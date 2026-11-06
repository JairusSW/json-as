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
export const NATIVE_MODELS = {
  abc: { source: "assembly/__benches__/abc.bench.ts", root: "string" },
  uuidv4: { source: "assembly/__benches__/uuidv4.bench.ts", root: "string" },
  vec3: { source: "assembly/__benches__/vec3.bench.ts", root: "Vec3" },
  token: { source: "assembly/__benches__/token.bench.ts", root: "Token" },
  small: { source: "assembly/__benches__/small.bench.ts", root: "SmallJSON" },
  medium: {
    source: "assembly/__benches__/medium.bench.ts",
    root: "MediumAPIResponse",
  },
  large: { source: "assembly/__benches__/large.bench.ts", root: "Repo" },
  multilib: { source: "assembly/__benches__/multilib/shared.ts", root: "Repo" },
};
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
    const name = suite.replace(/-(min|pretty)$/, "");
    if (
      !CLASSIC.includes(name) ||
      ![`${name}-min`, `${name}-pretty`].includes(suite)
    )
      throw new Error(`Unknown comparison suite ${suite}`);
    group = "classic";
    source = `assembly/__benches__/payloads/${suite.replace(/-(min|pretty)$/, ".$1")}.json`;
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
