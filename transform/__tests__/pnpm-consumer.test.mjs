// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const root = path.resolve(import.meta.dirname, "../..");
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "json-as pnpm consumer "));
const pnpm = process.env.PNPM_BIN || "pnpm";
const savedEnv = {
  ...process.env,
  JSON_AS_LIBRARY_SOURCE: "",
  JSON_CACHE: "false",
};
let builds = 0,
  operations = 0;
function run(command, args, cwd, env = {}) {
  const r = spawnSync(command, args, {
    cwd,
    env: { ...savedEnv, ...env },
    encoding: "utf8",
  });
  assert.equal(
    r.status,
    0,
    `${command} ${args.join(" ")}\n${r.stdout}\n${r.stderr}`,
  );
  return r.stdout;
}
function write(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(
    file,
    typeof value === "string" ? value : JSON.stringify(value, null, 2),
  );
}
function fixture(name, model = false) {
  return `import {JSON as J,JSONMode,toRaw,fromRaw,toBox} from "${name}";
${model ? 'import {Row} from "models";' : "@json class Row {n:i32=7;}"}
export function verify():string {
 const out=J.parse<Row>('${model ? '{"n":9,"lazy":4,"values":[1,2],"map":{"x":3},"token":8}' : '{"n":9}'}'); assert(out.n==9);
 assert(J.parse<Row>('${model ? '{"n":11,"lazy":4,"values":[1,2],"map":{"x":3},"token":8}' : '{"n":11}'}',out).n==11);
 ${model ? 'assert(out.lazy==4&&out.values.length==2&&out.map.get("x")==3&&out.token.value==8);' : ""}
 assert(fromRaw(toRaw('{"x":1}'))=='{"x":1}');assert(toBox<i32>(7).value==7);assert(JSONMode.SWAR==0);
 assert(J.stringify(out).includes('"n":11'));
 assert(J.stringify<f32>(1.25)=="1.25");
 assert(J.stringify<f64[]>([1.5,2.5])=="[1.5,2.5]");
 const floats=new Map<string,f64>();floats.set("f",1.5);assert(J.stringify(floats)=='{"f":1.5}');
 return J.stringify(out.n);
}`;
}
function execute(wasm) {
  let g;
  const decode = (p) =>
    Buffer.from(
      g.memory.buffer,
      p,
      new DataView(g.memory.buffer).getUint32(p - 4, true) & 0x7fffffff,
    ).toString("utf16le");
  g = new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(wasm)), {
    env: {
      abort(m) {
        throw Error(m ? decode(m) : "abort");
      },
    },
  }).exports;
  assert.equal(decode(g.verify()), "11");
  operations += 10;
}
function compile(cwd, app, name, entry, mode, strict) {
  const compiler = path.join(app, "node_modules/assemblyscript/bin/asc.js");
  const transform = path.join(
    app,
    "node_modules",
    name,
    "transform/lib/index.js",
  );
  const output = path.join(cwd, "out.wasm");
  const flags = [
    "-O3",
    "-o",
    output,
    ...(mode === "SIMD" ? ["--enable", "simd"] : []),
  ];
  if (cwd === app)
    run(pnpm, ["exec", "asc", entry, "--transform", name, ...flags], cwd, {
      JSON_MODE: mode,
      JSON_STRICT: String(strict),
    });
  else
    run(
      process.execPath,
      [
        compiler,
        "--baseDir",
        app,
        path.join(app, entry),
        "--transform",
        transform,
        ...flags,
      ],
      cwd,
      { JSON_MODE: mode, JSON_STRICT: String(strict) },
    );
  execute(output);
  builds++;
}
try {
  const packed = JSON.parse(
    run(
      "npm",
      ["pack", "--ignore-scripts", "--json", "--pack-destination", dir],
      root,
    ),
  )[0];
  const tarball = path.join(dir, packed.filename);
  const entries = run("tar", ["-tzf", tarball], root).split("\n");
  for (const name of [
    "assembly/index.ts",
    "LICENSE",
    "LICENSE.Apache-2.0",
    "NOTICE",
  ])
    assert(
      entries.includes("package/node_modules/xjb-as/" + name),
      "Missing bundled dependency source/license: " + name,
    );
  const app = path.join(dir, "default");
  write(path.join(app, "package.json"), {
    private: true,
    dependencies: { "json-as": "file:" + tarball },
    devDependencies: { assemblyscript: "0.28.20" },
  });
  write(path.join(app, "index.ts"), fixture("json-as"));
  run(
    pnpm,
    [
      "install",
      "--ignore-scripts",
      "--prefer-offline",
      "--reporter=append-only",
    ],
    app,
  );
  for (const mode of process.env.PNPM_CONSUMER_QUICK
    ? ["SWAR"]
    : ["NAIVE", "SWAR", "SIMD"])
    for (const strict of process.env.PNPM_CONSUMER_QUICK
      ? [false]
      : [false, true])
      compile(app, app, "json-as", "index.ts", mode, strict);
  if (!process.env.PNPM_CONSUMER_QUICK) {
    const lower = path.join(dir, "compiler-lower-bound");
    write(path.join(lower, "package.json"), {
      private: true,
      dependencies: { "json-as": "file:" + tarball },
      devDependencies: { assemblyscript: "0.28.18" },
    });
    write(path.join(lower, "index.ts"), fixture("json-as/assembly"));
    run(
      pnpm,
      [
        "install",
        "--ignore-scripts",
        "--prefer-offline",
        "--reporter=append-only",
      ],
      lower,
    );
    compile(lower, lower, "json-as", "index.ts", "SWAR", false);

    for (const name of ["json-as", "json-toolkit"]) {
      const workspace = path.join(dir, "workspace-" + name);
      const app = path.join(workspace, "packages/app");
      const model = path.join(workspace, "packages/models");
      write(path.join(workspace, "package.json"), { private: true });
      write(
        path.join(workspace, "pnpm-workspace.yaml"),
        "packages:\n  - 'packages/*'\nhoist: false\npublicHoistPattern: []\n",
      );
      write(path.join(app, "package.json"), {
        name: "app",
        private: true,
        dependencies: { [name]: "file:" + tarball, models: "workspace:*" },
        devDependencies: { assemblyscript: "0.28.20" },
      });
      write(path.join(model, "package.json"), {
        name: "models",
        version: "1.0.0",
        types: "index.ts",
        dependencies: { [name]: "file:" + tarball },
      });
      write(
        path.join(model, "index.ts"),
        `import {JSON} from "${name}/assembly";
@json class Token {value:i32=-1;@serializer("number") encode(self:Token):string{return self.value.toString();}@deserializer("number") decode(text:string):Token {const out=new Token();out.value=<i32>parseInt(text);return out;}}
@json export class Base<T> {n:T=changetype<T>(7);}
@json export class Row extends Base<i32> {lazy:JSON.Lazy<i32>=2;values:i32[]=[];map:Map<string,i32>=new Map<string,i32>();token:Token=new Token();}
`,
      );
      write(path.join(app, "index.ts"), fixture(name, true));
      run(
        pnpm,
        [
          "install",
          "--ignore-scripts",
          "--prefer-offline",
          "--reporter=append-only",
        ],
        workspace,
      );
      assert(
        !fs.existsSync(path.join(workspace, "node_modules/assemblyscript")),
        "The workspace root must not supply a compiler",
      );
      for (const cwd of [app, workspace]) {
        run(
          process.execPath,
          [
            "--input-type=module",
            "-e",
            `await import(${JSON.stringify(path.join(app, "node_modules", name, "transform/lib/index.js"))})`,
          ],
          cwd,
        );
        for (const [mode, strict] of [
          ["SWAR", false],
          ["SIMD", true],
        ])
          compile(cwd, app, name, "index.ts", mode, strict);
      }
    }
  }
  console.log(
    `pnpm packed consumers: ${builds} builds, ${operations} execution checks; ${process.env.PNPM_CONSUMER_QUICK ? "default smoke passed" : "default and isolated linked workspaces passed"}`,
  );
} finally {
  if (process.env.KEEP_PNPM_CONSUMERS) console.log("Preserved:", dir);
  else fs.rmSync(dir, { recursive: true, force: true });
}
