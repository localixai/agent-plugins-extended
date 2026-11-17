# 7.3 Hook handlers

Each object in a matcher group's `hooks` array is a handler: what runs when the group matches.
There are five types. Evidence: `hooks.md`, "Hook handler fields", "Prompt-based hooks",
"Agent-based hooks" and "Run hooks in the background", unless a rule names another section or page.
Shapes follow the handler union of the `hooks` member of the official `Settings` type
(`@anthropic-ai/claude-agent-sdk` 0.3.321, `sdk.d.ts`).

| `type` | Runs | Result read from |
| --- | --- | --- |
| `command` | A shell command, or an executable spawned directly (§7.3.2). | Exit code, stdout, stderr (§7.4.1). |
| `http` | A POST of the event's input to a URL (§7.3.4). | Status and response body (§7.4.4). |
| `mcp_tool` | A call to a tool on a configured MCP server (§7.3.5). | The tool's text, read as command stdout (§7.3.5). |
| `prompt` | A one-turn evaluation by a Claude model (§7.3.6). | The model's `ok` response (§7.4.6). |
| `agent` | A subagent with tools that verifies a condition (§7.3.7). Experimental. | The subagent's `ok` response (§7.4.6). |

<!-- req: hooks.behavior.Hook handler fields | hooks.guide.How hooks work -->

## 7.3.1 Common fields

| Field | Required | Meaning |
| --- | --- | --- |
| `type` | yes | `"command"`, `"http"`, `"mcp_tool"`, `"prompt"` or `"agent"`. <!-- req: hooks.handler.common.type --> |
| `if` | no | One permission rule that the tool call must match for the handler to run; tool events only (§7.2.3). <!-- req: hooks.handler.common.if --> |
| `timeout` | no | Seconds before the run is cancelled (§7.3.8). <!-- req: hooks.handler.common.timeout --> |
| `statusMessage` | no | A message the client shows in its spinner while the handler runs. <!-- req: hooks.handler.common.statusMessage --> |
| `once` | no | When `true`, the handler is removed after its first successful run (below). <!-- req: hooks.handler.common.once --> |

1. **`once`** MUST be honoured only for handlers declared in a skill's frontmatter, and ignored in
   settings files, agent frontmatter and a plugin's hooks (Judgment J7.50). A run that fails,
   blocks with exit code 2 or times out leaves the handler in place, so it runs again on the next
   matching occurrence. While one occurrence runs a `once` handler, a concurrent occurrence does not
   run it too (Judgment J7.51). <!-- req: hooks.handler.common.once -->
2. **`statusMessage`** is presentation; a client MAY show it in its own way, and shows it for a
   background run too (Judgment J7.52). <!-- req: hooks.handler.common.statusMessage -->

## 7.3.2 Command hooks

| Field | Required | Meaning |
| --- | --- | --- |
| `command` | yes | The shell command; with `args`, the executable to spawn. <!-- req: hooks.handler.command.command --> |
| `args` | no | The argument vector. Its presence selects exec form (§7.3.2.1). <!-- req: hooks.handler.command.args --> |
| `shell` | no | `"bash"` or `"powershell"`, for shell form (§7.3.2.2). <!-- req: hooks.handler.command.shell --> |
| `async` | no | When `true`, runs in the background without blocking (§7.3.3). <!-- req: hooks.handler.command.async --> |
| `asyncRewake` | no | When `true`, runs in the background and wakes Claude on exit code 2 (§7.3.3). <!-- req: hooks.handler.command.asyncRewake --> |
| `onFailure` | no | `"continue"` or `"block"`: whether the action goes ahead when the hook fails (§7.4.3). Claude Code 2.1.295 or later. <!-- req: hooks.handler.command.onFailure --> |

### 7.3.2.1 Exec form and shell form

