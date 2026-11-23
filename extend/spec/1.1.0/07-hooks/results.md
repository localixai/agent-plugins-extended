# 7.4 Hook results

How a client reads what a handler returned, decides what it means for the action, and combines the
results of several handlers. Evidence: `hooks.md`, "Hook input and output", "Prompt-based hooks"
and the event sections named, unless a rule names another page. Output shapes follow the official
`HookJSONOutput`, `SyncHookJSONOutput`, `AsyncHookJSONOutput` and `PermissionUpdate` types
(`@anthropic-ai/claude-agent-sdk` 0.3.330, `sdk.d.ts`). Each event's own fields, and what exit code
2 does on it, are §7.5.

## 7.4.1 Exit codes

When a command hook's run finishes, its exit code decides whether the action that fired it — a tool
call, a prompt, a compaction — goes ahead:

| Outcome | When | What the client does |
| --- | --- | --- |
| **Success** | Exit 0. | Applies the JSON output fields the hook printed (§7.4.5); the action goes ahead unless they block or deny it, and except as §7.4.2 says for a hook that leaves a background process. <!-- req: hooks.behavior.Exit code output.Success --> |
| **Blocking error** | Exit 2. | On an event that can block (§7.5), stops the action. <!-- req: hooks.behavior.Exit code output.Blocking error --> |
| **Non-blocking error** | Any other exit code, or another failure: the hook did not start, or printed invalid JSON. | The action goes ahead, unless the hook is one whose failure blocks (§7.4.3). On events such as `PreToolUse` the transcript shows a `<hook name> hook error` notice. <!-- req: hooks.behavior.Exit code output.Non-blocking error --> |

<!-- req: hooks.behavior.Exit code output -->

What the hook printed to stdout can change the outcome. The client MUST combine the two as this
table says, for every event without a rule of its own (below):

| Stdout | Exit 0 | Exit 2 | Any other exit code |
| --- | --- | --- | --- |
| A JSON object that passes schema validation (§7.4.5) | Success; the fields apply. | Blocking error; the fields are still read, but a `PreToolUse` call stays blocked even with `"allow"` or `continue: false`; on other events see §7.4.1.2. | Success: the exit code is ignored and the fields alone decide; for a hook whose failure blocks (§7.4.3), a failure instead. |
| JSON that cannot be parsed, or fails validation | Non-blocking error; the notice carries the parse or validation message. | Blocking error; stderr is the reason. | Non-blocking error; the notice carries the parse or validation message. |
| Plain text, or nothing | Success. | Blocking error; stderr is the reason. | Non-blocking error (§7.4.1.3 says what the notice carries). |

<!-- req: hooks.behavior.Exit code output | hooks.behavior.Exit code output.Plain text, or nothing | hooks.guide.Hook output -->

Rules of particular events, which win over the table:

1. **`WorktreeCreate`**: any non-zero exit code fails the creation, whatever the JSON says.
   <!-- req: hooks.behavior.Exit code output.WorktreeCreate -->
2. **`WorktreeRemove`**: any non-zero exit code fails the removal when the directory still exists
   afterwards. <!-- req: hooks.behavior.Exit code output.WorktreeRemove -->
3. **`Stop`, `SubagentStop`, `TaskCompleted`, and a plugin's `UserPromptSubmit` hook**: an exit 2
   with nothing on stdout and a stderr saying a file is missing, such as `No such file or
   directory`, is a non-blocking error, not a block. <!-- req: hooks.behavior.Exit code output -->
4. **`Elicitation` and `ElicitationResult`**: `hookSpecificOutput` applies on exit 0 and is ignored
   on any other exit code. <!-- req: hooks.behavior.Exit code output.Elicitation and ElicitationResult -->
5. **Events that discard hook output, such as `StopFailure`**: the JSON is ignored on any exit code,
   except side-effect fields such as `terminalSequence`, which still fire.
   <!-- req: hooks.behavior.Exit code output -->

### 7.4.1.1 Exit code 0 and what stdout is

1. Exit 0 is success and the code to use with JSON output. When a hook exits 0 but its stdout does
   not parse or fails validation, the action goes ahead unless the hook's failure blocks (§7.4.3),
   and the run is a non-blocking error, not a success with fields applied.
   <!-- req: hooks.behavior.Exit code 0 -->
2. For a hook that is not async (§7.3.3 has the async rule), stdout counts as JSON output only when
   it is one JSON object, on one line or several, with nothing around it but whitespace. The client
   MUST read any other stdout as plain text or as a parse failure:
   - stdout that does not start with `{`, or starts with `{` and does not end with `}`, is plain
     text; so a JSON array and a quoted JSON string are plain text;
   - two or more lines that each parse as JSON on their own, the first starting with `{` and the
     last ending with `}`, are plain text when no line is a JSON output object that sets a field,
     and a parse failure when one line is (Judgment J7.31);
   - anything else that starts with `{` and ends with `}` but is not valid JSON is a parse failure.

   <!-- req: hooks.behavior.Exit code 0 -->
3. On most events the client writes stdout to the debug log and does not show it in the
   transcript. On `UserPromptSubmit`, `UserPromptExpansion`, `SessionStart` and `PostModelSwitch` it
   MUST add plain-text stdout to Claude's context (and not stdout it failed to parse); on
   `PreCompact` stdout becomes instructions for the compaction summary (§7.5.31).
   <!-- req: hooks.behavior.Exit code 0 | hooks.guide.Hook output -->
4. Claude never sees the stderr of a hook that exits 0; the client writes it to the debug log. A
   `PostToolUse` or `PostToolUseFailure` hook that wants Claude to see a warning exits 2.
   <!-- req: hooks.behavior.Exit code 0 -->
5. **Text before the JSON.** When something prints to stdout ahead of the object — typically a shell
   profile that Git Bash or `BASH_ENV` sources even in a non-interactive shell — the output no longer
   starts with `{`, so the client reads it as plain text, the JSON has no effect, and an exit 0
   shows no error. The client MUST record `Hook output does not start with {, treating as plain
   text` in the debug log for it. <!-- req: hooks.guide.Shell profile output before the JSON -->

### 7.4.1.2 Exit code 2

1. Exit 2 blocks the action on an event that can block (§7.5): a `PreToolUse` hook blocks the tool
   call, a `UserPromptSubmit` hook rejects the prompt. The message of the block is the hook's
   stderr; when the hook also printed JSON with a blocking decision, that decision's reason is the
   message instead. <!-- req: hooks.behavior.Exit code output.Blocking error -->
