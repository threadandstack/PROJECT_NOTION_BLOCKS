import type { NotionPropertyOption } from "@notionhq/custom-blocks"
import { useEffect, useId, useState } from "react"
import { StatusPicker } from "./StatusPicker"
import { formatDate, type Step as StepModel } from "./steps"

export type StepEdit = {
  title: string
  detail: string
  /** Only set when the status was changed. */
  status?: NotionPropertyOption
}

type StepProps = {
  step: StepModel
  index: number
  isLast: boolean
  canMoveUp: boolean
  canMoveDown: boolean
  statusOptions: NotionPropertyOption[]
  expanded: boolean
  /** Whether the stepline as a whole is being edited. */
  editable: boolean
  editing: boolean
  busy: boolean
  onToggle: () => void
  /** Open the status menu below the element clicked; absent when there are no statuses to pick. */
  onOpenStatus?: (anchor: HTMLElement) => void
  onStartEditing: () => void
  onStopEditing: () => void
  onSave: (edit: StepEdit) => void
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
  editable,
  editing,
  busy,
  onToggle,
  onOpenStatus,
  onStartEditing,
  onStopEditing,
  onSave,
  onMove,
  onRemove,
}: StepProps) {
  const panelId = useId()
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  useEffect(() => {
    if (!expanded || !editable) setConfirmingRemove(false)
  }, [expanded, editable])

  const date = formatDate(step.date)
  const title = step.title || "Untitled step"

  return (
    <li className={`step step-${step.phase} ${expanded ? "is-expanded" : ""}`}>
      <div className="rail">
        {/*
          The bullet doubles as the status control, like the pill beside the
          title: clicking either opens the status menu.
        */}
        {onOpenStatus ? (
          <button
            type="button"
            className="bullet"
            aria-label={`Step ${index} status: ${step.status ?? "none"}. Change status`}
            aria-haspopup="menu"
            disabled={busy}
            onClick={(event) => onOpenStatus(event.currentTarget)}
          >
            {step.phase === "complete" ? <DoneMark /> : index}
          </button>
        ) : (
          <span className="bullet" aria-hidden="true">
            {step.phase === "complete" ? <DoneMark /> : index}
          </span>
        )}
        {isLast ? null : <span className="connector" aria-hidden="true" />}
      </div>

      <div className="step-body">
        {/*
          The row toggles the step open, but holds the status pill, which is a
          button of its own, so it is a div with button behaviour rather than a
          <button> (buttons cannot nest).
        */}
        <div
          role="button"
          tabIndex={0}
          className="step-header"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={onToggle}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault()
              onToggle()
            }
          }}
        >
          <span className={`step-title ${step.tone ? `tone-${step.tone}` : ""}`}>
            {title}
          </span>
          {step.status && onOpenStatus ? (
            <button
              type="button"
              className={`status-tag status-button pill-${step.pill}`}
              aria-haspopup="menu"
              aria-label={`Status: ${step.status}. Change status`}
              disabled={busy}
              onClick={(event) => {
                event.stopPropagation()
                onOpenStatus(event.currentTarget)
              }}
            >
              {step.status}
            </button>
          ) : step.status ? (
            <span className={`status-tag pill-${step.pill}`}>{step.status}</span>
          ) : null}
          {date ? <span className="step-date">{date}</span> : null}
          <Chevron expanded={expanded} />
        </div>

        <div className="step-panel" id={panelId} hidden={!expanded}>
          {editing ? (
            <StepForm
              step={step}
              statusOptions={statusOptions}
              busy={busy}
              onCancel={onStopEditing}
              onSave={onSave}
            />
          ) : (
            <>
              {step.detail ? (
                <p className="detail-read">{step.detail}</p>
              ) : editable ? (
                <p className="detail-empty">No detail for this step yet.</p>
              ) : null}

              {/*
                Actions belong to editing the stepline, not to reading it — a
                step that is simply open shows its words and nothing else.
              */}
              {editable ? (
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
              ) : null}

              {editable && confirmingRemove ? (
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
  statusOptions,
  busy,
  onCancel,
  onSave,
}: {
  step: StepModel
  statusOptions: NotionPropertyOption[]
  busy: boolean
  onCancel: () => void
  onSave: (edit: StepEdit) => void
}) {
  const [title, setTitle] = useState(step.title)
  const [detail, setDetail] = useState(step.detail)
  const [status, setStatus] = useState<NotionPropertyOption | null>(null)

  function submit() {
    onSave({
      title: title.trim(),
      detail: detail.trim(),
      ...(status ? { status } : {}),
    })
  }

  return (
    <div className="step-form">
      <label className="field">
        <span className="field-label">Title</span>
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
      </label>

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

      <div className="field">
        <span className="field-label">Status</span>
        <StatusPicker
          options={statusOptions}
          value={status?.name ?? step.status}
          disabled={busy}
          onSelect={setStatus}
        />
      </div>

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

/** The brand check-circle: a filled circle with the tick cut out (fill-rule evenodd). */
function DoneMark() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14m3.844-8.791a.75.75 0 0 0-1.188-.918l-3.7 4.79-1.649-1.833a.75.75 0 1 0-1.114 1.004l2.25 2.5a.75.75 0 0 0 1.15-.043l4.25-5.5Z"
      />
    </svg>
  )
}
