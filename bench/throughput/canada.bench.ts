import { readFile } from "../lib/bench";
import { bench, blackbox, dumpToFile } from "../lib/bench";
// import { readFile } from "../lib/bench";

const objStr = readFile("./assembly/__benches__/payloads/canada.json");
// console.log("obj: " + objStr.slice(0, 100));

const parsed = JSON.parse(objStr);
bench(
  "Deserialize Canada (2.1MB)",
  () => {
    blackbox(JSON.parse(objStr));
  },
  500,
  objStr.length << 1,
);
dumpToFile("canada", "deserialize");

bench(
  "Serialize Canada (2.1MB)",
  () => {
    blackbox(JSON.stringify(parsed));
  },
  500,
  objStr.length << 1,
);
dumpToFile("canada", "deserialize");
