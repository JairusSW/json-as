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
  amount: i64 = 0;
  audienceSubCategoryId: i64 = 0;
  seatCategoryId: i64 = 0;
}


@json({ lazy: "auto" })
class Area {
  areaId: i64 = 0;
  blockIds: i64[] = [];
}


@json({ lazy: "auto" })
class SeatCategory {
  areas: Area[] = [];
  seatCategoryId: i64 = 0;
}


@json({ lazy: "auto" })
class Performance {
  eventId: i64 = 0;
  id: i64 = 0;
  logo: string | null = null;
  name: string | null = null;
  prices: Price[] = [];
  seatCategories: SeatCategory[] = [];
  seatMapImage: string | null = null;
  start: i64 = 0;
  venueCode: string = "";
}


@json({ lazy: "auto" })
class CitmEvent {
  description: string | null = null;
  id: i64 = 0;
  logo: string | null = null;
  name: string = "";
  subTopicIds: i64[] = [];
  subjectCode: string | null = null;
  subtitle: string | null = null;
  topicIds: i64[] = [];
}


@json({ lazy: "auto" })
class Citm {
  areaNames: Map<string, string> = new Map<string, string>();
  audienceSubCategoryNames: Map<string, string> = new Map<string, string>();
  blockNames: Map<string, string> = new Map<string, string>();
  events: Map<string, CitmEvent> = new Map<string, CitmEvent>();
  performances: Performance[] = [];
  seatCategoryNames: Map<string, string> = new Map<string, string>();
  subTopicNames: Map<string, string> = new Map<string, string>();
  subjectNames: Map<string, string> = new Map<string, string>();
  topicNames: Map<string, string> = new Map<string, string>();
  topicSubTopics: Map<string, i64[]> = new Map<string, i64[]>();
  venueNames: Map<string, string> = new Map<string, string>();
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
    blackbox(JSON.parse<Citm>(prettyJson));
  },
  2000,
  utf8ByteLength(prettyJson),
);
dumpToFile("citm_catalog-lazy-pretty", "deserialize");

bench(
  "Deserialize CITM Lazy (min)",
  () => {
    blackbox(JSON.parse<Citm>(minJson));
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
