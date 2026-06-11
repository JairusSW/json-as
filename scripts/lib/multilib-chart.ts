import fs from "fs";
import ChartDataLabels from "chartjs-plugin-datalabels";
import type { ChartConfiguration } from "chart.js";
import {
  benchLogPath,
  subtitle,
  generateChart,
  type BenchKind,
} from "./bench-utils";
import { MULTILIB_COLORS as COLORS, INK } from "./palette";

// Renders one multi-library throughput chart (library-serialize /
// library-deserialize). Both pull from the standard bench logs written by the
// multilib `*.bench.ts` files (AS via run-bench.as.sh in NAIVE/SWAR/SIMD,
// JS via run-bench.js.sh), so they ride the normal bench → chart pipeline
// instead of a bespoke runner. Colours come from the shared palette (grouped by
// family, NAIVE→SIMD as a light→dark opacity ramp).

const MODES = ["NAIVE", "SWAR", "SIMD"] as const;

function mbps(payload: string, kind: BenchKind, engine = ""): number {
  const file = benchLogPath(payload, kind, engine ? "as" : "js", engine);
  const data = JSON.parse(fs.readFileSync(file, "utf-8"));
  return typeof data.mbps === "number" ? data.mbps : 0;
}

export function buildMultilibChart(kind: BenchKind, outfile: string): void {
  const entries: [string, number][] = [];

  // JS, in its own fresh V8 (native JSON is the baseline; fast-json-* is the
  // op-specific specialist - parse for deserialize, stringify for serialize).
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

  // One bar per family, averaged across the three scan modes (NAIVE/SWAR/SIMD)
  // so the comparison stays readable. assemblyscript-json is mode-independent,
  // so averaging its three identical runs just collapses them.
  const avgModes = (suite: string): number => {
    const v = MODES.map((mode) => mbps(suite, kind, mode.toLowerCase()));
    return v.reduce((a, b) => a + b, 0) / v.length;
  };
  entries.push(["json-as struct", avgModes("multilib-json-as-struct")]);
  entries.push([
    "json-as struct lazy",
    avgModes("multilib-json-as-struct-lazy"),
  ]);
  entries.push(["json-as JSON.Obj", avgModes("multilib-json-obj")]);
  entries.push([
    "assemblyscript-json",
    avgModes("multilib-assemblyscript-json"),
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
          color: INK.label,
          font: { size: 12, weight: "bold" },
          formatter: (v: number) => Math.round(v).toLocaleString() + " MB/s",
        },
        title: {
          display: true,
          text: `JSON Library Comparison - ${kind[0].toUpperCase() + kind.slice(1)} throughput (${KiB} KiB payload)`,
          font: { size: 20, weight: "bold" },
        },
        subtitle: {
          display: true,
          text: subtitle(),
          font: { size: 14, weight: "bold" },
          color: INK.subtitle,
          padding: 16,
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "Throughput (MB/s - higher is better)",
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

  // SVG (vector, fast-loading) + PNG (3x density). Horizontal bars (indexAxis
  // "y") are unaffected by the datalabels dpr quirk that generateChart guards
  // against for vertical bars, so both formats render labels at the bar tips.
  const dims = { width: 1150, height: 640 };
  generateChart(config, outfile.replace(/\.png$/, ".svg"), dims);
  generateChart(config, outfile, dims);
}
