import { existsSync } from 'node:fs'

const FLATPAK_INFO_PATH = '/.flatpak-info'

export function isRunningInFlatpak(): boolean {
  return existsSync(FLATPAK_INFO_PATH)
}
