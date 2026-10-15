import { afterEach, describe, expect, test, vi } from 'vitest'
import { updateGuestOverlayFact } from '../../src/frontend/guestOverlay'
import { FactView } from '../../src/frontend/factView'

/** The little of the DOM that `updateGuestOverlayFact` touches, as there is no DOM in the unit tests. */
type FakeNode = { text?: string; tag?: string; className?: string; textContent?: string }

function fakeDocument() {
  const element = {
    classes: new Set(['cabin-fade-in']),
    offsetWidth: 0,
    children: [] as FakeNode[],
    classList: {
      add: (name: string) => element.classes.add(name),
      remove: (name: string) => element.classes.delete(name),
    },
    replaceChildren: (...nodes: FakeNode[]) => {
      element.children = nodes
    },
  }
  vi.stubGlobal('document', {
    createTextNode: (text: string): FakeNode => ({ text }),
    createElement: (tag: string): FakeNode => ({ tag }),
  })
  return element
}

const overlayWith = (element: unknown) => ({ querySelector: () => element }) as unknown as ParentNode

describe('updateGuestOverlayFact', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('shows plain parts as text nodes and highlighted parts as spans, all set as text', () => {
    const element = fakeDocument()
    const fact: FactView = {
      text: 'Hei <b>Dina</b>, 12 måneder',
      segments: [
        { text: 'Hei ', kind: 'text' },
        { text: '<b>Dina</b>', kind: 'guest' },
        { text: ', ', kind: 'text' },
        { text: '12 måneder', kind: 'stat' },
      ],
    }

    updateGuestOverlayFact(overlayWith(element), fact)

    expect(element.children).toEqual([
      { text: 'Hei ' },
      { tag: 'span', className: 'cabin-highlight cabin-highlight-guest', textContent: '<b>Dina</b>' },
      { text: ', ' },
      { tag: 'span', className: 'cabin-highlight cabin-highlight-stat', textContent: '12 måneder' },
    ])
    expect(element.classes.has('cabin-fade-in')).toBe(true)
  })

  test('does nothing without a fact element in the overlay', () => {
    fakeDocument()
    expect(() => updateGuestOverlayFact(overlayWith(null), { text: 'a', segments: [] })).not.toThrow()
  })
})
