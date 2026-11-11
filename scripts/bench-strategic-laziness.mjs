// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

// Coordinate preparation and measurement through ~/benchmark-lock.py.
// Every measured sample uses a fresh process.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { gzipSync, gunzipSync } from "node:zlib";

const root = path.resolve(import.meta.dirname, "..");
const args = process.argv.slice(2);
const option = (name, fallback) =>
  args.find((arg) => arg.startsWith(name + "="))?.slice(name.length + 1) ??
  fallback;
const base = path.resolve(option("--dir", "build/perf/strategic-api-5ae2306b"));
const manifestFile = path.join(base, "manifest.json");
const variants = ["main", "eager", "ordinary", "lazy", "strategic"];
const profiles = ["summary", "conditional", "full"];
const sha = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const run = (command, argv, options = {}) =>
  execFileSync(command, argv, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
    ...options,
  });
const json = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const write = (file, value) =>
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
const header = fs
  .readFileSync(fileURLToPath(import.meta.url), "utf8")
  .split("\n\n")[0];
const sources = {
  github: "https://api.github.com/repos/AssemblyScript/assemblyscript",
  twitter:
    "assembly/__benches__/payloads/twitter.min.json: statuses[0] (integer-preserving extraction)",
  weather:
    "https://api.open-meteo.com/v1/forecast?latitude=35.68&longitude=139.69&current=temperature_2m,relative_humidity_2m,is_day,precipitation,weather_code,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum&timezone=UTC&forecast_days=7",
};
const reads = {
  github: {
    summary: [
      "id",
      "full_name",
      "stargazers_count",
      "open_issues_count",
      "archived",
      "default_branch",
    ],
    detail: ["description", "homepage", "license", "topics"],
  },
  twitter: {
    summary: ["id_str", "text", "retweet_count", "favorite_count"],
    detail: [
      "user.name",
      "user.screen_name",
      "user.followers_count",
      "entities.user_mentions",
    ],
  },
  weather: {
    summary: [
      "latitude",
      "longitude",
      "timezone",
      "current.temperature_2m",
      "current.wind_speed_10m",
    ],
    detail: [
      "daily.temperature_2m_max",
      "daily.temperature_2m_min",
      "daily.sunrise",
    ],
  },
};
const selectedNames = args.includes("--smoke") ? ["github"] : Object.keys(reads);
const selectedModes = args.includes("--smoke") ? ["SWAR"] : ["SWAR", "SIMD"];

// Null-only fields are represented as nullable strings for this exact capture;
// empty arrays use string elements. No JSON.Raw/dynamic-value field shortcuts.
function infer(value, name, floating) {
  if (value === null) return { kind: "string", nullable: true };
  if (Array.isArray(value))
    return {
      kind: "array",
      item: value.length
        ? value.map((v) => infer(v, name + "Item", floating)).reduce(merge)
        : { kind: "string" },
    };
  if (typeof value === "object")
    return {
      kind: "object",
      name,
      fields: Object.entries(value).map(([key, v]) => ({
        key,
        name: "f_" + key.replace(/[^a-zA-Z0-9_$]/g, "_"),
        type: infer(
          v,
          name + "_" + key.replace(/[^a-zA-Z0-9_$]/g, "_"),
          floating,
        ),
      })),
    };
  if (typeof value === "number")
    return {
      kind:
        !floating.has(name) && Number.isInteger(value) && !Object.is(value, -0)
          ? "integer"
          : "float",
    };
  return { kind: typeof value };
}
function merge(a, b) {
  if (a.kind !== b.kind) {
    assert.ok(
      [a.kind, b.kind].every((kind) => ["integer", "float"].includes(kind)),
      "Unsupported heterogeneous fixture array",
    );
    return { kind: "float" };
  }
  if (a.kind === "array") return { ...a, item: merge(a.item, b.item) };
  if (a.kind === "object") {
    assert.deepEqual(
      a.fields.map((f) => f.key),
      b.fields.map((f) => f.key),
      "Object-array fixtures require consistent fields",
    );
    return {
      ...a,
      fields: a.fields.map((f, i) => ({
        ...f,
        type: merge(f.type, b.fields[i].type),
      })),
    };
  }
  return { ...a, nullable: a.nullable || b.nullable };
}
const type = (t) =>
  ({
    string: "string",
    boolean: "bool",
    integer: "i64",
    float: "f64",
    object: t.name,
    array: `Array<${t.item ? type(t.item) : "string"}>`,
  })[t.kind] + (t.nullable ? " | null" : "");
