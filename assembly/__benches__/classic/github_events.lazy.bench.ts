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
  gravatar_id: string = "";
  login: string = "";
  avatar_url: string = "";
  url: string = "";
  id: i64 = 0;
}


@json({ lazy: "auto" })
class GhRepo {
  url: string = "";
  id: i64 = 0;
  name: string = "";
}


@json({ lazy: "auto" })
class CommitAuthor {
  email: string = "";
  name: string = "";
}


@json({ lazy: "auto" })
class Commit {
  url: string = "";
  message: string = "";
  distinct: boolean = false;
  sha: string = "";
  author: CommitAuthor = new CommitAuthor();
}


@json({ lazy: "auto" })
class GhUser {
  url: string = "";
  gists_url: string = "";
  gravatar_id: string = "";
  type: string = "";
  avatar_url: string = "";
  subscriptions_url: string = "";
  received_events_url: string = "";
  organizations_url: string = "";
  repos_url: string = "";
  login: string = "";
  id: i64 = 0;
  starred_url: string = "";
  events_url: string = "";
  followers_url: string = "";
  following_url: string = "";
}


@json({ lazy: "auto" })
class Forkee {
  description: string = "";
  fork: boolean = false;
  url: string = "";
  language: string = "";
  stargazers_url: string = "";
  clone_url: string = "";
  tags_url: string = "";
  full_name: string = "";
  merges_url: string = "";
  forks: i32 = 0;


  @alias("private")
  is_private: boolean = false;
  git_refs_url: string = "";
  archive_url: string = "";
  collaborators_url: string = "";
  owner: GhUser = new GhUser();
  languages_url: string = "";
  trees_url: string = "";
  labels_url: string = "";
  html_url: string = "";
  pushed_at: string = "";
  created_at: string = "";
  has_issues: boolean = false;
  forks_url: string = "";
  branches_url: string = "";
  commits_url: string = "";
  notifications_url: string = "";
  open_issues: i32 = 0;
  contents_url: string = "";
  blobs_url: string = "";
  issues_url: string = "";
  compare_url: string = "";
  issue_events_url: string = "";
  name: string = "";
  updated_at: string = "";
  statuses_url: string = "";
  forks_count: i32 = 0;
  assignees_url: string = "";
  ssh_url: string = "";


  @alias("public")
  is_public: boolean = false;
  has_wiki: boolean = false;
  subscribers_url: string = "";
  mirror_url: string | null = null;
  watchers_count: i32 = 0;
  id: i64 = 0;
  has_downloads: boolean = false;
  git_commits_url: string = "";
  downloads_url: string = "";
  pulls_url: string = "";
  homepage: string | null = null;
  issue_comment_url: string = "";
  hooks_url: string = "";
  subscription_url: string = "";
  milestones_url: string = "";
  svn_url: string = "";
  events_url: string = "";
  git_tags_url: string = "";
  teams_url: string = "";
  comments_url: string = "";
  open_issues_count: i32 = 0;
  keys_url: string = "";
  git_url: string = "";
  contributors_url: string = "";
  size: i32 = 0;
  watchers: i32 = 0;
}


@json({ lazy: "auto" })
class PullRequestRef {
  html_url: string | null = null;
  patch_url: string | null = null;
  diff_url: string | null = null;
}


@json({ lazy: "auto" })
class Page {
  page_name: string = "";
  html_url: string = "";
  title: string = "";
  sha: string = "";
  summary: string | null = null;
  action: string = "";
}


@json({ lazy: "auto" })
class Issue {
  user: GhUser = new GhUser();
  url: string = "";
  labels: string[] = [];
  html_url: string = "";
  labels_url: string = "";
  pull_request: PullRequestRef | null = null;
  created_at: string = "";
  closed_at: string | null = null;
  milestone: string | null = null;
  title: string = "";
  body: string = "";
  updated_at: string = "";
  number: i32 = 0;
  state: string = "";
  assignee: string | null = null;
  id: i64 = 0;
  events_url: string = "";
  comments_url: string = "";
  comments: i32 = 0;
}


@json({ lazy: "auto" })
class Comment {
  user: GhUser = new GhUser();
  url: string = "";
  issue_url: string = "";
  created_at: string = "";
  body: string = "";
  updated_at: string = "";
  id: i64 = 0;
}

// `payload` is a tagged union: each event type carries a different subset of
// these keys, in inconsistent order. It falls back to its own slow path
// per-event (via the per-class fallback) - localized, so the rest of each event
// still parses fast. (A fully-@optional payload stays on the fast path but
// currently trips a per-class-fallback memory-corruption bug - left static.)
@json({ lazy: "auto" })
class Payload {
  commits: Commit[] = [];
  distinct_size: i32 = 0;
  description: string = "";
  master_branch: string = "";
  ref: string | null = null;
  push_id: i64 = 0;
  ref_type: string = "";
  head: string = "";
  before: string = "";
  size: i32 = 0;
  forkee: Forkee | null = null;
  issue: Issue | null = null;
  action: string = "";
  comment: Comment | null = null;
  pages: Page[] = [];
}


@json({ lazy: "auto" })
class GhEvent {
  type: string = "";
  created_at: string = "";
  actor: Actor = new Actor();
  repo: GhRepo = new GhRepo();


  @alias("public")
  isPublic: boolean = false;
  payload: Payload = new Payload();
  id: string = "";


  @optional org: Actor | null = null;
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
