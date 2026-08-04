import assert from "node:assert/strict";
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
const output = path.join(root, "build", "wago-wide");
const fixture = "assembly/__tests__/wago-wide.fixture.ts";
const goEnv = {
  ...process.env,
  GONOSUMDB: [process.env.GONOSUMDB, "github.com/JairusSW/wide"]
    .filter(Boolean)
    .join(","),
};

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? root,
    env: options.env ?? (command === "go" ? goEnv : process.env),
    encoding: options.encoding,
    stdio: options.stdio ?? "inherit",
  });
}

mkdirSync(output, { recursive: true });
for (const width of [128, 256, 512]) {
  const wasm = path.join(output, `json-v${width}.wasm`);
  run(
    path.join(root, "node_modules", ".bin", "asc"),
    [
      fixture,
      "--transform",
      "./transform",
      "--transform",
      "as-simd",
      "--runtime",
      "stub",
      "-O3",
      "--enable",
      "simd",
      "-o",
      wasm,
    ],
    {
      env: {
        ...process.env,
        JSON_MODE: "SIMD",
        JSON_SIMD_WIDTH: String(width),
        WAGO_PLUGINS: "wide",
      },
    },
  );

  const imports = WebAssembly.Module.imports(
    new WebAssembly.Module(readFileSync(wasm)),
  );
  if (width > 128) {
    assert(
      imports.some(
        ({ module, name }) =>
          module === "as-simd" &&
          (name === `v${width}.load` ||
            (width === 512 && name === "json.escape_copy_utf16_bulk.v512")),
      ),
      `v${width} build did not emit a native Wide operation`,
    );
    assert(
      imports.some(
        ({ module, name }) =>
          module === "as-simd" &&
          (name === `i16x${width / 16}.eq` ||
            (width === 512 && name === "i16x16.eq")),
      ),
      `v${width} build did not emit a native-width comparison`,
    );
    assert(
      imports.some(
        ({ module, name }) =>
          module === "as-simd" &&
          name ===
            (width === 512
              ? "json.escape_copy_utf16_64.v512"
              : "json.escape_copy_utf16_64"),
      ),
      `v${width} build did not emit the fused UTF-16 JSON copy/classifier`,
    );
    if (width === 512) {
      assert(
        imports.some(
          ({ module, name }) =>
            module === "as-simd" && name === "json.escape_copy_utf16_256.v512",
        ),
        "v512 build did not emit the four-ZMM UTF-16 JSON copy/classifier",
      );
      assert(
        imports.some(
          ({ module, name }) =>
            module === "as-simd" && name === "json.escape_copy_utf16_bulk.v512",
        ),
        "v512 build did not emit the bulk UTF-16 JSON copy/classifier",
      );
    }
  }
}

