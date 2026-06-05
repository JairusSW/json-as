import fs from "fs";
import {
  createBarChart,
  generateChart,
  type BenchResult,
} from "./lib/bench-utils";
import type { ChartConfiguration, Plugin } from "chart.js";
import type {} from "chartjs-plugin-datalabels";
import {
  EAGER as EAGER_BAR,
  LAZY as LAZY_BAR,
  INK,
  BASE,
  rgba,
} from "./lib/palette";

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

// Lazy mode access patterns. SWAR only (the mode the lazy fast-path is showcased
// in) — read swar logs directly regardless of the size-chart MODE above. Each
// payload group shows lazy reads of a growing slice of its deferred fields
// (none/one/half/all) plus the eager full-parse baseline. Backed by
// assembly/__benches__/lazy/access-pattern.bench.ts (run `bun run bench:as
// lazy/` to regenerate every mode's logs).
const SWAR_READ = (suite: string, type: string): BenchResult =>
  JSON.parse(
    fs.readFileSync(`./build/logs/as/swar/${suite}.${type}.as.json`, "utf-8"),
  );

const ACCESS_SETS: [string, string][] = [
  ["vec3", "Vec3\n(19b)"],
  ["token", "Token\n(49b)"],
  ["small", "Small\n(108b)"],
  ["medium", "Medium\n(1.1kb)"],
  ["large", "Large\n(5.5kb)"],
];
const READ_LEVELS = ["none", "one", "half", "all", "base"];
const READ_LABELS = [
  "read none",
  "read one",
  "read half",
  "read all",
  "baseline (eager)",
];
// A distinct hue per access mode: blue→green→orange→red as lazy does more work,
// then a neutral copper for the eager baseline reference.
const ACCESS_COLORS = [
  { bg: rgba("pacificBlue", 0.85), border: BASE.pacificBlue },
  { bg: rgba("jungleGreen", 0.85), border: BASE.jungleGreen },
  { bg: rgba("orange", 0.85), border: BASE.orange },
  { bg: rgba("strawberryRed", 0.85), border: BASE.strawberryRed },
  { bg: rgba("fadedCopper", 0.85), border: BASE.fadedCopper },
];

const accData: Record<string, BenchResult[]> = {};
const accLabels: Record<string, string> = {};
for (const [key, label] of ACCESS_SETS) {
  accData[key] = READ_LEVELS.map((lvl) => SWAR_READ(`lzap-${key}`, lvl));
  accLabels[key] = label;
}
emit(
  createBarChart(accData, accLabels, {
    title:
      "Lazy mode access patterns (SWAR) — deferred-field reads vs eager baseline",
    yLabel: MBPS,
    xLabel: "",
    datasetLabels: READ_LABELS,
    colors: ACCESS_COLORS,
  }),
  `${OUT}/lazy-access-pattern.svg`,
);
