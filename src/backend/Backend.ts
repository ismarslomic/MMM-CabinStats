// noinspection JSVoidFunctionReturnValueUsed,JSUnusedGlobalSymbols

// Default import preserves static methods on MagicMirror's CommonJS NodeHelper class.
import NodeHelper from 'node_helper'
import * as Log from 'logger'
import { SocketNotification } from '../constants/SocketNotifications'
import { hasApiBaseUrl, resolveConfig } from '../types/Config'
import { LiveStatsError, LiveStatsResponse, isLiveStatsRequest } from '../types/Messages'
import { fetchLiveStats } from './fetchLiveStats'

export default NodeHelper.create({
  start(): void {
    Log.debug(`${this.name} is started!`)
  },

  stop(): void {
    Log.debug(`${this.name} is stopped!`)
  },

  socketNotificationReceived(notification: string, request: unknown): void {
    if (notification !== SocketNotification.LIVE_STATS_REQUEST) {
      Log.error(`${this.name} received unknown socket notification: '${notification}'`)
      return
    }
    if (!isLiveStatsRequest(request)) {
      Log.error(`${this.name} received an invalid live stats request`)
      return
    }
    void this.loadLiveStats(request.identifier, request.config)
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

  sendError(identifier: string, message: string): void {
    Log.error(`${this.name} could not load live stats: ${message}`)
    const payload: LiveStatsError = { identifier, message }
    this.sendSocketNotification(SocketNotification.LIVE_STATS_ERROR, payload)
  },
})
