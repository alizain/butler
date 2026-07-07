// Background service worker for butler extension

const OFFSCREEN_PATH = "entrypoints/offscreen.html"
let creatingOffscreen: Promise<void> | null = null

type TabSummary = {
	title: string
	url: string
}

async function ensureOffscreenDocument() {
	const hasDocument = (await chrome.offscreen.hasDocument?.()) ?? false
	if (hasDocument) return

	if (!creatingOffscreen) {
		creatingOffscreen = chrome.offscreen
			.createDocument({
				justification: "Copy tab list to clipboard",
				reasons: [chrome.offscreen.Reason.CLIPBOARD],
				url: OFFSCREEN_PATH,
			})
			.finally(() => {
				creatingOffscreen = null
			})
	}

	await creatingOffscreen
}

async function closeOffscreenDocument() {
	const hasDocument = (await chrome.offscreen.hasDocument?.()) ?? false
	if (!hasDocument) return
	await chrome.offscreen.closeDocument()
}

async function copyToClipboard(text: string): Promise<boolean> {
	await ensureOffscreenDocument()
	try {
		const response = await chrome.runtime.sendMessage({ text, type: "copy" })
		return response?.success === true
	} finally {
		try {
			await closeOffscreenDocument()
		} catch (error) {
			console.warn("[butler bg] offscreen close failed:", error)
		}
	}
}

function summarizeTabs(tabs: chrome.tabs.Tab[]): TabSummary[] {
	return tabs.map((tab) => ({
		title: tab.title ?? "",
		url: tab.url ?? tab.pendingUrl ?? "",
	}))
}

function formatTabSummaries(tabs: TabSummary[]): string {
	return tabs.map((tab) => `${tab.url}\n\t${tab.title}\n`).join("\n")
}

async function copyTabsFromWindow(windowId: number): Promise<number> {
	const tabs = await chrome.tabs.query({ windowId })
	const summaries = summarizeTabs(tabs)
	const content = formatTabSummaries(summaries)
	const success = await copyToClipboard(content)
	if (!success) {
		throw new Error("Clipboard copy failed")
	}
	return tabs.length
}

// Copy all tabs in the current window when the action icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
	try {
		const windowId = tab?.windowId ?? chrome.windows.WINDOW_ID_CURRENT
		const count = await copyTabsFromWindow(windowId)

		chrome.action.setBadgeText({ text: String(count) })
		chrome.action.setBadgeBackgroundColor({ color: "#009966" })
		chrome.action.setBadgeTextColor({ color: "#ffffff" })
		setTimeout(() => chrome.action.setBadgeText({ text: "" }), 5000)
	} catch (error) {
		console.error("[butler bg] copy tabs error:", error)
		chrome.action.setBadgeText({ text: "✗" })
		chrome.action.setBadgeBackgroundColor({ color: "#c70036" })
		chrome.action.setBadgeTextColor({ color: "#ffffff" })
		setTimeout(() => chrome.action.setBadgeText({ text: "" }), 5000)
	}
})