1. **Exec form** applies when `args` is present, even as `[]`. The client MUST resolve `command` as
   an executable on `PATH` (or at the path it names) and spawn it directly with `args` as the
   argument vector. No shell runs and no tokenization happens, on any platform: each element is one
   argument exactly as written, and apostrophes, `$` and backticks pass verbatim. The path
   placeholders (§7.3.2.4) are substituted into `command` and each element as plain strings.
   <!-- req: hooks.handler.command.args | hooks.handler.command.command -->
2. In exec form `command` is the executable's name or path only. When it is a bare name, with no
   path separator, and holds whitespace beside `args`, the client SHOULD log a warning, because no
   executable named, say, `node script.js` exists; an absolute path with spaces such as
   `C:\Program Files\nodejs\node.exe` is one valid executable and draws no warning.
   <!-- req: hooks.handler.command.command -->
3. On Windows, exec form needs `command` to resolve to a real executable such as a `.exe`; a
   `.cmd` or `.bat` shim, such as those npm installs in `node_modules/.bin`, cannot be spawned
   without a shell. A hook runs such a tool in exec form through `node` and the script path, or by
   name in shell form. <!-- req: hooks.handler.command.args -->
4. **Shell form** applies when `args` is absent. The client MUST pass `command` to a shell: `sh -c`
   on macOS and Linux, Git Bash on Windows, PowerShell on Windows when Git Bash is not installed, or
   the shell `shell` names. The shell tokenizes the string, expands variables, and interprets pipes,
   `&&`, redirects and globs. <!-- req: hooks.handler.command.command -->
5. A hook SHOULD use exec form whenever it references a path placeholder, and shell form only for
   shell features. In shell form the author wraps each placeholder in double quotes so that a path
   with spaces stays one word, and a validator warns about an unquoted one (§3.2.3).
   <!-- req: hooks.components.Environment, quoting, and matching MCP tools.Quoting -->

```json
{ "type": "command", "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/scripts/format.js", "--fix"] }
```

is the exec-form equivalent of the shell-form
`{ "type": "command", "command": "node \"${CLAUDE_PLUGIN_ROOT}\"/scripts/format.js --fix" }`.

### 7.3.2.2 `shell`

1. `shell` selects the shell of a shell-form hook: `"bash"` (the default) or `"powershell"`. The
   default is `"powershell"` instead on Windows when Git Bash is not installed. It is ignored when
   `args` is set. <!-- req: hooks.handler.command.shell -->
2. `"powershell"` runs the command through PowerShell on Windows: the client uses `pwsh.exe`
   (PowerShell 7 or later) when it finds one and `powershell.exe` (Windows PowerShell 5.1)
   otherwise. It does not need `CLAUDE_CODE_USE_POWERSHELL_TOOL`, since hooks spawn PowerShell
   directly. <!-- req: hooks.handler.command.shell -->
3. Which hooks run in PowerShell matters for failures on Windows without Git Bash (§7.4.3.1) and for
   a `command` that is only quoted strings (§7.4.3.2).

### 7.3.2.3 Process, directory and environment

1. **Working directory.** A handler runs in the session's current directory. When that directory
   no longer exists (a worktree or temp directory another shell deleted), the client MUST run
   command hooks from the first that still exists of: the directory the session started in, the
   project root, the user's home directory, the system temp directory; and it records a warning
   naming the fallback in the debug log. <!-- req: hooks.behavior.Hook handler fields -->
2. **Environment.** A command hook inherits the client's environment (§3.3), minus the `OTEL_*`
   exporter variables the client removes from every subprocess, minus what
   `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` strips (§3.3.1), and minus Anthropic credentials in a session
   under the HIPAA configuration. It receives `CLAUDE_PROJECT_DIR`, `CLAUDE_PLUGIN_ROOT` and
   `CLAUDE_PLUGIN_DATA` (in either form, so a script reads `process.env.CLAUDE_PLUGIN_ROOT` however
   it was launched), `CLAUDE_PLUGIN_OPTION_<KEY>` for each user configuration value of its plugin,
   and the session variables of §3.3. `CLAUDE_CODE_REMOTE` is `"true"` in remote web environments
   and unset locally; `CLAUDE_CODE_BRIDGE_SESSION_ID` holds the Remote Control session id while one
   is connected (Claude Code 2.1.199 or later). There is no `CLAUDE_MODEL` variable.
   <!-- req: hooks.behavior.Hook handler fields | hooks.components.Environment, quoting, and matching MCP tools.Environment -->
