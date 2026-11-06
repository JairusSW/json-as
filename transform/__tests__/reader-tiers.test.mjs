import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-tiers-"));
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
          visitClassDeclaration(node, parent) {
            if (node.name.text === 'Child') for (const member of node.members) {
              const tier = member.name.text === '__DESERIALIZE_FAST' ? 1 :
                member.name.text === '__DESERIALIZE_WHITESPACE' ? 2 : 0;
              if (tier) member.body.statements.unshift(
                SimpleParser.parseStatement('recordTier(' + tier + ');')
              );
            }
            super.visitClassDeclaration(node, parent);
          }
        }
        const instrument = new Instrument();
        for (const source of parser.sources)
          if (source.internalPath.endsWith('reader-tiers.fixture')) instrument.visit(source);
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
            "assembly/__tests__/reader-tiers.fixture.ts",
            "--transform",
            transform,
            "-O3",
            "--enable",
            "simd",
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
        assert.equal(instance.exports.compact(+fast), 1);
        assert.equal(instance.exports.pretty(+fast), 1);
        if (+fast)
          assert.equal(
            instance.exports.counts(),
            2,
            `${mode}/${strict}/${fast}`,
          );
        assert.equal(
          instance.exports.compact(+fast),
          1,
          "next parse restarts at tier 1",
        );
        assert.equal(instance.exports.fallbacks(+fast), 1);
        checked++;
      }
  console.log(`Generated child tiers: ${checked} configurations passed`);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
