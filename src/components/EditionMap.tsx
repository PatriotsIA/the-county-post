import { useEffect, useState } from "react";
import type { CountySite } from "../data/counties";
import type { StateSite } from "../data/states";
import {
  countyMapViewBox,
  loadCountyStateMap,
  loadUnitedStatesMap,
  unitedStatesMapViewBox,
  type CountyMapPath,
} from "../lib/county-state-map";

type EditionMapProps = {
  county?: CountySite;
  state?: StateSite;
};

export function EditionMap({ county, state }: EditionMapProps) {
  if (county) return <CountyEditionMap county={county} />;
  return <UnitedStatesEditionMap state={state} />;
}

function CountyEditionMap({ county }: { county: CountySite }) {
  const [paths, setPaths] = useState<CountyMapPath[]>();
  const [outline, setOutline] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadCountyStateMap(county.fips)
      .then((map) => {
        if (cancelled) return;
        setPaths(map.counties);
        setOutline(map.outline);
      })
      .catch(() => {
        if (!cancelled) setPaths([]);
      });
    return () => {
      cancelled = true;
    };
  }, [county.fips]);

  if (!paths?.length) {
    return (
      <div className="edition-map-shell" aria-hidden={Boolean(paths)}>
        <p className="muted">{paths ? "County map unavailable." : "Loading county map…"}</p>
      </div>
    );
  }

  return (
    <figure className="edition-map-shell">
      <svg
        className="edition-map edition-map-county"
        viewBox={countyMapViewBox}
        role="img"
        aria-label={`${county.displayName} highlighted on the ${county.state.name} county map`}
      >
        {paths.map((path) => (
          <path
            key={path.id}
            d={path.d}
            className={path.selected ? "edition-map-selected" : "edition-map-unit"}
          />
        ))}
        {outline ? <path d={outline} className="edition-map-outline" /> : null}
      </svg>
      <figcaption>
        {county.state.name} counties · {county.displayName} in red
      </figcaption>
    </figure>
  );
}

function UnitedStatesEditionMap({ state }: { state?: StateSite }) {
  const [paths, setPaths] = useState<CountyMapPath[]>();
  const [outline, setOutline] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadUnitedStatesMap(state?.name)
      .then((map) => {
        if (cancelled) return;
        setPaths(map.states);
        setOutline(map.outline);
      })
      .catch(() => {
        if (!cancelled) setPaths([]);
      });
    return () => {
      cancelled = true;
    };
  }, [state?.name]);

  if (!paths?.length) {
    return (
      <div className="edition-map-shell" aria-hidden={Boolean(paths)}>
        <p className="muted">{paths ? "National map unavailable." : "Loading national map…"}</p>
      </div>
    );
  }

  return (
    <figure className="edition-map-shell">
      <svg
        className="edition-map edition-map-nation"
        viewBox={unitedStatesMapViewBox}
        role="img"
        aria-label={state ? `${state.name} highlighted on the United States map` : "Map of the United States"}
      >
        {paths.map((path) => (
          <path
            key={path.id}
            d={path.d}
            className={path.selected ? "edition-map-selected" : "edition-map-unit"}
          />
        ))}
        {outline ? <path d={outline} className="edition-map-outline" /> : null}
      </svg>
      <figcaption>{state ? `United States · ${state.name} in red` : "United States"}</figcaption>
    </figure>
  );
}
