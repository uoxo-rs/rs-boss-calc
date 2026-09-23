// RuneScape Wiki: Revenant Spirit#Drop chance and Module:Revpet.
// Verified September 23, 2026. Artwork credits: public/revenants/CREDITS.md.
export const revenantSource =
  "https://runescape.wiki/w/Revenant_Spirit#Drop_chance";

export const revenantPets = [
  "None",
  "Imp",
  "Goblin",
  "Icefiend",
  "Pyrefiend",
  "Hobgoblin",
  "Vampyre",
  "Werewolf",
  "Cyclops",
  "Hellhound",
  "Demon",
  "Ork",
  "Dark beast",
  "Knight",
  "Dragon",
] as const;

export const revenants = [
  { name: "Dragon", level: 126, image: "dragon" },
  { name: "Knight", level: 119, image: "knight" },
  { name: "Dark beast", level: 112, image: "dark-beast" },
  { name: "Ork", level: 98, image: "ork" },
  { name: "Demon", level: 84, image: "demon" },
  { name: "Hellhound", level: 70, image: "hellhound" },
  { name: "Cyclops", level: 60, image: "cyclops" },
  { name: "Werewolf", level: 53, image: "werewolf" },
  { name: "Vampyre", level: 47, image: "vampyre" },
  { name: "Hobgoblin", level: 44, image: "hobgoblin" },
  { name: "Pyrefiend", level: 40, image: "pyrefiend" },
  { name: "Icefiend", level: 37, image: "icefiend" },
  { name: "Goblin", level: 28, image: "goblin" },
  { name: "Goblin", level: 22, image: "goblin" },
  { name: "Goblin", level: 19, image: "goblin" },
  { name: "Goblin", level: 16, image: "goblin" },
  { name: "Imp", level: 14, image: "imp" },
] as const;

export function revenantDenominator(
  petsOwned: number,
  combatLevel: number,
): number | null {
  if (
    !Number.isInteger(petsOwned) ||
    petsOwned < 0 ||
    petsOwned >= revenantPets.length
  ) {
    throw new RangeError("Select a pet stage from None through Dragon.");
  }
  if (!revenants.some((revenant) => revenant.level === combatLevel)) {
    throw new RangeError("Select a supported revenant combat level.");
  }
  // The Wiki calculator stops at Dragon: there is no next pet to unlock.
  if (petsOwned === revenantPets.length - 1) return null;
  return Math.floor(((petsOwned + 1) * 250 * 150) / combatLevel);
}

export const revenantStorageKey = "dropwise-revenant-pet";

export function readRevenantPet(): number {
  try {
    const saved = window.localStorage.getItem(revenantStorageKey);
    if (saved !== null && /^(?:[0-9]|1[0-4])$/.test(saved))
      return Number(saved);
  } catch {
    // Private browsing and unavailable storage should not prevent calculation.
  }
  return 0;
}

export function saveRevenantPet(petsOwned: number): void {
  try {
    window.localStorage.setItem(revenantStorageKey, String(petsOwned));
  } catch {
    // The current selection still works without persistent storage.
  }
}
