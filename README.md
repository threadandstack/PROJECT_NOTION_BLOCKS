# Notion Custom Blocks

Thread & Stack's custom block worker — and the blueprint future blocks get copied
from. A **custom block** is a small React app that Notion embeds in a page as a
sandboxed iframe, with live read/write access to data sources the person
configures when they insert it.

Currently ships one block: **Stepline (vertical)**.

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
  "Edit" on a step opens a form for its icon, title, detail and status — nothing
  is written until Save, and Cancel leaves the step untouched. A newly added step
  opens straight into its form, since it has nothing to read yet.
- **Steps can carry a Notion icon.** The icon is the row's real Notion page icon,
  so it shows in the database and on the page too, not just in the block. The edit
  form's picker offers Notion's own flat icons in all ten of its colours, plus
  emoji. An icon can be changed but not removed — see the constraints below.
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

A step's icon is not a property — it is the Notion page icon on the row itself, so
there is nothing to map for it.

**Status must be a Status property, not a Select.** The block reads the
property's own groups (To-do / In progress / Complete) rather than matching option
names, so any status scheme works — "Shipped", "Live", "Done" all read as
complete if they sit in the Complete group. Where a host supplies no groups, it
falls back to matching common words.

Steps with no Position fall to the end, in a stable order. Moving one assigns
positions as it goes, so an unordered database sorts itself out the first time
anything is moved.

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

Typecheck and test:

```bash
npm run check && npm test
```

### What the dev shell can and can't show you

The shell is a **read-only** mock host. Rendering, ordering, expansion, theming
and sizing are all faithful, and failed writes surface correctly. But it rejects
page writes (`page not found`) and doesn't model status options, so these can only
be verified against a real workspace:

- saving an edit (title, detail or icon)
- changing a status, moving a step, adding a step, removing a step
- the status picker's menu (it shows a "bind a Status property" note locally)

Icons are fetched with `pages.get`, which the shell also does not serve, so steps
render without icons locally even when the real rows have them.

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

Map the five property slots when prompted. To let other workspace members insert
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
- **Notion's native icon picker cannot be opened from a block.** The bridge has
  messages for data, pages, users and layout only — nothing for presenting host
  UI — so a block has to draw its own picker. What it *writes* is the real thing:
  Notion stores a built-in icon as an `external` icon at
  `www.notion.so/icons/<name>_<colour>.svg`, which is exactly what the picker here
  writes. The icons cannot be *loaded* from that URL, though — the sandbox blocks
  it like any other origin — so their markup is bundled and drawn inline.
- **An icon can be set or replaced, but not cleared.** Notion's REST API clears
  an icon on `null` and the bridge forwards anything that is not `undefined`, so
  this looks like it should work — but the bridge's own message schema types
  `icon` as optional and NOT nullable, and the host drops the message rather than
  answering it. The write then hangs instead of failing. Clearing an icon has to
  be done on the row in Notion. (Testing this against the REST API proves nothing:
  the bridge is a different layer with its own schema.)
- **A rejected message is never answered**, so every bridge call needs a deadline.
  Without one, a single malformed write leaves the UI stuck mid-write with no
  error to explain it.
- **`--content-disabled` equals `--bg-control` in light mode** (both `--gray-40`),
  so disabled text on a control is invisible. Dim disabled controls with
  `opacity` instead of recolouring them. A test guards this.
- **A row's page icon is write-only from a query.** Data-source snapshots carry
  properties but no icon, so icons have to be fetched per row with `pages.get` and
  cached — and an icon changed elsewhere is not picked up until the block reloads.
  `icon` is also optional-but-not-nullable on the update message, so a block can
  set or replace an icon but never clear one.
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
  src/IconPicker.tsx      emoji picker for a step's page icon
  src/StepIcon.tsx        renders whichever icon variant a step carries
  src/emoji.ts            the bundled emoji set and its search
  src/notionIcons.ts      Notion's flat icons — bundled markup, colours, URLs
  src/NotionIconGlyph.tsx draws a bundled Notion icon inline
  src/useStepIcons.ts     fetches and caches each row's page icon
  src/steps.ts            ordering, status→phase mapping, date parsing
  src/index.css           Notion design tokens
data/steps.json           sample rows for the dev shell
test/stepline.test.mjs    declaration and data-shaping tests
```
