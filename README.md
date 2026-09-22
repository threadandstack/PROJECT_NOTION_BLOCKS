# Notion Custom Blocks

Thread & Stack's custom block worker — and the blueprint future blocks get copied
from. A **custom block** is a small React app that Notion embeds in a page as a
sandboxed iframe, with live read/write access to data sources the person
configures when they insert it.

Currently ships two blocks: **Stepline (vertical)** and **Tilting callout**.

> [!NOTE]
> Custom blocks are in Notion's **private alpha**. The workspace needs the
> feature enabled before a deployed block can be inserted. Page guests can't see
> custom blocks, and Notion Sites doesn't render them.

---

## The Stepline (vertical) block

A vertical, numbered stepline rendered inline in a Notion page. Each step is a
circular bullet joined to the next by a connecting line. Clicking a step expands
it like a toggle to reveal its detail.

- **Numbered bullets, connected by a rail.** Steps are numbered by their place in
  the sequence. Completed steps swap their number for a tick and fill in, so the
  rail reads as progress at a glance.
- **Status drives the bullet.** Complete steps fill solid, in-progress steps get
  a highlighted ring, not-started steps stay outlined.
- **Status drives the colour.** A step's title and its status label both take the
  colour the workspace gave that option, so the stepline reads in the same
  colours as the database behind it. Options with no hue — `default` and `gray`,
  which an untouched "Not started" usually is — keep a plain black title.
- **Reading it shows no controls at all.** An open step is its detail text on the
  page — no card, no buttons. "Edit stepline" appears on hover (and on keyboard
  focus) and is the only chrome at rest.
- **Editing is a mode.** Choosing "Edit stepline" reveals each step's Edit, Move
  and Remove actions plus "Add step"; "Done" puts them all away again. Within it,
  "Edit" on a step opens a form for its title, detail and status — nothing
  is written until Save, and Cancel leaves the step untouched. A newly added step
  opens straight into its form, since it has nothing to read yet.
- Edits are written straight back to the bound Notion database, because that is
  where the content actually lives.
- **Reorder without leaving the page.** Move up / move down rewrite the Position
  property; adding a step appends it to the end.
- **Removing is a two-step confirm** and archives the row rather than deleting
  it, so it can be restored from the database.

### What it binds to

The block declares one data source, `steps`, with five properties. When someone
inserts the block they map each slot to a real property; Notion auto-matches by
name, so a database using these names binds with no manual mapping:

| Slot | Type | What it's for |
|---|---|---|
| Title | `title` | The step's label, next to its bullet |
| Detail | `rich_text` | The body revealed when the step is expanded |
| Status | `status` | Drives the bullet's appearance |
| Position | `number` | Sort order — the numbering follows it |
| Date | `date` | Optional date shown beside the title (display only) |

Steps deliberately carry no icon: the numbered bullet already marks each one, and
a page icon added elsewhere is simply not drawn. (An earlier version offered an
icon picker; it was dropped as redundant.)

**Status must be a Status property, not a Select.** The block reads the
property's own groups (To-do / In progress / Complete) rather than matching option
names, so any status scheme works — "Shipped", "Live", "Done" all read as
complete if they sit in the Complete group. Where a host supplies no groups, it
falls back to matching common words.

Steps with no Position fall to the end, in a stable order. Moving one assigns
positions as it goes, so an unordered database sorts itself out the first time
anything is moved.

## The Tilting callout block

A Notion callout that tilts to follow the cursor. Insert it with `/tilting-callout`.

- **Everything a callout has.** An icon (any emoji, or none), a colour (the same
  nine text colours and nine background colours Notion offers, plus Default), and
  formatted text: bold, italic, strikethrough, underline, inline code, coloured
  spans and links.
