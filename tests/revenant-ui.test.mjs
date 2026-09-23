import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadComponent } from './helpers/load-component.mjs'
import { revenantStorageKey } from '../src/revenants.ts'

const App = await loadComponent(new URL('../src/App.tsx', import.meta.url))

function render(pet = null, storageBlocked = false) {
  const previousWindow = globalThis.window
  globalThis.window = {
    location: { hash: '#revenant-spirit' },
    localStorage: { getItem: key => {
      if (storageBlocked) throw new Error('Storage disabled')
      return key === revenantStorageKey ? pet : null
    } },
  }
  try { return renderToStaticMarkup(createElement(App)) }
  finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
}

test('the linked tab renders a single pet selector and all revenant images and rates', () => {
  const html = render()
  assert.match(html, /aria-current="page" href="#revenant-spirit"/)
  assert.match(html, /href="#calculator"/)
  assert.match(html, /<h1>Revenant Spirit Calc<\/h1>/)
  assert.match(html, /id="revenant-pet-value"><span>None<\/span><span class="pet-count">0\/14<\/span>/)
  assert.match(html, /role="combobox"[^>]*aria-expanded="false"/)
  assert.equal((html.match(/class="panel revenant-card"/g) ?? []).length, 17)
  assert.equal((html.match(/<img /g) ?? []).length, 17)
  // One calculator combobox, plus the app's existing native theme selector.
  assert.equal((html.match(/role="combobox"/g) ?? []).length, 1)
  assert.equal((html.match(/<select /g) ?? []).length, 1)
  assert.equal((html.match(/role="option"/g) ?? []).length, 15)
  assert.doesNotMatch(html, /id="boss"|id="kills"/)
  assert.match(html, /1 in 2,678/)
  assert.match(html, /1 in 297/)
  assert.match(html, /0\.3367% per kill/)
  for (const level of [16, 19, 22, 28]) assert.match(html, new RegExp(`Combat level ${level}`))
})

test('saved pet selection determines the next unlock and updates the per-kill chances', () => {
  const html = render('13')
  assert.match(html, /id="revenant-pet-value"><span>Knight<\/span><span class="pet-count">13\/14<\/span>/)
  assert.match(html, /Next unlock: Revenant dragon/)
  assert.match(html, /1 in 4,166/)
  assert.match(html, /0\.0240% per kill/)
})

test('Dragon has a completion state without misleading further unlock rates', () => {
  const html = render('14')
  assert.match(html, /Dragon is the final pet/)
  assert.equal((html.match(/<strong>Complete<\/strong>/g) ?? []).length, 17)
  assert.doesNotMatch(html, /1 in [0-9]|% per kill|Next unlock:/)
})

test('missing, corrupt, or unavailable storage defaults to no pets', () => {
  for (const invalid of [null, '', '15', '-1', '2.5', 'garbage']) {
    assert.match(render(invalid), /id="revenant-pet-value"><span>None<\/span><span class="pet-count">0\/14<\/span>/)
  }
  assert.match(render(null, true), /1 in 297/)
})
