import { describe, expect, test } from 'vitest'
import { buildGuestOverlayModel, findGuest } from '../../src/frontend/guestView'
import { LiveStats } from '../../src/types/LiveStats'
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
  test('builds the full name, initials and absolute avatar url', () => {
    const guest = findGuest(occupiedMixed as LiveStats, 'guest-1')!
    expect(buildGuestOverlayModel(guest, apiBaseUrl, 'loading')).toEqual({
      guestId: 'guest-1',
      fullName: 'Anna Testesen',
      firstName: 'Anna',
      initials: 'AT',
      avatarUrl: `${apiBaseUrl}/api/guests/guest-1/avatar`,
      status: 'loading',
    })
  })

  test('has no avatar url for a guest without avatar', () => {
    const guest = (guestWithoutAvatar as LiveStats).currentReservation!.guests.find((g) => g.firstName === 'Eva')!
    expect(buildGuestOverlayModel(guest, apiBaseUrl, 'loaded').avatarUrl).toBeNull()
  })
})
