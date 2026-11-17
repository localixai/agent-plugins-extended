# 13. Permissions and trust (continued): workspace trust and plugin security

This file continues [§13](13-permissions.md). Workspace trust decides what a folder's own content
may grant before the user has accepted it; the plugin security model says what an installed plugin
can do and which warnings and refusals guard it. Evidence: `permissions.md`, "Project allow rules
and workspace trust" and "What runs before you trust a folder"; `hooks.md`, "Workspace trust";
`plugins/loading.md`, "Plugins shared through a repository"; `plugins/security.md`. The MCP side of
trust (project server approval, `headersHelper`) is §8.11, the subagent side §5.11–§5.12, the
marketplace side §15, managed plugin controls §14.

## 13.15 Workspace trust

1. `permissions.allow` rules and `permissions.additionalDirectories` entries in a project's
   `.claude/settings.json` grant capability, so the client MUST apply them only after the user
   accepts the workspace trust dialog for that folder. The dialog MUST list the rules and directories
   the folder would grant. `deny` and `ask` rules restrict only and apply at once.
   <!-- req: trust.behavior.Project allow rules and workspace trust -->
2. The client keys and stores accepted trust by where it started:
   - in a git repository, on the repository root (in a worktree, the main checkout's root); the
     trust covers the whole repository except a repository nested inside it, such as a submodule;
   - outside a repository, on the start directory; it covers every subdirectory except a nested
     repository, each covered subdirectory counting as a folder whose parent was trusted;
   - in the home directory, for the current session only, never written to disk.
3. The dialog appears in interactive sessions only. A `claude -p` run or an SDK session never shows
   it, and a parent folder's trust does not count for project allow rules (§13.16).
4. Before starting or restarting a background session, the client MUST check trust for its
   directory: from a terminal in that directory it shows the dialog first; where no dialog can
   appear it exits with `Workspace not trusted. Run \`claude\` in <path> once and accept the trust prompt, then retry.`
   (`The home directory is trusted one session at a time` for the home directory, `<path> could not
   be resolved on disk` when the directory is missing).
5. Trust is set by hand with `projects["<path>"].hasTrustDialogAccepted: true` in `~/.claude.json`,
   `<path>` being the key of item 2. The client MUST print this exact key in the stderr warning for
   skipped allow rules, in the debug-log line for a skipped subagent hook or inline MCP server, and in
   the `headersHelper not run` line.
6. When the client does not know whether a folder is trusted, it treats it as untrusted (Judgment
   J13.29).

### 13.15.1 Hooks and workspace trust

The client checks trust before running any hook from a settings file. In an interactive session it
MUST hold back hooks from every settings file, the user's own `~/.claude/settings.json` included,
until the dialog is accepted for the folder or a parent whose trust covers it. A `-p` or SDK session
treats the folder as trusted, so hooks committed in a repository's `.claude/settings.json` run there;
to avoid that, a user reviews the `.claude/` files, starts with `--bare`, or passes
`--settings '{"disableAllHooks": true}'`. Subagent frontmatter hooks follow the stricter rule of
§13.16. <!-- req: trust.behavior.Workspace trust -->

### 13.15.2 When the local settings file needs trust

1. `.claude/settings.local.json` is normally the user's own, and its allow rules and directories
   apply without trust. When git tracks it, or `.claude` is a symbolic link, the client MUST treat it
   as repository-supplied and hold its rules until trust. <!-- req: trust.behavior.When your local settings file needs trust -->
2. The client runs git to tell the two apart only once the folder is trusted (by the dialog, a
   covering parent, or a `-p`/SDK session, which counts as accepted). Before that, in the
   configuration home — the home directory, or a directory whose `.claude` is `CLAUDE_CONFIG_DIR` —
   the file applies at once without git, unless the client keeps local settings at a repository root
   that holds that directory; anywhere else its rules are held like project settings. After the
   check, an untracked file, or one outside any repository, applies even in a folder not itself
   trusted.
3. A held local file is reported as
   `Ignoring <n> permissions.allow entries from .claude/settings.local.json: this workspace has not been trusted. Run Claude Code interactively here once and accept the trust dialog, or set projects["<path>"].hasTrustDialogAccepted: true in <home>/.claude.json.`
   (errors.md, "Workspace has not been trusted"; the count, key and file vary).

## 13.16 What runs before a folder is trusted

1. Each row is content a repository supplies; the columns are the two situations where the folder
   itself is not trusted. Inside a nested repository the parent column does not apply: an
   interactive session shows the dialog for it, and a `-p` run follows the last column.

   | Content | Only a parent folder trusted | `claude -p` or SDK, never trusted |
   | --- | --- | --- |
   | Settings-file hooks, the `env` block, helper commands such as `apiKeyHelper`, a project skill's hooks and `allowed-tools` | Used | Used; trust never gates `allowed-tools` <!-- req: trust.behavior.What runs before you trust a folder.env --> |
   | `permissions.allow` and `additionalDirectories` in `.claude/settings.json` | Not used until the dialog, shown again listing them, is accepted | Not used; a `this workspace has not been trusted` warning goes to stderr <!-- req: trust.behavior.What runs before you trust a folder.permissions.allow --> |
   | Project subagent frontmatter hooks, a project `@skills-dir` plugin, `extraKnownMarketplaces` from the repository or an `--add-dir` directory | Not used; no dialog offered | Not used <!-- req: trust.behavior.What runs before you trust a folder.@skills-dir --> |
   | Inline `mcpServers` in a subagent's frontmatter from the repository or an `--add-dir` directory | Not used; no dialog offered | Not used <!-- req: trust.behavior.What runs before you trust a folder.mcpServers --> |
   | `.mcp.json` servers, approved in the repository's settings or not | The user is asked before each connects; the repository's own approvals do not count | Connected without asking (the SDK only when `settingSources` includes project); `claude mcp list` still shows them pending <!-- req: trust.behavior.What runs before you trust a folder..mcp.json --> |
   | A `headersHelper` on a `.mcp.json` server | Not run until the dialog, shown again naming where it is declared, is accepted; static `headers` only | Not run; static `headers` only, and one `headersHelper not run` line per server on stderr <!-- req: trust.behavior.What runs before you trust a folder.headersHelper --> |

   <!-- req: trust.behavior.What runs before you trust a folder -->
2. Before running `claude -p` in a repository the user did not write, the client offers these
   controls: `--setting-sources user` (or SDK `settingSources` without project) reads neither project
   settings nor `.mcp.json`; `--bare` reads no project hooks, skills, commands, agents, plugins or
   `.mcp.json` servers, while project `env` and helpers such as `awsAuthRefresh` still apply and
   `apiKeyHelper` is read only from `--settings`; `--settings '{"disableAllHooks": true}'` turns hooks
   off for the run (user settings alone cannot, since project settings outrank them);
   `disabledMcpjsonServers` rejects a `.mcp.json` server by name in every session.

## 13.17 Repository plugins

1. A project-scope plugin — enabled through `enabledPlugins` in `.claude/settings.json` or placed as
   a plugin under `.claude/skills/` (`@skills-dir`, §4) — MUST load only after the trust check of
   project allow rules: a parent folder's trust or a `-p` run is not enough. Once loaded, its
   components that run code are limited: its MCP servers go through the per-server approval of a
   project `.mcp.json`; servers declared as an MCP bundle (`.mcpb`, `.dxt`) or from a file outside the
   plugin directory are skipped; its monitors do not load. Neither the check nor the limits apply to
   a plugin under the user's `~/.claude/skills/`. The client does not scan a project's
   `.claude/plugins/`. A cloud session does not add a repository's `extraKnownMarketplaces`.
   <!-- req: trust.loading.Trust check and component limits for repository plugins -->
2. A repository plugin that does not load has one of these causes, which a client's diagnostics
   SHOULD name (Judgment J13.30 for the order): <!-- req: trust.loading.Check why a repository plugin didn't load -->
   - **a subdirectory start**: the client reads `.claude/skills/` of the primary working directory
     only and, unlike plain skills, does not search parents for plugins; the user launches from the
     root or moves there with `/cd`; <!-- req: trust.loading.Check why a repository plugin didn't load.In a subdirectory -->
   - **a desktop worktree**: the plugin loads from the main checkout's `.claude/skills/`, not the
     worktree's; <!-- req: trust.loading.Check why a repository plugin didn't load.From the desktop app, in a worktree -->
   - **an untrusted folder**: it loads once the dialog is accepted; <!-- req: trust.loading.Check why a repository plugin didn't load.In a folder you haven't trusted -->
   - **managed settings**: `strictPluginOnlyCustomization`, `strictKnownMarketplaces` or
     `blockedMarketplaces` skip skills-directory plugins silently (§14).

## 13.18 The plugin security model

1. An installed, enabled plugin can run code with the user's privileges: hooks run as shell
   commands at lifecycle points; monitors run as background commands at session start, on reload or
   on a skill's first run; a mod runs JavaScript inside the client; stdio MCP servers and LSP servers
   run as processes; `bin/` is put on the Bash tool's `PATH` (on PowerShell's only outside the
   sandbox). Skills, commands and agents enter Claude's context as instructions. A plugin from a
   marketplace with auto-update on can change on disk after review (§16).
