/* eslint-disable no-console */
import {
  App,
  PluginSettingTab,
  Setting,
  TAbstractFile,
  TFolder,
} from 'obsidian'
import { MultiSuggest } from './MultiSuggest'
import { withConfirm } from './button'
import ObsidianAudioPenPlugin from '../main'
import {
  Auth,
  getAuth,
  signInWithCustomToken,
  signOut,
  Unsubscribe,
} from 'firebase/auth'
import { NewLineType } from '@shared/types'

export interface AudioPenSyncSettings {
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

export const DEFAULT_SETTINGS: AudioPenSyncSettings = {
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

export class AudioPenSettingTab extends PluginSettingTab {
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

  async display() {
    if (!this) {
      return
    }

    this.plugin.loadSettings()

    let { containerEl } = this

    containerEl.empty()

    // General Settings - Header
    containerEl.createEl('h2', { text: 'AudioPen Sync' })

    if (this.plugin.settings.error) {
      containerEl.createEl('p', {
        text: `error: ${this.plugin.settings.error}`,
      })
    }

    // Settings for Logged-In Users
    if (this.auth.currentUser) {
      containerEl
        .createEl('p', { text: 'See your buffer and read the docs at ' })
        .createEl('a', {
          text: 'AudioPen-Obsidian',
          href: 'https://audiopen-obsidian.web.app',
        })

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
        .setName('Destination folder')
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
        .setName('Update mode')
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
        .setName('New line')
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
          .setName('Render tags as')
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
            .setName('Link property')
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

      containerEl.createEl('h2', { text: 'Advanced settings' })
      containerEl.createEl('p', {
        text: 'You can use custom templates to render your notes and make them yours. If you break the template, you may lose data from the buffer.',
      })

      new Setting(containerEl)
        .setName('Use custom template')
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
        containerEl.createEl('p', {
          text: 'You can use the following variables in your template: {title}, {body}, {orig_transcript}, {id}, {date_created},{date_formatted}, {tagsAsLinks}, {tagsAsTags}',
        })
        containerEl.createEl('a', {
          text: 'Check the README for more information',
          href: 'https://github.com/jonashaefele/audiopen-obsidian#custom-templates',
        })

        new Setting(containerEl)
          .setName('Custom template')
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

      containerEl.createEl('h2', { text: 'Danger zone' })
      new Setting(containerEl)
        .setName(`Reset all settings to defaults.`)
        .addButton(
          withConfirm((button) => {
            button
              .setButtonText('Reset Settings')
              .setCta()
              .onClick(async (evt) => {
                try {
                  await signOut(this.auth)
                  this.plugin.settings = DEFAULT_SETTINGS
                } catch (err) {
                  this.plugin.settings.error = err.message
                } finally {
                  await this.plugin.saveSettings()
                  this.display()
                }
              })
          })
        )
    } // end this.auth.currentuser - logged
    else {
      // Settings for Logged-Out Users (need to log in)
      containerEl
        .createEl('p', { text: 'Generate a login token at ' })
        .createEl('a', {
          text: 'AudioPen-Obsidian',
          href: 'https://audiopen-obsidian.web.app',
        })

      new Setting(containerEl).setName('Webhook login token').addText((text) =>
        text
          .setPlaceholder('Paste your token')
          .setValue(this.plugin.settings.token)
          .onChange(async (value) => {
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
                await signInWithCustomToken(
                  this.auth,
                  this.plugin.settings.token
                )
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
    } // end logged-out

    containerEl.createEl('h2', { text: 'Support' })
    containerEl.createEl('p', {
      text: 'If you like this plugin and get value from it, consider donating to support continued development and to help cover server costs.',
    })
    const donateKoFi = new Setting(this.containerEl)
      .setName('Buy me a Coffee')
      .setDesc('One-off or recurring donations are welcome. Thank you!')

    const kofi = document.createElement('a')
    kofi.setAttribute('href', 'https://ko-fi.com/jonashaefele')
    const kofiImg = document.createElement('img')
    kofiImg.src = 'https://storage.ko-fi.com/cdn/kofi3.png?v=3'
    kofiImg.height = 36
    kofiImg.setAttribute(
      'style',
      'border:0px; height:36px; border-radius: 18px;'
    )
    kofiImg.alt = 'Buy Me a Coffee at ko-fi.com'
    kofi.appendChild(kofiImg)

    donateKoFi.controlEl.appendChild(kofi)

    const donateGH = new Setting(this.containerEl)
      .setName('Become a Github Sponsor')
      .setDesc('For the fellow developers out there. Thank you!')

    const ghSponsor = document.createElement('iframe')
    ghSponsor.setAttribute(
      'src',
      'https://github.com/sponsors/jonashaefele/button'
    )
    ghSponsor.setAttribute('title', 'Sponsor jonashaefele')
    ghSponsor.setAttribute('height', '32')
    ghSponsor.setAttribute('width', '114')
    ghSponsor.setAttribute('style', 'border: 0; border-radius: 6px;')

    donateGH.controlEl.appendChild(ghSponsor)
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
