// This Source Code Form is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at https://mozilla.org/MPL/2.0/.
//
// SPDX-License-Identifier: MPL-2.0
// Copyright (c) 2026 Jairus Tanaka

import { JSON } from "../..";
import { expect } from "../../__tests__/lib";
import {
  blackbox,
  bench,
  dumpToFile,
  readFile,
  utf8ByteLength,
} from "../lib/bench";

// github_events (yyjson_benchmark): 30 GitHub events. Fully modeled (no
// JSON.Raw): `payload` is a union of every event type's fields (push commits,
// fork forkee=repo, issues issue, issue_comment comment, gollum pages), so the
// eager bench materializes the whole document.

@json
class Actor {
  gravatar_id!: string;
  login!: string;
  avatar_url!: string;
  url!: string;
  id!: i64;
}


@json
class GhRepo {
  url!: string;
  id!: i64;
  name!: string;
}


@json
class CommitAuthor {
  email!: string;
  name!: string;
}


@json
class Commit {
  url!: string;
  message!: string;
  distinct!: boolean;
  sha!: string;
  author!: CommitAuthor;
}


@json
class GhUser {
  url!: string;
  gists_url!: string;
  gravatar_id!: string;
  type!: string;
  avatar_url!: string;
  subscriptions_url!: string;
  received_events_url!: string;
  organizations_url!: string;
  repos_url!: string;
  login!: string;
  id!: i64;
  starred_url!: string;
  events_url!: string;
  followers_url!: string;
  following_url!: string;
}


@json
class Forkee {
  description!: string;
  fork!: boolean;
  url!: string;
  language!: string;
  stargazers_url!: string;
  clone_url!: string;
  tags_url!: string;
  full_name!: string;
  merges_url!: string;
  forks!: i32;


  @alias("private")
  is_private!: boolean;
  git_refs_url!: string;
  archive_url!: string;
  collaborators_url!: string;
  owner!: GhUser;
  languages_url!: string;
  trees_url!: string;
  labels_url!: string;
  html_url!: string;
  pushed_at!: string;
  created_at!: string;
  has_issues!: boolean;
  forks_url!: string;
  branches_url!: string;
  commits_url!: string;
  notifications_url!: string;
  open_issues!: i32;
  contents_url!: string;
  blobs_url!: string;
  issues_url!: string;
  compare_url!: string;
  issue_events_url!: string;
  name!: string;
  updated_at!: string;
  statuses_url!: string;
  forks_count!: i32;
  assignees_url!: string;
  ssh_url!: string;


  @alias("public")
  is_public!: boolean;
  has_wiki!: boolean;
  subscribers_url!: string;
  mirror_url!: string | null;
  watchers_count!: i32;
  id!: i64;
  has_downloads!: boolean;
  git_commits_url!: string;
  downloads_url!: string;
  pulls_url!: string;
  homepage!: string | null;
  issue_comment_url!: string;
  hooks_url!: string;
  subscription_url!: string;
  milestones_url!: string;
  svn_url!: string;
  events_url!: string;
  git_tags_url!: string;
  teams_url!: string;
  comments_url!: string;
  open_issues_count!: i32;
  keys_url!: string;
  git_url!: string;
  contributors_url!: string;
  size!: i32;
  watchers!: i32;
}


@json
class PullRequestRef {
  html_url!: string | null;
  patch_url!: string | null;
  diff_url!: string | null;
}


@json
class Page {
  page_name!: string;
  html_url!: string;
  title!: string;
  sha!: string;
  summary!: string | null;
  action!: string;
}


@json
class Issue {
  user!: GhUser;
  url!: string;
  labels!: string[];
  html_url!: string;
  labels_url!: string;
  pull_request!: PullRequestRef | null;
  created_at!: string;
  closed_at!: string | null;
  milestone!: string | null;
  title!: string;
  body!: string;
  updated_at!: string;
  number!: i32;
  state!: string;
  assignee!: GhUser | null;
  id!: i64;
  events_url!: string;
  comments_url!: string;
  comments!: i32;
}


@json
class Comment {
  user!: GhUser;
  url!: string;
  issue_url!: string;
  created_at!: string;
  body!: string;
  updated_at!: string;
  id!: i64;
}

// Each event supplies a different subset of these union fields. Mark them
// optional so generated readers can preserve missing defaults without
// replaying fields already decoded before a localized fallback.
@json
class Payload {
  @optional commits!: Commit[];
  @optional distinct_size!: i32;
  @optional description!: string;
  @optional master_branch!: string;
  @optional ref!: string | null;
  @optional push_id!: i64;
  @optional ref_type!: string;
  @optional head!: string;
  @optional before!: string;
  @optional size!: i32;
  @optional forkee!: Forkee | null;
  @optional issue!: Issue | null;
  @optional action!: string;
  @optional comment!: Comment | null;
  @optional pages!: Page[];
}


@json
class GhEvent {
  type!: string;
  created_at!: string;
  actor!: Actor;
  repo!: GhRepo;


  @alias("public")
  isPublic!: boolean;
  payload!: Payload;
  id!: string;


  @optional org!: Actor | null;
}

const prettyJson = readFile(
  "./assembly/__benches__/payloads/github_events.pretty.json",
);
const minJson = readFile(
  "./assembly/__benches__/payloads/github_events.min.json",
);

expect(JSON.parse<GhEvent[]>(minJson).length).toBe(30);

const events = JSON.parse<GhEvent[]>(prettyJson);
const out = "";

bench(
  "Deserialize GitHubEvents (pretty)",
  () => {
    blackbox(JSON.parse<GhEvent[]>(prettyJson));
  },
  20000,
  utf8ByteLength(prettyJson),
);
dumpToFile("github_events-pretty", "deserialize");

bench(
  "Deserialize GitHubEvents (min)",
  () => {
    blackbox(JSON.parse<GhEvent[]>(minJson));
  },
  20000,
  utf8ByteLength(minJson),
);
dumpToFile("github_events-min", "deserialize");

bench(
  "Serialize GitHubEvents (min)",
  () => {
    blackbox(JSON.stringify(events, out));
  },
  40000,
  utf8ByteLength(minJson),
);
dumpToFile("github_events-min", "serialize");