2. Exit 2 still blocks with most JSON the hook prints:
   - **JSON that sets `continue: false`**: on events such as `Stop` and `SubagentStop`, the field
     wins over exit 2, so Claude or the subagent ends its turn instead of being sent back to work;
     on `PreToolUse` the tool call stays blocked with or without the field. This rule wins over the
     event's row of exit code 2 (§7.5). <!-- req: hooks.behavior.Exit code 2.JSON that sets continue: false -->
   - **Other JSON that passes validation** is still read, but even `permissionDecision: "allow"`
     does not let the action through. On `Elicitation` and `ElicitationResult` the
     `hookSpecificOutput` of an exit-2 hook is ignored. <!-- req: hooks.behavior.Exit code 2.Other JSON that passes schema validation -->
   - **JSON that fails validation** does not stop the block: stderr is the reason, and the client
     records the validation failure in the debug log. <!-- req: hooks.behavior.Exit code 2.JSON that fails schema validation -->
3. A blocked `PreToolUse` call returns the stderr to Claude as the tool's error, prefixed with the
   event name, the tool name and the hook's command in brackets:
   `PreToolUse:Bash hook error: [${CLAUDE_PROJECT_DIR}/.claude/hooks/no-rm.sh]: Blocked: rm commands
   are not allowed`. A hook that is not a command is named by its URL (`http`), `server:tool`
   (`mcp_tool`) or its type (Judgment J7.32). <!-- req: hooks.behavior.Exit code output.Blocking error -->
4. When a **plugin's** hook blocks this way and its stderr is the blocking message, the client
   MUST end the error with `This hook comes from the <plugin> plugin.`, the plugin named by its
   manifest name, so the user knows which plugin to fix or disable (Claude Code 2.1.281 or later;
   Judgment J7.33).
   <!-- req: install.troubleshooting.A plugin hook blocks a tool call or prompt -->

### 7.4.1.3 Other exit codes

1. Any exit code other than 0 and 2, with stdout that is plain text or empty, is a non-blocking
   error unless the hook's failure blocks (§7.4.3): the hook did not stop the action. Exit 1 is
   such a code although it is Unix's conventional failure: a hook that enforces a policy exits 2.
   <!-- req: hooks.behavior.Other exit codes -->
2. The client MUST show the notice `<hook name> hook error` with `Failed with non-blocking status
   code: <stderr>`, for example `PreToolUse:Bash hook error` carrying `Failed with non-blocking
   status code: something broke`; on events such as `Notification` a failing command hook shows no
   notice. The notice MAY cut the stderr short (it carries the first line;
   with no stderr it says `no stderr output`, Judgment J7.32); the full stderr goes to the debug
   log. <!-- req: hooks.behavior.Other exit codes | install.troubleshooting.hook error notices in the transcript -->
3. A hook that could not start — its script path does not exist or is not executable — is a
   non-blocking error too, unless its failure blocks. In shell form the shell exits with a code such
   as 127 and the notice carries its message, as in `Failed with non-blocking status code: /bin/sh:
   /path/to/hook.sh: No such file or directory`. <!-- req: hooks.behavior.Other exit codes | install.troubleshooting.hook error notices in the transcript -->

## 7.4.2 Timeouts and background processes

1. Except for an `async` command hook, the client MUST cancel a `command`, `http` or `mcp_tool` run
   that reaches its `timeout` (§7.3.8) and discard its output, so on most events a timed-out hook
   renders no decision. On `PreModelSwitch` a hook cancelled at its timeout blocks the switch.
   <!-- req: hooks.behavior.Timeouts -->
2. On `PreToolUse`, a timed-out `command`, `http` or `mcp_tool` hook does not block the tool call,
   unless its failure blocks (§7.4.3): the call goes on through the normal permission flow.
   `onFailure: "block"` on a `command`, `http` or `mcp_tool` hook makes a timeout block. In a Code
   Mode session a timeout with `onFailure` unset refuses a call from the code instead (§7.6.11.4).
   (An Agent SDK callback that exceeds its timeout blocks
   the call; that is the SDK's contract, not a plugin's.) <!-- req: hooks.behavior.Timeouts -->
3. For a hook that is not async, the client finishes reading output shortly after the hook's own
   process exits; what a background process it started prints afterwards is not read, so a deny
   printed late does not block. <!-- req: hooks.behavior.Hooks that start a background process -->
4. A hook MAY start a long-running program, such as a dev server, and leave it running: it runs
   the program in the background and redirects its stdout and stderr (`npm run dev > dev-server.log
   2>&1 &`). Without the redirect, a hook that is not async takes up to 10 seconds to finish after
   its own process exits. <!-- req: hooks.behavior.Hooks that start a background process -->
5. When a hook's process exits while a background process it started still holds its stdout or
   stderr open, the client MUST refuse the capture and block the action where exit 2 blocks (or a
   failure denies), with a hook error that includes `stdio went quiet` and `refusing to honor the
   suspect capture`; on
   `Stop`, `SubagentStop`, `TaskCompleted` and `TeammateIdle` it does not block (Judgment J7.34). A
   hook therefore prints its decision first and starts background work with its output redirected:
   `"$CLAUDE_PROJECT_DIR"/.claude/hooks/policy-check.sh || exit $?` followed by
   `.../upload-metrics.sh >/dev/null 2>&1 &`. <!-- req: hooks.behavior.Hooks that start a background process -->

## 7.4.3 Blocking the action when a hook fails

On most events a hook that fails or times out lets the action go ahead, so a policy hook with a wrong
path lets everything through. `"onFailure": "block"` on a `command`, `http` or `mcp_tool` hook
makes a failure block instead (Claude Code 2.1.295 or later; on `mcp_tool` hooks 2.1.328 or later).
Leaving the field unset is `"continue"`, except where §7.4.3.1 and item 5 below say otherwise.
<!-- req: hooks.behavior.Block the action when a hook fails | hooks.handler.mcp_tool.onFailure -->

1. Each of these MUST count as a failure:
   - **Can't start**: a command hook fails to start, for example because its script or executable
     does not exist. <!-- req: hooks.behavior.Block the action when a hook fails.Can't start -->
   - **Exit code other than 0 or 2**: for a command hook, even when it printed JSON that allows the
     action; a hook that returns a JSON decision exits 0. <!-- req: hooks.behavior.Block the action when a hook fails.Exit code other than 0 or 2 -->
   - **HTTP error**: an HTTP hook's connection fails or its status is not 2xx. <!-- req: hooks.behavior.Block the action when a hook fails.HTTP error -->
   - **MCP failure**: an `mcp_tool` hook's server is not connected, or its tool returns an error
     (`isError: true`), or the client could not read the tool's answer (§7.3.5). With `"block"` set
     on an event that can block, such as `PreToolUse` or `UserPromptSubmit`, a non-empty answer also
     counts as a failure unless it is `{}` or JSON that sets a hook output field (§7.4.5) other than
     `reason` (Judgment J7.212). <!-- req: hooks.behavior.Block the action when a hook fails.MCP failure -->
   - **Timeout**: the hook reaches its `timeout`. <!-- req: hooks.behavior.Block the action when a hook fails.Timeout -->
   - **Invalid output**: the JSON cannot be parsed or fails validation; for an HTTP hook, also a 2xx
     body that is neither empty nor a JSON object. Plain-text stdout from a command hook is not a
     failure. <!-- req: hooks.behavior.Block the action when a hook fails.Invalid output -->
