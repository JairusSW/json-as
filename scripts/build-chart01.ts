import {
  getBenchResults,
  createBarChart,
  generateChart,
  type BenchKind
} from "./lib/bench-utils";

const PAYLOADS: Record<string, string> = {
  abc: "Alphabet (104b)",
  vec3: "3D Vector (38b)",
  small: "Small Payload (88b)",
  medium: "Medium Payload (2.1kb)",
  large: "Large Payload (10.5kb)"
};

const KIND: BenchKind = "serialize";
const OUTPUT_FILE = "./build/charts/chart01.svg";

const allResults = getBenchResults(Object.keys(PAYLOADS));

const chartData: Record<string, any> = {};

for (const payload of Object.keys(PAYLOADS)) {
  chartData[payload] = allResults[payload][KIND];
}

const config = createBarChart(chartData, PAYLOADS, {
  title: "Serialization Throughput by Payload Size",
  yLabel: "Throughput (MB/s)",
  xLabel: "Payload",
  datasetLabels: [
    "Built-in JSON (JS)",
    "JSON-AS (NAIVE)",
    "JSON-AS (SWAR)",
    "JSON-AS (SIMD)"
  ]
});

generateChart(config, OUTPUT_FILE);
