import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { deflateSync, crc32 } from 'node:zlib'

/**
 * Mock cabin stats backend for the e2e tests. The first path segment selects the scenario, so every module instance
 * gets its own data through its `apiBaseUrl`:
 *
 *   GET  /{scenario}/api/stats                  fixture JSON, or 503 while the scenario is switched off
 *   GET  /{scenario}/api/guests/{id}/avatar     generated placeholder PNG
 *   POST /{scenario}/control/down | up          switch the scenario off or on (for outage tests)
 *   GET  /health                                readiness probe for Playwright `webServer`
 */

const port = Number(process.env.MOCK_BACKEND_PORT ?? 8081)

/** Scenario name -> fixture file in `__tests__/fixtures`. */
const scenarios = {
  'occupied-mixed': 'occupied-mixed.json',
  'not-occupied-next': 'not-occupied-next.json',
  'guest-without-avatar': 'guest-without-avatar.json',
  flaky: 'occupied-family-only.json',
}

const fixtures = new Map(
  Object.entries(scenarios).map(([name, file]) => [
    name,
    readFileSync(new URL(`../fixtures/${file}`, import.meta.url), 'utf8'),
  ])
)
const disabled = new Set()

function pngChunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, checksum])
}

/** A solid 8x8 PNG, so no real photo is needed and no image library is a dependency. */
function placeholderAvatar() {
  const size = 8
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header.writeUInt8(8, 8) // bit depth
  header.writeUInt8(2, 9) // colour type: RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3, 0x88)])
  const pixels = deflateSync(Buffer.concat(Array.from({ length: size }, () => row)))
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', pixels),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

const avatar = placeholderAvatar()

function send(response, status, contentType, body) {
  response.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-store' })
  response.end(body)
}

const server = createServer((request, response) => {
  const { pathname } = new URL(request.url ?? '/', `http://localhost:${port}`)
  if (pathname === '/health') return send(response, 200, 'text/plain', 'ok')

  const [, scenario, ...rest] = pathname.split('/')
  const route = `/${rest.join('/')}`
  if (!fixtures.has(scenario)) return send(response, 404, 'text/plain', 'Unknown scenario')

  if (request.method === 'POST' && route === '/control/down') {
    disabled.add(scenario)
    return send(response, 204, 'text/plain', '')
  }
  if (request.method === 'POST' && route === '/control/up') {
    disabled.delete(scenario)
    return send(response, 204, 'text/plain', '')
  }
  if (disabled.has(scenario)) return send(response, 503, 'text/plain', 'Switched off')
  if (request.method === 'GET' && route === '/api/stats') {
    return send(response, 200, 'application/json', fixtures.get(scenario))
  }
  if (request.method === 'GET' && /^\/api\/guests\/[^/]+\/avatar$/.test(route)) {
    return send(response, 200, 'image/png', avatar)
  }
  return send(response, 404, 'text/plain', 'Not found')
})

server.listen(port, '127.0.0.1', () => {
  console.log(`Mock cabin backend listening on http://127.0.0.1:${port}`)
})
