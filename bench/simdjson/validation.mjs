// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

// Whole-corpus validation without requiring typed reflection/Raw adapters.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { rotateText } from "./inputs.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const base = path.join(root, "build/simdjson-parity");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "bench/simdjson/workloads.json"), "utf8"),
);
const args = process.argv.slice(2),
  command = args.shift();
const option = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const label = option("--label", "validation-current");
if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw new Error("Invalid label");
const sourceRoot = path.resolve(option("--source-root", root));
const targetBytes = Number(option("--target-bytes", String(32 * 1024 * 1024)));
if (!Number.isSafeInteger(targetBytes) || targetBytes < 1024)
  throw new Error("Invalid target bytes");
const key = "validation-matrix",
  dir = path.join(base, "runs", label);
const read = (file) => fs.readFileSync(file, "utf8");
const sha = (value) => crypto.createHash("sha256").update(value).digest("hex");
const relative = (file) => path.relative(root, file).split(path.sep).join("/");
const preflight = [
  ["null", true],
  ["[1.25,-0,1e30,true]", true],
  ['{"text":"é漢字😀"}', true],
  ["01", false],
  ["1.", false],
  ["1e+", false],
  ["+1", false],
  ["[1,]", false],
  ['{"a":1,}', false],
  ["[", false],
  ['"bad\\q"', false],
  ['"line\nbreak"', false],
  ["truefalse", false],
  ['{"a" 1}', false],
  ["[1 2]", false],
  ["123\u0130", false],
];
function treeSha(directory) {
  const hash = crypto.createHash("sha256");
  const visit = (current) => {
    for (const entry of fs
      .readdirSync(current, { withFileTypes: true })
      .toSorted((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) {
        hash.update(
          path.relative(directory, absolute).split(path.sep).join("/"),
        );
        hash.update("\0");
        hash.update(fs.readFileSync(absolute));
        hash.update("\0");
      }
    }
  };
  visit(directory);
  return hash.digest("hex");
}
function assemblyscriptProvenance(sourceRoot) {
  const packageRoot = fs.realpathSync(
    path.join(sourceRoot, "node_modules/assemblyscript"),
  );
  const files = [
    "package.json",
    "bin/asc.js",
    "dist/asc.js",
    "dist/assemblyscript.js",
  ];
  const revision = spawnSync("git", ["-C", packageRoot, "rev-parse", "HEAD"], {
    encoding: "utf8",
  });
  return {
    version: JSON.parse(read(path.join(packageRoot, "package.json"))).version,
    sourcePath: packageRoot,
    revision: revision.status === 0 ? revision.stdout.trim() : null,
    standardLibrarySha256: treeSha(path.join(packageRoot, "std/assembly")),
    sha256: Object.fromEntries(
      files.map((file) => [
        file,
        sha(fs.readFileSync(path.join(packageRoot, file))),
      ]),
    ),
  };
}
function invoke(bin, argv, { cwd = root, env = {}, log } = {}) {
  const result = spawnSync(bin, argv, {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  const output = (result.stdout ?? "") + (result.stderr ?? "");
  if (log) fs.writeFileSync(log, output);
  if (result.status !== 0 || result.error || output.includes("abort:"))
    throw new Error(`${bin}: ${output}`, { cause: result.error });
  return output.trim();
}
function metadataPath() {
  return path.join(dir, `generated/${key}.json`);
}
function prepare() {
  if (fs.existsSync(metadataPath()))
    throw new Error("Prepared label exists; choose a new label");
  for (const folder of ["generated", "inputs", "oracles", "logs", "results"])
    fs.mkdirSync(path.join(dir, folder), { recursive: true });
  const cases = [],
    inputs = [];
  const selected = option("--cases", "").split(",").filter(Boolean);
  for (const corpus of manifest.corpora)
    for (const layout of corpus.layouts) {
      const name = `${corpus.name}-${layout}`;
      if (selected.length && !selected.includes(name)) continue;
      const payload = path.join(
        root,
        `assembly/__benches__/payloads/${corpus.name}.${layout}.json`,
      );
      const text = read(payload),
        bytes = Buffer.byteLength(text);
      const iterations = Math.max(
        10,
        Math.min(5000, Math.ceil(targetBytes / bytes)),
      );
      for (let i = 0; i < 4; i++) {
        const rotated = rotateText(text, i, true);
        JSON.parse(rotated);
        const file = path.join(dir, `inputs/${name}.${i}.json`);
        fs.writeFileSync(file, rotated);
        inputs.push({
          path: relative(file),
          sha256: sha(rotated),
          bytes: Buffer.byteLength(rotated),
        });
      }
      cases.push({
        key: name,
        iterations,
        bytes,
        payload: relative(payload),
        payloadSha256: sha(text),
      });
    }
  if (
    selected.length &&
    (new Set(selected).size !== cases.length ||
      selected.length !== cases.length)
  )
    throw new Error("Unknown or duplicate diagnostic case");
  const revision = invoke("git", ["rev-parse", "HEAD"], { cwd: sourceRoot });
  const patch = invoke(
    "git",
    ["diff", "--binary", "HEAD", "--", "assembly", "lib", "transform"],
    { cwd: sourceRoot },
  );
  fs.writeFileSync(path.join(dir, `generated/${key}.patch`), patch);
  const additionalSources = [];
  for (const source of invoke(
    "git",
    [
      "ls-files",
      "--others",
      "--exclude-standard",
      "--",
      "assembly",
      "lib",
      "transform",
    ],
    { cwd: sourceRoot },
  )
    .split("\n")
    .filter((file) => file.endsWith(".ts"))) {
    const snapshot = path.join(dir, "generated/untracked", source);
    fs.mkdirSync(path.dirname(snapshot), { recursive: true });
    fs.copyFileSync(path.join(sourceRoot, source), snapshot);
    additionalSources.push({
      source,
      snapshot: relative(snapshot),
      sha256: sha(fs.readFileSync(snapshot)),
    });
  }
  const meta = {
    additionalSources,
    case: key,
    label,
    validationOnly: true,
    validationDiagnostic: selected.length > 0,
    performanceTarget: manifest.performanceTarget,
    inputVariation:
      "Changing values and lengths in four independent source strings",
    sourceRoot,
    revision,
    sourcePatchSha256: sha(patch),
    root: "validation-only",
    schemaSha256: sha(JSON.stringify({ cases, preflight })),
    simdjson: manifest.simdjson,
    ops: targetBytes,
    cases,
    inputs,
    preflight,
    expectedOracle: { preflight: preflight.length, inputs: inputs.length },
    phases: cases.map((c) => `validate/${c.key}`),
    remainingRequiredFamilies: manifest.requiredFamilies.filter(
      (f) => f !== "validation",
    ),
    platform: invoke("uname", ["-a"]),
    manifestSha256: sha(JSON.stringify(manifest)),
    assemblyscript: assemblyscriptProvenance(sourceRoot),
    xjbSha256: sha(
      read(path.join(sourceRoot, "node_modules/xjb-as/assembly/xjb.ts")),
    ),
  };
  emit(meta);
  fs.writeFileSync(metadataPath(), JSON.stringify(meta, null, 2) + "\n");
  console.log(
    `Prepared ${cases.length} full-validation layouts at ${sourceRoot}`,
  );
}
function emit(meta) {
  const { cases, sourceRoot, ops: targetBytes } = meta;
  const prefix = path
    .relative(path.join(dir, "generated"), sourceRoot)
    .split(path.sep)
    .join("/");
  for (const mode of ["swar", "simd"]) {
    const code = `import {JSON} from "${prefix}/assembly/index";
import {bench,readFile,writeFile} from "${prefix}/assembly/__benches__/lib/bench";
if(!JSON_STRICT)throw new Error("Strict configuration required");
const inputs=new StaticArray<string>(4);let index=0;let positives=0;let preflightPassed=0;
function validate():void {if(!JSON.validate(unchecked(inputs[index])))throw new Error("Invalid timed fixture");index=(index+1)&3;}
function runCase(name:string,prefix:string,ops:u64):void {
 for(let i=0;i<4;i++) {
  const input=readFile(prefix+"."+i.toString()+".json");
  if(!JSON.validate(input))throw new Error("Invalid setup fixture: "+name);
  unchecked(inputs[i]=input);positives++;
 }
 index=0;bench("validate/"+name,validate,ops);
}
${preflight.map(([input, expected]) => `if(JSON.validate(${JSON.stringify(input)})!=${expected})throw new Error("Preflight differs");preflightPassed++;`).join("\n")}
${cases.map((c) => `runCase(${JSON.stringify(c.key)},${JSON.stringify(relative(path.join(dir, `inputs/${c.key}`)))},${c.iterations});`).join("\n")}
writeFile(${JSON.stringify(relative(path.join(dir, `oracles/as-${mode}-${key}.json`)))},${JSON.stringify('{"preflight":')}+preflightPassed.toString()+${JSON.stringify(',"inputs":')}+positives.toString()+"}");
`;
    fs.writeFileSync(path.join(dir, `generated/${key}-${mode}.ts`), code);
  }
  const cpp = `#include "simdjson.h"
#include <array>
#include <chrono>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <stdexcept>
#include <string>
struct Case {const char* name;size_t ops;};
const Case cases[]={${cases.map((c) => `{${JSON.stringify(c.key)},${c.iterations}}`).join(",")}};
int main(int argc,char**argv){try {
 if(argc!=4||std::stoull(argv[2])!=${targetBytes})throw std::runtime_error("Invalid matrix arguments");
 simdjson::dom::parser parser;simdjson::dom::element document;
 size_t preflightPassed=0,positives=0;
${preflight.map(([text, expected]) => `{simdjson::padded_string input{std::string(${JSON.stringify(text)})};bool valid=parser.parse(input).get(document)==simdjson::SUCCESS;if(valid!=${expected})throw std::runtime_error("Preflight differs");preflightPassed++;}`).join("\n")}
 std::cout<<"IMPLEMENTATION "<<simdjson::get_active_implementation()->name()<<std::endl;
 for(const auto& c:cases){
  std::array<simdjson::padded_string,4> inputs;
  for(size_t i=0;i<4;i++){
   auto error=simdjson::padded_string::load(std::string(argv[1])+"/"+c.name+"."+std::to_string(i)+".json").get(inputs[i]);
   if(error)throw std::runtime_error(simdjson::error_message(error));
   error=parser.parse(inputs[i]).get(document);
   if(error)throw std::runtime_error(std::string(c.name)+": "+simdjson::error_message(error));positives++;
  }
  size_t index=0;
  auto routine=[&]{auto error=parser.parse(inputs[index]).get(document);index=(index+1)&3;if(error)throw std::runtime_error(simdjson::error_message(error));asm volatile("" : : "g"(&document) : "memory");};
  for(size_t i=1;i<c.ops/10;i++)routine();
  const auto start=std::chrono::steady_clock::now();
  for(size_t i=0;i<c.ops;i++)routine();
  const auto stop=std::chrono::steady_clock::now();
  const double ns=std::chrono::duration<double,std::nano>(stop-start).count()/double(c.ops);
  std::cout<<${JSON.stringify('PARITY {"phase":"validate/')}<<c.name<<${JSON.stringify('","ns":')}<<std::fixed<<std::setprecision(2)<<ns<<${JSON.stringify(',"iterations":')}<<c.ops<<"}"<<std::endl;
 }
 std::ofstream output(std::string(argv[3])+".json");output<<${JSON.stringify('{"preflight":')}<<preflightPassed<<${JSON.stringify(',"inputs":')}<<positives<<"}";
 if(!output)throw std::runtime_error("Oracle output failed");
 return 0;
 }catch(const std::exception&e){std::cerr<<e.what()<<std::endl;return 1;}}
`;
  fs.writeFileSync(path.join(dir, `generated/${key}.cpp`), cpp);
}

function build() {
  const meta = JSON.parse(read(metadataPath()));
  if (
    JSON.stringify(assemblyscriptProvenance(meta.sourceRoot)) !==
    JSON.stringify(meta.assemblyscript)
  )
    throw new Error(
      "AssemblyScript compiler/runtime changed since preparation",
    );
  if (
    invoke("git", ["rev-parse", "HEAD"], { cwd: meta.sourceRoot }) !==
    meta.revision
  )
    throw new Error("Source revision changed");
  if (
    sha(
      invoke(
        "git",
        ["diff", "--binary", "HEAD", "--", "assembly", "lib", "transform"],
        { cwd: meta.sourceRoot },
      ),
    ) !== meta.sourcePatchSha256
  )
    throw new Error("Source patch changed");
  for (const source of meta.additionalSources ?? []) {
    if (
      sha(fs.readFileSync(path.join(meta.sourceRoot, source.source))) !==
        source.sha256 ||
      sha(fs.readFileSync(path.join(root, source.snapshot))) !== source.sha256
    )
      throw new Error(`Additional source changed: ${source.source}`);
  }
  const upstream = path.join(base, "upstream");
  if (
    invoke("git", ["-C", upstream, "rev-parse", "HEAD"]) !==
    manifest.simdjson.commit
  )
    throw new Error("Native revision changed");
  const nativeLibrary = JSON.parse(
    read(path.join(base, "native-library.json")),
  );
  if (
    sha(fs.readFileSync(path.join(base, "simdjson.o"))) !==
    nativeLibrary.objectSha256
  )
    throw new Error("Native library object changed");
  const compiler = process.env.PARITY_CXX ?? "/opt/homebrew/bin/g++-16";
  const flags = [
    "-std=c++26",
    "-freflection",
    "-O3",
    "-DNDEBUG",
    "-mcpu=native",
    `-I${upstream}/singleheader`,
  ];
  const commands = [];
  const nativeArgs = [
    ...flags,
    path.join(dir, `generated/${key}.cpp`),
    path.join(base, "simdjson.o"),
    "-o",
    path.join(dir, `${key}-native`),
  ];
  console.log("Build native matrix");
  invoke(compiler, nativeArgs, {
    log: path.join(dir, "logs/native-build.log"),
  });
  commands.push({ bin: compiler, args: nativeArgs });
  for (const mode of ["swar", "simd"]) {
    console.log(`Build AS matrix/${mode}`);
    const temp = path.join(dir, `${key}-${mode}.tmp`),
      binary = path.join(dir, `${key}-${mode}.wasm`);
    const asc = [
      path.join(meta.sourceRoot, "node_modules/assemblyscript/bin/asc.js"),
      path.join(dir, `generated/${key}-${mode}.ts`),
      "--transform",
      "./transform",
      "-o",
      temp,
      "-O3",
      "--noAssert",
      "--uncheckedBehavior",
      "always",
      "--runtime",
      "incremental",
      "--enable",
      "bulk-memory",
      "--exportStart",
      "start",
      "--exportRuntime",
    ];
    if (mode === "simd") asc.push("--enable", "simd");
    invoke("node", asc, {
      cwd: meta.sourceRoot,
      env: {
        JSON_AS_LIBRARY_SOURCE: "assembly/index",
        JSON_MODE: mode.toUpperCase(),
        JSON_STRICT: "true",
        JSON_CACHE: "0",
      },
      log: path.join(dir, `logs/${mode}-build.log`),
    });
    commands.push({ bin: "node", cwd: meta.sourceRoot, args: asc });
    const opt = [
      temp,
      "-o",
      binary,
      "-O4",
      "-tnh",
      "-iit",
      "-ifwl",
      "-s",
      "0",
      "--enable-bulk-memory",
      "--enable-nontrapping-float-to-int",
      "--enable-tail-call",
      "--enable-sign-ext",
      "--enable-mutable-globals",
    ];
    if (mode === "simd") opt.push("--enable-simd");
    invoke("wasm-opt", opt, { log: path.join(dir, `logs/${mode}-opt.log`) });
    commands.push({ bin: "wasm-opt", args: opt });
  }
  meta.nativeLibrary = nativeLibrary;
  meta.buildCommands = commands;
  meta.toolchain = {
    native: invoke(compiler, ["--version"]),
    nativeFlags: flags,
    v8: invoke("v8", ["--version"]),
    assemblyscript: meta.assemblyscript,
    wasmOpt: invoke("wasm-opt", ["--version"]),
  };
  meta.binaries = Object.fromEntries(
    ["native", "swar", "simd"].map((mode) => {
      const data = fs.readFileSync(
        path.join(dir, `${key}-${mode}${mode === "native" ? "" : ".wasm"}`),
      );
      return [mode, { bytes: data.length, sha256: sha(data) }];
    }),
  );
  fs.writeFileSync(metadataPath(), JSON.stringify(meta, null, 2) + "\n");
}
if (command === "prepare") prepare();
else if (command === "build") build();
else throw new Error("Use prepare or build");
