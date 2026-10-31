import fs from "node:fs";
import { Parser, NodeKind, CommonFlags } from "assemblyscript";

// Preserve each numeric token exactly while changing only the array shape.
// Parsing and re-stringifying the corpus here would round its decimal text.
export function coordinatePayloads(text, shape, count) {
  if (
    !["flat", "pairs"].includes(shape) ||
    !Number.isInteger(count) ||
    count < 4
  )
    throw new Error("Expected flat/pairs and at least four coordinate pairs");
  const number = "-?(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?(?:[eE][+-]?[0-9]+)?";
  const pair = new RegExp(`\\[\\s*(${number})\\s*,\\s*(${number})\\s*\\]`, "g");
  const pairs = [...text.matchAll(pair)]
    .slice(0, count)
    .map((m) => [m[1], m[2]]);
  if (pairs.length !== count) throw new Error("Insufficient coordinate pairs");
  return Array.from({ length: 4 }, (_, i) => {
    const rotated = [...pairs.slice(i), ...pairs.slice(0, i)];
    return shape === "flat"
      ? `[${rotated.flat().join(",")}]`
      : `[${rotated.map((p) => `[${p.join(",")}]`).join(",")}]`;
  });
}

// Owned string diagnostics preserve ordinary UTF-8/UTF-16 string semantics.
export function stringPayloads(shape) {
  const clean = "abcdefghABCDEFGH0123456789-_".repeat(640);
  const values = {
    short: "ordinary text 123",
    clean,
    late: clean + '"',
    dense: 'a"\\\n'.repeat(4096),
    unicode: "é漢字😀".repeat(3000),
  };
  if (!Object.hasOwn(values, shape)) throw new Error("Unknown string shape");
  return Array.from({ length: 4 }, (_, i) =>
    JSON.stringify(String.fromCharCode(65 + i).repeat(i + 1) + values[shape]),
  );
}

export function schemaFromSource(text, filename) {
  const parser = new Parser();
  parser.parseFile(text, filename, true);
  if (parser.diagnostics.length) throw new Error(`Cannot parse ${filename}`);
  return parser.sources[0].statements
    .filter(
      (node) =>
        node.kind === NodeKind.ClassDeclaration &&
        node.decorators?.some((d) => d.name.text === "json"),
    )
    .map((node) => {
      if (node.extendsType || node.typeParameters?.length)
        throw new Error(
          `Inheritance/generic model needs an exact mapping: ${node.name.text}`,
        );
      if (node.decorators?.some((d) => d.name.text !== "json"))
        throw new Error(`Unsupported class decorator: ${node.name.text}`);
      for (const member of node.members) {
        if (
          member.kind !== NodeKind.FieldDeclaration ||
          member.flags & CommonFlags.Static
        )
          throw new Error(`Unsupported model member: ${node.name.text}`);
        if (
          member.decorators?.some(
            (d) => !["alias", "optional"].includes(d.name.text),
          )
        )
          throw new Error(
            `Unsupported field decorator: ${node.name.text}.${member.name.text}`,
          );
      }
      return {
        name: node.name.text,
        source: text.slice(node.range.start, node.range.end),
        fields: node.members
          .filter((member) => member.kind === NodeKind.FieldDeclaration)
          .map((member) => ({
            name: member.name.text,
            key:
              member.decorators?.find((d) => d.name.text === "alias")?.args?.[0]
                ?.value ?? member.name.text,
            type: text.slice(member.type.range.start, member.type.range.end),
            // @optional affects missing-key parsing only. Native classes use
            // default_value and still serialize every field, matching AS.
            optional: !!member.decorators?.some(
              (d) => d.name.text === "optional",
            ),
            initializer: member.initializer
              ? text.slice(
                  member.initializer.range.start,
                  member.initializer.range.end,
                )
              : null,
          })),
      };
    });
}

export function cppType(type, classes) {
  type = type.replaceAll(/\s/g, "");
  if (type.endsWith("|null")) {
    const inner = type.slice(0, -5);
    return classes.has(inner)
      ? `std::unique_ptr<${inner}>`
      : `std::optional<${cppType(inner, classes)}>`;
  }
  if (type.endsWith("[]"))
    return `std::vector<${cppType(type.slice(0, -2), classes)}>`;
  const generic = /^([\w.]+)<(.*)>$/.exec(type);
  if (generic) {
    const [, name, body] = generic;
    const args = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < body.length; i++) {
      if (body[i] === "<") depth++;
      if (body[i] === ">") depth--;
      if (body[i] === "," && !depth) {
        args.push(body.slice(start, i));
        start = i + 1;
      }
    }
    args.push(body.slice(start));
    if (name === "Array" || name === "StaticArray")
      return `std::vector<${cppType(args[0], classes)}>`;
    if (name === "Map")
      return `std::map<${args.map((t) => cppType(t, classes)).join(",")}>`;
    if (name === "JSON.Box") return cppType(args[0], classes);
    throw new Error(`Unsupported generic ${type}`);
  }
  const primitive = {
    string: "std::string",
    boolean: "bool",
    bool: "bool",
    f64: "double",
    f32: "float",
    i64: "int64_t",
    u64: "uint64_t",
    i32: "int32_t",
    u32: "uint32_t",
    i16: "int16_t",
    u16: "uint16_t",
    i8: "int8_t",
    u8: "uint8_t",
  };
  if (primitive[type]) return primitive[type];
  if (classes.has(type)) return type;
  throw new Error(`Unsupported type ${type}`);
}

