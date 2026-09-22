import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import {
  carryHiddenStyles,
  colourLabel,
  fromMarkdown,
  fromNotionRichText,
  normaliseColour,
  normaliseIcon,
  plainText,
  toCallout,
  toMarkdown,
  toNotionRichText,
} from "../blocks/tilting-callout/src/callout.ts"
import { FLAT, MAX_TILT_X, MAX_TILT_Y, tiltFor } from "../blocks/tilting-callout/src/tilt.ts"

const workerUrl = new URL("../src/index.ts", import.meta.url)

/** A Notion rich text item, as `pages.get` returns it. */
function item(text, annotations = {}, href = null) {
  return {
    type: "text",
    text: { content: text, link: href ? { url: href } : null },
    plain_text: text,
    href,
    annotations: {
      bold: false,
      italic: false,
      strikethrough: false,
      underline: false,
      code: false,
      color: "default",
      ...annotations,
    },
  }
}

/** Summarise runs as [text, flags] pairs so assertions stay readable. */
function runs(segments) {
  return segments.map((segment) => [
    segment.text,
    [
      segment.bold && "b",
      segment.italic && "i",
      segment.strikethrough && "s",
      segment.underline && "u",
      segment.code && "c",
      segment.colour !== "default" && segment.colour,
      segment.href && `→${segment.href}`,
    ]
      .filter(Boolean)
      .join(" "),
  ])
}

