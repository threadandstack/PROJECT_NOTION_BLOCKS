import type { Segment } from "./callout"

/**
 * Render formatted runs the way Notion does. Links are drawn as links but not
 * followed: custom blocks cannot navigate, so the address is offered as a
 * tooltip instead.
 */
export function RichText({ segments }: { segments: Segment[] }) {
  return (
    <>
      {segments.map((segment, index) => {
        const classes = [
          segment.bold && "rt-bold",
          segment.italic && "rt-italic",
          segment.underline && "rt-underline",
          segment.strikethrough && "rt-strike",
          segment.href && "rt-link",
          segment.colour !== "default" && `c-${segment.colour}`,
        ]
          .filter(Boolean)
          .join(" ")

        const content = segment.code ? <code className="rt-code">{segment.text}</code> : segment.text

        return (
          <span key={index} className={classes || undefined} title={segment.href}>
            {content}
          </span>
        )
      })}
    </>
  )
}
