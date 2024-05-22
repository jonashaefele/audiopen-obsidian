/* eslint-disable no-console */
import {
  App,
  PluginSettingTab,
  Setting,
  TAbstractFile,
  TFolder,
} from 'obsidian'
import { MultiSuggest } from './MultiSuggest'
import ObsidianAudioPenPlugin from '../main'
import {
  Auth,
  getAuth,
  signInWithCustomToken,
  signOut,
  Unsubscribe,
} from 'firebase/auth'
import { NewLineType } from 'shared/types'

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

    console.log('settings in panel', this.plugin.settings)

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
