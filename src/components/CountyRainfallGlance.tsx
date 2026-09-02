import { Link } from "react-router-dom";
import type { CountySite } from "../data/counties";
import type { CountyRainfallHistory } from "../lib/county-weather-api";
import { useCountyWeather } from "../lib/useCountyWeather";

export function CountyRainfallGlance({ county }: { county: CountySite }) {
  const weather = useCountyWeather(county.state.slug, county.slug);
  const history = weather.data?.rainfallHistory;
  if (!history) return null;

  return (
    <CompactRainfallChart
      history={history}
      weatherHref={`/${county.state.slug}/${county.slug}/weather`}
    />
  );
}

export function CompactRainfallChart({
  history,
  weatherHref,
}: {
  history: CountyRainfallHistory;
  weatherHref: string;
}) {
  const maximum = Math.max(...history.daily.map((day) => day.precipitationInches), 0.01);

  return (
    <div className="atlas-rainfall-glance">
      <div className="atlas-rainfall-glance-heading">
        <div>
          <p className="kicker">Recent conditions</p>
          <h3>Fourteen-day precipitation</h3>
        </div>
        <div className="atlas-rainfall-glance-aside">
          <Link className="atlas-rainfall-more" to={weatherHref}>
            See More Weather Data
          </Link>
          <strong>{formatRainfallTotal(history.totalInches)}</strong>
        </div>
      </div>
      <p className="weather-rainfall-delay">NASA's Precipitation data is on a 3 day delay.</p>
      <div className="atlas-rainfall-glance-plot">
        <div className="atlas-rainfall-glance-scale" aria-hidden="true">
          <span>{formatScaleInches(maximum)}</span>
          <span>{formatScaleInches(maximum / 2)}</span>
          <span>0 in</span>
        </div>
        <ol className="atlas-rainfall-glance-chart" aria-label="Fourteen-day precipitation">
          {history.daily.map((day) => (
            <li key={day.date} title={`${formatChartDate(day.date)}: ${formatRainfallDaily(day.precipitationInches)}`}>
              <span className="atlas-rainfall-glance-value">{formatGlanceMeasure(day.precipitationInches)}</span>
              <span className="weather-rainfall-bar-track" aria-hidden="true">
                <span
                  className="weather-rainfall-bar-fill"
                  style={{ height: `${Math.max(day.precipitationInches > 0 ? 4 : 0, (day.precipitationInches / maximum) * 100)}%` }}
                />
              </span>
              <span className="atlas-rainfall-glance-date">{formatChartDate(day.date)}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function formatRainfallTotal(value: number) {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} in`;
}

function formatRainfallDaily(value: number) {
  if (value > 0 && value < 0.01) return "Trace";
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: value >= 1 ? 1 : 2,
    maximumFractionDigits: 2,
  }).format(value)} in`;
}

function formatGlanceMeasure(value: number) {
  if (value <= 0) return "—";
  if (value < 0.01) return "T";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: value >= 1 ? 1 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatScaleInches(value: number) {
  return `${new Intl.NumberFormat("en-US", {
    minimumFractionDigits: value >= 1 ? 1 : 2,
    maximumFractionDigits: 2,
  }).format(value)} in`;
}

function formatChartDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}
