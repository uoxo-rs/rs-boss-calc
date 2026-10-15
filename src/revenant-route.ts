import { revenantDenominator, revenantPets, revenants } from "./revenants.ts";

export const maxRouteCount = 10_000_000;
export const maxRouteSteps = 50;
export const revenantRouteStorageKey = "dropwise-revenant-route.v1";

export type RevenantRoute = {
  entries: { level: number; kills: string }[];
  laps: string;
};

export type SharedRevenantRoute =
  | { status: "none" }
  | { status: "invalid" }
  | { status: "valid"; route: RevenantRoute; petsOwned: number };

function defaultRoute(): RevenantRoute {
  return {
    entries: [{ level: 126, kills: "1" }, { level: 119, kills: "1" }],
    laps: "100",
  };
}

export function parseRouteCount(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const count = Number(value);
  return Number.isSafeInteger(count) && count >= 1 && count <= maxRouteCount
    ? count
    : null;
}

export function revenantRouteOdds(
  petsOwned: number,
  entries: readonly { level: number; kills: number }[],
  laps: number,
) {
  const validCount = (value: number) =>
    Number.isSafeInteger(value) && value >= 1 && value <= maxRouteCount;
  if (!validCount(laps)) throw new RangeError("Enter valid planned laps.");
  if (entries.length > maxRouteSteps) throw new RangeError("Use at most 50 route steps.");
  // Validate the pet stage even when the route is empty.
  const complete = revenantDenominator(petsOwned, revenants[0].level) === null;
  let killsPerLap = 0;
  let expectedSpiritsPerLap = 0;
  let logMissPerLap = 0;
  for (const { level, kills } of entries) {
    if (!validCount(kills)) throw new RangeError("Enter valid kills per lap.");
    const denominator = revenantDenominator(petsOwned, level);
    killsPerLap += kills;
    if (denominator !== null) {
      expectedSpiritsPerLap += kills / denominator;
      logMissPerLap += kills * Math.log1p(-1 / denominator);
    }
  }
  const totalKills = killsPerLap * laps;
  if (!Number.isSafeInteger(totalKills)) {
    throw new RangeError("The route contains too many kills.");
  }
  if (complete) return null;
  // Target the first spirit: every miss leaves the selected pet stage unchanged.
  // Work in log space so large plans and small per-kill chances stay stable.
  return {
    killsPerLap,
    totalKills,
    // Average the per-kill probabilities, weighted by the route's quantities.
    overallDenominator: expectedSpiritsPerLap > 0 ? killsPerLap / expectedSpiritsPerLap : null,
    chancePerLap: logMissPerLap === 0 ? 0 : -Math.expm1(logMissPerLap),
    chanceForPlan: logMissPerLap === 0 ? 0 : -Math.expm1(laps * logMissPerLap),
  };
}

export function restoreRevenantRoute(raw: string | null): RevenantRoute {
  try {
    const saved = JSON.parse(raw ?? "null");
    const isText = (value: unknown): value is string =>
      typeof value === "string" && value.length <= 100;
    if (
      !saved ||
      !Array.isArray(saved.entries) ||
      saved.entries.length > maxRouteSteps ||
      !isText(saved.laps)
    ) return defaultRoute();
    const entries: RevenantRoute["entries"] = [];
    for (const entry of saved.entries) {
      if (
        !entry ||
        !revenants.some((revenant) => revenant.level === entry.level) ||
        !isText(entry.kills)
      ) return defaultRoute();
      entries.push({ level: entry.level, kills: entry.kills });
    }
    return { entries, laps: saved.laps };
  } catch {
    return defaultRoute();
  }
}

export function readRevenantRoute(): RevenantRoute {
  try {
    return restoreRevenantRoute(window.localStorage.getItem(revenantRouteStorageKey));
  } catch {
    return defaultRoute();
  }
}

export function saveRevenantRoute(route: RevenantRoute): void {
  try {
    // Step IDs are only for the editor; persist the sequence itself.
    const entries = route.entries.map(({ level, kills }) => ({ level, kills }));
    window.localStorage.setItem(revenantRouteStorageKey, JSON.stringify({ entries, laps: route.laps }));
  } catch {
    // Keep the route usable when browser storage is unavailable.
  }
}

export function moveRouteStep<T>(entries: readonly T[], from: number, to: number): T[] {
  const result = [...entries];
  if (!Number.isInteger(from) || !Number.isInteger(to) ||
      from < 0 || to < 0 || from >= entries.length || to >= entries.length) return result;
  const [step] = result.splice(from, 1);
  result.splice(to, 0, step);
  return result;
}

