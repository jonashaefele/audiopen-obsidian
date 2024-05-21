/* eslint-disable no-console */
import {
  App,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  TAbstractFile,
  TFolder,
  // addIcon,
} from 'obsidian'
import { MultiSuggest } from './ui/MultiSuggest'
import {
  Auth,
  getAuth,
  signInWithCustomToken,
  signOut,
  Unsubscribe,
} from 'firebase/auth'
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
import app from 'shared/firebase'
import moment from 'moment' // Import moment library
import linksTemplate from './template-links.md'
import tagsTemplate from './template-tags.md'

// eslint-disable-next-line no-shadow
enum NewLineType {
  Windows = 1,
  UnixMac = 2,
}

interface MyPluginSettings {
  token: string
  frequency: string
  triggerOnLoad: boolean
  error?: string
  newLineType?: NewLineType
  tagsAsLinks?: boolean
  linkProperty?: string
  markdownTemplate?: string
  folderPath: string
  updateMode?: 'overwrite' | 'append' | 'prepend' | 'new'
  useCustomTemplate: boolean
}

const DEFAULT_SETTINGS: MyPluginSettings = {
  token: '',
  frequency: '0', // manual by default
  triggerOnLoad: true,
  newLineType: undefined,
  tagsAsLinks: true, // Default to rendering tags as links
  linkProperty: 'x', // Default link property
  markdownTemplate: '',
  folderPath: '',
  updateMode: 'new',
  useCustomTemplate: false,
}

export default class ObsidianAudioPenPlugin extends Plugin {
  settings: MyPluginSettings
  firebase: FirebaseApp
  loggedIn: boolean
  authUnsubscribe: Unsubscribe
  valUnsubscribe: Unsubscribe
  statusBarIcon: null | HTMLElement = null // Initialize as null
  defaultTemplate: string

