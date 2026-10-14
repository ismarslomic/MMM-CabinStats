import { describe, expect, test } from 'vitest'
import { buildGuestOverlayModel, findGuest, GuestViewState } from '../../src/frontend/guestView'
import { GuestProfileStats } from '../../src/types/GuestProfileStats'
import { GuestStats, LiveStats } from '../../src/types/LiveStats'
import regular from '../fixtures/guest-profile-regular.json'
import occupiedMixed from '../fixtures/occupied-mixed.json'
import notOccupiedNext from '../fixtures/not-occupied-next.json'
import guestWithoutAvatar from '../fixtures/guest-without-avatar.json'

const apiBaseUrl = 'http://backend.example:8080'

describe('findGuest', () => {
  test('finds a guest of the current reservation', () => {
    expect(findGuest(occupiedMixed as LiveStats, 'guest-2')?.firstName).toBe('Bjørn')
  })

  test('finds a guest of the next reservation', () => {
    expect(findGuest(notOccupiedNext as LiveStats, 'guest-4')?.firstName).toBe('Dora')
  })

  test.each([
    ['unknown guest', occupiedMixed as LiveStats, 'nobody'],
    ['no live stats yet', undefined, 'guest-1'],
  ])('returns undefined for %s', (_name, liveStats, guestId) => {
    expect(findGuest(liveStats, guestId)).toBeUndefined()
  })
})

describe('buildGuestOverlayModel', () => {
  const today = { year: 2026, month: 10 }
  const state = (guest: GuestStats, status: GuestViewState['status'], extra: Partial<GuestViewState> = {}) => ({
    guest,
    status,
    factIndex: 0,
    ...extra,
  })

  test('builds the full name, initials and absolute avatar url', () => {
    const guest = findGuest(occupiedMixed as LiveStats, 'guest-1')!
    expect(buildGuestOverlayModel(state(guest, 'loading'), apiBaseUrl, today)).toEqual({
      guestId: 'guest-1',
      fullName: 'Anna Testesen',
      firstName: 'Anna',
      initials: 'AT',
      avatarUrl: `${apiBaseUrl}/api/guests/guest-1/avatar`,
      status: 'loading',
      profile: undefined,
      factIndex: 0,
    })
  })

  test('has no avatar url for a guest without avatar', () => {
    const guest = (guestWithoutAvatar as LiveStats).currentReservation!.guests.find((g) => g.firstName === 'Eva')!
    expect(buildGuestOverlayModel(state(guest, 'loaded'), apiBaseUrl, today).avatarUrl).toBeNull()
  })

  test('builds the profile only when loaded', () => {
    const guest = findGuest(occupiedMixed as LiveStats, 'guest-1')!
    const profile = regular as unknown as GuestProfileStats
    expect(buildGuestOverlayModel(state(guest, 'loaded', { profile }), apiBaseUrl, today).profile?.totalVisits).toBe(
      125
    )
    expect(buildGuestOverlayModel(state(guest, 'loading', { profile }), apiBaseUrl, today).profile).toBeUndefined()
    expect(buildGuestOverlayModel(state(guest, 'error'), apiBaseUrl, today).profile).toBeUndefined()
    expect(buildGuestOverlayModel(state(guest, 'loaded'), apiBaseUrl, today).profile).toBeUndefined()
  })
})
