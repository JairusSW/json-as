import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import { blackbox, bench, dumpToFile, readFile } from "../lib/bench";
const payloadData = readFile("./assembly/__benches__/payloads/github-events.json");
const payloadChars = payloadData.length;

@json
class Large {
  id!: string;
  type!: string;
  actor!: Actor;
  repo!: Repo;
  payload!: Payload;

  @alias("public")
  _public!: boolean;
  created_at!: string;
  org!: Org;
}

@json
class Actor {
  id!: i32;
  login!: string;
  gravatar_id!: string;
  url!: string;
  avatar_url!: string;
}

@json
class Repo {
  id!: i32;
  name!: string;
  url!: string;
}

@json
class Payload {
  action!: string;
}

@json
class Org {
  id!: i32;
  login!: string;
  gravatar_id!: string;
  url!: string;
  avatar_url!: string;
}
const jsonStart = changetype<usize>(payloadData);
const jsonEnd = jsonStart + (payloadData.length << 1);
const typed = JSON.parse<Large>(payloadData);
const typedSerialized = JSON.stringify(typed);
bench(
  "Deserialize Large File",
  () => {
    blackbox(JSON.__deserialize<Large>(jsonStart, jsonEnd, changetype<usize>(typed)));
  },
  40,
  payloadChars,
);
dumpToFile("github-events", "deserialize");
bench(
  "Serialize Large File",
  () => {
    blackbox(JSON.stringify(typed));
  },
  40,
  payloadChars,
);
dumpToFile("github-events", "serialize");
