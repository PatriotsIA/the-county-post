import { useEffect, useState } from "react";
import { getCountyTurnoutHistoryByFips, type CountyTurnoutSummary } from "./turnout";

type TurnoutState = {
  loading: boolean;
  data: CountyTurnoutSummary[];
  fips: string | null;
};

export function useCountyTurnout(fips: string) {
  const [state, setState] = useState<TurnoutState>({ loading: true, data: [], fips: null });

  useEffect(() => {
    let active = true;
    getCountyTurnoutHistoryByFips(fips)
      .then((data) => {
        if (active) setState({ loading: false, data, fips });
      })
      .catch(() => {
        if (active) setState({ loading: false, data: [], fips });
      });
    return () => {
      active = false;
    };
  }, [fips]);

  return state.fips === fips ? { loading: state.loading, data: state.data } : { loading: true, data: [] };
}
