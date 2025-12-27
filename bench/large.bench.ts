import { bench, blackbox, dumpToFile } from "./lib/bench.js";

class RepoOwner {
  login: string = "octocat";
  id: number = 583231;
  node_id: string = "MDQ6VXNlcjU4MzIzMQ==";
  avatar_url: string = "https://avatars.githubusercontent.com/u/583231?v=4";
  gravatar_id: string = "";
  url: string = "https://api.github.com/users/octocat";
  html_url: string = "https://github.com/octocat";
  followers_url: string = "https://api.github.com/users/octocat/followers";
  following_url: string = "https://api.github.com/users/octocat/following{/other_user}";
  gists_url: string = "https://api.github.com/users/octocat/gists{/gist_id}";
  starred_url: string = "https://api.github.com/users/octocat/starred{/owner}{/repo}";
  subscriptions_url: string = "https://api.github.com/users/octocat/subscriptions";
  organizations_url: string = "https://api.github.com/users/octocat/orgs";
  repos_url: string = "https://api.github.com/users/octocat/repos";
  events_url: string = "https://api.github.com/users/octocat/events{/privacy}";
  received_events_url: string = "https://api.github.com/users/octocat/received_events";
  type: string = "User";
  user_view_type: string = "public";
  site_admin: boolean = false;
}

class RepoLicense {
  key: string = "";
  name: string = "";
  spdx_id: string = "";
  url: string | null = null;
  node_id: string = "";
}

class Repo {
  id: number = 132935648;
  node_id: string = "MDEwOlJlcG9zaXRvcnkxMzI5MzU2NDg=";
  name: string = "boysenberry-repo-1";
  full_name: string = "octocat/boysenberry-repo-1";
  private: boolean = true;
  owner: RepoOwner = new RepoOwner();
  html_url: string = "https://github.com/octocat/boysenberry-repo-1";
  description: string | null = "Testing";
  fork: boolean = true;
  url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1";
  forks_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/forks";
  keys_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/keys{/key_id}";
  collaborators_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/collaborators{/collaborator}";
  teams_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/teams";
  hooks_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/hooks";
  issue_events_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/issues/events{/number}";
  events_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/events";
  assignees_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/assignees{/user}";
  branches_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/branches{/branch}";
  tags_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/tags";
  blobs_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/git/blobs{/sha}";
  git_tags_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/git/tags{/sha}";
  git_refs_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/git/refs{/sha}";
  trees_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/git/trees{/sha}";
  statuses_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/statuses/{sha}";
  languages_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/languages";
  stargazers_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/stargazers";
  contributors_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/contributors";
  subscribers_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/subscribers";
  subscription_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/subscription";
  commits_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/commits{/sha}";
  git_commits_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/git/commits{/sha}";
  comments_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/comments{/number}";
  issue_comment_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/issues/comments{/number}";
  contents_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/contents/{+path}";
  compare_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/compare/{base}...{head}";
  merges_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/merges";
  archive_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/{archive_format}{/ref}";
  downloads_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/downloads";
  issues_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/issues{/number}";
  pulls_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/pulls{/number}";
  milestones_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/milestones{/number}";
  notifications_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/notifications{?since,all,participating}";
  labels_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/labels{/name}";
  releases_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/releases{/id}";
  deployments_url: string = "https://api.github.com/repos/octocat/boysenberry-repo-1/deployments";
  created_at: string = "2018-05-10T17:51:29Z";
  updated_at: string = "2025-05-24T02:01:19Z";
  pushed_at: string = "2024-05-26T07:02:05Z";
  git_url: string = "git://github.com/octocat/boysenberry-repo-1.git";
  ssh_url: string = "git@github.com:octocat/boysenberry-repo-1.git";
  clone_url: string = "https://github.com/octocat/boysenberry-repo-1.git";
  svn_url: string = "https://github.com/octocat/boysenberry-repo-1";
  homepage: string | null = "";
  size: number = 4;
  stargazers_count: number = 332;
  watchers_count: number = 332;
  language: string | null = null;
  has_issues: boolean = false;
  has_projects: boolean = true;
  has_downloads: boolean = true;
  has_wiki: boolean = true;
  has_pages: boolean = false;
  has_discussions: boolean = false;
  forks_count: number = 20;
  mirror_url: string | null = null;
  archived: boolean = false;
  disabled: boolean = false;
  open_issues_count: number = 1;
  license: RepoLicense | null = null;
  allow_forking: boolean = true;
  is_template: boolean = false;
  web_commit_signoff_required: boolean = false;
  topics: string[] = [];
  visibility: string = "public";
  forks: number = 20;
  open_issues: number = 1;
  watchers: number = 332;
  default_branch: string = "master";
}

