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
  "obj-1mb",
  "obj-2mb",
  "obj-3mb",
  "obj-4mb",
  "obj-5mb",
  "obj-6mb",
  "obj-7mb",
  "obj-8mb",
  "obj-9mb",
  "obj-10mb",
];
const modes = ["deserialize"];

type SeriesSpec = {
  key: string;
  label: string;
  language: "js" | "as";
  engine: string;
  payloadTransform?: (payload: string) => string;
  dash?: number[];
};

const series: SeriesSpec[] = [
  { key: "js", label: "JS", language: "js", engine: "" },
  { key: "naive", label: "NAIVE", language: "as", engine: "naive" },
  { key: "swar", label: "SWAR", language: "as", engine: "swar" },
  { key: "simd", label: "SIMD", language: "as", engine: "simd" },
  // Dynamic JSON.Obj (SIMD only): same payloads, read from the `<payload>-obj`
  // logs the JSON.Obj bench cases dump.
  {
    key: "obj",
    label: "JSON.Obj (SIMD)",
    language: "as",
    engine: "simd",
    payloadTransform: (p) => `${p}-obj`,
    dash: [8, 4],
  },
];

function logPath(payload: string, spec: SeriesSpec, mode: string) {
  const transformedPayload = spec.payloadTransform
    ? spec.payloadTransform(payload)
    : payload;
  return benchLogPath(
    transformedPayload,
    mode as "serialize" | "deserialize",
    spec.language,
    spec.engine,
  );
}

interface ChartPoint {
  x: number;
  y: number;
}
const chartData: Record<string, ChartPoint[]> = {};

for (const payload of payloads) {
  for (const spec of series) {
    for (const mode of modes) {
      const key = `${payload}-${spec.key}-${mode}`;
      const data = getBenchData(logPath(payload, spec, mode));
      const sizeKB = data.bytes / 1024;

      if (!chartData[key]) chartData[key] = [];
      chartData[key].push({ x: sizeKB, y: data.mbps });
    }
  }
}

const colors = MODE_RGB;

const datasets = [];

for (const mode of modes) {
  for (const spec of series) {
    const data: ChartPoint[] = payloads.map(
      (p) => chartData[`${p}-${spec.key}-${mode}`][0],
    );
    datasets.push({
      label: spec.label,
      data,
      borderColor: `rgba(${colors[spec.key + "-" + mode] || colors[spec.key]},0.9)`,
      backgroundColor: `rgba(${colors[spec.key + "-" + mode] || colors[spec.key]},0.3)`,
      fill: false,
      tension: 0.2,
      pointStyle: mode === "serialize" ? "circle" : "rect",
      pointRadius: 6,
      borderDash: spec.dash,
    });
  }
}

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
        text: "Object Deserialization Throughput vs Payload Size",
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
generateChart(config, "./build/charts/object-deserialize.svg", dims);
generateChart(config, "./build/charts/object-deserialize.png", dims);
