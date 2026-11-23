# 7.6 Tools

The tools a Claude Code client exposes, as far as a plugin sees them: the names a hook matcher, an
`if` condition, a permission rule, a skill's `allowed-tools` and a subagent's `tools` use; the
`tool_input` a `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PostToolUseFailure` or
`PermissionDenied` hook receives (§7.5); the documented parts of `tool_response`; and the tool rules
that change which tools exist, and therefore which hooks fire. Evidence: `tools-reference.md` and
`hooks.md` ("PreToolUse input", "PostToolUse input", "Matcher patterns") of Claude Code 2.1.330,
and `code-mode.md` for §7.6.11, unless a rule names another page. Shapes follow the official types
of the same release: the `BuiltinToolInputs` and `BuiltinToolResults` interfaces that Claude Code
2.1.330 declares for mods
(`claude-code-tools/index.d.ts`), and `sdk-tools.d.ts` of `@anthropic-ai/claude-agent-sdk` 0.3.330
(`AgentInput`, `BashInput`, `FileEditInput`, `FileReadInput`, `FileWriteInput`, `GlobInput`,
`GrepInput`, `WebFetchInput`, `WebSearchInput`, `AskUserQuestionInput`, `ExitPlanModeInput` and their
`*Output` counterparts).

## 7.6.1 What this section governs

1. **In the contract.** Every tool name of §7.6.2 and the rule format it takes (§7.6.4); the
   `tool_input` fields of §7.6.6 and the `tool_response` fields of §7.6.7, which a hook reads and a
   `PreToolUse` hook's `updatedInput` writes back (§7.4); MCP tool naming (§7.6.5); the rules of
   §7.6.3 that add or remove a tool, because a removed tool never reaches a hook; subagent tool
   selection as far as the Agent tool goes (§7.6.8); the Bash and PowerShell rules that touch
   hooks, permissions and skills (§7.6.9); and how tool calls made from Code Mode's code meet rules
   and hooks (§7.6.11).
2. **The host's own implementation.** What a tool does once it runs is the host's: file I/O, how Edit
   matches `old_string`, read windows and image handling, Bash output limits, timeouts, command
   backgrounding and its time limits, the memory cgroup, WebFetch's extraction model call and cache,
   WebSearch's backend and session limit, LSP navigation, Monitor's WebSocket transport, worktree
   creation, the feedback queue and the browser tools. `tools-reference.md` describes them, and a
   client SHOULD behave as it says, but this specification states them only where a plugin can
   observe the outcome through a hook, a rule or a skill (Judgment J7.200).
3. A client that offers a tool under one of the names of §7.6.2 MUST give it that name in every hook
   input, rule match and matcher test, MUST accept the input shape of §7.6.6 for it, and MUST NOT
   offer a different tool under that name. A client MAY leave out any tool the tables mark as
   conditional; a plugin MUST NOT assume a tool exists because it is listed here.

## 7.6.2 Tool names

Tool names are exact, case-sensitive strings. They are the canonical names: the label a tool shows in
the transcript or a permission dialog (such as `Stop Task` for `TaskStop`) is never matched by a
hook matcher or a rule (`permissions.md`, "Match all uses of a tool"). *Prompts* is the
`tools-reference.md` "Permission required" column: whether the tool prompts in Manual mode for paths
inside the working directory. *Rule* is the specifier format of §7.6.4; `bare` means the tool takes
only its bare name.