2. With `"block"`, a failure MUST do what exit code 2 does on that event (§7.5), except on
   `PermissionRequest`, where it denies the request. A `PreToolUse` failure blocks the tool call; a
   `UserPromptSubmit` failure blocks the prompt. Where exit 2 only shows stderr (`PostToolUse`), the
   failure text goes where that stderr would (Judgment J7.35). <!-- req: hooks.behavior.Block the action when a hook fails -->
3. The blocking error reads `<hook name> hook error: [<command>]: failed; blocking because onFailure
   is "block"`, followed by the hook's own error output; after a timeout it says `timed out` in
   place of `failed`. Without `onFailure`, the same missing script is a non-blocking error and the
   action runs. <!-- req: hooks.behavior.Block the action when a hook fails -->
4. `onFailure` has no effect on `Stop`, `SubagentStop`, `TaskCompleted` and `TeammateIdle` hooks,
   where exit 2 sends Claude back to work and Claude cannot repair a hook that will not run, nor on
   **background command hooks** (`async` or `asyncRewake`). <!-- req: hooks.behavior.Block the action when a hook fails.Background command hooks | hooks.behavior.Block the action when a hook fails -->
6. In a Code Mode session, a `PreToolUse` hook that does not finish refuses a tool call from the
   code when `onFailure` is unset; other failures let such a call run unless `onFailure` is
   `"block"` (§7.6.11.4, Judgment J7.213).
5. A `PreModelSwitch` hook cancelled at its timeout blocks the switch unless it sets `onFailure:
   "continue"` explicitly (Judgment J7.36).

### 7.4.3.1 Failed hooks on Windows without Git Bash

1. On Windows without Git Bash, a shell-form `PreToolUse` or `PermissionRequest` command hook with
   `onFailure` unset MUST be treated as one whose failure blocks: any exit code other than 0 or 2
   counts as a failure, even with JSON that does not deny, and a failure or timeout blocks the call.
   The error includes `blocking because Git Bash wasn't found, so only exit code 0 or 2 counts as
   this hook's verdict.` (before 2.1.309 it read `blocking because Git Bash wasn't found and this
   hook doesn't set "shell" to "powershell", so only exit code 0 or 2 counts as its verdict.`). An
   exec-form hook is not affected (Judgment J7.37). <!-- req: hooks.behavior.Failed hooks on Windows without Git Bash -->
2. The fixes a client SHOULD point to: `"onFailure": "continue"` when the call should go ahead on a
   failure; `"onFailure": "block"` with the script exiting 0 where it only warns (the warning then
   printed as a `systemMessage`); installing Git for Windows, or `CLAUDE_CODE_GIT_BASH_PATH`, for a
   hook written for Bash; exec form plus `"onFailure": "block"` for a hook that runs one `.exe`;
   `"onFailure": "block"` plus `"shell": "powershell"` for a PowerShell guard that must keep blocking
   once Git Bash is found. <!-- req: hooks.behavior.Failed hooks on Windows without Git Bash -->

### 7.4.3.2 PowerShell started no program

PowerShell prints, instead of running, a `command` that is only quoted strings, such as
`"command": "\"C:\\Tools\\guard.exe\""`. When a shell-form hook with no `shell` field runs in
PowerShell by default and its command is only quoted strings, the client MUST NOT run it, and
reports `PowerShell started no program` (Judgment J7.38). <!-- req: hooks.behavior.PowerShell started no program -->

| The hook means | Fix |
| --- | --- |
| **To print text, such as JSON** | Set `"shell": "powershell"`; the hook then prints the text and exits 0. <!-- req: hooks.behavior.PowerShell started no program.To print text, such as JSON --> |
| To run a `.ps1`, `.cmd` or `.bat` file, or a `.exe` whose path has a variable | Set `"shell": "powershell"` and put `&` before the quoted path; spell variables as `$HOME` and `$env:CLAUDE_PROJECT_DIR` (§7.3.2.5). |
| **To run one `.exe` at a path without `$`** | Remove the inner quotes, put the program in `command` and its arguments in `args` (`"args": []` for none), and add `"onFailure": "block"` (§7.4.3.1). <!-- req: hooks.behavior.PowerShell started no program.To run one .exe at a path without $ --> |
| **To run a script written for Bash** | Install Git for Windows or set `CLAUDE_CODE_GIT_BASH_PATH` (§7.4.3.1). <!-- req: hooks.behavior.PowerShell started no program.To run a script written for Bash --> |

## 7.4.4 HTTP responses

An HTTP hook answers with its status and body instead of an exit code and stdout. To block an action
or deny a permission, it returns 2xx with the decision fields of §7.4.5 in a JSON body;
`onFailure: "block"` (§7.4.3) makes a failed request block. Except on an event with its own failure
contract, such as `WorktreeCreate`, where any failure fails the operation (Judgment J7.39), the
client MUST read each response as follows: <!-- req: hooks.behavior.HTTP response handling | hooks.guide.HTTP hooks -->

| Response | Result |
| --- | --- |
| 2xx with an empty body | Success, as exit 0 with no output. <!-- req: hooks.behavior.HTTP response handling.2xx with an empty body --> |
| 2xx with a JSON object body | Read with the JSON output schema of §7.4.5; a body that fails validation is a non-blocking error. <!-- req: hooks.behavior.HTTP response handling.2xx with a JSON object body --> |
| 2xx with any other body, such as plain text | A non-blocking error, as a non-2xx status; the text is not added to Claude's context. |
| A non-2xx status | A non-blocking error; the notice carries `HTTP <status>` (Judgment J7.39). <!-- req: hooks.behavior.HTTP response handling.Non-2xx status --> |
| A connection failure | A non-blocking error. <!-- req: hooks.behavior.HTTP response handling.Connection failure --> |
| A timeout | The run is cancelled (§7.4.2). <!-- req: hooks.behavior.HTTP response handling.Timeout --> |

Each non-blocking error lets the action go ahead, unless the hook's failure blocks (§7.4.3).
<!-- req: hooks.behavior.HTTP response handling -->

## 7.4.5 JSON output

Exit codes only block or stay silent; a JSON object on stdout (or in an HTTP body) gives finer
control. A hook SHOULD choose one approach: exit codes alone, or exit 0 with JSON. When it mixes
them, §7.4.1 and §7.4.1.2 decide the outcome. <!-- req: hooks.guide.Structured JSON output -->

### 7.4.5.1 Fields

The object has three kinds of fields: the universal fields below, which every event accepts though
some discard them (§7.5); top-level `decision` and `reason`, which some events use to block or give
feedback; and `hookSpecificOutput`, an object for events that need more, whose `hookEventName` MUST
be the event's name.

