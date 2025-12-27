import "@/src/shared"
import { createSignal, onMount } from "solid-js"
import { render } from "solid-js/web"

function Popup() {
	const [tabCount, setTabCount] = createSignal<number | null>(null)
	const [error, setError] = createSignal<string | null>(null)

	onMount(async () => {
		try {
			const tabs = await chrome.tabs.query({ currentWindow: true })
			const content = tabs.map((t) => `${t.url}\n\t${t.title}\n`).join("\n")
			await navigator.clipboard.writeText(content)
			setTabCount(tabs.length)

			setTimeout(() => window.close(), 5000)
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to copy")
		}
	})

	return (
		<div class="w-60 p-4 bg-neutral-50 text-slate-900 font-medium">
			{error() ? (
				<p class="text-red-600">{error()}</p>
			) : tabCount() !== null ? (
				<p>
					Copied {tabCount()} tab{tabCount() === 1 ? "" : "s"}
				</p>
			) : (
				<p class="text-slate-500">Copying...</p>
			)}
		</div>
	)
}

const root = document.getElementById("root")

if (root) {
	render(() => <Popup />, root)
}
