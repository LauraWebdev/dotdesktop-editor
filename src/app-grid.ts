import Gtk from 'gi:Gtk-4.0'
import Pango from 'gi:Pango-1.0'

import type { DesktopEntry } from './desktop-entry.js'
import { resolveIcon } from './icon-resolver.js'

const TILE_LABEL_WIDTH_CHARS = 12

function createTile(entry: DesktopEntry) {
  const tile = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 6,
    marginTop: 8,
    marginBottom: 8,
    marginStart: 8,
    marginEnd: 8,
    halign: Gtk.Align.CENTER,
  })
  if (entry.comment) tile.setTooltipText(entry.comment)

  tile.append(resolveIcon(entry.icon))

  tile.append(new Gtk.Label({
    label: entry.name,
    justify: Gtk.Justification.CENTER,
    wrap: true,
    maxWidthChars: TILE_LABEL_WIDTH_CHARS,
    lines: 2,
    ellipsize: Pango.EllipsizeMode.END,
    halign: Gtk.Align.CENTER,
  }))

  return tile
}

export function createAppGrid(entries: readonly DesktopEntry[], onActivate: (entry: DesktopEntry) => void) {
  const flowBox = new Gtk.FlowBox({
    selectionMode: Gtk.SelectionMode.NONE,
    activateOnSingleClick: true,
    homogeneous: true,
    rowSpacing: 12,
    columnSpacing: 12,
    marginTop: 18,
    marginBottom: 18,
    marginStart: 18,
    marginEnd: 18,
    valign: Gtk.Align.START,
    maxChildrenPerLine: 8,
  })

  let entryByChild = new Map<InstanceType<typeof Gtk.FlowBoxChild>, DesktopEntry>()
  flowBox.on('child-activated', child => {
    const entry = entryByChild.get(child)
    if (entry) onActivate(entry)
  })

  function populate(entries: readonly DesktopEntry[]) {
    flowBox.removeAll()
    entryByChild = new Map()

    for (const entry of entries) {
      flowBox.append(createTile(entry))
    }

    for (let i = 0; ; i++) {
      const child = flowBox.getChildAtIndex(i)
      if (!child) break
      entryByChild.set(child, entries[i])
    }
  }

  populate(entries)

  const scrolled = new Gtk.ScrolledWindow({ vexpand: true, child: flowBox })
  return { widget: scrolled, refresh: populate }
}
