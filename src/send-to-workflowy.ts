import type { TabSummary } from "@/src/tabs"
import { deepLink, sendTabs } from "@/src/workflowy"
import { readApiKey } from "@/src/workflowy-settings"

// What the popup asks the service worker to send. The worker does the sending because
// Chrome closes the popup when it loses focus, and opening the app takes the focus.
export type SendRequest = {
	// The text after the date pill, possibly empty.
	note: string
	// Whether to open the new node in the desktop app afterwards.
	open: boolean
	// The tab that hands the deep link to the desktop app.
	tabId: number
	tabs: TabSummary[]
	// The short id of the node the tabs go under.
	target: string
}

export async function sendToWorkflowy({ note, open, tabId, tabs, target }: SendRequest) {
	const batch = await sendTabs({
		apiKey: await readApiKey(),
		date: Temporal.Now.plainDateISO().toString(),
		note,
		tabs,
		target,
	})
	if (open) await chrome.tabs.update(tabId, { url: deepLink(batch) })
}
