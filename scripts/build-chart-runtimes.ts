// Cross-runtime throughput chart for the classic payloads. Compares how fast the
// SAME json-as NAIVE-mode bench deserializes the minified payloads under six
// WebAssembly runtimes (Wago / wasmtime / wavm / wazero / v8 / bun). Every bar is
// the runtime's own bench()-reported MB/s - see scripts/run-bench.runtimes.sh.
//
// Populate the logs first:
//   bash scripts/run-bench.runtimes.sh
// Then:
//   bun scripts/build-chart-runtimes.ts
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import {
  createBarChart,
  generateChart,
  type BenchKind,
  type BenchResult,
} from "./lib/bench-utils";
import { rgba, BASE } from "./lib/palette";
import {
  readRuntimeRun,
  runtimeRunSubtitle,
} from "./lib/runtime-bench-run.mjs";

// One distinct hue per runtime; Wago (the subject) gets the hero blue.
const RUNTIMES: { key: string; label: string; bg: string; border: string }[] = [
  {
    key: "wago",
    label: "Wago",
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

function sizeLabel(bytes: number): string {
  const mb = bytes / 1e6;
  return mb >= 1 ? `${mb.toFixed(1)}MB` : `${Math.round(bytes / 1e3)}KB`;
}

// Resolve once, then pin both renderer processes to the same run even if a
// new benchmark starts while charts are being generated.
const args = process.argv.slice(2);
let selectedKind: string | undefined;
let runId = process.env.JSON_RUNTIME_RUN ?? "";
while (args.length) {
  const arg = args.shift();
  if (arg === "--run") {
    runId = args.shift() ?? "";
    if (!runId) throw new Error("--run requires a run ID");
  } else if (!selectedKind && (arg === "deserialize" || arg === "serialize")) {
    selectedKind = arg;
  } else throw new Error(`Unknown chart argument: ${arg}`);
}
const { manifest, results } = readRuntimeRun(process.cwd(), runId);
if (!selectedKind) {
  for (const kind of ["deserialize", "serialize"]) {
    execFileSync(
      process.execPath,
      [process.argv[1], kind, "--run", manifest.id],
      {
        stdio: "inherit",
      },
    );
  }
  process.exit(0);
}
const runtimes = RUNTIMES.filter(({ key }) => manifest.runtimes.includes(key));
fs.mkdirSync("./build/charts", { recursive: true });
// Export the original provenance, not the renderer's checkout/time/dependencies.
fs.writeFileSync(
  "./build/charts/runtimes-results.json",
  JSON.stringify(
    { manifest, wagoDependencies: manifest.wagoDependencies, results },
    null,
    2,
  ) + "\n",
);

for (const kind of [selectedKind] as BenchKind[]) {
  const chartData: Record<string, BenchResult[]> = {};
  const payloadLabels: Record<string, string> = {};
  let present = 0;

  for (const { key, label } of DATASETS) {
    const row = runtimes.map((rt) => results[rt.key][key][kind] as BenchResult);
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

  const makeConfig = () =>
    createBarChart(chartData, payloadLabels, {
      title: TITLES[kind],
      subtitleText: runtimeRunSubtitle(manifest),
      yLabel: "Throughput (MB/s)",
      xLabel: "",
      datasetLabels: runtimes.map((r) => r.label),
      colors: runtimes.map((r) => ({ bg: r.bg, border: r.border })),
      yStep: 250,
      labelAnchor: "end",
      labelFontSize: 11,
      labelRotation: -90,
    });

  const out = `./build/charts/runtimes-${kind}`;
  generateChart(makeConfig(), `${out}.svg`);
  generateChart(makeConfig(), `${out}.png`);
}