const tag = (t) =>
  t.kind === "object"
    ? t.name
    : t.kind === "array"
      ? "Array_" + tag(t.item)
      : t.kind + (t.nullable ? "_nullable" : "");
function allTypes(t, out = new Map()) {
  if (out.has(tag(t))) return out;
  out.set(tag(t), t);
  if (t.kind === "object") t.fields.forEach((f) => allTypes(f.type, out));
  if (t.kind === "array") allTypes(t.item, out);
  return out;
}
function pathType(schema, keys) {
  let expr = "value",
    t = schema;
  for (const key of keys.split(".")) {
    const field = t.fields.find((f) => f.key === key);
    assert.ok(field, `Missing fixture field ${keys}`);
    expr += "." + field.name;
    t = field.type;
  }
  return { expr, t };
}
function emit(schema, variant, spec) {
  const types = [...allTypes(schema).values()];
  const decorator =
    variant === "strategic"
      ? '@json({ lazy: "strategic" })'
      : variant === "lazy"
        ? '@json({ lazy: "all" })'
        : "@json";
  const declarations = types
    .filter((t) => t.kind === "object")
    .map(
      (t) =>
        `${decorator}\nclass ${t.name} {\n${t.fields.map((f) => `  @alias(${JSON.stringify(f.key)}) ${f.name}!: ${type(f.type)};`).join("\n")}\n}`,
    )
    .join("\n");
  const walkers = types
    .map((t) => {
      const label = tag(t),
        bare = { ...t, nullable: false };
      let body;
      if (t.nullable) {
        const scalar = t.kind === "string" ? "<u64>value.length" : "0";
        body = `if (value === null) return 0; return ${scalar};`;
      } else if (t.kind === "string") body = "return <u64>value.length;";
      else if (t.kind === "boolean") body = "return value ? 1 : 0;";
      else if (t.kind === "integer") body = "return <u64><u32>value;";
      else if (t.kind === "float")
        body = "return <u64><u32><i64>(value * 1024.0);";
      else if (t.kind === "array")
        body = `let sum: u64 = <u64>value.length; for (let i = 0; i < value.length; i++) sum += walk_${tag(t.item)}(value[i]); return sum;`;
      else
        body = `let sum: u64 = 0; ${t.fields.map((f) => `sum += walk_${tag(f.type)}(value.${f.name});`).join("\n")} return sum;`;
      assert.equal(type(bare).includes("undefined"), false);
      return `function walk_${label}(value: ${type(t)}): u64 { ${body} }`;
    })
    .join("\n");
  const selected = (paths) =>
    paths
      .map((p) => {
        const { expr, t } = pathType(schema, p);
        return `walk_${tag(t)}(${expr})`;
      })
      .join(" + ");
  const rootType = schema.name;
  return `${header}\n\nimport { JSON } from "../../assembly/index";\n${declarations}\n${walkers}
function summaryRead(value: ${rootType}): u64 { return ${selected(spec.summary)}; }
function detailRead(value: ${rootType}): u64 { return ${selected(spec.detail)}; }
export function summary(data: string, count: i32): u64 {
  let sum: u64 = 0; for (let i = 0; i < count; i++) { const value = JSON.parse<${rootType}>(data); sum += summaryRead(value); } return sum;
}
export function conditional(data: string, count: i32): u64 {
  let sum: u64 = 0; for (let i = 0; i < count; i++) { const value = JSON.parse<${rootType}>(data); sum += summaryRead(value);
    if ((i & 1) != 0) if ((i & 2) != 0) if ((i & 4) != 0) sum += detailRead(value);
  } return sum;
}
export function full(data: string, count: i32): u64 {
  let sum: u64 = 0; for (let i = 0; i < count; i++) { const value = JSON.parse<${rootType}>(data); sum += walk_${rootType}(value); } return sum;
}
let sink: u64 = 0;
export function snapshot(data: string): string { const value = JSON.parse<${rootType}>(data); sink = walk_${rootType}(value); return JSON.stringify(value); }
export function stringId(): u32 { return idof<string>(); }
export function fastCapability(): bool { return changetype<${rootType}>(0).__DESERIALIZE_FAST_ENABLED(); }
`;
}

