# 15. Marketplaces: hosting

The second file of §15. It states what a client does with a marketplace once it is hosted: the
hosts it reaches and what a user needs for each, the download limits, private access over git,
background refresh and credentials, the headers and `headersHelper` commands that authenticate
archive downloads, renames and removals, and the publishing rules that change what a client does.
[§15.1 to §15.10](15-marketplaces.md) state the file, its names, entries and sources.

Evidence: `plugins/host-marketplace.md` unless a section names another page.

## 15.11 Hosts

### 15.11.1 The four hosts

| Host | Add argument | What the user's machine needs |
| --- | --- | --- |
| GitHub | `your-org/your-marketplace` | `git`, and access to a private repository (§15.13). |
| Another git host (GitLab, Bitbucket, GitHub Enterprise Server, ...) | the full clone URL, `https://gitlab.example.com/team/plugins.git` | `git` and network access to the host; `owner/repo` always means github.com. |
| A hosted `marketplace.json` | `https://plugins.example.com/marketplace.json` | HTTPS access to the URL; no `git` for the catalog. |
| A shared directory | `/Volumes/shared/claude-plugins` | Read access to the path. |

`#<ref>` on a GitHub or git-URL argument pins the catalog's branch or tag. Users install by the
entry's `name` and the catalog's `name`: `/plugin install code-formatter@your-marketplace`.

Anyone who can clone the repository can install from a git-hosted marketplace, so a private
repository makes a private marketplace; the catalog itself carries no access control, and what
a user may add is otherwise limited only by managed policy (§14.8.3)
(`plugins/publish.md`, "Control who can install"). <!-- req: marketplace.publish.Control who can install -->

**For everyone in a repository.** `claude plugin marketplace add <source> --scope project` writes the
marketplace into the project's `.claude/settings.json`; once that file is committed, the client
registers the marketplace for each user who trusts the folder (§13). <!-- req: marketplace.hosting.Register the marketplace for everyone in a repository -->

### 15.11.2 Relative paths in a URL-hosted marketplace

For a `url` marketplace source the client downloads only `marketplace.json` and never fetches plugin
files by relative path from that server. An entry whose `source` is a relative path therefore fails
at install with `its marketplace entry path does not stay inside the marketplace directory`
(§15.6.1), and an already-installed one fails to load with `Plugin source path refused`. Such a
marketplace's entries need sources fetched on their own (`github`, `archive`, ...), or the
marketplace belongs in a git repository, which the client clones whole
(`plugins/troubleshooting.md`, "Plugins with relative paths fail in URL-based marketplaces"). <!-- req: marketplace.hosting.Avoid relative-path entries in a URL-hosted marketplace | marketplace.troubleshooting.Plugins with relative paths fail in URL-based marketplaces -->

### 15.11.3 Plugins loaded in place

A marketplace added from a local directory (a `directory` or `file` source) serves its
relative-path plugins in place: the client reads them from that directory instead of copying them,
so an edit takes effect at the next session start or `/reload-plugins`, with no update step and no
`version` change. Users of a hosted copy of the same marketplace get a cached copy instead and
receive changes as §16 says (`plugins/create-marketplace.md`, "Test an edit to a plugin"). <!-- req: marketplace.hosting.Edit plugins in place on a shared directory | marketplace.create.Test an edit to a plugin -->

### 15.11.4 Git LFS

A clone of a marketplace or of a git-based plugin MUST NOT download Git LFS content: LFS-tracked
files arrive as pointer files. `skipLfs` on a marketplace source changes nothing (§15.8.2). Authors
keep the files a plugin needs out of LFS. <!-- req: marketplace.hosting.Keep plugin files out of Git LFS -->

### 15.11.5 Symbolic links

When the client copies a plugin from a marketplace into its cache, it handles each symbolic link by
where its target resolves:

- **within the plugin's own directory**: kept, as a relative link in the cache, so it still resolves
  to the copied target; <!-- req: marketplace.hosting.Share files within a marketplace with symlinks.Within the plugin's own directory -->
