import type { NotionPageIcon, NotionPropertyOption } from "@notionhq/custom-blocks"
import { useEffect, useId, useState } from "react"
import { IconPicker } from "./IconPicker"
import { StatusPicker } from "./StatusPicker"
import { StepIcon } from "./StepIcon"
import { formatDate, type Step as StepModel } from "./steps"

export type StepEdit = {
  title: string
  detail: string
  /** Only set when the icon was changed — the bridge cannot clear one. */
  icon?: NotionPageIcon
}

type StepProps = {
  step: StepModel
  index: number
  isLast: boolean
  icon: NotionPageIcon | null | undefined
  canMoveUp: boolean
  canMoveDown: boolean
  statusOptions: NotionPropertyOption[]
  expanded: boolean
  editing: boolean
  busy: boolean
  onToggle: () => void
  onStartEditing: () => void
  onStopEditing: () => void
  onSave: (edit: StepEdit) => void
  onSetStatus: (option: NotionPropertyOption) => void
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
}

export function Step({
  step,
  index,
  isLast,
  icon,
  canMoveUp,
  canMoveDown,
  statusOptions,
  expanded,
  editing,
  busy,
  onToggle,
  onStartEditing,
  onStopEditing,
  onSave,
  onSetStatus,
  onMove,
  onRemove,
}: StepProps) {
  const panelId = useId()
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  useEffect(() => {
    if (!expanded) setConfirmingRemove(false)
  }, [expanded])

  const date = formatDate(step.date)
  const title = step.title || "Untitled step"

  return (
    <li className={`step step-${step.phase} ${expanded ? "is-expanded" : ""}`}>
      <div className="rail" aria-hidden="true">
        <span className="bullet">
          {step.phase === "complete" ? <CheckMark /> : index}
        </span>
        {isLast ? null : <span className="connector" />}
      </div>

      <div className="step-body">
        <button
          type="button"
          className="step-header"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={onToggle}
        >
          {icon ? <StepIcon icon={icon} /> : null}
          <span className="step-title">{title}</span>
          {step.status ? (
            <span className="status-tag">{step.status}</span>
          ) : null}
          {date ? <span className="step-date">{date}</span> : null}
          <Chevron expanded={expanded} />
        </button>

        <div className="step-panel" id={panelId} hidden={!expanded}>
          {editing ? (
            <StepForm
              step={step}
              icon={icon ?? null}
              busy={busy}
              onCancel={onStopEditing}
              onSave={onSave}
            />
          ) : (
            <>
              {step.detail ? (
                <p className="detail-read">{step.detail}</p>
              ) : (
                <p className="detail-empty">No detail for this step yet.</p>
              )}

              <div className="step-meta">
                <StatusPicker
                  options={statusOptions}
                  value={step.status}
                  disabled={busy}
                  onSelect={onSetStatus}
                />
              </div>

              <div className="step-actions">
                <button
                  type="button"
                  className="ghost-button"
                  disabled={busy}
                  onClick={onStartEditing}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={busy || !canMoveUp}
                  onClick={() => onMove(-1)}
                >
                  Move up
                </button>
                <button
                  type="button"
                  className="ghost-button"
                  disabled={busy || !canMoveDown}
                  onClick={() => onMove(1)}
                >
                  Move down
                </button>

                {confirmingRemove ? (
                  <>
                    <button
                      type="button"
                      className="ghost-button danger is-confirming"
                      disabled={busy}
                      onClick={onRemove}
                    >
                      Confirm remove
                    </button>
                    <button
                      type="button"
                      className="ghost-button"
                      disabled={busy}
                      onClick={() => setConfirmingRemove(false)}
                    >
                      Keep
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="ghost-button danger"
                    disabled={busy}
                    onClick={() => setConfirmingRemove(true)}
                  >
                    Remove
                  </button>
                )}
              </div>

              {confirmingRemove ? (
                <p className="field-note">
                  This moves the step to Notion's archive. You can restore it
                  from the database.
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </li>
  )
}

/**
 * The edit form. Drafts are local until Save, so nothing is written to Notion
 * until it is asked for, and Cancel leaves the step exactly as it was.
 *
 * Deliberately not a `<form>`: the custom-block sandbox disallows form elements,
 * so a submit button's event never fires and Save silently does nothing. Enter in
 * the title field stands in for submitting.
 */
function StepForm({
  step,
  icon,
  busy,
  onCancel,
  onSave,
}: {
  step: StepModel
  icon: NotionPageIcon | null
  busy: boolean
  onCancel: () => void
  onSave: (edit: StepEdit) => void
}) {
  const [title, setTitle] = useState(step.title)
  const [detail, setDetail] = useState(step.detail)
  const [draftIcon, setDraftIcon] = useState<NotionPageIcon | null>(icon)
  const [iconChanged, setIconChanged] = useState(false)

  function submit() {
    onSave({
      title: title.trim(),
      detail: detail.trim(),
      ...(iconChanged && draftIcon ? { icon: draftIcon } : {}),
    })
  }

  return (
    <div className="step-form">
      <div className="field">
        <span className="field-label">Icon and title</span>
        <div className="title-row">
          <IconPicker
            icon={draftIcon ?? undefined}
            disabled={busy}
            onPick={(next) => {
              setDraftIcon(next)
              setIconChanged(true)
            }}
          />
          <input
            type="text"
            className="field-input"
            aria-label="Step title"
            placeholder="Name this step"
            value={title}
            disabled={busy}
            autoFocus
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                submit()
              }
            }}
          />
        </div>
      </div>

      <label className="field">
        <span className="field-label">Detail</span>
        <textarea
          className="field-input field-textarea"
          aria-label="Step detail"
          placeholder="What happens at this step?"
          rows={3}
          value={detail}
          disabled={busy}
          onChange={(event) => setDetail(event.target.value)}
        />
      </label>

      <div className="step-actions">
        <button
          type="button"
          className="primary-button"
          disabled={busy}
          onClick={submit}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="ghost-button"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

function Chevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`chevron ${expanded ? "is-open" : ""}`}
      viewBox="0 0 12 12"
      width="12"
      height="12"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4 2.5 7.5 6 4 9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CheckMark() {
  return (
    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
      <path
        d="M2.5 6.2 5 8.7l4.5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
