import type { ClassNode, InferOptions, InferredSchema, JsonValue, NumberKind, SchemaWarning, TypeNode } from "./types.js";

interface Context {
  classes: ClassNode[];
  warnings: SchemaWarning[];
  totalSamples: number;
  options: Required<InferOptions>;
}

const DEFAULT_OPTIONS: Required<InferOptions> = {
  rootName: "Root",
  strict: false,
  dedupe: true,
  preferF64: false,
  preferI64: false,
};

export function inferJsonAsSchema(samples: JsonValue[], options: InferOptions = {}): InferredSchema {
  if (samples.length === 0) throw new Error("At least one JSON sample is required");
  const ctx: Context = {
    classes: [],
    warnings: [],
    totalSamples: samples.length,
    options: { ...DEFAULT_OPTIONS, ...options },
  };
  let root = inferValue(samples[0], ctx.options.rootName, "$", ctx);
  for (let i = 1; i < samples.length; i++) {
    root = mergeTypes(root, inferValue(samples[i], ctx.options.rootName, "$", ctx), "$", ctx);
  }
  finalizeOptionalFields(ctx);
  if (ctx.options.dedupe) dedupeClasses(ctx, root);
  pruneUnreachableClasses(ctx, root);
  return { root, classes: ctx.classes, warnings: ctx.warnings, options: ctx.options };
}

function inferValue(value: JsonValue, suggestedName: string, path: string, ctx: Context): TypeNode {
  if (value === null) return { kind: "null" };
  if (typeof value === "boolean") return { kind: "bool" };
  if (typeof value === "string") return { kind: "string" };
  if (typeof value === "number") return { kind: "number", numberKind: inferNumberKind(value, ctx.options) };
  if (Array.isArray(value)) return inferArray(value, suggestedName, path, ctx);
  return inferObject(value, suggestedName, path, ctx);
}

function inferArray(values: JsonValue[], suggestedName: string, path: string, ctx: Context): TypeNode {
  if (values.length === 0) {
    warn(ctx, path, "Empty array inferred as JSON.Value[]");
    return { kind: "array", element: { kind: "unknown" } };
  }
  let element = inferValue(values[0], `${suggestedName}Item`, `${path}[0]`, ctx);
  for (let i = 1; i < values.length; i++) {
    element = mergeTypes(element, inferValue(values[i], `${suggestedName}Item`, `${path}[${i}]`, ctx), `${path}[]`, ctx);
  }
  return { kind: "array", element };
}

function inferObject(value: { [key: string]: JsonValue }, suggestedName: string, path: string, ctx: Context): TypeNode {
  const classNode: ClassNode = { name: uniqueClassName(toPascalCase(suggestedName), ctx), path, fields: [] };
  const usedNames = new Map<string, number>();
  for (const [jsonKey, fieldValue] of Object.entries(value)) {
    const baseName = toFieldName(jsonKey);
    const name = uniqueFieldName(baseName, usedNames);
    if (name !== jsonKey) {
      // Alias is emitted later; this warning only matters when collisions force a suffix.
      if (name !== baseName) warn(ctx, `${path}.${jsonKey}`, `Field name collision resolved as '${name}'`);
    }
    classNode.fields.push({
      jsonKey,
      name,
      type: inferValue(fieldValue, `${classNode.name}${toPascalCase(jsonKey)}`, `${path}.${jsonKey}`, ctx),
      seen: 1,
      nullable: fieldValue === null,
      optional: false,
    });
  }
  ctx.classes.push(classNode);
  return { kind: "object", className: classNode.name, classNode };
}

function mergeTypes(left: TypeNode, right: TypeNode, path: string, ctx: Context): TypeNode {
  if (left.kind === "unknown") return right;
  if (right.kind === "unknown") return left;
  if (left.kind === "null") return nullable(right);
  if (right.kind === "null") return nullable(left);
  if (left.kind === "value" || right.kind === "value") return { kind: "value" };
  if (left.kind === "number" && right.kind === "number") return { kind: "number", numberKind: mergeNumberKind(left.numberKind, right.numberKind) };
  if (left.kind === "array" && right.kind === "array") return { kind: "array", element: mergeTypes(left.element, right.element, `${path}[]`, ctx) };
  if (left.kind === "object" && right.kind === "object") {
    mergeClasses(left.classNode, right.classNode, path, ctx);
    removeClass(ctx, right.classNode);
    return left;
  }
  if (left.kind === right.kind) return left;
  if (ctx.options.strict) throw new Error(`Mixed JSON types at ${path}: ${left.kind} vs ${right.kind}`);
  warn(ctx, path, `Mixed JSON types inferred as JSON.Value (${left.kind} vs ${right.kind})`);
  return { kind: "value" };
}

function mergeClasses(left: ClassNode, right: ClassNode, path: string, ctx: Context): void {
  const byKey = new Map(left.fields.map((field) => [field.jsonKey, field]));
  for (const field of left.fields) field.optional = true;
  for (const rightField of right.fields) {
    const existing = byKey.get(rightField.jsonKey);
    if (!existing) {
      rightField.optional = true;
      left.fields.push(rightField);
      continue;
    }
    existing.type = mergeTypes(existing.type, rightField.type, `${path}.${rightField.jsonKey}`, ctx);
    existing.seen += rightField.seen;
    existing.nullable ||= rightField.nullable;
    existing.optional = false;
  }
}