const temporaryModule = mkdtempSync(
  path.join(os.tmpdir(), "json-as-wago-wide-"),
);
writeFileSync(
  path.join(temporaryModule, "go.mod"),
  "module json-as-wago-wide-integration\n\ngo 1.22\n",
);
writeFileSync(
  path.join(temporaryModule, "main.go"),
  `package main

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	wide "github.com/JairusSW/wide"
	wago "github.com/wago-org/wago"
)

func main() {
	serializeRates := map[string]float64{}
	for _, wasmPath := range os.Args[1:] {
		wasm, err := os.ReadFile(wasmPath)
		if err != nil {
			panic(err)
		}
		runtime := wago.NewRuntime()
		if err := runtime.Use(wide.New()); err != nil {
			panic(fmt.Errorf("register Wide: %w", err))
		}
		module, err := runtime.Compile(wasm)
		if err != nil {
			panic(fmt.Errorf("compile %s: %w", wasmPath, err))
		}
		if !module.Compiled().RequiresAVX2() {
			panic(fmt.Errorf("%s did not select native wide lowering", wasmPath))
		}
		if strings.Contains(wasmPath, "v512") && !module.Compiled().RequiresAVX512() {
			panic(fmt.Errorf("%s did not select AVX-512 JSON lowering", wasmPath))
		}
		abort := wago.HostFunc(func(_ wago.HostModule, _, _ []uint64) {
			panic("AssemblyScript abort")
		})
		instance, err := runtime.Instantiate(
			context.Background(),
			module,
			wago.WithImports(wago.Imports{"env.abort": abort}),
		)
		if err != nil {
			panic(fmt.Errorf("instantiate %s: %w", wasmPath, err))
		}
		result, err := instance.Invoke("verify")
		if err != nil {
			panic(fmt.Errorf("verify %s: %w", wasmPath, err))
		}
		if len(result) != 1 || wago.AsI32(result[0]) != 0 {
			panic(fmt.Errorf("verify %s returned %v", wasmPath, result))
		}
		if os.Getenv("WAGO_BENCH") == "1" {
			for _, bench := range []struct {
				name       string
				bytes      float64
				iterations int32
			}{
				{"benchSerialize", 256, 200000},
				{"benchDeserialize", 260, 200000},
				{"benchSerializeLong", 4096, 20000},
				{"benchSerializeReuse", 256, 200000},
				{"benchSerializeReuseLong", 4096, 20000},
				{"benchDeserializeLong", 4100, 20000},
			} {
				if _, err := instance.Invoke(bench.name, wago.I32(1000)); err != nil {
					panic(err)
				}
				best := time.Duration(1<<63 - 1)
				for round := 0; round < 5; round++ {
					start := time.Now()
					if _, err := instance.Invoke(bench.name, wago.I32(bench.iterations)); err != nil {
						panic(err)
					}
					if elapsed := time.Since(start); elapsed < best {
						best = elapsed
					}
				}
				gbps := bench.bytes * float64(bench.iterations) / best.Seconds() / 1e9
				fmt.Printf("bench: %s %s %.3f GB/s\\n", wasmPath, bench.name, gbps)
				if bench.name == "benchSerialize" {
					switch {
					case strings.Contains(wasmPath, "v128"):
						serializeRates["v128"] = gbps
					case strings.Contains(wasmPath, "v512"):
						serializeRates["v512"] = gbps
					}
				}
				if bench.name == "benchSerializeLong" {
					switch {
					case strings.Contains(wasmPath, "v128"):
						serializeRates["v128-long"] = gbps
					case strings.Contains(wasmPath, "v512"):
						serializeRates["v512-long"] = gbps
					}
				}
				if bench.name == "benchSerializeReuseLong" {
					switch {
					case strings.Contains(wasmPath, "v128"):
						serializeRates["v128-reuse-long"] = gbps
					case strings.Contains(wasmPath, "v512"):
						serializeRates["v512-reuse-long"] = gbps
					}
				}
			}
		}
		instance.Close()
		runtime.Close()
		fmt.Printf("ok: %s\\n", wasmPath)
	}
	if os.Getenv("WAGO_BENCH_REQUIRE_2X") == "1" {
		ratio := serializeRates["v512-reuse-long"] / serializeRates["v128-reuse-long"]
		if ratio < 2 {
			panic(fmt.Errorf("v512 reusable-output serialize ratio %.3fx is below required 2.000x", ratio))
		}
		fmt.Printf("target: v512 reusable-output serialize %.3fx v128\\n", ratio)
	}
}
`,
);

function localModule(module, directory) {
  run(
    "go",
    [
      "mod",
      "edit",
      `-require=${module}@v0.0.0`,
      `-replace=${module}=${path.resolve(root, directory)}`,
    ],
    { cwd: temporaryModule },
  );
}

try {
  if (process.env.WIDE_DIR) {
    localModule("github.com/JairusSW/wide", process.env.WIDE_DIR);
  } else {
    run(
      "go",
      ["get", `github.com/JairusSW/wide@${process.env.WIDE_VERSION ?? "main"}`],
      { cwd: temporaryModule },
    );
  }
  if (process.env.WAGO_DIR) {
    localModule("github.com/wago-org/wago", process.env.WAGO_DIR);
  } else if (process.env.WAGO_VERSION) {
    run("go", ["get", `github.com/wago-org/wago@${process.env.WAGO_VERSION}`], {
      cwd: temporaryModule,
    });
  }
  run("go", ["mod", "tidy"], { cwd: temporaryModule });
  run(
    "go",
    [
      "run",
      ".",
      path.join(output, "json-v128.wasm"),
      path.join(output, "json-v256.wasm"),
      path.join(output, "json-v512.wasm"),
    ],
    { cwd: temporaryModule },
  );
} finally {
  rmSync(temporaryModule, { recursive: true, force: true });
}