- **elsewhere in the same marketplace**: dereferenced, the target's content copied in its place, so a
  meta-plugin's `skills/` can link to skills of sibling plugins; <!-- req: marketplace.hosting.Share files within a marketplace with symlinks.Elsewhere within the same marketplace -->
- **outside the marketplace**: skipped. <!-- req: marketplace.hosting.Share files within a marketplace with symlinks.Outside the marketplace -->

For a plugin installed from a local path, and for a `command` source in `copy` mode, only links that
resolve within the plugin's own directory are kept; every other link is skipped.

## 15.12 Download limits

The client downloads a file from the host for a `url` marketplace source and for an `archive` plugin
source, and MUST fail the download past these limits:

| File | Largest download | Time to respond | Redirects |
| --- | --- | --- | --- |
| `marketplace.json` of a `url` source | 5 MiB | 10 seconds | A redirect to another origin MUST use `https://` and MUST NOT point at a loopback, link-local or cloud-metadata host, so `https://` to `http://` fails. |
| Zip of an `archive` source | 256 MiB | 120 seconds | At most five; every target MUST use `https://` and MUST NOT point at a loopback, link-local or cloud-metadata host. |

A request redirected to another origin carries none of the headers configured on the marketplace
source or the entry (§15.15).

After an archive downloads, the install MUST fail when the zip exceeds any extraction limit:

- **Entries**: 100,000 files and directories; <!-- req: marketplace.hosting.Stay within the download limits for hosted files.Entries -->
- **File size**: 512 MiB for any one file, uncompressed; <!-- req: marketplace.hosting.Stay within the download limits for hosted files.File size -->
- **Total size**: 1 GiB uncompressed; <!-- req: marketplace.hosting.Stay within the download limits for hosted files.Total size -->
- **Compression ratio**: uncompressed content 50 times the size of the zip. <!-- req: marketplace.hosting.Stay within the download limits for hosted files.Compression ratio -->

## 15.13 Private access over git

The client runs the user's `git` for adding, installing from and updating a git marketplace and for
git-based plugin sources, with interactive prompts off, and relies on credentials the machine
already holds. It has no git token of its own, and `marketplace.json` has no field for one.

The form of the add argument chooses the protocol:

- **GitHub `owner/repo`**: the client probes `ssh -T git@github.com` and clones over SSH when the
  probe succeeds; when the probe or the SSH clone fails, it clones over HTTPS.
  `CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` skips the probe and clones over HTTPS. <!-- req: marketplace.hosting.Grant access to a private marketplace.GitHub owner/repo -->
- **`git@host:path.git`**: SSH. <!-- req: marketplace.hosting.Grant access to a private marketplace.git@host:path.git -->
- **`https://example.com/repo.git`**: HTTPS. <!-- req: marketplace.hosting.Grant access to a private marketplace.https://example.com/repo.git -->

What each protocol needs:

- **SSH**: SSH runs in batch mode with `StrictHostKeyChecking=yes`. The key MUST work without a
  passphrase prompt (loaded in `ssh-agent`, for example) and the host MUST already be in
  `known_hosts`; the client never accepts a host key on its own. <!-- req: marketplace.hosting.Grant access to a private marketplace.SSH -->
- **An SSH program the user names**: when `GIT_SSH_COMMAND`, `GIT_SSH` or git's `core.sshCommand`
  names an SSH program, the client MUST run that program, chosen in git's own order
  (`GIT_SSH_COMMAND` over `GIT_SSH` over `core.sshCommand`), for every clone, fetch and SSH probe of
  a marketplace or plugin source, and MUST NOT replace it with a plain `ssh` of its own. It does not
  rewrite the program's command line: the program, like `ssh`, MUST NOT need to prompt, since the
  client's prompt-suppressing environment still applies (Judgment J15.14). The rule applies from
  2.1.285; earlier releases ran their own `ssh` and ignored `GIT_SSH` and `core.sshCommand`
  (`changelog.md`, 2.1.285). <!-- req: install.guide.Add a private marketplace.SSH -->
- **HTTPS**: the client leaves the user's git credential helper on but forbids it to prompt, and
  runs no askpass program (`GIT_ASKPASS` included). A credential the helper already stores works; one
  it would have to ask for fails. <!-- req: marketplace.hosting.Grant access to a private marketplace.HTTPS -->

