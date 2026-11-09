import type { ChartConfiguration } from "chart.js";

/** Keep comparison baselines in the same place across grouped bars and legends. */
export function orderBenchmarkSeries(
  config: ChartConfiguration,
): ChartConfiguration {
  const rank = (label: string): number => {
    if (/^(built-in json|native json|js(?:$|\s|·))/i.test(label)) return -1;
    if (/simdjson/i.test(label)) return 2;
    if (/^(?:json-as\s*\(?simd\)?|simd)(?:$|\s|·)/i.test(label)) return 1;
    return 0;
  };
  return {
    ...config,
    data: {
      ...config.data,
      datasets: config.data.datasets
        .map((dataset) =>
          dataset.label === "JS"
            ? { ...dataset, label: "Built-in JSON (JS)" }
            : dataset,
        )
        .sort(
          (a, b) => rank(String(a.label ?? "")) - rank(String(b.label ?? "")),
        ),
    },
  };
}
