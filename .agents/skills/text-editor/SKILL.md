---
name: text-editor
description: Add Notion-style rich text editing to a custom block — click-to-type text, a selection menu matching Notion's (colour, bold, italic, underline, clear, link, strikethrough, code), keyboard shortcuts, undo, and formatting that survives saving. Use whenever a custom block needs editable or formatted text, an inline editor, a formatting toolbar, or "text that looks and edits like Notion". Rolls out the tilting callout's editor as the house pattern.
user-invocable: true
---

# Text editor for custom blocks

Thread & Stack's house pattern for editable text inside a Notion custom block.
It edits in place and looks like Notion's own editor: click and type, select to
format, the same menu and shortcuts. **Roll this out every time a block needs
text editing.** Don't rebuild it, and don't fall back to a textarea with
Markdown or a form with a Save button.

**Where things are.** This skill lives in the Notion blocks repo,
`threadstack.dev/PROJECT_NOTION_BLOCKS/` (GitHub:
`threadandstack/PROJECT_NOTION_BLOCKS`), at `.agents/skills/text-editor/`.
`threadstack.dev/.claude/skills/text-editor` links to it, so sessions anywhere
in the workspace can load it. Every path below is relative to that repo. New
blocks normally go in the same repo, as `blocks/<key>/`.

The reference implementation is the **tilting callout**
(`blocks/tilting-callout/`). It was built and verified against live Notion in
October 2026. Copy from it; this skill says what to copy, what to change and
why each odd-looking choice is there.

Read the `custom-blocks` skill first for the block basics (declaration, SDK,
dev shell, deploy).

## What the user gets

- **Click the text and type.** No edit button, form or Save. The text saves once,
  when focus leaves it (click away, Esc or ⌘↵), as a single write.
- **Select text** and a menu drawn after Notion's appears below the selection:
  - Row 1: **A** (colour), **B**, *I*, U, Tx (clear formatting)
  - Row 2: link, ~~S~~, `code`
  - Active marks show in Notion blue (`#2383e2`).
  - The colour panel has a "Text colour" row and a "Background colour" row of
    "A" swatches. The link panel is a "Paste a link…" field plus "Remove link".
- **Shortcuts as in Notion:** ⌘B, ⌘I, ⌘U, ⌘⇧S (strikethrough), ⌘E (code),
  ⌘K (link), ⌘Z / ⌘⇧Z (undo / redo), Enter for a new line.
- **Formatting survives** saving and reloading (see "Storage" below: this is
  the part Notion makes hard).

## Files to copy

From `blocks/tilting-callout/src/` into `blocks/<your-block>/src/`:

| File | What it is | Change when copying |
|---|---|---|
| `editorDom.ts` | Draws runs into the contenteditable element; maps the DOM selection to character offsets and back | Nothing |
| `InlineText.tsx` | The editor: input handling, shortcuts, undo, the selection menu, commit on blur | Nothing (props: `segments`, `placeholder`, `container`, `onCommit`, `onEditingChange`) |
| `FormatToolbar.tsx` | The selection menu, link panel and icons | Nothing, unless the block needs fewer marks |
| `ColourGrid.tsx` | Notion's text and background colour swatches | Nothing |
| `usePopoverSpace.ts` | Grows the iframe so a menu is never clipped | Nothing |
| `callout.ts`, **"Rich text", "Editing" and "Storage" sections** | The run model (`Segment`), pure edit functions (`replaceRange`, `toggleMark`, `applyStyle`, `clearFormatting`, `hasMark`, `sharedValue`), `toNotionRichText`, `toStored` / `fromStored` | Move into your block's own model file (e.g. `richText.ts`). Also bring `HUES`, `colourLabel` and `CalloutColour` (rename to `NotionColour`) from the top of the file |
| `index.css`, **"Notion's palette", "Colours", "Rich text" and "Menus" sections** | Notion's measured in-app colours (`--n-<hue>-text`, `-bg`, `-pill-text`, `-pill-bg`, light and dark), the `c-*` colour rules built on them, mark styles, the menu card and swatches | Copy as is. Never use the design system's raw palette (`--green-110` etc.) for text: it's darker than Notion's. The palette was read from the Notion app's stylesheet on 2026-10-09 (`--c-<hue>TexSec`, `BacSec`, `TexPri`, `--ca-<hue>BacTerTra`); re-measure rather than guess if it ever looks off |

From `App.tsx`, copy the **save pattern** (described below), not the file.
`IconMenu.tsx` is specific to the callout; copy it only if your block has an
icon.

If a second block adopts this, consider moving the shared files into
`blocks/_shared/text-editor/` and adding that path to each block's
`tsconfig.json` `include`. Do that as its own change, verified in the dev shell.

## Wiring it up

```tsx
const [container, setContainer] = useState<HTMLElement | null>(null)
const [editing, setEditing] = useState(false)

<main ref={setContainer} className="your-root">   {/* position: relative; box-sizing: border-box */}
  <InlineText
    segments={shown.segments}
    placeholder="Type something…"
    container={container}
    onEditingChange={setEditing}
    onCommit={(segments) => save({ segments })}
  />
</main>
```

- `container` must be a `position: relative` element **outside** any
  transformed element (for example a tilt). Menus are portalled into it, so they
  never lean or scale with the content.
- Freeze animations and hover effects while `editing` is true.

## Storage: the bridge drops formatting