A failed clone is reported as `Failed to clone marketplace repository:` followed by `SSH
authentication failed` or `HTTPS authentication failed`, or the host-key lines of
`plugins/troubleshooting.md`. A user without a GitHub SSH key relies on
`CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1`: `claude plugin install` from the shell may fall back to HTTPS on
its own for a `github` source, printing `SSH not configured, cloning via HTTPS`, but an install from
`/plugin` and every update MUST NOT fall back.

**Users without a git-host account** can add a marketplace served as a `marketplace.json` URL or a
shared directory, but install only the plugins whose sources they can reach: a private `github`
entry still fails, fetched by the same non-interactive git. The sources that need no account are
`archive` (HTTPS only; an entry should pin it with `sha256` so a changed
download is refused; credentials through §15.15) and a
public git repository given as an `https://` URL in a `url` or `git-subdir` source, which the client
clones without credentials; a `github` source, or a `git-subdir` written as `owner/repo`, needs
`CLAUDE_CODE_PLUGIN_PREFER_HTTPS=1` on a machine without a GitHub SSH key. <!-- req: marketplace.hosting.Serve users who have no git-host account -->

**Clone timeout.** Cloning a marketplace, and re-cloning one to update it, MUST stop after 120
seconds by default, failing with `Git clone timed out after 120s` and a hint naming
`CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS`, which sets the limit in milliseconds
(`plugins/troubleshooting.md`). <!-- req: marketplace.troubleshooting.Git clone timed out after 120s -->

**GitHub Enterprise Server.** A GHES marketplace is a `git` source on that host and needs git access
to it from the user's machine; when a policy restricts marketplace sources, it is admitted by a
`hostPattern` for the host (§14). Adding one from claude.ai needs the user's GitHub Enterprise
account connected there (`github-enterprise-server.md`). <!-- req: marketplace.troubleshooting.Marketplace add fails on a GitHub Enterprise Server host -->

## 15.14 Background auto-update and credentials

Background auto-update refreshes marketplaces and installed plugins after a session starts. For a
third-party marketplace it is off until the user turns it on (the marketplace's menu on the
**Marketplaces** tab of `/plugin`) or an `extraKnownMarketplaces` entry sets `"autoUpdate": true`; §16.19.2
gives the defaults, which are on for most official names, and §16.19.1 when it runs. For a private git marketplace, the background check for new commits uses the user's
configured credential helpers and MUST NOT prompt: <!-- req: marketplace.hosting.What background auto-update does with credentials -->

- **SSH remotes**: a key loaded in `ssh-agent` authenticates the check. <!-- req: marketplace.hosting.What background auto-update does with credentials.SSH remotes -->
- **HTTPS remotes with a stored credential**: a helper that supplies a stored credential without
  prompting (Git Credential Manager, the macOS Keychain helper, `git-credential-store`) authenticates
  the check. <!-- req: marketplace.hosting.What background auto-update does with credentials.HTTPS remotes with a stored credential -->
- **HTTPS remotes whose helper would prompt**: the check fails quietly and the existing checkout
  stays.

After the check:

- **Up to date**: the client leaves the checkout as it is. <!-- req: marketplace.hosting.What background auto-update does with credentials.The checkout is up to date -->
- **New commits, or a check that cannot reach or authenticate to the remote**: the client clones the
  marketplace again and replaces the checkout with the new clone; when that clone fails, the
  existing checkout stays in place and the plugins keep working from it. The re-clone is subject to
  the clone timeout (§15.13).

A user keeps a private marketplace current by storing a credential for the host in the helper (for
GitHub, `gh auth login` then `gh auth setup-git`). A token in the environment, such as
`GITHUB_TOKEN`, authenticates the check only through a credential helper that reads it. <!-- req: marketplace.hosting.What background auto-update does with credentials.Store a credential -->

