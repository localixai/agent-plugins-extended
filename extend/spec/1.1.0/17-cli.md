# 17. The plugin CLI and its diagnostics

A Claude Code user installs, configures, checks and removes plugins from the shell with
`claude plugin …`, and loads a plugin for one session with a flag on `claude`. This chapter states
those commands as an Extended client MUST offer them: their arguments, flags, output, exit codes
and refusals; the validator; the session flags that change what plugins and their components load;
and what a client reports so that a user can find out why a plugin or a setting did not take effect.
[17-errors.md](17-errors.md) continues the chapter with the diagnostics a client prints.

Evidence: `plugins/cli-reference.md` unless a section names another page; `cli-reference.md` for the
`claude` flags; `debug-your-config.md` for §17.16. What a command changes on disk is stated by the
chapters it changes: settings §12, marketplaces §15, installs, updates and dependencies §16; this
chapter states the command surface and points there.

## 17.1 The command tree

1. `claude plugin` manages plugins from the shell, outside a session. `claude plugins` is an alias
   and MUST behave identically. <!-- req: cli.command.claude plugin -->
2. A client MUST offer these subcommands, by these names and aliases:

   | Subcommand | Aliases | § |
   | --- | --- | --- |
   | `install <plugin>` | `i` | 17.4 |
   | `uninstall <plugin>` | `remove`, `rm` | 17.5 |
   | `enable <plugin>` | | 17.6 |
   | `disable [plugin]` | | 17.6 |
   | `update <plugin>` | | 17.7 |
   | `list` | | 17.8 |
   | `details <name>` | | 17.9 |
   | `configure <plugin>` | | 17.10 |
   | `restore-set-aside <plugin>` | | 17.10.1 |
   | `prune` | `autoremove` | 17.11 |
   | `tag [path]` | | 17.12 |
   | `validate <path>` | | 17.13 |
   | `marketplace add <source>` | | 17.14.1 |
   | `marketplace list` | | 17.14.2 |
   | `marketplace remove <name>` | `rm` | 17.14.3 |
   | `marketplace update [name]` | | 17.14.4 |

   `init` (alias `new`), `eval`, `eval init` and `test` scaffold plugins and run evaluation suites
   and mod tests. They neither load nor run a plugin, so this specification does not define them; a
   client MAY offer them (Judgment J17.1).
3. A word under `claude plugin` or `claude plugin marketplace` that names no subcommand is an
   unknown command: the client MUST exit `1` without acting (Judgment J17.3).
4. `--help` on any command prints its usage and changes nothing.

### 17.1.1 Conventions every subcommand shares

- **Exit codes.** `0` on success, `1` on failure. Only `validate` adds `2`, for an unexpected error
  of the validator itself (§17.13.4). <!-- req: cli.plugin.claude plugin commands.Exit codes -->
- **Plugin arguments.** A `<plugin>` is a plugin `name` or `name@marketplace`. When two
  marketplaces offer one name the qualified form is needed; `configure` and `restore-set-aside`
  take the qualified form only. A bare name matches the installed plugins whose name equals it;
  when two or more match, the command MUST refuse, change nothing and list the qualified command for
  each (§17.7.2, Judgment J17.5). <!-- req: cli.plugin.claude plugin commands.Plugin arguments -->
- **Scopes.** `--scope` takes `user`, `project` or `local` and names the settings file the command
  writes (§12). `update` also takes `managed`. The plugin commands spell it `-s, --scope <scope>`;
  the marketplace commands have no `-s`. A value a command does not take is a usage error
  (§17.2.3). <!-- req: cli.plugin.claude plugin commands.Scopes -->

## 17.2 How a command reports

### 17.2.1 The human line

Without `--json` a command prints a human-readable result. The client SHOULD write a success line
to stdout and a failure line to stderr (Judgment J17.2). Where this chapter quotes a line, the
client MUST print it as quoted, with the placeholders filled. A success line this chapter quotes
as `Successfully <verb> …` keeps `Successfully` only when stdout or stderr is not a terminal; in a
terminal the line leaves it out and begins with the capitalised verb, as in `Installed plugin:
<id> (scope: <scope>)` and `Added marketplace: <name> (declared in <scope> settings)`
(`plugins/cli-reference.md`, "claude plugin commands"; Judgment J17.33). The `message` of a
`--json` result keeps `Successfully` either way.

### 17.2.2 The JSON result line

`install`, `uninstall`, `enable`, `disable`, `update`, `marketplace add`, `marketplace remove` and
`marketplace update` take `--json`. With it, the **last line of stdout** MUST be one JSON object, the
*result*, in place of the human line. Lines before it, such as a marketplace-declared install
command the client displays (§17.4.2), are not part of the result, and a consumer parses only the
last line. The object always carries:

| Field | Value |
| --- | --- |
| `command` | The subcommand that ran: `install`, `uninstall`, `enable`, `disable`, `update`, `marketplace-add`, `marketplace-remove`, `marketplace-update`. <!-- req: cli.plugin.JSON result format.command --> |
| `outcome` | `ok` or `failed`; `ok` exactly when the exit code is `0`. <!-- req: cli.plugin.JSON result format.outcome --> |
| `message` | The human-readable description, the text the human line would carry. <!-- req: cli.plugin.JSON result format.message --> |

Other fields appear only when they apply: `pluginId`, `scope`, `failureCode` (a stable code for why
the command failed), and each subcommand's own fields stated in its section. For a plugin whose
marketplace entry installs it by running a command (§15, §17.4.2), `install` adds two booleans
(2.1.330 or later):

| Field | Value |
| --- | --- |
| `commandPrinted` | `true` when the install succeeded and the source's command wrote to stderr; the human line is then a warning, not a success, and shows what the command wrote. <!-- req: cli.plugin.JSON result format.commandPrinted --> |
| `commandFailed` | `true` when the source's command exited with an error, was killed by a signal, or timed out. <!-- req: cli.plugin.JSON result format.commandFailed --> |
 A marketplace command
adds `marketplace`, the name it acted on, and on failure a `failureCode` such as `invalid_source`;
`claude plugin marketplace remove your-marketplace --json` prints

```json
{"command":"marketplace-remove","outcome":"ok","marketplace":"your-marketplace","message":"Successfully removed marketplace: your-marketplace"}
```

<!-- req: cli.plugin.JSON result for marketplace commands -->

The `failureCode` values this specification fixes are in the table of Judgment J17.4; a client MAY
add codes of its own for failures the table does not name, and a consumer MUST treat an unknown
code as a failure.

### 17.2.3 Usage errors

A usage error, such as a `--scope` value the command does not take or two flags that exclude each
other, MUST print no result line, even with `--json`, write the reason to stderr and exit `1`
before anything is read or changed. The usage errors this chapter names are listed in Judgment J17.3,
with the reason's wording for an invalid scope: `Invalid scope: <value>. Use one of: <list>`.

## 17.3 Which scope a command acts on

1. `install`, `uninstall` and `prune` act on `--scope`, default `user`. `marketplace add` declares
   in `--scope`, default `user`; `marketplace remove` without `--scope` acts on every scope.
2. `enable` and `disable` without `--scope` MUST check the settings files in the order local,
   project, user and act at the first scope that mentions the plugin (its key in that scope's
   `enabledPlugins`).
3. `update` without `--scope` MUST update the plugin at the most specific scope it is installed at
   for the current project, checking local, project, user, then managed. `managed` is the one scope
   that can be updated and never installed to (§14, §16). <!-- req: cli.plugin.Which scope the command updates -->
4. `enable` or `disable` given a `--scope` where the plugin is not declared MUST either:
   - write an override at the given scope, when that scope takes precedence over every scope that
     declares the plugin (§12): `claude plugin disable formatter --scope local` turns a
     project-enabled plugin off for this user alone; or
   - fail, for any other scope, with
     `Plugin "<name>" is installed at <scope> scope, not <given>. Use --scope <scope> or omit --scope to auto-detect.`,
     naming the scope auto-detection would pick (Judgment J17.6).

## 17.4 `plugin install`

`claude plugin install <plugin> [options]` installs a plugin from one of the user's marketplaces
(§16). <!-- req: cli.plugin.plugin install -->

| Flag | Meaning |
| --- | --- |
| `-s, --scope <scope>` | `user`, `project` or `local`; default `user`. The install record and the `enabledPlugins` entry go to that scope (§16). <!-- req: cli.plugin.plugin install.-s, --scope <scope> --> |
| `--config <key=value>` | Sets a `userConfig` option the manifest declares (§3.4). Repeatable, one option each. A key written `<server>.<key>` sets a setting that a bundled MCP server (`.mcpb` shipped in the plugin, §8) declares in its own `user_config`. Values are checked before anything is installed; a value that fails refuses the whole install (Judgment J17.26), and a value given without `=` is a usage error (§17.4.1, Judgment J17.3). <!-- req: cli.plugin.plugin install.--config <key=value> --> |
| `-y, --yes` | Accepts the displayed marketplace-declared command without the `Run this command now? [y/N]` prompt (§17.4.2). Ignored when the command runs inside a session: from the Bash tool, a hook, or anything else the session spawns. <!-- req: cli.plugin.plugin install.-y, --yes --> |
| `--accept-command <sha256>` | Accepts exactly the displayed command whose digest a previous `--json` run reported (§17.4.3), in place of `-y`. With `-y` it is a usage error. It has no effect inside a session. <!-- req: cli.plugin.plugin install.--accept-command <sha256> --> |
| `--json` | Prints the result object (§17.2.2) as the last stdout line. <!-- req: cli.plugin.plugin install.--json --> |
| `--marketplace <source>` | Installs `<plugin>`, given by its **bare** name, from the marketplace at `<source>` (any form of §17.14.1), adding that marketplace first, in user settings and under the checks of `marketplace add`, when it is not added yet. A `<plugin>` written `name@marketplace` with this flag is a usage error. When the fetched catalog's name is a marketplace already added from a different source, the install fails and keeps the existing marketplace (§17.20). <!-- req: cli.plugin.plugin install.--marketplace <source> --> |

### 17.4.1 Output

- Success: `Successfully installed plugin: <id> (scope: <scope>)` (`Installed plugin: …` in a
  terminal, §17.2.1), exit `0`. When a local-folder plugin is outside its `engines` range, the line
  continues with the note of §2.4. Claude Code's `--json` result also carries `unsetOptionCount`,
  the number of `userConfig` options not yet set (changelog 2.1.323; the reference does not list
  it), which a client MAY add.
- Already installed at that scope: `Plugin "<id>" is already installed (scope: <scope>)`, exit `0`.
- A declined command-source prompt: `Aborted.`, exit `1`.
- A declined `headersHelper` prompt, or one that cannot be confirmed without a terminal:
  `Aborted — the command was not run.`, exit `1`.
- A plugin no marketplace lists fails, exit `1`; one offered under one name by several marketplaces
  fails and lists the qualified ids (§17.1.1).
- A broken marketplace registry fails with the messages of §17.20.

**`userConfig` values.** This section is where the specification states what `install` does with
`userConfig`; §2.12 and §3.4.6 cite it. The command never prompts for an option. It saves each
`--config KEY=VALUE` it is given; a key given twice keeps its last value, and a value that fails
its option's type, bounds or `options` (§3.4.1, §3.4.2) refuses the install before anything changes
(`invalid_config` in `--json`; Judgment J17.26). After a successful install:

