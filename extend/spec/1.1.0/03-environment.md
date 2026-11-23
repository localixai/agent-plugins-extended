# 3. Environment, substitution and user configuration

A plugin does not know where it will be installed, which project it will run in, or what the user
will configure. This chapter defines the three path variables a client gives a plugin, where a
`${...}` reference is replaced in each component and what reaches each process's environment, the
`userConfig` options a plugin asks the user for, and the environment variables of Claude Code that
change how plugins load and run. Evidence: `plugins/manifest-reference.md` ("Environment
variables", "User configuration"), `plugins/components.md` ("Ask the user for configuration
values", "Reference plugin paths and store data") and `env-vars.md`, unless a section names another
page. §2.2 states the manifest field `userConfig`; this chapter states what its value means.

## 3.1 Path variables

A client MUST provide three path variables to every component of a Claude Code plugin:

| Variable | Value | For |
| --- | --- | --- |
| `CLAUDE_PLUGIN_ROOT` | The absolute path of the directory the plugin is loaded from. <!-- req: environment.variable.${CLAUDE_PLUGIN_ROOT} --> | Scripts, binaries and configuration files bundled with the plugin. |
| `CLAUDE_PLUGIN_DATA` | The absolute path of the plugin's persistent data directory, `<plugins root>/data/<id>/`. <!-- req: environment.variable.${CLAUDE_PLUGIN_DATA} --> | Installed dependencies such as `node_modules`, virtual environments, generated code, caches. |
| `CLAUDE_PROJECT_DIR` | The absolute path of the project root where the session started. <!-- req: environment.variable.${CLAUDE_PROJECT_DIR} --> | Project-local scripts and configuration. |

### 3.1.1 `CLAUDE_PLUGIN_ROOT`

1. For a marketplace plugin copied into the cache, the root is that version's cache directory,
   `<plugins root>/cache/<marketplace>/<plugin>/<version>/` (§16). For a plugin loaded in place — a
   `--plugin-dir` directory, a skills-directory plugin, a relative-path plugin of a marketplace added
   from a local path — the root is the source directory itself, and its hook, MCP and LSP processes
   receive that path (`plugins/loading.md`, "In-place and copied plugins").
2. The root changes whenever the plugin's version changes. A plugin MUST NOT keep state under its
   root; a client MAY remove an old version's directory once no session uses it (§16).
   <!-- req: environment.variable.${CLAUDE_PLUGIN_ROOT} -->

### 3.1.2 `CLAUDE_PLUGIN_DATA`

1. `<plugins root>` is the value of `CLAUDE_CODE_PLUGIN_CACHE_DIR` when it is set and not empty,
   else `<config dir>/plugins`, where `<config dir>` is `CLAUDE_CONFIG_DIR` or `~/.claude`
   (§3.6.3, Judgment J3.1).
2. `<id>` is the plugin identifier (`<name>@<marketplace>`, or `<name>@inline` for a session-only
   plugin, §16) with every character other than an ASCII letter, a digit, `_` or `-` replaced by
   `-`. `my-plugin@my-marketplace` becomes `my-plugin-my-marketplace`. The identifier is not
   case-folded, so two ids that differ only in letter case (`My-Plugin@m` and `my-plugin@m`) name
   one directory on a case-insensitive file system, the default on macOS and Windows, and those
   plugins share it; on a case-sensitive one they have two (Judgment J3.19).
3. The client MUST create the directory when a component first references it. Exporting the
   variable into a process (§3.3) counts as a reference, so the directory exists before any hook,
   stdio MCP server or LSP server of the plugin starts (Judgment J3.2).
4. The directory MUST survive updates of the plugin. When the plugin is uninstalled from the last
   scope it is installed at, the client deletes it, except with `--keep-data`, when another
   installed plugin resolves to the same directory, or when the install records cannot be read back
   (`plugins/cli-reference.md`, "What an uninstall deletes and keeps"; §16).
   <!-- req: environment.variable.${CLAUDE_PLUGIN_DATA} -->

### 3.1.3 `CLAUDE_PROJECT_DIR`

The value is fixed for the session: it does not follow a `cd` that Claude runs, and it does not move
when Claude enters a worktree. A hook that needs the directory Claude is working in reads the `cwd`
field of its input instead (§7; `hooks.md`, "Reference scripts by path"). The same value is
substituted in skill content (§4) and set in the environment of every stdio MCP server, not only a
plugin's, and of plugin LSP servers. <!-- req: environment.variable.${CLAUDE_PROJECT_DIR} -->

## 3.2 Substitution

### 3.2.1 Where each reference resolves

A reference `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}` or `${CLAUDE_PROJECT_DIR}` resolves
only in the fields below; anywhere else it is ordinary text. The third column is what the client
also puts in the environment of the process the component starts (§3.3).

| Component | Fields where `${...}` resolves | Exported to the process |
| --- | --- | --- |
| Hook commands (§7) | Anywhere in `command` and in every `args` element. <!-- req: environment.component.Hook commands --> | `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, `CLAUDE_PROJECT_DIR`, and `CLAUDE_PLUGIN_OPTION_<KEY>` for each option (§3.4.4). |
| Monitor commands (§9.2) | Anywhere in `command`. <!-- req: environment.component.Monitor commands --> | None of them. |
| MCP `stdio` servers (§8) | `command`, `args`, `env`. <!-- req: environment.component.stdio --> | `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, `CLAUDE_PROJECT_DIR`. |
| MCP `http`, `sse` and `ws` servers (§8) | `url`, `headers`, `headersHelper`. <!-- req: environment.component.http --> | No process, except the `headersHelper` command (§3.3). |
| LSP servers (§9.1) | `command`, `args`, `env`, `workspaceFolder`. <!-- req: environment.component.LSP servers --> | `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`, `CLAUDE_PROJECT_DIR`. |
| Skill, command and agent content (§4, §5) | Anywhere in the Markdown body. <!-- req: environment.component.Skill, command, and agent content --> | No process. |

1. The client MUST NOT put the three variables in the environment of a command Claude runs through
   the Bash tool, in the main session or in a subagent. A skill, command or agent that tells Claude
   to run a bundled script writes the `${...}` reference in its body, and the client substitutes
   the path when it loads the content. <!-- req: environment.component.Skill, command, and agent content -->
2. `${user_config.KEY}` (§3.4.4) resolves in a narrower set of fields; §3.4.5 lists the fields that
   refuse it. Skill-only variables (`${CLAUDE_SKILL_DIR}`, `${CLAUDE_SESSION_ID}`,
   `${CLAUDE_EFFORT}`) and the `allowed-tools` substitution are §4's. Environment references in MCP
   configuration (`${VAR}`, `${VAR:-default}`) are §8's.
3. A hook that no plugin declares — one from a settings file or from a skill's or agent's
   frontmatter — has no plugin root: the client leaves `${CLAUDE_PLUGIN_ROOT}`,
   `${CLAUDE_PLUGIN_DATA}` and `${user_config.*}` in it as written and exports only
   `CLAUDE_PROJECT_DIR` (Judgment J3.3).

### 3.2.2 Reference syntax

A reference is `${` + a name + `}` with no brace inside. The client replaces each reference it
recognises in one pass over the field as written: a substituted value is never scanned again, so a
path or option value that contains `${...}` stays literal. A reference the client does not recognise
in that field stays as written. A reference to an option that has no value (§3.4.4) also stays as
written, and the client SHOULD record a warning naming the field (Judgment J3.4).

### 3.2.3 Quoting

Each substituted path MUST stay one argument of the command it reaches.
<!-- req: environment.rule.Quoting and path separators -->

1. **Exec form** (a hook with `args`, §7): each element of `args` is one argument and `command` is
   the executable; the client substitutes into each as a plain string and runs no shell, so no
   quoting is needed and characters such as `'`, `$` and backticks pass verbatim.
2. **Shell form** (a hook without `args`) and **monitor commands**: the author MUST wrap each
   reference in double quotes so that a path with spaces stays one word, as in
   `"\"${CLAUDE_PLUGIN_ROOT}\"/scripts/process.sh"`.
3. **Bash shell-form hooks** receive the three variables in their environment (§3.3). The client
   leaves the references `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}` and `${CLAUDE_PROJECT_DIR}`
   in the command for the shell to expand from that environment, rather than writing the path into
   the command text, so a directory name holding shell syntax is never parsed as shell. In a
   monitor `command`, an MCP `headersHelper` and a skill's or command's injected `!` command
   (§4.8.3) the client writes the path into the text (Judgment J3.5).
4. **PowerShell shell-form hooks** (`"shell": "powershell"`, or the default on Windows without Git
   Bash): the client rewrites each of the three placeholders to PowerShell's `${env:NAME}` form,
   whatever declared the hook, so PowerShell reads the value from the exported environment after it
   parses the command; the reference therefore expands inside double quotes and not inside single
   quotes. A bare `$CLAUDE_PROJECT_DIR`, `$CLAUDE_PLUGIN_ROOT` or `$CLAUDE_PLUGIN_DATA` is not
   rewritten (PowerShell reads it as an undefined variable, `$null`), and the client SHOULD log a
   warning for it (`hooks.md`, "Reference scripts by path in PowerShell hooks").
5. **Validator.** For a shell-form hook in a hooks file whose `shell` is not `"powershell"`, a
   validator MUST warn when a path variable, braced or bare, stands outside quotes. Claude Code
   2.1.325 words it `Shell command uses <variables> without quotes: <command>. If the expanded path
   contains a space the command can split into several words and fail. Wrap the placeholder in
   double quotes, or use exec form: {"command": "<executable>", "args":
   ["${CLAUDE_PLUGIN_ROOT}/..."]}.`, at `hooks.<Event>`, naming the variables in order of first
   appearance (Judgment J3.20). <!-- req: environment.rule.Quoting and path separators -->

### 3.2.4 Path separators on Windows

On Windows, a substituted path uses forward slashes (`C:/Users/you/...`), so that Git Bash does not
read backslashes as escapes; Bash builtins, MSYS tools and native Windows programs all accept that
form. Two places keep native backslashes: an exec-form hook, and a hook that runs through
PowerShell. A hook run through Git Bash sees the forward-slash form in its command and in the three
exported variables. The rewrite applies to the three path variables (and `${CLAUDE_SKILL_DIR}`,
§4), never to an option value or an environment reference (Judgment J3.6).
<!-- req: environment.rule.Quoting and path separators -->

## 3.3 Process environments

Each process the client starts for a plugin inherits the client's environment (as `env` in settings
changed it, §3.6.2), minus what §3.3.1 removes, plus the variables below. A variable the client sets
replaces an inherited one of the same name (Judgment J3.7).

