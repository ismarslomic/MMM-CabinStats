import { expect, test, type Locator, type Page } from '@playwright/test'

const mockBackend = 'http://127.0.0.1:8081'

/**
 * The instances in `mm/config.js` all render a region named like this. They are told apart by their content, because
 * every instance reads a different mock backend scenario.
 */
function regions(page: Page): Locator {
  return page.getByRole('region', { name: 'Hyttestatistikk' })
}

function occupiedMixed(page: Page): Locator {
  return regions(page).filter({ has: page.getByRole('listitem').filter({ hasText: 'Carl' }) })
}

function notOccupiedNext(page: Page): Locator {
  return regions(page).filter({ has: page.getByRole('heading', { level: 2, name: /^Neste besøk/ }) })
}

function guestWithoutAvatar(page: Page): Locator {
  return regions(page).filter({ has: page.getByRole('listitem').filter({ hasText: 'Eva' }) })
}

function flaky(page: Page): Locator {
  return regions(page)
    .filter({ has: page.getByRole('listitem').filter({ hasText: 'Bjørn' }) })
    .filter({
      hasNot: page.getByRole('listitem').filter({ hasText: 'Carl' }),
    })
}

test.describe('MMM-CabinStats', () => {
  test.beforeEach(async ({ page, request }) => {
    await request.post(`${mockBackend}/flaky/control/up`)
    await page.goto('/')
  })

  test.afterEach(async ({ request }) => {
    await request.post(`${mockBackend}/flaky/control/up`)
  })

  test.describe('occupied view', () => {
    test('shows heading, remaining nights and the guests with visit numbers', async ({ page }) => {
      const view = occupiedMixed(page)
      await expect(view.getByRole('heading', { level: 2, name: 'Velkommen til hytta' })).toBeVisible()
      await expect(view.getByText('2 netter igjen')).toBeVisible()

      const guests = view.getByRole('list', { name: 'Gjester på hytta' }).getByRole('listitem')
      await expect(guests).toHaveCount(3)
      await expect(guests.nth(0)).toContainText('Anna')
      await expect(guests.nth(0)).toContainText('besøk nr. 14')
      await expect(guests.nth(1)).toContainText('Bjørn')
      await expect(guests.nth(1)).toContainText('besøk nr. 12')
      await expect(guests.nth(2)).toContainText('Carl')
      await expect(guests.nth(2)).toContainText('Første besøk!')
    })

    test('gives the badge only to the top visitor', async ({ page }) => {
      const guests = occupiedMixed(page).getByRole('list', { name: 'Gjester på hytta' }).getByRole('listitem')
      await expect(guests.filter({ hasText: 'Anna' }).getByRole('img', { name: 'Hyttas største fan' })).toBeVisible()
      await expect(guests.filter({ hasText: 'Bjørn' }).getByRole('img', { name: 'Hyttas største fan' })).toHaveCount(0)
      await expect(guests.filter({ hasText: 'Carl' }).getByRole('img', { name: 'Hyttas største fan' })).toHaveCount(0)
    })

    test('shows the next visit with its guests', async ({ page }) => {
      const next = occupiedMixed(page).getByRole('region', { name: 'Neste besøk' })
      await expect(next.getByRole('heading', { level: 3, name: 'Neste besøk 20.–23. nov.' })).toBeVisible()
      const guests = next.getByRole('list', { name: 'Gjester neste besøk' }).getByRole('listitem')
      await expect(guests).toHaveCount(2)
      await expect(guests.filter({ hasText: 'Anna' })).toBeVisible()
      await expect(guests.filter({ hasText: 'Dora' })).toBeVisible()
    })

    test('rotates the guest facts and the cabin facts', async ({ page }) => {
      const view = occupiedMixed(page)
      for (const fact of [
        'Anna har vært på hytta flest ganger.',
        'Dette er Carls første besøk!',
        'Gjengen har vært samlet 5 ganger.',
        'Hytta har vært besøkt 120 ganger.',
        'Det er 300 netter totalt.',
      ]) {
        await expect(view.getByText(fact)).toBeVisible()
      }
    })

    test('loads the avatar photos from the backend', async ({ page }) => {
      const photos = occupiedMixed(page).getByRole('list', { name: 'Gjester på hytta' }).getByRole('presentation')
      await expect(photos).toHaveCount(3)
      for (const photo of await photos.all()) {
        await expect(photo).toHaveJSProperty('complete', true)
        await expect(photo).not.toHaveJSProperty('naturalWidth', 0)
      }
    })

    test('falls back to initials for a guest without avatar', async ({ page }) => {
      const eva = guestWithoutAvatar(page).getByRole('listitem').filter({ hasText: 'Eva' })
      await expect(eva.getByText('EE')).toBeVisible()
      await expect(eva.getByRole('presentation')).toHaveCount(0)
    })
  })

  test.describe('compact view', () => {
    test('shows the next visit, its guests and the totals', async ({ page }) => {
      const view = notOccupiedNext(page)
      await expect(view.getByRole('heading', { level: 2, name: 'Neste besøk om 14 dager' })).toBeVisible()
      await expect(view.getByText('20.–23. nov.')).toBeVisible()
      const guests = view.getByRole('list', { name: 'Gjester neste besøk' }).getByRole('listitem')
      await expect(guests).toHaveCount(2)
      await expect(guests.filter({ hasText: 'Anna' })).toBeVisible()
      await expect(guests.filter({ hasText: 'Dora' })).toBeVisible()
      await expect(view.getByText('Dora kommer tilbake etter 8 måneder.')).toBeVisible()
      await expect(view.getByRole('list', { name: 'Totalt' }).getByRole('listitem')).toHaveText([
        '120 besøk',
        '300 netter',
        '25 gjester',
      ])
    })

    test('rotates the cabin facts', async ({ page }) => {
      const view = notOccupiedNext(page)
      await expect(view.getByText('Hytta har vært besøkt 120 ganger.')).toBeVisible()
      await expect(view.getByText('Det er 300 netter totalt.')).toBeVisible()
    })
  })

  test('shows the config error when apiBaseUrl is missing', async ({ page }) => {
    await expect(page.getByRole('alert')).toHaveText('MMM-CabinStats: sett apiBaseUrl i config.js')
  })

  test('keeps the instances independent', async ({ page }) => {
    await expect(occupiedMixed(page)).toHaveCount(1)
    await expect(notOccupiedNext(page)).toHaveCount(1)
    await expect(occupiedMixed(page).getByRole('heading', { name: /^Neste besøk om/ })).toHaveCount(0)
    await expect(notOccupiedNext(page).getByRole('heading', { name: 'Velkommen til hytta' })).toHaveCount(0)
    await expect(notOccupiedNext(page).getByText('Carl')).toHaveCount(0)
    await expect(occupiedMixed(page).getByText('Dora kommer tilbake etter 8 måneder.')).toHaveCount(0)
  })

  test('shows nothing while the backend is down, recovers, and keeps the data on a later outage', async ({
    page,
    request,
  }) => {
    await request.post(`${mockBackend}/flaky/control/down`)
    await page.reload()
    await expect(occupiedMixed(page)).toBeVisible()
    await expect(notOccupiedNext(page)).toBeVisible()
    await expect(guestWithoutAvatar(page)).toBeVisible()
    await expect(regions(page)).toHaveCount(3)

    await request.post(`${mockBackend}/flaky/control/up`)
    await expect(flaky(page)).toBeVisible({ timeout: 10_000 })
    await expect(regions(page)).toHaveCount(4)

    await request.post(`${mockBackend}/flaky/control/down`)
    await page.waitForTimeout(3000)
    await expect(flaky(page)).toBeVisible()
  })
})
