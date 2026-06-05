import {
  createBarChart,
  generateChart,
  type BenchResult,
} from "./lib/bench-utils";

// Lazy-fields charts: eager vs `@json({ lazy: "auto" })`. Numbers are ns/op
// (best-of-3, 2M iters, SIMD, -O3) from the eager-vs-lazy micro-bench over the
// small/medium/large bench payloads plus a synthetic struct for the access
// pattern. Re-measure and update DATA below if the implementation changes.
//
// Built on the same createBarChart + generateChart pipeline as build-chart01
// (legend on top, build-info sidebar, SVG output). The bar value labels are
// drawn by the small plugin below instead of chartjs-plugin-datalabels: that
// plugin's above-bar placement is unreliable in the SVG backend for some data
// shapes (it drops labels to the baseline when two bars in a group are close in
// height). Computing the position straight from the bar geometry is immune.
const DATA = {
  size: ["Small\n(~120b)", "Medium\n(~700b)", "Large\n(~5kb)"],
  deserialize: { eager: [132, 1531, 2595], lazy: [41, 158, 701] },
  roundtrip: { eager: [185, 1890, 3816], lazy: [89, 286, 1252] },
  access: {
    labels: ["read none", "read 1 field", "read all", "round-trip\n(passthru)"],
    eager: [861, 856, 865, 1064],
    lazy: [694, 704, 688, 863],
  },
  // module size (KB): eager vs every class auto-deferred (incl. an ~80-field struct)
  size_kb: [328, 1229],
};

const GREY = { bg: "rgba(148,163,184,0.85)", border: "#94a3b8" };
const BLUE = { bg: "rgba(99,102,241,0.85)", border: "#6366f1" };
const RED = { bg: "rgba(239,68,68,0.9)", border: "#ef4444" };
const NS = "ns / op  (lower is better)";

// Draw each bar's value just above its top edge.
const valueLabels = {
  id: "valueLabels",
  afterDatasetsDraw(chart: any) {
    const ctx = chart.ctx;
    ctx.save();
    ctx.font = "bold 13px sans-serif";
    ctx.fillStyle = "#374151";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    for (let di = 0; di < chart.data.datasets.length; di++) {
      const meta = chart.getDatasetMeta(di);
      const values = chart.data.datasets[di].data as number[];
      meta.data.forEach((bar: any, i: number) => {
        ctx.fillText(String(Math.round(values[i])), bar.x, bar.y - 4);
      });
    }
    ctx.restore();
  },
};

// createBarChart only reads `.mbps` off each result — fill the rest with zeros.
const v = (mbps: number): BenchResult => ({
  language: "as",
  description: "",
  elapsed: 0,
  bytes: 0,
  operations: 0,
  features: [],
  mbps,
  gbps: 0,
});

function eagerVsLazy(
  labels: string[],
  eager: number[],
  lazy: number[],
  datasetLabels: string[],
  colors: { bg: string; border: string }[],
  title: string,
  yLabel: string,
  file: string,
) {
  const data: Record<string, BenchResult[]> = {};
  const payloadLabels: Record<string, string> = {};
  labels.forEach((label, i) => {
    const key = `c${i}`;
    data[key] = [v(eager[i]), v(lazy[i])];
    payloadLabels[key] = label;
  });
  const cfg = createBarChart(data, payloadLabels, {
    title,
    yLabel,
    xLabel: "",
    datasetLabels,
    colors,
    yStep: 500,
  });
  // Swap the built-in datalabels for the geometry-based plugin above.
  (cfg.options as any).plugins.datalabels = { display: false };
  (cfg as any).plugins = [valueLabels];
  generateChart(cfg, file);
}

const OUT = process.env["JSON_CHART_OUT"] ?? "./build/charts";
const LAZY = ["eager", 'lazy ("auto")'];
const PAIR = [GREY, BLUE];

eagerVsLazy(
  DATA.size,
  DATA.deserialize.eager,
  DATA.deserialize.lazy,
  LAZY,
  PAIR,
  "Deserialize: eager vs lazy (deferred fields not read)",
  NS,
  `${OUT}/lazy-deserialize.svg`,
);
eagerVsLazy(
  DATA.size,
  DATA.roundtrip.eager,
  DATA.roundtrip.lazy,
  LAZY,
  PAIR,
  "Round-trip: eager vs lazy (parse → stringify, untouched)",
  NS,
  `${OUT}/lazy-roundtrip.svg`,
);
eagerVsLazy(
  DATA.access.labels,
  DATA.access.eager,
  DATA.access.lazy,
  LAZY,
  PAIR,
  "Access pattern — a struct with deferrable fields",
  NS,
  `${OUT}/lazy-access-pattern.svg`,
);
eagerVsLazy(
  [""],
  [DATA.size_kb[0]],
  [DATA.size_kb[1]],
  ["eager", 'lazy: "all"'],
  [GREY, RED],
  "Code-size cost of lazy-everywhere",
  "module size (KB)",
  `${OUT}/lazy-module-size.svg`,
);
