import { JSON } from "../..";
import { bench, blackbox, dumpToFile, utf8ByteLength } from "../lib/bench";

// Lazy mode access patterns. For each canonical payload (vec3/token/small/
// medium/large) we compare a fully-eager SWAR parse (the baseline) against a
// lazy parse that reads a growing slice of its N deferred fields:
//   none -> parse skeleton only, never materialize a deferred field
//   one  -> read a single deferred field
//   half -> read round(N / 2) deferred fields
//   all  -> touch every deferred field (work is deferred, not removed)
//
// Fields are marked deferrable with explicit `@lazy` (per the maintainer's
// request) rather than class-level `lazy: "auto"`, so each payload has a known
// deferred-field count regardless of the auto threshold. The dedicated chart
// (build-chart15.ts) reads the SWAR logs only — lazy is showcased in SWAR.
//
// Dumps: lzap-<payload>.{base,none,one,half,all}.

// ============================= vec3 (19b, N=3) ============================
// Deferred: x, y, z. none=0, one=1, half=2, all=3.

@json
class Vec3E {
  public x!: i32;
  public y!: i32;
  public z!: i32;
}


@json
class Vec3L {

  @lazy public x!: i32;


  @lazy public y!: i32;


  @lazy public z!: i32;
}

const vec3Json = JSON.stringify<Vec3E>({ x: 1, y: 2, z: 3 });
const vec3Bytes = utf8ByteLength(vec3Json);
const VEC3_ITER: u32 = 5_000_000;

bench(
  "vec3 baseline",
  () => {
    blackbox(changetype<usize>(JSON.parse<Vec3E>(vec3Json)));
  },
  VEC3_ITER,
  vec3Bytes,
);
dumpToFile("lzap-vec3", "base");
bench(
  "vec3 read none",
  () => {
    blackbox(changetype<usize>(JSON.parse<Vec3L>(vec3Json)));
  },
  VEC3_ITER,
  vec3Bytes,
);
dumpToFile("lzap-vec3", "none");
bench(
  "vec3 read one",
  () => {
    blackbox(JSON.parse<Vec3L>(vec3Json).x);
  },
  VEC3_ITER,
  vec3Bytes,
);
dumpToFile("lzap-vec3", "one");
bench(
  "vec3 read half",
  () => {
    const o = JSON.parse<Vec3L>(vec3Json);
    blackbox(o.x + o.y);
  },
  VEC3_ITER,
  vec3Bytes,
);
dumpToFile("lzap-vec3", "half");
bench(
  "vec3 read all",
  () => {
    const o = JSON.parse<Vec3L>(vec3Json);
    blackbox(o.x + o.y + o.z);
  },
  VEC3_ITER,
  vec3Bytes,
);
dumpToFile("lzap-vec3", "all");

// ============================ token (49b, N=2) ============================
// Deferred: uid, token. none=0, one=1, half=1, all=2.

@json
class TokenE {
  uid: u32 = 256;
  token: string = "dewf32df@#G43g3Gs!@3sdfDS#2";
}


@json
class TokenL {

  @lazy uid: u32 = 256;


  @lazy token: string = "dewf32df@#G43g3Gs!@3sdfDS#2";
}

const tokenJson = JSON.stringify<TokenE>(new TokenE());
const tokenBytes = utf8ByteLength(tokenJson);
const TOKEN_ITER: u32 = 5_000_000;

bench(
  "token baseline",
  () => {
    blackbox(changetype<usize>(JSON.parse<TokenE>(tokenJson)));
  },
  TOKEN_ITER,
  tokenBytes,
);
dumpToFile("lzap-token", "base");
bench(
  "token read none",
  () => {
    blackbox(changetype<usize>(JSON.parse<TokenL>(tokenJson)));
  },
  TOKEN_ITER,
  tokenBytes,
);
dumpToFile("lzap-token", "none");
bench(
  "token read one",
  () => {
    blackbox(JSON.parse<TokenL>(tokenJson).uid);
  },
  TOKEN_ITER,
  tokenBytes,
);
dumpToFile("lzap-token", "one");
bench(
  "token read half",
  () => {
    blackbox(JSON.parse<TokenL>(tokenJson).uid);
  },
  TOKEN_ITER,
  tokenBytes,
);
dumpToFile("lzap-token", "half");
bench(
  "token read all",
  () => {
    const o = JSON.parse<TokenL>(tokenJson);
    blackbox(o.uid + o.token.length);
  },
  TOKEN_ITER,
  tokenBytes,
);
dumpToFile("lzap-token", "all");

// ============================ small (108b, N=4) ===========================
// Deferred: user_id, username, role, expires_at (authenticated stays eager).
// none=0, one=1, half=2, all=4.

@json
class SmallE {
  authenticated: boolean = true;
  user_id: i32 = 8472;
  username: string = "jairus";
  role: string = "admin";
  expires_at: string = "2025-12-23T04:30:00Z";
}


@json
class SmallL {
  authenticated: boolean = true;


  @lazy user_id: i32 = 8472;


  @lazy username: string = "jairus";


