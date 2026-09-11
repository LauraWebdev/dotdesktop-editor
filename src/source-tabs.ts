import Adw from 'gi:Adw-1'

import type { DesktopEntry } from './desktop-entry.js'
import { filterEntries, type SourceFilter } from './app-filter.js'
import { createAppGrid } from './app-grid.js'

const TABS: { source: SourceFilter; title: string; icon: string }[] = [
  { source: 'all', title: 'All', icon: 'view-grid-symbolic' },
  { source: 'local', title: 'Local', icon: 'user-home-symbolic' },
  { source: 'global', title: 'Global', icon: 'computer-symbolic' },
  { source: 'flatpak', title: 'Flatpak', icon: 'package-x-generic-symbolic' },
  { source: 'snap', title: 'Snap', icon: 'package-x-generic-symbolic' },
]

export function createSourceTabs(onActivate: (entry: DesktopEntry) => void) {
  const stack = new Adw.ViewStack()

  const pages = TABS.map(tab => {
    const grid = createAppGrid([], onActivate)
    const page = stack.addTitledWithIcon(grid.widget, tab.source, tab.title, tab.icon)
    return { source: tab.source, grid, page }
  })

  const switcherBar = new Adw.ViewSwitcherBar({ stack, reveal: true })

  function refresh(entries: readonly DesktopEntry[], searchText: string): void {
    for (const { source, grid, page } of pages) {
      page.setVisible(filterEntries(entries, source, '').length > 0)
      grid.refresh(filterEntries(entries, source, searchText))
    }
  }

  return { stack, switcherBar, refresh }
}