**Keep the checkout on failure.** With `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE=1`, when the
background check cannot reach or authenticate to the remote, the client MUST keep the existing
checkout and MUST NOT attempt the re-clone, but only for a checkout that already contains
`.claude-plugin/marketplace.json`; a marketplace never cloned, or whose clone stopped partway, still
gets the clone attempt. Without the variable, an offline machine repeats the failed check and
re-clone every session for each marketplace with auto-update on; the checkout stays and startup is not delayed
(`plugins/troubleshooting.md`, "Marketplace updates keep failing offline"). A fully offline
deployment seeds the plugins directory instead (§16). <!-- req: marketplace.hosting.What background auto-update does with credentials.Keep the checkout on failure | marketplace.troubleshooting.Marketplace updates keep failing offline -->

## 15.15 Archive download headers

### 15.15.1 Where headers are set

An `archive` download is authenticated with HTTP headers, set in either of two places, each as a
`headers` map or a `headersHelper` command whose printed JSON object is that place's headers
(v2.1.238 or later for the entry fields and for `headersHelper`): <!-- req: marketplace.hosting.Authenticate archive downloads -->

| Place | Downloads that get the headers | When a `headersHelper` there runs |
| --- | --- | --- |
| The marketplace's `url` source (in settings) | Archive downloads on the marketplace URL's origin: same scheme, host and port. The fetch of `marketplace.json` too. | Before each fetch of `marketplace.json` and each archive download on that origin; one run's output is reused for up to 60 seconds. |
| The plugin's entry | That entry's download only. | Only when the user installs or updates that one plugin by itself and accepts the command (§15.15.4). |

Where both places set a header of one name, the entry's value is sent. Within one place, a header the
command prints overrides one of the same name in `headers`. `headers` and `headersHelper` on an entry
whose source is not `archive` have no effect (a validator warns, §15.10).

An entry that sets `headersHelper` MUST also set `"strict": false`; a validator reports otherwise
`Plugin "<name>" sets headersHelper but is not "strict": false`, and the client refuses to run the
helper. The entry should pin `sha256` (a validator warns without it). Installing such a plugin from
the shell, `claude plugin install <plugin>@<marketplace>`, shows the command and the archive URL and
downloads after the user accepts. <!-- req: marketplace.hosting.Add a headersHelper to a plugin entry -->

### 15.15.2 The command

Whether on a `url` source or an entry:

- **Command text**: at most 500 characters of printable ASCII, with no run of four or more spaces. <!-- req: marketplace.hosting.Write the headersHelper command.Command text -->
- **Output**: one JSON object of header names to string values on stdout, and exit 0 within 10
  seconds. <!-- req: marketplace.hosting.Write the headersHelper command.Output -->
- **Shell and working directory**: run through `sh`, or `cmd.exe` on Windows, in the configuration
  directory (`~/.claude` or `CLAUDE_CONFIG_DIR`); a relative path resolves against that directory,
  not the project. <!-- req: marketplace.hosting.Write the headersHelper command.Shell and working directory -->
- **Variables the client removes**: for a command set in a `marketplace.json` entry, or in a
  project's `.claude/settings.json` or `.claude/settings.local.json`, the client MUST remove from the
  command's environment every variable whose name looks like a credential, by the rule of an MCP
  `headersHelper` (§8): `ANTHROPIC_API_KEY` and `MY_REGISTRY_TOKEN` are both removed. The removal does
  not apply to a command set in user settings, a `--settings` file or managed settings. <!-- req: marketplace.hosting.Write the headersHelper command.Variables Claude Code removes -->
- **Variables the client sets**: `CLAUDE_CODE_MARKETPLACE_URL` and `CLAUDE_CODE_MARKETPLACE_NAME` for
  a `url` source's command; `CLAUDE_CODE_PLUGIN_NAME` and `CLAUDE_CODE_PLUGIN_ARCHIVE_URL` for an
  entry's. `CLAUDE_CODE_MARKETPLACE_NAME` is unset on the first fetch after a marketplace is added by
  URL, because that fetch supplies the name. <!-- req: marketplace.hosting.Write the headersHelper command.Variables Claude Code sets -->

### 15.15.3 When a command is skipped or headers are dropped

<!-- req: marketplace.hosting.When Claude Code skips a headersHelper command or drops its output -->

