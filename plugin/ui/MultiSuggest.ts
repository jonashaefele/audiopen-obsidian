import { AbstractInputSuggest, App } from 'obsidian'

// not documented well, but found here:
// https://forum.obsidian.md/t/provide-an-implementation-of-suggest-input-for-plugins-to-use/66561/6
// https://github.com/obsidianmd/obsidian-api/blob/249eb773347588f4e9fec7c600e1904cd9240fcb/obsidian.d.ts#L290

export class MultiSuggest extends AbstractInputSuggest<string> {
  private content: Set<string>
  private onSelectCb: (value: string) => void

  constructor(
    private inputEl: HTMLInputElement,
    private getContent: () => Set<string>,
    app: App,
    onSelectCb: (value: string) => void
  ) {
    super(app, inputEl)
    this.content = getContent()
    this.onSelectCb = onSelectCb
  }

  getSuggestions(inputStr: string): string[] {
    const lowerCaseInputStr = inputStr.toLocaleLowerCase()
    return [...this.content].filter((content) =>
      content.toLocaleLowerCase().includes(lowerCaseInputStr)
    )
  }

  renderSuggestion(content: string, el: HTMLElement): void {
    el.setText(content)
  }

  selectSuggestion(content: string, evt: MouseEvent | KeyboardEvent): void {
    this.onSelectCb(content)
    this.inputEl.value = ''
    this.inputEl.blur()
    this.close()
  }
}
