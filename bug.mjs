#!/usr/bin/env node
/**
 * Reproduction: json-as singleton state pollution bug
 *
 * SETUP:
 *   git clone https://github.com/JairusSW/json-as.git
 *   cd json-as
 *   npm install
 *   npm run build:transform
 *   node bug.mjs
 *
 * ROOT CAUSE:
 *   transform/src/index.ts:51 - static SN = new JSONTransform()
 *   The singleton's visitedClasses Set persists across compilations.
 *
 * This script demonstrates that the singleton state accumulates
 * between multiple calls to main(), which causes issues in worker pools.
 *
 * FIX APPLIED:
 *   The afterParse() method now resets singleton state at the start of each compilation.
 */

import { main } from "assemblyscript/asc";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { writeFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Source A: A @json class named "Data"
const SOURCE_A = `
import { JSON } from "..";

@json
class Data {
  name: string = "";
  count: i32 = 0;
}

export function test(): void {
  const d = new Data();
  d.name = "first";
  d.count = 42;
  const result = JSON.stringify<Data>(d);
  assert(result == '{"name":"first","count":42}', "Serialization A failed: " + result);
}
`;

// Source B: A DIFFERENT @json class also named "Data" (different fields)
const SOURCE_B = `
import { JSON } from "..";

@json
class Data {
  id: string = "";
  active: bool = false;
}

export function test(): void {
  const d = new Data();
  d.id = "second";
  d.active = true;
  const result = JSON.stringify<Data>(d);
  assert(result == '{"id":"second","active":true}', "Serialization B failed: " + result);
}
`;

let JSONTransform = null;

async function compile(source, label, inputPath, outputPath) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`COMPILE: ${label}`);
  console.log("─".repeat(60));

  writeFileSync(inputPath, source);

  const result = await main([inputPath, "--transform", join(__dirname, "transform"), "--outFile", outputPath, "--runtime", "incremental", "--debug", "--config", "./node_modules/@assemblyscript/wasi-shim/asconfig.json"], {
    reportDiagnostic(diag) {
      if (!diag.message.includes("possibly unused")) {
        console.error(`  DIAGNOSTIC: ${diag.message}`);
      }
    },
    stderr: {
      write(s) {
        if (!s.includes("unused")) process.stderr.write("  " + s);
      },
    },
    stdout: {
      write(s) {
        process.stdout.write("  " + s);
      },
    },
  });

  // Import singleton for inspection
  if (!JSONTransform) {
    try {
      const mod = await import(join(__dirname, "transform", "lib", "index.js"));
      JSONTransform = mod.JSONTransform;
    } catch {}
  }

  const hasWasm = existsSync(outputPath);

  if (JSONTransform) {
    const singleton = JSONTransform.SN;
    console.log(`\n  Singleton state after compilation:`);
    console.log(`    visitedClasses: ${singleton.visitedClasses.size} entries`);
    for (const cls of singleton.visitedClasses) {
      console.log(`      - ${cls}`);
    }
    console.log(`    schemas: ${singleton.schemas.size} source files`);
  }

  if (hasWasm) {
    console.log(`  ✅ Compiled: ${outputPath}`);
    return true;
  } else {
    console.log(`  ❌ Compilation failed`);
    return false;
  }
}

function runWasm(wasmPath, label) {
  console.log(`\n  Running: ${label}`);
  try {
    execSync(`wasmtime "${wasmPath}"`, { stdio: "inherit" });
    console.log(`  ✅ Runtime SUCCESS`);
    return true;
  } catch (err) {
    console.log(`  ❌ Runtime FAILED - assertions did not pass`);
    return false;
  }
}

async function main_repro() {
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║  json-as Singleton State Pollution - Bug Test                     ║
╠═══════════════════════════════════════════════════════════════════╣
║  This script compiles two sources in the SAME process.            ║
║  If the fix works, both compilations produce correct WASM.        ║
╚═══════════════════════════════════════════════════════════════════╝`);

  const testDir = join(__dirname, "assembly", "__tests__");
  mkdirSync(testDir, { recursive: true });

  const inputPath = join(testDir, "test.ts");
  const outputA = join(testDir, "output_a.wasm");
  const outputB = join(testDir, "output_b.wasm");

  try {
    // COMPILATION 1
    const compile1 = await compile(SOURCE_A, "Source A - Data{name, count}", inputPath, outputA);

    // COMPILATION 2 - different source, same class name
    const compile2 = await compile(SOURCE_B, "Source B - Data{id, active}", inputPath, outputB);

    console.log(`\n${"═".repeat(60)}`);
    console.log("RUNTIME VERIFICATION");
    console.log("═".repeat(60));

    // The real test: do the WASM files actually work correctly?
    const run1 = compile1 && runWasm(outputA, "Source A WASM");
    const run2 = compile2 && runWasm(outputB, "Source B WASM");

    console.log(`\n${"═".repeat(60)}`);
    console.log("RESULTS");
    console.log("═".repeat(60));

    if (run1 && run2) {
      console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║  ✅ FIX VERIFIED: Singleton state properly reset                  ║
╠═══════════════════════════════════════════════════════════════════╣
║  Both compilations succeeded AND produced correct output!         ║
║                                                                   ║
║  - Source A: Data{name, count} serializes correctly               ║
║  - Source B: Data{id, active} serializes correctly                ║
║                                                                   ║
║  The singleton state is now properly reset between compilations.  ║
╚═══════════════════════════════════════════════════════════════════╝
`);
      process.exit(0);
    } else {
      console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║  🐛 BUG DETECTED: Singleton state pollution                       ║
╠═══════════════════════════════════════════════════════════════════╣
║  One or both WASM files failed runtime verification.              ║
║                                                                   ║
║  Compilation 1: ${compile1 ? "✅" : "❌"}  Runtime 1: ${run1 ? "✅" : "❌"}                              ║
║  Compilation 2: ${compile2 ? "✅" : "❌"}  Runtime 2: ${run2 ? "✅" : "❌"}                              ║
║                                                                   ║
║  This indicates the singleton state was not properly reset.       ║
╚═══════════════════════════════════════════════════════════════════╝
`);
      process.exit(1);
    }
  } finally {
    try {
      rmSync(inputPath, { force: true });
      rmSync(outputA, { force: true });
      rmSync(outputB, { force: true });
    } catch {}
  }
}

main_repro().catch((e) => {
  console.error("Fatal:", e);
  process.exit(2);
});