| Field | Default | Effect |
| --- | --- | --- |
| `continue` | `true` | `false` stops Claude's processing entirely after the hook runs. It does not block a `PreToolUse` tool call: a hook that must block it also returns `permissionDecision: "deny"`. On `PreToolUse` and `PostToolUse` the stop applies even when the tool call fails or completes while Claude is still streaming, but not when the permission check refuses a `PreToolUse` call. |
| `stopReason` | none | The message shown to the user when `continue` is `false`. It stays in the conversation, so Claude sees it if the conversation continues. |
| `suppressOutput` | `false` | Accepted and has no effect. |
| `systemMessage` | none | A warning shown to the user. In SDK and `stream-json` output it can arrive as an informational message. |
| `terminalSequence` | none | An escape sequence the client emits for the hook (§7.4.5.3). |

1. **Validation.** A value of the wrong type, a `decision` other than `"block"` (the SDK type's
   deprecated `"approve"` is accepted on `PreToolUse` only), a `hookEventName` that is not the
   event's, and a value outside a field's enum fail validation. A key the schema does not name is
   ignored, not a failure, and the client records `Hook JSON output had unrecognized keys` in the
   debug log (Judgment J7.30). <!-- req: hooks.guide.Structured JSON output -->
2. **Wrong level.** A field placed at the wrong level — `permissionDecision` or `additionalContext`
   at the top level instead of inside `hookSpecificOutput` — is such an unrecognized key: the JSON
   parses, the field has no effect, and no error is shown. <!-- req: hooks.guide.Structured JSON output -->
3. **Decision patterns.** Which events take which decision fields is §7.5. In short: a top-level
   `decision: "block"` with `reason` on `UserPromptSubmit`, `UserPromptExpansion`, `PostToolUse`,
   `PostToolUseFailure`, `PostToolBatch`, `Stop`, `SubagentStop`, `ConfigChange` and `PreCompact`;
   exit code 2 or a top-level `decision: "block"` on `TaskCreated`, where `continue: false` is
   ignored; `hookSpecificOutput` decisions on `PreToolUse` (`permissionDecision` `allow`, `deny`,
   `ask` or `defer`, with `permissionDecisionReason`), `PermissionRequest` (`decision.behavior`),
   `PermissionDenied` (`retry`) and `MessageDisplay` (`displayContent`); `hookSpecificOutput` or a
   top-level `decision: "block"` on `PreModelSwitch` (`permissionDecision` `allow`, `deny` or `ask`)
   and the elicitation events (`action`, `content`), the block cancelling the switch or declining;
   exit code 2 or a top-level `decision: "block"` on `TeammateIdle` and `TaskCompleted`, which keep
   the teammate working or the task open, where `continue: false` lets the teammate go idle (and is
   ignored on a `TaskUpdate` call); context only on `SessionStart`,
   `SubagentStart` and `PostModelSwitch`; a path on `WorktreeCreate`; the exit code alone on `WorktreeRemove`, whose JSON is discarded;
   nothing on the side-effect
   events. The only value of a top-level `decision` is `"block"`: a hook allows by omitting it.
   <!-- req: hooks.behavior.Decision control -->
4. **Rewrites.** `PreToolUse` replaces a tool's input with `updatedInput` directly under
   `hookSpecificOutput`; `PermissionRequest` with `updatedInput` inside its `decision`;
   `PostToolUse` replaces the result of a successful call with `updatedToolOutput`;
   `PostToolUseFailure` cannot rewrite a result, so a failing command's output cannot be redacted.
   `UserPromptSubmit` cannot replace the prompt, only add context beside it. <!-- req: hooks.behavior.Decision control -->
5. On `PreToolUse`, `deny` cancels the call and returns `permissionDecisionReason` to Claude; `ask`
   shows the user the normal permission prompt; `allow` skips the interactive prompt within the
   limits of §7.4.10; `defer` is §7.4.10.4. <!-- req: hooks.guide.Structured JSON output -->

### 7.4.5.2 Size limits

The `additionalContext`, `systemMessage` and `initialUserMessage` strings of a hook, and its plain
stdout, are capped at 10,000 characters each. Each string is measured on its own, also when several
hooks answer one event; plain stdout is measured whole. Over the cap, except for `PreCompact`
stdout (§7.5.31), the client MUST save the text to a file in the session directory and pass, in its
place, the file's path and a preview of up to its first 2,000 characters; Claude is not asked to
read the file. No setting raises this cap. A string an event discards is not saved (Judgment
J7.40). <!-- req: hooks.behavior.Add context for Claude -->

### 7.4.5.3 Terminal notifications

1. `terminalSequence` holds one or more escape sequences from this allowlist: OSC `0`, `1` and `2`
   (window and icon titles), OSC `9` (including `9;4` progress), OSC `99`, OSC `777`, and a bare
   BEL; each OSC ends with BEL or ST. If the value contains anything else — a CSI sequence, an OSC
   palette sequence, an OSC 8 link, OSC 52, OSC 1337, or a control character inside an allowed
   sequence's body (Judgment J7.41) — the client MUST ignore the whole field.
   <!-- req: hooks.behavior.Emit terminal notifications -->
2. The client writes the sequence itself, through its own terminal output, when it processes the
   hook's result, so the field works on events that discard `systemMessage` and `continue`, such as
   `Notification` and `StopFailure`. It writes it only in an interactive session while its interface
   is open, never in `-p` mode or the SDK, and never from a background hook. A `WorktreeCreate`
   command hook cannot return JSON (its stdout is the path); an HTTP one can.
   <!-- req: hooks.behavior.Emit terminal notifications -->

### 7.4.5.4 Context for Claude

1. `additionalContext`, inside `hookSpecificOutput`, passes a string into Claude's context. The
   client MUST wrap it in a system reminder and insert it where the hook fired: at the start of the
   conversation for `SessionStart` and `SubagentStart`; beside the submitted prompt for
   `UserPromptSubmit` and `UserPromptExpansion`; next to the tool result for `PreToolUse`,
   `PostToolUse`, `PostToolUseFailure` and `PostToolBatch`; at the end of the turn for `Stop` and
   `SubagentStop`, where the conversation then continues; with the next request after the switch
   for `PostModelSwitch` (§7.5.34). Claude reads it on the next model request; it is not a chat
   message in the interface. On any other event the field is discarded (Judgment J7.108, §7.5).
   <!-- req: hooks.behavior.Add context for Claude -->
2. When several hooks return `additionalContext` for one event, Claude receives every value. A
   `<system-reminder>` or `</system-reminder>` tag inside a value reaches Claude with its `<`
   replaced by `&lt;`. <!-- req: hooks.behavior.Add context for Claude -->
3. The client saves the injected text in the transcript. On `--continue` or `--resume` it replays
   the saved text of past turns instead of re-running their hooks, so a timestamp or a commit hash
   from a mid-session event is stale; `SessionStart` runs again with `source` `resume` (or `fork`)
   and can refresh. <!-- req: hooks.behavior.Add context for Claude -->