- when options remain unset, it prints `N userConfig options not yet set — run /plugin configure
  <plugin>@<marketplace> in Claude Code, or pass --config KEY=VALUE.`, with ` (M required)` after
  `not yet set` when M of them are `required`; when every option is set it prints no such line;
- a `--config` key the manifest does not declare does not stop the install: the command prints
  `⚠ Installed, but --config not applied: --config key "<key>" isn't declared in this plugin's
  userConfig.` followed by the keys the plugin declares. When the plugin ships a bundled MCP server
  file that declares its own `user_config` (§8), the line ends
  `isn't declared in this plugin's userConfig or by its bundled MCP servers.` instead and the keys
  listed include that server's, written `<server>.<key>`; a bundle the manifest references by URL is
  not read at install, so its keys are not listed and the line says to configure it in `/plugin`.

The options can be set later with `/plugin configure` (§3.4.6) or `claude plugin configure
--values-stdin` (§17.10). <!-- req: manifest.troubleshooting.The userConfig dialog never appears -->

### 17.4.2 Marketplace-declared commands

Most plugins install without a prompt. When the plugin's marketplace entry installs it by running a
command, or fetches its archive through a `headersHelper` (§15, §16), the client MUST first print
that command and ask `Run this command now? [y/N]`, and run it only on `y`. Then:

1. With `-y`, from the user's own terminal, the client runs the command without asking.
2. With neither `-y` nor `--accept-command`, when stdin or stdout is not a terminal, the client MUST
   refuse the install, say that the command was only displayed, and exit `1`.
3. Inside a session, `-y` and `--accept-command` are ignored: a command the model runs never
   accepts on the user's behalf, and rule 2 applies.

### 17.4.3 Accepting a displayed command by digest

When a `--json` run displays a marketplace-declared command and does not run it, its `failed` result
MUST carry `"failureCode": "command_not_accepted"` (Judgment J17.4) and a `shownCommand` object with, at least, the command as displayed, the plugin it belongs
to, and the command's `sha256`. Re-running from the user's own terminal with
`--accept-command <that sha256>` accepts exactly that command, for that plugin and that marketplace
catalog. If any of the three changed since it was shown — including a change the run's own
marketplace refresh fetched — the client MUST NOT accept the digest: it shows the command again,
with `shownCommand.acceptCommandMatched: false`, and runs nothing. The digest is computed as
Judgment J17.8 states. <!-- req: cli.plugin.Accept a displayed install command -->

## 17.5 `plugin uninstall`

`claude plugin uninstall <plugin> [options]` removes an installed plugin from one scope (§16).

| Flag | Meaning |
| --- | --- |
| `-s, --scope <scope>` | `user`, `project` or `local`; default `user`. <!-- req: cli.plugin.plugin uninstall.-s, --scope <scope> --> |
| `--keep-data` | Keeps the plugin's persistent data directory, `~/.claude/plugins/data/<id>/` (§3.1.2). <!-- req: cli.plugin.plugin uninstall.--keep-data --> |
| `--prune` | Also removes auto-installed dependencies (§16) that no remaining plugin needs, after a confirmation prompt. <!-- req: cli.plugin.plugin uninstall.--prune --> |
| `-y, --yes` | Skips the `--prune` confirmation. Without a terminal on stdin or stdout, `--prune` without `-y` is a usage error. <!-- req: cli.plugin.plugin uninstall.-y, --yes --> |
| `--json` | Prints the result object (§17.2.2). With `--prune` it is a usage error. <!-- req: cli.plugin.plugin uninstall.--json --> |

Output:

- Success: `Successfully uninstalled plugin: <name> (scope: <scope>)` (§17.2.1), naming the plugin by its
  `name` even when the argument was qualified, exit `0`. When enabled plugins still depend on it, the
  uninstall succeeds and the line adds ` — warning: required by <names>` (§16.29, Judgment J16.23).
- Not installed at that scope: a line starting `Failed to uninstall plugin "<plugin>":`, exit `1`.
- The settings of the scope still switch the plugin on: the failure continues
  `"<name>" was not uninstalled:` and names the settings file; the plugin stays installed with
  everything it saved; `--json` carries `failureCode: "settings_still_on"`. §17.18.11 states the
  message.

### 17.5.1 What an uninstall deletes and keeps

When the uninstall removes the plugin from the **last** scope it is installed at, the client MUST
also delete the plugin's stored `userConfig` options and secrets (§3.4) and its data directory,
except that:

1. with `--keep-data`, the data directory stays;
2. when another installed plugin uses the same data folder — for one, an id that differs only in
   letter case (§3.1.2, §16.6.7) — the data directory stays;
3. when the client cannot read the list of installed plugins back after removing this scope's
   record, the options, the secrets and the data directory all stay, because the plugin may still
   be installed at another scope. The uninstall still succeeds; the message lists what stayed and how
   to delete it, and `--json` carries `savedKept: "install_records_unreadable"`.

With `--json`, `keptData` (boolean) reports whether the data directory stayed, for any of these
reasons; `/plugin` shows `· data preserved` beside the plugin when it did. Uninstalling from a scope
that is not the last deletes none of them. These are examples, not the only cases in which some or
all of them stay. When the client deletes the options and secrets it also deletes the files it
extracted into `mcpb/` under the plugins root from the plugin's MCP bundles (§2.9, §16.6), keeping
them while another plugin uses an identical bundle; extracted files no session has used for the
`cleanupPeriodDays` period are cleaned up on their own (§12). <!-- req: cli.plugin.What an uninstall deletes and keeps -->

## 17.6 `plugin enable` and `plugin disable`

`claude plugin enable <plugin> [options]` turns on an installed, disabled plugin;
`claude plugin disable [plugin] [options]` turns one off without uninstalling it. Both write the
plugin's `enabledPlugins` entry (§12). A plugin synced from claude.ai (§16) is named `<name>@synced`.

| Flag | `enable` | `disable` |
| --- | --- | --- |
| `-s, --scope <scope>` | `user`, `project`, `local`; auto-detected when omitted (§17.3). | The same. <!-- req: cli.plugin.plugin disable.-s, --scope <scope> --> |
| `-a, --all` | — | Disables every enabled plugin. With a plugin name or `--scope` it is a usage error. <!-- req: cli.plugin.plugin disable.-a, --all --> |
| `--json` | The result object (§17.2.2). | The same. <!-- req: cli.plugin.plugin disable.--json --> |

`enable`:

1. Success: `Successfully enabled plugin: <plugin> (scope: <scope>)` (§17.2.1), naming the scope
   used.
2. A plugin already enabled at the resolved scope: `Plugin "<plugin>" is already enabled`, exit `1`;
   with `--json` the result carries `"failureCode": "already_in_goal_state"` and
   `"alreadyInGoalState": true`, so that a script can treat it as success.
3. A plugin that declares dependencies (§16) enables them too, and the command fails, changing
   nothing, when a dependency is not installed (printing the `claude plugin install` command for
   each missing one), when the organisation's plugin policy blocks one (naming it), or when one is
   set to `false` at a scope that takes precedence over the target scope. <!-- req: cli.plugin.plugin enable -->

`disable`:

1. Success: `Successfully disabled plugin: <plugin> (scope: <scope>)` (§17.2.1).
2. Neither a name nor `--all`: a usage error (§17.2.3), with the reason `Please specify a plugin
   name or use --all to disable all plugins` on stderr, exit `1`, and no result line even with
   `--json` (Judgment J17.3).
3. Already disabled: `Plugin "<plugin>" is already disabled`, exit `1`, with the `--json` fields of
   enable's rule 2.
4. The command fails, changing nothing, when another enabled plugin depends on the plugin (naming
   the dependents to disable first), or when the organisation requires it as a synced plugin
   (§17.18.10). <!-- req: cli.plugin.plugin disable -->

`--all` disables each enabled plugin at the scope whose value is in effect, skips managed and
organisation-required plugins, and prints `Successfully disabled <N> plugins`, or
`No enabled plugins to disable` with exit `0` when there are none (Judgment J17.6).

## 17.7 `plugin update`

`claude plugin update <plugin> [options]` updates a plugin to the newest version its marketplace
offers (§16). The new version loads in the next session, or after `/reload-plugins`. Flags:
`-s, --scope <scope>` (also `managed`; §17.3), `-y, --yes` and `--accept-command <sha256>` (as for
`install`, §17.4.2–17.4.3: they accept a **changed** install command of a command-source plugin, or
a `headersHelper`; without a terminal one of them is required), and `--json`.

An update also installs a declared dependency the plugin is missing, unless
`CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` is set; the dependencies left unmet are then listed after
`still unresolved:` (§16.24.1, §16.30).

Output: `Checking for updates for plugin "<plugin>"…`, then the result. When nothing is newer,
`<name> is already at the latest version (<version>).` and exit `0`, unless the dependency retry of
§17.7.3 runs and fails. Judgment J17.27 fixes the success line.

### 17.7.1 Which scope

§17.3 rule 3. A `--scope` at which the plugin is not installed fails with
`Plugin "<name>" is not installed at scope <scope>`.

### 17.7.2 A bare name

A bare `<plugin>` is matched against the installed plugins. When installed plugins of different
marketplaces share the name, the client MUST refuse the update and list a
`claude plugin update <name>@<marketplace>` command for each. <!-- req: cli.plugin.Update by bare name -->

### 17.7.3 Retrying an unfinished dependency install

When the plugin is already at its newest version, `update` MUST also retry an unfinished install of
the packages the plugin's cached copy declares (§16), in the cases §16 states. If that retry fails,
the command prints `Failed to update plugin "<plugin>"` with the reason and exits `1`. <!-- req: cli.plugin.Retry an unfinished dependency install -->

## 17.8 `plugin list`

`claude plugin list [options]` lists the installed plugins with their version, scope and status.
<!-- req: cli.plugin.plugin list -->

| Flag | Meaning |
| --- | --- |
| `--json` | Prints the list as JSON (§17.8.2). <!-- req: cli.plugin.plugin list.--json --> |
| `--available` | With `--json`, also lists the plugins the user's marketplaces offer and that are not installed (§17.8.3). Without `--json` it has no effect. <!-- req: cli.plugin.plugin list.--available --> |
| `--data-size [plugin]` | With `--json`, measures the saved data directory of each installed plugin, or only of the named one (`name@marketplace`), into `dataDirSize` / `dataDirUnreadable`. A named plugin with no install record prints `--data-size names a plugin that is not installed` and exits `1` without the list. Without `--json` it has no effect. <!-- req: cli.plugin.plugin list.--data-size [plugin] --> |

### 17.8.1 Text output

The text output MUST group plugins under these headings, in this order, omitting an empty group:

1. `Installed plugins:` — installed from a marketplace;
2. `Session-only plugins (--plugin-dir / --plugin-url):` — loaded by those flags given before the
   subcommand in the same command, as in `claude --plugin-dir ./my-plugin plugin list`;
3. `Skills-directory plugins (.claude/skills/*):` — found in a skills directory (§1, §4);
4. `Synced from claude.ai` — synced from the user's claude.ai account (§16).

With nothing in any group the output is
``No plugins installed. Use `claude plugin install` to install a plugin.``, exit `0`. Each entry
SHOULD show the id, the version, the scope or path, and the status, with each load error and note
(Judgment J17.9).

