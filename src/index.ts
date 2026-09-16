import { Worker } from "@notionhq/workers"

const worker = new Worker()
export default worker

// ─── Vertical timeline ──────────────────────────────────────────────────────
//
// A numbered, connected timeline rendered inline in a Notion page. Each step is
// a row in a bound data source, so the content lives in Notion and stays
// editable from the database as well as from the block itself.
//
// Steps are ordered by `position` (a number) so the sequence is explicit rather
// than dependent on the view's own sort. `status` drives the bullet's
// appearance — the block reads the bound property's status groups (To do /
// In progress / Complete) rather than hard-coding option names, so it adapts to
// whatever status scheme the workspace already uses.
worker.customBlock("timeline", {
  name: "Timeline",
  description:
    "A vertical, numbered timeline. Each step expands to reveal its detail, and carries a status.",
  icon: { type: "emoji", emoji: "🧭" },
  slashCommand: "timeline",
  path: "./blocks/timeline",
  command: "npx vite build",
  output: "dist",
  version: 1,
  dataSources: {
    steps: {
      name: "Steps",
      description: "One row per step on the timeline, in order.",
      icon: { type: "emoji", emoji: "🧭" },
      properties: {
        title: {
          name: "Title",
          description: "The step's label, shown next to its numbered bullet.",
          type: "title",
        },
        detail: {
          name: "Detail",
          description: "The body revealed when the step is expanded.",
          type: "rich_text",
        },
        status: {
          name: "Status",
          description:
            "Drives the bullet's appearance — complete, in progress, or not started.",
          type: "status",
        },
        position: {
          name: "Position",
          description:
            "Sort order. Lower numbers appear first; the bullet numbering follows this.",
          type: "number",
        },
        date: {
          name: "Date",
          description: "Optional date shown beneath the step's title.",
          type: "date",
        },
      },
    },
  },
})