4. What belongs there is information about the current state, written as facts rather than
   commands to the model (text framed as out-of-band system instructions can trip Claude's
   prompt-injection defences and be shown to the user instead):
   - **Environment state**: the current branch, the deployment target, the feature flags that are
     on. <!-- req: hooks.behavior.Add context for Claude.Environment state -->
   - **Conditional project rules**: which test command applies to the file just edited, which
     directories are read-only in this worktree. <!-- req: hooks.behavior.Add context for Claude.Conditional project rules -->
   - **External data**: open issues, recent CI results, content fetched from an internal service.
     <!-- req: hooks.behavior.Add context for Claude.External data -->

   Instructions that never change belong in `CLAUDE.md`.

## 7.4.6 Prompt and agent responses

A prompt or agent hook's model MUST answer with one JSON object:

| Field | Meaning |
| --- | --- |
| `ok` | `true` lets the action proceed; `false` is handled per event, below. <!-- req: hooks.behavior.Response schema.ok --> |
| `reason` | The explanation; required when `ok` is `false`. <!-- req: hooks.behavior.Response schema.reason --> |
| `impossible` | Prompt hooks only, optional, with `ok: false`: the model judges the condition can never be met. On `Stop` and `SubagentStop` the client then lets the turn end instead of feeding the reason back; agent hooks and other events ignore it. <!-- req: hooks.behavior.Response schema.impossible --> |

A reply that is not one such object (optionally in one code fence), including `ok: false` without a
non-blank `reason`, gives no verdict: the run is a non-blocking error (Judgment J7.43).

On `ok: false`, a prompt hook does this, and an agent hook does what a prompt hook with
`continueOnBlock: true` does (§7.3.7):

| Event | On `ok: false` |
| --- | --- |
| `Stop`, `SubagentStop` | The reason is fed back to Claude as its next instruction and the turn continues, unless `impossible: true`, which lets the turn end. <!-- req: hooks.behavior.Response schema.Stop --> |
| `PreToolUse` | The call is denied. By default the turn ends and the reason appears in the chat as a warning line; with `continueOnBlock: true` the reason returns to Claude as the tool error and it continues, as a command hook's `permissionDecision: "deny"` does. <!-- req: hooks.behavior.Response schema.PreToolUse --> |
| `PostToolUse` | By default the turn ends with the reason as a warning line; with `continueOnBlock: true` the reason is fed back to Claude and the turn continues. <!-- req: hooks.behavior.Response schema.PostToolUse --> |
| `PostToolBatch`, `UserPromptSubmit`, `UserPromptExpansion` | The turn ends and the reason appears as a warning line, whatever `continueOnBlock` says, so an agent hook ends it too (Judgment J7.65). <!-- req: hooks.behavior.Response schema.PostToolBatch --> |
| `PostToolUseFailure`, `TaskCreated` | The reason returns to Claude as a tool error and the turn continues, whatever `continueOnBlock` says. <!-- req: hooks.behavior.Response schema.PostToolUseFailure --> |
| `TaskCompleted` | On a `TaskUpdate` call: Claude receives the reason as the tool result and the turn continues, whatever `continueOnBlock` says. At the end of a teammate's turn: as `TeammateIdle`. <!-- req: hooks.behavior.Response schema.TaskCompleted --> |
| `TeammateIdle` | By default the teammate goes idle and the reason appears in its transcript; with `continueOnBlock: true` the reason is sent to the teammate and it keeps working. <!-- req: hooks.behavior.Response schema.TeammateIdle --> |
| `PermissionRequest` | Does not deny the request; a deny comes from a command hook's `decision.behavior: "deny"`. <!-- req: hooks.behavior.Response schema.PermissionRequest --> |
| `PermissionDenied` | No effect: the denial has happened and the only output read is `retry`, which these hooks cannot set; they run and their output is discarded. <!-- req: hooks.behavior.Response schema.PermissionDenied --> |

<!-- req: hooks.behavior.Prompt hook configuration.continueOnBlock | hooks.guide.Prompt-based hooks -->

## 7.4.7 Permission update entries

`updatedPermissions` (a `PermissionRequest` output) and `permission_suggestions` (its input) are
arrays of the same entries, the official `PermissionUpdate` type. Each has a `type`, the fields that
type needs, and a `destination`:

| `type` | Fields | Effect |
| --- | --- | --- |
| `addRules` | `rules`, `behavior`, `destination` | Adds permission rules. `rules` is an array of `{ toolName, ruleContent? }`; without `ruleContent` the rule matches the whole tool. `behavior` is `"allow"`, `"deny"` or `"ask"`. <!-- req: hooks.permissionUpdate.addRules --> |
| `replaceRules` | `rules`, `behavior`, `destination` | Replaces every rule of that `behavior` at the destination with `rules`. <!-- req: hooks.permissionUpdate.replaceRules --> |
| `removeRules` | `rules`, `behavior`, `destination` | Removes the matching rules of that `behavior`. <!-- req: hooks.permissionUpdate.removeRules --> |
| `setMode` | `mode`, `destination` | Changes the permission mode to `default`, `auto`, `acceptEdits`, `dontAsk`, `bypassPermissions` or `plan`; `manual` is an alias of `default`. <!-- req: hooks.permissionUpdate.setMode --> |
| `addDirectories` | `directories`, `destination` | Adds working directories, an array of path strings. <!-- req: hooks.permissionUpdate.addDirectories --> |
| `removeDirectories` | `directories`, `destination` | Removes working directories. <!-- req: hooks.permissionUpdate.removeDirectories --> |

| `destination` | Writes to |
| --- | --- |
| `session` | Memory only, discarded when the session ends. |
| `localSettings` | `.claude/settings.local.json` |
| `projectSettings` | `.claude/settings.json` |
| `userSettings` | `~/.claude/settings.json` |
| `cliArg` | The session's command-line rules (in the official type, not the docs table; Judgment J7.44). |

1. `setMode` to `bypassPermissions` MUST take effect only in a session launched with bypass mode
   available (`--dangerously-skip-permissions`, `--permission-mode bypassPermissions`,
   `--allow-dangerously-skip-permissions`, or `permissions.defaultMode: "bypassPermissions"` in user,
   `--settings` or managed settings); otherwise, under `permissions.disableBypassPermissionsMode`,
   or in restricted mode, it is a no-op. `bypassPermissions` is never persisted as `defaultMode`,
   whatever the destination. <!-- req: hooks.permissionUpdate.setMode -->
