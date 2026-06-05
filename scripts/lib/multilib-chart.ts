import fs from "fs";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import ChartDataLabels from "chartjs-plugin-datalabels";
import type { ChartConfiguration } from "chart.js";
import { benchLogPath, subtitle, type BenchKind } from "./bench-utils";

// Renders one multi-library throughput chart (chart13 = deserialize,
// chart14 = serialize). Both pull from the standard bench logs written by the
// multilib `*.bench.ts` files (AS via run-bench.as.sh in NAIVE/SWAR/SIMD,
// JS via run-bench.js.sh), so they ride the normal bench → chart pipeline
// instead of a bespoke runner.

const MODES = ["NAIVE", "SWAR", "SIMD"] as const;

// Grouped by family, blue-vs-amber for the two json-as families (the classic
// colourblind-safe contrast), slate for the recede-able JS baselines, rose for
// the competitor. NAIVE→SIMD shades light→dark within each json-as family.
//   • json-as struct        → blue
//   • json-as struct (lazy) → amber
//   • json-as JSON.Obj      → forest green
//   • JS baselines          → slate
//   • assemblyscript-json   → rose
const COLORS: Record<string, string> = {
  "native JSON (JS)": "#cbd5e1", // slate-300
  "fast-json-parse (JS)": "#94a3b8", // slate-400
  "fast-json-stringify (JS)": "#94a3b8", // slate-400
  "assemblyscript-json": "#e11d48", // rose-600
  "json-as struct (NAIVE)": "#93c5fd", // blue-300
  "json-as struct (SWAR)": "#3b82f6", // blue-500
  "json-as struct (SIMD)": "#1e40af", // blue-800
  "json-as struct lazy (NAIVE)": "#fcd34d", // amber-300
  "json-as struct lazy (SWAR)": "#f59e0b", // amber-500
  "json-as struct lazy (SIMD)": "#b45309", // amber-700
  "json-as JSON.Obj (NAIVE)": "#4ade80", // green-400
  "json-as JSON.Obj (SWAR)": "#16a34a", // green-600
  "json-as JSON.Obj (SIMD)": "#166534", // green-800 (forest)
};

function mbps(payload: string, kind: BenchKind, engine = ""): number {
  const file = benchLogPath(payload, kind, engine ? "as" : "js", engine);
  const data = JSON.parse(fs.readFileSync(file, "utf-8"));
  return typeof data.mbps === "number" ? data.mbps : 0;
}

export function buildMultilibChart(kind: BenchKind, outfile: string): void {
  const entries: [string, number][] = [];

  // JS, in its own fresh V8 (native JSON is the baseline; fast-json-* is the
  // op-specific specialist — parse for deserialize, stringify for serialize).
  entries.push(["native JSON (JS)", mbps("multilib-native-json", kind)]);
  if (kind === "deserialize") {
    entries.push([
      "fast-json-parse (JS)",
      mbps("multilib-fast-json-parse", kind),
    ]);
  } else {
    entries.push([
      "fast-json-stringify (JS)",
      mbps("multilib-fast-json-stringify", kind),
    ]);
  }

  // json-as generated struct + dynamic JSON.Obj, one bar per mode.
  for (const mode of MODES) {
    const m = mode.toLowerCase();
    entries.push([
      `json-as struct (${mode})`,
      mbps("multilib-json-as-struct", kind, m),
    ]);
    entries.push([
      `json-as struct lazy (${mode})`,
      mbps("multilib-json-as-struct-lazy", kind, m),
    ]);
    entries.push([
      `json-as JSON.Obj (${mode})`,
      mbps("multilib-json-obj", kind, m),
    ]);
  }

  // assemblyscript-json is mode-independent (it doesn't use json-as's parser);
  // average its three identical runs so it shows as a single bar.
  const asj = MODES.map((mode) =>
    mbps("multilib-assemblyscript-json", kind, mode.toLowerCase()),
  );
  entries.push([
    "assemblyscript-json",
    asj.reduce((a, b) => a + b, 0) / asj.length,
  ]);

  entries.sort((a, b) => b[1] - a[1]);

  const payloadBytes = Buffer.byteLength(
    fs.readFileSync("./assembly/__benches__/payloads/multilib.json", "utf-8"),
    "utf8",
  );
  const KiB = (payloadBytes / 1024).toFixed(0);
  const top = entries[0][1];

  const config: ChartConfiguration<"bar"> = {
    type: "bar",
    data: {
      labels: entries.map(([l]) => l),
      datasets: [
        {
          data: entries.map(([, v]) => Math.round(v)),
          backgroundColor: entries.map(([l]) => COLORS[l] ?? "#888888"),
          borderWidth: 0,
        },
      ],
    },
    options: {
      indexAxis: "y",
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: "end",
          align: "end",
          color: "#374151",
          font: { size: 12, weight: "bold" },
          formatter: (v: number) => Math.round(v).toLocaleString() + " MB/s",
        },
        title: {
          display: true,
          text: `JSON Library Comparison — ${kind[0].toUpperCase() + kind.slice(1)} throughput (${KiB} KiB payload)`,
          font: { size: 20, weight: "bold" },
        },
        subtitle: {
          display: true,
          text: subtitle(),
          font: { size: 14, weight: "bold" },
          color: "#6b7280",
          padding: 16,
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "Throughput (MB/s — higher is better)",
            font: { size: 16, weight: "bold" },
          },
          beginAtZero: true,
          max: Math.ceil((top * 1.15) / 500) * 500,
        },
        y: { ticks: { font: { size: 13, weight: "bold" } } },
      },
    },
    plugins: [ChartDataLabels],
  };

  config.options = { ...(config.options ?? {}), devicePixelRatio: 3 };
  const canvas = new ChartJSNodeCanvas({
    width: 1150,
    height: 640,
    backgroundColour: "white",
    chartCallback: (ChartJS) => ChartJS.register(ChartDataLabels),
  });
  const buffer = canvas.renderToBufferSync(config, "image/png");
  fs.writeFileSync(outfile, buffer);
  console.log(`> ${outfile}`);
}
