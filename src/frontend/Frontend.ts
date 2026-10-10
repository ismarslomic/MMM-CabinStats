import { FrontendModule } from '../types/FrontendModule'
import * as Log from 'logger'
import { defaultConfig, hasApiBaseUrl, resolveConfig } from '../types/Config'
import { SocketNotification } from '../constants/SocketNotifications'
import {
  GuestStatsRequest,
  isGuestStatsError,
  isGuestStatsResponse,
  isLiveStatsError,
  isLiveStatsResponse,
  LiveStatsRequest,
} from '../types/Messages'
import { buildViewModel } from './viewModel'
import { TemplateData, toTemplateData } from './display'
import { clampIndex, interleaveGuestFacts, nextIndex } from './rotation'
import { buildGuestOverlayModel, findGuest } from './guestView'
import { createGuestOverlay } from './guestOverlay'

const frontendModule: Omit<
  FrontendModule,
  'name' | 'identifier' | 'config' | 'file' | 'translate' | 'updateDom' | 'sendSocketNotification'
> &
  ThisType<FrontendModule> = {
  defaults: defaultConfig,

  start(): void {
    Log.debug(`${this.name} is starting`)
    this.state = { guestFactIndex: 0, cabinFactIndex: 0 }

    const config = resolveConfig(this.config)
    if (!hasApiBaseUrl(config)) {
      Log.error(`${this.name} has no valid apiBaseUrl; set it to e.g. http://backend.example:8080`)
    }
    for (const option of Object.keys(config) as (keyof typeof config)[]) {
      if (option !== 'apiBaseUrl' && config[option] !== this.config[option]) {
        Log.error(`${this.name} has an invalid ${option}; using ${config[option]}`)
      }
    }

    this.loadData()
    this.startPolling()
    this.startRotation()
    this.updateDom()
  },

  notificationReceived(notification: string): void {
    // The avatars are re-created on every render, so one delegated listener on the document serves them all.
    if (notification === 'DOM_OBJECTS_CREATED' && !this.documentClickHandler) {
      this.documentClickHandler = (event: MouseEvent) => {
        const avatar =
          event.target instanceof Element ? event.target.closest<HTMLElement>('[data-cabin-guest-id]') : null
        // Several instances share the page: only react to the avatars of this one.
        if (avatar?.closest('.module')?.id !== this.identifier) return
        const guestId = avatar.dataset.cabinGuestId
        if (guestId) this.openGuestView(guestId)
      }
      document.addEventListener('click', this.documentClickHandler)
    }
  },

  getStyles() {
    return [this.file('css/MMM-CabinStats.css')]
  },

  getTemplate(): string {
    return 'templates/MMM-CabinStats.njk'
  },

  getTemplateData(): TemplateData {
    return toTemplateData(
      buildViewModel({
        config: resolveConfig(this.config),
        liveStats: this.state?.liveStats,
        guestFactIndex: this.state?.guestFactIndex ?? 0,
        cabinFactIndex: this.state?.cabinFactIndex ?? 0,
      })
    )
  },

  getTranslations(): Record<string, string> {
    // Norwegian only: listing it as the single entry also makes it the fallback for every other language.
    return { nb: 'translations/nb.json' }
  },

  socketNotificationReceived(notificationIdentifier: string, payload: unknown): void {
    if (notificationIdentifier === SocketNotification.LIVE_STATS_RESPONSE) {
      if (!isLiveStatsResponse(payload)) {
        Log.error(`${this.name} received an invalid live stats response`)
        return
      }
      // The helper broadcasts to every instance of this module type.
      if (payload.identifier !== this.identifier) {
        return
      }
      Log.debug(`${this.name} received live stats fetched at ${payload.fetchedAt}`)
      const previous = this.state
      const guestFacts = interleaveGuestFacts(payload.liveStats.guestFunFacts)
      this.state = {
        liveStats: payload.liveStats,
        fetchedAt: payload.fetchedAt,
        guestFactIndex: clampIndex(previous?.guestFactIndex ?? 0, guestFacts.length),
        cabinFactIndex: clampIndex(previous?.cabinFactIndex ?? 0, payload.liveStats.cabinFunFacts.length),
      }
      this.startRotation()
      this.updateDom(resolveConfig(this.config).animationSpeed)
    } else if (notificationIdentifier === SocketNotification.LIVE_STATS_ERROR) {
      if (!isLiveStatsError(payload)) {
        Log.error(`${this.name} received an invalid live stats error`)
        return
      }
      if (payload.identifier !== this.identifier) {
        return
      }
      // Keep showing the last good data; the helper has already logged the details.
      Log.error(`${this.name} could not load live stats: ${payload.message}`)
    } else if (notificationIdentifier === SocketNotification.GUEST_STATS_RESPONSE) {
      if (!isGuestStatsResponse(payload)) {
        Log.error(`${this.name} received an invalid guest stats response`)
        return
      }
      this.finishGuestStats(payload.identifier, payload.guestId, 'loaded')
    } else if (notificationIdentifier === SocketNotification.GUEST_STATS_ERROR) {
      if (!isGuestStatsError(payload)) {
        Log.error(`${this.name} received an invalid guest stats error`)
        return
      }
      if (payload.identifier === this.identifier) {
        Log.error(`${this.name} could not load guest stats: ${payload.message}`)
      }
      this.finishGuestStats(payload.identifier, payload.guestId, 'error')
    } else {
      Log.error(`${this.name} received unknown socket notification: '${notificationIdentifier}'`)
    }
  },

  suspend(): void {
    this.closeGuestView()
    if (this.config.pauseWhenHidden) {
      this.isPollingSuspended = true
      this.stopPolling()
      this.stopRotation()
    }
  },

  resume(): void {
    // Repeated show calls must not create extra timers or requests.
    if (this.config.pauseWhenHidden && this.isPollingSuspended) {
      this.isPollingSuspended = false
      this.loadData()
      this.startPolling()
      this.startRotation()
    }
  },

  startPolling(): void {
    this.stopPolling()
    const config = resolveConfig(this.config)
    if (this.isPollingSuspended || !hasApiBaseUrl(config)) {
      return
    }
    this.pollingTimer = setInterval(() => {
      this.loadData()
    }, config.updateInterval)
  },

  stopPolling(): void {
    if (this.pollingTimer !== undefined) {
      clearInterval(this.pollingTimer)
      this.pollingTimer = undefined
    }
  },

  startRotation(): void {
    this.stopRotation()
    const config = resolveConfig(this.config)
    if (this.isPollingSuspended || !hasApiBaseUrl(config)) {
      return
    }
    this.guestFactTimer = setInterval(() => {
      this.rotateGuestFact()
    }, config.guestFactInterval)
    this.cabinFactTimer = setInterval(() => {
      this.rotateCabinFact()
    }, config.cabinFactInterval)
  },

  stopRotation(): void {
    if (this.guestFactTimer !== undefined) {
      clearInterval(this.guestFactTimer)
      this.guestFactTimer = undefined
    }
    if (this.cabinFactTimer !== undefined) {
      clearInterval(this.cabinFactTimer)
      this.cabinFactTimer = undefined
    }
  },

  rotateGuestFact(): void {
    const state = this.state
    const liveStats = state?.liveStats
    // Guest facts are only shown for an ongoing reservation, and not at all by a `stats` instance.
    if (
      resolveConfig(this.config).display === 'stats' ||
      !state ||
      !liveStats?.isOccupied ||
      !liveStats.currentReservation
    )
      return
    const length = interleaveGuestFacts(liveStats.guestFunFacts).length
    if (length <= 1) return
    state.guestFactIndex = nextIndex(state.guestFactIndex, length)
    this.updateDom(resolveConfig(this.config).animationSpeed)
  },

  rotateCabinFact(): void {
    const state = this.state
    const config = resolveConfig(this.config)
    if (!state?.liveStats || !config.showCabinFacts || config.display === 'stats') return
    const length = state.liveStats.cabinFunFacts.length
    if (length <= 1) return
    state.cabinFactIndex = nextIndex(state.cabinFactIndex, length)
    this.updateDom(config.animationSpeed)
  },

  openGuestView(guestId: string): void {
    const config = resolveConfig(this.config)
    const guest = findGuest(this.state?.liveStats, guestId)
    if (!this.state || !config.guestView || !hasApiBaseUrl(config) || !guest) return

    this.state.guestView = { guest, status: 'loading' }
    this.documentKeyHandler ??= (event: KeyboardEvent) => {
      if (event.key === 'Escape') this.closeGuestView()
    }
    document.addEventListener('keydown', this.documentKeyHandler)
    this.renderGuestView()
    this.startGuestViewTimeout()
    this.requestGuestStats(guestId)
  },

  closeGuestView(): void {
    clearTimeout(this.guestViewTimer)
    this.guestViewTimer = undefined
    if (this.documentKeyHandler) {
      document.removeEventListener('keydown', this.documentKeyHandler)
      this.documentKeyHandler = undefined
    }
    this.guestOverlay?.remove()
    this.guestOverlay = undefined
    if (this.state) this.state.guestView = undefined
  },

  renderGuestView(): void {
    const guestView = this.state?.guestView
    if (!guestView) return
    const overlay = createGuestOverlay(
      buildGuestOverlayModel(guestView.guest, resolveConfig(this.config).apiBaseUrl, guestView.status),
      (key, variables) => this.translate(key, variables),
      {
        onClose: () => this.closeGuestView(),
        onRetry: () => {
          guestView.status = 'loading'
          this.renderGuestView()
          this.requestGuestStats(guestView.guest.guestId)
        },
        onActivity: () => this.startGuestViewTimeout(),
      }
    )
    if (this.guestOverlay) {
      this.guestOverlay.replaceWith(overlay)
    } else {
      document.body.append(overlay)
    }
    this.guestOverlay = overlay
    overlay.querySelector<HTMLElement>('.cabin-overlay-close')?.focus()
  },

  startGuestViewTimeout(): void {
    clearTimeout(this.guestViewTimer)
    this.guestViewTimer = setTimeout(() => {
      this.closeGuestView()
    }, resolveConfig(this.config).guestViewTimeout)
  },

  requestGuestStats(guestId: string): void {
    const request: GuestStatsRequest = { identifier: this.identifier, guestId, config: this.config }
    this.sendSocketNotification(SocketNotification.GUEST_STATS_REQUEST, request)
  },

  finishGuestStats(identifier: string, guestId: string, status: 'loaded' | 'error'): void {
    // The helper broadcasts to every instance of this module type. A reply for a view that was closed or switched
    // to another guest in the meantime is stale.
    const guestView = this.state?.guestView
    if (identifier !== this.identifier || guestView?.guest.guestId !== guestId || guestView.status !== 'loading') return
    guestView.status = status
    this.renderGuestView()
  },

  loadData(): void {
    const config = resolveConfig(this.config)
    if (!hasApiBaseUrl(config)) {
      return
    }
    Log.debug(`${this.name} is loading data`)
    const request: LiveStatsRequest = { identifier: this.identifier, config: this.config }
    this.sendSocketNotification(SocketNotification.LIVE_STATS_REQUEST, request)
  },
}

Module.register('MMM-CabinStats', frontendModule)
