import { useEffect, useRef, useState } from "react";
import { revenantDenominator, revenantPets, revenants } from "./revenants";
import {
  createRevenantRouteLink,
  exportRevenantRouteText,
  formatRouteChance,
  formatRouteFraction,
  maxRouteCount,
  maxRouteSteps,
  moveRouteStep,
  parseRouteCount,
  readRevenantRoute,
  revenantRouteOdds,
  saveRevenantRoute,
} from "./revenant-route";
import type { RevenantRoute, SharedRevenantRoute } from "./revenant-route";

const countError = "Use a whole number from 1 to 10,000,000.";
const formatCount = (count: number) => count.toLocaleString("en-US");
type EditorRoute = Omit<RevenantRoute, "entries"> & {
  entries: (RevenantRoute["entries"][number] & { id: number })[];
};
type Props = { petsOwned: number; shared: SharedRevenantRoute };

export default function RevenantRoutePlanner({ petsOwned, shared }: Props) {
  const [route, setRoute] = useState<EditorRoute>(() => {
    const initial = shared.status === "valid" ? shared.route : readRevenantRoute();
    return { ...initial, entries: initial.entries.map((entry, id) => ({ ...entry, id })) };
  });
  const nextId = useRef(route.entries.length);
  useEffect(() => saveRevenantRoute(route), [route]);
  const [sharing, setSharing] = useState(false);
  const [shareResult, setShareResult] = useState<{ key: string; message: string; link?: string } | null>(null);
  const shareKey = JSON.stringify({ route, petsOwned });
  const activeShare = shareResult?.key === shareKey ? shareResult : null;

  const complete = petsOwned === revenantPets.length - 1;
  const laps = parseRouteCount(route.laps);
  const counts = route.entries.map((entry) => parseRouteCount(entry.kills));
  const invalidKills = counts.some((count) => count === null);
  const odds = !complete && !invalidKills && route.entries.length > 0
    ? revenantRouteOdds(
        petsOwned,
        route.entries.map((entry, index) => ({ level: entry.level, kills: counts[index]! })),
        laps ?? 1,
      )
    : null;

  async function copyLink() {
    const link = createRevenantRouteLink(window.location.href, route, petsOwned);
    setSharing(true);
    try {
      await navigator.clipboard.writeText(link);
      setShareResult({ key: shareKey, message: "Route link copied. It includes the order, quantities, pet stage, and planned laps." });
    } catch {
      setShareResult({ key: shareKey, message: "Clipboard access is unavailable. Select and copy the link below.", link });
    } finally {
      setSharing(false);
    }
  }

  function exportText() {
    const text = exportRevenantRouteText(window.location.href, route, petsOwned);
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "revenant-route.txt";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    setShareResult({ key: shareKey, message: "Text export ready. It includes the ordered steps, odds, and a link to reopen the route." });
  }

  return (
    <section className="panel revenant-route" aria-labelledby="revenant-route-title">
      <div className="revenant-route-heading">
        <div>
          <h2 id="revenant-route-title">Route planner</h2>
          <p>Build your kill order for one lap. Add the same revenant again whenever your route returns to it.</p>
        </div>
        <button type="button" className="text-button" disabled={complete || route.entries.length === 0}
          onClick={() => setRoute({ ...route, entries: [] })}>
          Clear route
        </button>
      </div>
      {shared.status === "valid" && <p className="field-help">Shared route loaded and saved in this browser.</p>}
      {shared.status === "invalid" && (
        <p className="route-input-error" role="alert">This shared link could not be loaded. The planner uses your saved route or the default example.</p>
      )}
      {complete ? (
        <p className="revenant-route-empty" role="status">
          All revenant pets unlocked. There is no next spirit to plan for.
        </p>
      ) : (
        <>
          {route.entries.length > 0 && (
            <div className="revenant-route-overview">
              <h3>One lap, in order</h3>
              <ol className="revenant-route-sequence" aria-label="Route order">
                {route.entries.map((entry, index) => {
                  const enemy = revenants.find((enemy) => enemy.level === entry.level)!;
                  return (
                    <li key={entry.id}>
                      <span className="revenant-route-stop">
                        <span className="revenant-route-step">{index + 1}</span>
                        {enemy.name}{enemy.name === "Goblin" ? ` (${enemy.level})` : ""}
                        {counts[index] !== null && counts[index]! > 1 && <small>×{formatCount(counts[index]!)}</small>}
                        {counts[index] === null && <small>Check kills</small>}
                      </span>
                      {index < route.entries.length - 1 && <span className="revenant-route-arrow" aria-hidden="true">→</span>}
                    </li>
                  );
                })}
              </ol>
              <p className="field-help">Return to step 1 for the next lap. Quantities mean consecutive kills at that step.</p>
            </div>
          )}
          <div className="revenant-route-layout">
            <div className="revenant-route-editor">
              <ol className="revenant-route-list" aria-label="Edit route steps">
                {route.entries.map((entry, index) => {
                  const revenant = revenants.find((enemy) => enemy.level === entry.level)!;
                  const name = `Revenant ${revenant.name.toLowerCase()}`;
                  const inputId = `route-kills-${entry.id}`;
                  const denominator = revenantDenominator(petsOwned, entry.level)!;
                  return (
                    <li key={entry.id} className="revenant-route-entry">
                      <span className="revenant-route-step" aria-hidden="true">{index + 1}</span>
                      <div className="revenant-route-enemy">
                        <strong>{name}</strong>
                        <span>Level {entry.level} · 1 in {formatCount(denominator)} per kill</span>
                      </div>
                      <div className="revenant-route-quantity">
                        <label htmlFor={inputId}>
                          Kills at step {index + 1}<span className="route-sr-only">: {name}, level {entry.level}</span>
                        </label>
                        <input id={inputId} type="number" inputMode="numeric" min={1} max={maxRouteCount} step={1}
                          value={entry.kills} aria-invalid={counts[index] === null}
                          aria-describedby={counts[index] === null ? "route-kills-error" : undefined}
                          onChange={(event) => setRoute({
                            ...route,
                            entries: route.entries.map((item) => item.id === entry.id
                              ? { ...item, kills: event.target.value } : item),
                          })}
                        />
                      </div>
                      <div className="revenant-route-controls">
                        <button type="button" aria-label={`Move step ${index + 1} up: ${name}`} disabled={index === 0}
                          onClick={() => setRoute({ ...route, entries: moveRouteStep(route.entries, index, index - 1) })}>
                          <span aria-hidden="true">↑</span>
                        </button>
                        <button type="button" aria-label={`Move step ${index + 1} down: ${name}`} disabled={index === route.entries.length - 1}
                          onClick={() => setRoute({ ...route, entries: moveRouteStep(route.entries, index, index + 1) })}>
                          <span aria-hidden="true">↓</span>
                        </button>
                        <button type="button" aria-label={`Remove step ${index + 1}: ${name}, level ${entry.level}`}
                          onClick={() => setRoute({ ...route, entries: route.entries.filter((item) => item.id !== entry.id) })}>
                          <span aria-hidden="true">×</span>
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
              {route.entries.length === 0 && (
                <p className="revenant-route-empty">Add a revenant to start building your route.</p>
              )}
              {invalidKills && <p className="route-input-error" id="route-kills-error" role="alert">Kills at each step: {countError}</p>}
              <label htmlFor="route-add">Add next step</label>
              <select id="route-add" value="" disabled={route.entries.length >= maxRouteSteps}
                onChange={(event) => {
                  const level = Number(event.target.value);
                  if (route.entries.length < maxRouteSteps && revenants.some((enemy) => enemy.level === level)) {
                    setRoute({ ...route, entries: [...route.entries, { id: nextId.current++, level, kills: "1" }] });
                  }
                }}>
                <option value="" disabled>{route.entries.length < maxRouteSteps ? "Choose a revenant…" : "50-step limit reached"}</option>
                {revenants.map((enemy) => (
                  <option key={enemy.level} value={enemy.level}>Revenant {enemy.name.toLowerCase()} · Level {enemy.level}</option>
                ))}
              </select>
              <p className="field-help">Use the arrows to reorder steps. Up to 50 steps per lap, saved in this browser.</p>
            </div>
            <div className="revenant-route-summary">
              <div className="revenant-route-lap" role="status" aria-atomic="true">
                <h3>Chance per lap</h3>
                {odds ? (
                  <>
                    <strong className="revenant-route-percent">{formatRouteChance(odds.chancePerLap, 4)}</strong>
                    <p>Overall drop fraction: <strong>{formatRouteFraction(odds.overallDenominator!)}</strong> per kill (approx.)</p>
                    <span>Weighted by the number of kills of each revenant in your route.</span>
                    <p>About 1 in {(1 / odds.chancePerLap).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} laps</p>
                    <span>{formatCount(odds.killsPerLap)} {odds.killsPerLap === 1 ? "kill" : "kills"} per lap · At least one spirit</span>
                  </>
                ) : (
                  <p>{invalidKills ? "Check the kills at each step to see the odds." : "Add a revenant to see your combined chance."}</p>
                )}
              </div>
              <label htmlFor="route-laps">Planned laps</label>
              <input id="route-laps" type="number" inputMode="numeric" min={1} max={maxRouteCount} step={1}
                value={route.laps} aria-invalid={laps === null}
                aria-describedby={laps === null ? "route-laps-error" : undefined}
                onChange={(event) => setRoute({ ...route, laps: event.target.value })}
              />
              {laps === null && <p className="route-input-error" id="route-laps-error" role="alert">{countError}</p>}
              <div className="revenant-route-plan" role="status" aria-atomic="true">
                {odds && laps !== null ? (
                  <>
                    <strong>{formatRouteChance(odds.chanceForPlan, 2)}</strong>
                    <p>Chance of at least one spirit within {formatCount(laps)} {laps === 1 ? "lap" : "laps"}</p>
                    <span>{formatCount(odds.totalKills)} total {odds.totalKills === 1 ? "kill" : "kills"}</span>
                  </>
                ) : <p>Enter a valid route and planned laps to see your hunt's chance.</p>}
              </div>
            </div>
          </div>
          <div className="revenant-route-share">
            <div className="revenant-route-share-actions">
              <button type="button" onClick={copyLink} disabled={!odds || laps === null || sharing}>Copy route link</button>
              <button type="button" onClick={exportText} disabled={!odds || laps === null}>Export text</button>
            </div>
            <p className="field-help">Share the exact order, quantities, current pet, and planned laps.</p>
            <p className="field-help" role="status">{activeShare?.message}</p>
            {activeShare?.link && (
              <div className="revenant-route-copy">
                <label htmlFor="route-share-link">Route link</label>
                <textarea id="route-share-link" readOnly value={activeShare.link} rows={3} onFocus={(event) => event.target.select()} />
              </div>
            )}
          </div>
        </>
      )}
      <p className="revenant-route-note">
        Order shows how to follow your route; the combined odds depend on which kills are included.
        These odds target your next spirit at the selected pet stage, assuming you do not
        already hold an unused spirit. After unlocking a pet, update your selection.
        A drop is never guaranteed.
      </p>
    </section>
  );
}
