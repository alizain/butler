type KeyAction =
	| "highlight-next"
	| "highlight-previous"
	| "write-note"
	| "send"
	| "send-and-open"

// The popup's keyboard, as one table. In the node step the search box has focus; in the
// note step, the box for the text after the date pill. "Send" picks the highlighted
// node, or the first match when none is highlighted.
export function keyAction(
	step: "node" | "note",
	key: { caretAtEnd: boolean; name: string; shift: boolean },
): KeyAction | undefined {
	if (key.name === "Enter") return key.shift ? "send-and-open" : "send"
	if (step === "note") return undefined
	if (key.name === "ArrowDown") return "highlight-next"
	if (key.name === "ArrowUp") return "highlight-previous"
	// Mid-query → still moves the caret; at the end of the query it has nothing else to do.
	if (key.name === "ArrowRight" && key.caretAtEnd) return "write-note"
	return undefined
}
