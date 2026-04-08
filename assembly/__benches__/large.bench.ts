import { JSON } from "..";
import { expect } from "../__tests__/lib";
import { bench, blackbox, dumpToFile } from "./lib/bench";


@json
class RepoOwner {
  public login: string = "octocat";
  public id: i32 = 583231;
  public node_id: string = "MDQ6VXNlcjU4MzIzMQ==";
  public avatar_url: string = "https://avatars.githubusercontent.com/u/583231?v=4";
  public gravatar_id: string = "";
  public url: string = "https://api.github.com/users/octocat";
  public html_url: string = "https://github.com/octocat";
  public followers_url: string = "https://api.github.com/users/octocat/followers";
  public following_url: string = "https://api.github.com/users/octocat/following{/other_user}";
  public gists_url: string = "https://api.github.com/users/octocat/gists{/gist_id}";
  public starred_url: string = "https://api.github.com/users/octocat/starred{/owner}{/repo}";
  public subscriptions_url: string = "https://api.github.com/users/octocat/subscriptions";
  public organizations_url: string = "https://api.github.com/users/octocat/orgs";
  public repos_url: string = "https://api.github.com/users/octocat/repos";
  public events_url: string = "https://api.github.com/users/octocat/events{/privacy}";
  public received_events_url: string = "https://api.github.com/users/octocat/received_events";
  public type: string = "User";
  public user_view_type: string = "public";
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
class Repo {
  public id: i32 = 132935648;
  public node_id: string = "MDEwOlJlcG9zaXRvcnkxMzI5MzU2NDg=";
  public name: string = "boysenberry-repo-1";
  public full_name: string = "octocat/boysenberry-repo-1";
  public private: boolean = true;
  public owner: RepoOwner = new RepoOwner();
  public html_url: string = "https://github.com/octocat/boysenberry-repo-1";
  public description: string | null = "Testing";
  public fork: boolean = true;
  public url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1";
  public forks_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/forks";
  public keys_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/keys{/key_id}";
  public collaborators_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/collaborators{/collaborator}";
  public teams_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/teams";
  public hooks_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/hooks";
  public issue_events_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/issues/events{/number}";
  public events_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/events";
  public assignees_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/assignees{/user}";
  public branches_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/branches{/branch}";
  public tags_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/tags";
  public blobs_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/git/blobs{/sha}";
  public git_tags_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/git/tags{/sha}";
  public git_refs_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/git/refs{/sha}";
  public trees_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/git/trees{/sha}";
  public statuses_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/statuses/{sha}";
  public languages_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/languages";
  public stargazers_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/stargazers";
  public contributors_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/contributors";
  public subscribers_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/subscribers";
  public subscription_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/subscription";
  public commits_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/commits{/sha}";
  public git_commits_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/git/commits{/sha}";
  public comments_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/comments{/number}";
  public issue_comment_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/issues/comments{/number}";
  public contents_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/contents/{+path}";
  public compare_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/compare/{base}...{head}";
  public merges_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/merges";
  public archive_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/{archive_format}{/ref}";
  public downloads_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/downloads";
  public issues_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/issues{/number}";
  public pulls_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/pulls{/number}";
  public milestones_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/milestones{/number}";
  public notifications_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/notifications{?since,all,participating}";
  public labels_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/labels{/name}";
  public releases_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/releases{/id}";
  public deployments_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/deployments";
  public created_at: string = "2018-05-10T17:51:29Z";
  public updated_at: string = "2025-05-24T02:01:19Z";
  public pushed_at: string = "2024-05-26T07:02:05Z";
  public git_url: string = "git://github.com/octocat/boysenberry-repo-1.git";
  public ssh_url: string = "git@github.com:octocat/boysenberry-repo-1.git";
  public clone_url: string = "https://github.com/octocat/boysenberry-repo-1.git";
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

// Create instances and assign fields directly
const v1 = new Repo();

const v2 = `{"id":132935648,"node_id":"MDEwOlJlcG9zaXRvcnkxMzI5MzU2NDg=","name":"boysenberry-repo-1","full_name":"octocat/boysenberry-repo-1","private":true,"owner":{"login":"octocat","id":583231,"node_id":"MDQ6VXNlcjU4MzIzMQ==","avatar_url":"https://avatars.githubusercontent.com/u/583231?v=4","gravatar_id":"","url":"https://api.github.com/users/octocat","html_url":"https://github.com/octocat","followers_url":"https://api.github.com/users/octocat/followers","following_url":"https://api.github.com/users/octocat/following{/other_user}","gists_url":"https://api.github.com/users/octocat/gists{/gist_id}","starred_url":"https://api.github.com/users/octocat/starred{/owner}{/repo}","subscriptions_url":"https://api.github.com/users/octocat/subscriptions","organizations_url":"https://api.github.com/users/octocat/orgs","repos_url":"https://api.github.com/users/octocat/repos","events_url":"https://api.github.com/users/octocat/events{/privacy}","received_events_url":"https://api.github.com/users/octocat/received_events","type":"User","user_view_type":"public","site_admin":false},"html_url":"https://github.com/octocat/boysenberry-repo-1","description":"Testing","fork":true,"url":"https://api.github.com/repos/octocat/boysenberry-repo-1","forks_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/forks","keys_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/keys{/key_id}","collaborators_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/collaborators{/collaborator}","teams_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/teams","hooks_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/hooks","issue_events_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/issues/events{/number}","events_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/events","assignees_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/assignees{/user}","branches_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/branches{/branch}","tags_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/tags","blobs_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/git/blobs{/sha}","git_tags_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/git/tags{/sha}","git_refs_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/git/refs{/sha}","trees_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/git/trees{/sha}","statuses_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/statuses/{sha}","languages_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/languages","stargazers_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/stargazers","contributors_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/contributors","subscribers_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/subscribers","subscription_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/subscription","commits_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/commits{/sha}","git_commits_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/git/commits{/sha}","comments_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/comments{/number}","issue_comment_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/issues/comments{/number}","contents_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/contents/{+path}","compare_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/compare/{base}...{head}","merges_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/merges","archive_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/{archive_format}{/ref}","downloads_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/downloads","issues_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/issues{/number}","pulls_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/pulls{/number}","milestones_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/milestones{/number}","notifications_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/notifications{?since,all,participating}","labels_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/labels{/name}","releases_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/releases{/id}","deployments_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/deployments","created_at":"2018-05-10T17:51:29Z","updated_at":"2025-05-24T02:01:19Z","pushed_at":"2024-05-26T07:02:05Z","git_url":"git://github.com/octocat/boysenberry-repo-1.git","ssh_url":"git@github.com:octocat/boysenberry-repo-1.git","clone_url":"https://github.com/octocat/boysenberry-repo-1.git","svn_url":"https://github.com/octocat/boysenberry-repo-1","homepage":"","size":4,"stargazers_count":332,"watchers_count":332,"language":null,"has_issues":false,"has_projects":true,"has_downloads":true,"has_wiki":true,"has_pages":false,"has_discussions":false,"forks_count":20,"mirror_url":null,"archived":false,"disabled":false,"open_issues_count":1,"license":null,"allow_forking":true,"is_template":false,"web_commit_signoff_required":false,"topics":[],"visibility":"public","forks":20,"open_issues":1,"watchers":332,"default_branch":"master"}`;

expect(JSON.stringify(v1)).toBe(v2);
expect(JSON.stringify(JSON.parse<Repo>(v2))).toBe(v2);

bench(
  "Serialize Large API Response",
  () => {
    blackbox(inline.always(JSON.stringify(v1)));
  },
  100_000,
  v2.length << 1,
);
dumpToFile("large", "serialize");

bench(
  "Deserialize Large API Response",
  () => {
    blackbox(inline.always(JSON.parse<Repo>(v2)));
  },
  100_000,
  v2.length << 1,
);
dumpToFile("large", "deserialize");