- **Command fails**: when it exits non-zero, runs past 10 seconds, or prints anything other than a
  JSON object of string values, the fetch or download it ran for MUST NOT happen. <!-- req: marketplace.hosting.When Claude Code skips a headersHelper command or drops its output.Command fails -->
- **Marketplace URL not `https://`**: that `url` source's command does not run; requests carry only
  its `headers`.
- **Redirect leaves the origin**: the redirected request carries no `headers` values and no command
  output, from either place. <!-- req: marketplace.hosting.When Claude Code skips a headersHelper command or drops its output.Redirect leaves the origin -->
- **Entry sets a routing or identity header**: the client drops request-routing and client-identity
  names, such as `Host`, `Cookie` and every `X-Forwarded-*`, in any letter case (the exact set is
  Judgment J15.12), from every
  `marketplace.json` entry's `headers` and command output, and keeps authentication names such as
  `Authorization`. A validator warns `Header "<name>" is a request-routing/identity header that
  catalog entries may not set; Claude Code drops it at download time.` <!-- req: marketplace.hosting.When Claude Code skips a headersHelper command or drops its output.Entry sets a routing or identity header -->
- **Command set in an `--add-dir` directory's settings**: ignored, on a `url` source and an inline
  plugin entry alike; only that file's `headers` are sent.
- **Managed settings block the command**: `disableCommandPluginSources: true` blocks `headersHelper`
  commands, and `allowManagedHooksOnly` blocks them too unless `disableCommandPluginSources` is
  explicitly `false`. Under either block, a command for a marketplace that managed settings
  themselves declare still runs (§14). <!-- req: marketplace.hosting.When Claude Code skips a headersHelper command or drops its output.Managed settings block the command -->

### 15.15.4 Accepting an entry's command

An entry's command runs only after the user accepts it, each time they install or update that one
plugin by itself. The client shows the command and the archive URL. The places to do it:

- **Terminal session**: the plugin's own view in `/plugin`. <!-- req: marketplace.hosting.How users accept a headersHelper command.Terminal session -->
- **Shell**: `claude plugin install` or `claude plugin update`; in a non-interactive shell `--yes`
  accepts, and `--accept-command <sha256>` accepts only the command a previous `--json` run showed
  (§17). <!-- req: marketplace.hosting.How users accept a headersHelper command.Shell -->
- **VS Code extension**: the **Manage plugins** dialog, extension 2.1.290 or later. <!-- req: marketplace.hosting.How users accept a headersHelper command.VS Code extension -->

The client MUST run only the command it showed, for the archive URL it showed: when either changed in
between, it refuses the install or update. A change in the URL's query string alone does not count,
except in the VS Code extension and with `--accept-command`.

**Operations that refuse instead of asking.** On any operation other than a single-plugin install or
update, the client MUST NOT run an entry's command or download its archive; the plugin stays at its
installed version or uninstalled: <!-- req: marketplace.hosting.Installs and updates that refuse a command instead of asking -->

- installing several plugins at once, from a suggestion, or as another plugin's dependency: the
  plugin with the command is refused and the user is directed to its own view in `/plugin`; the
  other plugins of a bulk install still install, and a plugin depending on the refused one fails
  until it is installed by itself;
- background auto-update, or session start for a plugin whose archive was never downloaded: the
  plugin is listed on the `/plugin` Errors tab so the user installs or updates it by hand.

### 15.15.5 When a `url` source's command runs

A `url` source's `headersHelper` is declared in a settings file, not in the catalog, so the user is
not asked on each install. The file that declares it decides when it runs:

| Settings file | When the command runs |
| --- | --- |
| User settings, a `--settings` file, or a managed settings file on the machine | Without asking, background refreshes included. <!-- req: marketplace.hosting.When a marketplace url source's command runs.--settings --> |
| A project's `.claude/settings.json` or `.claude/settings.local.json` | Only after the user accepts the workspace trust dialog for that folder itself; a `-p` or SDK session does not count, nor does trust granted to a parent folder (§13). <!-- req: marketplace.hosting.When a marketplace url source's command runs..claude/settings.json --> |
| Server-managed settings | In an interactive session, only after the user approves the delivered settings in the security approval dialog (§14). <!-- req: marketplace.hosting.When a marketplace url source's command runs.Server-managed settings --> |

