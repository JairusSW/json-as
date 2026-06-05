import type { ChartConfiguration } from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { generateChart, subtitle } from "./lib/bench-utils";

// Lazy-fields charts: eager vs `@json({ lazy: "auto" })`. Numbers are ns/op
// (best-of-3, 2M iters, SIMD, -O3) from the eager-vs-lazy micro-bench over the
// small/medium/large bench payloads plus a synthetic struct for the access
// pattern. Re-measure and update DATA below if the implementation changes.
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
  size_kb: {
    labels: ["eager", 'lazy: "all"\n(all classes)'],
    data: [328, 1229],
  },
};

const GREY = { bg: "rgba(148,163,184,0.85)", border: "#94a3b8" };
const BLUE = { bg: "rgba(99,102,241,0.85)", border: "#6366f1" };
const RED = { bg: "rgba(239,68,68,0.9)", border: "#ef4444" };

// Mirror the chart01 (createBarChart) look: bold title, legend on top, value
// labels above the bars, and the build-info sidebar on the right.
function chartShell(
  title: string,
  yLabel: string,
  yMax: number,
  showLegend: boolean,
): ChartConfiguration<"bar">["options"] {
  return {
    responsive: true,
    plugins: {
      title: { display: true, text: title, font: { size: 20, weight: "bold" } },
      legend: {
        display: showLegend,
        position: "top",
        labels: { font: { size: 16, weight: "bold" }, padding: 20 },
      },
      datalabels: {
        // Centered inside each bar: the SVG backend's above-bar placement
        // (anchor/align "end"/"top") is unreliable for some data shapes and
        // drops labels to the baseline. Center is geometry-based (no clamping)
        // and always correct; the white text + dark halo stays readable on the
        // grey/indigo/red bars.
        anchor: "center",
        align: "center",
        color: "#ffffff",
        textStrokeColor: "rgba(0,0,0,0.55)",
        textStrokeWidth: 3,
        font: { weight: "bold", size: 13 },
        formatter: (v: number) => v.toFixed(0),
      },
      subtitle: {
        display: true,
        text: subtitle(),
        font: { size: 14, weight: "bold" },
        color: "#6b7280",
        padding: 16,
        position: "right",
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: yMax,
        title: {
          display: true,
          text: yLabel,
          font: { size: 16, weight: "bold" },
        },
        ticks: { font: { size: 14, weight: "bold" } },
      },
      x: {
        ticks: {
          maxRotation: 0,
          minRotation: 0,
          font: { size: 14, weight: "bold" },
        },
      },
    },
  };
}

function eagerVsLazy(
  title: string,
  labels: string[],
  eager: number[],
  lazy: number[],
  yLabel = "ns / op  (lower is better)",
): ChartConfiguration<"bar"> {
  const yMax = Math.ceil((Math.max(...eager, ...lazy) * 1.18) / 100) * 100;
  return {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "eager",
          data: eager,
          backgroundColor: GREY.bg,
          borderColor: GREY.border,
          borderWidth: 1,
        },
        {
          label: 'lazy ("auto")',
          data: lazy,
          backgroundColor: BLUE.bg,
          borderColor: BLUE.border,
          borderWidth: 1,
        },
      ],
    },
    options: chartShell(title, yLabel, yMax, true),
    plugins: [ChartDataLabels],
  };
}

function moduleSize(): ChartConfiguration<"bar"> {
  const yMax = Math.ceil((Math.max(...DATA.size_kb.data) * 1.18) / 100) * 100;
  return {
    type: "bar",
    data: {
      labels: DATA.size_kb.labels,
      datasets: [
        {
          label: "module size",
          data: DATA.size_kb.data,
          backgroundColor: [GREY.bg, RED.bg],
          borderColor: [GREY.border, RED.border],
          borderWidth: 1,
        },
      ],
    },
    options: chartShell(
      "Code-size cost of lazy-everywhere",
      "module size (KB)",
      yMax,
      false,
    ),
    plugins: [ChartDataLabels],
  };
}

const OUT = process.env["JSON_CHART_OUT"] ?? "./build/charts";

generateChart(
  eagerVsLazy(
    "Deserialize: eager vs lazy (deferred fields not read)",
    DATA.size,
    DATA.deserialize.eager,
    DATA.deserialize.lazy,
  ),
  `${OUT}/lazy-deserialize.svg`,
);
generateChart(
  eagerVsLazy(
    "Round-trip: eager vs lazy (parse → stringify, untouched)",
    DATA.size,
    DATA.roundtrip.eager,
    DATA.roundtrip.lazy,
  ),
  `${OUT}/lazy-roundtrip.svg`,
);
generateChart(
  eagerVsLazy(
    "Access pattern — a struct with deferrable fields",
    DATA.access.labels,
    DATA.access.eager,
    DATA.access.lazy,
  ),
  `${OUT}/lazy-access-pattern.svg`,
);
generateChart(moduleSize(), `${OUT}/lazy-module-size.svg`);
