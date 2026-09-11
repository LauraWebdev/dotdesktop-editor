import { fileURLToPath } from 'node:url'

import GLib from 'gi:GLib-2.0'
import Gio from 'gi:Gio-2.0'
import Gdk from 'gi:Gdk-4.0'
import Gtk from 'gi:Gtk-4.0'
import Adw from 'gi:Adw-1'

import { styles } from 'node-gtk/styles'

import { AppRegistry } from './app-registry.js'
import { openEntryDialog } from './entry-dialog.js'
import { createSourceTabs } from './source-tabs.js'
import { createSearchControl } from './search-bar.js'
import { refreshDesktopDatabase } from './desktop-cache.js'

const APP_ID = 'media.laura.dotdesktopeditor'
const APP_NAME = 'DotDesktop Editor'

const loop = GLib.MainLoop.new(null, false)
const app = new Adw.Application({ applicationId: APP_ID, flags: Gio.ApplicationFlags.FLAGS_NONE })

app.on('activate', () => {
  styles.addFile(new URL('../style.css', import.meta.url))

  const display = Gdk.Display.getDefault()
  if (display) {
    const iconsDir = fileURLToPath(new URL('../icons', import.meta.url))
    Gtk.IconTheme.getForDisplay(display).addSearchPath(iconsDir)
  }

  const window = new Adw.ApplicationWindow({ application: app })
  window.setTitle(APP_NAME)
  window.setDefaultSize(720, 560)

  const registry = new AppRegistry()
  registry.load()

  const toasts = new Adw.ToastOverlay({ vexpand: true })

  const sourceTabs = createSourceTabs(entry => openEntryDialog(window, entry, onSaved))
  toasts.setChild(sourceTabs.stack)

  let searchText = ''

  function applyFilters(): void {
    sourceTabs.refresh(registry.getApplications(), searchText)
  }

  let lastWrittenDir: string | null = null

  const cacheBanner = new Adw.Banner({
    title: 'Other apps may not see this change until the desktop entry cache is refreshed.',
    buttonLabel: 'Refresh Cache',
  })
  cacheBanner.on('button-clicked', () => {
    if (!lastWrittenDir) return
    refreshDesktopDatabase(lastWrittenDir)
      .then(() => {
        cacheBanner.setRevealed(false)
        toasts.addToast(new Adw.Toast({ title: 'Desktop entry cache refreshed' }))
      })
      .catch((error: unknown) => {
        toasts.addToast(new Adw.Toast({
          title: error instanceof Error ? error.message : 'Failed to refresh the cache',
        }))
      })
  })

  function onSaved(name: string, dir: string): void {
    registry.load()
    applyFilters()
    lastWrittenDir = dir
    cacheBanner.setRevealed(true)
    toasts.addToast(new Adw.Toast({ title: `Saved “${name}”` }))
  }

  applyFilters()

  const header = new Adw.HeaderBar()

  const addButton = new Gtk.Button({ iconName: 'list-add-symbolic', tooltipText: 'Add' })
  addButton.on('clicked', () => openEntryDialog(window, null, onSaved))
  header.packStart(addButton)

  const menu = new Gio.Menu()
  menu.append(`About ${APP_NAME}`, 'app.about')
  menu.append('Quit', 'app.quit')

  const menuButton = new Gtk.MenuButton({
    iconName: 'open-menu-symbolic',
    tooltipText: 'Main Menu',
    menuModel: menu,
    primary: true,
  })
  header.packEnd(menuButton)

  const search = createSearchControl(window, text => {
    searchText = text
    applyFilters()
  })
  header.packEnd(search.toggleButton)

  const toolbarView = new Adw.ToolbarView()
  toolbarView.addTopBar(header)
  toolbarView.addTopBar(search.bar)
  toolbarView.addTopBar(cacheBanner)
  toolbarView.setContent(toasts)
  toolbarView.addBottomBar(sourceTabs.switcherBar)
  window.setContent(toolbarView)

  const showAbout = () => {
    const about = new Adw.AboutDialog({
      applicationName: APP_NAME,
      applicationIcon: APP_ID,
      version: '1.0.0',
      comments: 'Edit .desktop application launcher entries',
      developers: ['Laura Sofia Heimann https://laura.media'],
      copyright: '© 2026 Laura Sofia Heimann',
      licenseType: Gtk.License.MIT_X11,
    })
    about.present(window)
  }

  const aboutAction = Gio.SimpleAction.new('about', null)
  aboutAction.on('activate', () => showAbout())
  app.addAction(aboutAction)

  const quitAction = Gio.SimpleAction.new('quit', null)
  quitAction.on('activate', () => { loop.quit(); app.quit() })
  app.addAction(quitAction)
  app.setAccelsForAction('app.quit', ['<Control>q'])

  window.on('close-request', () => (loop.quit(), app.quit(), false))

  styles.install()
  window.present()

  loop.run()
})

app.run([])
