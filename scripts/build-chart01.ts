import {
  getBenchResults,
  createBarChart,
  generateChart,
  type BenchKind,
  BenchResult,
} from "./lib/bench-utils";

const PAYLOADS: Record<string, string> = {
  abc: "Alphabet\n   (104b)",
  uuidv4: "UUIDv4\n   (72b)",
  vec3: "3D Vector\n     (38b)",
  small: "Small Payload\n       (216b)",
  medium: "Medium Payload\n        (2.1kb)",
  large: "Large Payload\n      (10.5kb)",
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

generateChart(config, OUTPUT_FILE);
