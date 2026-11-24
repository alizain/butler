import type { TabSummary } from "@/src/tabs"
import { sendTabs } from "@/src/workflowy"
import { readApiKey } from "@/src/workflowy-settings"

// What the popup asks the service worker to send. The worker does the sending because
// Chrome closes the popup when it loses focus.
export type SendRequest = {
	// The text after the date pill, possibly empty.
	note: string
	tabs: TabSummary[]
	// The short id of the node the tabs go under.
	target: string
}

export async function sendToWorkflowy(request: SendRequest) {
	await sendTabs({
		apiKey: await readApiKey(),
		date: Temporal.Now.plainDateISO().toString(),
		...request,
	})
}
