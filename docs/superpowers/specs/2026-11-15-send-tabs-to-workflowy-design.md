# Send tabs to Workflowy

## Goal

Select tabs in Chrome's vertical tab strip, open butler's popup with ⌘⇧O, the toolbar icon or a selected tab's right-click menu, find a Workflowy node by typing part of its name, optionally write a note, and the tabs land under that node as a new dated node. Enter sends; Shift+Enter sends and opens the new node in the Workflowy desktop app.

```
- <the node you picked>
  - [2026-11-15] <your note>       ← new node: date pill, then the note, if you wrote one
    - https://example.com/a
      - Title of tab a
    - https://example.com/b
      - Title of tab b
```

This supersedes the toolbar's copy-all-tabs, which copied every tab in the window to the clipboard for pasting into Workflowy by hand. Copy-all-tabs is retired and the toolbar icon opens the popup instead.

## Scope

- As a Chrome user, I can select tabs in the vertical tab strip and then press ⌘⇧O, click butler's toolbar icon, or right-click a selected tab and choose "Send to Workflowy…", and all three open the same popup with the node search focused, so that I can send from the keyboard or from wherever my mouse is.
- As a Chrome user, I can send without touching the mouse: ↓ and ↑ highlight a match, → takes the highlighted match (or the first) and moves me to a box for the note after the date pill, and Enter sends from either step with whatever I have, taking the first match when none is highlighted, so that sending is a few keystrokes.
- As a Chrome user, Enter sends and closes the popup, and Shift+Enter sends and opens the new node in the Workflowy desktop app, so that I choose each time whether to switch to Workflowy.
- As a Chrome user, the popup tells me how many tabs the window has and how many of them are selected to be sent, so that I know what I am sending.
- As a Workflowy user, I can type part of a node's name and pick it from up to ten matches, each shown with the path of its ancestors, so that I can send to any node without remembering where it lives.
- As a Workflowy user, matches are ranked by how well the name matches, by whether its words start with what I typed, by how near the top of the outline the node sits, and by how early it sits among its siblings, so that the node I mean comes first even when a slightly better match exists deeper down or further along its list.
- As a Workflowy user, completed nodes, and everything inside them, never appear as matches, so that I only send to live parts of my outline.
- As a Workflowy user, I find a new node at the top of the node I picked whose name is today's date pill followed by the note I wrote, or the date pill alone, so that the batch is labelled as I send it or I can label it later.
- As a Workflowy user, I find each sent tab under that node as its URL, stored as a link, with its title as the URL's child, in the order the tabs sit in the tab strip, every node stored the way a typed one is, so that the batch reads like the tab strip did and looks like I entered it.
- As a WorkFlowy desktop app user, Shift+Enter opens the app zoomed into the new node right after sending, so that I can keep writing there.
- As butler's owner, I paste my Workflowy API key into the popup once, where it stays masked, and search covers my outline as of at most an hour ago, so that setup is one step in the one place I already use and the popup never waits on Workflowy.

Done when each story holds in Chrome Canary with the unpacked extension and the WorkFlowy desktop app.

## What the platform provides

