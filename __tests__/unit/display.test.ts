import { describe, expect, test } from 'vitest'
import { formatDateRange, toTemplateData } from '../../src/frontend/display'
import { buildViewModel } from '../../src/frontend/viewModel'
import { defaultConfig } from '../../src/types/Config'
import occupiedMixed from '../fixtures/occupied-mixed.json'
import notOccupiedNoNext from '../fixtures/not-occupied-no-next.json'
import { LiveStats } from '../../src/types/LiveStats'

const config = { ...defaultConfig, apiBaseUrl: 'http://backend.example:8080' }

describe('formatDateRange', () => {
  test.each([
    ['2026-10-06', '2026-10-09', '6.–9. okt.'],
    ['2026-09-30', '2026-10-02', '30. sep.–2. okt.'],
    ['2026-03-05', '2026-03-05', '5. mars'],
    ['2026-12-28', '2027-01-03', '28. des.–3. jan.'],
    ['nonsense', '2026-10-09', 'nonsense–2026-10-09'],
    ['2026-13-01', '2026-10-09', '2026-13-01–2026-10-09'],
    ['2026-10-06', '2026-10-32', '2026-10-06–2026-10-32'],
  ])('%s to %s gives %s', (start, end, expected) => {
    expect(formatDateRange(start, end)).toBe(expected)
  })
})

describe('toTemplateData', () => {
  test('adds date ranges to the stay and the next visit and keeps everything else', () => {
    const viewModel = buildViewModel({
      config,
      liveStats: occupiedMixed as LiveStats,
      guestFactIndex: 0,
      cabinFactIndex: 0,
    })
    const data = toTemplateData(viewModel)
    expect(data.stay).toEqual({
      ...viewModel.stay,
      dateRange: formatDateRange(viewModel.stay!.startDate, viewModel.stay!.endDate),
    })
    expect(data.nextVisit?.dateRange).toBe(
      formatDateRange(viewModel.nextVisit!.startDate, viewModel.nextVisit!.endDate)
    )
    expect(data.guests).toBe(viewModel.guests)
    expect(data.view).toBe('occupied')
  })

  test('keeps stay and next visit null when there are none', () => {
    const viewModel = buildViewModel({
      config,
      liveStats: notOccupiedNoNext as LiveStats,
      guestFactIndex: 0,
      cabinFactIndex: 0,
    })
    const data = toTemplateData(viewModel)
    expect(data.stay).toBeNull()
    expect(data.nextVisit).toBeNull()
  })
})
