import fs from "fs";
import path from "path";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import ChartDataLabels from "chartjs-plugin-datalabels";
import type { ChartConfiguration } from "chart.js";

const LOGS_DIR = "./build/logs";

/**
 * Load a bench log JSON by file path
 */
function loadJSON(file: string) {
  const text = fs.readFileSync(file, "utf-8");
  return JSON.parse(text);
}

/**
 * Get throughput (mbps) and size (bytes) from a bench log
 */
function getBenchData(filePath: string) {
  const data = loadJSON(filePath);
  return {
    bytes: typeof data.bytes === "number" ? data.bytes : 0,
    mbps: typeof data.mbps === "number" ? data.mbps : 0,
  };
}

/* ================================
 * Payload Types — only strings
 * ================================ */
const payloads = ["small-str", "medium-str", "large-str"];
const engines = ["swar", "simd"];
const modes = ["serialize", "deserialize"];

// Helper to build log file path
function logPath(payload: string, engine: string, mode: string) {
  return path.join(LOGS_DIR, "as", engine, `${payload}.${mode}.as.json`);
}

/* ================================
 * Prepare Chart Data
 * ================================ */
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

/* ================================
 * Configure Chart
 * ================================ */
const canvas = new ChartJSNodeCanvas({
  width: 1200,
  height: 700,
  chartCallback: ChartJS => ChartJS.register(ChartDataLabels),
});

const colors: Record<string, string> = {
  "swar-serialize": "34,197,94",    // green
  "swar-deserialize": "59,130,246", // blue
  "simd-serialize": "234,179,8",    // yellow
  "simd-deserialize": "220,38,38",  // red
};


const datasets = [];

for (const mode of modes) {
  for (const engine of engines) {
    const data: ChartPoint[] = payloads.map(p => chartData[`${p}-${engine}-${mode}`][0]);
    datasets.push({
      label: `${engine} ${mode}`,
      data,
      borderColor: `rgba(${colors[engine + "-" + mode]},0.9)`,
      backgroundColor: `rgba(${colors[engine+"-"+mode]},0.3)`,
      fill: false,
      tension: 0.2,
      pointStyle: mode === "serialize" ? "circle" : "rect",
      pointRadius: 6,
      borderDash: engine === "simd" ? [5, 5] : undefined,
    });
  }
}


/* ================================
 * Chart Configuration
 * ================================ */
const config: ChartConfiguration<"line"> = {
  type: "line",
  data: { datasets },
  options: {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: "String Serialization & Deserialization Throughput vs Payload Size (KB)",
        font: { size: 20, weight: "bold" },
      },
      legend: { position: "top", labels: { font: { size: 14, weight: "bold" } } },
      datalabels: {
        anchor: "end",
        align: "top",
        font: { size: 10, weight: "bold" },
        formatter: (value: any) => `${value.y.toFixed(0)} MB/s`,
      },
    },
    scales: {
      x: {
        title: { display: true, text: "Payload Size (KB)", font: { size: 16, weight: "bold" } },
        type: "linear",
      },
      y: {
        title: { display: true, text: "Throughput (MB/s)", font: { size: 16, weight: "bold" } },
        beginAtZero: true,
      },
    },
  },
  plugins: [ChartDataLabels],
};

/* ================================
 * Render Chart to PNG
 * ================================ */
console.log("Rendering chart03 for strings (serialize + deserialize)...");
const buffer = canvas.renderToBufferSync(config, "image/png");
const outFile = path.join(LOGS_DIR, "chart03.png");
fs.writeFileSync(outFile, buffer);
console.log(`chart03.png written → ${outFile}`);
