import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import {
  blackbox,
  bench,
  dumpToFile,
  readFile,
  utf8ByteLength,
} from "../lib/bench";

// github_events (yyjson_benchmark): a 30-element array of GitHub event objects.
// actor/repo are uniform structs; `payload` and `org` vary per event type
// (PushEvent, CreateEvent, IssuesEvent, ...) so they stay JSON.Raw passthrough.

@json({ lazy: "auto" })
class Actor {
  gravatar_id: string = "";
  login: string = "";
  avatar_url: string = "";
  url: string = "";
  id: i64 = 0;
}


@json({ lazy: "auto" })
class GhRepo {
  url: string = "";
  id: i64 = 0;
  name: string = "";
}


@json({ lazy: "auto" })
class GhEvent {
  type: string = "";
  created_at: string = "";
  actor: Actor = new Actor();
  repo: GhRepo = new GhRepo();


  @alias("public")
  isPublic: boolean = false;
  payload: JSON.Raw | null = null;
  id: string = "";
  org: JSON.Raw | null = null;
}

const prettyJson = readFile(
  "./assembly/__benches__/payloads/github_events.pretty.json",
);
const minJson = readFile(
  "./assembly/__benches__/payloads/github_events.min.json",
);

expect(JSON.parse<GhEvent[]>(minJson).length).toBe(30);

const events = JSON.parse<GhEvent[]>(prettyJson);

bench(
  "Deserialize GitHubEvents Lazy (pretty)",
  () => {
    blackbox(JSON.parse<GhEvent[]>(prettyJson));
  },
  20000,
  utf8ByteLength(prettyJson),
);
dumpToFile("github_events-lazy-pretty", "deserialize");

bench(
  "Deserialize GitHubEvents Lazy (min)",
  () => {
    blackbox(JSON.parse<GhEvent[]>(minJson));
  },
  20000,
  utf8ByteLength(minJson),
);
dumpToFile("github_events-lazy-min", "deserialize");

bench(
  "Serialize GitHubEvents Lazy (min)",
  () => {
    blackbox(JSON.stringify(events));
  },
  40000,
  utf8ByteLength(minJson),
);
dumpToFile("github_events-lazy-min", "serialize");
