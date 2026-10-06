import { describe, expect, test } from 'vitest'
import { avatarUrlFor, buildViewModel, ViewModelInput } from '../../src/frontend/viewModel'
import { defaultConfig } from '../../src/types/Config'
import { LiveStats } from '../../src/types/LiveStats'
import occupiedMixed from '../fixtures/occupied-mixed.json'
import occupiedFamilyOnly from '../fixtures/occupied-family-only.json'
import notOccupiedNext from '../fixtures/not-occupied-next.json'
import notOccupiedNoNext from '../fixtures/not-occupied-no-next.json'
import guestWithoutAvatar from '../fixtures/guest-without-avatar.json'

const config = { ...defaultConfig, apiBaseUrl: 'http://backend.example:8080' }

function build(liveStats: LiveStats | undefined, overrides: Partial<ViewModelInput> = {}) {
  return buildViewModel({ config, liveStats, guestFactIndex: 0, cabinFactIndex: 0, ...overrides })
}

describe('avatarUrlFor', () => {
  test.each([
    [
      'http://backend.example:8080',
      '/api/guests/guest-1/avatar',
      'http://backend.example:8080/api/guests/guest-1/avatar',
    ],
    [
      'http://backend.example:8080',
      'api/guests/guest-1/avatar',
      'http://backend.example:8080/api/guests/guest-1/avatar',
    ],
    ['http://backend.example:8080', null, null],
    ['http://backend.example:8080', undefined, null],
    ['http://backend.example:8080', '', null],
    [undefined, '/api/guests/guest-1/avatar', null],
  ])('%j + %j gives %j', (base, avatar, expected) => {
    expect(avatarUrlFor(base, avatar)).toBe(expected)
  })
})

describe('buildViewModel', () => {
  test('shows the config error without a valid apiBaseUrl, even with data', () => {
    for (const apiBaseUrl of [undefined, '', 'nonsense']) {
      const model = buildViewModel({
        config: { ...config, apiBaseUrl },
        liveStats: occupiedMixed,
        guestFactIndex: 0,
        cabinFactIndex: 0,
      })
      expect(model.view).toBe('config-error')
      expect(model.guests).toEqual([])
      expect(model.totals).toBeNull()
    }
  })

  test('is empty before the first response', () => {
    const model = build(undefined)
    expect(model.view).toBe('empty')
    expect(model.totals).toBeNull()
    expect(model.cabinFact).toBeNull()
  })

  test('passes the animation speed on', () => {
    expect(build(undefined, { config: { ...config, animationSpeed: 250 } }).animationSpeed).toBe(250)
  })

  describe('occupied', () => {
    test('maps the guests of the current reservation', () => {
      const model = build(occupiedMixed)
      expect(model.view).toBe('occupied')
      expect(model.stay).toEqual({ startDate: '2026-10-04', endDate: '2026-10-08', remainingNights: 2 })
      expect(model.guests).toEqual([
        {
          guestId: 'guest-1',
          firstName: 'Anna',
          avatarUrl: 'http://backend.example:8080/api/guests/guest-1/avatar',
          initials: 'AT',
          isFirstVisit: false,
          isTopVisitor: true,
          visitNumber: 14,
        },
        expect.objectContaining({ guestId: 'guest-2', isTopVisitor: false, visitNumber: 12 }),
        expect.objectContaining({ guestId: 'guest-3', isFirstVisit: true, isTopVisitor: false, visitNumber: 0 }),
      ])
    })

    test('falls back to initials for a guest without avatar', () => {
      const [guest] = build(guestWithoutAvatar).guests
      expect(guest.avatarUrl).toBeNull()
      expect(guest.initials).toBe('EE')
    })

    test('selects the guest fact by index in the interleaved order', () => {
      // Facts are for guest-1, guest-3 and the group, so the order stays the same.
      expect(build(occupiedMixed, { guestFactIndex: 0 }).guestFact).toBe('Anna har vært på hytta flest ganger.')
      expect(build(occupiedMixed, { guestFactIndex: 1 }).guestFact).toBe('Dette er Carls første besøk!')
      expect(build(occupiedMixed, { guestFactIndex: 2 }).guestFact).toBe('Gjengen har vært samlet 5 ganger.')
    })

    test('clamps an out-of-range index', () => {
      expect(build(occupiedMixed, { guestFactIndex: 99 }).guestFact).toBe('Gjengen har vært samlet 5 ganger.')
    })

    test('has no guest fact when the list is empty', () => {
      expect(build({ ...occupiedMixed, guestFunFacts: [] }).guestFact).toBeNull()
    })

    test('shows only family guests in the family-only scenario', () => {
      const model = build(occupiedFamilyOnly)
      expect(model.guests.map((g) => g.guestId)).toEqual(['guest-1', 'guest-2'])
      expect(model.nextVisit).toBeNull()
      expect(model.cabinFact).toBe('Hytta har vært besøkt 120 ganger.')
    })

    test('is compact when flagged occupied but the reservation is missing', () => {
      const model = build({ ...occupiedMixed, currentReservation: null })
      expect(model.view).toBe('compact')
      expect(model.guestFact).toBeNull()
    })
  })

  describe('next visit', () => {
    test('maps the upcoming reservation with guests and the first fact', () => {
      const { nextVisit } = build(occupiedMixed)
      expect(nextVisit).toMatchObject({ startDate: '2026-11-20', endDate: '2026-11-23', daysUntil: 14 })
      expect(nextVisit?.guests.map((g) => g.guestId)).toEqual(['guest-1', 'guest-4'])
      expect(nextVisit?.fact).toBe('Neste besøk er om 14 dager.')
    })

    test('is hidden when showNextVisit is off', () => {
      expect(build(occupiedMixed, { config: { ...config, showNextVisit: false } }).nextVisit).toBeNull()
    })

    test('is null without a next reservation', () => {
      expect(build(notOccupiedNoNext).nextVisit).toBeNull()
    })

    test('has no fact when the list is empty', () => {
      expect(build({ ...notOccupiedNext, nextVisitFunFacts: [] }).nextVisit?.fact).toBeNull()
    })
  })

  describe('compact', () => {
    test('shows next visit, totals and no guests when not occupied', () => {
      const model = build(notOccupiedNext)
      expect(model.view).toBe('compact')
      expect(model.stay).toBeNull()
      expect(model.guests).toEqual([])
      expect(model.guestFact).toBeNull()
      expect(model.nextVisit?.daysUntil).toBe(14)
      expect(model.totals).toEqual({ visits: 120, nights: 300, uniqueGuests: 25 })
    })

    test('shows only totals without a next reservation and without cabin facts', () => {
      const model = build(notOccupiedNoNext)
      expect(model.view).toBe('compact')
      expect(model.nextVisit).toBeNull()
      expect(model.cabinFact).toBeNull()
      expect(model.totals).toEqual({ visits: 120, nights: 300, uniqueGuests: 25 })
    })
  })

  describe('cabin facts', () => {
    test('selects by index and clamps', () => {
      expect(build(occupiedMixed, { cabinFactIndex: 1 }).cabinFact).toBe('Det er 300 netter totalt.')
      expect(build(occupiedMixed, { cabinFactIndex: 7 }).cabinFact).toBe('Det er 300 netter totalt.')
    })

    test('is hidden when showCabinFacts is off', () => {
      expect(build(occupiedMixed, { config: { ...config, showCabinFacts: false } }).cabinFact).toBeNull()
    })
  })
})
