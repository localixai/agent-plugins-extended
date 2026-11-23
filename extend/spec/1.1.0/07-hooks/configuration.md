# 7.2 Hook configuration

What a hooks configuration looks like, how a client reads it, and how it decides which handlers an
occurrence of an event runs. Evidence: `hooks.md`, "Configuration", unless a rule names another
section or page. Shapes follow the `hooks` member of the official `Settings` type of
`@anthropic-ai/claude-agent-sdk` 0.3.330 (`sdk.d.ts`).

## 7.2.1 The shape

1. A hooks configuration has three levels: an object whose keys are hook event names (§7.5); for
   each event, an array of **matcher groups**; in each group, an optional `matcher` string and a
   `hooks` array of **handlers** (§7.3). The `hooks` object of a settings file, a skill's or agent's
   frontmatter `hooks`, and the manifest's inline `hooks` (§2.8) are this event map itself; a hooks
   file wraps it in a top-level `"hooks"` key (§7.1.3). <!-- req: hooks.behavior.Configuration -->

   ```json
   {
     "hooks": {
       "PostToolUse": [
         {
           "matcher": "Edit|Write",
           "hooks": [{ "type": "command", "command": "/path/to/lint-check.sh" }]
         }
       ]
     }
   }
   ```

2. Event names are case-sensitive. A key that names no event of §7.5 never fires.
3. A key of a matcher group other than `matcher` and `hooks`, and a key of a handler that its type
   does not define (§7.3), is ignored (Judgment J7.10).

### 7.2.1.1 How a plugin's hooks file loads

A plugin's hooks load entry by entry, so that one broken hook does not take the others with it,
except where the broken entry could be a guard (Judgment J7.11):

