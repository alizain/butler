// Background service worker for butler extension

import { refreshOutline, scheduleOutlineExports } from "@/src/outline"
import { type SendRequest, sendToWorkflowy } from "@/src/send-to-workflowy"

chrome.runtime.onInstalled.addListener(() => {
	chrome.contextMenus.create({
		contexts: ["tab"],
		id: "send-to-workflowy",
		title: "Send to Workflowy…",
	})
	scheduleOutlineExports()
})

// The tab menu opens the same popup as the toolbar icon, in the window just clicked.
chrome.contextMenus.onClicked.addListener(() => chrome.action.openPopup())

chrome.alarms.onAlarm.addListener(() => refreshOutline())

// A rejected send rejects the popup's sendMessage with the error's message.
chrome.runtime.onMessage.addListener((request: SendRequest) => sendToWorkflowy(request))
