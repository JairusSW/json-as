import { JSON } from "..";
import { expect } from "../__tests__/lib";
import { deserializeStringToField_SWAR } from "../deserialize/swar/string";
import { atoi } from "../util/atoi";
import { bench, blackbox, dumpToFile } from "./lib/bench";

const TRUE_WORD: u64 = 28429475166421108;
const FALSE_WORD: u64 = 32370086184550502;


@inline
function failParse(): void {
  throw new Error("Failed to parse JSON");
}


@inline
function parseBoolField(srcStart: usize, dstFieldPtr: usize): usize {
  if (load<u64>(srcStart) == TRUE_WORD) {
    store<bool>(dstFieldPtr, true);
    return srcStart + 8;
  }

  if (load<u64>(srcStart) == FALSE_WORD && load<u16>(srcStart, 8) == 101) {
    store<bool>(dstFieldPtr, false);
    return srcStart + 10;
  }

  failParse();
  return srcStart;
}


@inline
function deserializeIntegerField<T extends number>(srcStart: usize, srcEnd: usize, fieldPtr: usize): usize {
  let valueEnd = srcStart;
  if (load<u16>(valueEnd) == 45) {
    valueEnd += 2;
    if (valueEnd >= srcEnd) failParse();
  }

  let digit = <u32>load<u16>(valueEnd) - 48;
  if (digit > 9) failParse();
  valueEnd += 2;

  while (valueEnd < srcEnd) {
    digit = <u32>load<u16>(valueEnd) - 48;
    if (digit > 9) break;
    valueEnd += 2;
  }

  store<T>(fieldPtr, atoi<T>(srcStart, valueEnd));
  return valueEnd;
}


@inline
function parseStringArray_FAST(srcStart: usize, srcEnd: usize, out: Array<string>): usize {
  if (load<u16>(srcStart) != 91) failParse();

  let index = 0;
  srcStart += 2;

  if (load<u16>(srcStart) == 93) {
    out.length = 0;
    return srcStart + 2;
  }

  while (true) {
    if (index >= out.length) out.push("");
    srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, out.dataStart + ((<usize>index) << alignof<string>()));
    index++;

    const code = load<u16>(srcStart);
    if (code == 44) {
      srcStart += 2;
      continue;
    }
    if (code == 93) {
      out.length = index;
      return srcStart + 2;
    }
    failParse();
  }
}


@json
class UserPreferences {
  theme!: string;
  notifications!: boolean;
  language!: string;
  timezone!: string;
  privacy_level!: string;
  two_factor_enabled!: boolean;


  @inline
  __DESERIALIZE<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): usize {
    const dst = changetype<usize>(out);

    if (load<u64>(srcStart, 0) != 29273895796342907 || load<u64>(srcStart, 8) != 9570583007002725 || load<u16>(srcStart, 16) != 58) failParse();
    srcStart += 18;
    srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("theme"));

    if (load<u64>(srcStart, 0) != 31244194863513644 || load<u64>(srcStart, 8) != 29555310648164468 || load<u64>(srcStart, 16) != 29555370777182307 || load<u64>(srcStart, 24) != 9570643136610415 || load<u16>(srcStart, 32) != 58) failParse();
    srcStart += 34;
    srcStart = parseBoolField(srcStart, dst + offsetof<this>("notifications"));

    if (load<u64>(srcStart, 0) != 27303536599629868 || load<u64>(srcStart, 8) != 27303575258857582 || load<u64>(srcStart, 16) != 16325694684725351) failParse();
    srcStart += 24;
    srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("language"));

    if (load<u64>(srcStart, 0) != 29555370773053484 || load<u64>(srcStart, 8) != 31244246407512173 || load<u64>(srcStart, 16) != 16325694684725358) failParse();
    srcStart += 24;
    srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("timezone"));

    if (load<u64>(srcStart, 0) != 32088628383580204 || load<u64>(srcStart, 8) != 27866439313916009 || load<u64>(srcStart, 16) != 28429436510470265 || load<u64>(srcStart, 24) != 9570613071249526 || load<u16>(srcStart, 32) != 58) failParse();
    srcStart += 34;
    srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("privacy_level"));

    if (load<u64>(srcStart, 0) != 33496020447002668 || load<u64>(srcStart, 8) != 27303510833823855 || load<u64>(srcStart, 16) != 32088624093986915 || load<u64>(srcStart, 24) != 27303545193955423 || load<u64>(srcStart, 32) != 28147931469840482 || load<u32>(srcStart, 40) != 3801122) failParse();
    srcStart += 44;
    srcStart = parseBoolField(srcStart, dst + offsetof<this>("two_factor_enabled"));

    if (load<u16>(srcStart) != 125) failParse();
    return srcStart + 2;
  }
}