| Tool | What it does | Prompts | Rule |
| --- | --- | --- | --- |
| `Agent` | Spawns a subagent; with agent teams on, a call that carries `name` can start a teammate (§7.6.8). <!-- req: tools.tool.Agent --> | No | subagent type |
| `Artifact` | Publishes an HTML or Markdown file to claude.ai as a private page; needs a claude.ai subscription and `/login`. <!-- req: tools.tool.Artifact --> | Yes | bare |
| `AskUserQuestion` | Asks one to four multiple-choice questions; open until answered unless `askUserQuestionTimeout` is set (§7.6.10). <!-- req: tools.tool.AskUserQuestion --> | No | bare |
| `Bash` | Runs a shell command, each in its own process (§7.6.9). <!-- req: tools.tool.Bash --> | Yes | command |
| `CronCreate` | Schedules a session-scoped recurring or one-shot prompt. <!-- req: tools.tool.CronCreate --> | No | bare |
| `CronDelete` | Cancels a session-scoped scheduled task by id. <!-- req: tools.tool.CronDelete --> | No | bare |
| `CronList` | Lists the session-scoped scheduled tasks. <!-- req: tools.tool.CronList --> | No | bare |
| `Edit` | Exact string replacement in a file. <!-- req: tools.tool.Edit --> | Yes | edit path |
| `EndConversation` | Ends the session (§7.6.3, item 4). <!-- req: tools.tool.EndConversation --> | No | bare |
| `EnterPlanMode` | Switches to plan mode. <!-- req: tools.tool.EnterPlanMode --> | No | bare |
| `EnterWorktree` | Creates and enters a git worktree, or enters an existing one given `path`. <!-- req: tools.tool.EnterWorktree --> | Some worktrees | bare |
| `ExitPlanMode` | Presents the plan for approval and leaves plan mode (§7.6.10). <!-- req: tools.tool.ExitPlanMode --> | Yes | bare |
| `ExitWorktree` | Leaves a worktree session for the original directory; not given to a subagent that already runs in its own working directory. <!-- req: tools.tool.ExitWorktree --> | Yes (v2.1.327+) to remove a worktree the client cannot check or that holds work at risk, such as unpushed commits or files `git status` lists; otherwise No | bare |
| `Glob` | Finds files by name pattern; absent by default on macOS, Linux and WSL (§7.6.3). <!-- req: tools.tool.Glob --> | No | read path |
| `Grep` | Searches file contents with ripgrep syntax; absent by default where Glob is. <!-- req: tools.tool.Grep --> | No | read path |
| `ListAgents` | Lists the agents `SendMessage` can reach; only where cross-session messaging is on (v2.1.224+). <!-- req: tools.tool.ListAgents --> | No | bare |
| `ListMcpResourcesTool` | Lists connected MCP servers' resources, without MCP Apps UI resources. <!-- req: tools.tool.ListMcpResourcesTool --> | No | bare |
| `ListPlugins` | Lists the plugins enabled for the user's claude.ai account; only in a cloud session or the desktop app, never on third-party providers. <!-- req: tools.tool.ListPlugins --> | No | bare |
| `ListSkills` | Lists the skills enabled for the user's claude.ai account; in the same sessions as `ListPlugins`. <!-- req: tools.tool.ListSkills --> | No | bare |
| `LSP` | Code intelligence from a plugin's language server (§9); inactive until such a plugin is installed, and in cloud sessions. <!-- req: tools.tool.LSP --> | No | read path |
| `Monitor` | Runs a command, or opens a WebSocket (`ws`), in the background and feeds each output line or message back as an event. <!-- req: tools.tool.Monitor --> | Yes | command |
| `NotebookEdit` | Replaces, inserts or deletes one Jupyter cell by `cell_id`. <!-- req: tools.tool.NotebookEdit --> | Yes | edit path |
| `propose_skills` | Shows a card of proposed skills the user reviews and saves to their claude.ai account; in some cloud sessions only. <!-- req: tools.tool.propose_skills --> | No | bare |
| `PowerShell` | Runs a PowerShell command natively (§7.6.9). <!-- req: tools.tool.PowerShell --> | Yes | PowerShell command |
| `PushNotification` | Sends a desktop notification, or a phone push with Remote Control or in a cloud session. <!-- req: tools.tool.PushNotification --> | No | bare |
| `Read` | Reads a file, with line numbers; also images, PDFs and notebooks. <!-- req: tools.tool.Read --> | No | read path |
| `ReadMcpResourceTool` | Reads one MCP resource by URI. <!-- req: tools.tool.ReadMcpResourceTool --> | No | bare |
| `RemoteTrigger` | Manages cloud scheduled tasks on claude.ai; backs `/schedule`. <!-- req: tools.tool.RemoteTrigger --> | No | bare |
| `ReportFindings` | Reports code-review findings as a structured list for the client to render. <!-- req: tools.tool.ReportFindings --> | No | bare |
| `ScheduleWakeup` | Picks when a self-paced `/loop` runs next, or ends it with `stop: true`; its pending wakeup appears in `Stop` input's `session_crons` (§7.5). <!-- req: tools.tool.ScheduleWakeup --> | No | bare |
| `SearchPlugins` | Searches the user's claude.ai plugin catalog; in the same sessions as `ListPlugins`. <!-- req: tools.tool.SearchPlugins --> | No | bare |
| `SearchSkills` | Searches claude.ai skills; in the same sessions as `ListPlugins`. <!-- req: tools.tool.SearchSkills --> | No | bare |
| `SendFeedback` | Drafts a feedback report into a local queue the user reviews; sends nothing by itself (v2.1.238+). <!-- req: tools.tool.SendFeedback --> | No | bare |
| `SendMessage` | Sends a message to a teammate, a resumed subagent or another session; a `summary` over 200 characters is cut with an ellipsis. <!-- req: tools.tool.SendMessage --> | No | bare |
| `SendUserFile` | Sends files to the user's device; with Remote Control or in a cloud session only. <!-- req: tools.tool.SendUserFile --> | No | bare |
| `ShareOnboardingGuide` | Uploads `ONBOARDING.md` and returns a share link; Team and Enterprise only. <!-- req: tools.tool.ShareOnboardingGuide --> | Yes | bare |
| `Skill` | Runs a skill in the main conversation (§4.7); can prompt for a skill that sets `allowed-tools`, `disallowed-tools` or `hooks`. <!-- req: tools.tool.Skill --> | Some skills | skill name |
| `SubagentHandback` | Delivers a subagent's final report (§7.6.7, §7.6.8). <!-- req: tools.tool.SubagentHandback --> | No | bare |
| `SuggestPluginInstall` | Shows a card of suggested plugins the user can add; in the same sessions as `ListPlugins`. <!-- req: tools.tool.SuggestPluginInstall --> | No | bare |
| `SuggestSkills` | Shows a card of claude.ai skills the user can add; in the same sessions as `ListPlugins`. <!-- req: tools.tool.SuggestSkills --> | No | bare |
| `TaskCreate` | Creates a task in the task list (§7.6.3, item 5). <!-- req: tools.tool.TaskCreate --> | No | bare |
| `TaskGet` | Returns one task's details. <!-- req: tools.tool.TaskGet --> | No | bare |
| `TaskList` | Lists the tasks with their status. <!-- req: tools.tool.TaskList --> | No | bare |
| `TaskOutput` | Removed in v2.1.277; a 2.1.330 client MUST NOT offer it. A rule or matcher that names it is accepted and matches nothing. <!-- req: tools.tool.TaskOutput --> | No | bare |
| `TaskStop` | Stops a background task, a teammate or a named background agent by id or name; with no match, the error lists the running background agents. <!-- req: tools.tool.TaskStop --> | No | bare |
| `TaskUpdate` | Updates or deletes a task. <!-- req: tools.tool.TaskUpdate --> | No | bare |
| `TodoWrite` | The session checklist; off by default in favour of the four task tools, back with `CLAUDE_CODE_ENABLE_TASKS=0`. <!-- req: tools.tool.TodoWrite --> | No | bare |
| `ToolSearch` | Searches for and loads deferred tools when tool search is on. <!-- req: tools.tool.ToolSearch --> | No | bare |
| `WaitForMcpServers` | Waits for MCP servers still connecting; only when tool search is off. <!-- req: tools.tool.WaitForMcpServers --> | No | bare |
| `WebFetch` | Fetches a URL and runs a prompt over its content. <!-- req: tools.tool.WebFetch --> | Yes | domain |
| `WebSearch` | Searches the web and returns titles and URLs. <!-- req: tools.tool.WebSearch --> | Yes | bare (§7.6.4) |
| `Workflow` | Runs a dynamic workflow script in the background (§11). <!-- req: tools.tool.Workflow --> | Yes | bare |
| `Write` | Creates or overwrites a file with the full content. <!-- req: tools.tool.Write --> | Yes | edit path |

File tools marked *No* (`Read`, `Grep`, `Glob`) still prompt for paths outside the working directory
and additional directories, apart from files the client itself needs; `Bash` is marked *Yes* but
runs a built-in set of read-only commands without a prompt (§13). The tool that runs Code Mode's
code, `REPL`, is not in the tools reference; §7.6.11 states it.

**Other names.** The 2.1.330 types declare inputs for further tools that the tools reference does
not list (among them `ArtifactComments`, `ArtifactData`, `ReadMcpResourceDirTool`, `Projects`,
`SendUserMessage`, `GetGoal`, `SetGoal`, `PauseGoal`, `OfferChromeSetup`, and per-connector
`enable__mcp__…` tools). A
hook sees their names like any other when a client offers them, but they are not part of this
contract: a client MAY offer them and a plugin MUST NOT rely on them (Judgment J7.201). The advisor
tool is a server tool the API runs; it has no name a rule or matcher can reference.

**Validation.** Neither a client nor a validator rejects a hook matcher, an `if` condition or an
agent's `tools` entry because it names no known tool: such a matcher or condition matches nothing
(Judgment J7.202). Deny and ask rules that match no tool draw the startup warning of §13.

## 7.6.3 Availability rules that change what hooks see

A hook fires only for a tool the session has. These rules add or remove tools; a client MUST apply
them before matching any hook.

