import {
  pages,
  type NotionDataSourcePage,
  type NotionPageId,
  type NotionPagePropertyInputMap,
} from "@notionhq/custom-blocks"
import { useBlockId, useDataSource } from "@notionhq/custom-blocks/react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  carryHiddenStyles,
  fromMarkdown,
  fromNotionRichText,
  fromPlainText,
  plainText,
  toCallout,
  toMarkdown,
  toNotionRichText,
  type Segment,
} from "./callout"
import { Editor, type CalloutEdit } from "./Editor"
import { RichText } from "./RichText"
import { TiltSurface } from "./TiltSurface"

const DATA_SOURCE_KEY = "callouts"

/** A write result from either the per-row helper or the `pages` API. */
type WriteResult = { status: "success" } | { status: "error"; error: { message: string } }

/**
 * How long to wait for the host to answer a write before giving up on it. The
 * bridge never answers a message the host rejects as malformed, so without a
 * deadline one bad write would leave the form disabled for good.
 */
const WRITE_TIMEOUT_MS = 10_000

/**
 * One tilting callout.
 *
 * Custom blocks have no storage of their own, so each callout's words, icon and
 * colour live in a row of the bound Callouts database, found by this block's ID.
 * Every tilting callout in the workspace can share that one database. A block
 * with no row yet shows an empty callout, and its row is created the first time
 * someone saves it, so merely viewing a page never writes to Notion.
 */
export function App() {
  const blockId = useBlockId()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [writeError, setWriteError] = useState<string | null>(null)
  // Bumped after each save so a formatting-only change, which leaves the plain
  // text untouched, still re-reads the formatted text.
  const [revision, setRevision] = useState(0)
  // The icon and colour being chosen in the editor, shown on the callout before saving.
  const [preview, setPreview] = useState<Pick<CalloutEdit, "icon" | "colour"> | null>(null)

  // Two people saving a brand new callout at the same moment could each create
  // a row. Fetching a few and picking by ID means every viewer settles on the
  // same one. (Sorting by created time would be neater, but the built-in
  // timestamps can't be sorted everywhere the block runs.)
  const query = useDataSource(DATA_SOURCE_KEY, {
    filter: { key: "block", rich_text: { equals: blockId } },
    limit: 5,
  })
  const { items, propertyIdsByKey, isLoading, error } = query

  const callout = useMemo(() => toCallout(pickRow(items)), [items])
  const lastEdited = JSON.stringify(callout.row?.propertiesById.last_edited_time ?? null)
  const segments = useFormattedText(
    callout.row?.id,
    propertyIdsByKey.text,
    callout.text,
    `${lastEdited}:${revision}`
  )

  const write = useCallback(async (run: () => Promise<WriteResult>) => {
    setBusy(true)
    setWriteError(null)

    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<WriteResult>((resolve) => {
      timer = setTimeout(
        () =>
          resolve({
            status: "error",
            error: {
              message:
                "Notion didn't respond to that change. It may not have been saved, so reopen the editor to check.",
            },
          }),
        WRITE_TIMEOUT_MS
      )
    })

    try {
      const result = await Promise.race([run(), timeout])
      if (result.status === "error") setWriteError(result.error.message)
      return result.status === "success"
    } catch (cause) {
      setWriteError(cause instanceof Error ? cause.message : String(cause))
      return false
    } finally {
      clearTimeout(timer)
      setBusy(false)
    }
  }, [])

  async function save(edit: CalloutEdit) {
    const next = carryHiddenStyles(segments, fromMarkdown(edit.markdown))
    const properties: NotionPagePropertyInputMap = {}

    if (toMarkdown(next) !== toMarkdown(segments) || plainText(next) !== callout.text) {
      properties.text = { type: "title", title: toNotionRichText(next) }
    }
    if (!callout.row || edit.icon !== callout.icon) {
      properties.icon = {
        type: "rich_text",
        rich_text: edit.icon ? [{ type: "text", text: { content: edit.icon } }] : [],
      }
    }
    if (!callout.row || edit.colour !== callout.colour) {
      properties.colour = {
        type: "rich_text",
        rich_text: [{ type: "text", text: { content: edit.colour } }],
      }
    }

    const row = callout.row
    if (row && Object.keys(properties).length === 0) {
      setPreview(null)
      setEditing(false)
      return
    }

    const saved = await write(() =>
      row
        ? row.update({ properties })
        : pages.create({
            parent: { type: "data_source_key", key: DATA_SOURCE_KEY },
            properties: {
              ...properties,
              text: { type: "title", title: toNotionRichText(next) },
              block: {
                type: "rich_text",
                rich_text: [{ type: "text", text: { content: blockId } }],
              },
            },
          })
    )
    if (saved) {
      setPreview(null)
      setEditing(false)
      setRevision((current) => current + 1)
    }
  }

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

  const isEmpty = plainText(segments).trim() === ""
  const look = editing && preview ? preview : callout

  return (
    <main className={`callout-root ${editing ? "is-editing" : ""}`}>
      {!editing ? (
        <div className="callout-toolbar">
          <button type="button" className="ghost-button" onClick={() => setEditing(true)}>
            Edit callout
          </button>
        </div>
      ) : null}

      <TiltSurface enabled={!editing} className={`callout callout-${look.colour}`}>
        {look.icon ? (
          <span className="callout-icon" aria-hidden="true">
            {look.icon}
          </span>
        ) : null}
        <div className="callout-text">
          {isEmpty ? (
            <span className="callout-placeholder">
              {callout.row ? "Empty callout" : "Hover and choose “Edit callout” to write this callout."}
            </span>
          ) : (
            <RichText segments={segments} />
          )}
        </div>
      </TiltSurface>

      {writeError ? (
        <div className="notice notice-error" role="alert">
          {writeError}
        </div>
      ) : null}

      {editing ? (
        <Editor
          initial={{ markdown: toMarkdown(segments), icon: callout.icon, colour: callout.colour }}
          busy={busy}
          onSave={(edit) => void save(edit)}
          onPreview={setPreview}
          onCancel={() => {
            setWriteError(null)
            setPreview(null)
            setEditing(false)
          }}
        />
      ) : null}
    </main>
  )
}

