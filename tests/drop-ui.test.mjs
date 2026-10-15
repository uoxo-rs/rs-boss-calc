import assert from 'node:assert/strict'
import test from 'node:test'
import { loadComponent } from './helpers/load-component.mjs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { defaultPreferences } from '../src/preferences.ts'

// Render the real component so a correct helper cannot mask an outdated select.
const App = await loadComponent(new URL('../src/App.tsx', import.meta.url))

function render(preferences) {
  const previousWindow = globalThis.window
  globalThis.window = { localStorage: { getItem: () => preferences ? JSON.stringify({ ...defaultPreferences, ...preferences }) : null } }
  try { return renderToStaticMarkup(createElement(App)) }
  finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
}

test('dryness card uses completed kills and the selected custom rate', () => {
  const html = render({ boss: 'Nakatra, Devourer Eternal', scenario: 'Hard mode', drop: 'Shard of Genesis Essence', current: '1000', customRate: '512', customThreshold: '0' })
  assert.match(html, /How dry is your hunt\?/)
  assert.match(html, /14\.16%/)
  assert.match(html, /85\.84%/)
  assert.match(html, /1\.95/)
  assert.match(html, /Assumes no Shard of Genesis Essence/)
})

test('rendered normal-mode dropdown exposes the shard and preserves an incompatible saved target', () => {
  const html = render({ boss: 'Nakatra, Devourer Eternal', scenario: 'Normal mode', drop: 'Shard of Genesis Essence' })
  assert.match(html, /<option value="Shard of Genesis Essence" selected="">Shard of Genesis Essence — unavailable in this scenario<\/option>/)
  assert.match(html, /id="drop" aria-invalid="true"/)
  assert.match(html, /Drop unavailable in this encounter/)
  assert.match(html, /Available in: Hard mode/)
  assert.doesNotMatch(html, /chance of at least one drop/)
})

test('rendered compatible mode calculates the saved shard at the Wiki rate', () => {
  const html = render({ boss: 'Nakatra, Devourer Eternal', scenario: 'Hard mode', drop: 'Shard of Genesis Essence', kills: '1' })
  assert.match(html, /<option value="Shard of Genesis Essence" selected="">Shard of Genesis Essence<\/option>/)
  assert.match(html, /1 \/ 75/)
  assert.match(html, /1\.33%/)
  assert.match(html, /chance of at least one drop/)
  assert.doesNotMatch(html, /Drop unavailable in this encounter/)
})

test('unknown-rate selection renders an explanation without odds or a false mode error', () => {
  const html = render({ boss: 'Commander Zilyana', scenario: 'Normal mode', drop: "Saradomin's hum" })
  assert.match(html, /Drop rate not modelled/)
  assert.match(html, /without a confirmed numerical rate/)
  assert.doesNotMatch(html, /chance of at least one drop|Drop unavailable in this encounter/)
})

test('a first visit still begins with no boss selected', () => {
  const html = render(null)
  assert.match(html, /<option value="-1" selected="">Select a boss/)
  assert.match(html, /Choose your next hunt/)
  assert.doesNotMatch(html, /id="drop"/)
})

test('multiple plans render exact comparison probabilities and three numbered graph markers', () => {
  const html = render({ boss: 'Nakatra, Devourer Eternal', scenario: 'Hard mode', drop: 'Shard of Genesis Essence', kills: '50, 100, 500' })
  assert.equal((html.match(/class="plan-marker-label"/g) ?? []).length, 3)
  for (const count of [50, 100, 500]) {
    const chance = ((1 - (1 - 1 / 75) ** count) * 100).toFixed(2)
    assert.ok(html.includes(`${count} kills: ${chance}%`))
    assert.ok(html.includes(`<td>${chance}%</td>`))
  }
  assert.match(html, /in your next <strong>500 kills<\/strong>/)
  assert.match(html, /id="kills" type="text"/)
  assert.match(html, /stroke="#67e8f9"/)
})

test('an unfinished comparison list shows validation instead of misleading partial odds', () => {
  const html = render({ boss: 'Nakatra, Devourer Eternal', scenario: 'Hard mode', drop: 'Shard of Genesis Essence', kills: '50, 100,' })
  assert.match(html, /Enter up to 10 comma-separated planned kill counts/)
  assert.doesNotMatch(html, /class="plan-table"|chance of at least one drop/)
})

test('Arch-Glacor renders separate mechanics and pile controls and uses both for pet odds', () => {
  const html = render({ boss: 'Arch-Glacor', scenario: 'Normal mode · 2 mechanics · 2 loot piles', drop: 'Gladys · Pet', kills: '100', current: '499' })
  assert.match(html, /id="arch-glacor-mechanics"><option value="0">0 mechanics<\/option><option value="1">1 mechanic<\/option><option value="2" selected="">2 mechanics/)
  assert.match(html, /id="arch-glacor-piles" aria-describedby="arch-glacor-piles-help"><option value="1">1 loot pile<\/option><option value="2" selected="">2 loot piles<\/option><option value="3">3 loot piles/)
  assert.match(html, /1 \/ 12,000/)
  assert.match(html, /2 independent rolls per kill/)
  const expected = ((1 - (1 - 1 / 12000) ** 2 * (1 - 2 / 12000) ** 198) * 100).toFixed(2)
  assert.ok(html.includes(`<div class="big-percent">${expected}%</div>`))
  const scenarios = html.match(/<select id="scenario">(.*?)<\/select>/)[1]
  assert.equal((scenarios.match(/<option/g) ?? []).length, 7)
  assert.match(scenarios, /<option value="0" selected="">Normal mode<\/option>/)
})

