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
