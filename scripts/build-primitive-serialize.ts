import {
  getBenchResults,
  createBarChart,
  generateChart,
  type BenchKind,
  BenchResult,
} from "./lib/bench-utils";

const PAYLOADS: Record<string, string> = {
  "prim-bool": "bool\n  (4b)",
  "prim-i32": "i32\n   (11b)",
  "prim-i64": "i64\n   (20b)",
  "prim-f32": "f32\n   (9b)",
  "prim-f64": "f64\n   (17b)",
  "prim-string": "string\n     (13b)",
};

const KIND: BenchKind = "serialize";
const OUTPUT_FILE = "./build/charts/primitive-serialize.svg";

const allResults = getBenchResults(Object.keys(PAYLOADS));

const chartData: Record<string, BenchResult[]> = {};

for (const payload of Object.keys(PAYLOADS)) {
  chartData[payload] = allResults[payload][KIND];
}

const config = createBarChart(chartData, PAYLOADS, {
  title: "Primitive Serialization Performance",
  yLabel: "Throughput (MB/s)",
  xLabel: "",
  datasetLabels: [
    "Built-in JSON (JS)",
    "JSON-AS (NAIVE)",
    "JSON-AS (SWAR)",
    "JSON-AS (SIMD)",
  ],
});

// SVG (vector, fast-loading) + PNG (3x density) so the README can reference
// the SVG while the PNG stays available for other uses.
generateChart(config, OUTPUT_FILE);
generateChart(config, OUTPUT_FILE.replace(/\.svg$/, ".png"));
