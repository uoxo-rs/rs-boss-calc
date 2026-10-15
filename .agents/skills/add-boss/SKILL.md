---
name: add-boss
description: Add a RuneScape 3 boss or boss family to the Dropwise calculator in rs-boss-calc, following its catalogue, probability, source, artwork, and regression-check conventions. Use when adding supported encounters or scenarios for a newly added boss.
---

# Add a boss to Dropwise

Add the requested encounter to this repository's curated catalogue with supported
drop probabilities, clear eligibility notes, source evidence, and relevant checks.
All paths below are relative to the repository root.

## Establish the encounter and sources

- Identify the requested boss and modes. Ask for the boss name if none is given;
  infer ordinary catalogue conventions from the closest existing encounter.
- Read `CALCULATOR.md`, the relevant corrections in `SOURCES.md`, and the scope
  and limitations in `DROP-AUDIT.md`. Inspect current types and helpers in
  `src/data.ts` and a similar boss before editing.
- Verify new facts against current RuneScape Wiki boss drop tables, pet pages,
  and any referenced calculator modules or templates. Open the sources; search
  snippets alone are insufficient. Follow reward-page redirects and footnotes.
  Per-boss tables take precedence over stale collection-calculator entries;
  record any conflict and the evidence supporting the chosen value.
- Establish whether each rate is per kill, personal loot pile, or independent
  roll; identify mode restrictions, group size, thresholds, ownership conditions,
  and boosts. Preserve exact fractions rather than rounded reciprocal rates.
  If evidence is unavailable or ambiguous, state the gap and use an unmodelled
  target where supported. Never supply a guessed numerical rate.
- Keep coverage consistent with the selected equipment/component/pet catalogue.
  Purchased pets, full collection completion, and generic loot tables require
  additional scope; they are not implied by adding a boss.

## Extend the existing catalogue

| File | Role and useful patterns |
| --- | --- |
| `src/data.ts` | `Boss`, `Scenario`, `Drop`, and `UnmodelledDrop` types; standalone bosses; helpers such as `fixed`, `modes`, and `pet`; final exported catalogue. |
| `src/boss-groups.ts` | `additionalBosses` and family helpers such as `makeBoss` and `ed`; grouped encounters and shared kill-count guidance. |
| `src/extra-drops.ts` | `expandBossDrops` adds supplemental targets and conditional or unmodelled rewards to the exported catalogue. |
| `src/drop-options.ts` | Union of targets across scenarios, including availability and unmodelled status. |
| `src/preferences.ts` | Saved selections use boss, scenario, and drop names as identifiers. |
| `src/probability.ts` | Shared fixed-rate and pet-threshold calculations; inspect when mechanics need more than catalogue data. |

- Follow the closest helper's actual signature; similarly named helpers in
  different files accept different arguments. Extend a family in
  `src/boss-groups.ts` or a standalone entry in `src/data.ts` as appropriate.
  Preserve the single custom entry at the end and the `.map(expandBossDrops)`
  assembly. `bossCount` is derived, not manually assigned.
- Supply `name`, `area`, `symbol`, `source`, and scenarios; use `group` and
  `killCountHelp` when appropriate. `source` is an unencoded Wiki page title,
  not a full URL: `wikiUrl` encodes it. Match existing group names exactly.
  The dropdown derives groups from the catalogue, so normal additions need no
  new UI registry.
- Keep boss names unique, scenario names unique within a boss, and target names
  consistent across modes. Existing names are persistence keys; avoid incidental
  renames. Put the intended default scenario and numerical target first.
- Inspect the final expanded boss, not just its base entry. A target must not be
  duplicated or both numerical and unmodelled within a scenario. The current
  expansion replaces `unmodelledDrops` when it generates extras; preserve any
  base entries if combining both sources.
- Current UI defaults, preference restoration, and catalogue tests assume at
  least one numerical drop in each scenario. If all requested targets have
  unknown rates, do not invent a placeholder to satisfy that assumption. Report
  the limitation or implement explicit support with UI and preference regression
  coverage when that work is within the requested scope.