1. **Glob and Grep.** On Windows both are in the default set. On macOS, Linux and WSL both are left
   out, and Claude searches with `find` and `grep` through Bash instead: those searches reach hooks
   and permission rules as `Bash` calls, so a hook matching `Glob|Grep` does not see them. They come
   back when the session's `--tools` names them (only the ones named), when `--allowedTools` names
   either (both return; an allow rule in a settings file does not have this effect), when the Agent
   SDK's equivalent `tools` or `allowedTools` option does the same, when a deny
   rule, `--disallowedTools` or `--restricted` removes `Bash` from the session, or for one subagent
   whose `tools` lists them and leaves out `Bash` (§5.7.1), which for an agent run as the main
   session (`--agent`, the `agent` setting) means the whole session (`tools-reference.md`, "Glob tool
   behavior").
2. **PowerShell.** Enabled automatically on Windows without Git Bash, where the Bash tool is not
   registered at all; on Windows with Git Bash on by default for claude.ai and Console accounts and
   behind `CLAUDE_CODE_USE_POWERSHELL_TOOL=1` on Amazon Bedrock, Google Cloud's Agent Platform and
   Microsoft Foundry (`0` turns it off); opt-in on Linux, macOS and WSL, where it also needs `pwsh`
   7 or later on `PATH`. §7.6.9 gives the Bash deny interaction.
3. **Worktree tools.** With `permissions.blockWritesOutsideWorkingDirectories` on, the client
   removes `EnterWorktree` and `ExitWorktree` or refuses calls to them.
4. **EndConversation.** Offered only in an interactive terminal session (not `-p`, the Agent SDK,
   the VS Code extension panel, GitHub Actions or cloud sessions, nor `--bare`), on Claude Opus 4.8,
   Claude Sonnet 5, Claude Fable 5 or later models of those families, and not on Amazon Bedrock,
   Claude Platform on AWS, Google Cloud's Agent Platform, Microsoft Foundry or through a cloud
   gateway. `PreToolUse` hooks MUST NOT run for it, and it never prompts. While any other tool
   remains, deny and ask rules naming it have no effect, a skill's `disallowed-tools` does not remove
   it, and neither `--disallowedTools` nor a `--tools` list that omits it removes it. It goes only
   when nothing else would remain: when the deny rules remove every other tool and also match it
   (as `"*"` does), unless an allow rule names `EndConversation` explicitly; and with `--tools ""`
   when no MCP tools remain either (`cli-reference.md`, `--tools`). Deny rules that remove every
   other tool without matching it leave it in place. Subagents never get it (§5.7.1); a background
   task that shares the main conversation's tool list sees it, and a call to it there ends nothing
   (`tools-reference.md`, "EndConversation tool behavior"). After it ends an interactive session, prompts and most commands answer
   `Claude ended this conversation. Start a new session (or /clear) to continue.`
5. **Task tools.** `TaskCreate`, `TaskGet`, `TaskList` and `TaskUpdate` (or `TodoWrite` instead,
   with `CLAUDE_CODE_ENABLE_TASKS=0`) are offered by default only on Opus 4.7, Sonnet 4.6, Haiku 4.5
   and earlier models; on other models, and on a model id the client does not recognise, only after
   an opt-in: `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`, naming one in `--allowedTools`, or listing them in
   `--tools`. Background and cloud sessions have them on every model. A subagent has them only when
   the session does (`tools-reference.md`, "Task tool availability").
6. **SubagentHandback.** Given, in auto mode only, to a non-fork subagent the Agent tool runs
   locally (v2.1.271+), whatever its `tools` and `disallowedTools` say (§5.7.1, §7.6.8).
7. **Monitor and Bash rules.** A `Bash` or `Bash(*)` deny rule in force at session start removes
   Monitor; added during a session, it refuses the next Monitor call with `Permission to use Monitor
   has been denied: it runs code as Bash does, and a rule denies Bash.` (§13). On Windows, Monitor
   exists only where Git Bash is installed.
8. **WebFetch through the `web-fetch` subagent.** Where the client reads web pages through its
   built-in `web-fetch` subagent (a claude.ai sign-in, v2.1.287+; off under an `Agent(web-fetch)`
   deny rule, through an LLM gateway from v2.1.330, and without feature-flag fetching), Claude
   starts that subagent with an `Agent` call and the subagent calls WebFetch; the main session's
   tool list then lacks `WebFetch`. `WebFetch` permission rules and the `PreToolUse` and
   `PostToolUse` hooks that match `WebFetch` still apply to its fetches, and a `PostToolUse` hook
   receives the page text there, where a WebFetch call Claude makes itself returns an answer to
   Claude's question, so a hook that parses the result handles both. A `PreToolUse` hook that
   blocks `Agent` calls stops the fetch. For this subagent only `SubagentStart` and `SubagentStop`
   hooks from managed settings run (§7.5.18, §7.5.19).
   <!-- docs: tools-reference.md | The web-fetch subagent -->

## 7.6.4 Tool names in rules, matchers and `if`

1. **Where a tool name is written.** The same rule format, `ToolName` or `ToolName(specifier)`, is
   accepted in `permissions.allow` and `permissions.deny` (and `ask`) in settings and the
   `/permissions` interface, in the `--allowedTools` and `--disallowedTools` flags, in the Agent
   SDK's `allowedTools` and `disallowedTools`, in a skill's `allowed-tools` (§4.9.2), and in a hook
   handler's `if` condition (§7.3). A client MUST parse the specifier by the format of the tool it
   names, as in this table; matching each format is §13's. <!-- req: tools.behavior.Configure tools with permission rules and hooks -->

| Example | Applies to | Specifier |
| --- | --- | --- |
| `Bash(npm run *)` | `Bash`, `Monitor` | A command pattern, matched against each subcommand (§13). A `Monitor` rule matches its command by the rules `Bash(...)` follows. <!-- req: tools.behavior.Configure tools with permission rules and hooks.Bash(npm run *) --> |
| `PowerShell(Get-ChildItem *)` | `PowerShell` | A command pattern of the same shape as Bash's; cmdlet aliases are canonicalised and matching is case-insensitive (§13). <!-- req: tools.behavior.Configure tools with permission rules and hooks.PowerShell(Get-ChildItem *) --> |
| `Read(~/secrets/**)` | `Read`, `Grep`, `Glob`, `LSP` | A path pattern (§13). <!-- req: tools.behavior.Configure tools with permission rules and hooks.Read(~/secrets/**) --> |
| `Edit(/src/**)` | `Edit`, `Write`, `NotebookEdit` | A path pattern (§13); `Edit(notebooks/**)` covers NotebookEdit calls there. <!-- req: tools.behavior.Configure tools with permission rules and hooks.Edit(/src/**) --> |
| `Skill(deploy *)` | `Skill` | A skill name pattern (§4.7.7). <!-- req: tools.behavior.Configure tools with permission rules and hooks.Skill(deploy *) --> |
| `Agent(Explore)` | `Agent` | A subagent type; for a plugin agent, its scoped name (§5.7.4). <!-- req: tools.behavior.Configure tools with permission rules and hooks.Agent(Explore) --> |
| `WebFetch(domain:example.com)` | `WebFetch` | `domain:` and a host; `WebFetch(domain:*)` is every domain. <!-- req: tools.behavior.Configure tools with permission rules and hooks.WebFetch(domain:example.com) --> |
| `WebSearch` | `WebSearch` | None: the bare name in `allow` or `deny` is the only form; the tool is allowed or denied as a whole. <!-- req: tools.behavior.Configure tools with permission rules and hooks.WebSearch --> |

2. **Bare-only tools.** Every tool the table does not list, such as `ExitPlanMode` or
   `ShareOnboardingGuide`, accepts only its bare name. What a specifier on such a tool does is §13's
   (Judgment J7.203). <!-- req: tools.behavior.Configure tools with permission rules and hooks -->
3. **Rules that reach across tools.** An `Edit(...)` allow rule also grants read access to the same
   path. A `Read(...)` deny rule also blocks `Edit` and `Write` on the same path, including creating
   a new file there (for `Write` since v2.1.228). <!-- req: tools.behavior.Configure tools with permission rules and hooks.Edit(/src/**) | tools.behavior.Configure tools with permission rules and hooks.Read(~/secrets/**) -->
4. **Matchers take bare names.** A hook `matcher` is tested against `tool_name` and never uses the
   parenthesised rule format: `Edit|Write`, `^Notebook`, `mcp__memory__.*` (§7.2 gives the exact
   and regular-expression paths). `Edit.*` on the regular-expression path matches `NotebookEdit`
   too; `^Edit$` does not. The `if` field is where a specifier narrows a tool-event hook.

## 7.6.5 MCP tools as hooks see them

1. An MCP server's tools appear in every tool event under the name `mcp__<server>__<tool>`, and a
   matcher, `if` condition or rule matches them by that name. A plugin's server's tools carry the
   scoped segment `plugin_<plugin>_<server>`, normalised as §8.5 states:
   `mcp__plugin_my-plugin_db__query`. A matcher written against the bare server key
   (`mcp__db__.*`) never fires for a plugin's tool.
2. To match every tool of a server, a matcher MUST add `.*` (or another regular-expression
   character) after the prefix: `mcp__memory` contains only exact-match characters, is compared as
   an exact string, and matches no tool (§7.2).
3. For an MCP tool the hook input also carries `mcp_server` (v2.1.274+), the SDK's
   `McpServerProvenance`: `name`, the server's configuration key, and `source`, where its definition
   came from: `sdk`, `plugin`, or a configuration scope (`user`, `project`, `local`, `dynamic`,
   `managed`, `enterprise`, `claudeai`, `agent`). The set is open; a hook MUST treat an unknown
   `source` as an unrecognised configured source, never as `sdk`, and SHOULD base a trust decision on
   `source` rather than on `name` or the `mcp__` prefix. Non-MCP tools carry no `mcp_server`.
4. `tool_input` of an MCP tool is the arguments the model sent, shaped by the tool's own input schema
   (§8.10.3); `tool_response` is the tool's result. Neither has a shape this section fixes.

## 7.6.6 `tool_input`

**General rules.**

1. `tool_input` is the argument object of the call, after the client's own normalisation and before
   any hook's `updatedInput` (§7.4). For `Write`, `Edit` and `Read`, `file_path` is always absolute:
   the client MUST expand `~` and relative paths before hooks run, so a path hook cannot be bypassed
   by another spelling of the same path. On Windows the path MUST arrive with backslash separators,
   also for a hook that runs under Git Bash; a hook that compares with forward slashes SHOULD
   normalise separators first. `PostToolUse` and `PostToolUseFailure` receive the same form.
2. The fields below are the documented ones. A tool's input MAY carry further fields its official
   type declares (shown under *Also declared*), and a newer client MAY add fields; a hook MUST ignore
   fields it does not know, and SHOULD echo them back unchanged in `updatedInput` (Judgment J7.204).
3. A field marked optional MAY be absent; a hook MUST NOT read absence as a value other than the
   documented default.

### Bash

| Field | Type | Meaning |
| --- | --- | --- |
| `command` | string | The shell command to run. <!-- req: tools.input.Bash.command --> |
| `description` | string, optional | What the command does. <!-- req: tools.input.Bash.description --> |
| `timeout` | number, optional | Milliseconds. A value above the maximum (§7.6.9) is reduced to the maximum, not rejected. <!-- req: tools.input.Bash.timeout --> |
| `run_in_background` | boolean, optional | Start the command as a background task. <!-- req: tools.input.Bash.run_in_background --> |

Also declared: `dangerouslyDisableSandbox` (boolean).

### PowerShell

The fields match Bash, with the PowerShell command string in `command`. The 2.1.330 type
declarations of a build without the PowerShell tool do not declare it; the docs' table is the shape
(Judgment J7.205).

| Field | Type | Meaning |
| --- | --- | --- |
| `command` | string | The PowerShell command to run. <!-- req: tools.input.PowerShell.command --> |
| `description` | string, optional | What the command does. <!-- req: tools.input.PowerShell.description --> |
| `timeout` | number, optional | Milliseconds; the same timeout rules and variables as Bash. <!-- req: tools.input.PowerShell.timeout --> |
| `run_in_background` | boolean, optional | Start the command as a background task. <!-- req: tools.input.PowerShell.run_in_background --> |

### Write

| Field | Type | Meaning |
| --- | --- | --- |
| `file_path` | string | Absolute path of the file to write. <!-- req: tools.input.Write.file_path --> |
| `content` | string | The whole new content. <!-- req: tools.input.Write.content --> |

### Edit

| Field | Type | Meaning |
| --- | --- | --- |
| `file_path` | string | Absolute path of the file to edit. <!-- req: tools.input.Edit.file_path --> |
| `old_string` | string | Exact text to find. <!-- req: tools.input.Edit.old_string --> |
| `new_string` | string | Replacement text. <!-- req: tools.input.Edit.new_string --> |
| `replace_all` | boolean, optional | Replace every occurrence; default `false`. <!-- req: tools.input.Edit.replace_all --> |

### Read

| Field | Type | Meaning |
| --- | --- | --- |
| `file_path` | string | Absolute path of the file to read. <!-- req: tools.input.Read.file_path --> |
| `offset` | number, optional | Line to start from. <!-- req: tools.input.Read.offset --> |
| `limit` | number, optional | Number of lines to read. <!-- req: tools.input.Read.limit --> |

Also declared: `pages` (string, a PDF page range such as `"1-5"`), `allow_large` (boolean, v2.1.296+).

### Glob

| Field | Type | Meaning |
| --- | --- | --- |
| `pattern` | string | The glob pattern. <!-- req: tools.input.Glob.pattern --> |
| `path` | string, optional | Directory to search; default the current working directory. Not expanded to an absolute path (item 1 names only the three file tools). <!-- req: tools.input.Glob.path --> |

### Grep

| Field | Type | Meaning |
| --- | --- | --- |
| `pattern` | string | A ripgrep regular expression. <!-- req: tools.input.Grep.pattern --> |
| `path` | string, optional | File or directory to search. <!-- req: tools.input.Grep.path --> |
| `glob` | string, optional | Glob that filters the files searched. <!-- req: tools.input.Grep.glob --> |
| `output_mode` | string, optional | `"content"`, `"files_with_matches"` or `"count"`; default `"files_with_matches"`. <!-- req: tools.input.Grep.output_mode --> |
| `-i` | boolean, optional | Case-insensitive search. <!-- req: tools.input.Grep.-i --> |
| `multiline` | boolean, optional | Let a pattern match across lines; default `false`. <!-- req: tools.input.Grep.multiline --> |

Also declared (`GrepInput`): `-A`, `-B`, `-C`, `context`, `head_limit`, `offset` (numbers), `-n`,
`-o` (booleans) and `type` (string, a file type such as `py`).

### WebFetch

| Field | Type | Meaning |
| --- | --- | --- |
| `url` | string | The URL to fetch. <!-- req: tools.input.WebFetch.url --> |
| `prompt` | string | What to extract from the content. <!-- req: tools.input.WebFetch.prompt --> |
| `offset` | number, optional | Characters to skip from the start of the page, set to keep reading a long page (v2.1.290+). <!-- req: tools.input.WebFetch.offset --> |

### WebSearch

| Field | Type | Meaning |
| --- | --- | --- |
| `query` | string | The search query. <!-- req: tools.input.WebSearch.query --> |
| `allowed_domains` | string[], optional | Only results from these domains. <!-- req: tools.input.WebSearch.allowed_domains --> |
| `blocked_domains` | string[], optional | No results from these domains. One call never carries both lists. <!-- req: tools.input.WebSearch.blocked_domains --> |
| `mode` | string, optional | `"standard"` (a lighter search) or `"extended"` (the full search). Some sessions do not send it; a call without it runs the full search (v2.1.282+; Judgment J7.206). <!-- req: tools.input.WebSearch.mode --> |

### Agent

| Field | Type | Meaning |
| --- | --- | --- |
| `prompt` | string | The task for the subagent. <!-- req: tools.input.Agent.prompt --> |
| `description` | string | A short description of the task. <!-- req: tools.input.Agent.description --> |
| `subagent_type` | string, optional in the type | The agent type, such as `Explore` or a plugin agent's scoped name (§5.13). <!-- req: tools.input.Agent.subagent_type --> |
| `model` | string, optional | A model alias that overrides the default: `sonnet`, `opus`, `haiku` or `fable` in `AgentInput` (§5.8). <!-- req: tools.input.Agent.model --> |

Also declared: `effort`, `name`, `run_in_background` (in `AgentInput`), `isolation` (`"worktree"` or
`"remote"`), and the ignored, deprecated `team_name` and `mode`.

### AskUserQuestion

| Field | Type | Meaning |
| --- | --- | --- |
| `questions` | array | One to four questions, each with `question` (string), a short `header`, `options` (each `label`, `description`, optional `preview`; two to four in `AskUserQuestionInput`) and a `multiSelect` flag, which `hooks.md` marks optional and both official types declare required, so a hook MUST accept its absence. <!-- req: tools.input.AskUserQuestion.questions --> |
| `answers` | object, optional | Maps each question's text to the chosen option label; a multi-select answer joins its labels with commas. Claude never sets it; a hook supplies it through `updatedInput` to answer programmatically (§7.6.10). <!-- req: tools.input.AskUserQuestion.answers --> |

Also declared: `annotations` (object) and `metadata` (`{ source? }`).

### ExitPlanMode

Claude writes the plan to a file before calling the tool, so the model's literal input is usually
empty. The client MUST inject the plan and its path before passing the input to hooks.

| Field | Type | Meaning |
| --- | --- | --- |
| `plan` | string | The plan in Markdown, read from the plan file. <!-- req: tools.input.ExitPlanMode.plan --> |
| `planFilePath` | string | Path of the plan file. <!-- req: tools.input.ExitPlanMode.planFilePath --> |
| `allowedPrompts` | array, optional | Deprecated: accepted and ignored (before v2.1.205 it carried prompt-based permissions, each `{ tool: "Bash", prompt }`). A client MUST NOT act on it. <!-- req: tools.input.ExitPlanMode.allowedPrompts --> |

`ExitPlanModeInput` is open (`[k: string]: unknown`), which is where the injected fields live.

### Other tools

Hooks receive these inputs as their 2.1.330 types declare them; the docs give no table, so the names
are evidence and the meanings come from the tools reference.

| Tool | `tool_input` fields |
| --- | --- |
| `SubagentHandback` | `message`: the subagent's report (§7.6.7). `hooks.md` names this field; the 2.1.330 types declare no input for the tool. |
| `Monitor` | `description`, `timeout_ms` (5 minutes default, 30 at most), and exactly one of `command` or `ws` (`{ url, protocols? }`). |
| `NotebookEdit` | `notebook_path`, `cell_id?`, `new_source`, `cell_type?` (`code`, `markdown`), `edit_mode?` (`replace` default, `insert`, `delete`). |
| `Skill` | `skill` (the name), `args?`. |
| `Workflow` | `script?`, `scriptPath?`, `name?`, `description?`, `title?`, `args?`, `resumeFromRunId?` (§11). |
| `TaskCreate` / `TaskUpdate` | `subject`, `description`, `activeForm?`, `metadata?` / `taskId`, the same fields optional, `status?`, `addBlocks?`, `addBlockedBy?`, `owner?`. |
| `TaskGet` / `TaskStop` | `taskId` / `task_id?`, `shell_id?`. |
| `TodoWrite` | `todos`: `{ content, status, activeForm }[]`. |
| `CronCreate` / `CronDelete` | `cron`, `prompt`, `recurring?`, `durable?` / `id`. |
| `ScheduleWakeup` | `delaySeconds?`, `reason?`, `prompt?`, `stop?`, `noop?`. |
| `EnterWorktree` / `ExitWorktree` | `name?`, `path?` / `action` (`keep`, `remove`), `discard_changes?`. |
| `SendMessage` | `to`, `message`, `summary?`, `notify_when_idle?`. |
| `LSP` | `operation` (`goToDefinition`, `findReferences`, `hover`, `documentSymbol`, `workspaceSymbol`, `goToImplementation`, `prepareCallHierarchy`, `incomingCalls`, `outgoingCalls`), `filePath` (absolute or relative), `line`, `character` (both 1-based), `query?` (`workspaceSymbol` only). A `Read(...)` rule (§7.6.4) is matched against `filePath`, resolved against the working directory as a `Read` path is, for every operation (Judgment J7.210). |
| `ListMcpResourcesTool` / `ReadMcpResourceTool` | `server?` / `server`, `uri`. |
| `ToolSearch` / `WaitForMcpServers` | `query`, `max_results` / `servers?`. |
| `ListPlugins` / `ListSkills` | `keywords?` (string[]), a filter. |
| `SearchPlugins` / `SearchSkills` | `keywords` (string[]). |
| `SuggestPluginInstall` / `SuggestSkills` | `contextLabel`, `plugins` (`{ pluginId, pluginName, description, skills? }[]`), `trigger?` (`user_asked`, `proactive`) / `keywords`, `contextLabel?`, `trigger?`. |
| `propose_skills` | `proposals`: `{ name, kind, target?, description, evidence?, edits?, skillMd? }[]`, `kind` being `new` or `improvement`. |
| `CronList`, `TaskList`, `EnterPlanMode`, `EndConversation` | no fields (`EndConversation` never reaches `PreToolUse`). |

## 7.6.7 `tool_response`

`tool_response` is the tool's result as the client records it; its shape depends on the tool and is
the tool's `*Output` type. A hook MUST ignore fields it does not know. The fields below are those the
docs name; for every other built-in tool this section fixes no field (Judgment J7.207).

**Write and Edit.** A Write result carries `filePath` and `type` (`"create"` or `"update"`); an Edit
result `filePath`, `oldString`, `newString` and `replaceAll` (`FileWriteOutput`, `FileEditOutput`).

**Bash: changed files.** When a Bash command changes files in a Git repository, the client MAY record
what changed, and then gives `PostToolUse` hooks the list in `tool_response.bashEditDiff`
(v2.1.269+; `bashEditDiff` in `BuiltinToolResults.Bash`). It records in every permission mode when
the `bashEditDiffEnabled` setting is on; otherwise only in auto and `bypassPermissions` modes, and
only when the client directs Claude to edit files through Bash; `false` turns recording off.
Background and read-only commands carry no diff. Git-ignored files and files in submodules are never
listed. The list is best effort and in public beta: a hook SHOULD use it to find what to review,
never to enforce a policy.

| Field | Type | Meaning |
| --- | --- | --- |
| `changedFiles` | string[] | Absolute paths of the changed files, at most 200; present whenever `files` holds a diff or `moreFiles` is above zero. <!-- req: tools.input.Bash.changedFiles --> |
| `files` | array | Diffs of up to 5 changed files, for display: `filePath`, `hunks`, and `created` or `deleted` `true` for a file added or removed. <!-- req: tools.input.Bash.files --> |
| `moreFiles` | number | Changed files with no diff in `files`. <!-- req: tools.input.Bash.moreFiles --> |
| `unavailable` | boolean | The diff is incomplete or could not be taken. <!-- req: tools.input.Bash.unavailable --> |
| `skipped` | boolean | A Git command that moves the working tree (`git checkout`, `git stash`): no diff taken. <!-- req: tools.input.Bash.skipped --> |
| `shared` | boolean | Another Bash call, such as a subagent's, ran in the same repository at the same time, so some changes may be its. <!-- req: tools.input.Bash.shared --> |

**Agent.** When a foreground Agent call completes, `tool_response` carries the subagent's result and
run telemetry (`AgentOutput`, member `status: "completed"`):

| Field | Type | Meaning |
| --- | --- | --- |
| `status` | string | `"completed"` for a foreground subagent, `"async_launched"` for a background one. <!-- req: tools.input.Agent.status --> |
| `agentId` | string | The subagent run's id. <!-- req: tools.input.Agent.agentId --> |
| `content` | array | The subagent's final text blocks (`{ type: "text", text }`), or, when its report went through `SubagentHandback`, a short note about that hand-back. <!-- req: tools.input.Agent.content --> |
| `resolvedModel` | string | The model the subagent started on, which may differ from `tool_input.model` (for instance under `availableModels`). <!-- req: tools.input.Agent.resolvedModel --> |
| `modelsUsed` | string[] | Models used in order, consecutive repeats collapsed; set only when the model changed mid-run. <!-- req: tools.input.Agent.modelsUsed --> |
| `totalTokens` | number | Input, output and cache tokens of the subagent's **final** API request only, not the run. <!-- req: tools.input.Agent.totalTokens --> |
| `totalDurationMs` | number | Wall-clock duration of the run. <!-- req: tools.input.Agent.totalDurationMs --> |
| `totalToolUseCount` | number | Tool calls the subagent made, not counting `SubagentHandback`. <!-- req: tools.input.Agent.totalToolUseCount --> |
| `usage` | object | Token breakdown of the final request: `input_tokens`, `output_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`. <!-- req: tools.input.Agent.usage --> |

For a background subagent the tool returns when the task moves to the background (at once for a
background launch, at the transition for a foreground task backgrounded mid-run), so the response
carries no usage fields: `status: "async_launched"`, `agentId`, `description`, `prompt`,
`outputFile` and `resolvedModel`, the model in use at the move. For run-wide token totals a plugin
uses the client's usage counters, not these fields.

**SubagentHandback.** A subagent that has the tool (§7.6.3, item 6) delivers its report through it
instead of returning it as text. A hook that needs the report MUST match `PreToolUse` or
`PostToolUse` on `SubagentHandback` and read `tool_input.message`; the parent's Agent result then
holds only the note in `content`.

**ExitPlanMode.** In `PostToolUse`, `tool_response` carries `plan` and `filePath`, the approved plan,
plus internal status flags; a hook SHOULD read `tool_response.plan` rather than the file.

## 7.6.8 The Agent tool and subagent tool selection

1. **What a call starts.** A plain call spawns a subagent in its own context window, which returns
   only its final result to the parent; the parent never sees its intermediate tool calls. The same
   tool can start two other kinds of agent:
   - **Teammate**: with agent teams enabled, a call that carries `name` can launch a teammate, which
     reports back through team messages instead of returning a result. <!-- req: tools.behavior.Agent tool behavior.Teammate -->
   - **Fork**: where fork mode is on, the tool can launch a forked subagent, which inherits the whole
     parent conversation and the main conversation's exact tool pool; `tools` and `disallowedTools`
     do not apply to it (§5.7.1). <!-- req: tools.behavior.Agent tool behavior.Fork -->
2. **Tools of a non-fork subagent.** The client resolves them from the subagent definition (§5.7.2
   states the order):
   - **Neither field set**: every tool available to subagents (§5.7.1). <!-- req: tools.behavior.Agent tool behavior.Neither field set -->
   - **`tools` only**: the listed tools; with persistent `memory` enabled (§5), also Read, Write
     and Edit. <!-- req: tools.behavior.Agent tool behavior.tools only -->
   - **`disallowedTools` only**: every parent tool except the listed ones. <!-- req: tools.behavior.Agent tool behavior.disallowedTools only -->
   - **Both set**: `disallowedTools` wins; a tool in both is removed. <!-- req: tools.behavior.Agent tool behavior.Both set -->

   In every case the result is limited to the tools available to subagents: a tool the filters of
   §5.7.1 remove is never granted, even when `tools` lists it, and `SubagentHandback` is added where
   §7.6.3 item 6 holds, even when `tools` omits it or `disallowedTools` lists it. A `tools` list
   whose every entry matches nothing usually fails the call with the error of §5.7.3 instead of
   launching. `maxTurns` caps the subagent's turns; at the cap its result is marked partial and it
   can be resumed.
3. **Permissions.** Launching a subagent prompts for nothing; each of the subagent's own tool calls
   is checked against the permission rules as it runs, and the subagent's tool events fire hooks as
   §5.12.1 says. Where the prompts appear depends on how it runs (subagents run in the background by
   default, §5.12.3):
   - **Foreground subagents** show the same prompts as the main conversation, when each call
     happens. <!-- req: tools.behavior.Agent tool behavior.Foreground subagents -->
   - **Background subagents** surface their prompts in the main session, naming the subagent that
     asks; `Esc` denies that one call without stopping the subagent. <!-- req: tools.behavior.Agent tool behavior.Background subagents -->

## 7.6.9 Bash and PowerShell

1. **Match both.** A hook that inspects shell commands SHOULD match `Bash|PowerShell`: wherever the
   PowerShell tool is enabled on Windows, Claude treats PowerShell as the primary shell and routes
   commands through it, and on Windows without Git Bash the Bash tool does not exist, so a hook that
   matches only `Bash` never fires there. Its `tool_input.command` holds the command string with the
   same fields as Bash (§7.6.6).
2. **Monitor.** A `PreToolUse` or `PermissionRequest` hook with a `Bash` matcher also runs on the
   commands Monitor starts (v2.1.314+), but its `allow` and `updatedInput` have no effect there; §7.2
   gives the rule.
3. **Timeouts.** Without a `timeout`, a foreground command gets `BASH_DEFAULT_TIMEOUT_MS` (two
   minutes by default); a requested timeout is capped at the larger of that and
   `BASH_MAX_TIMEOUT_MS` (ten minutes by default). PowerShell reads the same two variables. What
   happens at the timeout (moving the command to the background) is the host's (§7.6.1).
4. **Bash deny rules turn PowerShell off.** On Windows with Git Bash installed, any deny rule on
   Bash, a scoped one such as `Bash(git push *)` or a bare `Bash`, from a settings file or
   `--disallowedTools`, MUST also turn the PowerShell tool off for the session, because a `Bash` rule
   does not restrict PowerShell, which has its own rules (§13). It stays on when
   `CLAUDE_CODE_USE_POWERSHELL_TOOL=1` is set in the environment or a settings file's `env`, or when
   a settings file holds a scoped `PowerShell(...)` rule (for example a `PowerShell(git push *)`
   deny). Otherwise a scoped Bash deny leaves Bash available and turns PowerShell off without a
   warning; a rule that removes the whole Bash tool leaves the session with no shell tool.
   <!-- req: tools.behavior.Bash deny rules also turn off the PowerShell tool -->
5. **Shell selection.** Three settings choose PowerShell outside the tool:
   - `"defaultShell": "powershell"` in `settings.json` routes the user's interactive `!` commands
     through PowerShell. It requires the PowerShell tool to be enabled; without it, `!` commands run
     in Bash (Judgment J7.208). <!-- req: tools.behavior.Shell selection in settings, hooks, and skills."defaultShell": "powershell" -->
   - `"shell": "powershell"` on a command hook (§7.3) runs that hook in PowerShell. Hooks spawn
     PowerShell directly, so this MUST work whether or not `CLAUDE_CODE_USE_POWERSHELL_TOOL` is set.
     A hook that runs in PowerShell, by this field or by default on Windows without Git Bash, has
     no `CLAUDE_ENV_FILE` (`hooks.md`, "Persist environment variables"). The field is ignored when
     `args` is set (exec form): such a hook runs no shell, so it is no PowerShell hook and gets
     `CLAUDE_ENV_FILE` on the events that offer it. <!-- req: tools.behavior.Shell selection in settings, hooks, and skills."shell": "powershell" -->
   - `shell: powershell` in a skill's frontmatter runs its `` !`command` `` blocks in PowerShell; it
     requires the PowerShell tool to be enabled (§4.8.4). <!-- req: tools.behavior.Shell selection in settings, hooks, and skills.shell: powershell -->
6. **Shared session behaviour.** PowerShell commands follow Bash's main-session working-directory
   carry-over and reset (including `CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR`), and receive the
   variables hooks persist through `CLAUDE_ENV_FILE` under the conditions of §3.5.2 (v2.1.296+).
   PowerShell profiles are not loaded. Exit code 1 from a search or `git diff` can count as a normal
   result in the tool, and counts as a failure in a skill with `shell: powershell` (§4.8.5).

## 7.6.10 Tools that need the user

`AskUserQuestion` and `ExitPlanMode` wait on the user. When a `-p` run offers them, and how a
`PreToolUse` hook answers in the user's place (`allow` with the answer in `updatedInput`; for
`AskUserQuestion`, `answers` beside the echoed `questions` of §7.6.6), is §7.4.10.3; an MCP tool
marked `_meta["anthropic/requiresUserInteraction"]` keeps its prompt whatever a hook returns
(§8.10.2). `askUserQuestionTimeout` (`60s`, `5m`, `10m`) lets an unanswered question close on its
own and submit what was selected; it never starts in a background session, in screen reader mode,
or under Remote Control, and permission prompts, plan approval included, never resolve on idle.

## 7.6.11 Code Mode: tool calls from code

Code Mode is an experimental, off-by-default way of working (`CLAUDE_CODE_EXPERIMENTAL_CODE_MODE=1`,
Claude Code 2.1.323 or later) in which Claude writes a piece of JavaScript that makes several tool
calls, and the client runs it as one call of the tool `REPL`. A client MAY offer Code Mode; one
that does MUST follow this section, because the hooks and rules a plugin ships meet the calls the
code makes (Judgment J7.214). Evidence: `code-mode.md`.

### 7.6.11.1 What Code Mode limits

A client that offers Code Mode states these limits to the user before turning it on. Auto mode
and Hooks bind a plugin's rules and hooks; the others are the limits of Claude Code's own session
(its resume, how long code runs, its features and where the session moves), which a client sets
for its own:

- **Resuming**: a Code Mode session resumes only in the terminal with Code Mode on; with it off the
  client refuses the resume. A session started without Code Mode resumes without it. <!-- docs: code-mode.md | Code Mode limitations -->
- **Auto mode**: the auto mode classifier reviews the code, not each tool call (§7.6.11.2). <!-- req: hooks.code-mode.Code Mode limitations.Auto mode -->
- **Long-running code**: the client waits for the code to finish and stops it after ten minutes,
  unless the code can run in the background, where it runs for up to two hours. Background code
  needs a session started in `auto` or `bypassPermissions` mode. In Manual and `acceptEdits` modes,
  time at a permission prompt does not count toward the ten minutes (v2.1.328+). <!-- docs: code-mode.md | Code Mode limitations -->
- **Hooks**: a tool call is refused when a `PreToolUse` hook does not finish, for example after a
  timeout (§7.6.11.4). <!-- req: hooks.code-mode.Code Mode limitations.Hooks -->
- **Unavailable features**: Remote Control, Claude in Chrome and computer use are not available. <!-- docs: code-mode.md | Code Mode limitations -->
- **Moving the session**: the session cannot move to the desktop app or become a background
  session, and `/fork` cannot start a background copy of it. <!-- docs: code-mode.md | Code Mode limitations -->

### 7.6.11.2 Permission checks and `PreToolUse`

1. Each tool call the code makes MUST go through the `deny` and `ask` permission rules (§13) and
   the `PreToolUse` hooks under the tool's usual name, such as `Bash` or `mcp__<server>__<tool>`,
   as if Claude had called it directly. In auto mode the classifier reviews each piece of code
   before it runs, not each call, and does not see values the code computes at run time (a path
   taken from search output), so a rule or a hook is what controls such a call. In the other modes
   the user is prompted for each call that would prompt in that mode. In `auto` and
   `bypassPermissions` modes code can run from start to finish without a prompt, except for the
   actions no mode auto-approves (§13.10). <!-- req: hooks.code-mode.Permission checks -->
2. A shell command from code can reach a hook in a compound form: a `git push` in a folder `app`
   arrives as `cd 'app' && git push`. A hook that allows or blocks shell commands SHOULD check each
   part of a command, as Bash rules do (§13.4.2). <!-- req: hooks.code-mode.Permission checks -->
3. **The code itself.** A `PreToolUse` hook that matches `REPL` receives the JavaScript in
   `tool_input.code`, and can deny or allow the whole piece of code as for any tool call.
   <!-- req: hooks.code-mode.Permission checks -->
4. **An `ask` rule for a command**, such as `Bash(git push *)`, MUST prompt for the forms of that
   command the rule matches, also in `auto` and `bypassPermissions` mode. <!-- req: hooks.code-mode.Require approval for a command -->
5. **An `ask` rule for `REPL`** MUST prompt before each piece of code starts; the prompt does not
   show the code, which the user reads in the transcript viewer (a subagent's code is not shown
   there from the main conversation). Approved in auto mode, the code starts even where the
   classifier would have blocked it, and its project edits and read-only commands run without a
   prompt. Under this rule the code can fail to start a subagent. <!-- req: hooks.code-mode.Approve each piece of code first -->
6. Answering **No** (or `Esc`) at a prompt for one of the code's calls stops the code, and the
   changes of calls that already finished stay; **No** with a comment refuses that one call and the
   code can continue with its others. <!-- docs: code-mode.md | Answer a permission prompt while code runs -->

### 7.6.11.3 Checking code output with `PostToolUse`

1. A `PostToolUse` hook that matches `REPL` runs on what the code returns before Claude reads it,
   also when background code finishes and when the code throws. Its `tool_response` carries `code`
   (the JavaScript), `result`, `stdout`, `stderr` and `toolsUsed` (the tool names the code called),
   and may carry `error` (only when the code failed or was stopped), `images`, `documents` and
   `refusedCalls`. <!-- req: hooks.code-mode.Read code output in the hook -->
2. **Redaction.** The hook redacts by returning a changed copy of `tool_response` as
   `updatedToolOutput` (§7.4.5). The client MUST accept the copy only in this shape, and give Claude
   the original output otherwise:
   - **Change the text** in `result`, `stdout`, `stderr` and `error`; `result` can be missing or
     `null`. <!-- req: hooks.code-mode.Redact code output.Change the text -->
   - **Keep the shape**: `code`, `stdout` and `stderr` strings, `error` a string or absent.
     <!-- req: hooks.code-mode.Redact code output.Keep the shape -->
   - **Remove images and PDFs** by setting `images` or `documents` to `[]`.
     <!-- req: hooks.code-mode.Redact code output.Remove images and PDFs -->

   `refusedCalls` can repeat a refused call's input, such as a Bash command, and Claude reads it
   unchanged, so this hook cannot hide a value there.
3. **Redaction with a block or an error.** A hook that blocks with `decision: "block"` and wants the
   output hidden MUST print the redacted copy in the same JSON; without it Claude reads the original
   output. When the hook crashes, times out or prints invalid JSON, Claude gets the original output,
   so a redacting hook SHOULD catch its own errors and print a copy with placeholder text.
   <!-- req: hooks.code-mode.Redact when your hook blocks or hits an error -->
4. **Not `UserPromptSubmit`.** From 2.1.328 the client MUST NOT run `UserPromptSubmit` hooks on code
   output, managed ones included; a check of code output belongs in this `PostToolUse` hook.
   <!-- req: hooks.code-mode.Move a check from a UserPromptSubmit hook -->
5. **Code output withheld.** Before 2.1.328, background code output reached `UserPromptSubmit`
   hooks as a prompt (input `source` `poll_event`), for `command`, `http` and `mcp_tool` hooks; a
   hook that blocked it withheld the output, Claude's reply showed `UserPromptSubmit operation
   blocked by hook`, and the block's `reason` reached Claude's context. A client at 2.1.328 or later
   MUST NOT withhold code output for a `UserPromptSubmit` hook's block, since no such hook runs on
   it (item 4). A hook written for the earlier releases lets a prompt whose `source` is
   `poll_event` through, so the client MUST pass `source` in the input where it sends one (§7.5.8).
   <!-- req: hooks.code-mode.Code output withheld by a hook -->

### 7.6.11.4 Tool calls refused by a hook

When a `PreToolUse` hook gives no decision on a call from code, the client refuses the call with an
error Claude can report:

- `the hook did not finish`: the hook timed out, or an agent hook ended without a decision. With
  `onFailure` unset this refuses the call; the error can also follow on other tool calls once Claude
  has run code in the session (Judgment J7.213).
- `the hook failed`: the hook could not start, was killed, exited 126, 127 or above 128, or returned
  an HTTP error or invalid output. Before 2.1.329 this refused a call from code; from 2.1.329 a call
  from code runs by default after such a failure, and the error is rare (one cause is feature-flag
  fetching turning off during the session).

A `command` or `http` hook chooses with `onFailure` (§7.4.3): `"block"` stops the call after a
timeout or a failure, as a guard hook SHOULD; `"continue"` lets it run.
<!-- req: hooks.code-mode.Tool call refused by a hook -->

## Design decisions

### Why the tools' behaviour stays the host's

A plugin observes a tool through three surfaces only: its name, its input and its result as hooks
receive them, and the rules that decide whether it may run. Those are fixed here so that every hook
and rule a plugin ships means the same thing on any conformant client. How a tool reads a PDF or
sizes its output window is product behaviour that changes between releases without changing any
plugin's contract; binding it would make a client's conformance depend on features a plugin cannot
see.

### Why availability rules are normative

A tool that does not exist fires no hook. The rules that remove Glob and Grep, PowerShell or
EndConversation decide whether a plugin's `Read|Grep` guard or a `Bash` policy hook ever runs, so a
client that kept PowerShell on under a Bash deny would let a plugin's protection be bypassed.

### Why `bashEditDiff` is permitted, not required

Claude Code calls the list best effort and in public beta, and records it only in some modes. Making
it a MUST would require an exact diff no hook may rely on; making it a MAY with a fixed shape lets a
review hook use it wherever a client provides it.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J7.200 | A tool's runtime behaviour (I/O, limits, backgrounding, memory cap, Edit matching, WebFetch processing, search backends, LSP, worktrees, feedback) is the host's: a client SHOULD follow `tools-reference.md`, and this specification states it only where a hook, rule or skill observes it (§7.6.1). | The reference implementation's `spec/scope-audit.md` keeps "tool names and input shapes, agent tool selection, permission-rule integration, Bash/PowerShell deny interaction and hook/skill shell selection" and calls native tool I/O, backgrounding, memory limits and file editing host work. |
| J7.201 | Tools declared in the 2.1.330 types but absent from the tools table (`ArtifactComments`, `ArtifactData`, `ReadMcpResourceDirTool`, `Projects`, `SendUserMessage`, `GetGoal`, `SetGoal`, `enable__mcp__…`, and others) are outside the contract: a client MAY offer them, a plugin MUST NOT rely on them (§7.6.2). | `BuiltinToolInputs` declares them; `tools-reference.md` says nothing of them. The reference implementation lists such names as `SDK_ONLY_TOOLS` and "claims nothing about their behaviour". |
| J7.202 | A hook matcher, an `if` condition or an agent `tools` entry that names no known tool is not an error and matches nothing (§7.6.2). | The docs give no validation for these. Oracle 2.1.325: `claude plugin validate` passes a plugin whose hook matcher is `Bashh\|TaskOutput\|EndConversation`, whose `if` is `WebSearch(foo)`, and whose agent lists `tools: Globb, TaskOutput, Read`, with no tool-name warning. |
| J7.203 | What a specifier on a bare-only tool does is left to §13; this section only says the tool "accepts only the bare tool name" (§7.6.4). | `tools-reference.md` says unlisted tools accept the bare name, not what happens otherwise. The reference implementation treats such a rule as failing closed (an allow matches nothing, a deny or ask matches every call). |
| J7.204 | A hook ignores `tool_input` and `tool_response` fields it does not know and echoes them back in `updatedInput`; the fields under *Also declared* are part of the input a hook can receive (§7.6.6). | `hooks.md` tables name fewer fields than the official types (`GrepInput` has `-A`, `head_limit`, `type`…; `FileReadInput` has `pages`, `allow_large`; `BashInput` has `dangerouslyDisableSandbox`). Echoing keeps an `updatedInput` from silently dropping a field the tool needs. |
| J7.205 | PowerShell's input is the docs' four-field table; the 2.1.330 mod declarations (as the 2.1.321 ones), generated on a build without the tool, do not declare it (§7.6.6). | `BuiltinToolInputs` has no `PowerShell` entry and `sdk-tools.d.ts` has no `PowerShellInput`; `hooks.md` says "the fields match the Bash tool". |
| J7.206 | `WebSearch.mode` is optional and a hook MUST NOT require it (§7.6.6). | `hooks.md` documents `mode` (v2.1.282+) and says some sessions do not send it; the `WebSearchInput` of SDK 0.3.330 and `BuiltinToolInputs.WebSearch` of 2.1.330 do not declare it. |
| J7.207 | Beyond the fields named in §7.6.7, this specification fixes no `tool_response` field of a built-in tool; the `*Output` types are the reference shape (§7.6.7). | `hooks.md` says "the exact schema for both depends on the tool" and documents only Write's example, Agent, `bashEditDiff`, ExitPlanMode and SubagentHandback. The Agent table omits `agentType`, `toolStats`, `worktreePath` and the `remote_launched` member that `AgentOutput` declares; they may appear and are not contract. |
| J7.208 | `"defaultShell": "powershell"` while the PowerShell tool is off leaves interactive `!` commands in Bash; any other `defaultShell` value does the same (§7.6.9). | `tools-reference.md` says the setting "requires the PowerShell tool to be enabled" without saying what happens otherwise. Lead: the reference implementation's `interactiveShell`. |
| J7.209 | A multi-select `answers` value joins the chosen labels with `,` and no space (§7.6.6). | `hooks.md` says "join labels with commas" with no example of two; the reference implementation's `answerQuestions` joins with `,`. A reader SHOULD accept either `,` or `, ` between labels. |
| J7.210 | A `Read(...)` permission rule is matched against an LSP call's `filePath`, a relative one resolved against the session's working directory, for every operation, `workspaceSymbol` included; what the language server answers about other files is not matched (§7.6.6). | `tools-reference.md` and `permissions.md` list `LSP` among the tools a `Read(~/secrets/**)` rule applies to and name no field; `filePath` is the only path the 2.1.330 `LSP` input declares ("The absolute or relative path to the file", `claude-types/claude-code-tools`). Filtering a server's answer is the tool's runtime behaviour, which §7.6.1 leaves to the host (J7.200). |
| J7.213 | In a Code Mode session, a `PreToolUse` `command` or `http` hook with `onFailure` unset that times out refuses the call from code (`the hook did not finish`); with `onFailure` set, the field decides, `"continue"` letting the call run after the timeout too. An agent hook, which has no `onFailure`, refuses when it ends without a decision (§7.6.11.4, §7.4.2). | `code-mode.md` (2.1.330), "Tool call refused by a hook", says the timeout error refuses the call and that from 2.1.329 a call runs by default after "a hook failure other than `the hook did not finish`", then that `onFailure` `"continue"` lets the call run "after a timeout or failure"; read together, the timeout refusal is the unset default. `hooks.md`, "Timeouts", points Code Mode users there. Not observed: Code Mode needs an interactive session on a supported account. |
| J7.214 | Offering Code Mode is optional (MAY); a client that offers it follows §7.6.11, and a plugin MUST NOT assume a `REPL` tool exists. | `code-mode.md` calls Code Mode experimental, off by default, and liable to change or be removed in any release; the 2.1.330 types declare no `REPL` input. What a plugin can observe of it is the `REPL` tool and the rules and hooks its inner calls meet. |
