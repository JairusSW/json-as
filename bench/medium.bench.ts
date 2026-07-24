import { bench, blackbox, dumpToFile, utf8ByteLength } from "./lib/bench.js";

class UserPreferences {
  theme!: string;
  notifications!: boolean;
  language!: string;
  timezone!: string;
  privacy_level!: string;
  two_factor_enabled!: boolean;
}

class RecentActivity {
  action!: string;
  timestamp!: string;
  target!: string;
}

class MediumAPIResponse {
  id!: number;
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
  follower_count!: number;
  following_count!: number;

  preferences!: UserPreferences;

  tags!: string[];

  recent_activity!: RecentActivity[];
}

const v2 = `{"id":42,"username":"jairus","full_name":"Jairus Tanaka","email":"me@jairus.dev","avatar_url":"https://avatars.githubusercontent.com/u/123456?v=4","bio":"I like compilers, elegant algorithms, bare metal, simd, and wasm.","website":"https://jairus.dev/","location":"Seattle, WA","joined_at":"2020-01-15T08:30:00Z","is_verified":true,"is_premium":true,"follower_count":61,"following_count":39,"preferences":{"theme":"dark","notifications":true,"language":"en-US","timezone":"America/Los_Angeles","privacy_level":"friends_only","two_factor_enabled":false},"tags":["typescript","webassembly","performance","rust","assemblyscript","json"],"recent_activity":[{"action":"starred","timestamp":"2025-12-22T10:15:00Z","target":"assemblyscript/json-as"},{"action":"commented","timestamp":"2025-12-22T09:42:00Z","target":"issue #142"},{"action":"pushed","timestamp":"2025-12-21T23:58:00Z","target":"main branch"},{"action":"forked","timestamp":"2025-12-21T18:20:00Z","target":"fast-json-wasm"},{"action":"created","timestamp":"2025-12-21T14:10:00Z","target":"new benchmark suite"}]}`;
const v1 = JSON.parse(v2) as MediumAPIResponse;

bench(
  "Serialize Medium API Response",
  () => {
    blackbox(JSON.stringify(v1));
  },
  500_000,
  utf8ByteLength(v2),
);
dumpToFile("medium", "serialize");

bench(
  "Deserialize Medium API Response",
  () => {
    blackbox(JSON.parse(v2));
  },
  500_000,
  utf8ByteLength(v2),
);
dumpToFile("medium", "deserialize");
