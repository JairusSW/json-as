import { JSON } from "..";
import { expect } from "../__tests__/lib";
import { bench, blackbox, dumpToFile } from "./lib/bench";


@json
class UserPreferences {
  theme: string = "dark";
  notifications: boolean = true;
  language: string = "en-US";
  timezone: string = "America/Los_Angeles";
  privacy_level: string = "friends_only";
  two_factor_enabled: boolean = false;
}


@json
class RecentActivity {
  action: string = "starred";
  timestamp: string = "2025-12-22T10:15:00Z";
  target: string = "JairusSW/json-as";
}


@json
class MediumAPIResponse {
  id: i32 = 42;
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
  follower_count: i32 = 61;
  following_count: i32 = 39;
  preferences: UserPreferences = new UserPreferences();
  tags: string[] = ["typescript", "webassembly", "performance", "rust", "assemblyscript", "json"];
  recent_activity: RecentActivity[] = [new RecentActivity(), new RecentActivity(), new RecentActivity(), new RecentActivity(), new RecentActivity()];
}


@inline
function parseIntoReusable(srcStart: usize, srcEnd: usize, out: MediumAPIResponse): void {
  // @ts-expect-error: defined by transform in SWAR/SIMD modes
  if (isDefined(out.__DESERIALIZE_FAST)) {
    // @ts-expect-error: defined by transform in SWAR/SIMD modes
    out.__DESERIALIZE_FAST<MediumAPIResponse>(srcStart, srcEnd, out);
    return;
  }
  // @ts-expect-error: defined by transform in all modes
  if (isDefined(out.__DESERIALIZE_SLOW)) {
    // @ts-expect-error: defined by transform in all modes
    out.__DESERIALIZE_SLOW<MediumAPIResponse>(srcStart, srcEnd, out);
    return;
  }
  throw new Error("Missing __DESERIALIZE_FAST/__DESERIALIZE_SLOW on MediumAPIResponse");
}

const v1 = new MediumAPIResponse();
const v2: string = JSON.stringify<MediumAPIResponse>(v1);
const byteLength: usize = v2.length;
const v2Ptr: usize = changetype<usize>(v2);
const v2End: usize = v2Ptr + byteLength;
const reusable = new MediumAPIResponse();
reusable.preferences = new UserPreferences();
reusable.tags = new Array<string>(6);
reusable.recent_activity = new Array<RecentActivity>(5);
reusable.recent_activity[0] = new RecentActivity();
reusable.recent_activity[1] = new RecentActivity();
reusable.recent_activity[2] = new RecentActivity();
reusable.recent_activity[3] = new RecentActivity();
reusable.recent_activity[4] = new RecentActivity();
expect(JSON.stringify(v1)).toBe(v2);
expect(JSON.stringify(JSON.parse<MediumAPIResponse>(v2))).toBe(v2);
bench(
  "Serialize Medium API Response",
  () => {
    blackbox(inline.always(JSON.stringify<MediumAPIResponse>(v1)));
  },
  500_000,
  byteLength,
);
dumpToFile("medium", "serialize");
bench(
  "Deserialize Medium API Response",
  () => {
    inline.always(parseIntoReusable(v2Ptr, v2End, reusable));
    blackbox(reusable);
  },
  500_000,
  byteLength,
);
dumpToFile("medium", "deserialize");