function pickRow(rows: NotionDataSourcePage[]): NotionDataSourcePage | undefined {
  return [...rows].sort((a, b) => a.id.localeCompare(b.id))[0]
}

/**
 * The callout's text with its formatting.
 *
 * Data source queries return titles as plain text, so the formatted version is
 * read from the page itself whenever the text changes. Until it arrives, and if
 * it ever disagrees with the live plain text (a stale answer racing an edit),
 * the plain text is shown instead, so the block never shows words that are not
 * in the database. `version` changes whenever the row may have been restyled
 * without its words changing.
 */
function useFormattedText(
  pageId: string | undefined,
  propertyId: string | undefined,
  text: string,
  version: string
): Segment[] {
  const [formatted, setFormatted] = useState<Segment[] | null>(null)

  useEffect(() => {
    if (!pageId || !propertyId) {
      setFormatted(null)
      return
    }
    let cancelled = false
    // Row IDs are page IDs; the SDK just types them as plain strings.
    void pages.get(pageId as NotionPageId).then((result) => {
      if (cancelled || result.status !== "success") return
      const property = Object.values(result.page.properties).find(
        (candidate) => candidate.id === propertyId
      )
      if (property?.type === "title") setFormatted(fromNotionRichText(property.title))
      else if (property?.type === "rich_text") setFormatted(fromNotionRichText(property.rich_text))
    })
    return () => {
      cancelled = true
    }
  }, [pageId, propertyId, text, version])

  return formatted && plainText(formatted) === text ? formatted : fromPlainText(text)
}
