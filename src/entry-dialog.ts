import Gtk from 'gi:Gtk-4.0'
import Adw from 'gi:Adw-1'
import { dirname, join } from 'node:path'

import type { DesktopEntry } from './desktop-entry.js'
import { getWritableApplicationDirectories, isDirectoryWritable } from './app-directories.js'
import {
  serializeDesktopEntry,
  writeDesktopFile,
  desktopFileExists,
  slugify,
  type EntryFormValues,
} from './desktop-file-writer.js'
import { createIconPicker } from './icon-picker.js'

const CATEGORIES_HINT = 'Semicolon-separated, e.g. Utility;Development;'

/** If `entry´ is null, this dialog will be the create dialog */
export function openEntryDialog(
  window: InstanceType<typeof Adw.ApplicationWindow>,
  entry: DesktopEntry | null,
  onSaved: (name: string, dir: string) => void,
): void {
  const isEdit = entry !== null
  const writableDirs = getWritableApplicationDirectories()
  const defaultDir = writableDirs[0]

  let currentIcon = entry?.icon

  const dialog = new Adw.Dialog({ title: isEdit ? 'Edit Application' : 'New Application', followsContentSize: true })

  const header = new Adw.HeaderBar({ showStartTitleButtons: false, showEndTitleButtons: false })
  header.setTitleWidget(new Gtk.Label({ label: dialog.getTitle(), cssClasses: ['title'] }))

  const cancelButton = new Gtk.Button({ label: 'Cancel' })
  cancelButton.on('clicked', () => dialog.close())
  header.packStart(cancelButton)

  const saveButton = new Gtk.Button({ label: 'Save', cssClasses: ['suggested-action'], sensitive: !!entry?.name })
  header.packEnd(saveButton)

  const banner = new Adw.Banner({ revealed: false, cssClasses: ['error'] })

  const iconGroup = new Adw.PreferencesGroup()
  iconGroup.add(createIconPicker(window, entry?.icon, path => { currentIcon = path }))

  const nameRow = new Adw.EntryRow({ title: 'Name', text: entry?.name ?? '' })
  const commentRow = new Adw.EntryRow({ title: 'Comment', text: entry?.comment ?? '' })
  const execRow = new Adw.EntryRow({ title: 'Command', text: entry?.exec ?? '' })

  const detailsGroup = new Adw.PreferencesGroup({ title: 'Details' })
  detailsGroup.add(nameRow)
  detailsGroup.add(commentRow)
  detailsGroup.add(execRow)

  if (isEdit && !isDirectoryWritable(dirname(entry.filePath))) {
    detailsGroup.setDescription(
      'This app is provided by the system — your changes will be saved as a personal copy.',
    )
  }

  const terminalRow = new Adw.SwitchRow({ title: 'Run in a Terminal', active: entry?.terminal ?? false })
  const visibleRow = new Adw.SwitchRow({
    title: 'Show in App Grid',
    active: entry ? !(entry.noDisplay || entry.hidden) : true,
  })
  const categoriesRow = new Adw.EntryRow({ title: 'Categories', text: entry?.categories.join(';') ?? '' })
  categoriesRow.setTooltipText(CATEGORIES_HINT)

  const optionsGroup = new Adw.PreferencesGroup({ title: 'Options' })
  optionsGroup.add(terminalRow)
  optionsGroup.add(visibleRow)
  optionsGroup.add(categoriesRow)

  const groups = [iconGroup, detailsGroup, optionsGroup]

  let locationDropdown: InstanceType<typeof Gtk.DropDown> | undefined
  let filenameRow: InstanceType<typeof Adw.EntryRow> | undefined
  let filenameEdited = false
  let settingFilenameProgrammatically = false

  function currentTargetPath(): string {
    if (isEdit) {
      const dir = dirname(entry.filePath)
      return isDirectoryWritable(dir) ? entry.filePath : join(defaultDir, entry.id)
    }
    const dir = writableDirs[locationDropdown!.getSelected()] ?? defaultDir
    const filename = (filenameRow!.text.trim() || slugify(nameRow.text)) + '.desktop'
    return join(dir, filename)
  }

  function updateCollisionState(): void {
    if (isEdit) return
    const path = currentTargetPath()
    if (desktopFileExists(path)) {
      banner.setTitle(`A file named “${path.split('/').pop()}” already exists at this location.`)
      banner.setRevealed(true)
    } else {
      banner.setRevealed(false)
    }
  }

  if (!isEdit) {
    locationDropdown = Gtk.DropDown.newFromStrings(writableDirs)
    locationDropdown.setValign(Gtk.Align.CENTER)
    locationDropdown.on('notify::selected', () => updateCollisionState())

    const locationRow = new Adw.ActionRow({ title: 'Location', activatableWidget: locationDropdown })
    locationRow.addSuffix(locationDropdown)

    filenameRow = new Adw.EntryRow({ title: 'Filename', text: slugify(nameRow.text) })
    filenameRow.addSuffix(new Gtk.Label({ label: '.desktop', cssClasses: ['dim-label'] }))
    filenameRow.on('notify::text', () => {
      if (!settingFilenameProgrammatically) filenameEdited = true
      updateCollisionState()
    })

    const locationGroup = new Adw.PreferencesGroup({ title: 'Save Location' })
    locationGroup.add(locationRow)
    locationGroup.add(filenameRow)
    groups.push(locationGroup)
  }

  nameRow.on('notify::text', () => {
    saveButton.sensitive = nameRow.text.trim().length > 0

    if (filenameRow && !filenameEdited) {
      settingFilenameProgrammatically = true
      filenameRow.text = slugify(nameRow.text)
      settingFilenameProgrammatically = false
    }
    updateCollisionState()
  })

  const page = new Adw.PreferencesPage({ widthRequest: 480 })
  for (const group of groups) page.add(group)

  const toolbarView = new Adw.ToolbarView()
  toolbarView.addTopBar(header)
  toolbarView.addTopBar(banner)
  toolbarView.setContent(page)
  dialog.setChild(toolbarView)

  function doSave(targetPath: string): void {
    const values: EntryFormValues = {
      name: nameRow.text.trim(),
      comment: commentRow.text.trim() || undefined,
      exec: execRow.text.trim() || undefined,
      icon: currentIcon,
      terminal: terminalRow.active,
      categories: categoriesRow.text.split(';').map(s => s.trim()).filter(Boolean),
      visible: visibleRow.active,
    }

    try {
      writeDesktopFile(targetPath, serializeDesktopEntry(values))
    } catch (error) {
      banner.setTitle(error instanceof Error ? error.message : 'Failed to save the application.')
      banner.setRevealed(true)
      return
    }

    dialog.close()
    onSaved(values.name, dirname(targetPath))
  }

  saveButton.on('clicked', () => {
    const targetPath = currentTargetPath()

    if (!isEdit && desktopFileExists(targetPath)) {
      const filename = targetPath.split('/').pop()
      const confirm = new Adw.AlertDialog({
        heading: 'Replace File?',
        body: `A file named “${filename}” already exists. Saving will overwrite its contents.`,
      })
      confirm.addResponse('cancel', 'Cancel')
      confirm.addResponse('replace', 'Replace')
      confirm.setResponseAppearance('replace', Adw.ResponseAppearance.DESTRUCTIVE)
      confirm.setDefaultResponse('cancel')
      confirm.setCloseResponse('cancel')

      confirm.choose(dialog, null, (_source, result) => {
        if (confirm.chooseFinish(result) === 'replace') doSave(targetPath)
      })
      return
    }

    doSave(targetPath)
  })

  dialog.present(window)
}
