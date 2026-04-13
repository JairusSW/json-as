#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import { emitAssemblyScriptSchema } from "./emit.js";
import { inferJsonAsSchema } from "./infer.js";
import type { InferOptions, JsonValue } from "./types.js";

interface CliOptions extends InferOptions {
  out?: string;
  jsonl: boolean;
  files: string[];
}

async function main(argv: string[]): Promise<void> {
  const options = parseArgs(argv);
  const samples = await loadSamples(options.files, options.jsonl);
  const schema = inferJsonAsSchema(samples, options);
  const source = emitAssemblyScriptSchema(schema, { rootName: options.rootName });
  for (const warning of schema.warnings) console.warn(`[json-as-schema] ${warning.path}: ${warning.message}`);
  if (options.out) await writeFile(options.out, source);
  else process.stdout.write(source);
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { files: [], jsonl: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      case "--name":
        options.rootName = readValue(argv, ++i, arg);
        break;
      case "--out":
      case "-o":
        options.out = readValue(argv, ++i, arg);
        break;
      case "--jsonl":
        options.jsonl = true;
        break;
      case "--strict":
        options.strict = true;
        break;
      case "--no-dedupe":
        options.dedupe = false;
        break;
      case "--prefer-f64":
        options.preferF64 = true;
        break;
      case "--prefer-i64":
        options.preferI64 = true;
        break;
      default:
        if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
        options.files.push(arg);
        break;
    }
  }
  if (options.files.length === 0) throw new Error("Expected at least one JSON input file");
  if (!options.rootName) options.rootName = guessRootName(options.files[0]);
  return options;
}

function readValue(argv: string[], index: number, flag: string): string {
  const value = argv[index];
  if (!value) throw new Error(`Expected a value after ${flag}`);
  return value;
}

async function loadSamples(files: string[], jsonl: boolean): Promise<JsonValue[]> {
  const samples: JsonValue[] = [];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    if (jsonl) {
      for (const [index, line] of text.split(/\r?\n/).entries()) {
        if (line.trim().length === 0) continue;
        samples.push(parseJson(line, `${file}:${index + 1}`));
      }
    } else {
      samples.push(parseJson(text, file));
    }
  }
  return samples;
}

function parseJson(text: string, label: string): JsonValue {
  try {
    return JSON.parse(text) as JsonValue;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse ${label}: ${message}`);
  }
}

function guessRootName(file: string): string {
  const stem = basename(file).replace(/\.[^.]+$/, "");
  const parts = stem.match(/[A-Za-z0-9]+/g) ?? ["Root"];
  return parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()).join("");
}

function printHelp(): void {
  process.stdout.write(`Usage: json-as-schema [options] <input.json...>\n\nOptions:\n  --name <Root>      Root class/type name. Defaults to the first file name.\n  --out, -o <file>   Write generated AssemblyScript to a file. Defaults to stdout.\n  --jsonl            Treat each non-empty input line as a separate JSON sample.\n  --strict           Fail on mixed types instead of falling back to JSON.Value.\n  --no-dedupe        Keep path-based nested classes even when shapes match.\n  --prefer-f64       Infer all numbers as f64.\n  --prefer-i64       Infer integers as i64 instead of i32.\n  --help, -h         Show this help.\n`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[json-as-schema] ${message}`);
  process.exitCode = 1;
});
