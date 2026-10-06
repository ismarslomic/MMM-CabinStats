import { describe, expect, test, vi } from 'vitest'
import { fetchLiveStats } from '../../src/backend/fetchLiveStats'
import occupiedMixed from '../fixtures/occupied-mixed.json'

const options = { apiBaseUrl: 'http://backend.example:8080', requestTimeout: 5000 }

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), { status: 200, ...init })
}

describe('fetchLiveStats', () => {
  test('requests /api/stats and returns the validated payload', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse(occupiedMixed))

    await expect(fetchLiveStats(options, fetchFn)).resolves.toEqual(occupiedMixed)

    expect(fetchFn).toHaveBeenCalledOnce()
    const [url, init] = fetchFn.mock.calls[0]
    expect(url).toBe('http://backend.example:8080/api/stats')
    expect(init.headers).toEqual({ Accept: 'application/json' })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  test.each([404, 500, 503])('rejects status %i', async (status) => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('nope', { status }))
    await expect(fetchLiveStats(options, fetchFn)).rejects.toThrow(`failed with status ${status}`)
  })

  test('rejects when the network request fails', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('fetch failed'))
    await expect(fetchLiveStats(options, fetchFn)).rejects.toThrow('/api/stats failed')
  })

  test('reports a timeout', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new DOMException('timed out', 'TimeoutError'))
    await expect(fetchLiveStats(options, fetchFn)).rejects.toThrow('timed out after 5000 ms')
  })

  test('aborts a request that exceeds the timeout', async () => {
    const fetchFn = vi.fn(
      (_url: string | URL | Request, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        })
    )
    await expect(fetchLiveStats({ ...options, requestTimeout: 10 }, fetchFn)).rejects.toThrow('timed out after 10 ms')
  })

  test('rejects invalid JSON', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('<html>', { status: 200 }))
    await expect(fetchLiveStats(options, fetchFn)).rejects.toThrow('not valid JSON')
  })

  test('rejects a payload that does not match the contract', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ isOccupied: 'yes' }))
    await expect(fetchLiveStats(options, fetchFn)).rejects.toThrow('does not match the expected live stats contract')
  })
})
