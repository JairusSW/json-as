import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { stripVTControlCharacters } from "node:util";
const root = path.resolve(import.meta.dirname, "../..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-warnings-"));
const allowed = [217, 228, 235];
const asconfig = JSON.parse(
  fs.readFileSync(path.join(root, "asconfig.json"), "utf8"),
);
assert.deepEqual(
  asconfig.options.disableWarning,
  allowed,
  "Do not disable AS201 or all diagnostics via an empty list",
);
for (const name of ["as-test.config.json", "rfc.config.json"]) {
  const config = JSON.parse(fs.readFileSync(path.join(root, name), "utf8"));
  for (const options of [
    config.buildOptions,
    ...Object.values(config.modes).map((mode) => mode.buildOptions),
  ]) {
    const args = options.args;
    const disabled = args.flatMap((arg, index) =>
      arg === "--disableWarning" ? [Number(args[index + 1])] : [],
    );
    assert.deepEqual(
      disabled,
      [...allowed, 906],
      name + " must use only the documented exceptions",
    );
  }
}

function compile(entry, output, extra = [], env = {}) {
  const result = spawnSync(
    process.execPath,
    [
      path.join(root, "node_modules/assemblyscript/bin/asc.js"),
      entry,
      "-o",
      output,
      ...extra,
    ],
    { cwd: root, env: { ...process.env, ...env }, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  return stripVTControlCharacters(result.stderr + result.stdout);
}
function decode(g, p) {
  return Buffer.from(
    g.memory.buffer,
    p,
    new DataView(g.memory.buffer).getUint32(p - 4, true) & 0x7fffffff,
  ).toString("utf16le");
}
try {
  // Prove the normal project config still reports a genuine narrowing warning.
  const probe = path.join(dir, "narrow.ts");
  fs.writeFileSync(
    probe,
    "export function narrow(value:usize):i32 { return value; }",
  );
  assert.match(
    compile(probe, path.join(dir, "probe.wasm"), [], { CI: "true" }),
    /WARNING AS201:/,
    "AS201 must remain enabled",
  );
  let checks = 0;
  for (const mode of ["NAIVE", "SWAR", "SIMD"])
    for (const runtime of ["incremental", "minimal", "stub"])
      for (const strict of [false, true])
        for (const fast of [false, true]) {
          const label = `${mode}/${runtime}/strict=${strict}/fast=${fast}`;
          const file = path.join(dir, "check.wasm");
          const diagnostics = compile(
            "assembly/__tests__/compiler-warnings.fixture.ts",
            file,
            [
              "--transform",
              "./transform",
              "-O3",
              "--runtime",
              runtime,
              ...(mode === "SIMD" ? ["--enable", "simd"] : []),
            ],
            {
              JSON_MODE: mode,
              JSON_STRICT: String(strict),
              JSON_USE_FAST_PATH: fast ? "1" : "0",
              JSON_AS_LIBRARY_SOURCE: "assembly/index",
            },
          );
          assert.doesNotMatch(
            diagnostics,
            /WARNING AS\d+:/,
            label + " emitted a compiler warning:\n" + diagnostics,
          );
          let g;
          g = new WebAssembly.Instance(
            new WebAssembly.Module(fs.readFileSync(file)),
            {
              env: {
                abort(m) {
                  throw Error(decode(g, m));
                },
              },
            },
          ).exports;
          assert.equal(
            decode(g, g.verify()),
            '{"rows":[{"value":7,"label":"x"}],"bytes":[1,2],"buffer":[3,4]}|{"n":7}|[7]',
            label,
          );
          checks++;
        }
  // Explicit WASI configs bypass the root config. Match the benchmark flags.
  for (const mode of ["NAIVE", "SWAR", "SIMD"])
    for (const runtime of ["incremental", "minimal", "stub"]) {
      const diagnostics = compile(
        "assembly/__tests__/compiler-warnings.fixture.ts",
        path.join(dir, "wasi.wasm"),
        [
          "--transform",
          "./transform",
          "--config",
          "node_modules/@assemblyscript/wasi-shim/asconfig.json",
          "--disableWarning",
          "217",
          "--disableWarning",
          "228",
          "--disableWarning",
          "235",
          "-O3",
          "--runtime",
          runtime,
          ...(mode === "SIMD" ? ["--enable", "simd"] : []),
        ],
        {
          JSON_MODE: mode,
          JSON_STRICT: "false",
          JSON_USE_FAST_PATH: "1",
          JSON_AS_LIBRARY_SOURCE: "assembly/index",
        },
      );
      assert.doesNotMatch(
        diagnostics,
        /WARNING AS\d+:/,
        `${mode}/${runtime}/WASI:\n${diagnostics}`,
      );
      checks++;
    }
  // The test runner selects its own WASI config and includes as-test's helpers.
  for (const [entry, strict] of [
    ["null.spec.ts", false],
    ["strict/cursor.spec.ts", true],
  ])
    for (const mode of ["NAIVE", "SWAR", "SIMD"]) {
      const diagnostics = compile(
        "assembly/__tests__/" + entry,
        path.join(dir, "test.wasm"),
        [
          "--transform",
          "as-test/transform",
          "--transform",
          "./transform",
          "--transform",
          "try-as/transform",
          "--use",
          "AS_TEST_TRY_AS=1",
          "--use",
          "AS_TEST_WASI=1",
          "--config",
          "node_modules/@assemblyscript/wasi-shim/asconfig.json",
          ...[...allowed, 906].flatMap((code) => [
            "--disableWarning",
            String(code),
          ]),
          ...(mode === "SIMD" ? ["--enable", "simd"] : []),
        ],
        {
          JSON_MODE: mode,
          JSON_STRICT: String(strict),
          JSON_USE_FAST_PATH: "1",
          JSON_AS_LIBRARY_SOURCE: "assembly/index",
        },
      );
      assert.doesNotMatch(
        diagnostics,
        /(?:WARNING|PEDANTIC) AS\d+:/,
        mode + "/" + entry + ":\n" + diagnostics,
      );
      checks++;
    }
  console.log(
    `Compiler warnings: AS201 remains enabled; ${checks} native/WASI/test configurations are warning-free`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