## Preserve probability semantics

- `denominator` is the inverse of one roll's probability and may be fractional
  (for example, probability `3/512` uses `512 / 3`). It must be finite and at
  least one. `rolls` defaults to one and represents independent rolls per kill.
  Do not multiply a per-kill rate by the number of general loot piles again.
- `threshold` is completed kills, not loot rolls. Pet multipliers are
  `min(10, 1 + floor(completedKills / threshold))`; completing a threshold affects
  the next kill. State shared family/mode kill-count rules in `killCountHelp`.
  Planned kills remain kills of the selected boss and scenario.
- For conditional tables, include the probability of reaching the table. Sum
  mutually exclusive outcomes; use products of miss probabilities for independent
  rolls. Kerapac, Vorago, and GWD2 essence entries illustrate these differences.
- Model mode/group/enrage variations as explicit scenarios. Keep restricted
  targets absent from incompatible scenarios; the cross-scenario dropdown will
  expose them with an unavailable status. Use notes for qualifying kills,
  ownership, checkpoint, reputation, and boost assumptions.
- Use `unmodelledDrops: [{ name, note }]` for qualitative rarity, unsupported
  mitigation, or unresolved sequences. These entries have no denominator. A
  supported aggregate such as "Any next piece" does not estimate a specific
  cycling piece or set completion. Pet thresholds do not stand in for other
  bad-luck mitigation.

## Complete artwork and documentation

- Follow the local Wiki-thumbnail convention: add an appropriate image under
  `public/bosses/`, map the exact boss name in `src/boss-images.ts` to an array
  of paths such as `bosses/boss-name.png`, and credit its Wiki file page in
  `public/bosses/CREDITS.md`. Preserve the app's deployment-base handling.
  If artwork cannot be retrieved, retain the symbol fallback and report it.
- Add source links, verification date, formulas, and exclusions for the new boss
  in `SOURCES.md`; record target coverage and limitations in `DROP-AUDIT.md`.
  Update current coverage counts and applicable guidance in `README.md` and
  `CALCULATOR.md`. Keep historical audit dates/counts explicitly historical;
  adding one boss does not reverify the whole catalogue.
- Wiki maintenance is separate from editing rates. `wiki:fetch` caches sources,
  `wiki:check` reports changes, and `wiki:sync` does not import rates. If refreshing
  snapshots is part of the task, follow `wiki/README.md`, review the report and
  affected sources before accepting its hash, and treat check exit 1 as pending
  review rather than a test failure. Do not accept unrelated source changes just
  to add this boss. Add needed template/module links to the source documentation
  so future fetches track them.

## Check the addition

Use Node.js 24 and the existing npm scripts from the repository root. Reuse
installed dependencies; use `npm ci` if a clean dependency installation is needed.

- Extend `tests/catalogue.test.mjs` for presence and expected boss count; adjust
  exact family membership/order in `tests/boss-groups.test.mjs` when applicable.
  Add source-backed assertions for consequential rates, restrictions, thresholds,
  conditional formulas, or roll counts. Preserve existing coverage.
- Use `tests/drop-audit.test.mjs` for target availability and rate status;
  `tests/drop-ui.test.mjs` and `tests/preferences.test.mjs` for new selection or
  restoration behavior. Add cases to `tests/probability.test.mjs` only when
  calculation behavior changes, checking independent expected outcomes and
  threshold boundaries rather than repeating implementation formulas.
- Run these checks and resolve failures caused by the addition:

  ```sh
  npm test
  npm run lint
  npm run build
  ```

- When a browser/preview is available, check boss/group selection, default
  target, mode changes, any unavailable/unmodelled target, kill-count help,
  artwork/fallback, and persisted selection. State when this check was not run.
- Review the diff for accidental rate/name changes and generated/cache files.
  Report the boss and scenarios added, sources and assumptions, check results,
  and remaining unsupported mechanics or missing artwork.
