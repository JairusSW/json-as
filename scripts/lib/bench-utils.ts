// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import fs from "fs";
import path from "path";
import {
  readBenchArtifact,
  benchProvenanceSubtitle,
} from "./bench-provenance.mjs";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import type { ChartConfiguration } from "chart.js";
import { MODE_BARS, INK } from "./palette";
import { withAdaptiveLogScale } from "./chart-outliers";
import { orderBenchmarkSeries } from "./chart-order";
import {
  overviewStyle,
  compactSidebar,
  linearDeserializationScale,
} from "./chart-style.mjs";
import { comparisonWorkload } from "./comparison-workloads.mjs";

export interface BenchResult {
  language: "as" | "js" | "native";
  description: string;
  elapsed: number;
  bytes: number;
  operations: number;
  features: string[];
  mbps: number;
  gbps: number;
  inputSha256?: string;
}

export type BenchKind = "serialize" | "deserialize";

export interface BenchResults {
  [payload: string]: {
    serialize: BenchResult[];
    deserialize: BenchResult[];
  };
}

export interface LineSeries {
  label: string;
  data: number[];
  borderColor: string;
  backgroundColor?: string;
}

const LOGS_DIR = "./build/logs";
export type ASBenchRuntime = "v8" | "wavm";
const BENCH_RUNTIME: ASBenchRuntime = ((): ASBenchRuntime => {
  const value = process.env["JSON_CHART_RUNTIME"]?.trim().toLowerCase();
  return value === "wavm" ? "wavm" : "v8";
})();

type ChartProvenance = {
  id: string;
  startedAt: string;
  source: {
    commit: string;
    treeHash: string;
    packageVersion: string;
    branch?: string;
  };
  tools?: { v8?: string; node?: string; runtime?: string };
  host?: { arch?: string; cpu?: string; model?: string };
  settings?: Record<string, unknown>;
};
const measuredProvenance: (ChartProvenance | null)[] = [];
const artifactProvenance = new WeakMap<
  object,
  {
    source: { files: Record<string, string> };
    settings?: { outputPolicy?: string };
  }
>();
export function subtitle(runtime: string = BENCH_RUNTIME) {
  return benchProvenanceSubtitle(measuredProvenance, runtime);
}

export function readBenchLog(filePath: string): BenchResult {
  const { result, provenance } = readBenchArtifact(filePath);
  measuredProvenance.push(provenance);
  artifactProvenance.set(result, provenance);
  return result as BenchResult;
}

/** Reads one AssemblyScript benchmark result for a named mode/runtime. */
export function readASBenchResult(
  payload: string,
  kind: BenchKind,
  mode: string,
): BenchResult {
  return readBenchLog(benchLogPath(payload, kind, "as", mode));
}

export function benchLogPath(
  payload: string,
  type: BenchKind,
  language: "js" | "as",
  engine = "",
): string {
  if (language === "js") {
    return path.join(LOGS_DIR, "js", `${payload}.${type}.js.json`);
  }
  const suffix = BENCH_RUNTIME === "wavm" ? ".wavm.json" : ".as.json";
  return path.join(
    LOGS_DIR,
    "as",
    engine.toLowerCase(),
    `${payload}.${type}${suffix}`,
  );
}

export function getBenchResults(payloads: string[]): BenchResults {
  const out: BenchResults = {};

  for (const payload of payloads) {
    out[payload] = { serialize: [], deserialize: [] };

    for (const kind of ["serialize", "deserialize"] as const) {
      const js = readBenchLog(benchLogPath(payload, kind, "js"));
      const naive = readBenchLog(benchLogPath(payload, kind, "as", "naive"));
      const swar = readBenchLog(benchLogPath(payload, kind, "as", "swar"));
      const simd = readBenchLog(benchLogPath(payload, kind, "as", "simd"));

      out[payload][kind] = [js, naive, swar, simd];
    }
  }

  return out;
}

