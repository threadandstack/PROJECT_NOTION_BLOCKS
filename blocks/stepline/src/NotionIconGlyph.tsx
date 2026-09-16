import {
  NOTION_ICON_HEX,
  NOTION_ICON_VIEWBOX,
  notionIcon,
  type NotionIconColour,
} from "./notionIcons"

/**
 * Draws a bundled Notion icon inline.
 *
 * Inline SVG rather than an `<img>` because the sandbox blocks requests to
 * Notion's icon host; the markup ships with the block, so this needs no network.
 * The fill is applied here, which is why one bundled copy covers every colour.
 */
export function NotionIconGlyph({
  name,
  colour,
  className,
}: {
  name: string
  colour: NotionIconColour
  className?: string
}) {
  const icon = notionIcon(name)
  if (!icon) return null

  return (
    <svg
      className={className}
      viewBox={NOTION_ICON_VIEWBOX}
      fill={NOTION_ICON_HEX[colour]}
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: icon.svg }}
    />
  )
}
