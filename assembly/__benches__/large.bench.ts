import { JSON } from "..";
import { expect } from "../__tests__/lib";
import { bench, blackbox, dumpToFile } from "./lib/bench";

@json
class RepoOwner {
  public login!: string;
  public id!: i32;
  public node_id!: string;
  public avatar_url!: string;
  public gravatar_id!: string;
  public url!: string;
  public html_url!: string;
  public followers_url!: string;
  public following_url!: string;
  public gists_url!: string;
  public starred_url!: string;
  public subscriptions_url!: string;
  public organizations_url!: string;
  public repos_url!: string;
  public events_url!: string;
  public received_events_url!: string;
  public type!: string;
  public user_view_type!: string;
  public site_admin!: boolean;
}

@json
class RepoLicense {
  public key!: string;
  public name!: string;
  public spdx_id!: string;
  public url!: string | null;
  public node_id!: string;
}

@json
class Repo {
  public id!: i32;
  public node_id!: string;
  public name!: string;
  public full_name!: string;
  public private!: boolean;
  public owner!: RepoOwner;
  public html_url!: string;
  public description!: string | null;
  public fork!: boolean;
  public url!: string;
  public forks_url!: string;
  public keys_url!: string;
  public collaborators_url!: string;
  public teams_url!: string;
  public hooks_url!: string;
  public issue_events_url!: string;
  public events_url!: string;
  public assignees_url!: string;
  public branches_url!: string;
  public tags_url!: string;
  public blobs_url!: string;
  public git_tags_url!: string;
  public git_refs_url!: string;
  public trees_url!: string;
  public statuses_url!: string;
  public languages_url!: string;
  public stargazers_url!: string;
  public contributors_url!: string;
  public subscribers_url!: string;
  public subscription_url!: string;
  public commits_url!: string;
  public git_commits_url!: string;
  public comments_url!: string;
  public issue_comment_url!: string;
  public contents_url!: string;
  public compare_url!: string;
  public merges_url!: string;
  public archive_url!: string;
  public downloads_url!: string;
  public issues_url!: string;
  public pulls_url!: string;
  public milestones_url!: string;
  public notifications_url!: string;
  public labels_url!: string;
  public releases_url!: string;
  public deployments_url!: string;
  public created_at!: string;
  public updated_at!: string;
  public pushed_at!: string;
  public git_url!: string;
  public ssh_url!: string;
  public clone_url!: string;
  public svn_url!: string;
  public homepage!: string | null;
  public size!: i32;
  public stargazers_count!: i32;
  public watchers_count!: i32;
  public language!: string | null;
  public has_issues!: boolean;
  public has_projects!: boolean;
  public has_downloads!: boolean;
  public has_wiki!: boolean;
  public has_pages!: boolean;
  public has_discussions!: boolean;
  public forks_count!: i32;
  public mirror_url!: string | null;
  public archived!: boolean;
  public disabled!: boolean;
  public open_issues_count!: i32;
  public license!: RepoLicense | null;
  public allow_forking!: boolean;
  public is_template!: boolean;
  public web_commit_signoff_required!: boolean;
  public topics!: string[];
  public visibility!: string;
  public forks!: i32;
  public open_issues!: i32;
  public watchers!: i32;
  public default_branch!: string;
}

// Create instances and assign fields directly
const v1 = new Repo();
const owner = new RepoOwner();

owner.login = "octocat";
owner.id = 583231;
owner.node_id = "MDQ6VXNlcjU4MzIzMQ==";
owner.avatar_url = "https://avatars.githubusercontent.com/u/583231?v=4";
owner.gravatar_id = "";
owner.url = "https://api.github.com/users/octocat";
owner.html_url = "https://github.com/octocat";
owner.followers_url = "https://api.github.com/users/octocat/followers";
owner.following_url = "https://api.github.com/users/octocat/following{/other_user}";
owner.gists_url = "https://api.github.com/users/octocat/gists{/gist_id}";
owner.starred_url = "https://api.github.com/users/octocat/starred{/owner}{/repo}";
owner.subscriptions_url = "https://api.github.com/users/octocat/subscriptions";
owner.organizations_url = "https://api.github.com/users/octocat/orgs";
owner.repos_url = "https://api.github.com/users/octocat/repos";
owner.events_url = "https://api.github.com/users/octocat/events{/privacy}";
owner.received_events_url = "https://api.github.com/users/octocat/received_events";
owner.type = "User";
owner.user_view_type = "public";
owner.site_admin = false;

