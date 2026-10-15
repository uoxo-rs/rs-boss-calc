import assert from 'node:assert/strict'
import test from 'node:test'
import { bosses } from '../src/data.ts'
import { dropOptions } from '../src/drop-options.ts'
import { probability } from '../src/probability.ts'
import { defaultPreferences, restorePreferences } from '../src/preferences.ts'

const boss = bosses.find(b => b.name === 'Arch-Glacor')
const normal = (mechanics, lootPiles) => boss.scenarios.find(s =>
  s.archGlacor?.mechanics === mechanics && s.archGlacor.lootPiles === lootPiles)
const drop = (scenario, name) => scenario.drops.find(d => d.name === name)
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`)

test('normal mode supports every valid mechanic and personal pile combination', () => {
  assert.equal(boss.scenarios.filter(s => s.archGlacor).length, 14)
  for (let mechanics = 0; mechanics <= 5; mechanics++) {
    for (let piles = 1; piles <= 3; piles++) {
      const scenario = normal(mechanics, piles)
      if (mechanics < 2 && piles > 1) {
        assert.equal(scenario, undefined)
        continue
      }
      assert.ok(scenario)
      assert.ok(scenario.drops.every(d => d.rolls === piles))
      const pet = drop(scenario, 'Gladys · Pet')
      assert.equal(pet.denominator, [18000, 15000, 12000, 9000, 6000, 3000][mechanics])
      assert.equal(pet.threshold, 500)
      close(probability(1, pet.denominator, 0, pet.threshold, pet.rolls), 1 - (1 - 1 / pet.denominator) ** piles)
    }
  }
})

test('normal pet rolls multiply by personal piles while thresholds advance by kills', () => {
  const pet = drop(normal(2, 2), 'Gladys · Pet')
  close(probability(2, pet.denominator, 499, pet.threshold, pet.rolls),
    1 - (1 - 1 / 12000) ** 2 * (1 - 2 / 12000) ** 2)
})

test('mechanics gate unique drops and nilas without hiding unavailable targets', () => {
  for (let mechanics = 0; mechanics <= 5; mechanics++) {
    const targets = dropOptions(boss, normal(mechanics, 1))
    for (const name of ['Leng artefact', 'Scripture of Wen']) {
      assert.equal(targets.find(d => d.name === name).available, mechanics === 5)
    }
    assert.equal(targets.find(d => d.name === 'Dark nilas').available, mechanics >= 2)
    assert.equal(targets.find(d => d.name === 'Frozen core of Leng').available, false)
  }
})

test('normal material rates use the selected mechanic table and both remnant slots', () => {
  const remnantChances = [0.1, 0.1, 0.09126, 0.090325, 0.08885, 0.08885]
  const nilasChances = [0, 0, 0.00099, 0.0018, 0.00315, 0.00315]
  for (let mechanics = 0; mechanics <= 5; mechanics++) {
    const scenario = normal(mechanics, 1)
    close(1 / drop(scenario, 'Glacor remnants').denominator, remnantChances[mechanics])
    assert.equal(drop(scenario, 'Manuscript of Wen').denominator, 25)
    if (mechanics >= 2) close(1 / drop(scenario, 'Dark nilas').denominator, nilasChances[mechanics])
  }
})

test('old normal-mode preferences retain the default and new settings survive reloads', () => {
  assert.equal(boss.scenarios[0].name, 'Normal mode · 5 mechanics · 3 loot piles')
  for (const scenario of boss.scenarios.filter(s => s.archGlacor)) {
    const saved = { ...defaultPreferences, boss: boss.name, scenario: scenario.name, drop: 'Gladys · Pet' }
    assert.deepEqual(restorePreferences(JSON.stringify(saved)), saved)
  }
  const savedUnavailable = { ...defaultPreferences, boss: boss.name, scenario: normal(0, 1).name, drop: 'Scripture of Wen' }
  assert.deepEqual(restorePreferences(JSON.stringify(savedUnavailable)), savedUnavailable)
})

test('hard-mode claim presets keep their rates and single-roll pet calculation', () => {
  const hardModes = boss.scenarios.filter(s => !s.archGlacor)
  assert.equal(hardModes.length, 6)
  for (const scenario of hardModes) {
    const pet = drop(scenario, 'Gladys · Pet')
    assert.equal(pet.denominator, 1000)
    assert.equal(pet.rolls ?? 1, 1)
    assert.equal(pet.threshold, 500)
    assert.ok(drop(scenario, 'Frozen core of Leng'))
    assert.equal(drop(scenario, 'Dark nilas').denominator, 100)
  }
})