const oraclePython = String.raw`
import json,sys
payload=json.load(open(sys.argv[1])); schema=json.load(open(sys.argv[2])); spec=json.load(open(sys.argv[3]))
def utf16len(s): return len(s.encode('utf-16-le'))//2
def walk(v,t):
 if v is None: return 0
 k=t['kind']
 if k=='object': return sum(walk(v[f['key']],f['type']) for f in t['fields'])
 if k=='array': return len(v)+sum(walk(x,t['item']) for x in v)
 if k=='string': return utf16len(v)
 if k=='boolean': return int(v)
 if k=='integer': return int(v)&0xffffffff
 if k=='float': return int(float(v)*1024)&0xffffffff
 raise Exception(k)
def selected(paths):
 total=0
 for p in paths:
  v=payload;t=schema
  for key in p.split('.'):
   t=next(f['type'] for f in t['fields'] if f['key']==key);v=v[key]
  total+=walk(v,t)
 return str(total)
print(json.dumps({'summary':selected(spec['summary']),'detail':selected(spec['detail']),'full':str(walk(payload,schema))}))
`;
function expected(entry, profile, count) {
  const b = BigInt(
    profile === "full" ? entry.oracle.full : entry.oracle.summary,
  );
  return BigInt.asUintN(
    64,
    b * BigInt(count) +
      (profile === "conditional"
        ? BigInt(entry.oracle.detail) * BigInt(Math.floor(count / 8))
        : 0n),
  );
}

async function instance(entry, allocation = false) {
  let g,
    memory,
    events = 0,
    allocated = 0;
  const decode = (p) =>
    Buffer.from(
      memory.buffer,
      p,
      new DataView(memory.buffer).getUint32(p - 4, true) & 0x7fffffff,
    ).toString("utf16le");
  const rtrace = {
    oninit() {},
    onalloc(block) {
      events++;
      allocated +=
        (new DataView(memory.buffer).getUint32(block, true) & ~3) + 4;
    },
    onresize(block, old) {
      allocated += Math.max(
        0,
        (new DataView(memory.buffer).getUint32(block, true) & ~3) + 4 - old,
      );
    },
    onload: (p) => p,
    onstore: (p) => p,
    onmove() {},
    onfree() {},
    onvisit: () => 1,
    oncollect() {},
    oninterrupt() {},
    onyield() {},
  };
  g = (
    await WebAssembly.instantiate(
      fs.readFileSync(allocation ? entry.allocationBinary : entry.binary),
      {
        env: {
          abort(m, f, line, column) {
            throw Error(`${decode(m)} (${decode(f)}:${line}:${column})`);
          },
        },
        rtrace,
      },
    )
  ).instance.exports;
  memory = g.memory;
  g.start();
  const text = fs.readFileSync(entry.input, "utf8");
  const input = g.__pin(g.__new(text.length * 2, g.stringId()));
  const view = new Uint16Array(memory.buffer, input, text.length);
  for (let i = 0; i < text.length; i++) view[i] = text.charCodeAt(i);
  return {
    g,
    input,
    decode,
    reset() {
      events = allocated = 0;
    },
    counts: () => ({ objects: events, blockBytes: allocated }),
  };
}
function sealFiles(repo) {
  const files = run(
    "git",
    [
      "ls-files",
      "-z",
      "assembly",
      "lib",
      "transform/src",
      "transform/lib",
      "asconfig.json",
      "package.json",
    ],
    { cwd: repo },
  )
    .split("\0")
    .filter(
      (f) =>
        f &&
        !f.includes("__tests__") &&
        !f.includes("__benches__") &&
        !f.includes("__fuzz__"),
    );
  return files.map((f) => ({
    file: path.join(repo, f),
    sha256: sha(path.join(repo, f)),
  }));
}

