import { pages, type NotionPropertyOption } from "@notionhq/custom-blocks"
import { useDataSource } from "@notionhq/custom-blocks/react"
import { useCallback, useMemo, useState } from "react"
import { Step } from "./Step"
import { nextPosition, statusOptions, toSteps, type Step as StepModel } from "./steps"

const DATA_SOURCE_KEY = "steps"
const PAGE_SIZE = 25
const MAX_ROWS = 999

/** A write result from either the per-row helper or the `pages` API. */
type WriteResult = { status: "success" } | { status: "error"; error: { message: string } }

export function App() {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const [busyId, setBusyId] = useState<string | null>(null)
  const [writeError, setWriteError] = useState<string | null>(null)

  const query = useDataSource(DATA_SOURCE_KEY, { limit })
  const { items, propertySchemasByKey, isLoading, hasMore, error } = query

  const options = useMemo(
    () => statusOptions(propertySchemasByKey.status),
    [propertySchemasByKey.status]
  )
  const steps = useMemo(
    () => toSteps(items, propertySchemasByKey.status),
    [items, propertySchemasByKey.status]
  )

  /**
   * Run one write, keeping the affected step disabled until it settles and
   * surfacing any failure. Reads refresh through the live subscription, so
   * there is nothing to reconcile here on success.
   */
  const write = useCallback(
    async (id: string, run: () => Promise<WriteResult>) => {
      setBusyId(id)
      setWriteError(null)
      try {
        const result = await run()
        if (result.status === "error") setWriteError(result.error.message)
      } catch (cause) {
        setWriteError(cause instanceof Error ? cause.message : String(cause))
      } finally {
        setBusyId(null)
      }
    },
    []
  )

  const toggle = useCallback((id: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }, [])

  function editTitle(step: StepModel, value: string) {
    void write(step.id, () =>
      step.row.update({
        properties: {
          title: { type: "title", title: [{ type: "text", text: { content: value } }] },
        },
      })
    )
  }

  function editDetail(step: StepModel, value: string) {
    void write(step.id, () =>
      step.row.update({
        properties: {
          detail: {
            type: "rich_text",
            rich_text: value ? [{ type: "text", text: { content: value } }] : [],
          },
        },
      })
    )
  }

  function setStatus(step: StepModel, option: NotionPropertyOption) {
    void write(step.id, () =>
      step.row.update({
        properties: { status: { type: "status", status: { id: option.id } } },
      })
    )
  }

  /**
   * Swap a step with its neighbour by exchanging their positions. Steps with no
   * position yet take their current index, so an unordered list sorts itself out
   * the first time anything is moved.
   */
  function move(index: number, direction: -1 | 1) {
    const step = steps[index]
    const neighbour = steps[index + direction]
    if (!step || !neighbour) return

    const here = step.position ?? index + 1
    const there = neighbour.position ?? index + direction + 1

    void write(step.id, async () => {
      const moved = await step.row.update({
        properties: { position: { type: "number", number: there } },
      })
      if (moved.status === "error") return moved
      return neighbour.row.update({
        properties: { position: { type: "number", number: here } },
      })
    })
  }

  function remove(step: StepModel) {
    void write(step.id, async () => {
      const result = await step.row.archive()
      if (result.status === "success") {
        setExpanded((current) => {
          const next = new Set(current)
          next.delete(step.id)
          return next
        })
      }
      return result
    })
  }

  function addStep() {
    void write("new", async () => {
      const result = await pages.create({
        parent: { type: "data_source_key", key: DATA_SOURCE_KEY },
        properties: {
          title: {
            type: "title",
            title: [{ type: "text", text: { content: "New step" } }],
          },
          position: { type: "number", number: nextPosition(steps) },
        },
      })
      if (result.status === "success") {
        setExpanded((current) => new Set(current).add(result.page.id))
      }
      return result
    })
  }

  if (error) {
    return (
      <div className="notice" role="alert">
        Couldn't load the timeline: {error.message}
      </div>
    )
  }

  if (isLoading && steps.length === 0) {
    return (
      <div className="notice" aria-busy="true">
        Loading timeline…
      </div>
    )
  }

  return (
    <main className="timeline-root">
      {writeError ? (
        <div className="notice notice-error" role="alert">
          {writeError}
        </div>
      ) : null}

      {steps.length === 0 ? (
        <p className="empty">
          No steps yet. Add the first one to start the timeline.
        </p>
      ) : (
        <ol className="timeline">
          {steps.map((step, index) => (
            <Step
              key={step.id}
              step={step}
              index={index + 1}
              isLast={index === steps.length - 1}
              canMoveUp={index > 0}
              canMoveDown={index < steps.length - 1}
              statusOptions={options}
              expanded={expanded.has(step.id)}
              busy={busyId === step.id}
              canEdit
              onToggle={() => toggle(step.id)}
              onEditTitle={(value) => editTitle(step, value)}
              onEditDetail={(value) => editDetail(step, value)}
              onSetStatus={(option) => setStatus(step, option)}
              onMove={(direction) => move(index, direction)}
              onRemove={() => remove(step)}
            />
          ))}
        </ol>
      )}

      <div className="timeline-footer">
        <button
          type="button"
          className="add-button"
          disabled={busyId !== null}
          onClick={addStep}
        >
          + Add step
        </button>

        {hasMore && limit < MAX_ROWS ? (
          <button
            type="button"
            className="ghost-button"
            disabled={isLoading}
            onClick={() => setLimit((current) => Math.min(current + PAGE_SIZE, MAX_ROWS))}
          >
            {isLoading ? "Loading…" : "Show more steps"}
          </button>
        ) : null}

        {hasMore && limit >= MAX_ROWS ? (
          <span className="field-note">
            Showing the first {MAX_ROWS} steps — this timeline has more.
          </span>
        ) : null}
      </div>
    </main>
  )
}
