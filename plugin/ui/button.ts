import { ButtonComponent } from 'obsidian'

export function withConfirm(callback: (btn: ButtonComponent) => any) {
  let onClickHandler: (evt?: MouseEvent) => any = void 0
  let resetButtonClicked = false
  return (btn: ButtonComponent) => {
    btn.setWarning().onClick(() => {
      if (!resetButtonClicked) {
        resetButtonClicked = true
        btn.setButtonText('Confirm')
        return
      }
      if (onClickHandler != void 0) {
        onClickHandler()
      }
    })
    btn.onClick = (handler: (evt: MouseEvent) => any) => {
      onClickHandler = handler
      return btn
    }
    callback(btn)
  }
}