// Reads the dynamic JSON.Obj result for a payload (logged under `<payload>-obj`
// by the per-payload benches). Returns null when absent - e.g. primitive
// payloads have no JSON.Obj variant, or the obj benches weren't run - so charts
// can fall back to a zero bar instead of crashing.
export function readObjBenchResult(
  payload: string,
  kind: BenchKind,
  engine = "simd",
): BenchResult | null {
  try {
    return readBenchLog(benchLogPath(`${payload}-obj`, kind, "as", engine));
  } catch (error) {
    if (fs.existsSync(benchLogPath(`${payload}-obj`, kind, "as", engine)))
      throw error;
    return null;
  }
}

// Comparison inputs must match the measured AS payload, not just its name.
export function readComparisonResult(
  suite: string,
  kind: BenchKind,
  reference: BenchResult,
  engine: "simdjson" | "js-classic" = "simdjson",
): BenchResult {
  const descriptor = comparisonWorkload(process.cwd(), suite);
  const source = artifactProvenance.get(reference);
  const file =
    engine === "simdjson"
      ? path.join(LOGS_DIR, "native/simdjson", `${suite}.${kind}.native.json`)
      : path.join(LOGS_DIR, "js", `classic-${suite}.${kind}.js.json`);
  const result = readBenchLog(file);
  const comparison = artifactProvenance.get(result);
  const inputFiles = [
    descriptor.source,
    ...(descriptor.group === "overview"
      ? [`assembly/__benches__/${suite}.bench.ts`]
      : []),
  ];
  if (
    engine === "simdjson" &&
    kind === "serialize" &&
    !comparison?.settings?.outputPolicy?.includes(
      "native fields to fresh UTF-8 string",
    )
  )
    throw new Error(
      `Expected uncached owning serialization for ${suite}; rerun its benchmark`,
    );
  // Restyling historical results uses their sealed input sources, not whatever
  // comments or headers the current checkout has. Both captures must agree.
  if (
    !source ||
    !comparison ||
    inputFiles.some(
      (input) =>
        !source.source.files[input] ||
        source.source.files[input] !== comparison.source.files[input],
    )
  )
    throw new Error(
      `Recorded comparison input changed for ${suite}; rerun its benchmark`,
    );
  if (
    result.inputSha256 !== descriptor.inputSha256 ||
    result.bytes !== reference.bytes
  )
    throw new Error(`Comparison input mismatch for ${suite}`);
  return result;
}