An inline plugin entry in one of these files needs the same trust or approval as a marketplace-level
command there, and its own command is also accepted on each install or update (§15.15.4).

## 15.16 Releases, renames and removals

**Versions.** A user receives a new copy of a plugin only when its computed version changes: the
`plugin.json` `version`, then the entry's, then the commit or content hash (§16). A plugin loaded in
place (§15.11.3) or from a `command` source is not governed by `version`. A `version` set and not
bumped holds users on their copy.

**Changing a `command` source.** When a marketplace changes an entry's `command` or `mode`, the
client MUST NOT run the new command until the user accepts it: it stops the once-per-session run for
that user and shows an entry on the `/plugin` Errors tab with the new command and the `claude plugin
update` command to run, which shows the command and asks.

**Renames.** `renames` maps a former name to its current name or to `null`. After a catalog with a
rename reaches a user who has the old name enabled, the client loads the plugin under its new name,
shows `Renamed to "<new>" in the "<marketplace>" marketplace` once in `claude plugin list` and the
plugin's details, and rewrites the old key to the new one in `enabledPlugins` and `pluginConfigs` in
the user, project and local settings. A `null` target drops the old key from those scopes and shows
`Removed from the "<marketplace>" marketplace`. Managed settings are never rewritten, so the notice
recurs until an administrator updates them. For a git- or URL-hosted marketplace a renamed plugin
reports `Plugin "<name>" not cached at <path>` until the user installs it once by its new name. The
client follows a chain from the oldest name; a validator rejects a chain that cycles or ends
anywhere other than `null` or an entry's name (§15.10).

**Removal.** Without `forceRemoveDeletedPlugins`, a plugin removed from `plugins` stays installed and
reports `Plugin "<name>" not found in marketplace` when a session loads it. With
`"forceRemoveDeletedPlugins": true`, at each session start the client treats every plugin installed
from the marketplace that is neither listed nor renamed as removed, uninstalls it from the user,
project and local scopes (a plugin only managed settings installed stays), and lists it under
**Needs attention** on the **Installed** tab of `/plugin` (§16.21.1).

**Dependencies and suggestions.** An entry declares dependencies with `dependencies` (§15.4), which
may carry semver ranges resolved against `<plugin>--v<version>` git tags; a dependency from another
marketplace installs only when this marketplace lists that one in
`allowCrossMarketplaceDependenciesOn` (§16). Suggestions from `relevance` appear only for a
marketplace an administrator lists in `pluginSuggestionMarketplaces` (§15.9). <!-- req: marketplace.hosting.Depend on and recommend other plugins -->

**What a catalog cannot do.** No `marketplace.json` field restricts, installs or enables anything
beyond the catalog, and the client MUST NOT read such meaning into one: <!-- req: marketplace.hosting.Work around what a marketplace can't do -->

- restricting what else users install is the managed `strictKnownMarketplaces` (§14); <!-- req: marketplace.hosting.Work around what a marketplace can't do.Restrict what else users install -->
- installing or enabling a plugin unasked is managed `enabledPlugins` (§14);
- entries have no audience field: every user sees the whole catalog;
- there is no deprecation state: a plugin is retired by removing its entry, mapping its name to
  `null` in `renames`, and optionally `forceRemoveDeletedPlugins`; <!-- req: marketplace.hosting.Work around what a marketplace can't do.Mark a plugin deprecated -->
- auto-update is turned on by the user or by managed `autoUpdate` (§15.14), never by the catalog; <!-- req: marketplace.hosting.Work around what a marketplace can't do.Turn on auto-update for your users -->
- no field carries a git credential (§15.13); only `archive` downloads take `headers` or
  `headersHelper` (§15.15). <!-- req: marketplace.hosting.Work around what a marketplace can't do.Carry git credentials -->

## 15.17 Publishing

These author-facing rules matter to a client because its validator and installer enforce them
(`plugins/publish.md`).

