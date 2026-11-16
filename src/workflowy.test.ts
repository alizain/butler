import { fileURLToPath } from "node:url"
import { gunzipSync } from "node:zlib"
import nock from "nock"
import { expect, test } from "vitest"
import { createOutlineSearch, indexOutline } from "@/src/outline"
import {
	callApi,
	createNode,
	type ExportedNode,
	exportNodes,
	sendTabs,
} from "@/src/workflowy"

// Replays a recording of the real Workflowy API, and any request missing from it fails.
// To re-record, set WORKFLOWY_API_KEY: the tests then write for real, under TEST_TARGET.
const apiKey = process.env.WORKFLOWY_API_KEY ?? ""
// The short id of a node that exists in Workflowy solely to be written to by these tests.
const TEST_TARGET = "49f181ed2ae5"

nock.back.fixtures = fileURLToPath(new URL("./__fixtures__", import.meta.url))
nock.back.setMode(apiKey ? "update" : "lockdown")

type WorkflowyNode = {
	data: { layoutMode: string }
	id: string
	name: string
	priority: number
}
type Outline = { children: Outline[]; layout: string; name: string }

function outline(node: WorkflowyNode, children: Outline[]): Outline {
	return { children, layout: node.data.layoutMode, name: node.name }
}

async function children(id: string): Promise<Outline[]> {
	const { nodes } = await callApi<{ nodes: WorkflowyNode[] }>(
		apiKey,
		`nodes?parent_id=${id}`,
	)
	nodes.sort((a, b) => a.priority - b.priority)
	return Promise.all(nodes.map(async (node) => outline(node, await children(node.id))))
}

// An export holds the whole outline. A test searches only the subtree it built, with its
// root made top-level, and the recording keeps only that subtree, so recording and replay
// see the same nodes and nothing else from the outline reaches disk or test output.
function subtree(nodes: ExportedNode[], root: string): ExportedNode[] {
	const byId = new Map(nodes.map((node) => [node.id, node]))
	const inside = (node: ExportedNode) => {
		for (
			let current: ExportedNode | undefined = node;
			current;
			current = current.parent_id === null ? undefined : byId.get(current.parent_id)
		) {
			if (current.id === root) return true
		}
		return false
	}
	return nodes
		.filter(inside)
		.map((node) => (node.id === root ? { ...node, parent_id: null } : node))
}

// Real ids become placeholders, consistently, so the recording still says which request
// created the node a later one refers to. Workflowy gzips its responses and nock records
// them as hex-encoded gzip, so they are decoded first: the ids inside can only be replaced
// in plain JSON, and replay then serves plain JSON. The response headers are dropped:
// their content-encoding would describe the gzip rather than the decoded body, and
// nothing else in them is read.
function normalize(definitions: nock.Definition[], exportRoot?: string): string {
	const decoded = definitions.map(({ rawHeaders, response, ...definition }) => {
		const body = Array.isArray(response)
			? JSON.parse(gunzipSync(Buffer.from(response.join(""), "hex")).toString())
			: response
		return {
			...definition,
			response:
				definition.path === "/api/v1/nodes-export"
					? { nodes: subtree(body.nodes, exportRoot as string) }
					: body,
		}
	})
	let recording = JSON.stringify(decoded, null, "\t")
	const ids = new Set(recording.match(/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}/g))
	for (const [index, id] of [...ids].entries()) {
		const placeholder = `00000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`
		recording = recording.replaceAll(id, placeholder)
	}
	return recording
}

test("sends tabs as a dated, noted node holding each tab's URL, with its title beneath", async () => {
	const { context, nockDone } = await nock.back("send-tabs.json", {
		afterRecord: (definitions) => normalize(definitions),
	})

	const tabs = [
		{ title: "Example A", url: "https://example.com/a" },
		{ title: "Example B", url: "https://example.com/b" },
	]
	const batch = await sendTabs({
		apiKey,
		date: "2026-11-15",
		note: "Reading for the trip",
		tabs,
		target: TEST_TARGET,
	})
	const { node } = await callApi<{ node: WorkflowyNode }>(apiKey, `nodes/${batch}`)
	const sent = outline(node, await children(batch))

	nockDone()
	context.assertScopesFinished()
	expect(sent).toEqual({
		children: [
			{
				children: [{ children: [], layout: "bullets", name: "Example A" }],
				layout: "bullets",
				name: '<a href="https://example.com/a">https://example.com/a</a>',
			},
			{
				children: [{ children: [], layout: "bullets", name: "Example B" }],
				layout: "bullets",
				name: '<a href="https://example.com/b">https://example.com/b</a>',
			},
		],
		layout: "bullets",
		name: '<time startYear="2026" startMonth="11" startDay="15">Sun, Nov 15, 2026</time> Reading for the trip',
	})
})

test("ranks live nodes by name, word starts, depth and sibling order", async () => {
	let root = ""
	const { context, nockDone } = await nock.back("outline.json", {
		afterRecord: (definitions) => normalize(definitions, root),
	})

	// Each ranking term decides one pair below: without the word-start bonus "Keynotes"
	// comes first, without sibling order "Travel notes" passes "Notes on travel", and
	// without depth "My notes" comes first.
	root = await createNode(apiKey, { name: "Ranking", parent_id: TEST_TARGET })
	const child = (name: string) =>
		createNode(apiKey, { name, parent_id: root, position: "bottom" })
	await child("Keynotes")
	await child("Notes on travel")
	const travel = await child("Travel notes")
	await createNode(apiKey, { name: "My notes", parent_id: travel })
	const done = await child("Completed notes")
	await createNode(apiKey, { name: "Notes under a completed node", parent_id: done })
	await callApi(apiKey, `nodes/${done}/complete`, { method: "POST" })
	const search = createOutlineSearch(
		indexOutline(subtree(await exportNodes(apiKey), root)),
	)
	const matches = search("notes")

	nockDone()
	context.assertScopesFinished()
	expect(matches.map(({ name, path }) => ({ name, path }))).toEqual([
		{ name: "Notes on travel", path: ["Ranking"] },
		{ name: "Travel notes", path: ["Ranking"] },
		{ name: "Keynotes", path: ["Ranking"] },
		{ name: "My notes", path: ["Ranking", "Travel notes"] },
	])
})
