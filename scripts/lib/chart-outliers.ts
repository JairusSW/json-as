import type { ChartConfiguration } from "chart.js";

export interface ExtremeUpperTail {
  /** Lowest value classified as an outlier. */
  firstOutlier: number;
  /** Number of values in the extreme upper tail. */
  outlierCount: number;
}

function quantile(sorted: number[], percentile: number): number {
  const position = (sorted.length - 1) * percentile;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const weight = position - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * weight;
}

/**
 * Finds a small, clearly separated upper tail using two robust estimators:
 * Tukey's far-outlier fence and the median absolute deviation (MAD). The
 * stricter usable fence wins. A ratio guard prevents ordinary high values from
 * changing an otherwise readable chart to a logarithmic scale.
 */
export function detectExtremeUpperTail(
  input: readonly number[],
): ExtremeUpperTail | null {
  const values = input
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  // Six values is enough for the smallest generated comparison chart while
  // still making quartiles meaningful.
  if (values.length < 6) return null;

  const q1 = quantile(values, 0.25);
  const median = quantile(values, 0.5);
  const q3 = quantile(values, 0.75);
  const iqr = q3 - q1;

  const deviations = values
    .map((value) => Math.abs(value - median))
    .sort((a, b) => a - b);
  const mad = quantile(deviations, 0.5);

  const fences: number[] = [];
  if (iqr > 0) fences.push(q3 + 3 * iqr);
  if (mad > 0) fences.push(median + 6 * mad);

  // When most values are identical both robust spreads can be zero. A lone
  // value still has to exceed the common value by 4x to qualify.
  if (fences.length === 0 && median > 0) fences.push(median * 4);
  if (fences.length === 0) return null;

  const fence = Math.min(...fences);
  const firstOutlierIndex = values.findIndex((value) => value > fence);
  if (firstOutlierIndex <= 0) return null;

  const outlierCount = values.length - firstOutlierIndex;
  // More than one fifth of the chart is a population, not a sparse upper tail.
  if (outlierCount / values.length > 0.2) return null;

  const normalMax = values[firstOutlierIndex - 1];
  const firstOutlier = values[firstOutlierIndex];
  if (firstOutlier / normalMax < 1.35) return null;

  return { firstOutlier, outlierCount };
}

interface ChartDataset {
  data?: unknown[];
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function measuredValue(point: unknown, horizontal: boolean): number | null {
  if (typeof point === "number" && Number.isFinite(point)) return point;
  if (!point || typeof point !== "object") return null;
  const key = horizontal ? "x" : "y";
  const value = (point as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function axisTitleWithLogScale(title: unknown): unknown {
  const record = objectRecord(title);
  if (!record.text) return title;
  const text = String(record.text);
  return text.includes("log10 scale")
    ? title
    : { ...record, text: `${text} · log10 scale` };
}

function logTickLabel(value: unknown): string {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return "";
  const magnitude = 10 ** Math.floor(Math.log10(numeric));
  const mantissa = numeric / magnitude;
  const major = [1, 2, 5].some(
    (candidate) => Math.abs(mantissa - candidate) < 1e-8,
  );
  return major ? numeric.toLocaleString("en-US") : "";
}

/**
 * Switches a chart's measured axis to Chart.js's logarithmic scale. By default
 * the switch is adaptive; callers can force it for a known mixed population.
 * Source values and datalabels are never modified.
 */
export function withAdaptiveLogScale(
  config: ChartConfiguration,
  force = false,
): ChartConfiguration {
  const source = config as unknown as Record<string, unknown>;
  const type = source.type;
  if (type !== "bar" && type !== "line") return config;

  const data = objectRecord(source.data);
  const datasets = Array.isArray(data.datasets)
    ? (data.datasets as ChartDataset[])
    : [];
  const options = objectRecord(source.options);
  const horizontal = type === "bar" && options.indexAxis === "y";
  const values = datasets.flatMap((dataset) =>
    (dataset.data ?? [])
      .map((point) => measuredValue(point, horizontal))
      .filter((value): value is number => value !== null && value > 0),
  );
  if (values.length === 0) return config;
  if (!force && !detectExtremeUpperTail(values)) return config;

  const scales = objectRecord(options.scales);
  const axisKey = horizontal ? "x" : "y";
  const axis = objectRecord(scales[axisKey]);
  const ticks = objectRecord(axis.ticks);
  const maxValue = Math.max(...values);
  const logarithmicAxis: Record<string, unknown> = {
    ...axis,
    type: "logarithmic",
    beginAtZero: false,
    grace: "10%",
    suggestedMax: maxValue * (horizontal ? 2 : 1.25),
    title: axisTitleWithLogScale(axis.title),
    ticks: { ...ticks, callback: logTickLabel },
  };

  // Linear-chart bounds and steps are not meaningful on a logarithmic axis.
  delete logarithmicAxis.max;
  delete (logarithmicAxis.ticks as Record<string, unknown>).stepSize;

  return {
    ...source,
    options: {
      ...options,
      scales: { ...scales, [axisKey]: logarithmicAxis },
    },
  } as unknown as ChartConfiguration;
}
