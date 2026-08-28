import { Link } from "react-router-dom";
import {
  getCountyMarketCities,
  getCountyMarketCity,
  type CountySite,
} from "../data/counties";
import { buildCountyFallbackFeedUrls } from "../lib/fallback-feed-urls";
import {
  weatherSeverityClass,
  type CountyDroughtCondition,
  type CountyRainfallHistory,
  type CountyWeatherResponse,
  type WeatherAlert,
  type WeatherForecastPeriod,
  type WeatherMeasurement,
} from "../lib/county-weather-api";
import { useCountyWeather } from "../lib/useCountyWeather";
import { NewsFeedSection } from "./NewsFeedSection";

export function CountyWeatherPage({ county }: { county: CountySite }) {
  const weather = useCountyWeather(county.state.slug, county.slug);
  const marketCities = getCountyMarketCities(county, 3);
  const fallbackCity = marketCities[0] || getCountyMarketCity(county);
  const localCities = Array.from(new Set([fallbackCity, ...marketCities.slice(1), ...(county.localCities || [])]));
  const weatherFeedPath = `/v1/feeds/counties/${county.state.slug}/${county.slug}/weather`;
  const atlasPath = `/${county.state.slug}/${county.slug}/data/environment-disasters`;

  return (
    <div className="layout-grid weather-page">
      <section className="hero-card weather-hero">
        <p className="kicker">National Weather Service desk</p>
        <h1>{county.displayName} Weather</h1>
        <p className="lead">
          Current conditions, active alerts, and the local National Weather Service forecast for {county.state.name}.
        </p>
        <Link className="weather-atlas-link" to={atlasPath}>
          Explore environment &amp; disasters data
        </Link>
      </section>

      {weather.status === "loading" && !weather.data ? (
        <section className="card weather-status" role="status" aria-live="polite">
          <p className="kicker">Local conditions</p>
          <h2>Loading county weather…</h2>
        </section>
      ) : null}

      {weather.status === "error" ? (
        <section className="card weather-status weather-error" role="alert">
          <p className="kicker">Weather desk</p>
          <h2>County weather is temporarily unavailable</h2>
          <p>{weather.error}</p>
        </section>
      ) : null}

      {weather.data ? <WeatherReport weather={weather.data} atlasPath={atlasPath} /> : null}

      <NewsFeedSection
        title={`${county.displayName} weather stories`}
        kicker="Weather news"
        apiPath={weatherFeedPath}
        fallbackFeedUrls={buildCountyFallbackFeedUrls(county, "weather")}
        expandedLabel={`weather reports for nearby markets including ${localCities.join(" and ")}`}
        pageSize={12}
        kind="weather"
        locality={{
          countyName: county.name,
          stateName: county.state.name,
          stateAbbr: county.state.abbr,
          cities: localCities,
          strict: true,
        }}
        actionLink={{ to: atlasPath, label: "View environment & disasters data" }}
      />
    </div>
  );
}

