import { useState } from "react";
import RevenantPetSelect from "./RevenantPetSelect";
import {
  readRevenantPet,
  revenantDenominator,
  revenantPets,
  revenants,
  revenantSource,
  saveRevenantPet,
} from "./revenants";

const assetBase = import.meta.env?.BASE_URL ?? "/";

export default function RevenantSpiritCalc() {
  const [petsOwned, setPetsOwned] = useState(readRevenantPet);
  const nextPet = revenantPets[petsOwned + 1];

  return (
    <>
      <div className="intro">
        <div className="eyebrow">ONE SPIRIT. YOUR NEXT REVENANT PET.</div>
        <h1>Revenant Spirit Calculator</h1>
        <p>
          Choose your current pet to see your Revenant Spirit drop chance from
          every revenant.
        </p>
      </div>
      <section className="panel revenant-setup" aria-label="Your revenant pet">
        <div className="revenant-select">
          <label id="revenant-pet-label" htmlFor="revenant-pet">
            Current pet owned
          </label>
          <RevenantPetSelect
            value={petsOwned}
            onChange={(selected) => {
              setPetsOwned(selected);
              saveRevenantPet(selected);
            }}
          />
          <p className="field-help" id="revenant-pet-help">
            Select your highest unlocked pet, even if you use an earlier
            appearance.
          </p>
        </div>
        <div className="revenant-progress" role="status">
          <span>{petsOwned} of 14 pets unlocked</span>
          <strong>
            {nextPet
              ? `Next unlock: Revenant ${nextPet.toLowerCase()}`
              : "All revenant pets unlocked"}
          </strong>
          <p>
            {nextPet
              ? "Each spirit unlocks the next pet in order. The chance becomes rarer with every unlock."
              : "Dragon is the final pet. There are no further pet unlocks to calculate."}
          </p>
        </div>
      </section>
      <section
        className="revenant-results"
        aria-labelledby="revenant-results-title"
      >
        <div className="revenant-results-heading">
          <h2 id="revenant-results-title">Drop chance by revenant</h2>
          <span>17 variants · Chance per kill</span>
        </div>
        <div className="revenant-grid">
          {revenants.map((revenant) => {
            const denominator = revenantDenominator(petsOwned, revenant.level);
            return (
              <article className="panel revenant-card" key={revenant.level}>
                <div className="revenant-portrait">
                  <img
                    src={`${assetBase}revenants/${revenant.image}.png`}
                    alt={`Revenant ${revenant.name.toLowerCase()}`}
                    width={160}
                    height={128}
                    decoding="async"
                  />
                </div>
                <h3>Revenant {revenant.name.toLowerCase()}</h3>
                <p className="revenant-level">Combat level {revenant.level}</p>
                <div className="revenant-odds">
                  <strong>
                    {denominator
                      ? `1 in ${denominator.toLocaleString("en-US")}`
                      : "Complete"}
                  </strong>
                  <span>
                    {denominator
                      ? `${(100 / denominator).toFixed(4)}% per kill`
                      : "All pets unlocked"}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <section className="explain revenant-explain">
        <div>
          <span className="info-icon" aria-hidden="true">
            i
          </span>
          <div>
            <h3>How the drop chance works</h3>
            <p>
              Base = (pets owned + 1) × 250. Your chance per kill is 1 in (base
              × 150 ÷ combat level), rounded down to a whole-number denominator.
              Each goblin level has its own rate.
            </p>
            <p>
              Redeem any spirit you already hold before hunting another; an
              unclaimed spirit prevents another drop.
            </p>
          </div>
        </div>
        <a href={revenantSource} target="_blank" rel="noreferrer">
          Wiki drop formula ↗
        </a>
      </section>
    </>
  );
}
