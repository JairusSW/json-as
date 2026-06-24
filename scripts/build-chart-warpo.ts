// Compiler-comparison charts: json-as throughput on the classic payloads when
// compiled with asc vs warpo, each before and after wasm-opt -O4, all on v8.
// Isolates the compiler/optimizer (one runtime, one source). Emits one chart per
// kind: warpo-vs-asc-deserialize and warpo-vs-asc-serialize.
//
// Populate logs first:  bash scripts/run-bench.warpo.sh
// Then:                 bun scripts/build-chart-warpo.ts
import fs from "node:fs";
import {
  createBarChart,
  generateChart,
  type BenchKind,
  type BenchResult,
} from "./lib/bench-utils";
import { rgba, BASE } from "./lib/palette";

// Hue = compiler/GC (asc red, warpo-incremental blue, warpo-radical green);
// shade: light = compiler only, dark = + wasm-opt -O4. asc has no radical GC, so
// the green bars are warpo-only.
const VARIANTS: { key: string; label: string; bg: string; border: string }[] = [
  {
    key: "asc",
    label: "asc (incremental)",
    bg: rgba("strawberryRed", 0.5),
    border: BASE.strawberryRed,
  },
  {
    key: "asc-opt",
    label: "asc + wasm-opt -O4",
    bg: rgba("strawberryRed", 0.9),
    border: BASE.strawberryRed,
  },
  {
    key: "warpo",
    label: "warpo (incremental)",
    bg: rgba("pacificBlue", 0.5),
    border: BASE.pacificBlue,
  },
  {
    key: "warpo-opt",
    label: "warpo (incremental) + wasm-opt -O4",
    bg: rgba("pacificBlue", 0.9),
    border: BASE.pacificBlue,
  },
  {
    key: "warpo-radical",
    label: "warpo (radical)",
    bg: rgba("jungleGreen", 0.5),
    border: BASE.jungleGreen,
  },
  {
    key: "warpo-radical-opt",
    label: "warpo (radical) + wasm-opt -O4",
    bg: rgba("jungleGreen", 0.9),
    border: BASE.jungleGreen,
  },
];

const DATASETS: { key: string; label: string }[] = [
  { key: "twitter", label: "Twitter" },
  { key: "citm_catalog", label: "CITM" },
  { key: "canada", label: "Canada" },
];

const TITLES: Record<BenchKind, string> = {
  deserialize: "json-as deserialization: asc vs warpo compiler (v8)",
  serialize: "json-as serialization: asc vs warpo compiler (v8)",
};

function read(
  variant: string,
  payload: string,
  kind: BenchKind,
): BenchResult | null {
  try {
    return JSON.parse(
      fs.readFileSync(
        `./build/logs/warpo/${variant}/${payload}.${kind}.json`,
        "utf-8",
      ),
    ) as BenchResult;
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
    const row = VARIANTS.map(
      (v) => read(v.key, key, kind) ?? ({ mbps: 0 } as BenchResult),
    );
    if (row.some((r) => r.mbps > 0)) present++;
    chartData[key] = row;
    const sized = row.find((r) => r.bytes);
    payloadLabels[key] = `${label}\n(${sized ? sizeLabel(sized.bytes) : "?"})`;
  }

  if (present === 0) {
    console.warn(
      `  skip ${kind}: no warpo logs - run scripts/run-bench.warpo.sh first`,
    );
    continue;
  }

  const config = createBarChart(chartData, payloadLabels, {
    title: TITLES[kind],
    yLabel: "Throughput (MB/s)",
    xLabel: "Classic payload",
    datasetLabels: VARIANTS.map((v) => v.label),
    colors: VARIANTS.map((v) => ({ bg: v.bg, border: v.border })),
    yStep: 100,
    labelAnchor: "end",
    labelFontSize: 11,
    labelRotation: -90,
  });

  const out = `./build/charts/warpo-vs-asc-${kind}`;
  generateChart(config, `${out}.svg`);
  generateChart(config, `${out}.png`);
}