v1.owner = owner;

v1.id = 132935648;
v1.node_id = "MDEwOlJlcG9zaXRvcnkxMzI5MzU2NDg=";
v1.name = "boysenberry-repo-1";
v1.full_name = "octocat/boysenberry-repo-1";
v1.private = true;
v1.html_url = "https://github.com/octocat/boysenberry-repo-1";
v1.description = "Testing";
v1.fork = true;
v1.url = "https://api.github.com/repos/octocat/boysenberry-repo-1";
v1.forks_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/forks";
v1.keys_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/keys{/key_id}";
v1.collaborators_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/collaborators{/collaborator}";
v1.teams_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/teams";
v1.hooks_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/hooks";
v1.issue_events_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/issues/events{/number}";
v1.events_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/events";
v1.assignees_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/assignees{/user}";
v1.branches_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/branches{/branch}";
v1.tags_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/tags";
v1.blobs_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/git/blobs{/sha}";
v1.git_tags_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/git/tags{/sha}";
v1.git_refs_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/git/refs{/sha}";
v1.trees_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/git/trees{/sha}";
v1.statuses_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/statuses/{sha}";
v1.languages_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/languages";
v1.stargazers_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/stargazers";
v1.contributors_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/contributors";
v1.subscribers_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/subscribers";
v1.subscription_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/subscription";
v1.commits_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/commits{/sha}";
v1.git_commits_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/git/commits{/sha}";
v1.comments_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/comments{/number}";
v1.issue_comment_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/issues/comments{/number}";
v1.contents_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/contents/{+path}";
v1.compare_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/compare/{base}...{head}";
v1.merges_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/merges";
v1.archive_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/{archive_format}{/ref}";
v1.downloads_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/downloads";
v1.issues_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/issues{/number}";
v1.pulls_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/pulls{/number}";
v1.milestones_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/milestones{/number}";
v1.notifications_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/notifications{?since,all,participating}";
v1.labels_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/labels{/name}";
v1.releases_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/releases{/id}";
v1.deployments_url = "https://api.github.com/repos/octocat/boysenberry-repo-1/deployments";
v1.created_at = "2018-05-10T17:51:29Z";
v1.updated_at = "2025-05-24T02:01:19Z";
v1.pushed_at = "2024-05-26T07:02:05Z";
v1.git_url = "git://github.com/octocat/boysenberry-repo-1.git";
v1.ssh_url = "git@github.com:octocat/boysenberry-repo-1.git";
v1.clone_url = "https://github.com/octocat/boysenberry-repo-1.git";
v1.svn_url = "https://github.com/octocat/boysenberry-repo-1";
v1.homepage = "";
v1.size = 4;
v1.stargazers_count = 332;
v1.watchers_count = 332;
v1.language = null;
v1.has_issues = false;
v1.has_projects = true;
v1.has_downloads = true;
v1.has_wiki = true;
v1.has_pages = false;
v1.has_discussions = false;
v1.forks_count = 20;
v1.mirror_url = null;
v1.archived = false;
v1.disabled = false;
v1.open_issues_count = 1;
v1.license = null;
v1.allow_forking = true;
v1.is_template = false;
v1.web_commit_signoff_required = false;
v1.topics = [];
v1.visibility = "public";
v1.forks = 20;
v1.open_issues = 1;
v1.watchers = 332;
v1.default_branch = "master";

