import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { getApplicationDirectories } from './app-directories.js'
import { parseDesktopFile, type DesktopEntry } from './desktop-entry.js'
import { getPreferredLocales } from './locale.js'

/** Recursively lists every `*.desktop` file under `dir`. */
function findDesktopFiles(dir: string): string[] {
  const results: string[] = []

  let dirents
  try {
    dirents = readdirSync(dir, { withFileTypes: true })
  } catch {
    return results
  }

  for (const dirent of dirents) {
    const fullPath = join(dir, dirent.name)

    let stat
    try {
      stat = statSync(fullPath)
    } catch {
      continue
    }

    if (stat.isDirectory()) {
      results.push(...findDesktopFiles(fullPath))
    } else if (stat.isFile() && dirent.name.endsWith('.desktop')) {
      results.push(fullPath)
    }
  }

  return results
}

function desktopFileId(baseDir: string, filePath: string): string {
  return relative(baseDir, filePath).split(sep).join('-')
}

function isExecutableAvailable(command: string): boolean {
  if (command.startsWith('/')) {
    try {
      readFileSync(command)
      return true
    } catch {
      return true
    }
  }

  const path = process.env.PATH || ''
  return path.split(':').some(dir => {
    try {
      readFileSync(join(dir, command))
      return true
    } catch {
      return false
    }
  })
}

function isDisplayable(entry: DesktopEntry): boolean {
  if (entry.type !== 'Application') return false
  if (entry.noDisplay || entry.hidden) return false
  if (entry.onlyShowIn.length > 0 && !entry.onlyShowIn.includes('GNOME')) return false
  if (entry.notShowIn.includes('GNOME')) return false
  if (entry.tryExec && !isExecutableAvailable(entry.tryExec)) return false
  return true
}

export class AppRegistry {
  #applications: DesktopEntry[] = []

  load(): void {
    const locales = getPreferredLocales()
    const seenIds = new Set<string>()
    const found: DesktopEntry[] = []

    for (const { path: dir, source } of getApplicationDirectories()) {
      for (const filePath of findDesktopFiles(dir)) {
        const id = desktopFileId(dir, filePath)
        if (seenIds.has(id)) continue

        let contents: string
        try {
          contents = readFileSync(filePath, 'utf-8')
        } catch {
          continue
        }

        const entry = parseDesktopFile(filePath, id, contents, locales, source)
        if (!entry) continue

        seenIds.add(id)
        if (isDisplayable(entry)) found.push(entry)
      }
    }

    found.sort((a, b) => a.name.localeCompare(b.name))
    this.#applications = found
  }

  getApplications(): readonly DesktopEntry[] {
    return this.#applications
  }
}
