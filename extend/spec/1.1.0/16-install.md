# 16. Install, updates and dependencies

How a Claude Code plugin gets from a marketplace, a folder, a URL or a claude.ai account into a
running session: the install scopes, the files the client keeps on disk, how a plugin is enabled,
loaded and reloaded, what an uninstall removes, and the messages for each failure. The chapter has
three files:

- this file: ids and origins, scopes, the plugin store, session-only, skills-directory and synced
  plugins, name conflicts, `/reload-plugins`, uninstall, CLI hints and the install and load failures
  (§16.1–§16.15);
- [16-updates.md](16-updates.md): how a version is computed and pins a plugin, refreshing a
  marketplace before an install, auto-update, command-source re-runs, release practice, renames,
  and the client's own version policy (§16.16–§16.22);
- [16-dependencies.md](16-dependencies.md): plugins that depend on plugins, version constraints,
  tag resolution, combination of ranges, cross-marketplace dependencies and their errors
  (§16.23–§16.30).

The marketplace file, its entries and plugin sources are §15's; the `claude plugin` commands and
`/plugin` subcommands, with their flags, output and exit codes, are §17's. This chapter states what
those commands change and when. Evidence: `plugins/loading.md`, `plugins/install.md` and
`plugins/troubleshooting.md` unless a section names another page.

## 16.1 Plugin ids and origins

1. Every plugin a client knows has an **id** `<name>@<origin>`. The id is the key in
   `enabledPlugins` (§12), in `installed_plugins.json` (§16.6) and in `claude plugin list --json`
   (§17). The origin says how the plugin arrived:

   | Origin | How the plugin arrived | Enabled when |
   | --- | --- | --- |
   | `<marketplace>` | Installed from a marketplace the user added (§15). | `enabledPlugins` says so (§16.4). |
   | `inline` | Loaded for one session by `--plugin-dir`, `--plugin-url`, `CLAUDE_CODE_PLUGIN_DIRS` or the Agent SDK's `plugins` option (§16.8). | Always, unless the manifest sets `defaultEnabled: false` or a settings file sets `"<name>@inline": false`. |
   | `skills-dir` | A directory with `.claude-plugin/plugin.json` under `~/.claude/skills/` or the project's `.claude/skills/` (§16.9). | As the manifest's `defaultEnabled` says, unless a settings file sets the id to `true` or `false`. |
   | `synced` | Turned on for the user's claude.ai account and downloaded (§16.10). | Always, unless the manifest sets `defaultEnabled: false` or a settings file sets `"<name>@synced": false`; a plugin the organization requires loads regardless. |

2. For a marketplace plugin `<name>` is the **entry name** in `marketplace.json`; for `inline` and
   `skills-dir` it is the `name` in the plugin's manifest. `inline`, `skills-dir` and `synced` are
   reserved: a client MUST refuse a marketplace with one of these names (§15).
3. A marketplace plugin has two names that MAY differ. The entry name is the install and enable key:
   it is what `enabledPlugins` holds, what the cache directory is named after (§16.6) and what
   `claude plugin list` shows. The manifest `name` is what the plugin's components are namespaced
   under (§2.3) and what name conflicts compare (§16.11).
   <!-- req: install.loading.Entry name and manifest name -->

## 16.2 The three stages of a plugin

An `enabledPlugins` entry becomes a usable plugin in three stages, and a client MUST keep them
distinct, because a change at one stage does not reach the next on its own:

1. **Declared**, in settings: `enabledPlugins` says which plugins are on and `extraKnownMarketplaces`
   which marketplaces exist (§12, §15). Adding a marketplace from the command line also writes it to
   `extraKnownMarketplaces` in the user's settings.
2. **Fetched**, on disk under the plugins root (§16.6): `known_marketplaces.json` records each
   fetched marketplace with its `source`, `installLocation`, `lastUpdated` and `autoUpdate`, one file
   per user, so a marketplace added in one project is known in every project;
   `installed_plugins.json` records each install with its `scope`, `installPath` and `version`; and
   `cache/` holds the plugin files.
3. **Loaded**, in the running session: the plugin set loaded at startup or at the last reload
   (§16.12). A change to settings or disk made outside the `/plugin` panel — an install, update,
   enable or disable from the shell — MUST NOT change the loaded set until `/reload-plugins` runs or
   a new session starts; a change made in the panel reloads as §16.4.5 states.
   <!-- req: install.loading.Check which stage a plugin reached | install.overview.Make an installed plugin available in your session.Settings | install.overview.Make an installed plugin available in your session.Disk | install.overview.Make an installed plugin available in your session.Session -->

### 16.2.1 What is not on disk at session start

1. Plugins MUST load at session start from `installed_plugins.json` and the cache, without using the
   network.
2. After the session starts, the client checks the declared marketplaces in the background. A
   marketplace that settings declare and `known_marketplaces.json` lacks is cloned; the client then
   reloads plugins and downloads enabled plugins that are not cached yet. A declared marketplace
   whose source changed in settings is fetched again from the new source.
3. An enabled plugin that neither path fetched and that has no usable cache directory is reported in
   the `/plugin` **Errors** tab as `Plugin "<name>" not cached at <path>` (§16.14).
   <!-- req: install.loading.Plugins and marketplaces that aren't on disk at session start -->

### 16.2.2 What an enabled plugin costs

An enabled plugin is part of every session, not only those that use it. A client SHOULD make that
visible, because:

1. For each skill, agent and command that the model may invoke on its own, the name and description
   are in the model's context on every turn; the full text loads only on use (§4, §5). The tokens
   count toward usage even when nothing from the plugin runs.
   <!-- req: install.overview.What an enabled plugin adds to your sessions.Context and usage -->
2. The plugin's MCP servers run beside each session where it is enabled, and its hooks fire at their
   events (§7, §8). <!-- req: install.overview.What an enabled plugin adds to your sessions.Processes -->
3. What the plugin runs, it runs as the user (§13).
   <!-- req: install.overview.What an enabled plugin adds to your sessions.Permissions -->

A client SHOULD show a plugin's footprint before install (Claude Code shows a **Context cost**
estimate for plugins of its official marketplace, opened from the **Marketplaces** tab or by naming
the marketplace) and after it (`claude plugin details`, §17, and a **Not used recently** group of
the self-installed plugins not used lately on the **Installed** tab). A user stops a plugin without
uninstalling it by disabling it (§16.4).
<!-- req: install.overview.What an enabled plugin adds to your sessions.Before you install | install.overview.What an enabled plugin adds to your sessions.After you install | install.overview.What an enabled plugin adds to your sessions.To stop it without uninstalling -->

## 16.3 Install scopes

