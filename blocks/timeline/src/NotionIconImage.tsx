import { useState } from "react"

/**
 * A Notion flat icon, with a graceful failure.
 *
 * These load from Notion's icon host rather than the bundle, which is the only
 * way to offer them — but it means they depend on the sandbox permitting that
 * origin. If one fails to load, fall back to the icon's name so the picker
 * stays usable and readable instead of showing a grid of broken images.
 */
export function NotionIconImage({
  url,
  name,
  className,
}: {
  url: string
  name: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return <span className="icon-fallback">{name.replace(/-/g, " ")}</span>
  }

  return (
    <img
      className={className}
      src={url}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}
