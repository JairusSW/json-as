import { bench, blackbox, dumpToFile, utf8ByteLength } from "./lib/bench.js";

class RepoOwner {
  login!: string;
  id!: number;
  node_id!: string;
  avatar_url!: string;
  gravatar_id!: string;
  url!: string;
  html_url!: string;
  followers_url!: string;
  following_url!: string;
  gists_url!: string;
  starred_url!: string;
  subscriptions_url!: string;
  organizations_url!: string;
  repos_url!: string;
  events_url!: string;
  received_events_url!: string;
  type!: string;
  user_view_type!: string;
  site_admin!: boolean;
}

class RepoLicense {
  key!: string;
  name!: string;
  spdx_id!: string;
  url!: string | null;
  node_id!: string;
}

class Repo {
  id!: number;
  node_id!: string;
  name!: string;
  full_name!: string;
  private!: boolean;
  owner!: RepoOwner;
  html_url!: string;
  description!: string | null;
  fork!: boolean;
  url!: string;
  forks_url!: string;
  keys_url!: string;
  collaborators_url!: string;
  teams_url!: string;
  hooks_url!: string;
  issue_events_url!: string;
  events_url!: string;
  assignees_url!: string;
  branches_url!: string;
  tags_url!: string;
  blobs_url!: string;
  git_tags_url!: string;
  git_refs_url!: string;
  trees_url!: string;
  statuses_url!: string;
  languages_url!: string;
  stargazers_url!: string;
  contributors_url!: string;
  subscribers_url!: string;
  subscription_url!: string;
  commits_url!: string;
  git_commits_url!: string;
  comments_url!: string;
  issue_comment_url!: string;
  contents_url!: string;
  compare_url!: string;
  merges_url!: string;
  archive_url!: string;
  downloads_url!: string;
  issues_url!: string;
  pulls_url!: string;
  milestones_url!: string;
  notifications_url!: string;
  labels_url!: string;
  releases_url!: string;
  deployments_url!: string;
  created_at!: string;
  updated_at!: string;
  pushed_at!: string;
  git_url!: string;
  ssh_url!: string;
  clone_url!: string;
  svn_url!: string;
  homepage!: string | null;
  size!: number;
  stargazers_count!: number;
  watchers_count!: number;
  language!: string | null;
  has_issues!: boolean;
  has_projects!: boolean;
  has_downloads!: boolean;
  has_wiki!: boolean;
  has_pages!: boolean;
  has_discussions!: boolean;
  forks_count!: number;
  mirror_url!: string | null;
  archived!: boolean;
  disabled!: boolean;
  open_issues_count!: number;
  license!: RepoLicense | null;
  allow_forking!: boolean;
  is_template!: boolean;
  web_commit_signoff_required!: boolean;
  topics!: string[];
  visibility!: string;
  forks!: number;
  open_issues!: number;
  watchers!: number;
  default_branch!: string;
}

const v2 = `{"id":132935648,"node_id":"MDEwOlJlcG9zaXRvcnkxMzI5MzU2NDg=","name":"boysenberry-repo-1","full_name":"octocat/boysenberry-repo-1","private":true,"owner":{"login":"octocat","id":583231,"node_id":"MDQ6VXNlcjU4MzIzMQ==","avatar_url":"https://avatars.githubusercontent.com/u/583231?v=4","gravatar_id":"","url":"https://api.github.com/users/octocat","html_url":"https://github.com/octocat","followers_url":"https://api.github.com/users/octocat/followers","following_url":"https://api.github.com/users/octocat/following{/other_user}","gists_url":"https://api.github.com/users/octocat/gists{/gist_id}","starred_url":"https://api.github.com/users/octocat/starred{/owner}{/repo}","subscriptions_url":"https://api.github.com/users/octocat/subscriptions","organizations_url":"https://api.github.com/users/octocat/orgs","repos_url":"https://api.github.com/users/octocat/repos","events_url":"https://api.github.com/users/octocat/events{/privacy}","received_events_url":"https://api.github.com/users/octocat/received_events","type":"User","user_view_type":"public","site_admin":false},"html_url":"https://github.com/octocat/boysenberry-repo-1","description":"Testing","fork":true,"url":"https://api.github.com/repos/octocat/boysenberry-repo-1","forks_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/forks","keys_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/keys{/key_id}","collaborators_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/collaborators{/collaborator}","teams_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/teams","hooks_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/hooks","issue_events_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/issues/events{/number}","events_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/events","assignees_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/assignees{/user}","branches_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/branches{/branch}","tags_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/tags","blobs_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/git/blobs{/sha}","git_tags_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/git/tags{/sha}","git_refs_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/git/refs{/sha}","trees_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/git/trees{/sha}","statuses_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/statuses/{sha}","languages_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/languages","stargazers_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/stargazers","contributors_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/contributors","subscribers_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/subscribers","subscription_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/subscription","commits_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/commits{/sha}","git_commits_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/git/commits{/sha}","comments_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/comments{/number}","issue_comment_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/issues/comments{/number}","contents_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/contents/{+path}","compare_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/compare/{base}...{head}","merges_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/merges","archive_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/{archive_format}{/ref}","downloads_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/downloads","issues_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/issues{/number}","pulls_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/pulls{/number}","milestones_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/milestones{/number}","notifications_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/notifications{?since,all,participating}","labels_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/labels{/name}","releases_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/releases{/id}","deployments_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/deployments","created_at":"2018-05-10T17:51:29Z","updated_at":"2025-05-24T02:01:19Z","pushed_at":"2024-05-26T07:02:05Z","git_url":"git://github.com/octocat/boysenberry-repo-1.git","ssh_url":"git@github.com:octocat/boysenberry-repo-1.git","clone_url":"https://github.com/octocat/boysenberry-repo-1.git","svn_url":"https://github.com/octocat/boysenberry-repo-1","homepage":"","size":4,"stargazers_count":332,"watchers_count":332,"language":null,"has_issues":false,"has_projects":true,"has_downloads":true,"has_wiki":true,"has_pages":false,"has_discussions":false,"forks_count":20,"mirror_url":null,"archived":false,"disabled":false,"open_issues_count":1,"license":null,"allow_forking":true,"is_template":false,"web_commit_signoff_required":false,"topics":[],"visibility":"public","forks":20,"open_issues":1,"watchers":332,"default_branch":"master"}`;
const v1 = JSON.parse(v2) as Repo;

bench(
  "Serialize Large API Response",
  () => {
    blackbox(JSON.stringify(v1));
  },
  10_000,
  utf8ByteLength(v2),
);
dumpToFile("large", "serialize");

bench(
  "Deserialize Large API Response",
  () => {
    blackbox(JSON.parse(v2));
  },
  10_000,
  utf8ByteLength(v2),
);
dumpToFile("large", "deserialize");