3. **No terminal.** On macOS and Linux a command hook MUST run in its own session without a
   controlling terminal: it and its children cannot open `/dev/tty` or write escape sequences to the
   interface. A hook shows the user a message through `systemMessage` and emits a notification,
   title or bell through `terminalSequence` (§7.4.5).
4. **Stdin.** The client writes the event's JSON input (§7.5) to the hook's stdin.
5. **`CLAUDE_CODE_SHELL_PREFIX`.** When this variable is set, the client MUST start every
   shell-form command hook that runs in Bash through it: it runs the prefix as the program with the
   hook's whole command line as its one argument, shell-quoted, so `/path/to/logger.sh` runs
   `/path/to/logger.sh '<command>'`. The wrapper receives the command in `$1` and re-evaluates it
   with a shell (`exec bash -c "$1"`); a wrapper that treats `$1` as an executable path breaks.
   Exec-form hooks (§7.3.2.1) and hooks run in PowerShell (§7.3.2.2) start without the prefix. The
   same variable wraps the Bash tool's commands, status line commands and the start commands of
   stdio MCP servers (§8) (Judgment J7.66).
   <!-- docs: env-vars.md | Variables — CLAUDE_CODE_SHELL_PREFIX -->

### 7.3.2.4 Reference scripts by path

| Placeholder | Value |
| --- | --- |
| `${CLAUDE_PROJECT_DIR}` | The project root where the session started. It stays there when Claude enters a worktree or runs `cd`; the input's `cwd` follows Claude instead. <!-- req: hooks.behavior.Reference scripts by path.${CLAUDE_PROJECT_DIR} --> |
| `${CLAUDE_PLUGIN_ROOT}` | The plugin's installation directory, for scripts the plugin bundles (§3.1.1). <!-- req: hooks.behavior.Reference scripts by path.${CLAUDE_PLUGIN_ROOT} --> |
| `${CLAUDE_PLUGIN_DATA}` | The plugin's persistent data directory, for dependencies and state that survive updates (§3.1.2). <!-- req: hooks.behavior.Reference scripts by path.${CLAUDE_PLUGIN_DATA} --> |

1. Both forms MUST support the three placeholders, independent of the directory the hook runs in;
   how each form substitutes them, and the Windows path separators, are §3.2.3 and §3.2.4.
2. A plugin hook also substitutes `${user_config.<key>}`, in **exec form only**, into `command` and
   each `args` element as a plain string. A shell-form plugin hook whose `command` references
   `${user_config.*}` MUST fail with the error of §3.4.5 instead of running; a shell-form hook reads
   the value from `$CLAUDE_PLUGIN_OPTION_<KEY>`. (Before 2.1.207, shell form substituted it too.)
   <!-- req: hooks.behavior.Reference scripts by path.${CLAUDE_PLUGIN_ROOT} -->

### 7.3.2.5 PowerShell commands and paths

In a PowerShell shell-form command, whether it comes from settings, a plugin or a skill, the client
MUST rewrite `${CLAUDE_PROJECT_DIR}`, `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` to
PowerShell's `${env:NAME}` form, so PowerShell reads the exported value after parsing: the reference
expands inside double quotes and not inside single quotes. `$env:CLAUDE_PROJECT_DIR` works as
written. The bare `$CLAUDE_PROJECT_DIR` spelling is not rewritten: PowerShell reads it as an
undefined variable (`$null`), and the client logs a warning in the debug log.
`"command": "& \"$env:CLAUDE_PROJECT_DIR\\.claude\\hooks\\check.ps1\""` with `"shell":
"powershell"` runs a project script. <!-- req: hooks.behavior.Reference scripts by path in PowerShell hooks -->

