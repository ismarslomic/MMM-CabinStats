import nunjucks from 'nunjucks'
import { describe, expect, test } from 'vitest'
import { FactView, toFactView } from '../../src/frontend/factView'
import translations from '../../translations/nb.json'

const root = new URL('../../', import.meta.url).pathname

/** The nunjucks environment of MagicMirror: same options, and a `translate` filter that works like the module's. */
function render(data: Record<string, unknown>): string {
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(root), { trimBlocks: true, lstripBlocks: true })
  env.addFilter(
    'translate',
    (key: string) => new nunjucks.runtime.SafeString((translations as Record<string, string>)[key] ?? key)
  )
  return env.render('templates/MMM-CabinStats.njk', data)
}

const guestFact = toFactView({
  text: 'Det er 12 måneder siden sist, Ørjan!',
  priority: 80,
  segments: [
    { text: 'Det er ' },
    { text: '12 måneder', kind: 'stat' },
    { text: ' siden sist, ' },
    { text: 'Ørjan', kind: 'guest' },
    { text: '!' },
  ],
})
const cabinFact = toFactView({ text: 'Hytta har vært i bruk 26 % av årets dager', priority: 10 })

describe('templates/MMM-CabinStats.njk facts', () => {
  const facts = (overrides: { guestFact?: FactView | null; cabinFact?: FactView | null } = {}) =>
    render({ view: 'compact', display: 'facts', guestFact, cabinFact, ...overrides })

  test('highlights numbers and guest names in the guest fact, with the spaces of the text intact', () => {
    expect(facts()).toContain(
      'Det er <span class="cabin-highlight cabin-highlight-stat">12 måneder</span> siden sist, ' +
        '<span class="cabin-highlight cabin-highlight-guest">Ørjan</span>!</p>'
    )
  })

  test('shows a fact without segments as plain text', () => {
    const html = facts()
    expect(html).toContain('Hytta har vært i bruk 26 % av årets dager</p>')
    expect(html).not.toMatch(/cabin-fact-cabin[^>]*>[^<]*<span/)
  })

  test('escapes the text of a part', () => {
    const risky = toFactView({ text: '<i>Ørjan</i>', priority: 1, segments: [{ text: '<i>Ørjan</i>', kind: 'guest' }] })
    const html = facts({ guestFact: risky })
    expect(html).toContain('&lt;i&gt;Ørjan&lt;/i&gt;</span>')
    expect(html).not.toContain('<i>')
  })

  test('shows the facts in the occupied and compact views too', () => {
    const nextVisit = { dateRange: '15.–18. okt.', daysUntil: 1, guests: [] }
    const compact = render({ view: 'compact', display: 'stats', guestFact, cabinFact, nextVisit, totals: null })
    expect(compact).toContain('cabin-highlight-stat">12 måneder</span>')
    expect(compact).toContain('cabin-fact-cabin')

    const stay = { dateRange: '14.–17. okt.', remainingNights: 2 }
    const occupied = render({
      view: 'occupied',
      display: 'stats',
      guestFact,
      cabinFact,
      stay,
      guests: [],
      nextVisit: null,
    })
    expect(occupied).toContain('cabin-highlight-guest">Ørjan</span>!')
  })
})
