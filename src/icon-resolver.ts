import Gtk from 'gi:Gtk-4.0'

const ICON_PIXEL_SIZE = 64

const FALLBACK_ICON_NAME = 'application-x-executable'

export function resolveIcon(iconValue: string | undefined) {
  const icon = iconValue?.trim()

  const image = icon?.startsWith('/')
    ? Gtk.Image.newFromFile(icon)
    : Gtk.Image.newFromIconName(icon || FALLBACK_ICON_NAME)

  image.setPixelSize(ICON_PIXEL_SIZE)
  return image
}
