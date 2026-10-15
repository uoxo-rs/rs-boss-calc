import assert from 'node:assert/strict'
import test from 'node:test'
import { revenants } from '../src/revenants.ts'
import {
  maxRouteCount, maxRouteSteps, parseRouteCount, revenantRouteOdds, moveRouteStep,
  readRevenantRoute, restoreRevenantRoute, saveRevenantRoute, revenantRouteStorageKey,
  createRevenantRouteLink, parseSharedRevenantRoute, exportRevenantRouteText,
} from '../src/revenant-route.ts'

const example = [{ level: 126, kills: 1 }, { level: 119, kills: 1 }]
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`)

test('Dragon + Knight gives the agreed per-lap and 100-lap chances', () => {
  const result = revenantRouteOdds(0, example, 100)
  close(result.chancePerLap, 0.006530917642028733)
  close(1 / result.chancePerLap, (297 * 315) / (297 + 315 - 1))
  close(result.chanceForPlan, 0.4806793374053213)
  assert.equal(result.killsPerLap, 2)
  assert.equal(result.totalKills, 200)
})

test('quantities and repeated laps match explicit misses; order does not change odds', () => {
  const entries = [{ level: 126, kills: 3 }, { level: 119, kills: 2 }]
  const result = revenantRouteOdds(0, entries, 7)
  close(result.chancePerLap, 1 - (296 / 297) ** 3 * (314 / 315) ** 2)
  close(result.chanceForPlan, 1 - (296 / 297) ** 21 * (314 / 315) ** 14)
  assert.equal(result.totalKills, 35)
  const reversed = revenantRouteOdds(0, [...entries].reverse(), 7)
  close(reversed.chancePerLap, result.chancePerLap)
  close(reversed.chanceForPlan, result.chanceForPlan)
  const single = revenantRouteOdds(0, [{ level: 126, kills: 1 }], 1)
  close(single.chancePerLap, 1 / 297)
  close(single.chanceForPlan, single.chancePerLap)
})

test('selected pet stage and all four goblin variants use their own rounded rates', () => {
  const later = revenantRouteOdds(13, example, 100)
  close(later.chancePerLap, 1 - (1 - 1 / 4166) * (1 - 1 / 4411))
  assert.ok(later.chanceForPlan < revenantRouteOdds(0, example, 100).chanceForPlan)
  const goblins = [16, 19, 22, 28].map(level => ({ level, kills: 1 }))
  close(revenantRouteOdds(2, goblins, 1).chancePerLap,
    1 - [7031, 5921, 5113, 4017].reduce((miss, denominator) => miss * (1 - 1 / denominator), 1))
})

test('overall fraction weights every kill and repeated stop, independent of planned laps', () => {
  const entries = [{ level: 126, kills: 2 }, { level: 119, kills: 1 }, { level: 126, kills: 1 }]
  const expected = 4 / (3 / 297 + 1 / 315)
  close(revenantRouteOdds(0, entries, 1).overallDenominator, expected)
  close(revenantRouteOdds(0, entries, 100).overallDenominator, expected)
  close(revenantRouteOdds(0, [{ level: 126, kills: 20 }], 1).overallDenominator, 297)
  close(revenantRouteOdds(13, entries, 1).overallDenominator, 4 / (3 / 4166 + 1 / 4411))
})

test('empty routes and completed collections cannot suggest a further unlock', () => {
  assert.deepEqual(revenantRouteOdds(0, [], 100), {
    killsPerLap: 0, totalKills: 0, overallDenominator: null, chancePerLap: 0, chanceForPlan: 0,
  })
  assert.equal(revenantRouteOdds(14, example, 100), null)
  assert.equal(revenantRouteOdds(14, [], 100), null)
})

test('invalid counts, levels, and pet stages cannot produce plausible odds', () => {
  for (const invalid of [0, -1, 0.5, NaN, Infinity, maxRouteCount + 1]) {
    assert.throws(() => revenantRouteOdds(0, example, invalid), RangeError)
    assert.throws(() => revenantRouteOdds(0, [{ level: 126, kills: invalid }], 1), RangeError)
  }
  assert.throws(() => revenantRouteOdds(0, [{ level: 15, kills: 1 }], 1), RangeError)
  for (const stage of [-1, 15, 1.5, NaN]) {
    assert.throws(() => revenantRouteOdds(stage, [], 1), RangeError)
  }
  for (const value of ['', ' ', '1.5', '-1', '0', '1e3', '1,000', 'NaN', '10000001']) {
    assert.equal(parseRouteCount(value), null)
  }
  assert.equal(parseRouteCount('001'), 1)
  assert.equal(parseRouteCount('10000000'), maxRouteCount)
})

test('large routes stay finite and a rare single roll retains precision', () => {
  const huge = revenantRouteOdds(0, revenants.map(({ level }) => ({ level, kills: maxRouteCount })), maxRouteCount)
  assert.equal(huge.totalKills, 1_700_000_000_000_000)
  assert.equal(huge.chancePerLap, 1)
  assert.equal(huge.chanceForPlan, 1)
  close(revenantRouteOdds(13, [{ level: 14, kills: 1 }], 1).chancePerLap, 1 / 37500)
})

test('saved routes preserve quantities, goblin levels, input drafts, and intentionally empty routes', () => {
  const saved = { entries: [{ level: 16, kills: '3' }, { level: 28, kills: '2' }], laps: '75' }
  assert.deepEqual(restoreRevenantRoute(JSON.stringify(saved)), saved)
  const empty = { entries: [], laps: '100' }
  assert.deepEqual(restoreRevenantRoute(JSON.stringify(empty)), empty)
  const draft = { entries: [{ level: 126, kills: '' }], laps: '-5' }
  assert.deepEqual(restoreRevenantRoute(JSON.stringify(draft)), draft)
})

test('corrupt, oversized, and unsupported saved routes fall back to Dragon + Knight', () => {
  const expected = { entries: [{ level: 126, kills: '1' }, { level: 119, kills: '1' }], laps: '100' }
  for (const raw of [null, '', '{', 'null', '[]', '42', '{}',
    JSON.stringify({ ...expected, entries: [{ level: 15, kills: '1' }] }),
    JSON.stringify({ ...expected, entries: Array.from({ length: maxRouteSteps + 1 }, () => ({ level: 126, kills: '1' })) }),
    JSON.stringify({ ...expected, entries: [null] }),
    JSON.stringify({ ...expected, entries: [{ level: 126, kills: 1 }] }),
    JSON.stringify({ ...expected, laps: null }),
    JSON.stringify({ ...expected, laps: '1'.repeat(101) }),
  ]) assert.deepEqual(restoreRevenantRoute(raw), expected)
})

const orderedRoute = {
  entries: [126, 119, 98, 112, 126].map(level => ({ level, kills: '1' })),
  laps: '100',
}

test('repeated stops preserve order and count every kill toward the combined chance', () => {
  assert.deepEqual(restoreRevenantRoute(JSON.stringify(orderedRoute)), orderedRoute)
  const result = revenantRouteOdds(0, orderedRoute.entries.map(({ level }) => ({ level, kills: 1 })), 100)
  close(result.chancePerLap, 1 - (296 / 297) ** 2 * (314 / 315) * (381 / 382) * (333 / 334))
  assert.equal(result.killsPerLap, 5)
  assert.equal(result.totalKills, 500)
  const moved = moveRouteStep(orderedRoute.entries, 4, 1)
  assert.deepEqual(moved.map(entry => entry.level), [126, 126, 119, 98, 112])
  assert.deepEqual(orderedRoute.entries.map(entry => entry.level), [126, 119, 98, 112, 126])
  assert.equal(moved[1], orderedRoute.entries[4])
  close(revenantRouteOdds(0, moved.map(({ level }) => ({ level, kills: 1 })), 100).chancePerLap, result.chancePerLap)
  for (const [from, to] of [[-1, 0], [0, 5], [1.5, 2]]) {
    assert.deepEqual(moveRouteStep(orderedRoute.entries, from, to), orderedRoute.entries)
  }
})

test('share links round-trip order, repeated stops, quantities, pet stage, and laps', () => {
  const route = { entries: [...orderedRoute.entries, { level: 16, kills: '3' }, { level: 28, kills: '2' }], laps: '250' }
  const url = new URL(createRevenantRouteLink('https://example.com/rs-boss-calc/?old=1#calculator', route, 13))
  assert.equal(url.pathname, '/rs-boss-calc/')
  assert.equal(url.search, '')
  assert.deepEqual(parseSharedRevenantRoute(url.hash), { status: 'valid', route, petsOwned: 13 })
  const padded = createRevenantRouteLink(url.href, { entries: [{ level: 126, kills: '00000000001' }], laps: '00100' }, 0)
  assert.deepEqual(parseSharedRevenantRoute(new URL(padded).hash).route, { entries: [{ level: 126, kills: '1' }], laps: '100' })
  const maximum = { entries: Array.from({ length: maxRouteSteps }, () => ({ level: 126, kills: String(maxRouteCount) })), laps: String(maxRouteCount) }
  assert.equal(parseSharedRevenantRoute(new URL(createRevenantRouteLink(url.href, maximum, 0)).hash).status, 'valid')
  assert.equal(revenantRouteOdds(0, maximum.entries.map(({ level, kills }) => ({ level, kills: Number(kills) })), maxRouteCount).totalKills, 5_000_000_000_000_000)
})

test('invalid and future-version links are rejected without silently truncating the route', () => {
  const valid = '#revenant-spirit?v=1&route=126.1-119.1&laps=100&pet=0'
  for (const hash of [
    valid.replace('v=1', 'v=2'), valid.replace('126.1', '15.1'),
    valid.replace('126.1', '126.0'), valid.replace('126.1', '126.10000001'),
    valid.replace('126.1', '126.1.5'), valid.replace('route=126.1-119.1', 'route='),
    valid.replace('laps=100', 'laps=0'), valid.replace('laps=100', 'laps=1e3'),
    valid.replace('pet=0', 'pet=15'), valid.replace('pet=0', 'pet=-1'),
    valid.replace('&pet=0', ''), `${valid}&route=126.1`, `${valid}&pet=1`,
    valid.replace('route=126.1-119.1', `route=${Array(maxRouteSteps + 1).fill('126.1').join('-')}`),
    '#revenant-spirit?route=%E0%A4%A', '#revenant-spirit?' + 'x'.repeat(2000),
  ]) assert.deepEqual(parseSharedRevenantRoute(hash), { status: 'invalid' }, hash)
  for (const hash of ['', '#calculator', '#revenant-spirit']) {
    assert.deepEqual(parseSharedRevenantRoute(hash), { status: 'none' })
  }
  assert.throws(() => createRevenantRouteLink('https://example.com', { entries: [], laps: '100' }, 0), RangeError)
  assert.throws(() => createRevenantRouteLink('https://example.com', { ...orderedRoute, laps: '' }, 0), RangeError)
})

test('text exports retain exact repeated-stop instructions and a link to reopen the plan', () => {
  const route = { entries: [...orderedRoute.entries, { level: 16, kills: '2' }, { level: 28, kills: '1' }], laps: '50' }
  const text = exportRevenantRouteText('https://example.com/rs-boss-calc/', route, 0)
  assert.match(text, /Dragon → Knight → Ork → Dark beast → Dragon → Goblin \(level 16\) ×2 → Goblin \(level 28\)/)
  assert.match(text, /1\. Revenant dragon \(level 126\) — 1 kill/)
  assert.match(text, /5\. Revenant dragon \(level 126\) — 1 kill/)
  assert.match(text, /6\. Revenant goblin \(level 16\) — 2 consecutive kills/)
  assert.match(text, /Current pet: None \(0\/14 unlocked\)/)
  assert.match(text, /Kills per lap: 8\nTotal kills: 400/)
  const link = text.match(/Open this route: (.+)/)[1]
  assert.deepEqual(parseSharedRevenantRoute(new URL(link).hash), { status: 'valid', route, petsOwned: 0 })
  const exampleText = exportRevenantRouteText('https://example.com', { entries: example.map(({ level }) => ({ level, kills: '1' })), laps: '100' }, 0)
  assert.match(exampleText, /per lap: 0\.6531%/)
  assert.match(exampleText, /planned laps: 48\.07%/)
})

test('browser storage round-trips routes and failures leave the calculator usable', () => {
  const previousWindow = globalThis.window
  try {
    const storage = new Map()
    globalThis.window = { localStorage: {
      getItem: key => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
    } }
    const saved = { entries: [{ level: 119, kills: '3' }], laps: '500' }
    saveRevenantRoute(saved)
    assert.ok(storage.has(revenantRouteStorageKey))
    assert.deepEqual(readRevenantRoute(), saved)
    globalThis.window = { get localStorage() { throw new Error('Storage disabled') } }
    assert.deepEqual(readRevenantRoute(), restoreRevenantRoute(null))
    assert.doesNotThrow(() => saveRevenantRoute(saved))
  } finally {
    if (previousWindow === undefined) delete globalThis.window
    else globalThis.window = previousWindow
  }
})
