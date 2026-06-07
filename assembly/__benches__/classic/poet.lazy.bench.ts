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

@json({ lazy: "auto" })
class Poem {
  desc: string = "";
  name: string = "";
  id: string = "";
}

const prettyJson = readFile("./assembly/__benches__/payloads/poet.pretty.json");
const minJson = readFile("./assembly/__benches__/payloads/poet.min.json");

expect(JSON.parse<Poem[]>(minJson).length).toBe(8934);

const poet = JSON.parse<Poem[]>(prettyJson);

bench(
  "Deserialize Poet Lazy (pretty)",
  () => {
    blackbox(JSON.parse<Poem[]>(prettyJson));
  },
  500,
  utf8ByteLength(prettyJson),
);
dumpToFile("poet-lazy-pretty", "deserialize");

bench(
  "Deserialize Poet Lazy (min)",
  () => {
    blackbox(JSON.parse<Poem[]>(minJson));
  },
  500,
  utf8ByteLength(minJson),
);
dumpToFile("poet-lazy-min", "deserialize");

bench(
  "Serialize Poet Lazy (min)",
  () => {
    blackbox(JSON.stringify(poet));
  },
  1000,
  utf8ByteLength(minJson),
);
dumpToFile("poet-lazy-min", "serialize");
