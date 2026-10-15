import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { loadComponent } from './helpers/load-component.mjs'
import { revenantStorageKey } from '../src/revenants.ts'
import { revenantRouteStorageKey } from '../src/revenant-route.ts'

const App = await loadComponent(new URL('../src/App.tsx', import.meta.url))

function render(pet = null, storageBlocked = false, route = null, hash = '#revenant-spirit') {
  const previousWindow = globalThis.window
  globalThis.window = {
    location: { hash },
    localStorage: { getItem: key => {
      if (storageBlocked) throw new Error('Storage disabled')
      if (key === revenantStorageKey) return pet
      return key === revenantRouteStorageKey ? route : null
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
  assert.match(html, /<h1>Revenant Spirit Calculator<\/h1>/)
  assert.match(html, /id="revenant-pet-value"><span>None<\/span><span class="pet-count">0\/14<\/span>/)
  assert.match(html, /role="combobox"[^>]*aria-expanded="false"/)
  assert.equal((html.match(/class="panel revenant-card"/g) ?? []).length, 17)
  assert.equal((html.match(/<img /g) ?? []).length, 17)
  // Pet combobox, plus native theme and route-add selectors.
  assert.equal((html.match(/role="combobox"/g) ?? []).length, 1)
  assert.equal((html.match(/<select /g) ?? []).length, 2)
  assert.equal((html.match(/role="option"/g) ?? []).length, 15)
  assert.doesNotMatch(html, /id="boss"|id="kills"/)
  assert.match(html, /1 in 2,678/)
  assert.match(html, /1 in 297/)
  assert.match(html, /0\.3367% per kill/)
  assert.match(html, /Overall drop fraction: <strong>1 \/ 305\.74<\/strong> per kill/)
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

test('the route example shows combined odds, planned laps, and explicit units', () => {
  const html = render()
  assert.match(html, /Route planner/)
  assert.match(html, /0\.6531%/)
  assert.match(html, /About 1 in 153\.1 laps/)
  assert.match(html, /2 kills per lap/)
  assert.match(html, /48\.07%/)
  assert.match(html, /within 100 laps/)
  assert.match(html, /200 total kills/)
  assert.match(html, /unused spirit/)
  assert.match(html, /id="route-kills-0"/)
  assert.match(html, /id="route-kills-1"/)
  assert.match(html, /<option value="126"/)
  assert.match(html, /<option value="119"/)
  for (const level of [16, 19, 22, 28]) assert.match(html, new RegExp(`<option value="${level}"`))
  assert.doesNotMatch(render('13'), /0\.6531%|48\.07%/)
  const complete = render('14')
  assert.match(complete, /There is no next spirit to plan for/)
  assert.doesNotMatch(complete, /id="route-laps"|Chance per lap|%<\/strong>/)
})

test('saved custom routes render their own kills and quantities', () => {
  const html = render(null, false, JSON.stringify({ entries: [{ level: 28, kills: '3' }], laps: '5' }))
  assert.match(html, /id="route-kills-0"[^>]*value="3"/)
  assert.match(html, /3 kills per lap/)
  assert.match(html, /15 total kills/)
  assert.match(html, /within 5 laps/)
  assert.doesNotMatch(html, /id="route-kills-1"/)
})

test('empty and invalid saved drafts explain what needs fixing without stale odds', () => {
  const empty = render(null, false, JSON.stringify({ entries: [], laps: '100' }))
  assert.match(empty, /Add a revenant to start building your route/)
  assert.doesNotMatch(empty, /About 1 in|total kills|Infinity|NaN/)
  const invalidKills = render(null, false, JSON.stringify({ entries: [{ level: 126, kills: '' }], laps: '100' }))
  assert.match(invalidKills, /id="route-kills-0"[^>]*aria-invalid="true"/)
  assert.match(invalidKills, /id="route-kills-error" role="alert"/)
  assert.doesNotMatch(invalidKills, /About 1 in|total kills|Infinity|NaN/)
  const invalidLaps = render(null, false, JSON.stringify({ entries: [{ level: 126, kills: '1' }], laps: '-5' }))
  assert.match(invalidLaps, /About 1 in 297\.0 laps/)
  assert.match(invalidLaps, /id="route-laps"[^>]*aria-invalid="true"/)
  assert.doesNotMatch(invalidLaps, /total kills|Infinity|NaN/)
})

test('ordered routes show repeated stops with unique controls and numbered move actions', () => {
  const saved = { entries: [126, 119, 98, 112, 126].map(level => ({ level, kills: '1' })), laps: '100' }
  const html = render(null, false, JSON.stringify(saved))
  const overview = html.match(/<ol class="revenant-route-sequence"[^>]*>(.*?)<\/ol>/)[1]
  assert.match(overview, /Dragon.*Knight.*Ork.*Dark beast.*Dragon/)
  assert.equal((overview.match(/Dragon/g) ?? []).length, 2)
  assert.equal((html.match(/class="revenant-route-entry"/g) ?? []).length, 5)
  const ids = [...html.matchAll(/id="(route-kills-\d+)"/g)].map(match => match[1])
  assert.equal(new Set(ids).size, 5)
  assert.match(html, /Move step 1 up: Revenant dragon" disabled=""/)
  assert.match(html, /Move step 5 down: Revenant dragon" disabled=""/)
  assert.match(html, /Remove step 5: Revenant dragon, level 126/)
  assert.match(html, /Copy route link/)
  assert.match(html, /Export text/)
  assert.match(html, /5 kills per lap/)
})

test('shared links open the revenant tab and override saved route and pet stage together', () => {
  const html = render('0', false, JSON.stringify({ entries: [{ level: 14, kills: '2' }], laps: '1' }),
    '#revenant-spirit?v=1&route=126.1-119.1-98.1-112.1-126.1&laps=75&pet=13')
  assert.match(html, /aria-current="page" href="#revenant-spirit"/)
  assert.match(html, /Shared route loaded/)
  assert.match(html, /id="revenant-pet-value"><span>Knight<\/span>/)
  assert.match(html, /5 kills per lap/)
  assert.match(html, /375 total kills/)
  assert.match(html, /within 75 laps/)
})

test('bad shared links explain the fallback and sharing is disabled for unfinished plans', () => {
  const html = render('0', false, JSON.stringify({ entries: [{ level: 28, kills: '3' }], laps: '5' }),
    '#revenant-spirit?v=99&route=126.1&laps=100&pet=0')
  assert.match(html, /This shared link could not be loaded/)
  assert.match(html, /15 total kills/)
  for (const route of [{ entries: [], laps: '100' }, { entries: [{ level: 126, kills: '1' }], laps: '' }]) {
    const draft = render(null, false, JSON.stringify(route))
    assert.match(draft, /disabled="">Copy route link/)
    assert.match(draft, /disabled="">Export text/)
  }
})

test('large plans never display a guaranteed drop', () => {
  const html = render(null, false, JSON.stringify({ entries: [{ level: 126, kills: '10000000' }], laps: '10000000' }))
  assert.match(html, /&gt;99\.99%/)
  assert.match(html, /A drop is never guaranteed/)
  assert.doesNotMatch(html, />100(?:\.0+)?%|NaN|Infinity/)
})
