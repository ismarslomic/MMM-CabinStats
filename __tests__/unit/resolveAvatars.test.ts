import { describe, expect, test, vi } from 'vitest'
import { fetchAvatar } from '../../src/backend/fetchAvatar'
import { resolveAvatars } from '../../src/backend/resolveAvatars'
import type { GuestStats } from '../../src/types/LiveStats'
import occupied from '../fixtures/occupied-family-only.json'

vi.mock('logger', () => ({ warn: vi.fn() }))

const options = { apiBaseUrl: 'http://backend.example:8080', requestTimeout: 5000, apiToken: 'secret' }
const jpeg = () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/jpeg' } })

describe('fetchAvatar', () => {
  test('sends the apiToken as X-Api-Key header and returns a data url', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jpeg())

    await expect(fetchAvatar('http://backend.example:8080/a', options, fetchFn)).resolves.toBe(
      'data:image/jpeg;base64,AQID'
    )
    expect(fetchFn.mock.calls[0][1].headers).toEqual({ Accept: 'image/*', 'X-Api-Key': 'secret' })
  })

  test('rejects a non-2xx status and a response that is not an image', async () => {
    await expect(
      fetchAvatar('http://x/a', options, vi.fn().mockResolvedValue(new Response('', { status: 401 })))
    ).rejects.toThrow('failed with status 401')
    await expect(
      fetchAvatar(
        'http://x/a',
        options,
        vi.fn().mockResolvedValue(new Response('{}', { headers: { 'Content-Type': 'application/json' } }))
      )
    ).rejects.toThrow('is not an image')
  })
})

describe('resolveAvatars', () => {
  const guest = occupied.currentReservation.guests[0] as GuestStats

  test('replaces avatarUrl with a data url and caches it by url', async () => {
    const fetchFn = vi.fn().mockImplementation(() => Promise.resolve(jpeg()))
    const [first] = await resolveAvatars([guest], options, fetchFn)
    const [second] = await resolveAvatars([guest], options, fetchFn)

    expect(first.avatarUrl).toBe('data:image/jpeg;base64,AQID')
    expect(second.avatarUrl).toBe(first.avatarUrl)
    expect(fetchFn).toHaveBeenCalledOnce()
    expect(fetchFn.mock.calls[0][0]).toBe(`http://backend.example:8080${guest.avatarUrl}`)
  })

  test('gives null when the avatar cannot be loaded and keeps guests without avatar', async () => {
    const other = { ...guest, guestId: 'x', avatarUrl: '/api/guests/x/avatar' }
    const none = { ...guest, avatarUrl: null }
    const fetchFn = vi.fn().mockResolvedValue(new Response('', { status: 404 }))

    const result = await resolveAvatars([other, none], options, fetchFn)

    expect(result.map((g) => g.avatarUrl)).toEqual([null, null])
  })
})
