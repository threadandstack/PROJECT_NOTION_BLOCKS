import type { NotionPageIcon } from "@notionhq/custom-blocks"

/**
 * Renders whichever icon variant a step carries. Emoji are text; custom emoji
 * and external icons are Notion-hosted images, which the sandbox does allow.
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

  // A step icon that cannot load is dropped rather than shown broken — the
  // title still identifies the step perfectly well without it.
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