| Process | Path variables | Options | Session variables |
| --- | --- | --- | --- |
| Command hook (§7) | all three | `CLAUDE_PLUGIN_OPTION_<KEY>` | `CLAUDECODE`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_PID`; `CLAUDE_ENV_FILE` for the events of §3.5.2 |
| stdio MCP server (§8) | all three | none | `CLAUDECODE`, `CLAUDE_CODE_SESSION_ID` |
| LSP server (§9.1) | all three | none | none required (Judgment J3.23) |
| Monitor (§9.2) | none | none | none required (Judgment J3.23) |
| MCP `headersHelper` (§8) | `CLAUDE_PLUGIN_ROOT`, set only for a server a plugin provides | none | `CLAUDE_CODE_MCP_SERVER_NAME`, `CLAUDE_CODE_MCP_SERVER_URL` |
| Bash and PowerShell tool commands | none | none | `CLAUDECODE`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_PID` |

- **`CLAUDECODE`** MUST be `1` in the subprocesses `env-vars.md` names: Bash and PowerShell tool
  commands, tmux sessions, hook commands, status line commands and stdio MCP servers; an editor
  extension also sets it in its integrated terminal. A script reads it to know it runs under the
  client. A plugin monitor and an LSP server are not in that list, and a plugin MUST NOT rely on
  finding it there (Judgment J3.23). <!-- req: environment.host.CLAUDECODE -->
- **`CLAUDE_CODE_CHILD_SESSION`** MUST be `1` in the subprocesses the client itself starts through
  the Bash, PowerShell and Monitor tools, in hook commands and in status line commands, and MUST
  NOT be set for a stdio MCP server, which may outlive the session that started it. An editor
  extension does not set it, so it tells a process the client spawned apart from a `claude`
  started in an editor's terminal. <!-- docs: env-vars.md | Variables — CLAUDE_CODE_CHILD_SESSION -->
- **`CLAUDE_CODE_REMOTE_SESSION_ID`** is the current session's id in a cloud session, inherited by
  the commands and hooks it runs, so a script can link back to the session's transcript; outside a
  cloud session it is not set. <!-- docs: env-vars.md | Variables — CLAUDE_CODE_REMOTE_SESSION_ID -->
- **`CLAUDE_JOB_DIR`** is, in a background session, that session's `~/.claude/jobs/<id>`
  directory, inherited by the shell commands the session runs; `$CLAUDE_JOB_DIR/tmp` is a scratch
  folder that `Write` and `Edit` may use without a permission prompt, removed with the session.
  <!-- docs: env-vars.md | Variables — CLAUDE_JOB_DIR -->
- **`CLAUDE_CODE_SESSION_ID`** MUST be the current session id in Bash and PowerShell tool commands,
  hook commands and stdio MCP servers. For the tools and hooks it equals the hook input's
  `session_id` and changes on `/clear`. A stdio MCP server keeps the id it was started with; after
  `--resume <id>` that is the resumed id, after `--continue` or `--resume` without an id it MAY be
  the session's first id. <!-- req: environment.host.CLAUDE_CODE_SESSION_ID -->
- **`CLAUDE_PID`** MUST be the client's own process id in Bash and PowerShell tool commands and in
  hook commands. On Linux the Bash tool uses it to refuse a `pkill` pattern that would match the
  client itself (§13). <!-- req: environment.host.CLAUDE_PID -->
- **`CLAUDE_PLUGIN_OPTION_<KEY>`** is defined in §3.4.4. A monitor and a `headersHelper` never
  receive option values.

### 3.3.1 Subprocess environment scrub

When `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` is on, the client MUST remove credentials from the
environment of the subprocesses it starts — Bash and PowerShell tool commands, hooks, stdio MCP
servers — and keep them for its own API calls. It recognises a credential by the variable's name or
by the shape of its value. On Linux the scrub also runs Bash commands in their own PID namespace,
so they cannot read other processes' environments through `/proc`, and `ps`, `pgrep` and `kill`
cannot see host processes. <!-- req: environment.host.CLAUDE_CODE_SUBPROCESS_ENV_SCRUB -->

| Variable | Under the scrub |
| --- | --- |
| `ANTHROPIC_API_KEY` | Removed. <!-- req: environment.host.What the subprocess environment scrub removes.ANTHROPIC_API_KEY --> |
| `AWS_SECRET_ACCESS_KEY` | Removed. <!-- req: environment.host.What the subprocess environment scrub removes.AWS_SECRET_ACCESS_KEY --> |
| `NPM_TOKEN` | Removed: the name looks like a credential. <!-- req: environment.host.What the subprocess environment scrub removes.NPM_TOKEN --> |
| `DB_PASSWORD` | Removed: the name looks like a credential. <!-- req: environment.host.What the subprocess environment scrub removes.DB_PASSWORD --> |
| `DATABASE_URL` holding a password | Removed: the value looks like a credential. <!-- req: environment.host.What the subprocess environment scrub removes.DATABASE_URL --> |
| `PIP_INDEX_URL` (or `NPM_CONFIG_REGISTRY`) holding a password | Kept, with the user name and password cut from the URL. <!-- req: environment.host.What the subprocess environment scrub removes.PIP_INDEX_URL --> |
| `CLAUDE_CONFIG_DIR` | Removed. <!-- req: environment.host.What the subprocess environment scrub removes.CLAUDE_CONFIG_DIR --> |
| `GITHUB_TOKEN` | Kept, so `gh` and GitHub API scripts work. <!-- req: environment.host.What the subprocess environment scrub removes.GITHUB_TOKEN --> |
| `GH_TOKEN` | Kept. <!-- req: environment.host.What the subprocess environment scrub removes.GH_TOKEN --> |
| `GH_ENTERPRISE_TOKEN` | Kept. <!-- req: environment.host.What the subprocess environment scrub removes.GH_ENTERPRISE_TOKEN --> |
| `GITHUB_ENTERPRISE_TOKEN` | Kept. <!-- req: environment.host.What the subprocess environment scrub removes.GITHUB_ENTERPRISE_TOKEN --> |
| `HTTP_PROXY` | Kept, a user name and password in the URL included; the sandbox may set it itself for sandboxed commands (§13). <!-- req: environment.host.What the subprocess environment scrub removes.HTTP_PROXY --> |
| `HTTPS_PROXY` | Kept, as `HTTP_PROXY`. <!-- req: environment.host.What the subprocess environment scrub removes.HTTPS_PROXY --> |
| `GIT_CONFIG_COUNT` | Kept, whatever it holds. <!-- req: environment.host.What the subprocess environment scrub removes.GIT_CONFIG_COUNT --> |
| `GIT_CONFIG_KEY_<n>` | Kept, whatever it holds. <!-- req: environment.host.What the subprocess environment scrub removes.GIT_CONFIG_KEY_<n> --> |
| `GIT_CONFIG_VALUE_<n>` | Kept, whatever it holds. <!-- req: environment.host.What the subprocess environment scrub removes.GIT_CONFIG_VALUE_<n> --> |
| A secret whose name and value look like nothing | Kept. |

