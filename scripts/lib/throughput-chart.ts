// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import type { ChartConfiguration } from "chart.js";
import {
  benchLogPath,
  readBenchLog,
  subtitle,
  generateChart,
} from "./bench-utils";
import { withAdaptiveLogScale } from "./chart-outliers";
import { MODE_RGB, INK } from "./palette";
import { PAYLOAD_LABELS } from "../../bench/throughput/payload-sizes";

/** One curve per implementation, ten actual single-document sizes. */
export function throughputChart(
  kind: "object" | "string",
  operation: "serialize" | "deserialize",
): void {
  const specs = [
    { key: "js", label: "Built-in JSON (JS)", language: "js", mode: "" },
    { key: "naive", label: "NAIVE", language: "as", mode: "naive" },
    { key: "swar", label: "SWAR", language: "as", mode: "swar" },
    ...(kind === "object" && operation === "deserialize"
      ? [
          {
            key: "obj",
            label: "JSON.Obj (deferred)",
            language: "as",
            mode: "simd",
          },
        ]
      : []),
    { key: "simd", label: "SIMD", language: "as", mode: "simd" },
  ] as const;
  const datasets = specs.map((spec) => ({
    label: spec.label,
    data: PAYLOAD_LABELS.map((size) => {
      const prefix = kind === "object" ? "obj" : "str";
      const payload = prefix + "-" + size + (spec.key === "obj" ? "-obj" : "");
      const result = readBenchLog(
        benchLogPath(payload, operation, spec.language, spec.mode),
      );
      if (!(result.bytes > 0) || !(result.mbps > 0))
        throw Error("Invalid throughput result: " + payload);
      return { x: result.bytes / 1048576, y: result.mbps / 1000 };
    }),
    borderColor: `rgba(${MODE_RGB[spec.key]},0.9)`,
    backgroundColor: `rgba(${MODE_RGB[spec.key]},0.3)`,
    borderDash: spec.key === "obj" ? [8, 4] : undefined,
    fill: false,
    tension: 0.15,
    pointRadius: 5,
  }));
  // Curves must compare exactly the same encoded documents at each sample.
  for (let i = 1; i < datasets.length; i++) {
    if (
      datasets[i].data.some(
        (point, index) => point.x !== datasets[0].data[index].x,
      )
    )
      throw Error("Mismatched document sizes in " + kind + " " + operation);
  }
  const config: ChartConfiguration<"line"> = {
    type: "line",
    data: { datasets },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: `${kind === "object" ? "Growing-object" : "String"} ${operation === "serialize" ? "serialization" : "deserialization"} · ten single-document sizes`,
          font: { size: 20, weight: "bold" },
        },
        legend: {
          position: "top",
          labels: { font: { size: 15 }, padding: 18 },
        },
        datalabels: { display: false },
        subtitle: {
          display: true,
          text: subtitle(),
          font: { size: 13 },
          color: INK.subtitle,
          padding: 14,
          position: "bottom",
        },
      },
      scales: {
        x: {
          type: "linear",
          title: {
            display: true,
            text: "Single JSON document size (MiB)",
            font: { size: 16 },
          },
          grid: { color: INK.grid },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Throughput (GB/s)",
            font: { size: 16 },
          },
          grid: { color: INK.grid },
        },
      },
    },
  };
  const presentation = withAdaptiveLogScale(config);
  const base = `./build/charts/${kind}-${operation}`;
  generateChart(presentation, base + ".svg", { width: 1200, height: 700 });
  generateChart(presentation, base + ".png", { width: 1200, height: 700 });
}
