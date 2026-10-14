import type { components } from './api.generated'
import { isArrayOf, isIsoDate, isNumber, isRecord, isString } from './guards'
import { isFunFact, isGuestStats } from './LiveStats'

/** Response of the backend `GET /api/stats/guests/{guestId}`, generated from the OpenAPI spec. */
export type GuestProfileStats = components['schemas']['GuestProfileStats']
/** One visit of a guest: historical, ongoing or upcoming. */
export type GuestVisit = components['schemas']['GuestVisit']
/** Where a visit stands today. */
export type GuestVisitStatus = GuestVisit['status']

const visitStatuses: readonly GuestVisitStatus[] = ['COMPLETED', 'ONGOING', 'UPCOMING']

function isGuestVisit(value: unknown): value is GuestVisit {
  return (
    isRecord(value) &&
    isIsoDate(value.startDate) &&
    isIsoDate(value.endDate) &&
    isNumber(value.days) &&
    isNumber(value.nights) &&
    isString(value.status) &&
    visitStatuses.some((status) => status === value.status)
  )
}

/**
 * Type guard for {@link GuestProfileStats}. The payload crosses a runtime boundary (backend response), so every
 * field the module reads is checked.
 */
export function isGuestProfileStats(value: unknown): value is GuestProfileStats {
  return (
    isRecord(value) &&
    isGuestStats(value.guest) &&
    isArrayOf(value.visits, isGuestVisit) &&
    isArrayOf(value.funFacts, isFunFact)
  )
}
