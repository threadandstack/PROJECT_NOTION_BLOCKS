import { useEffect, useRef, useState } from "react"
import {
  COLOURS,
  HUES,
  colourLabel,
  normaliseIcon,
  type CalloutColour,
} from "./callout"

export type CalloutEdit = {
  markdown: string
  icon: string
  colour: CalloutColour
}

type EditorProps = {
  initial: CalloutEdit
  busy: boolean
  onSave: (edit: CalloutEdit) => void
  onCancel: () => void
  /** Called as the icon or colour changes, so the callout can preview them. */
  onPreview: (look: Pick<CalloutEdit, "icon" | "colour">) => void
}

/** A handful of the icons people reach for most in callouts. */
const QUICK_ICONS = ["💡", "📌", "⚠️", "✅", "❗", "ℹ️", "🔥", "📣", "🧭", "✨", "📝", "🚀"]

const TEXT_COLOURS = COLOURS.filter((colour) => !colour.endsWith("_background"))
const BACKGROUND_COLOURS = HUES.map((hue) => `${hue}_background` as const)

/**
 * The callout's edit form. Nothing is written until Save; Cancel (or Escape)
 * leaves the callout as it was. Ctrl/Cmd+Enter saves from the text box, the
 * same shortcut Notion's own dialogs use.
 */
export function Editor({ initial, busy, onSave, onCancel, onPreview }: EditorProps) {
  const [markdown, setMarkdown] = useState(initial.markdown)
  const [icon, setIcon] = useState(initial.icon)
  const [colour, setColour] = useState<CalloutColour>(initial.colour)
  const textRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const node = textRef.current
    if (!node) return
    node.focus()
    node.setSelectionRange(node.value.length, node.value.length)
  }, [])

  useEffect(() => {
    onPreview({ icon: normaliseIcon(icon), colour })
  }, [icon, colour, onPreview])

  function save() {
    onSave({ markdown, icon: normaliseIcon(icon), colour })
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault()
      onCancel()
    } else if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      save()
    }
  }

  return (
    <div className="editor" onKeyDown={onKeyDown}>
      <label className="field">
        <span className="field-label">Text</span>
        <textarea
          ref={textRef}
          className="field-input field-textarea"
          value={markdown}
          disabled={busy}
          rows={3}
          placeholder="Type something…"
          onChange={(event) => setMarkdown(event.target.value)}
        />
        <span className="field-note">
          **bold**, *italic*, ~~strikethrough~~, `code` and [link](https://…) all work.
          Ctrl+Enter saves.
        </span>
      </label>

      <fieldset className="field">
        <legend className="field-label">Icon</legend>
        <div className="icon-row">
          <input
            className="field-input icon-input"
            value={icon}
            disabled={busy}
            aria-label="Icon (paste or type an emoji)"
            placeholder="None"
            onChange={(event) => setIcon(event.target.value)}
          />
          {QUICK_ICONS.map((choice) => (
            <button
              key={choice}
              type="button"
              className={`icon-choice ${normaliseIcon(icon) === choice ? "is-selected" : ""}`}
              aria-label={`Use ${choice}`}
              aria-pressed={normaliseIcon(icon) === choice}
              disabled={busy}
              onClick={() => setIcon(choice)}
            >
              {choice}
            </button>
          ))}
          <button
            type="button"
            className="ghost-button"
            disabled={busy || !icon}
            onClick={() => setIcon("")}
          >
            No icon
          </button>
        </div>
      </fieldset>

      <fieldset className="field">
        <legend className="field-label">Colour</legend>
        <ColourRow label="Text" colours={TEXT_COLOURS} value={colour} busy={busy} onPick={setColour} />
        <ColourRow
          label="Background"
          colours={BACKGROUND_COLOURS}
          value={colour}
          busy={busy}
          onPick={setColour}
        />
      </fieldset>

      <div className="editor-actions">
        <button type="button" className="primary-button" disabled={busy} onClick={save}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" className="ghost-button" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

type ColourRowProps = {
  label: string
  colours: readonly CalloutColour[]
  value: CalloutColour
  busy: boolean
  onPick: (colour: CalloutColour) => void
}

/** One row of swatches, shown as the "A" chips Notion's colour menu uses. */
function ColourRow({ label, colours, value, busy, onPick }: ColourRowProps) {
  return (
    <div className="colour-row" role="radiogroup" aria-label={`${label} colour`}>
      <span className="colour-row-label">{label}</span>
      {colours.map((colour) => (
        <button
          key={colour}
          type="button"
          role="radio"
          aria-checked={value === colour}
          aria-label={colourLabel(colour)}
          title={colourLabel(colour)}
          className={`colour-chip c-${colour} ${value === colour ? "is-selected" : ""}`}
          disabled={busy}
          onClick={() => onPick(colour)}
        >
          A
        </button>
      ))}
    </div>
  )
}
