# 16. Install, updates and dependencies — updates

Part of §16 ([16-install.md](16-install.md) is its start): how a client computes a plugin's version
and detects an update, when it refreshes a marketplace, when plugins update on their own, how
releases reach users, and the settings that govern the client's own version. Evidence:
`plugins/loading.md`, "Versions and updates", unless a section names another page. The commands
named here are §17's.

## 16.16 Versions

A client MUST compute a **version** for every plugin it installs. The version is how it detects an
update: `claude plugin update` and auto-update (§16.19) compute it again and MUST NOT replace the
cached copy when it equals the version `installed_plugins.json` records (§16.6.1). The version also
names the plugin's cache directory, `cache/<marketplace>/<plugin>/<version>/`. When the version is
unchanged, `claude plugin update` prints `<name> is already at the latest version (<version>).`
however many commits the author pushed; an update the user starts MAY still retry an unfinished
Node.js package install in that copy (§16.18).

### 16.16.1 How the version is computed

For a marketplace added by source, the rule follows the `source` type of the plugin's marketplace
entry (§15). For every source type except `command`:

1. the `version` in the plugin's manifest (§2.4), if set;
2. else the `version` in the marketplace entry, if set;
3. else a version from the source:

   | Source type | Version |
   | --- | --- |
   | `github`, `url`, `git-subdir` | The source's commit SHA, shortened to 12 characters. A `git-subdir` version also carries a hash of the subdirectory path. <!-- req: updates.loading.How Claude Code computes the version.github --> |
   | `archive` | The SHA-256 digest shortened to 12 characters: the entry's `sha256` pin, or, without a pin, the digest of the downloaded file. <!-- req: updates.loading.How Claude Code computes the version.archive --> |
   | Relative path inside a git-hosted marketplace | The commit SHA of the installed directory. |
   | Local directory, when neither the plugin directory nor its marketplace is a git repository | `unknown` |
   | `npm` | `unknown` <!-- req: updates.loading.How Claude Code computes the version.npm --> |

4. The client MUST NOT take a version from a repository that merely encloses the install path, such
   as a git-managed `~/.claude`.
5. For a `command` source the version is always derived from what the command produced: a
   12-character hash alone, or `<manifest version>-<hash>` when the manifest sets one. The entry's
   `version` is ignored. What the hash covers is §15's (copy and link mode).
6. A plugin loaded in place from a marketplace added from a local path (§16.6.3) loads its current
   files at every session start, whatever its version says. For a plugin of a marketplace hosted on
   claude.ai, the version claude.ai records is its version and the manifest's is not read.
