# 14.8 Plugin policy

Part of §14, [Managed policy](14-policy.md). This part states the managed keys that decide which
plugins a client installs, enables and loads for an organization: required marketplaces and plugins,
the marketplace allowlist and blocklist, seeds, the other plugin controls, channels, update policy,
and the messages a user reads when policy refuses. Evidence: `plugins/org.md` unless a section names
another page; each key's entry in `settings-reference.md`. §15 defines marketplace sources and §16
installs; this part states only what policy adds to them. The keys' types follow the `Settings` type
of `@anthropic-ai/claude-agent-sdk` 0.3.330.

## 14.8.1 Which managed source carries the plugin keys

1. The plugin keys arrive by any mechanism of §14.1.1. By default only one managed source applies:
   the first that delivers a policy key, server-managed first, then MDM, then the managed settings
   file. If server-managed settings deliver even one unrelated policy key, the client ignores the
   plugin keys of an MDM policy or managed settings file on that machine, apart from the
   cross-source keys (§14.2.4), unless `managedSourcesBehavior` is `"merge"` (§14.2.3).
   <!-- req: policy.org.Which managed source applies on a machine -->
2. A managed administrator can thus enforce: a marketplace allowlist or blocklist; force-enabled
   plugins; no `--plugin-dir`, `--plugin-url` or `CLAUDE_CODE_PLUGIN_DIRS`; hooks only from managed
   settings and force-enabled plugins; and no plugins synced from members' claude.ai accounts
   (`plugins/security.md`, "Enforce plugin controls for your organization"). §14.8.5 states each
   key. <!-- req: policy.security.Enforce plugin controls for your organization -->

## 14.8.2 Requiring marketplaces and plugins

1. A managed `extraKnownMarketplaces` entry registers a marketplace on each machine, keyed by the
   marketplace's own `name`, with a `source` object (§15) and an optional `autoUpdate`. A managed
   `enabledPlugins` entry `"<plugin>@<marketplace>": true` installs and force-enables that plugin.
   At the start of the user's next session the client registers the marketplace and installs the
   plugins; they show in `/plugin`, and disabling one at a lower scope does not stop it loading.
   `"<plugin>@<marketplace>": false` in managed `enabledPlugins` blocks the plugin at every scope and
   hides it from the marketplace listing. <!-- req: policy.org.Require a marketplace and its plugins.source -->
2. `autoUpdate` on a managed entry decides auto-update for the fleet: `true` keeps the marketplace
   and its plugins refreshing in the background, `false` turns that off, and either value locks the
   user's toggle (§14.8.7).
   <!-- req: policy.org.Require a marketplace and its plugins.autoUpdate -->
3. A managed entry overrides a same-named entry from another source:
   - **Marketplaces**: a managed `extraKnownMarketplaces` entry replaces a lower-precedence entry of
     the same name whole; their fields never merge. <!-- req: policy.org.Require a marketplace and its plugins.Marketplaces -->
   - **`--plugin-dir` copies**: a `--plugin-dir` copy whose name matches a plugin managed
     `enabledPlugins` names is ignored, and `/plugin` lists `--plugin-dir copy of "<name>" ignored:
     plugin is locked by managed settings` in its **Errors** tab (§16). <!-- req: policy.org.Require a marketplace and its plugins.--plugin-dir copies -->
4. `claude-plugins-official` needs no `extraKnownMarketplaces` entry when `enabledPlugins` sets one
   of its plugins `true`: that entry declares the marketplace wherever the keys apply.
5. A git marketplace is cloned with git on the user's machine, with stored credentials and no
   prompt; a private repository needs read access per user, or a seed (§14.8.4).
6. **Per repository.** The same two keys in a repository's `.claude/settings.json` cover its
   contributors. Its `extraKnownMarketplaces` entries apply only in a trusted folder: interactively
   after the workspace trust dialog, and in `-p` only in a folder already trusted interactively or
   whose `hasTrustDialogAccepted` is set in `~/.claude.json`; in an untrusted folder they are ignored
   with no message. Its `enabledPlugins` apply at session start but install nothing: once the
   marketplace is registered, each contributor installs the plugin with `claude plugin install
   <name>@<marketplace> --scope project`, and until then the `/plugin` **Errors** tab can show a line
   ending in `isn't installed here` (§16.4.2). No install is needed for a plugin that a local
   `directory` or `file` marketplace lists by a relative-path `source`, or one a seed supplies
   (§14.8.4); §16 states the rest. A relative `directory` or `file` source path resolves against the
   repository's main checkout, so every worktree shares it. <!-- req: policy.org.Require plugins per repository -->
7. **Surfaces.** In an interactive terminal, managed keys apply at session start; in `-p` and CI they
   apply at session start with installs in the background, so a plugin can be missing from the first
   turn unless `CLAUDE_CODE_SYNC_PLUGIN_INSTALL=1` makes the run wait. An Anthropic-hosted cloud
   session receives only server-managed settings and waits for them before installing plugins.
   The `init` event of `--output-format stream-json --verbose` lists the loaded plugins under
   `plugins`.

## 14.8.3 Restricting marketplace sources

### Enforcement

