/* eslint-disable no-console */
import {
  Notice,
  Menu,
  Plugin,
  TFile,
  setIcon,
  // addIcon,
} from 'obsidian'
import { getAuth, Unsubscribe } from 'firebase/auth'
import { FirebaseApp } from 'firebase/app'
import {
  DataSnapshot,
  getDatabase,
  goOffline,
  goOnline,
  onValue,
  ref,
} from 'firebase/database'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { default as firebaseApp } from '@shared/firebase'
import moment from 'moment'
import linksTemplate from './templates/template-links.md'
import tagsTemplate from './templates/template-tags.md'
import { BufferItemData, NewLineType } from '@shared/types'

import {
  AudioPenSyncSettings,
  DEFAULT_SETTINGS,
  AudioPenSettingTab,
} from './ui/SettingsTab'

export default class ObsidianAudioPenPlugin extends Plugin {
  settings: AudioPenSyncSettings
  firebase: FirebaseApp
  loggedIn: boolean
  authUnsubscribe: Unsubscribe
  valUnsubscribe: Unsubscribe
  statusBarIcon: null | HTMLElement = null // Initialize as null
  defaultTemplate: string
  syncStatus = 'offline'

  async onload() {
    await this.loadSettings()
    this.firebase = firebaseApp
    this.authUnsubscribe = getAuth(this.firebase).onAuthStateChanged((user) => {
      if (this.valUnsubscribe) {
        this.valUnsubscribe()
      }
      if (user) {
        const db = getDatabase(this.firebase)
        const buffer = ref(db, `buffer/${user.uid}`)
        this.syncStatus = 'ok'
        this.valUnsubscribe = onValue(buffer, async (data) => {
          try {
            await goOffline(db)
            await this.onBufferChange(data)
          } finally {
            await goOnline(db)
          }
        })
      }
    })

    // Bind the instance of ObsidianAudioPenPlugin to the AudioPenSettingTab instance
    const settingTab = new AudioPenSettingTab(this.app, this)
    this.addSettingTab(settingTab)

    this.statusBarIcon = this.addStatusBarItem()
    this.updateStatusBarIcon() // Set initial color to gray
    this.registerDomEvent(this.statusBarIcon, 'click', (event) =>
      this.showStatusBarMenu(event)
    )
  }

  getSyncStatus = () => {
    let syncStatus = 'Starting up'
    switch (this.syncStatus) {
      case 'ok':
        syncStatus = 'Fully synced'
        break
      case 'sync':
        syncStatus = 'Syncing...'
        break
      case 'error':
        syncStatus = 'Error'
        break
      case 'offline':
      default:
        syncStatus = 'Offline'
        break
    }
    return syncStatus
  }

  showStatusBarMenu = (event: MouseEvent) => {
    const menu = new Menu()

    menu.addItem((item) => {
      const syncStatus = this.getSyncStatus()
      item.setIsLabel(true).setTitle(`Status: ${syncStatus}`)
    })

    menu.addSeparator()

    menu.addItem((item) =>
      item.setTitle('Force sync').setIcon('sync').onClick(this.forceBufferSync)
    )

    menu.addItem((item) =>
      item.setTitle('Open buffer').onClick(() => {
        window.open('https://audiopen-obsidian.web.app', '_blank')
      })
    )

    menu.addSeparator()

    menu.addItem((item) =>
      item.setTitle('Settings').onClick(() => {
        // this.app.setting is not defined in types, but exists
        // @ts-ignore
        const setting = this.app.setting
        setting.open()
        setting.openTabById('audiopen-sync')
      })
    )

    menu.showAtMouseEvent(event)
  }

  updateStatusBarIcon = () => {
    this.statusBarIcon.empty()
    const icon = this.statusBarIcon.createEl('span')
    setIcon(icon, 'microphone-filled')
    const syncStatus = this.getSyncStatus()
    icon.setAttr('data-tooltip-position', 'top')
    icon.setAttr('aria-label', syncStatus)
    icon.addClass(`mod-${this.syncStatus}`)
  }

