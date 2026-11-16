import "@/src/shared"
import { Button } from "@kobalte/core/button"
import { TextField } from "@kobalte/core/text-field"
import {
	createEffect,
	createMemo,
	createResource,
	createSignal,
	For,
	Show,
} from "solid-js"
import { render } from "solid-js/web"
import {
	createOutlineSearch,
	type OutlineMatch,
	readOutline,
	scheduleOutlineExports,
} from "@/src/outline"
import { keyAction } from "@/src/popup-keys"
import type { SendRequest } from "@/src/send-to-workflowy"
import { summarizeTabs } from "@/src/tabs"
import { readApiKey, writeApiKey } from "@/src/workflowy-settings"

const BOX = "rounded-md border border-gray-200 px-3 py-2 dark:border-slate-700"
const INPUT = `${BOX} bg-transparent placeholder:text-gray-400 focus:border-gray-400 focus:outline-none disabled:opacity-50 dark:placeholder:text-slate-500 dark:focus:border-slate-500`
const MUTED = "text-gray-500 dark:text-slate-400"
const HIGHLIGHT = "bg-gray-100 dark:bg-slate-800"

// `autofocus` only works while nothing else has focus, which is not the case once the
// popup moves to the note step.
const focusSoon = (input: HTMLInputElement) => requestAnimationFrame(() => input.focus())

// How Workflowy writes a date pill, for the one the note will follow.
const today = Temporal.Now.plainDateISO().toLocaleString("en-US", {
	day: "numeric",
	month: "short",
	weekday: "short",
	year: "numeric",
})

function MatchText(props: { match: OutlineMatch }) {
	return (
		<>
			<div class="line-clamp-2 wrap-anywhere">{props.match.name}</div>
			<div class={`line-clamp-2 text-[11px] wrap-anywhere ${MUTED}`}>
				{props.match.path.join(" › ")}
			</div>
		</>
	)
}

function SendTabs(props: { windowTabs: chrome.tabs.Tab[] }) {
	const [outline] = createResource(readOutline)
	const search = createMemo(() => {
		const entries = outline()
		return entries && createOutlineSearch(entries)
	})
	const [query, setQuery] = createSignal("")
	// -1 while no match is highlighted, when sending picks the first match.
	const [highlighted, setHighlighted] = createSignal(-1)
	// Set once a node is chosen, which moves the popup from the node step to the note step.
	const [target, setTarget] = createSignal<OutlineMatch>()
	const [note, setNote] = createSignal("")
	const [sending, setSending] = createSignal(false)
	const [error, setError] = createSignal("")
	// An empty query matches every node, so nothing is searched until something is typed.
	const matches = createMemo(() => {
		const find = search()
		return find && query().trim() ? find(query()) : []
	})
	const chosen = () => target() ?? matches()[highlighted()] ?? matches()[0]
	const selected = () => props.windowTabs.filter((tab) => tab.highlighted)

	createEffect(() => {
		document
			.getElementById(`match-${highlighted()}`)
			?.scrollIntoView({ block: "nearest" })
	})

	async function send(open: boolean) {
		const match = chosen()
		// A second send while the first runs would create a second batch.
		if (!match || sending()) return
		const active = props.windowTabs.find((tab) => tab.active) as chrome.tabs.Tab
		const request: SendRequest = {
			note: note().trim(),
			open,
			tabId: active.id as number,
			tabs: summarizeTabs(selected()),
			target: match.id,
		}
		setSending(true)
		try {
			await chrome.runtime.sendMessage(request)
			window.close()
		} catch (failure) {
			setError(String(failure))
			setSending(false)
		}
	}

	function act(event: KeyboardEvent & { currentTarget: HTMLInputElement }) {
		const input = event.currentTarget
		const action = keyAction(target() ? "note" : "node", {
			caretAtEnd: input.selectionStart === input.value.length,
			name: event.key,
			shift: event.shiftKey,
		})
		if (!action) return
		event.preventDefault()
		if (action === "highlight-next") {
			setHighlighted((index) => Math.min(index + 1, matches().length - 1))
		} else if (action === "highlight-previous") {
			setHighlighted((index) => Math.max(index - 1, 0))
		} else if (action === "write-note") {
			setTarget(chosen())
		} else {
			send(action === "send-and-open")
		}
	}

	return (
		<section class="flex flex-col gap-3 p-4">
			<h1 class="font-semibold">
				Send {selected().length} of {props.windowTabs.length} tabs
			</h1>
			<Show
				fallback={
					<>
						<TextField
							disabled={sending()}
							onChange={(value) => {
								setQuery(value)
								setHighlighted(-1)
							}}
							value={query()}
						>
							<TextField.Input
								aria-activedescendant={
									highlighted() >= 0
										? `match-${highlighted()}`
										: undefined
								}
								aria-autocomplete="list"
								aria-controls="matches"
								aria-expanded={matches().length > 0}
								aria-label="Workflowy node"
								class={`w-full ${INPUT}`}
								onKeyDown={act}
								placeholder="Find a Workflowy node"
								ref={focusSoon}
								role="combobox"
							/>
						</TextField>
						{/* Matches scroll here so the API key section is never pushed out of view. */}
						{/* Keyboard focus stays in the search box, which points at the highlighted match
						    through aria-activedescendant; a press on a match is handled on pointerdown with
						    the default prevented, so the search box never loses focus to it. */}
						<div
							class="-mx-2 flex max-h-80 flex-col overflow-y-auto"
							id="matches"
							role="listbox"
						>
							<For each={matches()}>
								{(match, index) => (
									<div
										aria-selected={index() === highlighted()}
										class="flex cursor-default flex-col gap-0.5 rounded-md px-2 py-1.5 aria-selected:bg-gray-100 dark:aria-selected:bg-slate-800"
										id={`match-${index()}`}
										onPointerDown={(event) => {
											event.preventDefault()
											setTarget(match)
										}}
										onPointerMove={() => setHighlighted(index())}
										role="option"
										tabIndex={-1}
									>
										<MatchText match={match} />
									</div>
								)}
							</For>
						</div>
						<Show
							when={outline() && query().trim() && matches().length === 0}
						>
							<p class={MUTED}>No matching node</p>
						</Show>
					</>
				}
				when={target()}
			>
				{(node) => (
					<>
						<div
							class={`flex flex-col gap-0.5 rounded-md px-2 py-1.5 ${HIGHLIGHT}`}
						>
							<MatchText match={node()} />
						</div>
						<TextField
							disabled={sending()}
							onChange={setNote}
							value={note()}
						>
							<div
								class={`flex items-center gap-2 ${BOX} focus-within:border-gray-400 dark:focus-within:border-slate-500`}
							>
								<span
									class={`shrink-0 rounded px-1.5 py-0.5 text-[11px] ${HIGHLIGHT}`}
								>
									{today}
								</span>
								<TextField.Input
									aria-label="Note after the date"
									class="min-w-0 flex-1 bg-transparent placeholder:text-gray-400 focus:outline-none dark:placeholder:text-slate-500"
									onKeyDown={act}
									placeholder="Add a note"
									ref={focusSoon}
								/>
							</div>
						</TextField>
					</>
				)}
			</Show>
			<Show when={outline.state === "ready" && !outline()}>
				<p class={MUTED}>
					Search isn't ready yet. Save your API key below, then reopen this
					popup.
				</p>
			</Show>
			<Show when={sending()}>
				<p class={MUTED}>Sending…</p>
			</Show>
			<Show when={error()}>
				<p class="text-red-600 dark:text-red-400">{error()}</p>
			</Show>
		</section>
	)
}