export function parseSharedRevenantRoute(hash: string): SharedRevenantRoute {
  if (!hash.startsWith("#revenant-spirit?")) return { status: "none" };
  if (hash.length > 2_000) return { status: "invalid" };
  const params = new URLSearchParams(hash.slice(hash.indexOf("?") + 1));
  if (["v", "route", "laps", "pet"].some((key) => params.getAll(key).length !== 1) ||
      params.get("v") !== "1") return { status: "invalid" };
  const pet = params.get("pet")!;
  const laps = params.get("laps")!;
  if (!/^(?:[0-9]|1[0-4])$/.test(pet) || parseRouteCount(laps) === null) return { status: "invalid" };
  const steps = params.get("route")!.split("-");
  if (steps.length > maxRouteSteps) return { status: "invalid" };
  const entries: RevenantRoute["entries"] = [];
  for (const step of steps) {
    const match = /^(\d{1,3})\.(\d{1,8})$/.exec(step);
    if (!match) return { status: "invalid" };
    const level = Number(match[1]);
    const kills = parseRouteCount(match[2]);
    if (kills === null || !revenants.some((enemy) => enemy.level === level)) return { status: "invalid" };
    entries.push({ level, kills: String(kills) });
  }
  return { status: "valid", route: { entries, laps: String(Number(laps)) }, petsOwned: Number(pet) };
}

export function readSharedRevenantRoute(): SharedRevenantRoute {
  return typeof window === "undefined"
    ? { status: "none" }
    : parseSharedRevenantRoute(window.location?.hash ?? "");
}

export function createRevenantRouteLink(baseUrl: string, route: RevenantRoute, petsOwned: number): string {
  const params = new URLSearchParams({
    v: "1",
    route: route.entries.map(({ level, kills }) => `${level}.${parseRouteCount(kills) ?? kills}`).join("-"),
    laps: String(parseRouteCount(route.laps) ?? route.laps),
    pet: String(petsOwned),
  });
  const hash = `#revenant-spirit?${params}`;
  if (parseSharedRevenantRoute(hash).status !== "valid") {
    throw new RangeError("Add a valid route and planned laps before sharing.");
  }
  const url = new URL(baseUrl);
  url.search = "";
  url.hash = hash;
  return url.href;
}

export function formatRouteChance(chance: number, digits: number): string {
  const percent = (chance * 100).toFixed(digits);
  return Number(percent) === 100 ? ">99.99%" : `${percent}%`;
}

export function formatRouteFraction(denominator: number): string {
  return `1 / ${denominator.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function exportRevenantRouteText(baseUrl: string, route: RevenantRoute, petsOwned: number): string {
  const link = createRevenantRouteLink(baseUrl, route, petsOwned);
  const odds = revenantRouteOdds(petsOwned, route.entries.map(({ level, kills }) => ({ level, kills: Number(kills) })), Number(route.laps));
  const names = route.entries.map(({ level, kills }) => {
    const enemy = revenants.find((enemy) => enemy.level === level)!;
    return `${enemy.name}${enemy.name === "Goblin" ? ` (level ${level})` : ""}${Number(kills) > 1 ? ` ×${Number(kills)}` : ""}`;
  });
  return [
    "Dropwise — Revenant Spirit route",
    `Current pet: ${revenantPets[petsOwned]} (${petsOwned}/14 unlocked)`,
    "",
    names.join(" → "),
    ...route.entries.map(({ level, kills }, index) => {
      const enemy = revenants.find((enemy) => enemy.level === level)!;
      return `${index + 1}. Revenant ${enemy.name.toLowerCase()} (level ${level}) — ${Number(kills)} ${Number(kills) === 1 ? "kill" : "consecutive kills"}`;
    }),
    "Repeat from step 1 for the next lap.",
    "",
    `Planned laps: ${Number(route.laps).toLocaleString("en-US")}`,
    ...(odds ? [
      `Kills per lap: ${odds.killsPerLap.toLocaleString("en-US")}`,
      `Total kills: ${odds.totalKills.toLocaleString("en-US")}`,
      `Overall drop fraction: approximately ${formatRouteFraction(odds.overallDenominator!)} per kill (weighted by kills of each revenant)`,
      `Chance of at least one spirit per lap: ${formatRouteChance(odds.chancePerLap, 4)}`,
      `Chance of at least one spirit within planned laps: ${formatRouteChance(odds.chanceForPlan, 2)}`,
    ] : ["All revenant pets unlocked; no next-spirit odds."]),
    "Odds target your next spirit, assuming no unused spirit is held. A drop is never guaranteed.",
    "",
    `Open this route: ${link}`,
    "",
  ].join("\n");
}
