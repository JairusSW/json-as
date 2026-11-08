import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as-lookahead-"));
const url = (file) => pathToFileURL(path.resolve(file)).href;
const wrapper = path.join(dir, "observe.mjs");
fs.writeFileSync(wrapper, `
import Base from ${JSON.stringify(url("transform/lib/index.js"))};
import {Visitor} from ${JSON.stringify(url("transform/lib/visitor.js"))};
import {SimpleParser,toString} from ${JSON.stringify(url("transform/lib/util.js"))};
export default class extends Base {
 afterParse(parser) {
  super.afterParse(parser);
  class Observe extends Visitor {
   visitMethodDeclaration(n,p) {
    const previous=this.active;
    this.active=n.name.text==='__DESERIALIZE_WHITESPACE';
    super.visitMethodDeclaration(n,p);
    this.active=previous;
   }
   visitBlockStatement(n,p) {
    super.visitBlockStatement(n,p);
    if(!this.active)return;
    for(let i=0;i<n.statements.length;i++) {
     const statement=n.statements[i];
     const text=toString(statement).replaceAll(' ','').replaceAll(';','');
     if(!text.startsWith('kp=')||!text.endsWith('.Util.skipWhitespace(srcStart,srcEnd)'))continue;
     const count=SimpleParser.parseStatement('recordLookahead();');
     class Bind extends Visitor {_visit(x,p){x.range=statement.range;super._visit(x,p);}}
     new Bind().visit(count);n.statements.splice(i,0,count);i++;
    }
   }
  }
  for(const s of parser.sources)
   if(s.internalPath.endsWith('optional-lookahead.fixture'))new Observe().visit(s);
 }
}
`);
const configs = ["incremental", "minimal", "stub"].flatMap((runtime) =>
  ["NAIVE", "SWAR", "SIMD"].flatMap((mode) =>
    ["false", "true"].flatMap((strict) =>
      ["0", "1"].map((fast) => ({ runtime, mode, strict, fast, trace: false })),
    ),
  ),
);
configs.push({ runtime: "incremental", mode: "SWAR", strict: "false", fast: "1", trace: true });
try {
  for (const c of configs) {
    const file = path.join(dir, "fixture.wasm");
    execFileSync(process.execPath, [
      "node_modules/assemblyscript/bin/asc.js", "transform/__tests__/optional-lookahead.fixture.ts",
      "--transform", wrapper, "-O3", "--runtime", c.runtime, "--enable", "simd",
      "--exportStart", "start", "--exportRuntime", "-o", file,
      ...(c.trace ? ["--use", "ASC_RTRACE=1"] : []),
    ], { env: { ...process.env, JSON_MODE: c.mode, JSON_STRICT: c.strict,
      JSON_USE_FAST_PATH: c.fast, JSON_CACHE: "0" }, stdio: "pipe" });
    const hooks = {};
    for (const name of ["oninit", "onalloc", "onresize", "onmove", "onfree", "onvisit",
      "oncollect", "oninterrupt", "onyield", "onload", "onstore"])
      hooks[name] = (...args) => name === "onvisit" ? 1 : args[0];
    const { instance } = await WebAssembly.instantiate(fs.readFileSync(file), {
      rtrace: hooks, env: { abort(_m, _f, line, column) {
        throw Error(`${JSON.stringify(c)}: abort ${line}:${column}`);
      } },
    });
    const g = instance.exports;
    g.start();
    assert.equal(g.verify(), 1, JSON.stringify(c));
    assert.equal(g.verifyMasks(), 128, JSON.stringify(c));
    for (let which = 0; which < 4; which++) {
      const expected = c.fast === "0" ? 0 : c.trace ? 6 : [1, 1, 2, 2][which];
      assert.equal(g.probeCount(which), expected, `${JSON.stringify(c)} probe ${which}`);
    }
  }
  console.log(`Optional lookahead: values, reuse, omissions, effects, fallback and preparation counts passed (${configs.length} configurations)`);
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
