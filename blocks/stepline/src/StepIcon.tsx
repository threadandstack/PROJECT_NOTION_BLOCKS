import type { NotionPageIcon } from "@notionhq/custom-blocks"
import { NotionIconGlyph } from "./NotionIconGlyph"
import { parseNotionIconUrl } from "./notionIcons"

/**
 * Renders whichever icon variant a step carries.
 *
 * A Notion built-in icon is stored as an external URL, but the sandbox cannot
 * load it — so it is recognised and drawn from the bundle instead. Other remote
 * icons (a custom emoji, an image set elsewhere) are still attempted as an
 * `<img>`, and hidden rather than shown broken if the sandbox refuses them.
 */
export function StepIcon({ icon }: { icon: NotionPageIcon }) {
  if (icon.type === "emoji") {
    return (
      <span className="step-icon" aria-hidden="true">
        {icon.emoji}
      </span>
    )
  }

  const url =
    icon.type === "custom_emoji"
      ? icon.custom_emoji.url
      : icon.type === "external"
        ? icon.external.url
        : icon.type === "file"
          ? icon.file.url
          : undefined

  if (!url) return null

  const builtIn = parseNotionIconUrl(url)
  if (builtIn) {
    return (
      <NotionIconGlyph
        className="step-icon step-icon-image"
        name={builtIn.name}
        colour={builtIn.colour}
      />
    )
  }

  return (
    <img
      className="step-icon step-icon-image"
      src={url}
      alt=""
      onError={(event) => {
        event.currentTarget.style.display = "none"
      }}
    />
  )
}
