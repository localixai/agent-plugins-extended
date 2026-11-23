# 7. Hooks

A hook runs something automatically at a point in a session: a shell command, an HTTP request, a
call to an MCP tool, a one-turn prompt to a model, or a subagent. A Claude Code plugin ships its
hooks in `hooks/hooks.json` and in the manifest's `hooks` key (§2.8); the same configuration also
comes from settings files, managed policy, and the frontmatter of skills and agents. This chapter
states how every one of them is found, selected, run and read, so that a client runs a plugin's
hooks as Claude Code 2.1.330 does. Evidence: `hooks.md` unless a section names another page
(`hooks-guide.md`, `code-mode.md`, `plugins/components.md`, `plugins/troubleshooting.md`).

Hooks written as JavaScript functions that run inside the client (a hooks module, listed under
`modules` in the same `hooks/hooks.json`) make a plugin a mod; they are §10, and the hooks of this
chapter keep working beside them.

## Terms

| Term | Meaning |
| --- | --- |
| **Hook event** | The point in the lifecycle that fires, such as `PreToolUse` or `Stop` (§7.5). |
| **Matcher group** | An object under an event: an optional `matcher` that filters occurrences, and the `hooks` array of handlers that run when it matches (§7.2). |
| **Hook handler** | One entry of a group's `hooks` array: what runs, of type `command`, `http`, `mcp_tool`, `prompt` or `agent` (§7.3). |
| **Run** | One execution of one handler for one occurrence of an event, and its result (§7.4). |
| **Hook** | The feature in general. |

## Files of this chapter

| § | File | What it states |
| --- | --- | --- |
| 7.1 | This file | The lifecycle, and where hooks come from: settings files, managed policy, plugins, skills and agents. |
| 7.2 | [Configuration](configuration.md) | The configuration shape, how a hooks file loads, matchers and their patterns, `if` conditions, duplicates, concurrency and order, disabling hooks. |
| 7.3 | [Handlers](handlers.md) | Each handler type and its fields: `command` (exec and shell form, `shell`, the environment, async), `http`, `mcp_tool`, `prompt`, `agent`; timeouts; which types each event accepts. |
| 7.4 | [Results](results.md) | Exit codes and what stdout is, JSON output, HTTP responses, blocking when a hook fails, the prompt and agent response schema, permission update entries, combining several hooks, the auto mode classifier note, PowerShell edge cases, and the result rules particular to some events. |
| 7.5 | [Events](events.md) | Each event: when it fires, its matcher values, its input, its decision control and what exit code 2 does. |
| 7.6 | [Tools](tools.md) | The built-in tools whose names and inputs hooks see and match, and how Code Mode's tool calls from code (the `REPL` tool) meet rules and hooks. |
| 7.7 | This file | How these hooks relate to the core's portable hooks. |

## 7.1 Where hooks come from

### 7.1.1 The lifecycle

1. A client MUST fire the events of §7.5 at the points that section names, wherever the session
   runs: a terminal, an editor extension, a desktop application or a cloud session. Events have
   three cadences: per session (`SessionStart`, `SessionEnd`), per turn (`UserPromptSubmit`,
   `Stop`, `StopFailure`), and per tool call inside the agentic loop (`PreToolUse`, `PostToolUse`,
   which do not fire for an `EndConversation` call); the other events fire where §7.5 says.
   <!-- req: hooks.behavior.Hook lifecycle | hooks.guide.How hooks work -->
2. When an event fires, the client selects every handler of that event whose group's matcher
   matches the occurrence (§7.2.2) and whose `if` condition, when set, matches the tool call
   (§7.2.3). It passes each selected handler the event's JSON input (§7.5): on stdin for a command
   hook, as the POST body for an HTTP hook. The selected handlers run in parallel (§7.2.5), and the
   client reads their results (§7.4) and acts on them. A handler that is not selected never starts:
   no process is spawned for a command hook whose `if` fails.
   <!-- req: hooks.behavior.Hook lifecycle | hooks.behavior.How a hook resolves -->
