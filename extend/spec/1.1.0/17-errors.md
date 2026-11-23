# 17. The plugin CLI and its diagnostics (continued): diagnostics

This part of §17 states the diagnostics an Extended client reports while it loads plugins, reads
marketplaces and settings, and starts a session: when each arises, what it changes, where it
appears, and its message. Evidence: `errors.md`, the section named after each diagnostic. The
commands themselves are in [17-cli.md](17-cli.md).

## 17.17 Conventions

1. A diagnostic's **condition** and **effect** (what loads, what is refused, the exit code) are
   normative. Where this part quotes a message, the client MUST print it as quoted with the
   placeholders filled; where it describes a message without quoting it, the wording is the
   client's.
2. A diagnostic appears where its section says: a *startup notice* is a line in the conversation
   view at the start of an interactive session, not on stderr; a *startup row* is a short line below
   the startup banner; *stderr* means the line is printed on stderr at startup in non-interactive
   mode with text output. Unless a section says otherwise, a diagnostic that goes to stderr in
   non-interactive mode goes to the debug log instead in a background session and with
   `--output-format json` or `stream-json`, so that machine-read output stays clean, and is captured
   with `--debug` at `~/.claude/debug/<session-id>.txt`.
3. A diagnostic about a plugin also appears in `claude plugin list` (its `errors` or `notes`, with
   `errorDetails` / `noteDetails`, §17.8.2) and in the `/plugin` **Errors** tab.
4. The documentation records how earlier releases behaved ("Before v2.1.…"). Those sentences are
   history: a client follows the 2.1.330 behaviour stated here (Judgment J17.28).

## 17.18 Plugin and component loading

### 17.18.1 A reserved skill, command or workflow name

A skill folder, a frontmatter `name`, a file or subfolder of `.claude/commands/`, or a saved
workflow named `anthropic-skills` or starting with `anthropic-skills:` MUST NOT load (§4, §11). The
client shows a startup notice naming what to change for the first refused item — a folder or file to
rename, a `name:` line to edit, a workflow to rename — such as

```text
Not loaded: rename .claude/skills/anthropic-skills, then restart — its name uses "anthropic-skills", a name reserved for the skills synced from your claude.ai account
```

ending with `· <N> more` when more were refused; the debug log names each one. <!-- req: cli.errors.A skill, command, or workflow wasn't loaded because its name is reserved -->

### 17.18.2 A skill or command name refused

