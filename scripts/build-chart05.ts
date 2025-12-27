import fs from "fs";
import path from "path";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import ChartDataLabels from "chartjs-plugin-datalabels";
import type { ChartConfiguration } from "chart.js";
import { subtitle } from "./lib/bench-utils";

/* ============================
   CONFIG
============================ */

const payload = "medium-str";
const engines = ["naive", "swar", "simd"];
const mode = "serialize";

/* ============================
   IO
============================ */

function loadJSON(file: string) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

function logPath(engine: string) {
  return path.join(
    "./build",
    "logs",
    "as",
    engine,
    `${payload}.${mode}.as.json`
  );
}

type BenchData = {
  memoryLogs: number[];
};

/* ============================
   LOAD DATA
============================ */

const series: Record<string, number[]> = {};

for (const engine of engines) {
  const data = loadJSON(logPath(engine)) as BenchData;

  if (!data.memoryLogs || !Array.isArray(data.memoryLogs)) {
    throw new Error(`Missing memoryLogs in ${engine} benchmark`);
  }

  series[engine] = data.memoryLogs;
}

/* ============================
   CHART SETUP
============================ */

const canvas = new ChartJSNodeCanvas({
  width: 1200,
  height: 700,
  chartCallback: ChartJS => ChartJS.register(ChartDataLabels),
});

const colors: Record<string, string> = {
  naive: "99,102,241",
  swar: "34,197,94",
  simd: "239,68,68",
};

const maxSamples = Math.max(...Object.values(series).map(s => s.length));
const labels = Array.from({ length: maxSamples }, (_, i) => i);

/* ============================
   DATASETS
============================ */

const datasets = engines.map(engine => ({
  label: engine.toUpperCase(),
  data: series[engine].map((y, x) => ({ x, y })),
  borderColor: `rgba(${colors[engine]},0.9)`,
  backgroundColor: `rgba(${colors[engine]},0.15)`,
  fill: false,
  tension: 0.15,
  pointRadius: 0,       // 🔑 timeline = no dots
  borderWidth: 2,
}));

/* ============================
   AXIS SCALING
============================ */

let maxY = 0;
for (const logs of Object.values(series)) {
  for (const v of logs) maxY = Math.max(maxY, v);
}

/* ============================
   CHART CONFIG
============================ */

const config: ChartConfiguration<"line"> = {
  type: "line",
  data: { labels, datasets },
  options: {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: "Memory Usage Over Time",
        font: { size: 20, weight: "bold" },
      },
      legend: {
        position: "top",
        labels: { font: { size: 16, weight: "bold" }, padding: 20 },
      },
      datalabels: {
        display: false, // 🔑 disable labels for dense timeline
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
      x: {
        title: {
          display: true,
          text: "Time (sample index)",
          font: { size: 16, weight: "bold" },
        },
        grid: { color: "rgba(0,0,0,0.08)" },
      },
      y: {
        title: {
          display: true,
          text: "Memory Usage (KiB)",
          font: { size: 16, weight: "bold" },
        },
        beginAtZero: true,
        max: Math.ceil(maxY / 256) * 256,
        grid: { color: "rgba(0,0,0,0.08)" },
      },
    },
  },
  plugins: [ChartDataLabels],
};

/* ============================
   RENDER
============================ */

const buffer = canvas.renderToBufferSync(config, "image/png");
const out = "./build/charts/memory-timeline.png";
fs.writeFileSync(out, buffer);
console.log(`> ${out}`);
