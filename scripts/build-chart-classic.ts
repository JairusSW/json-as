// Throughput charts for the classic/ dataset benches - native simdjson plus
// json-as NAIVE / SWAR / SIMD / lazy / dynamic modes, rendered once per AS
// runtime (v8 and wavm). The simdjson values are the recorded native medians
// from the equivalent owned-output parity harness; json-as values come from the
// regular benchmark logs.
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
  generateChart,
  type BenchKind,
  type BenchResult,
} from "./lib/bench-utils";
import { withAdaptiveLogScale } from "./lib/chart-outliers";
import { MODE_BARS, OBJ_BAR, rgba, BASE } from "./lib/palette";

const RUNTIMES = ["v8", "wavm"] as const;
type Runtime = (typeof RUNTIMES)[number];

const ISOLATED_KIND = process.env["JSON_CLASSIC_CHART_KIND"] as
  | BenchKind
  | undefined;
const ISOLATED_FORMAT = process.env["JSON_CLASSIC_CHART_FORMAT"] as
  | "svg"
  | "png"
  | undefined;
const ISOLATED_RUNTIME = process.env["JSON_CLASSIC_CHART_RUNTIME"] as
  | Runtime
  | undefined;

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

interface SimdjsonChartResult {
  inputBytes: number;
  deserialize: { medianNs: number; mbps: number };
  serialize: { medianNs: number; mbps: number };
}

interface SimdjsonChartResults {
  simdjson: { version: string; commit: string };
  results: Record<string, SimdjsonChartResult>;
}

const SIMDJSON_RESULTS = JSON.parse(
  fs.readFileSync("./bench/simdjson/classic-chart-results.json", "utf-8"),
) as SimdjsonChartResults;

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

// simdjson / NAIVE / SWAR / SIMD in the standard competitor and mode hues.
const SIMDJSON_BAR = MODE_BARS[0];
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
    return JSON.parse(fs.readFileSync(p, "utf-8")) as BenchResult;
  } catch {
    return null;
  }
}

function sizeLabel(bytes: number): string {
  const mb = bytes / 1e6;
  return mb >= 1 ? `${mb.toFixed(1)}MB` : `${Math.round(bytes / 1e3)}KB`;
}

function simdjsonResult(key: string, kind: BenchKind): BenchResult {
  const result = SIMDJSON_RESULTS.results[key][kind];
  return { mbps: result.mbps } as BenchResult;
}

fs.mkdirSync("./build/charts", { recursive: true });

for (const runtime of [ISOLATED_RUNTIME]) {
  // x-axis labels carry the payload's minified size (read once from a log).
  const payloadLabels: Record<string, string> = {};
  for (const { key, label } of DATASETS) {
    const r = read(runtime, "simd", `${key}-min`, "deserialize");
    payloadLabels[key] = `${label}\n(${r ? sizeLabel(r.bytes) : "?"})`;
  }

  for (const kind of [ISOLATED_KIND]) {
    const chartData: Record<string, BenchResult[]> = {};
    let present = 0;
    for (const { key } of DATASETS) {
      const eager = MODES.map(
        (m) =>
          read(runtime, m, `${key}-min`, kind) ?? ({ mbps: 0 } as BenchResult),
      );
      if (eager.every((r) => r.mbps > 0)) present++;
      // SIMD-only lazy(auto) + dynamic JSON.Obj bars, appended after the modes.
      const lazy =
        read(runtime, "simd", `${key}-lazy-min`, kind) ??
        ({ mbps: 0 } as BenchResult);
      const obj =
        read(runtime, "simd", `${key}-obj-min`, kind) ??
        ({ mbps: 0 } as BenchResult);
      chartData[key] = [simdjsonResult(key, kind), ...eager, lazy, obj];
    }
    if (present === 0) {
      console.warn(`  skip ${kind}/${runtime}: no logs found`);
      continue;
    }

    const makeConfig = () => {
      let config = createBarChart(chartData, payloadLabels, {
        title: TITLES[kind],
        runtimeLabel: runtime,
        yLabel: "Throughput (MB/s)",
        xLabel: "",
        datasetLabels: [
          `simdjson ${SIMDJSON_RESULTS.simdjson.version}`,
          "NAIVE",
          "SWAR",
          "SIMD",
          "Lazy",
          "JSON.Obj",
        ],
        colors: [SIMDJSON_BAR, ...MODE_COLORS, LAZY_BAR, OBJ_BAR],
        // Value labels stand up off each bar top (anchor "end", rotated vertical):
        // the six narrow same-height bars per group would otherwise overlap their
        // labels. generateChart compensates for the datalabels dpr quirk on the
        // PNG raster path.
        labelAnchor: "end",
        labelFontSize: 11,
        labelRotation: -90,
      });

      // JSON.Obj serialization is a distinct, much faster population. Force the
      // complete chart onto log10 so every bar remains visible without clipping.
      if (kind === "serialize") config = withAdaptiveLogScale(config, true);
      return config;
    };

    const out = `./build/charts/classic-payload-${kind}-${runtime}`;
    const dimensions = { width: 1200, height: 650 };
    generateChart(makeConfig(), `${out}.${ISOLATED_FORMAT}`, dimensions);
  }
}
