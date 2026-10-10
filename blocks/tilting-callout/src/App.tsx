import {
  pages,
  type NotionDataSourcePage,
  type NotionPageId,
  type NotionPagePropertyInputMap,
  type NotionPagePropertyWriteMap,
} from "@notionhq/custom-blocks"
import { useBlockId, useDataSource } from "@notionhq/custom-blocks/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  fromPlainText,
  sameSegments,
  toCallout,
  toNotionRichText,
  toStored,
  type CalloutColour,
  type Segment,
} from "./callout"
import { IconMenu } from "./IconMenu"
import { InlineText } from "./InlineText"
import { TiltSurface } from "./TiltSurface"
import { usePopoverSpace } from "./usePopoverSpace"

const DATA_SOURCE_KEY = "callouts"

/** A write result from either the per-row helper or the `pages` API. */
type WriteResult = { status: "success" } | { status: "error"; error: { message: string } }

/**
 * How long to wait for the host to answer a write before giving up on it. The
 * bridge never answers a message the host rejects as malformed, so without a
 * deadline one bad write would leave the block waiting for good.
 */
const WRITE_TIMEOUT_MS = 10_000

type Look = { segments: Segment[]; icon: string; colour: CalloutColour }

/**
 * One tilting callout.
 *
 * Custom blocks have no storage of their own, so each callout's words, icon and
 * colour live in a row of the bound Callouts database, found by this block's ID.
 * A block with no row yet shows an empty callout, and its row is created the
 * first time someone edits it, so merely viewing a page never writes to Notion.
 *
 * It works like a Notion callout: click the text to type, select text to format
 * it, click the icon to change the icon or colour. Hovering only ever tilts it.
 */
export function App() {
  const blockId = useBlockId()
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const [editingText, setEditingText] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuNode, setMenuNode] = useState<HTMLDivElement | null>(null)
  const [writeError, setWriteError] = useState<string | null>(null)
  // Changes shown straight away, before Notion confirms them, so the callout
  // never flicks back to its old look while a save is in flight.
  const [pending, setPending] = useState<Partial<Look>>({})

  usePopoverSpace(container, menuOpen ? menuNode : null)

  // Two people saving a brand new callout at the same moment could each create
  // a row. Fetching a few and picking by ID means every viewer settles on the
  // same one.
  const query = useDataSource(DATA_SOURCE_KEY, {
    filter: { key: "block", rich_text: { equals: blockId } },
    limit: 5,
  })
  const { items, propertyIdsByKey, isLoading, error } = query
  const callout = useMemo(() => toCallout(pickRow(items)), [items])
  const look: Look = {
    segments: pending.segments ?? callout.segments,
    icon: pending.icon ?? callout.icon,
    colour: pending.colour ?? callout.colour,
  }

  // Drop each pending change once Notion reports it back.
  useEffect(() => {
    setPending((current) => {
      const next = { ...current }
      if (next.segments && sameSegments(next.segments, callout.segments)) delete next.segments
      if (next.icon !== undefined && next.icon === callout.icon) delete next.icon
      if (next.colour !== undefined && next.colour === callout.colour) delete next.colour
      return Object.keys(next).length === Object.keys(current).length ? current : next
    })
  }, [callout])

  // Writes run one at a time. The first creates the row; later ones, even if
  // they start before the new row appears in the query, update that same row.
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const createdId = useRef<string | null>(null)
  const latest = useRef({ callout, look, propertyIdsByKey })
  latest.current = { callout, look, propertyIdsByKey }

  const save = useCallback(
    (change: Partial<Look>) => {
      setPending((current) => ({ ...current, ...change }))
      setWriteError(null)

      queue.current = queue.current.then(async () => {
        const { callout: saved, look: shown, propertyIdsByKey: ids } = latest.current
        const row = saved.row
        const rowId = row?.id ?? createdId.current
        const all = { ...shown, ...change }
        const properties = toProperties(rowId ? change : all, ids.formatted !== undefined)

        const result = await withTimeout(async (): Promise<WriteResult> => {
          if (row) return row.update({ properties })
          if (rowId) {
            return pages.update({ pageId: rowId as NotionPageId, properties: byPropertyId(properties, ids) })
          }
          const created = await pages.create({
            parent: { type: "data_source_key", key: DATA_SOURCE_KEY },
            properties: {
              ...properties,
              block: { type: "rich_text", rich_text: [{ type: "text", text: { content: blockId } }] },
            },
          })
          if (created.status === "success") createdId.current = created.page.id
          return created
        })
        if (result.status === "error") setWriteError(result.error.message)
      })
    },
    [blockId]
  )

  if (error) {
    return (
      <div className="notice notice-error" role="alert">
        Couldn't load the callout: {error.message}
      </div>
    )
  }

  if (isLoading && items.length === 0) {
    return (
      <div className="notice" aria-busy="true">
        Loading callout…
      </div>
    )
  }

  // With no icon there is nothing to click, so while the text is being edited
  // the icon's place offers "Add icon", as Notion does for pages.
  const showIcon = Boolean(look.icon) || editingText || menuOpen

  return (
    <main ref={setContainer} className="callout-root">
      <TiltSurface enabled={!editingText && !menuOpen} className={`callout callout-${look.colour}`}>
        {showIcon ? (
          <button
            type="button"
            className={`callout-icon ${look.icon ? "" : "is-placeholder"}`}
            aria-label={look.icon ? "Change icon or colour" : "Add icon"}
            aria-expanded={menuOpen}
            title={look.icon ? "Change icon or colour" : "Add icon"}
            // Keep the text focused until the menu takes over, so the button
            // does not vanish under the pointer mid-click.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {look.icon || <AddIconGlyph />}
          </button>
        ) : null}
        <div className="callout-text">
          <InlineText
            segments={look.segments}
            placeholder="Type something…"
            container={container}
            onEditingChange={setEditingText}
            onCommit={(segments) => save({ segments })}
          />
        </div>
      </TiltSurface>

      {menuOpen ? (
        <IconMenu
          icon={look.icon}
          colour={look.colour}
          menuRef={setMenuNode}
          onIcon={(icon) => save({ icon })}
          onColour={(colour) => save({ colour })}
          onClose={() => setMenuOpen(false)}
        />
      ) : null}

      {writeError ? (
        <div className="notice notice-error" role="alert">
          Couldn't save that change: {writeError}
        </div>
      ) : null}
    </main>
  )
}

