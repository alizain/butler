import Fuse from "fuse.js"
import { find } from "linkifyjs"
import { type DefaultTreeAdapterTypes, parseFragment } from "parse5"
import { type ExportedNode, exportNodes } from "@/src/workflowy"
import { readApiKey } from "@/src/workflowy-settings"

// One live node of the cached outline. Completed nodes, and everything inside them, are
// left out entirely.
export type OutlineEntry = {
	// The 12-character short id, which the API accepts as a parent_id.
	id: string
	// The node's name as plain text.
	name: string
	// The parent's position in the same array, or -1 for a top-level node.
	parent: number
	depth: number
	// 0 for the first live sibling, 1 for the last.
	siblingPlace: number
	// This node's URLs followed by the own URLs of each direct child.
	openUrls: string[]
}

export type OutlineMatch = {
	id: string
	name: string
	// The names of the node's ancestors, outermost first.
	path: string[]
	openUrls: string[]
}

// Anchors contribute their destination once, even when their label is also a URL.
function content(html: string) {
	const urls: string[] = []
	const text: string[] = []
	function visit(node: DefaultTreeAdapterTypes.ChildNode, insideLink: boolean) {
		if ("value" in node) {
			text.push(node.value)
			if (!insideLink) {
				for (const link of find(node.value, "url")) {
					if (/^https?:\/\//i.test(link.value) && URL.canParse(link.value))
						urls.push(link.value)
				}
			}
		} else if ("tagName" in node) {
			if (node.tagName === "a") {
				const href = node.attrs.find((attr) => attr.name === "href")?.value
				if (href && /^https?:\/\//i.test(href) && URL.canParse(href))
					urls.push(href)
			}
			for (const child of node.childNodes)
				visit(child, insideLink || node.tagName === "a")
		}
	}
	for (const node of parseFragment(html).childNodes) visit(node, false)
	return { text: text.join(""), urls }
}

export function indexOutline(nodes: ExportedNode[]): OutlineEntry[] {
	const ids = new Set(nodes.map((node) => node.id))
	const children = new Map<string | null, ExportedNode[]>()
	for (const node of nodes) {
		if (node.completed) continue
		const parent = node.parent_id && ids.has(node.parent_id) ? node.parent_id : null
		const siblings = children.get(parent) ?? []
		siblings.push(node)
		children.set(parent, siblings)
	}

	const outline: OutlineEntry[] = []
	function visitChildren(parentId: string | null, parent: number, depth: number) {
		const siblings = children.get(parentId) ?? []
		siblings.sort((a, b) => a.priority - b.priority)
		siblings.forEach((node, i) => {
			const name = content(node.name)
			const openUrls = name.urls
			if (node.note) openUrls.push(...content(node.note).urls)
			// Append only this node's content, before visiting its children.
			if (parent !== -1) outline[parent].openUrls.push(...openUrls)
			const index = outline.length
			outline.push({
				depth,
				id: node.id.slice(-12),
				name: name.text,
				openUrls,
				parent,
				siblingPlace: siblings.length > 1 ? i / (siblings.length - 1) : 0,
			})
			visitChildren(node.id, index, depth + 1)
		})
	}
	visitChildren(null, -1, 0)
	return outline
}

// A rank adds these to Fuse's score, which runs from 0 (exact) to 1 (no match), and the
// lowest rank comes first. For scale, the same exact match scores about 0.05 worse in a
// five-word name than in a one-word one.
// Per level below the top of the outline.
const DEPTH_PENALTY = 0.1
// For being the last of a parent's live children. The first child adds nothing.
const SIBLING_PENALTY = 0.05
// Subtracted when every query word starts a word of the name, in proportion otherwise.
const WORD_START_BONUS = 0.1
// How many typos a query word tolerates, from 0 (exact) to 1 (anything).
const THRESHOLD = 0.4
const MATCHES = 10

// Words as Fuse's token search splits them, so a word start here is a token start there.
const WORD = /[\p{L}\p{M}\p{N}_]+/gu
const words = (text: string) => text.toLowerCase().match(WORD) ?? []

export function createOutlineSearch(
	outline: OutlineEntry[],
	linksOnly = false,
): (query: string) => OutlineMatch[] {
	const ancestors = (entry: OutlineEntry) => {
		const path: number[] = []
		for (let parent = entry.parent; parent !== -1; parent = outline[parent].parent) {
			path.unshift(parent)
		}
		return path
	}
	const candidates = linksOnly
		? outline.filter((node) => node.openUrls.length > 0)
		: outline
	const nameWords = candidates.map((entry) => words(entry.name))
	const fuse = new Fuse(candidates, {
		includeScore: true,
		keys: ["name"],
		// The rank below decides the order.
		shouldSort: false,
		threshold: THRESHOLD,
		tokenize: WORD,
		// Every word of the query must match, in any order, each one fuzzily.
		tokenMatch: "all",
		useTokenSearch: true,
	})
	return (query) => {
		const queryWords = words(query)
		const wordStarts = (index: number) =>
			queryWords.filter((q) => nameWords[index].some((word) => word.startsWith(q)))
				.length / queryWords.length
		return fuse
			.search(query)
			.map(({ refIndex, score }) => ({
				index: refIndex,
				rank:
					(score as number) +
					DEPTH_PENALTY * candidates[refIndex].depth +
					SIBLING_PENALTY * candidates[refIndex].siblingPlace -
					WORD_START_BONUS * wordStarts(refIndex),
			}))
			.sort((a, b) => a.rank - b.rank)
			.slice(0, MATCHES)
			.map(({ index }) => ({
				id: candidates[index].id,
				name: candidates[index].name,
				openUrls: candidates[index].openUrls,
				path: ancestors(candidates[index]).map((parent) => outline[parent].name),
			}))
	}
}

const OUTLINE = "outlineWithLinks"

// Undefined until the first export has been stored.
export async function readOutline(): Promise<OutlineEntry[] | undefined> {
	const stored = await chrome.storage.local.get<{ [OUTLINE]?: OutlineEntry[] }>(OUTLINE)
	return stored[OUTLINE]
}

// The export and the parsed nodes are locals, so nothing holds them once this returns.
export async function refreshOutline() {
	const outline = indexOutline(await exportNodes(await readApiKey()))
	await chrome.storage.local.set({ [OUTLINE]: outline })
	await chrome.storage.local.remove("outline")
}

// Exports now, then every hour. The alarm survives browser restarts until the extension
// updates, and every update schedules it again from onInstalled.
export function scheduleOutlineExports(): Promise<void> {
	return chrome.alarms.create("export-outline", {
		periodInMinutes: 60,
		persistAcrossSessions: true,
		when: Date.now(),
	})
}