const v1 = new Repo();

const v2 = `{"id":132935648,"node_id":"MDEwOlJlcG9zaXRvcnkxMzI5MzU2NDg=","name":"boysenberry-repo-1","full_name":"octocat/boysenberry-repo-1","private":true,"owner":{"login":"octocat","id":583231,"node_id":"MDQ6VXNlcjU4MzIzMQ==","avatar_url":"https://avatars.githubusercontent.com/u/583231?v=4","gravatar_id":"","url":"https://api.github.com/users/octocat","html_url":"https://github.com/octocat","followers_url":"https://api.github.com/users/octocat/followers","following_url":"https://api.github.com/users/octocat/following{/other_user}","gists_url":"https://api.github.com/users/octocat/gists{/gist_id}","starred_url":"https://api.github.com/users/octocat/starred{/owner}{/repo}","subscriptions_url":"https://api.github.com/users/octocat/subscriptions","organizations_url":"https://api.github.com/users/octocat/orgs","repos_url":"https://api.github.com/users/octocat/repos","events_url":"https://api.github.com/users/octocat/events{/privacy}","received_events_url":"https://api.github.com/users/octocat/received_events","type":"User","user_view_type":"public","site_admin":false},"html_url":"https://github.com/octocat/boysenberry-repo-1","description":"Testing","fork":true,"url":"https://api.github.com/repos/octocat/boysenberry-repo-1","forks_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/forks","keys_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/keys{/key_id}","collaborators_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/collaborators{/collaborator}","teams_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/teams","hooks_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/hooks","issue_events_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/issues/events{/number}","events_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/events","assignees_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/assignees{/user}","branches_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/branches{/branch}","tags_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/tags","blobs_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/git/blobs{/sha}","git_tags_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/git/tags{/sha}","git_refs_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/git/refs{/sha}","trees_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/git/trees{/sha}","statuses_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/statuses/{sha}","languages_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/languages","stargazers_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/stargazers","contributors_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/contributors","subscribers_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/subscribers","subscription_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/subscription","commits_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/commits{/sha}","git_commits_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/git/commits{/sha}","comments_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/comments{/number}","issue_comment_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/issues/comments{/number}","contents_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/contents/{+path}","compare_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/compare/{base}...{head}","merges_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/merges","archive_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/{archive_format}{/ref}","downloads_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/downloads","issues_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/issues{/number}","pulls_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/pulls{/number}","milestones_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/milestones{/number}","notifications_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/notifications{?since,all,participating}","labels_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/labels{/name}","releases_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/releases{/id}","deployments_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/deployments","created_at":"2018-05-10T17:51:29Z","updated_at":"2025-05-24T02:01:19Z","pushed_at":"2024-05-26T07:02:05Z","git_url":"git://github.com/octocat/boysenberry-repo-1.git","ssh_url":"git@github.com:octocat/boysenberry-repo-1.git","clone_url":"https://github.com/octocat/boysenberry-repo-1.git","svn_url":"https://github.com/octocat/boysenberry-repo-1","homepage":"","size":4,"stargazers_count":332,"watchers_count":332,"language":null,"has_issues":false,"has_projects":true,"has_downloads":true,"has_wiki":true,"has_pages":false,"has_discussions":false,"forks_count":20,"mirror_url":null,"archived":false,"disabled":false,"open_issues_count":1,"license":null,"allow_forking":true,"is_template":false,"web_commit_signoff_required":false,"topics":[],"visibility":"public","forks":20,"open_issues":1,"watchers":332,"default_branch":"master"}`;

bench("Serialize Large API Response", () => {
  blackbox(JSON.stringify(v1));
}, 10_000, 10502);
dumpToFile("large", "serialize")

bench("Deserialize Large API Response", () => {
  blackbox(JSON.parse(v2));
}, 10_000, 10502);
dumpToFile("large", "deserialize")