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
  "str-1kb",
  "str-100kb",
  "str-200kb",
  "str-300kb",
  "str-400kb",
  "str-500kb",
  "str-600kb",
  "str-700kb",
  "str-800kb",
  "str-900kb",
  "str-1mb",
];
const engines = ["js", "naive", "swar", "simd"];
const modes = ["deserialize"];

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

// JSON.Value (dynamic) throughput series - SIMD only; reads the `<payload>-value`
// logs produced by the JSON.Value cases in the str-(de)serialize benches.
const valueSeries: ChartPoint[] = payloads.map((p) => {
  const d = getBenchData(logPath(`${p}-value`, "simd", modes[0]));
  return { x: d.bytes / 1024, y: d.mbps };
});
chartData["jsonvalue-simd"] = valueSeries;
datasets.push({
  label: "JSON.Value (SIMD)",
  data: valueSeries,
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
        text: "String Deserialization Throughput vs Payload Size (<=1MB)",
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
        align: "top",
        font: { size: 12, weight: "bold" },
        formatter: (value) => value.y.toFixed(0) + " MB/s",
      },
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
generateChart(config, "./build/charts/string-deserialize-1mb.svg", dims);
generateChart(config, "./build/charts/string-deserialize-1mb.png", dims);
