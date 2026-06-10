// AUTO-GENERATED from the eager bench by scripts/sync-lazy-benches.mjs - do not edit by hand.
// Re-run `node scripts/sync-lazy-benches.mjs` to regenerate.
import { JSON } from "../..";
import {
  bench,
  blackbox,
  dumpToFile,
  readFile,
  utf8ByteLength,
} from "../lib/bench";

// Dynamic JSON.Obj (de)serialize of the twitter payload - schema-agnostic, for
// the JSON.Obj series on the classic charts. Deserialize parses and touches a
// simdjson partial_tweets-style subset of values so the benchmark does not measure a touch-nothing parse.
const prettyJson = readFile(
  "./assembly/__benches__/payloads/twitter.pretty.json",
);
const minJson = readFile("./assembly/__benches__/payloads/twitter.min.json");
// Parsed once (untouched) for the passthrough serialize bench.
const doc = JSON.parse<JSON.Obj>(minJson);
const TOUCH_LIMIT: i32 = 8;

function sumValue(value: JSON.Value): f64 {
  switch (value.type) {
    case JSON.Types.Null:
      return 0.0;
    case JSON.Types.Bool:
      return value.get<bool>() ? 1.0 : 0.0;
    case JSON.Types.String:
      return <f64>value.get<string>().length;
    case JSON.Types.Object:
      return sumObj(value.get<JSON.Obj>());
    case JSON.Types.Array:
      return sumArr(value.get<JSON.Arr>());
    case JSON.Types.Raw:
      return <f64>value.get<JSON.Raw>().data.length;
    default:
      return value.toString().length;
  }
}

function sumObj(root: JSON.Obj): f64 {
  const vals = root.values();
  let s = 0.0;
  const limit = vals.length < TOUCH_LIMIT ? vals.length : TOUCH_LIMIT;
  for (let i = 0, n = limit; i < n; i++) s += sumValue(unchecked(vals[i]));
  return s;
}

function sumArr(root: JSON.Arr): f64 {
  let s = 0.0;
  const limit = root.length < TOUCH_LIMIT ? root.length : TOUCH_LIMIT;
  for (let i = 0, n = limit; i < n; i++) s += sumValue(root.at(i));
  return s;
}

function sumNumberField(root: JSON.Obj, key: string): f64 {
  const value = root.get(key);
  return value === null || value.type == JSON.Types.Null
    ? 0.0
    : value.get<f64>();
}

function sumStringField(root: JSON.Obj, key: string): f64 {
  const value = root.get(key);
  return value === null || value.type == JSON.Types.Null
    ? 0.0
    : <f64>value.get<string>().length;
}

function sumPartialTweet(status: JSON.Obj): f64 {
  let s = 0.0;
  s += sumStringField(status, "created_at");
  s += sumNumberField(status, "id");
  s += sumStringField(status, "text");
  s += sumNumberField(status, "in_reply_to_status_id");
  const userValue = status.get("user");
  if (userValue !== null && userValue.type != JSON.Types.Null) {
    const user = userValue.get<JSON.Obj>();
    s += sumNumberField(user, "id");
    s += sumStringField(user, "screen_name");
  }
  s += sumNumberField(status, "retweet_count");
  s += sumNumberField(status, "favorite_count");
  return s;
}

function sumTwitterPartial(root: JSON.Obj): f64 {
  const statusesValue = root.get("statuses");
  if (statusesValue === null || statusesValue.type == JSON.Types.Null)
    return 0.0;
  const statuses = statusesValue.get<JSON.Arr>();
  let s = 0.0;
  for (let i = 0, n = statuses.length; i < n; i++) {
    s += sumPartialTweet(statuses.at(i).get<JSON.Obj>());
  }
  return s;
}

function sumFindTweet(root: JSON.Obj): f64 {
  const statusesValue = root.get("statuses");
  if (statusesValue === null || statusesValue.type == JSON.Types.Null)
    return 0.0;
  const statuses = statusesValue.get<JSON.Arr>();
  for (let i = 0, n = statuses.length; i < n; i++) {
    const status = statuses.at(i).get<JSON.Obj>();
    if (sumNumberField(status, "id") == 505874901689851904.0) {
      return sumStringField(status, "text");
    }
  }
  return 0.0;
}