  @lazy role: string = "admin";


  @lazy expires_at: string = "2025-12-23T04:30:00Z";
}

const smallJson = JSON.stringify<SmallE>(new SmallE());
const smallBytes = utf8ByteLength(smallJson);
const SMALL_ITER: u32 = 2_000_000;

bench(
  "small baseline",
  () => {
    blackbox(changetype<usize>(JSON.parse<SmallE>(smallJson)));
  },
  SMALL_ITER,
  smallBytes,
);
dumpToFile("lzap-small", "base");
bench(
  "small read none",
  () => {
    blackbox(changetype<usize>(JSON.parse<SmallL>(smallJson)));
  },
  SMALL_ITER,
  smallBytes,
);
dumpToFile("lzap-small", "none");
bench(
  "small read one",
  () => {
    blackbox(JSON.parse<SmallL>(smallJson).user_id);
  },
  SMALL_ITER,
  smallBytes,
);
dumpToFile("lzap-small", "one");
bench(
  "small read half",
  () => {
    const o = JSON.parse<SmallL>(smallJson);
    blackbox(o.user_id + o.username.length);
  },
  SMALL_ITER,
  smallBytes,
);
dumpToFile("lzap-small", "half");
bench(
  "small read all",
  () => {
    const o = JSON.parse<SmallL>(smallJson);
    blackbox(
      o.user_id + o.username.length + o.role.length + o.expires_at.length,
    );
  },
  SMALL_ITER,
  smallBytes,
);
dumpToFile("lzap-small", "all");

// =========================== medium (1.1kb, N=4) ==========================
// Deferred: bio, website, tags, recent_activity. none=0, one=1, half=2, all=4.

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
class MediumE {
  id: i32 = 42;
  username: string = "jairus";
  full_name: string = "Jairus Tanaka";
  email: string = "me@jairus.dev";
  avatar_url: string = "https://avatars.githubusercontent.com/u/123456?v=4";
  bio: string =
    "I like compilers, elegant algorithms, bare metal, simd, and wasm.";
  website: string = "https://jairus.dev/";
  location: string = "Seattle, WA";
  joined_at: string = "2020-01-15T08:30:00Z";
  is_verified: boolean = true;
  is_premium: boolean = true;
  follower_count: i32 = 61;
  following_count: i32 = 39;
  preferences: UserPreferences = new UserPreferences();
  tags: string[] = [
    "typescript",
    "webassembly",
    "performance",
    "rust",
    "assemblyscript",
    "json",
  ];
  recent_activity: RecentActivity[] = [
    new RecentActivity(),
    new RecentActivity(),
    new RecentActivity(),
    new RecentActivity(),
    new RecentActivity(),
  ];
}


@json
class MediumL {
  id: i32 = 42;
  username: string = "jairus";
  full_name: string = "Jairus Tanaka";
  email: string = "me@jairus.dev";
  avatar_url: string = "https://avatars.githubusercontent.com/u/123456?v=4";


  @lazy bio: string =
    "I like compilers, elegant algorithms, bare metal, simd, and wasm.";


  @lazy website: string = "https://jairus.dev/";
  location: string = "Seattle, WA";
  joined_at: string = "2020-01-15T08:30:00Z";
  is_verified: boolean = true;
  is_premium: boolean = true;
  follower_count: i32 = 61;
  following_count: i32 = 39;
  preferences: UserPreferences = new UserPreferences();


  @lazy tags: string[] = [
    "typescript",
    "webassembly",
    "performance",
    "rust",
    "assemblyscript",
    "json",
  ];


  @lazy recent_activity: RecentActivity[] = [
    new RecentActivity(),
    new RecentActivity(),
    new RecentActivity(),
    new RecentActivity(),
    new RecentActivity(),
  ];
}

const mediumJson = JSON.stringify<MediumE>(new MediumE());
const mediumBytes = utf8ByteLength(mediumJson);
const MEDIUM_ITER: u32 = 1_000_000;

bench(
  "medium baseline",
  () => {
    blackbox(changetype<usize>(JSON.parse<MediumE>(mediumJson)));
  },
  MEDIUM_ITER,
  mediumBytes,
);
dumpToFile("lzap-medium", "base");
bench(
  "medium read none",
  () => {
    blackbox(changetype<usize>(JSON.parse<MediumL>(mediumJson)));
  },
  MEDIUM_ITER,
  mediumBytes,
);
dumpToFile("lzap-medium", "none");
bench(
  "medium read one",
  () => {
    blackbox(JSON.parse<MediumL>(mediumJson).bio.length);
  },
  MEDIUM_ITER,
  mediumBytes,
);
dumpToFile("lzap-medium", "one");
bench(
  "medium read half",
  () => {
    const o = JSON.parse<MediumL>(mediumJson);
    blackbox(o.bio.length + o.website.length);
  },
  MEDIUM_ITER,
  mediumBytes,
);
dumpToFile("lzap-medium", "half");
bench(
  "medium read all",
  () => {
    const o = JSON.parse<MediumL>(mediumJson);
    blackbox(
      o.bio.length +
        o.website.length +
        o.tags.length +
        o.recent_activity.length,
    );
  },
  MEDIUM_ITER,
  mediumBytes,
);
dumpToFile("lzap-medium", "all");