2. **Rules in an entry.** For a permission rule written `Tool(specifier)` (§13.2), `toolName` is
   the tool's name and `ruleContent` the specifier: `Bash(npm test)` is `{ "toolName": "Bash",
   "ruleContent": "npm test" }`; `Bash` and `Bash(*)`, which both match the whole tool, are
   `{ "toolName": "Bash" }`; `mcp__github__get_issue` is `{ "toolName": "mcp__github__get_issue" }`.
   An allow rule for an MCP tool MUST leave `ruleContent` out: with it the rule matches no call
   (§13.7). <!-- req: hooks.permissionUpdate.addRules -->
3. A hook MAY echo one of the `permission_suggestions` it received as its own `updatedPermissions`.
   The suggestions are not the options of the dialog the user would see: a dialog builds its own,
   may withhold one whose suggestion is in the array, and may offer one with no entry.

## 7.4.8 Combining several hooks

1. Every selected hook runs to completion before the client merges the results (§7.2.5).
   <!-- req: hooks.guide.Combine results from multiple hooks -->
2. For `PreToolUse` permission decisions the most restrictive answer wins, in the order `deny`,
   `defer`, `ask`, `allow`, whichever way each hook expressed it: an exit-2 or a failure that blocks
   counts as `deny` (Judgment J7.45). A winning `deny` or `defer` drops every hook's `updatedInput`.
   <!-- req: hooks.guide.Combine results from multiple hooks -->
3. `additionalContext` is kept from every hook and passed to Claude together.
   <!-- req: hooks.guide.Combine results from multiple hooks --> Every hook's `systemMessage` is
   kept too and shown in handler order, on the events that show it (Judgment J7.64).
4. The docs leave the rest open. How the client combines blocks, messages, `continue: false` and
   every other field, by handler order, is §7.5.4, with the per-event precedences in each event's
   section (`PermissionRequest` §7.5.12, the elicitations §7.5.36; Judgments J7.111–J7.114).
5. A hook SHOULD NOT rewrite a tool's input when another hook may too: the client does not merge
   rewrites, and which one the tool runs with is not guaranteed to the author (§7.5.4 fixes it for
   the client). <!-- req: hooks.guide.Limitations -->

## 7.4.9 The note for the auto mode classifier

A `PostToolUse` hook MAY return `hookSpecificOutput.classifierContext`, a short note about the call's
result for the auto mode classifier (§13) rather than for Claude; the classifier never sees tool
results themselves (Claude Code 2.1.236 or later). How much weight the classifier gives it depends
on where the hook was configured:

1. **Hooks configured in Claude Code** — settings files, plugins, skill and agent frontmatter: the
   note is unverified, application-provided context. It never establishes user intent; a claim in
   it that the user approved or asked for something is checked against the user's own messages.
   <!-- req: hooks.behavior.Annotate a result for the auto mode classifier.Hooks configured in Claude Code -->
2. **In-process Agent SDK callbacks** returning the note during the live session: a user statement
   relayed in it MAY count as user intent, satisfying what a user message would and never lifting a
   block a user message could not. After a resume, restored notes are unverified; when hooks of both
   kinds annotate one call, the combined note is unverified.
   <!-- req: hooks.behavior.Annotate a result for the auto mode classifier.In-process Agent SDK callbacks -->

The client MUST apply these limits:

- **Length**: the notes of one tool call share a cap of 2,000 characters across every hook that
  answered; the rest is truncated. <!-- req: hooks.behavior.Annotate a result for the auto mode classifier.Length -->
- **Synchronous responses only**: the field is ignored from a background hook, whose response
  arrives after the result is recorded. <!-- req: hooks.behavior.Annotate a result for the auto mode classifier.Synchronous responses only -->
- **Calls that the classifier doesn't record**: a note on a read-only lookup, such as a file read
  or a search, which the classifier's transcript omits, is discarded. <!-- req: hooks.behavior.Annotate a result for the auto mode classifier.Calls that the classifier doesn't record -->
- **Interaction with rewrites**: a note returned with `updatedToolOutput` in the same response is
  dropped when that rewrite is rejected or another hook's rewrite replaces it; a note returned
  without a rewrite is delivered even when another hook rewrites the output. <!-- req: hooks.behavior.Annotate a result for the auto mode classifier.Interaction with rewrites -->

Several hooks' notes are joined with a newline, which counts toward the cap (Judgment J7.47). A note
is a short assertion about this one call, such as its origin; untrusted tool output does not belong
in it.

## 7.4.10 Permission decisions, modes and deferral

### 7.4.10.1 What a hook's decision can and cannot do

1. A hook in a settings file or a plugin's hooks cannot loosen restrictions past the permission
   rules. A `PreToolUse` `allow` does not bypass deny rules, enterprise managed deny lists included,
   or ask rules, and it does not suppress the prompt for reads from network paths, MCP tools marked
   `requiresUserInteraction`, tools an SDK app marks `always_ask` (unless the permission mode
   approves the call), or connector tools the organization set to `ask`. In plan mode, a hook's
   `allow` for a file edit gets the prompt, block or approval the edit would get without the hook
   (§13). <!-- req: hooks.guide.Hooks and permission modes -->
2. A hook's `deny` MUST hold in every permission mode, `bypassPermissions` and
   `--dangerously-skip-permissions` included: `PreToolUse` fires before any permission-mode check,
   in every mode including `dontAsk`. Where a mod can still approve a call a hook blocked is §10 and
   §13. <!-- req: hooks.guide.Hooks and permission modes -->

### 7.4.10.2 Auto mode

1. **`updatedInput` without a decision.** In auto mode, when a `PreToolUse` hook returns
   `updatedInput` with no `permissionDecision`, the client can deny the changed call, because the
   server reviewed the input Claude wrote, not the one the hook returned. In interactive terminal and
   VS Code sessions on a direct Anthropic API connection the denial includes `a hook changed this
   call's input after auto mode reviewed it`. If Claude then repeats the changed input exactly, the
   hook still runs and may deny or ask, but any `updatedInput` it returns is dropped, so what runs is
   what was reviewed. In those sessions a `command` hook from settings or a plugin's hooks file can
   change Bash, PowerShell, Monitor, Edit, Write and NotebookEdit calls without this denial, unless
   a hook changed an earlier call in the same response or a Bash command asks to run outside the
   sandbox. <!-- req: hooks.behavior.PreToolUse updatedInput in auto mode -->
2. **`ask`.** In auto mode a `PreToolUse` `ask` sends the call to the permission prompt, and the
   classifier does not decide it, except: a call the client's own checks flag too (a write to a
   protected path, a command asking to run outside the sandbox) may be denied by the classifier
   before any prompt, and still goes to the prompt if approved; a `SubagentHandback` call shows no
   prompt and runs even if the classifier objects. To stop a `SubagentHandback` call a hook returns
   `deny`; the client then tells the subagent, up to three times, that its report was not delivered,
   and when the hook keeps denying, the subagent ends without delivering it and the waiting
   conversation gets a note saying so. <!-- req: hooks.behavior.PreToolUse ask decisions in auto mode -->

### 7.4.10.3 Tools that need the user

`AskUserQuestion` and `ExitPlanMode` need user interaction; in `-p` mode the client offers them only
when the run has a permission host to answer (an SDK `canUseTool` callback, a
`--permission-prompt-tool`). A `PreToolUse` hook stands in for the user when it reads the input,
collects the answer through its own interface, and returns `permissionDecision: "allow"` with an
`updatedInput` that holds the answer; `allow` alone is not enough. For `AskUserQuestion` the
`updatedInput` echoes the `questions` array and adds `answers`, mapping each question's text to the
chosen label. An MCP tool marked `_meta["anthropic/requiresUserInteraction"]` keeps its prompt
whatever a hook returns. <!-- req: hooks.behavior.Tools that require user interaction -->

