import { pages, type NotionPageIcon, type NotionPageId } from "@notionhq/custom-blocks"
import { useCallback, useEffect, useRef, useState } from "react"

/** `null` means "fetched, and this step has no icon" — distinct from "not fetched yet". */
type IconMap = Record<string, NotionPageIcon | null>

/**
 * Supplies each step's Notion page icon.
 *
 * Icons have to be fetched separately: a data-source snapshot carries a row's
 * properties but not its page icon, so there is no icon to read from the live
 * subscription. Each row is fetched once with `pages.get` and cached here, and
 * `setIcon` updates the cache when we write one ourselves rather than waiting
 * for a refetch.
 *
 * The trade-off is that an icon changed elsewhere — in the database view, say —
 * is not picked up until the block reloads.
 */
export function useStepIcons(ids: string[]) {
  const [icons, setIcons] = useState<IconMap>({})
  // Tracks ids already requested so a re-render mid-flight doesn't refetch them.
  const requested = useRef<Set<string>>(new Set())

  const key = ids.join(",")

  useEffect(() => {
    const pending = ids.filter((id) => !requested.current.has(id))
    if (pending.length === 0) return

    for (const id of pending) requested.current.add(id)

    let cancelled = false

    void Promise.all(
      pending.map(async (id) => {
        try {
          const result = await pages.get(id as NotionPageId)
          if (result.status !== "success") return [id, null] as const
          return [id, result.page.icon ?? null] as const
        } catch {
          // A step whose icon can't be read simply renders without one.
          return [id, null] as const
        }
      })
    ).then((entries) => {
      if (cancelled) return
      setIcons((current) => {
        const next = { ...current }
        for (const [id, icon] of entries) next[id] = icon
        return next
      })
    })

    return () => {
      cancelled = true
    }
    // `key` stands in for the id list so the effect only reruns when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const setIcon = useCallback((id: string, icon: NotionPageIcon | null) => {
    requested.current.add(id)
    setIcons((current) => ({ ...current, [id]: icon }))
  }, [])

  return { icons, setIcon }
}
