import { useEffect, useState } from "react";
import {
  fetchCountyWeather,
  type CountyWeatherResponse,
} from "./county-weather-api";

type CountyWeatherState = {
  data?: CountyWeatherResponse;
  error: string;
  status: "idle" | "loading" | "loaded" | "error";
};

export function useCountyWeather(stateSlug?: string, countySlug?: string) {
  const [state, setState] = useState<CountyWeatherState>({
    error: "",
    status: stateSlug && countySlug ? "loading" : "idle",
  });

  useEffect(() => {
    if (!stateSlug || !countySlug) {
      setState({ error: "", status: "idle" });
      return;
    }

    const controller = new AbortController();
    setState((current) => ({
      data: current.data?.county.stateSlug === stateSlug && current.data.county.slug === countySlug
        ? current.data
        : undefined,
      error: "",
      status: "loading",
    }));

    void fetchCountyWeather(stateSlug, countySlug, controller.signal)
      .then((data) => setState({ data, error: "", status: "loaded" }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          error: error instanceof Error ? error.message : "County weather is temporarily unavailable.",
          status: "error",
        });
      });

    return () => controller.abort();
  }, [countySlug, stateSlug]);

  return state;
}
