/**
 * Notion's own flat icon set.
 *
 * These are not emoji. Notion stores a built-in icon as an ordinary `external`
 * page icon pointing at `https://www.notion.so/icons/<name>_<colour>.svg`, so a
 * block can offer them by building that URL — an icon chosen here is the same
 * value Notion's own picker would have written, and renders identically
 * everywhere the page appears.
 *
 * The list is verified rather than guessed: every name below was checked against
 * Notion's icon host, and names that 404 were dropped. It is a working subset of
 * Notion's library, not the whole thing — the sandbox cannot enumerate the real
 * catalogue, so extending it means verifying more names the same way.
 */
export const NOTION_ICON_COLOURS = [
  "lightgray",
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

export type NotionIconColour = (typeof NOTION_ICON_COLOURS)[number]

export type NotionIcon = { name: string; keywords: string }

export const NOTION_ICONS: NotionIcon[] = [
  { name: "activity", keywords: "activity" },
  { name: "alarm", keywords: "alarm" },
  { name: "arrow-right", keywords: "arrow right" },
  { name: "attachment", keywords: "attachment" },
  { name: "battery", keywords: "battery" },
  { name: "bell", keywords: "bell" },
  { name: "bicycle", keywords: "bicycle" },
  { name: "book", keywords: "book" },
  { name: "bookmark", keywords: "bookmark" },
  { name: "briefcase", keywords: "briefcase" },
  { name: "bug", keywords: "bug" },
  { name: "bullseye", keywords: "bullseye target goal" },
  { name: "calendar", keywords: "calendar" },
  { name: "camera", keywords: "camera" },
  { name: "car", keywords: "car" },
  { name: "chart", keywords: "chart data metrics report" },
  { name: "chat", keywords: "chat" },
  { name: "checklist", keywords: "checklist tasks todo" },
  { name: "checkmark", keywords: "checkmark done complete tick" },
  { name: "clock", keywords: "clock time deadline" },
  { name: "cloud", keywords: "cloud" },
  { name: "code", keywords: "code" },
  { name: "coffee", keywords: "coffee" },
  { name: "compass", keywords: "compass direction strategy" },
  { name: "computer", keywords: "computer" },
  { name: "create", keywords: "create new add" },
  { name: "cursor", keywords: "cursor" },
  { name: "dashboard", keywords: "dashboard metrics overview" },
  { name: "database", keywords: "database" },
  { name: "document", keywords: "document doc page file" },
  { name: "download", keywords: "download" },
  { name: "drink", keywords: "drink" },
  { name: "exclamation-mark", keywords: "exclamation mark urgent important" },
  { name: "feed", keywords: "feed" },
  { name: "fire", keywords: "fire urgent priority hot" },
  { name: "flag", keywords: "flag milestone marker" },
  { name: "folder", keywords: "folder" },
  { name: "gear", keywords: "gear settings config" },
  { name: "gift", keywords: "gift" },
  { name: "globe", keywords: "globe" },
  { name: "graduate", keywords: "graduate training handover education" },
  { name: "grid", keywords: "grid" },
  { name: "groups", keywords: "groups team people" },
  { name: "hammer", keywords: "hammer build make" },
  { name: "hand", keywords: "hand" },
  { name: "heart", keywords: "heart" },
  { name: "home", keywords: "home" },
  { name: "inbox", keywords: "inbox" },
  { name: "key", keywords: "key access critical" },
  { name: "keyboard", keywords: "keyboard" },
  { name: "layers", keywords: "layers" },
  { name: "library", keywords: "library" },
  { name: "link", keywords: "link" },
  { name: "list", keywords: "list" },
  { name: "location", keywords: "location" },
  { name: "lock", keywords: "lock secure private" },
  { name: "mail", keywords: "mail" },
  { name: "map", keywords: "map plan route" },
  { name: "megaphone", keywords: "megaphone announce marketing launch" },
  { name: "microphone", keywords: "microphone" },
  { name: "moon", keywords: "moon" },
  { name: "music", keywords: "music" },
  { name: "network", keywords: "network" },
  { name: "news", keywords: "news" },
  { name: "notification", keywords: "notification" },
  { name: "package", keywords: "package delivery ship" },
  { name: "pen", keywords: "pen" },
  { name: "phone", keywords: "phone" },
  { name: "pin", keywords: "pin" },
  { name: "plus", keywords: "plus" },
  { name: "puzzle", keywords: "puzzle fit structure" },
  { name: "question-mark", keywords: "question mark unknown query" },
  { name: "refresh", keywords: "refresh" },
  { name: "repeat", keywords: "repeat" },
  { name: "rocket", keywords: "rocket launch ship release" },
  { name: "ruler", keywords: "ruler" },
  { name: "save", keywords: "save" },
  { name: "science", keywords: "science experiment test pilot" },
  { name: "search", keywords: "search" },
  { name: "send", keywords: "send deliver submit" },
  { name: "server", keywords: "server" },
  { name: "share", keywords: "share" },
  { name: "shield", keywords: "shield security safe" },
  { name: "shopping-cart", keywords: "shopping cart" },
  { name: "snippet", keywords: "snippet" },
  { name: "star", keywords: "star favourite highlight" },
  { name: "stars", keywords: "stars" },
  { name: "stopwatch", keywords: "stopwatch time duration" },
  { name: "subtask", keywords: "subtask steps breakdown" },
  { name: "sun", keywords: "sun" },
  { name: "sync", keywords: "sync" },
  { name: "table", keywords: "table" },
  { name: "tag", keywords: "tag" },
  { name: "target", keywords: "target" },
  { name: "thumbs-up", keywords: "thumbs up" },
  { name: "ticket", keywords: "ticket" },
  { name: "timeline", keywords: "timeline roadmap schedule" },
  { name: "token", keywords: "token" },
  { name: "trophy", keywords: "trophy win success" },
  { name: "umbrella", keywords: "umbrella" },
  { name: "upload", keywords: "upload" },
  { name: "user", keywords: "user person people" },
  { name: "verified", keywords: "verified approved signed off" },
  { name: "warning", keywords: "warning risk caution" },
  { name: "wrench", keywords: "wrench fix maintain" },
]

/** The URL Notion itself stores for a built-in icon. */
export function notionIconUrl(name: string, colour: NotionIconColour): string {
  return `https://www.notion.so/icons/${name}_${colour}.svg`
}

/** Case-insensitive search over an icon's name and its aliases. */
export function searchNotionIcons(query: string): NotionIcon[] | null {
  const term = query.trim().toLowerCase()
  if (!term) return null
  return NOTION_ICONS.filter((icon) => icon.keywords.includes(term))
}
