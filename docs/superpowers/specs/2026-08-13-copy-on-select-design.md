# Copy on select

## Goal

Selecting text on a page copies it to the clipboard. Silent, always on, no settings.

## Why this document exists

Two established extensions solve this problem, and both hand-roll a mouse-gesture classifier to do it: [Copy-On-Select](https://github.com/micpob/Copy-On-Select) and [Auto-Copy](https://github.com/jamiephill/Auto-Copy). Auto-Copy's changelog spans sixteen years and reads as one bug repeated: *copy fired on deselection*, *multiple copies on double/triple click*, *double-click failed after a triple-click*, *selection in a text field copied when the cursor left the field before mouseup*. Every entry is a consequence of inferring "the user finished selecting" from raw `mousedown`/`mouseup` coordinates and click counts.

The platform now answers that question directly. This design uses the standard signal and accepts the behavioural differences that follow, rather than reconstructing intent from mouse arithmetic. Every claim below was measured in Chrome, not read off a documentation page.

## What the platform actually provides

### selectionchange is the signal, but it is not "selection finished"

MDN states the event "fires once at the end of a selection operation". That is wrong. The [Selection API](https://w3c.github.io/selection-api/) coalescing flag only dedupes events scheduled within a single task, and a drag produces one task per `mousemove`.

Measured event counts for one gesture:

| Gesture | `selectionchange` events | Ordering relative to `pointerup` |
| --- | --- | --- |
| Drag-select | 20 | all before |
| Double-click | 1 | after |
| Triple-click | 1 | after |
| Click on blank area | 1 (empty selection) | after |

A debounce is therefore required, not as a correctness heuristic but to stop a single drag issuing twenty clipboard writes. Twenty writes would flood clipboard-manager history and burn twenty async API calls for one user action.

### The selection is fresh before the event fires

On a double-click, `document.getSelection()` returns `"quick"` at `mouseup` time, before the corresponding `selectionchange` fires. The selection state is updated synchronously; only the event is deferred to a task.

### isCollapsed lies inside form fields

With all 29 characters of an `<input>` selected, Chrome reports `isCollapsed: true` while `toString()` returns the full value. Emptiness must be tested with `toString().length`, never `isCollapsed`. Auto-Copy carries a comment about this; it is real and it is load-bearing.

### The clipboard is secure-context only

`Clipboard` is `[SecureContext]` in the [Clipboard API IDL](https://w3c.github.io/clipboard-apis/), so `navigator.clipboard` is `undefined` on `http:` pages. A content script inherits the page's context, so auto-copy cannot work on plain-http sites. Copy-On-Select patches this with an `execCommand` fallback; we take the difference instead.

Declaring `clipboardWrite` removes the transient-activation requirement for content scripts. Butler already declares it.

Offscreen documents cannot use `navigator.clipboard` at all, because of the API's document-focus requirement. This is why butler's existing tab-copy feature uses `execCommand` inside the offscreen document. That code is correct and stays as it is. The content script writes the clipboard directly and must not route through the service worker.

## Design

```
selectionchange  ->  debounce 100ms  ->  skip if editable  ->  skip if empty  ->  writeText
```

The whole feature is one file with no imports, no state beyond a timer handle, and no settings.

### src/copy-on-select.ts

```ts
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

	const text = document.getSelection()?.toString()
	if (!text) return

	// Rejects when the document isn't focused, or when a cross-origin frame
	// withholds clipboard-write. Nothing to do about either.
	navigator.clipboard.writeText(text).catch(() => {})
}

// Selecting inside a field the user can type into is usually a prelude to
// replacing the text, so copying there would destroy what they meant to paste.
function selectionIsEditable(): boolean {
	let el = document.activeElement
	while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement

	if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
		return !el.readOnly
	}
	if (el instanceof HTMLElement && el.isContentEditable) return true

	const node = document.getSelection()?.anchorNode
	const anchor = node instanceof Element ? node : node?.parentElement
	return anchor?.isContentEditable === true
}
```

### Two invariants the implementation must preserve

**Read the selection only in the commit, never in the listener.** `toString()` is O(size of selection). Reading it per event would stringify a large selection twenty times per drag for nothing.

**Test emptiness with `toString()`, never `isCollapsed`.** See the measurement above.

## Editable detection

Both obvious approaches have holes, and the holes are in different places:

- `activeElement` alone (Copy-On-Select's approach) **fails on shadow DOM** — a text input inside a web component reports the shadow *host*, so its contents get copied.
- An `anchorNode` ancestor walk alone **fails on every `input`/`textarea`** — Chrome reports `anchorNode: BODY` for those selections.

The union of both, with shadow piercing, passes every case. Validated with real mouse drags:

| Case | Expected | Result |
| --- | --- | --- |
| plain prose | copy | pass |
| `input[text]` | skip | pass |
| `input[email]` | skip | pass |
| `input[number]` | skip | pass |
| `input[password]` | skip | pass |
| `input[search]` | skip | pass |
| `textarea` | skip | pass |
| `contenteditable` | skip | pass |
| `contenteditable="false"` | copy | pass |
| `input[readonly]` | copy | pass |
| rich editor, focus on wrapper | skip | pass |
| shadow-root input | skip | pass |
| shadow-root contenteditable | skip | pass |
| `designMode="on"` | skip | pass |
| unfocused contenteditable | skip | pass |

### Why each branch exists

Each was checked by finding the case that fails without it.

- **Shadow-piercing loop** — without it, a text input inside a web component copies its contents.
- **`activeElement` branch** — the only way to observe `input`/`textarea` selections, since `anchorNode` reports `BODY` for them.
- **`anchorNode` branch** — the only way to catch a contenteditable whose focus sits on a non-editable wrapper, which is the shape ProseMirror and Slate use.
- **`!el.readOnly`** — readonly fields are display surfaces for API keys and generated IDs. They cannot lose data, so they should copy.

There is deliberately no `document.designMode === "on"` check. When designMode is on, `body.isContentEditable` becomes true and the `activeElement` branch already covers it. Verified.

### Why no input-type allowlist

`selectionStart` looks like the correct native discriminator for "is this a text-bearing input". It is a trap:

| input type | `selectionStart` | real drag selects text? |
| --- | --- | --- |
| text, search, password, tel, url | `0` | yes |
| **email, number** | **`null`** | **yes** |
| checkbox, radio, button, color, range, date, file | `null` | no |

Gating on `selectionStart !== null` would classify `<input type="email">` and `type="number"` as non-editable, so selecting an email address to retype it would stomp the clipboard. Any focused `input`/`textarea` counts as editable, with no type narrowing.

### Error polarity

Under-detecting an editable field costs the user clipboard data they wanted. Over-detecting costs one missed copy. These are not symmetric, so the detector biases toward skipping. A focused non-text control such as a checkbox, with prose selected elsewhere, is misread as editable — but a real mouse drag over prose moves focus to `BODY`, so it does not arise in practice, and the failure mode is a missed copy.

## Files changed

**`src/copy-on-select.ts`** (new) — the entire feature.

It does not go in `src/content/`. That directory already means the newtab essay components (`yc-advice.tsx`, `naval-on-tinkering.tsx`); putting a content script there would fuse two unrelated concepts under one name.

**`public/manifest.json`** — add:

```json
"content_scripts": [{
	"js": ["copy-on-select.js"],
	"matches": ["https://*/*"],
	"all_frames": true,
	"run_at": "document_start"
}]
```

`clipboardWrite` is already declared. No new permission entries, and no `storage` since there are no settings. The `matches` pattern adds the "Read your data on all websites" install warning. `run_at: document_start` is safe because only `document` is touched at registration, never `document.body`.

**`vite.config.ts`** — add a rolldown input for the content script and emit it at the bundle root with a stable, unhashed name, as `background` already is. MV3 content scripts cannot be ES modules; verified that rolldown emits zero `import`/`export` statements for a self-contained entry, so the output loads as a classic script.

## Accepted differences

Each is a deliberate trade, not an oversight.

1. **No auto-copy on `http:` pages.** `Clipboard` is `[SecureContext]`.
2. **Cross-origin iframes without `allow="clipboard-write"` fail silently.**
3. **Multiple writes per gesture.** A mid-drag pause over 100ms writes twice; a triple-click writes the word and then the paragraph. The final clipboard contents are correct in both cases.
4. **Script-driven selections get copied.** A page calling `addRange()` triggers a copy. There is no native way to distinguish user-driven from script-driven selection changes; gating on `navigator.userActivation.isActive` was tried and did not suppress it.
5. **Keyboard selection in page prose does not fire.** Chrome does not extend a selection with shift+arrow outside editable content unless caret browsing is enabled, so there is nothing to copy.

## Verification

The repository has no test infrastructure, and adding a framework for forty lines would be disproportionate. Verification is the Playwright harness that produced every measurement in this document — a page with prose, every input type, a textarea, contenteditable regions, a wrapper-focused rich editor, and two shadow roots — plus manual checks against the unpacked extension:

- drag-select prose, double-click a word, triple-click a paragraph
- click blank space and confirm nothing is copied
- select inside a textarea and confirm the clipboard is untouched
- select inside a readonly field and confirm it copies
- select inside an iframe
- confirm an `http:` page no-ops without console noise
