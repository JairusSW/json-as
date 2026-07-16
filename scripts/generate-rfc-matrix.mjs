import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import prettier from "prettier";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputDir = path.join(root, "assembly/__tests__/rfc");
const outputFile = path.join(
  root,
  "assembly/__tests__/rfc-matrix/matrix.spec.ts",
);
const checkOnly = process.argv.includes("--check");
const IMPLEMENTATION_REJECTS = new Set([
  "033_i_structure_500_nested_arrays.spec.ts",
  "034_i_structure_UTF_8_BOM_empty_object.spec.ts",
]);

const FLAGS = {
  ROOT_OBJECT: 1 << 0,
  ROOT_ARRAY: 1 << 1,
  ROOT_STRING: 1 << 2,
  ROOT_NUMBER: 1 << 3,
  ROOT_BOOLEAN: 1 << 4,
  ROOT_NULL: 1 << 5,
  ARRAY_NUMBER: 1 << 6,
  ARRAY_STRING: 1 << 7,
  ARRAY_BOOLEAN: 1 << 8,
  ARRAY_OBJECT: 1 << 9,
  NUM_I8: 1 << 10,
  NUM_U8: 1 << 11,
  NUM_I16: 1 << 12,
  NUM_U16: 1 << 13,
  NUM_I32: 1 << 14,
  NUM_U32: 1 << 15,
  NUM_I64: 1 << 16,
  NUM_U64: 1 << 17,
  STRING_DATE: 1 << 18,
};

function findParseCall(sourceFile) {
  let found = null;
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(sourceFile) === "JSON.parse"
    ) {
      if (found)
        throw new Error(`multiple JSON.parse calls in ${sourceFile.fileName}`);
      found = node;
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  if (!found) throw new Error(`no JSON.parse call in ${sourceFile.fileName}`);
  if (!ts.isStringLiteralLike(found.arguments[0])) {
    throw new Error(`non-literal RFC input in ${sourceFile.fileName}`);
  }
  return found;
}

function normalizeJSONEncoding(data) {
  if (data.length < 4) return data;
  let byteIndex;
  if (data.charCodeAt(0) === 0) byteIndex = 0;
  else if (data.charCodeAt(1) === 0) byteIndex = 1;
  else return data;

  for (let i = byteIndex; i < data.length; i += 2) {
    if (data.charCodeAt(i) !== 0) return data;
  }

  let out = "";
  for (let i = byteIndex ^ 1; i < data.length; i += 2) {
    out += String.fromCharCode(data.charCodeAt(i));
  }
  return out;
}

function integerFlags(tokens) {
  if (!tokens.every((token) => /^-?(?:0|[1-9]\d*)$/.test(token))) return 0;
  const values = tokens.map(BigInt);
  const unsigned = tokens.every((token) => !token.startsWith("-"));
  let flags = 0;
  if (values.every((v) => v >= -128n && v <= 127n)) flags |= FLAGS.NUM_I8;
  if (unsigned && values.every((v) => v <= 255n)) flags |= FLAGS.NUM_U8;
  if (values.every((v) => v >= -32768n && v <= 32767n)) flags |= FLAGS.NUM_I16;
  if (unsigned && values.every((v) => v <= 65535n)) flags |= FLAGS.NUM_U16;
  if (values.every((v) => v >= -2147483648n && v <= 2147483647n))
    flags |= FLAGS.NUM_I32;
  if (unsigned && values.every((v) => v <= 4294967295n)) flags |= FLAGS.NUM_U32;
  if (
    values.every((v) => v >= -9223372036854775808n && v <= 9223372036854775807n)
  )
    flags |= FLAGS.NUM_I64;
  if (unsigned && values.every((v) => v <= 18446744073709551615n))
    flags |= FLAGS.NUM_U64;
  return flags;
}

