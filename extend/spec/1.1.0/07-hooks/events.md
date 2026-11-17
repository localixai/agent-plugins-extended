# 7.5 Hook events

This section defines every hook event Claude Code 2.1.321 fires: when it fires, what its matcher
filters on, the input its handlers receive, the output the client honours and how several
handlers' outputs combine, and what exit code 2 does. Where a hook is configured and how a matcher
is evaluated is §7.2; the handler types and which events run each is §7.3; exit codes, stdout
classification, the JSON output schema and its validation are §7.4; tool names and the shapes of
`tool_input` and `tool_response` are §7.6. Evidence: `hooks.md`, the section named after each event
and its "input", "decision control" or "output" subsection, unless a paragraph names another. Shapes
follow the official types of `@anthropic-ai/claude-agent-sdk` 0.3.321 (`HookInput` and its 33
variants, `SyncHookJSONOutput`, the `*HookSpecificOutput` types).

## 7.5.1 The events

The client MUST fire exactly the 33 events of the SDK's `HookEvent` union, under these names
(case-sensitive). A key of a hooks map that names no event loads nothing (Judgment J7.100).

| Event | Fires | Matcher filters on | Exit 2 blocks | § |
| --- | --- | --- | --- | --- |
| `SessionStart` | a session begins or resumes | how it started (`source`) | no | 7.5.5 |
| `Setup` | `--init-only`, or `-p` with `--init` / `--maintenance` | the flag (`trigger`) | no | 7.5.6 |
| `InstructionsLoaded` | a `CLAUDE.md` or rules file enters context | `load_reason` | no | 7.5.7 |
| `UserPromptSubmit` | a prompt is submitted, before Claude reads it | — | yes | 7.5.8 |
| `UserPromptExpansion` | a typed command expands into a prompt | `command_name` | yes | 7.5.9 |
| `MessageDisplay` | assistant text is about to be rendered | — | no | 7.5.10 |
| `PreToolUse` | before a tool call runs | `tool_name` | yes | 7.5.11 |
| `PermissionRequest` | a tool call needs a permission decision | `tool_name` | no | 7.5.12 |
| `PostToolUse` | a tool call succeeded | `tool_name` | no | 7.5.13 |
| `PostToolUseFailure` | a tool call that started failed | `tool_name` | no | 7.5.14 |
| `PostToolBatch` | every call of a batch resolved, before the next model call | — | yes | 7.5.15 |
| `PermissionDenied` | auto mode denied a tool call | `tool_name` | no | 7.5.16 |
| `Notification` | the client raises a notification | `notification_type` | no | 7.5.17 |
| `SubagentStart` | a subagent starts or resumes | `agent_type` | no | 7.5.18 |
| `SubagentStop` | a subagent finished responding | `agent_type` | yes | 7.5.19 |
| `TaskCreated` | `TaskCreate` is creating a task | — | yes | 7.5.20 |
| `TaskCompleted` | a task is being marked completed | — | yes | 7.5.21 |
| `Stop` | the main agent finished responding | — | yes | 7.5.22 |
| `StopFailure` | the turn ended on an API error | `error` | no | 7.5.23 |
| `TeammateIdle` | an agent-team teammate is about to go idle | — | yes | 7.5.24 |
| `ConfigChange` | a settings, policy or skill file changed | `source` | yes | 7.5.25 |
| `CwdChanged` | a shell command changed the working directory | — | no | 7.5.26 |
| `DirectoryAdded` | a working directory was added mid-session | `source` | no | 7.5.27 |
| `FileChanged` | a watched file changed on disk | file basename | no | 7.5.28 |
| `WorktreeCreate` | an isolated worktree is being created | — | any non-zero | 7.5.29 |
| `WorktreeRemove` | a hook-created worktree is being removed | — | any non-zero | 7.5.30 |
| `PreCompact` | before a compaction | `trigger` | yes | 7.5.31 |
| `PostCompact` | after a compaction | `trigger` | no | 7.5.32 |
| `PreModelSwitch` | before a requested model switch | target model's canonical name | yes | 7.5.33 |
| `PostModelSwitch` | after the session's model changed | target model's canonical name | no | 7.5.34 |
| `SessionEnd` | the session ends | `reason` | no | 7.5.35 |
| `Elicitation` | an MCP server asks the user for input | `mcp_server_name` | yes | 7.5.36 |
| `ElicitationResult` | the user answered an elicitation | `mcp_server_name` | yes | 7.5.37 |

"—" means the event has no matcher support: a `matcher` on it is ignored and every matched group
runs (§7.2). Three cadences hold for a few events: `SessionStart` and `SessionEnd` once per session,
`UserPromptSubmit`, `Stop` and `StopFailure` once per turn, `PreToolUse` and `PostToolUse` on every
tool call except `EndConversation` calls, which fire neither (`hooks.md`, "Hook lifecycle"). The
other events fire at their own moments, given in their sections.

Hooks from settings files, managed policy and plugins also run inside subagents: a tool call a
subagent makes fires the tool events with the same configured hooks, and the input carries the
subagent's `agent_id` and `agent_type` (`hooks.md`, "Hook locations"). A subagent's frontmatter
`Stop` hook is registered as `SubagentStop` (§5).

In the sections below, **Input** lists the fields beyond §7.5.2; **Output** lists the fields beyond
§7.5.3 and says which universal fields the event discards; **Several handlers** says how their
outputs combine where §7.5.4 does not cover it; **Exit 2** is what a blocking exit does. A field the
event discards is accepted by schema validation (§7.4) and has no effect.

## 7.5.2 Common input fields

Every event's input carries these fields (`hooks.md`, "Common input fields"; type
`BaseHookInput`). §7.4 defines how the input reaches a command hook (stdin) and an HTTP hook (the
POST body).

| Field | Type | Present | Meaning |
| --- | --- | --- | --- |
| `session_id` | string | always | The session's identifier. <!-- req: hooks.input.common.session_id --> |
| `prompt_id` | string | after the first user input | UUID of the user prompt being processed; equals the `prompt.id` attribute of the client's OpenTelemetry events. Absent until the first user input. <!-- req: hooks.input.common.prompt_id --> |
| `transcript_path` | string | always | Path of the session transcript (JSONL). The file is written asynchronously and MAY lag the conversation; a hook that needs the turn's final text reads `last_assistant_message` (§7.5.19, §7.5.22). <!-- req: hooks.input.common.transcript_path --> |
| `cwd` | string | always | The working directory when the hook is invoked. <!-- req: hooks.input.common.cwd --> |
| `scratchpad_dir` | string | when the session has a scratchpad | The session's scratchpad directory; absent when there is none or the temporary directory is unavailable (Judgment J7.101). <!-- req: hooks.input.common.scratchpad_dir --> |
| `permission_mode` | string | some events | `"default"`, `"plan"`, `"acceptEdits"`, `"auto"`, `"dontAsk"` or `"bypassPermissions"`. The mode labelled **Manual** MUST arrive as `"default"`, never `"manual"`. Which events carry it: Judgment J7.102. <!-- req: hooks.input.common.permission_mode --> |
| `effort` | `{ level: string }` | events with a tool-use context, on models with effort | `level` is the effort level in force when the hook runs (`"low"`, `"medium"`, `"high"`, `"xhigh"`, `"max"`), a skill's, subagent's or `ultrathink` level included; on a model that does not support the chosen level, the level that ran; a level the user just changed MAY show here before it takes effect. The same value as `$CLAUDE_EFFORT` (§3). Which events: Judgment J7.103. <!-- req: hooks.input.common.effort --> |
| `hook_event_name` | string | always | The event's name, as in §7.5.1. <!-- req: hooks.input.common.hook_event_name --> |
| `agent_id` | string | inside a subagent or in-process teammate | Unique identifier of the subagent or in-process teammate the hook fires in. <!-- req: hooks.input.common.agent_id --> |
| `agent_type` | string | with `--agent`, or inside a subagent | The agent's name (`"Explore"`, `"security-reviewer"`, a plugin agent's scoped name). Inside a subagent, the subagent's type wins over the session's `--agent`. <!-- req: hooks.input.common.agent_type --> |