## 7.3.3 Background hooks: `async` and `asyncRewake`

1. Only `command` hooks accept `async`. With `"async": true` the client starts the hook and
   continues at once without waiting for it; the hook receives the same input on stdin. The hook
   cannot block or control anything: `decision`, `permissionDecision`, `continue` and the other
   decision fields have no effect, because the action they would control has already happened.
   <!-- req: hooks.behavior.Configure an async hook | hooks.handler.command.async -->
2. When the background process exits, the client MUST deliver the `additionalContext` and
   `systemMessage` of its JSON response to Claude on the next conversation turn, and show neither to
   the user. While the session is idle, the response waits for the next user interaction.
   <!-- req: hooks.behavior.How async hooks execute | hooks.behavior.Limitations -->
3. The response is read from stdout in two ways: alone on stdout, where it MAY span several lines
   (Claude Code 2.1.295 or later), or on one line of its own among other output. When several lines
   are JSON objects, the last is the response (Judgment J7.53). The client validates it against the
   output schema of §7.4.5 and drops each field of the wrong type instead of delivering it, with a
   debug warning naming the field. <!-- req: hooks.behavior.How async hooks execute -->
4. The client MUST NOT enforce `timeout` on an `async` hook once it runs in the background; it does
   enforce it on an `asyncRewake` hook. In `-p` mode the client kills every background hook still
   running at teardown and finalizes it with outcome `cancelled`; work that must outlive the run
   starts a fully detached process. <!-- req: hooks.behavior.Configure an async hook | hooks.handler.command.async -->
5. Each run is its own background process. Completion notices of background hooks are hidden unless
   the user turns on verbose output. <!-- req: hooks.behavior.Limitations | hooks.behavior.How async hooks execute -->
6. **`asyncRewake`** implies background running. When the hook exits with code 2, the client MUST
   show Claude the hook's stderr, or its stdout when stderr is empty, as a system reminder, and wake
   Claude at once, even when the session is idle. A wake text that is blank wakes nobody (Judgment
   J7.54). <!-- req: hooks.handler.command.asyncRewake | hooks.behavior.Limitations -->
7. An async `SessionStart` hook runs every time the event fires. The client skips its output when
   the `additionalContext` and `systemMessage` text equals what Claude last received from that hook,
   unless a synchronous `SessionStart` hook added other text since; it delivers the text when it
   changes, and again the first time the hook runs after a compaction or `/clear`.
   <!-- req: hooks.behavior.Limitations -->
8. `onFailure` and `terminalSequence` have no effect on a background hook, and nor does its
   `classifierContext` (§7.4.3, §7.4.5, §7.4.9).

## 7.3.4 HTTP hooks

| Field | Required | Meaning |
| --- | --- | --- |
| `url` | yes | The URL the client POSTs to. <!-- req: hooks.handler.http.url --> |
| `headers` | no | Extra request headers. Values interpolate `$VAR_NAME` and `${VAR_NAME}`, for the variables `allowedEnvVars` lists only. <!-- req: hooks.handler.http.headers --> |
| `allowedEnvVars` | no | The environment variable names that may be interpolated into header values; a reference to any other variable becomes the empty string. Without it nothing interpolates. <!-- req: hooks.handler.http.allowedEnvVars --> |
| `onFailure` | no | `"continue"` (the default) or `"block"` (§7.4.3). Claude Code 2.1.295 or later. <!-- req: hooks.handler.http.onFailure --> |

1. The client MUST send the event's JSON input (§7.5) as the body of a POST to `url`, with
   `Content-Type: application/json`, which replaces a header of that name in `headers` (Judgment
   J7.55). The response is read as §7.4.4 says, in the same output format as a command hook's
   stdout. <!-- req: hooks.handler.http.url | hooks.guide.HTTP hooks -->