| What is wrong | At runtime | A validator reports |
| --- | --- | --- |
| The file is not valid JSON, a leading UTF-8 byte order mark included (Judgment J2.3). | The file's hooks do not load (`Couldn't load hooks from <path>: <reason>` or `Failed to load hooks from <path>: <reason>`, §7.1.3); the plugin's other components still load (Judgment J7.20). | error `Invalid JSON syntax: <parser message>. At runtime this breaks the entire plugin load.` |
| The file has neither `hooks` nor `modules` at its top level. | The file's hooks do not load. | error ``hooks.json must have `hooks` (the hook matchers) or `modules` (hooks modules), or both`` |
| An event key names no event. | That event's entry is dropped; the rest loads. | warning `hooks.<Event>: unknown hook event; entry ignored at runtime` |
| An event's value is not an array of matcher groups. | That event's entry is dropped; the rest loads. | warning `hooks.<Event>: must be an array of matchers; received <kind>; entry ignored at runtime` |
| A matcher group or handler fails its shape (§7.3): a group without a `hooks` array, an unknown `type`, a missing `command`, a wrong-typed field, a value outside its enum, a `timeout` that is not a positive number. | That group or handler is dropped; the rest loads. | warning `hooks.<path>: <problem>; entry ignored at runtime`; for a group without `hooks`, `hooks.<Event>.<n>: Hook matcher "hooks" must be an array of hook entries; received undefined; entry ignored at runtime` |
| The same failure under `PreToolUse` or `PermissionRequest`. | The plugin does not load: a hook that cannot be read may be the guard of the permissions declared beside it. | error `hooks.<path>: <problem> — a PreToolUse/PermissionRequest hook that cannot be loaded may be what guards the permissions declared beside it, so nothing it sits in is applied until the entry is fixed or removed` |
| A `PreToolUse` or `PermissionRequest` key at the top level of the file, outside the `hooks` object, holding anything but `null` or `[]` (a matcher group, a number, an object, a string); or a `hooks` that is a non-empty array. | The plugin does not load, as in the row above. | error `PreToolUse/PermissionRequest is declared at the top level, outside the "hooks" object — a PreToolUse/PermissionRequest hook that cannot be loaded may be what guards the permissions declared beside it, so nothing it sits in is applied until the entry is fixed or removed` |

1. In the messages, `<path>` is the dotted location in the file below the top-level `hooks` key,
   starting with `hooks.` (`hooks.PreToolUse.0`, `hooks.Stop.0.hooks.0`), and `<problem>` names
   what failed (`Unknown hook type "nope"`, `Invalid command hook (command: Invalid input: expected
   string, received undefined)`). The two fixed texts after `<problem>`, `; entry ignored at
   runtime` and the guard tail beginning ` — a PreToolUse/PermissionRequest hook`, are exact, and
   the guard messages name both events in that one spelling, whichever of the two the entry is
   under (Judgment J7.20).
2. The top-level message is for `PreToolUse` and `PermissionRequest` only, and for any value under
   either key except `null` and an empty array: `5`, `{}`, `"x"`, `true`, `[5]` and a matcher group
   all draw it, at path `hooks`, even beside a valid `hooks` object. Another event key at the top
   level (`"Stop": 5`), or either guard key holding `null` or `[]`, draws nothing and registers
   nothing. A `hooks` value that is a non-empty array draws the same message; an empty `hooks`
   array draws `hooks: Invalid input: expected record, received array` instead (Judgment J7.20).
3. A validator reads the hooks file without following symbolic links. When the plugin's `hooks`
   directory is itself a link (a symbolic link or a Windows junction), it reads nothing in it and
   warns `The hooks directory is a link (a symlink or a Windows junction) and was not read — hooks
   are read without following symlinks and are capped at <n> bytes. The plugin loader has neither
   limit and fails the whole plugin on bad hook config, so validate the real file separately.`,
   with `<n>` the validator's size cap, `1048576`. The runtime loader follows the link and reads the
   file as this table says (Judgment J7.20).

The `hooks` object of a settings file is read by §12's rules, not this table.

## 7.2.2 Matchers

1. A group's `matcher` filters which occurrences of the event run its handlers. It is tested
   against one value of the occurrence, which depends on the event (§7.2.2.2). A matcher of `"*"`,
   `""`, or no matcher, matches every occurrence. <!-- req: hooks.guide.Filter hooks with matchers -->
2. An event without matcher support ignores a `matcher` silently, and its handlers run on every
   occurrence. <!-- req: hooks.guide.Filter hooks with matchers -->
3. Matchers are case-sensitive: `bash` does not match the `Bash` tool.
   <!-- req: hooks.guide.Filter hooks with matchers -->

### 7.2.2.1 Matcher patterns

How a matcher is evaluated depends on the characters it holds:

| Matcher | Evaluated as | Example |
| --- | --- | --- |
| `"*"`, `""`, or absent | Every occurrence matches. | — |
| Only letters, digits, `_`, `-`, spaces, `,` and `\|` | An exact string, or a list of exact strings separated by `\|` or `,`, each with optional surrounding whitespace. | `Edit\|Write` and `Edit, Write` each match exactly `Edit` or `Write`; `code-reviewer` matches only that agent type. |
| Any other character | A JavaScript regular expression, tested unanchored with `RegExp.prototype.test`, so a match anywhere in the value succeeds. | `^Notebook` matches every tool whose name starts with `Notebook`; `Edit.*` matches `Edit` and `NotebookEdit`; `^Edit$` matches `Edit` only. |

1. `FileChanged` and `StopFailure` use a narrower exact-match set: letters, digits, `_` and `|`
   only. A hyphen, space or comma in a matcher of those two events sends it to the
   regular-expression path, and only `|` separates alternatives. Every other event with matcher
   support accepts both `|` and `,`.
2. `FileChanged` builds its watch list from the matcher by its own rule (§7.5); the filter applied
   to an occurrence uses the narrow set above (Judgment J7.141, §7.5.28).
3. An empty alternative of an exact list, such as the tail of `Edit|`, names nothing (Judgment
   J7.13). A matcher on the regular-expression path that does not compile matches nothing
   (Judgment J7.14).
4. A matcher other than a match-all one matches nothing when the occurrence has no value to test
   (Judgment J7.15). An occurrence whose value is the empty string is tested like any other: an
   exact list never matches it, a regular expression matches it when the expression matches `""`.

### 7.2.2.2 What each event matches on

| Event | The matcher is tested against | Example values |
| --- | --- | --- |
| `PreToolUse` | the tool name, `tool_name`; a `Bash` matcher also selects Monitor commands (§7.2.2.4) | `Bash`, `Edit\|Write`, `mcp__.*` <!-- req: hooks.matcher.PreToolUse --> |
| `PostToolUse` | the tool name | as `PreToolUse` <!-- req: hooks.matcher.PostToolUse --> |
| `PostToolUseFailure` | the tool name | as `PreToolUse` <!-- req: hooks.matcher.PostToolUseFailure --> |
| `PermissionRequest` | the tool name; a `Bash` matcher also selects Monitor commands | as `PreToolUse` <!-- req: hooks.matcher.PermissionRequest --> |
| `PermissionDenied` | the tool name | as `PreToolUse` <!-- req: hooks.matcher.PermissionDenied --> |
| `SessionStart` | how the session started, `source` | `startup`, `resume`, `clear`, `compact`, `fork` <!-- req: hooks.matcher.SessionStart --> |
| `Setup` | the CLI flag that triggered setup, `trigger` | `init`, `maintenance` <!-- req: hooks.matcher.Setup --> |
| `SessionEnd` | why the session ended, `reason` | `clear`, `resume`, `logout`, `prompt_input_exit`, `other` <!-- req: hooks.matcher.SessionEnd --> |
| `Notification` | the notification type, `notification_type` | `permission_prompt`, `idle_prompt`, `elicitation_dialog`, `plugin_notification`, ... (§7.5) <!-- req: hooks.matcher.Notification --> |
| `SubagentStart` | the agent type, `agent_type` | `general-purpose`, `Explore`, `Plan`, a custom agent name, `^my-plugin:reviewer$` <!-- req: hooks.matcher.SubagentStart --> |
| `SubagentStop` | the agent type | as `SubagentStart` <!-- req: hooks.matcher.SubagentStop --> |
| `PreCompact` | what triggered compaction, `trigger` | `manual`, `auto` <!-- req: hooks.matcher.PreCompact --> |
| `PostCompact` | what triggered compaction | `manual`, `auto` <!-- req: hooks.matcher.PostCompact --> |
| `PreModelSwitch` | the canonical name the client derives from `to_model` (§7.5) | `claude-opus-5`, `claude-opus-4-6\|claude-opus-5`, `.*opus.*` <!-- req: hooks.matcher.PreModelSwitch --> |
| `PostModelSwitch` | the canonical name derived from `to_model` | as `PreModelSwitch` <!-- req: hooks.matcher.PostModelSwitch --> |
| `ConfigChange` | the configuration source, `source` | `user_settings`, `project_settings`, `local_settings`, `policy_settings`, `skills` <!-- req: hooks.matcher.ConfigChange --> |
| `DirectoryAdded` | how the directory was added | `slash_command`, `register_repo_root` <!-- req: hooks.matcher.DirectoryAdded --> |
| `FileChanged` | the basename of the changed file, in the narrow set; the matcher's literal names also build the watch list (§7.5) | `.envrc\|.env` <!-- req: hooks.matcher.FileChanged --> |
| `StopFailure` | the error type, in the narrow set | `rate_limit`, `overloaded`, `server_error`, `cloud_credential_error`, `unknown`, ... (§7.5) <!-- req: hooks.matcher.StopFailure --> |
| `InstructionsLoaded` | the load reason, `load_reason` | `session_start`, `nested_traversal`, `path_glob_match`, `include`, `compact` <!-- req: hooks.matcher.InstructionsLoaded --> |
| `UserPromptExpansion` | the command name, `command_name` | a skill or command name <!-- req: hooks.matcher.UserPromptExpansion --> |
| `Elicitation` | the MCP server name, `mcp_server_name` | a configured server name <!-- req: hooks.matcher.Elicitation --> |
| `ElicitationResult` | the MCP server name | as `Elicitation` <!-- req: hooks.matcher.ElicitationResult --> |
| `CwdChanged` | — no matcher support | <!-- req: hooks.matcher.CwdChanged --> |
| `UserPromptSubmit` | — no matcher support | <!-- req: hooks.matcher.UserPromptSubmit --> |
| `PostToolBatch` | — no matcher support | <!-- req: hooks.matcher.PostToolBatch --> |
| `Stop` | — no matcher support | <!-- req: hooks.matcher.Stop --> |
| `TeammateIdle` | — no matcher support | <!-- req: hooks.matcher.TeammateIdle --> |
| `TaskCreated` | — no matcher support | <!-- req: hooks.matcher.TaskCreated --> |
| `TaskCompleted` | — no matcher support | <!-- req: hooks.matcher.TaskCompleted --> |
| `WorktreeCreate` | — no matcher support | <!-- req: hooks.matcher.WorktreeCreate --> |
| `WorktreeRemove` | — no matcher support | <!-- req: hooks.matcher.WorktreeRemove --> |
| `MessageDisplay` | — no matcher support | <!-- req: hooks.matcher.MessageDisplay --> |

Each event's full set of values, and when a value such as `cloud_credential_error` first appeared,
is §7.5. A matcher that names agent types does not match the empty `agent_type` of an internal
agent's `SubagentStop` (§7.5).

### 7.2.2.3 Matching MCP tools

1. MCP tools appear in the five tool events under the name `mcp__<server>__<tool>` and are matched
   like any other tool name. <!-- req: hooks.behavior.Match MCP tools -->
2. To match every tool of a server, the matcher MUST append `.*` to the prefix: `mcp__memory__.*`,
   or `mcp__brave-search__.*` for a server whose name holds a hyphen. A matcher such as
   `mcp__memory` holds only exact-match characters, so it is an exact string and matches no tool.
   `mcp__.*__write.*` matches a tool whose name starts with `write` on any server.
   <!-- req: hooks.behavior.Match MCP tools -->
3. A tool of a plugin's MCP server has the scoped server segment `plugin_<plugin>_<server>`: the
   `query` tool of server `db` in plugin `my-plugin` is `mcp__plugin_my-plugin_db__query`, and the
   matcher for every tool of that server is `mcp__plugin_my-plugin_db__.*`. A matcher written
   against the bare server key never fires for it; the same scoped tool name goes in an `if` (§8).
   <!-- req: hooks.behavior.Match MCP tools | hooks.components.Environment, quoting, and matching MCP tools.Matching the plugin's own MCP tools -->

### 7.2.2.4 Matching Monitor commands

1. A `PreToolUse` or `PermissionRequest` group with a `Bash` matcher also runs for the shell
   commands Claude starts with the Monitor tool (§7.6; Claude Code 2.1.314 or later). `Bash|PowerShell`, `^Bash$` and `Bash.*` are
   `Bash` matchers too. Such a hook receives the call as a Bash call (`tool_name` `Bash`), and its
   `allow` and `updatedInput` have no effect on the Monitor command: it can deny the command or send
   it to the permission prompt only. In its `if`, it names Bash (`Bash(tail *)`); one whose `if`
   names Monitor does not run. <!-- req: hooks.behavior.Match Monitor commands -->
2. A matcher that includes Monitor — `Bash|Monitor`, `.*`, or none — gives the hook the Monitor
   call's own input, and `allow` and `updatedInput` apply. Its `if` names Monitor (`Monitor(tail
   *)`, matched by the rules `Bash(tail *)` follows, §7.2.3); if its `if` names Bash, the hook still
   gets the Monitor input, but `allow` and `updatedInput` have no effect.
   <!-- req: hooks.behavior.Match Monitor commands -->
3. A `Bash` matcher selects neither a Monitor WebSocket watch (a Monitor call with a `ws` source and
   no `command`, Judgment J7.16) nor, on `PostToolUse`, any Monitor call.
   <!-- req: hooks.behavior.Match Monitor commands -->

## 7.2.3 `if` conditions

1. A handler's `if` holds exactly one permission rule (§13), such as `"Bash(git *)"` or
   `"Edit(*.ts)"`, matched against the tool name and arguments together. The handler runs only when
   the occurrence's tool call matches; otherwise it is not started. There is no `&&`, `||` or list
   syntax: each further condition is another handler with its own `if`.
   <!-- req: hooks.handler.common.if | hooks.guide.Filter by tool name and arguments with the if field -->
2. `if` is evaluated only on the tool events `PreToolUse`, `PostToolUse`, `PostToolUseFailure`,
   `PermissionRequest` and `PermissionDenied`. On any other event, a handler with `if` set MUST
   NOT run. <!-- req: hooks.handler.common.if | hooks.guide.Filter by tool name and arguments with the if field -->
3. In an `if` for a file tool, a single-segment directory pattern such as `"Edit(src/**)"` matches
   the `src` directory of the working directory and the files under it; `"Edit(**/src/**)"` matches
   a `src` directory at any depth. <!-- req: hooks.handler.common.if -->

### 7.2.3.1 How `if` matches Bash commands

Before matching, leading `VAR=value` assignments are stripped. Then each subcommand of the input is
checked, including commands inside `$()` and backticks, and one matching subcommand is enough:

| `if` | Bash command | Runs | Why |
| --- | --- | --- | --- |
| `Bash(git *)` | `FOO=bar git push` | yes | the assignment is stripped; `git push` matches |
| `Bash(git *)` | `npm test && git push` | yes | `git push` matches |
| `Bash(rm *)` | `echo $(rm -rf /)` | yes | the command inside `$()` matches |
| `Bash(rm *)` | `echo $(date)` | no | no subcommand matches |
| `Bash(git push *)` | `echo $(date)` | yes | a pattern that says more than the command name runs the hook anyway on `$()`, backticks or `$VAR` |

When the client cannot split a Bash input into subcommands, it MUST run the handler regardless of
the pattern. The `if` filter is therefore best effort: a hard allow or deny belongs in permission
rules (§13), not in a hook. <!-- req: hooks.behavior.How if patterns match Bash commands | hooks.guide.Filter by tool name and arguments with the if field -->

## 7.2.4 Duplicates

1. A handler defined identically in more than one settings file MUST run once per occurrence. A
   plugin's or a skill's copy of the same handler stays separate and runs on its own.
   <!-- req: hooks.behavior.Hook handler fields -->
2. Two handlers are identical when they are under the same event, with the same matcher text and
   the same handler fields (key order aside); the first in registry order is the one kept, and two
   identical entries of one settings file merge too (Judgment J7.17).

## 7.2.5 Concurrency and order

1. When an event fires, the client MUST run every selected handler in parallel and wait until each
   finishes, fails or times out before merging the results (§7.4.8). One hook's `deny` does not
   stop its siblings, so a side effect of one hook still happens when another blocks.
   <!-- req: hooks.behavior.Hook handler fields | hooks.guide.How hooks work -->
2. When more than 12 of the selected handlers are `prompt` or `agent` hooks, 12 of those run at once
   and the rest start, in registry order, as running ones finish (Judgment J7.18). Each waiting
   handler's `timeout` starts when that handler starts. <!-- req: hooks.behavior.Hook handler fields -->
3. A hook MUST NOT rely on the order its siblings run in. Where several hooks' results must be
   combined in an order, the client uses registry order (Judgment J7.2, §7.1).

## 7.2.6 Disabling hooks

1. A hook in a settings file is removed by deleting its entry. There is no way to disable one hook
   while keeping it in the configuration. <!-- req: hooks.behavior.Disable or remove hooks -->
2. `"disableAllHooks": true` turns off every hook without removing it. The client reads the value
   left after settings precedence (§12): a `false` in a project's `.claude/settings.json` overrides
   a `true` in user settings, and `--settings '{"disableAllHooks": true}'` turns hooks off for one
   run whatever the project and local settings say. <!-- req: hooks.behavior.Disable or remove hooks -->
3. `disableAllHooks` set in user, project, local or flag settings MUST NOT disable hooks that
   managed settings define; only `disableAllHooks` set at the managed level disables those. Below
   the managed level it does disable plugin, skill and agent hooks, except the hooks of plugins
   that managed `enabledPlugins` force-enables and the frontmatter hooks of a skill or agent from
   the managed policy directory or bundled with Claude Code, which stop only under a managed
   `disableAllHooks` (Judgment J7.19).
   <!-- req: hooks.behavior.Disable or remove hooks -->

## Design decisions

### Why a matcher's characters decide how it reads

Most matchers are a tool name or a short list of names, and authors write them without thinking of
regular expressions. Reading a matcher made only of name characters as exact strings makes
`Edit|Write` mean what it looks like and keeps `mcp__memory` from silently matching
`mcp__memory_v2__x`; anything that looks like a pattern is one. The unanchored test is JavaScript's
own, so an author who needs a whole-string match writes `^...$`.

### Why one unreadable guard stops the plugin

Dropping a broken entry and loading the rest keeps a plugin useful when one hook has a typo. A
`PreToolUse` or `PermissionRequest` hook is different: it is often what makes the plugin's other
permissions safe, and loading the plugin without it would grant what the guard was meant to check.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J7.10 | An unknown key of a matcher group or of a handler is ignored, without a warning; so is a field that only another handler type defines (`onFailure` on a `prompt` hook). | The docs list the fields and say nothing of others; the official `Settings` type is closed but Claude Code does not reject. Oracle 2.1.325: `claude plugin validate` passes, with nothing to report, on a group with an extra key, a command handler with an extra key, and a prompt handler with `onFailure`. |
| J7.11 | A plugin's hooks load entry by entry as the table of §7.2.1.1 says; an unreadable entry under `PreToolUse` or `PermissionRequest`, or either event declared outside the `hooks` object, stops the plugin from loading. | `plugins/troubleshooting.md`, "Hooks fail to load", names only the whole-file message. Oracle 2.1.325 (`claude plugin validate`): an unknown event, an unknown type, a missing `command`, a bad `onFailure`, a timeout of `-1`, an event that is not an array each draw a warning ending `entry ignored at runtime`; the same under `PreToolUse` or `PermissionRequest`, or a top-level `PreToolUse` outside `hooks`, draws an error ending `nothing it sits in is applied until the entry is fixed or removed`; invalid JSON and a file without `hooks` or `modules` are errors. Reference: `src/format/hooks-settings.ts` (oracle 2.1.319, so the behaviour predates the target). |
| J7.13 | An empty alternative of an exact list (`Edit\|`, `Edit,,Write`) names nothing; the other alternatives still match. | The docs define the list and not an empty member; an empty name would match an empty value by accident. Reference: `src/rules/hook-matcher.ts`. |
| J7.14 | A regular-expression matcher that does not compile matches nothing; the hooks still load. | The docs are silent. Oracle 2.1.325: `claude plugin validate` passes a `PreToolUse` matcher `Bash(` with nothing to report, so the hook loads; matching nothing is the only reading that does not turn a typo into a match-all. |
| J7.15 | A matcher that is not match-all matches nothing on an occurrence that has no value to test. | The docs test a field of the input; without the field there is nothing to match, and treating it as a match would run a narrowed hook everywhere. Reference: `src/rules/hook-matcher.ts`. |
| J7.16 | A Monitor call is a WebSocket watch when its input has a `ws` source and no `command`. | `hooks.md` says a `Bash` matcher does not run for a WebSocket watch without naming the input that tells it apart; §7.6 gives the Monitor input. Reference: `src/hooks/select/mcp-tools.ts`. |
| J7.17 | "The same handler" is the same event, matcher text and handler fields, key order ignored; the first in registry order is kept; entries of one settings file merge too; only settings-file handlers merge. | `hooks.md`, "Hook handler fields", says a handler defined in several settings files runs once and a plugin's or skill's copy stays separate, and defines neither identity nor which copy survives. Reference: `src/hooks/select/dedupe.ts`. |
| J7.18 | Prompt and agent hooks waiting for one of the 12 slots start in registry order; one still waiting when the event is cancelled never starts and ends `cancelled`. | The docs say the rest start "as running ones finish", not in which order or what a cancelled wait reports. Reference: `src/hooks/handlers/remote/concurrency.ts`, `src/hooks/run-all.ts`. |
| J7.19 | `disableAllHooks` below the managed level turns off plugin, skill and agent hooks as well as settings hooks, except force-enabled plugins' hooks and the frontmatter hooks of a skill or agent from the managed policy directory or bundled with Claude Code, which only a managed `disableAllHooks` stops. | `hooks.md` says it disables "all hooks" and protects only managed ones; settings-reference.md, "`disableAllHooks`", says a file below managed disables "user, project, local, and plugin hooks" while "managed hooks ... and hooks from plugins force-enabled in managed `enabledPlugins` keep running", and that what is built into Claude Code keeps running; a skill the administrator deploys is a managed hook, a bundled one is built in. The SDK `Settings` type says it disables "the hooks defined in settings files and by installed plugins". Reference: `src/hooks/select/gates.ts`, `src/settings/hooks/origin-stops.ts`. |
| J7.20 | The validator's hooks-file messages are the exact texts of the §7.2.1.1 table and its items; an invalid-JSON hooks file loses that file's hooks while the plugin's other components still load, although the validator's message says the plugin load breaks; a top-level `PreToolUse` or `PermissionRequest` holding any value but `null` or `[]`, or a non-empty array `hooks`, is the guard error, and any other top-level key is ignored without a message; a linked `hooks` directory is skipped by the validator only. | Oracle 2.1.321, corpus (`completeness/validator-messages.md`): `Invalid JSON syntax: <parser message>. At runtime this breaks the entire plugin load.` (1 plugin), the `hooks`-or-`modules` error (5), the top-level guard error (6), `Hook matcher "hooks" must be an array of hook entries; received undefined` as warning (2) and with the guard tail as error (2), `unknown hook event` (12), the linked-directory warning (2). Oracle 2.1.325 (`claude plugin validate` in a scratch directory): the same texts, plus `must be an array of matchers; received an object` for a non-array event, `Unknown hook type "<t>"` and `Invalid command hook (<field>: <reason>)` as `<problem>`, and no message for a top-level `Stop` or an empty top-level `PermissionRequest`. Oracle 2.1.326 (scratch plugins beside `"hooks": {}`): a top-level `PreToolUse` of `5`, `{}`, `"x"`, `true`, `[5]` or `[{"hooks":[]}]` draws the guard error at `hooks`, `null` and `[]` draw nothing; `{"PreToolUse":{}}` alone and `{"hooks":[5]}` draw it too, `{"hooks":[]}` draws `Invalid input: expected record, received array`. Runtime, oracle 2.1.325 (`claude -p` with `--plugin-dir`): with an invalid-JSON `hooks/hooks.json` the plugin's command still expands, as `plugins/troubleshooting.md`, "Hooks fail to load", says; with an unreadable `PreToolUse` group, or `PreToolUse` at the top level, the command is not available. The docs give neither the messages nor the validator's link rule. |