function finalizeOptionalFields(ctx: Context): void {
  for (const classNode of ctx.classes) {
    for (const field of classNode.fields) {
      field.optional ||= field.seen < ctx.totalSamples;
      field.nullable ||= field.type.kind === "null";
      if (field.type.kind === "null") field.type = { kind: "value" };
    }
  }
}

function nullable(type: TypeNode): TypeNode {
  return type.kind === "null" ? { kind: "value" } : type;
}

function dedupeClasses(ctx: Context, root: TypeNode): void {
  const bySignature = new Map<string, ClassNode>();
  for (const classNode of [...ctx.classes]) {
    const signature = classSignature(classNode);
    const existing = bySignature.get(signature);
    if (!existing) {
      bySignature.set(signature, classNode);
      continue;
    }
    replaceClass(root, classNode, existing);
    removeClass(ctx, classNode);
  }
}

function pruneUnreachableClasses(ctx: Context, root: TypeNode): void {
  const reachable = new Set<ClassNode>();
  collectReachableClasses(root, reachable);
  ctx.classes = ctx.classes.filter((classNode) => reachable.has(classNode));
}

function collectReachableClasses(type: TypeNode, reachable: Set<ClassNode>): void {
  if (type.kind === "object") {
    if (reachable.has(type.classNode)) return;
    reachable.add(type.classNode);
    for (const field of type.classNode.fields) collectReachableClasses(field.type, reachable);
  } else if (type.kind === "array") {
    collectReachableClasses(type.element, reachable);
  }
}

function replaceClass(type: TypeNode, from: ClassNode, to: ClassNode): void {
  if (type.kind === "object") {
    if (type.classNode === from) {
      type.classNode = to;
      type.className = to.name;
    }
    for (const field of type.classNode.fields) replaceClass(field.type, from, to);
  } else if (type.kind === "array") {
    replaceClass(type.element, from, to);
  }
}

function classSignature(classNode: ClassNode): string {
  return classNode.fields
    .map((field) => `${field.jsonKey}:${field.optional ? "?" : ""}${field.nullable ? "null|" : ""}${typeSignature(field.type)}`)
    .join(";");
}

function typeSignature(type: TypeNode): string {
  switch (type.kind) {
    case "number": return `number:${type.numberKind}`;
    case "array": return `array:${typeSignature(type.element)}`;
    case "object": return `object:${classSignature(type.classNode)}`;
    default: return type.kind;
  }
}

function removeClass(ctx: Context, classNode: ClassNode): void {
  const index = ctx.classes.indexOf(classNode);
  if (index >= 0) ctx.classes.splice(index, 1);
}

function inferNumberKind(value: number, options: Required<InferOptions>): NumberKind {
  if (options.preferF64 || !Number.isInteger(value) || !Number.isSafeInteger(value)) return "f64";
  if (options.preferI64) return "i64";
  return value >= -2147483648 && value <= 2147483647 ? "i32" : "i64";
}

function mergeNumberKind(left: NumberKind, right: NumberKind): NumberKind {
  if (left === "f64" || right === "f64") return "f64";
  if (left === "i64" || right === "i64") return "i64";
  return "i32";
}

function uniqueClassName(base: string, ctx: Context): string {
  let name = base || "Root";
  let suffix = 2;
  const used = new Set(ctx.classes.map((classNode) => classNode.name));
  while (used.has(name)) name = `${base}${suffix++}`;
  return name;
}

function uniqueFieldName(base: string, usedNames: Map<string, number>): string {
  const count = usedNames.get(base) ?? 0;
  usedNames.set(base, count + 1);
  return count === 0 ? base : `${base}${count + 1}`;
}

function toFieldName(key: string): string {
  const name = toCamelCase(key);
  return isReserved(name) ? `${name}_` : name;
}

function toPascalCase(input: string): string {
  const parts = input.match(/[A-Za-z0-9]+/g) ?? ["Generated"];
  const joined = parts.map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("");
  return joined.replace(/^[0-9]/, "_$&") || "Generated";
}

function toCamelCase(input: string): string {
  const parts = input.match(/[A-Za-z0-9]+/g) ?? ["field"];
  const joined = parts.map((part, index) => {
    const normalized = part.charAt(0).toUpperCase() + part.slice(1);
    return index === 0 ? part.charAt(0).toLowerCase() + part.slice(1) : normalized;
  }).join("");
  const safe = joined.replace(/^[0-9]/, "_$&");
  return safe || "field";
}

function isReserved(name: string): boolean {
  return new Set(["if", "else", "for", "while", "do", "switch", "case", "class", "return", "null", "true", "false", "new", "import", "export", "function", "let", "const", "var", "type", "extends", "implements", "static", "this", "super"]).has(name);
}

function warn(ctx: Context, path: string, message: string): void {
  ctx.warnings.push({ path, message });
}
