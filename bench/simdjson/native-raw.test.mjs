import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { nativeSchema, schemaFromSource } from "./generate.mjs";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const base = path.join(root, "build/simdjson-parity");
const compiler = process.env.PARITY_CXX ?? "/opt/homebrew/bin/g++-16";
const available =
  fs.existsSync(compiler) && fs.existsSync(path.join(base, "simdjson.o"));

test(
  "native raw adapter owns exact lexemes and rejects malformed skipped contents",
  {
    skip: available
      ? false
      : "Requires the pinned native library (run.mjs bootstrap) and reflection compiler",
  },
  () => {
    const dir = path.join(base, "raw-adapter-tests");
    fs.mkdirSync(dir, { recursive: true });
    const model = schemaFromSource(
      "@json class Item { raw:JSON.Raw; maybe:JSON.Raw|null; children:JSON.Raw[]; }",
      "raw-fixture.ts",
    );
    const source =
      nativeSchema(model, "Item") +
      `
#define main parity_benchmark_main
#include ${JSON.stringify(path.join(root, "bench/simdjson/native-driver.h"))}
#undef main
#include <algorithm>
void check(bool ok) { if(!ok) throw std::runtime_error("Raw adapter assertion failed"); }
int main() {
  try {
    simdjson::ondemand::parser parser;
    simdjson::dom::parser validator;
    const std::array<std::string,8> lexemes={
      "1.2300e+03", "-0", "true", "null", R"("a\\n\\u4e2d\\ud83d\\ude00")",
      R"([ 1, { "x": [false, null] } ])", R"({ "x": 1.00, "y": [2, 3] })", "[]"
    };
    for(const auto &lexeme:lexemes) {
      model::Item value{};
      {
        const std::string text="{\\"raw\\":"+lexeme+" \\t,\\"maybe\\":null,\\"children\\":["+lexeme+"]}";
        simdjson::padded_string input(text);
        parse_owned(parser,validator,input,value);
        check(value.raw.data==lexeme && !value.maybe && value.children.size()==1 && value.children[0].data==lexeme);
        std::fill(input.data(),input.data()+input.size(),'x');
      }
      // Input is destroyed and both parser scratch areas are reused.
      simdjson::padded_string other(std::string("[1,2,3]"));
      model::OwnedRaw replacement;
      parse_owned(parser,validator,other,replacement);
      check(value.raw.data==lexeme && value.children[0].data==lexeme);
      std::string serialized;
      require_success(simdjson::builder::to_json(value.raw,serialized));
      check(serialized==lexeme);
      simdjson::padded_string scalar(lexeme+" \\r\\n");
      model::OwnedRaw root_raw;
      parse_owned(parser,validator,scalar,root_raw);
      check(root_raw.data==lexeme);
    }
    model::Item present{};
    simdjson::padded_string nullable(std::string(R"({"raw":false,"maybe":{"present":true},"children":[]})"));
    parse_owned(parser,validator,nullable,present);
    check(present.maybe && present.maybe->data==R"({"present":true})");
    // FGO uses a root map; raw container writers must also handle escaping keys.
    std::map<std::string,model::OwnedRaw> map;
    {
      simdjson::padded_string input(std::string(R"({"key\\"":"a", "array":[1, {"b":2}]})"));
      parse_owned(parser,validator,input,map);
      std::fill(input.data(),input.data()+input.size(),'x');
    }
    check(map.at("key\\"").data==R"("a")" && map.at("array").data==R"([1, {"b":2}])");
    std::string map_json;
    require_success(simdjson::builder::to_json(model::RawRootView<decltype(map)>{map},map_json));
    simdjson::padded_string serialized_map(map_json);
    std::map<std::string,model::OwnedRaw> reparsed;
    parse_owned(parser,validator,serialized_map,reparsed);
    check(reparsed.at("key\\"").data==map.at("key\\"").data && reparsed.at("array").data==map.at("array").data);
    const std::array<std::string,11> invalid={
      "[01]", "[1.]", "[1e+]", "[+1]", "[tru]", R"(["\\q"])",
      R"({"x":[true false]})", R"({"x":})", "[1,]", "[1", "null true"
    };
    for(const auto &bad:invalid) {
      model::Item value{}; value.raw.data="unchanged";
      simdjson::padded_string input("{\\"raw\\":"+bad+",\\"maybe\\":null,\\"children\\":[]}");
      bool rejected=false;
      try { parse_owned(parser,validator,input,value); }
      catch(const std::runtime_error &) { rejected=true; }
      check(rejected && value.raw.data=="unchanged");
    }
    // This benchmark adapter intentionally inherits DOM's representability and
    // Unicode restrictions; it is not a general JSON.Raw API replacement.
    for(const auto &restricted:{"1e9999", "18446744073709551616", R"("\\ud800")"}) {
      simdjson::padded_string input{std::string(restricted)};
      model::OwnedRaw value;
      bool rejected=false;
      try { parse_owned(parser,validator,input,value); }
      catch(const std::runtime_error &) { rejected=true; }
      check(rejected);
    }
    std::cout<<"Raw ownership, root/scalar/container lexemes, nullable values and 11 malformed subtrees passed\\n";
  } catch(const std::exception &error) { std::cerr<<error.what()<<"\\n"; return 1; }
}
`;
    const cpp = path.join(dir, "raw.cpp");
    const binary = path.join(dir, "raw-test");
    fs.writeFileSync(cpp, source);
    const built = spawnSync(
      compiler,
      [
        "-std=c++26",
        "-freflection",
        "-O3",
        "-DNDEBUG",
        "-mcpu=native",
        `-I${base}/upstream/singleheader`,
        cpp,
        path.join(base, "simdjson.o"),
        "-o",
        binary,
      ],
      { encoding: "utf8" },
    );
    fs.writeFileSync(
      path.join(dir, "build.log"),
      (built.stdout ?? "") + (built.stderr ?? ""),
    );
    assert.equal(built.status, 0, built.stderr?.slice(-6000));
    const ran = spawnSync(binary, [], { encoding: "utf8" });
    fs.writeFileSync(
      path.join(dir, "test.log"),
      (ran.stdout ?? "") + (ran.stderr ?? ""),
    );
    assert.equal(ran.status, 0, ran.stderr);
    // Keep the ordinary typed path free of the raw-only validation prepass.
    const control = path.join(dir, "typed-control.cpp");
    fs.writeFileSync(
      control,
      nativeSchema([], "string") +
        `
#define main parity_benchmark_main
#include ${JSON.stringify(path.join(root, "bench/simdjson/native-driver.h"))}
#undef main
int main() {
  simdjson::ondemand::parser parser;
  simdjson::dom::parser validator;
  simdjson::padded_string input(std::string(R"("owned text")"));
  model::Root value;
  parse_owned(parser,validator,input,value);
  std::string output;
  require_success(model::to_owned_json(value,output));
  return value=="owned text" && output==R"("owned text")" && validator.capacity()==0 ? 0 : 1;
}
`,
    );
    const controlBinary = path.join(dir, "typed-control");
    const controlBuild = spawnSync(
      compiler,
      [
        "-std=c++26",
        "-freflection",
        "-O3",
        "-DNDEBUG",
        "-mcpu=native",
        `-I${base}/upstream/singleheader`,
        control,
        path.join(base, "simdjson.o"),
        "-o",
        controlBinary,
      ],
      { encoding: "utf8" },
    );
    fs.writeFileSync(
      path.join(dir, "typed-control-build.log"),
      (controlBuild.stdout ?? "") + (controlBuild.stderr ?? ""),
    );
    assert.equal(controlBuild.status, 0, controlBuild.stderr?.slice(-6000));
    const controlRun = spawnSync(controlBinary, [], { encoding: "utf8" });
    assert.equal(controlRun.status, 0, controlRun.stderr);
  },
);