function pickRow(rows: NotionDataSourcePage[]): NotionDataSourcePage | undefined {
  return [...rows].sort((a, b) => a.id.localeCompare(b.id))[0]
}

function plainRichText(content: string) {
  return toNotionRichText(fromPlainText(content))
}

/**
 * The fields to write for a change. Text gets the formatted runs too (Notion
 * may one day keep them) and Formatted text gets them as JSON, which the bridge
 * does keep. A callout bound before Formatted text existed saves its words only.
 */
function toProperties(change: Partial<Look>, canFormat: boolean): NotionPagePropertyInputMap {
  const properties: NotionPagePropertyInputMap = {}
  if (change.segments) {
    properties.text = { type: "title", title: toNotionRichText(change.segments) }
    if (canFormat) properties.formatted = { type: "rich_text", rich_text: plainRichText(toStored(change.segments)) }
  }
  if (change.icon !== undefined) properties.icon = { type: "rich_text", rich_text: plainRichText(change.icon) }
  if (change.colour !== undefined) properties.colour = { type: "rich_text", rich_text: plainRichText(change.colour) }
  return properties
}

/** `pages.update` takes raw property IDs, each repeated in its value. */
function byPropertyId(
  properties: NotionPagePropertyInputMap,
  ids: Record<string, string | undefined>
): NotionPagePropertyWriteMap {
  const written: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(properties)) {
    const id = ids[key]
    if (id) written[id] = { ...value, id }
  }
  return written as NotionPagePropertyWriteMap
}

async function withTimeout(run: () => Promise<WriteResult>): Promise<WriteResult> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<WriteResult>((resolve) => {
    timer = setTimeout(
      () =>
        resolve({
          status: "error",
          error: { message: "Notion didn't respond. Edit the callout again to retry." },
        }),
      WRITE_TIMEOUT_MS
    )
  })
  try {
    return await Promise.race([run(), timeout])
  } catch (cause) {
    return { status: "error", error: { message: cause instanceof Error ? cause.message : String(cause) } }
  } finally {
    clearTimeout(timer)
  }
}

/** Notion's "Add icon" smiley, drawn faintly where the icon would be. */
function AddIconGlyph() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7.5" cy="8.5" r="1" fill="currentColor" />
      <circle cx="12.5" cy="8.5" r="1" fill="currentColor" />
      <path d="M7 12c.8 1 1.8 1.5 3 1.5s2.2-.5 3-1.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
