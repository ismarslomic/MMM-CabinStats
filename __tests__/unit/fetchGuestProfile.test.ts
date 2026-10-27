import { describe, expect, test, vi } from 'vitest'
import { fetchGuestProfile } from '../../src/backend/fetchGuestProfile'
import profile from '../fixtures/guest-profile-regular.json'

const options = { apiBaseUrl: 'http://backend.example:8080', requestTimeout: 5000 }

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), { status: 200, ...init })
}

describe('fetchGuestProfile', () => {
  test('requests /api/stats/guests/{guestId} and returns the validated payload', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(profile))

    await expect(fetchGuestProfile('guest-1', options, fetchFn)).resolves.toEqual(profile)

    expect(fetchFn).toHaveBeenCalledOnce()
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('http://backend.example:8080/api/stats/guests/guest-1')
    expect(init.headers).toEqual({ Accept: 'application/json' })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  test('sends the apiToken as X-Api-Key header', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(profile))
    await fetchGuestProfile('guest-1', { ...options, apiToken: 'secret' }, fetchFn)
    expect(fetchFn.mock.calls[0][1].headers).toEqual({ Accept: 'application/json', 'X-Api-Key': 'secret' })
  })

  test('encodes the guestId in the path', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(profile))
    await fetchGuestProfile('a/b?c', options, fetchFn)
    expect(fetchFn.mock.calls[0][0]).toBe('http://backend.example:8080/api/stats/guests/a%2Fb%3Fc')
  })

  test.each([404, 500])('rejects status %i', async (status) => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('nope', { status }))
    await expect(fetchGuestProfile('guest-1', options, fetchFn)).rejects.toThrow(`failed with status ${status}`)
  })

  test('reports a timeout', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError'))
    await expect(fetchGuestProfile('guest-1', options, fetchFn)).rejects.toThrow('timed out after 5000 ms')
  })

  test.each([[[]], ['text'], [null], [{}], [{ ...profile, visits: 'x' }]])('rejects the payload %j', async (body) => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(body))
    await expect(fetchGuestProfile('guest-1', options, fetchFn)).rejects.toThrow('guest profile contract')
  })
})
