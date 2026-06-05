import fs from "fs";
import {
  createBarChart,
  generateChart,
  type BenchResult,
} from "./lib/bench-utils";
import type { ChartConfiguration, Plugin } from "chart.js";
import type {} from "chartjs-plugin-datalabels";
import { EAGER as EAGER_BAR, LAZY as LAZY_BAR, INK } from "./lib/palette";

// Lazy-fields charts (eager vs `@json({ lazy: "auto" })`), SIMD. Backed by the
// committed benchmark in assembly/__benches__/lazy/lazy.bench.ts — regenerate
// the logs with `bun run bench:as lazy/ --mode simd`, then run this script.
const MODE = process.env["JSON_CHART_LAZY_MODE"] ?? "simd";
const read = (suite: string, type: string): BenchResult =>
  JSON.parse(
    fs.readFileSync(
      `./build/logs/as/${MODE}/${suite}.${type}.as.json`,
      "utf-8",
    ),
  );

const MBPS = "Throughput (MB/s, higher is better)";
const LAZY = ["eager", 'lazy ("auto")'];
const PAIR = [EAGER_BAR, LAZY_BAR];

// Geometry-based labels (the datalabels plugin mis-places above-bar labels in
// the SVG backend for some data shapes; bar.x/bar.y are always correct).
const valueLabels: Plugin<"bar"> = {
  id: "valueLabels",
  afterDatasetsDraw(chart) {
    const ctx = chart.ctx;
    ctx.save();
    ctx.font = "bold 12px sans-serif";
    ctx.fillStyle = INK.label;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    for (let di = 0; di < chart.data.datasets.length; di++) {
      const meta = chart.getDatasetMeta(di);
      const values = chart.data.datasets[di].data as number[];
      meta.data.forEach((bar, i) =>
        ctx.fillText(String(Math.round(values[i])), bar.x, bar.y - 4),
      );
    }
    ctx.restore();
  },
};

function emit(cfg: ChartConfiguration<"bar">, file: string) {
  cfg.options ??= {};
  cfg.options.plugins ??= {};
  cfg.options.plugins.datalabels = { display: false };
  cfg.plugins = [valueLabels];
  generateChart(cfg, file);
}

const OUT = process.env["JSON_CHART_OUT"] ?? "./build/charts";
const SIZES: [string, string][] = [
  ["small", "Small\n(~65b)"],
  ["medium", "Medium\n(~420b)"],
  ["large", "Large\n(~970b)"],
];

function sizeChart(kind: string, title: string, file: string) {
  const data: Record<string, BenchResult[]> = {};
  const labels: Record<string, string> = {};
  for (const [key, label] of SIZES) {
    data[key] = [read(`lz-${key}-eager`, kind), read(`lz-${key}-lazy`, kind)];
    labels[key] = label;
  }
  emit(
    createBarChart(data, labels, {
      title,
      yLabel: MBPS,
      xLabel: "",
      datasetLabels: LAZY,
      colors: PAIR,
    }),
    file,
  );
}

sizeChart("serialize", "Serialize: eager vs lazy", `${OUT}/lazy-serialize.svg`);
sizeChart(
  "deserialize",
  "Deserialize: eager vs lazy (deferred fields not read)",
  `${OUT}/lazy-deserialize.svg`,
);
sizeChart(
  "roundtrip",
  "Round-trip: eager vs lazy (parse → stringify, untouched)",
  `${OUT}/lazy-roundtrip.svg`,
);

// Access pattern (medium struct): eager parse cost is flat across read patterns;
// the round-trip group compares against eager round-trip.
const accEager = read("lz-access", "eager");
const accEagerRT = read("lz-medium-eager", "roundtrip");
const accData: Record<string, BenchResult[]> = {
  none: [accEager, read("lz-access", "none")],
  one: [accEager, read("lz-access", "one")],
  all: [accEager, read("lz-access", "all")],
  pass: [accEagerRT, read("lz-access", "pass")],
};
const accLabels: Record<string, string> = {
  none: "read none",
  one: "read 1 field",
  all: "read all",
  pass: "round-trip\n(passthru)",
};
emit(
  createBarChart(accData, accLabels, {
    title: "Access pattern — a struct with deferrable fields",
    yLabel: MBPS,
    xLabel: "",
    datasetLabels: LAZY,
    colors: PAIR,
  }),
  `${OUT}/lazy-access-pattern.svg`,
);