A skill or command name that holds hidden, direction-changing or blank-like characters, `<` or `>`,
or is over 256 characters, is refused (§4). When the refused name is the one the item goes by (its
directory, a command file's name or subfolder), the item does not load and the debug log line reads
`<name> is not offered`; when it is a skill's frontmatter `name`, the skill loads without that name,
which neither appears in the `/` menu nor invokes it, and the log line reads
`<name value> is not shown for <skill>`. The startup notice counts them:

```text
1 skill or command name refused: run with --debug to see which ([names]), rename, then restart — a name may not hold hidden, direction-changing or blank-like characters, < or >, or be over 256 characters
```

Each debug log line carries `[names]` and spells hidden characters as codes, such as `\u{200B}`.
<!-- req: cli.errors.Skill or command name refused -->

### 17.18.3 A path that could not be checked

When the client asks whether a plugin path exists and gets an error other than "not found", it MUST
NOT load what the path names, and MUST report it; a path that simply does not exist draws no error.

- A default component location (`skills/`, `monitors/monitors.json`, a root `SKILL.md`, §1.4): the
  plugin's other components still load.
- The plugin's own directory: nothing of the plugin loads.

`/plugin` shows `<component> path couldn't be checked: <path> (<code>)`, for instance
`skills path couldn't be checked: /home/user/my-plugin/skills (ELOOP)` (`errors.md` also lists the
`path could not be checked` spelling); `claude plugin list` shows
`Path not found: <path> (<component>, <code>)`. Fixing the path and running `/reload-plugins` (or
restarting) loads it. <!-- req: cli.errors.Path could not be checked -->

| Code | Cause |
| --- | --- |
| `ELOOP` | A symbolic link in the path points at itself or forms a loop. <!-- req: cli.errors.Path could not be checked.ELOOP --> |
| `EIO` (or `ESTALE`) | The path is on a network mount that is broken or stale. <!-- req: cli.errors.Path could not be checked.EIO --> |
| `EACCES` | A directory above the path denies the user permission to traverse it. <!-- req: cli.errors.Path could not be checked.EACCES --> |

### 17.18.4 A path that escapes the plugin directory

A component path that leads outside the plugin directory, or cannot be confirmed inside it, MUST be
dropped, and the rest of the plugin loads (§1.4, §2.5). Both a path outside as written
(`../shared-utils`) and a symbolic link that resolves outside — other than one the marketplace's
symlink rules allow (§15) — are refused. For a path the manifest or the marketplace entry declares,
the component in the message is the declaring field:

```text
commands path escapes plugin directory: ./../shared.md
```

`claude plugin` commands print it as `Path escapes plugin directory: ./../shared.md (commands)`. For
a link, the message adds where it resolves:
`… — it resolves to /home/user/shared/deploy.md, outside the plugin directory`. On macOS and Linux a
component path containing a backslash anywhere is refused even inside the plugin:
`… — its path contains a backslash, which is not resolved reliably on this platform`. <!-- req: cli.errors.Path escapes plugin directory -->

A message giving the full path of one of a marketplace plugin's own default files means the client
skipped that file, because it could not confirm the file is inside the plugin — or, for a plugin read
in place from a local marketplace (§16), inside that marketplace (`… outside the plugin directory and
its marketplace directory`). The component the message names is fixed per file:

| File | Component in the message |
| --- | --- |
| `hooks/hooks.json` | `hooks` <!-- req: cli.errors.Path escapes plugin directory.hooks/hooks.json --> |
| `monitors/monitors.json` | `monitors` <!-- req: cli.errors.Path escapes plugin directory.monitors/monitors.json --> |
| `SKILL.md` at the plugin root | `skills` <!-- req: cli.errors.Path escapes plugin directory.SKILL.md --> |

A root `settings.json` (§2.4, Judgment J2.9), which the 2.1.330 docs no longer list, is reported
under `settings` in the same way (2.1.321's `errors.md`, "Path escapes plugin directory").

A message ending in `EACCES` means a directory on the way to the path, or to where a link on it
points, denies traversal; other codes are as §17.18.3.

### 17.18.5 A manifest that was not read

When the client cannot confirm that a marketplace plugin's `.claude-plugin/plugin.json` is inside the
plugin — and, for a plugin of a local marketplace, inside that marketplace — it MUST load nothing from
that plugin and report it in the `/plugin` **Errors** tab, the reason at the end saying what it found:

```text
Plugin not loaded: its manifest /home/user/my-marketplace/my-plugin/.claude-plugin/plugin.json was not read, because it resolves to /home/user/dotfiles/my-plugin/.claude-plugin/plugin.json, outside the plugin directory and its marketplace directory
```

A reason ending in an error code reads as §17.18.3. <!-- req: cli.errors.Plugin not loaded: its manifest was not read -->

### 17.18.6 `${user_config.*}` in a shell command

A plugin hook in shell form, a monitor command, or an MCP `headersHelper` that references
`${user_config.KEY}` would hand a user-supplied value to a shell. The client MUST refuse to start
that component, without substituting, and the check runs on the template, so it fires before any
value is configured (§3.2, §7, §8, §9):

- shell-form hook: `Hook from plugin <id> references ${user_config.*} in a shell-form command. The substituted value would be re-parsed by the shell. Use exec form instead — {"command": "<executable>", "args": ["${user_config.KEY}", ...]} — or read $CLAUDE_PLUGIN_OPTION_<KEY> from the hook's environment. Command: <command>`
- monitor: `Monitor "<name>" from plugin <plugin> references ${user_config.*} in its command. The substituted value would be passed to a shell. Monitor commands cannot safely reference ${user_config.*}; have the monitor script read the value from a config file or prompt instead.`
- `headersHelper`: `headersHelper for MCP server '<server>' references ${user_config.*}. The substituted value would be passed to a shell; read the value inside the helper script instead (e.g. from an env var set in the server's "env" block).`

An exec-form hook (with `args`), where each reference is one argument, and a server's `headers`
field, which no shell parses, are not refused. <!-- req: cli.errors.Plugin command references user\_config in a shell command -->

### 17.18.7 A dynamic-context command that was not run

When a `` !`<command>` `` of a skill or command file (§4), after substitution, contains a character
the shell tool refuses — for either tool a raw control character other than tab and newline, for the
PowerShell tool also U+FEFF and U+180E — no shell command of that file runs, and the client reports
`No shell command in <name> was run, because the <tool> tool does not accept one of them: …`, ending
with the refused command with each refused character shown as `�`. <!-- req: cli.errors.No shell command in a skill or command was run -->

### 17.18.8 A hook path with a space

An `asyncRewake` hook (§7) in shell form whose `command` has an interpreter followed by an unquoted
path placeholder that resolves to a path containing a space MUST NOT run; the client notifies, in the
conversation view, `<Event> hook needs quotes around a path with a space (<script>)`, such as
`Stop hook needs quotes around a path with a space (check.py)`. <!-- req: cli.errors.Hook needs quotes around a path with a space -->

### 17.18.9 An archive whose digest does not match

For an `archive` plugin source with a `sha256` pin (§15), a downloaded file whose digest differs MUST
refuse the install and leave the plugin cache unchanged:

```text
Plugin archive integrity check failed for <url>: expected sha256 <pin>, got <digest>. The archive was not installed. Verify the sha256 in the marketplace entry, or that the URL serves the intended file.
```

<!-- req: cli.errors.Plugin archive integrity check failed -->

### 17.18.10 A plugin the organisation requires

`claude plugin disable`, or the **Installed** tab, on a synced plugin that the organisation marks as
required MUST save nothing and leave it enabled:
`Plugin "<name>@synced" is required by your organization and can't be disabled here. Contact your admin to change it.`
Disabling a plugin that a required plugin depends on is refused the same way, naming the required
plugin. <!-- req: cli.errors.Plugin is required by your organization -->

### 17.18.11 A plugin that was not uninstalled

After removing the plugin's `enabledPlugins` entry, the uninstall (§17.5) MUST read the scope's
settings files back. When the plugin is still switched on there, or a file that could switch it on
cannot be read or checked, the uninstall stops: the plugin stays installed and none of its options,
secrets or data are deleted; `claude plugin uninstall` exits `1`, `--json` carries
`failureCode: "settings_still_on"`, and `/plugin` shows the same message:

```text
✘ Failed to uninstall plugin "formatter": "formatter" was not uninstalled: it is still switched on in /home/user/project/.claude/settings.local.json, although the settings change reported no error. It is still installed. Take it out of "enabledPlugins" in that file yourself, then uninstall it again.
```

The middle names the file and the cause: `it is still switched on in <file>, although the settings
change reported no error`; `it is still switched on in <file>, and the settings change failed
(<error>)`; `<file> is there and could not be read`; or `<file> (not read: it is on a network path
or is a link to one, or could not be checked)`. Text after the colon that starts with
`installed_plugins.json` instead means a record that this release cannot read (§16). <!-- req: cli.errors.Plugin was not uninstalled -->

### 17.18.12 A server file path not read

An MCP or LSP server file that a plugin names — in `mcpServers` or `lspServers` of `plugin.json` or
of its marketplace entry — by a path that is absolute or has a `..` part MUST NOT be read, even when
the path stays inside the plugin; the rest of the plugin loads, without the servers that file
defines (§2.5, §8, §9.1). The message names the component and the path:

```text
mcp-servers path not read: ./sub/../x.json is absolute or has a ".." part
```

The fix is a path inside the plugin that starts with `./` and has no `..`, such as
`./servers/x.json`; one server file shared by plugins of a marketplace is linked into each under
the marketplace's symlink rules (§15). A validator reports the same path as `Path contains ".."
which could be a path traversal attempt: <path>` (§2.5). <!-- req: cli.errors.Server file path not read -->
(Oracle 2.1.330, 2026-11-23: `"mcpServers": "./sub/../x.json"` loads the plugin with
`MCP servers (0)` in `claude plugin details`, and `(1)` once the path is `./x.json`; `claude plugin
list --json` carries no error for it.)

## 17.19 Marketplace names

### 17.19.1 A name that impersonates an official marketplace

The client checks a marketplace's name every time it reads the catalog (§15). A registered
marketplace whose name impersonates an official Anthropic marketplace stops loading, and so do its
plugins: `claude plugin list` and the **Errors** tab report each plugin with a message beginning
`Claude Code refuses the marketplace name "<name>"`, and for an imitating name the marketplace's own
error reads `Claude Code refuses this marketplace's name: it looks like one of Anthropic's own`.
`claude plugin marketplace add` refuses such a name with
`Marketplace name impersonates an official Anthropic/Claude marketplace`. For a marketplace a
settings file declares inline (`"source": "settings"`), the message lists the steps that keep it:
rename the entry's key and `source.name` in each settings file, remove the old name, restart. <!-- req: cli.errors.Claude Code refuses the marketplace name -->

### 17.19.2 A reserved name from an untrusted source

A marketplace registered under a name reserved for official marketplaces whose source is not a
`github.com/anthropics/` repository stops loading with its plugins, re-checked on every load and
refresh:

```text
Marketplace "<name>" is registered from an untrusted source: The name '<name>' is reserved for official Anthropic marketplaces. Only repositories from 'github.com/anthropics/' can use this name. To fix it, remove the marketplace and re-add it from the official source.
```

For a source that is neither a GitHub repository nor a git URL the middle sentence reads
`can only be used with GitHub sources from the 'anthropics' organization`. `marketplace add` refuses
with `Failed to add marketplace:` and the same reserved-name sentence. <!-- req: cli.errors.Marketplace is registered from an untrusted source -->

### 17.19.3 Another spelling of a reserved name

A name that is another spelling of a reserved name (§15) is refused on add:
`Failed to add marketplace: "<name>" is another spelling of "<reserved>", a reserved marketplace name.`,
or, when the name would need shell quoting,
`This marketplace's name is another spelling of "<reserved>", a reserved marketplace name. It is not exactly the reserved name it appears to be.`
An entry already registered under such a name is ignored, and `/plugin`, `claude plugin install`
and `claude plugin update` warn:
`known_marketplaces.json has an entry named "<name>", another spelling of the reserved marketplace name "<reserved>", so it is ignored. Remove it with: claude plugin marketplace remove <name>` <!-- req: cli.errors.Marketplace name is another spelling of a reserved name -->

## 17.20 Marketplace registry, sources and settings files

### 17.20.1 The registry

A plugin command that needs `~/.claude/plugins/known_marketplaces.json` (§15) MUST fail when it
cannot use the file: `Failed to load marketplace configuration` when it exists but is not valid JSON
or cannot be read (an empty file included), `Marketplace configuration file is corrupted` when it is
JSON that does not match the registry schema. `claude plugin install` reports, for an empty file,
`✘ Failed to install plugin "<plugin>": Failed to load marketplace configuration: <parse error>`.
A registry reset to `{}` is filled again at the next start in a trusted folder from the
`extraKnownMarketplaces` of user and managed settings. <!-- req: cli.errors.Failed to load marketplace configuration -->

### 17.20.2 The same name from a different source

When `install --marketplace <source>` (§17.4) fetches a catalog whose name is that of a marketplace
already added from another source, the client MUST keep the existing marketplace, install nothing,
and print `Marketplace "<name>" is already added from a different source (<source>). To use this source instead, remove that marketplace first with /plugin marketplace remove <name>.` <!-- req: cli.errors.Marketplace is already added from a different source -->

### 17.20.3 An entry path outside the marketplace

A marketplace entry whose source path cannot be resolved inside the marketplace's directory MUST
neither install nor load (§15): an absolute, climbing (`..`) or network-shaped path; on macOS and
Linux a backslash after the leading `./`; in a marketplace fetched from git or a URL, a symbolic
link resolving outside the marketplace; a relative entry of a marketplace added from a direct URL to
its `marketplace.json`, which has no local files. `claude plugin install` reports
`Cannot install <id>: its marketplace entry path does not stay inside the marketplace directory (…)`,
and an installed plugin whose entry fails shows in `claude plugin list` as failed to load with
`Plugin source path refused: <path> does not stay inside its marketplace directory. Check that the marketplace entry has a plain relative path.` <!-- req: cli.errors.Marketplace entry path does not stay inside the marketplace directory -->

### 17.20.4 A `--settings` file that is not usable

A `--settings` file (§17.15.3) larger than 2 MiB MUST make `claude` exit `1` at startup with
`Error: Settings file exceeds the 2MiB limit: <path>`, without reading it. A device, FIFO or socket
gives `Error: Cannot use settings file (Not a regular file (device, FIFO, or socket))` followed by
the path, and a directory an `EISDIR` reason. <!-- req: cli.errors.Settings file exceeds the 2MiB limit -->

## 17.21 Managed settings, trust and settings values

| Diagnostic | Condition and effect |
| --- | --- |
| Organisation settings could not load | The session needs the organisation's settings, server-managed included, and they did not load. Interactive: a dialog `Claude Code can't start this session yet` holds the session until they load, offering retry. Non-interactive and background sessions print the message (such as `Claude Code couldn't reach Anthropic to load your organization's settings (could not connect). <Organization> requires them before a session can start.`) and exit `1`. No plugin loads before that. <!-- req: cli.errors.Claude Code couldn't load your organization's settings --> |
| A managed document that does not parse | A deployed managed source (a `managed-settings.json`, a `managed-settings.d` drop-in, a macOS managed preferences profile, the Windows registry value) that is present but not a JSON object MUST make the client exit `1` at startup — interactive, `-p`, SDK, background and most subcommands, `claude doctor` included — even when another source is valid: `<source>: Managed settings document could not be parsed as a JSON object; none of its settings are in effect. Fix or remove it.` An empty `managed-settings.json` counts as `{}`. A drop-in directory that cannot be listed reports `Managed settings drop-in directory could not be read:` and the error. A schema problem in a parsing document is not this error (§14). <!-- req: cli.errors.Managed settings document could not be parsed --> |
| A managed source that cannot be read | A deployed source that exists but cannot be read for a reason other than the system denying it (an I/O error), with no other source supplying a policy, MUST make the client exit at startup with `Unable to read managed policy settings.`, `This machine may require organization login enforcement, but the policy file failed to load.`, `Contact your administrator.` and `Detail: <source>: <reason>`. In the same state, sign-in flows, API requests from a session already running and the `claude gateway` server are refused with a variant of the first line that names `allowedProviders`. A read the system denies starts the session without that source (§14). <!-- req: cli.errors.Unable to read managed policy settings --> |
| Approval needed but not askable | A `claude plugin` command whose server-managed settings need the user's approval, and that cannot read the keyboard (piped input, and on macOS and Linux no `/dev/tty`), MUST stop before changing anything: ``Your organization's managed settings need your approval, which couldn't be asked for here. Run `claude` in a terminal and approve them, then run this command again.`` The approval is kept in the configuration directory. <!-- req: cli.errors.Managed settings need your approval --> |
| Approval declined | The user declines the security approval dialog: `Managed settings were not approved; exiting without applying them.` and exit. A decline is not remembered. <!-- req: cli.errors.Managed settings were not approved --> |
| Remote managed settings failed | The session is eligible for server-managed settings that could not be fetched or applied. Interactive sessions and the desktop Code tab warn with the cause in parentheses (`network error`, `request timed out`, `authentication rejected (401)`, `no setting in the server response could be applied as written`) and which policy the session runs on. <!-- req: cli.errors.Remote managed settings failed to load --> With settings cached from an earlier fetch the session runs on that cache, except the withheld environment variables, and the line reads `using cached policy`; with **no cached settings to apply** — none fetched yet on this machine, or the last fetch more than 24 hours ago — it runs without server-managed settings: `no remote policy applied`. <!-- req: cli.errors.Remote managed settings failed to load.No cached settings to apply --> In the desktop Code tab the warning is a line in the conversation, and a new line reports each change of the fetch's state: `Remote managed settings are still loading` when the session went ahead during the fetch; `Remote managed settings did not load` when it ended without an answer <!-- req: cli.errors.Remote managed settings failed to load.Remote managed settings did not load -->; and `Remote managed settings have now loaded` when it succeeded after a warning, saying whether a remote policy now applies. <!-- req: cli.errors.Remote managed settings failed to load.Remote managed settings have now loaded --> |
| Sandbox allow entries under a lock | Managed `allowManagedReadPathsOnly` or `allowManagedDomainsOnly` makes the `allowRead` or `allowedDomains` entries of a non-managed file not apply; `/status` and `claude doctor` warn, naming the key, the lock, the entry count and the file: `sandbox.filesystem.allowRead is ignored — managed settings set allowManagedReadPathsOnly, so only allowRead paths from managed settings are honored. The <N> entries in <file> will NOT apply (see https://code.claude.com/docs/en/settings#sandbox-settings).` For the network lock the warning names `sandbox.network.allowedDomains` and `allowManagedDomainsOnly` and says `only allowed domains (and WebFetch domain rules) from managed settings are honored`. <!-- req: cli.errors.Sandbox allow entries are ignored under a managed lock --> |
| `crossSessionInbound` out of range | A value other than `accept`, `hold`, `refuse` is ignored with a warning: in a user, project, local or `--settings` file messages are held for approval while it is present (`"crossSessionInbound" must be one of "accept", "hold", "refuse"; received "<value>". This value was ignored; while it is present, cross-session messages are held for your approval instead of being delivered. Set it to one of the values above.`); in managed settings it is read as `refuse` and the warning says messages are turned away. <!-- req: cli.errors.crossSessionInbound must be one of accept, hold, refuse --> |
| Workspace not trusted | `permissions.allow` rules and `permissions.additionalDirectories` of the project's `.claude/settings.json` or `.claude/settings.local.json` are not applied until the workspace is trusted (§13); `deny` and `ask` apply. The client warns with the count, the setting and the file, and how to trust: `Ignoring <N> permissions.allow entries from <file>: this workspace has not been trusted. Run Claude Code interactively here once and accept the trust dialog, or set projects["<path>"].hasTrustDialogAccepted: true in <home>/.claude.json.` <!-- req: cli.errors.Workspace has not been trusted --> |

## 17.22 Agents and tools

| Diagnostic | Condition and effect |
| --- | --- |
| Agent descriptions over budget | The names and `description`s of the non-built-in subagents, plugin ones included, pass an estimated 15,000 tokens. A startup notice, `Agent descriptions are over the 15.0k-token limit (~<n>k tokens) · ask Claude to trim agent descriptions in .claude/agents/`; every agent still loads (§5). <!-- req: cli.errors.Agent descriptions are over the 15.0k-token limit --> |
| Zero tools | A non-empty `tools` list in which no entry resolves refuses the launch, as §5.7.3 states, with the message `Agent '<type>' would be spawned with zero tools — refusing. Its tools list resolved to nothing: <groups>. Fix the agent's tools frontmatter or pass a different subagent_type.` An omitted or empty `tools`, or one `disallowedTools` emptied, launches without tools. <!-- req: cli.errors.Agent would be spawned with zero tools --> The groups: **unrecognized**, an entry that names no tool, such as `Grpe` <!-- req: cli.errors.Agent would be spawned with zero tools.Unrecognized -->; **not available to subagents**, a real tool subagents cannot use, including one only a foreground subagent keeps when the subagent would run in the background, which is the default <!-- req: cli.errors.Agent would be spawned with zero tools.Not available to subagents -->; **matched no tools in this session**, a valid entry with nothing behind it now, such as `mcp__github__*` with no such server connected, or `Agent` at the depth limit; `Agent` is always reported here. <!-- req: cli.errors.Agent would be spawned with zero tools.Matched no tools in this session --> |
| Invalid `--agents` | §5.5.1: `Error: Invalid --agents configuration:` then what failed, checks in order (invalid JSON; schema problems one per line, at most 20 then `…and N more`; a name starting with `-`), exit `1` before the session starts; `--safe-mode` or `CLAUDE_CODE_SAFE_MODE` ignores the flag; with `--resume` or `--continue` an inline value is not checked, a file value is. The file form's own refusals: `Error: --agents takes a JSON object, or a file path only with --print (-p)` and `Error: --agents file not found: <path>`. <!-- req: cli.errors.Invalid --agents configuration --> |
| `subagent_type` required | An Agent call without `subagent_type` in a session with no general-purpose subagent (built-ins disabled by `CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS=1` in non-interactive mode, or a main-thread `tools: Agent(...)` allowlist without it) returns `subagent_type is required: the general-purpose agent is not available in this session. Available agents: <list>` to the model. <!-- req: cli.errors.subagent\_type is required --> |
| No such tool | A tool call naming a tool not in the session's list returns `Error: No such tool available: <name>` to the model, and the turn continues; when the client can tell why, a sentence follows (`Tool names are case-sensitive: call Read instead.`). Right after a resume, a call to a server still on its first connection waits for it first (§8). A tool name cut to 200 characters fails the same way. <!-- req: cli.errors.No such tool available --> |

## 17.23 MCP servers

| Diagnostic | Condition and effect |
| --- | --- |
| `.mcp.json` unreadable | A command that reads the project's `.mcp.json` (`claude mcp add`/`add-json --scope project`, `claude mcp remove`) finds a file that is not regular or is larger than 2 MiB and exits with `Can't read .mcp.json: it isn't a regular file or is larger than 2097152 bytes. Fix or remove it, then run the command again.` <!-- req: cli.errors.Can't read .mcp.json --> |
| Managed scope | `claude mcp add`/`add-json --scope managed` fails with `Cannot add MCP server to scope: managed`: that scope is read only from `managedMcpServers` (§8). <!-- req: cli.errors.Cannot add MCP server to the managed scope --> |
| Only plugin servers allowed | With managed `strictPluginOnlyCustomization` `true` or listing `mcp` (§14), `claude mcp add`/`add-json` exits `1` without saving: `Cannot add MCP server: your organization's managed settings allow only MCP servers that plugins provide. Install a plugin that provides this server, or ask your administrator to make it available.`; `add-from-claude-desktop` and `/import` report each server as not imported with that reason. Plugin servers still load. <!-- req: cli.errors.Cannot add MCP server when managed settings allow only plugin servers --> |
| Permission prompt tool missing | The `--permission-prompt-tool` tool is not among the connected MCP tools when the first permission decision is needed, after waiting up to `MCP_TIMEOUT` (30 s) for its server to connect before the first prompt: the prompt is still sent, and the non-interactive run exits `1` on the first tool call, with no answer, printing `Error: MCP tool <name> (passed via --permission-prompt-tool) not found. Available MCP tools: <list or none>`. <!-- req: cli.errors.MCP permission prompt tool not found --> |
| Blocked by policy | **Reconnect** or re-enable in `/mcp` on a server that a matching `deniedMcpServers` entry (in any settings file, the user's and the project's included), an `allowedMcpServers` list it does not match, `strictPluginOnlyCustomization` with `mcp` locked (for a server configured in `~/.claude.json` or `.mcp.json`), or `disableClaudeAiConnectors` (for a claude.ai connector) blocks: the client refuses to connect it, `MCP server <name> is blocked by enterprise managed policy` (§8). <!-- req: cli.errors.MCP server is blocked by enterprise managed policy --> |
| Server disabled | A call to a tool of a server the user turned off does not connect it; the model receives `MCP server "<name>" is disabled — re-enable it via /mcp to use its tools` as the result. <!-- req: cli.errors.MCP server is disabled --> |
| Reserved server name | A server of the user's own configuration whose name the client reserves (such as a built-in server's) does not load: `"<name>" is a reserved MCP server name and was not loaded`. A plugin's server registers under its scoped name, so its key is not checked (§8.5 item 5, Judgment J8.12). <!-- req: cli.errors.MCP server name is reserved --> |
| Elicitation capability rejected | A server on Java MCP SDK 0.11.0–0.17.0 refuses the handshake's `form` and `url` elicitation modes: `This server (Java MCP SDK 0.17.0 or older) rejected Claude Code's elicitation capability. Set "bareElicitationCapability": true for it, or upgrade to Java MCP SDK 0.17.1+ (Spring AI 1.0.7+ or 1.1.6+).` A server entry (stdio, `sse`, `http`, `ws`) with `"bareElicitationCapability": true` is offered form mode only (§8). <!-- req: cli.errors.MCP server rejected the elicitation capability --> |

## 17.24 Permission rule warnings

Each of these keeps the rule as written (or skips it, where said) and changes nothing else; §13
states how rules match. In an interactive session the full warning goes to the debug log and the
startup row shown appears; in non-interactive mode with text output the full warning goes to stderr
(§17.17). The full warning names the rule's source in parentheses: a settings file path,
`managed policy settings`, the flag (`--allowed-tools`, `--disallowed-tools`), or a
`claude-settings-<hash>.json` path for an inline `--settings` value.

| Warning | Condition |
| --- | --- |
| A wildcard before the rest of the command | A `Bash` allow rule whose `*` precedes a later word that decides the command (`Bash(git * main)`, `Bash(git -C * status *)`), from settings, managed settings, `--allowedTools` or `--settings`. Full: `Permission allow rule (<source>): <rule> has a wildcard before the rest of the command, so it also matches any options inserted at that position and approves them without a prompt. …`; row: `⚠ Allow rule <rule> allows any option at its * · use an exact value`. <!-- req: cli.errors.Has a wildcard before the rest of the command --> |
| Not matched by file permission checks | A `Write`, `NotebookEdit`, `MultiEdit` or `Glob` rule with a path (except `Glob` in `--allowedTools`): file permissions consult only `Edit` and `Read` rules, so it never matches. Full: `Permission <kind> rule (<source>): <rule> is not matched by file permission checks — only Edit(path) rules are. Use Edit(<path>) instead (Edit rules cover all file-editing tools).`; a deny or ask rule also gets the row `⚠ Deny rule <rule> never matches · use Edit(<path>)`, an allow rule none. Bare tool names are not warned about. <!-- req: cli.errors.Is not matched by file permission checks --> |
| Malformed `Tool(content)` | A rule not of the form `Tool` or `Tool(content)` ending at the closing parenthesis is **skipped** and listed in the invalid-settings dialog at interactive start and in `claude doctor`: `Invalid permission rule "<rule>" was skipped: Malformed Tool(content) rule. Rules take the form Tool or Tool(content) and must end at the closing ")"; parentheses inside the content are literal`. <!-- req: cli.errors.Malformed Tool(content) rule --> |
| Matches no tool | A deny or ask rule whose tool name the client does not recognise (`Bsh`, or a tool's display label): row `⚠ Deny rule <rule> matches no tool · check for typos`; full `Permission deny rule "<rule>" matches no known tool — check for typos.` <!-- req: cli.errors.Matches no tool · check for typos --> |
| Denying Bash turns off PowerShell | On Windows with Git Bash, a whole-tool deny of Bash (`--disallowedTools Bash`, a bare `Bash` or `Bash(*)` deny rule) also turns off the PowerShell tool unless `CLAUDE_CODE_USE_POWERSHELL_TOOL=1`: `Denying Bash also turns off the PowerShell tool, so Claude has neither. To use PowerShell, set CLAUDE_CODE_USE_POWERSHELL_TOOL=1.` (stderr in non-interactive text mode; the debug log otherwise). <!-- req: cli.errors.Denying Bash also turns off the PowerShell tool --> |

## Design decisions

### Why loading failures are per component

A plugin is many independent files. Refusing one path that escapes the plugin, or that cannot be
checked, protects the user from what that path names without punishing the components that are
fine; only a failure that makes the whole plugin untrustworthy — its own directory or its manifest —
stops all of it.

### Why a managed document that does not parse stops the client

A policy the client cannot read cannot be enforced. Starting anyway would run sessions, and their
plugins, without the organisation's controls; failing closed makes the administrator's mistake
visible at once.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J17.28 | Version-history sentences of `errors.md` ("Before v2.1.…, …") state no requirement; the 2.1.330 behaviour around them is the contract. | They describe earlier releases, which this specification does not target. |
| J17.29 | `ESTALE` is reported and handled as `EIO`; any other code other than "not found" is reported with its own name and handled as §17.18.3. | `errors.md` lists causes "include", naming `EIO or ESTALE` together. |
| J17.30 | The parenthesised list of `Cannot install … does not stay inside the marketplace directory (…)` is the client's wording; the prefix and the `Plugin source path refused` line are as quoted. | The docs quote one long parenthesis that names implementation categories. |
| J17.31 | The startup-row and stderr routing of §17.17 rule 2 applies to every diagnostic `errors.md` gives a non-interactive stderr form for, unless its section says otherwise. | `errors.md` states it per section in the same words; a single rule avoids divergence. |
