import fs from "fs";
import path from "path";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import ChartDataLabels from "chartjs-plugin-datalabels";
import type { ChartConfiguration } from "chart.js";
import { subtitle } from "./lib/bench-utils";

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

const payloads = ["small-str", "medium-str", "large-str"];
const engines = ["naive", "swar", "simd"];
const modes = ["deserialize"];

function logPath(payload: string, engine: string, mode: string) {
  return path.join("./build", "logs", "as", engine, `${payload}.${mode}.as.json`);
}

interface ChartPoint { x: number; y: number; }
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

const canvas = new ChartJSNodeCanvas({
  width: 1200,
  height: 700,
  chartCallback: ChartJS => ChartJS.register(ChartDataLabels),
});

const colors: Record<string, string> = {
  "naive": "99,102,241",
  "swar": "34,197,94",
  "simd": "239,68,68"
};

const datasets = [];

for (const mode of modes) {
  for (const engine of engines) {
    const data: ChartPoint[] = payloads.map(p => chartData[`${p}-${engine}-${mode}`][0]);
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
        text: "String Deserialization Throughput vs Payload Size (KB)",
        font: { size: 20, weight: "bold" },
      },
      legend: {
        position: "top",
        labels: {
          font: { size: 16, weight: "bold" },
          padding: 20
        }
      },
      datalabels: {
        anchor: "end",
        align: "top",
        font: { size: 12, weight: "bold" },
        formatter: (value: any) => value.y.toFixed(0) + " MB/s",
      },
      subtitle: {
        display: true,
        text: subtitle(),
        font: { size: 14, weight: "bold" },
        color: "#6b7280",
        padding: 16,
        position: "right"
      }
    },
    scales: {
      x: {
        max: maxX + 7,
        title: { display: true, text: "Payload Size (KB)", font: { size: 16, weight: "bold" } },
        type: "linear",
        grid: {
          color: "rgba(0, 0, 0, 0.08)",
          lineWidth: 1
        }
      },
      y: {
        title: { display: true, text: "Throughput (MB/s)", font: { size: 16, weight: "bold" } },
        beginAtZero: false,
        grid: {
          color: "rgba(0, 0, 0, 0.08)",
          lineWidth: 1
        }
      },
    },
  },
  plugins: [ChartDataLabels],
};

const buffer = canvas.renderToBufferSync(config, "image/png");
fs.writeFileSync('./build/charts/chart04.png', buffer);
console.log("> ./build/charts/chart04.png");