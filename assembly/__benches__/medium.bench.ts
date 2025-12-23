import { JSON } from "..";
import { expect } from "../__tests__/lib";
import { bench, blackbox, dumpToFile } from "./lib/bench";

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

const v1 = new MediumAPIResponse();
const prefs = new UserPreferences();

prefs.theme = "dark";
prefs.notifications = true;
prefs.language = "en-US";
prefs.timezone = "America/Los_Angeles";
prefs.privacy_level = "friends_only";
prefs.two_factor_enabled = false;

v1.id = 42;
v1.username = "jairus";
v1.full_name = "Jairus Tanaka";
v1.email = "me@jairus.dev";
v1.avatar_url = "https://avatars.githubusercontent.com/u/123456?v=4";
v1.bio = "I like compilers, elegant algorithms, bare metal, simd, and wasm.";
v1.website = "https://jairus.dev/";
v1.location = "Seattle, WA";
v1.joined_at = "2020-01-15T08:30:00Z";
v1.is_verified = true;
v1.is_premium = true;
v1.follower_count = 61;
v1.following_count = 39;

v1.preferences = prefs;

v1.tags = ["typescript", "webassembly", "performance", "rust", "assemblyscript", "json"];

v1.recent_activity = new Array<RecentActivity>(5);

let act0 = new RecentActivity();
act0.action = "starred";
act0.timestamp = "2025-12-22T10:15:00Z";
act0.target = "assemblyscript/json-as";
v1.recent_activity[0] = act0;

let act1 = new RecentActivity();
act1.action = "commented";
act1.timestamp = "2025-12-22T09:42:00Z";
act1.target = "issue #142";
v1.recent_activity[1] = act1;

let act2 = new RecentActivity();
act2.action = "pushed";
act2.timestamp = "2025-12-21T23:58:00Z";
act2.target = "main branch";
v1.recent_activity[2] = act2;

let act3 = new RecentActivity();
act3.action = "forked";
act3.timestamp = "2025-12-21T18:20:00Z";
act3.target = "fast-json-wasm";
v1.recent_activity[3] = act3;

let act4 = new RecentActivity();
act4.action = "created";
act4.timestamp = "2025-12-21T14:10:00Z";
act4.target = "new benchmark suite";
v1.recent_activity[4] = act4;

const v2: string = JSON.stringify<MediumAPIResponse>(v1);
const byteLength: usize = v2.length << 1;

expect(JSON.stringify(v1)).toBe(v2);
expect(JSON.stringify(JSON.parse<MediumAPIResponse>(v2))).toBe(v2);

bench(
  "Serialize Medium API Response",
  () => {
    blackbox(inline.always(JSON.stringify<MediumAPIResponse>(v1)));
  },
  500_000,
  byteLength
);
dumpToFile("medium", "serialize")

bench(
  "Deserialize Medium API Response",
  () => {
    blackbox(inline.always(JSON.parse<MediumAPIResponse>(v2)));
  },
  500_000,
  byteLength
);
dumpToFile("medium", "deserialize")