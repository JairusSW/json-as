import fs from "node:fs";
import path from "node:path";
import { createCanvas, loadImage } from "canvas";
import ts from "typescript";

type CoverageKind = "direct" | "envelope" | "reject" | "na";

interface Fixture {
  name: string;
  category: "i" | "n" | "y";
  reject: boolean;
  flags: Set<string>;
}

interface Target {
  label: string;
  coverage(flags: Set<string>): Exclude<CoverageKind, "reject">;
}

const ROOT = path.resolve(import.meta.dirname, "..");
const MATRIX_FILE = path.join(
  ROOT,
  "assembly/__tests__/rfc-matrix/matrix.spec.ts",
);
const OUTPUT_DIR = path.join(ROOT, "build/charts");
const SVG_FILE = path.join(OUTPUT_DIR, "rfc-coverage.svg");
const PNG_FILE = path.join(OUTPUT_DIR, "rfc-coverage.png");

const MODES = ["NAIVE", "SWAR", "SIMD"] as const;
const COLORS: Record<CoverageKind, string> = {
  direct: "#2da44e",
  envelope: "#9be9a8",
  reject: "#0969da",
  na: "#ebedf0",
};
const CATEGORY_COLORS = {
  i: "#bf8700",
  n: "#cf222e",
  y: "#2da44e",
} as const;

const direct = (): "direct" => "direct";
const envelope = (): "envelope" => "envelope";
const ifFlag =
  (flag: string) =>
  (flags: Set<string>): "direct" | "na" =>
    flags.has(flag) ? "direct" : "na";
const directOrEnvelope =
  (flag: string) =>
  (flags: Set<string>): "direct" | "envelope" =>
    flags.has(flag) ? "direct" : "envelope";

const TARGETS: Target[] = [
  { label: "JSON.Raw", coverage: direct },
  { label: "JSON.Value", coverage: direct },
  { label: "custom any", coverage: direct },
  { label: "JSON.Obj", coverage: directOrEnvelope("ROOT_OBJECT") },
  { label: "JSON.Arr", coverage: directOrEnvelope("ROOT_ARRAY") },
  { label: "eager struct", coverage: envelope },
  { label: "lazy struct", coverage: envelope },
  { label: "Map", coverage: directOrEnvelope("ROOT_OBJECT") },
  { label: "Array", coverage: directOrEnvelope("ROOT_ARRAY") },
  { label: "StaticArray", coverage: directOrEnvelope("ROOT_ARRAY") },
  { label: "Set", coverage: directOrEnvelope("ROOT_ARRAY") },
  { label: "TypedArray", coverage: ifFlag("ARRAY_NUMBER") },
  {
    label: "ArrayBuffer",
    coverage: (flags): "direct" | "na" =>
      flags.has("ARRAY_NUMBER") && flags.has("NUM_U8") ? "direct" : "na",
  },
  { label: "Date", coverage: ifFlag("STRING_DATE") },
  {
    label: "scalar",
    coverage: (flags): "direct" | "na" =>
      ["ROOT_STRING", "ROOT_NUMBER", "ROOT_BOOLEAN"].some((flag) =>
        flags.has(flag),
      )
        ? "direct"
        : "na",
  },
  {
    label: "JSON.Box",
    coverage: (flags): "direct" | "na" =>
      flags.has("ROOT_NUMBER") || flags.has("ROOT_BOOLEAN") ? "direct" : "na",
  },
  {
    label: "nullable",
    coverage: (flags): "direct" | "na" =>
      flags.has("ROOT_NULL") || flags.has("ROOT_STRING") ? "direct" : "na",
  },
];

function parseFixtures(): Fixture[] {
  const source = fs.readFileSync(MATRIX_FILE, "utf8");
  const sourceFile = ts.createSourceFile(
    MATRIX_FILE,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const fixtures: Fixture[] = [];

  for (const statement of sourceFile.statements) {
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isCallExpression(statement.expression) ||
      statement.expression.expression.getText(sourceFile) !== "describe"
    )
      continue;

    const describeCall = statement.expression;
    const nameNode = describeCall.arguments[0];
    const callback = describeCall.arguments[1];
    if (
      !nameNode ||
      !ts.isStringLiteralLike(nameNode) ||
      !callback ||
      (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback))
    )
      continue;

    let expectation: ts.CallExpression | null = null;
    function visit(node: ts.Node): void {
      if (ts.isCallExpression(node)) {
        const callee = node.expression.getText(sourceFile);
        if (
          callee === "expectAcceptEveryCompatibleTarget" ||
          callee === "expectRejectEveryTarget"
        )
          expectation = node;
      }
      ts.forEachChild(node, visit);
    }
    visit(callback.body);
    if (!expectation)
      throw new Error(`missing expectation for ${nameNode.text}`);

    const expectationCall = expectation as ts.CallExpression;
    const reject =
      expectationCall.expression.getText(sourceFile) ===
      "expectRejectEveryTarget";
    const flags = new Set<string>();
    if (!reject && expectationCall.arguments[1]) {
      function collectFlags(node: ts.Node): void {
        if (ts.isIdentifier(node)) flags.add(node.text);
        ts.forEachChild(node, collectFlags);
      }
      collectFlags(expectationCall.arguments[1]);
    }

    const name = nameNode.text.replace(/^matrix\//, "");
    const category = name.slice(4, 5);
    if (category !== "i" && category !== "n" && category !== "y")
      throw new Error(`unknown RFC category in ${name}`);
    fixtures.push({ name, category, reject, flags });
  }

  return fixtures;
}

