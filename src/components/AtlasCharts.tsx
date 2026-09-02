import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CountyAtlasMetric } from "../lib/county-atlas-api";
import { atlasMetricSummary, formatAtlasValue } from "../lib/county-atlas-format";

const compositionColors = ["#123c73", "#a8191d", "#4f4f4f", "#7c6a3f", "#376b81", "#765d50"];

export function AtlasMetricChart({ metric }: { metric: CountyAtlasMetric }) {
  if (metric.chart === "trend" && (metric.observations?.length || 0) > 1) {
    return <TrendChart metric={metric} />;
  }
  if (metric.chart === "comparison" && metric.value !== undefined && metric.benchmarks?.length) {
    return <ComparisonChart metric={metric} />;
  }
  if (
    (metric.chart === "distribution" || metric.chart === "composition") &&
    metric.distribution?.length
  ) {
    return metric.chart === "composition" ? (
      <CompositionChart metric={metric} />
    ) : (
      <DistributionChart metric={metric} />
    );
  }
  return null;
}

function TrendChart({ metric }: { metric: CountyAtlasMetric }) {
  const observations = metric.observations || [];
  const first = observations[0];
  const latest = observations.at(-1)!;
  const summary = `${metric.label} trend from ${first.date}, ${formatAtlasValue(first.value, metric.valueKind, metric.unit)}, to ${latest.date}, ${formatAtlasValue(latest.value, metric.valueKind, metric.unit)}.`;

  return (
    <figure className="atlas-chart">
      <div className="atlas-chart-visual" role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={observations} margin={{ top: 12, right: 16, left: 0, bottom: 6 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" minTickGap={22} />
            <YAxis width={52} />
            <Tooltip formatter={(value) => formatChartValue(value, metric)} />
            <Line type="monotone" dataKey="value" name={metric.label} stroke="#123c73" strokeWidth={3} dot />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption>{summary}</figcaption>
      <AtlasDataTable
        caption={`${metric.label} trend data`}
        headers={["Date", metric.label]}
        rows={observations.map((observation) => [
          observation.date,
          formatAtlasValue(observation.value, metric.valueKind, metric.unit),
        ])}
      />
    </figure>
  );
}

function ComparisonChart({ metric }: { metric: CountyAtlasMetric }) {
  if (metric.value === undefined) return null;
  const data = [
    { label: "County", value: metric.value },
    ...(metric.benchmarks || []).map((benchmark) => ({ label: benchmark.label, value: benchmark.value })),
  ];
  const summary = `${atlasMetricSummary(metric)}. Benchmarks: ${(metric.benchmarks || [])
    .map((benchmark) => `${benchmark.label} ${formatAtlasValue(benchmark.value, metric.valueKind, metric.unit)}`)
    .join("; ")}.`;

  return (
    <figure className="atlas-chart">
      <div className="atlas-chart-visual" role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 6 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis width={52} />
            <Tooltip formatter={(value) => formatChartValue(value, metric)} />
            <Bar dataKey="value" name={metric.label} fill="#123c73" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption>{summary}</figcaption>
      <AtlasDataTable
        caption={`${metric.label} county, state, and national comparison`}
        headers={["Geography", metric.label]}
        rows={data.map((item) => [
          item.label,
          formatAtlasValue(item.value, metric.valueKind, metric.unit),
        ])}
      />
    </figure>
  );
}

function DistributionChart({ metric }: { metric: CountyAtlasMetric }) {
  const distribution = metric.distribution || [];
  const summary = `${metric.label} distribution: ${distribution
    .map((item) => `${item.label} ${formatAtlasValue(item.value, metric.valueKind, item.unit || metric.unit)}`)
    .join("; ")}.`;

  return (
    <figure className="atlas-chart">
      <div className="atlas-chart-visual" role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height={Math.max(250, distribution.length * 42)}>
          <BarChart data={distribution} layout="vertical" margin={{ top: 12, right: 16, left: 20, bottom: 6 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis type="category" dataKey="label" width={110} />
            <Tooltip formatter={(value) => formatChartValue(value, metric)} />
            <Bar dataKey="value" name={metric.label} fill="#123c73" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption>{summary}</figcaption>
      <DistributionTable metric={metric} />
    </figure>
  );
}

function CompositionChart({ metric }: { metric: CountyAtlasMetric }) {
  const distribution = (metric.distribution || []).map((item, index) => ({
    ...item,
    fill: compositionColors[index % compositionColors.length],
  }));
  const summary = `${metric.label} composition: ${distribution
    .map((item) => `${item.label} ${formatAtlasValue(item.value, metric.valueKind, item.unit || metric.unit)}`)
    .join("; ")}.`;

  return (
    <figure className="atlas-chart">
      <div className="atlas-chart-visual" role="img" aria-label={summary}>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Tooltip formatter={(value) => formatChartValue(value, metric)} />
            <Legend />
            <Pie
              data={distribution}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="45%"
              outerRadius={88}
              label
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <figcaption>{summary}</figcaption>
      <DistributionTable metric={metric} />
    </figure>
  );
}

function DistributionTable({ metric }: { metric: CountyAtlasMetric }) {
  return (
    <AtlasDataTable
      caption={`${metric.label} category data`}
      headers={["Category", metric.label]}
      rows={(metric.distribution || []).map((item) => [
        item.label,
        formatAtlasValue(item.value, metric.valueKind, item.unit || metric.unit),
      ])}
    />
  );
}

function AtlasDataTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="atlas-table-scroll">
      <table className="atlas-data-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${row[0]}-${rowIndex}`}>
              {row.map((value, columnIndex) =>
                columnIndex === 0 ? (
                  <th key={columnIndex} scope="row">{value}</th>
                ) : (
                  <td key={columnIndex}>{value}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatChartValue(
  value: number | string | readonly (number | string)[] | undefined,
  metric: CountyAtlasMetric,
) {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue)
    ? formatAtlasValue(numericValue, metric.valueKind, metric.unit)
    : String(value || "");
}
