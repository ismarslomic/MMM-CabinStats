import { FactView } from './factView'

/** What the overlay reports back to the module. */
export type GuestOverlayHandlers = {
  /** The close button was used. */
  onClose: () => void
  /** The retry button of the error state was used. */
  onRetry: () => void
  /** Any touch inside the overlay, so the module can restart the inactivity timeout. */
  onActivity: () => void
}

/**
 * Turns the rendered `templates/guest-view.njk` into the full-screen guest view and connects the buttons. It is meant
 * to be appended to `document.body`, outside the module's own DOM, so that a re-render of the module (live stats
 * polling) never touches it.
 *
 * @throws Error when the html has no root element.
 */
export function createGuestOverlay(html: string, handlers: GuestOverlayHandlers): HTMLElement {
  const host = document.createElement('div')
  host.innerHTML = html
  const overlay = host.firstElementChild
  if (!(overlay instanceof HTMLElement)) throw new Error('The guest view template rendered no element')

  overlay.addEventListener('pointerdown', handlers.onActivity)
  overlay.addEventListener('click', (event) => {
    const action = event.target instanceof Element ? event.target.closest('[data-cabin-action]') : null
    if (action?.getAttribute('data-cabin-action') === 'close') handlers.onClose()
    if (action?.getAttribute('data-cabin-action') === 'retry') handlers.onRetry()
  })
  return overlay
}

/** Shows another fun fact in an open guest view with a fade, without rebuilding anything else. */
export function updateGuestOverlayFact(overlay: ParentNode, fact: FactView): void {
  const element = overlay.querySelector<HTMLElement>('.cabin-profile-fact')
  if (!element) return
  element.classList.remove('cabin-fade-in')
  // Reading a layout property restarts the CSS animation.
  void element.offsetWidth
  // Text nodes and `textContent` only: the texts come from the backend and must not be parsed as html.
  element.replaceChildren(
    ...fact.segments.map(({ text, kind }) => {
      if (kind === 'text') return document.createTextNode(text)
      const span = document.createElement('span')
      span.className = `cabin-highlight cabin-highlight-${kind}`
      span.textContent = text
      return span
    })
  )
  element.classList.add('cabin-fade-in')
}
