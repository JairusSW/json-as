import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceFlavor = process.env.WAGO_CLASSIC_SOURCE_FLAVOR ?? "eager";
if (!["eager", "lazy", "obj"].includes(sourceFlavor)) {
  throw new Error(
    `WAGO_CLASSIC_SOURCE_FLAVOR must be eager, lazy, or obj; got ${sourceFlavor}`,
  );
}
const sourceTag = sourceFlavor === "eager" ? "" : `.${sourceFlavor}`;
const output = path.join(
  root,
  "build",
  sourceFlavor === "eager" ? "wago-classic" : `wago-classic-${sourceFlavor}`,
);
const wideDir = process.env.WIDE_DIR ?? path.resolve(root, "..", "wide");
const datasets = [
  "twitter",
  "canada",
  "citm_catalog",
  "poet",
  "github_events",
  "gsoc-2018",
  "lottie",
  "otfcc",
  "fgo",
];
const variants = [
  { label: "swar", mode: "SWAR", width: 128, plugin: false },
  { label: "v128", mode: "SIMD", width: 128, plugin: false },
  { label: "v256", mode: "SIMD", width: 256, plugin: true },
  { label: "v512", mode: "SIMD", width: 512, plugin: true },
];
const datasetFilter = new Set(
  (process.env.WAGO_CLASSIC_FILTER ?? "").split(",").filter(Boolean),
);

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? root,
    env: options.env ?? process.env,
    encoding: options.encoding,
    stdio: options.stdio ?? "inherit",
  });
}

mkdirSync(output, { recursive: true });
if (process.env.WAGO_CLASSIC_RUN_ONLY !== "1")
  for (const dataset of datasets) {
    if (datasetFilter.size !== 0 && !datasetFilter.has(dataset)) continue;
    const canonicalSource = path.join(
      root,
      "assembly",
      "__benches__",
      "classic",
      `${dataset}${sourceTag}.bench.ts`,
    );
    let source = canonicalSource;
    // The classic chart compares fresh minified deserialize and serialize.
    // Reuse has its own series and, on GitHub Events, currently exposes an
    // unrelated SIMD parse-into bounds trap, so omit those cases by default.
    if (process.env.WAGO_CLASSIC_INCLUDE_REUSE !== "1") {
      source = path.join(
        root,
        "assembly",
        "__benches__",
        "classic",
        `${dataset}${sourceTag}.wago.bench.ts`,
      );
      const withoutReuse = readFileSync(canonicalSource, "utf8").replace(
        /\nbench\(\n {2}"Deserialize[^"]*\(min, reuse\)",[\s\S]*?\n\);\ndumpToFile\([^\n]*-reuse[^\n]*\);\n/g,
        "\n",
      );
      writeFileSync(source, withoutReuse);
    }
    for (const variant of variants) {
      const wasm = path.join(output, `${dataset}.${variant.label}.wasm`);
      const args = [
        source,
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
        "--exportStart",
        "start",
        "--exportRuntime",
        "-o",
        wasm,
      ];
      if (variant.mode === "SIMD") args.push("--enable", "simd");
      if (variant.plugin) args.splice(3, 0, "--transform", "as-simd");
      run(path.join(root, "node_modules", ".bin", "asc"), args, {
        env: {
          ...process.env,
          JSON_CACHE: "0",
          JSON_MODE: variant.mode,
          JSON_SIMD_WIDTH: String(variant.width),
          WAGO_PLUGINS: variant.plugin ? "wide" : "",
        },
      });
      process.stderr.write(`built ${dataset} ${variant.label}\n`);
    }
    if (source !== canonicalSource) rmSync(source);
  }

