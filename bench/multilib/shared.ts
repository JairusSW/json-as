export const MULTILIB_PAYLOAD_FILE =
  "./assembly/__benches__/payloads/multilib.json";

export const JS_NATIVE_PARSE_OPS = 175_000;
export const JS_FAST_PARSE_OPS = 175_000;
export const JS_NATIVE_STRINGIFY_OPS = 220_000;
export const JS_FAST_STRINGIFY_OPS = 220_000;

export const schema = {
  type: "object",
  properties: {
    id: {
      type: "number",
    },
    node_id: {
      type: "string",
    },
    name: {
      type: "string",
    },
    full_name: {
      type: "string",
    },
    private: {
      type: "boolean",
    },
    owner: {
      type: "object",
      properties: {
        login: {
          type: "string",
        },
        id: {
          type: "number",
        },
        node_id: {
          type: "string",
        },
        avatar_url: {
          type: "string",
        },
        gravatar_id: {
          type: "string",
        },
        url: {
          type: "string",
        },
        html_url: {
          type: "string",
        },
        followers_url: {
          type: "string",
        },
        following_url: {
          type: "string",
        },
        gists_url: {
          type: "string",
        },
        starred_url: {
          type: "string",
        },
        subscriptions_url: {
          type: "string",
        },
        organizations_url: {
          type: "string",
        },
        repos_url: {
          type: "string",
        },
        events_url: {
          type: "string",
        },
        received_events_url: {
          type: "string",
        },
        type: {
          type: "string",
        },
        user_view_type: {
          type: "string",
        },
        site_admin: {
          type: "boolean",
        },
      },
    },
    html_url: {
      type: "string",
    },
    description: {
      type: "string",
    },
    fork: {
      type: "boolean",
    },
    url: {
      type: "string",
    },
    forks_url: {
      type: "string",
    },
    keys_url: {
      type: "string",
    },
    collaborators_url: {
      type: "string",
    },
    teams_url: {
      type: "string",
    },
    hooks_url: {
      type: "string",
    },
    issue_events_url: {
      type: "string",
    },
    events_url: {
      type: "string",
    },
    assignees_url: {
      type: "string",
    },
    branches_url: {
      type: "string",
    },
    tags_url: {
      type: "string",
    },
    blobs_url: {
      type: "string",
    },
    git_tags_url: {
      type: "string",
    },
    git_refs_url: {
      type: "string",
    },
    trees_url: {
      type: "string",
    },
    statuses_url: {
      type: "string",
    },
    languages_url: {
      type: "string",
    },
    stargazers_url: {
      type: "string",
    },
    contributors_url: {
      type: "string",
    },
    subscribers_url: {
      type: "string",
    },
    subscription_url: {
      type: "string",
    },
    commits_url: {
      type: "string",
    },
    git_commits_url: {
      type: "string",
    },
    comments_url: {
      type: "string",
    },
    issue_comment_url: {
      type: "string",
    },
    contents_url: {
      type: "string",
    },
    compare_url: {
      type: "string",
    },
    merges_url: {
      type: "string",
    },
    archive_url: {
      type: "string",
    },
    downloads_url: {
      type: "string",
    },
    issues_url: {
      type: "string",
    },
    pulls_url: {
      type: "string",
    },
    milestones_url: {
      type: "string",
    },
    notifications_url: {
      type: "string",
    },
    labels_url: {
      type: "string",
    },
    releases_url: {
      type: "string",
    },
    deployments_url: {
      type: "string",
    },
    created_at: {
      type: "string",
    },
    updated_at: {
      type: "string",
    },
    pushed_at: {
      type: "string",
    },
    git_url: {
      type: "string",
    },
    ssh_url: {
      type: "string",
    },
    clone_url: {
      type: "string",
    },
    svn_url: {
      type: "string",
    },
    homepage: {
      type: "string",
    },
    size: {
      type: "number",
    },
    stargazers_count: {
      type: "number",
    },
    watchers_count: {
      type: "number",
    },
    language: {
      type: ["string", "null"],
    },
    has_issues: {
      type: "boolean",
    },
    has_projects: {
      type: "boolean",
    },
    has_downloads: {
      type: "boolean",
    },
    has_wiki: {
      type: "boolean",
    },
    has_pages: {
      type: "boolean",
    },
    has_discussions: {
      type: "boolean",
    },
    forks_count: {
      type: "number",
    },
    mirror_url: {
      type: ["string", "null"],
    },
    archived: {
      type: "boolean",
    },
    disabled: {
      type: "boolean",
    },
    open_issues_count: {
      type: "number",
    },
    license: {
      type: ["object", "null"],
      properties: {
        key: {
          type: "string",
        },
        name: {
          type: "string",
        },
        spdx_id: {
          type: "string",
        },
        url: {
          type: ["string", "null"],
        },
        node_id: {
          type: "string",
        },
      },
    },
    allow_forking: {
      type: "boolean",
    },
    is_template: {
      type: "boolean",
    },
    web_commit_signoff_required: {
      type: "boolean",
    },
    topics: {
      type: "array",
      items: {
        type: "string",
      },
    },
    visibility: {
      type: "string",
    },
    forks: {
      type: "number",
    },
    open_issues: {
      type: "number",
    },
    watchers: {
      type: "number",
    },
    default_branch: {
      type: "string",
    },
  },
} as const;