export function createBarChart(
  data: Record<string, BenchResult[]>,
  payloadLabels: Record<string, string>,
  options: {
    title: string;
    runtimeLabel?: string;
    /** Recorded provenance for charts rebuilt from an earlier benchmark run. */
    subtitleText?: string;
    yLabel?: string;
    xLabel?: string;
    datasetLabels?: string[];
    /** Per-dataset colors; defaults to the JS/NAIVE/SWAR/SIMD palette. */
    colors?: { bg: string; border: string }[];
    /** Override the y-axis tick step (default 500). */
    yStep?: number;
    /** datalabels anchor for the value labels (default "end"). */
    labelAnchor?: "start" | "center" | "end";
    /** Value-label font size in px (default 12). */
    labelFontSize?: number;
    /**
     * Rotate the value labels, in degrees (default 0 = flat). Use -90 to stand
     * them up off the bar top so adjacent same-height labels stop colliding;
     * the y-axis gains extra headroom automatically so tall labels don't clip.
     */
    labelRotation?: number;
  },
): ChartConfiguration<"bar"> {
  const payloadKeys = Object.keys(data);
  const labels = payloadKeys.map((k) => payloadLabels[k] ?? k);

  const maxMBps = Math.max(
    ...Object.values(data)
      .flat()
      .map((r) => r.mbps),
  );

  // Round up to the next step above (tallest bar + headroom), so there is
  // always room for the value label above the highest bar
  // (e.g. 4992 -> 5500 instead of a clipped 5000). Rotated (near-vertical)
  // labels stand up off the bar and need much more headroom than a flat label,
  // so reserve a slice of the range proportional to the tallest bar.
  const yStep = options.yStep ?? 500;
  const rotated = Math.abs(options.labelRotation ?? 0) >= 45;
  const headroom = rotated ? maxMBps * 0.18 + yStep : yStep / 2;
  const yMax = Math.ceil((maxMBps + headroom) / yStep) * yStep;

  const datasetNames = options.datasetLabels ?? [
    "Built-in JSON (JS)",
    "JSON-AS (NAIVE)",
    "JSON-AS (SWAR)",
    "JSON-AS (SIMD)",
  ];

  const palette = options.colors ?? MODE_BARS;
  const numDatasets = Math.max(...payloadKeys.map((k) => data[k].length));

  return {
    type: "bar",
    data: {
      labels,
      datasets: Array.from({ length: numDatasets }, (_, i) => ({
        label: datasetNames[i] ?? `Series ${i + 1}`,
        data: payloadKeys.map((k) => data[k][i]?.mbps ?? 0),
        backgroundColor: palette[i % palette.length].bg,
        borderColor: palette[i % palette.length].border,
        // Preserve the original overview-chart look: the 4th (SIMD) bar had a 2px border.
        borderWidth: !options.colors && i === 3 ? 2 : 1,
      })),
    },
    options: {
      responsive: true,
      layout: { padding: 8 },
      plugins: {
        title: {
          display: !!options.title,
          text: options.title,
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
          anchor: options.labelAnchor ?? "end",
          align: "end",
          rotation: options.labelRotation ?? 0,
          font: { weight: "bold", size: options.labelFontSize ?? 12 },
          formatter: (v: number) =>
            v === 0 ? "" : Math.round(v).toLocaleString("en-US"),
        },
        subtitle: {
          display: true,
          text: options.subtitleText ?? subtitle(options.runtimeLabel),
          font: { size: 14, weight: "bold" },
          color: INK.subtitle,
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
            text: options.yLabel ?? "Throughput (MB/s)",
            font: { size: 16, weight: "bold" },
          },
          ticks: {
            stepSize: yStep,
            font: { size: 14, weight: "bold" },
          },
        },
        x: {
          title: {
            display: true,
            text: options.xLabel ?? "Payload",
            padding: 12,
            font: { size: 16, weight: "bold" },
          },
          ticks: {
            maxRotation: 0,
            minRotation: 0,
            font: { size: 14, weight: "bold" },
          },
        },
      },
    },
    // The datalabels plugin is registered per-render in generateChart (via
    // chartjs-node-canvas's `modern` option / freshRequire), not inline here -
    // see the note there.
  };
}

export function createLineChart(
  labels: string[],
  series: LineSeries[],
  options: {
    title: string;
    xLabel: string;
    yLabel: string;
    logX?: boolean;
  },
): ChartConfiguration<"line"> {
  return {
    type: "line",
    data: {
      labels,
      datasets: series.map((s) => ({
        label: s.label,
        data: s.data,
        borderColor: s.borderColor,
        backgroundColor: s.backgroundColor ?? s.borderColor,
        borderWidth: 3,
        tension: 0.25,
        pointRadius: 4,
      })),
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: options.title,
          font: { size: 20, weight: "bold" },
        },
        legend: {
          position: "top",
          labels: {
            font: { size: 16, weight: "bold" },
          },
        },
        subtitle: {
          display: true,
          text: subtitle(),
          font: { size: 14, weight: "bold" },
          color: INK.subtitle,
          padding: { bottom: 16 },
        },
      },
      scales: {
        x: {
          type: options.logX ? "logarithmic" : "category",
          title: {
            display: true,
            text: options.xLabel,
            font: { size: 16, weight: "bold" },
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: options.yLabel,
            font: { size: 16, weight: "bold" },
          },
        },
      },
    },
  };
}