- **Hover to tilt.** The callout turns to face the pointer, up to 7° top to
  bottom and 4° side to side, with a soft glare under the cursor and a lifted
  shadow. It eases back to flat when the pointer leaves. Touch doesn't tilt it
  (there's no hover to follow), and neither does *Reduce motion*.
- **Editing is a form, not inline typing.** "Edit callout" appears on hover.
  The form takes the text, icon and colour; the icon and colour preview on the
  callout as you choose them, and nothing is written until Save. Cancel or
  Escape leaves it as it was; Ctrl/Cmd+Enter saves.
- **Formatting uses Notion's Markdown shortcuts** in the text box: `**bold**`,
  `*italic*`, `~~strikethrough~~`, `` `code` `` and `[link](https://…)`.
  Underline and text colour have no shortcut, so the block keeps them as long as
  the words they sit on are unchanged. Apply them in the database row to add
  them.
- **Links show but can't be followed.** Custom blocks can't navigate, so a link
  is underlined with its address as a tooltip.

What it can't do, because a custom block is an iframe rather than a native
block: hold child blocks (a native callout can nest other blocks inside it), or
be edited by typing straight into it.

### Where the words live

A custom block has no storage of its own, so every tilting callout keeps its
content in a row of a **Callouts** database, and finds its row by its own block
ID. One Callouts database can serve every tilting callout in the workspace.
Bind the same one each time.

| Slot | Type | What it's for |
|---|---|---|
| Text | `title` | The callout's text, with its formatting |
| Icon | `rich_text` | One emoji; empty for no icon |
| Colour | `rich_text` | A Notion colour token: `gray_background`, `blue`, `default`… |
| Block ID | `rich_text` | Links the row to its block. Set by the block; don't edit |

The row is created the first time someone saves the callout, so a callout that
has only been viewed never writes to Notion. Until then it shows Notion's
defaults: 💡 on a grey fill. Duplicating a tilting callout gives the copy a new
block ID, so it starts empty rather than sharing the original's row.

---

## Working on it

```bash
npm install
```

Preview locally against a mock Notion host:

```bash
npm run dev
```

Then open http://localhost:9873. The shell builds the worker, reads the block
declaration, and serves the block with live reload. `data/steps.json` is a sample
stepline it binds against — pick **Steps (sample)** in the shell's *Data* panel
if it auto-binds to the empty generated source instead.

The tilting callout auto-binds to the generated, empty **Callouts** source and
shows its placeholder. To preview a filled one, add a row to
`data/worker_callouts.json` with `"block": "dev-shell-block"` (the shell's fixed
block ID) and restart the shell.

Typecheck and test:

```bash
npm run check && npm test
```

### What the dev shell can and can't show you

The shell is a **read-only** mock host. Rendering, ordering, expansion, theming
and sizing are all faithful, and failed writes surface correctly. But it rejects
page writes (`page not found`) and doesn't model status options, so these can only
be verified against a real workspace:

- saving an edit (title, detail or status)
- changing a status, moving a step, adding a step, removing a step
- the status picker's menu (it shows a "bind a Status property" note locally)
- saving a tilting callout, and its formatted text (the shell can't read the
  row's rich text, so it shows plain text)

Pull a real database into the shell instead if you want realistic rows:

```bash
ntn workers customblocks sample <data source URL>
```

---

## Deploying

```bash
ntn login
ntn workers deploy
```

Then insert it into a page — type `/stepline` in the slash menu, or:

```bash
ntn workers customblocks make --key timeline --target <page-id-or-url>
```

The `--key` is `timeline`, not `stepline`: the declaration key is the stable
identity every placed block is bound to, so it stays put while the display name
and slash command carry the block's public name.

For the tilting callout, type `/tilting-callout`, or use
`--key tiltingCallout`.

Map the property slots when prompted. To let other workspace members insert
the block, share the worker with **Can connect** access.

`workers.json` (gitignored) pins the worker to a workspace and worker ID. This
worker is `notion-blocks` in **Thread & Stack**
(`bbd9bf1d-df73-40f6-991f-470984d40eaa`).

> [!IMPORTANT]
> The `ntn` default workspace is **Bloom & Matter**, so an un-pinned first deploy
> lands there. Pin the target on the deploy that creates the worker —
> `NOTION_WORKSPACE_ID=<id> ntn workers deploy --name <name>` — after which
> `workers.json` remembers it and a plain `ntn workers deploy` is safe.

---

## Adding another block

1. Copy `blocks/stepline/` to `blocks/<key>/` and strip it back.
2. Add a second `worker.customBlock("<key>", { … })` in [src/index.ts](src/index.ts).
   Always set `command` explicitly — its default (`npm run build`) builds the
   worker, not the frontend.
3. Add `tsc -p blocks/<key>/tsconfig.json --noEmit` to the `check` script.
4. Keep all dependencies in the root `package.json` — blocks don't get their own.

### Constraints worth knowing before you design one

- **No network access.** The iframe can't call external APIs or load anything from
  a CDN. Bundle every script, style and font. Images can be bundled or `data:`
  URLs.
- **No navigation.** No `window.open`, no external links, and no supported way to
  open an internal Notion link.
- **999 rows maximum** per query, 20 by default. Filters support one condition or
  one flat `and` group — no `or`, no nesting.
- **Reads and writes use the viewer's permissions**, so two people can see
  different things. Handle write failures even after the block has loaded.
- **The bundle is public** to anyone who can view the block. Secrets belong in the
  worker, never the frontend.
- **No `<form>` elements.** The sandbox disallows them, so a submit button's
  event never fires and the handler silently does nothing. Use a plain button
  with `onClick`. A test guards against reintroducing one, because the failure is
  invisible — the form renders perfectly and simply does not work.
- **A rejected message is never answered**, so every bridge call needs a deadline.
  Without one, a single malformed write leaves the UI stuck mid-write with no
  error to explain it.
- **`--content-disabled` equals `--bg-control` in light mode** (both `--gray-40`),
  so disabled text on a control is invisible. Dim disabled controls with
  `opacity` instead of recolouring them. A test guards this.
- **Colour tokens are not all theme-aware.** The semantic tokens
  (`--content-*`, `--bg-*`, `--border-*`) flip between light and dark; the raw
  palette scale (`--red-60`, `--blue-60`…) does not — only the contrast modes
  redefine it. Use raw steps only for small marks like dots and swatches.

## Layout

```
src/index.ts              worker declaration — block manifest and data source schema
blocks/stepline/
  index.html              iframe document
  vite.config.ts          frontend build
  src/index.tsx           entry — NotionCustomBlock + NotionTokenScope wrappers
  src/App.tsx             query, write handlers, add / move / remove
  src/Step.tsx            one step: bullet, header toggle, read view, edit form
  src/StatusPicker.tsx    status menu
  src/steps.ts            ordering, status→phase mapping, date parsing
  src/index.css           Notion design tokens
blocks/tilting-callout/
  src/App.tsx             finds this block's row, saves edits, reads formatted text
  src/TiltSurface.tsx     pointer tracking; writes the tilt to CSS variables
  src/tilt.ts             tilt maths (angles, glare position, perspective)
  src/Editor.tsx          text, icon and colour form
  src/RichText.tsx        renders formatted runs
  src/callout.ts          colours, icons, rich text ⇄ Markdown shortcuts
  src/index.css           callout, tilt and colour styles
data/steps.json           sample rows for the dev shell
test/stepline.test.mjs    declaration and data-shaping tests
test/tilting-callout.test.mjs  formatting round trip, tilt maths, guards
```