A field marked "when" or "some events" is omitted, not sent empty, when it does not apply
(Judgment J7.104). Only `SessionStart` carries a `model`; the model events carry `from_model` and
`to_model` (§7.5.33). The client sets no `$CLAUDE_MODEL` variable (`hooks.md`, "Common input
fields").

**The scratchpad.** `scratchpad_dir` names a per-session directory under the client's temporary
directory: `/private/tmp/claude-<uid>/<project>/<session-id>/scratchpad/` on macOS,
`/tmp/claude-<uid>/<project>/<session-id>/scratchpad/` on Linux (the same shape under `$TMPDIR`
when the system sets one) and `%TEMP%\claude\<project>\<session-id>\scratchpad\` on Windows, where
`<project>` is the working directory path with every character other than a letter or digit
replaced by `-`. With `CLAUDE_CODE_TMPDIR` set, the tree moves under that directory. A session has a
scratchpad only when it is signed in with a claude.ai account (not an API key), uses the Anthropic
API (not Amazon Bedrock, Google Cloud's Agent Platform or Microsoft Foundry), and `enableArtifact`
is not `false`; otherwise the field is absent. The directory lasts as long as the session's
transcript: the retention sweep deletes it with the transcript, `claude purge` leaves it, and the
operating system may clear it, so a hook MUST NOT keep anything there that it needs after the
session. <!-- docs: claude-directory.md | Session scratchpad directory -->

## 7.5.3 Universal output fields

A hook's JSON output (§7.4 says when stdout is one) MAY carry these fields on every event (`hooks.md`,
"JSON output"; type `SyncHookJSONOutput`). Each event section says which of them it discards.

- **`continue`** (boolean, default `true`). `false` makes Claude stop processing after the hook
  runs, and takes precedence over every event-specific decision field. On `PreToolUse` and
  `PostToolUse` the stop holds even when the tool call fails or completes while Claude is still
  streaming. <!-- req: hooks.output.common.continue | hooks.output.JSON.continue -->
- **`stopReason`** (string). Shown to the user when `continue` is `false`; it stays in the
  conversation, so Claude sees it if the conversation goes on. <!-- req: hooks.output.common.stopReason | hooks.output.JSON.stopReason -->
- **`suppressOutput`** (boolean, default `false`). Accepted and without effect: a successful hook's
  stdout is never shown in the transcript and goes to the debug log in every case. <!-- req: hooks.output.common.suppressOutput | hooks.output.JSON.suppressOutput -->
- **`systemMessage`** (string). A warning shown to the user. In Agent SDK and `--output-format
  stream-json` output it MAY arrive as an `SDKInformationalMessage`. Some events discard it or route
  it elsewhere (`DirectoryAdded`, §7.5.27). <!-- req: hooks.output.common.systemMessage | hooks.output.JSON.systemMessage -->
- **`terminalSequence`** (string). One or more terminal escape sequences the client writes to its
  own terminal on the hook's behalf: OSC `0`, `1`, `2`, `9` (including `9;4`), `99`, `777`, and bare
  BEL, each ended by BEL or ST. A value holding anything else (CSI, OSC 8, 52, 1337, palette
  sequences) is ignored whole. The client writes it only in an interactive session while its
  interface is open, never under `-p` or the Agent SDK, and never for a hook that runs with `async`
  or `asyncRewake`. It works on events that discard `systemMessage` and `continue` (Judgment
  J7.120). <!-- req: hooks.output.common.terminalSequence | hooks.output.JSON.terminalSequence -->

Two more kinds of field are per event: the top-level `decision` and `reason`, and
`hookSpecificOutput`, whose `hookEventName` MUST equal the event's name (§7.4). The client MUST cap
each `additionalContext`, `systemMessage` and `initialUserMessage` string, and plain stdout, at
10,000 characters as §7.4 says. Where `additionalContext` reaches Claude, the client wraps it in a
system reminder at the point the event names, replaces the `<` of any `<system-reminder>` or
`</system-reminder>` tag in it with `&lt;`, and saves it in the transcript, so a resumed session
replays it rather than running the hook again (`hooks.md`, "Add context for Claude").

## 7.5.4 Several handlers on one event

All handlers an occurrence selects run (§7.2, §7.3), and the client combines their results into
one outcome. "Handler order" below is the order §7.2 gives the matched handlers, not the order
they finish, so the outcome does not depend on timing (Judgment J7.111).

1. **Blocks.** If any handler blocks — an exit code that blocks on this event, a failure that
   blocks (`onFailure: "block"`, §7.4), or a JSON decision that blocks — the action is blocked. A
   block by an exit code or failure wins over a JSON decision block of another handler; among
   several, the first in handler order supplies the message (Judgment J7.112).
2. **Context.** Every handler's `additionalContext` (and plain-text stdout on the events that
   take it as context) reaches Claude; none replaces another (`hooks.md`, "Add context for
   Claude").
3. **Messages.** Every handler's `systemMessage` is shown, in handler order (Judgment J7.64).
4. **`continue: false`.** One handler's `continue: false` stops Claude; the `stopReason` shown is
   the first in handler order that has one.
5. **Event fields.** Precedences the docs give are stated in the event's section. Where they give
   none: a single-valued field (a title, a path, a replacement) takes the value of the **last**
   handler in order that returned one; a boolean flag holds if **any** handler set it `true`; a list
   is the union of every handler's list, each entry once, in handler order (Judgment J7.111).

## 7.5.5 `SessionStart`

**When.** The client MUST fire `SessionStart` when it starts a new session or resumes one: at
launch, on `--resume`, `--continue` and `/resume`, after `/clear`, after a compaction, and when a
session is forked. Only `command` and `mcp_tool` handlers run on it (§7.3). At an interactive
launch, a launch-time resume and `/clear`, the hooks run in the background: the user can type and a
resumed conversation shows at once, but Claude's first request MUST wait for them so their context
reaches it, and a prompt sent meanwhile is held (the user MAY take it back with `Esc`). Switching
conversations with `/resume` inside a session waits for the hooks instead. If the user runs `/clear`
or switches conversation while background hooks still run, their results MUST NOT apply. The hooks
can persist variables through `CLAUDE_ENV_FILE` (§3.5.2). <!-- req: hooks.event.SessionStart -->

**Matcher** (`source`):

| Value | Fires on |
| --- | --- |
| `startup` | a new session. <!-- req: hooks.matcherValue.SessionStart.startup --> |
| `resume` | `--resume`, `--continue` or `/resume`. <!-- req: hooks.matcherValue.SessionStart.resume --> |
| `clear` | `/clear`. <!-- req: hooks.matcherValue.SessionStart.clear --> |
| `compact` | an automatic or manual compaction. <!-- req: hooks.matcherValue.SessionStart.compact --> |
| `fork` | a session forked from another: `--fork-session` with `--resume` or `--continue`, the `/fork` background copy, `/branch`, or a conversation moved to the background. <!-- req: hooks.matcherValue.SessionStart.fork --> |

**Input** (`SessionStartHookInput`):

| Field | Type | Meaning |
| --- | --- | --- |
| `source` | `"startup" \| "resume" \| "clear" \| "compact" \| "fork"` | How the session started; the matcher value. <!-- req: hooks.input.SessionStart.source --> |
| `model` | string, optional | The active model identifier. MAY be omitted, for example after `/clear` or a session restored by conversation recovery (Judgment J7.126). <!-- req: hooks.input.SessionStart.model --> |
| `agent_type` | string, optional | The agent name, present when the session runs with `--agent <name>`. <!-- req: hooks.input.SessionStart.agent_type --> |
| `session_title` | string, optional | The session's custom title (`--name`, `/rename`, a hook's `sessionTitle`, the SDK's `renameSession()`), present only when one is set; a generated title is not a custom title and is not sent. <!-- req: hooks.input.SessionStart.session_title --> |
| `seconds_since_last_response` | number, optional | Wall-clock seconds since the last response of the resumed transcript. <!-- req: hooks.input.SessionStart.seconds_since_last_response --> |
| `context_tokens` | number, optional | Tokens the first request of the resumed session re-sends as its prompt. <!-- req: hooks.input.SessionStart.context_tokens --> |
| `prompt_cache_likely_expired` | boolean, optional | `true` when the last response is older than the session's prompt cache lifetime, or a later compaction replaced the cached conversation. <!-- req: hooks.input.SessionStart.prompt_cache_likely_expired --> |
| `estimated_cache_write_usd` | number, optional | Estimated US-dollar cost of writing `context_tokens` to the prompt cache on the session's model, the response excluded. <!-- req: hooks.input.SessionStart.estimated_cache_write_usd --> |

The last four fields MUST be sent together when `source` is `"resume"` or `"fork"` and the
transcript holds at least one response from Claude, and MUST NOT be sent otherwise.

**Output** (`SessionStartHookSpecificOutput`). The event has no blocking or decision control; it
discards the top-level `decision` (Judgment J7.121). Plain-text stdout on exit 0 is added to
Claude's context like `additionalContext` (§7.4).

- `additionalContext` (string): added to Claude's context at the start of the conversation, before
  the first prompt. <!-- req: hooks.output.SessionStart.additionalContext -->
- `initialUserMessage` (string): in non-interactive mode (`-p`) only, the first user message of the
  session; it becomes the first turn even when no prompt is passed, and a prompt that is passed
  follows as the next turn. Elsewhere it is ignored. <!-- req: hooks.output.SessionStart.initialUserMessage -->
- `sessionTitle` (string): sets the session title as `/rename` does; applies only when `source` is
  `"startup"`, `"resume"` or `"fork"`. <!-- req: hooks.output.SessionStart.sessionTitle -->
- `watchPaths` (string[]): absolute paths `FileChanged` watches during the session; replaces the
  dynamic watch list (§7.5.28). <!-- req: hooks.output.SessionStart.watchPaths -->
- `reloadSkills` (boolean): when `true`, the client MUST re-scan the skill and command directories
  after the `SessionStart` hooks complete, so skills a hook installed are available to the first
  prompt (§4). <!-- req: hooks.output.SessionStart.reloadSkills -->

A plugin that finishes installing after the `SessionStart` hooks ran contributes neither
`initialUserMessage` nor `sessionTitle`. **Several handlers:** §7.5.4 item 5 (last title and
message, any `reloadSkills`, union of `watchPaths`).

**Exit 2.** Cannot block. The client shows the stderr to the user only, as a `<hook name> hook
error` notice in the transcript, the same way as a non-blocking error; Claude does not see it and
the session proceeds. <!-- req: hooks.exit2.SessionStart -->

## 7.5.6 `Setup`

**When.** The client MUST fire `Setup` only when launched with `--init-only`, or with `--init` or
`--maintenance` in non-interactive mode (`-p`), never on a normal start. With `--init-only` it runs
the `Setup` hooks, then the `SessionStart` hooks with the `startup` matcher, then exits without
starting a conversation, printing nothing on success. Only `command` handlers run; an `mcp_tool`
handler on `Setup` is always skipped (§7.3). The hooks can persist variables through
`CLAUDE_ENV_FILE` (§3.5.2). <!-- req: hooks.event.Setup -->

**Matcher** (`trigger`):

| Value | Fires on |
| --- | --- |
| `init` | `claude --init-only` or `claude -p --init`. <!-- req: hooks.matcherValue.Setup.init --> |
| `maintenance` | `claude -p --maintenance`. <!-- req: hooks.matcherValue.Setup.maintenance --> |

**Input** (`SetupHookInput`): `trigger`, `"init"` or `"maintenance"`. <!-- req: hooks.behavior.Setup input -->

**Output.** None. On every exit code the client discards the hook's JSON output fields
(`systemMessage`, `continue`, `hookSpecificOutput.additionalContext` and the rest), except
`terminalSequence` (Judgment J7.120). With `-p`, a `Setup` hook's stdout, stderr and exit code
appear in the run's output only as `hook_response` events under `--output-format stream-json
--verbose`. <!-- req: hooks.behavior.Setup decision control -->

**Exit 2.** Cannot block; the exit code and stderr are ignored and execution continues. <!-- req: hooks.exit2.Setup -->

## 7.5.7 `InstructionsLoaded`

**When.** The client MUST fire `InstructionsLoaded` each time a `CLAUDE.md` or `.claude/rules/*.md`
file is loaded into context: at session start for eagerly loaded files, and later for lazy loads,
such as a nested `CLAUDE.md` in a subdirectory Claude accesses or a rule whose `paths:` frontmatter
matches, and again after a compaction. It MUST NOT fire when `AGENTS.md` is read directly through
the **Project instructions** setting; it fires when a `CLAUDE.md` imports `AGENTS.md` (as `include`)
and when `CLAUDE.md` is a symbolic link to it (as a normal load). The hook runs asynchronously, for
observability. <!-- req: hooks.event.InstructionsLoaded -->

**Matcher:** `load_reason`, values `session_start`, `nested_traversal`, `path_glob_match`,
`include`, `compact` (`"path_glob_match|nested_traversal"` selects lazy loads only).

**Input** (`InstructionsLoadedHookInput`):

| Field | Type | Meaning |
| --- | --- | --- |
| `file_path` | string | Absolute path of the loaded instruction file. <!-- req: hooks.input.InstructionsLoaded.file_path --> |
| `memory_type` | `"User" \| "Project" \| "Local" \| "Managed"` | The file's scope. <!-- req: hooks.input.InstructionsLoaded.memory_type --> |
| `load_reason` | `"session_start" \| "nested_traversal" \| "path_glob_match" \| "include" \| "compact"` | Why it was loaded; `compact` is a re-load after compaction. <!-- req: hooks.input.InstructionsLoaded.load_reason --> |
| `globs` | string[], optional | The `paths:` patterns of the file's frontmatter; present only for `path_glob_match` loads. <!-- req: hooks.input.InstructionsLoaded.globs --> |
| `trigger_file_path` | string, optional | The file whose access triggered a lazy load (Judgment J7.125). <!-- req: hooks.input.InstructionsLoaded.trigger_file_path --> |
| `parent_file_path` | string, optional | The instruction file that included this one; present only for `include` loads. <!-- req: hooks.input.InstructionsLoaded.parent_file_path --> |

**Output.** None: the hook cannot block or modify the load, and the client discards its JSON
output fields (`systemMessage`, `continue`, `hookSpecificOutput`), except `terminalSequence`.
<!-- req: hooks.behavior.InstructionsLoaded decision control -->

**Exit 2.** Cannot block; the exit code is ignored. <!-- req: hooks.exit2.InstructionsLoaded -->

## 7.5.8 `UserPromptSubmit`

**When.** The client MUST fire `UserPromptSubmit` when a prompt is submitted, before Claude
processes it, and also on the turns it starts itself: a session-scoped scheduled task firing
(a `/loop` iteration included), a background subagent reporting back to the session that started
it, and a message another session sends to the main conversation. Its default timeout is 30
seconds for `command`, `http` and `mcp_tool` handlers (§7.3). A handler that reaches its timeout,
other than a command hook run with `async: true`, is cancelled and its output, `additionalContext`
included, discarded; the prompt reaches Claude without it and the transcript shows a notice naming
the hook, the timeout and that the output was discarded. A `command` or `http` hook with
`onFailure: "block"` blocks the prompt instead (§7.4), and so does an Agent SDK callback that times
out, with a message naming the hook and the timeout; the session continues. If the user presses `Esc` or interrupts while hooks check the
prompt, the check stops, the prompt does not reach Claude, typed text returns to the input and is
checked again when resent; a hook that blocks at that moment keeps the prompt blocked, its block
message shows, and the text does not return. <!-- req: hooks.event.UserPromptSubmit | hooks.behavior.Esc during a prompt check -->

**Matcher:** none.

**Input** (`UserPromptSubmitHookInput`): `prompt` (string), the submitted text, with any
`[Pasted text #N]` placeholder expanded in place (between `<pasted_content id="…">` and
`</pasted_content id="…">` lines where the client marks pasted text); for a typed skill or command,
the line as typed (`/deploy staging`), not its expansion. `session_title` (string, optional) as on
`SessionStart`. The SDK type also has an optional `source` (Judgment J7.106). <!-- req: hooks.behavior.UserPromptSubmit input -->

**Output** (`UserPromptSubmitHookSpecificOutput`); all universal fields are honoured. Plain-text
stdout on exit 0 is added to Claude's context; it and `additionalContext` are each injected as a
system reminder that starts with the hook's name, with no visible transcript entry.

- `decision` (`"block"`): the prompt stops before it reaches Claude; omit it to let the prompt
  through. <!-- req: hooks.output.UserPromptSubmit.decision -->
- `reason` (string): shown to the user when `decision` is `"block"`; not added to context. <!-- req: hooks.output.UserPromptSubmit.reason -->
- `additionalContext` (string): added to Claude's context alongside the submitted prompt. <!-- req: hooks.output.UserPromptSubmit.additionalContext -->
- `sessionTitle` (string): sets the session title. <!-- req: hooks.output.UserPromptSubmit.sessionTitle -->
- `suppressOriginalPrompt` (boolean): when `true` in the output of a handler that itself blocks the
  prompt (by `decision` or exit 2), the block message omits the prompt text. Set by a handler that
  does not block, it has no effect, even when another handler blocks (Judgment J7.144). <!-- req: hooks.output.UserPromptSubmit.suppressOriginalPrompt -->

A blocked prompt never reaches Claude. The block message shown to the user, and written to the
transcript file, MUST end with `Original prompt:` and the submitted text, on a line of its own
(Judgment J7.49, §7.4), unless a blocking handler set `suppressOriginalPrompt`, whether it blocked
by `decision` or by exit 2. That flag changes only the message: the text can still be in the
transcript and the prompt history (`hooks.md`, "What a blocked prompt leaves behind"). <!-- req: hooks.behavior.What a blocked prompt leaves behind -->

A blocked typed command does not run, nor do the shell commands its skill injects. **Several handlers:** any
`decision: "block"` blocks; last `sessionTitle`; the prompt text is left out when any of the
handlers that blocked set `suppressOriginalPrompt`.

**Exit 2.** Blocks the prompt, which never reaches Claude; the stderr is the block message shown to
the user and is not added to context. A plugin's hook that exits 2 with empty stdout and a stderr
saying a file is missing (`No such file or directory`) is a non-blocking error instead (§7.4).
<!-- req: hooks.exit2.UserPromptSubmit -->

## 7.5.9 `UserPromptExpansion`

**When.** The client MUST fire `UserPromptExpansion` when a command the user typed expands into a
prompt, before it reaches Claude: a skill or custom command, or an MCP server prompt. It covers the
path `PreToolUse` does not: typing `/skillname` never calls the `Skill` tool. <!-- req: hooks.event.UserPromptExpansion -->

**Matcher:** `command_name`; an empty matcher fires on every prompt-type command.

**Input** (`UserPromptExpansionHookInput`): `expansion_type` (`"slash_command"` for skills and
custom commands, `"mcp_prompt"` for MCP prompts), `command_name` (string), `command_args`
(string), `command_source` (string, optional; for example `"plugin"`), `prompt` (string, the line
as typed). <!-- req: hooks.behavior.UserPromptExpansion input -->

**Output** (`UserPromptExpansionHookSpecificOutput`); all universal fields are honoured, and
plain-text stdout on exit 0 is added to Claude's context.

- `decision` (`"block"`): prevents the command from expanding. <!-- req: hooks.output.UserPromptExpansion.decision -->
- `reason` (string): shown to the user when `decision` is `"block"`. <!-- req: hooks.output.UserPromptExpansion.reason -->
- `additionalContext` (string): added to Claude's context alongside the expanded prompt. <!-- req: hooks.output.UserPromptExpansion.additionalContext -->

The SDK type also carries `suppressOriginalPrompt`. The client MUST accept it without a warning
and it has no effect: the block message of an expansion is `UserPromptExpansion operation blocked by
hook:` and the reason, and never quotes the typed line, so there is nothing for the flag to leave
out (Judgment J7.107).

**Exit 2.** Blocks the expansion; the stderr is the block message shown to the user. <!-- req: hooks.exit2.UserPromptExpansion -->

## 7.5.10 `MessageDisplay`

**When.** The client MUST fire `MessageDisplay` while assistant message text streams to the
screen: each time a batch of newly completed lines is ready to render, once with those lines,
rendering the hook's replacement in their place. A message with no text (tool calls only) does not
fire it; tool results and the user's text are never passed. The client holds each batch until the
hooks return; the default timeout is 10 seconds (§7.3). If a hook fails or times out, the client
displays the original text and notes the failure only in debug output. In non-interactive runs
(`-p`, the Agent SDK) it fires once per message, after the message completes, with `index` `0`,
`final` `true` and the whole text in `delta`. The event is display-only: the transcript, verbose
mode and what Claude sees keep the original. <!-- req: hooks.event.MessageDisplay -->

**Matcher:** none.

**Input** (`MessageDisplayHookInput`):

| Field | Type | Meaning |
| --- | --- | --- |
| `turn_id` | string | UUID of the current turn. <!-- req: hooks.input.MessageDisplay.turn_id --> |
| `message_id` | string | UUID of the message, the same for every batch of it; not the API `msg_…` id. <!-- req: hooks.input.MessageDisplay.message_id --> |
| `index` | number | Zero-based index of this batch within the message. <!-- req: hooks.input.MessageDisplay.index --> |
| `final` | boolean | `true` on the message's last batch; each message has exactly one. <!-- req: hooks.input.MessageDisplay.final --> |
| `delta` | string | The lines completed since the prior batch, newlines included; always whole lines except the final batch, which may end mid-line; in interactive runs the final batch is empty when the message ends on a newline, so `final`, not an empty `delta`, marks the end. <!-- req: hooks.input.MessageDisplay.delta --> |

**Output** (`MessageDisplayHookSpecificOutput`). No decision control; the client discards
`systemMessage` and `continue`.

- `displayContent` (string): text displayed in place of the delta; omit it to display the original
  (Judgment J7.122). <!-- req: hooks.output.MessageDisplay.displayContent -->

**Several handlers:** the last `displayContent` in handler order is displayed.

**Exit 2.** Cannot block; the original text is displayed (Judgment J7.123). <!-- req: hooks.exit2.MessageDisplay -->

## 7.5.11 `PreToolUse`

**When.** The client MUST fire `PreToolUse` after Claude produces a tool call's parameters and
before the call is processed, for every tool but `EndConversation`: built-in tools and MCP tools
(§7.6). It does not fire for files the user references with `@`, which are inserted without a tool
call. A `Bash` matcher also selects Monitor commands, under the rules of §7.2. An Agent SDK
callback hook on `PreToolUse` that exceeds its timeout blocks the tool call. <!-- req: hooks.event.PreToolUse -->

**Matcher:** `tool_name` (§7.6 lists the names).

**Input** (`PreToolUseHookInput`): `tool_name` (string), `tool_input` (the tool's input, §7.6),
`tool_use_id` (string), and for an MCP tool `mcp_server` (`{ name, source }`, type
`McpServerProvenance`, 2.1.274 or later; `source` is `plugin`, `sdk` or a configuration scope such
as `user` or `project`, and a trust decision rests on `source`, not on `name` or the `mcp__<server>__`
prefix). For `Write`, `Edit` and `Read`, `tool_input.file_path` MUST be absolute, with `~` and
relative spellings expanded before hooks run, and on Windows MUST use backslash separators.
<!-- req: hooks.behavior.PreToolUse input -->

**Output** (`PreToolUseHookSpecificOutput`); all universal fields are honoured.

- `permissionDecision` (`"allow" | "deny" | "ask" | "defer"`): `allow` skips the permission
  prompt, except for actions no mode auto-approves, reads from network paths, tools an Agent SDK
  app marks `always_ask` (unless the permission mode approves the call), and MCP tools marked
  `requiresUserInteraction`; `AskUserQuestion` and `ExitPlanMode` need `allow` with
  `updatedInput` holding the answer. `deny` prevents the call. `ask` sends it to the permission
  prompt, which names the hook's origin: `[settings]` (any settings file or agent frontmatter),
  `[plugin:<name>]` or `[skill]`. `defer` ends the turn so the call can be resumed, and is honoured
  only in `-p` mode when Claude made a single tool call in the turn; otherwise it is ignored with a
  warning (Judgment J7.117). Deny and ask rules are evaluated whatever the hook returns. <!-- req: hooks.output.PreToolUse.permissionDecision -->
- `permissionDecisionReason` (string): for `ask`, shown in the prompt (and to Claude when a `-p`
  run that cannot prompt denies the call); for `deny`, shown to Claude; for `allow` and `defer`,
  written to the debug log only. <!-- req: hooks.output.PreToolUse.permissionDecisionReason -->
- `updatedInput` (object): replaces the whole tool input before the call runs; permission rules and
  a Bash command's auto-background eligibility are evaluated against it. With `allow` it
  auto-approves the changed call, with `ask` the user sees the changed input; for `defer` it is
  ignored. Without a `permissionDecision` in auto mode, the client MAY deny the changed call,
  because the classifier reviewed the original input. <!-- req: hooks.output.PreToolUse.updatedInput -->
- `additionalContext` (string): added to Claude's context next to the tool result; ignored when the
  decision is `defer`. <!-- req: hooks.output.PreToolUse.additionalContext -->

The deprecated top-level `decision` MUST still be read: `"approve"` as `allow` and `"block"` as
`deny`, with `reason` as the reason. A deferred call ends the turn with a result carrying
`stop_reason: "tool_deferred"` and `deferred_tool_use` (`id`, `name`, `input`); resuming the session
fires `PreToolUse` again for the same call (`hooks.md`, "Defer a tool call for later").

**Several handlers:** the decision with the highest precedence wins, `deny` > `defer` > `ask` >
`allow`, and its reason is the first handler's with that decision; the last `updatedInput` wins,
and none applies when the winning decision is `deny` or `defer` (Judgment J7.117).

**Exit 2.** Blocks the tool call, as a `deny`: Claude receives the stderr as the denial reason,
prefixed with the event, tool and hook (`PreToolUse:Bash hook error: [<command>]: <stderr>`, §7.4). <!-- req: hooks.exit2.PreToolUse -->

## 7.5.12 `PermissionRequest`

**When.** The client MUST fire `PermissionRequest` when it is about to ask the user for permission
for a tool call, and, in a session that cannot show a prompt (such as a background subagent in
non-interactive mode), when it would otherwise deny such a call; there, if no hook decides, the
call is denied. For a call that goes to a `--permission-prompt-tool` or an Agent SDK `canUseTool`
callback, the hooks run alongside the host and whichever decides first applies. It does not fire for
a sandboxed command's network request, nor for `EndConversation`. It fires at once, unlike the
`permission_prompt` notification (§7.5.17). <!-- req: hooks.event.PermissionRequest -->

**Matcher:** `tool_name`, as `PreToolUse` (Monitor rules of §7.2 included).

**Input** (`PermissionRequestHookInput`): `tool_name`, `tool_input`, no `tool_use_id`; `mcp_server`
for an MCP tool; `permission_suggestions` (optional), the permission update entries the client
suggests for this request (§7.4.7). The array is not the list of options the dialog shows.
<!-- req: hooks.behavior.PermissionRequest input -->

**Output** (`PermissionRequestHookSpecificOutput`): a `decision` object. The top-level `decision`
is discarded (Judgment J7.121).

- `behavior` (`"allow" | "deny"`): grants or denies the permission. Deny and ask rules are still
  evaluated, so `allow` does not override a matching deny rule. <!-- req: hooks.output.PermissionRequest.behavior -->
- `updatedInput` (object, `allow` only): replaces the whole tool input; the result is re-evaluated
  against deny and ask rules. `AskUserQuestion` and `ExitPlanMode` need it. <!-- req: hooks.output.PermissionRequest.updatedInput -->
- `updatedPermissions` (permission update entries, `allow` only): applied as §7.4 says, for example
  an allow rule or a mode change; a hook MAY echo an entry of `permission_suggestions`. <!-- req: hooks.output.PermissionRequest.updatedPermissions -->
- `message` (string, `deny` only): tells Claude why the permission was denied. <!-- req: hooks.output.PermissionRequest.message -->
- `interrupt` (boolean, `deny` only): when `true`, stops Claude. <!-- req: hooks.output.PermissionRequest.interrupt -->

**Several handlers:** Judgment J7.113.

**Exit 2.** Not honoured: an exit-2 hook without a `decision` object leaves the permission flow
unchanged, and its stderr is discarded. A failure under `onFailure: "block"` denies the request
(§7.4). <!-- req: hooks.exit2.PermissionRequest -->

## 7.5.13 `PostToolUse`

**When.** The client MUST fire `PostToolUse` immediately after a tool call completes successfully,
for every tool but `EndConversation`. A `Bash` matcher does not select Monitor here (§7.2).
<!-- req: hooks.event.PostToolUse -->

**After an interrupt** (`hooks.md`, "PostToolUse after an interrupt"):

- **`Ctrl+Enter`**: when it ends the turn while a tool runs and the tool then finishes, the hooks
  still run on its result and have 10 seconds; a command hook still running then is killed,
  whatever its `timeout` (Judgment J7.63, §7.4). The key acts as `Esc` when a `!` command was
  queued ahead or background tasks are disabled. <!-- req: hooks.behavior.PostToolUse after an interrupt.Ctrl+Enter -->
- **`Enter`**: a queued message does not interrupt the turn, so the hooks keep their `timeout`.
  <!-- req: hooks.behavior.PostToolUse after an interrupt.Enter -->
- **`Esc`**: cancels the hooks at once. <!-- req: hooks.behavior.PostToolUse after an interrupt.Esc -->

A hook that must outlive the 10 seconds runs `async`, and so cannot block or rewrite the result.
(Before 2.1.319 the hooks did not start after an interrupting message.)

**Matcher:** `tool_name`.

**Input** (`PostToolUseHookInput`): `tool_name`, `tool_input` (file paths absolute and native, as
on `PreToolUse`), `tool_response` (the tool's structured output, §7.6), `tool_use_id`,
`mcp_server` for an MCP tool, and:

- `duration_ms` (number, optional): the tool's execution time in milliseconds, excluding
  permission prompts and `PreToolUse` hooks. <!-- req: hooks.input.PostToolUse.duration_ms -->

**Output** (`PostToolUseHookSpecificOutput`); all universal fields are honoured.

- `decision` (`"block"`): adds `reason` next to the tool result; Claude still sees the original
  output. <!-- req: hooks.output.PostToolUse.decision -->
- `reason` (string): the explanation shown to Claude when `decision` is `"block"`. <!-- req: hooks.output.PostToolUse.reason -->
- `additionalContext` (string): added to Claude's context alongside the tool result. <!-- req: hooks.output.PostToolUse.additionalContext -->
- `classifierContext` (string): a short note about this result for the auto mode classifier, not
  for Claude. The client caps the notes of one call at 2,000 characters across all hooks,
  ignores it from a background hook, discards it for calls the classifier does not record
  (read-only lookups such as file reads and searches), and drops it when the same hook's
  `updatedToolOutput` is rejected or replaced by another hook's. A note from a hook configured in
  Claude Code (settings, plugins, skills, agents) is unverified context that never establishes user
  intent; only an in-process SDK callback's note in a live session may carry relayed user intent.
  <!-- req: hooks.output.PostToolUse.classifierContext -->
- `updatedToolOutput` (any): replaces the output before Claude sees it. For a built-in tool a value
  that does not match the tool's output shape is ignored and the original used; an MCP tool's
  value is passed through unchecked (Judgment J7.138). The tool has already run, and telemetry
  keeps the original. <!-- req: hooks.output.PostToolUse.updatedToolOutput -->
- `updatedMCPToolOutput` (any): replaces the output of an MCP tool only; `updatedToolOutput` is
  preferred and wins when a hook sets both (Judgment J7.138). <!-- req: hooks.output.PostToolUse.updatedMCPToolOutput -->

**Several handlers:** the last accepted replacement wins; a rejected one does not hide an earlier
accepted one (Judgment J7.111).

**Exit 2.** Cannot block, the tool having run: the stderr is shown to Claude. <!-- req: hooks.exit2.PostToolUse -->

## 7.5.14 `PostToolUseFailure`

**When.** The client MUST fire `PostToolUseFailure` when a tool call that started executing fails:
the tool threw, or an MCP tool returned an error result. It MUST NOT fire for calls rejected before
execution — an unknown tool, input that fails validation (those fire neither tool event), or a
permission denial (which fires `PreToolUse` only) — nor when a running tool is cancelled.
<!-- req: hooks.event.PostToolUseFailure -->

**Matcher:** `tool_name`.

**Input** (`PostToolUseFailureHookInput`): `tool_name`, `tool_input`, `tool_use_id`, `mcp_server`
for an MCP tool, and:

| Field | Type | Meaning |
| --- | --- | --- |
| `error` | string | What went wrong, generally the text Claude receives as the result. For Bash and PowerShell a command that ran and exited gives a first line `Exit code N`, then its interleaved output; a shell that could not start gives a bare message. Long text is middle-truncated around `... [N characters truncated] ...`; the client may insert lines such as `Command timed out after 2m 0s`. <!-- req: hooks.input.PostToolUseFailure.error --> |
| `is_interrupt` | boolean, optional | `true` when the failure reached the client as an abort rather than an error the tool reported. <!-- req: hooks.input.PostToolUseFailure.is_interrupt --> |
| `duration_ms` | number, optional | As on `PostToolUse`. <!-- req: hooks.input.PostToolUseFailure.duration_ms --> |

**Output** (`PostToolUseFailureHookSpecificOutput`); all universal fields are honoured, and a
top-level `decision: "block"` adds its `reason` next to the error as on `PostToolUse`.

- `additionalContext` (string): added to Claude's context alongside the error. <!-- req: hooks.output.PostToolUseFailure.additionalContext -->

**Exit 2.** Cannot block, the tool having failed: the stderr is shown to Claude. <!-- req: hooks.exit2.PostToolUseFailure -->

## 7.5.15 `PostToolBatch`

**When.** The client MUST fire `PostToolBatch` exactly once after every tool call of a batch has
resolved and before it sends the next request to the model, whereas `PostToolUse` fires once per
call, concurrently for parallel calls. <!-- req: hooks.event.PostToolBatch -->

**Matcher:** none.

**Input** (`PostToolBatchHookInput`): `tool_calls`, an array of `{ tool_name, tool_input,
tool_use_id, tool_response? }` (`PostToolBatchToolCall`). Here `tool_response` is the content the
model receives in the `tool_result` block — a serialized string or content-block array as the tool
emitted it, so line-numbered text for `Read` — not `PostToolUse`'s structured output.
<!-- req: hooks.behavior.PostToolBatch input -->

**Output** (`PostToolBatchHookSpecificOutput`); all universal fields are honoured.

- `additionalContext` (string): injected once before the next model call. <!-- req: hooks.output.PostToolBatch.additionalContext -->

A top-level `decision: "block"` or `continue: false` stops the agentic loop before the next model
call (Judgment J7.116). The message is the JSON `reason` or `stopReason`, or the stderr on exit 2;
the user sees it as a warning in the transcript, and it stays in the conversation, so Claude sees it
when the conversation continues.

**Exit 2.** Stops the agentic loop before the next model call, with the stderr as the message
(Judgment J7.124). <!-- req: hooks.exit2.PostToolBatch -->

## 7.5.16 `PermissionDenied`

**When.** The client MUST fire `PermissionDenied` when auto mode denies a tool call, including a
denial without a classifier verdict (a separate safety check refused the classifier's request, or
its response did not parse). It MUST NOT fire when the user denies a dialog, a `PreToolUse` hook
blocks, or a deny rule matches. <!-- req: hooks.event.PermissionDenied -->

**Matcher:** `tool_name`.

**Input** (`PermissionDeniedHookInput`): `tool_name`, `tool_input`, `tool_use_id`, `mcp_server`
for an MCP tool, and:

- `reason` (string): the denial reason. For a classifier verdict, in most sessions the matched rule
  in square brackets (`[Data Exfiltration]`); for a no-verdict denial, text starting with
  `Auto mode could not evaluate this action and is blocking it for safety`; when the classifier
  model was unavailable, exactly `Classifier unavailable`. <!-- req: hooks.input.PermissionDenied.reason -->

**Output** (`PermissionDeniedHookSpecificOutput`): `retry` (boolean). When `true`, the client adds
a message telling the model it may retry the call; it does not reverse the denial. Without it, or
with `false`, the model receives the original rejection. The client MUST ignore `retry` for a
no-verdict denial (Judgment J7.130). It discards `continue`, `systemMessage` and `decision`
(Judgment J7.121). **Several handlers:** any `retry: true` holds.
<!-- req: hooks.behavior.PermissionDenied decision control -->

**Exit 2.** Cannot block; the exit code and stderr are ignored, the denial having occurred. <!-- req: hooks.exit2.PermissionDenied -->

## 7.5.17 `Notification`

**When.** The client MUST fire `Notification` when it raises a notification of one of the types
below, whether or not desktop notifications are on (`preferredNotifChannel`, including
`notifications_disabled`, changes only how the user is alerted). Hooks are for side effects.
<!-- req: hooks.event.Notification -->

**Matcher** (`notification_type`); an omitted matcher runs for every type:

| Value | Fires when |
| --- | --- |
| `permission_prompt` | a tool use or a sandboxed command's network request awaits approval and the prompt has waited about six seconds; each keystroke defers the timer. In sessions whose permission requests go to an SDK `canUseTool` callback (Claude Desktop, the VS Code extension), it fires about six seconds after the request whatever the user types, not at all if the user or a `PermissionRequest` hook answers sooner, and never when `CLAUDE_CODE_DISABLE_PERMISSION_PROMPT_NOTIFY_HOOKS=1` (§3). <!-- req: hooks.matcherValue.Notification.permission_prompt --> |
| `idle_prompt` | about 60 seconds after Claude finished responding, if the user has not typed since and no background agent still runs; not while waiting for a usage limit reset. <!-- req: hooks.matcherValue.Notification.idle_prompt --> |
| `auth_success` | authentication completes. <!-- req: hooks.matcherValue.Notification.auth_success --> |
| `auth_storage_failure` | sign-in completes but the new credentials cannot be saved; fires instead of `auth_success`. <!-- req: hooks.matcherValue.Notification.auth_storage_failure --> |
| `elicitation_dialog` | an MCP server opens an elicitation form and the user has not typed for about six seconds. <!-- req: hooks.matcherValue.Notification.elicitation_dialog --> |
| `elicitation_url_dialog` | an MCP server asks the user to open a URL and the user has not typed for about six seconds. <!-- req: hooks.matcherValue.Notification.elicitation_url_dialog --> |
| `elicitation_complete` | an MCP server reports a URL-mode elicitation complete. <!-- req: hooks.matcherValue.Notification.elicitation_complete --> |
| `elicitation_response` | an elicitation response is sent back to the server. <!-- req: hooks.matcherValue.Notification.elicitation_response --> |
| `agent_needs_input` | a background session starts waiting for input while agent view is open in a terminal; also when a terminal session shows a teammate's terminal setup question, or auto mode's notice about classifier charges, and the user has not typed for about six seconds. <!-- req: hooks.matcherValue.Notification.agent_needs_input --> |
| `agent_completed` | a background session finishes or fails, only while agent view is open in a terminal. <!-- req: hooks.matcherValue.Notification.agent_completed --> |
| `quota_auto_resume_fired` | the client continues a task a claude.ai usage limit paused, at the reset or sooner when usage becomes available. <!-- req: hooks.matcherValue.Notification.quota_auto_resume_fired --> |
| `quota_auto_resume_stale` | a usage limit reset while the computer slept for more than about 30 minutes, so the client waits for `Enter` instead of continuing. <!-- req: hooks.matcherValue.Notification.quota_auto_resume_stale --> |
| `quota_auto_resume_disabled` | the client ends a usage-limit wait without continuing: `autoContinueAtUsageLimit` off or the reset moved over 24 hours away during a wait it started itself, the continued task kept hitting the limit, or the continuation was blocked. Not on `Esc`, `Ctrl+C` or **Don't continue automatically**. <!-- req: hooks.matcherValue.Notification.quota_auto_resume_disabled --> |
| `plugin_notification` | a mod raises a notification with `$.ui.notify` (§10); `title` is the mod's name unless the mod set one. <!-- req: hooks.matcherValue.Notification.plugin_notification --> |

A permission request or elicitation arriving while another dialog is open keeps the six-second
gate, timed from its arrival.

**Input** (`NotificationHookInput`): `message` (string, the notification text), `title` (string,
optional), `notification_type` (string, the type that fired; Judgment J7.128).

**Output.** The hook cannot block or modify the notification. The client discards `systemMessage`,
`continue` and `decision`, and still writes `terminalSequence`; `additionalContext` is discarded
(Judgment J7.108). <!-- req: hooks.behavior.Notification input -->

**Exit 2.** Cannot block; the exit code and stderr are ignored. <!-- req: hooks.exit2.Notification -->

## 7.5.18 `SubagentStart`

**When.** The client MUST fire `SubagentStart` when Claude spawns a subagent with the Agent tool,
when Claude resumes a subagent, and each time an in-process agent-team teammate handles a new
message. <!-- req: hooks.event.SubagentStart -->

**Matcher:** `agent_type`: a built-in's name (`general-purpose`, `Explore`, `Plan`), a custom
agent's frontmatter `name` (not its file name), or a plugin agent's scoped name such as
`my-plugin:reviewer`, which the colon puts on the regular-expression path, so `^my-plugin:reviewer$`
matches it exactly (§7.2, §5).

**Input** (`SubagentStartHookInput`): `agent_id` (string, required here) and `agent_type` (string,
required here), the subagent's identifier and the name the matcher filters on.

**Output** (`SubagentStartHookSpecificOutput`). The hook cannot block subagent creation; the
top-level `decision` is discarded (Judgment J7.121).

- `additionalContext` (string): added to the subagent's context at the start of its conversation,
  before its first prompt. When the hook runs again for the same subagent, the client injects the
  returned context only if the subagent's context does not already hold the copy from an earlier
  run, keeping the launch copy in place; after auto-compaction drops that copy, it injects the next
  run's context again. <!-- req: hooks.input.SubagentStart.additionalContext -->

**Exit 2.** Cannot block. The stderr is shown to the user only, as a `<hook name> hook error`
notice in the subagent's own transcript, not the parent's; Claude does not see it and the subagent
proceeds. <!-- req: hooks.exit2.SubagentStart -->

## 7.5.19 `SubagentStop`

**When.** The client MUST fire `SubagentStop` when a subagent has finished responding, and also
when one of the client's internal agents finishes (prompt suggestions, `/btw` side questions).
<!-- req: hooks.event.SubagentStop -->

**Matcher:** `agent_type`, the same values as `SubagentStart`. For an internal agent, `agent_type`
is the agent the session itself runs as (`--agent` or the `agent` setting), or the empty string.
A matcher naming agent types MUST NOT match an empty `agent_type`; an omitted, `""` or `"*"`
matcher, or a regular expression matching the empty string, does.

**Input** (`SubagentStopHookInput`): `stop_hook_active` (boolean, as on `Stop`), `agent_id`
(string), `agent_type` (string), `agent_transcript_path` (string, the subagent's own transcript in
a nested `subagents/` folder; `transcript_path` stays the main session's), `last_assistant_message`
(string, optional, the text of the subagent's final response), and `background_tasks` and
`session_crons` as on `Stop` (§7.5.22), scoped to the parent session. A subagent that delivers its
report through `SubagentHandback` has the report in that call's `tool_input.message`, not in
`last_assistant_message`, which holds any closing text. <!-- req: hooks.behavior.SubagentStop input -->

**Output.** As `Stop` (§7.5.22), with `hookEventName` `"SubagentStop"`: `decision: "block"` keeps
the subagent running and delivers `reason` to it as its next instruction, and
`hookSpecificOutput.additionalContext` is non-error feedback that keeps it running. The loop
protections of `Stop` apply per subagent. Context for the parent session after a subagent returns
comes from a `PostToolUse` hook on the `Agent` tool.

**Exit 2.** Prevents the subagent from stopping; the stderr is delivered to it as its next
instruction. `onFailure` has no effect, and an exit 2 with empty stdout whose stderr says a file is
missing is a non-blocking error (§7.4). <!-- req: hooks.exit2.SubagentStop -->

## 7.5.20 `TaskCreated`

**When.** The client MUST fire `TaskCreated` when a task is being created through the `TaskCreate`
tool; in a session without the task tools it never fires. <!-- req: hooks.event.TaskCreated -->

**Matcher:** none.

**Input** (`TaskCreatedHookInput`):

| Field | Type | Meaning |
| --- | --- | --- |
| `task_id` | string | Identifier of the task being created. <!-- req: hooks.input.TaskCreated.task_id --> |
| `task_subject` | string | The task's title. <!-- req: hooks.input.TaskCreated.task_subject --> |
| `task_description` | string, optional | The task's detailed description. <!-- req: hooks.input.TaskCreated.task_description --> |
| `teammate_name` | string, optional | The teammate creating the task. <!-- req: hooks.input.TaskCreated.teammate_name --> |
| `team_name` | string, optional | Deprecated: a session-derived team name, to be removed. <!-- req: hooks.input.TaskCreated.team_name --> |
| `agent_id` | string, optional | The common field (§7.5.2), here the subagent or in-process teammate creating the task. <!-- req: hooks.input.TaskCreated.agent_id --> |

**Output.** A top-level `decision: "block"` cancels the creation: the client deletes the task and
returns `reason` to Claude as the tool's error. The client ignores `continue: false` here, and
Claude keeps working. <!-- req: hooks.behavior.TaskCreated decision control -->

**Exit 2.** Rolls back the creation: the task is deleted and the stderr returned to Claude as the
tool's error. <!-- req: hooks.exit2.TaskCreated -->

## 7.5.21 `TaskCompleted`

**When.** The client MUST fire `TaskCompleted` when a task is being marked completed: when any agent
marks it so through the `TaskUpdate` tool, and when an agent-team teammate finishes its turn with
tasks in progress. <!-- req: hooks.event.TaskCompleted -->

**Matcher:** none.

**Input** (`TaskCompletedHookInput`):

| Field | Type | Meaning |
| --- | --- | --- |
| `task_id` | string | Identifier of the task being completed. <!-- req: hooks.input.TaskCompleted.task_id --> |
| `task_subject` | string | The task's title. <!-- req: hooks.input.TaskCompleted.task_subject --> |
| `task_description` | string, optional | The task's detailed description. <!-- req: hooks.input.TaskCompleted.task_description --> |
| `teammate_name` | string, optional | The teammate completing the task. <!-- req: hooks.input.TaskCompleted.teammate_name --> |
| `team_name` | string, optional | Deprecated: a session-derived team name, to be removed. <!-- req: hooks.input.TaskCompleted.team_name --> |
| `agent_id` | string, optional | The common field, here the subagent or in-process teammate completing the task. <!-- req: hooks.input.TaskCompleted.agent_id --> |

**Output.** No top-level `decision` (Judgment J7.121). `continue: false` with `stopReason` stops the
teammate entirely, as on `Stop`, with `stopReason` shown to the user, when a teammate finishing its
turn fired the event; when `TaskUpdate` fired it, the client MUST ignore `continue: false`
(Judgment J7.135). <!-- req: hooks.behavior.TaskCompleted decision control -->

**Exit 2.** The task is not marked completed and the stderr is fed back to the model. `onFailure`
has no effect, and an exit 2 with empty stdout whose stderr says a file is missing is a non-blocking
error (§7.4). <!-- req: hooks.exit2.TaskCompleted -->

## 7.5.22 `Stop`

**When.** The client MUST fire `Stop` when the main agent has finished responding, but not when a
user interrupt stopped it; a turn that ends on an API error fires `StopFailure` instead. `/goal` is
a session-scoped prompt hook on this event. <!-- req: hooks.event.Stop -->

**Matcher:** none.

**Input** (`StopHookInput`): `stop_hook_active` (boolean, `true` when the client is already
continuing because of a stop hook), `last_assistant_message` (string, optional, the text of
Claude's final response), and `background_tasks` and `session_crons`, present when the client's
task registry is reachable, empty when nothing is in flight or scheduled. Each `background_tasks`
entry (`BackgroundTaskSummary`) describes one task in flight:

| Field | Type | Meaning |
| --- | --- | --- |
| `id` | string | Task identifier. <!-- req: hooks.input.Stop.id --> |
| `type` | string | A label naming the feature that created the task: `shell`, `subagent`, `monitor`, `workflow`, `teammate`, `cloud session` or `MCP task`; an unrecognised type gives its raw discriminant. <!-- req: hooks.input.Stop.type --> |
| `status` | string | Current task status. <!-- req: hooks.input.Stop.status --> |
| `description` | string | Free text, capped at 1,000 characters with an in-string `… [+N chars]` marker when clipped (Judgment J7.127). <!-- req: hooks.input.Stop.description --> |
| `command` | string, optional | The shell command line, capped the same way; `shell` tasks only. <!-- req: hooks.input.Stop.command --> |
| `agent_type` | string, optional | The subagent type; `subagent` tasks only. <!-- req: hooks.input.Stop.agent_type --> |
| `server` | string, optional | The MCP server name; `monitor` and `MCP task` tasks only. <!-- req: hooks.input.Stop.server --> |
| `tool` | string, optional | The MCP tool name; `monitor` and `MCP task` tasks only. <!-- req: hooks.input.Stop.tool --> |
| `name` | string, optional | The workflow name; `workflow` tasks only. <!-- req: hooks.input.Stop.name --> |

Each `session_crons` entry (`SessionCronSummary`) describes one session-scoped scheduled wakeup
from `CronCreate`, `ScheduleWakeup` or `/loop`; the entry's `id` is the cron task identifier:

| Field | Type | Meaning |
| --- | --- | --- |
| `schedule` | string | The cron expression, such as `0 9 * * 1-5`. <!-- req: hooks.input.Stop.schedule --> |
| `recurring` | boolean | `false` for a one-shot wakeup, `true` for a task that re-fires on every match. <!-- req: hooks.input.Stop.recurring --> |
| `prompt` | string | The prompt submitted when it fires, capped at 1,000 characters with the same marker. <!-- req: hooks.input.Stop.prompt --> |

**Output** (`StopHookSpecificOutput`); all universal fields are honoured.

- `decision` (`"block"`): prevents Claude from stopping; omit it to let Claude stop. <!-- req: hooks.output.Stop.decision -->
- `reason` (string): required when `decision` is `"block"` (Judgment J7.118); tells Claude why it
  should continue. <!-- req: hooks.output.Stop.reason -->
- `hookSpecificOutput.additionalContext` (string): non-error feedback; the conversation continues
  so Claude can act on it, labelled `Stop hook feedback` in the transcript, with no hook error
  notice. <!-- req: hooks.output.Stop.hookSpecificOutput.additionalContext -->

A handler's `continue: false` wins over its own `decision: "block"` and feedback (Judgment J7.115).
**Loop protection.** After stop hooks have continued the turn eight consecutive times, the client
MUST override the next block, end the turn, and warn that the hook blocked too many consecutive
times; the count resets each time Claude calls a tool, and `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP` changes
the cap, `0` removing it (§3.6.5). Feedback through `additionalContext` counts like a block, and the
count is per subagent for `SubagentStop`; the tool calls that reset it are Judgment J7.136. A hook avoids the cap by exiting early
when its input's `stop_hook_active` is `true`. <!-- req: hooks.guide.Stop hook hits the block cap -->

**Exit 2.** Prevents Claude from stopping; Claude receives the stderr as the reason to continue.
`onFailure` has no effect, and an exit 2 with empty stdout whose stderr says a file is missing is a
non-blocking error (§7.4). <!-- req: hooks.exit2.Stop -->

## 7.5.23 `StopFailure`

**When.** The client MUST fire `StopFailure` instead of `Stop` when the turn ends on an API error.
It runs for notification and logging only. <!-- req: hooks.event.StopFailure -->

**Matcher:** `error`, with the narrow exact-match grammar of §7.2. Values: `rate_limit`,
`overloaded`, `authentication_failed`, `oauth_org_not_allowed`, `account_on_hold`, `billing_error`,
`invalid_request`, `model_not_found`, `server_error`, `max_output_tokens`,
`cloud_credential_error` (a credential-load failure, reported under this value since v2.1.267) and
`unknown` (Judgment J7.105).

**Input** (`StopFailureHookInput`):

| Field | Type | Meaning |
| --- | --- | --- |
| `error` | string | The error type, one of the matcher values. <!-- req: hooks.input.StopFailure.error --> |
| `error_details` | string, optional | More detail when available, such as `429 Too Many Requests`. <!-- req: hooks.input.StopFailure.error_details --> |
| `last_assistant_message` | string, optional | The rendered error text shown in the conversation, such as `API Error: Rate limit reached`, not Claude's output. <!-- req: hooks.input.StopFailure.last_assistant_message --> |

**Output.** None: the client ignores the output on every exit code, except `terminalSequence`.

**Exit 2.** Cannot block; output and exit code are ignored, except `terminalSequence`. <!-- req: hooks.exit2.StopFailure -->

## 7.5.24 `TeammateIdle`

**When.** The client MUST fire `TeammateIdle` when an agent-team teammate is about to go idle after
finishing its turn. <!-- req: hooks.event.TeammateIdle -->

**Matcher:** none.

**Input** (`TeammateIdleHookInput`):

| Field | Type | Meaning |
| --- | --- | --- |
| `teammate_name` | string | The teammate about to go idle. <!-- req: hooks.input.TeammateIdle.teammate_name --> |
| `team_name` | string | Deprecated: a session-derived team name, to be removed. <!-- req: hooks.input.TeammateIdle.team_name --> |
| `agent_id` | string, optional | The common field, here the in-process teammate about to go idle. <!-- req: hooks.input.TeammateIdle.agent_id --> |

**Output.** No top-level `decision` (Judgment J7.121). `continue: false` with `stopReason` stops the
teammate entirely, as on `Stop`; `stopReason` is shown to the user. <!-- req: hooks.behavior.TeammateIdle decision control -->

**Exit 2.** Prevents the teammate from going idle: it receives the stderr as feedback and keeps
working. `onFailure` has no effect (§7.4). <!-- req: hooks.exit2.TeammateIdle -->

## 7.5.25 `ConfigChange`

**When.** The client MUST fire `ConfigChange` when, during a session, a settings file, a managed
policy file (`managed-settings.json` or a file in `managed-settings.d/`) or a skill file changes.
It MUST NOT fire for server-managed settings arriving or refreshing, for macOS managed preferences
or Windows registry policy, nor on WSL for a Windows-side managed file applied on the policy poll;
those apply without hooks. <!-- req: hooks.event.ConfigChange -->

**Matcher** (`source`):

| Value | Fires when |
| --- | --- |
| `user_settings` | `~/.claude/settings.json` changes. <!-- req: hooks.matcherValue.ConfigChange.user_settings --> |
| `project_settings` | `.claude/settings.json` changes. <!-- req: hooks.matcherValue.ConfigChange.project_settings --> |
| `local_settings` | `.claude/settings.local.json` changes. <!-- req: hooks.matcherValue.ConfigChange.local_settings --> |
| `policy_settings` | `managed-settings.json` or a file in `managed-settings.d/` changes. <!-- req: hooks.matcherValue.ConfigChange.policy_settings --> |
| `skills` | a skill file in `.claude/skills/` changes. <!-- req: hooks.matcherValue.ConfigChange.skills --> |

**Input** (`ConfigChangeHookInput`): `source` (one of the values above) and `file_path` (string,
optional, the changed file). <!-- req: hooks.behavior.ConfigChange input -->

**Output.** The client discards `systemMessage` and `continue`.

- `decision` (`"block"`): the change is not applied to the running session. <!-- req: hooks.output.ConfigChange.decision -->
- `reason` (string): accepted and never shown. <!-- req: hooks.output.ConfigChange.reason -->

A `policy_settings` change MUST NOT be blocked: the hooks run, and any blocking decision is ignored.
A blocked change surfaces no message to the user or Claude; the client writes a line to the debug
log only.

**Exit 2.** Blocks the change from taking effect, except for `policy_settings`; the stderr goes to
the debug log only. <!-- req: hooks.exit2.ConfigChange -->

## 7.5.26 `CwdChanged`

**When.** The client MUST fire `CwdChanged` when a shell command in the main conversation changes
the working directory, such as a `cd` Claude runs. Variables the hook writes to `CLAUDE_ENV_FILE`
persist into later Bash commands until the next `CwdChanged`, when the client clears them (§3.5.2).
<!-- req: hooks.event.CwdChanged -->

**Matcher:** none.

**Input** (`CwdChangedHookInput`): `old_cwd` and `new_cwd` (strings); `cwd` is the new directory.
<!-- req: hooks.behavior.CwdChanged input -->

**Output** (`CwdChangedHookSpecificOutput`). No decision control. The client reads `watchPaths` and
`systemMessage` and discards `continue`; in an interactive session it shows `systemMessage` as a
brief terminal notification, which does not reach the SDK message stream.

- `watchPaths` (string[]): absolute paths; replaces the dynamic watch list of `FileChanged`
  (§7.5.28). The matcher-configured names stay watched; an empty array clears the dynamic list,
  the usual answer on entering a new directory. <!-- req: hooks.output.CwdChanged.watchPaths -->

**Exit 2.** Cannot block; the stderr is shown to the user only. <!-- req: hooks.exit2.CwdChanged -->

## 7.5.27 `DirectoryAdded`

**When.** The client MUST fire `DirectoryAdded` after a working directory is added mid-session with
`/add-dir`, or by an SDK client's `register_repo_root` control request, after refreshing sandbox and
permission state, so sandboxed tools already see it (the hook commands run unsandboxed). It MUST NOT
fire for `--add-dir` at startup (`SessionStart` covers those), for a directory added on the
`/permissions` Workspace tab, or for one that already is, or lies inside, a working directory. The
add completes at once; the hook runs in the background with the 600-second default timeout.
<!-- req: hooks.event.DirectoryAdded -->

**Matcher** (`source`):

| Value | Fires when |
| --- | --- |
| `slash_command` | the user adds a directory with `/add-dir`. <!-- req: hooks.matcherValue.DirectoryAdded.slash_command --> |
| `register_repo_root` | an SDK client adds one with the `register_repo_root` control request. <!-- req: hooks.matcherValue.DirectoryAdded.register_repo_root --> |

**Input** (`DirectoryAddedHookInput`):

| Field | Type | Meaning |
| --- | --- | --- |
| `directory` | string | Absolute path of the added directory. <!-- req: hooks.input.DirectoryAdded.directory --> |
| `source` | `"slash_command" \| "register_repo_root"` | How it was added. <!-- req: hooks.input.DirectoryAdded.source --> |

**Output.** No decision control; the client discards `continue`. For `slash_command` it delivers
the hook's `systemMessage` to Claude as context on the next turn instead of showing it to the user,
shows a count of failed hooks in the transcript, and sends full failure output to the debug log; for
`register_repo_root` it writes `systemMessage` and failure output to the debug log only.

**Exit 2.** Cannot block, the directory being added already; the stderr goes to the debug log. <!-- req: hooks.exit2.DirectoryAdded -->

## 7.5.28 `FileChanged`

**When.** The client MUST fire `FileChanged` when a watched file changes on disk, detected by a
file-system watcher, whatever changed it: an `Edit` or `Write` call, a command run through `Bash`, or
a process outside the client. Variables written to `CLAUDE_ENV_FILE` persist until the next
`CwdChanged` (§3.5.2). <!-- req: hooks.event.FileChanged -->

**Matcher.** The matcher has two roles. *Watch list:* the client splits each `FileChanged` group's
matcher on `|` and registers each segment as a literal file name in the working directory (a
regular expression is not interpreted, so `^\.env` watches a file of that name, and `"*"` watches a
file named `*`); an omitted matcher adds nothing. *Filter:* when a watched file changes, the
matcher selects groups against the changed file's basename by the narrow grammar of §7.2, an
omitted matcher matching every watched file (Judgment J7.141). The client MUST start the watcher
only once something names a file: a `FileChanged` matcher, or `watchPaths` from `SessionStart`,
`CwdChanged` or `FileChanged`.

**Input** (`FileChangedHookInput`):

| Field | Type | Meaning |
| --- | --- | --- |
| `file_path` | string | Absolute path of the changed file. <!-- req: hooks.input.FileChanged.file_path --> |
| `event` | `"change" \| "add" \| "unlink"` | Modified, created or deleted. <!-- req: hooks.input.FileChanged.event --> |

**Output** (`FileChangedHookSpecificOutput`). No decision control; the client reads `watchPaths` and
`systemMessage` and discards `continue`, showing `systemMessage` as on `CwdChanged`.

- `watchPaths` (string[]): absolute paths; replaces the dynamic watch list, the matcher-configured
  names staying watched (Judgment J7.131). <!-- req: hooks.output.FileChanged.watchPaths -->

The hook runs again after every rewrite of a watched file, its own rewrites included.

**Exit 2.** Cannot block; the stderr is shown to the user only. <!-- req: hooks.exit2.FileChanged -->

## 7.5.29 `WorktreeCreate`

**When.** The client MUST fire `WorktreeCreate` when it creates an isolated working copy: a session
started with `--worktree`; Claude switching into a new worktree with `EnterWorktree`; a subagent with
`isolation: "worktree"`; a workflow agent in its own worktree; a background session isolated in a
worktree; `claude remote-control` in `worktree` mode. It does not fire for `git worktree add` run
through Bash. With `--worktree` and `--tmux` the worktree is created before plugins load, so only
settings-file hooks run. A configured hook **replaces** the default `git worktree` creation, and
`.worktreeinclude` is then not processed. <!-- req: hooks.event.WorktreeCreate -->

**Matcher:** none.

**Input** (`WorktreeCreateHookInput`): `name` (string), the worktree's slug, given by the user or
generated (`bold-oak-a3f2`). <!-- req: hooks.behavior.WorktreeCreate input -->

**Output.** The hook MUST return the created directory's path. A **command** hook prints it as the
last non-empty line of stdout; the client strips ANSI escape codes before reading that line, and a
command hook cannot return JSON. An **HTTP** hook returns `hookSpecificOutput.worktreePath`
(`WorktreeCreateHookSpecificOutput`). The client resolves a relative path against the directory the
hook ran in, collapsing `.` and `..`; it refuses an absolute path with `.` or `..` segments and any
path through a symbolic link below the repository root, naming the rejected component. A path that
is not an enterable directory makes the session print an error naming it and exit with code 1. The
client discards `systemMessage` and `continue`. **Several handlers:** the last path in handler order
is used (Judgment J7.143). <!-- req: hooks.behavior.WorktreeCreate output -->

**Exit 2.** Any non-zero exit code, or a hook that fails or prints no path, fails the worktree
creation with an error, whatever the JSON says. <!-- req: hooks.exit2.WorktreeCreate -->

## 7.5.30 `WorktreeRemove`

**When.** The client MUST fire `WorktreeRemove` when it cleans up a worktree a `WorktreeCreate` hook
created: on exit of an interactive worktree session when the user chooses removal, or without asking
when the session is unnamed and git finds no changed or untracked files; when a background session
running in it is deleted; when Claude removes it with `ExitWorktree` (which refuses a hook-created
worktree unless `discard_changes: true`); when a `claude remote-control` worktree-mode session ends
without crashing, or `claude remote-control` stops, and git finds no changes or new commits. It MUST
NOT fire when a subagent or workflow agent finishes: their hook-created worktrees are kept. For a
background-session delete, the client verifies the stored path first, refusing one that is or
passes through a symbolic link below the repository root, and runs the hook for a worktree that
still holds files only when the user confirms the delete in agent view. Without a `WorktreeRemove` hook, the
client removes the path as `git worktree remove --force` would on exit or `ExitWorktree` (a
non-git worktree stays), and keeps it on a `claude remote-control` cleanup, showing
`worktree removal failed, kept: <path>`. The client never deletes a hook-created worktree's
branch. <!-- req: hooks.event.WorktreeRemove -->

**Matcher:** none.

**Input** (`WorktreeRemoveHookInput`): `worktree_path` (string), the absolute path `WorktreeCreate`
returned.

**Output.** None: the exit code decides, and the client discards the JSON output fields. Exit 0
counts as removed; the client reads nothing else. <!-- req: hooks.behavior.WorktreeRemove input -->

**Exit 2.** Any non-zero exit code fails the removal if the directory at `worktree_path` still
exists afterwards: the worktree stays, with no git fallback, and the command and stderr go to the
debug log; a background session being deleted stays too, its refusal in agent view naming how the
hook ended (`exited 1`) and quoting the start of its stderr; a `claude remote-control` cleanup shows
`worktree removal failed, kept: <path>`. A hook that deleted the directory before failing counts as
removed. <!-- req: hooks.exit2.WorktreeRemove -->

## 7.5.31 `PreCompact`

**When.** The client MUST fire `PreCompact` before it runs a compaction. <!-- req: hooks.event.PreCompact -->

**Matcher** (`trigger`):

| Value | Fires on |
| --- | --- |
| `manual` | `/compact`. <!-- req: hooks.matcherValue.PreCompact.manual --> |
| `auto` | auto-compaction at the auto-compact window, and idle compaction. <!-- req: hooks.matcherValue.PreCompact.auto --> |

**Input** (`PreCompactHookInput`): `trigger` (`"manual" | "auto"`) and `custom_instructions`
(string or `null`): what the user passed to `/compact`, `null` when nothing was passed and always
for `auto`. <!-- req: hooks.behavior.PreCompact input -->

**Output.** The client discards `systemMessage` and `continue`. A top-level `decision: "block"`
blocks the compaction. When the hook exits 0 and does not block, the client MUST use its plain
stdout as instructions for the compaction summary, cut at 10,000 characters per hook with a marker
appended, not saved to a file as §7.4.5.2 does elsewhere; the instructions of several hooks are all
used, in handler order (Judgment J7.111). <!-- req: hooks.behavior.PreCompact output -->

**Exit 2.** Blocks the compaction; for a manual `/compact` the stderr is shown to the user. A blocked
proactive auto-compaction is skipped and the conversation continues uncompacted; a blocked
compaction that was recovering from a context-limit error lets that error surface, and the request
fails. <!-- req: hooks.exit2.PreCompact -->

## 7.5.32 `PostCompact`

**When.** The client MUST fire `PostCompact` after a compaction completes. <!-- req: hooks.event.PostCompact -->

**Matcher** (`trigger`):

| Value | Fires on |
| --- | --- |
| `manual` | after `/compact`. <!-- req: hooks.matcherValue.PostCompact.manual --> |
| `auto` | after auto-compaction at the auto-compact window, and after idle compaction. <!-- req: hooks.matcherValue.PostCompact.auto --> |

**Input** (`PostCompactHookInput`): `trigger` (`"manual" | "auto"`) and `compact_summary` (string,
the summary the compaction produced). <!-- req: hooks.behavior.PostCompact input -->

**Output.** None: no decision control; the client discards `systemMessage` and `continue`.

**Exit 2.** Cannot block; the stderr is shown to the user only. <!-- req: hooks.exit2.PostCompact -->

## 7.5.33 `PreModelSwitch`

**When.** The client MUST fire `PreModelSwitch` before it applies a model switch the user or a
client requested: `/model <name>` and the `/model` picker, the `Option+P` / `Alt+P` picker, the
Model setting in `/config`, turning on fast mode when that changes the model, and a `set_model`
request or a model change in an `apply_flag_settings` request from an Agent SDK host or Remote
Control. It MUST NOT fire for switches the client makes itself (an automatic fallback, restoring the
model on resume), which reach `PostModelSwitch` only. Its default timeout is 30 seconds, and a hook
that does not respond within its timeout blocks the switch (§7.4). <!-- req: hooks.event.PreModelSwitch -->

**Matcher:** the canonical name of the target model, ignoring a `[1m]` suffix: an alias (`opus`), a
dated id and a provider id (an Amazon Bedrock id) all match the one canonical name they resolve to,
so `claude-opus-5` covers every spelling. When the client cannot determine a canonical name (a
custom id only an LLM gateway knows), it MUST run every `PreModelSwitch` hook whatever its matcher.

**Input** (`PreModelSwitchHookInput`):

| Field | Type | Meaning |
| --- | --- | --- |
| `from_model` | string | The model id switched from. <!-- req: hooks.input.PreModelSwitch.from_model --> |
| `to_model` | string | The model id switched to; the matcher compares its canonical name. <!-- req: hooks.input.PreModelSwitch.to_model --> |
| `requested_model` | string or `null` | What the request named: an alias, a full id, or `null` for the default model. <!-- req: hooks.input.PreModelSwitch.requested_model --> |
| `source` | `"command" \| "picker" \| "sdk"` | `command` for `/model <name>`, the `/config` Model setting or fast mode; `picker` for a model picker; `sdk` for a `set_model` or `apply_flag_settings` request. <!-- req: hooks.input.PreModelSwitch.source --> |
| `context_tokens` | number | Tokens the next request re-sends: input, cache read, cache creation and output tokens of the main conversation's last response, combined; `0` before the first response. <!-- req: hooks.input.PreModelSwitch.context_tokens --> |
| `prompt_cache_warm` | boolean | Whether the current model's prompt cache is likely still warm, so the switch forfeits it. <!-- req: hooks.input.PreModelSwitch.prompt_cache_warm --> |
| `cache_ttl` | `"5m" \| "1h"` | The main conversation's prompt cache lifetime at the switch. <!-- req: hooks.input.PreModelSwitch.cache_ttl --> |
| `estimated_cache_write_usd` | number | Estimated US-dollar cost of writing `context_tokens` to the cache on `to_model` at the `cache_ttl` rate, the next response excluded. <!-- req: hooks.input.PreModelSwitch.estimated_cache_write_usd --> |
| `pricing` | `"configured" \| "catalog" \| "default"` | How the estimate was priced: the organization's configured rates, list price, or an assumed default rate for a model with no known price. <!-- req: hooks.input.PreModelSwitch.pricing --> |

**Output** (`PreModelSwitchHookSpecificOutput`). A top-level `decision: "block"` cancels the switch.
The event accepts no `defer`, `updatedInput` or `additionalContext`.

- `permissionDecision` (`"allow" | "deny" | "ask"`): `allow` proceeds and skips the confirmation
  the client shows while the prompt cache is warm; `deny` cancels the switch; `ask` asks the user to
  confirm. Only `/model` in an interactive session can show the `ask` prompt; everywhere else —
  `-p`, `/config`, `set_model` — `ask` is a refusal. <!-- req: hooks.output.PreModelSwitch.permissionDecision -->
- `permissionDecisionReason` (string): for `deny`, shown to the user as the reason, or returned as
  the error of a `set_model` request; for `ask`, shown in the confirmation; ignored for `allow`, so
  the client shows nothing for it. <!-- req: hooks.output.PreModelSwitch.permissionDecisionReason -->

The client shows every `systemMessage` whatever the decision. **Several handlers:** precedence
`deny` > `ask` > `allow`. When the switch is blocked, the client keeps the current model and reports
that a `PreModelSwitch` hook blocked it, with the hook's message as the reason. A hook that does not
respond before its timeout (30 seconds by default) blocks the switch. An exit code other than 0 or 2
without valid JSON is a non-blocking error and the switch goes ahead, unless the hook's failure
blocks (§7.4.3). <!-- req: hooks.behavior.PreModelSwitch timeouts and other exit codes -->

The report reads `Model switch to <model> was blocked by a PreModelSwitch hook: <reason>` for a
switch the user typed or picked, and `Model switch blocked by a PreModelSwitch hook` with the
reason, not naming the target model, for one an Agent SDK host or Remote Control requested. The
reason is the hook's `permissionDecisionReason`, or one of the client's own:

- `PreModelSwitch hook <name> did not respond before its timeout`, for a hook that timed out;
- `confirmation required, and this session cannot ask`, for an `ask` without a reason where no
  confirmation can be shown; `/model` in a `-p` run adds `(run /model interactively to confirm)`;
- `a PreModelSwitch hook failed before answering`, or `PreModelSwitch hooks were cancelled (the
  control stream closed) before answering`, when the run ended without a verdict, which the client
  never treats as approval;
- a text that begins with what failed and ends `so organization-managed PreModelSwitch hooks could
  not be checked`, when the client cannot tell which `PreModelSwitch` hooks managed plugins deliver
  (a managed plugin failed to load); it checks again on every attempt, so a cleared failure stops
  blocking. <!-- docs: errors.md | Model switch was blocked by a PreModelSwitch hook -->

Which line is printed, and where (the transcript, stderr of a `-p` run, the error of a `set_model`
request), is the presenting host's choice, since only the host knows who asked for the switch. A
library that runs the hooks returns the verdict (blocked or not) and the reason, its own reasons
above included, and the line for each form: the user's form given the target model, the SDK and
Remote Control form `Model switch blocked by a PreModelSwitch hook: <reason>` without it. The host
keeps the current model and shows the form that fits the request (Judgment J7.211).

**Exit 2.** Blocks the switch and shows the stderr to the user. <!-- req: hooks.exit2.PreModelSwitch -->

## 7.5.34 `PostModelSwitch`

**When.** The client MUST fire `PostModelSwitch` after the session's model changes: a switch the
user or a client requested, an automatic model fallback, a setting such as `opusplan` entering or
leaving plan mode, and the model restored on resume. It MUST NOT fire when a model of a fallback
chain serves one turn, which leaves the session's model unchanged. <!-- req: hooks.event.PostModelSwitch -->

**Matcher:** as `PreModelSwitch`, against the canonical name of the model switched to.

**Input** (`PostModelSwitchHookInput`): the fields of `PreModelSwitch`, with two more `source`
values: `auto` for a fallback or another change the client made itself, and `resume` for the model
restored on resume; the narrower `source` of `PreModelSwitchHookInput` does not apply here. `requested_model` is `null` when `source` is `auto`, and the
restored model setting when it is `resume`. <!-- req: hooks.behavior.PostModelSwitch input -->

**Output** (`PostModelSwitchHookSpecificOutput`). Context only; the top-level `decision` is
discarded. Plain-text stdout on exit 0, or `additionalContext`, is delivered to Claude with the next
request after the switch.

- `additionalContext` (string): added to Claude's context with the next request. If the hook has
  not finished within five seconds after the user sends the next prompt, the client sends that
  request without it and attaches it to the following one; when the model changes several times
  before the next request, only the output for the last switch's target is delivered. <!-- req: hooks.output.PostModelSwitch.additionalContext -->

**Exit 2.** Cannot block, the model having switched: the stderr is shown to the user only, as a
`<hook name> hook error` notice; Claude does not see it. <!-- req: hooks.exit2.PostModelSwitch -->

## 7.5.35 `SessionEnd`

**When.** The client MUST fire `SessionEnd` when a session ends. Its hooks share a budget of 1.5
seconds by default when the user exits, runs `/clear` or switches session with interactive
`/resume`; how a hook's `timeout` and `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` raise it is §3 and
§7.3. <!-- req: hooks.event.SessionEnd -->

**Matcher** (`reason`): `clear` (`/clear`), `resume` (interactive `/resume`), `logout`,
`prompt_input_exit` (the user exited while the prompt input was visible), `other`. The client MUST
NOT send `bypass_permissions_disabled`, removed in v2.1.234 (Judgment J7.132).

**Input** (`SessionEndHookInput`): `reason`, one of the values above (`ExitReason`).
<!-- req: hooks.behavior.SessionEnd input -->

**Output.** None: the hook cannot block termination, and the client discards its JSON output fields,
except `terminalSequence`.

**Exit 2.** Cannot block; the stderr is shown to the user only. <!-- req: hooks.exit2.SessionEnd -->

## 7.5.36 `Elicitation`

**When.** The client MUST fire `Elicitation` when an MCP server requests user input during a tool
call, before showing its dialog (§8). A hook can answer for the user, and the dialog then does not
appear. <!-- req: hooks.event.Elicitation -->

**Matcher:** `mcp_server_name`, the configured MCP server names.

**Input** (`ElicitationHookInput`): `mcp_server_name` (string), `message` (string), and optional
`mode` (`"form" | "url"`), `url` (string, URL mode), `elicitation_id` (string) and
`requested_schema` (object, form mode). <!-- req: hooks.behavior.Elicitation input -->

**Output** (`ElicitationHookSpecificOutput`). The client applies `hookSpecificOutput` only when the
hook exits 0, ignores a `hookSpecificOutput` with no `action`, and discards `reason`,
`systemMessage` and `continue` whatever the `action`. The outcomes:

| To | The hook returns | The server receives |
| --- | --- | --- |
| Answer for the user | `action: "accept"`, the form values in `content` keyed by `requested_schema` property names. In URL mode the URL is never opened. <!-- req: hooks.output.Elicitation.Answer for the user --> | `accept` with that `content` |
| Decline | `action: "decline"`, as the dialog's **Decline** sends. <!-- req: hooks.output.Elicitation.Decline the request --> | `decline` |
| Cancel | `action: "cancel"`, as `Esc` in the dialog sends. <!-- req: hooks.output.Elicitation.Cancel the request --> | `cancel` |
| Leave it to the user | nothing, exit 0. <!-- req: hooks.output.Elicitation.Leave the request to the user --> | the user's answer from the dialog |

Besides `action: "decline"`, a hook declines by exiting 2 (its `hookSpecificOutput` is then
ignored) or by a top-level `decision: "block"`, which overrides an `action` in the same output; the
server receives the same `decline` in each case. Neither the user nor the server sees the reason or
stderr of a decline. **Several handlers:** a decline from any handler overrides an `accept` or
`cancel` from another (Judgment J7.114). <!-- req: hooks.behavior.Other ways to decline an elicitation -->

A hook that prints an `accept` with its `content` answers the request without a dialog; one that
prints nothing leaves the dialog to appear. The client records a debug line ending `Elicitation
resolved by hook: <the action and content as JSON>`. <!-- req: hooks.behavior.Answer a form request from a script -->

**Exit 2.** Declines the request, and no dialog appears; a `hookSpecificOutput` the same hook
printed is ignored. <!-- req: hooks.exit2.Elicitation -->

## 7.5.37 `ElicitationResult`

**When.** The client MUST fire `ElicitationResult` after the user responds to an elicitation — by
accepting, declining or cancelling — and before the response goes back to the server. It MUST NOT
fire when an `Elicitation` hook answered the request. <!-- req: hooks.event.ElicitationResult -->

**Matcher:** `mcp_server_name`, as `Elicitation`.

**Input** (`ElicitationResultHookInput`): `mcp_server_name` (string), `action` (`"accept" |
"decline" | "cancel"`, the user's), and optional `mode`, `elicitation_id` and `content` (the
submitted values; Judgment J7.129). <!-- req: hooks.behavior.ElicitationResult input -->

**Output** (`ElicitationResultHookSpecificOutput`), under the same rules as `Elicitation`: applied
only on exit 0, ignored without an `action`, and `reason`, `systemMessage` and `continue` discarded.
The hook's `action` replaces the user's.

| To | The hook returns | The server receives |
| --- | --- | --- |
| Let it through | nothing, exit 0. <!-- req: hooks.output.ElicitationResult.Let the response through --> | the user's response, unchanged |
| Change the values | `action: "accept"` with new `content`, which replaces the user's whole `content` object. <!-- req: hooks.output.ElicitationResult.Change the submitted values --> | `accept` with the hook's `content` |
| Block it | `action: "decline"`. <!-- req: hooks.output.ElicitationResult.Block the response --> | `decline`, without the user's values |
| Cancel it | `action: "cancel"`. <!-- req: hooks.output.ElicitationResult.Cancel the request --> | `cancel`, with the values the user submitted |

A top-level `decision: "block"` also blocks (declines) and overrides an `action` in the same output.
**Several handlers:** as `Elicitation`.

**Exit 2.** Blocks the response: the action becomes `decline`, and the hook's `hookSpecificOutput`
is ignored. <!-- req: hooks.exit2.ElicitationResult -->

## Design decisions

### Why combination is defined by handler order, not by finishing order

Handlers run in parallel, so "the last to answer" would differ between runs and between clients.
Claude Code's docs give precedences only for the gates (`PreToolUse`, `PreModelSwitch`, the
elicitations); for every other field this section fixes one rule per kind of value — the last
single value in configuration order, any `true`, the union of lists — so two conformant clients
given the same hooks reach the same outcome. Later configuration overriding earlier matches how
settings layer (§12).

### Why the client discards rather than rejects a field an event does not honour

Many events document that they discard `systemMessage` or `continue`, and the SDK's output type is
one shape for every event. A hook written for several events, or a field a later release adds to
an event, must not turn a working hook into a validation failure; only §7.4's schema decides
whether the JSON is valid, and this section decides what of it has effect.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J7.100 | Event names are matched exactly and case-sensitively; a hooks-map key that names no event of §7.5.1 registers nothing, and a validator reports it as a warning (§7.5.1). | `HOOK_EVENTS` in the SDK is the list. Oracle 2.1.325: `claude plugin validate` on a plugin hooking all 33 events passes; with an added `PreToolUSE` key it passes with the warning `hooks.PreToolUSE: unknown hook event; entry ignored at runtime`. The same run reported no warning for a `matcher` on the matcherless events. |
| J7.101 | `scratchpad_dir` is sent as a string though the SDK's `BaseHookInput` lacks it (§7.5.2). | `hooks.md` documents the field (v2.1.257 or later); the docs state the contract and the type lags. Lead: the reference implementation's `src/hooks/input/common.ts`. |
| J7.102 | `permission_mode` is sent on `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`, `PermissionDenied`, `UserPromptSubmit`, `UserPromptExpansion`, `Stop`, `SubagentStop`, `TaskCompleted` and `TeammateIdle`, and on no other event (§7.5.2). | `hooks.md` says "Not all events receive this field. Check the JSON example in each hook event section"; the examples are the only list, and those events' examples show it. |
| J7.103 | `effort` is sent, on a model with effort, on `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`, `PermissionRequest`, `PermissionDenied`, `Stop` and `SubagentStop` (§7.5.2). | `hooks.md` names four events and "other events with a tool-use context"; the events that carry a tool call or end the agent's turn are counted as that context. |
| J7.104 | A common field with no value is omitted, never sent as an empty string or `null` (§7.5.2). | The docs call these fields "absent" when they do not apply; an empty text would read as a value. |
| J7.105 | The `StopFailure` matcher and `error` may also carry `verification_required`, which the SDK's `SDKAssistantMessageError` has and the docs do not list (§7.5.23). | The SDK type is a superset of the documented table; a hook matching it must not be refused. |
| J7.106 | A client MAY send `UserPromptSubmit.source` (`"user"`, `"sdk"`, `"system"`, `"loop_wakeup"`, `"schedule_wakeup"`, `"poll_event"`); a hook MUST NOT rely on it (§7.5.8). | The SDK type has the field and says "payloads may omit it while the field rolls out"; `hooks.md` does not document it. |
| J7.107 | `UserPromptExpansion` accepts `suppressOriginalPrompt` as a known field, and it changes nothing: an expansion's block message never quotes the typed line (§7.5.9). | The SDK's `UserPromptExpansionHookSpecificOutput` has the field; `hooks.md` lists it only for `UserPromptSubmit`, whose block message is the one that ends with `Original prompt:`. Oracle 2.1.325 (`claude -p "/<plugin>:hello SECRET-ARG" --plugin-dir`, a `UserPromptExpansion` hook printing `decision: "block"`): the result and the transcript read `UserPromptExpansion operation blocked by hook:` and the reason, with neither the typed line nor its argument. |
| J7.108 | `additionalContext` reaches Claude only on the events whose section says where it appears (`SessionStart`, `SubagentStart`, the two prompt events, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PostToolBatch`, `Stop`, `SubagentStop`, `PostModelSwitch`); on `Notification` and `Setup`, where the SDK types it, it is discarded (§7.5.17, §7.5.6). | `hooks.md`, "Add context for Claude", lists where the reminder appears; `Setup` says its `additionalContext` is discarded; no section says what `Notification`'s does. |
| J7.111 | Handler order is the order §7.2 gives the matched handlers. Without a documented precedence, a single-valued field (`sessionTitle`, `initialUserMessage`, `displayContent`, `updatedInput`, `updatedToolOutput`, `worktreePath`) takes the last value in that order; a flag (`reloadSkills`, `suppressOriginalPrompt`, `retry`) holds if any handler sets it; `watchPaths` is the union, each path once, in order; `PreCompact` stdout instructions of every handler are all used, in order. A rejected `updatedToolOutput` does not hide an earlier accepted one (§7.5.4, §7.5.31). | The docs give precedence only for the gates and elicitations and say every `additionalContext` reaches Claude. Lead: the reference implementation's merge rules ("last-in-registry-order wins"). See Design decisions. |
| J7.112 | A block by exit code or failure wins over another handler's JSON decision; among blocks the first in handler order supplies the message; only a JSON blocking decision of the same hook replaces an exit-2 hook's stderr as the reason (§7.5.4). | `hooks.md`, "Exit code 2": the JSON fields "can't override the block" and a blocking decision's reason is used "instead"; both are stated for one hook. |
| J7.113 | `PermissionRequest` across handlers: any `deny` wins over every `allow`; the message is the first denying handler's that has one; `interrupt` holds if any denying handler sets it; the `updatedPermissions` of the allowing handlers are concatenated in order and the last `updatedInput` wins (§7.5.12). | The docs give no precedence for this event; a deny winning matches the gates' `deny` first. |
| J7.114 | `Elicitation` and `ElicitationResult`: a decline (an `action: "decline"`, a `decision: "block"` or an exit 2) beats every other answer; between `accept` and `cancel`, the first in handler order wins (§7.5.36). | The docs say only "a decline from one of them overrides an `accept` or `cancel` from another". |
| J7.115 | On `Stop` and `SubagentStop`, a handler that returns `continue: false` stops, and its own `decision: "block"` and `additionalContext` feedback do not keep the turn going (§7.5.22). | "`continue` ... takes precedence over any event-specific decision fields"; on `Stop` the two contradict. |
| J7.116 | Only `PostToolBatch` turns `continue: false` into a block of the action; on other events it stops Claude with `stopReason` (§7.5.15). | `hooks.md` says "`decision: "block"` or `continue: false` stops the agentic loop" for `PostToolBatch` alone. |
| J7.117 | A winning `defer` drops every handler's `updatedInput`; a `defer` that is ignored (interactive session, several tool calls) leaves no hook decision, and the lower-ranked `ask` or `allow` of other handlers do not stand in for it (§7.5.11). | `updatedInput` is "for `defer`, ignored" and the call "proceeds through the normal permission flow"; neither says whose input or what becomes of the other answers. |
| J7.118 | A `Stop` or `SubagentStop` output with `decision: "block"` and no `reason` fails validation and is a non-blocking error (§7.5.22). | `reason` is "Required when `decision` is `"block"`"; the docs do not say what a missing one does. |
| J7.120 | `terminalSequence` is honoured on every event, including those that discard all JSON output (`Setup`, `InstructionsLoaded`, `SessionEnd`, `WorktreeRemove`, `StopFailure`), within the limits of §7.5.3 (§7.5.3). | "The field works on events that discard `systemMessage` and `continue`"; its exceptions are about the session and the handler, not the event. |
| J7.121 | The top-level `decision` is discarded on `PermissionRequest`, `PermissionDenied`, `SessionStart`, `SubagentStart`, `PostModelSwitch`, `TaskCompleted` and `TeammateIdle`, and on every event with no decision control (§7.5.5 and others). | The "Decision control" table lists no top-level `decision` for them; `PermissionDenied` reads only `retry`. |
| J7.122 | An empty-string `displayContent` replaces the delta with nothing; only an absent field displays the original (§7.5.10). | The docs say only "Omit it to display the original". |
| J7.123 | The stderr of an exit-2 `MessageDisplay` hook is discarded; of `WorktreeCreate`, written to the debug log (§7.5.10, §7.5.29). | The per-event table gives these rows no stderr route. |
| J7.124 | An exit-2 `PostToolBatch` hook's stderr is shown to the user as a transcript warning and stays in the conversation for Claude (§7.5.15). | The table says only "Stops the agentic loop"; the decision-control text routes the blocking message, "or from stderr on exit 2", that way. |
| J7.125 | `trigger_file_path` is sent for `nested_traversal` and `path_glob_match` loads only (§7.5.7). | `hooks.md` says "for lazy loads" and names those two reasons as the lazy loads. |
| J7.126 | `SessionStart.model` is sent whenever the client knows the active model, for any `source`; it is omitted only when the client does not know it (§7.5.5). | The docs say it "can be omitted, for example after `/clear`" and tell hooks to check for it. |
| J7.127 | A capped text keeps its first 1,000 Unicode code points, then `… [+N chars]`, `N` being the code points cut; the marker does not count toward the cap. A task whose `type` is not one of the listed labels carries none of the per-type fields (§7.5.22). | The docs give the cap and the marker, not how `N` is counted, whether the marker counts, or what an unlisted type carries. |
| J7.128 | `notification_type` may carry a type outside the matcher table; the matcher values are the documented ones (§7.5.17). | The SDK types it as `string`; the input section says only that it indicates "which type fired". |
| J7.129 | `ElicitationResult.content` is sent as the user submitted it, for every `action` (§7.5.37). | `content` is optional and undescribed for `decline` and `cancel`; the output table says a `cancel` reaches the server "along with the values the user submitted". |
| J7.130 | `retry` is ignored when the denial `reason` starts with `Auto mode could not evaluate this action and is blocking it for safety`; a `Classifier unavailable` denial honours it (§7.5.16). | The docs define the no-verdict denial by that prefix and list `Classifier unavailable` separately, without calling it no-verdict. |
| J7.131 | An output without `watchPaths` leaves the dynamic watch list as it is; `[]` clears it; a relative entry is resolved against the hook input's `cwd` (§7.5.26, §7.5.28). | The docs say the field "replaces" the list and ask for absolute paths, but not what an absent field or a relative path does. |
| J7.132 | A `SessionEnd` matcher naming `bypass_permissions_disabled` never matches (§7.5.35). | The docs say the value was removed in v2.1.234 and is not sent; the SDK's `ExitReason` lacks it. |
| J7.135 | The client knows whether `TaskUpdate` or a teammate's finished turn fired `TaskCompleted` and applies `continue: false` only for the latter; the input does not say which (§7.5.21). | The docs make `continue: false` hold for one trigger only, and the input has no field naming it. |
| J7.136 | The continuation cap counts per session, and per subagent for `SubagentStop`; a stop that holds nothing ends the run of consecutive holds; `additionalContext` feedback counts as a hold (§7.5.22). The count resets when Claude calls a tool in that session or subagent: the tool call is the reset, whether or not any hook is registered for it. A library that sees only dispatched events resets on `PreToolUse`, `PostToolUse` and `PostToolUseFailure` of that session or subagent; `PermissionRequest`, `PermissionDenied` and `PostToolBatch` do not reset it, and neither does `stop_hook_active`. | `hooks.md`, "Stop input", gives the cap of eight "consecutive" continuations and the reset "each time Claude calls a tool", and says feedback goes "through the same loop protections". The three events are the ones every call reaches (§7.5.11, §7.5.13, §7.5.14); the others follow a call `PreToolUse` already counted, or none. Reference: `src/hooks/verdict/stop-block-cap.ts` (`TOOL_EVENTS`). |
| J7.138 | A built-in tool's `updatedToolOutput` is checked against the tool's output type (`sdk-tools.d.ts`, §7.6) where one is defined; for a tool without one it passes unchecked; `updatedMCPToolOutput` on a built-in tool is ignored, and a hook that sets both fields on an MCP tool gets its `updatedToolOutput` (§7.5.13). | The docs say a non-matching built-in value "is ignored" without naming the shapes, and only "prefer `updatedToolOutput`" for the two fields; the SDK's tool output types are the shapes (E2). Lead: the reference implementation's `src/hooks/output/merge-simple.ts` takes the hook's own `updatedToolOutput` before `updatedMCPToolOutput`. |
| J7.141 | The `FileChanged` filter reads the matcher by the narrow grammar of §7.2 (letters, digits, `_` and `\|` exact), against the basename of `file_path` (§7.5.28). | `hooks.md` says those two events use the narrow set, and also that the filter uses "the standard matcher rules"; the two disagree for a hyphen, comma or space. |
| J7.143 | When several `WorktreeCreate` handlers return a path, the last in handler order is used; an HTTP hook's `worktreePath` and a command hook's stdout count alike (§7.5.29). | The docs describe one hook returning one path. |
| J7.144 | `suppressOriginalPrompt` counts only in the output of a handler that blocks the prompt itself (`decision: "block"` or exit 2); a non-blocking handler's flag is ignored, so of several handlers the prompt text is left out when one of those that blocked set it (§7.5.8). | `hooks.md`, "UserPromptSubmit decision control", defines the field as "if `true` when the hook blocks the prompt", and "What a blocked prompt leaves behind" says it works "whether the hook blocks with `decision: "block"` or by exiting 2": both tie the flag to the hook that blocks. The reference implementation takes it from any handler (`src/hooks/output/merge-simple.ts`); that reading lets a hook that never blocked change another hook's message. Oracle 2.1.325 cannot tell the two apart: in `claude -p` the block message, in the result and the transcript, is `UserPromptSubmit operation blocked by hook:` and the reason, without an `Original prompt:` line whether the flag is set or not. |
| J7.211 | The report line of a blocked model switch is the host's to choose and to place; a library returns the verdict, the reason and both forms of the line, the one an Agent SDK host or Remote Control gets written `Model switch blocked by a PreModelSwitch hook: <reason>`. | `errors.md`, "Model switch was blocked by a PreModelSwitch hook", gives the user's form with the model and says the SDK and Remote Control form leaves the model out "with the reason" without spelling the joint; `: ` is the user form's joint. Who requested the switch (a typed `/model`, a picker, `set_model`) is known only to the host that received the request. |