function escapeXML(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function buildSVG(fixtures: Fixture[]): {
  svg: string;
  width: number;
  height: number;
} {
  const cell = 8;
  const pitch = 10;
  const rowPitch = 10;
  const modeGap = 12;
  const left = 310;
  const top = 196;
  const right = 24;
  const bottom = 40;
  const modeWidth = TARGETS.length * pitch;
  const gridWidth = MODES.length * modeWidth + (MODES.length - 1) * modeGap;
  const width = left + gridWidth + right;
  const height = top + fixtures.length * rowPitch + bottom;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">`,
    '<title id="title">RFC 8259 parsing coverage by fixture, target family, and mode</title>',
    `<desc id="description">${fixtures.length} JSONTestSuite fixtures across ${TARGETS.length} target families in NAIVE, SWAR, and SIMD modes. Each square is one fixture-target-mode check.</desc>`,
    '<rect width="100%" height="100%" fill="#ffffff"/>',
    '<g font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" fill="#1f2328">',
    '<text x="20" y="30" font-size="20" font-weight="600">RFC 8259 parsing coverage</text>',
    `<text x="20" y="53" font-size="12" fill="#59636e">${fixtures.length} fixtures × ${TARGETS.length} target families × ${MODES.length} parser modes = ${fixtures.length * TARGETS.length * MODES.length} test cells</text>`,
  ];

  const counts = fixtures.reduce(
    (out, fixture) => {
      out[fixture.category]++;
      return out;
    },
    { i: 0, n: 0, y: 0 },
  );
  parts.push(
    `<text x="20" y="73" font-size="11" fill="#59636e">${counts.y} must-accept · ${counts.n} must-reject · ${counts.i} implementation-defined</text>`,
  );

  const legend = [
    ["direct", "direct value"],
    ["envelope", "nested / enveloped"],
    ["reject", "rejection exercised"],
    ["na", "not applicable"],
  ] as const;
  let legendX = 20;
  for (const [kind, label] of legend) {
    parts.push(
      `<rect x="${legendX}" y="91" width="10" height="10" rx="2" fill="${COLORS[kind]}" stroke="#1f2328" stroke-opacity="0.15"/>`,
      `<text x="${legendX + 15}" y="100" font-size="10">${escapeXML(label)}</text>`,
    );
    legendX += label.length * 6 + 34;
  }

  for (let modeIndex = 0; modeIndex < MODES.length; modeIndex++) {
    const modeX = left + modeIndex * (modeWidth + modeGap);
    parts.push(
      `<text x="${modeX + modeWidth / 2}" y="126" text-anchor="middle" font-size="12" font-weight="600">${MODES[modeIndex]}</text>`,
      `<line x1="${modeX}" y1="133" x2="${modeX + modeWidth - 2}" y2="133" stroke="#d0d7de"/>`,
    );
    for (let targetIndex = 0; targetIndex < TARGETS.length; targetIndex++) {
      const x = modeX + targetIndex * pitch + cell / 2;
      parts.push(
        `<text x="${x}" y="${top - 10}" transform="rotate(-90 ${x} ${top - 10})" font-size="8" text-anchor="start">${escapeXML(TARGETS[targetIndex].label)}</text>`,
      );
    }
  }

  let previousCategory: Fixture["category"] | null = null;
  for (let row = 0; row < fixtures.length; row++) {
    const fixture = fixtures[row];
    const y = top + row * rowPitch;
    if (previousCategory !== null && fixture.category !== previousCategory) {
      parts.push(
        `<line x1="20" y1="${y - 1}" x2="${width - right}" y2="${y - 1}" stroke="#8c959f" stroke-width="1"/>`,
      );
    }
    previousCategory = fixture.category;

    parts.push(
      `<rect x="${left - 10}" y="${y}" width="3" height="${cell}" rx="1" fill="${CATEGORY_COLORS[fixture.category]}"><title>${fixture.category === "y" ? "must accept" : fixture.category === "n" ? "must reject" : "implementation-defined"}</title></rect>`,
      `<text x="${left - 15}" y="${y + 6.7}" text-anchor="end" font-family="SFMono-Regular,Consolas,Liberation Mono,monospace" font-size="7.2">${escapeXML(fixture.name)}</text>`,
    );

    for (let modeIndex = 0; modeIndex < MODES.length; modeIndex++) {
      const modeX = left + modeIndex * (modeWidth + modeGap);
      for (let targetIndex = 0; targetIndex < TARGETS.length; targetIndex++) {
        const target = TARGETS[targetIndex];
        const kind: CoverageKind = fixture.reject
          ? "reject"
          : target.coverage(fixture.flags);
        const x = modeX + targetIndex * pitch;
        const detail = `${fixture.name} · ${MODES[modeIndex]} · ${target.label} · ${kind}`;
        parts.push(
          `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${COLORS[kind]}" stroke="#1f2328" stroke-opacity="0.12"><title>${escapeXML(detail)}</title></rect>`,
        );
      }
    }
  }

  parts.push("</g></svg>");
  return { svg: parts.join("\n"), width, height };
}

async function main(): Promise<void> {
  const fixtures = parseFixtures();
  if (fixtures.length === 0) throw new Error("RFC matrix contains no fixtures");
  const { svg, width, height } = buildSVG(fixtures);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(SVG_FILE, `${svg}\n`);

  const scale = 2;
  const image = await loadImage(Buffer.from(svg));
  const canvas = createCanvas(width * scale, height * scale);
  const context = canvas.getContext("2d");
  context.scale(scale, scale);
  context.drawImage(image, 0, 0, width, height);
  fs.writeFileSync(PNG_FILE, canvas.toBuffer("image/png"));

  console.log(
    `generated ${path.relative(ROOT, SVG_FILE)} and ${path.relative(ROOT, PNG_FILE)} (${fixtures.length} fixtures)`,
  );
}

await main();