function sumTopTweet(root: JSON.Obj): f64 {
  const statusesValue = root.get("statuses");
  if (statusesValue === null || statusesValue.type == JSON.Types.Null)
    return 0.0;
  const statuses = statusesValue.get<JSON.Arr>();
  let best = -1.0;
  let bestIndex = -1;
  for (let i = 0, n = statuses.length; i < n; i++) {
    const status = statuses.at(i).get<JSON.Obj>();
    const count = sumNumberField(status, "retweet_count");
    if (count <= 60.0 && count >= best) {
      best = count;
      bestIndex = i;
    }
  }
  if (bestIndex < 0) return 0.0;
  const status = statuses.at(bestIndex).get<JSON.Obj>();
  const userValue = status.get("user");
  if (userValue === null || userValue.type == JSON.Types.Null)
    return best + sumStringField(status, "text");
  return (
    best +
    sumStringField(status, "text") +
    sumStringField(userValue.get<JSON.Obj>(), "screen_name")
  );
}

function sumDistinctUserId(root: JSON.Obj): f64 {
  const statusesValue = root.get("statuses");
  if (statusesValue === null || statusesValue.type == JSON.Types.Null)
    return 0.0;
  const statuses = statusesValue.get<JSON.Arr>();
  let s = 0.0;
  for (let i = 0, n = statuses.length; i < n; i++) {
    const status = statuses.at(i).get<JSON.Obj>();
    const userValue = status.get("user");
    if (userValue !== null && userValue.type != JSON.Types.Null) {
      s += sumNumberField(userValue.get<JSON.Obj>(), "id");
    }
    const retweetedValue = status.get("retweeted_status");
    if (retweetedValue !== null && retweetedValue.type != JSON.Types.Null) {
      const retweeted = retweetedValue.get<JSON.Obj>();
      const retweetedUser = retweeted.get("user");
      if (retweetedUser !== null && retweetedUser.type != JSON.Types.Null) {
        s += sumNumberField(retweetedUser.get<JSON.Obj>(), "id");
      }
    }
  }
  return s;
}

bench(
  "Deserialize twitter (JSON.Obj, pretty)",
  () => {
    blackbox(sumTwitterPartial(JSON.parse<JSON.Obj>(prettyJson)));
  },
  2000,
  utf8ByteLength(prettyJson),
);
dumpToFile("twitter-obj-pretty", "deserialize");

bench(
  "Deserialize twitter (JSON.Obj, min)",
  () => {
    blackbox(sumTwitterPartial(JSON.parse<JSON.Obj>(minJson)));
  },
  2000,
  utf8ByteLength(minJson),
);
dumpToFile("twitter-obj-min", "deserialize");

bench(
  "Find Tweet twitter (JSON.Obj, min)",
  () => {
    blackbox(sumFindTweet(JSON.parse<JSON.Obj>(minJson)));
  },
  2000,
  utf8ByteLength(minJson),
);
dumpToFile("twitter-find_tweet-obj-min", "deserialize");

bench(
  "Top Tweet twitter (JSON.Obj, min)",
  () => {
    blackbox(sumTopTweet(JSON.parse<JSON.Obj>(minJson)));
  },
  2000,
  utf8ByteLength(minJson),
);
dumpToFile("twitter-top_tweet-obj-min", "deserialize");

bench(
  "Distinct User ID twitter (JSON.Obj, min)",
  () => {
    blackbox(sumDistinctUserId(JSON.parse<JSON.Obj>(minJson)));
  },
  2000,
  utf8ByteLength(minJson),
);
dumpToFile("twitter-distinct_user_id-obj-min", "deserialize");

bench(
  "Serialize twitter (JSON.Obj, min)",
  () => {
    blackbox(JSON.stringify(doc));
  },
  2000,
  utf8ByteLength(minJson),
);
dumpToFile("twitter-obj-min", "serialize");