  forceBufferSync = async () => {
    const user = getAuth(this.firebase).currentUser
    if (!user) {
      return
    }
    const db = getDatabase(this.firebase)
    try {
      await goOffline(db)
    } finally {
      await goOnline(db)
      new Notice('Reset AudioPen buffer connection')
    }
  }

  onBufferChange = async (data: DataSnapshot) => {
    if (!data.hasChildren()) {
      this.syncStatus = 'ok'
      this.updateStatusBarIcon() // No pending events, set color to gray
      return
    }

    try {
      this.syncStatus = 'sync'
      this.updateStatusBarIcon() // Pending events, set color to orange

      const payloads: BufferItemData[] = []
      data.forEach((event) => {
        const payload = event.val().data // Get the payload data
        if (payload) {
          payloads.push(payload)
        }
      })

      // Sort payloads by date_created in ascending order
      payloads.sort((a, b) => {
        const dateA = new Date(a.date_created)
        const dateB = new Date(b.date_created)
        return dateA.getTime() - dateB.getTime()
      })

      let promiseChain = Promise.resolve()
      for (const payload of payloads) {
        promiseChain = promiseChain.then(() => this.applyEvent(payload))
      }

      await promiseChain
      await this.wipe(payloads[payloads.length - 1]) // Wipe the last (newest) payload
      // TODO: Should this be the last? Or the last touched, which is the first?
      promiseChain.catch((err) => {
        this.handleError(err, 'Error loading AudioPen notes')
      })
      this.syncStatus = 'ok'
      this.updateStatusBarIcon() // All events processed, set color to gray
      new Notice('New AudioPen notes loaded')
    } catch (err) {
      this.syncStatus = 'error'
      this.updateStatusBarIcon()
      this.handleError(err, 'Error loading AudioPen notes')
      throw err
    } finally {
    }
  }

  wipe = async (value: unknown) => {
    const functions = getFunctions(this.firebase, 'europe-west1')
    const wipe = httpsCallable(functions, 'wipe')
    await wipe(value)
  }

  findFileByAudioPenID = async (id: string): Promise<TFile | null> => {
    const files = this.app.vault.getMarkdownFiles()

    for (const file of files) {
      // const content = await this.app.vault.cachedRead(file)
      const frontmatter = this.app.metadataCache.getCache(
        file.path
      )?.frontmatter

      if (frontmatter && frontmatter.audioPenID === id) {
        return file
      }
    }

    return null
  }

  generateMarkdownContent = async (
    body: string,
    orig_transcript: string,
    title: string,
    tags: string[],
    id: string,
    date_created: string
  ): Promise<string> => {
    let markdownTemplate: string
    if (!this.settings.useCustomTemplate) {
      // default templates
      if (this.settings.tagsAsLinks) {
        markdownTemplate = linksTemplate
      } else {
        markdownTemplate = tagsTemplate
      }
    } else {
      const file = this.app.vault.getAbstractFileByPath(
        this.settings.markdownTemplate
      )
      if (file instanceof TFile) {
        markdownTemplate = await this.app.vault.cachedRead(file)
      } else {
        throw new Error('Invalid file type for markdown template')
      }
    }

    // get link to daily note, read from periodic notes if installed
    // then fall back to daily note core plugin
    // then fall back to basic YYYY-MM-DD

    // this.app.plugins is not defined in types, but exists
    // @ts-ignore
    const periodicNotesPlugin = this.app.plugins.getPlugin('periodic-notes')
    // @ts-ignore
    const dailyNotesPlugin = this.app.plugins.getPlugin('daily-notes')

    let dailyNoteFormat = 'YYYY-MM-DD'

    if (periodicNotesPlugin && periodicNotesPlugin.settings) {
      dailyNoteFormat =
        periodicNotesPlugin.settings.daily?.format || dailyNoteFormat
    } else if (dailyNotesPlugin && dailyNotesPlugin.settings) {
      dailyNoteFormat = dailyNotesPlugin.settings.format || dailyNoteFormat
    }

    const tagsAsLinks =
      this.settings.tagsAsLinks && tags?.length > 0
        ? tags
            .map((tag) => (tag?.length > 0 ? `  - "[[${tag.trim()}]]"` : null))
            .filter((t) => !!t)
            .join('\n')
        : ''

    const tagsAsTags =
      !this.settings.tagsAsLinks && tags?.length > 0
        ? tags
            .map((tag) => (tag?.length > 0 ? `  - ${tag.trim()}` : null))
            .filter((t) => !!t)
            .join('\n')
        : ''

    return markdownTemplate
      .replace(/{title}/g, title)
      .replace(/{body}/g, body)
      .replace(/{orig_transcript}/g, orig_transcript)
      .replace(/{id}/g, id)
      .replace(/{date_created}/g, date_created)
      .replace(
        /{date_formatted}/g,
        moment(new Date(date_created)).format(dailyNoteFormat)
      )
      .replace(/{linkProperty}/g, this.settings.linkProperty || 'x')
      .replace(/{tagsAsLinks}/g, tagsAsLinks)
      .replace(/{tagsAsTags}/g, tagsAsTags)
  }

