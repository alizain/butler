// Background service worker for butler extension

import manifest from "@/public/manifest.json"
import { refreshOutline, scheduleOutlineExports } from "@/src/outline"
import { type SendRequest, sendToWorkflowy } from "@/src/send-to-workflowy"
import { type OpenLinksRequest, openLinks, summarizeTabs } from "@/src/tabs"

chrome.runtime.onInstalled.addListener(() => {
	chrome.contextMenus.create({
		contexts: ["tab"],
		id: "send-to-workflowy",
		title: "Send tabs to Workflowy...",
	})
	chrome.contextMenus.create({
		contexts: ["tab"],
		id: "copy-selected-tabs",
		title: "Copy tabs",
	})
	scheduleOutlineExports()
})

chrome.contextMenus.onClicked.addListener(async ({ menuItemId }, tab) => {
	if (menuItemId === "send-to-workflowy") {
		await chrome.action.openPopup()
	} else if (menuItemId === "copy-selected-tabs" && tab) {
		const selected = tab.highlighted
			? await chrome.tabs.query({ highlighted: true, windowId: tab.windowId })
			: [tab]
		selected.sort((a, b) => a.index - b.index)
		const text = summarizeTabs(selected)
			.map(({ url, title }) => `${url}\n\t${title}\n`)
			.join("\n")
		await navigator.clipboard.writeText(text)
	}
})

chrome.commands.onCommand.addListener(async (command) => {
	if (command !== "open-links") return
	const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
	if (tab?.id === undefined) return
	const popup = manifest.action.default_popup
	await chrome.action.setPopup({ popup: `${popup}#open-links`, tabId: tab.id })
	try {
		await chrome.action.openPopup({ windowId: tab.windowId })
	} finally {
		await chrome.action.setPopup({ popup, tabId: tab.id })
	}
})

chrome.alarms.onAlarm.addListener(() => refreshOutline())

chrome.runtime.onMessage.addListener((request: SendRequest | OpenLinksRequest) =>
	"urls" in request ? openLinks(request) : sendToWorkflowy(request),
)
