import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { formatDate, nextPosition, toSteps } from "../blocks/timeline/src/steps.ts"

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
    { id: "o-todo", name: "Not started" },
    { id: "o-doing", name: "In flight" },
    { id: "o-done", name: "Shipped" },
  ],
  groups: [
    { id: "g1", name: "To-do", option_ids: ["o-todo"] },
    { id: "g2", name: "In progress", option_ids: ["o-doing"] },
    { id: "g3", name: "Complete", option_ids: ["o-done"] },
  ],
}

test("declares the timeline block and the properties it binds", async () => {
  const source = await readFile(workerUrl, "utf8")

  assert.match(source, /worker\.customBlock\("timeline"/)
  assert.match(source, /path:\s*"\.\/blocks\/timeline"/)
  assert.match(source, /command:\s*"npx vite build"/)
  assert.match(source, /slashCommand:\s*"timeline"/)

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
  const { searchEmoji, EMOJI_GROUPS } = await import("../blocks/timeline/src/emoji.ts")

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