- **Before a release**: a plugin's `name` is permanent, since a renamed plugin is a different plugin
  to every install (kebab-case, or `claude plugin validate` warns); `version` is either bumped on
  every release or omitted in a git-hosted marketplace so the commit SHA versions it, because with
  an unchanged `version` `claude plugin update` prints `<name> is already at the latest version
  (<version>).`; `claude plugin validate --strict` exits 1 on warnings, a missing `version`
  included, and validation reports component paths that do not start with `./`; `homepage` must
  parse as a URL (§2). <!-- req: marketplace.publish.Prepare your plugin for release -->
- **Shipping with one's own tool**: an installer runs or prints `claude plugin marketplace add
  <source>` then `claude plugin install <name>@<marketplace>`, the two commands a user needs to
  install from a marketplace. <!-- req: marketplace.publish.Ship a plugin with your own tool -->

**The deprecated `claude-code-plugins` marketplace.** The marketplace `claude-code-plugins` in
`anthropics/claude-code` is deprecated; its plugins update from the `claude-plugins-official`
repository and keep working. Two differ: `ralph-wiggum` is now `ralph-loop`
(`ralph-loop@claude-plugins-official`, commands `/ralph-loop:`), and `claude-opus-4-5-migration` is
retired and is uninstalled with `claude plugin uninstall
claude-opus-4-5-migration@claude-code-plugins` (`plugins/anthropic-marketplaces.md`). A client MUST
treat `claude-code-plugins` from `anthropics/claude-code` as an official name (§15.3.2). <!-- req: marketplace.anthropic.Deprecated claude-code-plugins marketplace -->

## Design decisions

### Why the client never prompts for git credentials

Marketplaces refresh in the background and from non-interactive shells and CI, where a prompt would
hang or fail unseen. Relying only on credentials already stored keeps every path, interactive or not,
behaving the same, and keeps the catalog free of secrets.

### Why an entry's `headersHelper` needs consent each time and `strict: false`

The command comes from a catalog the user did not write and runs on their machine. Showing it, with
the URL it is for, on each single-plugin install or update, and refusing it in bulk or background
operations, keeps every run tied to a decision the user made. Requiring `strict: false` puts the
plugin's whole manifest in the entry, so what the plugin ships is visible before its command runs.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J15.12 | A name is a request-routing or client-identity header when, lowercased with `_` read as `-`, it is one of `host`, `cookie`, `forwarded`, `x-real-ip`, `x-client-ip`, `true-client-ip`, `client-ip`, `cf-connecting-ip`, `fastly-client-ip`, `x-originating-ip`, `x-remote-ip`, `x-remote-addr`, `x-cluster-client-ip`, `connection`, `upgrade`, `transfer-encoding`, `content-length`, `te`, `trailer`, `expect`, `via`, or starts with `x-forwarded-`, `x-original-` or `proxy-` (§15.15.3). Every other name, `Authorization`, `X-Api-Key` and a bare `X-Forwarded` included, is kept. | The docs say "such as `Host`, `Cookie`, and `X-Forwarded-*`" and keep `Authorization`. Oracle 2.1.325: `claude plugin validate` warns for each listed name, for `X-Original-Host`, `proxy-foo` and `X_Real_IP`, and not for `Authorization`, `X-Api-Key` or `X-Forwarded`. The exact set is the one those validator warnings show; the 2.1.321 docs list only examples. |
| J15.14 | A user-named SSH program (§15.13) is run as git would run it, in git's order, also for the `ssh -T git@github.com` probe of an `owner/repo` shorthand; the client adds no `BatchMode` or `StrictHostKeyChecking` option to it, and clears the askpass variables and terminal prompts as for any clone. | `plugins/install.md`, "Add a private marketplace": "If your git setup names an SSH program in `GIT_SSH_COMMAND`, `GIT_SSH`, or your git config's `core.sshCommand`, Claude Code runs that program"; the docs do not say which wins, whether options are added, or whether the probe uses it. Git's own precedence keeps an install's transport the one the user's other git commands use. Lead: the reference implementation's `src/marketplace/git-transport.ts` (`clonePlan`: a named program is `user-configured`, otherwise `ssh` in batch mode). Changelog 2.1.285 fixed installs and updates "ignoring the ssh program set in `GIT_SSH` or in your git config's `core.sshCommand`". |
