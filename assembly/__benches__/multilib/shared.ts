import { JSON, JSONMode } from "../..";
import { readFile, utf8ByteLength } from "../lib/bench";
import { JSON as ASJ } from "assemblyscript-json/assembly";


@json
export class RepoOwner {
  public login: string = "octocat";
  public id: i32 = 583231;
  public node_id: string = "MDQ6VXNlcjU4MzIzMQ==";
  public avatar_url: string =
    "https://avatars.githubusercontent.com/u/583231?v=4";
  public gravatar_id: string = "";
  public url: string = "https://api.github.com/users/octocat";
  public html_url: string = "https://github.com/octocat";
  public followers_url: string =
    "https://api.github.com/users/octocat/followers";
  public following_url: string =
    "https://api.github.com/users/octocat/following{/other_user}";
  public gists_url: string =
    "https://api.github.com/users/octocat/gists{/gist_id}";
  public starred_url: string =
    "https://api.github.com/users/octocat/starred{/owner}{/repo}";
  public subscriptions_url: string =
    "https://api.github.com/users/octocat/subscriptions";
  public organizations_url: string =
    "https://api.github.com/users/octocat/orgs";
  public repos_url: string = "https://api.github.com/users/octocat/repos";
  public events_url: string =
    "https://api.github.com/users/octocat/events{/privacy}";
  public received_events_url: string =
    "https://api.github.com/users/octocat/received_events";
  public type: string = "User";
  public user_view_type: string = "public";
  public site_admin: boolean = false;
}


@json
export class RepoLicense {
  public key: string = "";
  public name: string = "";
  public spdx_id: string = "";
  public url: string | null = null;
  public node_id: string = "";
}


@json
export class Repo {
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
  public forks_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/forks";
  public keys_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/keys{/key_id}";
  public collaborators_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/collaborators{/collaborator}";
  public teams_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/teams";
  public hooks_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/hooks";
  public issue_events_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/issues/events{/number}";
  public events_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/events";
  public assignees_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/assignees{/user}";
  public branches_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/branches{/branch}";
  public tags_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/tags";
  public blobs_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/git/blobs{/sha}";
  public git_tags_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/git/tags{/sha}";
  public git_refs_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/git/refs{/sha}";
  public trees_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/git/trees{/sha}";
  public statuses_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/statuses/{sha}";
  public languages_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/languages";
  public stargazers_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/stargazers";
  public contributors_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/contributors";
  public subscribers_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/subscribers";
  public subscription_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/subscription";
  public commits_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/commits{/sha}";
  public git_commits_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/git/commits{/sha}";
  public comments_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/comments{/number}";
  public issue_comment_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/issues/comments{/number}";
  public contents_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/contents/{+path}";
  public compare_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/compare/{base}...{head}";
  public merges_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/merges";
  public archive_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/{archive_format}{/ref}";
  public downloads_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/downloads";
  public issues_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/issues{/number}";
  public pulls_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/pulls{/number}";
  public milestones_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/milestones{/number}";
  public notifications_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/notifications{?since,all,participating}";
  public labels_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/labels{/name}";
  public releases_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/releases{/id}";
  public deployments_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/deployments";
  public created_at: string = "2018-05-10T17:51:29Z";
  public updated_at: string = "2025-05-24T02:01:19Z";
  public pushed_at: string = "2024-05-26T07:02:05Z";
  public git_url: string = "git://github.com/octocat/boysenberry-repo-1.git";
  public ssh_url: string = "git@github.com:octocat/boysenberry-repo-1.git";
  public clone_url: string =
    "https://github.com/octocat/boysenberry-repo-1.git";
  public svn_url: string = "https://github.com/octocat/boysenberry-repo-1";
  public homepage: string | null = "";
  public size: i32 = 4;
  public stargazers_count: i32 = 332;
  public watchers_count: i32 = 332;
  public language: string | null = null;
  public has_issues: boolean = false;
  public has_projects: boolean = true;
  public has_downloads: boolean = true;
  public has_wiki: boolean = true;
  public has_pages: boolean = false;
  public has_discussions: boolean = false;
  public forks_count: i32 = 20;
  public mirror_url: string | null = null;
  public archived: boolean = false;
  public disabled: boolean = false;
  public open_issues_count: i32 = 1;
  public license: RepoLicense | null = null;
  public allow_forking: boolean = true;
  public is_template: boolean = false;
  public web_commit_signoff_required: boolean = false;
  public topics: string[] = [];
  public visibility: string = "public";
  public forks: i32 = 20;
  public open_issues: i32 = 1;
  public watchers: i32 = 332;
  public default_branch: string = "master";
}

export const payload = readFile(
  "./assembly/__benches__/payloads/multilib.json",
);
export const payloadBytes: usize = utf8ByteLength(payload);
export const payloadStart: usize = changetype<usize>(payload);
export const payloadEnd: usize = payloadStart + (payload.length << 1);
export const structValue = JSON.parse<Repo>(payload);
export const objValue = JSON.parse<JSON.Obj>(payload);
export const asjValue = changetype<ASJ.Obj>(ASJ.parse<string>(payload));

function opsByMode(naive: i32, swar: i32, simd: i32): i32 {
  if (JSON_MODE == JSONMode.NAIVE) return naive;
  if (JSON_MODE == JSONMode.SWAR) return swar;
  if (JSON_MODE == JSONMode.SIMD) return simd;
  return naive;
}