7. A `version` that is empty or only blanks counts as not set. A stated or computed version that
   cannot name one folder (empty, `.`, `..`, or holding `/`, `\` or NUL) is passed over for the next
   rule, and is `unknown` when none is left. A SHA, pin or digest is lower-cased before it is cut; a
   `git-subdir` version is `<commit12>-<path hash>` (Judgment J16.10).
   <!-- req: updates.loading.How Claude Code computes the version -->

A session-only plugin whose manifest sets no version is listed as `Version: unknown` (oracle
2.1.325, Judgment J16.11).

### 16.16.2 What pinning means

Because the manifest comes first, a manifest that pins `"version": "1.0.0"` keeps every user on the
cached copy until the author changes the string. To let users follow commits, an author leaves
`version` out of both the manifest and the entry. An author SHOULD NOT set it in both: the client uses
the manifest's value without warning, and `claude plugin validate` reports
`Entry declares version "<a>" but <path>/plugin.json says "<b>"` (§17).

### 16.16.3 `Version: unknown` for a git source

`Version: unknown` in `claude plugin list` for a plugin with its own git repository or inside a
git-hosted marketplace can mean the client could not read the commit it uses as the version. Claude
Code 2.1.302 and later clone in a form the commit can be read from; then updating the marketplace and
the plugin rewrites the recorded version. `claude plugin update` changes one scope's record per run,
so a record still showing `unknown` is updated with its own `--scope` (§17).
<!-- req: install.troubleshooting.A plugin installed from a git repository shows version unknown -->

## 16.17 Refreshing a marketplace before an install

An install looks the plugin up in the local copy of the marketplace catalog. Whether the client
refreshes that copy first depends on the form:

| Plugin named as | Command | What is refreshed |
| --- | --- | --- |
| `name@marketplace` | `/plugin install` or `claude plugin install` | The named marketplace, before the lookup. <!-- req: updates.loading.When Claude Code refreshes a marketplace before an install.name@marketplace --> |
| `name` | `/plugin install` | Only marketplaces with auto-update on, and only after the lookup misses. |
| `name` | `claude plugin install` | Nothing: the cached catalogs are read as they are. <!-- req: updates.loading.When Claude Code refreshes a marketplace before an install.name --> |

1. The refresh before a `name@marketplace` install MUST NOT depend on the marketplace's auto-update
   setting or on `DISABLE_AUTOUPDATER`.
2. When the refresh fails, the install proceeds from the cached catalog, and `claude plugin install`
   reports `marketplace not refreshed`; `/plugin install` reports nothing about it.
3. The client skips the refresh when the marketplace was added from a local `file` or `directory`
   source or defined inline with a `settings` source (§15); when a seed directory supplies it (§14);
   when it was refreshed within the last 30 seconds; when `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`
   is set; or when managed settings block the marketplace, in which case it also refuses the install.
   A bare name through `/plugin install` applies the same skips to each auto-update marketplace,
   but a managed block there only drops that marketplace from the refresh and refuses nothing
   (Judgment J16.12).
   <!-- req: updates.loading.When Claude Code refreshes a marketplace before an install -->

## 16.18 Updating now

1. One plugin is updated from its view under **Installed** (**Update now**) or with
   `claude plugin update <plugin>@<marketplace>` (§17). The new version loads in the next session or
   at `/reload-plugins`. Without `--scope`, the command updates the most specific scope the plugin is
   installed at for the current project: local, project, user, then managed.
2. No command updates every plugin. **Update marketplace** on the **Marketplaces** tab refreshes that
   marketplace's listing, updates the plugins installed from it, and reports each plugin it left for
   the user. It MUST leave a plugin with a `command` source, or with an entry that sets a
   `headersHelper`, to be updated on its own (§15).
3. `claude plugin marketplace update` with no name refreshes every listing and MUST leave installed
   plugins at their versions.
4. When the plugin is current, an update MAY retry an unfinished Node.js package install in its
   cached copy (§16.7); a failed retry prints `Failed to update plugin "<id>"` with the reason and
   exits 1.
   <!-- req: updates.guide.Update plugins now -->

## 16.19 Auto-update

### 16.19.1 When it runs

1. In an interactive session, after the user's first message, the client waits a random delay of up
   to ten minutes, then refreshes every marketplace with auto-update on and updates the plugins
   installed from them on disk (Judgment J16.13).
2. The running session MUST keep the versions it loaded until the user reloads; the client shows
   `Plugin updated: <name> · Run /reload-plugins to apply`, `/reload-plugins` in that session loads
   the new versions, and the next launch loads them whether or not the user reloads.
3. When a copied plugin updates mid-session, its hook commands, monitors, MCP and LSP servers keep
   the previous version's path. `/reload-plugins` switches hooks, MCP and LSP servers to the new
   path; monitors switch only at a restart (§9.2).

### 16.19.2 Which marketplaces auto-update

Whether a marketplace auto-updates follows the first of these that is set:

1. `autoUpdate` on its `extraKnownMarketplaces` entry in a settings file (§12);
2. `autoUpdate` on its `known_marketplaces.json` entry, which the auto-update toggle in the
   marketplace's menu on the **Marketplaces** tab writes; when the user, project or local settings
   also declare the marketplace under `extraKnownMarketplaces`, the toggle writes `autoUpdate` there
   as well;
3. the default: on for Anthropic's official marketplace names (§15) such as `claude-plugins-official`,
   except off for `knowledge-work-plugins` and `first-party-plugins`; on for marketplaces added from
   claude.ai; off for every other marketplace, including the community marketplace, third-party and
   local ones.

A marketplace a seed directory supplies is off (§14), before any of these is consulted
(Judgment J16.14). `marketplace.json` has no field that turns auto-update on; only a user or an admin
does.
<!-- req: updates.loading.Which marketplaces and plugins auto-update | updates.guide.Turn auto-update on or off for a marketplace | updates.hosting.Turn on auto-update -->

### 16.19.3 What turns it off

1. `DISABLE_UPDATES=1`, `DISABLE_AUTOUPDATER=1` or `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1` turns
   the whole pass off and hides the toggle, unless `FORCE_AUTOUPDATE_PLUGINS=1` is also set (§3.6).
2. Auto-update MUST skip a plugin whose marketplace entry declares a `headersHelper`; such a plugin
   appears in the **Errors** tab with the update to run (§15). It also skips `command`-source
   plugins, which re-run on their own schedule (§16.20).

### 16.19.4 Policy for a fleet

`plugins/org.md`, "Set update policy":

1. A managed `extraKnownMarketplaces` entry that sets `autoUpdate` decides for every user it reaches;
   the client MUST then refuse the user's toggle with an error that starts `Auto-update for '<name>'
   is set by`. A managed entry that leaves `autoUpdate` unset lets the user's toggle persist.
   <!-- req: updates.org.Turn auto-update on or off per marketplace -->
2. `DISABLE_AUTOUPDATER` in the managed `env` block turns plugin auto-update off for every
   marketplace and stops the client's own updates; adding `FORCE_AUTOUPDATE_PLUGINS` keeps plugin
   auto-update. Neither covers `command`-source plugins (§16.20).
   <!-- req: updates.org.Turn updates off for the whole fleet -->
3. Release channels are assigned to groups by giving each group its own `extraKnownMarketplaces`
   entry through separate endpoint-managed settings per group or one gateway policy per group (the
   first matching policy applies, and its `extraKnownMarketplaces` does not merge with another's, so
   it lists every marketplace the group needs). Server-managed settings apply to the whole
   organization and cannot assign groups (§14).
   <!-- req: updates.org.Assign release channels to user groups -->

### 16.19.5 Private marketplaces

A background check of a private marketplace uses the configured git credential helpers and MUST NOT
prompt (`plugins/host-marketplace.md`, "What background auto-update does with credentials"):

1. An SSH remote authenticates with a key loaded in `ssh-agent`; an HTTPS remote with a helper that
   supplies a stored credential without prompting. A helper that needs to prompt cannot answer, and
   the update fails quietly. A token in the environment, such as `GITHUB_TOKEN`, counts only through
   a credential helper that reads it.
2. When the checkout is current, the client leaves it. When the check finds new commits, or cannot
   reach or authenticate to the remote, the client clones again and replaces the checkout; when that
   clone fails, the old checkout stays and plugins keep working from it.
   `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE=1` keeps the checkout without the re-clone when the
   check cannot reach or authenticate and the checkout already holds
   `.claude-plugin/marketplace.json` (§15.14, §3.6).
   <!-- req: updates.guide.Auto-update from a private marketplace -->

## 16.20 Command-source re-runs

A plugin with a `command` source (§15) does not wait for the auto-update pass, because the directory
it printed reflects the tool's state when it ran. The client MUST run the accepted command again:

1. on every install and update of the plugin;
2. once per session for each enabled command-sourced plugin, in the background shortly after start,
   whatever the marketplace's auto-update setting or `DISABLE_AUTOUPDATER`;
3. at startup or `/reload-plugins`, when an enabled plugin's installed version is missing from the
   cache.

`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` skips the two background runs; explicit installs and
updates still run. When the hashed output changed, the client installs it as a new version and
reloads it in the running interactive session, switching what `/reload-plugins` switches, with a
notification; when that would invalidate the prompt cache, it asks the user to run `/reload-plugins`
instead (§16.12). <!-- req: updates.loading.When a command source re-runs -->

When the marketplace changes the entry's `command` or its `mode`, the client MUST run only the exact
command the user accepted at install or last update: the once-per-session run stops for that user,
and the **Errors** tab shows the new command and the `claude plugin update` command to run, which
asks the user to accept the new one (`plugins/host-marketplace.md`, "Change the command of a command
source"). <!-- req: updates.hosting.Change the command of a command source -->

## 16.21 How releases reach users

Release practice for authors and marketplace maintainers (`plugins/publish.md`,
`plugins/host-marketplace.md`). A client's part is the version rule of §16.16 and the update paths of
§16.18–§16.20.

1. **Releasing**: users receive a new copy only when the computed version changes. An author either
   increments `version` on each release (users stay on their cached copy until it changes) or omits it
   from both the manifest and the entry (users follow commits). Neither applies to an in-place load or
   a `command` source. <!-- req: updates.hosting.Release a new version | updates.publish.Release a new version -->
2. **Reaching users**: on request, `claude plugin update <plugin>@<marketplace>` refreshes the
   marketplace and installs the new copy when the version changed; with auto-update on (off by default
   for a third-party marketplace) the same happens on a delay after start. Without auto-update, users
   receive changes with `/plugin marketplace update <name>` or `claude plugin update`.
   <!-- req: updates.publish.Ship updates to users -->
3. **Tagging**: a release needs a git tag only when other plugins put a version range on it, because
   ranges resolve against tags (§16.25). `claude plugin tag` creates `{name}--v{version}` and `--push`
   sends it to `origin` (§17). <!-- req: updates.publish.Tag a release -->
4. **Holding users on a version**: a maintainer chooses which ref, commit or tag users get: `ref`
   and `sha` on a `github`, `url` or `git-subdir` entry, `#<ref>` on the add command, a marketplace
   source whose `ref` is a full commit SHA (§15), or, for dependents, `<plugin>--v<version>` tags.
   <!-- req: updates.hosting.Hold users on one version -->
5. **Release channels**: a plugin has no channel of its own. Two marketplaces with different `name`
   values point at different refs of one plugin, and each user adds one; a user cannot register two
   marketplaces of one name. The two refs need different versions (or no `version`), because a ref
   that moves without a version change leaves users on the cached copy.
   <!-- req: updates.hosting.Run release channels -->

### 16.21.1 Renames and removals

A plugin's `name` is its identifier in `enabledPlugins`, `pluginConfigs` and install commands;
changing it breaks every install, and `displayName` (§2.4) changes the label instead. A marketplace's
top-level `renames` map (§15) migrates users: <!-- req: updates.publish.Rename or remove a plugin -->

1. **Renamed entry**: the plugin loads under its new name; `claude plugin list` and the plugin's
   details show `Renamed to "<new>" in the "<marketplace>" marketplace` once, and the client rewrites
   the old key to the new one in `enabledPlugins` and `pluginConfigs` of the user, project and local
   scopes. The client follows the chain from the oldest name. For a marketplace added from a git
   repository or URL, the renamed plugin reports `Plugin "<name>" not cached at <path>` until the user
   installs it once under its new name.
   <!-- req: updates.hosting.Migrate users with a renames map.Renamed entry -->
2. **`null` entry**: the old key is dropped from those scopes, with `Removed from the "<marketplace>"
   marketplace`. <!-- req: updates.hosting.Migrate users with a renames map.null entry -->
3. **Enabled in managed settings**: the plugin loads under its new name, but the client MUST NOT
   rewrite managed settings, so the notice recurs until an admin changes them.
   <!-- req: updates.hosting.Migrate users with a renames map.Enabled in managed settings -->
4. **Removed plugins**: without `forceRemoveDeletedPlugins`, a plugin the marketplace no longer lists
   stays installed and reports `Plugin "<name>" not found in marketplace` when it loads. With
   `"forceRemoveDeletedPlugins": true`, at each session start the client compares what was installed
   from the marketplace against its entries and `renames`, treats each plugin neither listed nor
   renamed as removed, uninstalls it from the user, project and local scopes (a plugin only managed
   settings installed stays), and lists it under **Needs attention** on the **Installed** tab of
   `/plugin`, recorded in `flagged-plugins.json` (§16.6; `plugins/host-marketplace.md`, "Uninstall
   removed plugins from users' machines"). A `renames` target, even one whose chain
   does not resolve, is never treated as removed (Judgment J16.15).
   <!-- req: updates.hosting.Uninstall removed plugins from users' machines -->

## 16.22 The client's own version

Four settings (§12) govern the client's own updates, not plugins' (`settings-reference.md`):

| Key | Scope | Type and default | Effect |
| --- | --- | --- | --- |
| `autoUpdatesChannel` | Any file | `"latest"` or `"stable"`; unset follows `"latest"` | Which release channel background updates and `claude update` follow. `/config` writes `"stable"` to user settings and removes the key for latest; `claude install stable` and `claude install latest` save the channel; switching to stable asks whether to allow a downgrade, and staying sets `minimumVersion`. A Homebrew install ignores it. <!-- req: updates.key.autoUpdatesChannel --> |
| `minimumVersion` | Any file | Version string; an invalid value is ignored; unset allows any | Updates never install a version below it. It does not block start. `/config` writes it when the user stays on the current version while switching to stable, and clears it on switching back to latest. In managed settings it is a floor user and project settings cannot lower. <!-- req: updates.key.minimumVersion --> |
| `requiredMaximumVersion` | Managed only (ignored elsewhere without warning) | Version string; an invalid value is ignored; unset is no ceiling | A running version above it exits at start, telling the user to install an approved version; updates skip versions above it; `claude update`, `claude install` and `claude doctor` keep working. 2.1.163 or later. <!-- req: updates.key.requiredMaximumVersion --> |
| `requiredMinimumVersion` | Managed only (ignored elsewhere without warning) | Version string; an invalid value is ignored; unset is no floor | A running version below it exits at start; the check runs at start only, so a running session continues; the recovery commands keep working. 2.1.163 or later. <!-- req: updates.key.requiredMinimumVersion --> |

A channel value other than `latest` or `stable` follows `latest`; the effective `minimumVersion` is
the highest valid one of all files; a running version that does not parse starts (Judgment J16.16).

## Design decisions

### Why the manifest's version comes first

The manifest travels with the plugin's files, so it is the one statement of the version that the
author controls in the same commit as the change. An entry's version is the marketplace's claim about
a plugin it does not own.

### Why a running session keeps the version it loaded

A session's hooks, servers and prompt cache were built from one copy. Swapping files under them
mid-turn would mix two versions; orphaning the old directory for 14 days (§16.6.5) lets a session
finish on what it started with.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J16.10 | A blank `version` counts as unset; a version that cannot name one folder is passed over for the next rule, then `unknown`; SHAs, pins and digests are lower-cased before they are cut to 12 characters (a shorter one is kept whole); a `git-subdir` version is `<commit12>-<first 8 hex digits of the SHA-256 of the path without a leading ./ or trailing />` (§16.16.1). | `loading.md` gives the order and the table, not blank strings, the folder-name constraint the cache directory implies, or the path hash's form. Reference: `src/marketplace/version-resolution.ts`, `version-hash.ts`. |
| J16.11 | A session-only plugin with no manifest `version` is listed as `unknown` (§16.16.1). | The docs give no rule for session-only plugins. Oracle 2.1.325: `claude --plugin-dir ./q1 plugin list` printed `Version: unknown` for a manifest without `version`, and the manifest's `1.0.0` for one with it. |
| J16.12 | "Within the last 30 seconds" excludes exactly 30 seconds; a bare name through `/plugin install` applies the `name@marketplace` skips to each auto-update marketplace, and a managed block there drops that marketplace from the refresh without refusing (§16.17). | The skip list is stated for `name@marketplace` only. Reference: `src/updates/refresh-before-install.ts`. |
| J16.13 | The first auto-update pass is armed once per session with a delay drawn uniformly from 0 to 10 minutes; the client does not repeat it within the session (§16.19.1). | The docs say "a random delay of up to ten minutes" and nothing about repetition. Reference: `src/updates/auto-update-pass.ts`. |
| J16.14 | A seed marketplace is off before the settings entry, the recorded value and the default are consulted; the toggle writes a settings entry only in a user, project or local file, never in a managed, `--settings` or `--add-dir` one (§16.19.2). | `org.md` says a seed forces `autoUpdate` off and the toggle also writes the declaring settings entry, not which files are writable. Reference: `src/updates/auto-update-precedence.ts`. |
| J16.15 | With `forceRemoveDeletedPlugins`, a `renames` key with a non-null target is renamed, never removed, even when its chain does not resolve; a plugin only managed settings installed is still listed under **Needs attention** (§16.21.1). | A broken map must not uninstall plugins; the docs say managed installs stay, not whether they are flagged. Reference: `src/marketplace/removal.ts`. |
| J16.16 | An `autoUpdatesChannel` other than `latest` or `stable` follows `latest`; the effective `minimumVersion` is the highest valid value of all files; `v2.1.100` reads as `2.1.100`; a running version that is not a version starts (the gate fails open) (§16.22). | `settings-reference.md` gives the two values and a managed floor that "user and project settings can't lower", in 2.1.330 as in 2.1.321. The SDK `Settings` type (`@anthropic-ai/claude-agent-sdk` 0.3.330, `sdk.d.ts`) also lists `rc`, which the docs of neither release name; this specification does not define `rc`, and a client MAY accept it as a channel of its own. Reference: `src/updates/claude-code-version-policy.ts`. |
