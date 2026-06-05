import fs from "fs";
import {
  getBenchResults,
  createBarChart,
  generateChart,
  benchLogPath,
  type BenchKind,
  BenchResult,
} from "./lib/bench-utils";
import { BASE, rgba } from "./lib/palette";
import type { Context } from "chartjs-plugin-datalabels";

const PAYLOADS: Record<string, string> = {
  abc: "Alphabet\n   (52b)",
  uuidv4: "UUIDv4\n   (36b)",
  vec3: "3D Vector\n     (19b)",
  token: "Token\n  (49b)",
  small: "Small Payload\n       (108b)",
  medium: "Medium Payload\n        (1.1kb)",
  large: "Large Payload\n      (5.5kb)",
};

const KIND: BenchKind = "serialize";
const OUTPUT_FILE = "./build/charts/chart01.svg";

const allResults = getBenchResults(Object.keys(PAYLOADS));

const chartData: Record<string, BenchResult[]> = {};

for (const payload of Object.keys(PAYLOADS)) {
  chartData[payload] = allResults[payload][KIND];
}

const config = createBarChart(chartData, PAYLOADS, {
  title: "Serialization Performance",
  yLabel: "Throughput (MB/s)",
  xLabel: "",
  datasetLabels: [
    "Built-in JSON (JS)",
    "JSON-AS (NAIVE)",
    "JSON-AS (SWAR)",
    "JSON-AS (SIMD)",
  ],
});

// Lazy (@json({ lazy: "auto" })) best-case SIMD bar, added per payload that has
// a *.lazy.bench.ts (vec3/token/small/medium/large). Faded-copper, distinct
// from the four eager hues; solid border + 0.8-opacity fill flag that the lazy
// comparison defers work and so isn't strictly apples-to-apples.
const LAZY_PAYLOADS = ["vec3", "token", "small", "medium", "large"];
function lazyMbps(payload: string, kind: BenchKind): number {
  if (!LAZY_PAYLOADS.includes(payload)) return 0;
  const file = "./" + benchLogPath(`${payload}-lazy`, kind, "as", "simd");
  if (!fs.existsSync(file)) return 0;
  const data = JSON.parse(fs.readFileSync(file, "utf-8"));
  return typeof data.mbps === "number" ? data.mbps : 0;
}

const lazyData = Object.keys(PAYLOADS).map((p) => lazyMbps(p, KIND));
config.data.datasets.push({
  label: "JSON-AS (SIMD, lazy)",
  data: lazyData,
  backgroundColor: rgba("fadedCopper", 0.8),
  borderColor: BASE.fadedCopper,
  borderWidth: 1,
  // Suppress the "0" label on payloads that have no lazy variant.
  datalabels: {
    display: (ctx: Context) => Number(ctx.dataset.data[ctx.dataIndex]) > 0,
  },
});

// Raise the y-axis ceiling if a lazy bar is now the tallest.
const allMbps = config.data.datasets.flatMap((d) => d.data as number[]);
const yStep = 500;
(config.options!.scales!.y as { max?: number }).max =
  Math.ceil((Math.max(...allMbps) + yStep / 2) / yStep) * yStep;

generateChart(config, OUTPUT_FILE);
