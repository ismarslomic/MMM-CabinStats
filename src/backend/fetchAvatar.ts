import { FetchJsonOptions } from './fetchJson'

/**
 * Fetches a guest avatar and returns it as a `data:` url. The browser cannot send the `X-Api-Key` header from an
 * `<img>` tag, so the MagicMirror server fetches the image and hands the browser the bytes.
 *
 * @throws Error with a short description on network failure, timeout, non-2xx status or a response that is not an image.
 */
export async function fetchAvatar(
  url: string,
  { requestTimeout, apiToken }: FetchJsonOptions,
  fetchFn: typeof fetch = fetch
): Promise<string> {
  let response: Response
  try {
    response = await fetchFn(url, {
      headers: apiToken ? { Accept: 'image/*', 'X-Api-Key': apiToken } : { Accept: 'image/*' },
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

  const contentType = response.headers.get('Content-Type')?.split(';')[0].trim() ?? 'image/jpeg'
  if (!contentType.startsWith('image/')) {
    throw new Error(`Response from ${url} is not an image`)
  }

  const bytes = Buffer.from(await response.arrayBuffer())
  return `data:${contentType};base64,${bytes.toString('base64')}`
}
