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
  debug: boolean
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
  debug: false,
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

      new Setting(containerEl).setName('Advanced').setHeading()
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

      new Setting(containerEl)
        .setName('Debug Mode')
        .setDesc(
          'Print debug messages to the console. This is useful for troubleshooting issues. See the console with View --> Toggle Developer Tools'
        )
        .addToggle((toggle) =>
          toggle
            .setValue(this.plugin.settings.debug)
            .onChange(async (value) => {
              this.plugin.settings.debug = value
              await this.plugin.saveSettings()
              this.display()
            })
        )

      new Setting(containerEl).setName('Danger zone').setHeading()
      new Setting(containerEl)
        .setName(`Reset all settings to defaults.`)
        .addButton(
          withConfirm((button) => {
            button
              .setButtonText('Reset settings')
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

    new Setting(containerEl).setName('Support').setHeading()
    containerEl.createEl('p', {
      text: 'If you like this plugin and get value from it, consider donating to support continued development and to help cover server costs.',
    })
    const donateKoFi = new Setting(this.containerEl)
      .setName('Buy me a coffee')
      .setDesc('Thank you!')

    const kofi = document.createElement('a')
    kofi.setAttribute('href', 'https://ko-fi.com/jonashaefele')
    const kofiImg = document.createElement('img')
    kofiImg.src =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMwAAAAgCAYAAABepJcLAAAEtmlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPD94cGFja2V0IGJlZ2luPSLvu78iIGlkPSJXNU0wTXBDZWhpSHpyZVN6TlRjemtjOWQiPz4KPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNS41LjAiPgogPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgeG1sbnM6dGlmZj0iaHR0cDovL25zLmFkb2JlLmNvbS90aWZmLzEuMC8iCiAgICB4bWxuczpleGlmPSJodHRwOi8vbnMuYWRvYmUuY29tL2V4aWYvMS4wLyIKICAgIHhtbG5zOnBob3Rvc2hvcD0iaHR0cDovL25zLmFkb2JlLmNvbS9waG90b3Nob3AvMS4wLyIKICAgIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIKICAgIHhtbG5zOnhtcE1NPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvbW0vIgogICAgeG1sbnM6c3RFdnQ9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZUV2ZW50IyIKICAgdGlmZjpJbWFnZUxlbmd0aD0iMzIiCiAgIHRpZmY6SW1hZ2VXaWR0aD0iMjA0IgogICB0aWZmOlJlc29sdXRpb25Vbml0PSIyIgogICB0aWZmOlhSZXNvbHV0aW9uPSI3Mi8xIgogICB0aWZmOllSZXNvbHV0aW9uPSI3Mi8xIgogICBleGlmOlBpeGVsWERpbWVuc2lvbj0iMjA0IgogICBleGlmOlBpeGVsWURpbWVuc2lvbj0iMzIiCiAgIGV4aWY6Q29sb3JTcGFjZT0iMSIKICAgcGhvdG9zaG9wOkNvbG9yTW9kZT0iMyIKICAgcGhvdG9zaG9wOklDQ1Byb2ZpbGU9InNSR0IgSUVDNjE5NjYtMi4xIgogICB4bXA6TW9kaWZ5RGF0ZT0iMjAyNC0w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'
    kofiImg.height = 32
    kofiImg.setAttribute('style', 'border:0px; height:32px;')
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
