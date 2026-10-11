import { element, Translate } from './dom'
import { HeatmapCell, HeatmapRow, ProfileModel, ProfileTile } from './guestProfile'

const levels = [0, 1, 2, 3, 4] as const

function monthName(month: number, translate: Translate): string {
  return translate(`MONTH_SHORT_${month}`)
}

/** Accessible name of a heatmap cell, e.g. `Mai 2021: 2 besøk`. */
function cellLabel(cell: HeatmapCell, year: number, translate: Translate): string {
  const variables = { month: monthName(cell.month, translate), year, count: cell.count }
  if (cell.state === 'nodata') return translate('HEATMAP_CELL_NODATA', variables)
  if (cell.state === 'future') {
    return translate(cell.hasUpcoming ? 'HEATMAP_CELL_UPCOMING' : 'HEATMAP_CELL_FUTURE', variables)
  }
  const visits = translate(cell.count === 1 ? 'HEATMAP_CELL_ONE' : 'HEATMAP_CELL_OTHER', variables)
  return cell.hasUpcoming ? `${visits} ${translate('HEATMAP_UPCOMING_SUFFIX')}` : visits
}

function createCell(cell: HeatmapCell, year: number, translate: Translate): HTMLElement {
  const td = element('td', 'cabin-heat-cell')
  td.dataset.level = String(cell.level)
  td.dataset.state = cell.state
  td.setAttribute('aria-label', cellLabel(cell, year, translate))
  if (cell.hasUpcoming) td.append(element('span', 'cabin-heat-dot'))
  return td
}

function createHeatmapTable(rows: HeatmapRow[], translate: Translate): HTMLElement {
  const table = element('table', 'cabin-heatmap')
  table.style.setProperty('--cabin-years', String(rows.length))
  table.setAttribute('aria-label', translate('HEATMAP_LABEL'))

  const head = element('tr', 'cabin-heatmap-head')
  head.append(element('td', 'cabin-heatmap-corner'))
  for (let month = 1; month <= 12; month++) {
    const th = element('th', 'cabin-heatmap-month', monthName(month, translate))
    th.scope = 'col'
    head.append(th)
  }
  table.createTHead().append(head)

  const body = table.createTBody()
  for (const row of rows) {
    const tr = element('tr', 'cabin-heatmap-row')
    const year = element('th', 'cabin-heatmap-year', String(row.year))
    year.scope = 'row'
    tr.append(year, ...row.cells.map((cell) => createCell(cell, row.year, translate)))
    body.append(tr)
  }
  return table
}

function createLegend(translate: Translate): HTMLElement {
  const legend = element('div', 'cabin-heat-legend')
  legend.setAttribute('aria-hidden', 'true')
  for (const level of levels) {
    const item = element('span', 'cabin-heat-legend-item')
    const swatch = element('span', 'cabin-heat-cell cabin-heat-swatch')
    swatch.dataset.level = String(level)
    swatch.dataset.state = 'past'
    item.append(swatch, element('span', 'cabin-heat-legend-label', level === 4 ? '4+' : String(level)))
    legend.append(item)
  }
  const upcoming = element('span', 'cabin-heat-legend-item')
  upcoming.append(
    element('span', 'cabin-heat-dot cabin-heat-dot-static'),
    element('span', 'cabin-heat-legend-label', translate('HEATMAP_LEGEND_UPCOMING'))
  )
  legend.append(upcoming)
  return legend
}

function tileLabelKey(tile: ProfileTile): string {
  return `TILE_${tile.id.toUpperCase()}`
}

function createTile(tile: ProfileTile, translate: Translate): HTMLElement {
  const item = element('li', 'cabin-tile')
  const value = tile.of === undefined ? tile.value : translate('TILE_OF', { count: tile.value, total: tile.of })
  item.append(
    element('span', 'cabin-tile-value', value),
    element('span', 'cabin-tile-label', translate(tileLabelKey(tile)))
  )
  return item
}

function createTiles(tiles: ProfileTile[], className: string, translate: Translate): HTMLElement | undefined {
  if (tiles.length === 0) return undefined
  const list = element('ul', className)
  list.append(...tiles.map((tile) => createTile(tile, translate)))
  return list
}

function createDates(profile: ProfileModel, translate: Translate): HTMLElement | undefined {
  const parts = [
    profile.firstVisit ? translate('PROFILE_FIRST_VISIT', { date: profile.firstVisit }) : null,
    profile.lastVisit ? translate('PROFILE_LAST_VISIT', { date: profile.lastVisit }) : null,
  ].filter((part): part is string => part !== null)
  return parts.length > 0 ? element('p', 'cabin-profile-dates dimmed', parts.join(' · ')) : undefined
}

/**
 * The fun fact shown under the name of the guest, `undefined` without facts. `factIndex` selects the fact shown
 * first; later changes go through {@link updateProfileFact} so the rest stays untouched.
 */
export function createProfileFact(profile: ProfileModel, factIndex: number): HTMLElement | undefined {
  if (profile.facts.length === 0) return undefined
  return element('p', 'cabin-profile-fact bright', profile.facts[factIndex] ?? profile.facts[0])
}

/** The profile of a guest: headline number, visit heatmap, stat tiles and the first and last visit. */
export function createProfileSection(profile: ProfileModel, translate: Translate): HTMLElement {
  const section = element('div', 'cabin-profile')

  section.append(
    element(
      'p',
      'cabin-profile-subtitle dimmed',
      translate('PROFILE_SUBTITLE', { first: profile.firstYear, last: profile.lastYear })
    )
  )

  const total = element('p', 'cabin-profile-total')
  total.append(
    element('span', 'cabin-profile-total-number', String(profile.totalVisits)),
    element(
      'span',
      'cabin-profile-total-label dimmed',
      translate('PROFILE_TOTAL_LABEL', { count: profile.yearsInGrid })
    )
  )
  section.append(total)

  const heatmap = element('section', 'cabin-heat')
  heatmap.setAttribute('aria-label', translate('HEATMAP_LABEL'))
  heatmap.append(
    element('h3', 'cabin-heat-title dimmed', translate('HEATMAP_LABEL')),
    createHeatmapTable(profile.heatmap, translate),
    createLegend(translate),
    element('p', 'cabin-heat-caption dimmed', translate('HEATMAP_CAPTION', { year: profile.lastYear }))
  )
  section.append(heatmap)

  for (const node of [
    createTiles(profile.primaryTiles, 'cabin-tiles cabin-tiles-primary', translate),
    createTiles(profile.secondaryTiles, 'cabin-tiles cabin-tiles-secondary', translate),
    createDates(profile, translate),
  ]) {
    if (node) section.append(node)
  }

  return section
}

/** Shows another fun fact with a fade, without rebuilding anything else. */
export function updateProfileFact(overlay: ParentNode, text: string): void {
  const fact = overlay.querySelector<HTMLElement>('.cabin-profile-fact')
  if (!fact) return
  fact.classList.remove('cabin-fade-in')
  // Reading a layout property restarts the CSS animation.
  void fact.offsetWidth
  fact.textContent = text
  fact.classList.add('cabin-fade-in')
}
