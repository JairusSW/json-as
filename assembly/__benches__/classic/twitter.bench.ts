import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import {
  blackbox,
  bench,
  dumpToFile,
  readFile,
  utf8ByteLength,
} from "../lib/bench";

// Twitter search API response (miloyip/nativejson-benchmark). Fully modeled as
// a struct schema with no JSON.Raw passthrough, so the eager bench really
// materializes the fields. retweeted_status is itself a tweet; it is a distinct
// (non-recursive) lean class — see the note above RetweetedStatus.

@json
class TweetMetadata {
  result_type: string = "";
  iso_language_code: string = "";
}


@json
class Hashtag {
  text: string = "";
  indices: i32[] = [];
}


@json
class UrlEntity {
  url: string = "";
  expanded_url: string = "";
  display_url: string = "";
  indices: i32[] = [];
}


@json
class Mention {
  screen_name: string = "";
  name: string = "";
  id: i64 = 0;
  id_str: string = "";
  indices: i32[] = [];
}


@json
class Size {
  w: i32 = 0;
  h: i32 = 0;
  resize: string = "";
}


@json
class MediaSizes {
  medium: Size = new Size();
  small: Size = new Size();
  thumb: Size = new Size();
  large: Size = new Size();
}


@json
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
  source_status_id: JSON.Box<i64> | null = null;
  source_status_id_str: string | null = null;
}


@json
class Entities {
  hashtags: Hashtag[] = [];
  symbols: string[] = [];
  urls: UrlEntity[] = [];
  user_mentions: Mention[] = [];
  media: Media[] = [];
}


@json
class UrlList {
  urls: UrlEntity[] = [];
}


@json
class UserEntities {
  url: UrlList | null = null;
  description: UrlList = new UrlList();
}


@json
class GeoJSON {
  type: string = "";
  coordinates: f64[] = [];
}


@json
class Place {
  id: string = "";
  url: string = "";
  place_type: string = "";
  name: string = "";
  full_name: string = "";
  country_code: string = "";
  country: string = "";
}


@json
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
  profile_banner_url: string = "";
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

// A retweeted tweet. json-as inlines nested struct (de)serialization, so giving
// the retweet the *full* Status tree (a second TweetUser + Entities + Media +
// MediaSizes) makes codegen blow up super-linearly. It is modeled with a lean
// user and without the deep entity nesting — still a real struct (no JSON.Raw),
// just not re-materializing the whole heavy subtree a second time.
@json
class RtUser {
  id: i64 = 0;
  id_str: string = "";
  name: string = "";
  screen_name: string = "";
  location: string = "";
  description: string = "";
  followers_count: i32 = 0;
  friends_count: i32 = 0;
  statuses_count: i32 = 0;
  verified: boolean = false;
  created_at: string = "";
  lang: string = "";
}


@json
class RetweetedStatus {
  metadata: TweetMetadata = new TweetMetadata();
  created_at: string = "";
  id: i64 = 0;
  id_str: string = "";
  text: string = "";
  source: string = "";
  truncated: boolean = false;
  user: RtUser = new RtUser();
  retweet_count: i32 = 0;
  favorite_count: i32 = 0;
  favorited: boolean = false;
  retweeted: boolean = false;
  possibly_sensitive: boolean = false;
  lang: string = "";
}


@json
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
  // `contributors` is always null in this dataset; json-as's codegen rejects a
  // nullable array field (Array<i64> | null), so the key is simply left
  // unmodeled (skipped on parse) rather than passed through as JSON.Raw.
  retweeted_status: RetweetedStatus | null = null;
  retweet_count: i32 = 0;
  favorite_count: i32 = 0;
  entities: Entities = new Entities();
  favorited: boolean = false;
  retweeted: boolean = false;
  possibly_sensitive: boolean = false;
  lang: string = "";
}


@json
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


@json
class Twitter {
  statuses: Status[] = [];
  search_metadata: SearchMetadata = new SearchMetadata();
}

const prettyJson = readFile(
  "./assembly/__benches__/payloads/twitter.pretty.json",
);
const minJson = readFile("./assembly/__benches__/payloads/twitter.min.json");
const outStr = "";
// Sanity: the schema parses the whole document on the fast path.
expect(JSON.parse<Twitter>(minJson).statuses.length).toBe(100);

const twitter = JSON.parse<Twitter>(prettyJson);

bench(
  "Deserialize Twitter (pretty)",
  () => {
    blackbox(JSON.parse<Twitter>(prettyJson, twitter));
  },
  2000,
  utf8ByteLength(prettyJson),
);
dumpToFile("twitter-pretty", "deserialize");

bench(
  "Deserialize Twitter (min)",
  () => {
    blackbox(JSON.parse<Twitter>(minJson, twitter));
  },
  2000,
  utf8ByteLength(minJson),
);
dumpToFile("twitter-min", "deserialize");

bench(
  "Serialize Twitter (min)",
  () => {
    blackbox(JSON.stringify(twitter, outStr));
  },
  4000,
  utf8ByteLength(minJson),
);
dumpToFile("twitter-min", "serialize");
