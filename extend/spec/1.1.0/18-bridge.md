# 18. The core and Claude Code in one client

An Extended client loads both package forms (§1.2): core packages under the core, Claude Code
plugins under the chapters of this specification. This chapter says how the two coexist in one
session, how each core hook event, field and tool profile corresponds to Claude Code's, how an
author writes one behaviour in both forms, and what a tool that converts one form into the other
MUST do.

The chapter carries no requirement ids: Claude Code has no core packages, so its documentation says
nothing here. Every rule is derived from the core (`core §n`, Agent Plugins 1.1.0), from the
chapters of this specification (`§n`), or is a judgment of this chapter (`J18.n`) with its reason.
Field shapes on the Claude Code side follow the 2.1.330 types named in §7.5 and §7.6
(`@anthropic-ai/claude-agent-sdk` 0.3.330, `sdk.d.ts` and `sdk-tools.d.ts`).

Two principles decide every case below:

1. **A Claude Code plugin behaves exactly as in Claude Code.** Nothing a core package does changes
   what a Claude Code plugin's hooks receive, when they run, or what their results do.
2. **A core package behaves exactly as the core says.** Its handlers receive core inputs only, its
   results are read by core rules, and where the core leaves a choice to the client (limits,
   presentation, failure policy, context placement), the Extended client makes the choice Claude
   Code makes for the nearest Claude Code feature.

## 18.1 One client, two forms

### 18.1.1 What runs under which rules

1. An Extended client decides each plugin root's form by §1.3 and then applies one rule set to the
   whole root: a core package's `plugin.json`, `skills/`, `mcp.json` and `hooks.json` by the core;
   a Claude Code plugin's files by §2–§17. A dual package is a Claude Code plugin only (§1.3.1,
   J1.2), so nothing of this chapter's coexistence rules applies inside one package.
2. Core packages and Claude Code plugins MAY be enabled in the same session. Their components then
   share one session: one tool namespace (§18.1.4), one permission system (§13), one hook
   occurrence per event (§18.1.2), one context the model sees.
3. A core package has no Claude Code components. Its root's `commands/`, `agents/`, `.mcp.json`,
   `hooks/hooks.json`, `bin/`, `settings.json` and every other default location of §1.4 are ordinary
   files the client MUST NOT load, because the core defines only `skills/`, `mcp.json` and
   `hooks.json` (core §6.1, §7). A `hooks/` directory beside `hooks.json` is where the core keeps
   handler programs (core §4.2), not a hooks location.
4. A core package's `extensions` members and extension directories (core §8) are ignored by an
   Extended client: this specification defines no extension namespace. The client MUST NOT validate
   them (core §8.1).

### 18.1.2 Hooks of both forms on one occurrence

The core's five events have Claude Code events of the same name. An Extended client fires each
occurrence once for both forms: the Claude Code handlers of every enabled Claude Code plugin,
settings file and frontmatter (§7.1) as §7 says, and the core handlers of every enabled core
package as core §7.3 says. Which occurrences of a Claude Code event are also occurrences of the
core event is this table (Judgments J18.6–J18.9):

| Core event | Fires on these Claude Code occurrences | Not on |
| --- | --- | --- |
| `SessionStart` | `SessionStart` with `source` `startup`, `clear` or `fork`: each gives the session a new `session_id` (§3.3, `CLAUDE_CODE_SESSION_ID` changes on `/clear`). | `source` `resume` and `compact`, which keep the `session_id` (core §7.3.4); subagents. |
| `UserPromptSubmit` | `UserPromptSubmit` for an external submission (core §7.3.5): a prompt the user submits, a prompt an SDK or `-p` caller submits, an event a host submits on the poll-event channel, and a message from outside the session's own work that the client injects, such as a message another session or a channel sends to the conversation. | The turns the client starts itself: a scheduled task or `/loop` iteration firing, a task notification (a background subagent, command or monitor reporting back) and an automatic continuation (core: internally generated work and agent reports SHOULD NOT trigger it). |
| `PreToolUse` | Every `PreToolUse` (§7.5.11), in the main conversation and in subagents. | `EndConversation`, which fires no tool event in Claude Code either. |
| `PostToolUse` | Every `PostToolUse` (§7.5.13), and every `PostToolUseFailure` (§7.5.14) whose `is_interrupt` is not `true`: a failure the tool reports is a completed result reporting failure (core §7.3.7). | A call denied before it ran, a call rejected for unknown name or invalid input, a cancelled call, an abort (`is_interrupt: true`). |
| `Stop` | `Stop` (§7.5.22). | `SubagentStop`, `StopFailure` (a turn ending on an API error), a user interrupt. |

The other 28 Claude Code events have no core counterpart; core handlers never run on them.

**Which `UserPromptSubmit` turns are external.** The client decides by the turn's origin, which it
knows because it started or accepted the turn, never by the input's `source` alone (Judgment
J18.7). The official `source` values (`UserPromptSubmitHookInput`, `sdk.d.ts` 0.3.330; J7.106)
decide every case but one: `user`, `sdk` and `poll_event` are external and fire the core event;
`loop_wakeup` and `schedule_wakeup` are client-started and do not. `system` covers both kinds
("other machine-injected turns: peer/channel messages, task notifications, auto-continuation"), so
for a `system` turn the client MUST classify it by origin: a peer or channel message fires the core
event, a task notification or an automatic continuation does not. The type lets payloads omit
`source`; a turn without it is classified by origin too. A component of the client that sees only
the Claude Code input (a library the host calls) MUST be told the origin of every `system` turn by
its host and MUST NOT fire or skip one by default as if it knew; a turn without `source` it MAY
treat as a submitted prompt, unless the host says otherwise. A hook adapter (§18.4.4) runs as a
Claude Code handler and has no host to ask; it follows §18.4.4 item 5 instead.

#### Inputs

1. A core handler MUST receive exactly the core input of its event (core §7.3.3–§7.3.8), with no
   Claude Code field: no `transcript_path`, `permission_mode`, `agent_id`, `mcp_server` or any other
   field §7.5 adds. Core §7.3.3 forbids a property no Agent Plugins version defines.
2. The common fields carry the values the Claude Code handlers of the same occurrence receive:
   `hook_event_name` the event's name, `session_id` the session's identifier (§7.5.2; core
   §7.3.3 needs one value per root session, and Claude Code's is that value, a subagent's events
   included), `cwd` the same absolute working directory.
3. §18.2 gives every other field.

#### When each side runs

1. **`PreToolUse`: Claude Code first, then the core.** The client MUST run the Claude Code
   handlers the occurrence selects (§7.2.5), combine their results (§7.5.11), apply the winning
   `updatedInput` when the combined decision is neither `deny` nor `defer`, and only then run the
   core handlers, whose `tool_input` and `tool_profile` describe the input the call would run with
   (Judgment J18.1). When no Claude Code handler is selected, the core handlers run at once. The
   core handlers run whatever the Claude Code outcome was, a denial included, because core §7.3.6
   covers every call the client intercepts; a core result cannot undo a Claude Code denial.
2. **Every other shared event: together.** On `SessionStart`, `UserPromptSubmit`, `PostToolUse`
   and `Stop` no Claude Code handler can change what a core input carries, so the client MAY run
   both sides concurrently, and MUST wait for both before acting on the occurrence (§7.2.5; core
   §7.3.5, §7.3.7).
3. **No handler sees another's result.** A core handler never receives a Claude Code handler's
   output, and a Claude Code handler never receives a core handler's: core §7.3.3 forbids the
   first, and Claude Code hooks receive nothing of other hooks' results. On `PostToolUse` the core
   `tool_result` and `tool_profile` describe the tool's own result, before any Claude Code
   `updatedToolOutput` or `updatedMCPToolOutput` replaced it (Judgment J18.2). The rewritten input
   of item 1 is not a handler's result in the core's sense: it is the call as the client will make
   it, which is what core §7.3.6 defines `tool_input` to be.
4. **Handler order.** Where §7.5.4 picks a message by handler order, every Claude Code handler of
   the occurrence comes before every core handler, and core handlers follow in the order their
   packages loaded (Judgment J18.3).

#### Combining results

