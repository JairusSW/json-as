import fs from "fs";
import ChartDataLabels from "chartjs-plugin-datalabels";
import type { ChartConfiguration } from "chart.js";
import { benchLogPath, subtitle, generateChart } from "./lib/bench-utils";
import { MODE_RGB, INK } from "./lib/palette";

function loadJSON(file: string) {
  const text = fs.readFileSync(file, "utf-8");
  return JSON.parse(text);
}

function getBenchData(filePath: string) {
  const data = loadJSON(filePath);
  return {
    bytes: typeof data.bytes === "number" ? data.bytes : 0,
    mbps: typeof data.mbps === "number" ? data.mbps : 0,
  };
}

const payloads = [
  "obj-1kb",
  "obj-100kb",
  "obj-200kb",
  "obj-300kb",
  "obj-400kb",
  "obj-500kb",
  "obj-600kb",
  "obj-700kb",
  "obj-800kb",
  "obj-900kb",
  "obj-1mb",
];
const engines = ["js", "naive", "swar", "simd"];
const modes = ["serialize"];

function logPath(payload: string, engine: string, mode: string) {
  const language = engine == "js" ? "js" : "as";
  return benchLogPath(
    payload,
    mode as "serialize" | "deserialize",
    language,
    engine == "js" ? "" : engine,
  );
}

interface ChartPoint {
  x: number;
  y: number;
}
const chartData: Record<string, ChartPoint[]> = {};

for (const payload of payloads) {
  for (const engine of engines) {
    for (const mode of modes) {
      const key = `${payload}-${engine}-${mode}`;
      const data = getBenchData(logPath(payload, engine, mode));
      const sizeKB = data.bytes / 1024;

      if (!chartData[key]) chartData[key] = [];
      chartData[key].push({ x: sizeKB, y: data.mbps });
    }
  }
}

const colors = MODE_RGB;

const datasets = [];

for (const mode of modes) {
  for (const engine of engines) {
    const data: ChartPoint[] = payloads.map(
      (p) => chartData[`${p}-${engine}-${mode}`][0],
    );
    datasets.push({
      label: `${engine.toUpperCase()}`,
      data,
      borderColor: `rgba(${colors[engine + "-" + mode] || colors[engine]},0.9)`,
      backgroundColor: `rgba(${colors[engine + "-" + mode] || colors[engine]},0.3)`,
      fill: false,
      tension: 0.2,
      pointStyle: mode === "serialize" ? "circle" : "rect",
      pointRadius: 6,
      borderDash: undefined,
    });
  }
}

// JSON.Obj (dynamic) throughput series - SIMD only; reads the `<payload>-obj`
// logs produced by the JSON.Obj cases in the obj-(de)serialize benches.
const objSeries: ChartPoint[] = payloads.map((p) => {
  const d = getBenchData(logPath(`${p}-obj`, "simd", modes[0]));
  return { x: d.bytes / 1024, y: d.mbps };
});
chartData["jsonobj-simd"] = objSeries;
datasets.push({
  label: "JSON.Obj (SIMD)",
  data: objSeries,
  borderColor: `rgba(${colors["obj"]},0.95)`,
  backgroundColor: `rgba(${colors["obj"]},0.3)`,
  fill: false,
  tension: 0.2,
  pointStyle: modes[0] === "serialize" ? "circle" : "rect",
  pointRadius: 6,
  borderDash: [8, 4],
});

let maxX = 0;
let maxY = 0;

for (const points of Object.values(chartData)) {
  for (const p of points) {
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
}

const config: ChartConfiguration<"line"> = {
  type: "line",
  data: { datasets },
  options: {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: "Object Serialization Throughput vs Payload Size (<=1MB)",
        font: { size: 20, weight: "bold" },
      },
      legend: {
        position: "top",
        labels: {
          font: { size: 16, weight: "bold" },
          padding: 20,
        },
      },
      datalabels: { display: false },
      subtitle: {
        display: true,
        text: subtitle(),
        font: { size: 14, weight: "bold" },
        color: INK.subtitle,
        padding: 16,
        position: "right",
      },
    },
    scales: {
      x: {
        max: maxX + 7,
        title: {
          display: true,
          text: "Payload Size (KB)",
          font: { size: 16, weight: "bold" },
        },
        type: "linear",
        grid: {
          color: INK.grid,
          lineWidth: 1,
        },
      },
      y: {
        // 500 MB/s headroom above the tallest line for the value labels
        max: maxY + 500,
        title: {
          display: true,
          text: "Throughput (MB/s)",
          font: { size: 16, weight: "bold" },
        },
        beginAtZero: false,
        grid: {
          color: INK.grid,
          lineWidth: 1,
        },
      },
    },
  },
  plugins: [ChartDataLabels],
};

// SVG (vector, fast-loading) + PNG (3x density) so the README can
// reference the SVG while the PNG stays available for other uses.
const dims = { width: 1200, height: 700 };
generateChart(config, "./build/charts/object-serialize-1mb.svg", dims);
generateChart(config, "./build/charts/object-serialize-1mb.png", dims);