**Verified 2026-10-09:** Notion's custom block bridge drops title formatting
**in both directions.** A `createPage` or `updatePage` that sends
`annotations: { bold: true }` or `text.link` is accepted but stored as plain
text. A title formatted through the REST API still reaches the block plain.
The REST API itself keeps formatting, so testing the REST API proves nothing
about the bridge.

So each formatted field needs **two properties**:

| Property | Type | Holds |
|---|---|---|
| e.g. `Text` | `title` (or `rich_text`) | The plain words, so the database reads well. Write `toNotionRichText(segments)` (it goes in flattened today, but would keep the formatting if Notion fixes the bridge) |
| e.g. `Formatted text` | `rich_text` | `toStored(segments)`: compact JSON (`{"v":1,"r":[{"t":"Hi","b":1}]}`) written through `toNotionRichText(fromPlainText(...))`, which splits it into 2,000-character items |

When reading, use the stored runs **only if their plain text equals the plain
field** (`toCallout` in `callout.ts`). Otherwise show the plain text, so an edit
made straight in the database isn't hidden behind stale formatting.

Declare the stored property in `src/index.ts` with a description telling people
to hide it and not edit it.

## The save pattern (from `App.tsx`)

- **Pending overrides.** Show a saved change at once (`pending` state) and drop
  it once the query reports the same value back (`sameSegments`). Otherwise the
  text flicks back while the write is in flight.
- **One write at a time.** Chain writes on a promise (`queue`). A row created by
  the first write may not be in the query yet when the second one starts, so
  keep its id (`createdId`) and update it with `pages.update`, which takes
  **raw property IDs**: resolve them with `propertyIdsByKey` and repeat each id
  inside its value (`byPropertyId`). Without this, quick edits create duplicate
  rows.
- **Race every bridge call against a timeout** (`withTimeout`, 10s). The host
  never answers a message it rejects, so an unanswered promise would hang
  forever.
- **Only write a stored field when it's bound:**
  `propertyIdsByKey.formatted !== undefined`. Writing an unbound key fails with
  `unmapped_property`.

## Traps this pattern already avoids. Don't undo them

- **Never send `link: null` or `false` annotations.** The host drops the whole
  write silently and the save times out. `toNotionRichText` sends only the
  formatting that is set.
- **All input goes through `beforeinput` into the run model.** Don't use
  `document.execCommand` or let the browser format (it invents `<b>`,
  `<span style>` and `<div>`s). Only IME composition is left to the browser,
  and it is read back on `compositionend`.
- **The DOM is drawn by `renderRuns`, not React.** React re-rendering a
  contenteditable element moves the caret. A trailing newline needs the filler
  `<br data-filler>`.
- **Toolbar buttons call `preventDefault` on `mousedown`**, so the text keeps
  focus and its selection. Only the link field takes focus. Blur logic ignores
  focus moving between the text and its menu (`leaves`).
- **Typing over a selection keeps the selection's formatting.** Typing at a
  caret continues the previous character's formatting, but links and code don't
  extend past their end (`replaceRange`). This matches Notion.
- **Menus need room in the iframe.** `usePopoverSpace` sets the container's
  `min-height` past the menu. It does so on the **next animation frame**:
  changing layout inside a `ResizeObserver` callback raises "ResizeObserver
  loop", and the host treats that as the block crashing.
- **Active blue is hard-coded `#2383e2`.** `--content-interactive-primary`
  follows the page theme and is grey by default.
- **No `<form>`, no `type="submit"`.** The sandbox blocks form submission
  silently. There are tests for this.
- **No hover-revealed controls** on blocks whose point is the hover. Editing is
  reached by clicking the content itself.
- **Notion's native menus are unreachable.** The bridge has no message for
  opening host UI, so the block draws its own. Don't promise the native
  toolbar or emoji picker.

## Rolling out to an existing block

Adding a property to a block's `dataSources` (such as the stored formatting
field) **unbinds existing instances**: in the dev shell an unmapped property
shows "This block requires data", and live Notion should be assumed to do the
same. Before deploying:

1. Tell the user which existing blocks will need re-binding.
2. Offer to add the new column to their existing databases through the API
   (`PATCH /v1/data_sources/{id}`), so re-binding is one dropdown choice.
3. New instances bind every property when inserted, so they're unaffected.

**Deleting files before deploying:** `ntn workers deploy` archives the files
git tracks. A tracked file deleted from disk fails the deploy with "Failed to
add <file> to archive". Stage the deletion with `git rm --cached <file>` (or
commit it) first.

## Testing

- **Unit tests** (`node --test`): the edit functions are pure and take character
  offsets, so cover them directly. See `test/tilting-callout.test.mjs`, the
  "Editing" and "Storage" sections, and copy their shape. Keep the guard tests:
  no forms, no `execCommand`, input through `beforeinput`, light and dark rules
  for every colour.
- **Dev shell** (`npm run dev`, localhost:9873): typing, selection, the menu,
  formatting, the colour panel and resizing all work there. **Saving does not**,
  because the shell is read-only. When you add a property, add it to
  `data/worker_<key>.json` and **restart** the shell, which reads that file only
  at startup.
- **Live Notion:** check a real save with **real text, bold and a link**. An
  empty save goes out the same way from old and new code, so it proves nothing.
  Then read the row back through the REST API to confirm both fields.
- **Browser automation:** typing into a block works once its text has focus,
  but **take a screenshot before typing**. If a click misses the block, it lands
  on Notion's own UI and keystrokes (even ⌘A) act on the page.
