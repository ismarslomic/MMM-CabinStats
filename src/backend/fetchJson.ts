/** The parts of the config `fetchJson` needs. */
export type FetchJsonOptions = {
  /** Request timeout in milliseconds. */
  requestTimeout: number
  /** Sent as the `X-Api-Key` header when set. */
  apiToken?: string
}

/**
 * Fetches a url and parses the JSON body. The caller validates the payload.
 *
 * @throws Error with a short description on network failure, timeout, non-2xx status or invalid JSON.
 */
export async function fetchJson(
  url: string,
  { requestTimeout, apiToken }: FetchJsonOptions,
  fetchFn: typeof fetch = fetch
): Promise<unknown> {
  let response: Response
  try {
    response = await fetchFn(url, {
      headers: apiToken ? { Accept: 'application/json', 'X-Api-Key': apiToken } : { Accept: 'application/json' },
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

  try {
    return await response.json()
  } catch (error) {
    throw new Error(`Response from ${url} is not valid JSON`, { cause: error })
  }
}