2. Header interpolation is one pass: the value a variable brings in is not read again, and a line
   break in it is dropped, so a variable cannot add a header (Judgment J7.56).
   <!-- req: hooks.handler.http.headers -->
3. When any settings level defines `allowedHttpHookUrls`, the client MUST run an HTTP hook only if
   its URL matches the merged allowlist; a hook whose URL matches no entry sends nothing. When
   `httpHookAllowedEnvVars` is defined, a hook's effective `allowedEnvVars` is the intersection with
   it. Both apply to hooks of every source (§12). <!-- req: hooks.handler.http.allowedEnvVars | hooks.handler.http.url -->
4. `SessionStart` and `Setup` do not accept HTTP hooks (§7.3.9).

```json
{
  "type": "http",
  "url": "http://localhost:8080/hooks/pre-tool-use",
  "timeout": 30,
  "headers": { "Authorization": "Bearer $MY_TOKEN" },
  "allowedEnvVars": ["MY_TOKEN"]
}
```

## 7.3.5 MCP tool hooks

| Field | Required | Meaning |
| --- | --- | --- |
| `server` | yes | The name of a configured MCP server. A plugin's server is named by its scoped name `plugin:<plugin>:<server>`, such as `plugin:my-plugin:db`, not by its bare key (§8). <!-- req: hooks.handler.mcp_tool.server --> |
| `tool` | yes | The tool to call on that server. <!-- req: hooks.handler.mcp_tool.tool --> |
| `input` | no | The tool's arguments. String values substitute `${path}` from the hook's JSON input, such as `"${tool_input.file_path}"`. <!-- req: hooks.handler.mcp_tool.input --> |

1. **Substitution.** A `${path}` is input keys joined by dots, a number indexing an array; strings
   nested in objects and arrays are substituted too; a non-string value is written as text (an
   object as JSON); a path with no value becomes the empty string; text that is not a path is left
   alone; the substituted text is not read again (Judgment J7.57). <!-- req: hooks.handler.mcp_tool.input -->
2. **The result.** The client reads the tool's text content as it reads a command hook's stdout on
   exit 0 (§7.4.1.1). A tool result with `isError: true` is a non-blocking error and execution
   continues. <!-- req: hooks.handler.mcp_tool.tool -->
3. **A connecting server.** On an event where a hook can block or change the result, such as
   `PreToolUse` or `Stop`, the client waits for a server that is still connecting before calling
   the tool, for at most `MCP_TIMEOUT` and within the hook's own `timeout`. On an observational
   event, such as `Notification` or `SessionEnd`, it does not wait. A server in the `cached` status
   connects when the hook calls it. A server not connected at call time makes the run a
   non-blocking error. A hook never starts an OAuth flow. <!-- req: hooks.handler.mcp_tool.server -->
4. **Before servers exist.** `SessionStart` at launch (with `--continue` and `--resume` too) and
   every `Setup` fire before the session's MCP servers are available. The client MUST skip their
   `mcp_tool` hooks without calling the tool and record `mcp_tool hooks are not available for the
   'SessionStart' hook event (no MCP client context)` (or the same naming `Setup`) in the debug log.
   A `SessionStart` that fires later, after `/clear` or a compaction, runs its `mcp_tool` hooks.
   <!-- req: hooks.handler.mcp_tool.server -->

## 7.3.6 Prompt hooks

| Field | Required | Meaning |
| --- | --- | --- |
| `type` | yes | `"prompt"`. <!-- req: hooks.behavior.Prompt hook configuration.type --> |
| `prompt` | yes | The prompt sent to the model. `$ARGUMENTS` stands for the hook's JSON input; when the prompt has no `$ARGUMENTS`, the input is appended. `\$` escapes a literal dollar: `\$1.00` renders as `$1.00`. <!-- req: hooks.behavior.Prompt hook configuration.prompt | hooks.handler.prompt.prompt --> |
| `model` | no | The model that evaluates; default the model the client uses for background functionality. <!-- req: hooks.behavior.Prompt hook configuration.model | hooks.handler.prompt.model --> |
| `timeout` | no | Seconds; default 30. <!-- req: hooks.behavior.Prompt hook configuration.timeout --> |
| `continueOnBlock` | no | On the events it applies to, `true` feeds an `ok: false` reason back to Claude and continues instead of ending the turn; default `false` (§7.4.6). <!-- req: hooks.behavior.Prompt hook configuration.continueOnBlock --> |

