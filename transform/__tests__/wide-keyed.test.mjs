import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

fs.mkdirSync(".as-test", { recursive: true });
const dir = fs.mkdtempSync(path.resolve(".as-test/wide-keyed-"));
const fixture = path.join(dir, "wide-keyed.fixture.ts");
// Cover both eligibility limits and the u32/u64 mask boundary. Instrument the
// slow reader so correct values alone cannot hide an unintended fallback.
const lines = [
  'import {JSON} from "../../assembly/index";',
  "let slowCalls:i32=0; function recordSlow():void {slowCalls++;}",
  "@json class Nested { n:i32=0; }",
];
const checks = [];
for (const count of [24, 25, 32, 33, 64, 65]) {
  const name = `Wide${count}`;
  const fields = Array.from(
    { length: count },
    (_, i) => `p${String(i).padStart(2, "0")}`,
  );
  const type = (i) =>
    ({ 2: "string", 3: "bool", 4: "f64", 5: "string | null", 32: "Nested" })[
      i
    ] ?? "i32";
  const value = (i) =>
    i === 5
      ? null
      : ({ 2: "wire", 3: true, 4: 1.5, 5: null, 32: { n: 33 } }[i] ?? i + 1);
  const initial = (i) =>
    ({ 2: '"old"', 3: "true", 4: "99.5", 5: '"old"', 32: "new Nested()" })[i] ??
    "99";
  const zero = (i) => ({ 2: '""', 3: "false", 4: "0.0", 5: "null" })[i] ?? "0";
  lines.push(
    `@json class ${name} {${fields.map((f, i) => `${f}!: ${type(i)};`).join("\n")}}`,
  );
  const full = Object.fromEntries(
    fields.map((f, i) => [f, value(i)]).reverse(),
  );
  const sparse = '{"p00":7' + (count > 33 ? ',"p33":9,"p33":11' : "") + "}";
  checks.push(
    "{",
    `const out = new ${name}();`,
    ...fields.map((f, i) => `out.${f}=${initial(i)};`),
    `JSON.parse<${name}>(${JSON.stringify(JSON.stringify(full))},out);`,
    ...fields.map(
      (f, i) =>
        `assert(out.${f}${i === 32 ? ".n" : ""}==${JSON.stringify(i === 32 ? 33 : value(i))});`,
    ),
    "slowCalls=0;",
    `const fresh=JSON.parse<${name}>(${JSON.stringify(sparse)});`,
    `JSON.parse<${name}>(${JSON.stringify(sparse)},out);`,
    ...fields.flatMap((f, i) =>
      ["fresh", "out"].map(
        (o) =>
          `assert(${o}.${f}${i === 32 ? ".n" : ""}==${i === 0 ? "7" : i === 33 ? "11" : zero(i)});`,
      ),
    ),
    ...(count >= 25 && count <= 64
      ? ["if(JSON_USE_FAST_PATH) assert(slowCalls==0);"]
      : []),
    "}",
  );
}
lines.push("export function verify():i32 {", ...checks, "return 1;}");
fs.writeFileSync(fixture, lines.join("\n"));
try {
  const transform = path.join(dir, "instrument.mjs");
  const moduleURL = (file) => pathToFileURL(path.resolve(file)).href;
  fs.writeFileSync(
    transform,
    `
    import Transformer from ${JSON.stringify(moduleURL("transform/lib/index.js"))};
    import {Visitor} from ${JSON.stringify(moduleURL("transform/lib/visitor.js"))};
    import {SimpleParser} from ${JSON.stringify(moduleURL("transform/lib/util.js"))};
    export default class extends Transformer {
      afterParse(parser) {
        super.afterParse(parser);
        class Instrument extends Visitor {
          visitClassDeclaration(node,parent){
            if(node.name.text.startsWith('Wide'))for(const member of node.members)if(member.name?.text==='__DESERIALIZE_SLOW')member.body.statements.unshift(SimpleParser.parseStatement('recordSlow();'));
            super.visitClassDeclaration(node,parent);
          }
        }
        const instrument = new Instrument();
        for (const source of parser.sources)
          if (source.internalPath.endsWith('wide-keyed.fixture')) instrument.visit(source);
      }
    }
  `,
  );
  let checked = 0;
  for (const mode of ["NAIVE", "SWAR", "SIMD"])
    for (const strict of ["false", "true"])
      for (const fast of ["0", "1"]) {
        const binary = path.join(dir, "tiers.wasm");
        execFileSync(
          process.execPath,
          [
            "node_modules/assemblyscript/bin/asc.js",
            fixture,
            "--transform",
            transform,
            "-O3",
            "--enable",
            "simd",
            "--use",
            `JSON_USE_FAST_PATH=${fast}`,
            "--exportStart",
            "start",
            "-o",
            binary,
          ],
          {
            env: {
              ...process.env,
              JSON_MODE: mode,
              JSON_STRICT: strict,
              JSON_USE_FAST_PATH: fast,
              JSON_CACHE: "0",
            },
            stdio: "pipe",
          },
        );
        const { instance } = await WebAssembly.instantiate(
          fs.readFileSync(binary),
          {
            env: {
              abort(m, f, l, c) {
                throw new Error(`${mode}/${strict}/${fast}: ${l}:${c}`);
              },
            },
          },
        );
        instance.exports.start();
        assert.equal(instance.exports.verify(), 1);
        checked++;
      }
  console.log(
    `Wide keyed masks and sparse defaults: ${checked} configurations passed`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
