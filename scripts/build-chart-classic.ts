// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

// API-level classic workload charts, including owning native and JS references.
// The paired classic parity gate remains a separate benchmark harness.
//
// Populate the logs first (v8 and wavm), e.g.:
//   for rt in "" "--wavm"; do for m in naive swar simd; do \
//     for d in twitter canada citm_catalog poet github_events gsoc-2018 \
//       lottie otfcc fgo; do \
//       bash scripts/run-bench.as.sh classic/$d --mode $m $rt; done; done; done
// Then: bun scripts/build-chart-classic.ts
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import {
  createBarChart,
  readBenchLog,
  readComparisonResult,
  generateChart,
  type BenchKind,
  type BenchResult,
} from "./lib/bench-utils";
import { MODE_BARS, OBJ_BAR, SIMDJSON_BAR, rgba, BASE } from "./lib/palette";

const RUNTIMES = ["v8", "wavm"] as const;
type Runtime = (typeof RUNTIMES)[number];

const ISOLATED_KIND = process.env["JSON_CLASSIC_CHART_KIND"] as
  BenchKind | undefined;
const ISOLATED_FORMAT = process.env["JSON_CLASSIC_CHART_FORMAT"] as
  "svg" | "png" | undefined;
const ISOLATED_RUNTIME = process.env["JSON_CLASSIC_CHART_RUNTIME"] as
  Runtime | undefined;

// Chart.js retains process-wide layout state across these dense charts. Render
// each runtime, kind and format in a fresh process so one render's legend/layout
// cannot affect the next while preserving the normal one-command entry point.
if (
  ISOLATED_KIND === undefined ||
  ISOLATED_FORMAT === undefined ||
  ISOLATED_RUNTIME === undefined
) {
  for (const runtime of RUNTIMES) {
    for (const kind of ["deserialize", "serialize"] as BenchKind[]) {
      for (const format of ["svg", "png"] as const) {
        execFileSync(process.execPath, [process.argv[1]], {
          stdio: "inherit",
          env: {
            ...process.env,
            JSON_CLASSIC_CHART_KIND: kind,
            JSON_CLASSIC_CHART_FORMAT: format,
            JSON_CLASSIC_CHART_RUNTIME: runtime,
          },
        });
      }
    }
  }
  process.exit(0);
}

const MODES = ["naive", "swar", "simd"] as const;
const rawPayloads = new Set(
  JSON.parse(fs.readFileSync("bench/simdjson/workloads.json", "utf8"))
    .corpora.filter((corpus: { raw: boolean }) => corpus.raw)
    .map((corpus: { name: string }) => corpus.name),
);

const DATASETS: { key: string; label: string }[] = [
  { key: "twitter", label: "Twitter" },
  { key: "canada", label: "Canada" },
  { key: "citm_catalog", label: "CITM" },
  { key: "poet", label: "Poet" },
  { key: "github_events", label: "GitHub" },
  { key: "gsoc-2018", label: "GSOC" },
  { key: "lottie", label: "Lottie" },
  { key: "otfcc", label: "otfcc" },
  { key: "fgo", label: "FGO" },
];

// NAIVE / SWAR / SIMD retain their standard mode hues.
const MODE_COLORS = [MODE_BARS[1], MODE_BARS[2], MODE_BARS[3]];
// SIMD-only extra series: lazy(auto) (muted teal) and dynamic JSON.Obj (copper).
const LAZY_BAR = { bg: rgba("mutedTeal", 0.85), border: BASE.mutedTeal };

const TITLES: Record<BenchKind, string> = {
  deserialize: "Deserialization throughput of classic payloads",
  serialize: "Serialization throughput of classic payloads",
};

function read(
  runtime: Runtime,
  mode: string,
  suite: string,
  kind: BenchKind,
): BenchResult | null {
  const suffix = runtime === "wavm" ? ".wavm.json" : ".as.json";
  const p = `./build/logs/as/${mode}/${suite}.${kind}${suffix}`;
  try {
    return readBenchLog(p);
  } catch (error) {
    if (fs.existsSync(p)) throw error;
    return null;
  }
}

function sizeLabel(bytes: number): string {
  const mb = bytes / 1e6;
  return mb >= 1 ? `${mb.toFixed(1)}MB` : `${Math.round(bytes / 1e3)}KB`;
}

fs.mkdirSync("./build/charts", { recursive: true });

for (const runtime of [ISOLATED_RUNTIME]) {
  // x-axis labels carry the payload's minified size (read once from a log).
  const payloadLabels: Record<string, string> = {};
  for (const { key, label } of DATASETS) {
    const r = read(runtime, "simd", `${key}-min`, "deserialize");
    payloadLabels[key] =
      `${label}${rawPayloads.has(key) ? " (Raw)" : ""}\n(${r ? sizeLabel(r.bytes) : "?"})`;
  }

  for (const kind of [ISOLATED_KIND]) {
    const chartData: Record<string, BenchResult[]> = {};
    let present = 0;
    for (const { key } of DATASETS) {
      const eager = MODES.map(
        (m) =>
          read(runtime, m, `${key}-min`, kind) ?? ({ mbps: 0 } as BenchResult),
      );
      if (eager.every((r) => !r.mbps)) continue;
      if (eager.every((r) => r.mbps > 0)) present++;
      // SIMD-only lazy(auto) + dynamic JSON.Obj bars, appended after the modes.
      const lazy =
        read(runtime, "simd", `${key}-lazy-min`, kind) ??
        ({ mbps: 0 } as BenchResult);
      const obj =
        read(runtime, "simd", `${key}-obj-min`, kind) ??
        ({ mbps: 0 } as BenchResult);
      const native = readComparisonResult(`${key}-min`, kind, eager[2]);
      const js = readComparisonResult(
        `${key}-min`,
        kind,
        eager[2],
        "js-classic",
      );
      chartData[key] =
        kind === "serialize"
          ? [...eager, native, js]
          : [...eager, lazy, obj, native, js];
    }
    if (present === 0) {
      console.warn(`  skip ${kind}/${runtime}: no logs found`);
      continue;
    }

    const makeConfig = () => {
      const config = createBarChart(chartData, payloadLabels, {
        title: TITLES[kind],
        runtimeLabel: runtime,
        yLabel: "Throughput (MB/s)",
        xLabel: "",
        datasetLabels:
          kind === "serialize"
            ? [
                "NAIVE",
                "SWAR",
                "SIMD",
                "simdjson (owning)",
                "Built-in JSON (JS/V8)",
              ]
            : [
                "NAIVE",
                "SWAR",
                "SIMD",
                "Lazy (subset read)",
                kind === "serialize"
                  ? "untouched JSON.Obj forwarding"
                  : "JSON.Obj (subset read)",
                "simdjson (owning)",
                "Built-in JSON (JS/V8)",
              ],
        colors:
          kind === "serialize"
            ? [...MODE_COLORS, SIMDJSON_BAR, MODE_BARS[0]]
            : [...MODE_COLORS, LAZY_BAR, OBJ_BAR, SIMDJSON_BAR, MODE_BARS[0]],
        // Value labels stand up off each bar top (anchor "end", rotated vertical):
        // the six narrow same-height bars per group would otherwise overlap their
        // labels. generateChart compensates for the datalabels dpr quirk on the
        // PNG raster path.
        labelAnchor: "end",
        labelFontSize: 11,
        labelRotation: -90,
      });

      return config;
    };

    const out = `./build/charts/classic-payload-${kind}-${runtime}`;
    const dimensions = { width: 1500, height: 700 };
    generateChart(makeConfig(), `${out}.${ISOLATED_FORMAT}`, dimensions);
  }
}
