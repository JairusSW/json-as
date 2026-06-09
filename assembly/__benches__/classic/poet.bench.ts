import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import {
  blackbox,
  bench,
  dumpToFile,
  readFile,
  utf8ByteLength,
} from "../lib/bench";

// poet (yyjson_benchmark): a flat array of ~8934 {desc, name, id} string
// records. Trivial uniform schema — pure struct fast path.

@json
class Poem {
  desc: string = "";
  name: string = "";
  id: string = "";
}

const prettyJson = readFile("./assembly/__benches__/payloads/poet.pretty.json");
const minJson = readFile("./assembly/__benches__/payloads/poet.min.json");

expect(JSON.parse<Poem[]>(minJson).length).toBe(8934);

const poet = JSON.parse<Poem[]>(prettyJson);
const out = "";

bench(
  "Deserialize Poet (pretty)",
  () => {
    blackbox(JSON.parse<Poem[]>(prettyJson, poet));
  },
  500,
  utf8ByteLength(prettyJson),
);
dumpToFile("poet-pretty", "deserialize");

bench(
  "Deserialize Poet (min)",
  () => {
    blackbox(JSON.parse<Poem[]>(minJson, poet));
  },
  500,
  utf8ByteLength(minJson),
);
dumpToFile("poet-min", "deserialize");

bench(
  "Serialize Poet (min)",
  () => {
    blackbox(JSON.stringify(poet, out));
  },
  1000,
  utf8ByteLength(minJson),
);
dumpToFile("poet-min", "serialize");