test('zero mechanics restricts piles to one and explains unavailable unique drops', () => {
  const html = render({ boss: 'Arch-Glacor', scenario: 'Normal mode · 0 mechanics · 1 loot pile', drop: 'Scripture of Wen' })
  const piles = html.match(/<select id="arch-glacor-piles"[^>]*>(.*?)<\/select>/)[1]
  assert.equal(piles, '<option value="1" selected="">1 loot pile</option>')
  assert.match(html, /Scripture of Wen — unavailable in this scenario/)
  assert.match(html, /Drop unavailable in this encounter/)
  assert.doesNotMatch(html, /chance of at least one drop/)
})

test('Arch-Glacor custom per-kill rates do not get multiplied by personal piles', () => {
  const html = render({ boss: 'Arch-Glacor', scenario: 'Normal mode · 5 mechanics · 3 loot piles', drop: 'Gladys · Pet', kills: '1', customRate: '100', customThreshold: '0' })
  assert.match(html, /Current custom rate \/ kill/)
  assert.match(html, /<div class="big-percent">1\.00%<\/div>/)
  assert.doesNotMatch(html, /3 independent rolls per kill/)
})

test('hard mode omits normal-mode configuration and retains its pet odds', () => {
  const html = render({ boss: 'Arch-Glacor', scenario: 'Hard mode · 0% enrage · claim every kill', drop: 'Gladys · Pet', kills: '1' })
  assert.doesNotMatch(html, /id="arch-glacor-mechanics"|id="arch-glacor-piles"/)
  assert.match(html, /<div class="big-percent">0\.10%<\/div>/)
})

test('pet fractions use current KC at threshold boundaries and keep a numerator of one', () => {
  for (const [current, denominator] of [['0', '3,000'], ['499', '3,000'], ['500', '1,500'], ['1000', '1,000'], ['4500', '300'], ['100000', '300']]) {
    const html = render({ boss: 'Arch-Glacor', scenario: 'Normal mode · 5 mechanics · 3 loot piles', drop: 'Gladys · Pet', current })
    assert.match(html, /Current rate \/ roll/)
    assert.ok(html.includes(`<strong aria-live="polite">1 / ${denominator}</strong>`))
    assert.match(html, /3 independent rolls per kill/)
  }
})

test('single-roll pets display fractional denominators without changing their calculated odds', () => {
  const html = render({ boss: 'Arch-Glacor', scenario: 'Hard mode · 0% enrage · claim every kill', drop: 'Gladys · Pet', current: '1000', kills: '1' })
  assert.match(html, /Current rate \/ kill/)
  assert.match(html, /<strong aria-live="polite">1 \/ 333\.333<\/strong>/)
  assert.match(html, /For your next kill at 1,000 completed kills/)
  assert.match(html, /<div class="big-percent">0\.30%<\/div>/)
})

test('pet fractions respect custom thresholds and cap the displayed chance at one', () => {
  for (const [customRate, customThreshold, expected] of [['1200', '100', '200'], ['1200', '0', '1,200'], ['2', '100', '1']]) {
    const html = render({ boss: 'Arch-Glacor', scenario: 'Normal mode · 5 mechanics · 3 loot piles', drop: 'Gladys · Pet', current: '500', customRate, customThreshold })
    assert.match(html, /Current custom rate \/ kill/)
    assert.ok(html.includes(`<strong aria-live="polite">1 / ${expected}</strong>`))
  }
})

test('current pet fractions remain available while planned kills are being edited', () => {
  const html = render({ boss: 'Arch-Glacor', scenario: 'Normal mode · 5 mechanics · 3 loot piles', drop: 'Gladys · Pet', current: '500', kills: '50,' })
  assert.match(html, /<strong aria-live="polite">1 \/ 1,500<\/strong>/)
  assert.match(html, /Enter up to 10 comma-separated planned kill counts/)
})

test('invalid current KC does not display a misleading pet fraction', () => {
  for (const current of ['', '-1', '0.5', '10000001', 'invalid']) {
    const html = render({ boss: 'Arch-Glacor', scenario: 'Normal mode · 5 mechanics · 3 loot piles', drop: 'Gladys · Pet', current })
    assert.match(html, /<strong aria-live="polite">—<\/strong>/)
    assert.match(html, /Enter a valid current kill count, rate and threshold to see current odds/)
  }
})

test('fixed drops retain their base rate regardless of current KC', () => {
  const html = render({ boss: 'Arch-Glacor', scenario: 'Normal mode · 5 mechanics · 3 loot piles', drop: 'Scripture of Wen', current: '10000' })
  assert.match(html, /Base rate \/ roll/)
  assert.match(html, /<strong aria-live="polite">1 \/ 500<\/strong>/)
  assert.doesNotMatch(html, /Current rate \/ roll|Includes your pet threshold boost/)
})
