import type { NotionPageIcon } from "@notionhq/custom-blocks"
import { useEffect, useMemo, useRef, useState } from "react"
import { EMOJI_GROUPS, searchEmoji } from "./emoji"
import { NotionIconGlyph } from "./NotionIconGlyph"
import {
  NOTION_ICON_COLOURS,
  NOTION_ICON_HEX,
  NOTION_ICONS,
  notionIconUrl,
  searchNotionIcons,
  type NotionIconColour,
} from "./notionIcons"
import { StepIcon } from "./StepIcon"

type IconPickerProps = {
  icon: NotionPageIcon | undefined
  disabled?: boolean
  /** `null` removes the icon. */
  onPick: (icon: NotionPageIcon | null) => void
}

type Tab = "icons" | "emoji"

/**
 * Icon picker offering Notion's own flat icons alongside emoji.
 *
 * This is a picker the block draws itself. Notion's native picker cannot be
 * summoned from a custom block: the bridge exposes messages for data, pages,
 * users and layout only, and has nothing for opening host UI — so a block can
 * write any icon it likes, but cannot ask Notion to present its chooser.
 *
 * What it writes is the real thing regardless. A Notion flat icon is stored as
 * an `external` icon pointing at Notion's icon host, exactly as the native
 * picker stores it, so the result is indistinguishable from one chosen in Notion.
 * The icons are drawn from bundled markup rather than loaded from that URL,
 * because the sandbox blocks the request.
 *
 * Removing an icon sends `null`. The SDK's types say `icon` is optional but not
 * nullable, which reads as "cannot be cleared" — but the bridge does no outgoing
 * validation, it only skips the field when it is `undefined`, so a `null` reaches
 * the host, and the host clears the icon exactly as Notion's REST API does.
 */
export function IconPicker({ icon, disabled, onPick }: IconPickerProps) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>("icons")
  const [query, setQuery] = useState("")
  const [colour, setColour] = useState<NotionIconColour>("gray")
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

  const iconResults = useMemo(() => searchNotionIcons(query), [query])
  const emojiResults = useMemo(() => searchEmoji(query), [query])

  function chooseIcon(name: string) {
    setOpen(false)
    onPick({ type: "external", external: { url: notionIconUrl(name, colour) } })
  }

  function chooseEmoji(char: string) {
    setOpen(false)
    onPick({ type: "emoji", emoji: char })
  }

  const icons = iconResults ?? NOTION_ICONS

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
          <div className="icon-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "icons"}
              className={`icon-tab ${tab === "icons" ? "is-active" : ""}`}
              onClick={() => setTab("icons")}
            >
              Icons
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "emoji"}
              className={`icon-tab ${tab === "emoji" ? "is-active" : ""}`}
              onClick={() => setTab("emoji")}
            >
              Emoji
            </button>
          </div>

          <div className="icon-menu-head">
            <input
              type="search"
              className="field-input"
              placeholder={tab === "icons" ? "Search icons" : "Search emoji"}
              aria-label={tab === "icons" ? "Search icons" : "Search emoji"}
              value={query}
              autoFocus
              onChange={(event) => setQuery(event.target.value)}
            />
            {icon ? (
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setOpen(false)
                  onPick(null)
                }}
              >
                Remove
              </button>
            ) : null}
          </div>

          {tab === "icons" ? (
            <div className="colour-row" role="radiogroup" aria-label="Icon colour">
              {NOTION_ICON_COLOURS.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={option === colour}
                  aria-label={option}
                  title={option}
                  className={`colour-swatch ${option === colour ? "is-active" : ""}`}
                  style={{ background: NOTION_ICON_HEX[option] }}
                  onClick={() => setColour(option)}
                />
              ))}
            </div>
          ) : null}

          <div className="icon-scroll">
            {tab === "icons" ? (
              icons.length > 0 ? (
                <div className="icon-grid">
                  {icons.map((entry) => (
                    <button
                      key={entry.name}
                      type="button"
                      className="icon-option"
                      title={entry.name.replace(/-/g, " ")}
                      aria-label={entry.name.replace(/-/g, " ")}
                      onClick={() => chooseIcon(entry.name)}
                    >
                      <NotionIconGlyph
                        className="icon-option-image"
                        name={entry.name}
                        colour={colour}
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="field-note">No icons match "{query}".</p>
              )
            ) : emojiResults ? (
              emojiResults.length > 0 ? (
                <div className="icon-grid">
                  {emojiResults.map((entry) => (
                    <EmojiButton
                      key={entry.char}
                      char={entry.char}
                      label={entry.keywords}
                      onPick={chooseEmoji}
                    />
                  ))}
                </div>
              ) : (
                <p className="field-note">No emoji match "{query}".</p>
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
                        onPick={chooseEmoji}
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
