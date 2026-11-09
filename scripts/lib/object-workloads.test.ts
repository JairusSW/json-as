import { expect, test } from "bun:test";
import { splitRepeatedObjectWorkloads } from "./object-workloads";
test("separates the harness's record switch without dropping or joining measurements", () => {
  const data = [
    { x: 900, y: 2400 },
    { x: 1024, y: 450 },
  ];
  const input = [{ label: "SIMD", data, borderColor: "blue" }];
  const out = splitRepeatedObjectWorkloads(input);
  expect(out[0].data).toEqual([data[0]]);
  expect(out[1].data).toEqual([data[1]]);
  expect(out[1]).toMatchObject({
    showLine: false,
    pointStyle: "triangle",
    borderColor: "blue",
  });
  expect(out.map((d) => d.label)).toEqual([
    "SIMD · 55 B records",
    "SIMD · 1,049 B records",
  ]);
  expect(input[0].data).toBe(data);
});
