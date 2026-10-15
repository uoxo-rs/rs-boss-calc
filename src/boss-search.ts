// Aliases affect search only; the dropdown always displays the catalogue name.
const aliasGroups = [
  {
    names: ["Kree'arra", "General Graardor", "K'ril Tsutsaroth", "Commander Zilyana", "Nex"],
    terms: ["gw1", "gwd1", "godwars", "god wars", "godwars1", "god wars 1", "god wars dungeon", "god wars dungeon 1"],
  },
  {
    names: ["Gregorovic", "Twin Furies", "Vindicta", "Helwyr", "Telos, the Warden"],
    terms: ["gw2", "gwd2", "god wars 2", "god wars dungeon 2", "heart", "heart of gielinor"],
  },
  {
    names: ["Kerapac, the bound", "Arch-Glacor", "Croesus", "TzKal-Zuk"],
    terms: ["gw3", "gwd3", "egwd", "god wars 3", "god wars dungeon 3", "elder god wars", "elder god wars dungeon"],
  },
  {
    names: ["The Sanctum Guardian", "Masuta the Ascended", "Seiryu the Azure Serpent"],
    terms: ["ed1", "elite dungeon 1", "aminishi", "temple of aminishi"],
  },
  {
    names: ["Astellarn", "Verak Lith", "Black stone dragon"],
    terms: ["ed2", "elite dungeon 2", "dragonkin laboratory"],
  },
  {
    names: ["Crassian Leviathan", "Taraket the Necromancer", "The Ambassador"],
    terms: ["ed3", "elite dungeon 3", "shadow reef"],
  },
  {
    names: ["Dagannoth Rex", "Dagannoth Prime", "Dagannoth Supreme"],
    terms: ["dag kings", "dks", "dagannoth kings"],
  },
  { names: ["King Black Dragon"], terms: ["kbd"] },
  { names: ["Queen Black Dragon"], terms: ["qbd"] },
  { names: ["Nex, Angel of Death"], terms: ["aod"] },
  { names: ["Kalphite King"], terms: ["kk"] },
  { names: ["Araxxor / Araxxi"], terms: ["rax"] },
  { names: ["General Graardor"], terms: ["bandos"] },
  { names: ["Kree'arra"], terms: ["arma", "armadyl"] },
  { names: ["Commander Zilyana"], terms: ["sara", "saradomin"] },
  { names: ["K'ril Tsutsaroth", "Zamorak, Lord of Chaos"], terms: ["zammy", "zamorak"] },
];

function normalize(value: string): string {
  return value.normalize("NFKD").toLowerCase()
    .replace(/\p{M}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "");
}

export function matchesBossSearch(name: string, query: string): boolean {
  const compact = (value: string) => normalize(value).replace(/\s+/g, "");
  const compactQuery = compact(query);
  // Exact aliases take priority: "god wars" keeps its original GW1 meaning.
  const exactGroups = aliasGroups.filter(group => group.terms.some(term => compact(term) === compactQuery));
  if (exactGroups.length) return exactGroups.some(group => group.names.includes(name));
  const terms = normalize(query).trim().split(/\s+/).filter(Boolean);
  const aliases = aliasGroups.filter(group => group.names.includes(name)).flatMap(group => group.terms);
  const searchable = [name, ...aliases].map(compact);
  return terms.every(term => searchable.some(text => text.includes(term)));
}
