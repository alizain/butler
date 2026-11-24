export type TabSummary = {
	title: string
	url: string
}

export function summarizeTabs(tabs: chrome.tabs.Tab[]): TabSummary[] {
	return tabs.map((tab) => ({
		title: tab.title ?? "",
		url: tab.url ?? tab.pendingUrl ?? "",
	}))
}

export type OpenLinksRequest = { urls: string[]; windowId: number }

export async function openLinks({ urls, windowId }: OpenLinksRequest) {
	let firstTabId: number | undefined
	for (const url of urls) {
		const tab = await chrome.tabs.create({ active: false, url, windowId })
		firstTabId ??= tab.id
	}
	if (firstTabId !== undefined) await chrome.tabs.update(firstTabId, { active: true })
}
