import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import {
  applyStyle,
  clearFormatting,
  colourLabel,
  fromPlainText,
  fromStored,
  hasMark,
  normaliseColour,
  normaliseIcon,
  plainText,
  replaceRange,
  sharedValue,
  toCallout,
  toggleMark,
  toNotionRichText,
  toStored,
} from "../blocks/tilting-callout/src/callout.ts"
import { FLAT, MAX_TILT_X, MAX_TILT_Y, tiltFor } from "../blocks/tilting-callout/src/tilt.ts"

const workerUrl = new URL("../src/index.ts", import.meta.url)

/** Build runs from [text, flags] pairs, the inverse of runs() below. */
function build(pairs) {
  return pairs.map(([text, flags = ""]) => {
    const parts = flags.split(" ").filter(Boolean)
    const href = parts.find((part) => part.startsWith("→"))
    const colour = parts.find((part) => !["b", "i", "s", "u", "c"].includes(part) && !part.startsWith("→"))
    return {
      text,
      bold: parts.includes("b"),
      italic: parts.includes("i"),
      strikethrough: parts.includes("s"),
      underline: parts.includes("u"),
      code: parts.includes("c"),
      colour: colour ?? "default",
      ...(href ? { href: href.slice(1) } : {}),
    }
  })
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

  for (const key of ["text", "formatted", "icon", "colour", "block"]) {
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
  assert.deepEqual(toCallout(undefined), { segments: [], icon: "💡", colour: "gray_background" })

  const row = { id: "r", propertiesByKey: { text: "Hi", icon: "", colour: "red_background" } }
  const callout = toCallout(row)
  assert.equal(callout.icon, "")
  assert.equal(callout.colour, "red_background")
  assert.deepEqual(runs(callout.segments), [["Hi", ""]])
})

// ─── Editing ────────────────────────────────────────────────────────────────

test("toggles a mark across a selection, and off again when it is all marked", () => {
  const text = fromPlainText("Make this bold")
  const bolded = toggleMark(text, 5, 9, "bold")
  assert.deepEqual(runs(bolded), [["Make ", ""], ["this", "b"], [" bold", ""]])
  assert.equal(hasMark(bolded, 5, 9, "bold"), true)
  assert.equal(hasMark(bolded, 4, 9, "bold"), false)

  // Part-bold selections become wholly bold first, as in Notion.
  assert.deepEqual(runs(toggleMark(bolded, 0, 9, "bold")), [["Make this", "b"], [" bold", ""]])
  assert.deepEqual(runs(toggleMark(bolded, 5, 9, "bold")), [["Make this bold", ""]])
})

test("colours, links and clears a range", () => {
  const text = fromPlainText("see the docs")
  const linked = applyStyle(text, 8, 12, { href: "https://n.so" })
  const coloured = applyStyle(linked, 0, 3, { colour: "red_background" })
  assert.deepEqual(runs(coloured), [["see", "red_background"], [" the ", ""], ["docs", "→https://n.so"]])
  assert.equal(sharedValue(coloured, 8, 12, "href"), "https://n.so")
  assert.equal(sharedValue(coloured, 0, 12, "colour"), undefined, "mixed colours have no shared value")

  const unlinked = applyStyle(coloured, 8, 12, { href: undefined })
  assert.deepEqual(runs(unlinked), [["see", "red_background"], [" the docs", ""]])

  // Clearing keeps links, as Notion's "clear formatting" does.
  const busy = toggleMark(applyStyle(linked, 0, 12, { colour: "blue" }), 0, 12, "italic")
  assert.deepEqual(runs(clearFormatting(busy, 0, 12)), [["see the ", ""], ["docs", "→https://n.so"]])
})

test("typed text continues the formatting before it, but not a link or code", () => {
  const text = build([["Hello ", ""], ["world", "b"]])
  assert.deepEqual(runs(replaceRange(text, 11, 11, "!")), [["Hello ", ""], ["world!", "b"]])
  assert.deepEqual(runs(replaceRange(text, 0, 0, "Oh, ")), [["Oh, Hello ", ""], ["world", "b"]])
  // Typing over a selection keeps its formatting.
  assert.deepEqual(runs(replaceRange(text, 6, 11, "there")), [["Hello ", ""], ["there", "b"]])

  const link = build([["go", "→https://n.so"], [" now", ""]])
  assert.deepEqual(runs(replaceRange(link, 2, 2, "!")), [["go", "→https://n.so"], ["! now", ""]])
  assert.deepEqual(runs(replaceRange(link, 1, 1, "o")), [["goo", "→https://n.so"], [" now", ""]])

  const code = build([["x = 1", "c"]])
  assert.deepEqual(runs(replaceRange(code, 5, 5, ";")), [["x = 1", "c"], [";", ""]])
})

test("deletes and line breaks are just replacements", () => {
  const text = build([["one ", ""], ["two", "i"]])
  assert.deepEqual(runs(replaceRange(text, 3, 7, "")), [["one", ""]])
  assert.deepEqual(runs(replaceRange(text, 4, 4, "\r\n")), [["one \n", ""], ["two", "i"]])
  assert.equal(plainText(replaceRange(text, 0, 7, "")), "")
})

// ─── Storage ────────────────────────────────────────────────────────────────

