import type { AppSource } from './app-directories.js'
import type { DesktopEntry } from './desktop-entry.js'

export type SourceFilter = AppSource | 'all'

function matchesSearch(entry: DesktopEntry, query: string): boolean {
  return (
    entry.name.toLowerCase().includes(query) ||
    entry.id.toLowerCase().includes(query) ||
    (entry.exec?.toLowerCase().includes(query) ?? false) ||
    (entry.comment?.toLowerCase().includes(query) ?? false)
  )
}

/** Filters `entries` by source tab and, if non-empty, by search text (name/id/exec/comment). */
export function filterEntries(
  entries: readonly DesktopEntry[],
  source: SourceFilter,
  searchText: string,
): DesktopEntry[] {
  const query = searchText.trim().toLowerCase()

  return entries.filter(entry => {
    if (source !== 'all' && entry.source !== source) return false
    return !query || matchesSearch(entry, query)
  })
}