2. Permission rules and the sandbox MUST cover Claude's tool calls, not code a plugin runs itself:
   hooks, monitors, MCP and LSP servers and the processes a mod starts run outside the sandbox and
   outside the rules. A call to a plugin's MCP tool and a Bash command running a `bin/` executable
   are tool calls, so the rules apply (§13.14).
3. Installing a plugin enables it, unless its manifest or marketplace entry sets
   `defaultEnabled: false` and the user has not enabled it (§2.4, §16).
4. Before install the client SHOULD let the user inspect a plugin: `/plugin`'s details pane lists
   under **Will install** its commands, agents, skills, hooks and MCP and LSP servers, or
   `Components will be discovered at installation` (a plugin inside the marketplace) or
   `Component summary not available for remote plugin`; `claude plugin details <name>` (with
   `--plugin-dir` for an uninstalled copy) prints a `Component inventory` (§17).

## 13.19 Marketplace tiers

1. A marketplace's name places it in a tier: official, community, or third-party. The client MUST
   accept an official or community name only for a marketplace sourced from a `github` or `git`
   source under `github.com/anthropics/`; every other marketplace is third-party, whoever publishes
   it. How the names are reserved, including other spellings, is §15.
2. The official names are:

   | Name |
   | --- |
   | `claude-plugins-official` <!-- req: trust.security.Official marketplace names.claude-plugins-official --> |
   | `claude-code-marketplace` <!-- req: trust.security.Official marketplace names.claude-code-marketplace --> |
   | `claude-code-plugins` <!-- req: trust.security.Official marketplace names.claude-code-plugins --> |
   | `anthropic-marketplace` <!-- req: trust.security.Official marketplace names.anthropic-marketplace --> |
   | `anthropic-plugins` <!-- req: trust.security.Official marketplace names.anthropic-plugins --> |
   | `agent-skills` <!-- req: trust.security.Official marketplace names.agent-skills --> |
   | `anthropic-agent-skills` <!-- req: trust.security.Official marketplace names.anthropic-agent-skills --> |
   | `life-sciences` <!-- req: trust.security.Official marketplace names.life-sciences --> |
   | `knowledge-work-plugins` <!-- req: trust.security.Official marketplace names.knowledge-work-plugins --> |
   | `claude-for-legal` <!-- req: trust.security.Official marketplace names.claude-for-legal --> |
   | `claude-for-financial-services` <!-- req: trust.security.Official marketplace names.claude-for-financial-services --> |
   | `financial-services-plugins` <!-- req: trust.security.Official marketplace names.financial-services-plugins --> |
   | `first-party-plugins` <!-- req: trust.security.Official marketplace names.first-party-plugins --> |
   | `claude-tag-plugins` <!-- req: trust.security.Official marketplace names.claude-tag-plugins --> |

