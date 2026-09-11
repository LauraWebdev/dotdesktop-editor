
import type { AppSource } from './app-directories.js'

/**
 * Documentation: https://specifications.freedesktop.org/desktop-entry-spec/latest/
 */
export interface DesktopEntry {
  id: string
  name: string
  comment?: string
  icon?: string
  exec?: string
  tryExec?: string
  terminal: boolean
  categories: string[]
  noDisplay: boolean
  hidden: boolean
  onlyShowIn: string[]
  notShowIn: string[]
  type: string
  filePath: string
  source: AppSource
}

/**
 * Helper to split categories joined via ";"
 * 
 * @param value Value to split
 * @returns Split values
 */
function splitList(value: string | undefined): string[] {
  return value ? value.split(';').map(s => s.trim()).filter(Boolean) : []
}

export function parseDesktopFile(
  filePath: string,
  id: string,
  contents: string,
  locales: string[],
  source: AppSource,
): DesktopEntry | null {
  let inEntryGroup = false
  const values = new Map<string, string>()

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim()
    // Comments
    if (!line || line.startsWith('#')) continue

    // Header
    if (line.startsWith('[')) {
      inEntryGroup = line === '[Desktop Entry]'
      continue
    }
    if (!inEntryGroup) continue

    const eq = line.indexOf('=')
    if (eq === -1) continue
    values.set(line.slice(0, eq).trim(), line.slice(eq + 1).trim())
  }

  const type = values.get('Type')
  if (!type) return null

  const localized = (key: string): string | undefined => {
    for (const locale of locales) {
      const value = values.get(`${key}[${locale}]`)
      if (value !== undefined) return value
    }
    return values.get(key)
  }

  const name = localized('Name')
  if (!name) return null

  return {
    id,
    name,
    comment: localized('Comment'),
    icon: values.get('Icon'),
    exec: values.get('Exec'),
    tryExec: values.get('TryExec'),
    terminal: values.get('Terminal') === 'true',
    categories: splitList(values.get('Categories')),
    noDisplay: values.get('NoDisplay') === 'true',
    hidden: values.get('Hidden') === 'true',
    onlyShowIn: splitList(values.get('OnlyShowIn')),
    notShowIn: splitList(values.get('NotShowIn')),
    type,
    filePath,
    source,
  }
}
