import type { NotionPageIcon } from "@notionhq/custom-blocks"
import { useEffect, useMemo, useRef, useState } from "react"
import { EMOJI_GROUPS, searchEmoji } from "./emoji"
import { StepIcon } from "./StepIcon"

type IconPickerProps = {
  icon: NotionPageIcon | undefined
  disabled?: boolean
  onPick: (icon: NotionPageIcon) => void
}

/**
 * Emoji picker for a step's Notion page icon.
 *
 * Only emoji can be chosen here. A step that already carries a custom emoji or
 * an uploaded image keeps it — the trigger renders it and it survives until
 * someone picks a replacement — but the block does not offer those, because
 * custom emoji need workspace IDs the sandbox cannot browse and file uploads
 * are not available to custom blocks.
 *
 * There is deliberately no "remove icon" control. The bridge's update message
 * types `icon` as optional but not nullable, so an icon can be set or replaced
 * but never cleared; a remove button here would silently do nothing. Clearing an
 * icon has to be done on the page itself in Notion.
 */
export function IconPicker({ icon, disabled, onPick }: IconPickerProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) {
      setQuery("")
      return
    }

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("mousedown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  const results = useMemo(() => searchEmoji(query), [query])

  function choose(char: string) {
    setOpen(false)
    onPick({ type: "emoji", emoji: char })
  }

  return (
    <div className="icon-picker" ref={containerRef}>
      <button
        type="button"
        className="icon-trigger"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={icon ? "Change icon" : "Add an icon"}
        onClick={() => setOpen((current) => !current)}
      >
        {icon ? <StepIcon icon={icon} /> : <span className="icon-empty">+</span>}
      </button>

      {open ? (
        <div className="icon-menu" role="dialog" aria-label="Choose an icon">
          <div className="icon-menu-head">
            <input
              type="search"
              className="field-input"
              placeholder="Search icons"
              aria-label="Search icons"
              value={query}
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="icon-scroll">
            {results ? (
              results.length > 0 ? (
                <div className="icon-grid">
                  {results.map((entry) => (
                    <EmojiButton
                      key={entry.char}
                      char={entry.char}
                      label={entry.keywords}
                      onPick={choose}
                    />
                  ))}
                </div>
              ) : (
                <p className="field-note">No icons match "{query}".</p>
              )
            ) : (
              EMOJI_GROUPS.map((group) => (
                <section key={group.name} className="icon-group">
                  <h3 className="icon-group-name">{group.name}</h3>
                  <div className="icon-grid">
                    {group.emoji.map((entry) => (
                      <EmojiButton
                        key={entry.char}
                        char={entry.char}
                        label={entry.keywords}
                        onPick={choose}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function EmojiButton({
  char,
  label,
  onPick,
}: {
  char: string
  label: string
  onPick: (char: string) => void
}) {
  return (
    <button
      type="button"
      className="icon-option"
      title={label}
      aria-label={label}
      onClick={() => onPick(char)}
    >
      {char}
    </button>
  )
}
