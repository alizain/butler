import type { TabSummary } from "@/src/tabs"

const API = "https://workflowy.com/api/v1"

// `path` is relative to the API root, e.g. "nodes" or "nodes?parent_id=<id>".
export async function callApi<T>(
	apiKey: string,
	path: string,
	init?: RequestInit,
): Promise<T> {
	const response = await fetch(`${API}/${path}`, {
		...init,
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
	})
	if (!response.ok) {
		throw new Error(`Workflowy ${response.status}: ${await response.text()}`)
	}
	return (await response.json()) as T
}

type CreateNode = {
	name: string
	parent_id: string
	position?: "top" | "bottom"
}

export async function createNode(apiKey: string, node: CreateNode): Promise<string> {
	const { item_id } = await callApi<{ item_id: string }>(apiKey, "nodes", {
		body: JSON.stringify(node),
		method: "POST",
	})
	return item_id
}

// Creates one node under `target`, named with a date pill and then `note`, holding a
// child per tab: the tab's URL as a link, with its title beneath it. Returns the new
// node's id. Every node gets its own request so it is stored the way a typed one is:
// the API's multiline names would store the title as a paragraph rather than a bullet.
export async function sendTabs(
	apiKey: string,
	target: string,
	tabs: TabSummary[],
	date: string,
	note: string,
): Promise<string> {
	const name = note ? `[${date}] ${note}` : `[${date}]`
	const batch = await createNode(apiKey, { name, parent_id: target })
	// One at a time: "bottom" keeps tab order only if each node lands after the last.
	for (const tab of tabs) {
		const page = await createNode(apiKey, {
			name: `<a href="${tab.url}">${tab.url}</a>`,
			parent_id: batch,
			position: "bottom",
		})
		await createNode(apiKey, { name: tab.title, parent_id: page })
	}
	return batch
}

// The fields of an exported node that the outline index reads. `name` is HTML.
export type ExportedNode = {
	completed: boolean
	id: string
	name: string
	parent_id: string | null
	// The order among siblings: lower comes first.
	priority: number
}

// Every node in the outline, unordered. Workflowy allows one export a minute.
export async function exportNodes(apiKey: string): Promise<ExportedNode[]> {
	const { nodes } = await callApi<{ nodes: ExportedNode[] }>(apiKey, "nodes-export")
	return nodes
}

// Opens the node in the desktop app. A node's short id is the last 12 characters of its id.
export function deepLink(id: string): string {
	return `workflowy://workflowy.com/#/${id.slice(-12)}`
}