1. A prompt hook MUST send the hook input and the prompt to a Claude model in one turn, read the
   model's JSON decision (§7.4.6), and act on it as §7.4.6 says for the event. The prompt may state
   a rule about what to block ("Block any Bash command that reads `.env` files") or a condition
   that must hold ("All unit tests pass"). <!-- req: hooks.behavior.How prompt-based hooks work | hooks.guide.Prompt-based hooks -->
2. Every `$ARGUMENTS` is replaced, in one pass; `\$ARGUMENTS` is literal text and not the
   placeholder; when appended, the input follows the prompt after a blank line (Judgment J7.58).
   <!-- req: hooks.handler.prompt.prompt -->
3. The client tells the model the response schema of §7.4.6 alongside the prompt (Judgment J7.59).

```json
{ "hooks": { "Stop": [ { "hooks": [ { "type": "prompt", "prompt": "Evaluate if Claude should stop: $ARGUMENTS. Check if all tasks are complete." } ] } ] } }
```

## 7.3.7 Agent hooks

Agent hooks are experimental in Claude Code and may change; their fields are those of a prompt hook,
except that the default `timeout` is 60 seconds and there is no `continueOnBlock`.

1. When an agent hook fires, the client MUST spawn a subagent with the prompt and the hook's JSON
   input (`$ARGUMENTS` as in §7.3.6). The subagent can use tools such as Read, Grep and Glob to
   inspect files and output, for up to 50 turns, and then returns `{ "ok": true }` or `{ "ok":
   false, "reason": "..." }` (Judgment J7.60). <!-- req: hooks.behavior.How agent hooks work | hooks.behavior.Agent hook configuration | hooks.guide.Agent-based hooks -->
2. On `ok: true` the action proceeds. On `ok: false` the client handles the block as it handles a
   prompt hook with `continueOnBlock: true` on the same event (§7.4.6), so on `PreToolUse` and
   `PostToolUse` the turn continues. The `impossible` field is not supported.
   <!-- req: hooks.behavior.How agent hooks work | hooks.behavior.Agent hook configuration | hooks.guide.Agent-based hooks -->
3. An agent hook is the tool for a check against the state of the code; a prompt hook suffices
   when the input alone decides. <!-- req: hooks.guide.Agent-based hooks -->

## 7.3.8 Timeouts

A handler's `timeout` is in seconds. When unset, the default is:

| Type | Default | Lowered on |
| --- | --- | --- |
| `command`, `http`, `mcp_tool` | 600 | 30 on `UserPromptSubmit`, `PreModelSwitch` and `PostModelSwitch`; 10 on `MessageDisplay` |
| `prompt` | 30 | — |
| `agent` | 60 | — |

<!-- req: hooks.handler.common.timeout | hooks.guide.Limitations -->

1. `SessionEnd` hooks of every type share a budget of 1.5 seconds, applied on exit, `/clear` and an
   interactive `/resume` switch. A `timeout` longer than that on a hook in a settings file raises
   the budget to the highest such value, up to 60 seconds; a hook without its own `timeout` keeps
   the default; a plugin hook's `timeout` does not raise it. `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS`
   sets the budget, and the timeout of each hook without one, explicitly (§3.6.5).
   <!-- req: hooks.handler.common.timeout | hooks.behavior.SessionEnd input -->
2. The clock of a waiting prompt or agent hook starts when it starts (§7.2.5); an `async` hook's
   timeout is not enforced (§7.3.3).