3. The community names are `claude-community`, `claude-plugins-community` and `healthcare`. Where the
   `claude-community` catalog pins a plugin to a commit SHA, the client MUST refuse to install any
   other commit.
4. Unless `OTEL_LOG_TOOL_DETAILS=1`, the plugin loaded event reports official-tier plugin and
   marketplace names as they are and every other as `third-party`, and the plugin installed event
   omits the name fields of a plugin that is not official.

## 13.20 Warnings and refusals

1. The details pane of every plugin, whatever its marketplace, MUST show
   `Make sure you trust a plugin before installing, updating, or using it. Anthropic does not control what MCP servers, files, or other software are included in plugins and cannot verify that they will work as intended or that they won't change. See each plugin's homepage for more information.`
   When managed settings set `pluginTrustMessage` (§14), the client appends that text, after a blank
   line (Judgment J13.31). <!-- req: trust.security.Trust warning before you install -->
2. The client MUST refuse, each with its own message: a marketplace that uses an official or
   community name from a source outside `github.com/anthropics/` stops loading together with the
   plugins installed from it, with
   `Marketplace "<name>" is registered from an untrusted source: The name '<name>' is reserved for official Anthropic marketplaces. Only repositories from 'github.com/anthropics/' can use this name. To fix it, remove the marketplace and re-add it from the official source.`
   (for a source that is not GitHub or git, the middle sentence reads
   `can only be used with GitHub sources from the 'anthropics' organization`); and an `archive`
   source whose download does not match its `sha256` pin is not installed, with
   `Plugin archive integrity check failed for <url>: expected sha256 <pin>, got <digest>. The archive was not installed. Verify the sha256 in the marketplace entry, or that the URL serves the intended file.`
   The `sha256` pin is separate from the community catalog's commit pin (§15). <!-- req: trust.security.Untrusted marketplace sources and failed integrity checks -->
