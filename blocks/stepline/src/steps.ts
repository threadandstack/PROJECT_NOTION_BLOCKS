import type {
  NotionDataSourcePage,
  NotionDataSourceValue,
  NotionPropertyOption,
  NotionPropertySchema,
} from "@notionhq/custom-blocks"

/**
 * How a step's status reads visually on the rail. Derived from the bound Status
 * property's own groups rather than from option names, so the block adapts to
 * whatever status scheme a workspace already uses.
 */
export type StepPhase = "complete" | "active" | "todo"

export type Step = {
  row: NotionDataSourcePage
  id: string
  title: string
  detail: string
  status?: string
  position?: number
  date?: string
  phase: StepPhase
}

/** Notion's three built-in status groups, lower-cased for matching. */
const COMPLETE_GROUP = "complete"
const ACTIVE_GROUP = "in progress"

/** Fallbacks for workspaces whose status property has renamed its groups. */
const COMPLETE_WORDS = ["done", "complete", "completed", "shipped", "live"]
const ACTIVE_WORDS = ["in progress", "doing", "active", "started", "current"]

function asText(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

/**
 * Notion returns a date property as a `NotionDateValue` union — all-day
 * (`date` / `daterange`) or timestamped (`datetime` / `datetimerange`). Every
 * variant carries `start_date`; the timestamped ones add `start_time`. We only
 * display the start, so the end of a range is deliberately dropped.
 */
function asDateStart(
  value: NotionDataSourceValue | undefined
): string | undefined {
  if (!value || typeof value !== "object" || !("start_date" in value)) {
    return undefined
  }

  const start = value.start_date
  if (typeof start !== "string") return undefined

  const time = "start_time" in value ? value.start_time : undefined
  return typeof time === "string" ? `${start}T${time}` : start
}

/** The Status property's options, in the order Notion lists them. */
export function statusOptions(
  schema: NotionPropertySchema | undefined
): NotionPropertyOption[] {
  if (!schema || schema.type !== "status") return []
  return schema.options ?? []
}

/**
 * Map a status option to a phase. Group membership is authoritative; the
 * word-list fallback only runs when the host gives us no groups.
 */
function phaseForStatus(
  status: string | undefined,
  schema: NotionPropertySchema | undefined
): StepPhase {
  if (!status) return "todo"

  if (schema?.type === "status") {
    const option = schema.options?.find((candidate) => candidate.name === status)
    const group = schema.groups?.find((candidate) =>
      option ? candidate.option_ids.includes(option.id) : false
    )
    if (group) {
      const name = group.name.toLowerCase()
      if (name.includes(COMPLETE_GROUP)) return "complete"
      if (name.includes(ACTIVE_GROUP)) return "active"
      return "todo"
    }
  }

  const name = status.toLowerCase()
  if (COMPLETE_WORDS.some((word) => name.includes(word))) return "complete"
  if (ACTIVE_WORDS.some((word) => name.includes(word))) return "active"
  return "todo"
}

/**
 * Turn raw rows into ordered steps.
 *
 * `position` is sorted client-side rather than through the query's `sorts`
 * because rows with no position must fall to the end in a stable, predictable
 * way — Notion sorts empty values last in both directions, which would shuffle
 * them against each other as they are edited.
 */
export function toSteps(
  rows: NotionDataSourcePage[],
  statusSchema: NotionPropertySchema | undefined
): Step[] {
  return rows
    .map((row) => {
      const status = asText(row.propertiesByKey.status) || undefined
      return {
        row,
        id: row.id,
        title: asText(row.propertiesByKey.title),
        detail: asText(row.propertiesByKey.detail),
        status,
        position: asNumber(row.propertiesByKey.position),
        date: asDateStart(row.propertiesByKey.date),
        phase: phaseForStatus(status, statusSchema),
      }
    })
    .sort((a, b) => {
      const left = a.position ?? Number.POSITIVE_INFINITY
      const right = b.position ?? Number.POSITIVE_INFINITY
      if (left !== right) return left - right
      return a.id.localeCompare(b.id)
    })
}

/** The next position to hand a newly added step. */
export function nextPosition(steps: Step[]): number {
  const positions = steps
    .map((step) => step.position)
    .filter((position): position is number => position !== undefined)
  if (positions.length === 0) return 1
  return Math.max(...positions) + 1
}

/** Render a date property for display, falling back to the raw value. */
export function formatDate(value: string | undefined): string | undefined {
  if (!value) return undefined
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  const hasTime = value.includes("T")
  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(hasTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  })
}