function classify(value, source) {
  if (value === null) return FLAGS.ROOT_NULL;
  if (Array.isArray(value)) {
    let flags = FLAGS.ROOT_ARRAY;
    if (value.every((v) => typeof v === "number")) {
      const body = source.trim().slice(1, -1).trim();
      const tokens =
        body === "" ? [] : body.split(",").map((item) => item.trim());
      flags |= FLAGS.ARRAY_NUMBER | integerFlags(tokens);
    }
    if (value.every((v) => typeof v === "string")) flags |= FLAGS.ARRAY_STRING;
    if (value.every((v) => typeof v === "boolean"))
      flags |= FLAGS.ARRAY_BOOLEAN;
    if (
      value.every(
        (v) => v !== null && typeof v === "object" && !Array.isArray(v),
      )
    )
      flags |= FLAGS.ARRAY_OBJECT;
    return flags;
  }
  if (typeof value === "string") {
    return (
      FLAGS.ROOT_STRING |
      (Number.isFinite(Date.parse(value)) ? FLAGS.STRING_DATE : 0)
    );
  }
  if (typeof value === "number")
    return FLAGS.ROOT_NUMBER | integerFlags([source.trim()]);
  if (typeof value === "boolean") return FLAGS.ROOT_BOOLEAN;
  return FLAGS.ROOT_OBJECT;
}

const flagEntries = Object.entries(FLAGS).sort((a, b) => a[1] - b[1]);
function formatFlags(flags) {
  const names = flagEntries
    .filter(([, bit]) => flags & bit)
    .map(([name]) => name);
  if (!names.length)
    throw new Error("accepted fixture has no compatibility flags");
  return names.join(" | ");
}

const files = fs
  .readdirSync(inputDir)
  .filter((name) => /^\d{3}_[iny]_.*\.spec\.ts$/.test(name))
  .sort();

const cases = files.map((name) => {
  const file = path.join(inputDir, name);
  const source = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const call = findParseCall(sourceFile);
  const category = name.slice(4, 5);
  const reject = category === "n" || IMPLEMENTATION_REJECTS.has(name);
  let flags = 0;
  if (!reject) {
    const normalized = normalizeJSONEncoding(call.arguments[0].text);
    let parsed;
    try {
      parsed = JSON.parse(normalized);
    } catch (error) {
      throw new Error(`cannot classify accepted fixture ${name}`, {
        cause: error,
      });
    }
    flags = classify(parsed, normalized);
  }
  return {
    name: name.replace(/\.spec\.ts$/, ""),
    category,
    reject,
    flags,
    literal: call.arguments[0].getText(sourceFile),
  };
});

const counts = cases.reduce(
  (out, item) => {
    out[item.category]++;
    if (item.reject && item.category === "i") out.implReject++;
    return out;
  },
  { i: 0, n: 0, y: 0, implReject: 0 },
);

const imports = [
  "expectAcceptEveryCompatibleTarget",
  "expectRejectEveryTarget",
  ...flagEntries.map(([name]) => name),
];

const lines = [
  "// GENERATED by scripts/generate-rfc-matrix.mjs. Do not edit by hand.",
  `// ${counts.y} must-accept, ${counts.n} must-reject, ${counts.i} implementation-defined (${counts.implReject} explicit rejects).`,
  'import { describe } from "as-test";',
  "import {",
  ...imports.map((name) => `  ${name},`),
  '} from "./targets";',
  "",
];

for (const item of cases) {
  const expectation = item.reject
    ? `expectRejectEveryTarget(${item.literal});`
    : `expectAcceptEveryCompatibleTarget(${item.literal}, ${formatFlags(item.flags)});`;
  lines.push(
    `describe(${JSON.stringify(`matrix/${item.name}`)}, () => {`,
    `  ${expectation}`,
    "});",
    "",
  );
}

const output = await prettier.format(`${lines.join("\n")}\n`, {
  filepath: outputFile,
});
if (checkOnly) {
  const current = fs.existsSync(outputFile)
    ? fs.readFileSync(outputFile, "utf8")
    : "";
  if (current !== output) {
    console.error(
      "RFC matrix is stale; run: node scripts/generate-rfc-matrix.mjs",
    );
    process.exitCode = 1;
  }
} else {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, output);
  console.log(
    `generated ${path.relative(root, outputFile)} (${cases.length} cases)`,
  );
}