3. Removing a plugin a user no longer trusts is `claude plugin uninstall` at its scope (§16); the
   cached copy stays under `~/.claude/plugins/cache/` for 14 days.

## Design decisions

### Why trust gates grants and not restrictions

A cloned repository is content the user did not write. What it adds to Claude's reach — allow
rules, directories, plugins, servers — waits for the user's explicit acceptance; what it takes away
— deny and ask rules — is safe to apply at once. A `-p` run cannot ask, so it keeps the grants that
need an exact, persisted trust off and leaves the rest to the user's own controls (`--bare`,
`--setting-sources`).

### Why plugin code runs outside the permission rules

Rules decide Claude's tool calls; a hook or server is code the user chose to install, started by
the client, not requested by the model. Holding it to rules would make every plugin depend on the
user's rule set to work at all. The contract therefore puts the decision at install time — the
warning, the inventory, the tiers — and keeps the rules for what the model asks to do.

## Judgments

| Id | Decision | Evidence |
| --- | --- | --- |
| J13.29 | A folder whose trust the host does not know is untrusted: no project grant applies, and no persisted trust is assumed. | The docs make grants depend on trust and give no default; the least-granting value never turns on a rule the user did not accept; *reference* `src/settings/context.ts`. |
| J13.30 | When several causes keep a repository plugin from loading, the diagnosis names the first of: a managed block, the session directory, trust. | plugins/loading.md lists the causes without an order; *reference* `src/loading/repository-trust.ts`. |
| J13.31 | A blank line separates the standard trust warning from `pluginTrustMessage`; an empty or blank message adds nothing. | plugins/security.md says the text is "appended" without a separator; *reference* `src/settings/plugins/trust-warning.ts`. |
