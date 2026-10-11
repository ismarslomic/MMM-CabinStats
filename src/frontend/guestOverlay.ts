import { element, Translate } from './dom'
import { GuestOverlayModel } from './guestView'
import { createProfileSection, updateProfileFact } from './guestProfileView'

/** What the overlay reports back to the module. */
export type GuestOverlayHandlers = {
  /** The close button or Escape was used. */
  onClose: () => void
  /** The retry button of the error state was used. */
  onRetry: () => void
  /** Any touch inside the overlay, so the module can restart the inactivity timeout. */
  onActivity: () => void
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
    const status = element('p', 'cabin-overlay-status dimmed', translate('GUEST_PROFILE_LOADING'))
    status.setAttribute('role', 'status')
    body.append(status)
  } else if (model.status === 'error') {
    const message = element('p', 'cabin-overlay-status bright', translate('GUEST_PROFILE_ERROR'))
    message.setAttribute('role', 'alert')
    const retry = element('button', 'cabin-overlay-button', translate('GUEST_PROFILE_RETRY'))
    retry.type = 'button'
    retry.addEventListener('click', handlers.onRetry)
    body.append(message, retry)
  } else {
    if (model.profile) body.append(createProfileSection(model.profile, model.factIndex, translate))
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
  overlay.setAttribute('aria-label', translate('GUEST_PROFILE_LABEL', { name: model.fullName }))
  overlay.addEventListener('pointerdown', handlers.onActivity)

  const close = element('button', 'cabin-overlay-close', '✕')
  close.type = 'button'
  close.setAttribute('aria-label', translate('CLOSE'))
  close.addEventListener('click', handlers.onClose)

  const header = element('header', 'cabin-overlay-header')
  header.append(createAvatar(model), element('h2', 'cabin-overlay-name bright', model.fullName))

  overlay.append(close, header, createBody(model, translate, handlers))
  return overlay
}

/** Shows another fun fact in an open guest view. */
export function updateGuestOverlayFact(overlay: HTMLElement, text: string): void {
  updateProfileFact(overlay, text)
}
