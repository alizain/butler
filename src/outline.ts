import Fuse from "fuse.js"
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
	// Workflowy's order among siblings: lower comes first.
	priority: number
}

export type OutlineMatch = {
	id: string
	name: string
	// The names of the node's ancestors, outermost first.
	path: string[]
}

const ENTITIES: Record<string, string> = { amp: "&", gt: ">", lt: "<", quot: '"' }

// Names are HTML: tags for links, date pills, mentions and formatting, and these four
// entities for literal text. One pass decodes them, so "&amp;lt;" stays "&lt;".
function plainText(html: string): string {
	return html
		.replace(/<[^>]*>/g, "")
		.replace(/&(amp|gt|lt|quot);/g, (_, entity: string) => ENTITIES[entity])
}

export function indexOutline(nodes: ExportedNode[]): OutlineEntry[] {
	const byId = new Map(nodes.map((node) => [node.id, node]))
	const live = nodes.filter((node) => {
		for (
			let current: ExportedNode | undefined = node;
			current;
			current = current.parent_id === null ? undefined : byId.get(current.parent_id)
		) {
			if (current.completed) return false
		}
		return true
	})
	// A live node's parent is live too, so every parent has a position.
	const position = new Map(live.map((node, index) => [node.id, index]))
	return live.map((node) => ({
		id: node.id.slice(-12),
		name: plainText(node.name),
		parent: node.parent_id === null ? -1 : (position.get(node.parent_id) as number),
		priority: node.priority,
	}))
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

// 0 for a parent's first live child, 1 for its last.
function siblingPlaces(outline: OutlineEntry[]): number[] {
	const children = new Map<number, number[]>()
	outline.forEach((entry, index) => {
		const siblings = children.get(entry.parent) ?? []
		siblings.push(index)
		children.set(entry.parent, siblings)
	})
	const place: number[] = []
	for (const siblings of children.values()) {
		siblings.sort((a, b) => outline[a].priority - outline[b].priority)
		siblings.forEach((index, k) => {
			place[index] = siblings.length > 1 ? k / (siblings.length - 1) : 0
		})
	}
	return place
}

export function createOutlineSearch(
	outline: OutlineEntry[],
): (query: string) => OutlineMatch[] {
	const ancestors = (index: number) => {
		const path: number[] = []
		for (
			let parent = outline[index].parent;
			parent !== -1;
			parent = outline[parent].parent
		) {
			path.unshift(parent)
		}
		return path
	}
	const depth = outline.map((_, index) => ancestors(index).length)
	const place = siblingPlaces(outline)
	const nameWords = outline.map((entry) => words(entry.name))
	const fuse = new Fuse(outline, {
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
					DEPTH_PENALTY * depth[refIndex] +
					SIBLING_PENALTY * place[refIndex] -
					WORD_START_BONUS * wordStarts(refIndex),
			}))
			.sort((a, b) => a.rank - b.rank)
			.slice(0, MATCHES)
			.map(({ index }) => ({
				id: outline[index].id,
				name: outline[index].name,
				path: ancestors(index).map((parent) => outline[parent].name),
			}))
	}
}

const OUTLINE = "outline"

// Undefined until the first export has been stored.
export async function readOutline(): Promise<OutlineEntry[] | undefined> {
	const stored = await chrome.storage.local.get<{ [OUTLINE]?: OutlineEntry[] }>(OUTLINE)
	return stored[OUTLINE]
}

// The export and the parsed nodes are locals, so nothing holds them once this returns.
export async function refreshOutline() {
	const outline = indexOutline(await exportNodes(await readApiKey()))
	await chrome.storage.local.set({ [OUTLINE]: outline })
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