The exact name words and value shapes are Judgment J3.8. A client implementing a release before
2.1.251 removes only `ANTHROPIC_API_KEY` and `AWS_SECRET_ACCESS_KEY`.

`CLAUDE_CODE_MCP_ALLOWLIST_ENV`, when on, starts each stdio MCP server with only a safe baseline
environment plus the server's own `env`, instead of the inherited environment.
<!-- req: environment.host.CLAUDE_CODE_MCP_ALLOWLIST_ENV --> A plugin's server still receives the
three path variables of §3.1 under it (Judgment J3.22).

## 3.4 User configuration

`userConfig` (§2.2) declares the values the client asks the user for when the plugin is enabled, so
that a user never edits a settings file by hand. It is an object of option key to option.

### 3.4.1 Keys and fields

1. A key MUST consist of ASCII letters, digits and `_`, and MUST NOT start with a digit
   (`[A-Za-z_][A-Za-z0-9_]*`). Any other key fails validation (`userConfig.<key>: Invalid key in
   record`, oracle 2.1.325) and the plugin does not load.
2. Each option is a **strict object** (§2.1): an unknown field fails validation
   (`userConfig.<key>: Unrecognized key: "<field>"`) and the plugin does not load.

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `type` | `"string"`, `"number"`, `"boolean"`, `"directory"` or `"file"` | yes | The kind of value. Any other value fails validation, `userConfig.<key>.type: Invalid option: expected one of "string"\|"number"\|"boolean"\|"directory"\|"file"`, and the plugin does not load. A `directory` or `file` value is a path string. <!-- req: userConfig.field.type --> |
| `title` | string | yes | The label shown in the configuration dialog. <!-- req: userConfig.field.title --> |
| `description` | string | yes | Help text shown beneath the field. <!-- req: userConfig.field.description --> |
| `required` | boolean | no | When `true`, the dialog does not accept an empty value. <!-- req: userConfig.field.required --> |
| `default` | string, number, boolean or array of strings | no | The value used when the user provides none. <!-- req: userConfig.field.default --> |
| `options` | array of strings | no | For a `string` field, the only values it accepts, shown as a picker (§3.4.2). <!-- req: userConfig.field.options --> |
| `multiple` | boolean | no | For a `string` field, the value may be an array of strings. <!-- req: userConfig.field.multiple --> |
| `sensitive` | boolean | no | When `true`, the dialog masks the input and the value goes to secure storage, not to a settings file (§3.4.3). <!-- req: userConfig.field.sensitive --> |
| `min` | number | no | The lower bound of a `number` value. <!-- req: userConfig.field.min --> |
| `max` | number | no | The upper bound of a `number` value. <!-- req: userConfig.field.max --> |

A missing required field fails validation, as `userConfig.<key>.title: Invalid input: expected
string, received undefined`. The client MUST NOT reject an option because its `default` has a type
other than its `type`, or because `min` and `max` are set on another type or in the wrong order:
Claude Code accepts both (Judgment J3.9).

Every option of every enabled plugin, except a `sensitive` option and a `multiple` one, MUST also
appear as a row of the client's settings panel (`/config`), where it can be changed; an option with
`options` is a picker there.

```json
{
  "userConfig": {
    "api_endpoint": {
      "type": "string",
      "title": "API endpoint",
      "description": "Your team's API endpoint"
    },
    "api_token": {
      "type": "string",
      "title": "API token",
      "description": "API authentication token",
      "sensitive": true
    }
  }
}
```

### 3.4.2 Fixed options

`options` limits a field to a fixed list. A plugin whose `options` break any rule below does not
load, and a validator reports the rule at the path shown (messages of Claude Code 2.1.325, Judgment
J3.10). <!-- req: userConfig.rule.Limit a field to fixed options -->

| Rule | Validator message |
| --- | --- |
| The field is `type: "string"` and neither `multiple` nor `sensitive` is `true`. | `userConfig.<key>.options: options is only for a field of type "string" that is neither multiple nor sensitive` |
| The list holds at least one value. | `userConfig.<key>.options: options needs at least one value` |
| Each value is 1 to 64 Unicode code points long. | `userConfig.<key>.options.<i>: An option cannot be empty` / `An option can be at most 64 characters` |
| No value starts or ends with a space. | `userConfig.<key>.options.<i>: An option cannot start or end with a space` |
| No value holds a control, invisible (such as U+200B) or bidirectional-formatting character. | `userConfig.<key>.options.<i>: An option cannot contain control, invisible or bidirectional-formatting characters` |
| No two values are equal ignoring letter case. | `userConfig.<key>.options: options cannot repeat a value (in any letter case)` |
| `default`, when set, is one of the values, compared exactly. | `userConfig.<key>.default: default must be one of the options: <values>` |
| Without `default`, `required` is `true` (Judgment J3.11). | `userConfig.<key>.default: a field with options needs a default among them, or required: true` |

A value may otherwise hold any characters, inner spaces, commas and non-ASCII letters included.

```json
{
  "userConfig": {
    "tone": {
      "type": "string",
      "title": "Tone",
      "description": "Voice for generated replies",
      "options": ["neutral", "warm", "formal"],
      "default": "neutral"
    }
  }
}
```

`options` needs Claude Code 2.1.271 or later; an older release cannot load a plugin that declares it
on any field (non-normative).

### 3.4.3 Where values are stored

1. The client MUST save a non-sensitive value under `pluginConfigs["<plugin id>"].options["<key>"]`
   in the user's settings file (§12), as a string, number, boolean or array of strings. It reads
   `pluginConfigs` from user and managed settings only; for one plugin id, the entry of the
   higher-precedence file applies whole (§12, Judgment J12.3).
2. The client MUST save a sensitive value in the platform's secure credential store, never in a
   settings file. On macOS that is the Keychain, falling back to `~/.claude/.credentials.json` when
   the Keychain refuses the write; on a platform without a supported keychain it is
   `~/.claude/.credentials.json` (`settings-reference.md`, "`pluginConfigs`").
3. Uninstalling a plugin from the last scope it is installed at deletes its saved options and
   secrets, except when the install records cannot be read back (§16). Removing a marketplace from
   the last scope that declares it does the same for every plugin it uninstalls.
   <!-- req: userConfig.rule.Where values are stored -->

### 3.4.4 Referencing a saved value

The **value** of an option is its saved value (§3.4.3), else its `default`, else none. An option
is **set** only when it has a saved value: a `default` gives it a value but does not set it, so
the configuration dialog (§3.4.6) and `claude plugin configure` (§17.10, which lists such an option
as `not set`) still treat it as unset. A key the
manifest does not declare has no value, whatever is saved under it (Judgment J3.12). A component
reads the value in one of two ways. <!-- req: userConfig.rule.Reference a saved value -->