Every claim in this section comes from documentation read on 2026-11-15, from Chromium or library source, from files on this machine, or, where it says so, from recordings and measurements of the live Workflowy API. [Verify first](#verify-first) lists what is still to be measured.

### Chrome

- **Extensions can add items to a tab's right-click menu.** Chrome 150 added `"tab"` to `chrome.contextMenus.ContextType`: "Applies to the context menu of a tab in the tab strip." ([reference](https://developer.chrome.com/docs/extensions/reference/api/contextMenus#type-ContextType), [PSA](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/RReE8dtY4Ok/m/hOQaYDNYAwAJ)). The installed Canary is 160.0.8163.0.
- **The selection is the window's highlighted tabs.** Chrome calls multi-selected tabs *highlighted*. A tab-menu click carries only the right-clicked tab, so the selection is always read with `chrome.tabs.query`. Clicking the toolbar icon leaves the selection as it was (confirmed by hand).
- **Vertical tabs are the same tab strip, moved.** Chrome's help: "Vertical tabs move your tab strip to the side of your window." Multi-select is Cmd-click (individual tabs) and Shift-click (a range). ([help](https://support.google.com/chrome/answer/2391819))
- **`chrome.action.openPopup()` opens the action's popup from code** (all extensions since Chrome 127). Chromium's implementation refuses only when the window is not active or the action has no popup on the active tab; it does not check for a user gesture. A tab-menu click happens in the active window, and the popup is the action's `default_popup`.
- **An action with a popup never fires `action.onClicked`.** That is why copy-all-tabs, which lived on `onClicked`, could not stay once the toolbar icon opens the popup.
- **A popup closes as soon as it loses focus.** Opening the `workflowy://` link moves focus to the desktop app, so anything still running in the popup at that point is cut off.
- **A message listener may return a Promise** (Chrome 148+). Its value becomes the response, and a rejection rejects the sender's `sendMessage` with the error's message. ([messaging](https://developer.chrome.com/docs/extensions/develop/concepts/messaging))
- **An alarm created with `persistAcrossSessions: true` survives browser restarts** until the extension updates (Chrome 150+). Every update fires `runtime.onInstalled`. ([alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms))
- **A command named `_execute_action` opens the action's popup, with no handler of butler's own.** Its `suggested_key` is a suggestion: the binding is changed at `chrome://extensions/shortcuts`.

### Workflowy

- **One endpoint creates nodes.** `POST https://workflowy.com/api/v1/nodes` with `Authorization: Bearer <API key>`. It returns `{ "item_id": "<uuid>" }`. ([reference](https://workflowy.com/api-reference))
- **`parent_id` accepts a node's full ID, its 12-character short ID, or its URL.**
- **A node's short ID is the last 12 characters of its full ID.** The reference pairs `6ed4b9ca-…-d8754237b505` with `d8754237b505`. Butler builds links and parent IDs from it without extra requests.
- **`[YYYY-MM-DD]` in `name` becomes a date pill.** Recorded: `[2026-11-15]` is stored as `<time startYear="2026" startMonth="11" startDay="15">Sun, Nov 15, 2026</time>`.
- **A multiline `name` creates children, but not the way typing does, so butler does not use it.** The reference says "the first line becomes the parent node and subsequent lines become child nodes". Recorded on 2026-11-15, `"<url>\n\n<title>"` stored the title with `layoutMode: "p"` (a paragraph, not a bullet) and `note: ""`. A sub-bullet typed by hand is stored as `layoutMode: "bullets"` with `note: null`, and so is a node created by its own request.
- **A URL typed into Workflowy is stored as a link**, `<a href="<url>"><url></a>`. Bare URLs that butler sent were later rewritten into exactly that form. Sending the link form stores it that way from the start, and the API keeps `name` HTML as given.
- **`position` is `"top"` (default) or `"bottom"`.**
- **The REST API has no search.** The only way to see the whole outline is `GET /api/v1/nodes-export`, every node as a flat list with `parent_id`, `completed` and `priority` (the order among siblings, lower first), limited to one request a minute. Measured on 2026-11-15 on the owner's outline: 17,330 nodes, about 6 MB of JSON, between 0.6 and 4.2 seconds per export.
- **Names are HTML.** Measured on the owner's outline: tags `time`, `a`, `b`, `code`, `u`, `i`, `s` and `mention`, and the entities `&amp;`, `&quot;`, `&gt;` and `&lt;`, and nothing else.
- **The desktop app registers the `workflowy://` scheme.** `/Applications/WorkFlowy.app/Contents/Info.plist` declares `CFBundleURLSchemes: ["workflowy"]` (app 4.3.2611120800). Workflowy's [deep-links post](https://blog.workflowy.com/deep-links-open-links-directly-in-desktop-and-mobile-apps/) gives the form `workflowy://workflowy.com/#/<short id>`, which opens that node in the app.

**Butler talks to Workflowy only through the REST API.** The desktop app's Local MCP can search the app's live outline in milliseconds and could also write and zoom, but it only runs while the app is open with Local MCP on, butler would need its own MCP client, and its results are a text format made for AI tools. One interface for everything was chosen over a fresher search, and an hour of staleness is accepted. The `workflowy://` deep link is the app's own link scheme, not an API.

### Fuse.js

- **Token search is the matching rule.** With `useTokenSearch: true` and `tokenMatch: "all"`, every word of the query must match the name, in any order, each one fuzzily, and each word is searched anywhere in the name. ([Fuse.js](https://fusejs.io/token-search))
- **Scores run from 0 (exact) to 1 (no match), and longer names score worse.** The final score is the match score raised to `1/√(whitespace-separated words)`, so the same exact match scores 0.001 in a one-word name and about 0.046 in a five-word one. A URL counts as one word.
- **Where a word matches inside the name does not count.** Token search always ignores location, so "c" matches "Off**c**e" as well as it matches the "C" that starts "Catalogue". Butler adds a word-start bonus of its own.
- **The tokenizer is an option.** `tokenize` takes a global RegExp, and butler passes its word pattern, the same as Fuse's default, so "starts a word" in butler's bonus means the start of a Fuse token.
- **`shouldSort: false` with `includeScore: true` returns every match with its score, unsorted,** which lets butler compute each rank once and sort by it.
- **An empty query returns the first documents unfiltered,** so the popup does not search until something is typed.

### Kobalte

- **Kobalte supplies the popup's text fields and button; the popup owns its keyboard.** Kobalte is Solid's headless, accessible component library, and only the popup uses it. `src/global.css` is shared by every butler page, including the new tab page, so it carries no styling for this feature and stays as it was.
- **Kobalte's `Search` combobox is not used, because its keyboard model is not this popup's.** It runs a caller's key handler and then its own regardless, never checking `defaultPrevented`. Enter selects only a highlighted option, ← and → clear the highlight, and which option is highlighted is private state. The popup's rules read the highlight (→ and Enter take it, or the first match) and give → and Enter other meanings, so the popup keeps the highlight itself and renders the match list as a WAI-ARIA combobox: `role="combobox"` on the input, `role="listbox"` and `role="option"` on the list, and `aria-activedescendant` for the highlighted match.

## Design

```
hourly alarm, and right after an API key is saved
  → GET /nodes-export → index (live nodes only, plain-text names) → chrome.storage.local "outline"

⌘⇧O (the _execute_action command), toolbar icon, or tab menu "Send to Workflowy…" → popup
  → node step: search the stored outline; ↓ ↑ highlight; → or a press on a match takes a node
  → note step: the text after the date pill
  → Enter (send) or Shift+Enter (send and open) from either step
      → sendMessage({ target, tabs, tabId, note, open }) to the service worker
  → worker: POST "[date] note" under target → per tab: POST URL link, then POST title under it
  → worker, only when open: workflowy://workflowy.com/#/<new node> in the active tab
```

### The outline cache

`src/outline.ts` owns it. `scheduleOutlineExports()` creates the alarm `export-outline` with `when: now`, `periodInMinutes: 60` and `persistAcrossSessions: true`. The service worker calls it from `onInstalled`, so an export runs right after every install and update and then hourly. The popup calls it after saving an API key, so search works within a minute of setup rather than within the hour.

On the alarm, `refreshOutline()` exports, indexes, and overwrites one `chrome.storage.local` key. The index is an array of `{ id, name, parent, priority }`:

- `id` is the 12-character short ID, which both `parent_id` and the deep link accept.
- `name` is plain text: tags stripped, and the four entities decoded in one pass, so `&amp;lt;` stays `&lt;`.
- `parent` is the parent's position in the same array, or -1 at the top, so paths need no second lookup.
- `priority` is Workflowy's order among siblings, as exported.
- Completed nodes, and every node inside one, are dropped. Measured: 8,090 of 17,330 nodes are live, and the stored index is about 1 MB.

**Nothing holds the outline in memory for long.** The 6 MB export and the parsed nodes are locals of `refreshOutline`, so they are garbage once it returns, and Chrome stops an idle service worker anyway. The popup's copy lives only while the popup is open. Storage holds one key, overwritten each hour, so it does not grow. A module-level cache in the service worker is the leak to avoid, and there is none.

### Search and ranking

`createOutlineSearch(outline)` builds one Fuse index when the popup opens and returns a `query → matches` function. Each match carries the short ID, the name, and the ancestors' names, outermost first.

Fuse finds every match and scores it, and butler ranks each one once, lowest first, keeping ten:

```
rank = Fuse score
     + 0.1  × depth                   DEPTH_PENALTY: per level below the top of the outline
     + 0.05 × place among siblings    SIBLING_PENALTY: 0 for a parent's first live child, 1 for its last
     − 0.1  × share of query words    WORD_START_BONUS: query words that start a word of the name
```

The weights were tuned by hand against the owner's outline. They share Fuse's scale, on which the same exact match scores about 0.05 worse in a five-word name than in a one-word one, so each weight reads as "worth this many words of name quality":

- **Depth** makes a node high in the outline beat a slightly better match deep inside it, but not a much better one.
- **Sibling place** makes an early item in a list beat a slightly better match later in the same list. It divides by the number of live siblings, so the last item of a 3-item list and of a 300-item list pay the same. Only live siblings count, because completed ones are never shown.
- **The word-start bonus** restores what token search ignores: for "c", "Catalogue" and "Courses" beat "Family Office", whose only "c" sits inside "Office". Without it, a one-letter query matches almost every name equally well and structure alone decides.

The fuzziness is Fuse's `threshold`, set to 0.4: two-typo queries like "reveiw notes" still work, and gibberish matches only a handful of nodes (12 for "qwrtp"). Measured on the owner's 8,090 live nodes:

| threshold | "notes" | "notse" | "reveiw notes" | "proj" | "qwrtp" | one search |
|---|---|---|---|---|---|---|
| 0.6 | 6,940 | 6,759 | 1,807 | 2,797 | 3,520 | 27–81 ms |
| 0.4 | 2,099 | 2,113 | 54 | 716 | 12 | 18–66 ms |
| 0.3 | 119 | 120 | 0 | 716 | 0 | 20–51 ms |
| 0.2 | 119 | 120 | 0 | 80 | 0 | 9–45 ms |

The counts are matching nodes, of which the popup shows the best ten.

### The popup

`src/popup.tsx` is 24 rem wide, the width of Tailwind's `max-w-sm`, set as a fixed `w-sm` so the popup does not change width as matches come and go. It has two sections, divided by a hairline:

- **Send tabs**, first. Its title, "Send 3 of 12 tabs", names the action and both counts: the selected tabs and every tab in the window. Below it is one of two steps:
  - **The node step** has the search box, focused when the popup opens, and the ranked matches. Each match shows its name and its path, each cut off with an ellipsis after two lines; long unbroken text such as a URL wraps anywhere so the cut-off works. Matches scroll in their own area, so the key section below is never pushed out of view, and the highlighted match is scrolled into view. Until the first export has been stored, the section says search isn't ready and to save the API key, then reopen the popup.
  - **The note step** shows the chosen node and a box for the note, led by today's date as Workflowy writes it ("Mon, Nov 16, 2026"), so it reads as the text after the pill.
- **Workflowy API key**, below. See [Settings](#settings).

Both follow butler's palette: gray text and hairlines on white, slate in dark mode, which `src/global.css` already switches on the system setting.

The keyboard is one pure function, `keyAction(step, key)` in `src/popup-keys.ts`, so the rules live in one table:

| step | key | action |
|---|---|---|
| node | ↓ / ↑ | move the highlight |
| node | → at the end of the query | take the highlighted match, or the first, and go to the note step |
| node, note | Enter | send, then close the popup |
| node, note | Shift+Enter | send, then open the new node in Workflowy |

→ acts only at the end of the query because elsewhere it moves the caret, and that is where the caret is after typing. A press on a match does what → does. It acts on pointerdown with the default prevented, so keyboard focus never leaves the search box, which points at the highlighted match through `aria-activedescendant`. Sending takes the chosen node, else the highlighted match, else the first, and does nothing when there is no match. The highlight resets when the query changes, so a fresh query sends to its first match. The note is trimmed, and an empty note sends the date pill alone.

A send passes `{ target, tabs, tabId, note, open }` to the service worker and waits. The worker does the writes because the popup closes the moment focus leaves it. A rejected send rejects the popup's `sendMessage` (Chrome 148+), and the popup shows the error. A second send while one is running is ignored, because it would create a second batch.

### The send

`src/send-to-workflowy.ts` handles the request in the service worker:

1. Read the API key from `chrome.storage.local`.
2. Create the dated node: `{ parent_id: <picked short ID>, name: "[<today, local, YYYY-MM-DD>] <note>" }`, or the date alone when the note is empty. Position defaults to `"top"`.
3. For each selected tab, in order: `{ parent_id: <dated node>, name: '<a href="<tab.url>"><tab.url></a>', position: "bottom" }`, then `{ parent_id: <that node>, name: <tab.title> }`. Requests run one after another, because `"bottom"` only preserves order if each lands after the previous one.
4. Only for Shift+Enter: open `workflowy://workflowy.com/#/<dated node's short ID>` in the window's active tab, so the desktop app zooms into the new node.

A response that is not 2xx throws. A send of N tabs is 2N+1 requests.

Steps 2 and 3 talk only to Workflowy and live in `src/workflowy.ts` as `sendTabs({ apiKey, date, note, tabs, target })`, which takes one object because its arguments are mostly strings that would compile in any order. That file imports nothing from `chrome.*`, so it runs under Node and is tested against Workflowy's real behaviour without a fake Chrome. The date is computed on the Chrome side (`Temporal.Now.plainDateISO()`) and passed in, so `sendTabs` sends the same requests every time it gets the same input.

### Settings

The popup's second section has one masked field, **Workflowy API key** (from https://workflowy.com/api-key), and a **Save key** button; Enter in the field saves too. Saving writes the key, schedules an export right away so search works without waiting for the hour, and says "Key saved". Butler has no options page. `src/workflowy-settings.ts` owns the storage key. An unset key reads as empty, and Workflowy rejects it with a 401.

## Files changed

- **`public/manifest.json`**: the action gets `default_popup` and the logo icon, and `commands._execute_action` suggests ⌘⇧O (Ctrl+Shift+O elsewhere) for opening it. Permissions add `contextMenus`, `storage` and `alarms`, and drop `offscreen`. `clipboardWrite` stays because copy-on-select relies on it. `host_permissions` adds `https://workflowy.com/*` so the worker can call the API.
- **`src/background.ts`**: only wiring now: the tab-menu item, `openPopup` on its click, the export alarm, and the popup's send request.
- **`src/popup.tsx`** and **`entrypoints/popup.html`** (new): the popup, with both sections.
- **`src/popup-keys.ts`** (new): the popup's keyboard as one pure function, with its test beside it.
- **`src/outline.ts`** (new): the outline cache, its index, and the search.
- **`src/send-to-workflowy.ts`** (new): the send request and its handler in the worker.
- **`src/workflowy.ts`** (new): every Workflowy request (`callApi`, `createNode`, `sendTabs`, `exportNodes`) and the deep link (`deepLink`).
- **`src/tabs.ts`** (new): `TabSummary` and `summarizeTabs`, moved out of `src/background.ts`.
- **`src/workflowy-settings.ts`** (new): the API key in `chrome.storage.local`.
- **Deleted, the options page:** `src/options.tsx`, `entrypoints/options.html`, the manifest's `options_ui` and its build input. The API key lives in the popup instead.
- **Deleted with copy-all-tabs:** `src/offscreen.ts`, `entrypoints/offscreen.html`, `public/copy.svg`, and the toolbar click handler, clipboard and offscreen code in `src/background.ts`.
- **`package.json`**: `fuse.js` and `@kobalte/core`, plus vitest, nock and a `test` script.

## Accepted differences

1. **After Shift+Enter, the cursor is not placed for you.** Neither the API nor the deep link can focus a node for typing. The app opens zoomed into the new node, and you click where you want to keep writing.
2. **On Shift+Enter, Chrome may ask "Open WorkFlowy?"** before handing a `workflowy://` link to the app.
3. **Search is up to an hour stale.** A node created, renamed, moved or completed since the last export is searched as it was then.

## Verify first

These decide whether the design works at all. They are checked first, in Canary, with the built extension loaded unpacked:

1. **The tab-menu item appears when tabs are vertical.** The docs say only "the tab strip".
2. **The tab-menu item opens the popup,** including when butler's icon is not pinned to the toolbar.
3. **⌘⇧O opens the popup.** If Chrome did not take the suggested key, set it at `chrome://extensions/shortcuts`.
4. **An extension can launch `workflowy://` cleanly.** The candidate is `chrome.tabs.update(<active tab>, { url })`, expecting Chrome to hand the URL to the OS and leave the page in place. Check that it opens the app and leaves no blank tab or replaced page behind.
5. **The desktop app has the new node when the deep link arrives.** The node is created through the cloud API, and the app learns of it by sync. Check that the app opens on the new node, not on a "not found" view.

## Verification

The Workflowy side is tested with vitest against recordings of the real Workflowy API, in `src/workflowy.test.ts`:

- **Sending tabs:** the test sends two tabs with a note, reads the result back, and checks the tree Workflowy built: the date pill followed by the note, and every node stored as a bullet.

The popup's keyboard rules are tested as the pure `keyAction` table, in `src/popup-keys.test.ts`.
- **Searching the outline:** the test builds a small tree with a completed branch, exports, indexes and searches it. Each ranking term decides one pair in the expected order, so dropping the depth term, the sibling term or the word-start bonus each fails the test, and so does showing anything completed.

Recording writes to the real outline, so it only ever writes under one node: `TEST_TARGET` in the test file, a node that exists solely for these tests. There is no fallback target. An export holds the whole outline, so the outline test searches only the subtree it built, and the recorder keeps only that subtree. Nothing else from the outline reaches disk or test output. Re-recording runs the tests with `WORKFLOWY_API_KEY` set, for example `WORKFLOWY_API_KEY="op://…" op run -- npm test`. Without the key, the tests replay the recordings and the network is closed.

The Chrome side is verified by hand, in Canary with the built extension loaded unpacked, against your real Workflowy with your go-ahead:

- Select three tabs in the vertical tab strip, click butler's icon, search for a node and pick it. The node gains a top node `[today]` with three URL children, each holding its title, in tab-strip order.
- The same from a selected tab's right-click menu.
- The desktop app opens zoomed into the new node, and typing after the pill works.
