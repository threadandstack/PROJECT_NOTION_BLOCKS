import { useEffect, useRef, useState } from "react"

type EditableTextProps = {
  label: string
  value: string
  placeholder: string
  multiline?: boolean
  disabled?: boolean
  onCommit: (next: string) => void
}

/**
 * A text field that writes back on blur, or on Enter for single-line fields.
 *
 * It holds a local draft so typing never fights the live data-source
 * subscription: snapshots arrive continuously, and re-rendering straight from
 * them would reset the caret mid-edit. The draft resyncs only when the field is
 * idle and the incoming value has actually changed.
 */
export function EditableText({
  label,
  value,
  placeholder,
  multiline,
  disabled,
  onCommit,
}: EditableTextProps) {
  const [draft, setDraft] = useState(value)
  const editing = useRef(false)

  useEffect(() => {
    if (!editing.current) setDraft(value)
  }, [value])

  function commit() {
    editing.current = false
    const next = draft.trim()
    if (next === value.trim()) {
      setDraft(value)
      return
    }
    onCommit(next)
  }

  const shared = {
    className: multiline ? "field-input field-textarea" : "field-input",
    "aria-label": label,
    value: draft,
    placeholder,
    disabled,
    onFocus: () => {
      editing.current = true
    },
    onChange: (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ) => setDraft(event.target.value),
    onBlur: commit,
  }

  if (multiline) {
    return (
      <textarea
        {...shared}
        rows={3}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            editing.current = false
            setDraft(value)
            event.currentTarget.blur()
          }
        }}
      />
    )
  }

  return (
    <input
      {...shared}
      type="text"
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault()
          event.currentTarget.blur()
        }
        if (event.key === "Escape") {
          editing.current = false
          setDraft(value)
          event.currentTarget.blur()
        }
      }}
    />
  )
}