### 7.4.10.4 Deferring a tool call

1. A client MUST honour `permissionDecision: "defer"` only in `-p` mode and only when Claude makes a
   single tool call in the turn. In an interactive session it logs a warning and ignores the hook's
   result; with several tool calls at once it ignores `defer` with a warning and the call goes
   through the normal permission flow. An ignored `defer` leaves no hook decision: the other hooks'
   `ask` or `allow` do not stand in for it (Judgment J7.117, §7.5.11). <!-- req: hooks.behavior.Defer a tool call for later -->
2. On `defer` the tool does not run; the turn ends with a result whose `stop_reason` is
   `tool_deferred` and whose `deferred_tool_use` carries the call's `id`, `name` and `input`; the
   pending call stays in the transcript. When the caller resumes with `claude -p --resume <id>` and
   the same permission host, the same call fires `PreToolUse` again; `allow` with the answer in
   `updatedInput` runs it, and another `defer` keeps it pending. A prompt sent with a resume while
   the call is pending is answered without the call's result. There is no timeout or retry limit:
   the session lasts until the retention sweep (`cleanupPeriodDays`, 30 days by default) deletes it.
   <!-- req: hooks.behavior.Defer a tool call for later -->
3. A resume restores no stored permission mode: the run starts in the mode a new `claude -p` run
   would, and a plan-mode session needs `--permission-prompt-tool` with `--resume` to present its
   plan (2.1.246 or later). When the deferred call's tool is not available on resume, the result's
   `stop_reason` is `tool_deferred_unavailable` and its `deferred_tool_use` names the tool; the hook
   does not fire, a prompt does not reach Claude and the run exits 1 with a result that starts
   `<tool> isn't available, so its deferred call didn't run.`
   `CLAUDE_CODE_DROP_UNAVAILABLE_DEFERRED_TOOL=1` drops the call: with a prompt, Claude gets an error
   as the call's result and answers the prompt; without one, the run still drops it and exits 1.
   <!-- req: hooks.behavior.Defer a tool call for later -->

## 7.4.11 Rules of particular events

The rules above hold on every event unless the event's section of §7.5 says otherwise. That
section, and only it, states the event's input, which output fields it honours or discards, what
exit code 2 and a timeout do there, and its timing: `Setup` §7.5.6, the prompt events §7.5.8 and
§7.5.9 (a blocked prompt, `Esc` during a check), `PreToolUse` §7.5.11, `PostToolUse` after an
interrupt §7.5.13, the `Stop` block cap §7.5.22, `PreCompact` stdout §7.5.31, the model switches
§7.5.33 and §7.5.34, the worktrees §7.5.29 and §7.5.30, the elicitations §7.5.36 and §7.5.37.

## 7.4.12 Diagnostics

