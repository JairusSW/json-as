import { bench, blackbox, dumpToFile } from "./lib/bench.js";

class UserPreferences {
  theme: string = "dark";
  notifications: boolean = true;
  language: string = "en-US";
  timezone: string = "America/Los_Angeles";
  privacy_level: string = "friends_only";
  two_factor_enabled: boolean = false;
}

class RecentActivity {
  action: string = "";
  timestamp: string = "";
  target: string = "";
}

class MediumAPIResponse {
  id: number = 42;
  username: string = "jairus";
  full_name: string = "Jairus Tanaka";
  email: string = "me@jairus.dev";
  avatar_url: string = "https://avatars.githubusercontent.com/u/123456?v=4";
  bio: string = "I like compilers, elegant algorithms, bare metal, simd, and wasm.";
  website: string = "https://jairus.dev/";
  location: string = "Seattle, WA";
  joined_at: string = "2020-01-15T08:30:00Z";
  is_verified: boolean = true;
  is_premium: boolean = true;
  follower_count: number = 61;
  following_count: number = 39;

  preferences: UserPreferences = new UserPreferences();

  tags: string[] = ["typescript", "webassembly", "performance", "rust", "assemblyscript", "json"];

  recent_activity: RecentActivity[] = [
    { action: "starred", timestamp: "2025-12-22T10:15:00Z", target: "assemblyscript/json-as" },
    { action: "commented", timestamp: "2025-12-22T09:42:00Z", target: "issue #142" },
    { action: "pushed", timestamp: "2025-12-21T23:58:00Z", target: "main branch" },
    { action: "forked", timestamp: "2025-12-21T18:20:00Z", target: "fast-json-wasm" },
    { action: "created", timestamp: "2025-12-21T14:10:00Z", target: "new benchmark suite" },
  ];
}

const v1 = new MediumAPIResponse();

const v2 = JSON.stringify(v1);

bench(
  "Serialize Medium API Response",
  () => {
    blackbox(JSON.stringify(v1));
  },
  500_000,
  v2.length << 1
);
dumpToFile("medium", "serialize")

bench(
  "Deserialize Medium API Response",
  () => {
    blackbox(JSON.parse(v2));
  },
  500_000,
  v2.length << 1
);
dumpToFile("medium", "deserialize")