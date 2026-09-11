/*
 * Rebuilds the freedesktop `mimeinfo.cache` (https://www.freedesktop.org/wiki/Software/desktop-file-utils/)
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { isRunningInFlatpak } from './sandbox.js'

const execFileAsync = promisify(execFile)

/**
 * Refreshes the cache by running update-desktop-database
 * 
 * @param dir Directory to refresh
 */
export async function refreshDesktopDatabase(dir: string): Promise<void> {
  const command = isRunningInFlatpak() ? 'flatpak-spawn' : 'update-desktop-database'
  const args = isRunningInFlatpak() ? ['--host', 'update-desktop-database', dir] : [dir]

  try {
    await execFileAsync(command, args)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      throw new Error('update-desktop-database isn’t installed (part of desktop-file-utils).')
    }
    throw error
  }
}
