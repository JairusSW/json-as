/** The legacy harness switches records at 1 MiB; never connect those workloads. */
export function splitRepeatedObjectWorkloads<
  T extends { label?: string; data: unknown[] },
>(datasets: T[]): T[] {
  return datasets.flatMap((dataset) => {
    const label = dataset.label === "JS" ? "Built-in JSON (JS)" : dataset.label;
    return [
      {
        ...dataset,
        label: `${label} · 55 B records`,
        data: dataset.data.slice(0, -1),
      },
      {
        ...dataset,
        label: `${label} · 1,049 B records`,
        data: dataset.data.slice(-1),
        showLine: false,
        pointStyle: "triangle",
        pointRadius: 7,
      },
    ] as T[];
  });
}
