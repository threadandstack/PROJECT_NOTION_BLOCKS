import { Worker } from "@notionhq/workers"

const worker = new Worker()
export default worker

// ─── Steplist ───────────────────────────────────────────────────────────────
//
// A numbered, connected steplist rendered inline in a Notion page. Each step is
// a row in a bound data source, so the content lives in Notion and stays
// editable from the database as well as from the block itself.
//
// Steps are ordered by `position` (a number) so the sequence is explicit rather
// than dependent on the view's own sort. `status` drives the bullet's
// appearance — the block reads the bound property's status groups (To do /
// In progress / Complete) rather than hard-coding option names, so it adapts to
// whatever status scheme the workspace already uses.
//
// The declaration key stays "timeline" on purpose. It is the stable identity
// every placed block instance is bound to, and renaming it would orphan the
// ones already on pages; only the display name and slash command are the
// block's public name.
worker.customBlock("timeline", {
  name: "Steplist",
  description:
    "A numbered list of steps under a heading. Each step expands to reveal its detail, and carries a status you can change in place.",
  icon: { type: "emoji", emoji: "🧭" },
  slashCommand: "steplist",
  path: "./blocks/stepline",
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
        // The steplist's heading lives in the same database as its steps: a row
        // whose Row type is "Title" is shown as the H3 and left out of the steps.
        kind: {
          name: "Row type",
          description:
            "Leave empty for a step. Set by the block to \"Title\" on the row that holds the steplist's heading (its Detail keeps the heading's formatting).",
          type: "select",
        },
      },
    },
  },
})

// ─── Tilting callout ────────────────────────────────────────────────────────
//
// A Notion callout (icon, text, colour) that leans towards the pointer on hover.
//
// Custom blocks have no per-instance storage, so each callout is a row in a
// shared Callouts database, found by the block's own ID in the `block`
// property. One database can hold every tilting callout in the workspace. The
// row is created on first save, so an untouched block never writes to Notion.
worker.customBlock("tiltingCallout", {
  name: "Tilting callout",
  description:
    "A callout that tilts to follow the cursor on hover. Icon, colour and formatted text work as in a Notion callout.",
  icon: { type: "emoji", emoji: "💡" },
  slashCommand: "tilting-callout",
  path: "./blocks/tilting-callout",
  command: "npx vite build",
  output: "dist",
  version: 1,
  dataSources: {
    callouts: {
      name: "Callouts",
      description:
        "One row per tilting callout. Rows are created by the block; each is matched to its block by Block ID.",
      icon: { type: "emoji", emoji: "💡" },
      properties: {
        text: {
          name: "Text",
          description: "The callout's words, as plain text.",
          type: "title",
        },
        // Notion's custom block bridge drops title formatting in both
        // directions, so the formatted text travels here as JSON instead.
        formatted: {
          name: "Formatted text",
          description:
            "Set by the block: the callout's text with its formatting (bold, links, colour). Safe to hide; don't edit.",
          type: "rich_text",
        },
        icon: {
          name: "Icon",
          description: "A single emoji shown beside the text. Leave empty for no icon.",
          type: "rich_text",
        },
        colour: {
          name: "Colour",
          description:
            "A Notion colour, such as gray_background, blue_background or red. Plain hues colour the text; _background hues fill the callout.",
          type: "rich_text",
        },
        block: {
          name: "Block ID",
          description: "Set by the block to link the row to the callout it belongs to. Don't edit.",
          type: "rich_text",
        },
      },
    },
  },
})