| Event | Outcome when both sides answer |
| --- | --- |
| `SessionStart` | Every core `additional_context` and every Claude Code `additionalContext` (and plain stdout) reaches the model before its first request; none replaces another. Claude Code's other fields apply as §7.5.5 says; the core has none. |
| `UserPromptSubmit` | Blocked when any Claude Code handler blocks (`decision: "block"`, exit 2, a failure under `onFailure: "block"`) or any core handler returns `deny`. A blocked prompt delivers no context from either side (core §7.3.5). The block message is the one §7.5.4 item 1 picks among the Claude Code handlers when one blocked (an exit-code block before a JSON block, then handler order), else the core reasons (joined as item 6 of "Failures, limits and presentation" says); it ends with `Original prompt:` and the text unless a blocking Claude Code handler set `suppressOriginalPrompt` (§7.5.8). When the prompt proceeds, every context string of both sides reaches the model with it. |
| `PreToolUse` | The decision with the highest precedence wins: `deny` > `defer` > `ask` > `allow` > none. A core `deny` is a `deny`; a core `allow` is an `allow` with no `updatedInput`. The reason Claude receives for a denial is the one §7.5.11 and §7.5.4 item 1 pick among the denying Claude Code handlers when one denied, else a core reason, so a Claude Code denial's reason wins; the client MAY append the core reasons. An `allow` that wins, from either side, skips the permission prompt only as §7.5.11 says: deny and ask rules, managed policy, the sandbox, `AskUserQuestion` and `ExitPlanMode` (which need `updatedInput`), and MCP tools that require user interaction still decide, which is also what core §7.3.6 requires of an `allow`. |
| `PostToolUse` | Every core `additional_context` and every Claude Code `additionalContext` reaches the model with the tool result. Claude Code's replacements, `decision: "block"` and `continue: false` apply as §7.5.13 says; the core has no counterpart. |
| `Stop` | The client continues when any Claude Code handler blocks (`decision: "block"`, exit 2, `additionalContext` feedback) or any core handler returns `continue`, unless a Claude Code handler returned `continue: false` (a client-specific result that prevents continuation, core §7.3.8). One continuation runs, carrying every Claude Code reason and every core reason. The loop cap of §7.5.22 counts that one continuation once, whatever side asked for it (Judgment J18.9). |

#### Failures, limits and presentation of core handlers

1. A core handler that fails (core §7.3.2 item 5: it did not launch, timed out, exited nonzero, or
   wrote anything but nothing or one valid object; `{}` is a failure) contributes nothing. The
   client MUST NOT deny, block or stop because of it: the core allows that (core §7.3.5, §7.3.6),
   Claude Code's default for a failed hook is a non-blocking error (§7.4.1), and a core author has
   no `onFailure` to ask for more (Judgment J18.4). The client reports it as it reports a
   non-blocking Claude Code hook error, with the `<hook name> hook error` notice on the events that
   show one (§7.4.1) and the cause in the debug log. The notice is the line a Claude Code `command`
   hook in exec form gets for the same failure on the same event, `<hook name> hook error:
   [<label>]: <cause>` (§7.4.1.2 item 3, §7.4.1.3): `<hook name>` is the event, with `:<tool name>`
   on the tool events; `<label>` is the handler's `command` and `args` as written in `hooks.json`,
   joined by single spaces; `<cause>` is, by failure (Judgment J18.22):

   | Failure | `<cause>` |
   | --- | --- |
   | A nonzero exit status, 2 included | `Failed with non-blocking status code: <first line of stderr>`, or `no stderr output` after the colon when stderr is blank (§7.4.1.3 item 2); the whole stderr goes to the debug log. |
   | Did not launch | The launch error, as for a Claude Code hook that could not start (§7.4.1.3 item 3). |
   | Timed out | The timeout text a Claude Code `command` hook gets on that event (§7.4.2, §7.5.8, which name the timeout and the discarded output but give no words): `timed out after <N>s; the hook's output was discarded` on `UserPromptSubmit`, `timed out` on the others, `<N>` the limit of item 3 in seconds. |
   | Exit 0 with output that is not one JSON object (plain text included) | `wrote output that is not one JSON object` |
   | Exit 0 with one object that is no result shape of the event, `{}` included | `wrote an object that is not a <event> result` |

2. An exit status of 2 from a core handler is a failure like any other nonzero status, never a
   block (core §7.3.3). Plain text on stdout from a core handler is invalid output, never context.
3. A core handler's time limit is the default timeout of a Claude Code `command` hook on the same
   event: 30 seconds on `UserPromptSubmit`, 600 seconds on the other four (§7.3.8). Its output
   limit, the 10,000-character cap on each context string, the system-reminder wrapping and the
   transcript record of injected context are those of a Claude Code hook (§7.5.3) (Judgment J18.5).
4. A core handler runs as core §7.3.3 says: a fresh process per invocation, `command` resolved as
   one token (a `./` path against the plugin root), `args` after `${PLUGIN_ROOT}` and
   `${PLUGIN_DATA}` expansion, the plugin root as working directory, one JSON object on stdin, the
   environment of §18.1.3. The Claude Code machinery of matchers, `if`, `async`, `once`,
   `statusMessage`, shell form and `${CLAUDE_*}` substitution does not apply to it.
5. `disableAllHooks` and the managed hook restrictions of §7.2.6 and §14 apply to a core package's
   handlers as to a Claude Code plugin's hooks: they are plugin hooks, and an administrator who turns
   plugin hooks off means every plugin's (Judgment J18.15).
6. **Reasons from several core handlers.** Where a core reason reaches Claude or the user (a
   `UserPromptSubmit` or `PreToolUse` denial, a `Stop` continuation), the reasons of every core
   handler that returned the decision are taken in handler order (J18.3), an absent or empty
   `reason` left out, and joined with one newline (`\n`). With Claude Code's message first (the
   `Stop` continuation, or a `PreToolUse` denial whose core reasons the client appends), the core
   text follows it after one newline. When no core handler gave a reason, the core side adds no
   text, and a denial or continuation it alone decided carries an empty reason (Judgment J18.22).

### 18.1.3 Environment

1. **Core subprocesses.** For a core package's stdio MCP servers and hook handlers, the client MUST
   set `PLUGIN_ROOT` and `PLUGIN_DATA` as core §9.1 says, after the server's `env` overlay. The base
   environment is the one a Claude Code plugin's subprocess of the same kind receives (§3.3,
   §7.3.2.3): the client's environment after `env` in settings and the scrub of §3.3.1, with
   `CLAUDECODE`, `CLAUDE_CODE_SESSION_ID`, `CLAUDE_PID` (hooks only) and `CLAUDE_PROJECT_DIR`. The
   client MUST NOT set `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` or any `CLAUDE_PLUGIN_OPTION_<KEY>`
   for a core subprocess, and SHOULD remove those names when it inherited them (Judgment J18.12).
2. **Claude Code subprocesses.** For a Claude Code plugin's hooks, MCP, LSP and monitor processes
   the client sets exactly what §3.3 says, and MUST NOT set `PLUGIN_ROOT` or `PLUGIN_DATA`. An
   inherited value of either passes through untouched, as it does in Claude Code.
3. **Values.** `PLUGIN_ROOT` is the filesystem-resolved directory that `CLAUDE_PLUGIN_ROOT` would
   name for the same install (§3.1.1): the version's cache directory, or the source directory of a
   plugin loaded in place, with symbolic links resolved as core §9.1 requires. `PLUGIN_DATA` is the
   directory `CLAUDE_PLUGIN_DATA` would name, `<plugins root>/data/<id>/` (§3.1.2), created before
   the first subprocess starts, kept across updates and deleted on uninstall as §3.1.2 says
   (Judgment J18.13).
4. **Placeholders.** In a core package's files the client expands `${PLUGIN_ROOT}` and
   `${PLUGIN_DATA}` only, only where core §9.2 says, and leaves every other `${...}` literal:
   `${CLAUDE_PLUGIN_ROOT}`, `${HOME}` and `${user_config.KEY}` stay as written. In a Claude Code
   plugin's files `${PLUGIN_ROOT}` is an ordinary environment-variable reference (§8.4.2) read from
   the client's environment, as in Claude Code.
5. **User configuration.** A core package declares no `userConfig`; the client asks nothing at
   enable, and `pluginConfigs` entries for its id have no effect.

### 18.1.4 MCP servers in one tool namespace

1. **Names.** A core package's server registers under the scoped name `plugin:<name>:<server>`,
   and its tools are callable as `mcp__plugin_<name>_<server>__<tool>`, normalised as §8.5 says
   (every character outside `A-Z`, `a-z`, `0-9`, `_` and `-` becomes `_`): server `notes` of core
   package `acme.tools` offers `mcp__plugin_acme_tools_notes__latest_tag` (Judgment J18.10). The
   model, permission rules, hook matchers, a skill's `allowed-tools`, a subagent's `tools`,
   `mcp_tool` hooks, `/mcp` and the policy lists see that name. The input's `mcp_server` given to
   Claude Code handlers is `{ name: "<server>", source: "plugin" }`.
