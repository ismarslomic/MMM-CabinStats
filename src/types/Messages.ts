import { Config } from './Config'
import { isLiveStats, LiveStats } from './LiveStats'

/** Socket payload sent from the frontend to the node helper to request fresh live stats. */
export type LiveStatsRequest = {
  /** Identifier of the requesting module instance, echoed back so the instance can recognise the reply. */
  identifier: string
  /** Configuration of the requesting module instance. The helper validates it again with `resolveConfig`. */
  config: Config
}

/** Socket payload sent from the node helper to the frontend with the validated backend response. */
export type LiveStatsResponse = {
  /** Identifier of the module instance that made the request. */
  identifier: string
  /** The validated response of `GET /api/stats`. */
  liveStats: LiveStats
  /** When the stats were fetched, as a Unix timestamp in milliseconds. */
  fetchedAt: number
}

/** Socket payload sent from the node helper to the frontend when the stats could not be fetched. */
export type LiveStatsError = {
  /** Identifier of the module instance that made the request. */
  identifier: string
  /** Short description of what went wrong, for logging. Never shown on the mirror. */
  message: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Type guard for {@link LiveStatsRequest}. Only `identifier` and the presence of a `config` object are checked;
 * the config content is validated by `resolveConfig`.
 */
export function isLiveStatsRequest(payload: unknown): payload is LiveStatsRequest {
  return isRecord(payload) && typeof payload.identifier === 'string' && isRecord(payload.config)
}

/** Type guard for {@link LiveStatsResponse}: string `identifier`, finite `fetchedAt` and a valid `liveStats`. */
export function isLiveStatsResponse(payload: unknown): payload is LiveStatsResponse {
  return (
    isRecord(payload) &&
    typeof payload.identifier === 'string' &&
    typeof payload.fetchedAt === 'number' &&
    Number.isFinite(payload.fetchedAt) &&
    isLiveStats(payload.liveStats)
  )
}

/** Type guard for {@link LiveStatsError}. */
export function isLiveStatsError(payload: unknown): payload is LiveStatsError {
  return isRecord(payload) && typeof payload.identifier === 'string' && typeof payload.message === 'string'
}
