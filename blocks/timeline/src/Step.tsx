import type { NotionPropertyOption } from "@notionhq/custom-blocks"
import { useEffect, useId, useState } from "react"
import { EditableText } from "./EditableText"
import { StatusPicker } from "./StatusPicker"
import { formatDate, type Step as StepModel } from "./steps"

type StepProps = {
  step: StepModel
  index: number
  isLast: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  statusOptions: NotionPropertyOption[]
  expanded: boolean
  busy: boolean
  canEdit: boolean
  onToggle: () => void
  onEditTitle: (value: string) => void
  onEditDetail: (value: string) => void
  onSetStatus: (option: NotionPropertyOption) => void
  onMove: (direction: -1 | 1) => void
  onRemove: () => void
}

export function Step({
  step,
  index,
  isLast,
  canMoveUp,
  canMoveDown,
  statusOptions,
  expanded,
  busy,
  canEdit,
  onToggle,
  onEditTitle,
  onEditDetail,
  onSetStatus,
  onMove,
  onRemove,
}: StepProps) {
  const panelId = useId()
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  // Collapsing the step cancels a pending delete, so a half-confirmed action
  // never sits waiting behind a closed panel.
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
          <span className="step-title">{title}</span>
          {step.status ? (
            <span className="status-tag">{step.status}</span>
          ) : null}
          {date ? <span className="step-date">{date}</span> : null}
          <Chevron expanded={expanded} />
        </button>

        <div className="step-panel" id={panelId} hidden={!expanded}>
          {canEdit ? (
            <>
              <label className="field">
                <span className="field-label">Title</span>
                <EditableText
                  label="Step title"
                  value={step.title}
                  placeholder="Name this step"
                  disabled={busy}
                  onCommit={onEditTitle}
                />
              </label>

              <label className="field">
                <span className="field-label">Detail</span>
                <EditableText
                  label="Step detail"
                  value={step.detail}
                  placeholder="What happens at this step?"
                  multiline
                  disabled={busy}
                  onCommit={onEditDetail}
                />
              </label>

              <div className="field">
                <span className="field-label">Status</span>
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
          ) : (
            <p className="detail-read">
              {step.detail || "No detail for this step yet."}
            </p>
          )}
        </div>
      </div>
    </li>
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