export function generateChart(
  config: ChartConfiguration,
  outfile: string,
  dims?: { width?: number; height?: number },
) {
  const isSvg = outfile.endsWith(".svg");

  config = orderBenchmarkSeries(config);
  config = outfile.includes("deserialize")
    ? linearDeserializationScale(config)
    : withAdaptiveLogScale(config);

  const fullCaption = config.options?.plugins?.subtitle?.text ?? "";
  config = overviewStyle(
    config,
    compactSidebar(measuredProvenance, fullCaption),
  );
  // Preserve detailed run identity separately from the one-line sidebar.
  const metadataPath = outfile.replace(/\.(svg|png)$/, ".metadata.json");
  const records = [
    ...new Map(
      measuredProvenance
        .filter((record): record is ChartProvenance => record != null)
        .map((record) => [
          record.id,
          {
            id: record.id,
            measuredAt: record.startedAt,
            source: {
              commit: record.source.commit,
              treeHash: record.source.treeHash,
              version: record.source.packageVersion,
              branch: record.source.branch,
            },
            architecture: record.host?.arch,
            hardwareModel: record.host?.cpu || record.host?.model,
            engines: {
              v8: record.tools?.v8,
              node: record.tools?.node,
              runtime: record.tools?.runtime,
            },
            settings: {
              language: record.settings?.language,
              runtime: record.settings?.runtime,
              mode: record.settings?.mode,
              strict: record.settings?.strict,
              fastPath: record.settings?.fastPath,
              outputPolicy: record.settings?.outputPolicy,
            },
          },
        ]),
    ).values(),
  ];
  if (isSvg || !fs.existsSync(metadataPath)) {
    fs.writeFileSync(
      metadataPath,
      JSON.stringify({ caption: fullCaption, records }, null, 2) + "\n",
    );
  }
  // Axes and legends identify line series; per-point labels overlap on curves.
  if (config.type === "line") {
    config.options ??= {};
    config.options.plugins ??= {};
    config.options.plugins.datalabels = { display: false };
  }

  // SVG is resolution-independent (dpr 1); PNG renders at 3x density so the
  // logical 1000x600 layout becomes a crisp 3000x1800 raster.
  config = {
    ...config,
    options: { ...(config.options ?? {}), devicePixelRatio: isSvg ? 1 : 3 },
  };

  // Strip any inline datalabels plugin instance a caller added to its config:
  // it's the shared module instance, and reusing it across renders is exactly
  // the stale-state bug we avoid by registering a fresh copy per render (below).
  if (Array.isArray(config.plugins)) {
    const kept = config.plugins.filter(
      (p) => (p as { id?: string })?.id !== "datalabels",
    );
    config = { ...config, plugins: kept.length ? kept : undefined };
  }

  const canvas = new ChartJSNodeCanvas({
    width: dims?.width ?? 1000,
    height: dims?.height ?? 600,
    type: isSvg ? "svg" : "png",
    backgroundColour: "white",
    // Register chartjs-plugin-datalabels through the `modern` option so
    // chartjs-node-canvas freshRequire()s a CLEAN copy of the plugin per render.
    // The plugin holds mutable module-level state that, reused across renders in
    // one process, collapses rotated value labels onto the x-axis baseline on
    // every render after the first - which is why the serialize chart (rendered
    // after the deserialize one) had its labels stuck at the bottom while
    // deserialize looked fine. A fresh module each render sidesteps it; no dpr or
    // anchor-flip workarounds needed.
    plugins: { modern: ["chartjs-plugin-datalabels"] },
  });

  const buffer = canvas.renderToBufferSync(
    config,
    isSvg ? "image/svg+xml" : "image/png",
  );

  fs.writeFileSync(outfile, buffer);
  console.log(`> ${outfile}`);
}