3. A `timeout` that is not a positive number fails the handler's shape (§7.2.1.1).
4. What a run that reaches its timeout does is §7.4.2.

## 7.3.9 Handler types per event

| Events | Accept |
| --- | --- |
| `PermissionDenied`, `PostToolBatch`, `PostToolUse`, `PostToolUseFailure`, `PreToolUse`, `Stop`, `SubagentStop`, `TaskCompleted`, `TaskCreated`, `TeammateIdle`, `UserPromptExpansion`, `UserPromptSubmit` | all five types |
| `PermissionRequest` | `command`, `http`, `mcp_tool`, `prompt` |
| `ConfigChange`, `CwdChanged`, `DirectoryAdded`, `Elicitation`, `ElicitationResult`, `FileChanged`, `InstructionsLoaded`, `MessageDisplay`, `Notification`, `PostCompact`, `PostModelSwitch`, `PreCompact`, `PreModelSwitch`, `SessionEnd`, `StopFailure`, `SubagentStart`, `WorktreeCreate`, `WorktreeRemove` | `command`, `http`, `mcp_tool` |
| `SessionStart`, `Setup` | `command`, `mcp_tool` (with §7.3.5 item 4) |

A handler of a type its event does not accept MUST be skipped, and the event proceeds as if it were
absent; an `agent` hook on `PermissionRequest` leaves the permission flow unchanged. The client
SHOULD report the skip, as `A hook of type <type> is not supported on <Event> and is skipped` (Judgment
J7.61). <!-- req: hooks.behavior.Prompt-based hooks -->

## 7.3.10 What a handler cannot do

1. A command hook talks to the client only through stdout, stderr and its exit code, and an HTTP
   hook only through its response; neither can run a `/` command or a tool call. Text a hook
   returns as `additionalContext` reaches Claude as a system reminder, read as plain text.
   <!-- req: hooks.guide.Limitations -->
2. A `PostToolUse` hook cannot undo the tool call: it has run. <!-- req: hooks.guide.Limitations -->
3. Command hooks run with the user's full permissions; the client MUST NOT sandbox them more than
   any other process it starts (Judgment J7.62).

## Design decisions

### Why `args` alone selects exec form

A shell re-parses everything it is given, so a path or a user value that holds a quote, `$` or a
backtick changes what runs. Exec form passes each value as one argument with nothing to re-parse,
which is why `${user_config.*}` is substituted only there. Making the presence of `args` the switch
keeps the rule visible in the configuration: `"args": []` is all it takes to leave the shell.

### Why background hooks cannot decide

