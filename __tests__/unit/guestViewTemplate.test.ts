import nunjucks from 'nunjucks'
import { describe, expect, test } from 'vitest'
import { buildGuestOverlayModel, findGuest, GuestViewState } from '../../src/frontend/guestView'
import { GuestProfileStats } from '../../src/types/GuestProfileStats'
import { GuestStats, LiveStats } from '../../src/types/LiveStats'
import translations from '../../translations/nb.json'
import occupiedMixed from '../fixtures/occupied-mixed.json'
import regular from '../fixtures/guest-profile-regular.json'
import sporadic from '../fixtures/guest-profile-sporadic.json'
import firstVisit from '../fixtures/guest-profile-first-visit.json'
import noVisits from '../fixtures/guest-profile-no-visits.json'

const root = new URL('../../', import.meta.url).pathname
const today = { year: 2026, month: 10 }
const anna = findGuest(occupiedMixed as LiveStats, 'guest-1')!

/** The nunjucks environment of MagicMirror: same options, and a `translate` filter that works like the module's. */
function environment() {
  const env = new nunjucks.Environment(new nunjucks.FileSystemLoader(root), { trimBlocks: true, lstripBlocks: true })
  env.addFilter('translate', (key: string, variables: Record<string, unknown> = {}) => {
    const text = Object.entries(variables).reduce(
      (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
      (translations as Record<string, string>)[key] ?? `MISSING ${key}`
    )
    return new nunjucks.runtime.SafeString(text)
  })
  return env
}

function render(
  state: Partial<GuestViewState> & { status: GuestViewState['status'] },
  guest: GuestStats = anna
): string {
  const model = buildGuestOverlayModel({ guest, factIndex: 0, ...state }, 'http://backend.example:8080', today)
  return environment().render('templates/guest-view.njk', model)
}

const profile = (fixture: unknown) => fixture as GuestProfileStats

describe('templates/guest-view.njk', () => {
  test('renders a dialog with the name, a close button and the avatar', () => {
    const html = render({ status: 'loading' })

    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-label="Statistikk for Anna Testesen"')
    expect(html).toContain('data-cabin-action="close"')
    expect(html).toContain('aria-label="Lukk"')
    expect(html).toContain('src="http://backend.example:8080/api/guests/guest-1/avatar"')
    expect(html).toContain('>AT</span>')
    expect(html).toContain('role="status"')
    expect(html).not.toContain('cabin-profile"')
  })

  test('shows the initials only for a guest without avatar', () => {
    expect(render({ status: 'loading' }, { ...anna, avatarUrl: null })).not.toContain('<img')
  })

  test('renders the error with a retry button', () => {
    const html = render({ status: 'error' })

    expect(html).toContain('role="alert"')
    expect(html).toContain('Kunne ikke hente statistikk')
    expect(html).toContain('data-cabin-action="retry"')
  })

  test('has no retry button while loading or loaded', () => {
    expect(render({ status: 'loading' })).not.toContain('retry')
    expect(render({ status: 'loaded', profile: profile(regular) })).not.toContain('retry')
  })

  test('renders the headline, the subtitle and the visit count', () => {
    const html = render({ status: 'loaded', profile: profile(regular) })

    expect(html).toContain('Hyttehistorikk · 2020–2026')
    expect(html).toContain('<span class="cabin-profile-total-number">125</span>')
    expect(html).toContain('hyttebesøk de siste 7 årene')
  })

  test('puts the rank before the name, gold for rank 1', () => {
    expect(render({ status: 'loaded', profile: profile(regular) })).toMatch(
      /<span class="cabin-overlay-rank cabin-overlay-rank-first">#1<\/span> Anna Testesen/
    )
    expect(render({ status: 'loaded', profile: profile(sporadic) })).toMatch(
      /<span class="cabin-overlay-rank">#9<\/span> Anna Testesen/
    )
    expect(render({ status: 'loaded', profile: profile(noVisits) })).not.toContain('cabin-overlay-rank')
  })

  test('shows the fun fact under the name, and the one at the fact index', () => {
    const facts = regular.funFacts.map((fact) => fact.text)
    const html = render({ status: 'loaded', profile: profile(regular), factIndex: 1 })

    expect(html).toContain(`<p class="cabin-profile-fact bright">${facts[1]}</p>`)
    expect(html.indexOf('cabin-profile-fact')).toBeLessThan(html.indexOf('cabin-overlay-body'))
    expect(render({ status: 'loaded', profile: profile(regular), factIndex: 99 })).toContain(facts[0])
    expect(render({ status: 'loaded', profile: profile(noVisits) })).not.toContain('cabin-profile-fact')
  })

  test('renders the heatmap as a table with a named cell per month', () => {
    const html = render({ status: 'loaded', profile: profile(regular) })

    expect(html).toContain(
      '<table class="cabin-heatmap" style="--cabin-years: 7" aria-label="Besøk fordelt på måneder">'
    )
    expect(html.match(/<th class="cabin-heatmap-year" scope="row">/g)).toHaveLength(7)
    expect(html.match(/<th class="cabin-heatmap-month" scope="col">/g)).toHaveLength(12)
    expect(html.match(/<td class="cabin-heat-cell"/g)).toHaveLength(7 * 12)
    expect(html).toContain('aria-label="Jan 2020: ingen data"')
    expect(html).toContain('aria-label="Okt 2026: 1 besøk"')
    expect(html).toContain('aria-label="Nov 2026: planlagt besøk"')
    expect(html).toContain('aria-label="Des 2026: ikke kommet ennå"')
    expect(html).toContain('data-level="0" data-state="nodata"')
  })

  test('marks a month with an upcoming visit with a dot, and has a legend', () => {
    const html = render({ status: 'loaded', profile: profile(regular) })

    expect(html.match(/<span class="cabin-heat-dot"><\/span>/g)).toHaveLength(1)
    expect(html).toContain('>4+</span>')
    expect(html).toContain('Planlagt besøk')
    expect(html).toContain('Antall besøk per måned · 2026 hittil')
  })

  test('renders the tiles with their labels', () => {
    const html = render({ status: 'loaded', profile: profile(regular) })

    for (const label of [
      'Besøk per år',
      'Flest på én måned',
      'År med besøk',
      'Dager på hytta',
      'Netter på hytta',
      'Netter i lengste opphold',
      'Besøk i år',
    ]) {
      expect(html).toContain(`>${label}</span>`)
    }
    expect(html).toContain('>7 av 7</span>')
    expect(html).toContain('>17,9</span>')
    expect(html).not.toContain('Rangering')
  })

  test('shows the first and last visit', () => {
    expect(render({ status: 'loaded', profile: profile(regular) })).toMatch(
      /Første registrerte besøk sep\. 2020 · Sist her \d{1,2}\. \S+ 2026/
    )
    expect(render({ status: 'loaded', profile: profile(firstVisit) })).not.toContain('Sist her')
  })

  test('has no tiles or dates for a guest without visits, but still the heatmap', () => {
    const html = render({ status: 'loaded', profile: profile(noVisits) })

    expect(html).not.toContain('cabin-tiles')
    expect(html).not.toContain('cabin-profile-dates')
    expect(html).toContain('<table class="cabin-heatmap"')
    expect(html).toContain('<span class="cabin-profile-total-number">0</span>')
  })

  test('does not use elements that MagicMirror styles globally', () => {
    // `header` gets upper case text, a line height of 15px and a border from the main.css of MagicMirror.
    const html = render({ status: 'loaded', profile: profile(regular) })

    expect(html).not.toMatch(/<header[\s>]/)
  })

  test('escapes the name of the guest', () => {
    const html = render({ status: 'loaded', profile: profile(regular) }, { ...anna, firstName: '<b>"Anna"</b>' })

    expect(html).not.toContain('<b>')
    expect(html).toContain('&lt;b&gt;')
    expect(html).toContain('aria-label="Statistikk for &lt;b&gt;&quot;Anna&quot;&lt;/b&gt; Testesen"')
  })
})
