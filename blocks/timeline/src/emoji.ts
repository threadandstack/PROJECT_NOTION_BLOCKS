/**
 * A curated emoji set for the icon picker.
 *
 * The sandbox blocks CDN requests, so the picker cannot pull Notion's own emoji
 * data at runtime — everything it offers has to ship in the bundle. This is a
 * working set aimed at project and process timelines rather than an exhaustive
 * list, kept small enough not to bloat the block. `keywords` backs the search
 * box; the emoji's own group name is searched too.
 */
export type EmojiGroup = {
  name: string
  emoji: { char: string; keywords: string }[]
}

export const EMOJI_GROUPS: EmojiGroup[] = [
  {
    name: "Progress",
    emoji: [
      { char: "✅", keywords: "check tick done complete" },
      { char: "☑️", keywords: "checkbox done ticked" },
      { char: "🔄", keywords: "repeat cycle in progress loop" },
      { char: "⏳", keywords: "hourglass waiting pending time" },
      { char: "⏸️", keywords: "pause hold paused" },
      { char: "🚧", keywords: "roadworks blocked wip construction" },
      { char: "🛑", keywords: "stop blocked halt" },
      { char: "⚠️", keywords: "warning risk caution" },
      { char: "❗", keywords: "exclamation urgent important" },
      { char: "❓", keywords: "question unknown query" },
      { char: "🏁", keywords: "finish flag end launch" },
      { char: "🚀", keywords: "rocket launch ship release" },
    ],
  },
  {
    name: "Work",
    emoji: [
      { char: "📋", keywords: "clipboard plan brief tasks" },
      { char: "📝", keywords: "memo notes write draft" },
      { char: "📄", keywords: "document page file" },
      { char: "📁", keywords: "folder files archive" },
      { char: "📌", keywords: "pin pinned important" },
      { char: "📎", keywords: "paperclip attachment" },
      { char: "🗓️", keywords: "calendar date schedule" },
      { char: "⏰", keywords: "alarm deadline time" },
      { char: "📊", keywords: "chart data report metrics" },
      { char: "📈", keywords: "growth up increase trend" },
      { char: "📉", keywords: "down decrease decline" },
      { char: "🧾", keywords: "receipt invoice billing" },
      { char: "💼", keywords: "briefcase business work" },
      { char: "🏷️", keywords: "label tag category" },
      { char: "🔖", keywords: "bookmark saved" },
      { char: "📬", keywords: "mail inbox post" },
    ],
  },
  {
    name: "Making",
    emoji: [
      { char: "💡", keywords: "idea lightbulb concept discovery" },
      { char: "🔍", keywords: "search research discovery magnify" },
      { char: "🧭", keywords: "compass direction strategy navigate" },
      { char: "🗺️", keywords: "map plan roadmap route" },
      { char: "🎯", keywords: "target goal objective aim" },
      { char: "🧩", keywords: "puzzle piece fit structure" },
      { char: "🏗️", keywords: "construction build structure" },
      { char: "🔨", keywords: "hammer build fix" },
      { char: "🛠️", keywords: "tools build maintain" },
      { char: "⚙️", keywords: "gear settings config system" },
      { char: "🧱", keywords: "brick foundation base" },
      { char: "🪛", keywords: "screwdriver tweak adjust" },
      { char: "✏️", keywords: "pencil draft edit write" },
      { char: "🎨", keywords: "art design palette creative" },
      { char: "🖌️", keywords: "brush design paint" },
      { char: "📐", keywords: "ruler design measure spec" },
    ],
  },
  {
    name: "People",
    emoji: [
      { char: "👋", keywords: "wave hello intro kickoff" },
      { char: "🤝", keywords: "handshake agreement deal partner" },
      { char: "👥", keywords: "people team group" },
      { char: "🗣️", keywords: "speaking talk workshop voice" },
      { char: "💬", keywords: "chat comment discussion feedback" },
      { char: "📣", keywords: "megaphone announce launch marketing" },
      { char: "🎤", keywords: "mic present pitch talk" },
      { char: "🧑‍🏫", keywords: "teach training handover onboarding" },
      { char: "🙌", keywords: "celebrate praise hands win" },
      { char: "👏", keywords: "clap applause well done" },
      { char: "🫱", keywords: "hand offer give" },
      { char: "🧠", keywords: "brain thinking strategy" },
    ],
  },
  {
    name: "Signals",
    emoji: [
      { char: "🔵", keywords: "blue circle dot" },
      { char: "🟢", keywords: "green circle go good" },
      { char: "🟡", keywords: "yellow circle caution" },
      { char: "🔴", keywords: "red circle stop bad" },
      { char: "🟣", keywords: "purple circle" },
      { char: "🟠", keywords: "orange circle" },
      { char: "⭐", keywords: "star favourite highlight" },
      { char: "✨", keywords: "sparkles new shiny polish" },
      { char: "🔥", keywords: "fire hot urgent priority" },
      { char: "❄️", keywords: "frozen cold paused" },
      { char: "🌱", keywords: "seedling new growth start" },
      { char: "🌳", keywords: "tree mature established" },
      { char: "🔑", keywords: "key access critical" },
      { char: "🔒", keywords: "lock secure private closed" },
      { char: "🔓", keywords: "unlock open access" },
      { char: "🧪", keywords: "test experiment trial pilot" },
    ],
  },
]

/** Flat list of every emoji, used by search. */
const ALL = EMOJI_GROUPS.flatMap((group) =>
  group.emoji.map((entry) => ({ ...entry, group: group.name }))
)

/** Case-insensitive search over the emoji's keywords and group name. */
export function searchEmoji(query: string) {
  const term = query.trim().toLowerCase()
  if (!term) return null
  return ALL.filter(
    (entry) =>
      entry.keywords.includes(term) || entry.group.toLowerCase().includes(term)
  )
}
