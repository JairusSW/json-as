import { readFile } from "../lib/bench";
import { bench, blackbox, dumpToFile } from "../lib/bench";
// import { readFile } from "../lib/bench";

const objStr = readFile("./assembly/__benches__/payloads/github-events.json");
// console.log("obj: " + objStr.slice(0, 100));

const parsed = JSON.parse(objStr);
bench(
  "Deserialize Large File (2.1MB)",
  () => {
    blackbox(JSON.parse(objStr));
  },
  100,
  objStr.length << 1,
);
dumpToFile("github-events", "deserialize");

bench(
  "Serialize Large File (2.1MB)",
  () => {
    blackbox(JSON.stringify(parsed));
  },
  100,
  objStr.length << 1,
);
dumpToFile("github-events", "deserialize");
