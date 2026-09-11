import { accessSync, constants, existsSync, statSync } from 'node:fs'
import { homedir } from 'node:os'

import { isRunningInFlatpak } from './sandbox.js'

export type AppSource = 'local' | 'global' | 'flatpak' | 'snap'

function dataHome(): string {
  return process.env.XDG_DATA_HOME || `${homedir()}/.local/share`
}

function dataDirs(): string[] {
  const raw = process.env.XDG_DATA_DIRS || '/usr/local/share:/usr/share'
  return raw.split(':').filter(Boolean)
}

/** Defines a source by origin */
function classifySource(dir: string): AppSource {
  if (dir.includes('/flatpak/exports/share/applications')) return 'flatpak'
  if (dir.includes('/snapd/desktop/applications')) return 'snap'
  if (dir === `${dataHome()}/applications`) return 'local'
  return 'global'
}

export function getApplicationDirectories(): { path: string; source: AppSource }[] {
  const home = homedir()

  // Common paths for .desktop files
  const candidates = [
    `${dataHome()}/applications`,
    ...dataDirs().map(dir => `${dir}/applications`),
    `${home}/.local/share/flatpak/exports/share/applications`,
    '/var/lib/flatpak/exports/share/applications',
    '/var/lib/snapd/desktop/applications',
  ]

  // If run as Flatpak, add host /usr paths
  if (isRunningInFlatpak()) {
    candidates.push('/run/host/usr/share/applications', '/run/host/usr/local/share/applications')
  }

  const seen = new Set<string>()
  const dirs: { path: string; source: AppSource }[] = []

  for (const dir of candidates) {
    if (seen.has(dir)) continue
    seen.add(dir)

    if (existsSync(dir) && statSync(dir).isDirectory()) dirs.push({ path: dir, source: classifySource(dir) })
  }

  return dirs
}

export function isDirectoryWritable(dir: string): boolean {
  try {
    accessSync(dir, constants.W_OK)
    return true
  } catch {
    return false
  }
}

export function getWritableApplicationDirectories(): string[] {
  const defaultDir = `${dataHome()}/applications`
  const dirs = [defaultDir]

  for (const { path } of getApplicationDirectories()) {
    if (path !== defaultDir && isDirectoryWritable(path)) dirs.push(path)
  }

  return dirs
}