@json
class RecentActivity {
  action!: string;
  timestamp!: string;
  target!: string;


  @inline
  __DESERIALIZE<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): usize {
    const dst = changetype<usize>(out);

    if (load<u64>(srcStart, 0) != 27866439308411003 || load<u64>(srcStart, 8) != 30962724186423412 || load<u32>(srcStart, 16) != 3801122) failParse();
    srcStart += 20;
    srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("action"));

    if (load<u64>(srcStart, 0) != 29555370773053484 || load<u64>(srcStart, 8) != 32651591226294381 || load<u64>(srcStart, 16) != 9570630251642977 || load<u16>(srcStart, 24) != 58) failParse();
    srcStart += 26;
    srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("timestamp"));

    if (load<u64>(srcStart, 0) != 27303570959368236 || load<u64>(srcStart, 8) != 32651531096883314 || load<u32>(srcStart, 16) != 3801122) failParse();
    srcStart += 20;
    srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("target"));

    if (load<u16>(srcStart) != 125) failParse();
    return srcStart + 2;
  }
}


@inline
function parseRecentActivityArray(srcStart: usize, srcEnd: usize, out: Array<RecentActivity>): usize {
  if (load<u16>(srcStart) != 91) failParse();

  let index = 0;
  srcStart += 2;

  if (load<u16>(srcStart) == 93) {
    out.length = 0;
    return srcStart + 2;
  }

  while (true) {
    let value: RecentActivity;

    if (index < out.length) {
      value = unchecked(out[index]);
      if (changetype<usize>(value) == 0) {
        value = new RecentActivity();
        unchecked((out[index] = value));
      }
    } else {
      value = new RecentActivity();
      out.push(value);
    }

    srcStart = value.__DESERIALIZE<RecentActivity>(srcStart, srcEnd, value);
    index++;

    const code = load<u16>(srcStart);
    if (code == 44) {
      srcStart += 2;
      continue;
    }
    if (code == 93) {
      out.length = index;
      return srcStart + 2;
    }
    failParse();
  }
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


  @inline
  __DESERIALIZE<__JSON_T>(srcStart: usize, srcEnd: usize, out: __JSON_T): usize {
    const dst = changetype<usize>(out);

    if (load<u64>(srcStart, 0) != 28147948644860027 || load<u32>(srcStart, 8) != 3801122) failParse();
    srcStart += 12;
    srcStart = deserializeIntegerField<i32>(srcStart, srcEnd, dst + offsetof<this>("id"));

    if (load<u64>(srcStart, 0) != 32370124835127340 || load<u64>(srcStart, 8) != 27303545194807397 || load<u64>(srcStart, 16) != 16325694684725357) failParse();
    srcStart += 24;
    srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("username"));

    if (load<u64>(srcStart, 0) != 32933010364039212 || load<u64>(srcStart, 8) != 30962655467143276 || load<u64>(srcStart, 16) != 9570583007002721 || load<u16>(srcStart, 24) != 58) failParse();
    srcStart += 26;
    srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("full_name"));

    if (load<u64>(srcStart, 0) != 30681206255386668 || load<u64>(srcStart, 8) != 9570613071511649 || load<u16>(srcStart, 16) != 58) failParse();
    srcStart += 18;
    srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("email"));

    if (load<u64>(srcStart, 0) != 33214463865913388 || load<u64>(srcStart, 8) != 32088563964444769 || load<u64>(srcStart, 16) != 30399787118690399 || load<u32>(srcStart, 24) != 3801122) failParse();
    srcStart += 28;
    srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("avatar_url"));

    if (load<u64>(srcStart, 0) != 29555293463642156 || load<u32>(srcStart, 8) != 2228335 || load<u16>(srcStart, 12) != 58) failParse();
    srcStart += 14;
    srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("bio"));

    if (load<u64>(srcStart, 0) != 28429483751112748 || load<u64>(srcStart, 8) != 32651548277538914 || load<u32>(srcStart, 16) != 2228325 || load<u16>(srcStart, 20) != 58) failParse();
    srcStart += 22;
    srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("website"));

    if (load<u64>(srcStart, 0) != 31244186273579052 || load<u64>(srcStart, 8) != 29555370777182307 || load<u64>(srcStart, 16) != 16325694685315183) failParse();
    srcStart += 24;
    srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("location"));

    if (load<u64>(srcStart, 0) != 31244177683644460 || load<u64>(srcStart, 8) != 28147931469971561 || load<u64>(srcStart, 16) != 9570647430725727 || load<u16>(srcStart, 24) != 58) failParse();
    srcStart += 26;
    srcStart = deserializeStringToField_SWAR<string>(srcStart, srcEnd, dst + offsetof<this>("joined_at"));

    if (load<u64>(srcStart, 0) != 32370073295519788 || load<u64>(srcStart, 8) != 32088581144445023 || load<u64>(srcStart, 16) != 28429423626027113 || load<u32>(srcStart, 24) != 2228324 || load<u16>(srcStart, 28) != 58) failParse();
    srcStart += 30;
    srcStart = parseBoolField(srcStart, dst + offsetof<this>("is_verified"));

    if (load<u64>(srcStart, 0) != 32370073295519788 || load<u64>(srcStart, 8) != 28429462281388127 || load<u64>(srcStart, 16) != 30681274979516525 || load<u32>(srcStart, 24) != 3801122) failParse();
    srcStart += 28;
    srcStart = parseBoolField(srcStart, dst + offsetof<this>("is_premium"));

    if (load<u64>(srcStart, 0) != 31244160503775276 || load<u64>(srcStart, 8) != 33495998977015916 || load<u64>(srcStart, 16) != 27866430723719269 || load<u64>(srcStart, 24) != 32651569752506479 || load<u32>(srcStart, 32) != 3801122) failParse();
    srcStart += 36;
    srcStart = deserializeIntegerField<i32>(srcStart, srcEnd, dst + offsetof<this>("follower_count"));

    if (load<u64>(srcStart, 0) != 31244160503775276 || load<u64>(srcStart, 8) != 33495998977015916 || load<u64>(srcStart, 16) != 26740565176352873 || load<u64>(srcStart, 24) != 30962749956620387 || load<u32>(srcStart, 32) != 2228340 || load<u16>(srcStart, 36) != 58) failParse();
    srcStart += 38;
    srcStart = deserializeIntegerField<i32>(srcStart, srcEnd, dst + offsetof<this>("following_count"));

    if (load<u64>(srcStart, 0) != 32088628383580204 || load<u64>(srcStart, 8) != 32088581143396453 || load<u64>(srcStart, 16) != 28429397856747621 || load<u32>(srcStart, 24) != 2228339 || load<u16>(srcStart, 28) != 58) failParse();
    srcStart += 30;
    let preferences = load<UserPreferences>(dst + offsetof<this>("preferences"));
    if (changetype<usize>(preferences) == 0) {
      preferences = new UserPreferences();
      store<UserPreferences>(dst + offsetof<this>("preferences"), preferences);
    }
    srcStart = preferences.__DESERIALIZE<UserPreferences>(srcStart, srcEnd, preferences);

    if (load<u64>(srcStart, 0) != 27303570959368236 || load<u64>(srcStart, 8) != 16325694685642855) failParse();
    srcStart += 16;
    let tags = load<Array<string>>(dst + offsetof<this>("tags"));
    if (changetype<usize>(tags) == 0) {
      tags = [];
      store<Array<string>>(dst + offsetof<this>("tags"), tags);
    }
    srcStart = parseStringArray_FAST(srcStart, srcEnd, tags);

    if (load<u64>(srcStart, 0) != 28429462276276268 || load<u64>(srcStart, 8) != 32651569751457891 || load<u64>(srcStart, 16) != 32651522506555487 || load<u64>(srcStart, 24) != 32651548277735529 || load<u32>(srcStart, 32) != 2228345 || load<u16>(srcStart, 36) != 58) failParse();
    srcStart += 38;
    let recentActivity = load<Array<RecentActivity>>(dst + offsetof<this>("recent_activity"));
    if (changetype<usize>(recentActivity) == 0) {
      recentActivity = [];
      store<Array<RecentActivity>>(dst + offsetof<this>("recent_activity"), recentActivity);
    }
    srcStart = parseRecentActivityArray(srcStart, srcEnd, recentActivity);

    if (load<u16>(srcStart) != 125) failParse();
    return srcStart + 2;
  }
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
    inline.always(reusable.__DESERIALIZE<MediumAPIResponse>(v2Ptr, v2End, reusable));
    blackbox(reusable);
  },
  10_000,
  byteLength,
);
dumpToFile("medium", "deserialize");
