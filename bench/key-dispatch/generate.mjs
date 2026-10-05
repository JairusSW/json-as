import { writeFileSync, mkdirSync } from "node:fs";
const [widthArg, output = "bench/key-dispatch/fixture.tmp.ts"] =
  process.argv.slice(2);
const width = Number(widthArg);
if (!Number.isInteger(width) || width < 1 || width > 4096)
  throw new Error("Expected width in [1, 4096]");
const fields = Array.from(
  { length: width },
  (_, i) => `field${i.toString().padStart(5, "0")}`,
);
const payload = (delta) =>
  JSON.stringify(
    Object.fromEntries(
      [...fields].reverse().map((key, i) => [key, width - i + delta]),
    ),
  );
const expected = (delta) =>
  JSON.stringify(
    Object.fromEntries(fields.map((key, i) => [key, i + 1 + delta])),
  );
const source = [
  'import { JSON } from "../../assembly";',
  "@json class Wide {",
  ...fields.map((field) => `  ${field}: i32 = 0;`),
  "}",
  `const inputs = [${JSON.stringify(payload(0))}, ${JSON.stringify(payload(1))}];`,
  "let output = new Wide();",
  "export function verify(): bool {",
  "  output = JSON.parse<Wide>(inputs[0]);",
  `  if (JSON.stringify(output) != ${JSON.stringify(expected(0))}) return false;`,
  "  output = JSON.parse<Wide>(inputs[1]);",
  `  if (JSON.stringify(output) != ${JSON.stringify(expected(1))}) return false;`,
  "  output = JSON.parse<Wide>(inputs[0], output);",
  `  if (JSON.stringify(output) != ${JSON.stringify(expected(0))}) return false;`,
  "  output = JSON.parse<Wide>(inputs[1], output);",
  `  return JSON.stringify(output) == ${JSON.stringify(expected(1))};`,
  "}",
  "export function run(reuse: bool, iterations: i32): i32 {",
  "  for (let i = 0; i < iterations; i++) {",
  "    output = reuse ? JSON.parse<Wide>(unchecked(inputs[i & 1]), output) : JSON.parse<Wide>(unchecked(inputs[i & 1]));",
  "  }",
  `  return output.${fields[0]} + output.${fields[width - 1]};`,
  "}",
];
mkdirSync(output.slice(0, output.lastIndexOf("/")), { recursive: true });
writeFileSync(output, source.join("\n") + "\n");