export const STRUCT_DESERIALIZE_OPS: i32 = opsByMode(
  300_000,
  2_750_000,
  3_250_000,
);
export const STRUCT_STRINGIFY_OPS: i32 = opsByMode(
  1_500_000,
  2_300_000,
  2_250_000,
);
export const JSON_OBJ_DESERIALIZE_OPS: i32 = 200_000;
export const JSON_OBJ_STRINGIFY_OPS: i32 = 900_000;
export const ASJ_DESERIALIZE_OPS: i32 = 10_000;
export const ASJ_STRINGIFY_OPS: i32 = 35_000;

// --- lazy: "auto" variants of the structs above (same fields, deferred parse) ---
@json({ lazy: "auto" })
export class RepoOwnerLazy {
  public login: string = "octocat";
  public id: i32 = 583231;
  public node_id: string = "MDQ6VXNlcjU4MzIzMQ==";
  public avatar_url: string =
    "https://avatars.githubusercontent.com/u/583231?v=4";
  public gravatar_id: string = "";
  public url: string = "https://api.github.com/users/octocat";
  public html_url: string = "https://github.com/octocat";
  public followers_url: string =
    "https://api.github.com/users/octocat/followers";
  public following_url: string =
    "https://api.github.com/users/octocat/following{/other_user}";
  public gists_url: string =
    "https://api.github.com/users/octocat/gists{/gist_id}";
  public starred_url: string =
    "https://api.github.com/users/octocat/starred{/owner}{/repo}";
  public subscriptions_url: string =
    "https://api.github.com/users/octocat/subscriptions";
  public organizations_url: string =
    "https://api.github.com/users/octocat/orgs";
  public repos_url: string = "https://api.github.com/users/octocat/repos";
  public events_url: string =
    "https://api.github.com/users/octocat/events{/privacy}";
  public received_events_url: string =
    "https://api.github.com/users/octocat/received_events";
  public type: string = "User";
  public user_view_type: string = "public";
  public site_admin: boolean = false;
}


@json({ lazy: "auto" })
export class RepoLicenseLazy {
  public key: string = "";
  public name: string = "";
  public spdx_id: string = "";
  public url: string | null = null;
  public node_id: string = "";
}


@json({ lazy: "auto" })
export class RepoLazy {
  public id: i32 = 132935648;
  public node_id: string = "MDEwOlJlcG9zaXRvcnkxMzI5MzU2NDg=";
  public name: string = "boysenberry-repo-1";
  public full_name: string = "octocat/boysenberry-repo-1";
  public private: boolean = true;
  public owner: RepoOwnerLazy = new RepoOwnerLazy();
  public html_url: string = "https://github.com/octocat/boysenberry-repo-1";
  public description: string | null = "Testing";
  public fork: boolean = true;
  public url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1";
  public forks_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/forks";
  public keys_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/keys{/key_id}";
  public collaborators_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/collaborators{/collaborator}";
  public teams_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/teams";
  public hooks_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/hooks";
  public issue_events_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/issues/events{/number}";
  public events_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/events";
  public assignees_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/assignees{/user}";
  public branches_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/branches{/branch}";
  public tags_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/tags";
  public blobs_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/git/blobs{/sha}";
  public git_tags_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/git/tags{/sha}";
  public git_refs_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/git/refs{/sha}";
  public trees_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/git/trees{/sha}";
  public statuses_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/statuses/{sha}";
  public languages_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/languages";
  public stargazers_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/stargazers";
  public contributors_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/contributors";
  public subscribers_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/subscribers";
  public subscription_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/subscription";
  public commits_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/commits{/sha}";
  public git_commits_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/git/commits{/sha}";
  public comments_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/comments{/number}";
  public issue_comment_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/issues/comments{/number}";
  public contents_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/contents/{+path}";
  public compare_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/compare/{base}...{head}";
  public merges_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/merges";
  public archive_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/{archive_format}{/ref}";
  public downloads_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/downloads";
  public issues_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/issues{/number}";
  public pulls_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/pulls{/number}";
  public milestones_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/milestones{/number}";
  public notifications_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/notifications{?since,all,participating}";
  public labels_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/labels{/name}";
  public releases_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/releases{/id}";
  public deployments_url: string =
    "https://api.github.com/repos/octocat/boysenberry-repo-1/deployments";
  public created_at: string = "2018-05-10T17:51:29Z";
  public updated_at: string = "2025-05-24T02:01:19Z";
  public pushed_at: string = "2024-05-26T07:02:05Z";
  public git_url: string = "git://github.com/octocat/boysenberry-repo-1.git";
  public ssh_url: string = "git@github.com:octocat/boysenberry-repo-1.git";
  public clone_url: string =
    "https://github.com/octocat/boysenberry-repo-1.git";
  public svn_url: string = "https://github.com/octocat/boysenberry-repo-1";
  public homepage: string | null = "";
  public size: i32 = 4;
  public stargazers_count: i32 = 332;
  public watchers_count: i32 = 332;
  public language: string | null = null;
  public has_issues: boolean = false;
  public has_projects: boolean = true;
  public has_downloads: boolean = true;
  public has_wiki: boolean = true;
  public has_pages: boolean = false;
  public has_discussions: boolean = false;
  public forks_count: i32 = 20;
  public mirror_url: string | null = null;
  public archived: boolean = false;
  public disabled: boolean = false;
  public open_issues_count: i32 = 1;
  public license: RepoLicenseLazy | null = null;
  public allow_forking: boolean = true;
  public is_template: boolean = false;
  public web_commit_signoff_required: boolean = false;
  public topics: string[] = [];
  public visibility: string = "public";
  public forks: i32 = 20;
  public open_issues: i32 = 1;
  public watchers: i32 = 332;
  public default_branch: string = "master";
}

export const structValueLazy = JSON.parse<RepoLazy>(payload);
