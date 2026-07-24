// AUTO-GENERATED from the eager bench by scripts/sync-lazy-benches.mjs - do not edit by hand.
// Re-run `node scripts/sync-lazy-benches.mjs` to regenerate.
import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import {
  blackbox,
  bench,
  dumpToFile,
  readFile,
  utf8ByteLength,
} from "../lib/bench";

// citm_catalog (yyjson_benchmark): a concert-catalog document. The id->name
// lookup tables are dynamic-key maps (Map<string,string>); `events` is an
// id->event map; `performances` is a uniform struct array. All on the typed
// fast path (struct + Map + typed arrays).

@json({ lazy: "auto" })
class Price {
  amount!: i64;
  audienceSubCategoryId!: i64;
  seatCategoryId!: i64;
}


@json({ lazy: "auto" })
class Area {
  areaId!: i64;
  blockIds!: i64[];
}


@json({ lazy: "auto" })
class SeatCategory {
  areas!: Area[];
  seatCategoryId!: i64;
}


@json({ lazy: "auto" })
class Performance {
  eventId!: i64;
  id!: i64;
  logo!: string | null;
  name!: string | null;
  prices!: Price[];
  seatCategories!: SeatCategory[];
  seatMapImage!: string | null;
  start!: i64;
  venueCode!: string;
}


@json({ lazy: "auto" })
class CitmEvent {
  description!: string | null;
  id!: i64;
  logo!: string | null;
  name!: string;
  subTopicIds!: i64[];
  subjectCode!: string | null;
  subtitle!: string | null;
  topicIds!: i64[];
}


@json({ lazy: "auto" })
class Citm {
  areaNames!: Map<string, string>;
  audienceSubCategoryNames!: Map<string, string>;
  blockNames!: Map<string, string>;
  events!: Map<string, CitmEvent>;
  performances!: Performance[];
  seatCategoryNames!: Map<string, string>;
  subTopicNames!: Map<string, string>;
  subjectNames!: Map<string, string>;
  topicNames!: Map<string, string>;
  topicSubTopics!: Map<string, i64[]>;
  venueNames!: Map<string, string>;
}

function touchRoot(root: Citm): f64 {
  let s = 0.0;
  for (let i = 0, n = root.performances.length; i < n; i++) {
    const perf = unchecked(root.performances[i]);
    s += <f64>perf.eventId + <f64>perf.id + <f64>perf.start;
    const name = perf.name;
    if (name !== null) s += <f64>name.length;
    s += <f64>perf.venueCode.length;
  }
  const events = root.events.values();
  const limit = events.length < 8 ? events.length : 8;
  for (let i = 0, n = limit; i < n; i++) {
    const event = unchecked(events[i]);
    s += <f64>event.id + <f64>event.name.length;
    const subject = event.subjectCode;
    if (subject !== null) s += <f64>subject.length;
  }
  return s;
}

const prettyJson = readFile(
  "./assembly/__benches__/payloads/citm_catalog.pretty.json",
);
const minJson = readFile(
  "./assembly/__benches__/payloads/citm_catalog.min.json",
);

expect(JSON.parse<Citm>(minJson).performances.length).toBe(243);

const citm = JSON.parse<Citm>(prettyJson);

bench(
  "Deserialize CITM Lazy (pretty)",
  () => {
    const root = JSON.parse<Citm>(prettyJson);
    blackbox(touchRoot(root));
  },
  2000,
  utf8ByteLength(prettyJson),
);
dumpToFile("citm_catalog-lazy-pretty", "deserialize");

bench(
  "Deserialize CITM Lazy (min)",
  () => {
    const root = JSON.parse<Citm>(minJson);
    blackbox(touchRoot(root));
  },
  2000,
  utf8ByteLength(minJson),
);
dumpToFile("citm_catalog-lazy-min", "deserialize");

bench(
  "Serialize CITM Lazy (min)",
  () => {
    blackbox(JSON.stringify(citm));
  },
  4000,
  utf8ByteLength(minJson),
);
dumpToFile("citm_catalog-lazy-min", "serialize");
