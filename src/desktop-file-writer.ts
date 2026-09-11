import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export interface EntryFormValues {
  name: string
  comment?: string
  exec?: string
  icon?: string
  terminal: boolean
  categories: string[]
  visible: boolean
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'app'
}

export function serializeDesktopEntry(values: EntryFormValues): string {
  const lines = ['[Desktop Entry]', 'Type=Application', 'Version=1.0', `Name=${values.name}`]

  if (values.comment) lines.push(`Comment=${values.comment}`)
  if (values.exec) lines.push(`Exec=${values.exec}`)
  if (values.icon) lines.push(`Icon=${values.icon}`)
  if (values.terminal) lines.push('Terminal=true')
  if (values.categories.length > 0) lines.push(`Categories=${values.categories.join(';')};`)
  if (!values.visible) lines.push('NoDisplay=true')

  return lines.join('\n') + '\n'
}

export function desktopFileExists(path: string): boolean {
  return existsSync(path)
}

export function writeDesktopFile(path: string, contents: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, contents, 'utf-8')
}
