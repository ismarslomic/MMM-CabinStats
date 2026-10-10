import { Config } from './Config'
import { GuestDetailStats, isGuestDetailStats } from './GuestDetailStats'
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

/** Socket payload sent from the frontend to the node helper to request the stats of one guest. */
export type GuestStatsRequest = LiveStatsRequest & {
  /** The guest to fetch stats for. */
  guestId: string
}

/** Socket payload sent from the node helper to the frontend with the validated guest stats. */
export type GuestStatsResponse = {
  /** Identifier of the module instance that made the request. */
  identifier: string
  /** The guest the stats belong to, echoed back so the instance can recognise the reply. */
  guestId: string
  /** The validated response of `GET /api/stats/guests/{guestId}`. */
  guestStats: GuestDetailStats
}

/** Socket payload sent from the node helper to the frontend when the guest stats could not be fetched. */
export type GuestStatsError = {
  /** Identifier of the module instance that made the request. */
  identifier: string
  /** The guest the request was for. */
  guestId: string
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

/** Type guard for {@link GuestStatsRequest}: a valid {@link LiveStatsRequest} plus a non-empty `guestId`. */
export function isGuestStatsRequest(payload: unknown): payload is GuestStatsRequest {
  return (
    isLiveStatsRequest(payload) && 'guestId' in payload && typeof payload.guestId === 'string' && payload.guestId !== ''
  )
}

/** Type guard for {@link GuestStatsResponse}. */
export function isGuestStatsResponse(payload: unknown): payload is GuestStatsResponse {
  return (
    isRecord(payload) &&
    typeof payload.identifier === 'string' &&
    typeof payload.guestId === 'string' &&
    isGuestDetailStats(payload.guestStats)
  )
}

/** Type guard for {@link GuestStatsError}. */
export function isGuestStatsError(payload: unknown): payload is GuestStatsError {
  return (
    isRecord(payload) &&
    typeof payload.identifier === 'string' &&
    typeof payload.guestId === 'string' &&
    typeof payload.message === 'string'
  )
}