2. **Collisions.** Two plugins whose normalised segments coincide (`acme.tools` and `acme_tools`)
   collide as two Claude Code plugins would; §8.5 governs. The 128-character limit of §8.5 item 3
   applies to a core package's tools too.
3. **Configuration.** The client validates and starts a core server by core §7.2: closed variants,
   `command` as one token, `cwd` supported with the plugin root as default, `url` and `headers`
   never expanded, HTTPS required off loopback, an invalid entry skipped with the rest kept. A
   valid core server then runs as a Claude Code plugin's server of the same transport with no
   optional field set: `stdio` as §8.2.1, `streamable-http` as `http` and `sse` as `sse` (§8.2.2),
   with Claude Code's connect and tool timeouts, output limits (§8.10.1), tool-search deferral,
   lifecycle (§8.8) and elicitation (§8.10.5). Authorization is client-managed in the core (core
   §7.2.1), so a remote core server that requires it goes through the OAuth flow of §8.7 with
   discovered metadata (Judgment J18.11).
4. **Stdio details.** The client answers `roots/list` for a core stdio server as for any server
   (§8.2.1) and sets `CLAUDE_PROJECT_DIR` in its environment with the base environment of §18.1.3.

### 18.1.5 Settings, permissions, policy and marketplaces

A core package is a plugin to every part of the client that is not a component: it is installed,
identified, enabled, restricted and removed exactly like a Claude Code plugin (Judgment J18.15).

1. **Identity.** Its id is `<name>@<marketplace>` (§16), or `<name>@inline` when loaded for one
   session by `--plugin-dir` or its equivalents. Every core name is a valid id part (core §5.5 is
   narrower than §15.3.1). That id is the `enabledPlugins` key (§12), the cache and data directory
   names (§3.1, §16) and what `claude plugin list` shows.
2. **Install and updates.** A marketplace entry's source MAY be a core package: the install,
   update, pinning and uninstall of §16 copy the directory as they copy any plugin, and the form is
   decided when the copy loads (§1.3). The core `version` takes the role of the manifest `version`
   in §16 (core §10.2 allows it for update checks). A marketplace entry's component fields
   (`commands`, `agents`, `skills`, `hooks`, `mcpServers`, `lspServers`, `outputStyles`, themes)
   and `strict: false` do not apply to a core package; the client reports each such field in the
   plugin's errors and loads the package as the core says. Its metadata fields (`displayName`,
   `description`, `defaultEnabled`, `category`, `tags` and the rest of §15.4) apply as for any
   entry.
3. **Enablement and policy.** `enabledPlugins`, `defaultEnabled` of the marketplace entry,
   `blockedMarketplaces`, `strictKnownMarketplaces`, managed force-enable, the trust prompts of
   §13.15–§13.20 and every other plugin restriction of §12, §14 and §15 apply by id. A core package
   has no `dependencies`; another plugin MAY depend on it by id (§16.23).
4. **Permissions.** Rules match a core package's components by their Claude Code names:
   `mcp__plugin_<name>_<server>__<tool>`, `mcp__plugin_<name>_<server>` and `__*` for its tools
   (§13), `Skill(<name>:<skill>)` for its skills (§4.7.7). The MCP policy lists of §8.11.5 match a
   core server by `serverName` `plugin:<name>:<server>`, by `serverUrl` its `url`, and by
   `serverCommand` its command and `args` as they will run: a `./` command as its resolved absolute
   path, `args` after core expansion.
5. **Skills.** A core package's skills are discovered by core §7.1 (one level of `skills/`, a skill
   that fails the Agent Skills specification skipped and reported) and then offered as plugin
   skills: command `/<name>:<directory>`, listed, invocable by the model and the user (§4.2, §4.7).
   Only the six Agent Skills fields have an effect; `allowed-tools` acts as §4.9.2 says. The body is
   used as written: the client MUST NOT apply the expansion of §4.8 (no argument placeholders, no
   `${CLAUDE_*}` variables, no injected commands); arguments passed to the skill are appended as
   `ARGUMENTS: <the arguments>`, as §4.8.1 item 3 does for a body that receives none (Judgment
   J18.14).
6. **Presentation.** The plugin manager and `claude plugin list` SHOULD say that a plugin is a core
   package. A validator (§17) that receives a core package validates the core files by the core;
   `claude plugin validate` itself validates only the Claude Code view of a directory (J1.1).

## 18.2 Event and result mapping

The tables below pair each core field with the Claude Code field that carries the same thing on
the same occurrence. The Extended client uses them to build core inputs (§18.1.2); a converter's
hook adapter uses them in both directions (§18.4.4). "—" means no counterpart.

### 18.2.1 Common fields and outputs

| Core | Claude Code | Notes |
| --- | --- | --- |
| `hook_event_name` | `hook_event_name` | The same name. On a `PostToolUseFailure` occurrence the core value is `"PostToolUse"`. |
| `session_id` | `session_id` | The same value. |
| `cwd` | `cwd` | The same absolute path. |
| — | `prompt_id`, `transcript_path`, `scratchpad_dir`, `permission_mode`, `effort`, `agent_id`, `agent_type` | Never given to a core handler. |
| no bytes, or only whitespace | no bytes (exit 0) | Both: no opinion. |
| `{}` | `{}` | Invalid in the core (a failure); valid and without effect in Claude Code. |
| exit status other than 0 | exit 2, other exit codes | Core: a failure, no decision. Claude Code: exit 2 blocks where the event can block (§7.4.1). |
| — | `continue`, `stopReason`, `suppressOutput`, `systemMessage`, `terminalSequence` | No core counterpart. |

### 18.2.2 `SessionStart`

| Core | Claude Code |
| --- | --- |
| (fires on new sessions only) | `source`: the core fires on `startup`, `clear` and `fork` (§18.1.2). |
| — | `model`, `agent_type`, `session_title`, `seconds_since_last_response`, `context_tokens`, `prompt_cache_likely_expired`, `estimated_cache_write_usd` |
| output `additional_context` | `hookSpecificOutput.additionalContext`; also plain stdout on exit 0. |
| — | `initialUserMessage`, `sessionTitle`, `watchPaths`, `reloadSkills` |

### 18.2.3 `UserPromptSubmit`

| Core | Claude Code |
| --- | --- |
| `prompt` | `prompt`: the same string, pasted text expanded and a typed command as typed (§7.5.8). |
| (fires on external submissions only) | `source`: by origin, `system` split by origin (§18.1.2). |
| — | `session_title` |
| output `additional_context` | `hookSpecificOutput.additionalContext`; also plain stdout on exit 0. |
| output `decision: "deny"`, `reason` | top-level `decision: "block"`, `reason`; also exit 2 with stderr as the message. |
| — | `sessionTitle`, `suppressOriginalPrompt` |

### 18.2.4 `PreToolUse`

| Core | Claude Code |
| --- | --- |
| `tool_use_id` | `tool_use_id`: the same value, kept by `PostToolUse` (core §7.3.7). |
| `tool_name` | `tool_name`: the Claude Code name (§7.6.2), an MCP tool's full `mcp__…` name. |
| `tool_input` | `tool_input`, after the Claude Code handlers' winning `updatedInput` (§18.1.2). |
| `tool_profile` | — (§18.2.7 derives it). |
| — | `mcp_server` |
| output `decision: "allow"` | `hookSpecificOutput.permissionDecision: "allow"` without `updatedInput`; deprecated top-level `decision: "approve"`. |
| output `decision: "deny"`, `reason` | `permissionDecision: "deny"`, `permissionDecisionReason`; deprecated `decision: "block"`, `reason`; exit 2 with stderr. |
| — | `permissionDecision` `"ask"` and `"defer"`, `updatedInput`, `additionalContext` |

### 18.2.5 `PostToolUse`

| Core | Claude Code `PostToolUse` | Claude Code `PostToolUseFailure` |
| --- | --- | --- |
| `tool_use_id`, `tool_name`, `tool_input` | the same fields: the call as it ran | the same fields |
| `tool_result` | `tool_response`, the tool's structured output (§7.6.7) | `error`, the failure text Claude receives (§7.5.14) |
| `tool_profile` | derived (§18.2.7), the result before any replacement | derived, the profile's failure form |
| — | `duration_ms`, `mcp_server` | `duration_ms`, `mcp_server`, `is_interrupt` (the core does not fire when it is `true`) |
| output `additional_context` | `hookSpecificOutput.additionalContext` | `hookSpecificOutput.additionalContext` |
| — | `decision: "block"` and `reason`, `updatedToolOutput`, `updatedMCPToolOutput`, `classifierContext` | `decision: "block"` and `reason` |

### 18.2.6 `Stop`