3. Every event's input carries the common fields — among them `session_id`, `cwd` (the directory
   when the event fired) and `hook_event_name` — and the fields of its event: a `PreToolUse` input
   for a Bash call adds `tool_name` and `tool_input`, whose `command` is the shell command; a
   `UserPromptSubmit` input adds `prompt`; a `SessionStart` input adds `source`. §7.5 lists them
   all. A handler reads the input, does its work, and answers through its exit code and output
   (§7.4). <!-- req: hooks.guide.Hook input -->

For example, a `PreToolUse` group with `"matcher": "Bash"` and a handler with `"if": "Bash(rm *)"`
runs its script for `rm -rf /tmp/build` and never for `npm test`. When the script prints
`{"hookSpecificOutput": {"hookEventName": "PreToolUse", "permissionDecision": "deny",
"permissionDecisionReason": "..."}}`, the client blocks the call and shows Claude the reason; when it
exits 0 with no output, the call goes on through the normal permission flow (§13). A hook can deny a
call, but silence never approves one. <!-- req: hooks.behavior.How a hook resolves -->

### 7.1.2 Hook locations

The place that declares a hook decides when it runs:

| Location | Runs |
| --- | --- |
| `~/.claude/settings.json` | In every project of the user. <!-- req: hooks.behavior.Hook locations.~/.claude/settings.json --> |
| `.claude/settings.json` | In that project; the file can be committed. <!-- req: hooks.behavior.Hook locations..claude/settings.json --> |
| `.claude/settings.local.json` | In that project, on this machine only (the client adds it to `.gitignore` when it writes a setting there). <!-- req: hooks.behavior.Hook locations..claude/settings.local.json --> |
| Managed policy settings | Everywhere the policy applies (§14). <!-- req: hooks.behavior.Hook locations.Managed policy settings --> |
| A plugin's `hooks/hooks.json` and manifest `hooks` | While the plugin is enabled (§7.1.3). <!-- req: hooks.behavior.Hook locations.hooks/hooks.json --> |
| A skill's frontmatter `hooks` | From the skill's invocation to the end of the session (§7.1.4). <!-- req: hooks.behavior.Hook locations.Skill frontmatter --> |
| A subagent's frontmatter `hooks` | While that subagent runs (§7.1.4). <!-- req: hooks.behavior.Hook locations.Subagent frontmatter --> |

<!-- req: hooks.behavior.Hook locations | hooks.guide.Configure hook location -->

1. Every location uses the configuration shape of §7.2.1. A client MUST run the hooks of every
   location together: the hook entries of the settings levels **add up** rather than replace each
   other, so user, project and local settings add hooks without removing managed ones, and a
   plugin's hooks merge with the user's and the project's. <!-- req: hooks.behavior.Hook locations -->
2. A cloud session does not read the user's local `~/.claude/settings.json`; what reaches one is
   §12's. <!-- req: hooks.behavior.Hook locations -->
3. Hooks from settings files, managed policy and plugins also run inside subagents: a tool event of
   a subagent's tool call fires the same configured hooks as in the main conversation, with the
   `agent_id` and `agent_type` input fields naming the subagent (§7.5). <!-- req: hooks.behavior.Hook locations -->
4. **Restrictions.** Under managed `allowManagedHooksOnly`, the hooks of user, project and local
   settings and of plugins do not run, except the hooks of plugins that managed `enabledPlugins`
   force-enables; under `strictPluginOnlyCustomization` with `"hooks"`, only plugin and managed
   hooks run, and skill and agent frontmatter hooks follow §7.1.4. What else each setting narrows is
   §14. <!-- req: hooks.behavior.Hook locations -->
5. **Allowlists.** The HTTP hook allowlists `allowedHttpHookUrls` and `httpHookAllowedEnvVars` apply
   to the HTTP hooks of every location: set in managed settings they cover the hooks of managed
   settings, set in any settings file they cover the others, and a covered hook is checked against
   the list merged across files (§7.3.4, §12.7.1).
   <!-- req: hooks.behavior.Hook locations | hooks.behavior.Limit HTTP hooks -->
