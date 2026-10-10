import { isLiveStats, LiveStats } from '../types/LiveStats'
import { fetchJson } from './fetchJson'

/** The parts of the config `fetchLiveStats` needs. */
export type FetchLiveStatsOptions = {
  /** Normalised base url without trailing slash. */
  apiBaseUrl: string
  /** Request timeout in milliseconds. */
  requestTimeout: number
}

/**
 * Fetches `GET /api/stats` from the backend and validates the response.
 *
 * @throws Error with a short description on network failure, timeout, non-2xx status, invalid JSON or a payload
 * that does not match the contract.
 */
export async function fetchLiveStats(
  { apiBaseUrl, requestTimeout }: FetchLiveStatsOptions,
  fetchFn: typeof fetch = fetch
): Promise<LiveStats> {
  const url = `${apiBaseUrl}/api/stats`
  const body = await fetchJson(url, { requestTimeout }, fetchFn)

  if (!isLiveStats(body)) {
    throw new Error(`Response from ${url} does not match the expected live stats contract`)
  }
  return body
}
