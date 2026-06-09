// Throughput charts for the classic/ dataset benches — NAIVE / SWAR / SIMD,
// deserialize and serialize, rendered once per AS runtime (v8 and wavm). Based
// on build-chart01.ts, but with no JS baseline (these benches (de)serialize into
// a pre-existing object) and a custom log reader so it can run without js logs.
//
// Populate the logs first (v8 and wavm), e.g.:
//   for rt in "" "--wavm"; do for m in naive swar simd; do \
//     for d in twitter canada citm_catalog poet github_events gsoc-2018 \
//       lottie otfcc fgo; do \
//       bash scripts/run-bench.as.sh classic/$d --mode $m $rt; done; done; done
// Then: bun scripts/build-chart-classic.ts
import fs from "node:fs";
import {
  createBarChart,
  generateChart,
  type BenchKind,
  type BenchResult,
} from "./lib/bench-utils";
import { MODE_BARS } from "./lib/palette";

const RUNTIMES = ["v8", "wavm"] as const;
type Runtime = (typeof RUNTIMES)[number];
const MODES = ["naive", "swar", "simd"] as const;

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

// NAIVE / SWAR / SIMD in the standard mode hues (orange / green / blue).
const MODE_COLORS = [MODE_BARS[1], MODE_BARS[2], MODE_BARS[3]];

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

fs.mkdirSync("./build/charts", { recursive: true });

for (const runtime of RUNTIMES) {
  // x-axis labels carry the payload's minified size (read once from a log).
  const payloadLabels: Record<string, string> = {};
  for (const { key, label } of DATASETS) {
    const r = read(runtime, "simd", `${key}-min`, "deserialize");
    payloadLabels[key] = `${label}\n(${r ? sizeLabel(r.bytes) : "?"})`;
  }

  for (const kind of ["deserialize", "serialize"] as BenchKind[]) {
    const chartData: Record<string, BenchResult[]> = {};
    let present = 0;
    for (const { key } of DATASETS) {
      const series = MODES.map(
        (m) =>
          read(runtime, m, `${key}-min`, kind) ?? ({ mbps: 0 } as BenchResult),
      );
      if (series.every((r) => r.mbps > 0)) present++;
      chartData[key] = series;
    }
    if (present === 0) {
      console.warn(`  skip ${kind}/${runtime}: no logs found`);
      continue;
    }

    const config = createBarChart(chartData, payloadLabels, {
      title: TITLES[kind],
      yLabel: "Throughput (MB/s)",
      xLabel: "",
      datasetLabels: ["NAIVE", "SWAR", "SIMD"],
      colors: MODE_COLORS,
      // Value labels sit on top of each bar (this datalabels build treats
      // "start" as the bar's far end); a slightly smaller font keeps adjacent
      // same-height labels from touching.
      labelAnchor: "start",
      labelFontSize: 11,
    });

    const out = `./build/charts/classic-payload-${kind}-${runtime}`;
    generateChart(config, `${out}.svg`);
    generateChart(config, `${out}.png`);
  }
}