const temporaryModule = mkdtempSync(
  path.join(os.tmpdir(), "json-as-wago-classic-"),
);
writeFileSync(
  path.join(temporaryModule, "go.mod"),
  "module json-as-wago-classic\n\ngo 1.22\n",
);
writeFileSync(
  path.join(temporaryModule, "main.go"),
  `package main

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
	"unicode/utf16"

	wide "github.com/JairusSW/wide"
	wago "github.com/wago-org/wago"
)

type benchResult struct {
	GBPS float64 \`json:"gbps"\`
}

func liftString(memory []byte, ptr uint32) string {
	if ptr == 0 || ptr < 4 || int(ptr) > len(memory) {
		return ""
	}
	size := binary.LittleEndian.Uint32(memory[ptr-4:])
	end := uint64(ptr) + uint64(size)
	if end > uint64(len(memory)) {
		panic("guest string is out of bounds")
	}
	runes := make([]uint16, size/2)
	for i := range runes {
		runes[i] = binary.LittleEndian.Uint16(memory[int(ptr)+i*2:])
	}
	return string(utf16.Decode(runes))
}

func main() {
	if len(os.Args) != 3 {
		panic("usage: runner <wasm-dir> <repo-root>")
	}
	wasmDir, root := os.Args[1], os.Args[2]
	entries, err := filepath.Glob(filepath.Join(wasmDir, "*.wasm"))
	if err != nil {
		panic(err)
	}
	sort.Strings(entries)
	filter := map[string]bool{}
	for _, name := range strings.Split(os.Getenv("WAGO_CLASSIC_FILTER"), ",") {
		if name != "" {
			filter[name] = true
		}
	}
	fmt.Println("dataset\\tmode\\tdeserialize_gbps\\tdeserialize_reuse_gbps\\tserialize_gbps")
	for _, wasmPath := range entries {
		base := strings.TrimSuffix(filepath.Base(wasmPath), ".wasm")
		split := strings.LastIndexByte(base, '.')
		if split < 0 {
			panic("invalid module name " + base)
		}
		dataset, mode := base[:split], base[split+1:]
		if len(filter) != 0 && !filter[dataset] {
			continue
		}
		code, err := os.ReadFile(wasmPath)
		if err != nil {
			panic(err)
		}
		rt := wago.NewRuntime()
		if err := rt.Use(wide.New()); err != nil {
			panic(err)
		}
		module, err := rt.Compile(code)
		if err != nil {
			panic(fmt.Errorf("compile %s: %w", base, err))
		}

		payloadPointers := map[string]uint32{}
		captured := map[string]string{}
		started := time.Now()
		imports := wago.Imports{
			"env.abort": wago.HostFunc(func(m wago.HostModule, p, _ []uint64) {
				panic(fmt.Sprintf("abort: %s:%d", liftString(m.Memory(), uint32(p[1])), uint32(p[2])))
			}),
			"env.console.log": wago.HostFunc(func(m wago.HostModule, p, _ []uint64) {
				if os.Getenv("WAGO_CLASSIC_VERBOSE") == "1" {
					fmt.Fprintln(os.Stderr, base+": "+liftString(m.Memory(), uint32(p[0])))
				}
			}),
			"env.Date.now": wago.HostFunc(func(_ wago.HostModule, _, r []uint64) {
				r[0] = math.Float64bits(float64(time.Now().UnixMilli()))
			}),
			"env.performance.now": wago.HostFunc(func(_ wago.HostModule, _, r []uint64) {
				r[0] = math.Float64bits(float64(time.Since(started).Nanoseconds()) / 1e6)
			}),
			"env.readFile": wago.HostFunc(func(m wago.HostModule, p, r []uint64) {
				name := liftString(m.Memory(), uint32(p[0]))
				ptr, ok := payloadPointers[name]
				if !ok {
					panic("unprepared payload " + name)
				}
				r[0] = wago.I32(int32(ptr))
			}),
			"env.writeFile": wago.HostFunc(func(m wago.HostModule, p, _ []uint64) {
				captured[liftString(m.Memory(), uint32(p[0]))] =
					liftString(m.Memory(), uint32(p[1]))
			}),
		}
		instance, err := rt.Instantiate(
			context.Background(),
			module,
			wago.WithImports(imports),
		)
		if err != nil {
			panic(fmt.Errorf("instantiate %s: %w", base, err))
		}

		for _, flavor := range []string{"pretty", "min"} {
			rel := "./assembly/__benches__/payloads/" + dataset + "." + flavor + ".json"
			data, err := os.ReadFile(filepath.Join(root, rel))
			if os.IsNotExist(err) {
				continue
			}
			if err != nil {
				panic(err)
			}
			out, err := instance.Invoke("__new", wago.I32(int32(len(data))), wago.I32(1))
			if err != nil {
				panic(fmt.Errorf("allocate %s: %w", rel, err))
			}
			ptr := uint32(wago.AsI32(out[0]))
			copy(instance.Memory().Bytes()[int(ptr):int(ptr)+len(data)], data)
			payloadPointers[rel] = ptr
		}
		if _, err := instance.Invoke("start"); err != nil {
			fmt.Printf("%s\\t%s\\tTRAP\\tTRAP\\t%s\\n", dataset, mode, err)
			instance.Close()
			rt.Close()
			continue
		}
		readRate := func(kind string) float64 {
			flavor := os.Getenv("WAGO_CLASSIC_SOURCE_FLAVOR")
			if flavor == "" || flavor == "eager" {
				flavor = ""
			} else {
				flavor = "-" + flavor
			}
			suffix := dataset + flavor + "-min." + kind + ".as.json"
			for name, raw := range captured {
				if strings.HasSuffix(name, suffix) {
					var result benchResult
					if err := json.Unmarshal([]byte(raw), &result); err != nil {
						panic(err)
					}
					return result.GBPS
				}
			}
			panic("missing result " + suffix)
		}
		readOptionalRate := func(suffix string) string {
			for name, raw := range captured {
				if strings.HasSuffix(name, suffix) {
					var result benchResult
					if err := json.Unmarshal([]byte(raw), &result); err != nil {
						panic(err)
					}
					return fmt.Sprintf("%.6f", result.GBPS)
				}
			}
			return "-"
		}
		reuseSuffix := dataset + "-min-reuse.deserialize.as.json"
		fmt.Printf("%s\\t%s\\t%.6f\\t%s\\t%.6f\\n", dataset, mode, readRate("deserialize"), readOptionalRate(reuseSuffix), readRate("serialize"))
		instance.Close()
		rt.Close()
	}
}
`,
);

try {
  run(
    "go",
    [
      "mod",
      "edit",
      "-require=github.com/JairusSW/wide@v0.0.0",
      `-replace=github.com/JairusSW/wide=${wideDir}`,
    ],
    { cwd: temporaryModule },
  );
  run("go", ["get", "github.com/wago-org/wago@latest"], {
    cwd: temporaryModule,
  });
  run("go", ["mod", "tidy"], { cwd: temporaryModule });
  run("go", ["run", ".", output, root], { cwd: temporaryModule });
} finally {
  rmSync(temporaryModule, { recursive: true, force: true });
}
