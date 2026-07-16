import {
  createBarChart,
  generateChart,
  readASBenchResult,
  type BenchKind,
  type BenchResult,
} from "./lib/bench-utils";
import { BASE, MODE_BARS, rgba } from "./lib/palette";

const PAYLOADS: Record<string, string> = {
  vec3: "3D Vector\n(19b)",
  token: "Token\n(49b)",
  small: "Small Payload\n(108b)",
  medium: "Medium Payload\n(1.1kb)",
  large: "Large Payload\n(5.5kb)",
};

const MODES = ["naive", "swar", "simd"] as const;
const COLORS = [
  MODE_BARS[1],
  { bg: rgba("orange", 0.35), border: BASE.orange },
  MODE_BARS[2],
  { bg: rgba("jungleGreen", 0.35), border: BASE.jungleGreen },
  MODE_BARS[3],
  { bg: rgba("pacificBlue", 0.35), border: BASE.pacificBlue },
];

const requestedKind = process.env["JSON_BENCH_KIND"];
const kinds: BenchKind[] =
  requestedKind == "serialize" || requestedKind == "deserialize"
    ? [requestedKind]
    : ["serialize", "deserialize"];

for (const kind of kinds) {
  const chartData: Record<string, BenchResult[]> = {};
  for (const payload of Object.keys(PAYLOADS)) {
    chartData[payload] = MODES.flatMap((mode) => [
      readASBenchResult(payload, kind, mode),
      readASBenchResult(`${payload}-nondefault`, kind, mode),
    ]);
  }

  const operation = kind == "serialize" ? "Serialization" : "Deserialization";
  const out = `./build/charts/default-values-${kind}`;
  const dims = { width: 1200, height: 700 };
  // Chart.js mutates configuration objects while laying them out. Build a
  // fresh config for each format so the SVG render cannot affect the PNG.
  for (const extension of ["svg", "png"]) {
    const config = createBarChart(chartData, PAYLOADS, {
      title: `${operation}: default vs non-default values`,
      yLabel: "Throughput (MB/s)",
      xLabel: "",
      datasetLabels: [
        "NAIVE default",
        "NAIVE non-default",
        "SWAR default",
        "SWAR non-default",
        "SIMD default",
        "SIMD non-default",
      ],
      colors: COLORS,
      labelAnchor: "end",
      labelFontSize: 11,
      labelRotation: -90,
    });
    generateChart(config, `${out}.${extension}`, dims);
  }
}
