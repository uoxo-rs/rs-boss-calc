import type { Scenario } from "./data.ts";

/** Normal-mode tables and Glacor core formula checked on 2026-10-14.
 * https://runescape.wiki/w/Arch-Glacor
 * https://runescape.wiki/w/Glacor_core
 */
export const archGlacorMaxPiles = (mechanics: number) => mechanics < 2 ? 1 : 3;

export const archGlacorNormalScenarios: Scenario[] = [5, 4, 3, 2, 1, 0].flatMap(
  (mechanics) =>
    Array.from({ length: archGlacorMaxPiles(mechanics) }, (_, index) => {
      const lootPiles = archGlacorMaxPiles(mechanics) - index;
      const nilasChance = mechanics === 2 ? 0.011 : mechanics === 3 ? 0.02 : 0.035;
      const remnantWeight = mechanics === 2 ? 36 : mechanics === 3 ? 34 : 32;
      return {
        name: `Normal mode · ${mechanics} ${mechanics === 1 ? "mechanic" : "mechanics"} · ${lootPiles} loot ${lootPiles === 1 ? "pile" : "piles"}`,
        archGlacor: { mechanics, lootPiles },
        note: `Normal mode with ${mechanics} enabled mechanics and ${lootPiles} personal loot ${lootPiles === 1 ? "pile" : "piles"} per kill. Each pile includes a pet roll. No luck or pontifex ring boost.`,
        drops: [
          ...(mechanics === 5
            ? ["Leng artefact", "Scripture of Wen"].map((name) => ({
                name, denominator: 500, rolls: lootPiles,
                note: "Only available with all five mechanics enabled in normal mode.",
              }))
            : []),
          ...(mechanics >= 2
            ? [{ name: "Dark nilas", denominator: 1 / (0.09 * nilasChance), rolls: lootPiles }]
            : []),
          {
            name: "Gladys · Pet",
            denominator: 18000 - mechanics * 3000,
            threshold: 500,
            rolls: lootPiles,
          },
          { name: "Manuscript of Wen", denominator: 25, rolls: lootPiles },
          {
            name: "Glacor remnants",
            denominator: mechanics < 2
              ? 10
              : 1 / (0.09 * (1 - nilasChance) + (0.005 * remnantWeight) / 80),
            rolls: lootPiles,
            note: mechanics < 2
              ? "Chance of a stack from the 0–1 mechanic drop table."
              : "Includes both remnant slots; calculates the chance of any stack in your selected loot piles.",
          },
        ],
      };
    }),
);