test("formatting round-trips through the stored field", () => {
  const original = build([
    ["Heads up: ", ""],
    ["very", "b i"],
    [" read ", ""],
    ["this", "s u red"],
    [" and run ", ""],
    ["npm test", "c"],
    [" via ", ""],
    ["the guide", "blue_background →https://n.so/g"],
  ])
  assert.deepEqual(runs(fromStored(toStored(original))), runs(original))
  assert.ok(toStored(original).length < 400, "stored form stays compact")
})

test("ignores stored values that are missing or not ours", () => {
  assert.equal(fromStored(undefined), null)
  assert.equal(fromStored(""), null)
  assert.equal(fromStored("plain words"), null)
  assert.equal(fromStored('{"v":2,"r":[]}'), null)
  assert.equal(fromStored('{"v":1,"r":[{"x":1}]}'), null)
})

test("uses stored formatting only while it matches the Text field", () => {
  const formatted = toStored(build([["Hello ", ""], ["world", "b"]]))
  const row = (text) => ({ id: "r", propertiesByKey: { text, formatted, icon: "💡", colour: "default" } })

  assert.deepEqual(runs(toCallout(row("Hello world")).segments), [["Hello ", ""], ["world", "b"]])
  // Edited in the database since: show the new words, plain, not stale formatting.
  assert.deepEqual(runs(toCallout(row("Hello there")).segments), [["Hello there", ""]])
})

test("writes rich text items Notion accepts, splitting long runs", () => {
  const long = "x".repeat(4500)
  const items = toNotionRichText(build([[long, "b"]]))
  assert.equal(items.length, 3)
  assert.deepEqual(
    items.map((entry) => entry.text.content.length),
    [2000, 2000, 500]
  )
  assert.ok(items.every((entry) => entry.annotations.bold))

  const stored = toStored(build([[long, ""]]))
  assert.equal(
    toNotionRichText(fromPlainText(stored)).map((entry) => entry.text.content).join(""),
    stored,
    "a long stored value survives being split"
  )
})

// The custom block host silently drops a write carrying `link: null` or unset
// annotations, so the save hangs until it times out. Plain text must go out in
// exactly the shape the Stepline's (working) writes use.
test("sends only the formatting that is set, never null links", () => {
  assert.deepEqual(toNotionRichText(fromPlainText("Hello")), [
    { type: "text", text: { content: "Hello" } },
  ])

  const items = toNotionRichText(build([["Read ", ""], ["this", "b"], [" ", ""], ["now", "→https://example.com"]]))
  assert.deepEqual(items, [
    { type: "text", text: { content: "Read " } },
    { type: "text", text: { content: "this" }, annotations: { bold: true } },
    { type: "text", text: { content: " " } },
    { type: "text", text: { content: "now", link: { url: "https://example.com" } } },
  ])
  assert.ok(!JSON.stringify(items).includes("null"))
})

// ─── Tilt ───────────────────────────────────────────────────────────────────

test("stays within the brand's Tilt3D limits", () => {
  assert.equal(MAX_TILT_Y, 8, "horizontal tilt")
  assert.equal(MAX_TILT_X, 6, "vertical tilt")
})

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
  assert.equal(tiltFor(0, 0, 700, 50).perspective, 2100)
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

test("every colour comes from Notion's palette, with light and dark values", async () => {
  const css = (
    await readFile(new URL("../blocks/tilting-callout/src/index.css", import.meta.url), "utf8")
  ).replace(/\/\*[\s\S]*?\*\//g, "")
  const dark = css.slice(css.indexOf('[data-display-mode="dark"] {'))

  for (const hue of ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"]) {
    assert.match(css, new RegExp(`\\.callout-${hue} \\{ color: var\\(--n-${hue}-text\\)`), `callout-${hue}`)
    assert.match(
      css,
      new RegExp(`\\.callout-${hue}_background \\.tilt-body \\{ background: var\\(--n-${hue}-bg\\)`),
      `callout-${hue}_background`
    )
    assert.match(dark, new RegExp(`--n-${hue}-bg:`), `${hue} fill has a dark value`)
  }

  assert.doesNotMatch(css, /color:\s*var\(--content-disabled\)/)
})

// Hovering the callout is the whole point of the block, so it must only ever
// tilt: no control may appear on hover. Text is edited in place and the icon
// opens its menu, as in a Notion callout.
test("hover only tilts; text edits in place and the icon opens its menu", async () => {
  const src = new URL("../blocks/tilting-callout/src/", import.meta.url)
  const app = await readFile(new URL("App.tsx", src), "utf8")
  const css = await readFile(new URL("index.css", src), "utf8")
  assert.doesNotMatch(css, /:hover\s+\.|:hover\s*>|callout-toolbar/, "CSS reveals something on hover")
  assert.match(app, /className=\{`callout-icon[\s\S]{0,600}onClick=\{\(\) => setMenuOpen/, "the icon opens its menu")
  assert.match(app, /<InlineText/, "the text is edited in place")
})

// The editor must not let the browser reformat the text itself: every edit goes
// through the run model, or bold/links would drift from what gets saved.
test("the editor routes input through the model", async () => {
  const editor = await readFile(new URL("../blocks/tilting-callout/src/InlineText.tsx", import.meta.url), "utf8")
  assert.match(editor, /addEventListener\("beforeinput"/)
  assert.match(editor, /event\.preventDefault\(\)[\s\S]{0,1200}replaceRange\(/)
  assert.doesNotMatch(editor, /execCommand/, "document.execCommand formats behind the model's back")
})
