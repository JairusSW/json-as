// ============================================================================
// run-benchmark.ts - Run benchmarks and generate JSON data
// Usage: bun run run-benchmark.ts
// ============================================================================

import { writeFileSync } from 'fs';

type DataPoint = {
  sizeKB: number;
  gbPerSec: number;
};

type BenchmarkResult = {
  library: string;
  dataPoints: DataPoint[];
};

type ChartData = {
  title: string;
  libraries: string[];
  dataSizes: number[];
  results: BenchmarkResult[];
};

type BenchResult = {
  description: string;
  elapsed: number;
  opsPerSecond: number;
  gbPerSec: number;
  bytesPerOp: number;
};

// Benchmark utility
function bench(
  description: string,
  routine: () => void,
  ops: number = 1_000_000,
  bytesPerOp: number = 0
): BenchResult {
  console.log(` - Benchmarking ${description}`);
  
  // Warmup
  let warmup = Math.floor(ops / 10);
  while (warmup-- > 0) {
    routine();
  }
  
  const start = performance.now();
  let count = ops;
  while (count-- > 0) {
    routine();
  }
  const end = performance.now();
  
  const elapsed = Math.max(1, end - start);
  const opsPerSecond = (ops * 1000) / elapsed;
  
  let gbPerSec = 0;
  if (bytesPerOp > 0) {
    const totalBytes = bytesPerOp * ops;
    const bytesPerSec = totalBytes / (elapsed / 1000);
    gbPerSec = bytesPerSec / (1024 * 1024 * 1024);
  }
  
  let log = `   Completed in ${formatNumber(Math.round(elapsed))}ms at ${formatNumber(Math.round(opsPerSecond))} ops/s`;
  if (bytesPerOp > 0) {
    log += ` @ ${gbPerSec.toFixed(3)} GB/s`;
  }
  console.log(log + '\n');
  
  return {
    description,
    elapsed,
    opsPerSecond,
    gbPerSec,
    bytesPerOp
  };
}

function formatNumber(n: number): string {
  let str = n.toString();
  let len = str.length;
  let result = "";
  let commaOffset = len % 3;
  for (let i = 0; i < len; i++) {
    if (i > 0 && (i - commaOffset) % 3 === 0) result += ",";
    result += str.charAt(i);
  }
  return result;
}

// Generate test JSON data of specific size
function generateJSON(targetSizeKB: number): string {
  const targetBytes = targetSizeKB * 1024;
  
  const obj: any = {
    users: [],
    metadata: {
      timestamp: Date.now(),
      version: "1.0.0",
      count: 0
    },
    data: [],
    config: {
      enabled: true,
      timeout: 5000,
      retries: 3
    }
  };
  
  let currentSize = JSON.stringify(obj).length;
  let userId = 0;
  
  while (currentSize < targetBytes) {
    obj.users.push({
      id: userId++,
      name: `User ${userId}`,
      email: `user${userId}@example.com`,
      active: userId % 2 === 0,
      score: Math.random() * 1000,
      tags: ["tag1", "tag2", "tag3"],
      preferences: {
        theme: "dark",
        notifications: true
      }
    });
    
    obj.data.push(Math.random() * 10000);
    
    currentSize = JSON.stringify(obj).length;
  }
  
  obj.metadata.count = userId;
  
  return JSON.stringify(obj);
}

// Main benchmark suite
function runBenchmarkSuite(): ChartData {
  console.log("=== JSON Parsing Benchmark Suite ===\n");
  
  // Test sizes in KB (logarithmic scale)
  const testSizes = [1, 10, 100, 1000]; // 1KB to 10MB
  
  const chartData: ChartData = {
    title: "JSON Parse Throughput vs File Size",
    libraries: ["JSON.parse", "JSON.stringify"],
    dataSizes: testSizes,
    results: [
      {
        library: "JSON.parse",
        dataPoints: []
      },
      {
        library: "JSON.stringify",
        dataPoints: []
      }
    ]
  };
  
  for (const sizeKB of testSizes) {
    console.log(`\n--- Testing ${sizeKB}KB JSON ---`);
    
    const jsonData = generateJSON(sizeKB);
    const actualSize = jsonData.length;
    
    console.log(`Generated ${formatNumber(actualSize)} bytes of JSON data\n`);
    
    // Adjust ops based on size
    let ops = 10000;
    if (sizeKB >= 1000) ops = 100;
    else if (sizeKB >= 100) ops = 1000;
    
    // Benchmark JSON.parse
    const parseResult = bench(
      `JSON.parse (${sizeKB}KB)`,
      () => {
        JSON.parse(jsonData);
      },
      ops,
      actualSize
    );
    
    chartData.results[0].dataPoints.push({
      sizeKB: actualSize / 1024,
      gbPerSec: parseResult.gbPerSec
    });
    
    // Benchmark JSON.stringify
    const obj = JSON.parse(jsonData);
    const stringifyResult = bench(
      `JSON.stringify (${sizeKB}KB)`,
      () => {
        JSON.stringify(obj);
      },
      ops,
      actualSize
    );
    
    chartData.results[1].dataPoints.push({
      sizeKB: actualSize / 1024,
      gbPerSec: stringifyResult.gbPerSec
    });
  }
  
  return chartData;
}

// Run benchmarks and save JSON
console.log("Running benchmarks...\n");
const results = runBenchmarkSuite();

writeFileSync('benchmark-data.json', JSON.stringify(results, null, 2), 'utf-8');
console.log('\n✅ Benchmark data saved to benchmark-data.json');
console.log('\nNow run: bun run generate-chart.ts');