1. Managed `strictKnownMarketplaces` (alias `allowedMarketplaces`) is an allowlist and managed
   `blockedMarketplaces` a blocklist of marketplace sources: the git repository, URL or local path a
   marketplace is fetched from. Both match the source of the marketplace a plugin comes from, never
   the plugin's own entry inside it. <!-- req: policy.org.Restrict what users can install -->
2. The client MUST apply both lists before any network or filesystem operation, when a user adds a
   marketplace and on every install, update, refresh and auto-update, so a marketplace added before
   the policy cannot fetch once its source stops matching. Blocked sources never touch the
   filesystem. <!-- req: policy.org.Restrict what users can install.Before a download -->
3. The client MUST apply them again at session start to plugins already installed: a plugin whose
   marketplace source no longer passes does not load, and `/plugin` lists `Marketplace "<name>" is
   not in the allowed marketplace list` or `Marketplace "<name>" is blocked by enterprise policy`
   (§14.8.8). <!-- req: policy.org.Restrict what users can install.At session start -->
4. Set in the claude.ai admin console, the lists bind the sessions that read server-managed settings,
   and claude.ai itself refuses a repository the allowlist does not admit or the blocklist names when
   anyone in the organization adds a marketplace from a git repository on claude.ai or from
   **Customize** in the desktop app outside its Code tab, for their own account or for the
   organization. It does not re-check marketplaces added before and does not check uploaded plugins.
   Set in any other managed source, only the client enforces them. <!-- req: policy.org.Restrict what users can install.The claude.ai admin console -->
5. **Restriction active.** While any allowlist is set, or the blocklist names any source other than
   `skills-dir`, a plugin whose marketplace the client cannot find does not load, and `/plugin`
   shows the policy error rather than a not-found error (Judgment J14.5).
6. Where they come from: the lists are restriction allowlists (§14.2.3), taken whole from the
   highest source that sets one; a parent-supplied allowlist is blocked by a managed one and a
   parent blocklist adds to the managed ones (§14.2.6).

### Source entries

