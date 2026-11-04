import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import test from "node:test";
import { execFileSync } from "node:child_process";
import {
  beginBenchRun,
  finishBenchRun,
  readBenchArtifact,
  benchProvenanceSubtitle,
} from "../lib/bench-provenance.mjs";
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-provenance-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, "package.json"), '{"version":"1.0.0"}');
  fs.mkdirSync(path.join(root, "assembly"));
  fs.writeFileSync(path.join(root, "assembly/model.ts"), "old");
  fs.mkdirSync(path.join(root, "build/logs/as/swar"), { recursive: true });
  return root;
}
test("chart provenance belongs to the measured artifact after checkout changes", (t) => {
  const root = fixture(t);
  const file = path.join(root, "build/logs/as/swar/test.serialize.as.json");
  const pending = beginBenchRun(root, {
    strict: "false",
    fastPath: "1",
    language: "as",
  });
  fs.writeFileSync(
    file,
    JSON.stringify({
      description: "untouched JSON.Obj forwarding",
      operations: 10,
      mbps: 123,
    }),
  );
  finishBenchRun(root, pending);
  fs.writeFileSync(path.join(root, "package.json"), '{"version":"2.0.0"}');
  fs.writeFileSync(path.join(root, "assembly/model.ts"), "new");
  const { result, provenance } = readBenchArtifact(file);
  assert.equal(result.mbps, 123);
  const title = benchProvenanceSubtitle([provenance]);
  assert.match(title, /v1\.0\.0/);
  assert.doesNotMatch(title, /v2\.0\.0/);
  assert.equal(provenance.workload, "untouched JSON.Obj forwarding");
  assert.ok(provenance.source.files["assembly/model.ts"]);
  fs.writeFileSync(file, JSON.stringify({ mbps: 999 }));
  assert.throws(() => readBenchArtifact(file), /does not match/);
});
test("legacy logs have explicit unknown provenance; changed sources cannot be certified", (t) => {
  const root = fixture(t);
  assert.match(benchProvenanceSubtitle([null]), /Unrecorded/);
  const pending = beginBenchRun(root);
  fs.writeFileSync(path.join(root, "assembly/model.ts"), "changed");
  assert.throws(() => finishBenchRun(root, pending), /sources changed/);
});

test("the JavaScript runner records completed measurements without live chart probes", (t) => {
  const root = fixture(t);
  const repository = path.resolve(import.meta.dirname, "../..");
  for (const name of [
    "scripts/run-bench.js.sh",
    "scripts/lib/bench-provenance.mjs",
    "scripts/lib/runtime-version.mjs",
  ]) {
    fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    fs.copyFileSync(path.join(repository, name), path.join(root, name));
  }
  const bin = path.join(root, "bin");
  fs.mkdirSync(bin);
  fs.symlinkSync(process.execPath, path.join(bin, "node"));
  const executable = (name, text) =>
    fs.writeFileSync(
      path.join(bin, name),
      "#!/bin/bash\nset -euo pipefail\n" + text,
      { mode: 0o755 },
    );
  executable("npx", "exit 0\n");
  executable(
    "d8",
    `if [[ "\${1:-}" == --version ]]; then echo 'V8 fixture-old'; exit; fi
mkdir -p build/logs/js
printf '%s\\n' '{"description":"fixture","mbps":7}' > build/logs/js/fixture.serialize.js.json
`,
  );
  fs.mkdirSync(path.join(root, "bench/lib"), { recursive: true });
  fs.writeFileSync(path.join(root, "bench/lib/bench.js"), "// fixture");
  fs.writeFileSync(path.join(root, "bench/fixture.bench.ts"), "// fixture");
  fs.mkdirSync(path.join(root, "build/lib"), { recursive: true });
  fs.writeFileSync(path.join(root, "build/fixture.bench.js"), "// fixture");
  execFileSync("bash", ["scripts/run-bench.js.sh", "fixture"], {
    cwd: root,
    env: {
      ...process.env,
      PATH: bin + path.delimiter + process.env.PATH,
      D8_BIN: path.join(bin, "d8"),
    },
    stdio: "pipe",
  });
  const { provenance, result } = readBenchArtifact(
    path.join(root, "build/logs/js/fixture.serialize.js.json"),
  );
  assert.equal(result.mbps, 7);
  assert.equal(provenance.tools.v8, "V8 fixture-old");
  assert.ok(provenance.drivers["build/fixture.bench.js"]);
  assert.equal(provenance.settings.language, "js");
});
