import type { components } from './api.generated'

/** Response of the backend `GET /api/stats`, generated from the OpenAPI spec. */
export type LiveStats = components['schemas']['LiveStats']
/** Ongoing reservation, `null` when the cabin is not occupied. */
export type CurrentReservationInfo = components['schemas']['CurrentReservationInfo']
/** Next upcoming reservation, `null` when there is none. */
export type NextReservationInfo = components['schemas']['NextReservationInfo']
/** Visit statistics and flags for one guest of a reservation. */
export type LiveGuestStats = components['schemas']['LiveGuestStats']
/** Guest visit statistics for one period (the current year or all years). */
export type GuestPeriodStats = components['schemas']['GuestPeriodStats']
/** Ready-to-display fun fact about a guest, the group or the cabin. */
export type FunFact = components['schemas']['FunFact']

type UnknownRecord = Record<string, unknown>

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

/** `YYYY-MM-DD` that is also a real calendar date (rejects `2026-02-31`). */
function isIsoDate(value: unknown): value is string {
  if (!isString(value) || !ISO_DATE.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

/** The backend sends explicit `null` for absent values, but the spec leaves them out of `required`. */
function isOptional(value: unknown, isValid: (value: unknown) => boolean): boolean {
  return value === undefined || value === null || isValid(value)
}

function isArrayOf(value: unknown, isValid: (item: unknown) => boolean): boolean {
  return Array.isArray(value) && value.every(isValid)
}

function isGuestPeriodStats(value: unknown): value is GuestPeriodStats {
  return (
    isRecord(value) &&
    isNumber(value.totalVisits) &&
    isNumber(value.totalDays) &&
    isOptional(value.visitsRank, isNumber) &&
    isOptional(value.daysRank, isNumber)
  )
}

function isLiveGuestStats(value: unknown): value is LiveGuestStats {
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
    isArrayOf(value.guests, isLiveGuestStats) &&
    isNumber(value.remainingNights)
  )
}

function isNextReservation(value: unknown): boolean {
  return (
    isRecord(value) &&
    isIsoDate(value.startDate) &&
    isIsoDate(value.endDate) &&
    isArrayOf(value.guests, isLiveGuestStats) &&
    isNumber(value.daysUntil)
  )
}

function isFunFact(value: unknown): value is FunFact {
  return isRecord(value) && isOptional(value.guestId, isString) && isString(value.text) && isNumber(value.priority)
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
