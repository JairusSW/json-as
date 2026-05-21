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

const KIND: BenchKind = "deserialize";
const OUTPUT_FILE = "./build/charts/chart12.svg";

const allResults = getBenchResults(Object.keys(PAYLOADS));

const chartData: Record<string, BenchResult[]> = {};

for (const payload of Object.keys(PAYLOADS)) {
  chartData[payload] = allResults[payload][KIND];
}

const config = createBarChart(chartData, PAYLOADS, {
  title: "Primitive Deserialization Performance",
  yLabel: "Throughput (MB/s)",
  xLabel: "",
  datasetLabels: [
    "Built-in JSON (JS)",
    "JSON-AS (NAIVE)",
    "JSON-AS (SWAR)",
    "JSON-AS (SIMD)",
  ],
});

generateChart(config, OUTPUT_FILE);
