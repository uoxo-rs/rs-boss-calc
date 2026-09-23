import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { revenantDenominator, revenants, revenantPets } from '../src/revenants.ts'

// Rate fixtures are in combat-level order, independent of the card display order.
const byLevel = [...revenants].sort((a, b) => a.level - b.level)

test('all 17 starting rates match the Wiki formula with the denominator rounded down', () => {
  const expected = [2678, 2343, 1973, 1704, 1339, 1013, 937, 852, 797, 707, 625, 535, 446, 382, 334, 315, 297]
  assert.deepEqual(byLevel.map(revenant => revenantDenominator(0, revenant.level)), expected)
})

test('pet stages count unlocks, with four separately calculated goblin variants', () => {
  assert.equal(revenantPets.indexOf('Goblin'), 2)
  assert.deepEqual(byLevel.filter(revenant => revenant.name === 'Goblin').map(revenant => revenantDenominator(2, revenant.level)), [7031, 5921, 5113, 4017])
  assert.equal(revenantDenominator(7, 126), 2380)
  assert.equal(revenantDenominator(13, 126), 4166) // Round after scaling, not 297 × 14.
  assert.equal(revenantDenominator(13, 14), 37500)
  for (const revenant of revenants) {
    for (let pets = 1; pets < 14; pets++) {
      assert.ok(revenantDenominator(pets, revenant.level) > revenantDenominator(pets - 1, revenant.level))
    }
    assert.equal(revenantDenominator(14, revenant.level), null)
  }
})

test('invalid stages and unsupported combat levels cannot produce plausible rates', () => {
  for (const pets of [-1, 15, 1.5, NaN]) assert.throws(() => revenantDenominator(pets, 126), RangeError)
  for (const level of [0, 15, Infinity, NaN]) assert.throws(() => revenantDenominator(0, level), RangeError)
})

test('every revenant has a bundled PNG image', async () => {
  for (const image of new Set(revenants.map(revenant => revenant.image))) {
    const file = await readFile(new URL(`../public/revenants/${image}.png`, import.meta.url))
    assert.equal(file.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', image)
  }
})
