import { expect, test } from "bun:test";
import { orderBenchmarkSeries } from "./chart-order";
test("keeps JS left and SIMD references right without changing measurements or colors", () => {
  const datasets = [
    "SIMD",
    "simdjson (owning)",
    "Lazy",
    "JS",
    "SWAR",
    "NAIVE",
  ].map((label, i) => ({
    label,
    data: [i + 1],
    backgroundColor: `color-${i}`,
  }));
  const result = orderBenchmarkSeries({ type: "bar", data: { datasets } });
  expect(result.data.datasets.map((d) => d.label)).toEqual([
    "Built-in JSON (JS)",
    "Lazy",
    "SWAR",
    "NAIVE",
    "SIMD",
    "simdjson (owning)",
  ]);
  expect(result.data.datasets.map((d) => d.data[0])).toEqual([
    4, 3, 5, 6, 1, 2,
  ]);
  expect(result.data.datasets.map((d) => d.backgroundColor)).toEqual([
    "color-3",
    "color-2",
    "color-4",
    "color-5",
    "color-0",
    "color-1",
  ]);
  expect(datasets[0].label).toBe("SIMD");
});