An install picks a **scope**, which decides who the plugin is enabled for and which settings file
records it (`plugins/install.md`, "Choose an install scope"; `plugins/overview.md`, "Understand
install scopes"):

| Scope | Enabled for | `enabledPlugins` entry written to |
| --- | --- | --- |
| `user` | The user, in every project on this machine. | `~/.claude/settings.json` |
| `project` | Everyone who works in the repository. | `.claude/settings.json`, which is committed |
| `local` | The user, in this repository only. | `.claude/settings.local.json` |
| `managed` | Every user a policy covers; installed by managed settings (§14). | Managed settings; never written by the client |

1. A project-scope entry turns the plugin on for collaborators but does not download it to their
   machines: each collaborator installs it once at project scope, in each clone (§16.4.2).
   <!-- req: install.guide.Choose an install scope.User scope | install.guide.Choose an install scope.Project scope | install.guide.Choose an install scope.Local scope | install.overview.Understand install scopes.User scope | install.overview.Understand install scopes.Project scope | install.overview.Understand install scopes.Local scope -->
2. When one plugin is set at several scopes, local overrides project and project overrides user
   (§16.4).
3. The terminal, the desktop app's local sessions and the IDE extension on one computer read the same
   settings files, so a user-scope install in any of them is available in the others.
4. A plugin whose manifest or marketplace entry sets `defaultEnabled: false` (§2.4) is installed and
   stays off until the user enables it.
5. A plugin at **Managed** scope is listed but cannot be enabled, disabled or uninstalled by the user.
6. A shell install (`claude plugin install`, §17) uses user scope unless `--scope project` or
   `--scope local` is given. `enable` and `disable` without `--scope` act on the most specific scope
   whose settings already list the plugin; `install` and `uninstall` without it act on user scope.
   All four change the same settings the `/plugin` panel changes.
   <!-- req: install.guide.Install from your shell.Scope | install.guide.Manage plugins from your shell -->

## 16.4 Enabling and where a plugin is enabled

1. An `enabledPlugins` entry can come from six sources, here from lowest precedence to highest:

   | Source | File | Reaches |
   | --- | --- | --- |
   | `--add-dir` | `.claude/settings.json` or `.claude/settings.local.json` of a directory passed with `--add-dir` | This session, and every other source overrides it; skipped until the user saves trust for the directory (§16.4.6) |
   | `user` | `~/.claude/settings.json` | The user, in every project |
   | `project` | `.claude/settings.json` | Everyone who clones the repository |
   | `local` | `.claude/settings.local.json` | The user, in this repository |
   | `flag` | The `--settings` value given at launch | This session |
   | `managed` | Managed settings (§14) | Every user the policy covers; `true` force-enables, `false` blocks, and no other source overrides either |

2. The sources merge key by key: for each plugin id, the value that applies is the one from the
   highest-precedence source that mentions the id; a source that does not mention it leaves the
   lower value in effect. §12 states the merge.

### 16.4.1 Disabled but still loads

When the user sets a plugin to `false` in `~/.claude/settings.json` and a higher source sets it
`true`, the plugin loads. Its row in `claude plugin list` and in `/plugin` MUST say so, naming the
overriding source: `Disabled in ~/.claude/settings.json but still loads — project settings enable
it, which overrides your user setting`, where the source is `project`, `project, gitignored` (for
`.claude/settings.local.json`), `cli flag` or `managed`. To opt out of a project-enabled plugin on
one machine the user sets the id to `false` in `.claude/settings.local.json`. A synced plugin the
organization requires is marked `required by your org` instead (§16.10).
<!-- req: install.loading.Disabled in user settings but still loads | install.troubleshooting.Disabled in ~/.claude/settings.json but still loads -->

### 16.4.2 Enabled in project settings but not installed

1. A plugin whose only `true` is in the project's `.claude/settings.json` MUST NOT load at session
   start on a machine where it is not installed, and the client MUST NOT fetch it there, except:
   - a seed directory (§14) already holds it: it loads with nothing to run;
   - its entry has a relative-path source in a marketplace added from a local path: it loads at
     session start, from the marketplace itself, with no install record;
   - its entry has a relative-path source (such as `./plugins/formatter`) in a git marketplace the
     user has added: `/reload-plugins` loads it for the current session only, and
     `CLAUDE_CODE_SYNC_PLUGIN_INSTALL=1` loads it for one non-interactive `-p` run.
2. A client fetches a plugin with an external source only when one of these sets it `true`: the user
   settings, a `.claude/settings.local.json` that git does not track, the `--settings` flag, or
   managed settings.
3. Otherwise, when the plugin's marketplace is on the machine at session start, the **Errors** tab
   shows `Plugin "<name>" is on in project settings but isn't installed here` with the guidance
   `Run claude plugin install <name>@<marketplace> --scope project to install it for this project`.
   The same state in a text or `stream-json` `-p` run is reported there too, as not installed with
   the install command, not as `not cached` (§16.6.1). When the marketplace is not on the machine,
   the user adds it first, from the source the project's `extraKnownMarketplaces` names (§16.5.3).
4. The user installs from a shell in the project with the plugin's `enabledPlugins` key,
   `claude plugin install <name>@<marketplace> --scope project`, then runs `/reload-plugins` or starts
   a new session; the entry is gone and the plugin is listed under **Installed**. The install is
   per clone; `--scope user` covers every project of the user.
   <!-- req: install.loading.Enabled in project settings but not installed | install.troubleshooting.Plugin "<name>" is on in project settings but isn't installed here -->

### 16.4.3 Repository plugins

1. A repository shares a plugin by listing it under `enabledPlugins` in `.claude/settings.json` or
   by placing it under `.claude/skills/` (§16.9). A client MUST NOT scan a project's
   `.claude/plugins/` directory.
2. A project-scope plugin loads only after the workspace trust check that applies to project allow
   rules (§13); trusting a parent folder or running with `-p` is not enough. Its MCP servers go
   through the per-server approval of a project `.mcp.json` (§8); its MCP servers declared as an
   MCP bundle (`.mcpb`, `.dxt`) or from a file outside the plugin directory are skipped; its
   monitors do not load (§9.2). None of this applies to a plugin under the user's own
   `~/.claude/skills/`.
3. An Anthropic-hosted cloud session does not add the marketplaces a repository lists under
   `extraKnownMarketplaces`, because that needs the trust dialog such a session never shows.

### 16.4.4 Uninstalling a plugin the project enables

When the user uninstalls, from `/plugin`, a plugin the repository's `.claude/settings.json` enables,
the client MUST ask whether to disable it for the user (**Disable for me**: write `false` for it in
`.claude/settings.local.json`, leaving the project install) or to uninstall it for everyone
(**Uninstall for everyone**: remove it from the shared `.claude/settings.json`). The question is a
list answered with the arrow keys and Enter, or Esc to cancel; single-letter answers are not taken
(Claude Code 2.1.326 changelog).
<!-- req: install.guide.Uninstall a plugin the project enables -->

### 16.4.5 Managing installed plugins

The **Installed** tab of `/plugin` lists the plugins with actions to enable, disable, update and
uninstall each; `/plugin enable`, `disable` and `uninstall` open it at the plugin (§17). Disabled
plugins are grouped under a collapsed header at the bottom. A plugin's details offer **Disable
plugin** or **Enable plugin**, **Update now** and **Uninstall**, plus **Configure options** when the
manifest declares `userConfig` (§3.4) and **Configure** when a marketplace plugin has an MCP bundle
(§8). Managed-scope plugins are listed without enable, disable or uninstall. Closing the panel with
pending changes made in it runs `/reload-plugins` (§16.12), which warns and leaves them pending when
it would invalidate the prompt cache, until `/reload-plugins --force`.
<!-- req: install.guide.Manage installed plugins -->

### 16.4.6 Enabled in an `--add-dir` directory but not loaded

1. Until the user has saved workspace trust for a directory passed with `--add-dir`, the client
   MUST skip that directory's `extraKnownMarketplaces` entries and, in an interactive terminal
   session, its `enabledPlugins` entries set to `true` (§13). Answering the prompt that `--add-dir`
   shows does not save that trust; the user saves it by starting a session in the directory and
   accepting the trust dialog, or by setting the trust key (§13). A directory inside a
   pull-request worktree can be skipped even after it is trusted.
2. A `true` in one of the added directory's files is read only when that file's setting sources are
   loaded (`--setting-sources`, §17.15.3; all three are on by default):

   | File of the added directory | Setting sources it needs |
   | --- | --- |
   | `.claude/settings.json` | `project` <!-- req: install.loading.Enabled in an --add-dir directory but not loaded..claude/settings.json --> |
   | `.claude/settings.local.json` | `project` and `local` <!-- req: install.loading.Enabled in an --add-dir directory but not loaded..claude/settings.local.json --> |

   So `claude --setting-sources user --add-dir ./shared` reads neither file of `./shared`; the user
   adds `--setting-sources user,project` for a `true` in `settings.json`
   <!-- req: install.loading.Enabled in an --add-dir directory but not loaded.settings.json -->
   and `--setting-sources user,project,local` for one in `settings.local.json`.
   <!-- req: install.loading.Enabled in an --add-dir directory but not loaded.settings.local.json -->

## 16.5 Installing

### 16.5.1 In a session

1. `/plugin install <name>@<marketplace>` MUST NOT install at once: it opens the plugin's details so
   the user can review it and choose a scope. `/plugin` with no name opens the **Discover** tab,
   which lists the plugins of every added marketplace and filters as the user types.
2. The details pane shows the description and MAY show **Will install** (the commands, agents,
   skills, hooks, and MCP and LSP servers the plugin adds). For a plugin of Anthropic's official
   marketplace it also shows **Last updated** and **Context cost** (**Every turn**, what the plugin
   adds to each message, and **When invoked**, what its skills and agents add once loaded); the
   estimates appear when the plugin is opened by naming its marketplace or from the
   **Marketplaces** tab, not from the **Discover** list. A plugin of a local or custom marketplace
   MAY show `Components will be discovered at installation` instead.
3. The user chooses **Install for you (user scope)**, **Install for all collaborators on this
   repository (project scope)** or **Install for you, in this repo only (local scope)**. The client
   then installs the plugin, with the dependencies it is missing (§16.23), and prints a summary that
   ends in one of these ways:
   - `Plugin is now active.` — the plugin is loaded;
   - `Plugin is now active.` followed by a note that starts `Its bundled MCP server needs` — the
     plugin's MCP bundle needs its options set through **Configure** (§8);
   - `Run /reload-plugins to apply.` — the panel closes and the client runs the reload itself
     (§16.12); when that reload would invalidate the prompt cache it warns and leaves the plugin
     pending until `/reload-plugins --force`;
   - a sentence that includes `The plugin couldn't` — it did not load, and the reason is in the
     **Errors** tab.
4. The plugin's skills then appear as `/<plugin>:<skill>`, and the plugin is listed under
   **Installed** with its scope and by `claude plugin list` with `Version`, `Scope` and `Status`.
   <!-- req: install.guide.Install a plugin -->

### 16.5.2 From the shell

`claude plugin install <name>@<marketplace>` (§17) installs without a session and prints
`Installed plugin: <name>@<marketplace> (scope: <scope>)` in a terminal, `Successfully installed
plugin: …` when its output is not a terminal (§17.2.1). Plugins it installs load at
the next session start, or at `/reload-plugins` in an open session. On a machine where no
interactive session has run, the official marketplace is not registered yet (§15), so a setup script
runs `claude plugin marketplace add anthropics/claude-plugins-official` before installing from it. A plugin whose marketplace entry uses a `command` source shows its
command and asks the user to accept it before running it; a script passes `--yes` (§15).
<!-- req: install.guide.Install from your shell.When the plugins load | install.guide.Install from your shell.The marketplace on a new machine -->

### 16.5.3 Adding a marketplace

A client MUST know a marketplace before it installs from it. A user adds it once, in a session
(`/plugin marketplace add <source>`, also `/plugin market add`) or from the shell
(`claude plugin marketplace add <source>`), with the source forms of §15:

| Source | Written as |
| --- | --- |
| GitHub repository | `owner/repo`, optionally `#ref` for a branch or tag |
| Git repository on any host | The full clone URL with `https://`, or `git@host:path` for SSH, optionally `#ref`; a bare `host/path.git` is read as GitHub shorthand and refused |
| Local directory or file | A path to a directory holding `.claude-plugin/marketplace.json`, or to the file; a relative path starts with `./` or `../`, because a bare `name/name` is GitHub shorthand |
| Hosted `marketplace.json` | Its `https://` URL |

On success the marketplace is listed on the **Marketplaces** tab of `/plugin` and its plugins on
**Discover**; from the shell the client prints `Added marketplace: <name> (declared in <scope>
settings)` in a terminal and `Successfully added marketplace: …` otherwise (§17.14.1). Marketplaces are listed, refreshed and removed with the
`marketplace list`, `update` and `remove` commands (§17); removing one from the last scope that
declares it uninstalls every plugin installed from it and removes their `enabledPlugins` entries, and the **Marketplaces**
tab names them before asking to confirm.
<!-- req: install.guide.Add a marketplace.GitHub repository | install.guide.Add a marketplace.Git repository on any host | install.guide.Add a marketplace.Local directory or file | install.guide.Add a marketplace.marketplace.json | install.guide.Manage marketplaces.List marketplaces | install.guide.Manage marketplaces.Update a marketplace's listing | install.guide.Manage marketplaces.Remove a marketplace -->

### 16.5.4 Adding and installing in one command

`--marketplace <source>` on an install names a marketplace source to add first; the plugin is then
named without `@marketplace` (§17).

1. In a session (Claude Code 2.1.275 or later), the source MUST NOT contain spaces. When the source
   is not added yet, the client shows the source it resolved and asks the user to confirm, then
   opens the plugin's details for a scope. When the source matches an added marketplace, it skips
   the confirmation and opens the details in that marketplace.
   <!-- req: install.guide.Add and install in a session -->
2. From the shell (2.1.292 or later), the client adds the marketplace without confirmation, reusing
   one already added from that source. A new one goes through the same policy checks as
   `marketplace add` (§14) and is declared in the user's settings even with `--scope project`; the
   command prints `Added marketplace: <name> (declared in user settings)` (in a terminal; §17.2.1)
   and installs.
   <!-- req: install.guide.Add and install from your shell -->
3. When the catalog fetched from the source has the name of a marketplace added from another source,
   the client keeps the existing one and installs nothing:
   `Marketplace "<name>" is already added from a different source (<source>). To use this source
   instead, remove that marketplace first with /plugin marketplace remove <name>.`
   <!-- req: install.troubleshooting.Marketplace "<name>" is already added from a different source -->

### 16.5.5 Private marketplaces

A client clones a private marketplace with the git credentials already on the machine and MUST NOT
prompt for one (§15 states the transport):

1. **HTTPS**: git credential helpers apply; git's own prompts and askpass programs, including one
   named by `GIT_ASKPASS`, are off, so the clone fails rather than asks.
2. **SSH**: the host MUST already be in `known_hosts` and the key MUST work without a passphrase
   prompt. An SSH program named by `GIT_SSH_COMMAND`, `GIT_SSH` or `core.sshCommand` is used.
3. **GitHub `owner/repo` shorthand**: the client checks whether the SSH key authenticates to
   `github.com` and clones over SSH if it does, over HTTPS if not, and over HTTPS when the SSH
   clone itself fails (§15.13); `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` skips the check and always uses
   HTTPS (§3.6).

The same credentials apply to plugin install, marketplace update and plugin update.
<!-- req: install.guide.Add a private marketplace.HTTPS | install.guide.Add a private marketplace.SSH | install.guide.Add a private marketplace.GitHub owner/repo shorthand -->

### 16.5.6 Other surfaces

1. In `claude -p` and other non-interactive runs `/plugin` does not run; the client replies
   `/plugin isn't available in this environment.` Plugins already installed load, and the shell
   commands manage them.
   <!-- req: install.guide.JetBrains, non-interactive runs, and the Agent SDK.claude -p and other non-interactive runs -->
2. An IDE integration that runs the client in the IDE's terminal follows the terminal behaviour.
   <!-- req: install.guide.JetBrains, non-interactive runs, and the Agent SDK.JetBrains IDEs -->
3. The Agent SDK loads plugins through its `plugins` option, which is the equivalent of
   `--plugin-dir` (§16.8; type `SdkPluginConfig`, `{ type: 'local', path }`, in
   `@anthropic-ai/claude-agent-sdk`). <!-- req: install.guide.JetBrains, non-interactive runs, and the Agent SDK.Agent SDK -->
4. A cloud session has no plugin browser and does not load the plugins the user installed at `user`
   or `local` scope; it loads what managed settings distribute (§14).
5. A client that offers sessions on a remote machine over SSH, as the Desktop app does, copies the
   user's plugins from their computer to `~/.claude/remote/plugins/` on the remote machine and loads
   them from there; on a Windows remote machine it leaves out a plugin holding a file or folder name
   Windows cannot store, and the session lists the plugins left out. A name Windows cannot store is
   a path segment that holds one of `< > : " \ | ? *` or a control character (U+0000 to U+001F),
   ends in a space or a dot, or is a reserved device name (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`,
   `LPT1`–`LPT9`, in any case, with or without an extension, so `nul.txt` too) (Judgment J16.26). A WSL
   session gets no plugins. Managed plugins the app withholds under `disableSideloadFlags` are
   §17.15.1's. <!-- docs: desktop.md | Install plugins --> <!-- docs: desktop.md | Windows remote machines --> <!-- docs: desktop.md | Files and processes on the remote machine -->

## 16.6 The plugin store on disk

1. All plugin files and records live under one **plugins root**: `CLAUDE_CODE_PLUGIN_CACHE_DIR` when
   it is set and not empty, else `plugins` under the configuration directory, `~/.claude/plugins` by
   default (§3.1.2, Judgment J3.1). Every path below is relative to it, except `synced/` and
   `.trash/`, which stay under `~/.claude/plugins` even when `CLAUDE_CODE_PLUGIN_CACHE_DIR` is set.

   | Path | Holds |
   | --- | --- |
   | `cache/<marketplace>/<plugin>/<version>/` | One directory per installed version of a copied marketplace plugin; `<plugin>` is the entry name and `<version>` the resolved version (§16.16). `${CLAUDE_PLUGIN_ROOT}` points here (§3.1.1). |
   | `data/<plugin-id>/` | The plugin's persistent directory, `${CLAUDE_PLUGIN_DATA}` (§3.1.2). Created on first use, kept across updates, deleted by the last uninstall (§16.13). |
   | `marketplaces/<name>/` | The clone or download of a marketplace added from GitHub, another git host or a URL. A marketplace added from a local file or directory has no copy here; its `installLocation` is the path given. |
   | `mcpb/` | The files extracted from the MCP bundles (`.mcpb`, `.dxt`) that plugins declare (§2.9, §8); deleted with a plugin's options at its last uninstall unless another plugin uses an identical bundle (§17.5.1). |
   | `synced/` | Plugins synced from claude.ai (§16.10). |
   | `.trash/` | Plugins the claude.ai sync removed. |
   | `installed_plugins.json`, `known_marketplaces.json` | The records of §16.2. A marketplace hosted on claude.ai is recorded in `known_marketplaces_claudeai.json` instead. |
   | `flagged-plugins.json` | Plugins flagged as removed because their marketplace delisted them; listed under **Needs attention** on the **Installed** tab of `/plugin` (§16.21). |
   | `installed_plugins.set-aside.<date>.<hash>.json`, `installed_plugins.unreadable.<date>.<hash>.kept` | Dated copies kept before records are dropped or the file is rebuilt (§16.6.2); they age out on the `cleanupPeriodDays` schedule (§12). |

2. Because `${CLAUDE_PLUGIN_ROOT}` is a version directory, a plugin's root changes with each version;
   durable files belong in `${CLAUDE_PLUGIN_DATA}`.

### 16.6.1 `installed_plugins.json`

1. The file records, per plugin id, one install per scope (and, for `project` and `local`, per
   project folder). A record carries `scope`, `installPath` and `version`; a `project` or `local`
   record carries the project folder as `projectPath`. The client SHOULD write the file as
   `{ "version": 2, "plugins": { "<id>": [ <record>, ... ] } }`, with optional text fields
   `installedAt`, `lastUpdated` and `gitCommitSha`, and MUST keep and write back fields it does not
   know (Judgment J16.1).
2. An enabled plugin of which the client finds no usable copy — such as one whose record exists but
   whose `installPath` is missing — is reported `Plugin "<name>" not cached at <path>` with the
   guidance `Run /plugin to refresh the plugin cache`. A plugin that only a repository's settings
   enable and that is not installed is not reported this way but as §16.4.2 item 3 states. Installing
   it again from the shell MUST download it again even though its record exists (for a plugin the
   project enables, `--scope project` from the project); after `/reload-plugins` the entry is gone
   and the plugin is listed under **Installed**. <!-- req: install.troubleshooting.Plugin "<name>" not cached at <path> -->

### 16.6.2 A file or record the client cannot use

A client MUST NOT lose what another version wrote, and MUST NOT guess what an unreadable file meant:

1. **A record it cannot read**: a record that is valid JSON under a valid plugin id whose fields do
   not parse for this version (most likely written by a newer version). While such a record exists
   the client MUST NOT rewrite the file. It reports `installed_plugins.json holds a record under
   "<id>" that this version of Claude Code cannot read` (`holds records under`, naming each, when
   there are several), and suggests in order: update the client; uninstall the plugin with the
   version that wrote the record; delete the record by hand and restart or reload.
   - `claude plugin list` prints it as a `Note:`.
   - `claude plugin install`, `uninstall` and `update` refuse with `Plugin "<name>" was not
     installed:`, `… was not uninstalled:` or `… was not updated:` followed by the same text.
   - With `--json`, the result line carries the same `message` and
     `failureCode: "install_records_unreadable"` (§17).
   - When the file's own format is one this version does not know, the message is
     `installed_plugins.json is in a format (version <N>) that this version of Claude Code does not
     know`.
   <!-- req: install.troubleshooting.installed_plugins.json holds a record under "<id>" that this version of Claude Code cannot read | install.troubleshooting.installed_plugins.json holds a record under "<id>" that this version of Claude Code cannot read.claude plugin list | install.troubleshooting.installed_plugins.json holds a record under "<id>" that this version of Claude Code cannot read.--json on any of those three commands | install.troubleshooting.installed_plugins.json holds a record under "<id>" that this version of Claude Code cannot read.Several such records -->
2. **A file that is not valid JSON or not a list of plugins**: the client keeps its text in
   `installed_plugins.unreadable.<date>.<hash>.kept`, starts the file over empty, and while the
   copy exists `claude plugin list` prints `installed_plugins.json could not be read and was
   rebuilt` with the copy's path. The client never reads the copy back.
   <!-- req: install.troubleshooting.installed_plugins.json could not be read and was rebuilt -->
3. **Records under a key that is not a plugin id**: the client copies them into
   `installed_plugins.set-aside.<date>.<hash>.json`, drops them, and loads the rest. While the copy
   exists `claude plugin list` prints `install records under names that no version of Claude Code
   can use were removed from installed_plugins.json` with the copy's path, ending `Nothing needs
   doing about these copies.` The copy is never read back.
   <!-- req: install.troubleshooting.install records under names that no version of Claude Code can use were removed from installed_plugins.json -->
4. The copy MUST be written before the file changes, so a failed write loses nothing. The docs give
   the names' shape, not `<date>` or `<hash>` (Judgment J16.2).

### 16.6.3 In-place and copied plugins

A client loads some plugins in place and copies the rest, by origin:

1. A `--plugin-dir` directory and a skills-directory plugin load in place and are never copied. A
   `--plugin-url` archive or a `--plugin-dir` `.zip` is extracted into a session temporary directory
   first.
2. A relative-path plugin of a marketplace added from a local path loads in place from its folder
   inside the marketplace; edits take effect at the next session start or `/reload-plugins` with no
   version change, and its hook, MCP and LSP processes receive the source directory as
   `CLAUDE_PLUGIN_ROOT`.
3. A `command`-source plugin in link mode loads in place from the directory the command printed,
   through links in its cache entry (§15).
4. Every other marketplace plugin is copied into `cache/<marketplace>/<plugin>/<version>/` at install
   and loaded from the copy. Files outside the plugin directory are not copied, so a script that reads
   `../shared` finds nothing (§1.6).
   <!-- req: install.loading.In-place and copied plugins -->

### 16.6.4 Paths that escape the plugin

Whether in place or copied, a client MUST reject a component path that resolves outside the plugin
root, declared in `plugin.json` or in a marketplace entry: a path written outside (`../shared-utils`),
a symbolic link that leads outside (other than links between plugins of one marketplace, §15), and,
on macOS and Linux, any path that contains a backslash, even one that stays inside. The rejection is a
`path escapes plugin directory` error, and the plugin loads without that component (§2.5).
<!-- req: install.loading.Paths that escape the plugin directory -->

### 16.6.5 Cleanup of previous versions

When an update or uninstall leaves a version directory unused, the client MUST write an
`.orphaned_at` marker into it and remove it in a background sweep 14 days later, so a session that
loaded the old version keeps running. The sweep runs only while `installed_plugins.json` records at
least one install; after the last uninstall, orphaned directories stay until another install. Only
version directories inside `cache/` are marked or swept, never an in-place source directory
(Judgment J16.3). <!-- req: install.loading.Cleanup of previous versions -->

### 16.6.6 Moving a new copy into place

An install downloads a fresh copy and moves it into the version directory. When the move fails, the
client MUST put back the copy installed before when it can, and say what happened to it:
`Could not move the new copy of this plugin version into <path>: <reason> (<code>)`, followed by
`The previously installed copy was moved back` (the old version is still installed), by `had to be
removed first`, `was not moved back` or `could not be moved back` (no copy of that version is
installed until an install succeeds), or by nothing (there was no earlier copy). On Windows, when
another program holds the installed copy, the message says it `could not be replaced` and `It was
not replaced and the new copy was discarded`. A `Left on disk` list names set-aside folders inside
the cache, which a later install or cache cleanup removes. Example:

```text
Could not move the new copy of this plugin version into /home/user/.claude/plugins/cache/acme-tools/formatter/1.2.0: the new copy or the version folder stayed busy while the install ran (ENOTEMPTY) — usually a scanner still reading the freshly downloaded files, another program using that folder, or another process re-creating it. The previously installed copy was moved back. Run the install again once other Claude Code sessions or programs using that folder have finished.
```
<!-- req: install.troubleshooting.Could not move the new copy of this plugin version into <path> -->

### 16.6.7 Two ids, one folder

Two plugin ids map to one folder when they are equal once `.` and `@` are written as `-`, and, on
macOS and Windows, when they differ only in capitals. A client MUST refuse to install the second:
`"<plugin>" was not installed: it would share its folder with "<other>"` (or `would share its saved
data with`, for the data folder of §3.1.2), and the installed plugin keeps its files. When the other
is installed, the message says `Only one of the two can be installed.` and names the uninstall that
removes it. When both ids arrive in one install, such as a plugin and its dependency, no order helps
and only a marketplace maintainer can fix it by renaming one; the later id is the one refused
(Judgment J16.4). <!-- req: install.troubleshooting."<plugin>" was not installed: it would share its folder with "<other>" -->

## 16.7 Node.js package dependencies

When a client copies a plugin into the cache, it MUST install the plugin's own npm or Bun packages
into the version directory, so its hooks and MCP servers can load them. (Plugins that depend on
plugins are §16.23.)

1. **When**: each time a version directory is created — on install, on an update to a new version,
   and at session start when an enabled plugin is not cached yet. Never into the source directory of
   a plugin loaded in place (§16.6.3); its author installs there, or a hook installs into
   `${CLAUDE_PLUGIN_DATA}`. <!-- req: install.loading.When the dependency install runs -->
2. **Whether**: only when the plugin root holds a `package.json` and a supported lockfile. The first
   of `bun.lock` (Bun), `npm-shrinkwrap.json`, `package-lock.json` (npm) found decides the package
   manager, run from the user's `PATH`; the client MUST NOT fall back to the other manager when that
   one is missing. It skips the install for `bun.lockb`, `yarn.lock` and `pnpm-lock.yaml`, for an npm
   lockfile whose `lockfileVersion` is not `2` or `3`, and for a `bun.lock` whose `lockfileVersion`
   is above `2`. An npm-source plugin ships `npm-shrinkwrap.json`, because npm leaves
   `package-lock.json` out of a published package.
3. **Limits**, so that no code from the plugin or its packages runs and the install is bounded:
   - every dependency MUST be a registry package pinned in the lockfile to an exact version; a git,
     GitHub, folder, workspace or linked dependency means no install;
     <!-- req: install.loading.Limits on the dependency install.Registry packages only -->
   - every download link in the lockfile MUST use `https`, unless it points at the user's own
     default npm registry; <!-- req: install.loading.Limits on the dependency install.https downloads -->
   - the package manager runs in a folder of its own that holds only a copy of the checked dependency
     list, so it reads no `.npmrc`, `.env` or `bunfig.toml` of the plugin; on success the resulting
     `node_modules` moves into the plugin;
     <!-- req: install.loading.Limits on the dependency install.A separate install folder -->
   - resolution is frozen to the lockfile's versions, and the install is skipped when `package.json`
     and the lockfile do not list the same dependencies;
     <!-- req: install.loading.Limits on the dependency install.Frozen resolution -->
   - lifecycle scripts do not run (`--ignore-scripts`), so native modules download but do not build;
     <!-- req: install.loading.Limits on the dependency install.No lifecycle scripts -->
   - npm `overrides` mean no install from an npm lockfile, and Bun `patchedDependencies` no install
     from `bun.lock`; <!-- req: install.loading.Limits on the dependency install.No overrides or patches -->
   - an install running over 60 seconds is stopped and counts as failed.
     <!-- req: install.loading.Limits on the dependency install.60-second timeout -->

   The install cannot be turned off. The commands are `npm ci --ignore-scripts` and
   `bun install --frozen-lockfile --ignore-scripts` (Judgment J16.5).
4. **Failure**: when the install fails or is skipped, the plugin still loads. On an enabled plugin
   whose cached copy has a lockfile and a `package.json` with runtime dependencies but no
   `node_modules`, `/plugin` and `claude plugin list` MUST show a note: `The packages it lists are
   not installed` when the install can run but did not finish, with the `claude plugin update`
   command that retries it (§16.18), or `were not installed, because <reason>` when it cannot run
   for this plugin (a Yarn, pnpm or `bun.lockb` lockfile, a package manager missing on this
   computer); updating does not help while that reason stands. While
   `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` is set, update skips the retry and reports the plugin
   current.
   <!-- req: install.loading.When the dependency install fails or is skipped | install.troubleshooting.The packages it lists are not installed or were not installed, because ... -->

## 16.8 Session-only plugins

A **session-only** plugin is loaded for one session without an install, with id `<name>@inline`.
Nothing is written to settings for it, and editing its files takes effect at `/reload-plugins`
(`plugins/create.md`, "Develop without a marketplace"; `plugins/cli-reference.md`, "Flags that load a
plugin for one session").

1. `--plugin-dir <path>` loads a plugin from a directory or a `.zip` archive of one; the flag takes
   one path and repeats. <!-- req: install.develop.Load a plugin from a directory or .zip -->
2. `--plugin-url <url>` downloads a `.zip` archive at startup; the flag repeats, or one quoted value
   holds several URLs separated by spaces. When the archive cannot be fetched or is invalid, the
   session starts without it and records a load error in the **Errors** tab. The archive has the
   extraction limits of an `archive` source and its download sends no headers (§15; Judgment
   J16.25).
   <!-- req: install.develop.Load a plugin from a URL -->
3. `CLAUDE_CODE_PLUGIN_DIRS` lists absolute paths, each loaded as a `--plugin-dir` path, in addition
   to the flags (2.1.280 or later). Project and local settings cannot set it (§3.6).
   <!-- req: install.develop.Load plugins from an environment variable -->
4. **A folder of plugins** (2.1.265 or later): a folder with no `.claude-plugin/` directory and no
   plugin component at its top level is a folder of plugins, and each immediate subfolder that has
   `.claude-plugin/plugin.json` and whose name does not start with `.` loads as its own plugin;
   everything else, including a subfolder without a manifest and a dot-named one with a manifest, is
   skipped without an error (`plugins/create.md`, "Load a folder of plugins"). A folder whose `.claude-plugin/` holds a
   `marketplace.json` and no `plugin.json` is also a folder of plugins (2.1.281 or later); the
   marketplace file is not read and nothing is installed from it, so a plugin under its `plugins/`
   folder does not load (§2.12); before 2.1.281 such a folder loaded as one empty plugin named
   after it. In an interactive session, a
   subfolder added later loads once its manifest exists, unless its name starts with `.`, and one
   removed unloads, each with a
   message; a change that would invalidate the prompt cache is held and the message says to run
   `/reload-plugins` (§16.12). Judgment J16.6 lists what counts as a component at the top level.
   <!-- req: install.develop.Load a folder of plugins -->
5. `claude plugin list` shows a session-only plugin only when the same flag precedes the subcommand
   (`claude --plugin-dir ./p plugin list`), under a heading that begins `Session-only plugins`; with
   `--json` its `scope` is `session` (§17).
6. A session-only plugin that shares a name with an installed one replaces it for that session
   (§16.11). The installed copy loads instead when the session-only copy is disabled
   (`"<name>@inline": false` in any settings file, or `claude plugin disable <name>@inline`) or when
   managed settings lock that plugin name.
7. Managed `disableSideloadFlags` rejects both flags and `CLAUDE_CODE_PLUGIN_DIRS`: the client prints
   that the flag is disabled by the organization's managed settings and exits `1` without starting
   (§14).
   <!-- req: install.plugin.Flags that load a plugin for one session -->

Pointing `--plugin-dir` at a marketplace root loads nothing from its `plugins/` folder and reports no
error, because `marketplace.json` is not read; it takes one plugin's folder (§17).

## 16.9 Skills-directory plugins

1. A folder under `~/.claude/skills/` that contains `.claude-plugin/plugin.json` is a skills-directory
   plugin, `<name>@skills-dir`. It loads at every session start with no flag and no install, unless
   managed settings block it (§16.9.1).
2. `claude plugin init <name>` (§17) scaffolds one at `~/.claude/skills/<name>/` with a
   `.claude-plugin/plugin.json` and a root `SKILL.md`, printing `✔ Created plugin "<name>" at
   ~/.claude/skills/<name>` followed by `It will auto-load next session as <name>@skills-dir. Run
   /reload-plugins to load it now.` <!-- req: install.develop.Scaffold the plugin with claude plugin init -->
3. The root `SKILL.md` of such a plugin is also a personal skill, invoked as `/<name>`, not
   `/<name>:<name>`; skills under its `skills/` carry the prefix, `/<name>:<skill>` (§4).
   <!-- req: install.develop.Name the plugin's skills -->
4. Deleting the folder, or `claude plugin disable <name>@skills-dir`, stops it loading.
   <!-- req: install.develop.Stop loading the plugin -->
5. The same layout at `<project>/.claude/skills/<name>/` is a repository plugin (§16.4.3). The client
   reads the `.claude/skills/` of the session's primary working directory only, and, unlike plain
   skills, MUST NOT search parent directories for plugins. In a worktree started by the desktop app
   it reads the main checkout's. It loads only after workspace trust.
   <!-- req: install.develop.Share the plugin through a repository -->

### 16.9.1 Blocked by managed settings

A client MUST skip a skills-directory plugin, silently, when managed settings set
`strictPluginOnlyCustomization` to `true` or to an array naming any customization kind (the whole
plugin is skipped when any one kind is locked), or set a `strictKnownMarketplaces` allowlist without
a `{ "source": "skills-dir" }` entry, or a `blockedMarketplaces` list with one (§14). `/plugin` and
`claude plugin list` show nothing for it. Unless skills are locked, a root `SKILL.md` still loads as a
plain skill.

## 16.10 Synced plugins

1. A plugin turned on for the user's claude.ai account, by the user or the organization, loads as
   `<name>@synced`, with no marketplace and no install record, and with the trust of an installed
   marketplace plugin: its skills, agents, hooks, MCP and LSP servers all load. Plugins installed
   from marketplaces are never added to the account.
2. In a terminal session (2.1.273 or later) the client syncs once in the background at each start,
   downloading new and updated plugins into `synced/` and removing those turned off. When the sync
   adds, updates or removes one during an interactive session, the client shows `Plugins changed.
   Run /reload-plugins to activate.`; a change made on claude.ai during a session applies at the next
   start.
3. The client MUST NOT download or load synced plugins in a session whose credential comes from
   `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN` or an `apiKeyHelper`; that does not fetch
   feature flags (such as with `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`); in bare mode or with
   `--safe-mode`; or with a `--setting-sources` list that leaves out `user`.
4. `claude plugin disable <name>@synced` and the **Installed** tab save `"<name>@synced": false` in
   the user's `enabledPlugins`. `syncClaudeAiPlugins: false` (user or managed, §12) stops downloads,
   and the next start moves the synced plugins to `.trash/` and stops loading them. A plugin the
   organization requires loads even when disabled; `claude plugin disable` refuses it with `Plugin
   "<name>@synced" is required by your organization and can't be disabled here. Contact your admin to
   change it.` and `claude plugin list` marks it `required by your org`. A synced plugin is removed by
   turning it off on claude.ai.
5. claude.ai can also list marketplaces (2.1.273 or later), added by name with `--claudeai` (§15)
   and recorded in `known_marketplaces_claudeai.json`. Signing out keeps them configured with no
   plugins, and plugins already installed from them keep loading.

## 16.11 Name conflicts

When enabled plugins of different origins share a **manifest** name, a client MUST load exactly one,
by this order from highest precedence to lowest:

1. A plugin whose id appears in managed `enabledPlugins`, as `true` or `false`. A `--plugin-dir` copy
   whose manifest name matches the id's name part is not loaded: `--plugin-dir copy of "<name>"
   ignored: plugin is locked by managed settings`.
2. An enabled session-only plugin (§16.8). It replaces a same-named installed marketplace plugin
   silently — `claude plugin list` still shows the marketplace row enabled, because that row reflects
   settings, and only the debug log records `Plugin "<name>" from --plugin-dir overrides installed
   version` — and replaces a skills-directory plugin with an **Errors** row `Not loaded — the name
   "<name>" is already taken by a session-only plugin (--plugin-dir / --plugin-url), which takes
   precedence`.
3. An installed marketplace plugin; a same-named skills-directory plugin gets the same `Not loaded`
   row, naming the installed plugin.
4. A skills-directory plugin; between two, the one under `~/.claude/skills/` loads and the project's
   is dropped with a row naming the path that shadowed it.
5. A synced plugin; when an enabled plugin of any other origin has its name, that one loads and the
   synced copy is reported not loaded. Disabling the other copy lets the synced one load.

Because names are compared, a `--plugin-dir` plugin named `hello-plugin` replaces
`hello@example-marketplace` whose manifest also says `"name": "hello-plugin"`.
<!-- req: install.loading.Name conflicts -->

1. **Hooks**: two installed plugins of one manifest name from different marketplaces both appear
   enabled, but one copy per name registers its `hooks/hooks.json` hooks and one loads a hooks module
   (§10): the copy managed settings turn on, else the copy loaded first. The **Errors** tab and the
   left-out copy's details MUST carry a note naming the copy that holds the name, beginning `Its
   hooks.json hooks do not run` or `Its hooks module does not load` (2.1.296 or later). Disabling or
   uninstalling the holder and reloading registers the other copy's hooks and clears the note; when
   managed settings turn the holder on, it cannot be disabled and the other copy's hooks stay off
   while both are installed.
   <!-- req: install.loading.Hooks when two enabled plugins share a name -->
2. **Keeping a session-only plugin out**: `"<name>@inline": false` in any settings file stops it
   from loading, so the marketplace or skills-directory copy loads instead.
   <!-- req: install.loading.Keep a session-only plugin from loading -->

## 16.12 `/reload-plugins`

`/reload-plugins [--force]` applies pending changes — plugins installed, updated, enabled, disabled
or edited on disk since the session started — to the running session (`plugins/cli-reference.md`,
"/reload-plugins"). Closing `/plugin` with pending changes made in it runs it; changes made elsewhere,
such as a `claude plugin` command in another terminal, need it typed. `force` without dashes works.

1. **Summary**: the client reloads every active plugin and prints one line,
   `Reloaded: N plugins · N skills · N agents · N hooks · N plugin MCP servers · N plugin LSP
   servers`, without the MCP server count in a session without an interactive terminal. The skills
   count covers a plugin's `commands/` entries and its `SKILL.md` skills; the agents count is every
   agent loaded in the session, plugin or not. When any plugin failed, it adds `N errors during
   load. Run /plugin for details.` (Judgment J16.7 for the joining). <!-- req: install.plugin.Reload summary -->
   **Dependencies**: when a reloaded plugin is missing a dependency the client can resolve (§16.23),
   the reload installs it; when the reload applies, the summary includes
   `(+ N dependencies: <names>) resolved`. When the reload is not applied (item 2) or the summary
   says the dependencies were `installed but not applied`, `/reload-plugins --force` applies them. <!-- req: cli.plugin.Dependencies installed during a reload -->
2. **MCP tools**: when the reload would add or remove a plugin MCP server or the `LSP` tool and so
   invalidate the prompt cache, the client MUST NOT apply it without `--force`. It prints `This reload
   changes MCP tools (<server>) — your next message will re-read the whole conversation instead of
   using the cache. Run /reload-plugins --force to apply.`, or a line beginning `This reload adds the
   LSP tool` or `This reload removes the LSP tool`. <!-- req: install.plugin.Reloads that change MCP tools -->
3. **Without an interactive terminal** (desktop app, Agent SDK, `-p`; 2.1.260 or later) the command
   runs only when the user types it into the session. Arriving another way, such as Remote Control or
   a relayed message, it replies `/reload-plugins isn't available over a remote connection in this
   session.` and reloads nothing. There it does not connect or disconnect plugin MCP servers; those
   changes take effect in the next session. <!-- req: install.plugin.Sessions without an interactive terminal -->
4. **After an install** whose summary ends `Run /reload-plugins to apply.` (activation would
   invalidate the prompt cache, or failed), the client runs the reload itself when the panel closes,
   or queues it until a streaming response finishes (2.1.268 or later). A `Plugins changed. Run
   /reload-plugins to activate.` notice MAY show above the prompt at the same time.
   <!-- req: install.troubleshooting.Run /reload-plugins to apply. -->

## 16.13 Uninstall and data

1. An uninstall removes the install record of one scope (§17 for the command). When it removes the
   last scope the plugin is installed at, the client MUST also delete the plugin's stored options and
   secrets (§3.4.3) and its data directory `data/<id>/`, except: with `--keep-data` the data
   directory stays; when another installed plugin uses the same data folder it stays; when the client
   cannot read the install records back after removing the scope, options, secrets and data all stay,
   the uninstall still succeeds, and the message lists what stayed (§3.1.2).
2. The version directory it leaves is orphaned (§16.6.5). Auto-installed dependencies stay until
   pruned (§16.29).
3. On Windows, `installed_plugins.json` MAY hold two records for one project folder spelled
   differently (`c:\work\app`, `C:\work\app`); one uninstall removes one. Running the same uninstall
   again from the same folder MUST remove the record under the other spelling (2.1.295 or later;
   before, it failed with `Plugin "<name>" is not installed in project scope`). Two spellings that
   compare equal by the platform's path rules are one install (Judgment J16.8).
   <!-- req: install.troubleshooting.A plugin stays installed after plugin uninstall on Windows -->

## 16.14 CLI hints

A command-line tool can recommend its plugin by writing a `<claude-code-hint />` tag to stderr
(`plugins/cli-hints.md`). This applies only to a plugin listed in a marketplace with one of
Anthropic's official names (§15); the community marketplace is not one.

1. **Emitting**: a tool SHOULD emit the tag only when `CLAUDECODE` or `CLAUDE_CODE_CHILD_SESSION` is
   set. The client MUST set `CLAUDECODE=1` in Bash and PowerShell tool commands and hook commands,
   and `CLAUDE_CODE_CHILD_SESSION=1` in the subprocesses it starts itself (§3.6); IDE terminals also
   set `CLAUDECODE`. A tool MAY emit on every run, since the prompt shows once per plugin.
   <!-- req: install.hints.Emit the hint -->
2. **Format**: the tag MUST occupy its own line; a tag inside a line is ignored. It has three
   required attributes, double-quoted or unquoted (an unquoted value cannot contain whitespace):
   `v`, the protocol version, where `1` is the only supported value; `type`, the hint kind, where
   `plugin` is the only supported value; and `value`, the plugin id `name@marketplace`.

   ```text
   <claude-code-hint v="1" type="plugin" value="example-cli@claude-plugins-official" />
   ```

   <!-- req: install.hints.Hint format.v | install.hints.Hint format.type | install.hints.Hint format.value -->
3. **Stripping**: the client MUST remove every tag line from Bash and PowerShell tool output before
   the model sees it, even when `v` or `type` is not recognized, and also from `-p`, subagent and hook
   output, where no prompt is shown (Judgment J16.9 for the edges).
4. **When the prompt shows**: only in an interactive terminal session, and only when every check
   passes:
   - `value` names a plugin found in the local copy of an official marketplace, not installed, and
     blocked by no policy; <!-- req: install.hints.Check when the prompt appears.Official and installable -->
   - analytics are on — not with `DISABLE_TELEMETRY`, `DO_NOT_TRACK` or
     `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`, nor on a third-party provider where telemetry is
     off by default; <!-- req: install.hints.Check when the prompt appears.Analytics on -->
   - at most one prompt per session, one ever per plugin whatever the answer, and none once 100
     plugins have been prompted for on the machine; <!-- req: install.hints.Check when the prompt appears.Frequency limits -->
   - the user has not chosen **No, and don't show plugin installation hints again**;
     <!-- req: install.hints.Check when the prompt appears.Not turned off -->
   - the workspace is local and the session attended — not `--cloud`, not serving Remote Control,
     not an agent-team teammate. <!-- req: install.hints.Check when the prompt appears.Local, attended session -->
5. **The dialog**, **Plugin recommendation**, names the first word of the shell command that wrote the
   tag (`The <word> command suggests installing a plugin.`), the plugin, the marketplace and the
   description, and offers **Yes, install** (installs at user scope), **No**, and **No, and don't
   show plugin installation hints again** (turns hints off for the user). No answer within 30 seconds
   counts as **No**.

## 16.15 Install and load failures

Messages the install and load stages produce, beyond those in §16.6, and what a client does. Messages
of the marketplace stage are §15's and those of policy §14's.

| Message | When, and what the client does |
| --- | --- |
| `Plugin "<name>" not found in marketplace "<marketplace>"` with the hint `Your local copy may be out of date — try claude plugin marketplace update <marketplace>` or `The marketplace couldn't be refreshed (...)` | The name is not in the local catalog and the client did not refresh it before the lookup (offline, or a skip of §16.17). The user refreshes and retries. <!-- req: install.troubleshooting.not found in marketplace with a refresh hint --> |
| The same message with no hint | The catalog was refreshed; the name is likely wrong. Before 2.1.232 the named marketplace was refreshed only after a miss and only with auto-update on. `claude plugin install` prints it also for a marketplace never added. <!-- req: install.troubleshooting.not found in marketplace with no hint --> |
| `Plugin "<name>" not found in any marketplace` (`… in any configured marketplace` from the shell) | A bare name matched no catalog; neither form refreshed every catalog first (§16.17). Success reads `✓ Installed <plugin>.` in a session, and `Installed plugin: <plugin>@<marketplace>` from the shell in a terminal (`Successfully installed plugin: …` when the output is not a terminal, §17.2.1). <!-- req: install.troubleshooting.Plugin "<name>" not found in any marketplace --> |
| `Plugin '<name>@<marketplace>' is already installed globally` | `/plugin install` of a plugin installed at user scope or by managed settings; without `@<marketplace>` the word `globally` is left out. A plugin installed only at project or local scope MAY be installed at user scope too. The shell prints `Plugin "<name>@<marketplace>" is already installed (scope: user)` and exits 0, downloading again when the cache directory is missing. <!-- req: install.troubleshooting.Plugin '<name>@<marketplace>' is already installed globally --> |
| `This plugin uses a source type your Claude Code version does not support` and `Update Claude Code and try again.` | The entry's source type is unknown to this version (§15). <!-- req: install.troubleshooting.This plugin uses a source type your Claude Code version does not support --> |
| `Plugin archive integrity check failed for <url>: expected sha256 <pin>, got <digest>. The archive was not installed. Verify the sha256 in the marketplace entry, or that the URL serves the intended file.` | An `archive` source's download does not match its `sha256` pin (§15); nothing is installed. <!-- req: install.troubleshooting.Plugin archive integrity check failed --> |
| `"<package>" was not installed: <reason>. An npm plugin source must name a registry package (name or name@version) or link to a tarball file. For a plugin in a git repository, use a "github", "url" or "git-subdir" source.` | An `npm` source's `package` was refused before any fetch, on install, update or load (§15). <!-- req: install.troubleshooting.An npm plugin source must name a registry package --> |
| `Marketplace "<name>" is registered from an untrusted source: The name '<name>' is reserved for official Anthropic marketplaces. Only repositories from 'github.com/anthropics/' can use this name. To fix it, remove the marketplace and re-add it from the official source.` | A reserved name is re-checked every time the marketplace loads or refreshes (2.1.205 or later), so the marketplace and its plugins stop loading (§15); `claude plugin marketplace update <name>` prints the line. For a source that is neither GitHub nor git, such as a local directory, the reserved-name sentence ends `can only be used with GitHub sources from the 'anthropics' organization`; `claude plugin marketplace add` runs the same check and refuses with `Failed to add marketplace:` and that sentence (§17.19.2). <!-- req: install.troubleshooting.Marketplace "<name>" is registered from an untrusted source --> |
| `Marketplace <name> is added but ignored. <reason> <fix>` | A `known_marketplaces.json` entry failed a check run on every read: a location on a network drive, with a `.` or `..` segment, or not checkable; a git URL or URL that cannot be used; a source that differs from its `extraKnownMarketplaces` declaration; or, with `(see the debug log)`, a refused name. The marketplace and its plugins stop loading; `claude plugin marketplace remove` works on the entry; a network location is trusted only when declared in user or managed settings (§15). In `/plugin` the name is quoted and the fix is on the next line. <!-- req: install.troubleshooting.Marketplace "<name>" is added but ignored --> |
| `Cannot add marketplace "<name>": its source doesn't match its extraKnownMarketplaces entry in user or managed settings` | Two sources match only when their type and every field are equal; an unpassed `ref` differs, and an `https://github.com/` URL is a `git` source, not `github`. Nothing is registered (before 2.1.287 the wording was `its network source differs from the one declared for it in settings (…)`). <!-- req: install.troubleshooting.Cannot add marketplace "<name>": its source doesn't match its extraKnownMarketplaces entry in user or managed settings --> |
| `Plugin <name> has a corrupt manifest file` + `JSON parse error:` / `has an invalid manifest file` + `Validation errors:` | The fetched `.claude-plugin/plugin.json` is not JSON, or fails the schema (§2.1). From the shell the line is prefixed `Failed to install plugin "<name>@<marketplace>":` (where `<name>` in the rest MAY be a temporary directory) and the command exits 1. <!-- req: install.troubleshooting.Plugin <name> has a corrupt manifest file or has an invalid manifest file --> |
| `Plugin directory not found at path: <path>` | An enabled relative-path plugin's folder is missing inside its marketplace. `Marketplace directory not found at path: <path>` means the marketplace's own local directory moved or was deleted. <!-- req: install.troubleshooting.Plugin directory not found at path: <path> --> |
| `No plugins yet` / `No marketplaces configured` | No marketplace is registered; **Discover** is empty (`No plugins yet`) and `claude plugin marketplace list` prints `No marketplaces configured` (or lists only the built-in directory marketplace, §17.14.2). <!-- req: install.troubleshooting.No plugins yet or No marketplaces configured --> |
| `Couldn't install: <plugin> (<reason>)` or `Failed to install: <plugin> (<reason>)` | A bulk install from `/plugin` installed none; the menu closes with this summary. A reason MAY be cut to its first line; then the summary ends `Installing a plugin from its details (Enter) in /plugin shows its full error.`, and installing from the details shows the whole error. <!-- req: install.troubleshooting.Couldn't install: <plugin> (<reason>) or Failed to install: <plugin> (<reason>) --> |
| `Marketplace "<name>", which managed settings declare, stands from another source and cannot be taken back while its declared source is unreachable` | Managed settings declare a marketplace under a name the user's registry holds from another source, and the client could not reach the declared source, so it keeps the user's marketplace. Once the declared source is reachable, the next interactive session replaces it (§14, §15). <!-- req: install.troubleshooting.Marketplace "<name>", which managed settings declare, stands from another source and cannot be taken back while its declared source is unreachable --> |
| `The list of installed plugins (installed_plugins.json) could not be read, so marketplace "<name>", which managed settings declare, cannot be taken back from another source` | Before replacing such a marketplace the client reads `installed_plugins.json`, and the read failed; it replaces nothing. When `claude plugin list` reports a record this version cannot read, §16.6.2 item 1 applies; otherwise the user makes the file readable again (fixing its JSON or restoring it), and the next interactive session replaces the marketplace. <!-- req: install.troubleshooting.The list of installed plugins (installed_plugins.json) could not be read, so marketplace "<name>", which managed settings declare, cannot be taken back from another source --> |
| `⚠ <file> does not load (<error>), so Claude Code ignores the whole file, including anything this command wrote there. Fix the file, then run this command again if its change is missing. If a newer Claude Code wrote the file, update Claude Code instead.` | After the success line of `install`, `enable`, `disable` or `marketplace add`, when the settings file written has an error: `its "<key>" is not valid` (`its "<key>" and N other value are not valid` for several), or `it is not a JSON object` (§12). <!-- req: install.troubleshooting.does not load (...), so Claude Code ignores the whole file --> |
| A hook failure beginning `Failed to run: Plugin directory does not exist`, or one saying the plugin `was updated or removed, so this hook did not run` | A hook's plugin directory is gone from disk; the hook does not run, and the failure shows once per session per hook event and command. `/reload-plugins` loads the hooks from the current directory (§7); its output, not the hook going quiet, confirms the fix: `Reloaded:` with no errors line, `N errors during load.` (see the **Errors** tab), or a line ending `Run /reload-plugins --force to apply.` (nothing reloaded) (`errors.md`, "Find your error"). <!-- req: install.troubleshooting.Plugin directory does not exist: <path> --> |

A plugin's hooks that do not run, or that block an action, are found this way (§7 states the
behaviour; `plugins/troubleshooting.md`, "`Couldn't load hooks from <path>` and hooks that don't
fire"):

1. **Load failures** are in the **Errors** tab: `Couldn't load hooks from <path>: <reason>` or
   `Failed to load hooks from <path>: <reason>`, the reason naming the problem, such as invalid JSON
   or a missing top-level `hooks` key; `hooks path not found: <path>`; and
   `hooks path escapes plugin directory: <path>` (§17.18.4). <!-- req: install.troubleshooting.Hooks fail to load -->
2. **A hook whose command failed** shows `<Event> hook error: Failed with non-blocking status code:
   <stderr>` in the transcript. A plugin path cut off at a space in that stderr means an unquoted
   `${CLAUDE_PLUGIN_ROOT}` in a shell-form command, which the validator warns about (§2.5, §7); a
   notice reading `Failed to run: Plugin directory does not exist: <path>` is the last row of the
   table above; for any other error the full stderr is in the debug log. <!-- req: install.troubleshooting.hook error notices in the transcript -->
3. **A blocking hook**: when a plugin hook exits `2` and its stderr is the blocking message, the
   error MUST end with `This hook comes from the <plugin> plugin.` (§7). <!-- req: install.troubleshooting.A plugin hook blocks a tool call or prompt -->
4. **A hook that loads but never fires**: the plugin's details first, where a note beginning
   `Its hooks.json hooks do not run` means a same-named plugin holds the hooks (§16.11 item 1); then
   the event name (case-sensitive), the `matcher` for a tool event, and the debug log, with debug
   logging on, after triggering the event, where a hook that ran shows with its exit code. <!-- req: install.troubleshooting.Hook loads but never fires -->

A plugin that is installed but shows no skills is checked in order: listed and enabled under
**Installed** (`Status: ✔ enabled` in `claude plugin list`); the **Errors** tab, where each entry pairs
a message with a guidance line; `/reload-plugins` if it was installed in this session; and the
plugin's details, which list what it contains. A client MUST provide those three views.
<!-- req: install.troubleshooting.Plugin doesn't appear or its skills don't show up -->

For a plugin being developed, the checks are, in this order (`plugins/create.md`, "Test and
debug"): `claude plugin validate <path>` (§17), which checks the manifest and the frontmatter of
every skill, agent and command file and exits `0` on `Validation passed` (`--strict` also fails on
warnings); `/reload-plugins`, which prints one `Reloaded:` line; the **Installed** tab, whose details
list the components found, and the **Errors** tab, which lists what failed and why; and
`claude --plugin-dir <path> plugin list`, which prints session-only and skills-directory plugins in
their own sections with `Status: ✔ loaded` or the load error. A skills-directory plugin missing from
that list with no error anywhere is blocked by managed settings (§16.9.1). A
`<component> path not found: <path>` error names a declared path that points at nothing (§2.5).
<!-- req: install.develop.Test and debug -->

The default locations a new plugin starts with are §1.4's: `.claude-plugin/plugin.json` (without it
a `--plugin-dir` plugin is named after its directory), `skills/`, `commands/`, `agents/`,
`hooks/hooks.json` (a top-level `"hooks"` key with the shape of `hooks` in settings) and `.mcp.json`.
Only `plugin.json` belongs inside `.claude-plugin/`; a component saved there does not load. The
plugin root is the plugin's own directory, so a `.mcp.json` at `~/.claude/.mcp.json` is not a
plugin's.
<!-- req: install.develop.Plugin layout..claude-plugin/plugin.json | install.develop.Plugin layout.skills/ | install.develop.Plugin layout.commands/ | install.develop.Plugin layout.agents/ | install.develop.Plugin layout.hooks/hooks.json | install.develop.Plugin layout..mcp.json -->

## Design decisions

### Why a project `true` does not download an external plugin

A repository's settings reach every collaborator who clones it. Letting them fetch code from an
external source would turn a committed line into a remote install on someone else's machine. A
relative-path plugin is already in the marketplace the user added, so it needs no fetch.

### Why records the client cannot read stop it from writing

A newer client may write records an older one does not understand. Rewriting the file would drop
them and uninstall plugins the newer client still uses; keeping the file untouched costs only that
the older client cannot change installs until it is updated.

### Why name conflicts compare manifest names

Components are namespaced by the manifest name, so two plugins with one manifest name would register
the same `/<name>:<skill>` commands. Choosing one by origin keeps every command unambiguous.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J16.1 | `installed_plugins.json` is `{ "version": 2, "plugins": { "<id>": [record, ...] } }`; `installedAt`, `lastUpdated`, `gitCommitSha` and `projectPath` are optional strings; unknown record fields are kept and written back; a file with no numeric `version` or no `plugins` object is "not a list of plugins" and is rebuilt (§16.6.1). | The docs name `scope`, `installPath`, `version`, `projectPath` and a "format (version <N>)", not the layout. Reference: `src/marketplace/installed-plugins.ts`. |
| J16.2 | In the dated copies, `<date>` is the UTC day `YYYY-MM-DD` and `<hash>` the first eight hex digits of the SHA-256 of the text the copy keeps; a `.set-aside` copy is the dropped keys with their raw values as JSON (§16.6.2). | The docs give the file-name shape only. Reference: `src/marketplace/installed-plugins-store.ts`. |
| J16.3 | A directory is swept when its marker is at least 14 days old; a directory a remaining record points at is neither marked nor swept; only `cache/<marketplace>/<plugin>/<version>` folders are marked or swept (§16.6.5). | The docs say "14 days later" and nothing about in-place directories, which the client does not own. Reference: `src/marketplace/orphan-cleanup.ts`. |
| J16.4 | When two ids of one install share a folder, the later one in install order is refused (§16.6.7). | The docs say no order helps, not which is refused. Reference: `src/marketplace/folder-collision.ts`. |
| J16.5 | The package-manager commands are `npm ci --ignore-scripts` and `bun install --frozen-lockfile --ignore-scripts`, run in the separate folder with a 60-second limit (§16.7). | The docs require frozen resolution and `--ignore-scripts`, not the command. Reference: `src/marketplace/node-deps.ts`. |
| J16.6 | A folder is one plugin, not a folder of plugins, when its top level has `.claude-plugin/` (unless it holds `marketplace.json` and no `plugin.json`), `skills/`, `commands/`, `agents/`, `hooks/`, `output-styles/`, `themes/`, `monitors/`, `workflows/`, a root `SKILL.md`, `.lsp.json` or a non-empty `.mcp.json`; `bin/`, `settings.json`, `CLAUDE.md`, a root `hooks.json` and a lower-case `skill.md` do not count (§16.8). | The docs say "no plugin components at its top level". Reference oracle 2.1.319: `src/loading/plugin-folder.ts`. |
| J16.7 | The reload summary joins its clauses to the counts with a space, the dependency clause before the errors clause, and does not pluralize (`1 plugins`) (§16.12). | The docs quote each clause, not their joining. Reference: `src/marketplace/reload-summary.ts`. |
| J16.8 | Two spellings of one project folder are one install by the platform's own path comparison (on Windows capitals and both separators are equal) (§16.13). | The docs describe the Windows case only. Reference: `src/marketplace/uninstall-records.ts`. |
| J16.9 | A hint tag MAY have blanks around it on its line; a line whose attribute list has a stray word is not a tag and stays in the output; a tag line missing a required attribute is removed and prompts nothing (§16.14). | The docs require the tag on its own line and three attributes, not these edges. Reference: `src/marketplace/plugin-hints.ts`. |
| J16.25 | A `--plugin-url` archive is extracted with the limits of an `archive` source, and its download sends no headers (§16.8). | `plugins/create.md` gives no limits or headers for `--plugin-url`; an archive with no limits would be the one unbounded download path. Reference: `src/marketplace/session-plugins.ts`. |
| J16.26 | A file or folder name Windows cannot store, which keeps a plugin off a Windows remote machine, is a path segment with `< > : " \ \| ? *` or a control character, one ending in a space or a dot, or a reserved device name with or without an extension. | `desktop.md`, "Windows remote machines", names only `:` ("such as a name with `:`"); the rest is the set Windows itself refuses in a file name, so a client that checks only `:` would copy a plugin the remote machine then cannot hold. |