// ============================ large (5.5kb, N=4) ==========================
// Deferred: owner, html_url, topics, default_branch. none=0, one=1, half=2, all=4.

@json
class RepoOwner {
  public login: string = "octocat";
  public id: i32 = 583231;
  public node_id: string = "MDQ6VXNlcjU4MzIzMQ==";
  public avatar_url: string =
    "https://avatars.githubusercontent.com/u/583231?v=4";
  public gravatar_id: string = "";
  public url: string = "https://api.github.com/users/octocat";
  public html_url: string = "https://github.com/octocat";
  public type: string = "User";
  public site_admin: boolean = false;
}


@json
class RepoLicense {
  public key: string = "";
  public name: string = "";
  public spdx_id: string = "";
  public url: string | null = null;
  public node_id: string = "";
}


@json
class RepoE {
  public id: i32 = 132935648;
  public node_id: string = "MDEwOlJlcG9zaXRvcnkxMzI5MzU2NDg=";
  public name: string = "boysenberry-repo-1";
  public full_name: string = "octocat/boysenberry-repo-1";
  public private: boolean = true;
  public owner: RepoOwner = new RepoOwner();
  public html_url: string = "https://github.com/octocat/boysenberry-repo-1";
  public description: string | null = "Testing";
  public fork: boolean = true;
  public url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1";
  public created_at: string = "2018-05-10T17:51:29Z";
  public updated_at: string = "2025-05-24T02:01:19Z";
  public pushed_at: string = "2024-05-26T07:02:05Z";
  public homepage: string | null = "";
  public size: i32 = 4;
  public stargazers_count: i32 = 332;
  public watchers_count: i32 = 332;
  public language: string | null = null;
  public has_issues: boolean = false;
  public forks_count: i32 = 20;
  public license: RepoLicense | null = null;
  public allow_forking: boolean = true;
  public topics: string[] = ["wasm", "json", "simd", "assemblyscript"];
  public visibility: string = "public";
  public forks: i32 = 20;
  public open_issues: i32 = 1;
  public watchers: i32 = 332;
  public default_branch: string = "master";
}


@json
class RepoL {
  public id: i32 = 132935648;
  public node_id: string = "MDEwOlJlcG9zaXRvcnkxMzI5MzU2NDg=";
  public name: string = "boysenberry-repo-1";
  public full_name: string = "octocat/boysenberry-repo-1";
  public private: boolean = true;


  @lazy public owner: RepoOwner = new RepoOwner();


  @lazy public html_url: string =
    "https://github.com/octocat/boysenberry-repo-1";
  public description: string | null = "Testing";
  public fork: boolean = true;
  public url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1";
  public created_at: string = "2018-05-10T17:51:29Z";
  public updated_at: string = "2025-05-24T02:01:19Z";
  public pushed_at: string = "2024-05-26T07:02:05Z";
  public homepage: string | null = "";
  public size: i32 = 4;
  public stargazers_count: i32 = 332;
  public watchers_count: i32 = 332;
  public language: string | null = null;
  public has_issues: boolean = false;
  public forks_count: i32 = 20;
  public license: RepoLicense | null = null;
  public allow_forking: boolean = true;


  @lazy public topics: string[] = ["wasm", "json", "simd", "assemblyscript"];
  public visibility: string = "public";
  public forks: i32 = 20;
  public open_issues: i32 = 1;
  public watchers: i32 = 332;


  @lazy public default_branch: string = "master";
}

const largeJson = JSON.stringify<RepoE>(new RepoE());
const largeBytes = utf8ByteLength(largeJson);
const LARGE_ITER: u32 = 500_000;

bench(
  "large baseline",
  () => {
    blackbox(changetype<usize>(JSON.parse<RepoE>(largeJson)));
  },
  LARGE_ITER,
  largeBytes,
);
dumpToFile("lzap-large", "base");
bench(
  "large read none",
  () => {
    blackbox(changetype<usize>(JSON.parse<RepoL>(largeJson)));
  },
  LARGE_ITER,
  largeBytes,
);
dumpToFile("lzap-large", "none");
bench(
  "large read one",
  () => {
    blackbox(JSON.parse<RepoL>(largeJson).owner.id);
  },
  LARGE_ITER,
  largeBytes,
);
dumpToFile("lzap-large", "one");
bench(
  "large read half",
  () => {
    const o = JSON.parse<RepoL>(largeJson);
    blackbox(o.owner.id + o.html_url.length);
  },
  LARGE_ITER,
  largeBytes,
);
dumpToFile("lzap-large", "half");
bench(
  "large read all",
  () => {
    const o = JSON.parse<RepoL>(largeJson);
    blackbox(
      o.owner.id +
        o.html_url.length +
        o.topics.length +
        o.default_branch.length,
    );
  },
  LARGE_ITER,
  largeBytes,
);
dumpToFile("lzap-large", "all");