### 17.8.2 JSON output

`--json` prints an array with one object per installation. `id`, `version`, `scope`, `enabled` and
`installPath` are always present (except as `installPath` says); every other field is present only
when it applies.

| Field | Type | Value |
| --- | --- | --- |
| `id` | string | `name@marketplace` for an install, `name@inline` for a session-only plugin, `name@skills-dir` for a skills-directory plugin, `name@synced` for a synced one. <!-- req: cli.plugin.JSON output.id --> |
| `version` | string | For a marketplace install, the version the client computed at install (§16); otherwise the manifest's `version`, or `unknown` when it declares none. <!-- req: cli.plugin.JSON output.version --> |
| `scope` | string | `user`, `project`, `local` or `managed` for an install; `user` or `project` for a skills-directory plugin; `session` for a session-only plugin; `synced` for a synced one. <!-- req: cli.plugin.JSON output.scope --> |
| `enabled` | boolean | Whether the merged settings enable the plugin (§12). <!-- req: cli.plugin.JSON output.enabled --> |
| `installPath` | string | The directory the plugin loads from. Absent for a plugin that sessions load in place from its marketplace's folder (§16), which carries `readFromFolder` instead. <!-- req: cli.plugin.JSON output.installPath --> |
| `readFromFolder` | string | For a plugin loaded in place, its source directory inside the marketplace's folder. <!-- req: cli.plugin.JSON output.readFromFolder --> |
| `folderVersion` | string | With `readFromFolder`: the `version` the client loaded from that folder, which can differ from `version`. Absent when the plugin did not load or declares no version. <!-- req: cli.plugin.JSON output.folderVersion --> |
| `installedAt` | string | ISO 8601 timestamp of the install. Marketplace installs only. <!-- req: cli.plugin.JSON output.installedAt --> |
| `lastUpdated` | string | ISO 8601 timestamp of the last update. Marketplace installs only. <!-- req: cli.plugin.JSON output.lastUpdated --> |
| `projectPath` | string | The project the install belongs to; `project` and `local` scope only. <!-- req: cli.plugin.JSON output.projectPath --> |
| `mcpServers` | object | The plugin's MCP server definitions, for a marketplace-installed plugin that has any (§8). <!-- req: cli.plugin.JSON output.mcpServers --> |
| `errors` | string[] | The load errors, when the plugin failed to load. <!-- req: cli.plugin.JSON output.errors --> |
| `notes` | string[] | Warnings that are not load errors: authoring issues, packages that are not installed (§16). <!-- req: cli.plugin.JSON output.notes --> |
| `errorDetails` | object[] | One object per `errors` entry, in the same order: its diagnostic `type` and the names it refers to (plugin, marketplace, server, file). <!-- req: cli.plugin.JSON output.errorDetails --> |
| `noteDetails` | object[] | The same, one per `notes` entry. <!-- req: cli.plugin.JSON output.noteDetails --> |
| `hasUserConfig` | boolean | Present and `true` when the plugin loaded and its manifest declares `userConfig` options; absent for a plugin that failed to load, whatever its manifest says. Saved values are never listed. <!-- req: cli.plugin.JSON output.hasUserConfig --> |
| `projectEnabled` | boolean | Whether the project's shared `.claude/settings.json` turns the plugin on. Marketplace installs only. <!-- req: cli.plugin.JSON output.projectEnabled --> |
| `dataDirSize` | object | With `--data-size`: `{ "bytes": <number>, "human": <string> }`, the size of the saved data directory; absent when it is missing or empty. Marketplace installs only. Judgment J17.10 fixes `human`. <!-- req: cli.plugin.JSON output.dataDirSize --> |
| `dataDirUnreadable` | boolean | With `--data-size`: `true` when the data directory exists but could not be measured. Marketplace installs only. <!-- req: cli.plugin.JSON output.dataDirUnreadable --> |

### 17.8.3 Available plugins

With `--json --available` the output is one object instead of an array: `installed` holds the array
of §17.8.2 and `available` one object per marketplace plugin that is not installed:

| Field | Type | Value |
| --- | --- | --- |
| `pluginId` | string | `name@marketplace`. <!-- req: cli.plugin.JSON output.pluginId --> |
| `name` | string | The plugin's name in the marketplace. <!-- req: cli.plugin.JSON output.name --> |
| `marketplaceName` | string | The marketplace that offers it. <!-- req: cli.plugin.JSON output.marketplaceName --> |
| `source` | string or object | The entry's `source` (§15): a string for a relative path, an object otherwise. <!-- req: cli.plugin.JSON output.source --> |
| `description` | string | The entry's description, when it has one. <!-- req: cli.plugin.JSON output.description --> |
| `version` | string | The entry's version, when it declares one. |
| `installCount` | number | The install count, when the client has one. <!-- req: cli.plugin.JSON output.installCount --> |

## 17.9 `plugin details`

`claude plugin details <name>` shows a loaded plugin's components and what it costs in context. The
plugin MUST be loaded: installed, found in a skills directory, or passed with `--plugin-dir` or
`--plugin-url` before the subcommand. `<name>` is a `name` or `name@marketplace`. The command takes
no flag beyond `--help`.

The output gives the plugin's name, version, description and source, then three sections, under
these headings:

1. `Component inventory`: the plugin's skills, agents, hooks, MCP servers and LSP servers, each
   kind with its count and names. <!-- req: cli.plugin.plugin details.Component inventory -->
2. `Projected token cost`: the always-on tokens the plugin adds to every session — what its skill,
   command and agent listings and other always-loaded text cost (§4, §5). <!-- req: cli.plugin.plugin details.Projected token cost -->
3. `Per-component (rounded)`: for each skill, agent and command, the always-on estimate and the
   on-invoke estimate (what the body costs each time it fires), rounded. Omitted when the plugin has
   none of them. <!-- req: cli.plugin.plugin details.Per-component (rounded) -->

The estimates are the client's own (Judgment J17.11). A plugin that is not loaded prints
``Plugin "<name>" not found. Run `claude plugin list` to see installed plugins, or pass --plugin-dir <path> to load one from disk.``
and exits `1`; for an id ending in `@builtin` the message is
``Plugin "<name>@builtin" not found. Built-in plugins don't appear in `claude plugin list`. To see the ones available in a session, run /plugin in Claude Code and open the Installed tab.``

## 17.10 `plugin configure`

`claude plugin configure <plugin>` shows an installed plugin's `userConfig` options (§3.4) and which
are set, or saves values read from stdin.

1. `<plugin>` MUST be the full `name@marketplace` id as `plugin list` shows it; a bare name is not
   accepted. When no loaded plugin has the id: `No installed plugin has the id "<plugin>".`, exit `1`.
2. Without flags, the command lists each option with up to three labels, in this order:
   `required` or `optional`; `sensitive` when the manifest declares it so; `set` or `not set`. It
   prints no saved value.
3. `--json` prints one object on stdout. Without `--values-stdin` it carries the options' `schema`
   and `choices`, their starting `inputs`, and the `configured` and `unconfigured` option names; it
   includes the saved value of an option that is not sensitive and never the text of a sensitive one.
4. `--values-stdin` reads a JSON object mapping option keys to single-line string values. Each value
   MUST be checked against the option's declared type (§3.4). When every value passes, the client
   saves them, leaves the options not named with their saved values, and prints
   `Configuration saved. Restart Claude Code to apply it.` A key the manifest does not declare, or a
   value that fails, MUST save nothing, print `Failed to save configuration:` with the reason, and
   exit `1`; with `--json` the refusal also prints an object whose `refused` field carries the
   `message` and, when one option is at fault, its `option` key. With `--json` a save prints the
   `saved` option names and, when they could be read back, the `unconfigured` ones.
5. A bundled MCP server's own settings are not configured here (`install --config`, §17.4, or the
   session's configuration dialog).

Judgment J17.12 fixes the listing's line form. <!-- req: cli.plugin.plugin configure -->

### 17.10.1 `plugin restore-set-aside`

When the organisation's managed settings replace a marketplace the user added with one of the same
name from another source (§14, §15), the client sets aside the `userConfig` options and secrets
(§3.4) saved under the ids of that marketplace, so that a plugin of the replacement marketplace does
not read them, and `claude plugin list` (text) prints a note naming each id. `claude plugin
restore-set-aside <plugin>@<marketplace> [--discard]` (2.1.321 or later) acts on them:

1. Without `--discard`, it restores them, so any plugin installed under that id reads them,
   including one from the replacement marketplace. When the id already holds a value for an option,
   restoring MAY keep that value and drop the set-aside one.
2. With `--discard`, it deletes them.
3. Without either, they stay set aside.
4. `<plugin>` MUST be the full `name@marketplace` id as the note gives it. An id with nothing set
   aside — a bare `name` always — prints `No options or secrets are set aside for <plugin>.` and
   changes nothing; Claude Code 2.1.330 exits `0` then (Judgment J17.34).
5. The command has no session form and takes no `--json`.

<!-- req: cli.plugin.plugin restore-set-aside -->

## 17.11 `plugin prune`

`claude plugin prune [options]` removes auto-installed dependencies (§16) that no installed plugin
needs any more. It MUST NOT remove a plugin the user installed directly.

| Flag | Meaning |
| --- | --- |
| `-s, --scope <scope>` | `user`, `project` or `local`; default `user`. <!-- req: cli.plugin.plugin prune.-s, --scope <scope> --> |
| `--dry-run` | Lists what would be removed, ending with `(dry run — nothing removed)`, and removes nothing. <!-- req: cli.plugin.plugin prune.--dry-run --> |
| `-y, --yes` | Removes without the confirmation prompt; without a terminal on stdin or stdout, nothing is removed without it. <!-- req: cli.plugin.plugin prune.-y, --yes --> |

With none to remove the command prints a line starting `Nothing to prune`. Otherwise:

| Terminal and flags | What happens |
| --- | --- |
| Interactive terminal, no `-y` | Lists the orphaned dependencies and asks `Remove? [y/N]`; removes them on `y`. |
| Any terminal, `-y` | Removes them and prints `Removed <N> auto-installed plugins: <names>`. <!-- req: cli.plugin.plugin prune.-y --> |
| stdin or stdout not a terminal, no `-y` | Prints the list and ``Not a TTY — run `claude plugin prune -y` to remove.``, removing nothing. |

The exit code is `0` whatever the answer at the prompt (Judgment J17.7).

## 17.12 `plugin tag`

`claude plugin tag [path] [options]` creates an annotated git tag `<name>--v<version>` for a plugin
release. `[path]` is the plugin directory, default the current directory. Before tagging, the client
MUST check that the plugin's `plugin.json` and the marketplace entry that lists it agree on the
version; it finds that entry by walking up from the directory to the first
`.claude-plugin/marketplace.json` that lists the plugin. A plugin no marketplace lists is tagged from
`plugin.json` alone.

The client MUST exit `1` without tagging, printing the reason, when the plugin fails validation
(§17.13), when neither `plugin.json` nor the entry has a `version`, when the two disagree, when the
tag already exists, or when the working tree under the plugin directory is dirty
(`plugins/dependencies.md`, "Create a release tag"). Without `--dry-run` it prints `Created tag <name>--v<version>`, then `Pushed to <remote>`
or the push command to run. When the push fails the tag stays created locally and the command exits
`1`. <!-- req: cli.plugin.plugin tag -->

