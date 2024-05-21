import { AbstractInputSuggest, App } from 'obsidian'

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
