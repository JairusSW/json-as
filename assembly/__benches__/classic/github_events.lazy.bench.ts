// AUTO-GENERATED from the eager bench by scripts/sync-lazy-benches.mjs - do not edit by hand.
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

// github_events (yyjson_benchmark): 30 GitHub events. Fully modeled (no
// JSON.Raw): `payload` is a union of every event type's fields (push commits,
// fork forkee=repo, issues issue, issue_comment comment, gollum pages), so the
// eager bench materializes the whole document.

@json({ lazy: "auto" })
class Actor {
  gravatar_id!: string;
  login!: string;
  avatar_url!: string;
  url!: string;
  id!: i64;
}


@json({ lazy: "auto" })
class GhRepo {
  url!: string;
  id!: i64;
  name!: string;
}


@json({ lazy: "auto" })
class CommitAuthor {
  email!: string;
  name!: string;
}


@json({ lazy: "auto" })
class Commit {
  url!: string;
  message!: string;
  distinct!: boolean;
  sha!: string;
  author!: CommitAuthor;
}


@json({ lazy: "auto" })
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


@json({ lazy: "auto" })
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


@json({ lazy: "auto" })
class PullRequestRef {
  html_url!: string | null;
  patch_url!: string | null;
  diff_url!: string | null;
}


@json({ lazy: "auto" })
class Page {
  page_name!: string;
  html_url!: string;
  title!: string;
  sha!: string;
  summary!: string | null;
  action!: string;
}


@json({ lazy: "auto" })
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
  assignee!: string | null;
  id!: i64;
  events_url!: string;
  comments_url!: string;
  comments!: i32;
}


@json({ lazy: "auto" })
class Comment {
  user!: GhUser;
  url!: string;
  issue_url!: string;
  created_at!: string;
  body!: string;
  updated_at!: string;
  id!: i64;
}

// `payload` is a tagged union: each event type carries a different subset of
// these keys, in inconsistent order. It falls back to its own slow path
// per-event (via the per-class fallback) - localized, so the rest of each event
// still parses fast. (A fully-@optional payload stays on the fast path but
// currently trips a per-class-fallback memory-corruption bug - left static.)
@json({ lazy: "auto" })
class Payload {
  commits!: Commit[];
  distinct_size!: i32;
  description!: string;
  master_branch!: string;
  ref!: string | null;
  push_id!: i64;
  ref_type!: string;
  head!: string;
  before!: string;
  size!: i32;
  forkee!: Forkee | null;
  issue!: Issue | null;
  action!: string;
  comment!: Comment | null;
  pages!: Page[];
}


@json({ lazy: "auto" })
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

function touchRoot(root: GhEvent[]): f64 {
  let s = 0.0;
  for (let i = 0, n = root.length; i < n; i++) {
    const event = unchecked(root[i]);
    s += <f64>event.type.length;
    s += <f64>event.created_at.length;
    s += <f64>event.actor.login.length + <f64>event.actor.id;
    s += <f64>event.repo.name.length + <f64>event.repo.id;
    s += event.isPublic ? 1.0 : 0.0;
  }
  return s;
}

const prettyJson = readFile(
  "./assembly/__benches__/payloads/github_events.pretty.json",
);
const minJson = readFile(
  "./assembly/__benches__/payloads/github_events.min.json",
);

expect(JSON.parse<GhEvent[]>(minJson).length).toBe(30);

const events = JSON.parse<GhEvent[]>(prettyJson);

bench(
  "Deserialize GitHubEvents Lazy (pretty)",
  () => {
    const root = JSON.parse<GhEvent[]>(prettyJson);
    blackbox(touchRoot(root));
  },
  20000,
  utf8ByteLength(prettyJson),
);
dumpToFile("github_events-lazy-pretty", "deserialize");

bench(
  "Deserialize GitHubEvents Lazy (min)",
  () => {
    const root = JSON.parse<GhEvent[]>(minJson);
    blackbox(touchRoot(root));
  },
  20000,
  utf8ByteLength(minJson),
);
dumpToFile("github_events-lazy-min", "deserialize");

bench(
  "Serialize GitHubEvents Lazy (min)",
  () => {
    blackbox(JSON.stringify(events));
  },
  40000,
  utf8ByteLength(minJson),
);
dumpToFile("github_events-lazy-min", "serialize");
