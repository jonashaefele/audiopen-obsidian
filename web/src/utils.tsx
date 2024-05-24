import { createSignal } from 'solid-js'

export function useToast() {
  const [showToast, setShowToast] = createSignal(false)
  const [toastMessage, setToastMessage] = createSignal('')
  const [toastPosition, setToastPosition] = createSignal<{
    x: number
    y: number
  } | null>(null)

  const showToastMessage = (
    message: string,
    eventTarget?: HTMLElement | null
  ) => {
    setToastMessage(message)
    setShowToast(true)

    if (eventTarget) {
      const rect = eventTarget.getBoundingClientRect()
      setToastPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      })
    } else {
      setToastPosition(null)
    }

    setTimeout(() => {
      setShowToast(false)
      setToastPosition(null)
    }, 3000)
  }

  return { showToast, toastMessage, toastPosition, showToastMessage }
}
