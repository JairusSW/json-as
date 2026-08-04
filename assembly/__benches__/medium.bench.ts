import { JSON } from "..";
import { expect } from "../__tests__/lib";
import {
  bench,
  blackbox,
  ChangingPayloads,
  dumpToFile,
  utf8ByteLength,
} from "./lib/bench";


@json
class UserPreferences {
  theme!: string;
  notifications!: boolean;
  language!: string;
  timezone!: string;
  privacy_level!: string;
  two_factor_enabled!: boolean;
}


@json
class RecentActivity {
  action!: string;
  timestamp!: string;
  target!: string;
}


@json
class MediumAPIResponse {
  id!: i32;
  username!: string;
  full_name!: string;
  email!: string;
  avatar_url!: string;
  bio!: string;
  website!: string;
  location!: string;
  joined_at!: string;
  is_verified!: boolean;
  is_premium!: boolean;
  follower_count!: i32;
  following_count!: i32;
  preferences!: UserPreferences;
  tags!: string[];
  recent_activity!: RecentActivity[];
}

const v2 = `{"id":42,"username":"jairus","full_name":"Jairus Tanaka","email":"me@jairus.dev","avatar_url":"https://avatars.githubusercontent.com/u/123456?v=4","bio":"I like compilers, elegant algorithms, bare metal, simd, and wasm.","website":"https://jairus.dev/","location":"Seattle, WA","joined_at":"2020-01-15T08:30:00Z","is_verified":true,"is_premium":true,"follower_count":61,"following_count":39,"preferences":{"theme":"dark","notifications":true,"language":"en-US","timezone":"America/Los_Angeles","privacy_level":"friends_only","two_factor_enabled":false},"tags":["typescript","webassembly","performance","rust","assemblyscript","json"],"recent_activity":[{"action":"starred","timestamp":"2025-12-22T10:15:00Z","target":"assemblyscript/json-as"},{"action":"commented","timestamp":"2025-12-22T09:42:00Z","target":"issue #142"},{"action":"pushed","timestamp":"2025-12-21T23:58:00Z","target":"main branch"},{"action":"forked","timestamp":"2025-12-21T18:20:00Z","target":"fast-json-wasm"},{"action":"created","timestamp":"2025-12-21T14:10:00Z","target":"new benchmark suite"}]}`;
const v1 = JSON.parse<MediumAPIResponse>(v2);
const freshPayloads = new ChangingPayloads(v2);
const reusePayloads = new ChangingPayloads(v2);
const reuseTarget = JSON.parse<MediumAPIResponse>(v2);
const byteLength: usize = utf8ByteLength(v2);
expect(JSON.stringify(JSON.parse<MediumAPIResponse>(v2))).toBe(v2);
bench(
  "Serialize Medium API Response",
  () => {
    blackbox(JSON.stringify<MediumAPIResponse>(v1));
  },
  500_000,
  byteLength,
);
dumpToFile("medium", "serialize");
bench(
  "Deserialize Medium API Response",
  () => {
    blackbox(JSON.parse<MediumAPIResponse>(freshPayloads.next()));
  },
  500_000,
  byteLength,
);
dumpToFile("medium", "deserialize");
bench(
  "Deserialize Medium API Response (reuse)",
  () => {
    blackbox(JSON.parse<MediumAPIResponse>(reusePayloads.next(), reuseTarget));
  },
  500_000,
  byteLength,
);
dumpToFile("medium-reuse", "deserialize");

// Dynamic JSON.Obj variant of the same payload (typed struct vs JSON.Obj).
const objMedium = JSON.parse<JSON.Obj>(v2);
bench(
  "Serialize Medium (JSON.Obj)",
  () => {
    blackbox(JSON.stringify(objMedium));
  },
  500_000,
  byteLength,
);
dumpToFile("medium-obj", "serialize");
bench(
  "Deserialize Medium (JSON.Obj)",
  () => {
    blackbox(JSON.parse<JSON.Obj>(v2));
  },
  500_000,
  byteLength,
);
dumpToFile("medium-obj", "deserialize");
