import type { ChartConfiguration } from "chart.js";
import { generateChart } from "./lib/bench-utils";

// Lazy-fields charts: eager vs `@json({ lazy: "auto" })`. Numbers are ns/op
// (best-of-3, 2M iters, SIMD, -O3) from the eager-vs-lazy micro-bench over the
// small/medium/large bench payloads plus a synthetic struct for the access
// pattern. Re-measure and update DATA below if the implementation changes.
const DATA = {
  size: ["Small\n~120 B", "Medium\n~700 B", "Large\n~5 KB"],
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

function baseOptions(title: string, yLabel: string, legend: boolean) {
  return {
    plugins: {
      title: {
        display: true,
        text: title,
        font: { size: 20, weight: "bold" as const },
      },
      legend: {
        display: legend,
        position: "top" as const,
        labels: { font: { size: 16, weight: "bold" as const }, padding: 20 },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: yLabel,
          font: { size: 16, weight: "bold" as const },
        },
        ticks: { font: { size: 14, weight: "bold" as const } },
      },
      x: {
        ticks: {
          maxRotation: 0,
          minRotation: 0,
          font: { size: 14, weight: "bold" as const },
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
    options: baseOptions(title, yLabel, true),
  };
}

function moduleSize(): ChartConfiguration<"bar"> {
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
    options: baseOptions(
      "Code-size cost of lazy-everywhere",
      "module size (KB)",
      false,
    ),
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
  `${OUT}/lazy-deserialize.png`,
);
generateChart(
  eagerVsLazy(
    "Round-trip: eager vs lazy (parse → stringify, untouched)",
    DATA.size,
    DATA.roundtrip.eager,
    DATA.roundtrip.lazy,
  ),
  `${OUT}/lazy-roundtrip.png`,
);
generateChart(
  eagerVsLazy(
    "Access pattern — a struct with deferrable fields",
    DATA.access.labels,
    DATA.access.eager,
    DATA.access.lazy,
  ),
  `${OUT}/lazy-access-pattern.png`,
);
generateChart(moduleSize(), `${OUT}/lazy-module-size.png`);
