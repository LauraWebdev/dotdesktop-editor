import Gtk from 'gi:Gtk-4.0'

import { resolveIcon } from './icon-resolver.js'

const PICKER_ICON_PIXEL_SIZE = 96

/**
 * @param parentWindow used to parent the native file-picker dialog
 * @param initialIcon   the entry's current `Icon=` value, if any
 * @param onChange      called with the newly picked file's absolute path
 */
export function createIconPicker(
  parentWindow: InstanceType<typeof Gtk.Window>,
  initialIcon: string | undefined,
  onChange: (path: string) => void,
) {
  const image = resolveIcon(initialIcon)
  image.setPixelSize(PICKER_ICON_PIXEL_SIZE)

  const editButton = new Gtk.Button({
    iconName: 'document-edit-symbolic',
    tooltipText: 'Change Icon…',
    cssClasses: ['circular', 'osd'],
    halign: Gtk.Align.END,
    valign: Gtk.Align.END,
  })

  editButton.on('clicked', () => {
    const dialog = new Gtk.FileDialog({ title: 'Select Icon', modal: true })

    const imageFilter = new Gtk.FileFilter({
      name: 'Images',
      mimeTypes: ['image/png', 'image/svg+xml', 'image/jpeg', 'image/x-xpixmap'],
    })
    dialog.setDefaultFilter(imageFilter)

    dialog.open(parentWindow, null, (_source, result) => {
      let file
      try {
        file = dialog.openFinish(result)
      } catch {
        return
      }

      const path = file?.getPath()
      if (!path) return

      image.setFromFile(path)
      image.setPixelSize(PICKER_ICON_PIXEL_SIZE)
      onChange(path)
    })
  })

  const overlay = new Gtk.Overlay({ child: image, halign: Gtk.Align.CENTER })
  overlay.addOverlay(editButton)
  return overlay
}
