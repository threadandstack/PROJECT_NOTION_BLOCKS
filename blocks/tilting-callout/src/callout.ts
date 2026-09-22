import type { NotionDataSourcePage } from "@notionhq/custom-blocks"

/**
 * The colours a Notion callout (and any span of Notion text) can take: a plain
 * hue colours the text, a `_background` hue tints the fill behind it. These are
 * Notion's own tokens, so a value typed straight into the database reads the
 * same as one chosen from the block.
 */
export const HUES = [
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "blue",
  "purple",
  "pink",
  "red",
] as const

export type Hue = (typeof HUES)[number]

export type CalloutColour = "default" | Hue | `${Hue}_background`

/** Notion inserts a new callout with a grey fill, so the block does too. */
export const DEFAULT_COLOUR: CalloutColour = "gray_background"

/** Notion's default callout icon. */
export const DEFAULT_ICON = "💡"

export const COLOURS: readonly CalloutColour[] = [
  "default",
  ...HUES,
  ...HUES.map((hue) => `${hue}_background` as const),
]

/**
 * Read a stored colour, falling back to the default for anything Notion would
 * not recognise. Case and surrounding space are forgiven, since the value may
 * have been typed by hand into the database.
 */
export function normaliseColour(value: unknown): CalloutColour {
  if (typeof value !== "string") return DEFAULT_COLOUR
  const token = value.trim().toLowerCase().replace(/\s+/g, "_")
  if (token === "grey") return "gray"
  if (token === "grey_background") return "gray_background"
  return (COLOURS as readonly string[]).includes(token)
    ? (token as CalloutColour)
    : DEFAULT_COLOUR
}

/** The display name for a colour in the picker, in Notion's own words. */
export function colourLabel(colour: CalloutColour): string {
  if (colour === "default") return "Default"
  const hue = colour.replace(/_background$/, "")
  const name = hue.charAt(0).toUpperCase() + hue.slice(1)
  return colour.endsWith("_background") ? `${name} background` : name
}

/**
 * Keep only the first visible character of an icon. Emoji can be several code
 * points long (skin tones, flags, joined families), so this splits on grapheme
 * clusters rather than characters. An empty result means "no icon", which a
 * Notion callout also allows.
 */
export function normaliseIcon(value: unknown): string {
  if (typeof value !== "string") return ""
  const trimmed = value.trim()
  if (!trimmed) return ""
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" })
  const first = segmenter.segment(trimmed)[Symbol.iterator]().next()
  return first.done ? "" : first.value.segment
}

// ─── Rich text ─────────────────────────────────────────────────────────────

/** One run of text sharing the same formatting. */
export type Segment = {
  text: string
  bold: boolean
  italic: boolean
  strikethrough: boolean
  underline: boolean
  code: boolean
  /** A Notion colour token; `default` for none. */
  colour: string
  href?: string
}

type Style = Omit<Segment, "text">

const PLAIN: Style = {
  bold: false,
  italic: false,
  strikethrough: false,
  underline: false,
  code: false,
  colour: "default",
}

/** Notion caps a single rich text item at 2,000 characters. */
const MAX_ITEM_LENGTH = 2000

function sameStyle(a: Style, b: Style): boolean {
  return (
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.strikethrough === b.strikethrough &&
    a.underline === b.underline &&
    a.code === b.code &&
    a.colour === b.colour &&
    a.href === b.href
  )
}

/** Join neighbouring runs that format identically, and drop empty ones. */
function merge(segments: Segment[]): Segment[] {
  const merged: Segment[] = []
  for (const segment of segments) {
    if (!segment.text) continue
    const last = merged[merged.length - 1]
    if (last && sameStyle(last, segment)) {
      last.text += segment.text
    } else {
      merged.push({ ...segment })
    }
  }
  return merged
}

export function plainText(segments: Segment[]): string {
  return segments.map((segment) => segment.text).join("")
}

export function fromPlainText(text: string): Segment[] {
  return merge([{ ...PLAIN, text }])
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

/**
 * Read Notion's rich text items into runs. The SDK types each item as an open
 * record, so every field is checked rather than trusted. Mentions and equations
 * keep their `plain_text`, which is how Notion itself renders them as text.
 */
export function fromNotionRichText(items: readonly unknown[]): Segment[] {
  return merge(
    items.map((raw) => {
      const item = record(raw)
      const annotations = record(item.annotations)
      const text = record(item.text)
      const link = record(text.link)
      const content =
        typeof item.plain_text === "string"
          ? item.plain_text
          : typeof text.content === "string"
            ? text.content
            : ""
      const href =
        typeof item.href === "string"
          ? item.href
          : typeof link.url === "string"
            ? link.url
            : undefined

      return {
        text: content,
        bold: annotations.bold === true,
        italic: annotations.italic === true,
        strikethrough: annotations.strikethrough === true,
        underline: annotations.underline === true,
        code: annotations.code === true,
        colour: typeof annotations.color === "string" ? annotations.color : "default",
        ...(href ? { href } : {}),
      }
    })
  )
}

/** Write runs back as Notion rich text items, splitting any that are too long. */
export function toNotionRichText(segments: Segment[]) {
  return merge(segments).flatMap((segment) => {
    const chunks: string[] = []
    for (let start = 0; start < segment.text.length; start += MAX_ITEM_LENGTH) {
      chunks.push(segment.text.slice(start, start + MAX_ITEM_LENGTH))
    }
    return chunks.map((content) => ({
      type: "text" as const,
      text: {
        content,
        link: segment.href ? { url: segment.href } : null,
      },
      annotations: {
        bold: segment.bold,
        italic: segment.italic,
        strikethrough: segment.strikethrough,
        underline: segment.underline,
        code: segment.code,
        color: segment.colour,
      },
    }))
  })
}

// ─── The editor's text format ──────────────────────────────────────────────
//
// The block edits in a textarea, so formatting travels as the same Markdown
// shortcuts Notion accepts while typing: **bold**, *italic*, ~~strikethrough~~,
// `code` and [links](https://…). Underline and text colour have no shortcut, so
// they are kept whenever the words they sit on come back unchanged.

const MARKERS = [
  { token: "**", style: "bold" },
  { token: "~~", style: "strikethrough" },
  { token: "*", style: "italic" },
  { token: "_", style: "italic" },
] as const

type Toggle = (typeof MARKERS)[number]["style"]

/** Markers must hug the text they wrap, so edge spaces are moved outside. */
function wrap(text: string, open: string, close = open): string {
  const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(text)
  if (!match || !match[2]) return text
  return `${match[1]}${open}${match[2]}${close}${match[3]}`
}

function escapeMarkdown(text: string): string {
  return text.replace(/([\\*_~`[\]])/g, "\\$1")
}

export function toMarkdown(segments: Segment[]): string {
  return merge(segments)
    .map((segment) => {
      let text = segment.code
        ? wrap(segment.text.replace(/`/g, "'"), "`")
        : escapeMarkdown(segment.text)
      if (segment.italic) text = wrap(text, "*")
      if (segment.bold) text = wrap(text, "**")
      if (segment.strikethrough) text = wrap(text, "~~")
      if (segment.href) text = `[${text}](${segment.href})`
      return text
    })
    .join("")
}

