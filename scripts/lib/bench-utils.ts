import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import ChartDataLabels from "chartjs-plugin-datalabels";
import type { ChartConfiguration } from "chart.js";

export interface BenchResult {
  language: "as" | "js";
  description: string;
  elapsed: number;
  bytes: number;
  operations: number;
  features: string[];
  mbps: number;
  gbps: number;
}

export type BenchKind = "serialize" | "deserialize";

export interface BenchResults {
  [payload: string]: {
    serialize: BenchResult[];
    deserialize: BenchResult[];
  };
}

export interface LineSeries {
  label: string;
  data: number[];
  borderColor: string;
  backgroundColor?: string;
}

const LOGS_DIR = "./build/logs";

const VERSION = "v" + JSON.parse(fs.readFileSync("./package.json", "utf-8")).version;
let V8_VERSION = execSync("v8").toString().trim().slice(11);
V8_VERSION = V8_VERSION.slice(0, V8_VERSION.indexOf("\n")).trim();
const GIT_HASH = execSync("git rev-parse --short HEAD").toString().trim();
const GIT_BRANCH = execSync("git rev-parse --abbrev-ref HEAD").toString().trim();

export function subtitle() {
  return `${new Date().toDateString()} • ${VERSION} • v8 ${V8_VERSION} • ${GIT_HASH} • ${GIT_BRANCH}`;
}

function readBenchLog(filePath: string): BenchResult {
  return JSON.parse(fs.readFileSync("./" + filePath, "utf-8")) as BenchResult;
}

function benchPath(kind: "js" | "as", payload: string, type: BenchKind, engine?: "swar" | "simd" | "naive"): string {
  if (kind === "js") {
    return path.join(LOGS_DIR, "js", `${payload}.${type}.js.json`);
  }
  return path.join(LOGS_DIR, "as", engine!.toLowerCase(), `${payload}.${type}.as.json`);
}

export function getBenchResults(payloads: string[]): BenchResults {
  const out: BenchResults = {};

  for (const payload of payloads) {
    out[payload] = { serialize: [], deserialize: [] };

    for (const kind of ["serialize", "deserialize"] as const) {
      const js = readBenchLog(benchPath("js", payload, kind));
      const naive = readBenchLog(benchPath("as", payload, kind, "naive"));
      const swar = readBenchLog(benchPath("as", payload, kind, "swar"));
      const simd = readBenchLog(benchPath("as", payload, kind, "simd"));

      out[payload][kind] = [js, naive, swar, simd];
    }
  }

  return out;
}

export function createBarChart(
  data: Record<string, BenchResult[]>,
  payloadLabels: Record<string, string>,
  options: {
    title: string;
    yLabel?: string;
    xLabel?: string;
    datasetLabels?: string[];
  },
): ChartConfiguration<"bar"> {
  const payloadKeys = Object.keys(data);
  const labels = payloadKeys.map((k) => payloadLabels[k] ?? k);

  const maxMBps = Math.max(
    ...Object.values(data)
      .flat()
      .map((r) => r.mbps),
  );

  const datasetNames = options.datasetLabels ?? ["Built-in JSON (JS)", "JSON-AS (NAIVE)", "JSON-AS (SWAR)", "JSON-AS (SIMD)"];

  return {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: datasetNames[0],
          data: payloadKeys.map((k) => data[k][0].mbps),
          backgroundColor: "rgba(99,102,241,0.85)",
          borderColor: "#6366f1",
          borderWidth: 1,
        },
        {
          label: datasetNames[1],
          data: payloadKeys.map((k) => data[k][1].mbps),
          backgroundColor: "rgba(255, 241, 49, 0.85)", // vibrant purple
          borderColor: "rgb(255, 241, 49)",
          borderWidth: 1,
        },
        {
          label: datasetNames[2],
          data: payloadKeys.map((k) => data[k][2].mbps),
          backgroundColor: "rgba(34,197,94,0.85)",
          borderColor: "#22c55e",
          borderWidth: 1,
        },
        {
          label: datasetNames[3],
          data: payloadKeys.map((k) => data[k][3].mbps),
          backgroundColor: "rgba(239,68,68,0.9)",
          borderColor: "#ef4444",
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: !!options.title,
          text: options.title,
          font: { size: 20, weight: "bold" },
        },
        legend: {
          position: "top",
          labels: {
            font: { size: 16, weight: "bold" },
            padding: 20,
          },
        },
        datalabels: {
          anchor: "end",
          align: "end",
          font: { weight: "bold", size: 12 },
          formatter: (v: number) => v.toFixed(0),
        },
        subtitle: {
          display: true,
          text: subtitle(),
          font: { size: 14, weight: "bold" },
          color: "#6b7280",
          padding: 16,
          position: "right",
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          max: Math.ceil(maxMBps / 500) * 500,
          title: {
            display: true,
            text: options.yLabel ?? "Throughput (MB/s)",
            font: { size: 16, weight: "bold" },
          },
          ticks: {
            stepSize: 500,
            font: { size: 14, weight: "bold" },
          },
        },
        x: {
          title: {
            display: true,
            text: options.xLabel ?? "Payload",
            font: { size: 16, weight: "bold" },
          },
          ticks: {
            maxRotation: 0,
            minRotation: 0,
            font: { size: 14, weight: "bold" },
          },
        },
      },
    },
    plugins: [ChartDataLabels],
  };
}

export function createLineChart(
  labels: string[],
  series: LineSeries[],
  options: {
    title: string;
    xLabel: string;
    yLabel: string;
    logX?: boolean;
  },
): ChartConfiguration<"line"> {
  return {
    type: "line",
    data: {
      labels,
      datasets: series.map((s) => ({
        label: s.label,
        data: s.data,
        borderColor: s.borderColor,
        backgroundColor: s.backgroundColor ?? s.borderColor,
        borderWidth: 3,
        tension: 0.25,
        pointRadius: 4,
      })),
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: options.title,
          font: { size: 20, weight: "bold" },
        },
        legend: {
          position: "top",
          labels: {
            font: { size: 16, weight: "bold" },
          },
        },
        subtitle: {
          display: true,
          text: subtitle(),
          font: { size: 14, weight: "bold" },
          color: "#6b7280",
          padding: { bottom: 16 },
        },
      },
      scales: {
        x: {
          type: options.logX ? "logarithmic" : "category",
          title: {
            display: true,
            text: options.xLabel,
            font: { size: 16, weight: "bold" },
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: options.yLabel,
            font: { size: 16, weight: "bold" },
          },
        },
      },
    },
  };
}

export function generateChart(config: ChartConfiguration, outfile: string) {
  const canvas = new ChartJSNodeCanvas({
    width: 1000,
    height: 600,
    type: outfile.endsWith(".svg") ? "svg" : "png",
    chartCallback: (ChartJS) => ChartJS.register(ChartDataLabels),
  });

  const buffer = canvas.renderToBufferSync(config, outfile.endsWith(".svg") ? "image/svg+xml" : "image/png");

  fs.writeFileSync(outfile, buffer);
  console.log(`> ${outfile}`);
}
