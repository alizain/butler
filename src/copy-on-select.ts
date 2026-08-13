// Copy the current selection to the clipboard whenever it settles.
//
// selectionchange is the standard "the selection changed" signal, but it fires
// once per mousemove during a drag (measured: 20x for a single drag). The
// debounce collapses that burst into one clipboard write.

const SETTLE_MS = 100

let timer: ReturnType<typeof setTimeout> | undefined

document.addEventListener("selectionchange", () => {
	clearTimeout(timer)
	timer = setTimeout(copySelection, SETTLE_MS)
})

function copySelection() {
	if (selectionIsEditable()) return

	// Chrome reports isCollapsed as true for a fully selected input, so
	// emptiness has to be read off the text itself.
	const text = document.getSelection()?.toString()
	if (!text) return

	// Rejects when the document isn't focused, or when a cross-origin frame
	// withholds clipboard-write. Nothing to do about either.
	navigator.clipboard.writeText(text).catch(() => {})
}

// Selecting inside a field the user can type into is usually a prelude to
// replacing the text, so copying there would destroy what they meant to paste.
function selectionIsEditable(): boolean {
	// Chrome reports anchorNode as BODY for input and textarea selections, so
	// those are only observable through the focused element, and a shadow root
	// hides the real field behind its host.
	let el = document.activeElement
	while (el?.shadowRoot?.activeElement) {
		el = el.shadowRoot.activeElement
	}

	// Readonly fields are display surfaces for things like API keys and
	// generated ids, and they can't lose data, so they should copy.
	if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
		return !el.readOnly
	}

	// Everything else follows what is selected rather than what is focused. When
	// focus sits in an editor but the selection is prose elsewhere, the prose is
	// what the user asked for.
	const node = document.getSelection()?.anchorNode
	const anchor = node instanceof HTMLElement ? node : node?.parentElement
	return anchor?.isContentEditable === true
}
