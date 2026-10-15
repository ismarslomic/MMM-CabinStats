import type { components } from './api.generated'
import { isArrayOf, isIsoDate, isNumber, isOptional, isRecord, isString } from './guards'

/** Response of the backend `GET /api/stats`, generated from the OpenAPI spec. */
export type LiveStats = components['schemas']['LiveStats']
/** Ongoing reservation, `null` when the cabin is not occupied. */
export type CurrentReservationInfo = components['schemas']['CurrentReservationInfo']
/** Next upcoming reservation, `null` when there is none. */
export type NextReservationInfo = components['schemas']['NextReservationInfo']
/** Visit statistics and flags for one guest of a reservation. */
export type GuestStats = components['schemas']['GuestStats']
/** Guest visit statistics for one period (the current year or all years). */
export type GuestPeriodStats = components['schemas']['GuestPeriodStats']
/** Ready-to-display fun fact about a guest, the group or the cabin. */
export type FunFact = components['schemas']['FunFact']
/** A part of a {@link FunFact} text, so the part can be highlighted. */
export type FactSegment = components['schemas']['FactSegment']

function isGuestPeriodStats(value: unknown): value is GuestPeriodStats {
  return (
    isRecord(value) &&
    isNumber(value.totalVisits) &&
    isNumber(value.totalDays) &&
    isNumber(value.totalNights) &&
    isOptional(value.visitsRank, isNumber) &&
    isOptional(value.daysRank, isNumber) &&
    isOptional(value.visitsRankAmongGuests, isNumber) &&
    isOptional(value.daysRankAmongGuests, isNumber)
  )
}

/** Type guard for {@link GuestStats}. */
export function isGuestStats(value: unknown): value is GuestStats {
  return (
    isRecord(value) &&
    isString(value.guestId) &&
    isString(value.firstName) &&
    isString(value.lastName) &&
    isNumber(value.age) &&
    typeof value.isFamily === 'boolean' &&
    isOptional(value.avatarUrl, isString) &&
    typeof value.isFirstVisit === 'boolean' &&
    isOptional(value.firstVisitDate, isIsoDate) &&
    isOptional(value.lastVisitDate, isIsoDate) &&
    isArrayOf(value.yearsVisited, isNumber) &&
    isGuestPeriodStats(value.currentYear) &&
    isGuestPeriodStats(value.allTime)
  )
}

function isCurrentReservation(value: unknown): boolean {
  return (
    isRecord(value) &&
    isIsoDate(value.startDate) &&
    isIsoDate(value.endDate) &&
    isArrayOf(value.guests, isGuestStats) &&
    isNumber(value.remainingNights)
  )
}

function isNextReservation(value: unknown): boolean {
  return (
    isRecord(value) &&
    isIsoDate(value.startDate) &&
    isIsoDate(value.endDate) &&
    isArrayOf(value.guests, isGuestStats) &&
    isNumber(value.daysUntil)
  )
}

/** Type guard for {@link FactSegment}. Any string is accepted as `kind`: the backend may add kinds later. */
export function isFactSegment(value: unknown): value is FactSegment {
  return isRecord(value) && isString(value.text) && isOptional(value.kind, isString)
}

/** Type guard for {@link FunFact}. */
export function isFunFact(value: unknown): value is FunFact {
  return (
    isRecord(value) &&
    isOptional(value.guestId, isString) &&
    isString(value.text) &&
    isNumber(value.priority) &&
    isOptional(value.segments, (segments) => isArrayOf(segments, isFactSegment))
  )
}

/**
 * Type guard for {@link LiveStats}. The payload crosses a runtime boundary (backend response), which TypeScript
 * cannot validate. Every field the module reads is checked. Nullable fields accept `null` and a missing key.
 */
export function isLiveStats(payload: unknown): payload is LiveStats {
  return (
    isRecord(payload) &&
    typeof payload.isOccupied === 'boolean' &&
    isOptional(payload.currentReservation, isCurrentReservation) &&
    isOptional(payload.nextReservation, isNextReservation) &&
    isNumber(payload.allTimeVisits) &&
    isNumber(payload.allTimeNights) &&
    isNumber(payload.allTimeUniqueGuests) &&
    isArrayOf(payload.guestFunFacts, isFunFact) &&
    isArrayOf(payload.cabinFunFacts, isFunFact) &&
    isArrayOf(payload.nextVisitFunFacts, isFunFact)
  )
}
