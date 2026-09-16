import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { formatDate, nextPosition, toSteps } from "../blocks/stepline/src/steps.ts"

const workerUrl = new URL("../src/index.ts", import.meta.url)

/** A minimal stand-in for a row returned by `useDataSource`. */
function row(id, propertiesByKey) {
  return { id, propertiesByKey }
}

/** A Status property schema with Notion's three default groups. */
const statusSchema = {
  name: "Status",
  type: "status",
  options: [
    { id: "o-todo", name: "Not started", color: "default" },
    { id: "o-doing", name: "In flight", color: "blue" },
    { id: "o-done", name: "Shipped", color: "green" },
  ],
  groups: [
    { id: "g1", name: "To-do", option_ids: ["o-todo"] },
    { id: "g2", name: "In progress", option_ids: ["o-doing"] },
    { id: "g3", name: "Complete", option_ids: ["o-done"] },
  ],
}

test("declares the stepline block and the properties it binds", async () => {
  const source = await readFile(workerUrl, "utf8")

  // The key stays "timeline" deliberately — it is the identity placed blocks
  // bind to, so renaming it would orphan the ones already on pages. Only the
  // display name and slash command are the block's public name.
  assert.match(source, /worker\.customBlock\("timeline"/)
  assert.match(source, /name:\s*"Stepline \(vertical\)"/)
  assert.match(source, /slashCommand:\s*"stepline"/)
  assert.match(source, /path:\s*"\.\/blocks\/stepline"/)
  assert.match(source, /command:\s*"npx vite build"/)

  for (const key of ["title", "detail", "status", "position", "date"]) {
    assert.match(source, new RegExp(`${key}:\\s*\\{`), `missing ${key} property`)
  }
})

test("orders steps by position, with unpositioned steps last", () => {
  const steps = toSteps(
    [
      row("c", { title: "Third", position: 3 }),
      row("z", { title: "No position" }),
      row("a", { title: "First", position: 1 }),
    ],
    statusSchema
  )

  assert.deepEqual(
    steps.map((step) => step.title),
    ["First", "Third", "No position"]
  )
})

test("derives the bullet phase from the status property's own groups", () => {
  const steps = toSteps(
    [
      row("a", { title: "a", position: 1, status: "Not started" }),
      row("b", { title: "b", position: 2, status: "In flight" }),
      row("c", { title: "c", position: 3, status: "Shipped" }),
      row("d", { title: "d", position: 4 }),
    ],
    statusSchema
  )

  assert.deepEqual(
    steps.map((step) => step.phase),
    ["todo", "active", "complete", "todo"]
  )
})

test("falls back to option names when the host supplies no groups", () => {
  const [done, doing] = toSteps(
    [
      row("a", { title: "a", position: 1, status: "Done" }),
      row("b", { title: "b", position: 2, status: "Doing" }),
    ],
    undefined
  )

  assert.equal(done.phase, "complete")
  assert.equal(doing.phase, "active")
})

test("reads a date property's start, all-day and timestamped", () => {
  const [allDay, timed] = toSteps(
    [
      row("a", { title: "a", position: 1, date: { type: "date", start_date: "2026-03-04" } }),
      row("b", {
        title: "b",
        position: 2,
        date: { type: "datetime", start_date: "2026-03-05", start_time: "09:30" },
      }),
    ],
    statusSchema
  )

  assert.equal(allDay.date, "2026-03-04")
  assert.equal(timed.date, "2026-03-05T09:30")
  assert.equal(typeof formatDate(allDay.date), "string")
})

test("ignores a date property that has no start", () => {
  const [step] = toSteps([row("a", { title: "a", date: undefined })], statusSchema)

  assert.equal(step.date, undefined)
  assert.equal(formatDate(step.date), undefined)
})

test("appends new steps after the highest position", () => {
  assert.equal(nextPosition([]), 1)
  assert.equal(
    nextPosition([{ position: 2 }, { position: 7 }, { position: undefined }]),
    8
  )
})

test("icon search matches keywords and group names", async () => {
  const { searchEmoji, EMOJI_GROUPS } = await import("../blocks/stepline/src/emoji.ts")

  assert.equal(searchEmoji(""), null, "an empty query shows the grouped list")
  assert.equal(searchEmoji("   "), null)

  const build = searchEmoji("build")
  assert.ok(build.length > 0)
  assert.ok(build.every((entry) => entry.keywords.includes("build")))

  // A group name is searchable even when no keyword carries it.
  assert.ok(searchEmoji("progress").length > 0)
  assert.equal(searchEmoji("ZZZZ").length, 0)

  // Every emoji is unique, so React keys and the picker grid stay stable.
  const chars = EMOJI_GROUPS.flatMap((group) => group.emoji.map((e) => e.char))
  assert.equal(new Set(chars).size, chars.length, "duplicate emoji in the set")
})

test("the block uses no form elements", async () => {
  // The custom-block sandbox disallows forms: a submit button's event never
  // fires, so Save would silently do nothing. Guard against reintroducing one.
  const dir = new URL("../blocks/stepline/src/", import.meta.url)
  const { readdir } = await import("node:fs/promises")

  for (const file of await readdir(dir)) {
    if (!file.endsWith(".tsx")) continue
    const source = await readFile(new URL(file, dir), "utf8")
    const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")
    assert.doesNotMatch(code, /<form[\s>]/, `${file} renders a <form>`)
    assert.doesNotMatch(code, /type="submit"/, `${file} has a submit button`)
  }
})

test("Notion icons build the URL Notion itself stores", async () => {
  const { NOTION_ICONS, NOTION_ICON_COLOURS, notionIconUrl, searchNotionIcons } =
    await import("../blocks/stepline/src/notionIcons.ts")

  assert.equal(
    notionIconUrl("target", "blue"),
    "https://www.notion.so/icons/target_blue.svg"
  )
  assert.equal(NOTION_ICON_COLOURS.length, 10)

  const names = NOTION_ICONS.map((icon) => icon.name)
  assert.ok(names.length > 50)
  assert.equal(new Set(names).size, names.length, "duplicate icon names")

  // An icon's own name is always searchable, aliases or not.
  for (const name of ["rocket", "calendar", "target"]) {
    assert.ok(
      searchNotionIcons(name)?.some((icon) => icon.name === name),
      `${name} is not findable by its own name`
    )
  }

  // Aliases let intent find the right icon.
  assert.ok(searchNotionIcons("done")?.some((icon) => icon.name === "checkmark"))
  assert.equal(searchNotionIcons("")?.length, undefined)
})

test("bundled icons render without the network, and stored URLs map back", async () => {
  const {
    NOTION_ICONS,
    NOTION_ICON_HEX,
    NOTION_ICON_COLOURS,
    notionIcon,
    notionIconUrl,
    parseNotionIconUrl,
  } = await import("../blocks/stepline/src/notionIcons.ts")

  // Every icon ships its own markup — nothing is fetched at runtime.
  for (const icon of NOTION_ICONS) {
    assert.ok(icon.svg.includes("<path"), `${icon.name} has no path markup`)
    assert.doesNotMatch(icon.svg, /fill="#/, `${icon.name} kept a baked-in fill`)
    assert.doesNotMatch(icon.svg, /https?:/, `${icon.name} references a remote asset`)
  }

  // Each colour has Notion's own hex, so the fill is applied at render time.
  for (const colour of NOTION_ICON_COLOURS) {
    assert.match(NOTION_ICON_HEX[colour], /^#[0-9A-F]{6}$/i, `${colour} hex`)
  }

  // A stored icon URL round-trips, so an existing icon can be drawn locally.
  const url = notionIconUrl("rocket", "blue")
  assert.deepEqual(parseNotionIconUrl(url), { name: "rocket", colour: "blue" })
  assert.ok(notionIcon("rocket"))

  // Anything that is not a bundled built-in is left alone for the <img> path.
  assert.equal(parseNotionIconUrl("https://example.com/x.png"), undefined)
  assert.equal(parseNotionIconUrl(notionIconUrl("not-an-icon", "blue")), undefined)
  assert.equal(
    parseNotionIconUrl("https://www.notion.so/icons/rocket_chartreuse.svg"),
    undefined
  )
})

test("titles take the status colour the workspace configured", async () => {
  const withColours = {
    ...statusSchema,
    options: [
      { id: "o-1", name: "Plain", color: "default" },
      { id: "o-2", name: "Grey", color: "gray" },
      { id: "o-3", name: "Tinted", color: "purple_background" },
      { id: "o-4", name: "Hot", color: "red" },
      { id: "o-5", name: "Odd", color: "chartreuse" },
      { id: "o-6", name: "Bare" },
    ],
  }

  const steps = toSteps(
    [
      row("a", { title: "a", position: 1, status: "Plain" }),
      row("b", { title: "b", position: 2, status: "Grey" }),
      row("c", { title: "c", position: 3, status: "Tinted" }),
      row("d", { title: "d", position: 4, status: "Hot" }),
      row("e", { title: "e", position: 5, status: "Odd" }),
      row("f", { title: "f", position: 6, status: "Bare" }),
      row("g", { title: "g", position: 7 }),
    ],
    withColours
  )

  assert.deepEqual(
    steps.map((step) => step.tone),
    [
      undefined, // default carries no hue, so the title stays black
      undefined, // nor does grey — a grey title would read as disabled
      "purple", // the _background suffix is normalised away
      "red",
      undefined, // an unrecognised colour is ignored rather than guessed at
      undefined, // an option with no colour at all
      undefined, // and no status at all
    ]
  )
})

test("every status tone has both a light and a dark declaration", async () => {
  const { STATUS_TONES } = await import("../blocks/stepline/src/steps.ts")
  const css = await readFile(
    new URL("../blocks/stepline/src/index.css", import.meta.url),
    "utf8"
  )

  // The raw palette does not flip between light and dark, so a tone declared
  // only once would be unreadable in one of the two themes.
  for (const tone of STATUS_TONES) {
    assert.ok(css.includes(`.tone-${tone} { color:`), `${tone} has no colour`)
    assert.ok(
      css.includes(`[data-display-mode="dark"] .tone-${tone} { color:`),
      `${tone} has no dark-mode colour`
    )
    assert.ok(
      css.includes(`.status-tag.tone-${tone} { background:`),
      `${tone} has no label tint`
    )
    assert.ok(
      css.includes(`[data-display-mode="dark"] .status-tag.tone-${tone} { background:`),
      `${tone} has no dark-mode label tint`
    )
  }

  // Titles must not fall back to grey anywhere.
  assert.doesNotMatch(
    css,
    /\.step-complete \.step-title/,
    "completed titles are being greyed out"
  )
})