const v2 = `{"id":132935648,"node_id":"MDEwOlJlcG9zaXRvcnkxMzI5MzU2NDg=","name":"boysenberry-repo-1","full_name":"octocat/boysenberry-repo-1","private":true,"owner":{"login":"octocat","id":583231,"node_id":"MDQ6VXNlcjU4MzIzMQ==","avatar_url":"https://avatars.githubusercontent.com/u/583231?v=4","gravatar_id":"","url":"https://api.github.com/users/octocat","html_url":"https://github.com/octocat","followers_url":"https://api.github.com/users/octocat/followers","following_url":"https://api.github.com/users/octocat/following{/other_user}","gists_url":"https://api.github.com/users/octocat/gists{/gist_id}","starred_url":"https://api.github.com/users/octocat/starred{/owner}{/repo}","subscriptions_url":"https://api.github.com/users/octocat/subscriptions","organizations_url":"https://api.github.com/users/octocat/orgs","repos_url":"https://api.github.com/users/octocat/repos","events_url":"https://api.github.com/users/octocat/events{/privacy}","received_events_url":"https://api.github.com/users/octocat/received_events","type":"User","user_view_type":"public","site_admin":false},"html_url":"https://github.com/octocat/boysenberry-repo-1","description":"Testing","fork":true,"url":"https://api.github.com/repos/octocat/boysenberry-repo-1","forks_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/forks","keys_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/keys{/key_id}","collaborators_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/collaborators{/collaborator}","teams_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/teams","hooks_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/hooks","issue_events_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/issues/events{/number}","events_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/events","assignees_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/assignees{/user}","branches_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/branches{/branch}","tags_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/tags","blobs_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/git/blobs{/sha}","git_tags_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/git/tags{/sha}","git_refs_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/git/refs{/sha}","trees_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/git/trees{/sha}","statuses_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/statuses/{sha}","languages_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/languages","stargazers_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/stargazers","contributors_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/contributors","subscribers_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/subscribers","subscription_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/subscription","commits_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/commits{/sha}","git_commits_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/git/commits{/sha}","comments_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/comments{/number}","issue_comment_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/issues/comments{/number}","contents_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/contents/{+path}","compare_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/compare/{base}...{head}","merges_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/merges","archive_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/{archive_format}{/ref}","downloads_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/downloads","issues_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/issues{/number}","pulls_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/pulls{/number}","milestones_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/milestones{/number}","notifications_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/notifications{?since,all,participating}","labels_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/labels{/name}","releases_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/releases{/id}","deployments_url":"https://api.github.com/repos/octocat/boysenberry-repo-1/deployments","created_at":"2018-05-10T17:51:29Z","updated_at":"2025-05-24T02:01:19Z","pushed_at":"2024-05-26T07:02:05Z","git_url":"git://github.com/octocat/boysenberry-repo-1.git","ssh_url":"git@github.com:octocat/boysenberry-repo-1.git","clone_url":"https://github.com/octocat/boysenberry-repo-1.git","svn_url":"https://github.com/octocat/boysenberry-repo-1","homepage":"","size":4,"stargazers_count":332,"watchers_count":332,"language":null,"has_issues":false,"has_projects":true,"has_downloads":true,"has_wiki":true,"has_pages":false,"has_discussions":false,"forks_count":20,"mirror_url":null,"archived":false,"disabled":false,"open_issues_count":1,"license":null,"allow_forking":true,"is_template":false,"web_commit_signoff_required":false,"topics":[],"visibility":"public","forks":20,"open_issues":1,"watchers":332,"default_branch":"master"}`;

expect(JSON.stringify(v1)).toBe(v2);
expect(JSON.stringify(JSON.parse<Repo>(v2))).toBe(v2);

bench("Serialize Large API Response", () => {
  blackbox(inline.always(JSON.stringify(v1)));
}, 10_000, 10502);
dumpToFile("large", "serialize")

bench("Deserialize Large API Response", () => {
  blackbox(inline.always(JSON.parse<Repo>(v2)));
}, 10_000, 10502);
dumpToFile("large", "deserialize")