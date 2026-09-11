import Gtk from 'gi:Gtk-4.0'
import Adw from 'gi:Adw-1'

export function createSearchControl(
  window: InstanceType<typeof Gtk.Window>,
  onChange: (text: string) => void,
) {
  const entry = new Gtk.SearchEntry({ placeholderText: 'Search Applications…' })
  entry.on('notify::text', () => onChange(entry.text))

  const bar = new Gtk.SearchBar({ child: new Adw.Clamp({ child: entry, maximumSize: 400 }) })
  bar.connectEntry(entry)
  bar.setKeyCaptureWidget(window)

  const toggleButton = new Gtk.ToggleButton({ iconName: 'edit-find-symbolic', tooltipText: 'Search' })
  toggleButton.on('toggled', () => bar.setSearchMode(toggleButton.active))
  bar.on('notify::search-mode-enabled', () => { toggleButton.active = bar.getSearchMode() })

  return { toggleButton, bar }
}
