// noinspection JSVoidFunctionReturnValueUsed,JSUnusedGlobalSymbols

// Default import preserves static methods on MagicMirror's CommonJS NodeHelper class.
import NodeHelper from 'node_helper'
import * as Log from 'logger'
import { SocketNotification } from '../constants/SocketNotifications'
import { hasApiBaseUrl, resolveConfig } from '../types/Config'
import {
  GuestProfileError,
  GuestProfileResponse,
  LiveStatsError,
  LiveStatsResponse,
  isGuestProfileRequest,
  isLiveStatsRequest,
} from '../types/Messages'
import { fetchGuestProfile } from './fetchGuestProfile'
import { fetchLiveStats } from './fetchLiveStats'
import { resolveLiveStatsAvatars, resolveProfileAvatars } from './resolveAvatars'

export default NodeHelper.create({
  start(): void {
    Log.debug(`${this.name} is started!`)
  },

  stop(): void {
    Log.debug(`${this.name} is stopped!`)
  },

  socketNotificationReceived(notification: string, request: unknown): void {
    if (notification === SocketNotification.LIVE_STATS_REQUEST) {
      if (!isLiveStatsRequest(request)) {
        Log.error(`${this.name} received an invalid live stats request`)
        return
      }
      void this.loadLiveStats(request.identifier, request.config)
    } else if (notification === SocketNotification.GUEST_PROFILE_REQUEST) {
      if (!isGuestProfileRequest(request)) {
        Log.error(`${this.name} received an invalid guest profile request`)
        return
      }
      void this.loadGuestProfile(request.identifier, request.guestId, request.config)
    } else {
      Log.error(`${this.name} received unknown socket notification: '${notification}'`)
    }
  },

  async loadLiveStats(identifier: string, rawConfig: unknown): Promise<void> {
    const config = resolveConfig(rawConfig)
    if (!hasApiBaseUrl(config)) {
      this.sendError(identifier, 'apiBaseUrl is missing or not a valid http(s) url')
      return
    }
    try {
      const liveStats = await resolveLiveStatsAvatars(await fetchLiveStats(config), config)
      const payload: LiveStatsResponse = { identifier, liveStats, fetchedAt: Date.now() }
      this.sendSocketNotification(SocketNotification.LIVE_STATS_RESPONSE, payload)
    } catch (error) {
      this.sendError(identifier, error instanceof Error ? error.message : String(error))
    }
  },

  async loadGuestProfile(identifier: string, guestId: string, rawConfig: unknown): Promise<void> {
    const config = resolveConfig(rawConfig)
    if (!hasApiBaseUrl(config)) {
      this.sendGuestProfileError(identifier, guestId, 'apiBaseUrl is missing or not a valid http(s) url')
      return
    }
    try {
      const profile = await resolveProfileAvatars(await fetchGuestProfile(guestId, config), config)
      const payload: GuestProfileResponse = { identifier, guestId, profile }
      this.sendSocketNotification(SocketNotification.GUEST_PROFILE_RESPONSE, payload)
    } catch (error) {
      this.sendGuestProfileError(identifier, guestId, error instanceof Error ? error.message : String(error))
    }
  },

  sendError(identifier: string, message: string): void {
    Log.error(`${this.name} could not load live stats: ${message}`)
    const payload: LiveStatsError = { identifier, message }
    this.sendSocketNotification(SocketNotification.LIVE_STATS_ERROR, payload)
  },

  sendGuestProfileError(identifier: string, guestId: string, message: string): void {
    Log.error(`${this.name} could not load guest profile: ${message}`)
    const payload: GuestProfileError = { identifier, guestId, message }
    this.sendSocketNotification(SocketNotification.GUEST_PROFILE_ERROR, payload)
  },
})
