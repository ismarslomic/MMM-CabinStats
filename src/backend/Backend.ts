// noinspection JSVoidFunctionReturnValueUsed,JSUnusedGlobalSymbols

// Default import preserves static methods on MagicMirror's CommonJS NodeHelper class.
import NodeHelper from 'node_helper'
import * as Log from 'logger'
import { SocketNotification } from '../constants/SocketNotifications'
import { hasApiBaseUrl, resolveConfig } from '../types/Config'
import {
  GuestStatsError,
  GuestStatsResponse,
  LiveStatsError,
  LiveStatsResponse,
  isGuestStatsRequest,
  isLiveStatsRequest,
} from '../types/Messages'
import { fetchGuestStats } from './fetchGuestStats'
import { fetchLiveStats } from './fetchLiveStats'

export default NodeHelper.create({
  /**
   * TEMPORARY: reply to guest stats requests with an empty object without calling the backend, until
   * `GET /api/stats/guests/{guestId}` is implemented there. Set to `false` to fetch for real.
   */
  useMockGuestStats: true,

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
    } else if (notification === SocketNotification.GUEST_STATS_REQUEST) {
      if (!isGuestStatsRequest(request)) {
        Log.error(`${this.name} received an invalid guest stats request`)
        return
      }
      void this.loadGuestStats(request.identifier, request.guestId, request.config)
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
      const liveStats = await fetchLiveStats(config)
      const payload: LiveStatsResponse = { identifier, liveStats, fetchedAt: Date.now() }
      this.sendSocketNotification(SocketNotification.LIVE_STATS_RESPONSE, payload)
    } catch (error) {
      this.sendError(identifier, error instanceof Error ? error.message : String(error))
    }
  },

  async loadGuestStats(identifier: string, guestId: string, rawConfig: unknown): Promise<void> {
    const config = resolveConfig(rawConfig)
    if (!hasApiBaseUrl(config)) {
      this.sendGuestStatsError(identifier, guestId, 'apiBaseUrl is missing or not a valid http(s) url')
      return
    }
    try {
      const guestStats = this.useMockGuestStats ? {} : await fetchGuestStats(guestId, config)
      const payload: GuestStatsResponse = { identifier, guestId, guestStats }
      this.sendSocketNotification(SocketNotification.GUEST_STATS_RESPONSE, payload)
    } catch (error) {
      this.sendGuestStatsError(identifier, guestId, error instanceof Error ? error.message : String(error))
    }
  },

  sendError(identifier: string, message: string): void {
    Log.error(`${this.name} could not load live stats: ${message}`)
    const payload: LiveStatsError = { identifier, message }
    this.sendSocketNotification(SocketNotification.LIVE_STATS_ERROR, payload)
  },

  sendGuestStatsError(identifier: string, guestId: string, message: string): void {
    Log.error(`${this.name} could not load guest stats: ${message}`)
    const payload: GuestStatsError = { identifier, guestId, message }
    this.sendSocketNotification(SocketNotification.GUEST_STATS_ERROR, payload)
  },
})
