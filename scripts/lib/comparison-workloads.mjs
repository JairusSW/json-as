import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import ts from "typescript";

export const OVERVIEW = [
  "abc",
  "uuidv4",
  "vec3",
  "token",
  "small",
  "medium",
  "large",
];
export const CLASSIC = [
  "twitter",
  "canada",
  "citm_catalog",
  "poet",
  "github_events",
  "gsoc-2018",
  "lottie",
  "otfcc",
  "fgo",
];
export const digest = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");
export function literalPayload(source, filename = "benchmark.ts") {
  const tree = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  let value;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(tree) === "v2") {
      if (!node.initializer || !ts.isStringLiteralLike(node.initializer))
        throw new Error(`Expected a literal v2 payload in ${filename}`);
      value = node.initializer.text;
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  if (value === undefined) throw new Error(`Missing v2 payload in ${filename}`);
  JSON.parse(value);
  return value;
}
export function comparisonWorkload(root, suite) {
  let source, text, group;
  if (OVERVIEW.includes(suite)) {
    group = "overview";
    source = `bench/${suite}.bench.ts`;
    text = literalPayload(
      fs.readFileSync(path.join(root, source), "utf8"),
      source,
    );
    const asSource = `assembly/__benches__/${suite}.bench.ts`;
    const asText = literalPayload(
      fs.readFileSync(path.join(root, asSource), "utf8"),
      asSource,
    );
    if (text !== asText) throw new Error(`AS/JS input mismatch for ${suite}`);
  } else if (suite === "multilib") {
    group = "library";
    source = "assembly/__benches__/payloads/multilib.json";
    text = fs.readFileSync(path.join(root, source), "utf8");
  } else {
    const name = suite.replace(/-min$/, "");
    if (!CLASSIC.includes(name) || suite !== `${name}-min`)
      throw new Error(`Unknown comparison suite ${suite}`);
    group = "classic";
    source = `assembly/__benches__/payloads/${name}.min.json`;
    text = fs.readFileSync(path.join(root, source), "utf8");
  }
  return {
    suite,
    group,
    source,
    text,
    bytes: Buffer.byteLength(text),
    inputSha256: digest(text),
    sourceSha256: digest(fs.readFileSync(path.join(root, source))),
  };
}
export function comparisonWorkloads(root) {
  return [...OVERVIEW, "multilib", ...CLASSIC.map((name) => `${name}-min`)].map(
    (suite) => comparisonWorkload(root, suite),
  );
}
