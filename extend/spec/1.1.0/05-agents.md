# 5. Agents

An agent (a *subagent* in Claude Code's words) is a separate assistant with its own system prompt,
tools, model and context window, to which the main conversation delegates a task and from which it
gets one result back. A plugin supplies agents as Markdown files; so do the user, the project,
managed settings and the `--agents` flag. This chapter defines how an Extended client finds them,
reads them, ranks them against each other, and runs them as Claude Code 2.1.321 does. Evidence:
`sub-agents.md` unless a section names another page; the shapes follow the official
`AgentDefinition`, `AgentMcpServerSpec`, `PermissionMode` (`sdk.d.ts`) and `AgentInput`
(`sdk-tools.d.ts`) of `@anthropic-ai/claude-agent-sdk` 0.3.321.

## 5.1 Terminology

| Term | Meaning |
| --- | --- |
| Agent file | A Markdown file with YAML frontmatter that defines one agent (§5.3). |
| Agent definition | What a client holds for one agent after reading it: the fields of `AgentDefinition` (`description`, `prompt`, `tools`, …) plus `color`, `isolation`, `hooks` and `experimental.cacheTtl`, which `AgentDefinition` has no place for. |
| Agent type | The identifier the Agent tool's `subagent_type` names, hooks receive as `agent_type`, and permission rules match: the frontmatter `name` for every source but a plugin, the scoped name for a plugin agent (§5.2). |
| Scoped name | A plugin agent's identifier, `<plugin>:<subfolder>:…:<name>` (§5.2). |
| Main conversation | The session's own thread. When an agent runs *as the main session* (`--agent`, the `agent` setting), the main thread takes on that agent's definition (§5.13). |
| Fork | A subagent that inherits the whole conversation instead of starting from a definition. |
| Spawn depth | How many subagent layers lie between a subagent and the main conversation; a subagent the main conversation spawns is at depth 1. |

## 5.2 Agents in a plugin

1. **Default location.** A client MUST read every `.md` file under the plugin's `agents/` directory,
   recursively, as one agent each. Only `.md` files are agents; other files in the tree are not
   read. <!-- req: agents.behavior.Choose the subagent scope.agents/ -->
2. **Manifest paths.** When `.claude-plugin/plugin.json` sets `agents`, the client reads exactly the
   `.md` files it lists and does not scan `agents/` (§2.5, §2.6).
3. **Scoped name.** A plugin agent is registered under the plugin's name, each subfolder name
   between `agents/` and the file, and the agent's own name, joined with `:`. The agent's own name
   is the frontmatter `name` when it is usable (§5.4.2), else the file name without `.md`. The
   frontmatter `name` replaces only the file-name part; it never removes the subfolder parts. A
   file that the manifest's `agents` key lists carries no subfolder parts, wherever it lies.
   (`plugins/components.md`, "Agents" and "Organize agents in subfolders".)

   | File | Frontmatter `name` | Registered as (plugin `my-plugin`) |
   | --- | --- | --- |
   | `agents/security-reviewer.md` | `security-reviewer` | `my-plugin:security-reviewer` |
   | `agents/security-reviewer.md` | absent | `my-plugin:security-reviewer` |
   | `agents/review/security.md` | absent | `my-plugin:review:security` |
   | `agents/review/security.md` | `audit` | `my-plugin:review:audit` |
   | `./custom/review/security.md`, listed in the manifest's `agents` | absent | `my-plugin:security` |

   <!-- req: agents.components.Organize agents in subfolders -->
4. **Subfolders elsewhere are not part of the name.** For the user, project and managed directories
   the scan is recursive too, but a subfolder does not change the agent's identity: only the
   frontmatter `name` does (§5.5). <!-- req: agents.behavior.Choose the subagent scope -->
5. **Plugin variables.** `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}` and `${CLAUDE_PROJECT_DIR}`
   are substituted in a plugin agent's content as §3 defines.
6. A plugin agent loads while its plugin is enabled, beside the user's own agents, and is offered in
   the `@` typeahead under its scoped name (§5.13). Two agents of one plugin that resolve to the
   same scoped name load once (Judgment J5.3).

## 5.3 The agent file

An agent file is YAML frontmatter between `---` lines followed by a Markdown body:

```markdown
---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep
model: sonnet
---

You are a code reviewer. When invoked, analyze the code and provide
specific, actionable feedback on quality, security, and best practices.
```

1. The frontmatter MUST open on the file's first line. A file whose opening `---` is on a later
   line has no frontmatter: its whole text is body.
2. The body is the agent's system prompt (`AgentDefinition.prompt`). A non-fork subagent receives
   that prompt plus the environment details the client appends (such as the working directory),
   not the client's own main system prompt. The body MAY be empty.
3. A subagent starts in the main conversation's current working directory. A directory change made
   inside one shell tool call does not persist to the subagent's next call and never changes the
   main conversation's directory.
4. With `isolation: worktree` (§5.6), the subagent's Bash and PowerShell commands run inside its
   worktree, and the client MUST refuse a command whose working directory resolves to the main
   checkout (for example because the worktree was removed while the subagent ran). The check covers
   the repository the client was launched in, and, when the session itself runs in a linked
   worktree, the main checkout it is linked from. For Bash, and for Monitor commands, the client
   also MUST block a command that redirects git into the main checkout and MUST refuse a command
   whose git invocations it cannot prove from the text stay inside the worktree (`worktrees.md`,
   "How Claude Code enforces isolation"); PowerShell commands get only the working-directory check.
   When the main conversation itself runs isolated in a worktree, the same checks apply to it and to
   every subagent it spawns. These checks are part of the client's decision to run a command
   (§13), made each time a command is about to run, not part of reading the agent: a client whose
   loading of plugins and agents is a separate component still MUST make them where its commands
   run (Judgment J5.18). A plugin-host library that loads plugins and agents but runs no commands
   does not own these checks and returns nothing for them beyond the agent's `isolation` value
   (§5.6), which tells its host to create the worktree and apply the checks; such an
   implementation records this item as not applicable.
5. The client MUST pick up an added or edited file in `~/.claude/agents/` and `.claude/agents/`
   within seconds, so that the next delegation uses the new definition. It need not watch a
   directory that did not exist when the session started, the `.claude/agents/` of a directory
   added with `--add-dir` or `/add-dir`, or anything at all in a session started with
   `--disable-slash-commands`; those changes take effect on restart.
6. In non-interactive mode, `--append-subagent-system-prompt <text>` (and
   `--append-subagent-system-prompt-file <path>`) appends the text to every subagent's system
   prompt, nested ones included, except a fork's.

<!-- req: agents.behavior.Write subagent files -->

## 5.4 Reading the frontmatter

The frontmatter is read with the YAML reading §4 defines for skills and commands. Field names are
case-sensitive camelCase and MUST match §5.6 exactly. A top-level field the client does not
recognize is ignored without an error, and the agent loads. A client SHOULD record, in its debug
log, up to five unrecognized top-level fields of each loaded agent, with the likely intended name
when one is close, under the words `does not recognize or apply` (Judgment J5.4).
<!-- req: agents.behavior.Subagent files Claude Code skips -->

### 5.4.1 Files that are skipped

For an agent file in a project, user or managed `agents` directory, or in the `.claude/agents/` of
an `--add-dir` directory, the client MUST skip the file, report nothing in the session, and behave
as follows:

| Problem | Behaviour |
| --- | --- |
| No `name` | The file is documentation kept beside the agents; nothing is logged. <!-- req: agents.behavior.Subagent files Claude Code skips.No name --> |
| An opening `---` that is not the first line | The file has no frontmatter, so no `name`: documentation, as above. |
| A `name` that starts with `-`, contains `:`, or is longer than 256 characters | Skipped; an error goes to the debug log. |
| A `name` but no `description` | Skipped; the reason goes to the debug log. <!-- req: agents.behavior.Subagent files Claude Code skips.A name but no description --> |
| YAML that does not parse | No field is read; skipped; the parse error goes to the debug log. <!-- req: agents.behavior.Subagent files Claude Code skips.YAML that doesn't parse --> |

A `name` that is present but empty counts as no `name`; a `name` that is a list or a table is
unusable and the file is skipped with an error (Judgment J5.1).

### 5.4.2 Plugin agents always load

A plugin agent file is never skipped for its frontmatter (`plugins/components.md`, "Frontmatter
fields in plugin agents"):

- **No `name`**, or an empty one: the agent's own name is its file name (§5.2).
- **A `name` longer than 256 characters**: the client MUST ignore it and use the file name, as for
  a missing name. <!-- req: agents.components.Frontmatter fields in plugin agents.A name longer than 256 characters -->
- **Frontmatter that does not parse**: the agent loads with every field ignored, named after its
  file, with the description `Agent from <plugin> plugin` and the body as its prompt. A validator
  (§17) MUST report the file as an error, so that the author can find it (Judgment J5.17). <!-- req: agents.components.Frontmatter fields in plugin agents.Frontmatter that doesn't parse -->
- **No `description`**: the agent loads with the description `Agent from <plugin> plugin`
  (Judgment J5.2).
- A `name` that contains `:` or starts with `-` is kept as written (Judgment J5.2).

### 5.4.3 Values the client cannot use

A field whose value has the wrong type or lies outside its listed values is ignored: the agent loads
as if the field were absent. A client SHOULD record each such value in its debug log
(Judgment J5.5). `autoCompactWindow` is the documented case: a value outside its range is logged as
`invalid autoCompactWindow` (§5.6). `maxTurns` written as text holding a whole number (`"5"`) is
that number.

### 5.4.4 Validation

`claude plugin validate` reads every `.md` file below a plugin's `agents/` at any depth, a README
or a shared fragment there included, and reports, at the field named, with the fixed text below
(`<…>` varies). An error fails validation; a warning fails it only under `--strict` (§17).

| Severity | Field | Message | When |
| --- | --- | --- | --- |
| warning | `frontmatter` | `No frontmatter block found. Add YAML frontmatter between --- delimiters at the top of the file to set description and other metadata.` | The file has no block (§2.11). |
| error | `frontmatter` | `YAML frontmatter failed to parse: <parser message>. At runtime this agent loads with its name taken from the filename and every other frontmatter field silently dropped.` | The block does not parse, after the retry of §4.4.1 item 2 (Judgment J5.17). |
| warning | `description` | `No description in frontmatter. A description helps users and Claude understand when to use this agent.` | The block has no `description` key (Judgment J5.2). |
| error | `name` | `name must be a string, got <type>.` | `name` is a number, a boolean, a list or a map (`object` for both of the last two). |
| error | `description` | `description must be a string, got <type>. At runtime this value is dropped.` | `description` is a list (`array`) or a map (`object`). |

No other agent field is reported: an unknown key, the fields a plugin agent ignores (§5.6.1), and
a wrong type or unlisted value in any other field (`effort: HIGH`, `tools: 5`, `metadata: text`)
pass silently (Judgments J5.4, J5.5, J4.26).

## 5.5 Scopes and precedence

Agents come from five sources. When two sources define the same agent type, the client MUST use the
one from the higher-priority source:

| Priority | Source | Scope |
| --- | --- | --- |
| 1 (highest) | `.claude/agents/` in the managed settings directory | Organization <!-- req: agents.behavior.Choose the subagent scope.Managed settings --> |
| 2 | The `--agents` flag | Current session <!-- req: agents.behavior.Choose the subagent scope.--agents --> |
| 3 | `.claude/agents/` of the project, and of each `--add-dir` directory | Current project <!-- req: agents.behavior.Choose the subagent scope..claude/agents/ --> |
| 4 | `~/.claude/agents/` | Every project of the user <!-- req: agents.behavior.Choose the subagent scope.~/.claude/agents/ --> |
| 5 (lowest) | A plugin's agents (§5.2) | Where the plugin is enabled <!-- req: agents.behavior.Choose the subagent scope.agents/ --> |

1. **Identity.** Outside plugins, an agent's type is its frontmatter `name`; the file name and
   subfolders play no part. A plugin agent's type is its scoped name, which contains `:` and so
   never equals the type of a project, user or managed agent.
2. **Project directories.** The client MUST scan every `.claude/agents/` from the current working
   directory up to the repository root. When several of them define one name, the one closest to the
   working directory wins. The `.claude/agents/` of each `--add-dir` directory loads at the same
   priority, after the project's own directories (Judgment J5.6).
3. **One directory, one name twice.** When two files under the same `agents` directory, subfolders
   included, declare one name, the client MUST load only one. Claude Code picks by filesystem order;
   an Extended client MUST pick the file whose path relative to that directory sorts first by code
   unit, and SHOULD report the other as a setup problem, as Claude Code's `/doctor` does
   (Judgment J5.3).
4. **Built-in agents.** A custom agent from any source whose type equals a built-in's (§5.12), such
   as `Explore`, replaces the built-in and keeps its own fields (Judgment J5.7).
5. **Managed definitions** use the same file format as user and project ones.
6. **Managed lock.** While managed settings set `strictPluginOnlyCustomization` to include
   `"agents"`, the client MUST NOT load agents from `~/.claude/agents/`, `.claude/agents/` or
   `--add-dir` directories; built-in and managed agents, and agents of plugins other than
   skills-directory plugins (§4.5.1), still load (§14,
   `settings-reference.md`, "strictPluginOnlyCustomization.agents").
7. A file under `.claude/agents/` of an `--add-dir` directory is read like a project file.
   Sharing agents across projects without it is what `~/.claude/agents/` and plugins are for.

<!-- req: agents.behavior.Choose the subagent scope -->

### 5.5.1 The `--agents` flag

`--agents` takes a JSON object. Each key is an agent's name (its type) and each value its
definition, the shape of `AgentDefinition`:

- `prompt` (string, required, MAY be empty): the system prompt, in place of the file body. An agent
  with an empty `prompt` and no `memory`, chosen as the session's agent with `--agent`, leaves the
  session's system prompt unchanged.
- `description` (string, required) and the frontmatter fields `tools`, `disallowedTools`, `model`,
  `permissionMode`, `mcpServers`, `hooks`, `maxTurns`, `autoCompactWindow`, `skills`,
  `initialPrompt`, `memory`, `effort`, `background`, `omitClaudeMd` and `isolation`, with the
  meanings of §5.6. `tools`, `disallowedTools` and `skills` are JSON arrays of strings.
- `color` and `experimental` are not accepted here; the client MUST ignore them, not reject the
  definition.

A name MUST NOT start with `-`. In non-interactive mode the value MAY instead be the path of a JSON
file holding the same object; an interactive session refuses a path with
`Error: --agents takes a JSON object, or a file path only with --print (-p)`, and a missing file is
`Error: --agents file not found: <path>`. An invalid value makes the client exit with code 1,
printing `Error: Invalid --agents configuration:` and then the first failing check only, in this
order: `invalid JSON:` with the parser's message; one line per schema problem; `<name>: agent names
must not start with '-'`; more than 20 lines are cut to 20 and `…and N more`. With `--safe-mode` or
`CLAUDE_CODE_SAFE_MODE` the flag is ignored; with `--resume` or `--continue` an inline value is not
checked, a file is (`errors.md`, "Invalid `--agents` configuration"). Definitions from the flag
exist for that session only. <!-- req: agents.behavior.Choose the subagent scope.--agents -->

## 5.6 Frontmatter fields

Only `name` and `description` are required. The **Plugin** column states what a plugin agent does
with the field (`plugins/components.md`, "Frontmatter fields in plugin agents"): *applied*, or
*ignored*, meaning the client MUST NOT apply the value, whatever it is.

| Field | Type and values | Meaning | Plugin |
| --- | --- | --- | --- |
| `name` | string, at most 256 characters, no `:`, not starting with `-` | The agent type (§5.5). Hooks receive it as `agent_type`. The file name need not match. <!-- req: agents.frontmatter.name --> | applied, as the last part of the scoped name |
| `description` | string | When the main conversation should delegate to this agent (§5.13). <!-- req: agents.frontmatter.description --> | applied |
| `tools` | comma-separated string or YAML list | The tools the agent may use (§5.7). Omitted: every tool available to subagents. <!-- req: agents.frontmatter.tools --> | applied |
| `disallowedTools` | as `tools` | Tools removed from the inherited or listed set (§5.7). <!-- req: agents.frontmatter.disallowedTools --> | applied |
| `model` | `sonnet`, `opus`, `haiku`, `fable`, a full model ID, or `inherit` | The agent's model (§5.8). <!-- req: agents.frontmatter.model --> | applied |
| `permissionMode` | `default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan`; `manual` is an alias of `default` | The permission mode the agent asks for (§5.9). <!-- req: agents.frontmatter.permissionMode --> | ignored |
| `maxTurns` | whole number ≥ 1 | The most agentic turns before the subagent stops; its output then returns marked as partial, and it can be resumed to continue. <!-- req: agents.frontmatter.maxTurns --> | applied |
| `autoCompactWindow` | whole number from `100000` to `1000000` | Lowers the auto-compact window of this subagent (§5.10). <!-- req: agents.frontmatter.autoCompactWindow --> | applied |
| `skills` | comma-separated string or YAML list of skill names | Skills whose full content is preloaded (§5.10). <!-- req: agents.frontmatter.skills --> | applied |
| `mcpServers` | list; each entry a server name or a one-key map of name to server configuration | MCP servers for this agent (§5.11). <!-- req: agents.frontmatter.mcpServers --> | ignored |
| `hooks` | the hooks object of a settings file | Hooks active only while this agent runs (§5.12.1). <!-- req: agents.frontmatter.hooks --> | ignored |
| `memory` | `user`, `project` or `local` | Persistent memory scope (§5.10). <!-- req: agents.frontmatter.memory --> | applied |
| `background` | boolean | `true` keeps the subagent in the background even when the main conversation asks to wait for it (§5.12). <!-- req: agents.frontmatter.background --> | applied |
| `omitClaudeMd` | boolean | `true` starts the subagent without the user, project and local CLAUDE.md files (§5.10). <!-- req: agents.frontmatter.omitClaudeMd --> | applied |
| `effort` | `low`, `medium`, `high`, `xhigh`, `max` | Effort level while the agent is active (§5.8). <!-- req: agents.frontmatter.effort --> | applied |
| `isolation` | `worktree` | Runs the subagent in a temporary git worktree (§5.3). <!-- req: agents.frontmatter.isolation --> | applied |
| `color` | `red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `cyan` | Display color in the task list and transcript. <!-- req: agents.frontmatter.color --> | applied |
| `initialPrompt` | string | First user turn when the agent runs as the main session (§5.13). <!-- req: agents.frontmatter.initialPrompt --> | ignored |
| `experimental` | map | Experimental options; only `cacheTtl` (`5m` or `1h`) is read. <!-- req: agents.frontmatter.experimental --> | applied (`cacheTtl` only) |

Field rules beyond the table:

- **`isolation: worktree`** branches the worktree, by default, from the repository's default branch
  (`worktrees.md`, "Choose the base branch"), not from the parent session's `HEAD`. The client MUST
  remove the worktree when the subagent finishes without changes. `worktree` is the only valid value
  in a file; the Agent tool's own `isolation` parameter (`AgentInput`) also takes `remote`, which a
  file cannot.
- **`omitClaudeMd: true`** still loads the managed policy CLAUDE.md files, except for a managed
  agent, which then loads none. It has no effect when the agent runs as the main session.
- **`effort`** overrides the session's effort level but not `CLAUDE_CODE_EFFORT_LEVEL`. The levels a
  model accepts depend on the model. The SDK type also allows an integer; a file takes the names.
- **`experimental.cacheTtl`** chooses the prompt-cache lifetime of the agent's requests, at the
  frontmatter's place in the cache precedence (`prompt-caching.md`, "Choose the TTL yourself"). Any
  other value or key is ignored; `1h` is ignored while the user's subscription is drawing usage
  credits. The field is read only from agent files, and `cacheTtl` written at the top level is an
  unrecognized field.
- **`maxTurns`** applies also when the subagent is resumed: the resumed run continues the work.
- The SDK's `observer`, `observerMessage` and `criticalSystemReminder_EXPERIMENTAL` are not
  frontmatter fields: in a file they are unrecognized (Judgment J5.4).

### 5.6.1 Plugin agents

A plugin agent applies `name`, `description`, `model`, `effort`, `maxTurns`, `autoCompactWindow`,
`tools`, `disallowedTools`, `skills`, `memory`, `background`, `omitClaudeMd`, `isolation`, `color`
and the `cacheTtl` key of `experimental`. <!-- req: agents.components.Frontmatter fields in plugin agents.Supported fields -->

A plugin agent MUST NOT apply `permissionMode`, `hooks`, `mcpServers` or `initialPrompt`: the client
loads the agent as if those fields were absent, and does not reject it. An agent file cannot add
hooks or MCP servers on its own; a plugin ships them as plugin hooks (`hooks/hooks.json`, §7) and
plugin MCP servers (`.mcp.json`, §8), which apply whenever the plugin is enabled. A user who needs
the fields copies the file into `.claude/agents/` or `~/.claude/agents/`.
<!-- req: agents.components.Frontmatter fields in plugin agents.Ignored fields -->

## 5.7 Tools

### 5.7.1 The pool a subagent inherits

A non-fork subagent starts from the built-in tools and MCP tools of the main conversation, narrowed
by two filters. A fork skips both and receives the main conversation's exact tool pool.

**Filter 1, every subagent.** The client MUST withhold these tools from every non-fork subagent, even
when its `tools` field lists them:

| Tool | Rule |
| --- | --- |
| `Agent` | Withheld at the spawn-depth limit (§5.12.2). A fork at the limit keeps it listed, but a call returns an error instead of spawning. <!-- req: agents.behavior.Available tools.Agent --> |
| `AskUserQuestion` | Always withheld. <!-- req: agents.behavior.Available tools.AskUserQuestion --> |
| `EndConversation` | Always withheld: it can end only the main conversation (`tools-reference.md`). <!-- req: agents.behavior.Available tools.EndConversation --> |
| `EnterPlanMode` | Always withheld. <!-- req: agents.behavior.Available tools.EnterPlanMode --> |
| `ExitPlanMode` | Withheld unless the subagent's permission mode is `plan`. <!-- req: agents.behavior.Available tools.ExitPlanMode --> |
| `ScheduleWakeup` | Always withheld. <!-- req: agents.behavior.Available tools.ScheduleWakeup --> |
| `WaitForMcpServers` | Always withheld. <!-- req: agents.behavior.Available tools.WaitForMcpServers --> |
| `ExitWorktree` | Withheld from a subagent that already runs in its own working directory, such as one with `isolation: worktree` (`tools-reference.md`, its row of the tools table). <!-- req: tools.tool.ExitWorktree --> |
| `Workflow` | Always withheld. <!-- req: agents.behavior.Available tools.Workflow --> |

**Filter 2, background subagents.** A subagent that runs in the background (the default, §5.12)
keeps every MCP tool but only these built-in tools: `Read`, `Grep`, `Glob`, `LSP`, `Bash`,
`PowerShell`, `Edit`, `Write`, `NotebookEdit`, `WebFetch`, `WebSearch`, `TodoWrite`, `Skill`,
`ToolSearch`, `EnterWorktree`, `ExitWorktree`, `Monitor`, `TaskStop`, `SendMessage` and `Artifact`,
plus `SubagentHandback` where the subagent reports through it. `Agent` and `ExitPlanMode` follow
filter 1 wherever the subagent runs. The client MUST remove every other built-in tool from a
background subagent, inherited or listed, without an error unless the `tools` list then resolves
to nothing (§5.7.3). So one definition can resolve to different tools in the foreground and in the
background. A resumed subagent keeps the tool set of its first run.

Additions and narrower cases:

- **`SubagentHandback`** is given to a locally run non-fork subagent in auto mode, even when `tools`
  leaves it out or `disallowedTools` lists it (`tools-reference.md`, its row of the tools table).
- **`Glob` and `Grep`**: on macOS, Linux and WSL a subagent can receive them when the main
  conversation lacks them (`tools-reference.md`, "Glob tool behavior").
- **`ListAgents`** follows the filters like any built-in tool: a foreground subagent inherits it
  where cross-session messaging is on; a background subagent does not keep it.
- **Agent team teammates** additionally keep `TaskCreate`, `TaskGet`, `TaskList`, `TaskUpdate`,
  `CronCreate`, `CronDelete` and `CronList`. In a session without the task tools, subagents do not
  get them either.

<!-- req: agents.behavior.Available tools.Agent | agents.behavior.Available tools.ExitPlanMode -->

### 5.7.2 `tools` and `disallowedTools`

`tools` is an allowlist and `disallowedTools` a denylist, each a comma-separated string or a list.
The client MUST resolve them in this order: start from the pool of §5.7.1; remove what
`disallowedTools` names; then, when `tools` is set, keep only what it names from what remains. A tool
listed in both is removed. Neither field set: the whole pool. A tool the filters removed is never
granted, whatever `tools` says (`tools-reference.md`, "Agent tool behavior").

| Entry | In `tools` | In `disallowedTools` |
| --- | --- | --- |
| `Read` | grants `Read` | removes `Read` |
| `Bash(git push *)` | grants the whole tool (Judgment J5.8) | removes the whole `Bash` tool, not only matching commands |
| `mcp__github__*` | grants every tool of server `github` | removes every tool of `github` <!-- req: agents.behavior.Restrict which tools a subagent can use.Withhold one server's tools --> |
| `mcp__github` | matches no tool | removes every tool of `github` <!-- req: agents.behavior.Restrict which tools a subagent can use.Withhold one server's tools --> |
| `mcp__*` | matches no tool (Judgment J5.8) | removes every MCP tool of every server <!-- req: agents.behavior.Restrict which tools a subagent can use.Withhold every MCP tool from any server --> |
| `mcp__github__create_issue` | grants that tool | removes that tool |

A server-wide entry is a prefix of tool names, so it reaches every server whose name begins the same
way: `mcp__reports` or `mcp__reports__*` in `disallowedTools` also removes the tools of a server
named `reports__v2`, and in `tools` a server whose name contains `__` needs its whole name and
`__*` (`mcp__reports__v2__*`). To keep Bash but block some commands, a user adds a Bash deny rule to
`permissions.deny` (§13), which applies to the main conversation and to subagents.

To stop a subagent from loading skills, `tools` leaves out `Skill` or `disallowedTools` lists it; the
`skills` field is not a tool entry (§5.10). The SDK marks `Skill` in `tools` as deprecated for that
purpose.

### 5.7.3 A `tools` list that resolves to nothing

When `tools` is non-empty and no entry resolves to a tool, the client MUST refuse to launch the
subagent and return the error

```text
Agent '<type>' would be spawned with zero tools — refusing. Its tools list resolved to nothing: <groups>. Fix the agent's tools frontmatter or pass a different subagent_type.
```

where each group names its entries in brackets: `unrecognized [Grpe]` for a name that matches no
tool; *not available to subagents* for a real tool the filters remove (a background-only removal
included); *matched no tools in this session* for a valid entry with nothing behind it now, such as
an `mcp__` entry of a server that is not connected, or `Agent` at the depth limit. `Agent` is always
reported in the last group. An omitted `tools`, an empty `tools`, or a `tools` list that
`disallowedTools` emptied does not refuse: the subagent launches without tools (`errors.md`, "Agent
would be spawned with zero tools"; Judgment J5.9).

### 5.7.4 Which agents may be spawned

1. **`Agent(type, …)` in `tools`** restricts which agent types an agent may spawn, but only when that
   agent runs as the main session (`--agent`, the `agent` setting). `tools: Agent(worker,
   researcher), Read, Bash` lets it spawn only `worker` and `researcher`; any other type fails, and
   the agent's prompt lists only the allowed types. `Agent` without parentheses allows every type,
   and a `tools` list without `Agent` allows none. In a subagent's own definition, `Agent` in
   `tools` lets it spawn while the depth limit allows, and any list in the parentheses is ignored.
   `Task(...)` is an alias of `Agent(...)` wherever either is accepted.
   <!-- req: agents.behavior.Restrict which subagents can be spawned -->
2. **`permissions.deny`** entries `Agent(<type>)`, and the `--disallowedTools "Agent(<type>)"` flag,
   stop the main conversation from using that type, built-in or custom. Denying `Agent` itself stops
   all delegation, and `Agent(fork)` stops forks only. For a plugin agent the type is its scoped
   name (Judgment J5.10). <!-- req: agents.behavior.Disable specific subagents -->
3. An Agent call without `subagent_type` uses `general-purpose`. When the session has none — the
   built-ins are disabled, or an `Agent(...)` allowlist leaves it out — the call fails with
   `subagent_type is required: the general-purpose agent is not available in this session. Available agents: ...`
   listing the types it does have (`errors.md`, "subagent_type is required").

## 5.8 Model and effort

### 5.8.1 The `model` value

<!-- req: agents.behavior.Choose a model -->

- **Model alias**: `sonnet`, `opus`, `haiku` or `fable`, resolved as `model-config.md` defines. <!-- req: agents.behavior.Choose a model.Model alias -->
- **Full model ID**: such as `claude-opus-5-5`; any value the `--model` flag accepts. <!-- req: agents.behavior.Choose a model.Full model ID -->
- **`inherit`**: the main conversation's model. <!-- req: agents.behavior.Choose a model.inherit -->

### 5.8.2 Resolution order

The client MUST resolve a subagent's model from the first of these that gives one:

1. The Agent call's `model` parameter. It takes an alias only (`AgentInput.model`); a full ID or
   `inherit` there counts as unset (Judgment J5.11). A mod's `agent.spawn` hook that sets a model
   replaces this parameter (§10).
2. The definition's `model`, where `inherit` selects the main conversation's model.
3. `CLAUDE_CODE_SUBAGENT_MODEL`, set to an alias or ID; `inherit` there is the same as unset.
4. The main conversation's model.

A family alias from step 1 or 2 resolves to the main conversation's exact model, `[1m]` suffix
included, when that model belongs to the family; and `opus` resolves to the main model on a
third-party provider when the client cannot tell the main model's family, unless
`ANTHROPIC_DEFAULT_OPUS_MODEL` is set. An alias in `CLAUDE_CODE_SUBAGENT_MODEL` always resolves to
the version the alias points to. The variable alone does not change Explore or Plan.

The client MUST check each candidate value against the organization's `availableModels` allowlist.
A blocked family alias runs on the newest version of that family the allowlist permits, under the
rules of `/model`; any other blocked value, or no permitted version, runs on the inherited model,
trying `CLAUDE_CODE_SUBAGENT_MODEL` first when it is set. An interactive session warns with both
model names. The per-invocation parameter persists when the subagent is resumed or messaged.
Subagents inherit the main conversation's extended-thinking setting; there is no per-agent one.

### 5.8.3 One model for every subagent

With `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`, the client MUST ignore every definition's `model` and
refuse a per-invocation `model`, for subagents, teammates and workflow agents alike: they run on
`CLAUDE_CODE_SUBAGENT_MODEL` when it is set, otherwise on the main conversation's model, except the
built-in Explore, which then keeps its own model (§5.12). A fork, and a skill run in a subagent with
`model: inherit`, still run on the main conversation's model. <!-- req: agents.behavior.Run every subagent on one model -->

### 5.8.4 Effort

The Agent call's `effort` parameter (non-fork calls) overrides the `effort` field and persists on
resume; `CLAUDE_CODE_EFFORT_LEVEL` overrides both. With neither field nor parameter, a subagent on
the main conversation's model runs at the session's level (`/effort`, `--effort`); on another model
the session level does not apply and the client sends no level of its own, so the model's default
applies (`model-config.md`, "Effort level of subagents and teammates"; Judgment J5.12).
<!-- req: agents.behavior.When a subagent has no effort field or parameter -->

## 5.9 Permission mode

Unset, a subagent inherits the main conversation's permission mode. Set, the main conversation's
mode decides whether the value is used:

| Main conversation | Subagent runs in |
| --- | --- |
| `bypassPermissions`, `acceptEdits` or `auto` | The main conversation's mode; the field is ignored. Under `auto`, the classifier judges the subagent's calls with the main conversation's rules and reviews its final report before delivery. |
| `plan` | `plan`, whatever the field says, except for an agent team teammate under the agent-teams rules. With the field `dontAsk`, what plan mode would ask about is denied instead. |
| `default` or `dontAsk` | The field's mode, except that `bypassPermissions` keeps the main conversation's mode, and so does `auto` when auto mode is not available to the subagent (`disableAutoMode`, a model without auto mode). |

The values (`PermissionMode`), with `manual` read as `default`:

| Value | The subagent |
| --- | --- |
| `default` | Prompts for permission (Manual mode). <!-- req: agents.permissionMode.default --> |
| `acceptEdits` | Accepts file edits and common filesystem commands for paths in the working directory or `additionalDirectories` without asking. <!-- req: agents.permissionMode.acceptEdits --> |
| `auto` | Has its commands and protected-directory writes reviewed by the auto-mode classifier. <!-- req: agents.permissionMode.auto --> |
| `dontAsk` | Is denied every call that would prompt; explicitly allowed tools still work, and `AskUserQuestion`, MCP tools marked `requiresUserInteraction`, reads from network paths and connector tools the organization set to `ask` are denied even when allowed. A mod may still approve some such calls (§10, §13). <!-- req: agents.permissionMode.dontAsk --> |
| `bypassPermissions` | Skips permission prompts, but only when the main conversation is itself in `bypassPermissions`. <!-- req: agents.permissionMode.bypassPermissions --> |
| `plan` | Explores read-only (plan mode) and keeps `ExitPlanMode` (§5.7.1). <!-- req: agents.permissionMode.plan --> |

A plugin agent's `permissionMode` is ignored (§5.6.1). The modes themselves are §13's.

## 5.10 Context: skills, memory, CLAUDE.md and compaction

### 5.10.1 What a non-fork subagent starts with

A non-fork subagent starts with a fresh context window: no conversation history, no skills already
invoked, no files already read. Its initial context holds:

- **System prompt**: the agent's prompt plus the environment details the client appends.
- **Task message**: the delegation prompt the main conversation writes.
- **CLAUDE.md files**: every level the main conversation loads (user, project, local, managed
  policy, and `AGENTS.md` loaded as project instructions). Explore and Plan skip them; an agent
  with `omitClaudeMd` loads only the managed policy files, or none for a managed agent. A
  subdirectory's CLAUDE.md and matching path-scoped rules still load when such a subagent works
  there.
- **Git status**: a snapshot taken at start (the worktree's for an isolated subagent), absent
  outside a repository or when `includeGitInstructions` turns it off. Only Explore and Plan skip it.
- **Preloaded skills** (§5.10.2); built-in agents preload none.
- **Sibling roster**: when the subagent has `SendMessage` and another agent in the session has a
  name, a system reminder listing `main` and every named agent, taken at start.

The main conversation's output style and auto memory never reach a non-fork subagent, and the
subagent's context window is sized by its own model.

### 5.10.2 Preloaded skills

The client MUST inject the full content of each skill the `skills` field names into the subagent's
context at startup, for the first 32 distinct names in the list. Preloading draws from the skills
the model may invoke, so a skill with `disable-model-invocation: true` (the bundled `/verify`
included) cannot be preloaded. A listed skill that is missing or disabled, for example by policy, is
skipped with a warning in the debug log. The field chooses what is preloaded, not what is
reachable: the subagent can still invoke project, user and plugin skills through the Skill tool
unless `Skill` is withheld (§5.7.2). §4 defines skill lookup and running a skill in a subagent
(`context: fork`), which is the inverse arrangement. <!-- req: agents.behavior.Preload skills into subagents -->

### 5.10.3 Persistent memory

With `memory` set and auto memory on, the client MUST give the subagent a persistent directory:

| Scope | Directory |
| --- | --- |
| `user` | `~/.claude/agent-memory/<agent>/` |
| `project` | `.claude/agent-memory/<agent>/` |
| `local` | `.claude/agent-memory-local/<agent>/` |

`<agent>` is the agent type; for a plugin agent, its scoped name with `:` and path separators
replaced by `-` (Judgment J5.13). While memory is on, the subagent's system prompt carries
instructions for reading and writing the directory and the first 200 lines or 25 KB of its
`MEMORY.md`, whichever ends first, with instructions to curate it when it is longer; and `Read`,
`Write` and `Edit` are enabled for it. When auto memory is off (`autoMemoryEnabled`,
`CLAUDE_CODE_DISABLE_AUTO_MEMORY`), `memory` has no effect. `project` is the recommended scope.

### 5.10.4 Auto-compaction

A subagent compacts as its own context fills; `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE` applies to it.
`autoCompactWindow` lowers its window: the value MUST be a whole number from 100000 to 1000000, and
a string is read as its leading integer, so `200k` reads as 200 and is out of range. An out-of-range
value leaves the subagent as if the field were absent, logged as `invalid autoCompactWindow`. A set
`CLAUDE_CODE_AUTO_COMPACT_WINDOW` that the client accepts wins over the field. The field has no
effect when the agent runs as the main session.

## 5.11 MCP servers

<!-- req: agents.behavior.Scope MCP servers to a subagent -->

1. Each `mcpServers` entry is either a string naming a server already configured in the session,
   which shares the parent's connection, or a map from a server name to a configuration of the
   `.mcp.json` shape (§8), of type `stdio`, `http`, `sse` or `ws` (`AgentMcpServerSpec`).
2. An inline server is connected when the subagent starts and disconnected when it finishes; its
   tools reach the subagent and not the main conversation. When the agent runs as the main session,
   inline servers connect at startup beside `.mcp.json` and settings servers.
3. `--strict-mcp-config`, `--bare`, managed MCP configuration and the `allowedMcpServers` and
   `deniedMcpServers` policies (§8, §14) cover servers declared in agent frontmatter: a blocked
   server is skipped with a warning naming it. Managed restrictions apply to every agent;
   `--strict-mcp-config` does not filter inline servers of `--agents` or SDK `agents` definitions.
4. A plugin agent's `mcpServers` is ignored (§5.6.1).

### 5.11.1 Trust for inline servers

<!-- req: agents.behavior.Trust required for inline MCP servers -->

An inline server from an agent file in the project's `.claude/agents/`, or in an `--add-dir`
directory's `.claude/agents/`, MUST NOT connect until the user has trusted the folder that file came
from (§13).

- **Trust that does not count**: a parent folder's trust, and the automatic trust a `-p` or SDK
  session has for settings hooks. <!-- req: agents.behavior.Trust required for inline MCP servers.Trust that doesn't count -->
- **Until then**: the client skips every inline server of that file and writes to its debug log the
  exact `projects["<path>"].hasTrustDialogAccepted` key of `~/.claude.json` that would trust it. <!-- req: agents.behavior.Trust required for inline MCP servers.Until then -->
- **`--add-dir` directories**: one outside the trusted workspace's repository needs its own trust
  entry. <!-- req: agents.behavior.Trust required for inline MCP servers.--add-dir directories -->

No trust is checked for a string reference, or for an inline server from `~/.claude/agents/`, from
`--agents` or the SDK `agents` option, or from managed settings.

## 5.12 Running subagents

### 5.12.1 Hooks

**In the frontmatter.** An agent's `hooks` field has the shape of a settings file's `hooks` object
(§7). Its hooks run only while that agent is active — spawned through the Agent tool or an
@-mention, or running as the main session, where they run beside the settings hooks — and are
removed when it finishes. Every hook event is accepted. For a subagent the three common events are:

| Event | Matcher | Fires |
| --- | --- | --- |
| `PreToolUse` | tool name | Before the subagent uses a tool. <!-- req: agents.hookEvent.PreToolUse --> |
| `PostToolUse` | tool name | After the subagent uses a tool. <!-- req: agents.hookEvent.PostToolUse --> |
| `Stop` | none | When the subagent finishes. The client MUST register a frontmatter `Stop` hook as `SubagentStop` when the agent runs as a subagent. <!-- req: agents.hookEvent.Stop --> |

A `PreToolUse` hook that exits with code 2 blocks the call and its stderr reaches the subagent, so an
agent can allow some uses of a tool and refuse others (§7):

```yaml
---
name: db-reader
description: Execute read-only database queries
tools: Bash
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-readonly-query.sh"
---
```

<!-- req: agents.behavior.Conditional rules with hooks -->

The frontmatter hooks of a project agent, or of an `--add-dir` directory's agent, MUST NOT run
until the user trusts the folder holding the file, under the same stricter rule as §5.11.1: a parent
folder's trust and a `-p` session do not count. Until then the agent runs without them and the
client logs an error saying how to trust the folder. User agents and `--agents` definitions need no
trust; neither do managed agents (Judgment J5.14). A plugin agent's `hooks` is ignored (§5.6.1).
Under `strictPluginOnlyCustomization` with `"hooks"`, frontmatter hooks of agents from the sources
an `"agents"` lock would block stop running, and the agents still load (§14).

**From settings.** Hooks from settings files, managed policy and plugins also apply inside
subagents: tool events fire for a subagent's tool calls as in the main conversation. `SubagentStart`
and `SubagentStop` fire in the main session when a subagent begins and completes; their matcher is
the agent type — the frontmatter `name`, or a plugin agent's scoped name. A scoped name contains `:`
and is matched as an unanchored regular expression, so `^my-plugin:db-agent$` matches that agent
only (§7). <!-- req: agents.behavior.Project-level hooks for subagent events -->

### 5.12.2 Nesting and concurrency

1. A subagent MAY spawn subagents of its own, up to `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` layers
   below the main conversation (default 3; `1` turns nesting off). At the limit the client withholds
   `Agent` from every subagent but a fork (§5.7.1), so the subagent does its work itself. A nested
   subagent resolves from the same scopes as a top-level one. In an interactive session a spawning
   subagent waits for its nested subagents' results; in `-p` and the SDK it waits while fork mode
   is on, and with fork mode off its nested subagents start in the background and report to the main
   conversation if they outlast it. To keep one agent from spawning, its `tools` leaves out `Agent`
   or `disallowedTools` lists it. <!-- req: agents.behavior.Let subagents spawn their own subagents -->
2. While `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` (default 20) subagents run, an Agent call fails with
   `Concurrent subagent limit reached` and tells the model not to retry. `/subtask` forks and
   resumes take slots without being blocked; workflow agents and teammates follow their own limits.
   The limit is not enforced while ultracode is active (`model-config.md`).

### 5.12.3 Foreground and background

A subagent the main conversation spawns starts in the background unless the main conversation waits
for it (the Agent call's `run_in_background: false`, where fork mode allows waiting). Fork mode is on
by default and `CLAUDE_CODE_FORK_SUBAGENT=0` turns it off; while it is on, the main conversation of
an interactive terminal, VS Code or desktop session on the user's machine cannot wait for a
subagent, so a plugin agent always starts in the background there; in `-p` and the Agent SDK it can
wait. A skill with `context: fork` follows §4.9.4 instead, whether or not fork mode is on.
<!-- docs: env-vars.md | Variables — CLAUDE_CODE_FORK_SUBAGENT -->
`background: true` keeps it in the background even then. `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`
makes every subagent run in the foreground. A background subagent surfaces its permission prompts in
the main session naming itself, and gets the reduced tool set of §5.7.1; its result arrives as a
completion notification.

### 5.12.4 Built-in agents

A client MUST register these built-in agent types in interactive sessions:

| Type | Model | Tools | Purpose |
| --- | --- | --- | --- |
| `Explore` | The main conversation's (with Fable as the main model, the `opus` alias's model on first-party connections) | Read-only; `Write` and `Edit` denied | Codebase search, at a thoroughness of quick, medium or very thorough. Starts without CLAUDE.md and git status; returns no agent ID. |
| `Plan` | The main conversation's | Read-only; `Write` and `Edit` denied | Research during plan mode. Starts without CLAUDE.md and git status; returns no agent ID. |
| `general-purpose` | The model order of §5.8.2 | Every tool available to subagents | Multi-step tasks that explore and change. The default `subagent_type`. |
| `claude` | The model order of §5.8.2 | Every tool available to subagents | The catch-all, and the default agent of a dispatched background session. |
| `statusline-setup` | Sonnet | — | `/statusline`. |
| `claude-code-guide` | Haiku | — | Questions about Claude Code. |

Built-ins inherit the parent's permission rules. `CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS=1`
removes Explore and Plan; in non-interactive mode and the SDK,
`CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS=1` removes every built-in. A custom agent of the same type
replaces a built-in (§5.5). The built-ins' prompts are the client's own (Judgment J5.7).
<!-- req: agents.behavior.Built-in subagents -->

### 5.12.5 Names on the Agent call

Agent teams are off by default; `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` (in the environment or a
settings `env`) turns them on, and a non-interactive session (`-p`, the Agent SDK) never spawns a
teammate, so there a named subagent runs as an ordinary one.
<!-- docs: env-vars.md | Variables — CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS -->

In a session with agent teams enabled, the main conversation MAY pass `name` on an Agent call, which
makes the subagent addressable by `SendMessage` and resumable by name after it finishes. In an
interactive session with agent teams on, such a call from the main conversation launches a teammate
instead, unless it is a fork or passes `isolation` on the call; an `isolation` in the agent's
frontmatter does not prevent that, and the teammate runs in the main session's directory
(`agent-teams.md`). Without agent teams a `name` makes nothing addressable (Judgment J5.15).
<!-- req: agents.behavior.Subagent names -->

### 5.12.6 A plugin agent as a teammate

A teammate MAY be spawned from an agent definition of the project, user, managed or plugin scope,
a plugin agent by its scoped name as for delegation. A teammate runs either in process (inside the
lead's session, the default display mode) or in its own split pane (`teammateMode`,
`--teammate-mode`). The client MUST apply the definition to the teammate as follows, and nothing
else of it:

| Part | In process | Split pane |
| --- | --- | --- |
| `tools` | The teammate's tools are the list, plus `SendMessage`, plus `TaskCreate`, `TaskGet`, `TaskList` and `TaskUpdate` in a session that has the Task tools. | The teammate's tools are the list. |
| `model` | Used when the spawn request names no model. | The same. |
| `disallowedTools` | Removed from the teammate's tools, except `SendMessage` and the Task tools added above. | Not applied. |
| `effort` | Applied under the frontmatter effort rules (§5.8.4). | Not applied. |
| `autoCompactWindow` | Applied under §5.10.4. | Ignored. |
| Body | Appended to the teammate's default system prompt as further instructions. | Replaces the default system prompt. |
| `skills` | Not applied: the teammate loads skills from the project and user settings. | The same. |
| `mcpServers` | Not applied: the teammate loads MCP servers from the project and user settings. | Applied under §5.11; a plugin agent's `mcpServers` stays ignored (§5.6.1). |

When the lead messages an in-process teammate that has stopped, the client brings it back in the
same session with its saved conversation and gives it the message as its next prompt; after the
session is resumed, teammates are not brought back this way. On bringing one back, the client
re-applies a definition from the `.claude/agents/` of the project or of an `--add-dir` directory
only when the folder holding the agent file is itself trusted (a trusted parent does not count,
§13); otherwise the teammate returns with only the tools every in-process teammate gets and no
instructions of the definition, and the sending agent's tool result carries, after the resume
report, `Its agent definition was not restored: the folder its definition file came from is not
trusted (source: projectSettings), so the teammate is running with the team-essential tools and no
custom instructions. …` (`errors.md`, "Teammate's agent definition was not restored"). A plugin
agent's definition is re-applied in either case.
<!-- docs: agent-teams.md | Use subagent definitions for teammates -->

## 5.13 Listing and selecting agents

1. **Delegation.** The client offers the model every loaded agent with its type and `description`,
   so that the model delegates by matching a task to a description. When the descriptions of the
   non-built-in agents (each counting its name and description) pass an estimated 15,000 tokens,
   an interactive client shows `Agent descriptions are over the 15.0k-token limit (~<n>k tokens)` as
   a startup notice and still loads every agent (`errors.md`).
2. **Natural language.** Naming an agent in a prompt is a hint; the model decides whether to
   delegate. <!-- req: agents.behavior.Invoke subagents explicitly.Natural language -->
3. **@-mention.** The `@` typeahead MUST offer each agent, a plugin agent under its scoped name
   (`my-plugin:code-reviewer`, `my-plugin:review:security`), and named background subagents running
   in the session with their status. Choosing one guarantees that agent runs for that message; the
   whole message still goes to the model, which writes the task prompt. Typed by hand,
   `@agent-<type>` resolves on submit, as `@agent-code-reviewer` or
   `@agent-my-plugin:code-reviewer`. <!-- req: agents.behavior.Invoke subagents explicitly.@-mention -->
4. **Session-wide.** `--agent <name>`, or the `agent` setting (§12), runs the main thread as that
   agent: its tools, model and system prompt apply to the session, and the prompt replaces the
   client's default system prompt entirely unless it is empty. CLAUDE.md and project memory still
   load, `omitClaudeMd` notwithstanding; in `-p` a custom agent with its own prompt starts without
   the git status snapshot. `initialPrompt` is submitted as the first user turn, commands and
   skills processed, prepended to any prompt the user gives. The header shows `@<name>`. The flag beats the
   setting, and a plugin's default `agent` (§12.6) is the lowest settings layer. A plugin agent is
   found by its bare name when one plugin has it, and by its scoped name always
   (Judgment J5.16). The choice persists on resume; if the agent is gone, the session continues with
   the default tools and warns
   `This session was running agent '<name>', which is no longer available (no agent by that name in <dirs>). …`
   (`errors.md`, "Session agent no longer available"). <!-- req: agents.behavior.Invoke subagents explicitly.Session-wide -->
5. A built-in agent can be selected the same ways.

## Design decisions

### Why plugin agents ignore `permissionMode`, `hooks`, `mcpServers` and `initialPrompt`

Installing a plugin is a lighter act than writing a file into one's own `.claude/agents/`. Each of
these fields would let a file from a marketplace raise its own permissions, run commands, or start
servers the moment it is delegated to, out of the user's sight. The plugin has an honest place for
hooks and MCP servers — its `hooks/hooks.json` and `.mcp.json` — which the user sees as the
plugin's and which policy can review. Ignoring the fields, not rejecting the agent, keeps one agent
file portable between a plugin and a user's directory.

### Why a plugin agent never fails to load for its frontmatter

A user agent with no `name` is plausibly a README beside the agents, and skipping it is right. A
file in a plugin's `agents/` was put there to be an agent, and the user who installed the plugin
cannot fix it; the file name is a stable fallback, and the validator is where the author learns of
the problem.

### Why `--add-dir` agents rank with the project's

Claude Code describes them as loading "alongside" project agents and gives them no row of their own;
ranking them after the project's own directories means a directory added for one task never
silently replaces a definition the project checked in.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J5.1 | For a project, user, managed or `--add-dir` file, an empty `name` (`name:`, `""`, whitespace) is no name (documentation, nothing logged); a `name` that is a list or table makes the file skipped with an error; a number or boolean is read as its text (§5.4.1). | `sub-agents.md` names "No `name`" only. YAML gives `name:` a null value, so it reads as absent; a structured value is not a name. Lead: the reference implementation's rows for `src/format/agent.ts`. |
| J5.2 | A plugin agent without a usable `description` loads with `Agent from <plugin> plugin`; a plugin agent's `name` that contains `:` or starts with `-` is kept (§5.4.2). | `plugins/components.md` gives that description only for unparsable frontmatter and lists only the 256-character fallback for names; `sub-agents.md` says a plugin agent "still loads". Oracle 2.1.325: `claude plugin validate` reports a plugin agent without `description` as a warning only (`No description in frontmatter`) and says nothing of `name: has:colon`; oracle 2.1.321 on the corpus gives the whole warning of §5.4.4 27 times, on files without the key, `agents/_shared/constitution.md` and `agents/research/references/README.md` among them. |
| J5.3 | Two files in one `agents` directory with one name: the one whose relative path sorts first by code unit loads and the client reports the other; two agents of one plugin with one scoped name are handled the same way (§5.2, §5.5). | The docs leave it to "filesystem read order rather than a documented precedence", which differs between machines; a fixed order makes two Extended clients agree. `/doctor` reporting duplicates is documented. |
| J5.4 | Unrecognized fields are logged up to five per agent in file order, with a suggestion when a supported field matches case-insensitively or within two edits; plugin agents too; the SDK-only `observer`, `observerMessage` and `criticalSystemReminder_EXPERIMENTAL` are unrecognized in a file (§5.4, §5.6). | The docs give the limit of five and "the likely intended name when a supported field is close" without the similarity rule; the three SDK keys are in `AgentDefinition` but not in the frontmatter table. Oracle 2.1.325: the validator does not report `maxTurn` (an unknown field) in a plugin agent. |
| J5.5 | A field value of the wrong type or outside its listed values (`color: magenta`, `isolation: remote` in a file, `maxTurns: 0`, `effort: huge`, `background: yes`) is dropped and the agent loads; the client logs it. `background` and `omitClaudeMd` take a YAML boolean or the text `true`/`false`; `maxTurns` a whole number ≥ 1, or text holding one (`"5"` is 5); `effort` the five names exactly; `model` any non-empty text (§5.4.3). | The docs say unknown fields are ignored and that a bad `autoCompactWindow` loads "as if the field were absent", and give no other invalid-value rule. Oracle 2.1.325: `claude plugin validate` reports none of `isolation: remote`, `color: magenta`, `maxTurns: "5"`, `tools: 5`, `effort: HIGH` or the ignored plugin fields (oracle 2.1.321 on the corpus: none of 68 agent `effort` values outside the list). **Quoted `maxTurns`**: oracle 2.1.325, re-run 2026-11-16 with a private config directory and a local stand-in for the Messages API that answers every subagent turn with a `Read` call: a plugin agent with `maxTurns: "2"` stopped after 2 turns, as `maxTurns: 2` did, and one without the field ran 9 turns until the stand-in answered with text. The reference implementation accepts the text too. |
| J5.6 | The `.claude/agents/` of `--add-dir` directories rank after the project's own directories, in the order the directories were added (§5.5). | The docs say they load "alongside your project subagents" without an order. See Design decisions. |
| J5.7 | A custom agent of any source whose type equals a built-in's replaces it; a built-in's prompt and exact read-only tool set are the client's own (§5.5, §5.12.4). | The docs say a user or project `Explore` overrides the built-in; managed and `--agents` outrank both, so they do too. The docs publish neither the built-ins' prompts nor the read-only list, only what is denied. |
| J5.8 | A specifier on a `tools` entry (`Bash(git status *)`) grants the whole tool; an unanchored `*` or `mcp__*` in `tools` matches no tool (§5.7.2). | The docs state the whole-tool rule for `disallowedTools` only and give `mcp__*` only as a `disallowedTools` entry; reading `tools` entries like allow rules (§13) is the nearest documented rule. |
| J5.9 | The zero-tools refusal fires only when every entry matched nothing in the filtered pool; an entry that `disallowedTools` removed counts as matched (§5.7.3). | `errors.md` says the refusal is skipped when `disallowedTools` removes every entry and fires when every entry "failed to match"; a mixed list is not described. |
| J5.10 | `Agent(<type>)` deny rules and `Agent(...)` allowlists match the agent type exactly and case-sensitively; for a plugin agent that is the scoped name (§5.7.4). | `sub-agents.md` says the rule uses "the subagent's name field", written before plugin scoping; the scoped name is what `subagent_type` carries and what `SubagentStart` matchers see. |
| J5.11 | A full model ID or `inherit` on the Agent call's `model` counts as unset (§5.8.2). | `AgentInput.model` allows only the four aliases, and the docs say the model "can't pass" the others; falling through to the definition is the safe reading. |
| J5.12 | With no `effort` field or parameter, on a model other than the main one, the client sends no effort level (§5.8.4). | `sub-agents.md` and `model-config.md` say the session's level "doesn't apply" there and name no other source. |
| J5.13 | A plugin agent's memory directory replaces `:` and path separators in the scoped name with `-` (`my-plugin:review:security` → `my-plugin-review-security`) (§5.10.3). | The docs name the directory `<name-of-agent>`; `:` is not a valid file-name character on Windows, and a separator must not leave the memory root. |
| J5.14 | A managed agent's frontmatter hooks need no folder trust (§5.12.1). | The docs exempt user and `--agents` agents and require trust for project and `--add-dir` ones; a managed agent does not come from opening a folder. |
| J5.15 | Without agent teams enabled, a `name` on an Agent call makes nothing addressable and starts no teammate; a call made by a subagent never starts a teammate (§5.12.5). | The docs define the parameter only "with agent teams enabled" and the teammate rule for calls "from the main conversation". |
| J5.16 | For `--agent` and the `agent` setting, an exact type of any source wins over a plugin agent's bare name; a bare name that two plugins share is refused with the scoped names listed; a plugin agent's bare name is the last part of its scoped name (§5.13). | `sub-agents.md` says a bare name finds a plugin agent and the scoped name disambiguates, without the rules for a clash with another source or for subfolders. |
| J5.17 | A validator reports an agent file whose frontmatter does not parse as an error, as §2.11 states for every skill, agent and command file (§5.4.4). Oracle 2.1.325 agrees: it reports `YAML frontmatter failed to parse: … At runtime this agent loads with its name taken from the filename and every other frontmatter field silently dropped.` as an **error**, and validation fails (exit 1). | `plugins/components.md` says only to run `claude plugin validate` to find such files. The 2.1.325 message confirms the runtime rule of §5.4.2. The same oracle read `name: [bad` (an unclosed flow sequence) without a parse error, which is §4's frontmatter reading to define. |
| J5.18 | The worktree-isolation checks of §5.3 item 4 belong to the client's command execution, not to agent loading. | `worktrees.md`, "How Claude Code enforces isolation", describes them as checks on each Bash, PowerShell or Monitor command before it runs, including a worktree removed while the subagent ran, which no reading of the agent file can foresee; the agent file only asks for isolation. A library that only loads plugins sees no command, so it owns none of the checks: what it returns is the parsed `isolation` field, and the host whose execution runs the commands applies them; conformance records the item as not applicable to such a library. |
