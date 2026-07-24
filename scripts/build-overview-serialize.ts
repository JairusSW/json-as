import {
  getBenchResults,
  readObjBenchResult,
  createBarChart,
  generateChart,
  type BenchKind,
  BenchResult,
} from "./lib/bench-utils";
import { MODE_BARS, OBJ_BAR } from "./lib/palette";

// A zero bar for payloads with no JSON.Obj variant (primitives) or unrun benches.
const ZERO_OBJ: BenchResult = {
  language: "as",
  description: "JSON.Obj",
  elapsed: 0,
  bytes: 0,
  operations: 0,
  features: [],
  mbps: 0,
  gbps: 0,
};

const PAYLOADS: Record<string, string> = {
  abc: "Alphabet\n   (52b)",
  uuidv4: "UUIDv4\n   (36b)",
  vec3: "3D Vector\n     (19b)",
  token: "Token\n  (49b)",
  small: "Small Payload\n        (44b)",
  medium: "Medium Payload\n        (1.1kb)",
  large: "Large Payload\n      (5.3kb)",
};

const KIND: BenchKind = "serialize";
const OUTPUT_FILE = "./build/charts/overview-serialize.svg";

const allResults = getBenchResults(Object.keys(PAYLOADS));

const chartData: Record<string, BenchResult[]> = {};

for (const payload of Object.keys(PAYLOADS)) {
  // Append the dynamic JSON.Obj (SIMD) result as a fifth series.
  chartData[payload] = [
    ...allResults[payload][KIND],
    readObjBenchResult(payload, KIND) ?? ZERO_OBJ,
  ];
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
    "JSON-AS (JSON.Obj)",
  ],
  colors: [...MODE_BARS, OBJ_BAR],
  // Stand the value labels up off each bar top so adjacent ones don't collide.
  labelRotation: -90,
});

// SVG (vector, fast-loading) + PNG (3x density) so the README can reference the
// SVG while the PNG stays available for other uses.
generateChart(config, OUTPUT_FILE);
generateChart(config, OUTPUT_FILE.replace(/\.svg$/, ".png"));