function ApiKey() {
	const [stored] = createResource(readApiKey)
	const [draft, setDraft] = createSignal<string>()
	const [saved, setSaved] = createSignal(false)
	const apiKey = () => draft() ?? stored() ?? ""

	// Saving also exports the outline right away, so search works without waiting for
	// the hourly export.
	async function save(event: SubmitEvent) {
		event.preventDefault()
		await writeApiKey(apiKey())
		await scheduleOutlineExports()
		setSaved(true)
	}

	return (
		<section class="border-t border-gray-200 p-4 dark:border-slate-700">
			<form onSubmit={save}>
				<TextField
					class="flex flex-col gap-2"
					onChange={(value) => {
						setDraft(value)
						setSaved(false)
					}}
					value={apiKey()}
				>
					<TextField.Label class="font-semibold">
						Workflowy API key
					</TextField.Label>
					<div class="flex gap-2">
						<TextField.Input
							class={`min-w-0 flex-1 ${INPUT}`}
							type="password"
						/>
						<Button
							class="rounded-md bg-gray-800 px-3 py-2 font-medium text-white hover:bg-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-400 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200"
							type="submit"
						>
							Save key
						</Button>
					</div>
					<TextField.Description class={`text-[11px] ${MUTED}`}>
						{saved()
							? "Key saved. Reopen in a minute to search."
							: "Get yours at workflowy.com/api-key."}
					</TextField.Description>
				</TextField>
			</form>
		</section>
	)
}

function Popup() {
	const [tabs] = createResource(() => chrome.tabs.query({ currentWindow: true }))

	return (
		<main class="flex w-sm flex-col text-xs">
			<Show when={tabs()}>
				{(windowTabs) => <SendTabs windowTabs={windowTabs()} />}
			</Show>
			<ApiKey />
		</main>
	)
}

const root = document.getElementById("root")

if (root) {
	render(() => <Popup />, root)
}
