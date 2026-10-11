import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import translations from '../../translations/nb.json'

const root = new URL('../../', import.meta.url).pathname
const keys = new Set(Object.keys(translations))

function sourceFiles(): { file: string; text: string }[] {
  const sources = readdirSync(join(root, 'src/frontend')).map((name) => join(root, 'src/frontend', name))
  return [...sources, join(root, 'templates/MMM-CabinStats.njk')].map((file) => ({
    file,
    text: readFileSync(file, 'utf8'),
  }))
}

describe('translations/nb.json', () => {
  test('has every key the code and the template use', () => {
    const used = new Set<string>()
    for (const { text } of sourceFiles()) {
      for (const match of text.matchAll(/translate\('([A-Z][A-Z0-9_]+)'/g)) used.add(match[1])
      for (const match of text.matchAll(/'([A-Z][A-Z0-9_]+)'\s*\|\s*translate/g)) used.add(match[1])
    }
    expect(used.size).toBeGreaterThan(20)
    expect([...used].filter((key) => !keys.has(key))).toEqual([])
  })

  test('has the keys that are built at runtime', () => {
    const built = [
      ...Array.from({ length: 12 }, (_, index) => `MONTH_SHORT_${index + 1}`),
      'TILE_VISITSPERYEAR',
      'TILE_MAXPERMONTH',
      'TILE_YEARSWITHVISITS',
      'TILE_DAYS',
      'TILE_NIGHTS',
      'TILE_LONGESTSTAY',
      'TILE_VISITSTHISYEAR',
    ]
    expect(built.filter((key) => !keys.has(key))).toEqual([])
  })

  test('has no unused keys', () => {
    const text = sourceFiles()
      .map((source) => source.text)
      .join('\n')
    const runtime = /^(MONTH_SHORT_\d+|TILE_[A-Z_]+)$/
    expect([...keys].filter((key) => !runtime.test(key) && !text.includes(`'${key}'`))).toEqual([])
  })
})