/**
 * Parse the editor's text back into runs. Deliberately forgiving: a marker with
 * no partner later on is kept as a literal character rather than swallowing the
 * rest of the callout, and `\` escapes any marker.
 */
export function fromMarkdown(source: string, base: Style = PLAIN): Segment[] {
  const segments: Segment[] = []
  const style: Style = { ...base }
  let buffer = ""
  let index = 0

  const flush = () => {
    if (buffer) segments.push({ ...style, text: buffer })
    buffer = ""
  }

  while (index < source.length) {
    const char = source[index]

    if (char === "\\" && index + 1 < source.length) {
      buffer += source[index + 1]
      index += 2
      continue
    }

    if (char === "`") {
      const close = source.indexOf("`", index + 1)
      if (close > index + 1) {
        flush()
        segments.push({ ...style, code: true, text: source.slice(index + 1, close) })
        index = close + 1
        continue
      }
    }

    if (char === "[") {
      const link = /^\[((?:\\.|[^\]\\])+)\]\(([^)\s]+)\)/.exec(source.slice(index))
      if (link) {
        flush()
        segments.push(...fromMarkdown(link[1], { ...style, href: link[2] }))
        index += link[0].length
        continue
      }
    }

    const marker = MARKERS.find(({ token }) => source.startsWith(token, index))
    if (marker) {
      const on = style[marker.style as Toggle]
      const rest = source.slice(index + marker.token.length)
      // Opening needs a partner later on and text hugging the marker; closing
      // needs the marker to hug the text before it.
      // Underscores inside a word (snake_case) are never markers, as in Notion.
      const inWord =
        marker.token === "_" &&
        (/\w/.test(source[index - 1] ?? "") && (!on || /\w/.test(rest[0] ?? "")))
      const opens = !on && !inWord && /^\S/.test(rest) && hasCloser(rest, marker.token)
      const closes = on && !inWord && /\S$/.test(buffer || segments.at(-1)?.text || "")
      if (opens || closes) {
        flush()
        style[marker.style as Toggle] = !on
        index += marker.token.length
        continue
      }
    }

    buffer += char
    index += 1
  }

  flush()
  return merge(segments)
}

function hasCloser(rest: string, token: string): boolean {
  for (let at = rest.indexOf(token); at !== -1; at = rest.indexOf(token, at + 1)) {
    if (at > 0 && rest[at - 1] !== "\\" && /\S/.test(rest[at - 1])) return true
  }
  return false
}

/**
 * Carry underline and colour, which the editor cannot express, across an edit.
 * A run whose exact words survive at the same position keeps them.
 */
export function carryHiddenStyles(before: Segment[], after: Segment[]): Segment[] {
  const hidden = before.filter((segment) => segment.underline || segment.colour !== "default")
  if (hidden.length === 0) return after

  const beforeText = plainText(before)
  const afterText = plainText(after)
  if (beforeText !== afterText) return after

  // The words are unchanged, so rebuild from the original runs with the new
  // editor-visible formatting laid over them character by character.
  const visibleAt = (segments: Segment[]) =>
    segments.flatMap((segment) => Array.from(segment.text, () => segment))
  const oldAt = visibleAt(before)
  const newAt = visibleAt(after)

  return merge(
    Array.from(afterText, (char, i) => ({
      ...newAt[i],
      text: char,
      underline: oldAt[i]?.underline ?? false,
      colour: oldAt[i]?.colour ?? "default",
    }))
  )
}

// ─── Rows ──────────────────────────────────────────────────────────────────

/** A callout as the block renders it. */
export type Callout = {
  row?: NotionDataSourcePage
  text: string
  icon: string
  colour: CalloutColour
}

/**
 * Read a bound row. A row with an empty Icon means "no icon" only once it has
 * been saved from the block; a fresh one (no row yet) shows Notion's default.
 */
export function toCallout(row: NotionDataSourcePage | undefined): Callout {
  if (!row) return { text: "", icon: DEFAULT_ICON, colour: DEFAULT_COLOUR }
  const values = row.propertiesByKey
  return {
    row,
    text: typeof values.text === "string" ? values.text : "",
    icon: normaliseIcon(values.icon),
    colour: normaliseColour(values.colour),
  }
}
