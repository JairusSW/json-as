import { bench, blackbox, dumpToFile } from "./lib/bench.js";

class Token {
  public id!: number;
  public token!: string;
}

const v1: Token = {
  id: 256,
  token: "dewf32df@#G43g3Gs!@3sdfDS#2",
};

const v2 = '{"uid":256,"token":"dewf32df@#G43g3Gs!@3sdfDS#2"}';

bench(
  "Serialize Token",
  () => {
    blackbox(JSON.stringify(v1));
  },
  5_000_000,
  v2.length << 1,
);
dumpToFile("token", "serialize");

bench(
  "Deserialize Token",
  () => {
    blackbox(JSON.parse(v2));
  },
  5_000_000,
  v2.length << 1,
);
dumpToFile("token", "deserialize");