| Flag | Meaning |
| --- | --- |
| `--dry-run` | Prints the plan and creates nothing: the plugin name; the version and the file it came from; the matching marketplace entry, when there is one; the tag name; the `git tag` and `git push` commands it would run. <!-- req: cli.plugin.plugin tag.--dry-run --> |
| `--push` | Pushes the tag to `--remote` after creating it. <!-- req: cli.plugin.plugin tag.--push --> |
| `--remote <name>` | The remote `--push` pushes to; default `origin`. <!-- req: cli.plugin.plugin tag.--remote <name> --> |
| `-f, --force` | Skips the dirty-working-tree and tag-already-exists checks. The version-agreement check still runs. <!-- req: cli.plugin.plugin tag.-f, --force --> |
| `-m, --message <msg>` | The annotation message; `%s` in it stands for the version. Default `<name> <version>`. <!-- req: cli.plugin.plugin tag.-m, --message <msg> --> |

The client runs git with argument vectors, not through a shell (Judgment J17.22).

## 17.13 `plugin validate`

`claude plugin validate <path> [options]` checks a plugin manifest, a marketplace manifest, or the
skills, agents and commands of a directory, and exits with a code a CI job can act on. §2.11 states
the manifest verdicts and §2.6–§2.10 what each manifest field must satisfy; §15 states the
marketplace manifest's. A validator MUST reach the verdict Claude Code reaches on the same input,
and report each problem the client would meet loading it.

| Flag | Meaning |
| --- | --- |
| `--strict` | Warnings count as errors: unknown fields and missing metadata that the runtime tolerates fail the run. |
| `--json` | The report as one JSON object on stdout, with the same exit codes (§17.13.4). |

### 17.13.1 What a directory validates

Given a directory, the validator chooses by what it finds:

1. `.claude-plugin/marketplace.json` when it exists: the marketplace. When the directory also holds
   `.claude-plugin/plugin.json`, the validator MUST also validate that plugin's manifest and
   component files. <!-- req: cli.plugin.Validate a directory..claude-plugin/marketplace.json -->
2. Otherwise `.claude-plugin/plugin.json`: the plugin, its manifest and its component files.
3. Otherwise the component files, chosen by the directory's name:
   - a directory named `skills`, `agents` or `commands`: the files in it;
   - a directory named `.claude`: its `skills`, `agents` and `commands` directories;
   - any other directory: the `skills`, `agents` and `commands` directories under its `.claude`,
     and a `skills/<name>/SKILL.md` tree at its root. The documentation names only the `.claude`
     directories here; reading the root skills tree follows Claude Code's behaviour (Judgment
     J17.14, E4a). <!-- deviates: cli.plugin.Validate a directory -->
4. A directory with none of these is an error:
   `No manifest found in directory. Expected .claude-plugin/marketplace.json or .claude-plugin/plugin.json`.

The validator MUST NOT follow a symbolic link inside the directory it is given:

- a `skills`, `agents` or `commands` directory under the plugin or `.claude` root that is a link is a
  **warning** saying nothing in it was read;
- a link inside such a directory is skipped, with one warning per directory counting the skipped
  entries that a session would load;
- the `skills`, `agents` or `commands` directory named on the command line, or its parent `.claude`,
  being a link is an **error**, and nothing in it is checked; the user names the real directory.

A component file that is not a regular file is not read either: a link, a FIFO or a directory where
a skill's `SKILL.md` belongs is counted in the same per-directory warning. The validator also reads
the hooks file and each MCP server file without following a link and up to 1,048,576 bytes
(1 MiB), and warns, checking nothing in it, about a `hooks` directory that is a link (a symbolic
link or a Windows junction), a hooks or MCP server file that is a link, a FIFO or a directory, and
one past that size. The client's loader has neither limit, so these warnings never change what a
session loads. Each message below is a **warning** under the key `directory`, reported on the
component directory, the hooks file or the MCP server file it is about, with `<n>` the count;
"plugin" messages are those of a plugin run, "`.claude`" messages those of a run on a `.claude`
directory or a directory holding one (Judgment J17.32):

| Case | Message |
| --- | --- |
| Linked component directory, plugin | `This directory is a symlink, so the validator read nothing in it. An installed plugin loads it only if it points inside the plugin's installed folder, or, for a plugin read in place from a local marketplace folder, inside that folder; a project's .claude/skills plugin, only if it points inside the folder holding that .claude. Otherwise replace the link with a copy of the folder. To check its files, validate the folder it points to.` |
| Linked component directory, `.claude` | `This directory is a symlink and nothing in it was read — component directories are read without following symlinks. A session loading this project does follow it, so validate the real directory separately.` |
| Linked `.claude` under the directory named | `This directory is a link (a symlink or a Windows junction) and nothing in it was read — .claude is read without following links. A session loading this project does follow it, so validate the real directory separately.` |
| Linked entries, plugin | `<n> entries here are symlinks and were not read — components are read without following symlinks.` (one: `1 entry here is a symlink and was not read — …`), then `A session started with --plugin-dir on this plugin follows a symlink here. An installed plugin follows one only if it points inside the plugin's installed folder, or, for a plugin read in place from a local marketplace folder, inside that folder; a project's .claude/skills plugin, only if it points inside the folder holding that .claude. To check what a symlink points to, validate that path.` |
| Linked entries, `.claude` | The same opening, then `A session loading this directory does follow them, so validate the real paths separately.` |
| Component files that are not regular files, plugin | `<n> components here were not read — the path is not a regular file (a symlink, a FIFO, a directory). A FIFO or a directory is never read.` (one: `1 component here was not read — …`), then the plugin ending of the linked-entries row |
| Component files that are not regular files, `.claude` | `<n> components here were not read — the path is not a regular file (a symlink, a FIFO, a directory).` (one: `1 component here was not read — …`), then the `.claude` ending of the linked-entries row |
| Linked `hooks` directory | `The hooks directory is a link (a symlink or a Windows junction) and was not read — hooks are read without following symlinks and are capped at 1048576 bytes. The plugin loader has neither limit and fails the whole plugin on bad hook config, so validate the real file separately.` |
| Hooks file not a regular file, or too large | `hooks.json is not a regular file (a symlink, a FIFO, a directory)`, or `hooks.json is past the size cap and was not read`, then ` — hooks are read without following symlinks and are capped at 1048576 bytes. The plugin loader has neither limit and fails the whole plugin on bad hook config, so validate the real file separately.` |
| MCP server file not a regular file, or too large | `The file is not a regular file (a symlink, a FIFO, a directory) and was not read`, or `The file is past the size cap and was not read`, then ` — MCP server files are read without following symlinks and are capped at 1048576 bytes. The plugin loader has neither limit, so validate the real file separately.` |

The two **errors** for a link named on the command line are `This path is a link (a symlink or a
Windows junction). Component directories are read without following links, so nothing here was
validated. Pass the real directory instead.` for the `skills`, `agents` or `commands` directory
itself, and `The enclosing .claude directory is a link (a symlink or a Windows junction). Component
directories are read without following links, so nothing here was validated. Pass the real
directory instead.` for its parent `.claude`, both under the key `directory` (Judgment J17.32).

A plugin run reads each skill, agent and command file, the hooks files (`hooks/hooks.json` and each
path `hooks` names), and the MCP server files (§17.13.3). A marketplace run also reads the hooks
files of the plugins it lists by relative path (`Validating hooks: <path>`), reporting them as a
plugin run does. It does not read:

- a `SKILL.md` at the plugin root (that file is a skill to a session, §4, but not to the validator); <!-- req: cli.plugin.Validate a directory.A SKILL.md at the plugin root -->
- a `CLAUDE.md` at the plugin root as context: it reports it as a warning,
  `CLAUDE.md at the plugin root is not loaded as project context. To ship context with your plugin, use a skill (skills/<name>/SKILL.md) instead.`; <!-- req: cli.plugin.Validate a directory.A CLAUDE.md at the plugin root -->
- in a marketplace run, the skill, agent and command files, or bundled MCP server files, of the
  plugins the marketplace lists in other directories. It reads their entries, the `plugin.json` a
  relative entry points at and its hooks files, but finding errors in their other files needs a run
  on each plugin directory (Judgment J17.35). <!-- req: cli.plugin.Validate a directory.Plugin files in a marketplace run -->


### 17.13.2 A manifest file

`<path>` may also name a file. A file named `plugin.json` is validated as a plugin manifest, one
named `marketplace.json` as a marketplace, and any other file inside a `.claude-plugin` directory as
a plugin manifest. Any other file is classified by its fields: it is a marketplace when `plugins` is
an array, when `plugins` and `owner` are both present, or when it has a field only `marketplace.json`
defines (such as `owner`) and none only `plugin.json` defines (such as `author`); otherwise it is a
plugin manifest. Judgment J17.16 lists the two field sets. <!-- req: cli.plugin.Validate a manifest file -->

### 17.13.3 What a plugin run checks

Besides the manifest rules of §2, the validator checks every MCP server entry the plugin declares:
in `.mcp.json`, in a `.json` file `mcpServers` names, or inline in `plugin.json` (§2.9, §8).

- **Errors**: an entry the client would drop when it loads the plugin; a `${user_config.KEY}`
  reference to an option the manifest does not declare; a remote `url` that is not a valid absolute
  URL. <!-- req: cli.rule.Validate the manifest.Errors -->
- **Warnings**: an `http://` or `ws://` URL to a host that is not loopback; a header value that
  looks like a literal credential. <!-- req: cli.rule.Validate the manifest.Warnings -->

It reports each skill, agent and command file without a frontmatter block as the warning
`No frontmatter block found`, and frontmatter that is not valid YAML as an error (§2.11, §4, §5).

### 17.13.4 Verdict, output and exit codes

The text output names each file validated (`Validating plugin manifest: <path>`,
`Validating marketplace manifest: <path>`, `Validating components in: <path>`, and one line per
component file), its errors and warnings each with its path, and ends with one verdict line. The
verdict and the exit code MUST agree:

| Exit | Verdict line | When |
| --- | --- | --- |
| `0` | `Validation passed` | No error and no warning: the manifest loads. <!-- req: cli.rule.Validate the manifest.Validation passed --> |
| `0` | `Validation passed with warnings` | Warnings and no error, without `--strict`: the manifest loads, with something to fix — an unknown top-level field the client strips, a `name` that is not kebab-case, a missing `version`, `description` or `author`. <!-- req: cli.rule.Validate the manifest.Validation passed with warnings --> |
| `1` | `Validation failed` | Any error: a type mismatch, a path that is missing or escapes the plugin root, an unknown key in a `userConfig` option, a `channels` entry, an `lspServers` configuration or a `monitors` entry. The client reports the same problem when it loads the plugin. <!-- req: cli.rule.Validate the manifest.Validation failed --> |
| `1` | `Validation failed (--strict treats warnings as errors)` | Warnings and no error, with `--strict`. <!-- req: cli.plugin.Output and exit codes.1 --> |
| `2` | `Unexpected error during validation: <reason>` | The validator itself failed, such as on a path it cannot stat. <!-- req: cli.plugin.Output and exit codes.2 --> |

Exit `0` means the manifest loads; with `--strict`, also that there is no warning. <!-- req: cli.plugin.Output and exit codes.0 -->
Advice (§17.13.5) never changes the verdict or the exit code, with or without `--strict`. A path
that does not exist is a failure (`File not found: <path>`, exit `1`), not an unexpected error
(Judgment J17.13).

