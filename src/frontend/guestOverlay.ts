import { GuestOverlayModel } from './guestView'

/** Translates a key of `translations/nb.json`, with optional `{name}` style variables. */
export type Translate = (key: string, variables?: Record<string, string | number>) => string

/** What the overlay reports back to the module. */
export type GuestOverlayHandlers = {
  /** The close button or Escape was used. */
  onClose: () => void
  /** The retry button of the error state was used. */
  onRetry: () => void
  /** Any touch inside the overlay, so the module can restart the inactivity timeout. */
  onActivity: () => void
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

function createAvatar(model: GuestOverlayModel): HTMLElement {
  const avatar = element('div', 'cabin-avatar cabin-avatar-large')
  avatar.append(element('span', 'cabin-avatar-initials', model.initials))
  if (model.avatarUrl) {
    const image = element('img', 'cabin-avatar-image')
    image.src = model.avatarUrl
    image.alt = ''
    avatar.append(image)
  }
  return avatar
}

function createBody(model: GuestOverlayModel, translate: Translate, handlers: GuestOverlayHandlers): HTMLElement {
  const body = element('div', 'cabin-overlay-body')
  if (model.status === 'loading') {
    const status = element('p', 'cabin-overlay-status medium light dimmed', translate('GUEST_STATS_LOADING'))
    status.setAttribute('role', 'status')
    body.append(status)
  } else if (model.status === 'error') {
    const message = element('p', 'cabin-overlay-status medium light bright', translate('GUEST_STATS_ERROR'))
    message.setAttribute('role', 'alert')
    const retry = element('button', 'cabin-overlay-button medium', translate('GUEST_STATS_RETRY'))
    retry.type = 'button'
    retry.addEventListener('click', handlers.onRetry)
    body.append(message, retry)
  } else {
    // Next iteration: the statistics of the guest go here.
    body.append(element('p', 'cabin-overlay-status medium light dimmed', translate('GUEST_STATS_PLACEHOLDER')))
  }
  return body
}

/**
 * Builds the full-screen guest view. It is meant to be appended to `document.body`, outside the module's own DOM, so
 * that a re-render of the module (live stats polling) never touches it.
 */
export function createGuestOverlay(
  model: GuestOverlayModel,
  translate: Translate,
  handlers: GuestOverlayHandlers
): HTMLElement {
  const overlay = element('div', 'cabin-overlay')
  overlay.setAttribute('role', 'dialog')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-label', translate('GUEST_STATS_LABEL', { name: model.fullName }))
  overlay.addEventListener('pointerdown', handlers.onActivity)

  const close = element('button', 'cabin-overlay-close', '✕')
  close.type = 'button'
  close.setAttribute('aria-label', translate('CLOSE'))
  close.addEventListener('click', handlers.onClose)

  const header = element('header', 'cabin-overlay-header')
  header.append(createAvatar(model), element('h2', 'cabin-overlay-name large light bright', model.fullName))

  overlay.append(close, header, createBody(model, translate, handlers))
  return overlay
}