1. **`${user_config.KEY}`** is substituted in MCP server configuration (§8, every field of
   §3.2.1's MCP rows except `headersHelper`, which refuses it, §3.4.5), LSP server configuration (`command`, `args`, `env`, `workspaceFolder`), the
   `command` and `args` of an exec-form hook, and skill, command and agent content.
   - In skill, command and agent content only a non-sensitive value is substituted. A sensitive
     option's reference becomes the placeholder `[sensitive option '<key>' not available in skill
     content]`, whether or not a value is saved (Judgment J3.14), so a secret never reaches the
     model.
   - A reference to an option with no value stays as written (§3.2.2). In an MCP `url` it leaves
     the URL invalid, and the server does not start (§8).
   - A number or boolean is written as its JSON text (`8080`, `true`), an array as its strings
     joined by `,` (Judgment J3.13).
2. **`CLAUDE_PLUGIN_OPTION_<KEY>`** is exported to every hook process of the plugin, for every
   option that has a value, sensitive ones included, with `<KEY>` the key in upper case: option
   `api_token` is `$CLAUDE_PLUGIN_OPTION_API_TOKEN`. The value is written as in item 1. No other
   process receives it. <!-- req: userConfig.rule.Reference a saved value -->

A validator MUST report as an error a `${user_config.KEY}` in an MCP server whose key the manifest
(or the server's `channels` entry, §9.3) does not declare (§2.9). A channel's own `userConfig`
options are substituted into its server's `env` and win over a top-level option of the same key
(§9.3, Judgment J3.21).

### 3.4.5 Fields that run through a shell

Three fields are handed to a shell, which would parse a substituted value again: a value holding
`$(...)`, a backtick or `;` would run as code. The client MUST NOT substitute `${user_config.*}`
into them. A component whose field references an option (a `${user_config.KEY}` whose `KEY` is a
valid option key, §3.4.1) MUST fail to start with the error below instead of running. The check
reads the template, not a value, so it fails even when nothing is configured yet (`errors.md`,
"Plugin command references user_config in a shell command"; Judgment J3.15).

| Field | The error | How a value can reach it |
| --- | --- | --- |
| Shell-form hook `command` (no `args`, §7) | `Hook from plugin <plugin id> references ${user_config.*} in a shell-form command. The substituted value would be re-parsed by the shell. Use exec form instead — {"command": "<executable>", "args": ["${user_config.KEY}", ...]} — or read $CLAUDE_PLUGIN_OPTION_<KEY> from the hook's environment. Command: <command as written>` <!-- req: userConfig.shell.Shell-form hook commands --> | Exec form with the reference in `args`, or `$CLAUDE_PLUGIN_OPTION_<KEY>` read from the hook's environment. |
| Monitor `command` (§9.2) | `Monitor "<name>" from plugin <plugin> references ${user_config.*} in its command. The substituted value would be passed to a shell. Monitor commands cannot safely reference ${user_config.*}; have the monitor script read the value from a config file or prompt instead.` <!-- req: userConfig.shell.Monitor commands --> | Not through the client: a monitor receives no `CLAUDE_PLUGIN_OPTION_<KEY>`, so its script obtains the value itself. |
| MCP `headersHelper` (§8) | `headersHelper for MCP server '<server>' references ${user_config.*}. The substituted value would be passed to a shell; read the value inside the helper script instead (e.g. from an env var set in the server's "env" block).` The server is reported as misconfigured. <!-- req: userConfig.shell.headersHelper --> | Not through the client: the helper's environment carries `CLAUDE_PLUGIN_ROOT`, `CLAUDE_CODE_MCP_SERVER_NAME` and `CLAUDE_CODE_MCP_SERVER_URL` and no option. Put the reference in `headers`, which no shell parses, or have the script read the value. |

A client implementing a release before 2.1.207 substitutes the value into these fields; this
specification states 2.1.330, which refuses it.

### 3.4.6 When the configuration dialog appears

The configuration dialog belongs to the interactive plugin manager (`/plugin`). It MUST open, for
every option that is not set (no saved value, whether or not it has a `default`, §3.4.4), when the
user: <!-- req: userConfig.components.When the configuration dialog appears -->

- installs the plugin in `/plugin`, including from its Discover tab;
- runs `/plugin install <plugin>@<marketplace>` inside a session;
- enables the plugin from the Installed tab of `/plugin`.

Each option shows its `title` as the label and its `description` beneath it; a `sensitive` option's
input is masked. `/plugin configure <plugin>@<marketplace>` opens the same dialog at any time, with
every option. A client embedded in an editor MAY present the dialog as a form after an install,
with a control on the plugin's row that opens it again with every option.

The `claude plugin install` command never prompts: it saves the `--config KEY=VALUE` values it is
given and says which options remain unset, as §17.4.1 states. `claude plugin configure
--values-stdin` saves a JSON object of values afterward (§17.10). <!-- req: userConfig.components.When the configuration dialog appears -->

## 3.5 Hooks that prepare the environment

### 3.5.1 Installing dependencies into the data directory

For a marketplace-installed plugin the client installs eligible Node.js package dependencies itself
when it caches the plugin (§16). A plugin that installs its own dependencies SHOULD put them under
`${CLAUDE_PLUGIN_DATA}`, which survives updates, and install them again only when the plugin's
manifest of dependencies changes. In this example a `SessionStart` hook runs a script of the
plugin, which reads the path variables from its environment (§3.3):

```json
{
  "hooks": {
    "SessionStart": [
      { "hooks": [{ "type": "command", "command": "\"${CLAUDE_PLUGIN_ROOT}/scripts/sync-deps.sh\"" }] }
    ]
  }
}
```

```sh
#!/bin/sh
# scripts/sync-deps.sh: install the npm dependencies into the data directory when package.json
# differs from the copy kept beside them after the last successful install.
wanted="$CLAUDE_PLUGIN_ROOT/package.json"
installed="$CLAUDE_PLUGIN_DATA/package.json"
cmp -s "$wanted" "$installed" && exit 0
cp "$wanted" "$installed"
if ! npm install --prefix "$CLAUDE_PLUGIN_DATA" --omit=dev --no-fund; then
  rm -f "$installed"   # so the next session start tries again
  exit 1
fi
```

An MCP server of the plugin then reaches the modules by setting `NODE_PATH` to
`${CLAUDE_PLUGIN_DATA}/node_modules` in its `env`, where the reference resolves (§3.2.1). Because
the client creates the data directory before the hook runs (§3.1.2), the script can write into it
without creating it first.
<!-- req: environment.components.Install dependencies into the data directory -->

### 3.5.2 `CLAUDE_ENV_FILE`

`CLAUDE_ENV_FILE` names a shell script the client runs before each Bash tool command, in the same
shell process, so that its exports are visible to the command (a virtualenv or conda activation,
for example). A user MAY set it; the client also gives `SessionStart`, `Setup`, `CwdChanged` and
`FileChanged` hooks a `CLAUDE_ENV_FILE` of the session's own, to which a hook appends `export`
lines, and hooks of other events receive none. A PowerShell tool command receives the persisted
variables too, under the conditions of §7 (`hooks.md`, "Persist environment variables").
<!-- req: environment.host.CLAUDE_ENV_FILE -->

### 3.5.3 Reloading skills a hook installs

The client discovers skills before the `SessionStart` hooks finish. When a `SessionStart` hook's
output sets `reloadSkills: true` (§7), the client MUST scan the skill and command directories again
after every `SessionStart` hook has completed and before the first prompt runs, so that skills a
hook wrote into `~/.claude/skills/` or `.claude/skills/` are available in the same session
(`hooks.md`, "Reload skills that a hook installs"). <!-- req: environment.behavior.Reload skills that a hook installs -->

## 3.6 Environment variables of Claude Code

The client reads the variables below and they change what this specification says it does with
plugins. A variable not listed here does not change plugin behaviour.

### 3.6.1 Values

1. An **on/off** variable is on for `1`, `true`, `yes` or `on` and off for `0`, `false`, `no` or
   `off`, in any letter case and ignoring surrounding white space; any other value, and an unset
   variable, leaves the default. This holds for every variable documented as "set to `1`"
   (Judgment J3.16). Two variables are exceptions: `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` and
   `DISABLE_TELEMETRY` are on for **any non-empty value**, `0` and `false` included.