With `--json`, stdout is one JSON object with these top-level fields:

| Field | Value |
| --- | --- |
| `success` | Boolean; the verdict the exit code gives: `true` exactly on exit `0`. <!-- req: cli.plugin.Output and exit codes.success --> |
| `strict` | Boolean; whether the run treated warnings as errors. <!-- req: cli.plugin.Output and exit codes.strict --> |
| `target` | The resolved path validated: the manifest file for a manifest run, the directory for a component run. <!-- req: cli.plugin.Output and exit codes.target --> |
| `manifest` | The manifest's own result, or `null` for a run without a manifest. For a directory with both manifests it is the `marketplace.json` result. <!-- req: cli.plugin.Output and exit codes.manifest --> |
| `contents` | One result per other file that has an error, a warning or a note, and none for a file with nothing to report, so `contents` is `[]` when nothing is wrong. For a directory with both manifests, the `plugin.json` result is here. Each result names its `file` and carries `errors`, `warnings` and `notes` arrays, and `gatingHooks`: for each mod hook that can refuse an action (such as `tool.call`, §10), an item with `module`, `pattern`, `hook` and `hasCatch`, the last saying whether the hook has a `.catch` handler. Judgment J17.15 fixes the shape of each entry: `errors` and `warnings` items are objects, `notes` items are plain strings, and `gatingHooks` items are the four-field objects. <!-- req: cli.plugin.Output and exit codes.contents --> |
| `advice` | The run's advice (§17.13.5), each entry with `file` (the README), `message` and `installLine`; `[]` when there is none. <!-- req: cli.plugin.Output and exit codes.advice --> |
| `provides` | The plugin's components by kind, or `null` when the run cannot list them (a marketplace run, for one). Claude Code 2.1.330 gives an object of arrays under `modules`, `hooks`, `mcpServers`, `lspServers`, `monitors`, `skills`, `commands`, `agents`, `outputStyles`, `themes`, `workflows` and `bin`, each naming its components as a session would (`"<plugin>:<skill>"`). <!-- req: cli.plugin.Output and exit codes.provides --> |
| `hosts` | The hosts the plugin can reach, or `null` when the run cannot list them: `named`, the hosts it names, each with its `sources` (such as `{ "type": "declared" }` for one in the manifest's `network.hosts`, §2.4), `unread`, the parts of the plugin that could reach other hosts but were not read for them (each with `kind`, `name` and a `reason`, such as `process` for a part that starts a program: a skill, an LSP server), and, in 2.1.330, `declared` (`{ plugin, servers }`, whether the manifest and which servers declare hosts). A plugin can reach hosts not listed. <!-- req: cli.plugin.Output and exit codes.hosts --> |

Each file result in `contents` also carries `modules`, one item per hooks module with fields such
as `hooks` and `uses` (or `null` when it is unknown which code loads), and `wasm`, the WebAssembly
each hooks module compiles (§10; 2.1.326 or later). The text output prints the same lists after the
findings of a plugin run: `Provides:` with one `❯ <kind>: <names>` line per kind that has any,
then `Hosts: <host> (declared), …` when it names any, `Hosts not read for: <kind> (<n>), …` when
any part was not read (a valid LSP server alone gives `Hosts not read for: lspServers (1)`) and,
when the manifest declares no `network.hosts`, `Hosts not declared: list what these parts reach under
"network.hosts" in plugin.json` (Judgment J17.36). None of these lines is a finding.

On exit `2` the client MUST write nothing to stdout, even with `--json`, and write the message to
stderr.

### 17.13.5 Advice on the README

Advice is neither an error nor a warning. A plugin's README that has no line installing the plugin
from a marketplace gets an `Advice` block giving a line to add:

```text
ℹ Advice (does not change the verdict):

  ❯ /path/to/acme-tools/plugins/deploy-helper/README.md: This README has no line that installs "deploy-helper" from a marketplace. Add the install line, which works in one step on Claude Code 2.1.275 or later.
      /plugin install deploy-helper --marketplace acme/tools
```

1. A line already counts when `plugin install`, or `plugin i`, in the `/plugin` or `claude plugin`
   spelling, is followed on the same line by `<plugin>@<marketplace>`, or by the plugin's name and
   `--marketplace <source>`.
2. In a run on a marketplace directory, the client fills the source from the `origin` remote of the
   `.git` directory at the top of that directory (Judgment J17.17). When it cannot, and in a run on a
   plugin directory whose marketplace lists it from elsewhere, the line holds the placeholder
   `<owner>/<repo>`; a line pasted with the placeholder unchanged does not count, so the advice
   stays.
3. The verdict line and exit code are those the run would have without the advice.

<!-- req: cli.plugin.Advice on the README -->

## 17.14 `plugin marketplace`

`claude plugin marketplace <subcommand>` adds, lists, refreshes and removes the marketplaces plugins
are installed from (§15). These subcommands follow §17.1.1; their `--scope` has no `-s`.

### 17.14.1 `marketplace add`

`claude plugin marketplace add <source> [options]` fetches a marketplace and declares it in a
settings file (§15). After adding it, the client installs any dependencies (§16) that installed
plugins were missing (`plugins/dependencies.md`, "When a dependency installs automatically";
§16.24.1). <!-- req: cli.plugin.plugin marketplace add -->

| Flag | Meaning |
| --- | --- |
| `--scope <scope>` | The settings file to declare it in: `user`, `project` or `local`; default `user`. <!-- req: cli.plugin.plugin marketplace add.--scope <scope> --> |
| `--sparse <paths...>` | Limits the git checkout to these directories (sparse checkout), for monorepos. `github` and `git` sources only; on another source it is a usage error. <!-- req: cli.plugin.plugin marketplace add.--sparse <paths...> --> |
| `--claudeai` | Reads the argument as the name of a marketplace that claude.ai hosts for the user, as `marketplace list` prints it under `From claude.ai:`, not as a source. The marketplace is hosted for the account and declared in no settings file, so it cannot be shared through a project; `--scope` and `--sparse` with it are usage errors. <!-- req: cli.plugin.plugin marketplace add.--claudeai --> |
| `--json` | The result object (§17.2.2), `command: "marketplace-add"`. No effect with `--claudeai`. <!-- req: cli.plugin.plugin marketplace add.--json --> |

The form of `<source>` decides the source type (§15) and how it is fetched. The rows below are not
an order of precedence: the client tries the forms in the order §15.8.3 states (a local path first,
then an `http(s)` URL, SSH, and GitHub shorthand last; Judgment J15.9).

| Source written | Type | Fetched |
| --- | --- | --- |
| `owner/repo`, `owner/repo#ref`, `owner/repo@ref` | `github` | The GitHub repository is cloned, pinned to `ref` when given. Owner and repo MUST follow GitHub's naming rules. <!-- req: cli.plugin.plugin marketplace add.owner/repo --> |
| `user@host:path[.git][#ref]` | `git` | Cloned over SSH. |
| An `http://` or `https://` URL ending in `.git[#ref]`, or containing `/_git/` | `git` | The URL is cloned (Azure DevOps included). |
| `https://github.com/owner/repo` or `https://gitlab.com/namespace/project`, or the same over `http://` | `git` | Cloned after `.git` is appended. A `gitlab.com` URL with nested subgroups (`https://gitlab.com/group/subgroup/project`) is cloned the same way. <!-- req: cli.plugin.plugin marketplace add.https://github.com/owner/repo --> |
| Any other `http://` or `https://` URL | `url` | Fetched as a `marketplace.json`; a self-hosted git host without `.git` lands here, and appending `.git` clones it instead. <!-- req: cli.plugin.plugin marketplace add.http:// --> |
| `./path`, `../path`, `/path`, `~/path` to a directory (on Windows also `.\`, `..\`, `C:\`) | `directory` | Read in place. <!-- req: cli.plugin.plugin marketplace add../path --> |
| The same path forms to a `.json` file | `file` | Read in place. <!-- req: cli.plugin.plugin marketplace add..json --> |

A host whose clone URLs lack `.git` (such as AWS CodeCommit) is added as a `git` entry in
`extraKnownMarketplaces` (§12, §15), which clones whatever the URL ends in.

Output:

- Success: `Successfully added marketplace: <name> (declared in <scope> settings)`
  (`Added marketplace: …` in a terminal, §17.2.1), `<name>` being the `name` in the marketplace's
  own manifest, not the repository's name.
- A marketplace already on disk: `Marketplace '<name>' already on disk — declared in <scope> settings`,
  exit `0`.
- An unrecognised source: `Invalid marketplace source format. Try: owner/repo, https://..., or ./path`,
  exit `1`, `failureCode: "invalid_source"`. The documentation also names `That isn't a marketplace
  source` for this case; Claude Code 2.1.330's shell command prints the first form (Judgment J17.37).
- A bare host such as `gitlab.example.com/team/plugins` fails as an invalid `owner/repo` shorthand;
  the message tells the user to add `https://` or use a local path.
- A name that impersonates or respells a reserved name is refused (§17.19).
- The argument `anthropic-plugin-directory`, the reserved name of §15, can end with no result line
  even with `--json`; a script checks the exit code, which is `1` (Judgment J17.21).

### 17.14.2 `marketplace list`

`claude plugin marketplace list [options]` lists every marketplace the user added, with its source.
The text output is `Configured marketplaces:` followed by one entry per marketplace, each with a
`Source:` line, or `No marketplaces configured`. When the user's terminal sessions sync plugins from
claude.ai (§16), the text ends with a `From claude.ai:` section naming the marketplaces claude.ai
lists for the account that the user has not added, git-based and hosted alike. Judgment J17.18
fixes the entry layout.

`--json` prints an array, one object per configured marketplace (never the `From claude.ai:`
section). Every field is a string:

| Field | Value |
| --- | --- |
| `name` | The marketplace's name. <!-- req: cli.plugin.plugin marketplace list.name --> |
| `source` | `github`, `git`, `url`, `directory`, `file` or `claudeai`. <!-- req: cli.plugin.plugin marketplace list.source --> |
| `repo` | `owner/repo`; `github` sources only. <!-- req: cli.plugin.plugin marketplace list.repo --> |
| `url` | The clone or fetch URL; `git` and `url` sources only. <!-- req: cli.plugin.plugin marketplace list.url --> |
| `path` | The local path; `directory` and `file` sources only. <!-- req: cli.plugin.plugin marketplace list.path --> |
| `ref` | The pinned branch, tag or full commit SHA (§15); `github` and `git` sources, only when pinned. <!-- req: cli.plugin.plugin marketplace list.ref --> |
| `installLocation` | Where the client cached the marketplace (§15). A claude.ai marketplace has no local copy: it carries `marketplaceId` and `organizationUuid` in its place, `scope` when one is recorded, and `status`. <!-- req: cli.plugin.plugin marketplace list.installLocation --> |

### 17.14.3 `marketplace remove`

`claude plugin marketplace remove <name> [options]` removes a marketplace's declaration. `<name>` is
the name `marketplace list` shows, not the source given to `add`.

1. `--scope <scope>` removes the declaration from that one settings scope; without it the client
   removes it from every scope. A scope that does not declare it fails with
   `Marketplace '<name>' is not declared in <scope> settings. Omit --scope to remove it from all scopes.`
2. Removing it from the **last** scope that declares it MUST also delete its cache, uninstall every
   plugin installed from it, and delete their saved options, secrets and data where it can (§3.4,
   §16).
3. Output: `Successfully removed marketplace: <name>` (`Removed marketplace: <name>` in a terminal,
   §17.2.1); when plugins were uninstalled, a line such as
   `Also uninstalled 2 plugins from this marketplace:` and their ids follow.
4. `--json`: the result object, `command: "marketplace-remove"`.

<!-- req: cli.plugin.plugin marketplace remove -->

### 17.14.4 `marketplace update`

`claude plugin marketplace update [name] [options]` refreshes one marketplace, or every one when the
name is omitted, from its source (§15). A marketplace added with a branch or tag `ref` updates to the
newest commit of that ref, not of the default branch. Output:
`Successfully updated marketplace: <name>`, or for all of them a count,
`Successfully updated <N> marketplaces` (`Updated marketplace: <name>` and `Updated <N> marketplaces`
in a terminal, §17.2.1). A marketplace pinned to a commit SHA stays on that commit. `--json` gives the result object,
`command: "marketplace-update"`; without a name, `--json` is refused with exit `1` (Judgment J17.20).
<!-- req: cli.plugin.plugin marketplace update -->

## 17.15 Session flags that touch plugins

These flags of `claude` change what a session loads. Each states the plugin-relevant behaviour; the
chapter named holds the rest.

### 17.15.1 Loading a plugin for one session

| Flag | Behaviour |
| --- | --- |
| `--plugin-dir <path>` | Loads a plugin for this session only, from a directory or a `.zip` archive of one. A folder of plugins loads each direct child folder that has a `.claude-plugin/plugin.json` and a name not starting with `.` (§16.8 item 4 says which folders are). Each flag takes exactly one path, never split; the flag is repeatable. A marketplace root is such a folder: `marketplace.json` is not read, so a plugin under its `plugins/` folder does not load, and no error is reported (§2.12). <!-- req: cli.flag.--plugin-dir --> |
| `--plugin-url <url>` | Fetches a plugin `.zip` archive from a URL for this session only. Repeatable, and one value may hold several URLs separated by spaces. <!-- req: cli.flag.--plugin-url --> |

1. A plugin either flag loads is **session-only**: id `<name>@inline`, `--json` scope `session`.
   `claude plugin list` shows it only when the same flag precedes the subcommand
   (`claude --plugin-dir ./my-plugin plugin list`), under the heading starting `Session-only plugins`.
2. A session-only plugin that shares its name with an installed plugin loads instead of it for the
   session. The installed copy loads instead when the user disabled the session-only copy
   (`claude plugin disable <name>@inline`) or when managed settings lock that plugin name (§14, §16).
3. When managed `disableSideloadFlags` is set (§14), the client MUST reject both flags, and the
   folders named in `CLAUDE_CODE_PLUGIN_DIRS` (§3), printing that the flag is disabled by the
   organisation's managed settings and exiting `1` without starting (Judgment J17.23).
4. The Agent SDK's `plugins` option is the equivalent of `--plugin-dir`.
5. A session resumed with `--resume` or `--continue` MUST NOT restore the `--plugin-dir`,
   `--settings` or `--mcp-config` values of its original launch: the plugins they loaded are absent
   from the resumed session unless the flags are passed again. The settings files themselves are
   re-read at launch, so plugins enabled there load as usual. <!-- docs: sessions.md | What a resumed session restores -->
6. Backgrounding a session MUST carry its `--plugin-dir`, `--mcp-config`, `--strict-mcp-config`,
   `--settings`, `--setting-sources` and `--add-dir` values into the background session, so a
   plugin loaded by flag stays loaded there. Work that cannot move to the background session stops,
   a plugin's running monitors (§9.2) included, after the user confirms the `Background this
   session?` dialog; a backgrounded subagent that owns a monitor stops with it. The background
   session may start new monitors. Agent view (`claude agents`) applies `--plugin-dir`,
   `--settings` and `--setting-sources` to itself and passes every configuration flag to the
   sessions it dispatches. <!-- docs: agent-view.md | What carries over when you background --> <!-- docs: agent-view.md | Settings, plugins, and MCP servers -->

### 17.15.2 Modes that turn customizations off

| Flag | Behaviour |
| --- | --- |
| `--bare` | Minimal mode, for scripted calls: hooks, skills, custom commands, subagents, installed plugins, MCP servers, auto memory and CLAUDE.md are not discovered. Skills in a directory passed with `--add-dir` still load, and so does a plugin passed with `--plugin-dir` or `--plugin-url`, but hooks still do not run: neither those a `--settings` value declares nor a flag-loaded plugin's `hooks/hooks.json` or `hooks` manifest key (`headless.md`, "Start faster with bare mode"). The built-in tools are limited to Bash, file read and file edit. Sets `CLAUDE_CODE_SIMPLE`. <!-- req: cli.flag.--bare --> |
| `--safe-mode` | Starts with every customization off, to troubleshoot a broken configuration: CLAUDE.md, skills, plugins, hooks, MCP servers, custom commands and agents, output styles, workflows, custom themes, custom keybindings, status line and file-suggestion commands, LSP servers and auto memory do not load. Authentication, model selection, built-in tools and permissions work as usual. Managed settings policy still applies, its hooks, status line and file-suggestion commands included; managed plugins, managed skills, managed CLAUDE.md and policy-configured MCP servers do not load. Sets `CLAUDE_CODE_SAFE_MODE`. `--agents` is ignored (§5.5.1). <!-- req: cli.flag.--safe-mode --> |
| `--disable-slash-commands` | Disables every skill and command for the session, plugin ones included (§4). <!-- req: cli.flag.--disable-slash-commands --> |
| `--restricted` | Restricted mode, for a harness driving `claude` on a shared machine: the built-in tools that run commands or code, and WebFetch, are removed unless named individually in `--tools` (not through `default`); the built-in file tools are confined to the working directories; only managed settings and `--settings` are loaded (§12); `bypassPermissions` is refused (§13); creating cloud sessions is refused. <!-- req: cli.flag.--restricted --> |

What a mode does not name stays loaded (Judgment J17.24).

**Load diagnostics in `-p` stream output.** With `--output-format stream-json`, the `system/init`
event MUST carry `plugins`, the plugins that loaded, each with `name` and `path`, and, when any
plugin failed to load, `plugin_errors`, each entry with `plugin`, `type` and `message`; the key is
omitted when there is no error. A plugin that did not load is absent from `plugins`. The errors
include an unsatisfied dependency version (§16.30) and a `--plugin-dir` value that failed to load,
such as a missing path or an invalid archive, whose entry also carries `path`, the resolved
absolute path (2.1.283 or later), so a CI job can fail on a non-empty array. An entry for a
`--plugin-dir`, SDK, skills-directory or synced copy that a managed `enabledPlugins` entry dropped
(§14.8.2 item 3, §16) also carries `managed_lock`: `plugin_enabled` (that entry's value), `name` as the
entry spells it, and `marketplace` when the entry names one (`SDKSystemMessage` of
`@anthropic-ai/claude-agent-sdk` 0.3.330, `sdk.d.ts`). A reader treats an unknown `type` as a
generic failure. When
`CLAUDE_CODE_SYNC_PLUGIN_INSTALL` is set, marketplace plugins install before the first turn and the
client emits `system/plugin_install` events before `system/init`: `status` `started` and
`completed` bracket the install, `installed` and `failed` report one marketplace each, with `name`
and, on `failed`, `error`; each event carries `uuid` and `session_id`. <!-- docs: headless.md | Fail CI when a plugin or MCP server doesn't load --> <!-- docs: headless.md | Track plugin installs -->

### 17.15.3 Settings, directories, agents, tools and MCP

| Flag | Behaviour |
| --- | --- |
| `--setting-sources <list>` | Comma-separated setting sources to load: `user`, `project`, `local` (§12). Managed settings always load. Sessions started from this one (background sessions, teammates) inherit the list. Plugins enabled in a source not loaded are not enabled by it. <!-- req: cli.flag.--setting-sources --> |
| `--settings <file-or-json>` | A settings file path or an inline JSON string; its keys override the same keys of the settings files for this session, except that most lists merge with theirs, and keys it omits keep their file values (§12). A file MUST be a regular file of at most 2 MiB; §17.20 states the refusals. <!-- req: cli.flag.--settings --> |
| `--add-dir <paths…>` | Adds working directories Claude may read and edit. It grants file access; the client does not discover most `.claude/` configuration from them, but loads their `.claude/skills/` (§4), `.claude/commands/` and `.claude/agents/` (§5), and only the `enabledPlugins` and `extraKnownMarketplaces` keys of their `.claude/settings.json` and `.claude/settings.local.json` (§12; `permissions.md`, "Additional directories grant file access, not configuration"). Each path MUST exist as a directory, or the run is refused; most network paths (`\\server\share`) are not accepted. `permissions.additionalDirectories` persists the file access only: a directory listed there loads none of that configuration (§12, §13). <!-- req: cli.flag.--add-dir --> |
| `--agent <name>` | The agent the main session runs as, overriding the `agent` setting; a plugin agent by its scoped name or an unambiguous bare name (§5). <!-- req: cli.flag.--agent --> |
| `--agents <json>` | Subagents for this session, as a JSON object (with `--print`, also a path to a JSON file); validated at startup, exiting `1` on an invalid value (§5.5.1, §17.22). <!-- req: cli.flag.--agents --> |
| `--tools <list>` | Restricts the **built-in** tools: `""` none, `"default"` the default set, or names such as `"Bash,Edit,Read"`. It does not affect MCP tools, plugin servers included; `--disallowedTools "mcp__*"` denies those (§8, §13). <!-- req: cli.flag.--tools --> |
| `--permission-mode <mode>` | The starting permission mode: `default` (alias `manual`), `acceptEdits`, `plan`, `auto`, `dontAsk` or `bypassPermissions`; it overrides `defaultMode` (§13). A value outside these refuses the run. <!-- req: cli.flag.--permission-mode --> |
| `--mcp-config <files-or-json…>` | Loads MCP servers from JSON files or strings, space-separated. With `-p` the first turn waits for pending servers up to `MCP_TIMEOUT` (default 30 s), except a server with a cached tool list, which connects on first use (§8). In a self-hosted environment that wait is replaced by a shorter one that covers **stdio servers only**: up to 2 seconds, or `CLAUDE_CODE_MCP_STARTUP_WAIT_MS` milliseconds when set, which changes the length and never which servers it covers; HTTP and SSE servers of the file are not waited for and connect in the background (`self-hosted-environments-configuration.md`, "Wait for MCP servers before the first turn"). <!-- req: cli.flag.--mcp-config --> |
| `--strict-mcp-config` | Only the servers of `--mcp-config` are used: the servers configured elsewhere — `.mcp.json`, `~/.claude.json`, a plugin — are skipped (§8). <!-- req: cli.flag.--strict-mcp-config --> |
| `--channels <entries>` | (Research preview) The MCP servers whose channel notifications the session listens for: space-separated `plugin:<name>@<marketplace>` entries (§9). Requires Anthropic authentication through claude.ai or a Console API key. <!-- req: cli.flag.--channels --> |
| `--dangerously-load-development-channels <entries>` | Enables channels not on the approved allowlist, for local development: `plugin:<name>@<marketplace>` and `server:<name>` entries (§9). It asks for confirmation, so it takes effect only in interactive sessions; with `-p` it is ignored. <!-- req: cli.flag.--dangerously-load-development-channels --> |

Judgment J17.23 fixes the refusal messages of these flags that the docs do not quote.

## 17.16 What a client reports for debugging

`debug-your-config.md` names the views a user runs when a plugin, hook, setting or file did not take
effect. An Extended client MUST offer the equivalents:

1. **Resolved settings.** A read-only diagnostic command, `claude doctor`, that prints installation
   and settings diagnostics, invalid settings files included, without starting a session; and, in a
   session, `/status`, which shows the active settings sources and whether managed settings are in
   effect (§12, §14). Settings merge managed first, then local over project over user, with command
   line flags and environment variables as a further override layer. <!-- req: cli.debug.Check resolved settings -->
2. **Hooks.** `/hooks` lists every hook registered in the session, by event, plugin hooks included
   (§7). A hook absent from it was not loaded. A `matcher` that is an array is listed as an invalid
   setting at the start of an interactive session and in `claude doctor`; under `PreToolUse` or
   `PermissionRequest`, none of that file's other hooks load either. A skill's frontmatter hooks
   appear only after the skill is invoked. Edits to a settings file apply to the running session
   after a short file-stability delay, even for a `.claude/` folder created after the session
   started. With `--debug`, the debug log records each hook event, the matchers checked, and each
   hook's exit code and output. <!-- req: cli.debug.Check hooks -->
3. **A clean configuration.** `--safe-mode` (§17.15.2) starts a session with the user's
   customizations off; a problem that disappears there lies in one of them. <!-- req: cli.debug.Test against a clean configuration -->
   Safe mode turns off `CLAUDE.md` at every level, managed included, and still applies managed
   hooks and settings policy. <!-- req: cli.debug.Test against a clean configuration.CLAUDE.md -->
   When the problem persists, `CLAUDE_CONFIG_DIR` set to a new empty directory, with
   `--setting-sources user` and an empty working directory, MUST start a session with none of the
   user's or project's configuration: the client runs its first-run setup again; managed settings
   still apply; claude.ai connectors still load for a claude.ai login.
   - **Problem gone**: the cause is in the user or project configuration; copying `~/.claude.json`
     and the files of `~/.claude` into the new directory one at a time, then starting in the
     project without `--setting-sources user`, finds it. <!-- req: cli.debug.Test against a clean configuration.Problem gone -->
   - **Problem persists**: the cause is outside both, in managed settings (`/status`) or the
     environment. <!-- req: cli.debug.Test against a clean configuration.Problem persists -->

## Design decisions

### Why the JSON result is the last line, not the whole stdout

A command-source install prints the command it is about to run, and that command's own output may
follow, before the client knows the outcome. Putting the result alone on the last line lets a script
parse one line without the client buffering or suppressing what the user must see.

### Why a usage error prints no result line

A usage error happens before the command knows which plugin or marketplace it acts on, so a result
object would carry nothing but the reason. Printing none keeps "a result line means the command ran"
true for scripts.

### Why `-y` is ignored inside a session

A marketplace-declared command runs arbitrary code. Inside a session the model can type `-y`; only a
person at the user's own terminal may accept that command, and a digest accepts only the exact
command, plugin and catalog the person reviewed.

### Why a missing path fails validation instead of exiting `2`

A path that does not exist is a mistake in the input, which the user fixes like any other error; exit
`2` is kept for a validator that could not finish, so a CI job can tell the two apart.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J17.1 | `init`/`new`, `eval`, `eval init` and `test` are outside this specification; a client MAY offer them. `validate --profile` and the "Plugin directory checks" block (and its `directory` key in `--json`) are not part of the documented contract: a client MAY print such checks, but they MUST NOT change the verdict or the exit code. `restore-set-aside`, undocumented in 2.1.321, is documented in 2.1.330 and stated in §17.10.1. | Reference `spec/scope-audit.md`: authoring and eval runners do not load or run a plugin. The 2.1.330 docs name neither `--profile` nor the directory checks. Oracle 2.1.330, 2026-11-23 (`claude plugin validate` on minimal plugins, private config dir): the block follows the findings, headed `Plugin directory checks for <dir>. The plugin directory is the catalog that plugins are submitted to; this is a subset of what it runs.`, with `README_MISSING`, `LICENSE_MISSING` (problems the directory refuses) and `ICON_MISSING` (a warning: the validator looked for `icon` in plugin.json and for `.claude-plugin/icon.png` or `.svg`, `assets/icon.png` or `.svg`), then `These plugin directory checks do not change the result below. To fail on problems the directory refuses a submission for, run this command with --profile directory.`; a directory holding only a skills tree adds `MANIFEST_NOT_FOUND`; the verdict line was unchanged in each run. |
| J17.2 | A success line goes to stdout and a failure line to stderr; with `--json` the object's keys are ordered `command`, `outcome`, the other fields, `failureCode`, `message`. | The docs name no stream and no key order. Reference `src/cli/result.ts`. |
| J17.3 | Usage errors (no result line, reason on stderr, exit `1`): a `--scope` the command does not take (`Invalid scope: <value>. Use one of: <list>`); `--accept-command` with `-y`; `--config` without `=`; `--marketplace` with a qualified plugin; `uninstall --json --prune`; `uninstall --prune` without `-y` and without a terminal; `disable` with neither a name nor `--all` (`Please specify a plugin name or use --all to disable all plugins`); `disable --all` with a name or `--scope`; `marketplace add --claudeai` with `--scope` or `--sparse`; `--sparse` on a source that is not `github` or `git`; `marketplace update --json` without a name. An unlisted word under `plugin` or `plugin marketplace` is an unknown command. | The docs give "an invalid `--scope`" as the example usage error and say which flag pairs cannot combine, but word no reason. Reference `src/cli/scope.ts`, `install-start.ts`, `uninstall-plan.ts`, `disable-plan.ts`, `marketplace-add.ts`, `marketplace-update.ts`, `command-table.ts`. `plugins/cli-reference.md`, "plugin disable", gives the missing-name text and exit `1`; oracle 2.1.325, `claude plugin disable --json` with an empty `CLAUDE_CONFIG_DIR`: that text on stderr, nothing on stdout, exit `1`. |
| J17.4 | `failureCode` values: documented `already_in_goal_state`, `settings_still_on`, `invalid_source`, `install_records_unreadable` (`plugins/troubleshooting.md`, "installed_plugins.json holds a record … that this version of Claude Code cannot read"); fixed here `not_installed`, `ambiguous_plugin`, `wrong_scope`, `not_found`, `invalid_name`, `invalid_config`, `marketplace_blocked`, `dependency_error`, `dependency_not_installed`, `dependency_blocked`, `dependency_disabled_at_higher_scope`, `dependency_install_failed`, `has_dependents`, `required_by_organization`, `invalid_values`, `command_not_accepted` (an `install` or `update` that displayed a marketplace-declared command and did not run it: no terminal and no accepting flag, or a digest that no longer matches; §17.4.2, §17.4.3). | The docs say codes exist "such as `invalid_source`" and name four, one of them on the troubleshooting page. Reference `src/cli/*-plan.ts`, `install-lookup.ts`, `toggle-target.ts`; `command_not_accepted` in `src/cli/install-plan.ts` and `update-plan.ts`, for the one failure §17.4.3 defines that had no code. |
| J17.5 | The bare-name refusal of `update` (several marketplaces' plugins share the name) applies to `install`, `uninstall`, `enable` and `disable` too. | Documented for `update` only; §17.1.1 says the qualified form is needed when names collide. Reference `src/cli/plugin-ref.ts`. |
| J17.6 | `enable`/`disable` with `--scope`: an override is written when the scope outranks every declaring scope; the refusal names the first of local, project, user that declares the plugin; a plugin no scope mentions is `Plugin "<plugin>" is not installed` (`not_installed`). `enable`/`disable` print the plugin as typed. `disable --all` is as §17.6 states. | The docs quote the refusal for one declaring scope and give no wording for the others. Reference `src/cli/scope.ts`, `toggle-target.ts`, `disable-plan.ts`. |
| J17.7 | `prune` without a terminal and without `-y` exits `0` after the list and the `Not a TTY` line; a `no` at the prompt prints `Nothing removed`. | The docs say the exit code is `0` "whatever you answer" and give the non-TTY row without an exit code. Reference `src/cli/prune-plan.ts`. |
| J17.8 | The `sha256` of a displayed command is the SHA-256 of the JSON text of `{command, plugin, catalog}`, the catalog being the text the run read after its own refresh; a digest that does not match never prompts. | The docs say the digest binds the command, the plugin and the catalog, not how it is computed. Reference `src/cli/command-acceptance.ts`. A script MUST treat the digest as opaque. |
| J17.9 | The text form of a `plugin list` entry is not normative beyond its group heading; it SHOULD show `❯ <id>`, `Version:`, `Scope:` (or `Path:` for a session-only plugin), `Status:`, and one line per error and note. | The docs give the headings only. Oracle 2.1.325 prints `Path:` and `Status: ✔ loaded` for a session-only plugin; reference `src/cli/plugin-list.ts`. |
| J17.10 | `dataDirSize.human` is the byte count in the largest of B, KB, MB, GB, TB that keeps it at least 1, with one decimal (`512 B`, `1.5 MB`), binary units. | The docs give the field without its format. Reference `src/cli/plugin-list.ts`. |
| J17.11 | The token estimates of `plugin details` and their rounding are the client's; only the headings and the order of §17.9 are normative. | `plugins/measure.md` defines what the figures mean, not a tokenizer. Oracle 2.1.325 prints `Skills (1)  a` rows and `< 20` for small figures. |
| J17.12 | `configure` lists one `<key> (<labels>): <title>` line per option under `Options of <id>:`; a plugin with no options prints `<id> declares no userConfig options`; "set" means a saved value or a default. | The docs give the labels, not the line. Reference `src/cli/configure-plan.ts`. |
| J17.13 | A path that does not exist fails validation (`File not found: <path>` under the key `file`, exit `1`); a stat error other than "not found" (such as `ENOTDIR`) is exit `2`. `target` is the manifest file for a manifest run and the directory for a component run. | The docs give "an unreadable path" as an exit-2 example only. Oracle 2.1.325: a missing path exits `1` with `File not found`; `/dev/null/x` exits `2` with `ENOTDIR`, nothing on stdout. |
| J17.14 | A directory with no manifest and no `.claude` component directory, but with a `skills/<name>/SKILL.md` tree at its root, is validated as that skills tree. E4a deviation. | **Docs:** plugins/cli-reference.md, "Validate a directory": any other directory is validated as "those three directories under its `.claude`". **Claude Code:** 2.1.319 (reference implementation, `src/loading/validate/components-only.ts`), 2.1.325 (re-run 2026-11-16) and 2.1.330 (re-run 2026-11-23, the 2.1.330 docs unchanged here): `claude plugin validate d` on `d/skills/x/SKILL.md` alone prints `Validating components in: d`, then `Validating skill: d/skills/x/SKILL.md`, and fails on that file's unparsable frontmatter; a session loads such a tree as a skills-directory plugin. |
| J17.15 | In a `--json` result, an entry of `errors` or `warnings` is `{ "path", "message" }`; an entry of `notes` is a plain string (the mod validator's lines, such as `./register.js hooks: tool.call{tool=Bash}, tool.call`); an entry of `gatingHooks` is `{ "module", "pattern", "hook", "hasCatch" }`, where `module` is the path as `modules` writes it, `pattern` the event pattern given to `on` (a string), `hook` that pattern with its matcher in braces (`tool.call{tool=Bash}`), and `hasCatch` a boolean. Each file result carries all four arrays, empty when there is nothing. A client MAY add fields (2.1.325 adds `code` to error and warning entries, and `type` on each file result; 2.1.330 also `wasm` and `modules`, §17.13.4). | The docs name the arrays and the four `gatingHooks` fields, not the entries. Oracle 2.1.325 (`claude plugin validate --json` on a mod whose `register.js` calls `on('tool.call', { tool: 'Bash' }, …)` and `on('tool.call', …).catch(…)`): `notes` held strings, `gatingHooks` held `{"module":"./register.js","pattern":"tool.call","hook":"tool.call{tool=Bash}","hasCatch":false}` and the same with `"hook":"tool.call","hasCatch":true`; errors were `{"path","message","code":null}`. Reference `src/cli/validate-run.ts`. |
| J17.16 | Marketplace-only fields: `owner`, `plugins`. Plugin-only fields: `author`, `commands`, `agents`, `skills`, `hooks`, `mcpServers`, `lspServers`, `userConfig`, `channels`, `monitors`, `dependencies`, `settings`, `defaultEnabled`. | The docs give one example of each set. Reference `src/cli/validate-run.ts`. |
| J17.17 | The advice's source is filled from an `origin` remote on GitHub (`https://github.com/o/r[.git]`, `git@github.com:o/r[.git]`, `ssh://git@github.com/o/r`) as `o/r`; any other remote leaves the placeholder. 2.1.325 appends `In it, replace <owner>/<repo> with the repository that holds the marketplace.` to a message with the placeholder; 2.1.321 does not. | The install line's `--marketplace` form names a GitHub `owner/repo`. Reference `src/cli/validate-advice.ts`; oracle 2.1.325. |
| J17.18 | A `marketplace list` text entry is `  ❯ <name>` then `    Source: GitHub (owner/repo[#ref])`, `Git (<url>[#ref])`, `URL (<url>)`, `Folder (<path>)` (2.1.330; `Directory (<path>)` before), `File (<path>)` or `claude.ai`. Claude Code also lists the built-in `anthropic-plugin-directory` (`Source: Built in (Anthropic Directory)`) in text, not in `--json`, so its text never reads `No marketplaces configured`; a client MAY list such a built-in marketplace in text. | The docs give `Configured marketplaces:` and "one `Source:` line"; 2.1.330's `plugins/marketplace-reference.md`, "Reserved names", reserves `anthropic-plugin-directory` and `claude-plugin-directory` but does not say `list` shows one. Reference `src/cli/marketplace-list.ts`; oracle 2.1.325 and 2.1.330 (2026-11-23) with an empty `CLAUDE_CONFIG_DIR`: `Configured marketplaces:`, the built-in entry, exit `0`; `--json` prints `[]`. |
| J17.19 | `marketplace remove` of a name nobody declares fails with `Marketplace '<name>' not found` (`not_found`); one uninstalled plugin reads `Also uninstalled 1 plugin`. | The docs quote the plural form and no unknown-name case. Reference `src/cli/marketplace-remove.ts`. |
| J17.20 | `marketplace update` of one marketplace counted in bulk reads `Successfully updated 1 marketplace`; none, `0 marketplaces`. A seed-managed marketplace (§14) is refused with `Marketplace '<name>' is seed-managed (<dir>). Ask your administrator to update the seed directory`. | The docs give the plural example. Reference `src/cli/marketplace-update.ts`. |
| J17.21 | `marketplace add anthropic-plugin-directory` (and `remove`) prints only a reason on stderr and exits `1`; a `local` declaration reads `declared in local settings`; a `--claudeai` add prints `Successfully added marketplace: <name>`. | The docs say "can print no result line … check the exit code" without the code. Reference `src/cli/marketplace-add.ts`. |
| J17.22 | `plugin tag` runs `git` with argument vectors and quotes only its human preview; refusal wording not quoted in §17.12 is the client's. | The docs list reasons, not wording. Reference `src/cli/tag-plan.ts`. |
| J17.23 | Refusals: `<flag> is disabled by your organization's managed settings (disableSideloadFlags)` (also for `CLAUDE_CODE_PLUGIN_DIRS`, `--agents`, and `--mcp-config` unless every server is `type: "sdk"`); `Error: Invalid permission mode: <value>. Use one of: <list>` (case-sensitive); `Error: --restricted refuses --permission-mode bypassPermissions`; `--add-dir: <path> is not a directory`; `Invalid channel entry "<entry>": expected <form>` (`--channels` takes no `server:` entry); `Error: Settings file not found: <path>`, `Error: Invalid JSON passed to --settings: <problem>`. `--tools` names are separated by commas or spaces. | The docs describe these refusals without quoting them (except §17.20's). Reference `src/cli/flags/sideload.ts`, `session.ts`, `add-dir.ts`, `channels.ts`, `settings.ts`. |
| J17.24 | What neither `--bare` nor `--safe-mode` names stays loaded: under `--bare`, output styles, workflows, themes, keybindings, status line, file suggestion and LSP servers; `--bare` adds no built-in tool. | The docs list what each mode turns off. Reference `src/cli/flags/customizations.ts`. |
| J17.26 | `--config`: a key given twice keeps its last value; a value failing its type, bounds or `options` refuses the install before anything changes, reported as `invalid_config` (§17.4.1). | The docs say nothing about checking `--config` values (plugins/cli-reference.md, "plugin install"); they quote the unset-options and undeclared-key lines (plugins/troubleshooting.md, "The userConfig dialog never appears"), which §17.4.1 states as documented. Reference `src/cli/install-config.ts`. |
| J17.27 | `update`'s success line is `Successfully updated plugin: <name> to version <version> (scope: <scope>)`, without `Successfully` in a terminal (§17.2.1). | The docs say "then the result". Reference `src/cli/update-plan.ts`. |
| J17.32 | The validator's link, FIFO and size messages are those §17.13.1 quotes, each a warning under `directory` except the two command-line errors; the hooks and MCP server files are capped at 1,048,576 bytes; the phrase `a project's .claude/skills plugin` is fixed text, the same for `agents` and `commands`. The hooks-file warning says the loader "fails the whole plugin on bad hook config", which concerns the hooks file's verdict (§7.2.1.1), not these warnings. | The 2.1.321 docs (`plugins/cli-reference.md`, "Validate a directory") give the three link cases without wording and nothing on FIFOs, hooks or MCP files. Oracle 2.1.321, corpus (`~/Documents/llx-plugin/.cache/corpus/oracle/2.1.321/`): `devflow` and others (linked plugin component directory, also on `agents`, 8), `launchdarkly` (6, linked entries, plugin), `specforge` (`.claude/skills` plural and `.claude/agents` singular), `browser-harness` (a linked `SKILL.md`: `1 component here`, 6), `obsidian-connector` (linked `hooks` directory and `.mcp.json`), `wordpress-playground`, `obsx`. Oracle 2.1.325, re-run 2026-11-16 on minimal inputs in a scratch directory with an empty `CLAUDE_CONFIG_DIR`, for the cases the corpus does not hold: two linked `SKILL.md` (`2 components here were not read`), a FIFO `SKILL.md` (counted the same), a linked `hooks/hooks.json`, a 1.1 MB `hooks.json` and `.mcp.json`, the `.claude` forms, and the two errors (exit `1`). Not settled: 2.1.325 neither reads nor warns about a linked `agents/<name>.md` or `commands/<name>.md` file; the corpus holds no such case for 2.1.321. |
| J17.33 | The terminal rule of §17.2.1 covers every quoted `Successfully …` line of `install`, `uninstall`, `enable`, `disable`, `update` and the marketplace commands; the `✔` mark before it is presentation; `--json` messages keep `Successfully`. | The 2.1.330 docs state the rule with one example (`Installed plugin:`) and quote `Added marketplace:`, `Updated marketplace:`. Oracle 2.1.330, 2026-11-23, private config dir and a directory marketplace, each command under `script` (a terminal) and piped: `Installed plugin: p@mk (scope: user)`, `Enabled plugin: p (scope: user)`, `Updated marketplace: mk`, `Updated 2 marketplaces`, `Uninstalled plugin: p (scope: user)`, `Removed marketplace: mk` in a terminal; `✔ Successfully added marketplace: mk (declared in user settings)`, `✔ Successfully disabled plugin: p (scope: user)`, `✔ Successfully updated marketplace: mk` piped; `disable --json` under `script` gave `"message":"Successfully disabled plugin: q (scope: user)"`. |
| J17.34 | `restore-set-aside` with nothing set aside, a bare name included, prints its line and exits `0`; it takes no `--json` (`error: unknown option '--json'`, exit `1`). | The docs quote the line, not the exit code. Oracle 2.1.330, 2026-11-23, private config dir: `claude plugin restore-set-aside foo` and `foo@bar` print `No options or secrets are set aside for <arg>.` and exit `0`; `--help` lists only `--discard`. |
| J17.35 | A marketplace run reads the hooks files of the plugins it lists by relative path. | 2.1.330's `plugins/cli-reference.md`, "Validate a directory", drops "hook" from the files a marketplace run does not open. Oracle 2.1.330, 2026-11-23: a marketplace listing `./p` whose `hooks/hooks.json` holds `{"hooks": {` fails with `Validating hooks: <path>` and the `Invalid JSON syntax` error, while the same plugin's skill with unparsable YAML is not reported. |
| J17.36 | The text form of `Provides:` and `Hosts` lines is as §17.13.4 gives it and is not normative beyond holding the same lists as `provides` and `hosts`. | The docs describe the JSON fields only. Oracle 2.1.330, 2026-11-23: a plugin with one skill and `network.hosts: ["api.example.com"]` prints `Provides:`, `❯ skills: t:s`, `Hosts: api.example.com (declared)`, `Hosts not read for: skills (1)`; `--json` gave `hosts.named[0]` `{"host":"api.example.com","sources":[{"type":"declared"}]}`, `hosts.unread[0]` `{"kind":"skills","name":"t:s","reason":"process"}` and `hosts.declared` `{"plugin":true,"servers":[]}`; a marketplace run gave `provides` and `hosts` `null`. A plugin whose only component is one valid `lspServers` entry and no `network` prints `Provides:`, `❯ lspServers: go gopls`, no `Hosts:` line, `Hosts not read for: lspServers (1)` and `Hosts not declared: …`; `--json` gives `hosts` `{"named":[],"unread":[{"kind":"lspServers","name":"go","reason":"process"}],"declared":{"plugin":false,"servers":[]}}` (same day). |
| J17.37 | `claude plugin marketplace add` prints `Invalid marketplace source format. Try: owner/repo, https://..., or ./path` for an unrecognised source; `That isn't a marketplace source` is left to the session's add dialog. | 2.1.330's `plugins/troubleshooting.md` gives either message for the shell and the session alike. Oracle 2.1.330, 2026-11-23: `marketplace add marketplace.anthropic.com`, `'foo bar'` and `''` print the first form, exit `1`, piped and in a terminal. |
