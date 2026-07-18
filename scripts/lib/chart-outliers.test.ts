import { describe, expect, test } from "bun:test";
import type { ChartConfiguration } from "chart.js";
import { detectExtremeUpperTail, withAdaptiveLogScale } from "./chart-outliers";

describe("detectExtremeUpperTail", () => {
  test("detects a sparse extreme upper tail", () => {
    const result = detectExtremeUpperTail([
      401, 620, 780, 900, 1056, 1200, 1497, 2063, 2196, 2233, 2474, 3154, 5734,
      5920, 24743,
    ]);

    expect(result).toEqual({ firstOutlier: 24743, outlierCount: 1 });
  });

  test("handles a small comparison chart with one extreme value", () => {
    const result = detectExtremeUpperTail([72, 475, 547, 3810, 6898, 18138]);

    expect(result).toEqual({ firstOutlier: 18138, outlierCount: 1 });
  });

  test("does not flag a broad or steadily increasing distribution", () => {
    expect(
      detectExtremeUpperTail([100, 180, 300, 500, 800, 1200, 1700]),
    ).toBeNull();
  });

  test("ignores zero placeholders used for missing benchmark bars", () => {
    expect(detectExtremeUpperTail([0, 0, 100, 102, 98, 101, 99, 1000])).toEqual(
      { firstOutlier: 1000, outlierCount: 1 },
    );
  });
});

describe("withAdaptiveLogScale", () => {
  test("keeps every value and changes only the measured axis", () => {
    const values = [72, 475, 547, 3810, 6898, 18138];
    const source: ChartConfiguration<"bar"> = {
      type: "bar",
      data: {
        labels: values.map(String),
        datasets: [{ data: values }],
      },
      options: {
        scales: {
          y: {
            beginAtZero: true,
            max: 20000,
            title: { display: true, text: "Throughput (MB/s)" },
            ticks: { stepSize: 500 },
          },
        },
      },
    };

    const result = withAdaptiveLogScale(source);
    const dataset = result.data.datasets[0] as unknown as { data: number[] };
    const axis = result.options?.scales?.y as unknown as {
      type: string;
      beginAtZero: boolean;
      grace: string;
      max?: number;
      suggestedMax: number;
      title: { text: string };
      ticks: { stepSize?: number; callback: (value: unknown) => string };
    };

    expect(dataset.data).toEqual(values);
    expect(axis.type).toBe("logarithmic");
    expect(axis.beginAtZero).toBe(false);
    expect(axis.grace).toBe("10%");
    expect(axis.max).toBeUndefined();
    expect(axis.suggestedMax).toBe(18138 * 1.25);
    expect(axis.ticks.stepSize).toBeUndefined();
    expect(axis.ticks.callback(5000)).toBe("5,000");
    expect(axis.ticks.callback(8000)).toBe("");
    expect(axis.title.text).toContain("log10 scale");
  });

  test("leaves an ordinary chart linear unless forced", () => {
    const source: ChartConfiguration<"line"> = {
      type: "line",
      data: { datasets: [{ data: [100, 180, 300, 500, 800, 1200, 1700] }] },
      options: { scales: { y: { title: { text: "Throughput" } } } },
    };

    expect(withAdaptiveLogScale(source)).toBe(source);
    const forced = withAdaptiveLogScale(source, true);
    expect(forced.data.datasets[0].data).toEqual(source.data.datasets[0].data);
    expect(forced.options?.scales?.y?.type).toBe("logarithmic");
  });
});