export function nativeSchema(schema, root) {
  const classes = new Set(schema.map((c) => c.name));
  const nullable = new Set(
    [root, ...schema.flatMap((c) => c.fields.map((f) => f.type))]
      .flatMap((type) => [
        ...type.replaceAll(/\s/g, "").matchAll(/(\w+)\|null/g),
      ])
      .map((match) => match[1])
      .filter((name) => classes.has(name)),
  );
  const recursive = new Set(
    schema
      .filter((c) =>
        c.fields.some((f) => f.type.replaceAll(/\s/g, "") === `${c.name}|null`),
      )
      .map((c) => c.name),
  );
  const declarations = schema.map((c) => `struct ${c.name};`).join("\n");
  // The public adapter hook breaks native reflection's recursive size-bound
  // evaluation and forced-inlining cycle. The complete owned model is retained;
  // ordinary reflection still handles deserialization and every other field.
  const writers = [...recursive]
    .map(
      (name) =>
        `struct ${name}NullableWriter { [[gnu::noinline]] static void serialize(simdjson::builder::string_builder &b, const std::unique_ptr<${name}> &value); };`,
    )
    .join("\n");
  const definitions = schema
    .map(
      (c) =>
        `struct [[=simdjson::deny_unknown_fields]] [[=simdjson::default_value]] ${c.name} {\n${c.fields
          .map((f, i) => {
            const name =
              /^[a-zA-Z_]\w*$/.test(f.name) &&
              ![
                "private",
                "public",
                "protected",
                "operator",
                "class",
                "template",
                "default",
                "typeid",
                "new",
                "delete",
              ].includes(f.name)
                ? f.name
                : `field_${i}`;
            const rename =
              name !== f.key
                ? `[[=simdjson::rename<${JSON.stringify(f.key)}>]] `
                : "";
            if (f.initializer !== null)
              throw new Error(
                `Explicit initializer needs an exact native mapping: ${c.name}.${f.name}`,
              );
            const adapter =
              f.type.replaceAll(/\s/g, "") === `${c.name}|null`
                ? `[[=simdjson::with<${c.name}NullableWriter>]] `
                : "";
            return `  ${rename}${adapter}${cppType(f.type, classes)} ${name}{};`;
          })
          .join("\n")}\n};`,
    )
    .join("\n");
  const writerDefinitions = [...recursive]
    .map(
      (name) =>
        `void ${name}NullableWriter::serialize(simdjson::builder::string_builder &b, const std::unique_ptr<${name}> &value) { if(value) simdjson::builder::append(b,*value); else b.append_null(); }`,
    )
    .join("\n");
  // Native smart-pointer readers expect a non-null value. AS T|null also
  // accepts explicit JSON null, so provide that check through the public ADL
  // customization point without changing the owned pointer representation.
  const nullableReaders = [...nullable]
    .map(
      (name) =>
        `template<class V> simdjson::error_code tag_invoke(simdjson::deserialize_tag, V &input, std::unique_ptr<${name}> &out) {
  bool is_null; auto error=input.is_null().get(is_null); if(error) return error;
  if(is_null) { out.reset(); return simdjson::SUCCESS; }
  std::unique_ptr<${name}> value(new(std::nothrow) ${name}());
  if(!value) return simdjson::MEMALLOC;
  error=input.get(*value); if(error) return error;
  out=std::move(value); return simdjson::SUCCESS;
}`,
    )
    .join("\n");
  return `#include "simdjson.h"\n#include <string>\n#include <vector>\n#include <map>\n#include <optional>\n#include <memory>\n#include <new>\nnamespace model {\n${declarations}\n${writers}\n${definitions}\n${nullableReaders}\n${writerDefinitions}\nusing Root=${cppType(root, classes)};\n}\n`;
}

export function readSchema(source) {
  return schemaFromSource(fs.readFileSync(source, "utf8"), source);
}

export function assemblyDriver(
  schema,
  root,
  inputPrefix,
  outputPrefix,
  ops,
  libraryPrefix = "../../..",
) {
  return `import {JSON} from "${libraryPrefix}/assembly/index";
import {bench,blackbox,readFile,writeFile} from "${libraryPrefix}/assembly/__benches__/lib/bench";
${schema.map((c) => c.source).join("\n")}
if(!JSON_STRICT)throw new Error("Comparable parity benchmarks require strict syntax");
const inputs=new StaticArray<string>(4);
const objects=new Array<${root}>();
const retained=new Array<${root}>(8);
const retainedStrings=new StaticArray<string>(8);
for(let i=0;i<4;i++) {
  const input=readFile(${JSON.stringify(inputPrefix)}+"."+i.toString()+".json");
  inputs[i]=input;
  const value=JSON.parse<${root}>(input);objects.push(value);
  writeFile(${JSON.stringify(outputPrefix)}+"."+i.toString()+".json",JSON.stringify(value));
}
let index=0;let slot=0;
function parseOwned():void {
  const value=JSON.parse<${root}>(unchecked(inputs[index]));index=(index+1)&3;
  unchecked(retained[slot]=value);blackbox(value);slot=(slot+1)&7;
}
function serializeOwned():void {
  const value=JSON.stringify(unchecked(objects[index]));index=(index+1)&3;
  unchecked(retainedStrings[slot]=value);blackbox(value);slot=(slot+1)&7;
}
function validate():void { if(!JSON.validate(unchecked(inputs[index])))throw new Error("Invalid benchmark input");index=(index+1)&3; }
bench("parse-owned",parseOwned,${ops});
bench("serialize-owned",serializeOwned,${ops});
bench("validate",validate,${ops});
__collect();
for(let i=0;i<8;i++) {
  writeFile(${JSON.stringify(outputPrefix)}+".retained-object."+i.toString()+".json",JSON.stringify(unchecked(retained[i])));
  writeFile(${JSON.stringify(outputPrefix)}+".retained-string."+i.toString()+".json",unchecked(retainedStrings[i]));
}
`;
}
