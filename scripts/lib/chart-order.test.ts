// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { expect, test } from "bun:test";
import { orderBenchmarkSeries } from "./chart-order";
test("orders modes and representations without changing measurements or colors", () => {
  const datasets = [
    "SIMD",
    "simdjson (owning)",
    "Lazy",
    "JS",
    "SWAR",
    "NAIVE",
    "JSON.Obj",
  ].map((label, i) => ({
    label,
    data: [i + 1],
    backgroundColor: `color-${i}`,
  }));
  const result = orderBenchmarkSeries({ type: "bar", data: { datasets } });
  expect(result.data.datasets.map((d) => d.label)).toEqual([
    "Built-in JSON (JS)",
    "NAIVE",
    "SWAR",
    "SIMD",
    "JSON.Obj",
    "Lazy",
    "simdjson (owning)",
  ]);
  expect(result.data.datasets.map((d) => d.data[0])).toEqual([
    4, 6, 5, 1, 7, 3, 2,
  ]);
  expect(result.data.datasets.map((d) => d.backgroundColor)).toEqual([
    "color-3",
    "color-5",
    "color-4",
    "color-0",
    "color-6",
    "color-2",
    "color-1",
  ]);
  expect(datasets[0].label).toBe("SIMD");
});

test("representation labels retain their order when backend names are included", () => {
  const labels = [
    "Lazy (SIMD)",
    "JSON-AS (SIMD)",
    "JSON.Obj (SIMD)",
    "JSON-AS (SWAR)",
    "JSON-AS (NAIVE)",
  ];
  const config = orderBenchmarkSeries({
    type: "line",
    data: { datasets: labels.map((label) => ({ label, data: [1] })) },
  });
  expect(config.data.datasets.map((dataset) => dataset.label)).toEqual([
    "JSON-AS (NAIVE)",
    "JSON-AS (SWAR)",
    "JSON-AS (SIMD)",
    "JSON.Obj (SIMD)",
    "Lazy (SIMD)",
  ]);
});