2. A **numeric** variable accepts plain digits, scientific notation (`2e3` is 2000) and digit
   separators (`64_000` is 64000), unless its row says plain digits only. A value it cannot read
   leaves the default (Judgment J3.17).
3. A **list of paths** is separated by `:` on Unix and `;` on Windows; an empty entry is skipped
   (Judgment J3.18).

### 3.6.2 Setting variables and precedence

A variable reaches the client from its launch environment, read once at startup, or from the `env`
object of a settings file (§12). The client copies `env` values into its own environment as
written: no shell processes them, so `~` and `$HOME` stay literal and a path MUST be absolute. A
saved change to a settings file's `env` applies to the running session, except for a feature that
reads its variables once at startup, and removing an entry takes effect only at the next launch.
The file decides who the variable applies to:

| File | Applies to |
| --- | --- |
| `~/.claude/settings.json` | The user, in every project. <!-- req: environment.host.Set variables in settings files.~/.claude/settings.json --> |
| `.claude/settings.json` | Everyone working in the project; checked into source control. <!-- req: environment.host.Set variables in settings files..claude/settings.json --> |
| `.claude/settings.local.json` | The user, in this project only; gitignored when the client creates it. <!-- req: environment.host.Set variables in settings files..claude/settings.local.json --> |
| Managed settings | Everyone in the organisation, deployed by an administrator (§14). <!-- req: environment.host.Set variables in settings files.Managed settings --> |

Precedence: <!-- req: environment.host.Precedence -->

1. A settings `env` value replaces the inherited value of the same variable, except in a session
   whose launch environment is built by a hosting application, where an inherited value wins and
   the client logs each ignored variable (§12).
2. Between settings files, `env` follows settings precedence (§12): a managed value wins over user
   and project values. Project and local settings cannot set the variables §12 lists, among them
   `CLAUDE_CONFIG_DIR`, `CLAUDE_CODE_TMPDIR` and the OpenTelemetry exporter variables; the client
   drops each with a debug-log warning.
3. A settings file can set a variable but cannot unset one. An empty value is treated as unset for
   provider selection; subprocesses still inherit the empty value.
4. Where a variable and a setting or flag configure the same behaviour, which one wins differs per
   pair, and the row of the variable below or the chapter it names states it: for example
   `ANTHROPIC_MODEL` is read before the `model` setting, which applies only while the variable is
   unset, and `--model` and `/model` override `ANTHROPIC_MODEL`, while `CLAUDE_CODE_EFFORT_LEVEL`
   overrides `--effort` and `/effort` (`env-vars.md`, "Precedence"). For the hook and plugin
   variables of this chapter the variable applies over the matching setting only where its row says
   so.
5. A launch-environment variable is read at startup, so changing it takes effect at the next
   launch; a settings `env` value is applied again when the file changes, as above.

### 3.6.3 Plugin loading, storage and install

| Variable | Effect |
| --- | --- |
| `CLAUDE_CONFIG_DIR` | The configuration directory, default `~/.claude`. Settings, session history and the plugins root (§3.1.2) live under it. Settable in the shell, user or managed settings, as an absolute path; ignored in project and local settings. <!-- req: environment.host.CLAUDE_CONFIG_DIR --> |
| `CLAUDE_CODE_PLUGIN_CACHE_DIR` | The plugins root itself, default `<config dir>/plugins`: marketplaces, the plugin cache and the data directories live in its subdirectories. It wins over the root derived from `CLAUDE_CONFIG_DIR` (Judgment J3.1). <!-- req: environment.host.CLAUDE_CODE_PLUGIN_CACHE_DIR --> |
| `CLAUDE_CODE_PLUGIN_SEED_DIR` | One or more read-only seed directories, laid out like a plugins root. At startup the client registers the marketplaces they hold and uses their cached plugins without cloning again (§16). <!-- req: environment.host.CLAUDE_CODE_PLUGIN_SEED_DIR --> |
| `CLAUDE_CODE_PLUGIN_DIRS` | Plugin directories to load for the session, each as a `--plugin-dir` flag loads it (§16, §17). Each entry MUST be absolute or start with `~`; a relative entry is skipped. <!-- req: environment.host.CLAUDE_CODE_PLUGIN_DIRS --> |
| `CLAUDE_CODE_PLUGIN_DIR_WATCH` | Whether a mod reloads when its files change (§10). Default: a mod of a skills-directory plugin (§4.5.1) reloads in any session that takes more than one prompt, non-interactive included; a mod loaded with `--plugin-dir` reloads only in an interactive terminal session. On makes `--plugin-dir` mods reload as skills-directory mods do; off turns reloading off everywhere. <!-- req: environment.host.CLAUDE_CODE_PLUGIN_DIR_WATCH --> |
| `CLAUDE_CODE_SYNC_PLUGIN_INSTALL` | In non-interactive mode (`-p`), wait for pending plugin installs to finish before the first query. Without it plugins install in the background and MAY be missing on the first turn. <!-- req: environment.host.CLAUDE_CODE_SYNC_PLUGIN_INSTALL --> |
| `CLAUDE_CODE_SYNC_PLUGIN_INSTALL_TIMEOUT_MS` | The longest that wait lasts; past it the client goes on without the plugins and logs an error. No default: without it the wait is unbounded. <!-- req: environment.host.CLAUDE_CODE_SYNC_PLUGIN_INSTALL_TIMEOUT_MS --> |
| `CLAUDE_CODE_ENABLE_BACKGROUND_PLUGIN_REFRESH` | In non-interactive mode, refresh plugin state at turn boundaries after a background install completes. Off by default, because the refresh changes the system prompt mid-session. <!-- req: environment.host.CLAUDE_CODE_ENABLE_BACKGROUND_PLUGIN_REFRESH --> |
| `CLAUDE_CODE_TMPDIR` | The base of the client's temp files; the client appends `/claude-<uid>/` on Unix and `/claude/` on Windows. Default `/tmp` on macOS, the OS temp directory elsewhere. On macOS and Linux a sandboxed Bash command gets a short fallback `$TMPDIR` under the system default when the override is long; an unsandboxed one inherits the shell's `$TMPDIR` when it is set. On native Windows, when the shell sets no `$TMPDIR`, a Bash command that references it receives the override, or `%TEMP%` without one. The client's own temp files always use the override. Ignored in project and local settings. <!-- req: environment.host.CLAUDE_CODE_TMPDIR --> |
| `CLAUDE_CODE_DISABLE_POLICY_SKILLS` | Skip the skills of the system-wide managed skills directory (§4, §14). <!-- req: environment.host.CLAUDE_CODE_DISABLE_POLICY_SKILLS --> |
| `CLAUDE_CODE_DISABLE_WORKFLOWS` | Turn workflows off, as the `disableWorkflows` setting does (§11). <!-- req: environment.host.CLAUDE_CODE_DISABLE_WORKFLOWS --> |
| `SLASH_COMMAND_TOOL_CHAR_BUDGET` | The character budget for skill metadata listed to the Skill tool, in place of the default: 1% of the context window, 8,000 characters when that is unknown (§4). <!-- req: environment.host.SLASH_COMMAND_TOOL_CHAR_BUDGET --> |

Plugins loaded for one session with `--plugin-dir` or `CLAUDE_CODE_PLUGIN_DIRS` belong to that
launch. A session resumed with `--resume` or `--continue` does not restore the original launch's
`--plugin-dir` (nor `--settings` or `--mcp-config`): it resumes without those plugins unless they
are passed again, while plugins enabled in settings files load as usual, since those files are read
again at launch. <!-- docs: sessions.md | What a resumed session restores --> <!-- docs: cli-reference.md | CLI flags — --continue / -c --> <!-- docs: cli-reference.md | CLI flags — --resume / -r -->
Backgrounding a session is different: the backgrounded session keeps the original `--plugin-dir`,
`--settings`, `--setting-sources` and `--mcp-config`, so its plugins stay loaded.
<!-- docs: agent-view.md | What carries over when you background -->

### 3.6.4 Marketplaces and updates