  applyEvent = async ({
    body = '',
    orig_transcript = '',
    title = '',
    tags = [],
    id = '',
    date_created = '',
  }: {
    body: string
    orig_transcript: string
    title: string
    tags: string[]
    id: string
    date_created: string
  }) => {
    const existingFiles = this.app.vault.getMarkdownFiles().filter((file) => {
      const frontmatter = this.app.metadataCache.getCache(
        file.path
      )?.frontmatter
      return frontmatter && frontmatter.audioPenID === id
    })

    let newContent = await this.generateMarkdownContent(
      body,
      orig_transcript,
      title,
      tags,
      id,
      date_created
    )

    if (existingFiles.length === 0) {
      // No existing file found, create a new file
      const filePath = this.generateFilePath(title)
      await this.app.vault.create(filePath, newContent)
      return
    }

    if (this.settings.updateMode === 'new') {
      // Create a new file with a "V" suffix
      const filePath = this.generateFilePath(
        `${title} V${existingFiles.length + 1}`
      )

      await this.app.vault.create(filePath, newContent)
      return
    }

    // Update existing file based on user preference (overwrite, append, or prepend)
    const existingContent = await this.app.vault.cachedRead(existingFiles[0])
    let updatedContent

    switch (this.settings.updateMode) {
      case 'overwrite':
        updatedContent = newContent
        break
      case 'append':
        updatedContent = `${existingContent}${this.getNewLine()}#V${
          existingFiles.length + 1
        }${this.getNewLine()}${body}`
        break
      case 'prepend':
        updatedContent = `#V${
          existingFiles.length + 1
        }${this.getNewLine()}${body}${this.getNewLine()}${existingContent}`
        break
      default:
        throw new Error('Invalid update mode')
    }

    await this.app.vault.modify(existingFiles[0], updatedContent)
  }

  getNewLine(): string {
    switch (this.settings.newLineType) {
      case NewLineType.Windows:
        return '\r\n'
      case NewLineType.UnixMac:
        return '\n'
      default:
        return ''
    }
  }

  private handleError(error: Error, message: string) {
    console.error(`${message}: ${error.message}`)
    new Notice(`Error: ${message}`)
    this.syncStatus = 'error'
    this.updateStatusBarIcon()
  }

  generateFilePath(title: string): string {
    // Implement the logic to generate the file path based on the title
    // and the user's folder preference
    const folderPath = this.settings.folderPath || '+ Inbox/AudioPen'
    const fileName = title
      .replace(/[\\/:*?'"<>.|]/g, '') // Remove reserved characters for file names
      .slice(0, 250) // Limit the file name to 250 characters
    return `${folderPath}/${fileName}.md`
  }

  onunload() {
    if (this.authUnsubscribe) {
      this.authUnsubscribe()
    }
    if (this.valUnsubscribe) {
      this.valUnsubscribe()
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings() {
    await this.saveData(this.settings)
  }
}
