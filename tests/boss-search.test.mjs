import assert from 'node:assert/strict'
import test from 'node:test'
import { bosses } from '../src/data.ts'
import { matchesBossSearch } from '../src/boss-search.ts'

test('God Wars aliases return exactly the requested five bosses', () => {
  const expected = ["Kree'arra", 'General Graardor', "K'ril Tsutsaroth", 'Commander Zilyana', 'Nex'].sort()
  for (const query of ['GW1', 'godwars', 'god wars', 'god wars 1', 'GWD1', '  GOD   WARS 1  ']) {
    assert.deepEqual(bosses.filter(boss => matchesBossSearch(boss.name, query)).map(boss => boss.name).sort(), expected)
  }
})

test('search ignores punctuation while retaining partial and multiple-term matching', () => {
  for (const query of ['kril', "k'ril", 'K’RIL', 'kril tsut', 'tsut kril', 'gw1 kril']) {
    assert.equal(matchesBossSearch("K'ril Tsutsaroth", query), true)
  }
  assert.equal(matchesBossSearch("Kree'arra", 'kreearra'), true)
  assert.equal(matchesBossSearch('Nex, Angel of Death', 'nex angel'), true)
  assert.equal(matchesBossSearch('General Graardor', 'kril'), false)
  assert.equal(matchesBossSearch('Nex', 'god wars 2'), false)
  assert.equal(matchesBossSearch('Nex', 'no such boss'), false)
  assert.equal(matchesBossSearch('Nex', '  '), true)
})

test('boss abbreviations, nicknames, and unspaced names resolve to the intended bosses', () => {
  const cases = [
    ['kbd', ['King Black Dragon']],
    ['qbd', ['Queen Black Dragon']],
    ['aod', ['Nex, Angel of Death']],
    ['kk', ['Kalphite King']],
    ['rax', ['Araxxor / Araxxi']],
    ['bandos', ['General Graardor']],
    ['arma', ["Kree'arra"]],
    ['sara', ['Commander Zilyana']],
    ['zammy', ["K'ril Tsutsaroth", 'Zamorak, Lord of Chaos']],
    ['archglacor', ['Arch-Glacor']],
    ['kingblackdragon', ['King Black Dragon']],
  ]
  for (const [query, expected] of cases) {
    assert.deepEqual(bosses.filter(boss => matchesBossSearch(boss.name, query)).map(boss => boss.name).sort(), expected.sort(), query)
  }
})

test('dungeon, location, and family aliases return their supported members', () => {
  const cases = [
    [['gw2', 'gwd2', 'god wars 2', 'godwars2', 'heart'], bosses.filter(boss => boss.group === 'Heart of Gielinor')],
    [['ed1', 'aminishi'], bosses.filter(boss => boss.area.startsWith('ED1'))],
    [['ed2', 'dragonkin laboratory'], bosses.filter(boss => boss.area.startsWith('ED2'))],
    [['ed3', 'shadow reef', 'shadowreef'], bosses.filter(boss => boss.area.startsWith('ED3'))],
    [['dag kings', 'dks', 'dagannoth'], bosses.filter(boss => boss.group === 'Dagannoth Kings')],
  ]
  for (const [queries, expected] of cases) {
    for (const query of queries) {
      assert.deepEqual(bosses.filter(boss => matchesBossSearch(boss.name, query)).map(boss => boss.name).sort(), expected.map(boss => boss.name).sort(), query)
    }
  }
  assert.equal(matchesBossSearch('Helwyr', 'gw2 hel'), true)
  assert.equal(matchesBossSearch('Gregorovic', 'gw2 hel'), false)
})

test('Elder God Wars aliases return exactly the four front bosses', () => {
  const expected = ['Kerapac, the bound', 'Arch-Glacor', 'Croesus', 'TzKal-Zuk'].sort()
  for (const query of ['gwd3', 'GW3', 'egwd', 'god wars 3', 'god wars dungeon 3', 'elder god wars', 'elder god wars dungeon']) {
    assert.deepEqual(bosses.filter(boss => matchesBossSearch(boss.name, query)).map(boss => boss.name).sort(), expected, query)
  }
})
