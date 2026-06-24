// Cross-runtime throughput chart for the classic payloads. Compares how fast the
// SAME json-as NAIVE-mode bench deserializes the minified payloads under six
// WebAssembly runtimes (WARP / wasmtime / wavm / wazero / v8 / bun). Every bar is
// the runtime's own bench()-reported MB/s - see scripts/run-bench.runtimes.sh.
//
// Populate the logs first:
//   WARP_SRC=/path/to/wasm-compiler bash scripts/run-bench.runtimes.sh
// Then:
//   bun scripts/build-chart-runtimes.ts
import fs from "node:fs";
import {
  createBarChart,
  generateChart,
  type BenchKind,
  type BenchResult,
} from "./lib/bench-utils";
import { rgba, BASE } from "./lib/palette";

// One distinct hue per runtime; WARP (the subject) gets the hero blue.
const RUNTIMES: { key: string; label: string; bg: string; border: string }[] = [
  {
    key: "warp",
    label: "WARP",
    bg: rgba("pacificBlue", 0.9),
    border: BASE.pacificBlue,
  },
  {
    key: "wasmtime",
    label: "Wasmtime",
    bg: rgba("orange", 0.85),
    border: BASE.orange,
  },
  {
    key: "wavm",
    label: "WAVM",
    bg: rgba("fadedCopper", 0.85),
    border: BASE.fadedCopper,
  },
  {
    key: "wazero",
    label: "wazero",
    bg: rgba("palmLeaf", 0.85),
    border: BASE.palmLeaf,
  },
  {
    key: "v8",
    label: "V8",
    bg: rgba("strawberryRed", 0.85),
    border: BASE.strawberryRed,
  },
  {
    key: "bun",
    label: "Bun",
    bg: rgba("mutedTeal", 0.85),
    border: BASE.mutedTeal,
  },
];

const DATASETS: { key: string; label: string }[] = [
  { key: "twitter", label: "Twitter" },
  { key: "citm_catalog", label: "CITM" },
  { key: "canada", label: "Canada" },
];

const TITLES: Record<BenchKind, string> = {
  deserialize: "Deserialization throughput across WebAssembly runtimes",
  serialize: "Serialization throughput across WebAssembly runtimes",
};

function read(
  runtime: string,
  suite: string,
  kind: BenchKind,
): BenchResult | null {
  const p = `./build/logs/runtimes/${runtime}/${suite}.${kind}.json`;
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

for (const kind of ["deserialize", "serialize"] as BenchKind[]) {
  const chartData: Record<string, BenchResult[]> = {};
  const payloadLabels: Record<string, string> = {};
  let present = 0;

  for (const { key, label } of DATASETS) {
    const row = RUNTIMES.map(
      (rt) => read(rt.key, `${key}-min`, kind) ?? ({ mbps: 0 } as BenchResult),
    );
    if (row.some((r) => r.mbps > 0)) present++;
    chartData[key] = row;
    const sized = row.find((r) => r.bytes);
    payloadLabels[key] = `${label}\n(${sized ? sizeLabel(sized.bytes) : "?"})`;
  }

  if (present === 0) {
    console.warn(
      `  skip ${kind}: no runtime logs - run scripts/run-bench.runtimes.sh first`,
    );
    continue;
  }

  const config = createBarChart(chartData, payloadLabels, {
    title: TITLES[kind],
    yLabel: "Throughput (MB/s)",
    xLabel: "Classic payload",
    datasetLabels: RUNTIMES.map((r) => r.label),
    colors: RUNTIMES.map((r) => ({ bg: r.bg, border: r.border })),
    yStep: 250,
    labelAnchor: "end",
    labelFontSize: 11,
    labelRotation: -90,
  });

  const out = `./build/charts/runtimes-${kind}`;
  generateChart(config, `${out}.svg`);
  generateChart(config, `${out}.png`);
}