1. The client MUST write hook execution to its debug log (`--debug`, which writes
   `~/.claude/debug/<session-id>.txt` and prints nothing to the terminal, or `--debug-file
   <path>`): what matched, each run's outcome, stdout it treated as plain text (`Hook output does
   not start with {, treating as plain text`), fields it dropped. From Claude Code 2.1.296, a line per
   finished command hook on a tool event, `UserPromptSubmit`, `SessionStart`, `Stop` and several
   other events reads `Hooks:
   <Event>:<matched value> [<command>]`, then the plugin the hook came from if any, how the run
   ended (`finished with status <n>`, `timed out after <N>ms`, `cancelled`, `moved to the
   background`, `failed to start`) and its duration in parentheses, as in `Hooks:
   PostToolUse:Write [.claude/hooks/log-write.sh] finished with status 0 (31ms)`. On
   some events, such as `Notification`, `SessionEnd` and `PreCompact`, the line says `completed with
   status <n>` and has no duration. <!-- req: install.troubleshooting.Hook loads but never fires -->
2. The line's facts and its text belong to different parts of a client (Judgment J7.67). The part
   that selects and runs hooks MUST make available, for every run it finishes: the event, the value
   the matcher was tested against, the handler (its `command`, or for another type what §7.4
   names it by), the plugin it came from, how the run ended with its exit status or timeout, and
   its duration. The part that owns the debug log formats and writes the line; its exact wording,
   the timestamp and level, and which events get a duration are that part's, and a hook MUST NOT
   depend on them.
3. A notice `Stop hook error: Failed with non-blocking status code: /bin/sh: node: command not found`
   means the shell could not find the program on the `PATH` the client was started with; a stderr
   that shows a plugin's path cut at a space means a shell-form command used `${CLAUDE_PLUGIN_ROOT}`
   unquoted (§3.2.3). <!-- req: install.troubleshooting.hook error notices in the transcript -->

## Design decisions

### Why exit 1 does not block

Scripts exit 1 for every kind of trouble, including a missing `jq` or a typo. If exit 1 blocked, any
broken hook would stop the user's work; so only the deliberate exit 2 blocks, and a hook that must
fail closed says so with `onFailure: "block"`.

### Why JSON printed with a failing exit code still counts

A script that prints a well-formed decision and then exits non-zero (a trailing command failed) has
still made its decision; honouring the JSON keeps the visible answer authoritative. A hook whose
failure blocks is the exception, because there the author asked for any failure to count.

### Why unknown output keys are ignored

A newer release adds output fields. A hook written for it must still run on an older client, and a
hook that sets a field a client does not know has made no claim the client could honour; dropping
the key, with a debug line, keeps the rest of the decision.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J7.30 | An output key the schema does not name is ignored, with the debug line `Hook JSON output had unrecognized keys`; only wrong types, wrong enum values, a `decision` other than `block` (`approve` accepted on `PreToolUse`) and a wrong `hookEventName` fail validation. | `hooks-guide.md`, "Fields at the wrong level": misplaced fields are ignored "without reporting an error" and logged as unrecognized keys; the docs call only JSON that "fails schema validation" an error. `SyncHookJSONOutput.decision` is `'approve' \| 'block'`. Reference: `src/hooks/output/schemas-common.ts`. |
| J7.31 | "A JSON output object that sets a field" is an object with at least one key; `{}` sets none. | The docs do not define "sets a field". Reference: `src/hooks/verdict/stdout-kind.ts`. |
| J7.32 | A non-command hook is named in a notice by its URL (`http`), `server:tool` (`mcp_tool`) or its type (`prompt`, `agent`); with no stderr the non-blocking notice says `no stderr output`; on an event without a tool the name is `<Event>`. | The docs show the line only for command hooks on a tool event with a stderr. Reference: `src/hooks/verdict/notices.ts`. |
| J7.33 | `This hook comes from the <plugin> plugin.` follows the error after a space, naming the plugin by its manifest name (else its id), only when stderr is the blocking message; on a blocked prompt it precedes the `Original prompt:` line. | `plugins/troubleshooting.md` says the error "ends with" it; `hooks.md` says a blocked prompt's message "ends with `Original prompt:`"; both cannot be last. Reference: `src/hooks/verdict/exited.ts`. |
| J7.34 | A capture held open by a background process is refused for any exit code but 2, not only after an allow, and blocks where exit 2 blocks or a failure denies; not on `Stop`, `SubagentStop`, `TaskCompleted`, `TeammateIdle`. | `hooks.md` shows the allow case; a late deny is the same risk, and blocking a Stop would loop. Reference: `src/hooks/verdict/suspect-capture.ts`. |
| J7.35 | With `onFailure: "block"` on an event where exit 2 only shows stderr, the failure text takes that route. | "A failure does what exit code 2 does on that event". Reference: `src/hooks/verdict/on-failure.ts`. |
| J7.36 | A `PreModelSwitch` timeout blocks unless `onFailure` is explicitly `"continue"`. | "Timeouts" says the switch is blocked; "Block the action when a hook fails" says `"continue"` lets the action go ahead. Reference: `src/hooks/verdict/on-failure.ts`. |
| J7.37 | On Windows without Git Bash every shell-form `PreToolUse` and `PermissionRequest` command hook with `onFailure` unset is a gate, whatever its `shell`; an exec-form hook is not. | The docs say "a shell-form ... command hook"; the older message exempted `shell: "powershell"`, the 2.1.321 one does not. Reference: `src/hooks/verdict/on-failure.ts`. |
| J7.38 | `PowerShell started no program` is raised for a shell-form hook that runs in PowerShell by default (no `shell`) and whose command is only quoted strings (`"..."` or `'...'`, one or several); the run counts as not started. A hook with `"shell": "powershell"` runs as written. | `hooks.md` names the error and its fixes, not when it is raised; its first fix says that with `shell` set the hook prints and exits 0. Reference: `src/loading/resolve/powershell-no-program.ts`. |
| J7.39 | A failed HTTP or `mcp_tool` hook fails `WorktreeCreate` and `WorktreeRemove`; a non-2xx notice carries `HTTP <status>`, a connection failure the client's error text. | "Except on events with their own failure contract ... such as `WorktreeCreate`"; no wording is given. Reference: `src/hooks/verdict/http-response.ts`, `interpret.ts`. |
| J7.40 | Over the 10,000-character cap the replacement reads `Output too large (<N> characters). Full output saved to: <path>` and the preview; characters are code points; a string the event discards is not saved. | The docs give the cap, the 2,000-character preview and "a file in the session directory", no wording. Reference: `src/hooks/output/text-cap.ts`, `limit.ts`. |
| J7.41 | A control character (C0, DEL or C1, a newline included) inside the body of an allowed OSC sequence makes `terminalSequence` ignored. | The allowlist exists to stop other sequences; a control character could end the allowed one early. Reference: `src/hooks/output/terminal-sequence.ts`. |
| J7.43 | A prompt or agent reply that is not exactly one object of the schema (in at most one code fence), or `ok: false` without a non-blank `reason`, is a non-blocking error, not an allow or a block. | The docs say what the model must answer, not what a malformed answer does; guessing either way would let a model's formatting decide. Reference: `src/hooks/handlers/remote/prompt-response.ts`. |
| J7.44 | The `cliArg` destination, in the official `PermissionUpdateDestination` and not in the docs table, is accepted. | A suggestion can carry it and "a hook can echo one" back. Reference: `src/hooks/output/permission-update.ts`. |
| J7.45 | An exit-2 or blocking failure of a `PreToolUse` hook ranks as `deny` in the precedence, and drops the other hooks' `updatedInput`. | The precedence `deny > defer > ask > allow` holds whichever way a hook blocks; `hooks-guide.md`'s own example combines an exit 2 with a silent hook as a deny. Reference: `src/hooks/output/finalize.ts`. |
| J7.47 | Several hooks' `classifierContext` notes are joined with a newline, counted in the 2,000-character cap. | The docs give a shared cap and no separator. Reference: `src/hooks/output/merge-simple.ts`. |
| J7.49 | The `Original prompt:` quote starts a line of its own. | `hooks.md` says the message "ends with `Original prompt:` followed by the submitted text", with no layout. Reference: `src/hooks/verdict/blocked-prompt.ts`. |
| J7.63 | The 10-second limit after `Ctrl+Enter` applies to command hooks; other types keep their `timeout`. | "Claude Code kills a command hook that is still running", naming no other type. Reference: `src/hooks/interrupt.ts`. |
| J7.64 | Of several hooks on one occurrence, every `systemMessage` is kept and shown, in handler order (§7.2), none replacing another (§7.4.8, §7.5.4). | hooks-guide.md, "Combine results from multiple hooks", says only that `additionalContext` "is kept from every hook and passed to Claude together"; it says nothing of `systemMessage`. A warning one hook raises is lost to the user if another hook's replaces it, and handler order keeps the outcome independent of timing (J7.111). Lead: the reference implementation's `src/host/sdk-output.ts` joins several hooks' `systemMessage` strings with a newline. |
| J7.65 | On `PostToolBatch`, `UserPromptSubmit` and `UserPromptExpansion`, `ok: false` of a prompt or agent hook ends the turn whatever `continueOnBlock` says (§7.4.6). | hooks.md, "Response schema", says of these three events that "the turn ends and the reason appears as a warning line" and adds that they "end the turn on `decision: "block"` regardless of `continue`". The added sentence speaks of a command hook's top-level fields: a prompt or agent response has no `continue` (its fields are `ok`, `reason`, `impossible`), and `decision: "block"` ends these turns even beside `continue: true`. Read for prompt hooks, it leaves `continueOnBlock` without an exception here: the bullets for `PreToolUse`, `PostToolUse` and `TeammateIdle` name `continueOnBlock` where it changes the outcome, and this one does not. The reference implementation reads it the same (`src/hooks/handlers/remote/ok-false.ts`: these three always end the turn, with or without `continueOnBlock` and for agent hooks). Not observed: a prompt hook needs a model call. |
| J7.67 | A library that runs hooks returns each finished run's event, matched value, handler, plugin, ending, exit status or timeout, and duration; writing the debug line from them is the host's (§7.4.12). | `hooks.md`, "Debug hooks", describes the line the debug log holds and what it names; the log, its location and its format are the client's output, not a contract a plugin reads. Splitting at the facts lets a library be tested on what it decided while the host keeps its log format. |
| J7.212 | "A non-empty answer also counts" as an `mcp_tool` failure under `"block"` only on the events that can block (§7.5), not on the side-effect events; "sets a hook output field" is read as in J7.31 (at least one key the schema names), so an object holding only `reason`, or only unknown keys, is a failure. | `hooks.md`, "Block the action when a hook fails" (2.1.330), names `PreToolUse` and `UserPromptSubmit` "such as" and gives the `{}` and `reason` exceptions without defining the rest; on an event that cannot block, `"block"` has nothing to block. |
