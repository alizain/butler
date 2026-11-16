import { expect, test } from "vitest"
import { keyAction } from "@/src/popup-keys"

const press = (name: string, shift = false, caretAtEnd = true) => ({
	caretAtEnd,
	name,
	shift,
})

test("the node step highlights with ↓ and ↑, goes to the note with →, and sends with Enter", () => {
	expect(keyAction("node", press("ArrowDown"))).toBe("highlight-next")
	expect(keyAction("node", press("ArrowUp"))).toBe("highlight-previous")
	expect(keyAction("node", press("ArrowRight"))).toBe("write-note")
	expect(keyAction("node", press("ArrowRight", false, false))).toBeUndefined()
	expect(keyAction("node", press("Enter"))).toBe("send")
	expect(keyAction("node", press("Enter", true))).toBe("send-and-open")
})

test("the note step sends with Enter and leaves the arrows to the text box", () => {
	expect(keyAction("note", press("Enter"))).toBe("send")
	expect(keyAction("note", press("Enter", true))).toBe("send-and-open")
	expect(keyAction("note", press("ArrowRight"))).toBeUndefined()
	expect(keyAction("note", press("ArrowDown"))).toBeUndefined()
})
