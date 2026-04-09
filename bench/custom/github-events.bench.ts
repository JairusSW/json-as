import { readFile } from "../lib/bench";
import { bench, blackbox, dumpToFile } from "../lib/bench";
// import { readFile } from "../lib/bench";

const objStr = readFile("./assembly/__benches__/payloads/github-events.json");
// console.log("obj: " + objStr.slice(0, 100));

const parsed = JSON.parse(objStr);
bench(
  "Deserialize Github Events",
  () => {
    blackbox(JSON.parse(objStr));
  },
  100,
  objStr.length,
);
dumpToFile("github-events", "deserialize");

bench(
  "Serialize Github Events",
  () => {
    blackbox(JSON.stringify(parsed));
  },
  100,
  objStr.length,
);
dumpToFile("github-events", "deserialize");
