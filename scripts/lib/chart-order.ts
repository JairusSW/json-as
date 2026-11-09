// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import type { ChartConfiguration } from "chart.js";

/** Keep comparison baselines in the same place across grouped bars and legends. */
export function orderBenchmarkSeries(
  config: ChartConfiguration,
): ChartConfiguration {
  const rank = (label: string): number => {
    if (/^(built-in json|native json|js(?:$|\s|·))/i.test(label)) return -1;
    if (/simdjson/i.test(label)) return 5;
    // Representation takes precedence over a backend suffix, e.g. Obj (SIMD).
    if (/\b(?:JSON\.Obj|Obj)\b/i.test(label)) return 3;
    if (/\blazy\b/i.test(label)) return 4;
    if (/\bNAIVE\b/i.test(label)) return 0;
    if (/\bSWAR\b/i.test(label)) return 1;
    if (/\bSIMD\b/i.test(label)) return 2;
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
