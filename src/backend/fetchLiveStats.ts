import { isLiveStats, LiveStats } from '../types/LiveStats'

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

  let response: Response
  try {
    response = await fetchFn(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(requestTimeout),
    })
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'TimeoutError'
    throw new Error(isTimeout ? `Request to ${url} timed out after ${requestTimeout} ms` : `Request to ${url} failed`, {
      cause: error,
    })
  }

  if (!response.ok) {
    throw new Error(`Request to ${url} failed with status ${response.status}`)
  }

  let body: unknown
  try {
    body = await response.json()
  } catch (error) {
    throw new Error(`Response from ${url} is not valid JSON`, { cause: error })
  }

  if (!isLiveStats(body)) {
    throw new Error(`Response from ${url} does not match the expected live stats contract`)
  }
  return body
}