if (args.includes("--fetch")) {
  fs.mkdirSync(path.join(base, "payloads"), { recursive: true });
  for (const name of ["github", "weather"])
    run("curl", [
      "--fail",
      "--silent",
      "--show-error",
      "--max-time",
      "30",
      sources[name],
      "-o",
      path.join(base, "payloads", name + ".json"),
    ]);
  run("python3", [
    "-c",
    "import json,sys; data=json.load(open(sys.argv[1])); open(sys.argv[2],'w').write(json.dumps(data['statuses'][0],ensure_ascii=False,separators=(',',':')))",
    path.join(root, "assembly/__benches__/payloads/twitter.min.json"),
    path.join(base, "payloads/twitter.json"),
  ]);
} else if (args.includes("--prepare")) {
  fs.mkdirSync(base, { recursive: true });
  if (option("--capture", "")) {
    const recorded = JSON.parse(
      gunzipSync(fs.readFileSync(option("--capture", ""))),
    );
    fs.mkdirSync(path.join(base, "payloads"), { recursive: true });
    for (const [name, text] of Object.entries(recorded.payloads))
      fs.writeFileSync(path.join(base, "payloads", name + ".json"), text);
  }
  const baseline = path.resolve(option("--main", path.join(base, "main")));
  const entries = [];
  for (const name of selectedNames) {
    const input = path.join(base, "payloads", name + ".json");
    const floating = new Set(
      JSON.parse(
        run("python3", [
          "-c",
          String.raw`
import json,re,sys
out=set()
def scan(value,name):
 if isinstance(value,float): out.add(name)
 elif isinstance(value,list):
  for item in value: scan(item,name+'Item')
 elif isinstance(value,dict):
  for key,item in value.items(): scan(item,name+'_'+re.sub(r'[^a-zA-Z0-9_$]','_',key))
scan(json.load(open(sys.argv[1])),sys.argv[2]);print(json.dumps(sorted(out)))
`,
          input,
          "Api_" + name,
        ]),
      ),
    );
    const schema = infer(json(input), "Api_" + name, floating);
    const schemaFile = path.join(base, `${name}.schema.json`),
      specFile = path.join(base, `${name}.reads.json`);
    write(schemaFile, schema);
    write(specFile, reads[name]);
    const oracle = JSON.parse(
      run("python3", ["-c", oraclePython, input, schemaFile, specFile]),
    );
    for (const mode of selectedModes)
      for (const variant of variants) {
        const repo = variant === "main" ? baseline : root;
        const folder = path.join(repo, "build/strategic-api-bench");
        fs.mkdirSync(folder, { recursive: true });
        const source = path.join(folder, `${name}.${variant}.${mode}.ts`);
        fs.writeFileSync(source, emit(schema, variant, reads[name]));
        const prefix = path.join(base, `${name}.${variant}.${mode}`);
        const flags = [
          "--transform",
          "./transform",
          "-O3",
          "--noAssert",
          "--uncheckedBehavior",
          "always",
          "--runtime",
          "incremental",
          "--enable",
          "bulk-memory",
          "--exportRuntime",
          "--exportStart",
          "start",
          ...(mode === "SIMD" ? ["--enable", "simd"] : []),
        ];
        const env = {
          ...process.env,
          JSON_MODE: mode,
          JSON_STRICT: "false",
          JSON_USE_FAST_PATH: "1",
          JSON_DIAGNOSTICS: "true",
          JSON_CACHE: "0",
          JSON_STRATEGIC_LAZINESS: "",
          JSON_ACCESS_SPECIALIZATION: variant === "eager" ? "false" : "true",
          JSON_AS_LIBRARY_SOURCE: "assembly/index",
        };
        const entry = {
          name,
          mode,
          variant,
          repo,
          source,
          input,
          bytes: fs.statSync(input).size,
          oracle,
          binary: prefix + ".wasm",
          allocationBinary: prefix + ".alloc.wasm",
          flags,
        };
        console.log(`Preparing ${name}/${mode}/${variant}`);
        const debug = run(
          process.execPath,
          [
            path.join(root, "node_modules/assemblyscript/bin/asc.js"),
            path.relative(repo, source),
            ...flags,
            "-o",
            entry.binary,
          ],
          { cwd: repo, env: { ...env, JSON_DEBUG: "1" } },
        );
        fs.writeFileSync(
          prefix + ".decisions.log",
          debug
            .split("\n")
            .filter((line) => line.startsWith("[strategic]"))
            .join("\n") + "\n",
        );
        run(
          process.execPath,
          [
            path.join(root, "node_modules/assemblyscript/bin/asc.js"),
            path.relative(repo, source),
            ...flags,
            "--use",
            "ASC_RTRACE=1",
            "-o",
            entry.allocationBinary,
          ],
          { cwd: repo, env },
        );
        const plain = await instance(entry);
        entry.fastCapability = !!plain.g.fastCapability();
        for (const profile of profiles)
          assert.equal(
            BigInt.asUintN(64, plain.g[profile](plain.input, 16)),
            expected(entry, profile, 16),
            `${name}/${mode}/${variant}/${profile}`,
          );
        const snapshot = plain.decode(plain.g.snapshot(plain.input));
        run(
          "python3",
          [
            "-c",
            "import json,sys; assert json.load(open(sys.argv[1])) == json.loads(sys.stdin.read())",
            input,
          ],
          { input: snapshot },
        );
        plain.g.__unpin(plain.input);
        const counted = await instance(entry, true);
        entry.allocations = {};
        for (const profile of profiles) {
          counted.g.__collect();
          counted.reset();
          const count = 32;
          assert.equal(
            BigInt.asUintN(64, counted.g[profile](counted.input, count)),
            expected(entry, profile, count),
          );
          const result = counted.counts();
          entry.allocations[profile] = {
            objects: result.objects / count,
            blockBytes: result.blockBytes / count,
          };
        }
        counted.g.__unpin(counted.input);
        entry.seals = [input, source, entry.binary, entry.allocationBinary].map(
          (file) => ({ file, sha256: sha(file) }),
        );
        entries.push(entry);
      }
  }
  const candidatePatch = run("git", ["diff", "--binary", "HEAD"]);
  if (candidatePatch) fs.writeFileSync(path.join(base, "tracked-source.patch"), candidatePatch);
  write(manifestFile, {
    created: new Date().toISOString(),
    candidate: run("git", ["rev-parse", "HEAD"]).trim(),
    candidateDirty: !!candidatePatch,
    main: run("git", ["rev-parse", "HEAD"], { cwd: baseline }).trim(),
    sources,
    entries,
    compiler: json(path.join(root, "node_modules/assemblyscript/package.json"))
      .version,
    seals: [
      ...sealFiles(root),
      ...sealFiles(baseline),
      {
        file: fileURLToPath(import.meta.url),
        sha256: sha(fileURLToPath(import.meta.url)),
      },
    ],
  });
  console.log(
    `Prepared ${entries.length} native and allocation binaries; exact snapshots and checksums verified.`,
  );
} else if (args.includes("--child")) {
  const manifest = json(manifestFile),
    entry = manifest.entries[Number(option("--entry", "0"))];
  const profile = option("--profile", "summary");
  const { g, input } = await instance(entry);
  let count = 16,
    nsPerOp;
  const warmStart = performance.now();
  do {
    const start = process.hrtime.bigint();
    const checksum = g[profile](input, count);
    const elapsed = Number(process.hrtime.bigint() - start);
    assert.equal(BigInt.asUintN(64, checksum), expected(entry, profile, count));
    nsPerOp = elapsed / count;
    count = Math.max(8, Math.min(1 << 19, Math.ceil(15e6 / nsPerOp / 8) * 8));
  } while (performance.now() - warmStart < 100);
  g.__collect();
  count = Math.max(8, Math.min(1 << 20, Math.ceil(80e6 / nsPerOp / 8) * 8));
  const samples = [];
  for (let trial = 0; trial < 3; trial++) {
    const start = process.hrtime.bigint();
    const checksum = g[profile](input, count);
    const ns = Number(process.hrtime.bigint() - start);
    assert.equal(BigInt.asUintN(64, checksum), expected(entry, profile, count));
    samples.push({
      iterations: count,
      ns,
      nsPerOp: ns / count,
      checksum: BigInt.asUintN(64, checksum).toString(),
    });
  }
  g.__unpin(input);
  const nsPerRecord = samples.map((s) => s.nsPerOp).sort((a, b) => a - b)[1];
  console.log(
    JSON.stringify({
      name: entry.name,
      mode: entry.mode,
      variant: entry.variant,
      profile,
      nsPerRecord,
      gbps: entry.bytes / nsPerRecord,
      samples,
      node: process.version,
      v8: process.versions.v8,
    }),
  );
} else if (args.includes("--measure")) {
  const manifest = json(manifestFile);
  for (const seal of [
    ...manifest.seals,
    ...manifest.entries.flatMap((e) => e.seals),
  ])
    assert.equal(
      sha(seal.file),
      seal.sha256,
      `Changed sealed input ${seal.file}`,
    );
  const capture = () => ({
    at: new Date().toISOString(),
    load: os.loadavg(),
    power: run("pmset", ["-g", "batt"]),
    powerSettings: run("pmset", ["-g", "custom"]),
    processes: run("ps", ["-axo", "pid,pcpu,pmem,comm"])
      .split("\n")
      .filter((line, i) => i === 0 || Number(line.trim().split(/\s+/)[1]) >= 5)
      .join("\n"),
  });
  const raw = [],
    audits = [capture()];
  const pairs = Number(option("--pairs", "8"));
  for (const mode of selectedModes)
    for (const name of selectedNames)
      for (const profile of profiles) {
        for (let pair = 0; pair < pairs; pair++) {
          const order =
            pair % 2
              ? ["strategic", "ordinary", "main", "eager", "lazy"]
              : ["lazy", "eager", "main", "ordinary", "strategic"];
          for (const variant of order) {
            const entry = manifest.entries.findIndex(
              (e) =>
                e.mode === mode && e.name === name && e.variant === variant,
            );
            const sample = JSON.parse(
              run(process.execPath, [
                fileURLToPath(import.meta.url),
                "--child",
                `--dir=${base}`,
                `--entry=${entry}`,
                `--profile=${profile}`,
              ]),
            );
            raw.push({ ...sample, pair, processOrder: order.indexOf(variant) });
            write(path.join(base, "samples.json"), raw);
          }
        }
        audits.push(capture());
        write(path.join(base, "host-audits.json"), audits);
        console.log(
          `Measured ${mode}/${name}/${profile}: ${pairs} fresh-process groups`,
        );
      }
  write(path.join(base, "environment.json"), {
    host: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    cpu: os.cpus()[0].model,
    node: process.version,
    v8: process.versions.v8,
    manifestSha256: sha(manifestFile),
    pairs,
    audits,
  });
} else if (args.includes("--report")) {
  const manifest = json(manifestFile),
    samples = json(path.join(base, "samples.json"));
  const environment = json(path.join(base, "environment.json"));
  const geo = (values) =>
    Math.exp(
      values.reduce((sum, value) => sum + Math.log(value), 0) / values.length,
    );
  let seed = 0x5ae2306b;
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return (seed >>> 0) / 4294967296;
  };
  const interval = (values) => {
    const boot = Array.from({ length: 10000 }, () =>
      geo(values.map(() => values[Math.floor(random() * values.length)])),
    ).sort((a, b) => a - b);
    return [boot[250], boot[9750]];
  };
  const rows = [];
  for (const mode of selectedModes)
    for (const name of selectedNames)
      for (const profile of profiles) {
        const groups = Object.fromEntries(
          variants.map((variant) => [
            variant,
            samples
              .filter(
                (s) =>
                  s.mode === mode &&
                  s.name === name &&
                  s.profile === profile &&
                  s.variant === variant,
              )
              .sort((a, b) => a.pair - b.pair),
          ]),
        );
        for (const values of Object.values(groups))
          assert.equal(values.length, environment.pairs);
        const row = {
          mode,
          name,
          profile,
          bytes: manifest.entries.find((e) => e.name === name).bytes,
          variants: {},
        };
        for (const variant of variants) {
          const times = groups[variant].map((s) => s.nsPerRecord);
          const ratios = times.map(
            (time, i) => groups.main[i].nsPerRecord / time,
          );
          const sameBranchRatios = times.map(
            (time, i) => groups.eager[i].nsPerRecord / time,
          );
          const entry = manifest.entries.find(
            (e) => e.name === name && e.mode === mode && e.variant === variant,
          );
          const ns = geo(times);
          row.variants[variant] = {
            us: ns / 1000,
            gbps: row.bytes / ns,
            speedupVsMain: geo(ratios),
            speedupVsMain95CI: interval(ratios),
            speedupVsBranchEager: geo(sameBranchRatios),
            speedupVsBranchEager95CI: interval(sameBranchRatios),
            allocations: entry.allocations[profile],
            fastCapability: entry.fastCapability,
          };
        }
        rows.push(row);
      }
  write(path.join(base, "summary.json"), rows);
  const dirty = manifest.candidateDirty ?? fs.existsSync(path.join(base, "tracked-source.patch"));
  const power = [...new Set(environment.audits.map((audit) =>
    audit.power.includes("AC Power") ? "AC power" : audit.power.includes("Battery Power") ? "battery" : "unknown power",
  ))].join(" and ");
  const lines = [
    "# Strategic laziness: captured API reads",
    "",
    `Measured production sources: main \`${manifest.main.slice(0, 8)}\`; strategic branch \`${manifest.candidate.slice(0, 8)}\`${dirty ? " with uncommitted changes (see sealed sources and captured patch)" : ""}.`,
    "",
    `${environment.cpu}, ${environment.arch}, Node ${environment.node}, v8 ${environment.v8}, AssemblyScript ${manifest.compiler}. Incremental runtime, -O3, compatibility mode (strict off), fast path on, diagnostics on.`,
    "",
    `${environment.pairs} paired fresh-process groups per row and backend. Each process warms for at least 100 ms, then measures three batches; its median feeds the paired geometric means below. All raw batches are retained. GB/s uses captured UTF-8 payload bytes; input is already a pinned UTF-16 string. Timing includes JSON.parse plus the listed field reads, allocation and normal automatic collection. It excludes network, UTF-8 decoding, module startup and serialization.`,
    "",
    `The host used ${power} with background activity. These are shared-host measurements, not an isolated qualification. Full power/process audits are included in the capture.`,
    "",
    "## Inputs and reads",
    "",
  ];
  for (const name of selectedNames) {
    const spec = reads[name];
    const entry = manifest.entries.find((e) => e.name === name);
    lines.push(
      `- **${name}**, ${entry.bytes.toLocaleString("en-US")} bytes. Summary: ${spec.summary.join(", ")}. Conditional: the same summary plus ${spec.detail.join(", ")} on 1/8 of records. Full: every modeled field and array element.`,
      `  Source: ${sources[name]}`,
    );
  }
  lines.push(
    "",
    "Models cover every field in each fixed capture. Integer tokens use i64; decimal/exponent tokens and mixed numeric arrays use f64. Null-only fields are nullable strings and empty arrays use string elements for this capture. Neither JSON.Raw nor dynamic-object shortcuts are used. Exact full snapshots and independent integer-preserving Python checksums passed before timing.",
    "",
  );
  for (const mode of selectedModes) {
    lines.push(
      `## ${mode}`,
      "",
      "| API / read | Branch eager GB/s | Ordinary default GB/s | Default vs eager | 95% speedup interval | Ordinary lazy GB/s | Explicit strategic GB/s | Allocated bytes/op, eager → default |",
      "|---|---:|---:|---:|---:|---:|---:|---:|",
    );
    for (const row of rows.filter((r) => r.mode === mode)) {
      const v = row.variants,
        s = v.ordinary;
      lines.push(
        `| ${row.name} / ${row.profile} | ${v.eager.gbps.toFixed(3)} | ${s.gbps.toFixed(3)} | ${s.speedupVsBranchEager.toFixed(2)}× (${((s.speedupVsBranchEager - 1) * 100).toFixed(1)}%) | ${s.speedupVsBranchEager95CI.map((x) => x.toFixed(2) + "×").join("–")} | ${v.lazy.gbps.toFixed(3)} | ${v.strategic.gbps.toFixed(3)} | ${v.eager.allocations.blockBytes.toFixed(0)} → ${s.allocations.blockBytes.toFixed(0)} |`,
      );
    }
    lines.push("");
  }
  lines.push(
    "Allocations are a separate ASC_RTRACE=1 run, averaged over 32 operations; values include managed allocator block overhead/rounding. They are not RSS or throughput from the instrumented build. Branch eager disables access specialization; ordinary default enables it. The ordinary-lazy control uses lazy: all on the same branch.",
    "",
    "Conditional weights are syntactic estimates, not profiles. The full-read control intentionally includes the cost of materializing everything. Effectful reference selections use the non-speculative reader.",
    "",
    "95% intervals are paired bootstrap intervals (10,000 deterministic resamples), conditional on this host/run. They do not remove systematic effects from power policy or concurrent load.",
    "",
  );
  fs.writeFileSync(path.join(base, "report.md"), lines.join("\n"));
  const capture = {
    manifest,
    environment,
    samples,
    rows,
    payloads: Object.fromEntries(
      Object.keys(reads).map((name) => [
        name,
        fs.readFileSync(path.join(base, "payloads", name + ".json"), "utf8"),
      ]),
    ),
    decisions: Object.fromEntries(
      manifest.entries
        .filter((e) => e.variant === "strategic")
        .map((e) => [
          `${e.name}/${e.mode}`,
          fs.readFileSync(
            e.binary.replace(/\.wasm$/, ".decisions.log"),
            "utf8",
          ),
        ]),
    ),
  };
  fs.writeFileSync(
    path.join(base, "capture.json.gz"),
    gzipSync(JSON.stringify(capture), { level: 9 }),
  );
  console.log(lines.join("\n"));
} else {
  throw Error(
    "Use --fetch, --prepare, --measure (under the timing lock), --report, or --child",
  );
}
