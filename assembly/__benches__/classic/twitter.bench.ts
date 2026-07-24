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
// struct schema - no JSON.Raw - so the eager bench really materializes every
// field. Sometimes-absent keys are marked @optional so the whole document stays
// on the fast path; retweeted_status is recursively a Status (a retweet is just
// a tweet, with no nested retweet of its own - hence @optional).

@json
class TweetMetadata {
  result_type!: string;
  iso_language_code!: string;
}


@json
class Hashtag {
  text!: string;
  indices!: i32[];
}


@json
class UrlEntity {
  url!: string;
  expanded_url!: string;
  display_url!: string;
  indices!: i32[];
}


@json
class Mention {
  screen_name!: string;
  name!: string;
  id!: i64;
  id_str!: string;
  indices!: i32[];
}


@json
class Size {
  w!: i32;
  h!: i32;
  resize!: string;
}


@json
class MediaSizes {
  medium!: Size;
  small!: Size;
  thumb!: Size;
  large!: Size;
}


@json
class Media {
  id!: i64;
  id_str!: string;
  indices!: i32[];
  media_url!: string;
  media_url_https!: string;
  url!: string;
  display_url!: string;
  expanded_url!: string;
  type!: string;
  sizes!: MediaSizes;


  @optional source_status_id!: JSON.Box<i64> | null;


  @optional source_status_id_str!: string | null;
}


@json
class Entities {
  hashtags!: Hashtag[];
  symbols!: string[];
  urls!: UrlEntity[];
  user_mentions!: Mention[];


  @optional media!: Media[];
}


@json
class UrlList {
  urls!: UrlEntity[];
}


@json
class UserEntities {

  @optional url!: UrlList | null;
  description!: UrlList;
}


@json
class GeoJSON {
  type!: string;
  coordinates!: f64[];
}


@json
class Place {
  id!: string;
  url!: string;
  place_type!: string;
  name!: string;
  full_name!: string;
  country_code!: string;
  country!: string;
}

// Always null in this dataset; a nullable struct (with a representative field so
// it gets deserialize methods) sidesteps the nullable-array path while keeping
// the key modeled (no JSON.Raw).
@json
class ContributorList {
  id!: i64;
}


@json
class TweetUser {
  id!: i64;
  id_str!: string;
  name!: string;
  screen_name!: string;
  location!: string;
  description!: string;
  url!: string | null;
  entities!: UserEntities;


  @alias("protected")
  isProtected!: boolean;
  followers_count!: i32;
  friends_count!: i32;
  listed_count!: i32;
  created_at!: string;
  favourites_count!: i32;
  utc_offset!: JSON.Box<i32> | null;
  time_zone!: string | null;
  geo_enabled!: boolean;
  verified!: boolean;
  statuses_count!: i32;
  lang!: string;
  contributors_enabled!: boolean;
  is_translator!: boolean;
  is_translation_enabled!: boolean;
  profile_background_color!: string;
  profile_background_image_url!: string;
  profile_background_image_url_https!: string;
  profile_background_tile!: boolean;
  profile_image_url!: string;
  profile_image_url_https!: string;


  @optional profile_banner_url!: string;
  profile_link_color!: string;
  profile_sidebar_border_color!: string;
  profile_sidebar_fill_color!: string;
  profile_text_color!: string;
  profile_use_background_image!: boolean;
  default_profile!: boolean;
  default_profile_image!: boolean;
  following!: boolean;
  follow_request_sent!: boolean;
  notifications!: boolean;
}


@json
class Status {
  metadata!: TweetMetadata;
  created_at!: string;
  id!: i64;
  id_str!: string;
  text!: string;
  source!: string;
  truncated!: boolean;
  in_reply_to_status_id!: JSON.Box<i64> | null;
  in_reply_to_status_id_str!: string | null;
  in_reply_to_user_id!: JSON.Box<i64> | null;
  in_reply_to_user_id_str!: string | null;
  in_reply_to_screen_name!: string | null;
  user!: TweetUser;
  geo!: GeoJSON | null;
  coordinates!: GeoJSON | null;
  place!: Place | null;
  contributors!: ContributorList | null;


  @optional retweeted_status!: Status | null;
  retweet_count!: i32;
  favorite_count!: i32;
  entities!: Entities;
  favorited!: boolean;
  retweeted!: boolean;


  @optional possibly_sensitive!: boolean;
  lang!: string;
}


@json
class SearchMetadata {
  completed_in!: f64;
  max_id!: i64;
  max_id_str!: string;
  next_results!: string;
  query!: string;
  refresh_url!: string;
  count!: i32;
  since_id!: i64;
  since_id_str!: string;
}


@json
class Twitter {
  statuses!: Status[];
  search_metadata!: SearchMetadata;
}

const prettyJson = readFile(
  "./assembly/__benches__/payloads/twitter.pretty.json",
);
const minJson = readFile("./assembly/__benches__/payloads/twitter.min.json");
const outStr = "";

expect(JSON.parse<Twitter>(minJson).statuses.length).toBe(100);

const twitter = JSON.parse<Twitter>(prettyJson);

bench(
  "Deserialize Twitter (pretty)",
  () => {
    blackbox(JSON.parse<Twitter>(prettyJson));
  },
  2000,
  utf8ByteLength(prettyJson),
);
dumpToFile("twitter-pretty", "deserialize");

bench(
  "Deserialize Twitter (min)",
  () => {
    blackbox(JSON.parse<Twitter>(minJson));
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