| Core | Claude Code |
| --- | --- |
| `continuation_active` | `stop_hook_active`: the same value, `true` while the client continues because of a stop hook of either side (core §7.3.8 counts a client-specific after-response continuation). |
| — | `last_assistant_message`, `background_tasks`, `session_crons` |
| output `decision: "continue"`, `reason` | top-level `decision: "block"`, `reason`; also exit 2 with stderr as the reason. |
| — | `hookSpecificOutput.additionalContext` (feedback that continues the turn), `continue: false` |

### 18.2.7 Tool profiles

For each Claude Code tool of 2.1.330 (§7.6.2), the profile an Extended client gives core handlers.
A tool not in the table gets no profile, and neither does a call the profile's criteria exclude
(core §7.3.6: the decision is made from the tool's defined operation, never from its name alone).
The tools 2.1.330 adds (`ListPlugins`, `ListSkills`, `SearchPlugins`, `SearchSkills`,
`SuggestPluginInstall`, `SuggestSkills`; `tools-reference.md`) list, search or suggest claude.ai
plugins and skills, an operation no core profile describes, so they get none. Neither release
offers a `MultiEdit` tool; the name survives only in legacy permission rules (§13).

**Facts only the host has.** Four values a profile needs are not in any Claude Code hook input: an
MCP tool's declared name, the server's raw `CallToolResult`, a shell command's exit code (on
`PostToolUse`; `BashOutput` has no exit-code field), and the text Claude received from a `Read`
call. The client supplies each from its own execution of the call; it never reconstructs one from
the Claude Code fields when they do not determine it. A component of the client that sees only the
hook input (a library the host calls) takes them from its host, and when the host does not supply
one that a profile needs and the Claude Code fields do not determine it, that profile MUST be
omitted (core §7.3.6 and §7.3.7 make determining a profile a SHOULD and a profile's content exact,
so omission is conformant and a guessed value is not). The rows below say, per value, when the
Claude Code fields do determine it (Judgment J18.21).

| Claude Code tool | Profile | When |
| --- | --- | --- |
| `Bash`, `PowerShell` | `shell` | Every call: the tool has the shell interpret `command`. |
| `Monitor` | `shell` | A call with `command`; a call with `ws` gets none. |
| `Read` | `file.read` | Every call, whatever the file kind or `pages`. |
| `Edit`, `Write`, `NotebookEdit` | `file.modify` | Every call. |
| `WebFetch` | `web.fetch` | A call whose `url` is an absolute `http` or `https` URL. |
| `WebSearch` | `web.search` | Every call. |
| `mcp__…` (any MCP tool, a core package's included) | `mcp` | Every call sent as `tools/call`. |
| `Glob`, `Grep`, `LSP`, `Agent`, `Skill`, `Workflow`, `Artifact`, `AskUserQuestion`, `ExitPlanMode`, the task, cron, worktree, messaging and MCP-resource tools, and every other tool | none | Searching, delegating, asking and bookkeeping are none of the six operations. |

**`shell`** (`Bash`, `PowerShell`, `Monitor`):

| Core field | Source |
| --- | --- |
| `input.command` | `tool_input.command`, exactly. |
| — | `description`, `timeout`, `run_in_background`, `dangerouslyDisableSandbox`; Monitor's `timeout_ms` |
| `result.output` | The stdout and stderr returned to Claude as one string; `BashOutput` (`stdout`, `stderr`) on success, the text after the `Exit code N` line of `error` on failure. |
| `result.exit_code` | The exit code the client observed. Without it from the host: `N` from the `Exit code N` line of a `PostToolUseFailure` whose command ran and exited; on `PostToolUse`, `0` only when `BashOutput.returnCodeInterpretation` is absent, because a command whose nonzero code the tool reads as no error (`grep` finding nothing) reaches `PostToolUse` with that field set and its code unknown, and then the profile is omitted. |
| (profile omitted) | When no exit code exists: a background command (`run_in_background`, `backgroundTaskId`, a command moved to the background at its timeout), an interrupted command, a shell that could not start, every `Monitor` result. Core §7.3.7 requires the whole profile to be omitted then (Judgment J18.16). |

**`file.read`** (`Read`):

| Core field | Source |
| --- | --- |
| `input.path` | `tool_input.file_path`, already absolute (§7.6.6). |
| — | `offset`, `limit`, `pages`, `allow_large` |
| `result.content` | One entry per block Claude receives: `FileReadOutput` `text` gives `{ type: "text", text }` with the text as Claude receives it, line numbers included: byte for byte the string of that call's `tool_result` block, which a `PostToolBatch` hook receives as its `tool_response` (§7.5.15; `hooks.md`, "PostToolBatch"). The docs fix no format for the line-number prefix, so the text comes from the client's own `Read` output, never from `file.content` renumbered by a guessed format; without it from the host the profile is omitted (Judgment J18.16); `image` gives `{ type: "binary", media_type: file.type, data: file.base64 }`; `pdf` gives `binary` with `media_type` `application/pdf`; `parts` gives one `binary` per page image with that page's `mediaType`; `notebook` gives the text Claude receives for its cells (Judgment J18.16). |
| `result.error` | On `PostToolUseFailure`, the `error` text. |

**`file.modify`** (`Edit`, `Write`, `NotebookEdit`):

| Claude Code call | `input.operations` |
| --- | --- |
| `Edit` | `[{ kind: "edit", path: file_path }]`, `replace_all` either way, and also when `old_string` is empty. |
| `Write` | `[{ kind: "write", path: file_path }]`, whether the file exists or not. |
| `NotebookEdit` | `[{ kind: "edit", path }]` for every `edit_mode` (replacing, inserting or deleting a cell derives the notebook from its contents); `path` is `notebook_path` made absolute against the session's working directory when it is relative (Judgment J18.16). |

`result` is `{}` on `PostToolUse` and `{ error }` with the failure text on `PostToolUseFailure`. File
contents, `old_string`, `new_string` and the structured patch have no counterpart. A Bash command
that writes files has the `shell` profile, never `file.modify` (core §7.3.6).

**`web.fetch`** (`WebFetch`):

| Core field | Source |
| --- | --- |
| `input.url` | `tool_input.url`, as the call names it. |
| — | `prompt`, `offset` |
| `result.status_code` | `WebFetchOutput.code`. |
| `result.content` | `[{ type: "text", text: WebFetchOutput.result }]`: the derived text Claude receives. |
| (profile omitted) | On `PostToolUseFailure`, when the fetch produced no HTTP response. |

**`web.search`** (`WebSearch`):

| Core field | Source |
| --- | --- |
| `input.queries` | `[tool_input.query]`. |
| — | `allowed_domains`, `blocked_domains`, `mode` |
| `result.items` | Every `{ title, url, snippet? }` in the `content` of each object entry of `WebSearchOutput.results`, in order; a string entry is the tool's commentary, not a source, and gives no item (Judgment J18.16). `snippet` only where the tool returned one. |
| `result.error` | On `PostToolUseFailure`, the `error` text. |

**`mcp`** (every `mcp__…` tool):

| Core field | Source |
| --- | --- |
| `input.name` | The tool name the server declared, as sent in `tools/call`: `latest_tag`, not `mcp__plugin_release-guard_notes__latest_tag`. The full name determines it only when the text after `mcp__` holds `__` exactly once: the server segment (§8.5) and the declared name MAY each hold `__`, so with two or more the split is ambiguous and, without the declared name from the host, the profile is omitted. |
| `input.arguments` | `tool_input`, the arguments as sent; `{}` when none are sent. |
| `result` | The `CallToolResult` the server returned, before the client's own truncation, persistence of a large output (§8.10.1) or any hook's replacement. Claude Code's `tool_response` for an MCP tool (`McpOutput`) is a processed form and is not this value. A result with `isError: true` reaches the core `PostToolUse` with this profile (on Claude Code's `PostToolUseFailure`). |
| (profile omitted) | A transport or protocol failure, which has no `CallToolResult` (core §7.3.7); the core event still fires with `tool_result` the failure text. Also every call whose `CallToolResult` the host does not supply: `McpOutput` never determines it. The core `tool_result` is then Claude Code's `tool_response` (or `error`), which core §7.3.7 leaves client-native. |

## 18.3 Writing a dual package

A dual package carries both descriptions so that a core client and Claude Code (and an Extended
client, which reads only the Claude Code half, J1.2) run the same behaviour. The author keeps the
halves equivalent by these rules.

### 18.3.1 The manifest

Write `plugin.json` (core) and `.claude-plugin/plugin.json` (Claude Code) with the same values in
the fields both define, choosing values that load in both:

| Field | Core (core §5) | Claude Code (§2) | Value that loads in both |
| --- | --- | --- | --- |
| `$schema` | Required, the canonical core identifier. | Ignored. | The core identifier in `plugin.json`; omitted in `.claude-plugin/plugin.json`. |
| `name` | 1–64 of `a-z`, `0-9`, `-`, `.`; alphanumeric at both ends; no `--` or `..`. | No whitespace, `@`, `:`, `/`, `\`, control or bidirectional characters; reserved names refused by the validator; kebab-case recommended. | Kebab-case, 1–64 characters, not reserved (§2.3): `release-guard`. A `.` loads in both but draws Claude Code's `not kebab-case` warning (Judgment J18.19). |
| `displayName` | String. | String. | Any. |
| `version` | String, SemVer recommended. | String, pins installs (§2.4). | SemVer, changed on every release. |
| `description` | String. | String; a validator warns when missing. | Present. |
| `author` | Object of optional `name`, `email`, `url` strings; nothing else. | Object, `name` required. | Present with `name`, or absent. |
| `homepage` | String, not validated. | MUST parse as a URL. | An absolute URL. |
| `repository`, `license`, `keywords` | Strings, string array. | The same. | Any. |
| `extensions` | Client-specific data. | Unknown field, warned and stripped. | Only in `plugin.json`. |
| everything else of §2.2 | Unknown field, reported and ignored. | Defined. | Only in `.claude-plugin/plugin.json`. |

Component keys of the Claude Code manifest (`skills`, `hooks`, `mcpServers`, ...) have no core
counterpart, since the core reads only fixed locations (core §6.1). A dual package keeps its
components in the default locations both forms share or pair: `skills/`, `mcp.json` with
`.mcp.json`, `hooks.json` with `hooks/hooks.json`.

### 18.3.2 Skills

`skills/<name>/SKILL.md` is read by both forms. A skill behaves the same in both when:

1. its directory name is its `name`, lowercase letters, digits and hyphens (the Agent Skills rule
   that core §7.1 enforces), and its frontmatter has a `description`;
2. its frontmatter uses only `name`, `description`, `license`, `compatibility`, `metadata` and
   `allowed-tools` (§4.1);
3. its body holds nothing §4.8 expands in Claude Code: no `$ARGUMENTS`, `$0`, `$name`, no
   `${CLAUDE_*}` variable, no injected command. A core client shows such text literally, Claude Code
   replaces or runs it. A literal dollar amount before a digit is written `\$1.00` only if the
   author accepts the backslash in a core client.

A skill that needs Claude Code's fields belongs to a Claude Code plugin, not a dual package.

### 18.3.3 MCP servers

Write each server twice, keyed by the same name. The name becomes the same tool names in Claude
Code and an Extended client (`mcp__plugin_<plugin>_<server>__<tool>`, §18.1.4).

| `mcp.json` (core §7.2) | `.mcp.json` (§8) |
| --- | --- |
| `$schema` and `mcpServers` only | `mcpServers` |
| `"type": "stdio"` | `"type": "stdio"`, or absent |
| `"type": "streamable-http"` | `"type": "http"` |
| `"type": "sse"` | `"type": "sse"` |
| `command`: a bare name, or `./path` against the plugin root | the bare name, or `${CLAUDE_PLUGIN_ROOT}/path` |
| `args`, `env` values with `${PLUGIN_ROOT}`, `${PLUGIN_DATA}` | the same with `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}` |
| `cwd` | no counterpart: leave it out, and make the server independent of its working directory |
| `url`, `headers`: literal | the same literal values, with no `${` in them |

Rules for the pair:

1. Pass every path the server needs as an argument. The core sets `PLUGIN_ROOT` and `PLUGIN_DATA`
   in the server's environment, Claude Code sets `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA`; a
   server that reads one pair from its environment works in one form only.
2. Prefer `node`, `python3` or another interpreter by bare name with the script as the first
   argument over a `./` script: Claude Code cannot spawn a script without an executable file on
   Windows, and the core keeps `command` one token.
3. Keep `ws`, `headersHelper`, `oauth`, `timeout`, `alwaysLoad`, `${VAR}` and `${user_config.*}`
   out of a dual package: the core has none of them.

### 18.3.4 Hooks

The two hook files name the same events, but the handler programs speak different protocols
(§18.2): the input fields, the output shapes and the meaning of an exit status differ. A dual
package therefore points both files at one program and tells it which protocol to speak, by an
argument.

| `hooks.json` (core §7.3) | `hooks/hooks.json` (§7) |
| --- | --- |
| `$schema` and `hooks` only | `hooks` |
| event → array of handlers | event → matcher groups → handlers |
| no filtering: the program checks `tool_profile` | `matcher` (`Bash\|PowerShell`, `Edit\|Write\|NotebookEdit`, `Read`, `WebFetch`, `WebSearch`, `mcp__.*`) |
| `{ "command": "node", "args": ["${PLUGIN_ROOT}/hooks/x.mjs", "--form", "core"] }` | `{ "type": "command", "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/hooks/x.mjs", "--form", "claude-code"] }` |
| working directory: the plugin root | working directory: the session's (§7.3.2.3) |

Rules for the pair:

1. Use exec form on the Claude Code side (`args` present), so that no shell runs on either side.
2. Read paths from the arguments or from the program's own location, never from the working
   directory, which differs.
3. Map the events by §18.1.2. A core `SessionStart` handler is registered on Claude Code's
   `SessionStart` with the matcher `startup|clear|fork`; a core `PostToolUse` handler on both
   `PostToolUse` and `PostToolUseFailure`; the others on the event of the same name.
4. Answer only with results both protocols have (§18.2): context, a deny or block with its reason,
   a Stop continuation. Exit 0 always on the core side; on the Claude Code side a denial is the JSON
   `permissionDecision`, not exit 2, so the reason reads the same in both.

### 18.3.5 A complete example

`release-guard` drafts release notes through a skill and an MCP server, and stops the agent from
running `npm publish`.

```text
release-guard/
├── plugin.json                  core manifest
├── .claude-plugin/plugin.json   Claude Code manifest
├── skills/release-notes/SKILL.md
├── mcp.json                     core MCP
├── .mcp.json                    Claude Code MCP
├── hooks.json                   core hooks
├── hooks/
│   ├── hooks.json               Claude Code hooks
│   └── check-publish.mjs        the handler both use
├── server/notes.mjs             the MCP stdio server (not shown)
└── README.md
```

`plugin.json`:

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.1.0/plugin.schema.json",
  "name": "release-guard",
  "displayName": "Release Guard",
  "version": "1.0.0",
  "description": "Release notes from the changelog, and no publishing by the agent.",
  "author": { "name": "Example Team", "url": "https://example.com" },
  "homepage": "https://example.com/release-guard",
  "license": "MIT",
  "keywords": ["release", "changelog"]
}
```

`.claude-plugin/plugin.json` is the same object without `$schema`.

`skills/release-notes/SKILL.md`:

```markdown
---
name: release-notes
description: Drafts release notes from CHANGELOG.md for the version the user names. Use when asked for release notes or a release summary.
---

Read `CHANGELOG.md` at the repository root. Take the section of the requested version, group its
entries under Added, Changed and Fixed, and write the notes in plain prose. Use the `latest_tag`
tool of this plugin's `notes` server to find the previous release when the user names none.
```

