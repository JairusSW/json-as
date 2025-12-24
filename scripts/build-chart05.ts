import { getBenchResults, createLineChart, generateChart, BenchResults } from './lib/bench-utils';

const PAYLOADS_BY_TYPE: Record<string, string[]> = {
  object: ['smallObj', 'mediumObj', 'largeObj'],
  array: ['smallArr', 'mediumArr', 'largeArr'],
  string: ['smallStr', 'mediumStr', 'largeStr']
};

const payloadLabels: Record<string, string> = {
  smallObj: 'Small Object',
  mediumObj: 'Medium Object',
  largeObj: 'Large Object',
  smallArr: 'Small Array',
  mediumArr: 'Medium Array',
  largeArr: 'Large Array',
  smallStr: 'Small String',
  mediumStr: 'Medium String',
  largeStr: 'Large String'
};

// Load all payloads
const allPayloads = Object.values(PAYLOADS_BY_TYPE).flat();
const results: BenchResults = getBenchResults(allPayloads);

// Generate datasets per type
const series = Object.entries(PAYLOADS_BY_TYPE).flatMap(([type, keys]) => {
  const engines = ['JS', 'SWAR', 'SIMD'] as const;

  return engines.map((engine, idx) => ({
    label: `${type} (${engine})`,
    data: keys.map(k => results[k].serialize[idx].mbps),
    borderColor: engine === 'JS' ? '#6366f1' : engine === 'SWAR' ? '#22c55e' : '#ef4444'
  }));
});

// Create chart
const chartConfig = createLineChart(
  ['small', 'medium', 'large'],
  series,
  {
    title: 'Serialization Throughput by Type',
    xLabel: 'Payload Size',
    yLabel: 'Throughput (MB/s)'
  }
);

generateChart(chartConfig, './data/chart03.svg');
