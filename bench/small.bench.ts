import { bench, blackbox, dumpToFile } from "./lib/bench.js";

class SmallJSON {
  public id!: number;
  public name!: string;
  public active!: boolean;
}

const v1: SmallJSON = {
  id: 1,
  name: "Small Object",
  active: true,
};
const v2 = '{"id":1,"name":"Small Object","active":true}';

bench(
  "Serialize Small Object",
  () => {
    blackbox(JSON.stringify(v1));
  },
  5_000_000,
  v2.length << 1
);
dumpToFile("small", "serialize")

bench(
  "Deserialize Small Object",
  () => {
    blackbox(JSON.parse(v2));
  },
  5_000_000,
  v2.length << 1
);
dumpToFile("small", "deserialize")
