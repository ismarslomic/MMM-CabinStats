import { describe, expect, test, vi } from 'vitest'
import { fetchGuestStats } from '../../src/backend/fetchGuestStats'

const options = { apiBaseUrl: 'http://backend.example:8080', requestTimeout: 5000 }

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), { status: 200, ...init })
}

describe('fetchGuestStats', () => {
  test('requests /api/stats/guests/{guestId} and returns the validated payload', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}))

    await expect(fetchGuestStats('guest-1', options, fetchFn)).resolves.toEqual({})

    expect(fetchFn).toHaveBeenCalledOnce()
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('http://backend.example:8080/api/stats/guests/guest-1')
    expect(init.headers).toEqual({ Accept: 'application/json' })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  test('encodes the guestId in the path', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({}))
    await fetchGuestStats('a/b?c', options, fetchFn)
    expect(fetchFn.mock.calls[0][0]).toBe('http://backend.example:8080/api/stats/guests/a%2Fb%3Fc')
  })

  test.each([404, 500])('rejects status %i', async (status) => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('nope', { status }))
    await expect(fetchGuestStats('guest-1', options, fetchFn)).rejects.toThrow(`failed with status ${status}`)
  })

  test('reports a timeout', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError'))
    await expect(fetchGuestStats('guest-1', options, fetchFn)).rejects.toThrow('timed out after 5000 ms')
  })

  test.each([[[]], ['text'], [null]])('rejects the payload %j', async (body) => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(body))
    await expect(fetchGuestStats('guest-1', options, fetchFn)).rejects.toThrow('guest stats contract')
  })
})
