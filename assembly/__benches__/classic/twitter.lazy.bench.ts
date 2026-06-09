// AUTO-GENERATED from the eager bench by scripts/sync-lazy-benches.mjs — do not edit by hand.
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

// Twitter search API response (miloyip/nativejson-benchmark). Fully modeled as a
// struct schema — no JSON.Raw — so the lazy bench really materializes every
// field. Sometimes-absent keys are marked @optional so the whole document stays
// on the fast path; retweeted_status is recursively a Status (a retweet is just
// a tweet, with no nested retweet of its own — hence @optional).

@json({ lazy: "auto" })
class TweetMetadata {
  result_type: string = "";
  iso_language_code: string = "";
}


@json({ lazy: "auto" })
class Hashtag {
  text: string = "";
  indices: i32[] = [];
}


@json({ lazy: "auto" })
class UrlEntity {
  url: string = "";
  expanded_url: string = "";
  display_url: string = "";
  indices: i32[] = [];
}


@json({ lazy: "auto" })
class Mention {
  screen_name: string = "";
  name: string = "";
  id: i64 = 0;
  id_str: string = "";
  indices: i32[] = [];
}


@json({ lazy: "auto" })
class Size {
  w: i32 = 0;
  h: i32 = 0;
  resize: string = "";
}


@json({ lazy: "auto" })
class MediaSizes {
  medium: Size = new Size();
  small: Size = new Size();
  thumb: Size = new Size();
  large: Size = new Size();
}


@json({ lazy: "auto" })
class Media {
  id: i64 = 0;
  id_str: string = "";
  indices: i32[] = [];
  media_url: string = "";
  media_url_https: string = "";
  url: string = "";
  display_url: string = "";
  expanded_url: string = "";
  type: string = "";
  sizes: MediaSizes = new MediaSizes();


  @optional source_status_id: JSON.Box<i64> | null = null;


  @optional source_status_id_str: string | null = null;
}


@json({ lazy: "auto" })
class Entities {
  hashtags: Hashtag[] = [];
  symbols: string[] = [];
  urls: UrlEntity[] = [];
  user_mentions: Mention[] = [];


  @optional media: Media[] = [];
}


@json({ lazy: "auto" })
class UrlList {
  urls: UrlEntity[] = [];
}


@json({ lazy: "auto" })
class UserEntities {

  @optional url: UrlList | null = null;
  description: UrlList = new UrlList();
}


@json({ lazy: "auto" })
class GeoJSON {
  type: string = "";
  coordinates: f64[] = [];
}


@json({ lazy: "auto" })
class Place {
  id: string = "";
  url: string = "";
  place_type: string = "";
  name: string = "";
  full_name: string = "";
  country_code: string = "";
  country: string = "";
}

// Always null in this dataset; a nullable struct (with a representative field so
// it gets deserialize methods) sidesteps the nullable-array path while keeping
// the key modeled (no JSON.Raw).
@json({ lazy: "auto" })
class ContributorList {
  id: i64 = 0;
}


@json({ lazy: "auto" })
class TweetUser {
  id: i64 = 0;
  id_str: string = "";
  name: string = "";
  screen_name: string = "";
  location: string = "";
  description: string = "";
  url: string | null = null;
  entities: UserEntities = new UserEntities();


  @alias("protected")
  isProtected: boolean = false;
  followers_count: i32 = 0;
  friends_count: i32 = 0;
  listed_count: i32 = 0;
  created_at: string = "";
  favourites_count: i32 = 0;
  utc_offset: JSON.Box<i32> | null = null;
  time_zone: string | null = null;
  geo_enabled: boolean = false;
  verified: boolean = false;
  statuses_count: i32 = 0;
  lang: string = "";
  contributors_enabled: boolean = false;
  is_translator: boolean = false;
  is_translation_enabled: boolean = false;
  profile_background_color: string = "";
  profile_background_image_url: string = "";
  profile_background_image_url_https: string = "";
  profile_background_tile: boolean = false;
  profile_image_url: string = "";
  profile_image_url_https: string = "";


  @optional profile_banner_url: string = "";
  profile_link_color: string = "";
  profile_sidebar_border_color: string = "";
  profile_sidebar_fill_color: string = "";
  profile_text_color: string = "";
  profile_use_background_image: boolean = false;
  default_profile: boolean = false;
  default_profile_image: boolean = false;
  following: boolean = false;
  follow_request_sent: boolean = false;
  notifications: boolean = false;
}


@json({ lazy: "auto" })
class Status {
  metadata: TweetMetadata = new TweetMetadata();
  created_at: string = "";
  id: i64 = 0;
  id_str: string = "";
  text: string = "";
  source: string = "";
  truncated: boolean = false;
  in_reply_to_status_id: JSON.Box<i64> | null = null;
  in_reply_to_status_id_str: string | null = null;
  in_reply_to_user_id: JSON.Box<i64> | null = null;
  in_reply_to_user_id_str: string | null = null;
  in_reply_to_screen_name: string | null = null;
  user: TweetUser = new TweetUser();
  geo: GeoJSON | null = null;
  coordinates: GeoJSON | null = null;
  place: Place | null = null;
  contributors: ContributorList | null = null;


  @optional retweeted_status: Status | null = null;
  retweet_count: i32 = 0;
  favorite_count: i32 = 0;
  entities: Entities = new Entities();
  favorited: boolean = false;
  retweeted: boolean = false;


  @optional possibly_sensitive: boolean = false;
  lang: string = "";
}


@json({ lazy: "auto" })
class SearchMetadata {
  completed_in: f64 = 0;
  max_id: i64 = 0;
  max_id_str: string = "";
  next_results: string = "";
  query: string = "";
  refresh_url: string = "";
  count: i32 = 0;
  since_id: i64 = 0;
  since_id_str: string = "";
}


@json({ lazy: "auto" })
class Twitter {
  statuses: Status[] = [];
  search_metadata: SearchMetadata = new SearchMetadata();
}

const prettyJson = readFile(
  "./assembly/__benches__/payloads/twitter.pretty.json",
);
const minJson = readFile("./assembly/__benches__/payloads/twitter.min.json");
const outStr = "";

expect(JSON.parse<Twitter>(minJson).statuses.length).toBe(100);

const twitter = JSON.parse<Twitter>(prettyJson);

bench(
  "Deserialize Twitter Lazy (pretty)",
  () => {
    blackbox(JSON.parse<Twitter>(prettyJson));
  },
  2000,
  utf8ByteLength(prettyJson),
);
dumpToFile("twitter-lazy-pretty", "deserialize");

bench(
  "Deserialize Twitter Lazy (min)",
  () => {
    blackbox(JSON.parse<Twitter>(minJson));
  },
  2000,
  utf8ByteLength(minJson),
);
dumpToFile("twitter-lazy-min", "deserialize");

bench(
  "Serialize Twitter Lazy (min)",
  () => {
    blackbox(JSON.stringify(twitter, outStr));
  },
  4000,
  utf8ByteLength(minJson),
);
dumpToFile("twitter-lazy-min", "serialize");
