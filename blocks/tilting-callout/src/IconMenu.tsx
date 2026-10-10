import { useEffect, useRef, useState } from "react"
import { normaliseIcon, type CalloutColour } from "./callout"
import { ColourGrid } from "./ColourGrid"

/** The icons people reach for most in callouts, in Notion's picker order. */
const EMOJI = [
  "💡", "📌", "⚠️", "✅", "❗", "❓", "ℹ️", "🔥",
  "📣", "🧭", "✨", "📝", "🚀", "⭐", "💬", "💭",
  "📎", "🔗", "📅", "⏰", "🎯", "🏁", "🛠️", "🔒",
  "🔑", "👀", "👉", "🙌", "👍", "🎉", "⚡", "🌱",
  "🌍", "🎨", "📚", "🧪", "🧠", "❤️", "💙", "💚",
]

type IconMenuProps = {
  icon: string
  colour: CalloutColour
  onIcon: (icon: string) => void
  onColour: (colour: CalloutColour) => void
  onClose: () => void
  menuRef: (node: HTMLDivElement | null) => void
}

/**
 * What clicking a callout's icon opens: Notion's emoji picker (with Remove at
 * the top right, as Notion has it) and the callout's colour. Choosing anything
 * applies it straight away and closes the menu.
 */
export function IconMenu({ icon, colour, onIcon, onColour, onClose, menuRef }: IconMenuProps) {
  const [typed, setTyped] = useState("")
  const card = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    card.current?.querySelector<HTMLInputElement>(".menu-input")?.focus()
  }, [])

  function pick(next: string) {
    onIcon(next)
    onClose()
  }

  return (
    <div
      ref={(node) => {
        card.current = node
        menuRef(node)
      }}
      className="format-menu icon-menu"
      role="dialog"
      aria-label="Icon and colour"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault()
          onClose()
        }
      }}
      onBlur={(event) => {
        if (!(event.relatedTarget instanceof Node) || !card.current?.contains(event.relatedTarget)) onClose()
      }}
    >
      <div className="menu-header">
        <span className="menu-tab">Emoji</span>
        {icon ? (
          <button type="button" className="menu-row-button" onClick={() => pick("")}>
            Remove
          </button>
        ) : null}
      </div>

      <input
        className="menu-input"
        value={typed}
        placeholder="Type or paste an emoji…"
        aria-label="Emoji"
        onChange={(event) => {
          const next = normaliseIcon(event.target.value)
          if (next) pick(next)
          else setTyped(event.target.value)
        }}
      />

      <div className="emoji-grid">
        {EMOJI.map((choice) => (
          <button
            key={choice}
            type="button"
            className={`emoji-choice ${choice === icon ? "is-selected" : ""}`}
            aria-label={`Use ${choice}`}
            aria-pressed={choice === icon}
            onClick={() => pick(choice)}
          >
            {choice}
          </button>
        ))}
      </div>

      <div className="menu-panel">
        <ColourGrid
          value={colour}
          onPick={(picked) => {
            onColour(picked)
            onClose()
          }}
        />
      </div>
    </div>
  )
}