  async onload() {
    console.log('loading plugin')
    await this.loadSettings()
    this.firebase = app
    this.authUnsubscribe = getAuth(this.firebase).onAuthStateChanged((user) => {
      if (this.valUnsubscribe) {
        this.valUnsubscribe()
      }
      if (user) {
        const db = getDatabase(this.firebase)
        const buffer = ref(db, `buffer/${user.uid}`)
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

    this.addSettingTab(new AudioPenSettingTab(this.app, this))

    // TODO: make official AudioPen Icon work with Obsisian UI rules
    // addIcon(
    //   'audiopen-icon',
    //   `<g transform="matrix(1,0,0,1,0.149662,-0.218721)">
    //       <g transform="matrix(0.215448,0,0,0.215448,-9.04204,-9.49718)">
    //           <path d="M83.409,58.085C91.695,47.132 102.464,46.968 110.443,58.276C111.22,61.24 111.655,63.609 112.006,66.376C111.979,67.856 112.034,68.937 112.016,70.466C111.992,73.935 112.04,76.957 112.005,80.441C111.967,85.935 112.012,90.967 111.96,96.317C111.869,97.076 111.874,97.517 111.665,98.224C107.985,106.858 101.861,110.541 93.931,109.024C87.662,107.824 84.437,103.375 82.159,97.626C82.112,96.865 82.028,96.433 82.017,95.604C82.032,94.135 81.973,93.064 81.975,91.747C81.995,91.337 81.955,91.174 81.997,90.548C82.023,84.385 81.967,78.685 81.984,72.617C82.008,71.507 81.959,70.764 81.993,69.606C82.021,67.788 81.966,66.385 81.986,64.594C82.511,62.166 82.96,60.126 83.409,58.085Z" style="fill:currentColor;fill-rule:nonzero;"/>
    //       </g>
    //       <g transform="matrix(0.215448,0,0,0.215448,-9.04204,-9.49718)">
    //           <path d="M63.154,104.932C63.133,103.867 63.112,102.802 62.985,101.011C62.62,99.664 62.36,99.042 62.101,98.419C62.279,97.168 62.457,95.916 62.691,94.267C65.798,94.267 68.835,94.267 72.302,94.731C72.882,96.475 73.033,97.754 73.163,99.34C73.397,100.196 73.65,100.745 73.866,101.48C73.827,101.665 74.015,101.994 73.982,102.358C78.875,113.589 87.318,119.314 97.831,118.914C108.258,118.517 116.336,112.348 120.079,101.829C120.173,101.666 120.096,101.297 120.29,101.058C120.595,100.226 120.705,99.633 120.936,98.67C121.125,97.009 121.193,95.717 121.261,94.426C124.576,94.448 127.89,94.471 131.466,95.072C131.765,96.116 131.804,96.58 131.843,97.043C131.736,97.44 131.629,97.837 131.421,98.773C131.265,99.877 131.21,100.441 131.155,101.005C131.052,101.441 130.949,101.876 130.681,102.947C127.733,113.414 121.41,120.419 112.511,125.745C108.871,126.928 105.604,128.031 102.248,129.164C102.248,133.755 102.248,138.347 102.135,143.253C101.688,144.381 101.354,145.195 101.019,146.009C99.734,147.809 98.45,149.609 96.918,151.756C95.24,149.118 93.786,146.831 92.138,143.811C91.945,140.598 91.722,138.094 91.994,135.644C92.515,130.966 90.85,128.524 86.051,127.289C78.396,125.318 72.651,120.29 68.286,113.789C66.388,110.963 64.853,107.892 63.154,104.932Z" style="fill:currentColor;fill-rule:nonzero;"/>
    //       </g>
    //   </g>`
    // )

    this.statusBarIcon = this.addStatusBarItem()
    this.updateStatusBarIcon('ok') // Set initial color to gray
  }

  updateStatusBarIcon(status: 'ok' | 'sync' | 'error') {
    this.statusBarIcon.empty()
    const icon = this.statusBarIcon.createEl('span')
    icon.addClass('mic')

    switch (status) {
      case 'ok':
        icon.style.color = 'var(--text-muted)'
        break
      case 'sync':
        icon.style.color = 'var(--text-accent)'
        break
      case 'error':
        icon.style.color = 'var(--text-error)'
        break
    }
  }

  async onBufferChange(data: DataSnapshot) {
    if (!data.hasChildren()) {
      this.updateStatusBarIcon('ok') // No pending events, set color to gray
      return
    }

    try {
      this.updateStatusBarIcon('sync') // Pending events, set color to orange

      let last: unknown = undefined
      let promiseChain = Promise.resolve()
      data.forEach((event) => {
        const payload = event.val().data // Get the payload data
        if (!payload) {
          return
          //TODO: eror handling
        }
        last = payload
        promiseChain = promiseChain.then(() => this.applyEvent(payload))
      })
      await promiseChain
      await this.wipe(last)
      promiseChain.catch((err) => {
        this.handleError(err, 'Error processing webhook events')
      })

      this.updateStatusBarIcon('ok') // All events processed, set color to gray
      new Notice('notes updated by webhooks')
    } catch (err) {
      this.handleError(err, 'Error processing webhook events')
      throw err
    } finally {
    }
  }

  async wipe(value: unknown) {
    const functions = getFunctions(this.firebase, 'europe-west1')
    const wipe = httpsCallable(functions, 'wipe')
    await wipe(value)
  }

  async findFileByAudioPenID(id: string): Promise<TFile | null> {
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

  async generateMarkdownContent(
    body: string,
    orig_transcript: string,
    title: string,
    tags: string[],
    id: string,
    date_created: string
  ): Promise<string> {
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

    // @ts-ignore
    const periodicNotesPlugin = this.app.plugins.getPlugin('periodic-notes')
    // @ts-ignore
    const dailyNotesPlugin = this.app.plugins.getPlugin('daily-notes')

    let dailyNoteFormat = 'YYYY-MM-DD-dddd'

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

    console.log('making md', title, body, tagsAsLinks, markdownTemplate)

    return markdownTemplate
      .replace(/{title}/g, title)
      .replace(/{body}/g, body)
      .replace(/{orig_transcript}/g, orig_transcript)
      .replace(/{id}/g, id)
      .replace(/{date_created}/g, date_created)
      .replace(
        /{date_formatted}/g,
        moment(new Date(date_created)).format('YYYY-MM-DD-dddd')
      )
      .replace(/{linkProperty}/g, this.settings.linkProperty || 'x')
      .replace(/{tagsAsLinks}/g, tagsAsLinks)
      .replace(/{tagsAsTags}/g, tagsAsTags)
  }

  async applyEvent({
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
  }) {
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

    console.log('action: ', this.settings.updateMode)

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
    this.updateStatusBarIcon('error')
  }

  generateFilePath(title: string): string {
    // Implement the logic to generate the file path based on the title
    // and the user's folder preference
    console.log('generating file path', title)
    const folderPath = this.settings.folderPath || '+ Inbox/AudioPen/Test'
    const fileName = title
      .replace(/[\\/:*?'"<>.|]/g, '') // Remove reserved characters for file names
      .slice(0, 250) // Limit the file name to 250 characters
    console.log(`${folderPath}/${fileName}.md`)
    return `${folderPath}/${fileName}.md`
  }

  onunload() {
    console.log('unloading plugin')
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

class AudioPenSettingTab extends PluginSettingTab {
  plugin: ObsidianAudioPenPlugin
  auth: Auth
  authObserver: Unsubscribe

  constructor(oApp: App, plugin: ObsidianAudioPenPlugin) {
    super(oApp, plugin)
    this.plugin = plugin
    this.auth = getAuth(this.plugin.firebase)
    this.authObserver = this.auth.onAuthStateChanged(this.display.bind(this))
  }

  hide(): void {
    this.authObserver()
  }

  display(): void {
    if (!this) {
      return
    }

    let { containerEl } = this

    containerEl.empty()

    containerEl.createEl('h2', { text: 'Settings for AudioPen-Obsidian' })
    containerEl
      .createEl('p', { text: 'Generate login tokens at ' })
      .createEl('a', {
        text: 'AudioPen-Obsidian',
        href: 'https://audiopen-obsidian.web.app',
      })

    if (this.plugin.settings.error) {
      containerEl.createEl('p', {
        text: `error: ${this.plugin.settings.error}`,
      })
    }

    if (this.auth.currentUser) {
      new Setting(containerEl)
        .setName(`logged in as ${this.auth.currentUser.email}`)
        .addButton((button) => {
          button
            .setButtonText('Logout')
            .setCta()
            .onClick(async (evt) => {
              try {
                await signOut(this.auth)
                this.plugin.settings.error = undefined
              } catch (err) {
                this.plugin.settings.error = err.message
              } finally {
                await this.plugin.saveSettings()
                this.display()
              }
            })
        })

      new Setting(containerEl)
        .setName('Destination Folder')
        .setDesc('Select the folder where new notes will be created')
        .addText((text) => {
          const inputEl = text.inputEl
          const getContent = () => {
            const rootFolder = this.app.vault.getAbstractFileByPath('/')
            const folderOptions = this.getFolderOptions(rootFolder)
            return new Set(folderOptions)
          }
          const onSelectCb = async (value: string) => {
            this.plugin.settings.folderPath = value
            await this.plugin.saveSettings()
            this.display()
          }
          const multiSuggest = new MultiSuggest(
            inputEl,
            getContent,
            this.app,
            onSelectCb
          )
          inputEl.addEventListener('input', () => multiSuggest.open())
          inputEl.addEventListener('focus', () => multiSuggest.open())
          inputEl.value = this.plugin.settings.folderPath || ''
        })

      new Setting(containerEl)
        .setName('Update Mode')
        .setDesc(
          'How to handle existing files when receiving updates to an existing AudioPen note (identified by AudioPen ID). Append and prepend will only insert the new/edited summary.'
        )
        .addDropdown((dropdown) => {
          dropdown
            .addOption('overwrite', 'Overwrite existing file')
            .addOption('append', 'Append (note only) to existing file')
            .addOption('prepend', 'Prepend (note only) to existing file')
            .addOption('new', 'Always create a new file')
            .setValue(this.plugin.settings.updateMode || 'new')
            .onChange(async (value) => {
              // @ts-ignore
              this.plugin.settings.updateMode = value
              await this.plugin.saveSettings()
              this.display()
            })
        })

      new Setting(containerEl)
        .setName('New Line')
        .setDesc(
          'When appending/prepending, should we add new lines between the existing content and the new content?'
        )
        .addDropdown((dropdown) => {
          dropdown.addOption('none', 'No new lines')
          dropdown.addOption('windows', 'Windows style newlines')
          dropdown.addOption('unixMac', 'Linux, Unix or Mac style new lines')
          const { newLineType } = this.plugin.settings
          if (newLineType === undefined) {
            dropdown.setValue('none')
          } else if (newLineType == NewLineType.Windows) {
            dropdown.setValue('windows')
          } else if (newLineType == NewLineType.UnixMac) {
            dropdown.setValue('unixMac')
          }
          dropdown.onChange(async (value) => {
            if (value == 'none') {
              this.plugin.settings.newLineType = undefined
            } else if (value == 'windows') {
              this.plugin.settings.newLineType = NewLineType.Windows
            } else if (value == 'unixMac') {
              this.plugin.settings.newLineType = NewLineType.UnixMac
            }
            await this.plugin.saveSettings()
            this.display()
          })
        })

      if (!this.plugin.settings.useCustomTemplate) {
        new Setting(containerEl)
          .setName('Render Tags As')
          .setDesc('How should we render AudioPen tags?')
          .addDropdown((dropdown) => {
            dropdown
              .addOption('links', '[[Links]] to notes')
              .addOption('tags', 'Simple #tags')
              .setValue(this.plugin.settings.tagsAsLinks ? 'links' : 'tags')
              .onChange(async (value) => {
                this.plugin.settings.tagsAsLinks = value === 'links'
                await this.plugin.saveSettings()
                this.display()
              })
          })

        if (this.plugin.settings.tagsAsLinks) {
          new Setting(containerEl)
            .setName('Link Property')
            .setDesc(
              "Frontmatter property for tags as links (e.g., 'x', 'links')"
            )
            .addText((text) => {
              text
                .setPlaceholder('x')
                .setValue(this.plugin.settings.linkProperty || 'x')
                .onChange(async (value) => {
                  this.plugin.settings.linkProperty = value
                  await this.plugin.saveSettings()
                  this.display()
                })
            })
        }
      }
      new Setting(containerEl)
        .setName('Use Custom Template')
        .setDesc(
          'Toggle between using the default template or a custom template'
        )
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.useCustomTemplate)
            .onChange(async (value) => {
              this.plugin.settings.useCustomTemplate = value
              await this.plugin.saveSettings()
              this.display()
            })
        )

      if (this.plugin.settings.useCustomTemplate) {
        new Setting(containerEl)
          .setName('Custom Template')
          .setDesc(
            'Select a Markdown file from your vault to use as a custom template'
          )
          .addText((text) => {
            const inputEl = text.inputEl
            const getContent = () => {
              const markdownFiles = this.app.vault.getMarkdownFiles()
              return new Set(markdownFiles.map((file) => file.path))
            }
            const onSelectCb = async (value: string) => {
              this.plugin.settings.markdownTemplate = value
              await this.plugin.saveSettings()
              this.display()
            }
            const multiSuggest = new MultiSuggest(
              inputEl,
              getContent,
              this.app,
              onSelectCb
            )
            inputEl.addEventListener('input', () => multiSuggest.open())
            inputEl.addEventListener('focus', () => multiSuggest.open())
            inputEl.value = this.plugin.settings.markdownTemplate || ''
          })
      }

      return
    }

    new Setting(containerEl).setName('Webhook login token').addText((text) =>
      text
        .setPlaceholder('Paste your token')
        .setValue(this.plugin.settings.token)
        .onChange(async (value) => {
          console.log('Secret: ' + value)
          this.plugin.settings.token = value
          await this.plugin.saveSettings()
        })
    )

    new Setting(containerEl)
      .setName('Login')
      .setDesc('Exchanges webhook token for authentication')
      .addButton((button) => {
        button
          .setButtonText('Login')
          .setCta()
          .onClick(async (evt) => {
            try {
              await signInWithCustomToken(this.auth, this.plugin.settings.token)
              this.plugin.settings.token = ''
              this.plugin.settings.error = undefined
            } catch (err) {
              this.plugin.settings.error = err.message
            } finally {
              await this.plugin.saveSettings()
              this.display()
            }
          })
      })
  }

  getFolderOptions(folder: TAbstractFile): string[] {
    const options: string[] = []

    if (folder instanceof TFolder) {
      options.push(folder.path)

      folder.children.forEach((child) => {
        if (child instanceof TFolder) {
          options.push(...this.getFolderOptions(child))
        }
      })
    }

    return options
  }
}
