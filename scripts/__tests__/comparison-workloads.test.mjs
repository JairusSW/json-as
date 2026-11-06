import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  literalPayload,
  comparisonWorkload,
  comparisonWorkloads,
  digest,
} from "../lib/comparison-workloads.mjs";
import { benchProvenanceSubtitle } from "../lib/bench-provenance.mjs";

test("comparison payload extraction respects literal escapes and rejects computed inputs", () => {
  const expected = JSON.stringify({ name: "hello\nworld" });
  assert.equal(
    literalPayload("const v2 = " + JSON.stringify(expected) + ";"),
    expected,
  );
  assert.throws(() => literalPayload("const v2 = makeInput();"), /literal/);
  assert.throws(() => literalPayload('const unrelated = "{}";'), /Missing/);
});
test("all comparison inputs are pinned to their exact byte content", () => {
  const rows = comparisonWorkloads(process.cwd());
  assert.equal(rows.length, 17);
  assert.equal(rows.filter((r) => r.group === "classic").length, 9);
  for (const r of rows) {
    assert.equal(r.bytes, Buffer.byteLength(r.text));
    assert.equal(r.inputSha256, digest(r.text));
  }
});
test("comparison refuses mismatched AS and JS inputs", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-comparison-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const [file, payload] of [
    ["bench/abc.bench.ts", '"abc"'],
    ["assembly/__benches__/abc.bench.ts", '"abd"'],
  ]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), `const v2 = '${payload}';`);
  }
  assert.throws(() => comparisonWorkload(root, "abc"), /mismatch/);
});
test("mixed chart captions preserve native, JS, and Wasm runtime identities", () => {
  const base = {
    host: { arch: "arm64" },
    startedAt: "2026-11-05T00:00:00Z",
    source: {
      packageVersion: "2.0.0",
      commit: "1234567890",
      treeHash: "abcdefghij",
    },
    tools: {
      runtime: "simdjson 5.0.4 native DOM\nextra",
      v8: "V8 fixture",
      node: "Node fixture",
    },
    settings: { strict: "false", fastPath: "1" },
  };
  const rows = [
    { ...base, settings: { ...base.settings, language: "native" } },
    {
      ...base,
      settings: { ...base.settings, language: "js", runtime: "node" },
    },
    { ...base, settings: { ...base.settings, language: "as" } },
  ];
  const title = benchProvenanceSubtitle(rows);
  for (const value of [
    "arm64",
    "simdjson 5.0.4 native DOM",
    "Node fixture",
    "V8 fixture",
  ])
    assert.ok(title.includes(value));
  assert.ok(!title.includes("extra"));
});
