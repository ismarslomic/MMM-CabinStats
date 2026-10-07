import { FrontendModule } from '../types/FrontendModule'
import * as Log from 'logger'
import { defaultConfig, hasApiBaseUrl, resolveConfig } from '../types/Config'
import { SocketNotification } from '../constants/SocketNotifications'
import { isLiveStatsError, isLiveStatsResponse, LiveStatsRequest } from '../types/Messages'
import { buildViewModel } from './viewModel'
import { TemplateData, toTemplateData } from './display'
import { clampIndex, interleaveGuestFacts, nextIndex } from './rotation'

const frontendModule: Omit<
  FrontendModule,
  'name' | 'identifier' | 'config' | 'file' | 'updateDom' | 'sendSocketNotification'
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
    } else {
      Log.error(`${this.name} received unknown socket notification: '${notificationIdentifier}'`)
    }
  },

  suspend(): void {
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
    // Guest facts are only shown for an ongoing reservation.
    if (!state || !liveStats?.isOccupied || !liveStats.currentReservation) return
    const length = interleaveGuestFacts(liveStats.guestFunFacts).length
    if (length <= 1) return
    state.guestFactIndex = nextIndex(state.guestFactIndex, length)
    this.updateDom(resolveConfig(this.config).animationSpeed)
  },

  rotateCabinFact(): void {
    const state = this.state
    const config = resolveConfig(this.config)
    if (!state?.liveStats || !config.showCabinFacts) return
    const length = state.liveStats.cabinFunFacts.length
    if (length <= 1) return
    state.cabinFactIndex = nextIndex(state.cabinFactIndex, length)
    this.updateDom(config.animationSpeed)
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