By the time a background hook finishes, the tool call or prompt it fired for has moved on. Letting
its decision apply later would block or allow something other than what it inspected; so its
output only becomes context on the next turn, and `asyncRewake` is the one way it gets attention
sooner.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J7.50 | `once` is ignored for a plugin's hooks and for hooks a host registers for a session, as it is in settings files and agent frontmatter. | `hooks.md`, "Common fields", honours it only in skill frontmatter and names settings files and agent frontmatter as ignoring it; a plugin's hooks file is not named. Reference: `src/hooks/select/once.ts`. |
| J7.51 | A `once` handler is claimed while an occurrence runs it, so an overlapping occurrence leaves it out; a failure, block or timeout releases it, and it is removed after the first success (a background run's when its process ends). | The docs say what a failed run does, not what overlapping events do; running a "once" hook twice in parallel breaks its promise. Reference: `src/hooks/select/once.ts`. |
| J7.52 | `statusMessage` is shown for a background run as well. | The docs show it "while the hook runs" and exclude no hook. Reference: `src/hooks/handlers/registry.ts`. |
| J7.53 | When an async hook prints several lines that are JSON objects, the last is its response. | `hooks.md`, "How async hooks execute", allows the response on a line of its own among other text and does not say which of several objects counts; the last is what the hook said finally. Reference: `src/hooks/verdict/stdout-kind.ts`. |
| J7.54 | An `asyncRewake` exit 2 whose stderr is blank uses stdout; when that is blank too, Claude is not woken. | The docs say "stderr, or stdout if stderr is empty"; a blank reminder carries nothing to react to. Reference: `src/hooks/handlers/command/async.ts`. |
| J7.55 | The client's `Content-Type: application/json` replaces a `Content-Type` in `headers`; `url` is sent as written, with no interpolation. | The docs name the content type as the client's and interpolate only header values. Reference: `src/hooks/handlers/remote/http.ts`. |
| J7.56 | Header values interpolate in one pass; a line break inside a variable's value is dropped; a `$` that starts no name stays. | The docs say which variables resolve, not how; a value holding `\r\n` could otherwise inject a header. Reference: `src/hooks/handlers/remote/http-env.ts`. |
| J7.57 | In `mcp_tool` `input` substitution (§7.3.5 item 1), a `${path}` is one or more names of letters, digits and `_` joined by dots; any other `${...}` text is left as written. A value that is a string is inserted as is; `null` becomes the empty string, as a path with no value does; a number or boolean is written as its JSON text (`3`, `true`); an object or array as its JSON. Only strings are substituted: a number, boolean or `null` written in `input` itself, and every key, is sent unchanged. | The docs show only `"${tool_input.file_path}"` in a string value and say nothing of a value that is not a string. `null` reads as "no value" in the hook input (a field that does not apply), so it is treated as an absent path rather than the text `null`, which would reach the tool as a real argument. Reference: `src/hooks/handlers/remote/mcp-input.ts` (`null` to `""`). |
| J7.58 | Every `$ARGUMENTS` is replaced in one pass, `\$ARGUMENTS` stays literal, and an appended input follows a blank line. | The docs give the placeholder, the escape and the append, not the separator or repeated placeholders. Reference: `src/hooks/handlers/remote/prompt-text.ts`. |
| J7.59 | The model of a prompt or agent hook is told the response schema in text after the prompt, `impossible` only for a prompt hook. | The docs say what the model must answer, not how it learns it; the example prompts spell the schema out themselves. Reference: `src/hooks/handlers/remote/prompt-response.ts`. |
| J7.60 | An agent hook's subagent MUST have at least Read, Grep and Glob; the 50-turn limit counts its model turns. | `hooks.md` names "tools like Read, Grep, and Glob" and "up to 50 turns"; `hooks-guide.md` says agent hooks "use other tools" without a list, so only the three named are required. Reference: `src/hooks/handlers/remote/agent.ts` (Read, Grep, Glob). |
| J7.61 | A handler of a type its event does not accept is reported as a warning, `A hook of type <type> is not supported on <Event> and is skipped`. | The docs say such a hook is skipped or unsupported, not how a client reports it. Reference: `src/hooks/select/select.ts`. |
| J7.62 | Command hooks run unsandboxed, with the user's permissions. | `hooks.md`, "Security considerations": they "execute shell commands with your full user permissions". A client that sandboxed them would break hooks Claude Code runs. |
| J7.66 | `CLAUDE_CODE_SHELL_PREFIX` wraps a shell-form Bash hook with the command exactly as the handler's `command` holds it: placeholders such as `${CLAUDE_PLUGIN_ROOT}` are still in the text and the shell the wrapper starts expands them from the environment, as §3.2.3 item 3 says. An exec-form hook is spawned directly. | `env-vars.md`, "CLAUDE_CODE_SHELL_PREFIX", names hook commands and excludes PowerShell and exec-form hooks, and gives the `$1` contract. Oracle 2.1.325 (`claude -p --plugin-dir`, `UserPromptSubmit` hooks, a prefix that logs its arguments): each shell-form hook reached the prefix as one argument holding the literal command (`echo shell-form "${CLAUDE_PLUGIN_ROOT}" >> …`), which then ran with the root expanded; the exec-form hook ran and never reached the prefix. |