| Variable | Effect |
| --- | --- |
| `CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS` | The timeout of cloning or refreshing a marketplace, default 120000 (§15). <!-- req: environment.host.CLAUDE_CODE_PLUGIN_GIT_TIMEOUT_MS --> |
| `CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE` | When a refresh cannot reach or authenticate to the remote, keep the existing checkout and skip the attempt to clone again (§15). <!-- req: environment.host.CLAUDE_CODE_PLUGIN_KEEP_MARKETPLACE_ON_FAILURE --> |
| `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` | Clone a GitHub `owner/repo` source over HTTPS instead of SSH, for plugin install and update and for marketplace add and update (§15, §16). <!-- req: environment.host.CLAUDE_CODE_PLUGIN_PREFER_HTTPS --> |
| `CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL` | Skip the automatic registration of the official marketplace. The client reads it when it is about to register (usually a machine's first interactive launch); a skip is permanent, and unsetting the variable later does not undo it (§15). <!-- req: environment.host.CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL --> |
| `DISABLE_AUTOUPDATER` | Turn off automatic background updates of the client; a manual update still works. It also stops plugin auto-updates unless `FORCE_AUTOUPDATE_PLUGINS` is on (§16). <!-- req: environment.host.DISABLE_AUTOUPDATER --> |
| `DISABLE_UPDATES` | Block every update of the client, manual ones included; stricter than `DISABLE_AUTOUPDATER`. <!-- req: environment.host.DISABLE_UPDATES --> |
| `FORCE_AUTOUPDATE_PLUGINS` | Auto-update plugins even while `DISABLE_AUTOUPDATER` is on (§16). <!-- req: environment.host.FORCE_AUTOUPDATE_PLUGINS --> |
| `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` | Turn off nonessential network traffic (auto-updates, telemetry, error reporting, release notes, availability checks) and feature-flag fetching. It also stops the background runs of plugin `command` sources (§15), though they are local, because they can install dependencies. It does not stop the official marketplace auto-install. On for any non-empty value (§3.6.1). <!-- req: environment.host.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC --> |
| `DISABLE_TELEMETRY` | Opt out of telemetry and turn off feature-flag fetching. On for any non-empty value. <!-- req: environment.host.DISABLE_TELEMETRY --> |
| `DO_NOT_TRACK` | The same effect as `DISABLE_TELEMETRY`, read as an ordinary on/off variable, so `0` leaves telemetry on. <!-- req: environment.host.DO_NOT_TRACK --> |

With feature-flag fetching off, the features `env-vars.md` lists under "Features that need
feature-flag fetching" are unavailable; for plugins that includes syncing the plugins enabled for
the user's claude.ai account (§16) and `/skill-doctor`.

### 3.6.5 Hooks

| Variable | Effect |
| --- | --- |
| `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` | The time budget of the `SessionEnd` hooks, and the timeout of each one that sets none. Default 1.5 seconds, raised to the highest per-hook `timeout` in settings files up to 60 seconds; a plugin hook's `timeout` never raises it. Applies to exit, `/clear` and switching sessions with `/resume` (§7). <!-- req: environment.host.CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS --> |
| `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` | How many consecutive times `Stop` or `SubagentStop` hooks may keep a turn from ending before the client ends it anyway, default 8; `0` removes the cap (§7). <!-- req: environment.host.CLAUDE_CODE_STOP_HOOK_BLOCK_CAP --> |
| `CLAUDE_CODE_DISABLE_PERMISSION_PROMPT_NOTIFY_HOOKS` | Do not run `Notification` hooks for unanswered permission requests in a session whose permission requests go to an SDK `canUseTool` callback (a desktop app or an editor extension). No effect in a terminal session (§7). <!-- req: environment.host.CLAUDE_CODE_DISABLE_PERMISSION_PROMPT_NOTIFY_HOOKS --> |
| `CLAUDE_CODE_SHELL_PREFIX` | A command that wraps the shell commands the client spawns: Bash tool calls, shell-form hook commands, status line commands and stdio MCP server start commands. Each runs as `<prefix> '<command>'`, the whole command line one shell-quoted argument the wrapper re-runs with a shell (`exec bash -c "$1"`); for a Bash tool call that argument is the full invocation the client assembles. PowerShell hooks and exec-form hooks run without it. How it applies to a hook is §7.3, to a stdio server §8.2.1. <!-- docs: env-vars.md | Variables — CLAUDE_CODE_SHELL_PREFIX --> |
| `CLAUDE_CODE_EXPERIMENTAL_CODE_MODE` | `1` starts new sessions in Code Mode, which changes the tool calls a plugin's hooks see (§7.6.11). Only the launch environment, user settings and a `--settings` file can turn it on; the client ignores the variable in project and local settings, so a repository cannot turn it on, and a `1` in managed settings does not turn it on either. A `0` in any of the launch environment, user settings, a `--settings` file or managed settings keeps it off whatever is set elsewhere; a managed `0` blocks it for the organization, and a session started in Code Mode cannot be resumed while it is off. <!-- docs: env-vars.md | Variables — CLAUDE_CODE_EXPERIMENTAL_CODE_MODE --> <!-- docs: code-mode.md | Block Code Mode for your organization --> <!-- docs: settings-reference.md | Variables Claude Code ignores in env --> |

`CLAUDECODE`, `CLAUDE_CODE_CHILD_SESSION`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_PID`, the session
variables of §3.3 and `CLAUDE_ENV_FILE` are §3.3 and §3.5.2; `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB` is
§3.3.1.

### 3.6.6 MCP servers

| Variable | Effect |
| --- | --- |
| `MCP_TIMEOUT` | The timeout of one server's startup, default 30000 ms (§8). <!-- req: environment.host.MCP_TIMEOUT --> |
| `MCP_TOOL_TIMEOUT` | The timeout of one tool call, default 100000000 ms. HTTP, SSE and claude.ai connector servers also time out each request after 60 s (stdio and WebSocket servers have no per-request timer); a value of the variable or of a server's `timeout` above 60000 raises that limit, a lower one shortens only the overall timeout. A server's own `timeout` overrides the variable for that server, and is ignored below 1000. Values of the variable below 1000 count as 1000 (§8). <!-- req: environment.host.MCP_TOOL_TIMEOUT --> |
| `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` | Abort a tool call when its server sends no response and no progress notification for this long. Defaults 300000 ms for network servers and 1800000 ms for stdio; `0` turns the check off; raised to at least 1000, capped at the effective `MCP_TOOL_TIMEOUT`, and raised to a server's `timeout` of at least 1000. Not for IDE or in-process servers (§8). <!-- req: environment.host.CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT --> |
| `MCP_CONNECTION_NONBLOCKING` | Startup does not wait for servers by default; `0` makes the first query wait. A server with `alwaysLoad: true` makes startup wait regardless, unless served from the discovery cache, and `-p` without stream-json input waits for pending servers anyway (§8). <!-- req: environment.host.MCP_CONNECTION_NONBLOCKING --> |
| `MCP_CONNECT_TIMEOUT_MS` | How long a blocking startup waits for the connection batch before taking the tool list, default 5000; servers still pending keep connecting in the background (§8). <!-- req: environment.host.MCP_CONNECT_TIMEOUT_MS --> |
| `CLAUDE_CODE_MCP_STARTUP_WAIT_MS` | How long the first turn of a non-interactive session waits for servers still connecting, in place of the default wait; `0` skips it except for servers that keep a wait of their own (§8). <!-- req: environment.host.CLAUDE_CODE_MCP_STARTUP_WAIT_MS --> |
| `MCP_SERVER_CONNECTION_BATCH_SIZE` | How many stdio servers connect in parallel at startup, default 3. <!-- req: environment.host.MCP_SERVER_CONNECTION_BATCH_SIZE --> |
| `MCP_REMOTE_SERVER_CONNECTION_BATCH_SIZE` | How many HTTP and SSE servers connect in parallel at startup, default 20. <!-- req: environment.host.MCP_REMOTE_SERVER_CONNECTION_BATCH_SIZE --> |
| `CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS` | How long a tool call runs before it moves to a background task, default 120000; `0` turns this off and, interactively, makes Claude wait for MCP tasks (§8). <!-- req: environment.host.CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS --> |
| `CLAUDE_CODE_DISABLE_MCP_TASK_BACKGROUND` | In an interactive session Claude waits for an MCP task's result; automatic backgrounding still moves the call after its delay (§8). <!-- req: environment.host.CLAUDE_CODE_DISABLE_MCP_TASK_BACKGROUND --> |
| `MAX_MCP_OUTPUT_TOKENS` | The token limit of a tool result, default 25000, with a warning above 10,000. A tool with `anthropic/maxResultSizeChars` uses that limit for its text but this one for images; a text result over 50,000 characters from a tool without it is saved to a file (§8). <!-- req: environment.host.MAX_MCP_OUTPUT_TOKENS --> |
| `CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH` | The character limit of tool descriptions and server instructions sent to the model, replacing both defaults (4096, and 16384 for a tool loaded through tool search). Plain digits only (§8). <!-- req: environment.host.CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH --> |
| `MCP_DISCOVERY_CACHE` | Turn the discovery cache on or off; with it on, a remote server used before shows as `cached` and connects at its first tool call. Off by default unless a rollout enabled it; `0` keeps it off regardless (§8). <!-- req: environment.host.MCP_DISCOVERY_CACHE --> |
| `MCP_DISCOVERY_CACHE_TTL_S` | How long a cache entry is used without a refresh, default 900 s; an older entry is used and refreshed in the background. Capped at `MCP_DISCOVERY_CACHE_MAX_STALE_S`. <!-- req: environment.host.MCP_DISCOVERY_CACHE_TTL_S --> |
| `MCP_DISCOVERY_CACHE_MAX_STALE_S` | The oldest a cache entry may be, default 14400 s, capped at 7 days; an older entry is discarded and the server connects at startup. <!-- req: environment.host.MCP_DISCOVERY_CACHE_MAX_STALE_S --> |
| `MCP_DISCOVERY_CACHE_STRIKES` | How many background refreshes in a row may fail before the entry is discarded, default 1. <!-- req: environment.host.MCP_DISCOVERY_CACHE_STRIKES --> |
| `MCP_SDK_GENERATION` | Pin the MCP client runtime, `v1` or `v2` (default `v2`); read once per process; an unknown value is ignored with a debug-log warning (§8). <!-- req: environment.host.MCP_SDK_GENERATION --> |
| `MCP_PROTOCOL_NEGOTIATION` | On the v2 runtime: `legacy` keeps every server on the earlier handshake, `auto` probes the server kinds that support the newer revision; unset probes them with some servers skipped; any other value is ignored with a warning (§8). <!-- req: environment.host.MCP_PROTOCOL_NEGOTIATION --> |
| `MCP_CLIENT_SECRET` | The OAuth client secret for a server with pre-configured credentials, so that adding it asks no secret (§8). <!-- req: environment.host.MCP_CLIENT_SECRET --> |
| `MCP_OAUTH_CALLBACK_PORT` | A fixed port for the OAuth redirect, as `--callback-port` sets it (§8). <!-- req: environment.host.MCP_OAUTH_CALLBACK_PORT --> |
| `ENABLE_CLAUDEAI_MCP_SERVERS` | `false` stops the client fetching the servers of the user's claude.ai account; on by default for a signed-in user (§8). <!-- req: environment.host.ENABLE_CLAUDEAI_MCP_SERVERS --> |

`CLAUDE_CODE_MCP_ALLOWLIST_ENV` is §3.3.1.

### 3.6.7 Subagents

| Variable | Effect |
| --- | --- |
| `CLAUDE_CODE_SUBAGENT_MODEL` | The model of a subagent, teammate or workflow agent that no other source assigns one. A model given at spawn and an agent definition's `model` (including `inherit`) win over it; `inherit` is the same as unset (§5.8.2, Judgment J5.20). <!-- req: environment.host.CLAUDE_CODE_SUBAGENT_MODEL --> |
| `CLAUDE_CODE_SUBAGENT_MODEL_FORCE` | Force one model onto every subagent, teammate and workflow agent, over the sources above (§5.8.5). <!-- req: environment.host.CLAUDE_CODE_SUBAGENT_MODEL_FORCE --> |
| `CLAUDE_CODE_SUBAGENT_EFFORT` | The default effort level of subagents and workflow agents: `low`, `medium`, `high`, `xhigh` or `max`. It applies after `CLAUDE_CODE_EFFORT_LEVEL` and the spawning subagent's or the turn's level, and never to forks, forked skills or teammates (§5.8.7, §11). <!-- req: environment.host.CLAUDE_CODE_SUBAGENT_EFFORT --> |
| `CLAUDE_CODE_SUBAGENT_HISTORY` | `0` removes the task-list row from which the user reopens subagents that have ended (§5.12.3). <!-- req: environment.host.CLAUDE_CODE_SUBAGENT_HISTORY --> |
| `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` | How many subagents may run at once in a session before the Agent tool refuses another, default 20. A positive whole number in plain digits; anything else is ignored, so the cap cannot be removed (§5). <!-- req: environment.host.CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS --> |
| `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` | How many subagent layers may sit below the main conversation, default 3; `1` turns nesting off. Plain digits only; anything else is ignored (§5). <!-- req: environment.host.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH --> |

## Design decisions

### Why a shell never sees an option value

An option value comes from the user or from whoever wrote their settings, and a path comes from
where the client put the plugin; neither was written for a shell. A shell-form hook, a monitor and a
`headersHelper` hand their whole text to a shell, so a value pasted there could close a quote and
run a command. Exec form and the environment are the two channels a value can take without being
parsed: an argument vector and a variable are data, never code. The same reason makes the client
leave path references in a Bash shell-form hook for the shell to expand, and makes PowerShell read
them as `${env:NAME}`.

### Why the refusal reads the template

Refusing only when a value is set would make a plugin work on the author's machine, with nothing
configured, and fail on a user's. Reading the template fails the plugin the same way everywhere,
before anything runs.

### Why secrets stay out of model content

A skill's body is sent to the model and may be echoed into a transcript. A sensitive option is
promised secure storage; substituting it into content would undo that promise, so the content gets
a placeholder that names the option and holds nothing.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J3.1 | The data directories live under the plugins root. `CLAUDE_CODE_PLUGIN_CACHE_DIR`, which names the root itself, wins over `<CLAUDE_CONFIG_DIR>/plugins`; an empty value of either is no override (§3.1.2, §3.6.3). | `plugins/loading.md`, "Find plugins on disk", lists `data/<plugin-id>/` under the one plugins root that `CLAUDE_CODE_PLUGIN_CACHE_DIR` moves; `env-vars.md` says `CLAUDE_CONFIG_DIR` holds plugins too but not which wins. The reference implementation decides the same (`src/marketplace/store-layout.ts`). |
| J3.2 | Exporting `CLAUDE_PLUGIN_DATA` to a hook, stdio MCP or LSP process counts as a reference, so the directory is created before the process starts (§3.1.2). | The docs say the directory is "created on first reference" and that these processes receive the variable; a process given a path that does not exist would fail its first `cd`, as §3.5.1's documented hook does. |
| J3.3 | A hook no plugin declares keeps `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}` and `${user_config.*}` as written, exports only `CLAUDE_PROJECT_DIR`, and is not refused for a shell-form `${user_config.*}` (§3.2.1). | `hooks.md` says "Plugin hooks additionally substitute `${user_config.*}`" and shows the two plugin variables only for plugins; such a hook has no plugin root to name. Under PowerShell its placeholders are still rewritten to `${env:NAME}` (`hooks.md`), and the two plugin ones then read empty. |
| J3.4 | A reference is `${name}` without braces inside; one pass, no rescan of substituted text, an unknown reference and a reference to an option without a value stay as written, with a warning (§3.2.2). | `skills.md` states a single pass; `mcp.md` says a missing variable is reported and the text kept. Oracle 2.1.319 (`extend/conformance/oracle/model-content`, `bun run oracle:record model-content`): an unset and an undeclared option stay as written in skill content. |
| J3.5 | A Bash shell-form hook keeps the path references for the shell to expand from its environment; a monitor `command`, a `headersHelper` and a skill's or command's injected `!` command get the path text pasted in (§3.2.3). A client MAY instead write a braced reference into those three and export the variables it names to that process (the client's own, not a command Claude runs, so §3.2.1 item 1 does not apply); the result differs only inside single quotes and where a folder name holds shell syntax, which the reference does not run. | `manifest-reference.md` tells authors to double-quote, which fits both. The reference implementation's oracle on 2.1.322 (its `spec/judgments.md`, `shellPaths`): a quoted heredoc in a shell-form hook printed `${CLAUDE_PLUGIN_ROOT}` literally, and `$(...)` in a project folder name did not run, while a plugin `headersHelper` ran it, and a skill's `!` command under a plugin folder named `x$(echo INJECTED)y` printed `xINJECTEDy`. Monitors were not observed. |
| J3.6 | On Windows the forward-slash form applies to the three path variables and `${CLAUDE_SKILL_DIR}`, in the command text and in the exported variables of a hook run through Git Bash; never to option values or `${VAR}`; exec-form and PowerShell hooks keep native paths in both (§3.2.4). | The docs say "most substituted paths" and that a Git Bash hook "receives `${CLAUDE_PLUGIN_ROOT}`" with forward slashes so that a script expecting backslashes breaks (`plugins/troubleshooting.md`); since such a hook reads the variable from its environment (J3.5), the environment must carry the same form. The reference implementation keeps native paths in the environment; this specification follows the troubleshooting page instead. Not observed on Windows. |
| J3.7 | A variable the client sets for a process replaces an inherited one of the same name, and wins over a settings `env` value (§3.3). | The docs name what is set, not a clash; an inherited `CLAUDE_PLUGIN_ROOT` from a parent session would otherwise point a hook at another plugin. |
| J3.8 | The scrub compares names ignoring case. A name is a credential when one of its `_`-separated words is `TOKEN`, `PASS`, `PASSWD`, `PASSWORD`, `SECRET`, `SECRETS`, `CREDENTIAL`, `CREDENTIALS`, `KEY`, `APIKEY`, `PRIVATEKEY`, `ACCESSKEY` or `AUTH`, or it is `CLAUDE_CONFIG_DIR` or one of the fixed names; a value is one when it holds a URL with a password, a PEM private key or a JWT. The GitHub tokens, the proxies and the `GIT_CONFIG_*` variables stay; `PIP_INDEX_URL`, `PIP_EXTRA_INDEX_URL`, `NPM_CONFIG_REGISTRY`, `UV_INDEX_URL`, `UV_EXTRA_INDEX_URL` and `YARN_REGISTRY` lose their user information; one rule for every subprocess kind (§3.3.1). | `env-vars.md` gives examples only. Oracle 2.1.321, from the reference implementation (`src/format/credential-env.ts`, `tests/hooks/handlers/command/scrub-judgments.test.ts`): a `SessionStart` hook printed its environment under the scrub. |
| J3.9 | `default` is not checked against `type`, and `min`/`max` are not checked for type or order (§3.4.1). | Oracle 2.1.325: `claude plugin validate` passes a `string` option with `"default": 5`, and one with `"min": 1, "max": 0`. |
| J3.10 | The `options` rules and messages of §3.4.2, and that they also stop the plugin from loading. | The 2.1.321 docs say each option is "a plain label of 1 to 64 characters" and that the validator "reports anything else it rejects". Oracle 2.1.325 gave every message of the table, counted length in code points (65 emoji fail, 64 pass; 40 `e` + U+0301 fail) and accepted commas, inner spaces and accented letters. The reference implementation notes that 2.1.319 reported none of these rules; the docs say a plugin breaking them "fails to load", so this specification applies them at load too. |
| J3.11 | A field with `options` needs a `default` from the list or `required: true`; `"required": false` without a default fails (§3.4.2). | The docs: "Set `default` to one of the listed values, or set `required: true`". Oracle 2.1.325 confirms it, and that an array `default` is not one of the values. |
| J3.12 | An option's value is the saved one, else `default`, else none; an undeclared key has none; an option without a value is not exported as `CLAUDE_PLUGIN_OPTION_<KEY>` (§3.4.4). | `default` is "used when the user provides nothing"; "exported … for every option" cannot export a value that does not exist. |
| J3.13 | A number or boolean value is substituted and exported as its JSON text, an array as its strings joined by `,` (§3.4.4). | The docs show string options only. One joined string keeps an array one argument in exec form. |
| J3.14 | A sensitive option in skill, command or agent content becomes `[sensitive option '<key>' not available in skill content]`, whether or not a value is saved (§3.4.4). | The docs say only "becomes a placeholder" and name skill and agent content, while the "Where each variable resolves" table has one row for skills, commands and agents. Oracle 2.1.319 (`extend/conformance/oracle/model-content`, `bun run oracle:record model-content`) gives the text. |
| J3.15 | The shell-field refusal fires for any reference whose key is a valid option key, whether or not the plugin declares options or a value is saved; a `${user_config.<text>}` whose text is not a valid key names no option and is not refused (§3.4.5). | `errors.md`: "the check runs on the command template, so the error appears even when no value is configured yet". Difference observed: the 2.1.325 validator says the loader refuses a `headersHelper` only "when the plugin declares any options" and otherwise lets the literal text reach the shell; this specification follows the 2.1.321 docs. The 2.1.325 validator reports the `headersHelper` case only; a shell-form hook or monitor reference is a load error it does not report. |
| J3.16 | Every variable documented as "set to `1`" is an on/off variable with the full spelling set, case-insensitive, white space trimmed; any other value leaves the default (§3.6.1). | `env-vars.md` states the spelling set for on/off variables without listing which ones they are, and names `DISABLE_TELEMETRY` and `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` as the exceptions. |
| J3.17 | A numeric variable the client cannot read, or one below its documented floor, leaves the default; the plugin Git and install timeouts need a value above zero (§3.6.1). | `env-vars.md` says so for the plain-digit variables only ("anything else is ignored") and gives no rule for the others. |
| J3.18 | An empty entry of `CLAUDE_CODE_PLUGIN_DIRS` or `CLAUDE_CODE_PLUGIN_SEED_DIR` is skipped (§3.6.1). | The docs name only the separators; an empty entry names no directory. |
| J3.19 | The data directory id is not case-folded; two ids that differ only in case share one directory exactly when the file system is case-insensitive (§3.1.2). | `plugins/cli-reference.md` keeps a data directory "another installed plugin uses", such as one whose id differs only in case: two ids share a folder only on a case-insensitive file system, and then uninstalling one keeps the folder while the other is installed (§3.1.2 item 4). |
| J3.20 | The validator's unquoted-path warning covers hooks files only, counts a single-quoted and a bare `$NAME` spelling, and is silent for an exec-form hook, a PowerShell hook and an inline manifest hook (§3.2.3). | `manifest-reference.md` says "in a hooks file". Oracle 2.1.325: the warning above for `hooks/hooks.json`, none for the same command inline in `plugin.json`, none for `"shell": "powershell"`, `args`, or a reference inside single or double quotes. |
| J3.21 | A channel's option wins over a top-level option of the same key in its server's `env` (§3.4.4). | `manifest-reference.md`, "Channels", says channel values substitute into the server's `env`, not how a clash resolves; the narrower declaration is the one the channel dialog asked for. |
| J3.22 | Under `CLAUDE_CODE_MCP_ALLOWLIST_ENV`, a plugin's stdio server still has `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` and `CLAUDE_PROJECT_DIR` in its environment (§3.3.1). | The docs do not combine the two rules: `plugins/components.md`, "Reference plugin paths and store data", says the variables are "also exported to hook, MCP, and LSP processes", and `env-vars.md` says the switch keeps "only a safe baseline environment plus the server's configured `env`" in place of the inherited one. The path variables are the client's own per-plugin values, not part of the inherited shell environment the switch withholds, and a server that finds its files through them would break otherwise. Not observed: the switch needs a running server. The reference implementation (`src/format/mcp-knobs.ts`) adds only `CLAUDE_PROJECT_DIR` to the allowlisted environment; this specification adds all three, as the components page exports them. |
| J3.23 | A plugin monitor and an LSP server are not required to receive `CLAUDECODE`, `CLAUDE_CODE_SESSION_ID` or `CLAUDE_PID`; a client MAY set them there (§3.3). | `env-vars.md` names the processes that get each variable and lists neither a plugin monitor nor an LSP server for `CLAUDECODE`; `CLAUDE_CODE_CHILD_SESSION` names the Monitor tool, not a plugin's `monitors.json` entry. Not observed: a monitor runs only in a session that calls a model. |
