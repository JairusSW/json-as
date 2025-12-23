import fs from "fs";
import path from "path";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { execSync } from "child_process";

interface BenchResult {
  language: "as" | "js";
  description: string;
  elapsed: number;
  bytes: number;
  operations: number;
  features: string[];
  mbps: number;
  gbps: number;
}

const PAYLOADS: Record<string, string> = {
  abc: "Alphabet (104b)",
  vec3: "3D Vector (38b)",
  small: "Small Payload (88b)",
  medium: "Medium Payload (2.1kb)",
  large: "Large Payload (10.5kb)"
};

const TYPES = ["serialize", "deserialize"]; // pick one
const USE_TYPE: "serialize" | "deserialize" = "serialize";
const logsDir = "./build/logs";
const OUTPUT_FILE = "./data/chart01.svg";
const VERSION = "v" + JSON.parse(fs.readFileSync("./package.json").toString()).version;
const GIT_HASH = execSync("git rev-parse --short HEAD").toString().trim();
const GIT_BRANCH = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();

function readBenchLog(filePath: string): BenchResult {
  return JSON.parse(fs.readFileSync("./" + filePath, "utf-8")) as BenchResult;
}

function buildResultsMap(): Map<string, BenchResult[]> {
  const logs: {
    as: { swar: Record<string, BenchResult[]>; simd: Record<string, BenchResult[]> };
    js: Record<string, BenchResult[]>;
  } = { as: { swar: {}, simd: {} }, js: {} };

  function getFilePath(kind: "js" | "as", engine?: "swar" | "simd", payload?: string, type?: string) {
    if (kind === "js") return path.join(logsDir, "js", `${payload}.${type}.js.json`);
    return path.join(logsDir, "as", engine!, `${payload}.${type}.as.json`);
  }

  for (const engine of ["swar", "simd"] as const) {
    for (const payload of Object.keys(PAYLOADS)) {
      logs.as[engine][payload] = TYPES.map(type => readBenchLog(getFilePath("as", engine, payload, type)));
    }
  }

  for (const payload of Object.keys(PAYLOADS)) {
    logs.js[payload] = TYPES.map(type => readBenchLog(getFilePath("js", undefined, payload, type)));
  }

  const results = new Map<string, BenchResult[]>();
  for (const payload of Object.keys(PAYLOADS)) {
    const typeIndex = TYPES.indexOf(USE_TYPE);
    results.set(payload, [
      logs.js[payload][typeIndex],       // Native
      logs.as.swar[payload][typeIndex],  // SWAR
      logs.as.simd[payload][typeIndex]   // SIMD
    ]);
  }

  return results;
}

function createChart(results: Map<string, BenchResult[]>, outfile: string) {
  const width = 1000;
  const height = 600;
  const timestamp = new Date().toLocaleString();

  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width,
    height,
    type: outfile.endsWith(".svg") ? "svg" : "png",
    chartCallback: (ChartJS: any) => ChartJS.register(ChartDataLabels)
  });

  const payloadKeys = Array.from(results.keys());
  const labels = payloadKeys.map(key => PAYLOADS[key]); // use display names
  const maxMBPerSec = Math.max(...Array.from(results.values()).flat().map(r => r.mbps));

  const datasets = [
    {
      label: "Built-in JSON (JS)",
      backgroundColor: "rgba(99, 102, 241, 0.85)",
      borderColor: "#6366f1",
      borderWidth: 1,
      data: payloadKeys.map(key => results.get(key)?.[0]?.mbps ?? 0)
    },
    {
      label: "JSON-AS (SWAR)",
      backgroundColor: "rgba(34, 197, 94, 0.85)",
      borderColor: "#22c55e",
      borderWidth: 1,
      data: payloadKeys.map(key => results.get(key)?.[1]?.mbps ?? 0)
    },
    {
      label: "JSON-AS (SIMD)",
      backgroundColor: "rgba(239, 68, 68, 0.9)",
      borderColor: "#ef4444",
      borderWidth: 2,
      data: payloadKeys.map(key => results.get(key)?.[2]?.mbps ?? 0)
    }
  ];

  const config = {
    type: "bar",
    data: { labels, datasets },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "top", labels: { font: { size: 16, weight: "bold" }, padding: 20 } },
        datalabels: { anchor: "end", align: "end", font: { weight: "bold", size: 12 }, formatter: (v: number) => v.toFixed(0) },
        subtitle: {
          display: true,
          text: `${timestamp} • ${VERSION} • ${GIT_HASH} • ${GIT_BRANCH}`,
          font: { size: 14, weight: "bold" },
          color: "#6b7280",
          padding: { bottom: 20 },
          position: {right:0}
        }
      },
      scales: {
        y: { beginAtZero: true, max: Math.ceil(maxMBPerSec / 500) * 500, title: { display: true, text: "Throughput (MB/s)", font: { size: 16, weight: "bold" } }, ticks: { font: { size: 14, weight: "bold" }, stepSize: 500 } },
        x: { title: { display: true, text: "Payload", font: { size: 16, weight: "bold" } }, ticks: { font: { size: 14, weight: "bold" } } }
      },
      interaction: { mode: "index", intersect: false }
    },
    plugins: [ChartDataLabels]
  };

  const buffer = chartJSNodeCanvas.renderToBufferSync(
    config,
    outfile.endsWith(".svg") ? "image/svg+xml" : "image/png"
  );
  fs.writeFileSync(outfile, buffer);
  console.log(`Chart written to ${outfile}`);
}

const results = buildResultsMap();
createChart(results, OUTPUT_FILE);
