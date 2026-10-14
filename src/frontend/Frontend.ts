import { FrontendModule } from '../types/FrontendModule'
import * as Log from 'logger'
import { defaultConfig, hasApiBaseUrl, resolveConfig } from '../types/Config'
import { SocketNotification } from '../constants/SocketNotifications'
import {
  GuestProfileRequest,
  isGuestProfileError,
  isGuestProfileResponse,
  isLiveStatsError,
  isLiveStatsResponse,
  LiveStatsRequest,
} from '../types/Messages'
import { buildViewModel } from './viewModel'
import { TemplateData, toTemplateData } from './display'
import { clampIndex, nextIndex, rotatingGuestFacts } from './rotation'
import { buildGuestOverlayModel, findGuest } from './guestView'
import { createGuestOverlay, updateGuestOverlayFact } from './guestOverlay'
import { yearMonthOf } from './guestProfile'
import { GuestProfileStats } from '../types/GuestProfileStats'

const frontendModule: Omit<
  FrontendModule,
  'name' | 'identifier' | 'config' | 'file' | 'nunjucksEnvironment' | 'updateDom' | 'sendSocketNotification'
> &
  ThisType<FrontendModule> = {
  defaults: defaultConfig,
  guestViewRenderCount: 0,

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
      const guestFacts = rotatingGuestFacts(payload.liveStats, resolveConfig(this.config).showNextVisit)
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
    } else if (notificationIdentifier === SocketNotification.GUEST_PROFILE_RESPONSE) {
      if (!isGuestProfileResponse(payload)) {
        Log.error(`${this.name} received an invalid guest profile response`)
        return
      }
      this.finishGuestProfile(payload.identifier, payload.guestId, 'loaded', payload.profile)
    } else if (notificationIdentifier === SocketNotification.GUEST_PROFILE_ERROR) {
      if (!isGuestProfileError(payload)) {
        Log.error(`${this.name} received an invalid guest profile error`)
        return
      }
      if (payload.identifier === this.identifier) {
        Log.error(`${this.name} could not load guest profile: ${payload.message}`)
      }
      this.finishGuestProfile(payload.identifier, payload.guestId, 'error')
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
    const config = resolveConfig(this.config)
    // A `stats` instance shows no facts.
    if (!state?.liveStats || config.display === 'stats') return
    const length = rotatingGuestFacts(state.liveStats, config.showNextVisit).length
    if (length <= 1) return
    state.guestFactIndex = nextIndex(state.guestFactIndex, length)
    this.updateDom(config.animationSpeed)
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

    this.state.guestView = { guest, status: 'loading', factIndex: 0 }
    this.documentKeyHandler ??= (event: KeyboardEvent) => {
      if (event.key === 'Escape') this.closeGuestView()
    }
    document.addEventListener('keydown', this.documentKeyHandler)
    this.renderGuestView()
    this.startGuestViewTimeout()
    this.requestGuestProfile(guestId)
  },

  closeGuestView(): void {
    clearTimeout(this.guestViewTimer)
    this.guestViewTimer = undefined
    this.stopGuestViewFactRotation()
    if (this.documentKeyHandler) {
      document.removeEventListener('keydown', this.documentKeyHandler)
      this.documentKeyHandler = undefined
    }
    this.guestViewRenderCount++
    this.guestOverlay?.remove()
    this.guestOverlay = undefined
    if (this.state) this.state.guestView = undefined
  },

  renderGuestView(): void {
    const guestView = this.state?.guestView
    if (!guestView) return
    const renderId = ++this.guestViewRenderCount
    const model = buildGuestOverlayModel(guestView, resolveConfig(this.config).apiBaseUrl, yearMonthOf(new Date()))

    this.nunjucksEnvironment().render('templates/guest-view.njk', model, (error, html) => {
      // The view may have been closed, or rendered again, while the template was loading.
      if (renderId !== this.guestViewRenderCount || this.state?.guestView !== guestView) return
      if (error || html === null) {
        Log.error(`${this.name} could not render the guest view: ${error?.message ?? 'no output'}`)
        return
      }
      const overlay = createGuestOverlay(html, {
        onClose: () => this.closeGuestView(),
        onRetry: () => {
          this.stopGuestViewFactRotation()
          guestView.status = 'loading'
          guestView.profile = undefined
          guestView.factIndex = 0
          this.renderGuestView()
          this.requestGuestProfile(guestView.guest.guestId)
        },
        onActivity: () => this.startGuestViewTimeout(),
      })
      if (this.guestOverlay) {
        this.guestOverlay.replaceWith(overlay)
      } else {
        document.body.append(overlay)
      }
      this.guestOverlay = overlay
      overlay.querySelector<HTMLElement>('.cabin-overlay-close')?.focus()
    })
  },

  startGuestViewTimeout(): void {
    clearTimeout(this.guestViewTimer)
    this.guestViewTimer = setTimeout(() => {
      this.closeGuestView()
    }, resolveConfig(this.config).guestViewTimeout)
  },

  requestGuestProfile(guestId: string): void {
    const request: GuestProfileRequest = { identifier: this.identifier, guestId, config: this.config }
    this.sendSocketNotification(SocketNotification.GUEST_PROFILE_REQUEST, request)
  },

  finishGuestProfile(
    identifier: string,
    guestId: string,
    status: 'loaded' | 'error',
    profile?: GuestProfileStats
  ): void {
    // The helper broadcasts to every instance of this module type. A reply for a view that was closed or switched
    // to another guest in the meantime is stale.
    const guestView = this.state?.guestView
    if (identifier !== this.identifier || guestView?.guest.guestId !== guestId || guestView.status !== 'loading') return
    guestView.status = status
    guestView.profile = profile
    guestView.factIndex = 0
    this.renderGuestView()
    if (status === 'loaded') this.startGuestViewFactRotation()
  },

  startGuestViewFactRotation(): void {
    this.stopGuestViewFactRotation()
    if ((this.state?.guestView?.profile?.funFacts.length ?? 0) <= 1) return
    this.guestViewFactTimer = setInterval(() => {
      this.rotateGuestViewFact()
    }, resolveConfig(this.config).guestViewFactInterval)
  },

  stopGuestViewFactRotation(): void {
    clearInterval(this.guestViewFactTimer)
    this.guestViewFactTimer = undefined
  },

  rotateGuestViewFact(): void {
    const guestView = this.state?.guestView
    const facts = guestView?.profile?.funFacts
    if (!guestView || !facts || facts.length <= 1 || !this.guestOverlay) return
    guestView.factIndex = nextIndex(guestView.factIndex, facts.length)
    updateGuestOverlayFact(this.guestOverlay, facts[guestView.factIndex].text)
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