`mcp.json` and `.mcp.json`:

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.1.0/mcp.schema.json",
  "mcpServers": {
    "notes": {
      "type": "stdio",
      "command": "node",
      "args": ["${PLUGIN_ROOT}/server/notes.mjs", "--state", "${PLUGIN_DATA}/notes"]
    }
  }
}
```

```json
{
  "mcpServers": {
    "notes": {
      "type": "stdio",
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/server/notes.mjs", "--state", "${CLAUDE_PLUGIN_DATA}/notes"]
    }
  }
}
```

`hooks.json` and `hooks/hooks.json`:

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.1.0/hooks.schema.json",
  "hooks": {
    "PreToolUse": [
      { "command": "node", "args": ["${PLUGIN_ROOT}/hooks/check-publish.mjs", "--form", "core"] }
    ]
  }
}
```

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|PowerShell",
        "hooks": [
          {
            "type": "command",
            "command": "node",
            "args": ["${CLAUDE_PLUGIN_ROOT}/hooks/check-publish.mjs", "--form", "claude-code"]
          }
        ]
      }
    ]
  }
}
```

`hooks/check-publish.mjs`, one check answered in either protocol. The core side recognises a shell
call by its profile, the Claude Code side by its matcher; both express no opinion with empty
output and exit 0:

```js
// Denies `npm publish`, answering in the form named by --form (core or claude-code).
const form = process.argv[process.argv.indexOf('--form') + 1]
let text = ''
process.stdin.on('data', (chunk) => (text += chunk))
process.stdin.on('end', () => {
  const input = JSON.parse(text)
  const command =
    form === 'core'
      ? input.tool_profile?.name === 'shell' ? input.tool_profile.input.command : undefined
      : input.tool_input?.command
  if (typeof command !== 'string' || !/\bnpm\s+publish\b/.test(command)) return
  const reason = 'Packages are published by the release workflow, not by the agent.'
  const output =
    form === 'core'
      ? { decision: 'deny', reason }
      : {
          hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: reason,
          },
        }
  process.stdout.write(JSON.stringify(output))
})
```

In an Extended client and in Claude Code the plugin offers `/release-guard:release-notes`, the tool
`mcp__plugin_release-guard_notes__latest_tag`, and denies `npm publish --access public` in `Bash`
with the reason above. In a core client it offers the same skill, the server's tools under that
client's names, and the same denial for the client's shell tool.

**Checked.** `claude plugin validate` (Claude Code 2.1.325, and 2.1.330 on 2026-11-23) on this
directory, with a stub `server/notes.mjs` and no `README.md`: `Validation passed`, also with
`--strict`; the root `plugin.json`, `mcp.json` and `hooks.json` draw nothing. 2.1.330 lists what the
plugin provides (the `PreToolUse` hook, the `notes` server, the `release-notes` skill, §17.13.4) and
says the hosts they reach are not declared, which is no finding. The handler, run by hand, prints
the core denial for a core input with a `shell` profile, the Claude Code denial for a Claude Code
`Bash` input, and nothing for `npm test`. Both releases also print plugin directory checks (a
missing `README.md` refused, a missing icon warned), which do not change the verdict and are not
part of the documented contract (Judgment J18.20).

## 18.4 Converting

A converter turns a core package into a Claude Code plugin, or a Claude Code plugin into a core
package. Its output either loads with the same behaviour or says what it lost.

### 18.4.1 Rules for every conversion

1. **Nothing lost silently.** A converter MUST list every field, entry, file and behaviour it could
   not carry over, each with its path, and MUST NOT emit an entry the target form would skip or
   drop at load: a skipped entry looks converted and does nothing.
2. **No renaming.** A converter MUST NOT change the plugin's `name`, a server key or a skill
   directory name to fit the target. The name is the plugin's id, data directory, command prefix and
   tool-name segment (§18.1.4, §18.1.5); renaming breaks the user's settings, permission rules and
   stored data. A name the target refuses stops the conversion.
3. **Valid output.** The output MUST pass the target's validation: `claude plugin validate` with no
   error for a Claude Code plugin; the core schemas (`schemas/1.1.0/`) and core §5–§7 for a core
   package.
4. **Dual by default.** A converter SHOULD write the target files beside the source files, making
   a dual package (§1.3.1) whose halves follow §18.3, and MUST NOT delete the source form unless
   asked.
5. **Deterministic.** The same input gives the same output, so a converted package can be
   regenerated and compared in review.

### 18.4.2 Core package to Claude Code plugin

1. **Manifest.** Copy `name`, `displayName`, `version`, `description`, `author`, `homepage`,
   `repository`, `license` and `keywords` into `.claude-plugin/plugin.json`; drop `$schema`. Report
   `extensions` as not converted. An `author` without `name`, and a `homepage` that does not parse
   as a URL, fail in Claude Code (§2.2): the converter MUST report them and MUST NOT invent a value;
   it MAY leave the field out, reporting that too. A name that §2.3 reserves loads in Claude Code
   but fails its validator: report it.
2. **Skills.** `skills/` is used as it is. The converter MUST report every skill whose body holds
   text §4.8 would expand (argument placeholders, `${CLAUDE_*}` variables, injected commands),
   because Claude Code will expand or run it; it MAY escape argument placeholders with a backslash
   (§4.8.1 item 5).
3. **MCP servers.** Write `.mcp.json` from `mcp.json` by the table of §18.3.3, and to every stdio
   server add `env` entries `"PLUGIN_ROOT": "${CLAUDE_PLUGIN_ROOT}"` and
   `"PLUGIN_DATA": "${CLAUDE_PLUGIN_DATA}"`, so that a server that reads the core variables keeps
   working (Judgment J18.18). Report as not converted: `cwd` (Claude Code has no field, and its
   stdio servers do not start in the plugin root), `extensions`, and any `${` left in `args`, `env`,
   `url` or `headers` after the two placeholders are renamed, which Claude Code would expand as an
   environment variable (§8.4.2) and which has no escape there. An entry the core itself skips is
   not written.
4. **Hooks.** A core handler cannot be converted by rewriting configuration: its program reads core
   inputs and writes core results. The converter MUST either route every handler through a hook
   adapter (§18.4.4) or report every handler as not converted. With an adapter, it writes
   `hooks/hooks.json` with one exec-form `command` hook per core handler, registered as §18.3.4
   item 3 says, without a matcher.

### 18.4.3 Claude Code plugin to core package

1. **Manifest.** The name MUST satisfy core §5.5, or the conversion stops (§18.4.1 item 2). Write
   `plugin.json` with the canonical `$schema` and the nine shared fields of item 1 above; an
   `author` field outside `name`, `email`, `url` cannot be written. Every other manifest field is
   reported.
2. **Skills.** A skill converts when its directory is an immediate child of `skills/`, it conforms
   to the Agent Skills specification, and its frontmatter holds only the six fields of §4.1. A skill
   with Claude Code fields or §4.8 body features is reported; the converter MAY strip the fields,
   reporting each behaviour stripped, and MUST NOT emit a skill a core client would skip. Skills in
   other folders (the manifest's `skills` paths, a root `SKILL.md`) MAY be copied under `skills/`
   when their directory names do not collide.
3. **MCP servers.** Merge `.mcp.json` and the manifest's files and inline maps into one `mcp.json`
   (core §7.2.1 allows only that file), applying the later-name-wins rule of §2.9. Per entry: `stdio`
   and absent `type` give `stdio`, `http` gives `streamable-http`, `sse` stays; a `command` that is
   `${CLAUDE_PLUGIN_ROOT}/path` becomes `./path`, a bare name without whitespace stays, anything else
   is reported; `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}` in `args` and `env` become
   `${PLUGIN_ROOT}` and `${PLUGIN_DATA}`; and `env` gains `"CLAUDE_PLUGIN_ROOT": "${PLUGIN_ROOT}"`
   and `"CLAUDE_PLUGIN_DATA": "${PLUGIN_DATA}"` for a stdio server, so that its program still finds
   the variables it reads (Judgment J18.18; core §9.2 forbids only the names `PLUGIN_ROOT` and
   `PLUGIN_DATA` in `env`). A remote `url` must be HTTPS off loopback, with no user information or
   fragment, and neither `url` nor `headers` may hold a reference, or the entry is reported.
4. **Hooks.** Only `command` hooks on the five shared events can convert, and only through an
   adapter (§18.4.4). A matcher converts when it selects one profile's tools: `Bash|PowerShell`
   (shell), `Read` (file.read), `Edit|Write|NotebookEdit` (file.modify), `WebFetch`, `WebSearch`,
   `mcp__.*` (mcp), or matches everything; the adapter then runs the handler only on calls of that
   profile. Any other matcher, an `if`, `async`, `asyncRewake`, `once`, `onFailure`, and every
   `http`, `mcp_tool`, `prompt` and `agent` hook are reported.

### 18.4.4 Hook adapters

A hook adapter is a program the converter adds to the package, registered as the handler in the
target's hooks file, that runs the source form's handler program and translates between the two
protocols by §18.2. The converter MUST name the runtime the adapter needs (an interpreter on
`PATH`), since neither form guarantees one. An adapter MUST:

1. **Start the source handler as its form expects.** For a core handler under Claude Code: change
   to the plugin root (core working directory), set `PLUGIN_ROOT` and `PLUGIN_DATA`, run `command`
   with `args` after core expansion. For a Claude Code handler under the core: set
   `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA` and `CLAUDE_PROJECT_DIR` (the core input's `cwd`
   standing in for the last), stay in the core working directory, and run the command as §7.3.2
   would, exec or shell form.
2. **Translate the input.** Build the source form's input from the target's by the tables of
   §18.2: a core input under Claude Code gets the common fields, the event's fields and a
   `tool_profile` derived as §18.2.7 says from `tool_name` and `tool_input` (a core `PostToolUse`
   input from a `PostToolUseFailure` gets `tool_result` from `error`). A field the target does not
   supply is left out, never invented: a Claude Code handler under the core gets no
   `transcript_path` or `permission_mode`.
3. **Translate the result.** Map each source result to the target's by §18.2, and a result the
   target cannot express to nothing, reported on stderr. Exit statuses translate by meaning: a core
   handler's nonzero exit, `{}` or other invalid output becomes a Claude Code non-blocking error
   (exit 1, never 2); a Claude Code handler's exit 2 becomes the core result of a block on its event
   (`deny` with stderr as the reason on `UserPromptSubmit` and `PreToolUse`, `continue` on `Stop`,
   `additional_context` on `PostToolUse`), and its plain stdout context on `SessionStart` and
   `UserPromptSubmit` becomes `additional_context`.
4. **Keep the target's rules.** Write exactly one valid result or nothing, exit 0 for a core target;
   never write a result of another event.
5. **Classify `UserPromptSubmit` turns by `source` alone** (a core handler under Claude Code). The
   adapter sees only the Claude Code input, and that input does not tell a `system` turn's origin
   apart (§18.1.2). It runs the core handler when `source` is `user`, `sdk`, `poll_event` or
   `system`, or is absent, and exits 0 with no output, without starting the handler, when `source`
   is `loop_wakeup` or `schedule_wakeup` (Judgment J18.23). The converter MUST list, by §18.4.1
   item 1, that the converted handler also runs on task notifications and automatic continuations.

### 18.4.5 What cannot be converted

| From | Has no counterpart in the other form |
| --- | --- |
| Core | `extensions` and extension directories; a stdio `cwd`; literal `${…}` text in MCP `args`, `env`, `url`, `headers` and hook `args`; the plugin root as a hook's working directory (without an adapter); hook handlers without an adapter. |
| Claude Code | Commands, agents, output styles, themes, LSP servers, monitors, channels, workflows, mods, `bin/`, `settings.json`; the manifest's `userConfig`, `dependencies`, `defaultEnabled`, `settings`, `channels`, `types` and directory listing fields; skill frontmatter beyond the six Agent Skills fields and §4.8 body features; MCP `ws`, `headersHelper`, `oauth`, `timeout`, `alwaysLoad`, bundles, `${VAR}` and `${user_config.*}`; hooks on the other 28 events, non-command hooks, matchers beyond the profiles, `if`, `async`, `once`, `onFailure`; the results `ask`, `defer`, `updatedInput`, `updatedToolOutput`, `continue: false`, `systemMessage`, `sessionTitle` and every other field §18.2 marks "—". |

## Design decisions

### Why `PreToolUse` runs Claude Code's handlers first

The core defines `tool_input` as the input the call would run with, and an `allow` as satisfying
permission for that call. If core handlers ran beside Claude Code's, a Claude Code handler's
`updatedInput` could change the call after a core handler had approved the original, and the
core's approval would cover a command it never saw. Running the core second keeps every core
decision about the call that runs, and leaves Claude Code plugins exactly as fast as in Claude Code
when no core package is enabled.

### Why `PostToolUse` shows core handlers the tool's own result

After the call there is no decision a later rewrite could slip past: the core event only adds
context. A Claude Code replacement is a hook's result, which the core forbids passing to another
handler, and the `mcp` profile is defined as the server's `CallToolResult`, which a replacement need
not be. The two sides can then run together.

### Why a core failure never blocks

The core leaves blocking on failure to the client so that a client with a strict policy may adopt
one. Claude Code's policy is that a failed hook lets the action go ahead unless the hook itself asks
otherwise with `onFailure`, which a core handler cannot write. Blocking on every core failure would
make a core package stricter in an Extended client than its author could ever ask for in Claude
Code's terms.

### Why core packages use Claude Code's names for their tools

Administrators write permission rules and MCP policy against `mcp__plugin_<plugin>_<server>__<tool>`.
Giving a core package's tools the same scheme means a rule written for a plugin keeps working when
the plugin ships as a core package, as a dual package, or is converted, and that a name never
depends on which manifest the client happened to read.

### Why environment variables are not mirrored

Setting `CLAUDE_PLUGIN_ROOT` for core subprocesses would let core packages come to depend on Claude
Code's names and fail in every other core client, which the core forbids them to rely on. Setting
`PLUGIN_ROOT` for Claude Code subprocesses would let Claude Code plugins depend on a variable that
Claude Code never sets. Each form gets its own variables; a converter bridges them explicitly in the
configuration it writes.

### Why a converter does not rename

A plugin's name is its identity in every settings file, data directory, rule and transcript. A
converter that quietly made a name fit would produce a package that installs as a different plugin
and loses the user's data and rules; stopping makes the author choose.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J18.1 | On `PreToolUse` the Claude Code handlers run and combine first, their `updatedInput` applies, and the core handlers then run on the resulting input; they run even after a Claude Code denial (§18.1.2). | Core §7.3.6 defines `tool_input` as what the call would use and the `mcp` profile as emitted after client-side transformation; an `allow` must not authorise a call its handler never saw. Claude Code handlers keep their own timing (§7.2.5). |
| J18.2 | On `PostToolUse` the core sees the tool's result before any Claude Code replacement, and the sides MAY run together (§18.1.2). | Core §7.3.3: no handler gets another's result; core §7.3.7: the `mcp` result is the `CallToolResult`. No decision follows the event, so no rewrite can bypass a core handler. |
| J18.3 | In handler order every Claude Code handler precedes every core handler; core handlers follow package load order (§18.1.2). | §7.5.4 picks messages by handler order and Judgment J7.112 lets an exit-code block win; Claude Code plugins keep the messages they give in Claude Code. Core §7.3.5–§7.3.6 let the client select any reason. |
| J18.4 | A failed core handler never blocks, denies or stops; it is reported as a non-blocking hook error (§18.1.2). | Core §7.3.5–§7.3.6 make blocking on failure a client choice; §7.4.1 makes a failed Claude Code hook non-blocking unless `onFailure` says otherwise, and a core handler has no such field. |
| J18.5 | Core handlers get Claude Code's default `command` hook timeouts (30 s on `UserPromptSubmit`, 600 s otherwise), output caps and context presentation (§18.1.2). | Core §7.3.3 lets the client set limits and §7.3.4–§7.3.7 leave presentation to it; the nearest Claude Code feature is a plugin's command hook (§7.3.8, §7.5.3). |
| J18.6 | Core `SessionStart` fires on Claude Code's `startup`, `clear` and `fork`, not `resume` or `compact` (§18.1.2). | Core §7.3.4: only a new root session with a new `session_id`. `/clear` changes the session id (§3.3, `CLAUDE_CODE_SESSION_ID`), a fork is a new session (§7.5.5), a resume keeps the id; a compaction continues the same session. |
| J18.7 | Core `UserPromptSubmit` fires for external submissions (the user, an SDK or `-p` caller, the poll-event channel, a peer or channel message) and not for client-started turns (scheduled tasks, `/loop` iterations, task notifications, automatic continuations), decided by origin: `source` `system` holds both kinds, so its origin comes from the host, never from a default (§18.1.2). | Core §7.3.5: external submissions qualify "regardless of who authored their content", internally generated work, agent reports and automatic continuations SHOULD NOT. `UserPromptSubmitHookInput.source` (`sdk.d.ts` 0.3.330) lists `system` as "peer/channel messages, task notifications, auto-continuation", and `hooks.md` does not document the field (J7.106). A default either way breaks the core: skipping misses a MUST, firing runs on what it SHOULD NOT. The implementation (`src/hooks/core/input.ts`) skips `system` unless `CoreCallFacts.externalSubmission` says otherwise; it must follow by requiring the host's answer for every `system` turn, not by defaulting to skip. |
| J18.8 | Core `PostToolUse` fires on Claude Code's `PostToolUse` and on `PostToolUseFailure` unless `is_interrupt` is `true` (§18.1.2). | Core §7.3.7 includes results reporting failure (a nonzero exit, `isError: true`, a missing file) and excludes calls without a completed result; Claude Code splits the two cases across two events (§7.5.13, §7.5.14). |
| J18.9 | `Stop` continuation is one mechanism for both sides: `continuation_active` equals `stop_hook_active`, one continuation carries every reason, `continue: false` from a Claude Code handler prevents it, and the cap of §7.5.22 counts it once (§18.1.2). | Core §7.3.8 counts client-specific after-response continuations in `continuation_active`, allows a finite continuation limit and lets a client-specific hook result prevent continuation. Two counters would let the two sides together exceed the cap Claude Code enforces. |
| J18.10 | A core package's servers register as `plugin:<name>:<server>` with tools `mcp__plugin_<name>_<server>__<tool>` and `mcp_server.source` `plugin` (§18.1.4). | Core §7.3.6 leaves tool names to the client; §8.5 and §13 give plugin servers this scheme, and the same name across forms keeps rules and conversions working. |
| J18.11 | A valid core server runs with the defaults of a Claude Code plugin server of the same transport, OAuth discovery included (§18.1.4). | Core §7.2.1 maps the portable format onto the client's native configuration and makes authorization client-managed; the nearest native configuration is a `.mcp.json` entry with no optional field. |
| J18.12 | Core subprocesses get Claude Code's base subprocess environment, session variables and `CLAUDE_PROJECT_DIR` included, but no `CLAUDE_PLUGIN_*`; Claude Code subprocesses never get `PLUGIN_ROOT` or `PLUGIN_DATA` from the client (§18.1.3). | Core §9.1 lets the client choose the base environment and forbids packages from depending on it; plugin-scoped Claude Code variables would invite that dependence, and setting core variables for Claude Code plugins would make them differ from Claude Code. |
| J18.13 | `PLUGIN_ROOT` is the resolved `CLAUDE_PLUGIN_ROOT` of the install; `PLUGIN_DATA` is the `CLAUDE_PLUGIN_DATA` directory of the id (§18.1.3). | Core §9.1 lets the client choose the data directory and requires it per installed instance, kept across updates; reusing §3.1.2's directory means converting a package between forms keeps its data. |
| J18.14 | Core package skills are plugin skills `/<name>:<directory>` whose six Agent Skills fields act as in Claude Code, without §4.8 expansion; arguments are appended (§18.1.5). | Core §7.1 leaves exposure to the client. Expanding placeholders or running injected commands in text written for every client would run code the author never meant to run; appending arguments is how Claude Code treats a body without placeholders. |
| J18.15 | Settings, policy, trust, marketplaces, `disableAllHooks` and managed hook restrictions apply to a core package by its id as to any plugin; a marketplace entry's component fields and `strict: false` do not apply to one and are reported (§18.1.2, §18.1.5). | The core defines no installation or policy; an administrator's controls must hold for every plugin. An entry's components are Claude Code configuration, which a core package by definition does not read (core §5.1, §6.1: fixed locations, nothing configured beside them). |
| J18.16 | Profile details: no `shell` profile on `PostToolUse` without an exit code (background, interrupted, Monitor); `file.read` text is the line-numbered text Claude receives, exactly the call's `tool_result` string, and is never rebuilt from `file.content` (no profile when the host does not give it), PDF and page images are `binary`; `NotebookEdit` is an `edit` with a path made absolute; `WebSearch` string entries give no item (§18.2.7). | Core §7.3.7 requires omission without an exit code and describes content "returned to the agent"; `BashOutput`, `FileReadOutput` and `WebSearchOutput` (0.3.330) give the shapes; §7.6.6 makes only `Write`, `Edit` and `Read` paths absolute. `hooks.md` says `Read` returns "line-number-prefixed text" (PostToolBatch `tool_response`) and `tools-reference.md` "contents with line numbers", neither the prefix's format, so any rebuilt prefix is a guess core §7.3.7 does not allow. The implementation (`src/hooks/core/profile-results.ts`) numbers `file.content` as `cat -n` when `CoreCallFacts.readText` is absent; it must follow by omitting the profile then, as it already does for a notebook. |
| J18.17 | Hook handlers convert only through an adapter that translates inputs, results and exit statuses by §18.2 (§18.4.4). | The two protocols differ in every field and in what exit 2 means (core §7.3.3; §7.4.1); a handler moved by configuration alone would misread its input or answer with output the other form rejects. |
| J18.18 | A converter bridges the environment in configuration: Claude Code stdio servers gain `PLUGIN_ROOT`/`PLUGIN_DATA` in `env`, core stdio servers gain `CLAUDE_PLUGIN_ROOT`/`CLAUDE_PLUGIN_DATA` (§18.4.2, §18.4.3). | Each form sets only its own variables (J18.12); `env` with placeholders is valid in both (§8.4, core §9.2, which forbids only the names `PLUGIN_ROOT` and `PLUGIN_DATA`). |
| J18.19 | A dual package's name is kebab-case; a `.` is allowed but warned (§18.3.1). | Oracle 2.1.325: `claude plugin validate` passes `acme.tools` with `Plugin name "acme.tools" is not kebab-case. Claude Code accepts it, …`; fails `author` without `name` (`author.name: Invalid input: expected string, received undefined`) and `homepage: Invalid URL` for `docs.example.com`; warns `Unknown field 'extensions'`. |
| J18.20 | The worked example was validated on 2.1.325 and on 2.1.330; the plugin directory checks both print are outside the documented contract (§18.3.5). | Installed releases 2.1.325, then 2.1.330 (re-run 2026-11-23 on the files of §18.3.5 rebuilt from this chapter, private config dir). The verdict lines (`Validation passed`, also `--strict`) are what §2.11 defines; the `README_MISSING` and `ICON_MISSING` checks, the README install advice, and 2.1.330's `Provides:`, `Hosts not read for: hooks (1), mcpServers (1), skills (1)` and `Hosts not declared: list what these parts reach under "network.hosts" in plugin.json` lines do not change the verdict (J17.1, J17.36). |
| J18.21 | Four profile values exist only in the host: an MCP tool's declared name, the raw `CallToolResult`, a shell command's exit code on `PostToolUse`, the text Claude received from `Read`. The client supplies them from its own execution; a library takes them from its host and, where the host does not and the Claude Code fields do not determine the value, omits the profile. The fields determine it only in these cases: the declared name when the text after `mcp__` holds `__` once; the exit code from a failure's `Exit code N` line, and `0` on `PostToolUse` without `returnCodeInterpretation` (§18.2.7). | Core §7.3.6 and §7.3.7 make determining a profile a SHOULD and require `name` "identical" to the request, `result` "the completed MCP `CallToolResult`", `exit_code` the code "reported" and omission when it is unavailable. `McpOutput`, `BashOutput` (whose `returnCodeInterpretation` marks "non-error exit codes with special meaning") and `FileReadOutput` (`sdk-tools.d.ts` 0.3.330) do not carry these values; §8.5 lets a server segment and a declared name hold `__`. The implementation (`src/hooks/core/profiles.ts`, `profile-results.ts`) splits at the first `__` after the server and gives `0` on every `PostToolUse` without a host exit code; it must follow by omitting the profile when the split is ambiguous and when `returnCodeInterpretation` is set. Its omissions without `mcpResult` already follow. |
| J18.22 | A failed core handler's notice is `<hook name> hook error: [<command args>]: <cause>`, the line of a Claude Code exec-form `command` hook: a nonzero status gives `Failed with non-blocking status code: <first stderr line>` (`no stderr output`), a launch failure its error, a timeout Claude Code's timeout text for the event; output that is not one object gives `wrote output that is not one JSON object`, a wrong or empty object `wrote an object that is not a <event> result`. Several core reasons are joined by one newline in handler order, empty ones left out, after Claude Code's message where both appear (§18.1.2). | Core §7.3.2 and §7.3.5–§7.3.8 leave presentation and the choice of reasons to the client; §7.4.1.2–§7.4.1.3 give Claude Code's notice and its non-blocking cause, and a core exit 1 is the same event to the user as a Claude Code exit 1. The two invalid-output causes have no Claude Code counterpart (plain stdout is context there) and are this chapter's words; §7.5.4 picks one message and joins none, so the joint is this chapter's. The implementation (`src/hooks/core/output.ts`, `combine.ts`) words a nonzero status `exited with status <n>: <stderr>` and a timeout `timed out after <N>s`, and joins empty reasons too; it must follow this wording and leave empty reasons out. Its label, its invalid-output words and its `Stop` order already follow. |
| J18.23 | A hook adapter running a core `UserPromptSubmit` handler under Claude Code fires it on `source` `system` and on a turn without `source`, and skips only `loop_wakeup` and `schedule_wakeup`; the converter lists the over-firing as not carried over. | The adapter is a Claude Code handler: its only facts are the hook input, and `UserPromptSubmitHookInput.source` (`sdk.d.ts` 0.3.330) puts peer and channel messages, task notifications and automatic continuations under one value `system`, with no other field that separates them (`hooks.md` documents none, J7.106). One way is wrong whatever it picks. Skipping breaks a MUST of core §7.3.5 (external submissions fire "regardless of who authored their content", which is the case a policy handler exists for); firing breaks only a SHOULD NOT (internal work and agent reports). The weaker violation is the safer one, and §18.4.1 item 1 keeps it from being silent. A client with a host that knows the origin follows §18.1.2 instead. |