// ============================================================================
// generate-chart.ts - Read JSON and generate SVG chart
// Usage: bun run generate-chart.ts
// ============================================================================

export function generateChartFromFile(inputFile: string, outputFile: string = 'benchmark-chart.svg') {
  const { readFileSync } = require('fs');
  
  console.log(`\nReading benchmark data from ${inputFile}...`);
  const data: ChartData = JSON.parse(readFileSync(inputFile, 'utf-8'));
  
  const svg = generateChartSVG(data);
  writeFileSync(outputFile, svg, 'utf-8');
  
  console.log(`✅ Chart saved to ${outputFile}`);
  console.log('\nYou can now embed it in your README.md with:');
  console.log(`![Benchmark Results](./${outputFile})`);
}

function generateChartSVG(data: ChartData): string {
  const width = 800;
  const height = 500;
  const padding = { top: 60, right: 150, bottom: 70, left: 70 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const colors = [
    '#3b82f6', // blue
    '#10b981', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6'  // purple
  ];

  const maxThroughput = Math.max(
    ...data.results.flatMap(r => r.dataPoints.map(dp => dp.gbPerSec))
  );
  const yMax = Math.ceil(maxThroughput * 1.1 * 10) / 10;

  const xMin = Math.log10(1);
  const xMax = Math.log10(10000);

  const xScale = (kb: number) => {
    const logValue = Math.log10(kb);
    return padding.left + ((logValue - xMin) / (xMax - xMin)) * chartWidth;
  };

  const yScale = (gbPerSec: number) => {
    return padding.top + chartHeight - (gbPerSec / yMax) * chartHeight;
  };

  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      .chart-title { font: bold 18px sans-serif; fill: #1f2937; }
      .axis-label { font: 14px sans-serif; fill: #374151; }
      .tick-label { font: 12px sans-serif; fill: #6b7280; }
      .grid-line { stroke: #e5e7eb; stroke-width: 1; }
      .axis-line { stroke: #9ca3af; stroke-width: 2; }
      .legend-text { font: 13px sans-serif; fill: #374151; }
      .data-line { fill: none; stroke-width: 2.5; }
      .data-point { stroke: white; stroke-width: 2; }
    </style>
  </defs>

  <rect width="${width}" height="${height}" fill="white"/>

  <text x="${width / 2}" y="30" text-anchor="middle" class="chart-title">
    ${data.title}
  </text>

  <!-- Grid lines -->`;

  const yTicks = 6;
  for (let i = 0; i <= yTicks; i++) {
    const value = (yMax / yTicks) * i;
    const y = yScale(value);
    svg += `
  <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="grid-line"/>
  <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" class="tick-label">${value.toFixed(1)}</text>`;
  }

  const xTickValues = [1, 10, 100, 1000, 10000];
  xTickValues.forEach(kb => {
    const x = xScale(kb);
    const label = kb >= 1000 ? `${kb / 1000}MB` : `${kb}KB`;
    svg += `
  <line x1="${x}" y1="${padding.top}" x2="${x}" y2="${height - padding.bottom}" class="grid-line"/>
  <text x="${x}" y="${height - padding.bottom + 25}" text-anchor="middle" class="tick-label">${label}</text>`;
  });

  svg += `
  <line x1="${padding.left}" y1="${height - padding.bottom}" 
        x2="${width - padding.right}" y2="${height - padding.bottom}" class="axis-line"/>
  <text x="${width / 2}" y="${height - 10}" text-anchor="middle" class="axis-label">
    File Size (KB)
  </text>

  <line x1="${padding.left}" y1="${padding.top}" 
        x2="${padding.left}" y2="${height - padding.bottom}" class="axis-line"/>
  <text x="${20}" y="${height / 2}" text-anchor="middle" transform="rotate(-90, 20, ${height / 2})" class="axis-label">
    Throughput (GB/s)
  </text>`;

  data.results.forEach((result, idx) => {
    const color = colors[idx % colors.length];
    
    const pathData = result.dataPoints
      .map((dp, i) => {
        const x = xScale(dp.sizeKB);
        const y = yScale(dp.gbPerSec);
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');

    svg += `
  <path d="${pathData}" class="data-line" stroke="${color}"/>`;

    result.dataPoints.forEach(dp => {
      const x = xScale(dp.sizeKB);
      const y = yScale(dp.gbPerSec);
      svg += `
  <circle cx="${x}" cy="${y}" r="5" fill="${color}" class="data-point"/>`;
    });
  });

  svg += `
  <!-- Legend -->`;
  
  data.results.forEach((result, idx) => {
    const color = colors[idx % colors.length];
    const legendY = padding.top + idx * 25;
    
    svg += `
  <line x1="${width - padding.right + 10}" y1="${legendY}" 
        x2="${width - padding.right + 40}" y2="${legendY}" 
        stroke="${color}" stroke-width="2.5"/>
  <circle cx="${width - padding.right + 25}" cy="${legendY}" r="5" fill="${color}" class="data-point"/>
  <text x="${width - padding.right + 50}" y="${legendY + 5}" class="legend-text">
    ${result.library}
  </text>`;
  });

  svg += `
</svg>`;

  return svg;
}

// If run directly (not imported), generate chart from benchmark-data.json
if (import.meta.main) {
  try {
    generateChartFromFile('benchmark-data.json');
  } catch (error) {
    console.error('Error: Could not find benchmark-data.json');
    console.error('Please run: bun run run-benchmark.ts first');
  }
}