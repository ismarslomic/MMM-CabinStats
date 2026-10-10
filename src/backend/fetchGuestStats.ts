import { GuestDetailStats, isGuestDetailStats } from '../types/GuestDetailStats'
import { fetchJson } from './fetchJson'
import { FetchLiveStatsOptions } from './fetchLiveStats'

/**
 * Fetches `GET /api/stats/guests/{guestId}` from the backend and validates the response.
 *
 * @throws Error with a short description on network failure, timeout, non-2xx status, invalid JSON or a payload
 * that does not match the contract.
 */
export async function fetchGuestStats(
  guestId: string,
  { apiBaseUrl, requestTimeout }: FetchLiveStatsOptions,
  fetchFn: typeof fetch = fetch
): Promise<GuestDetailStats> {
  const url = `${apiBaseUrl}/api/stats/guests/${encodeURIComponent(guestId)}`
  const body = await fetchJson(url, { requestTimeout }, fetchFn)

  if (!isGuestDetailStats(body)) {
    throw new Error(`Response from ${url} does not match the expected guest stats contract`)
  }
  return body
}