test("declares the tilting callout block and the properties it binds", async () => {
  const source = await readFile(workerUrl, "utf8")

  assert.match(source, /worker\.customBlock\("tiltingCallout"/)
  assert.match(source, /name:\s*"Tilting callout"/)
  assert.match(source, /slashCommand:\s*"tilting-callout"/)
  assert.match(source, /path:\s*"\.\/blocks\/tilting-callout"/)

  for (const key of ["text", "icon", "colour", "block"]) {
    assert.match(source, new RegExp(`${key}:\\s*\\{`), `missing ${key} property`)
  }
})

// ─── Colours and icons ──────────────────────────────────────────────────────

test("reads Notion colour tokens and falls back to a grey fill", () => {
  assert.equal(normaliseColour("blue_background"), "blue_background")
  assert.equal(normaliseColour(" Red "), "red")
  assert.equal(normaliseColour("Blue background"), "blue_background")
  assert.equal(normaliseColour("grey"), "gray")
  assert.equal(normaliseColour("default"), "default")
  assert.equal(normaliseColour("teal"), "gray_background")
  assert.equal(normaliseColour(undefined), "gray_background")
})

test("labels colours the way Notion's menu does", () => {
  assert.equal(colourLabel("default"), "Default")
  assert.equal(colourLabel("green"), "Green")
  assert.equal(colourLabel("purple_background"), "Purple background")
})

test("keeps one whole emoji as the icon", () => {
  assert.equal(normaliseIcon(" 🔥 "), "🔥")
  assert.equal(normaliseIcon("⚠️ careful"), "⚠️")
  assert.equal(normaliseIcon("👩🏽‍💻"), "👩🏽‍💻")
  assert.equal(normaliseIcon("🇬🇧🇮🇪"), "🇬🇧")
  assert.equal(normaliseIcon(""), "")
  assert.equal(normaliseIcon(null), "")
})

test("an unsaved callout shows Notion's defaults; a saved one can have no icon", () => {
  assert.deepEqual(toCallout(undefined), { text: "", icon: "💡", colour: "gray_background" })

  const row = { id: "r", propertiesByKey: { text: "Hi", icon: "", colour: "red_background" } }
  const callout = toCallout(row)
  assert.equal(callout.icon, "")
  assert.equal(callout.colour, "red_background")
  assert.equal(callout.text, "Hi")
})

// ─── Rich text ──────────────────────────────────────────────────────────────

test("reads Notion rich text, merging runs that format alike", () => {
  const segments = fromNotionRichText([
    item("Read "),
    item("the "),
    item("docs", { bold: true }),
    item(" now", { color: "red" }, "https://example.com"),
  ])
  assert.deepEqual(runs(segments), [
    ["Read the ", ""],
    ["docs", "b"],
    [" now", "red →https://example.com"],
  ])
})

test("parses the editor's Markdown shortcuts", () => {
  assert.deepEqual(runs(fromMarkdown("A **bold** and *italic* ~~gone~~ `x = 1`")), [
    ["A ", ""],
    ["bold", "b"],
    [" and ", ""],
    ["italic", "i"],
    [" ", ""],
    ["gone", "s"],
    [" ", ""],
    ["x = 1", "c"],
  ])
  assert.deepEqual(runs(fromMarkdown("See [**the** guide](https://n.so/g).")), [
    ["See ", ""],
    ["the", "b →https://n.so/g"],
    [" guide", "→https://n.so/g"],
    [".", ""],
  ])
})

test("leaves unmatched or spaced markers as literal text", () => {
  assert.deepEqual(runs(fromMarkdown("2 * 3 = 6")), [["2 * 3 = 6", ""]])
  assert.deepEqual(runs(fromMarkdown("snake_case_name")), [["snake_case_name", ""]])
  assert.deepEqual(runs(fromMarkdown("an _aside_ here")), [["an ", ""], ["aside", "i"], [" here", ""]])
  assert.deepEqual(runs(fromMarkdown("**not closed")), [["**not closed", ""]])
  assert.deepEqual(runs(fromMarkdown("\\*literal\\*")), [["*literal*", ""]])
})

test("round-trips formatting through the editor unchanged", () => {
  const original = fromNotionRichText([
    item("Heads up: "),
    item("very", { bold: true, italic: true }),
    item(" "),
    item("important", { bold: true }),
    item(" read "),
    item("this", { strikethrough: true }),
    item(" and "),
    item("npm run check", { code: true }),
    item(" first. 2 * 3 [sic]"),
    item("link", {}, "https://example.com"),
  ])
  const markdown = toMarkdown(original)
  assert.deepEqual(runs(fromMarkdown(markdown)), runs(original))
})

// A space at the edge of a formatted run moves outside the markers (Markdown
// cannot bold a bare space), so it comes back unformatted. It looks the same.
test("moves edge spaces outside markers so they still parse", () => {
  const markdown = toMarkdown(fromNotionRichText([item("a"), item(" bold ", { bold: true }), item("b")]))
  assert.equal(markdown, "a **bold** b")
})

test("keeps underline and colour when the words are unchanged", () => {
  const before = fromNotionRichText([item("Hello "), item("world", { underline: true, color: "blue" })])
  const edited = fromMarkdown(toMarkdown(before).replace("Hello", "**Hello**"))
  const after = carryHiddenStyles(before, edited)
  assert.deepEqual(runs(after), [
    ["Hello", "b"],
    [" ", ""],
    ["world", "u blue"],
  ])
})

test("drops underline and colour once the words change", () => {
  const before = fromNotionRichText([item("Hello "), item("world", { color: "blue" })])
  const after = carryHiddenStyles(before, fromMarkdown("Goodbye world"))
  assert.deepEqual(runs(after), [["Goodbye world", ""]])
})

test("writes rich text items Notion accepts, splitting long runs", () => {
  const long = "x".repeat(4500)
  const items = toNotionRichText(fromMarkdown(`**${long}**`))
  assert.equal(items.length, 3)
  assert.deepEqual(
    items.map((entry) => entry.text.content.length),
    [2000, 2000, 500]
  )
  assert.ok(items.every((entry) => entry.annotations.bold))
  assert.equal(plainText(fromNotionRichText(items)), long)

  const [link] = toNotionRichText(fromMarkdown("[go](https://example.com)"))
  assert.deepEqual(link.text, { content: "go", link: { url: "https://example.com" } })
})

// ─── Tilt ───────────────────────────────────────────────────────────────────

test("lies flat with the pointer in the centre", () => {
  const tilt = tiltFor(300, 50, 600, 100)
  assert.equal(tilt.rotateX, 0)
  assert.equal(tilt.rotateY, 0)
  assert.equal(tilt.glareX, 50)
  assert.equal(tilt.glareY, 50)
})

test("lifts the corner nearest the pointer, up to the maximum", () => {
  // Bottom-right corner: bottom edge lifts (positive X), right edge lifts (negative Y).
  const corner = tiltFor(600, 100, 600, 100)
  assert.equal(corner.rotateX, MAX_TILT_X)
  assert.equal(corner.rotateY, -MAX_TILT_Y)
  assert.equal(corner.glareX, 100)
  assert.equal(corner.glareY, 100)

  const topLeft = tiltFor(0, 0, 600, 100)
  assert.equal(topLeft.rotateX, -MAX_TILT_X)
  assert.equal(topLeft.rotateY, MAX_TILT_Y)
})

test("clamps a pointer outside the callout and survives a zero size", () => {
  const beyond = tiltFor(-50, 500, 600, 100)
  assert.equal(beyond.rotateX, MAX_TILT_X)
  assert.equal(beyond.rotateY, MAX_TILT_Y)
  assert.deepEqual(tiltFor(10, 10, 0, 0), FLAT)
})

test("deepens the perspective for wide callouts", () => {
  assert.equal(tiltFor(0, 0, 200, 50).perspective, 800)
  assert.equal(tiltFor(0, 0, 700, 50).perspective, 1400)
})

// ─── Sandbox and theme guards ───────────────────────────────────────────────

test("the block uses no form elements", async () => {
  // The sandbox disallows forms: a submit button's event never fires, so Save
  // would silently do nothing.
  const dir = new URL("../blocks/tilting-callout/src/", import.meta.url)
  const { readdir } = await import("node:fs/promises")

  for (const file of await readdir(dir)) {
    if (!file.endsWith(".tsx")) continue
    const source = await readFile(new URL(file, dir), "utf8")
    const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "")
    assert.doesNotMatch(code, /<form[\s>]/, `${file} renders a <form>`)
    assert.doesNotMatch(code, /type="submit"/, `${file} has a submit button`)
  }
})

test("every colour has a light and a dark declaration, and disabled controls dim", async () => {
  const css = (
    await readFile(new URL("../blocks/tilting-callout/src/index.css", import.meta.url), "utf8")
  ).replace(/\/\*[\s\S]*?\*\//g, "")

  for (const hue of ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"]) {
    for (const token of [hue, `${hue}_background`]) {
      const rule = new RegExp(`\\.callout-${token}\\b`, "g")
      assert.equal(css.match(rule)?.length, 2, `callout-${token} needs a light and a dark rule`)
    }
  }

  assert.doesNotMatch(css, /color:\s*var\(--content-disabled\)/)
  assert.match(css, /\.ghost-button:disabled[\s\S]{0,200}opacity/)
})