Each list is an array of source objects: the marketplace source types of §15.8.1, plus the forms
valid only in these two lists (`hostPattern`, `pathPattern`, `skills-dir` and the `owner/*` form of
`repo`; `plugins/marketplace-reference.md`, "Source values valid only in policy lists" and "Marketplace
sources").
<!-- req: policy.rule.Source values valid only in policy lists | policy.rule.Source objects in settings -->

| Entry | Fields | Matches |
| --- | --- | --- |
| `github` | `repo` required; optional `ref` (branch or tag) and `path` (subdirectory) | A `github` source, exactly (below). <!-- req: policy.reference.Allowed source types.github | policy.org.Allowlist with strictKnownMarketplaces.github --> |
| `github` owner wildcard | `repo` is `"<owner>/*"` | Every repository under that owner (§ Owner wildcards). <!-- req: policy.org.Allowlist with strictKnownMarketplaces.github owner wildcard --> |
| `git` | `url` required; optional `ref` and `path` | A `git` source, exactly. <!-- req: policy.reference.Allowed source types.git | policy.org.Allowlist with strictKnownMarketplaces.git --> |
| `url` | `url` required; optional `headers` | A `url` source by its `url`; `headers` are never compared. <!-- req: policy.reference.Allowed source types.url | policy.org.Allowlist with strictKnownMarketplaces.url --> |
| `file` | `path` required: the absolute path of a `marketplace.json` | A `file` source, exactly. <!-- req: policy.reference.Allowed source types.file --> |
| `directory` | `path` required: the absolute path of a directory holding `.claude-plugin/marketplace.json` | A `directory` source, exactly. <!-- req: policy.reference.Allowed source types.directory | policy.org.Allowlist with strictKnownMarketplaces.file and directory --> |
| `settings` | `name`, `plugins` | The allowlist admits a `settings` source with the same `name` and identical `plugins`; the blocklist blocks any with the same `name`. |
| `npm` | `package` | Parses and matches nothing on either list, since no `npm` marketplace registers (§15.8.1). |
| `hostPattern` | `hostPattern` required: a regular expression | The host of a `github`, `git` or `url` source, matched anywhere in the hostname; anchor with `^` and `$` to match the whole host. <!-- req: policy.reference.Allowed source types.hostPattern | policy.org.Allowlist with strictKnownMarketplaces.hostPattern --> |
| `pathPattern` | `pathPattern` required: a regular expression | The `path` of a `file` or `directory` source, matched anywhere; `^` pins a prefix and `".*"` allows every local path. <!-- req: policy.reference.Allowed source types.pathPattern | policy.org.Allowlist with strictKnownMarketplaces.pathPattern --> |
| `skills-dir` | none | No marketplace; it decides whether skills-directory plugins load (below). <!-- req: policy.reference.Allowed source types.skills-dir | policy.org.Allowlist with strictKnownMarketplaces.skills-dir --> |

1. **Host of a source**, for `hostPattern`: a `github` source is always `github.com`; a `url`
   source's host is its URL's hostname; a `git` source with a scheme (`https://`, `ssh://`) has its
   URL's hostname, one in git's scp form `user@host:path` has the host between `@` and `:`, and any
   other form has no host and matches no allowlist `hostPattern`. The blocklist reads a host from a
   wider set of forms (Judgment J14.6). `file` and `directory` sources have no host. A marketplace
   hosted on claude.ai is matched by its host: an allowlist `hostPattern` matching `claude.ai` admits
   the organization's claude.ai marketplaces and the claude.ai default marketplaces, not one made of a
   member's own uploads or one whose scope claude.ai did not state.
2. **Patterns** that do not compile are stripped from the allowlist (§14.4.3) and kept, matching
   nothing, in the blocklist. The regular-expression dialect is ECMAScript (Judgment J14.7).
3. A `url` marketplace downloads only its `marketplace.json`, so its plugins MUST use a source other
   than a relative path.
4. `hostPattern`, `pathPattern`, `skills-dir` and the `owner/*` form of `repo` are refused anywhere
   but these two lists; an `extraKnownMarketplaces` source or `/plugin marketplace add` MUST name a
   single repository. An `extraKnownMarketplaces` value is a map from name to `{ source, autoUpdate? }`
   (§14.8.2); the two policy lists are arrays of bare source objects.

### Allowlist matching

1. **Exact matching.** Every entry but an owner wildcard, `hostPattern` and `pathPattern` admits a
   source only when it matches exactly. For `github` and `git`, `repo` or `url` must be equal, and
   `ref` and `path` must each be equal or absent on both sides: an entry without `ref` does not admit
   a source with `ref: "main"`; a `github` entry does not admit a `git` URL cloning the same
   repository; a trailing slash, a `.git` suffix or `ssh://` for `https://` is a different value.
   <!-- req: policy.reference.Exact matching | policy.org.How entries match -->
2. An empty allowlist, `[]`, admits no source, the official marketplace included. It does not cover
   plugins synced from claude.ai, which come from the user's account, not a marketplace; managed
   `syncClaudeAiPlugins: false`, or turning Skills off for the organization on claude.ai, stops
   those. <!-- req: policy.org.Lock every source out -->

### Owner wildcards

A `github` entry whose `repo` is `"<owner>/*"` matches every repository of that owner. Only the whole
repository-name position may be `*`: `*`, `*/plugins` and `acme/tools-*` are invalid and match
nothing. The two lists differ:

| Rule | `strictKnownMarketplaces` | `blockedMarketplaces` |
| --- | --- | --- |
| Source spellings | The `owner/repo` form of a `github` source only; a git URL of the same repository does not match. <!-- req: policy.reference.Owner wildcards.Matching source spellings --> | Any spelling, git URLs of the same github.com repository included. |
| Owner case | Case-sensitive. <!-- req: policy.reference.Owner wildcards.Owner case --> | Case-insensitive. |
| `ref` | Exact: an entry with `ref` matches only that ref, one without matches only sources without. <!-- req: policy.reference.Owner wildcards.ref --> | An entry without `ref` blocks every ref. |
| `path` | An entry with `path` requires that value; one without matches any path in the repository. <!-- req: policy.reference.Owner wildcards.path --> | An entry without `path` blocks every path. |

### Blocklist matching

`blockedMarketplaces` takes the same entries and is checked first, so a source on both lists is
blocked. Its matching is wider: git URLs are canonicalized, so the `git@` and `https://` forms, `.git`
suffixes and trailing slashes of one github.com repository are one repository (Judgment J14.6); a
`github` entry blocks the equivalent `git` URL and the reverse; an owner wildcard compares the owner
without case; an entry without `ref` or `path` blocks every ref and path. A `url` entry also stops a
user adding an `https://` repository URL the client clones rather than fetches, such as a bare
`github.com` URL, ignoring a `.git` suffix and a `#ref`. A blocklist does not block a marketplace
already registered from a source it does not match. <!-- req: policy.org.Blocklist with blockedMarketplaces -->

### Skills-directory plugins

1. *Skills-directory plugins* are folders with `.claude-plugin/plugin.json` under `~/.claude/skills/`
   or a project's `.claude/skills/` (`@skills-dir`, §16). They do not load when: any allowlist is set
   without a `{ "source": "skills-dir" }` entry (an empty one included); the blocklist has that entry;
   or `strictPluginOnlyCustomization` locks any surface, whether or not the entry is present. The
   allowlist never governs a plain `SKILL.md` without the manifest. <!-- req: policy.org.Keep skills-directory plugins loading -->
2. A blocklist that names only `skills-dir` is not an active restriction (§ Enforcement, item 5).
3. A skipped folder shows in neither `/plugin` nor `claude plugin list`, and with no error; its
   commands, agents, hooks and MCP servers are missing. Unless skills are locked, a `SKILL.md` at the
   folder's root still loads as a plain skill. (`plugins/loading.md`, "Skills-directory plugins
   blocked by managed settings".)

   | Cause | Rule |
   | --- | --- |
   | Customization locked to plugins | `strictPluginOnlyCustomization` `true` or an array naming any surface: the whole plugin is skipped whichever components it has. <!-- req: policy.loading.Skills-directory plugins blocked by managed settings.Customization locked to plugins --> |
   | Marketplace sources restricted | An allowlist without `skills-dir`, or a blocklist with it. <!-- req: policy.loading.Skills-directory plugins blocked by managed settings.Marketplace sources restricted --> |

   To confirm the cause, `/status` shows `Enterprise managed settings` in `Setting sources` (§14.5).
   <!-- req: policy.loading.Skills-directory plugins blocked by managed settings.Confirm the cause -->
   To load the whole plugin, the user adds it to an allowed marketplace and installs it, or loads it
   for one session with `--plugin-dir` unless `disableSideloadFlags` is set.
   <!-- req: policy.loading.Skills-directory plugins blocked by managed settings.Load the whole plugin -->

### The official marketplace under an allowlist

1. With `{ "source": "github", "repo": "anthropics/claude-plugins-official" }` as the only entry, the
   client keeps an already-registered official marketplace and, on a fresh machine, registers it
   itself at the first interactive terminal session. It does not register it in a `-p` run, in a
   terminal attached to a cloud session, on a machine that has only run the VS Code extension, or on
   a machine that once ran under a policy blocking it (an empty allowlist included): the client
   records the blocked attempt and does not retry after the policy changes. There a managed
   `extraKnownMarketplaces` entry, an `enabledPlugins` entry for one of its plugins, or a manual
   `claude plugin marketplace add anthropics/claude-plugins-official` registers it.
   <!-- req: policy.reference.Allow only the official marketplace -->
2. The allowlist registers nothing. An `extraKnownMarketplaces` entry registers, and MUST itself pass
   the allowlist: the client refuses to register a managed marketplace whose source the allowlist
   does not admit. The common policy allows the official marketplace and the organization's own,
   registers both, enables the organization's plugins and sets `disableSideloadFlags`; under it,
   adding any other source fails with a message containing `is blocked by enterprise policy` and the
   allowed sources, and `claude --plugin-dir ./x` exits naming `disableSideloadFlags`.
   <!-- req: policy.org.Allow the official marketplace and your own -->
3. The two keys compared:

   | Aspect | `strictKnownMarketplaces` | `extraKnownMarketplaces` |
   | --- | --- | --- |
   | Purpose | Policy: which sources may be used. <!-- req: policy.reference.Combine with extraKnownMarketplaces.Purpose --> | Convenience: register missing marketplaces. |
   | Settings file | Managed only. <!-- req: policy.reference.Combine with extraKnownMarketplaces.Settings file --> | Any file (§12). |
   | Behavior | Refuses additions it does not admit. <!-- req: policy.reference.Combine with extraKnownMarketplaces.Behavior --> | Registers each marketplace not yet known. |
   | When enforced | Before network and filesystem operations. <!-- req: policy.reference.Combine with extraKnownMarketplaces.When enforced --> | At once from user or managed settings; after the trust dialog from a repository's files. |
   | Can be overridden | No: highest precedence. <!-- req: policy.reference.Combine with extraKnownMarketplaces.Can be overridden --> | Yes, by a higher-precedence file, whose entry replaces the lower one whole. |
   | Source format | A bare source object. <!-- req: policy.reference.Combine with extraKnownMarketplaces.Source format --> | A named entry with a nested `source`. |

   With only the allowlist set, users may add an allowed marketplace themselves; the official one is
   the only marketplace the client registers on its own, and only when admitted.

### Marketplace sources in `extraKnownMarketplaces`

The `source` of an `extraKnownMarketplaces` entry is one of the forms below (§15 states each); a
policy list compares against these registered sources. <!-- req: policy.reference.Marketplace source types -->

| Form | Fields |
| --- | --- |
| `github` | `repo`, naming one repository; optional `ref`, `path`. <!-- req: policy.reference.Marketplace source types.github --> |
| `git` | `url`, any git URL on any host; optional `ref`, `path`. Cloned with the authentication `git clone` uses on the machine (credential helpers or SSH keys); a token such as `GITHUB_TOKEN` works only through a credential helper that reads it. For `github` and `git` sources Git LFS content is never downloaded: LFS files are checked out as pointer files and the add or update output reports how many (`skipLfs` is accepted and ignored). <!-- req: policy.reference.Marketplace source types.git --> |
| `url` | `url` of a `marketplace.json`; optional `headers` and `headersHelper`, a command printing short-lived headers, run before each fetch of the catalog and each archive download on the same origin, its output reused for up to 60 seconds; ignored in the settings of an `--add-dir` directory. <!-- req: policy.reference.Marketplace source types.url --> |
| `file` | `path` of a `marketplace.json`. <!-- req: policy.reference.Marketplace source types.file --> |
| `directory` | `path` of a marketplace directory; for development, or a marketplace the organization deploys to each machine (§14.9.5). <!-- req: policy.reference.Marketplace source types.directory --> |
| `settings` | An inline marketplace: `name`, equal to the entry's key, and `plugins`, each referencing an external source; each plugin is still enabled in `enabledPlugins`. <!-- req: policy.reference.Marketplace source types.settings --> |

For a plugin entry of a `settings` source whose own source is an `archive`, `headers` and
`headersHelper` apply to that archive's download only, and the command runs only when the user
installs or updates that one plugin by itself. Three rules depend on the file holding the entry:

- **`strict`**: an entry in settings needs no `"strict": false`, since a settings file carries no
  manifest fields. <!-- req: policy.reference.Marketplace source types.strict -->
- **Folder trust**: for an entry in a project's `.claude/settings.json` or `.claude/settings.local.json`,
  the command runs only after the folder is trusted. <!-- req: policy.reference.Marketplace source types.Folder trust -->
- **Header filter**: the client drops request-routing and client-identity header names from an entry
  in a project's settings files, a catalog entry and an `--add-dir` directory's settings; not from
  user settings, a `--settings` file or managed settings. <!-- req: policy.reference.Marketplace source types.Header filter -->

### Aliases

`allowedMarketplaces` is an alias of `strictKnownMarketplaces` and `additionalMarketplaces` of
`extraKnownMarketplaces`. Wherever the canonical key is accepted, the alias is read the same way;
when a file sets both spellings the canonical value applies and the alias is ignored; the client MAY
rewrite `additionalMarketplaces` to the canonical name when it updates the file. Clients before
2.1.232 ignore the aliases, so a file a mixed fleet reads SHOULD use the canonical names.
<!-- req: policy.reference.Marketplace key aliases | policy.org.Aliases for the marketplace keys -->

## 14.8.4 Seeds for containers and CI

1. `CLAUDE_CODE_PLUGIN_SEED_DIR` names one or more pre-populated plugin directories (`:`-separated on
   Unix, `;` on Windows), built by running installs with `CLAUDE_CODE_PLUGIN_CACHE_DIR` pointing at
   the seed path. A seed has the layout of `~/.claude/plugins` (`known_marketplaces.json`,
   `marketplaces/<name>/`, `cache/<marketplace>/<plugin>/<version>/`) and MAY be mounted elsewhere
   than where it was built. At startup the client registers the seed's marketplaces and loads plugin
   caches from it in place, using the first seed that holds a given marketplace or cache. Seed
   plugins are not enabled by themselves: `enabledPlugins` enables them. §16 defines the cache.
2. Seed marketplaces follow these rules:
   - **Read-only**: the client never writes to a seed and forces `autoUpdate` off for its
     marketplaces. <!-- req: policy.org.Seed containers and CI.Read-only -->
   - **Build from the declared source**: when user or managed settings declare a seed marketplace's
     name in `extraKnownMarketplaces`, the operator builds the seed from that same source and `ref`,
     so the seed and the declaration agree (Judgment J14.16). <!-- req: policy.org.Seed containers and CI.Build from the declared source -->
   - **Opting out**: when the repository's settings enable a seed plugin, a user opts out with
     `claude plugin disable`, not by removing the marketplace. <!-- req: policy.org.Seed containers and CI.Opting out -->
   - **Update and remove fail**: `claude plugin marketplace update <name>` and `remove` without
     `--scope` on a seed marketplace fail with a message naming the seed directory (§14.8.8); a bulk
     `marketplace update` skips it. <!-- req: policy.org.Seed containers and CI.Update and remove fail -->
   - **Policy still applies**: the allowlist and blocklist check a seed marketplace's recorded
     source. <!-- req: policy.org.Seed containers and CI.Policy still applies -->
3. `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` also turns plugin auto-update off, for fleets with no
   outbound git access.

## 14.8.5 The control matrix

Every key below is managed-only, except `enabledPlugins` (any file, locked by the managed value),
`syncClaudeAiPlugins` (also user, local and `--settings`), `CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL`
(an environment variable, delivered through the managed `env` block) and `allowManagedModsOnly` (an
option of the built-in guard under managed `pluginConfigs`, §14.9). <!-- req: policy.org.Control matrix -->

| Key | Enforces | Does not |
| --- | --- | --- |
| `strictKnownMarketplaces` | The allowlist of §14.8.3; `[]` blocks every source. | Register a marketplace, restrict entries inside an allowed marketplace, or block `--plugin-dir`. <!-- req: policy.org.Control matrix.strictKnownMarketplaces --> |
| `blockedMarketplaces` | The blocklist of §14.8.3, checked first. | Block a marketplace registered from a source it does not match. <!-- req: policy.org.Control matrix.blockedMarketplaces --> |
| `syncClaudeAiPlugins` | `false` stops downloading and loading the plugins synced from claude.ai (`<name>@synced`, §16); in user or managed settings it also moves those already synced to `~/.claude/plugins/.trash/`. `true` equals unset. A `false` from any admin source, the user's own user or local settings, or a `--settings` file applies; a repository cannot set it. | Turn off one synced plugin: `"<name>@synced": false` in `enabledPlugins` does. <!-- req: policy.org.Control matrix.syncClaudeAiPlugins --> |
| `enabledPlugins` | `true` force-enables, `false` blocks at every scope and hides the plugin. | Install a plugin whose marketplace is not registered or allowed. <!-- req: policy.org.Control matrix.enabledPlugins --> |
| `disableSideloadFlags` | See item 1. | Restrict `.mcp.json`, `claude mcp add` or SDK-provided servers; `allowedMcpServers` does (§8.11.5). <!-- req: policy.org.Control matrix.disableSideloadFlags --> |
| `disableCommandPluginSources` | See item 2. | Affect other source types. <!-- req: policy.org.Control matrix.disableCommandPluginSources --> |
| `allowManagedHooksOnly` | See item 3. | Trust hooks of plugins users enable themselves. <!-- req: policy.org.Control matrix.allowManagedHooksOnly --> |
| `strictPluginOnlyCustomization` | See item 4. | Restrict which plugins users install, or reject the flags that sideload plugins, agents and MCP servers; pair it with the allowlist and `disableSideloadFlags`. <!-- req: policy.org.Control matrix.strictPluginOnlyCustomization --> |
| `pluginSuggestionMarketplaces` | See item 5. | Affect the built-in tips. <!-- req: policy.org.Control matrix.pluginSuggestionMarketplaces --> |
| `pluginTrustMessage` | See item 6. | Change the warning's own text. <!-- req: policy.org.Control matrix.pluginTrustMessage --> |
| `allowedChannelPlugins` | Replaces the default channel allowlist; needs `channelsEnabled: true` (§14.8.6). | Register a channel the user did not opt in. <!-- req: policy.org.Control matrix.allowedChannelPlugins --> |
| `CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL=1` | Stops interactive terminal sessions from registering the official marketplace on their own. | Remove a registered one. The lists gate the same registration without it; a machine that started once with it set does not resume after it is unset. |
| `allowManagedModsOnly` | Stops every mod not counted as the organization's from running its hooks (§14.9.1). | Stop a plugin containing a mod from installing; the marketplace keys do. <!-- req: policy.org.Control matrix.allowManagedModsOnly --> |

1. **`disableSideloadFlags`** (default `false`). `true` rejects at startup `--plugin-dir`,
   `--plugin-url`, `--agents`, the Agent SDK `plugins` option and the folders named in
   `CLAUDE_CODE_PLUGIN_DIRS`, and `--mcp-config` unless every server in it is an in-process `type:
   "sdk"` entry. The client exits with an error naming each rejected flag, each line reading `<flag>
   is disabled by your organization's managed settings (disableSideloadFlags)`, followed by
   `Plugins, custom agents, and MCP servers can only be loaded from sources your administrator has
   approved.`; for the variable it says to unset it (Judgment J14.8). An Agent SDK `reloadPlugins()`
   call with `addPlugins` fails with an error and the session keeps its plugins. A mod Claude writes
   during a session does not load. In a cloud session the client instead starts and drops every
   server-delivered `--mcp-config` entry and every server-delivered mid-session MCP update, except
   in-process `type: "sdk"` entries and a Claude Tag session's Slack tools. Deployed to a device by
   MDM or file, it also stops the desktop app passing its own managed plugins to local Code and Cowork
   sessions on that device. <!-- req: policy.key.disableSideloadFlags | policy.managed.Keys only a managed source can set.disableSideloadFlags -->
2. **`disableCommandPluginSources`**. `true` never runs a `command` plugin source's command (§15),
   installs and updates no command-sourced plugin and stops loading those installed, force-enabled
   ones included; `false` allows them explicitly. Unset, it takes the value of
   `allowManagedHooksOnly`; a `disableAllHooks: true` in the SDK's `managedSettings` does not by
   itself disable them. Whenever command sources are blocked, marketplace `headersHelper` commands are
   blocked too, except for a marketplace managed settings themselves declare.
3. **`allowManagedHooksOnly`**. `true` runs only: managed hooks; hooks the Agent SDK registers in
   process; and hooks of plugins managed `enabledPlugins` force-enables, matched on the full
   `plugin@marketplace` id, a mod in such a plugin loading only when it counts as the organization's
   (§14.9.5). It blocks user, project and local hooks, the hooks and mods of every other plugin,
   agent-frontmatter hooks, and the monitors of plugins not force-enabled; built-in mods keep
   running. It disables command-sourced plugins and blocks marketplace `headersHelper` commands
   unless `disableCommandPluginSources` is explicitly `false`; reads `statusLine` and
   `fileSuggestion` from managed settings only; and `/goal` cannot run. §7 states the hook
   side.
4. **`strictPluginOnlyCustomization`**. `true` locks all four surfaces; an array locks those it
   names of `"skills"`, `"agents"`, `"hooks"` and `"mcp"`; an unrecognized name locks nothing.
   Locked surfaces load only from plugins, managed settings and built-ins: `skills` stops
   `~/.claude/skills/`, `.claude/skills/`, `~/.claude/commands/`, `.claude/commands/`, `--add-dir`
   skills and synced claude.ai skills (§4); `agents` stops `~/.claude/agents/`, `.claude/agents/` and
   `--add-dir` agents (§5); `hooks` stops hooks of user, project and local settings and frontmatter
   hooks of the components a skills or agents lock would block, and a personal or project skill that
   declares `hooks` loses its `allowed-tools` pre-approval except in a `context: fork` subagent (§7);
   `mcp` stops `~/.claude.json` and `.mcp.json` servers (§8.11). Any lock also stops skills-directory
   plugins (§14.8.3). Plugins other than skills-directory plugins keep every surface.
5. **`pluginSuggestionMarketplaces`**: an array of marketplace names whose plugins' `relevance`
   (§15) may surface as install suggestions in spinner tips and at the top of the `/plugin`
   **Discover** tab. Unset, no marketplace-declared suggestion surfaces in the terminal. A name takes
   effect only when the marketplace is registered on the machine and its registered source is
   declared in the same managed settings, as that name's `extraKnownMarketplaces` entry or as a
   `strictKnownMarketplaces` entry; a marketplace registered under the name from another source is
   ignored. `claude-plugins-official` needs only its name. In a cloud session's conversation and in
   the desktop app's Code tab Claude may suggest plugins regardless. <!-- req: policy.relevance.Enable suggestions in managed settings | policy.org.Recommend plugins -->
6. **`pluginTrustMessage`**: a string the client appends to the trust warning `/plugin` shows before a
   plugin installs, after the standard text (Judgment J14.9).

## 14.8.6 Channels

1. `channelsEnabled` (managed only) is the master switch for channels (§9.3). On claude.ai Team and
   Enterprise plans, and on Console accounts on a machine with managed settings, channels are blocked
   until it is `true`; `false` equals unset. Console accounts without managed settings, and Pro, Max
   and Ultra users without an organization, are allowed. An Owner can also enable channels from the
   console. While off, a channel's MCP server still connects and its tools work, but no channel
   registers, the development flag included, and a startup warning tells the user to have an admin
   enable it. <!-- req: policy.overview.Enable channels for your organization -->
2. `allowedChannelPlugins` (managed only) replaces the Anthropic-maintained default list once
   `channelsEnabled` passes. Entries are `{ "marketplace", "plugin" }` objects or the equivalent
   `"plugin@marketplace"` string (Judgment J14.10); both names match exactly. An empty array blocks
   every channel plugin, though `--dangerously-load-development-channels` still bypasses it for local
   testing; to block that flag too, leave `channelsEnabled` unset. A plugin passed to `--channels`
   that is not on the list does not register; the session starts and its startup notice says the
   plugin is not on the organization's approved list. Pro, Max and Ultra users without an
   organization skip both keys. <!-- req: policy.overview.Restrict which channel plugins can run -->

## 14.8.7 Update policy

1. Plugin auto-update runs in the background after startup for marketplaces that have it on (§16).
   When a managed `extraKnownMarketplaces` entry sets `autoUpdate`, the client refuses the user's
   `/plugin` toggle with an error starting `Auto-update for '<name>' is set by`; when it leaves the
   field unset, the user's toggle persists.
2. `DISABLE_AUTOUPDATER` in the managed `env` block turns plugin auto-update off for every marketplace
   and stops the client's own updates; `FORCE_AUTOUPDATE_PLUGINS=1` beside it keeps plugin
   auto-update on. Neither governs a `command`-sourced plugin, whose command re-runs each session
   (§16).
3. Per-group release channels need settings delivered per group: separate endpoint-managed settings,
   gateway policies, or on an Enterprise plan the server-managed group configurations (§14.3.7).
   A group configuration does not merge with the organization-wide one, so each lists every
   marketplace its group needs.

## 14.8.8 Messages users read

The client MUST print these when policy refuses (`plugins/troubleshooting.md`, "Blocked by your
organization"). Placeholders are as shown; a source is written `<type>:<locator>`, such as
`github:acme/plugins` (Judgment J14.11).

| Message | When |
| --- | --- |
| `Marketplace source '<source>' is blocked by enterprise policy` | `/plugin marketplace add`, `update` or an install is refused by either list. When the allowlist refused, the message continues `. Allowed sources: <list>`, or `. No external marketplaces are allowed.` for an empty allowlist; when the allowlist admits a git host by `hostPattern` and the user gave `owner/repo` shorthand, a `Tip:` line says the shorthand assumes github.com and to add the full URL. A marketplace added before stops refreshing too. <!-- req: policy.troubleshooting.Marketplace source '<source>' is blocked by enterprise policy --> |
| `Marketplace "<name>" is not in the allowed marketplace list` | In `/plugin`'s **Errors** tab for a registered marketplace the allowlist no longer admits; the next line lists the allowed sources, or reads `Contact your administrator to configure allowed marketplace sources`. The blocklist variant is `Marketplace "<name>" is blocked by enterprise policy` with `This marketplace source is explicitly blocked by your administrator`. The marketplace and its plugins stop loading. <!-- req: policy.troubleshooting.Marketplace "<name>" is not in the allowed marketplace list --> |
| `Plugin "<name>" is blocked by your organization's policy and cannot be installed` | An install refused by managed `enabledPlugins`; an enable reads `... cannot be enabled`. An install or update refused for its marketplace reads `Plugin "<name>" is from marketplace "<marketplace>", which is blocked by your organization's policy`, and for a dependency `Plugin "<name>" depends on "<dep>", which is blocked by your organization's policy`. <!-- req: policy.troubleshooting.Plugin "<name>" is blocked by your organization's policy and cannot be installed --> |
| `--plugin-dir is disabled by your organization's managed settings (disableSideloadFlags)` | Startup with a flag `disableSideloadFlags` rejects (§14.8.5 item 1). A related **Errors** line, `--plugin-dir copy of "<name>" ignored: plugin is locked by managed settings`, marks a copy of a plugin managed `enabledPlugins` names. <!-- req: policy.troubleshooting.--plugin-dir is disabled by your organization's managed settings (disableSideloadFlags) --> |
| `Plugins from ~/.claude/skills/ are blocked by your organization's managed settings` | `claude plugin init` or `claude plugin enable` on a skills-directory plugin while a list blocks them; the message names `strictKnownMarketplaces or blockedMarketplaces` and asks the administrator to add `{"source":"skills-dir"}` to the allowlist or remove it from the blocklist. <!-- req: policy.troubleshooting.Plugins from ~/.claude/skills/ are blocked by your organization's managed settings --> |
| `Command-sourced plugins are disabled by your organization's managed settings` | An install or update of a `command`-sourced plugin under `disableCommandPluginSources`, or `allowManagedHooksOnly` with it unset; followed by `The plugin was not installed or updated and its command was not run.` <!-- req: policy.troubleshooting.Command-sourced plugins are disabled by your organization's managed settings --> |
| `Marketplace '<name>' is seed-managed (<dir>)` | `claude plugin marketplace update <name>` on a marketplace an operator pre-populated through `CLAUDE_CODE_PLUGIN_SEED_DIR`, with a hint to ask the administrator. A seed-managed marketplace is read-only: the client MUST refuse to update it by name, and a bulk `marketplace update` MUST skip it and update the others (§14.8). <!-- req: policy.troubleshooting.Marketplace '<name>' is seed-managed --> |

## 14.8.9 Limits and troubleshooting

1. Managed settings have no key for: per-user or per-group targeting (deliver each group its own
   settings, as §14.8.7 item 3 says); restricting entries inside an allowed marketplace (use managed
   `enabledPlugins` `false`); hiding `/plugin` (combine an allowlist of the organization's
   marketplace, managed `enabledPlugins` and `disableSideloadFlags`); gating `--plugin-dir` through
   the allowlist (`disableSideloadFlags` does); and enforcing the claude.ai plugin toggles, which
   reach the client as synced plugins with their own controls. <!-- req: policy.org.Plan for what managed settings can't enforce -->
2. When plugin policy misbehaves: a managed file that does not parse stops the client (§14.4.1),
   while one invalid entry keeps the rest; a missing `Enterprise managed settings` in `/status` means
   the source did not load; a `blocked by enterprise policy` message names the marketplace or source,
   and for an allowlist the allowed sources; a plugin the user disabled in `~/.claude/settings.json`
   that still loads was re-enabled by another source, and `/plugin` and `claude plugin list` show
   `Disabled in ~/.claude/settings.json but still loads` with that source (§12).
   <!-- req: policy.org.Troubleshoot policy -->

## Design decisions

### Why the allowlist matches exactly and the blocklist widely

An allowlist entry is a grant: reading it widely would admit sources the administrator never named,
so a different spelling of a repository is a different source and the administrator lists it or uses
a `hostPattern`. A blocklist entry is a refusal: reading it narrowly would let a respelling of the
same repository through, so it is canonicalized and covers every ref and path.

### Why policy is checked again at session start

A marketplace can be registered before a policy arrives, and a cache can outlive the source that
filled it. Checking only on add would leave those plugins loading; checking at session start makes
the current policy the one in force.

## Judgments

| Id | Judgment | Evidence |
| --- | --- | --- |
| J14.5 | For a marketplace the client cannot find while a restriction is active, the message is the allowlist's (`... is not in the allowed marketplace list`) when an allowlist is set, otherwise the blocklist's. | plugins/org.md says `/plugin` "shows the policy error" without saying which; the reference implementation's reading. |
| J14.6 | The blocklist's canonical repository ignores scheme, user, port, a trailing slash, a `.git` suffix and a `#ref`, lowercases the host and keeps the path's case; its wider host reading also takes `host:path`, `host/path` and `user@host/path`. | plugins/org.md lists the spellings that match; settings-reference.md says only "a wider set of forms"; the reference implementation's reading. |
| J14.7 | `hostPattern` and `pathPattern` are ECMAScript regular expressions, tested unanchored. | The docs say "regex" and "matches anywhere"; the client is JavaScript. |
| J14.8 | Each rejected sideload flag gets its own line in the `--plugin-dir` form; `CLAUDE_CODE_PLUGIN_DIRS` gets the same form followed by `: unset the variable`. | troubleshooting.md quotes the `--plugin-dir` line and says the error names "the rejected flags"; settings-reference.md says the variable's error "says to unset it". |
| J14.9 | `pluginTrustMessage` follows the standard warning after a blank line; an empty or blank value adds nothing. | The docs say "appends" and name no separator. |
| J14.10 | The string form of an `allowedChannelPlugins` entry splits at its last `@`. | settings-reference.md gives `"telegram@claude-plugins-official"` and no rule for a name containing `@`; plugin names cannot contain `@` (§2.3). |
| J14.11 | A source in a refusal message is written `<type>:<locator>` (`github:<repo>`, `git:<url>`, `url:<url>`, `file:<path>`, `directory:<path>`, `settings:<name>`, `npm:<package>`, `hostPattern:<pattern>`, `pathPattern:<pattern>`, `skills-dir`). | troubleshooting.md quotes the messages with `<source>` and no spelling; the reference implementation's reading. |
| J14.16 | A seed marketplace whose name user or managed settings also declare is built from the declared source and `ref`; which of the two applies when they differ is not specified (§14.8.4). | plugins/org.md of 2.1.321 said a seed entry overwrites the user's entry of the same name at each startup; 2.1.330 drops that rule and tells operators to build the seed from the declared source. A run of `claude plugin marketplace list` with a seed and a differing declaration in a scratch configuration (2.1.330) listed neither, since seeds register at session start, so the behaviour on a mismatch was not observed. |
