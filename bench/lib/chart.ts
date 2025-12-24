// chartplot.ts (Bun/ESNext compatible)
import { readFileSync, writeFileSync } from "fs";
import { basename } from "path";

type RawBench = {
  description: string;
  elapsed: number; // ms
  bytes: number; // bytes per operation
  operations: number;
  features: string[];
};

type BenchmarkResult = {
  library: string;
  payload: string; // e.g., "small", "medium", "large", "abc", "vec3"
  gbPerSec: number;
};

type ChartData = {
  title: string;
  payloads: string[]; // ordered list of payload names
  results: BenchmarkResult[];
};

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error(
      "Usage:\n bun ./chartplot.ts <bench1.json> <bench2.json> [...] [-o output.svg]"
    );
    process.exit(1);
  }

  let outputFile = "benchmark-chart.svg";
  const inputFiles: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-o") {
      if (i + 1 >= args.length) {
        console.error("Error: -o requires a filename");
        process.exit(1);
      }
      outputFile = args[++i];
    } else {
      inputFiles.push("./build/logs/" +args[i]);
    }
  }

  if (!inputFiles.length) {
    console.error("Error: no input files provided");
    process.exit(1);
  }

  generateBarChartFromFiles(inputFiles, outputFile);
}

function generateBarChartFromFiles(files: string[], outputFile: string) {
  const results: BenchmarkResult[] = [];

  for (const file of files) {
    const raw: RawBench = JSON.parse(readFileSync(file, "utf-8"));
    const impl = inferImplementation(file);
    const payload = inferPayload(file);

    const gbPerSec = (raw.bytes * raw.operations) / (raw.elapsed * 1e6);

    results.push({ library: impl, payload, gbPerSec });
  }

  // Group by payload and sort payloads logically
  const payloadOrder = ["abc", "vec3", "small", "medium", "large"];
  const uniquePayloads = [...new Set(results.map(r => r.payload))].sort(
    (a, b) => payloadOrder.indexOf(a) - payloadOrder.indexOf(b)
  );

  const uniqueLibraries = [...new Set(results.map(r => r.library))];
  const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

  const chart: ChartData = {
    title: "JSON Throughput by Payload Size",
    payloads: uniquePayloads,
    results,
  };

  const svg = generateGroupedBarSVG(chart, uniqueLibraries, colors);
  writeFileSync(outputFile, svg, "utf-8");
  console.log(`✅ Bar chart written to ${outputFile}`);
}

function inferImplementation(file: string): string {
  return basename(file)
    .replace(".log.json", "")
    .replace(/\.bench\./g, " ")
    .replace(/\./g, " ")
    .trim();
}

function inferPayload(file: string): string {
  const name = basename(file);
  if (name.includes("abc.bench")) return "abc";
  if (name.includes("vec3.bench")) return "vec3";
  if (name.includes("small.bench")) return "small";
  if (name.includes("medium.bench")) return "medium";
  if (name.includes("large.bench")) return "large";
  return "unknown";
}

function generateGroupedBarSVG(
  data: ChartData,
  libraries: string[],
  colors: string[]
): string {
  const width = 900;
  const height = 550;
  const padding = { top: 80, right: 200, bottom: 80, left: 80 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const barPadding = 0.1; // space between groups
  const groupWidth = chartWidth / data.payloads.length;
  const barWidth = groupWidth / libraries.length * (1 - barPadding);

  const allValues = data.results.map(r => r.gbPerSec);
  const yMax = Math.max(...allValues, 0.1) * 1.1;

  const yScale = (v: number) =>
    padding.top + chartHeight - (v / yMax) * chartHeight;

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
<defs>
<style>
  .title { font: bold 20px sans-serif; fill: #1f2937; }
  .axis-label { font: 14px sans-serif; fill: #374151; }
  .tick { font: 12px sans-serif; fill: #6b7280; }
  .grid { stroke: #e5e7eb; stroke-dasharray: 3,3; }
  .axis { stroke: #9ca3af; stroke-width: 1.5; }
  .bar-label { font: bold 11px sans-serif; fill: white; text-anchor: middle; }
  .legend-text { font: 13px sans-serif; fill: #374151; }
</style>
</defs>

<rect width="${width}" height="${height}" fill="#fff"/>

<!-- Title -->
<text x="${width / 2}" y="40" text-anchor="middle" class="title">
${data.title}
</text>

<!-- Y Axis Grid & Labels -->
`;
  for (let i = 0; i <= 8; i++) {
    const v = (yMax / 8) * i;
    const y = yScale(v);
    svg += `
<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="grid"/>
<text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" class="tick">
${v.toFixed(2)} GB/s
</text>`;
  }

  // X Axis Labels (Payloads)
  data.payloads.forEach((payload, i) => {
    const x = padding.left + groupWidth * (i + 0.5);
    svg += `<text x="${x}" y="${height - padding.bottom + 40}" text-anchor="middle" class="tick">
${payload.toUpperCase()}
</text>`;
  });

  // Axes
  svg += `
<line x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${height - padding.bottom}" class="axis"/>
<line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" class="axis"/>

<text x="${width / 2}" y="${height - 20}" text-anchor="middle" class="axis-label">
Payload Type
</text>
<text x="-${height / 2}" y="20" transform="rotate(-90)" text-anchor="middle" class="axis-label">
Throughput (GB/s)
</text>
`;

  // Bars
  data.payloads.forEach((payload, payloadIdx) => {
    const groupX = padding.left + groupWidth * payloadIdx;

    libraries.forEach((lib, libIdx) => {
      const result = data.results.find(r => r.payload === payload && r.library === lib);
      if (!result) return;

      const x = groupX + (libIdx + 0.1) * (groupWidth / libraries.length);
      const barHeight = chartHeight - yScale(result.gbPerSec);
      const y = yScale(result.gbPerSec);

      const color = colors[libIdx % colors.length];

      svg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${color}" rx="4"/>
<text x="${x + barWidth / 2}" y="${y + 16}" class="bar-label">
${result.gbPerSec.toFixed(2)}
</text>`;
    });
  });

  // Legend
  libraries.forEach((lib, i) => {
    const y = padding.top + i * 30;
    const color = colors[i % colors.length];
    svg += `
<rect x="${width - padding.right + 20}" y="${y - 10}" width="18" height="18" fill="${color}" rx="4"/>
<text x="${width - padding.right + 50}" y="${y + 5}" class="legend-text">
${lib}
</text>`;
  });

  return svg + "</svg>";
}
// bun ./bench/lib/chart.ts   abc.bench.incremental.simd.as.log.json   vec3.bench.incremental.simd.as.log.json   small.bench.incremental.simd.as.log.json   medium.bench.incremental.simd.as.log.json   large.bench.incremental.simd.as.log.json   -o throughput-comparison.svg