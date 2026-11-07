import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-separator-"));
try {
  const moduleURL = (file) => pathToFileURL(path.resolve(file)).href;
  const transform = path.join(dir, "instrument.mjs");
  fs.writeFileSync(
    transform,
    `
    import Base from ${JSON.stringify(moduleURL("transform/lib/index.js"))};
    import {Visitor} from ${JSON.stringify(moduleURL("transform/lib/visitor.js"))};
    import {SimpleParser,toString} from ${JSON.stringify(moduleURL("transform/lib/util.js"))};
    export default class extends Base {
      afterParse(parser) {
        super.afterParse(parser);
        class Count extends Visitor {
          visitMethodDeclaration(node, parent) {
            const previous = this.active;
            this.active = node.name.text === '__DESERIALIZE_WHITESPACE';
            super.visitMethodDeclaration(node, parent);
            this.active = previous;
          }
          visitIfStatement(node, parent) {
            if (this.active && toString(node.condition).includes('srcEnd - srcStart >= 6')) {
              const call = SimpleParser.parseStatement('recordSeparatorShortcut();');
              call.range = node.range;
              node.ifTrue.statements.unshift(call);
            }
            super.visitIfStatement(node, parent);
          }
        }
        for (const source of parser.sources)
          if (source.internalPath.endsWith('separator-value-start.fixture'))
            new Count().visit(source);
      }
    }
  `,
  );
  const configs = ["incremental", "minimal", "stub"].flatMap((runtime) =>
    ["NAIVE", "SWAR", "SIMD"].flatMap((mode) =>
      ["false", "true"].flatMap((strict) =>
        ["0", "1"].map((fast) => ({ runtime, mode, strict, fast, trace: false })),
      ),
    ),
  );
  configs.push({
    runtime: "incremental",
    mode: "SWAR",
    strict: "false",
    fast: "1",
    trace: true,
  });
  for (const config of configs) {
    const output = path.join(dir, "fixture.wasm");
    execFileSync(
      process.execPath,
      [
        "node_modules/assemblyscript/bin/asc.js",
        "assembly/__tests__/separator-value-start.fixture.ts",
        "--transform",
        transform,
        "-O3",
        "--runtime",
        config.runtime,
        "--enable",
        "simd",
        "--exportRuntime",
        "--exportStart",
        "start",
        ...(config.trace ? ["--use", "ASC_RTRACE=1"] : []),
        "-o",
        output,
      ],
      {
        env: {
          ...process.env,
          JSON_MODE: config.mode,
          JSON_STRICT: config.strict,
          JSON_USE_FAST_PATH: config.fast,
          JSON_CACHE: "0",
        },
        stdio: "pipe",
      },
    );
    const { instance } = await WebAssembly.instantiate(fs.readFileSync(output), {
      env: {
        abort(message, file, line, column) {
          throw new Error(`${JSON.stringify(config)}: ${line}:${column}`);
        },
      },
      rtrace: {
        oninit() {},
        onalloc() {},
        onresize() {},
        onmove() {},
        onfree() {},
        onvisit() {
          return 1;
        },
        oncollect() {},
        oninterrupt() {},
        onyield() {},
        onload(pointer) {
          return pointer;
        },
        onstore(pointer) {
          return pointer;
        },
      },
    });
    instance.exports.start();
    assert.equal(instance.exports.verify(), 1);
    if (config.fast === "1" && !config.trace)
      assert.ok(instance.exports.shortcutCount() > 0, "shortcut must execute");
    else assert.equal(instance.exports.shortcutCount(), 0);
  }
  console.log(
    `Separator value starts: ${configs.length} configurations passed; shortcut, extra whitespace, codecs, reuse, Unicode and tracing fallback`,
  );
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