6. **Workspace trust.** The client MUST hold back the hooks of every settings file, the user's own
   included, in an interactive session until the user accepts the workspace trust dialog for the
   folder (or a parent whose trust extends to it). A `-p` or SDK session shows no dialog and treats
   the folder as trusted, so a repository's committed hooks run there. §13 states trust; the
   frontmatter rules are §7.1.4. <!-- req: hooks.behavior.Hook locations -->
7. Edits to a settings file's hooks SHOULD take effect without a restart: the client watches the
   files (§12). A client SHOULD offer a read-only listing of the configured hooks, labelled by where
   each comes from (Claude Code's `/hooks`), that also lists skill hooks once the skill has been
   invoked. <!-- req: hooks.guide.Configure hook location -->

### 7.1.3 Plugin hooks

1. A plugin declares hooks in `hooks/hooks.json` at its root and in the manifest's `hooks` key; both
   load and merge (§2.8). The file wraps the event map in a top-level `"hooks"` key, in the shape of
   the `hooks` object of `settings.json`, so a settings hook can be copied in unchanged; it MAY also
   hold a top-level `description` string, which the client does not act on, and the `modules` key of
   a mod (§10). <!-- req: hooks.components.Hooks -->
2. A client MUST register a plugin's hooks when a session loads the plugin, not when one of its
   skills or commands is first used, and fire them on their events from then on. A plugin limits
   when a hook runs with its matcher and `if`, never by when its other components are used.
   <!-- req: hooks.components.When plugin hooks fire -->
3. **Two enabled plugins with one manifest name.** Only one of them registers the hooks of its
   `hooks/hooks.json`: the copy that managed settings turn on, else the copy loaded first. The
   other's plugin details show a note that begins `Its hooks.json hooks do not run` and names the
   copy holding the name (Claude Code 2.1.296 or later; §16). <!-- req: hooks.components.Hooks | install.troubleshooting.Hook loads but never fires -->
4. **Load failures.** A client MUST report these in the plugin's error list, and the hooks they
   name do not run:
   - `Couldn't load hooks from <path>: <reason>` or `Failed to load hooks from <path>: <reason>` —
     the hooks file is not valid JSON, lacks the top-level `hooks` key, or fails the hooks schema in
     a way that keeps it from loading (§7.2.1 says which failures drop one entry and which drop the
     file or the plugin); the reason names the problem.
   - `hooks path not found: <path>` — the manifest's `hooks` names a file that does not exist
     (§2.5).
   - `hooks path escapes plugin directory: <path>` — the path resolves outside the plugin root
     (§2.5).

   A validator (§17) SHOULD catch the first case before publication.
   <!-- req: install.troubleshooting.Hooks fail to load -->
5. **A hook that never fires.** A hook that loads without error but never runs is diagnosed in this
   order: the shadowing note of item 3; an event name spelt with the wrong case (event names are
   case-sensitive, and an unknown one never fires, §7.2.1); a matcher that does not match the value
   (§7.2.2); then the debug log, which records which hooks matched and, for one that ran, its exit
   code. A client MUST record that much in its debug log. <!-- req: install.troubleshooting.Hook loads but never fires -->
6. When the directory the session loaded a plugin's hooks from no longer exists, the hook MUST NOT
   run; the client reports an error that begins `Failed to run: Plugin directory does not exist:
   <path>`, once per session for each event and command, and a plugin reload
   re-registers the hooks from the plugin's current directory (§16).
   <!-- req: install.troubleshooting.hook error notices in the transcript -->

### 7.1.4 Hooks in skills and agents

A skill's and an agent's frontmatter `hooks` take the same event map as settings (§4.9.5, §5.12.1).

1. **Agent hooks** MUST run only while that agent runs, and be removed when it finishes. A `Stop`
   hook declared there MUST be registered as `SubagentStop` when the agent runs as a subagent,
   since that is the event that fires when a subagent completes. <!-- req: hooks.behavior.Hooks in skills and agents -->
2. **Skill hooks** MUST NOT run before the user or Claude invokes the skill. Once registered they
   keep running, on later turns too, until the user exits or leaves the conversation with a command
   such as `/clear` or `/resume`, which removes them. A handler with `once: true` is removed sooner,
   after its first successful run (§7.3.1). <!-- req: hooks.behavior.Hooks in skills and agents | hooks.behavior.Hook locations.Skill frontmatter -->
3. **Trust.** A project skill's frontmatter hooks follow the settings-file trust rule of §7.1.2
   item 6, so they can run under `-p` in a folder the user has not trusted. A project
   subagent's frontmatter hooks run only after the user accepts the trust dialog for the folder the
   agent file came from; a `-p` session does not count as accepting it (§5.12.1, §13).
   <!-- req: hooks.behavior.Hooks in skills and agents -->
4. A plugin agent's frontmatter `hooks` is ignored (§5.6.1); a plugin ships its hooks in
   `hooks/hooks.json`.
5. **Under `allowManagedHooksOnly`** (§12.7.3) a skill's frontmatter hooks register on invocation
   only when the skill is in the managed settings directory or belongs to a plugin that managed
   `enabledPlugins` force-enables; the hooks of every other skill — personal, project, nested,
   added-directory, account-synced, bundled, and other plugins' — do not register, and the skill
   runs without them. Agent frontmatter hooks never run under the key, whatever the agent's
   source (Judgment J7.3).

#### 7.1.4.1 Limits on skill hooks

A skill that was invoked registers **none** of its frontmatter hooks in two cases, and the client
MUST then run the skill without them:

1. **Plugin-only lock.** Managed `strictPluginOnlyCustomization` that locks hooks keeps a skill's
   frontmatter hooks only for a plugin skill, a bundled skill, or a skill in the managed settings
   directory (§14). Under the same lock the hooks of the user's own settings files do not run.
2. **Hook limit.** Per session, the skills of one source — the project, the personal skills folder,
   and each plugin, each counted separately — register at most 1,024 hooks, whose matchers total at
   most 16,384 characters, a matcher counted once for each hook under it. Both totals build up skill
   by skill in invocation order; a skill whose hooks would pass either limit registers none of them,
   and the debug log records a line containing `registers none of its hooks` that names the skill.

<!-- req: hooks.behavior.Limits on skill hooks -->

A skill whose hooks are missing from the hook listing after invocation is otherwise one whose
frontmatter did not parse (§4).

## 7.7 Claude Code hooks and the core's portable hooks

The core defines portable hooks in core §7.3: a `hooks.json` at the plugin root, five events
(`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`), and an exec-only
handler. This chapter is Claude Code's hooks, a different component of a different package form
(§1.3). They differ in these respects, and nowhere else matters for an implementer; §18 maps one
onto the other.

| | Core portable hooks (core §7.3) | Claude Code hooks (this chapter) |
| --- | --- | --- |
| File | `hooks.json` at the root, with a required canonical `$schema` and no other top-level field. | `hooks/hooks.json` with a `hooks` wrapper (optional `description`, `modules`), plus the manifest's `hooks` key, settings files, managed policy and frontmatter (§7.1). |
| Shape | Event → array of handlers. | Event → matcher groups → handlers (§7.2.1). |
| Filtering | None: every handler runs on every occurrence. | `matcher` per group and `if` per handler (§7.2.2, §7.2.3). |
| Handler | `command` (one token, bare name or `./` path), `args`, `extensions`; no placeholder in `command`. | Five types (§7.3); a command hook runs in exec form with `args` or through a shell without, and placeholders are substituted in `command` too. |
| Working directory | The plugin root. | The session's current directory (§7.3.2). |
| Placeholders | `${PLUGIN_ROOT}`, `${PLUGIN_DATA}` in `args`. | `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_PROJECT_DIR}`, `${user_config.*}` (§3.2). |
| Exit status | 0 is a result; any other status is a failure with no decision. | 0 is success, 2 a blocking error, any other a non-blocking error unless the hook's failure blocks; JSON printed with any status can still decide (§7.4.1). |
| Output | Nothing, or one object of the event's output schema; `{}` is invalid. Fields are snake case (`additional_context`), decisions `allow`/`deny`/`continue`. | Universal fields, top-level `decision: "block"` and `reason`, and `hookSpecificOutput` with camel-case fields (`additionalContext`, `permissionDecision`); plain-text stdout is valid and on some events becomes context (§7.4.5). |
| Unknown output | Invalid. | Unknown keys are ignored (Judgment J7.30). |
| Failure | A failed invocation contributes nothing; the client MAY block. | `onFailure` decides per command or HTTP hook; a timeout on `PreModelSwitch` blocks (§7.4.3). |
| Inputs | Three common fields, closed objects. | Many common fields (`transcript_path`, `permission_mode`, `agent_id`, ...) and event fields (§7.5); `PreToolUse` carries no `tool_profile`. |
| `Stop` | Never for subagents; input `continuation_active`; result `decision: "continue"`. | `SubagentStop` for subagents; input `stop_hook_active`; result `decision: "block"` with `reason` (§7.5). |

## Design decisions

### Why every location adds hooks instead of replacing them

A hook is often a guard someone else relies on: an administrator's audit hook, a project's
formatting hook, a plugin's safety check. If a project's settings could replace the user's or the
managed hooks, adding one hook in a repository would silently remove another party's guard. So
hooks add up across levels, and only the explicit switches (`disableAllHooks`,
`allowManagedHooksOnly`, the plugin-only lock) remove them, each limited by who may set it.

### Why plugin hooks register when the plugin loads

Tying a plugin's hooks to the use of its skills would make a guard depend on whether Claude happened
to call a skill first. Registering at load makes a plugin's hooks as predictable as settings hooks;
the matcher and `if` are the tools for narrowing them.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J7.1 | The `description` of a hooks file is a free string the client does not act on; a validator does not report it (§7.1.3). | `hooks.md`, "Reference scripts by path", calls it optional and gives it no effect. Oracle 2.1.325: `claude plugin validate` on a hooks file with `description` passes with nothing to report. |
| J7.2 | Registry order — the order handlers are listed in, which §7.2.5 and §7.4.8 rely on — is: first the hooks of the settings files, one file after another in §12.3's precedence order, highest first (managed settings, with the managed source and its drop-ins in the order §12.5 reads them; then `--settings`; `.claude/settings.local.json`; `.claude/settings.json`; `~/.claude/settings.json`); then the plugins' hooks, plugin by plugin in the order §16 loads them (each plugin's hooks file before its manifest's `hooks`, §2.6); then the skill and agent frontmatter hooks and any hooks the session adds later, in the order they register. Inside one source, events, groups and handlers keep the order the file writes them. A gate (§12.7.3, trust) removes entries without reordering the rest. | The docs run handlers in parallel and give no order; a fixed order is what makes the merge of several hooks' scalar fields reproducible. Settings before plugins and highest precedence first puts the hooks of the party with the most authority first, as §12.3 ranks them. Reference: `src/hooks/register.ts` registers in file order and appends sources as they arrive. |
| J7.3 | Under `allowManagedHooksOnly`, a skill's frontmatter hooks follow the split the key makes for every other source: they run for a skill of the managed settings directory (its hooks are the organization's: "managed hooks run") and for a skill of a force-enabled plugin (that plugin's hooks run), and are blocked for every other skill, bundled skills included, since a bundled skill's hooks are none of managed, SDK or force-enabled hooks (§7.1.4 item 5). | settings-reference.md, "What runs under `allowManagedHooksOnly`", lists managed, SDK and force-enabled plugin hooks as what runs and agent frontmatter hooks among what is blocked, and does not name skill frontmatter. hooks.md, "Limits on skill hooks", treats a skill of the managed settings directory as the organization's under the plugin-only lock; the same reading applies here. No oracle: hooks fire only in a live session under managed settings. |