function WeatherReport({ weather, atlasPath }: { weather: CountyWeatherResponse; atlasPath: string }) {
  const observation = weather.currentObservation;
  const timeZone = weatherTimeZoneLabel(weather);

  return (
    <>
      {weather.warnings.length ? (
        <aside className="weather-service-warnings" aria-label="Weather data notices">
          <strong>Partial weather report</strong>
          <ul>
            {weather.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </aside>
      ) : null}

      <section className="card weather-current-section" aria-labelledby="current-weather-heading">
        <header className="weather-section-heading">
          <div>
            <p className="kicker">Current conditions</p>
            <h2 id="current-weather-heading">
              {weather.location.city || weather.county.displayName}
              {weather.location.state ? `, ${weather.location.state}` : ""}
            </h2>
          </div>
          {observation?.observedAt ? (
            <p>Observed {formatNwsLocalTime(observation.observedAt)} · {timeZone}</p>
          ) : null}
        </header>

        {observation ? (
          <div className="weather-current-grid">
            <div className="weather-current-primary">
              {observation.icon ? <img src={observation.icon} alt="" /> : null}
              <p className="weather-current-temperature">{formatTemperature(observation.temperature)}</p>
              <p>{observation.textDescription || "Condition description unavailable"}</p>
            </div>
            <dl className="weather-current-details">
              <WeatherDatum label="Humidity" value={formatPercent(observation.relativeHumidity)} />
              <WeatherDatum label="Wind" value={formatWind(observation.windSpeed, observation.windGust)} />
              <WeatherDatum label="Wind direction" value={formatDegrees(observation.windDirection)} />
              <WeatherDatum label="Pressure" value={formatPressure(observation.barometricPressure)} />
              <WeatherDatum label="Station" value={observation.stationName || observation.stationId} />
            </dl>
          </div>
        ) : (
          <p className="weather-empty">A current station observation is not available. Forecasts and alerts remain below.</p>
        )}
      </section>

      <section className="card weather-alerts-section" aria-labelledby="active-alerts-heading">
        <header className="weather-section-heading">
          <div>
            <p className="kicker">Public safety</p>
            <h2 id="active-alerts-heading">Active weather alerts</h2>
          </div>
          <span className="weather-count-badge">{weather.alerts.length} active</span>
        </header>
        {weather.alerts.length ? (
          <div className="weather-alert-card-grid">
            {weather.alerts.map((alert) => <WeatherAlertCard key={alert.id} alert={alert} />)}
          </div>
        ) : (
          <p className="weather-empty">No active National Weather Service alerts were returned for this county.</p>
        )}
      </section>

      <section className="card weather-drought-section" aria-labelledby="drought-conditions-heading">
        <header className="weather-section-heading">
          <div>
            <p className="kicker">Weekly conditions</p>
            <h2 id="drought-conditions-heading">Drought conditions</h2>
          </div>
          {weather.droughtCondition ? (
            <span className={`weather-count-badge drought-category-${weather.droughtCondition.category.toLowerCase()}`}>
              {weather.droughtCondition.category}
            </span>
          ) : null}
        </header>
        {weather.droughtCondition ? (
          <DroughtConditionCard condition={weather.droughtCondition} countyName={weather.county.displayName} />
        ) : (
          <p className="weather-empty">
            The latest U.S. Drought Monitor does not classify this county in D1–D4 drought.
          </p>
        )}
      </section>

      {weather.rainfallHistory ? (
        <section className="card weather-rainfall-section" aria-labelledby="rainfall-history-heading">
          <header className="weather-section-heading">
            <div>
              <p className="kicker">Recent conditions</p>
              <h2 id="rainfall-history-heading">Fourteen-day precipitation</h2>
            </div>
            <span className="weather-count-badge">
              {formatRainfallTotal(weather.rainfallHistory.totalInches)}
            </span>
          </header>
          <RainfallHistoryCard history={weather.rainfallHistory} countyName={weather.county.displayName} />
        </section>
      ) : null}

      <section className="card weather-forecast-section" aria-labelledby="weather-forecast-heading">
        <header className="weather-section-heading">
          <div>
            <p className="kicker">Seven-day outlook</p>
            <h2 id="weather-forecast-heading">Forecast periods</h2>
          </div>
          <OfficialLink href={weather.meta.source.links.forecast} label="Official NWS forecast data" />
        </header>
        {weather.forecast.length ? (
          <div className="weather-forecast-grid">
            {weather.forecast.map((period) => <ForecastCard key={`${period.number}-${period.startTime}`} period={period} />)}
          </div>
        ) : (
          <p className="weather-empty">The period forecast is temporarily unavailable.</p>
        )}
      </section>

      <section className="card weather-hourly-section" aria-labelledby="weather-hourly-heading">
        <header className="weather-section-heading">
          <div>
            <p className="kicker">Next 24 hours</p>
            <h2 id="weather-hourly-heading">Hourly forecast</h2>
          </div>
          <OfficialLink href={weather.meta.source.links.hourly} label="Official NWS hourly data" />
        </header>
        {weather.hourly.length ? (
          <div className="weather-hourly-scroll" tabIndex={0} aria-label="Scrollable hourly forecast">
            <table className="weather-hourly-table">
              <caption>Next-hours forecast in {timeZone}</caption>
              <thead>
                <tr>
                  <th scope="col">Time</th>
                  <th scope="col">Conditions</th>
                  <th scope="col">Temperature</th>
                  <th scope="col">Precipitation</th>
                  <th scope="col">Wind</th>
                </tr>
              </thead>
              <tbody>
                {weather.hourly.map((period) => (
                  <tr key={`${period.number}-${period.startTime}`}>
                    <th scope="row">{formatHourlyTime(period.startTime)}</th>
                    <td>{period.shortForecast || "Forecast unavailable"}</td>
                    <td>{formatTemperature(period.temperature)}</td>
                    <td>{formatPercent(period.precipitationProbability)}</td>
                    <td>{formatPeriodWind(period)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="weather-empty">The hourly forecast is temporarily unavailable.</p>
        )}
      </section>

      <section className="card weather-source-section" aria-labelledby="weather-source-heading">
        <div>
          <p className="kicker">Source &amp; freshness</p>
          <h2 id="weather-source-heading">Weather data sources</h2>
          <p>
            Current observations, forecasts, and alerts are provided by the National Weather Service. Recent
            precipitation is estimated by NASA POWER, and weekly drought classifications come from the U.S. Drought
            Monitor. The County Post does not require or expose a browser weather API key.
          </p>
        </div>
        <dl className="weather-source-details">
          <WeatherDatum label="API fetched" value={formatDateTime(weather.meta.fetchedAt)} />
          <WeatherDatum label="Time zone" value={timeZone} />
          {weather.rainfallHistory ? (
            <WeatherDatum label="Precipitation data through" value={formatDate(weather.rainfallHistory.dataThrough)} />
          ) : null}
          <WeatherDatum
            label="Forecast grid"
            value={weather.location.gridOffice && weather.location.gridX !== undefined && weather.location.gridY !== undefined
              ? `${weather.location.gridOffice} ${weather.location.gridX},${weather.location.gridY}`
              : "Not supplied"}
          />
          <WeatherDatum label="Coverage" value={weather.meta.partial ? "Partial response" : "Complete response"} />
        </dl>
        <div className="weather-official-links">
          <OfficialLink href={weather.meta.source.documentation} label="NWS API documentation" />
          <OfficialLink href={weather.meta.source.alertsDocumentation} label="NWS alerts documentation" />
          <OfficialLink href={weather.meta.source.links.points} label="NWS location point" />
          <OfficialLink href={weather.meta.source.links.latestObservation} label="Latest official observation" />
          <OfficialLink href={weather.rainfallHistory?.source.url} label="NASA POWER precipitation data" />
          <OfficialLink href={weather.rainfallHistory?.source.documentation} label="NASA POWER methodology" />
          {weather.zones.forecast ? <OfficialLink href={weather.zones.forecast.link} label={`Forecast zone ${weather.zones.forecast.id}`} /> : null}
          {weather.zones.county ? <OfficialLink href={weather.zones.county.link} label={`County zone ${weather.zones.county.id}`} /> : null}
          <Link to={atlasPath}>Environment &amp; disasters atlas</Link>
        </div>
      </section>
    </>
  );
}

function DroughtConditionCard({
  condition,
  countyName,
}: {
  condition: CountyDroughtCondition;
  countyName: string;
}) {
  return (
    <article className={`weather-drought-card drought-category-${condition.category.toLowerCase()}`}>
      <div>
        <p className="weather-drought-category">{condition.category} · {condition.label}</p>
        <h3>{condition.label} affects {formatDroughtPercent(condition.areaPercent)} of {countyName}</h3>
        <p>
          {formatDroughtPercent(condition.totalDroughtPercent)} of the county is in moderate drought or worse.
          U.S. Drought Monitor categories are cumulative and update weekly.
        </p>
      </div>
      <dl className="weather-drought-breakdown">
        <WeatherDatum label="Moderate or worse (D1+)" value={formatDroughtPercent(condition.categories.d1)} />
        <WeatherDatum label="Severe or worse (D2+)" value={formatDroughtPercent(condition.categories.d2)} />
        <WeatherDatum label="Extreme or worse (D3+)" value={formatDroughtPercent(condition.categories.d3)} />
        <WeatherDatum label="Exceptional (D4)" value={formatDroughtPercent(condition.categories.d4)} />
        <WeatherDatum label="Map date" value={formatDate(condition.mapDate)} />
      </dl>
      <div className="weather-official-links">
        <OfficialLink href={condition.source.countyUrl} label="View official county drought conditions" />
        <OfficialLink href={condition.source.url} label="Open U.S. Drought Monitor data" />
      </div>
    </article>
  );
}

function RainfallHistoryCard({
  history,
  countyName,
}: {
  history: CountyRainfallHistory;
  countyName: string;
}) {
  const maximum = Math.max(...history.daily.map((day) => day.precipitationInches), 0.01);

  return (
    <article className="weather-rainfall-card">
      <div className="weather-rainfall-summary">
        <div>
          <p className="weather-rainfall-total">{formatRainfallTotal(history.totalInches)}</p>
          <p>
            Estimated precipitation over the latest {history.availableDays} available days at the geographic center
            of {countyName}.
          </p>
        </div>
        <dl className="weather-rainfall-details">
          <WeatherDatum label="Period" value={`${formatDate(history.periodStart)}–${formatDate(history.periodEnd)}`} />
          <WeatherDatum label="Wet days" value={`${history.wetDays} above 0.01 in`} />
          <WeatherDatum label="Data through" value={formatDate(history.dataThrough)} />
          <WeatherDatum label="Location basis" value="County-center estimate" />
        </dl>
      </div>

      <div
        className="weather-rainfall-chart-scroll"
        tabIndex={0}
        aria-label={`Scrollable daily precipitation chart for ${countyName}`}
      >
        <ol className="weather-rainfall-chart">
          {history.daily.map((day) => (
            <li key={day.date} title={`${formatDate(day.date)}: ${formatRainfallDaily(day.precipitationInches)}`}>
              <span className="weather-rainfall-bar-track" aria-hidden="true">
                <span
                  className="weather-rainfall-bar-fill"
                  style={{ height: `${Math.max(day.precipitationInches > 0 ? 3 : 0, (day.precipitationInches / maximum) * 100)}%` }}
                />
              </span>
              <strong>{formatRainfallDaily(day.precipitationInches)}</strong>
              <span>{formatChartDate(day.date)}</span>
            </li>
          ))}
        </ol>
      </div>

      <p className="weather-rainfall-note">
        NASA POWER PRECTOTCORR is a corrected gridded precipitation estimate, not a county-wide rain-gauge total.
        Values may include the liquid equivalent of frozen precipitation. {history.source.latencyNote}
      </p>
      <div className="weather-official-links">
        <OfficialLink href={history.source.url} label="Open NASA POWER precipitation data" />
        <OfficialLink href={history.source.documentation} label="NASA POWER daily API documentation" />
      </div>
    </article>
  );
}

function WeatherAlertCard({ alert }: { alert: WeatherAlert }) {
  const severity = alert.severity || "Unknown";
  return (
    <article className={`weather-alert-card weather-severity-${weatherSeverityClass(alert.severity)}`}>
      <div className="weather-alert-meta">
        <strong>{severity}</strong>
        {alert.urgency ? <span>{alert.urgency}</span> : null}
        {alert.certainty ? <span>{alert.certainty}</span> : null}
      </div>
      <h3>{alert.headline || alert.event}</h3>
      {alert.headline ? <p className="weather-alert-event">{alert.event}</p> : null}
      {alert.effective || alert.expires ? (
        <p className="weather-alert-time">
          {alert.effective ? `Effective ${formatNwsLocalTime(alert.effective)}` : ""}
          {alert.effective && alert.expires ? " · " : ""}
          {alert.expires ? `Expires ${formatNwsLocalTime(alert.expires)}` : ""}
        </p>
      ) : null}
      {alert.description ? <p>{alert.description}</p> : null}
      {alert.instruction ? <p className="weather-alert-instruction"><strong>What to do:</strong> {alert.instruction}</p> : null}
      {alert.link ? (
        <a className="weather-official-link" href={alert.link} target="_blank" rel="noreferrer">
          Open official NWS alert
        </a>
      ) : null}
    </article>
  );
}

function ForecastCard({ period }: { period: WeatherForecastPeriod }) {
  return (
    <article className={`weather-forecast-card${period.isDaytime ? " daytime" : " nighttime"}`}>
      <div className="weather-forecast-card-heading">
        <h3>{period.name}</h3>
        {period.icon ? <img src={period.icon} alt="" loading="lazy" /> : null}
      </div>
      <p className="weather-forecast-temperature">{formatTemperature(period.temperature)}</p>
      <p className="weather-forecast-short">{period.shortForecast || "Forecast unavailable"}</p>
      <p className="weather-forecast-meta">
        Precipitation {formatPercent(period.precipitationProbability)} · Wind {formatPeriodWind(period)}
      </p>
      {period.detailedForecast ? <p className="weather-forecast-detail">{period.detailedForecast}</p> : null}
    </article>
  );
}

function WeatherDatum({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function OfficialLink({ href, label }: { href?: string; label: string }) {
  if (!href) return null;
  return <a className="weather-official-link" href={href} target="_blank" rel="noreferrer">{label}</a>;
}

function formatTemperature(measurement?: WeatherMeasurement) {
  return typeof measurement?.value === "number" ? `${Math.round(measurement.value)}°F` : "Unavailable";
}

function formatPercent(measurement?: WeatherMeasurement) {
  return typeof measurement?.value === "number" ? `${Math.round(measurement.value)}%` : "—";
}

function formatWind(speed?: WeatherMeasurement, gust?: WeatherMeasurement) {
  if (typeof speed?.value !== "number") return "Unavailable";
  const gustText = typeof gust?.value === "number" ? `, gusts ${Math.round(gust.value)} mph` : "";
  return `${Math.round(speed.value)} mph${gustText}`;
}

function formatPeriodWind(period: WeatherForecastPeriod) {
  if (typeof period.windSpeed.value !== "number") return "Unavailable";
  return `${period.windDirection ? `${period.windDirection} ` : ""}${Math.round(period.windSpeed.value)} mph`;
}

function formatDegrees(measurement?: WeatherMeasurement) {
  return typeof measurement?.value === "number" ? `${Math.round(measurement.value)}°` : "Unavailable";
}

function formatPressure(measurement?: WeatherMeasurement) {
  return typeof measurement?.value === "number"
    ? `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(measurement.value)} Pa`
    : "Unavailable";
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

function formatChartDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatDroughtPercent(value: number) {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value)}%`;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatNwsLocalTime(value: string) {
  return formatWallClock(value, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatHourlyTime(value: string) {
  return formatWallClock(value, {
    weekday: "short",
    hour: "numeric",
  });
}

function formatWallClock(value: string, options: Intl.DateTimeFormatOptions) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/u);
  if (!match) return formatDateTime(value);
  const [, year, month, day, hour, minute] = match;
  const wallClock = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute)));
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(wallClock);
}

function weatherTimeZoneLabel(weather: CountyWeatherResponse) {
  if (weather.location.timeZone) return weather.location.timeZone;
  const timestamp = weather.forecast[0]?.startTime || weather.hourly[0]?.startTime || weather.currentObservation?.observedAt;
  const offset = timestamp?.match(/([+-]\d{2}:\d{2}|Z)$/u)?.[1];
  if (!offset) return "NWS local time";
  return offset === "Z" ? "NWS local time (UTC)" : `NWS local time (UTC${offset})`;
}
