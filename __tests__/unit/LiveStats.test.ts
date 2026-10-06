import { describe, expect, test } from 'vitest'
import { isLiveStats, type LiveStats } from '../../src/types/LiveStats'
import occupiedMixed from '../fixtures/occupied-mixed.json'
import occupiedFamilyOnly from '../fixtures/occupied-family-only.json'
import notOccupiedNext from '../fixtures/not-occupied-next.json'
import notOccupiedNoNext from '../fixtures/not-occupied-no-next.json'
import guestWithoutAvatar from '../fixtures/guest-without-avatar.json'

/** Untyped JSON the tests break on purpose; the guard under test must cope with anything. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any

// Typing the fixtures with LiveStats makes a contract change break compilation.
const valid = {
  'occupied-mixed': occupiedMixed,
  'occupied-family-only': occupiedFamilyOnly,
  'not-occupied-next': notOccupiedNext,
  'not-occupied-no-next': notOccupiedNoNext,
  'guest-without-avatar': guestWithoutAvatar,
} satisfies Record<string, LiveStats>

/** Deep copy of a valid fixture that the test can break without affecting other tests. */
function mutated(change: (stats: Json) => void): unknown {
  const copy = structuredClone(occupiedMixed) as Json
  change(copy)
  return copy
}

describe('isLiveStats', () => {
  test.each(Object.entries(valid))('accepts fixture %s', (_name, fixture) => {
    expect(isLiveStats(fixture)).toBe(true)
  })

  test('accepts missing nullable fields as well as null', () => {
    const payload = mutated((s) => {
      delete s.nextReservation
      delete s.currentReservation.guests[0].avatarUrl
      delete s.currentReservation.guests[0].allTime.visitsRank
      delete s.guestFunFacts[0].guestId
    })
    expect(isLiveStats(payload)).toBe(true)
  })

  test.each([null, undefined, 'text', 42, [], {}])('rejects non-object or empty payload %j', (payload) => {
    expect(isLiveStats(payload)).toBe(false)
  })

  test.each([
    ['missing isOccupied', (s: Json) => delete s.isOccupied],
    ['isOccupied as string', (s: Json) => (s.isOccupied = 'true')],
    ['missing allTimeVisits', (s: Json) => delete s.allTimeVisits],
    ['allTimeNights as string', (s: Json) => (s.allTimeNights = '300')],
    ['allTimeUniqueGuests is NaN', (s: Json) => (s.allTimeUniqueGuests = Number.NaN)],
    ['missing guestFunFacts', (s: Json) => delete s.guestFunFacts],
    ['cabinFunFacts not an array', (s: Json) => (s.cabinFunFacts = {})],
    ['fun fact without text', (s: Json) => delete s.cabinFunFacts[0].text],
    ['fun fact priority as string', (s: Json) => (s.guestFunFacts[0].priority = 'high')],
    ['fun fact guestId as number', (s: Json) => (s.guestFunFacts[0].guestId = 1)],
    ['currentReservation as string', (s: Json) => (s.currentReservation = 'none')],
    ['reservation without guests', (s: Json) => delete s.currentReservation.guests],
    ['reservation bad date format', (s: Json) => (s.currentReservation.startDate = '04.10.2026')],
    ['reservation impossible date', (s: Json) => (s.currentReservation.endDate = '2026-02-31')],
    ['missing remainingNights', (s: Json) => delete s.currentReservation.remainingNights],
    ['next reservation missing daysUntil', (s: Json) => delete s.nextReservation.daysUntil],
    ['guest without guestId', (s: Json) => delete s.currentReservation.guests[0].guestId],
    ['guest isFamily as string', (s: Json) => (s.currentReservation.guests[0].isFamily = 'yes')],
    ['guest avatarUrl as number', (s: Json) => (s.currentReservation.guests[0].avatarUrl = 1)],
    ['guest bad firstVisitDate', (s: Json) => (s.currentReservation.guests[0].firstVisitDate = 'x')],
    ['guest yearsVisited with string', (s: Json) => (s.currentReservation.guests[0].yearsVisited = ['a'])],
    ['guest without allTime', (s: Json) => delete s.currentReservation.guests[0].allTime],
    ['allTime totalVisits as string', (s: Json) => (s.currentReservation.guests[0].allTime.totalVisits = '1')],
    ['currentYear visitsRank as string', (s: Json) => (s.currentReservation.guests[0].currentYear.visitsRank = '1')],
  ])('rejects %s', (_name, change) => {
    expect(isLiveStats(mutated(change))).toBe(false)
  })
})
