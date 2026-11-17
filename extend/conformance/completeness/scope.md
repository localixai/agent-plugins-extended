# Scope audit: what the reference implementation left out

Re-measured 2026-11-16 after the fixes: all 56 items that were missing or partly stated are now
stated, each with a `<!-- docs: … -->` marker; none is open.

Status: 2026-11-16, Claude Code 2.1.321. Non-normative; nothing here changes the specification.

`requirements.json` was taken from the reference implementation, whose scope rules dropped whole
documentation pages (`spec/out-of-scope-pages.json`), headings and table rows
(`spec/out-of-scope.json`) of `~/Documents/llx-plugin`. This file asks of each one whether a plugin
can observe the excluded behaviour: whether its files, hooks, skills, agents, MCP or LSP servers,
monitors, mods, settings defaults or install flow would behave differently in a client that skips
it. Each item is **should be in** (a plugin depends on it), **partly** (one part does), or
**correctly out** (the host's engine, UI, a hosted service or the SDK client: a plugin cannot see
it). For every item of the first two classes the chapters were searched first; "Ours" says whether
the text already states it without a requirement id ("stated") or does not ("missing").

## Summary

| Excluded | should be in | partly | correctly out | total |
| --- | --- | --- | --- | --- |
| Whole pages | 0 | 19 | 156 | 175 |
| Headings | 58 | 51 | 1070 | 1179 |
| Table rows | 33 | 22 | 552 | 607 |
| Pages seen by neither list | 0 | 0 | 3 | 3 |
| **All** | **91** | **92** | **1781** | **1964** |

Of the 183 items in the first two classes, 127 were stated in the chapters without a requirement id
at the first measurement and 56 were missing or stated only in part. After the fixes all 183 are
stated; the 56 carry `<!-- docs: <page> | <heading> -->` markers (C4), so they are not counted as
covered requirements. One marker gap remains, not a gap in the text: `settings-reference.md`,
"Settings index — sandbox", is stated under the `sandbox` marker of §9.1.4 item 8 and has none of
its own. The 56, by weight, and where they are now:

1. **MCP tasks** (11 headings): §8.10.8 items 1–10 (08-mcp.md).
2. **`subagentStatusLine`** (`statusline.md`, `settings-reference.md`): §12.6 item 5, §12.6.1
   and the §12.7.1 index row (12-settings.md).
3. **`CLAUDE_CODE_SHELL_PREFIX`**: §3.6.5 (03-environment.md), §7.3.2.3 (07-hooks/handlers.md, J7.66),
   §8.2.1 (08-mcp.md, J8.26).
4. **A plugin agent as a teammate**: §5.12.6, with the switch in §5.12.5 (05-agents.md).
5. **Tool search** (`ENABLE_TOOL_SEARCH`, 8 headings): §8.10.10 (08-mcp.md).
6. Smaller gaps, each now stated: MCP resources (§8.10.9), v2 notification-stream reopen limits
   (§8.8 item 10), auto-backgrounding cancel (§8.10.7), OAuth refusal messages (§8.7.3), the
   elicitation timeout in `-p` (§8.10.5 item 3), the sandbox not wrapping MCP and LSP servers
   (§8.2.1, §9.1.4 item 8), `--plugin-dir` across resume and backgrounding (§17.15.1 items 5–6,
   §3.6.3), monitors stopped by backgrounding (§9.2.3 item 6), LSP operations (§9.1.4 item 5),
   `PreModelSwitch` and output-style messages (§7.5.33, §6.1.4), Desktop SSH/WSL plugin delivery
   (§16.5.6), the scratchpad path (§7.5.2), `system/init` plugin diagnostics (§17.15.2).

## Should be in and partly

Grouped by page; one line per page or per group of headings that share a finding. "Chapter" is where
it belongs in `extend/spec/1.1.0/`.

### `agent-sdk/claude-code-features.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| partly | whole page | §12, §16 | stated §12, §16 (`--setting-sources`/`settingSources`) | `settingSources` decides whether user and project `enabledPlugins` (and so their plugins) load in an SDK session. In the text through `--setting-sources`; the SDK options are correctly out. |

### `agent-teams.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| partly | whole page | §5 | stated §5.12.6 table and resume text, 05-agents.md:716 (`docs: agent-teams.md | Use subagent definitions for teammates`); switch §5.12.5 | "Use subagent definitions for teammates": a plugin agent named as a teammate gets its `tools` (plus `SendMessage` and the Task tools in process), `model`, `disallowedTools`, `effort` and `autoCompactWindow` (in process only), its body appended (in process) or replacing the system prompt (split pane); its `skills` are never applied; `mcpServers` only in split-pane mode. A teammate brought back re-applies a project definition only from a trusted folder (`errors.md`, "Teammate's agent definition was not restored"). §5 names teammates only for tools (§5.7.1) and plan mode (§5.9). The `TeammateIdle`/`TaskCreated`/`TaskCompleted` hooks are stated in §7.5; the team scheduler, display modes and UI are correctly out. |

### `agent-view.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| partly | whole page | §9.2.3, §17 | stated 17-cli.md:759 §17.15.1 item 6, 09-lsp-monitors-channels.md:210 §9.2.3 item 6, 03-environment.md:529 (`docs: agent-view.md | What carries over when you background`, `… | Settings, plugins, and MCP servers`) | Backgrounding a session carries `--plugin-dir` (and `--settings`, `--setting-sources`, `--mcp-config`) into the background session, and stops work that cannot move, such as a running monitor: a plugin's running monitors end when the session is backgrounded. Agent view UI is correctly out. |

### `channels-reference.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| should be in | "Test during the research preview" | §9.3.2 | stated §9.3.2 (`--dangerously-load-development-channels`) | How a plugin channel is registered for a session before it is allowlisted. |

### `claude-directory.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| partly | whole page | §7.5.2 | stated §7.5.2, 07-hooks/events.md:105 (`docs: claude-directory.md | Session scratchpad directory`): shape, `CLAUDE_CODE_TMPDIR`, lifetime | The plugin cache, data directory, `.trash` and set-aside files are stated (§3.1.2, §16); the frontmatter field lists are stated in §4–§6. Not stated: the shape and lifetime of the scratchpad directory hooks receive as `scratchpad_dir` (`<tmp>/claude-<uid>/<project>/<session>/scratchpad`, moved by `CLAUDE_CODE_TMPDIR`, deleted with the transcript). The rest (CLAUDE.md, rules, memory, purge) is correctly out. |

### `cli-reference.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| should be in | "CLI flags — --allow-dangerously-skip-permissions"; "CLI flags — --allowedTools / --allowed-tools"; "CLI flags — --dangerously-skip-permissions"; "CLI flags — --disallowedTools / --disallowed-tools" | §13 | stated §13 | Session rules and modes that allow or deny a plugin's tools and skills. |
| should be in | "CLI flags — --append-subagent-system-prompt"; "CLI flags — --append-subagent-system-prompt-file" | §5 | stated §5 | Text appended to every subagent's system prompt, a plugin agent's included. |
| should be in | "CLI flags — --init"; "CLI flags — --init-only"; "CLI flags — --maintenance" | §7.5 | stated §7.5 (`Setup`) | They fire the `Setup` hook with trigger `init` or `maintenance`. |
| partly | "CLI flags — --continue / -c"; "CLI flags — --resume / -r" | §17 | stated 17-cli.md:751 §17.15.1 item 5, 03-environment.md:526 §3.6.3 (`docs: cli-reference.md | CLI flags — --continue / -c`, `… | CLI flags — --resume / -r`) | A resumed session does not restore `--plugin-dir` (see `sessions.md`). |
| partly | "CLI flags — --debug"; "CLI flags — --debug-file <path>" | §17 | stated (each chapter names its debug-log lines) | Where a plugin's load and hook diagnostics are written. |
| partly | "CLI flags — --teammate-mode"; "CLI flags — --worktree / -w" | §5, §12 | stated §12 | A worktree session loads the main checkout's project plugins; teammate mode decides how a plugin agent runs as a teammate (see `agent-teams.md`). |

### `cloud-environments.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| partly | whole page | §16 | stated §16 (cloud sessions skip repository marketplaces and plugins) | "What carries over from your setup": plugins and marketplaces from the repository's `.claude/settings.json` and plugins enabled only in user settings do not load in a cloud session. In the text; the environment service is correctly out. |

### `commands.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| partly | whole page | §16 | stated §16 (`/reload-plugins`) | `/reload-plugins [--force]` is stated (§16). The `/` menu matching (a plugin skill matching on its bare name) is UI and correctly out. |

### `context-window.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| partly | whole page | §4 | stated §4 (compaction) | After compaction, skill descriptions are rebuilt and invoked skill bodies re-attached under 5,000 tokens each and 25,000 in all, oldest dropped; `SessionStart` with source `compact` runs. In the text. |

### `cross-session-messaging.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| partly | whole page | §12 | stated §12 | `CLAUDE_CODE_MESSAGING_SOCKET` and `CLAUDE_CODE_MESSAGING_TOKEN` are exported to hooks before `SessionStart`; own-child messages from a hook are delivered. In the text; messaging itself is correctly out. |

### `desktop.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| partly | whole page | §16 | stated §16.5.6 item 5, 16-install.md:320 (`docs: desktop.md | Install plugins`, `… | Windows remote machines`, `… | Files and processes on the remote machine`) | Which plugins a Desktop session gets: SSH sessions copy the user's plugins to `~/.claude/remote/plugins/` and skip a plugin with a file name Windows cannot store on a Windows host; WSL sessions get no plugins; managed plugins withheld under `disableSideloadFlags` (stated). Applies only to a client that claims the Desktop surfaces; the app UI is correctly out. |

### `env-vars.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| should be in | "Variables — CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS"; "Variables — CLAUDE_CODE_AUTO_COMPACT_WINDOW"; "Variables — CLAUDE_CODE_BRIDGE_SESSION_ID"; "Variables — CLAUDE_CODE_CHILD_SESSION"; "Variables — CLAUDE_CODE_DISABLE_BACKGROUND_TASKS"; "Variables — CLAUDE_CODE_DISABLE_BUNDLED_SKILLS"; "Variables — CLAUDE_CODE_DISABLE_EXPLORE_PLAN_AGENTS"; "Variables — CLAUDE_CODE_EFFORT_LEVEL"; "Variables — CLAUDE_CODE_ENABLE_TASKS"; "Variables — CLAUDE_CODE_GIT_BASH_PATH"; "Variables — CLAUDE_CODE_MESSAGING_SOCKET"; "Variables — CLAUDE_CODE_MESSAGING_TOKEN"; "Variables — CLAUDE_CODE_PROCESS_WRAPPER"; "Variables — CLAUDE_CODE_PROJECT_DIR_NAME"; "Variables — CLAUDE_CODE_REMOTE"; "Variables — CLAUDE_CODE_SAFE_MODE"; "Variables — CLAUDE_CODE_SIMPLE"; "Variables — CLAUDE_CODE_USE_POWERSHELL_TOOL"; "Variables — CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS"; "Variables — CLAUDE_EFFORT" | §3, §5, §7 | stated (grep finds each in the chapters) | Exported to hook and Bash processes, or changing which agents/skills exist or how they run. Stated in the text without an id. |
| should be in | "Variables — CLAUDE_CODE_SHELL_PREFIX" | §7.3, §8.2.1 | stated §3.6.5 table (03-environment.md:558), §7.3.2.3 (07-hooks/handlers.md:123, J7.66), §8.2.1 (08-mcp.md:131, J8.26) (`docs: env-vars.md | Variables — CLAUDE_CODE_SHELL_PREFIX`) | The prefix wraps every hook command, status line command and stdio MCP server start command Claude Code spawns (not PowerShell): a plugin's hook and server run as `<prefix> <command>`. |
| partly | "Variables — CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS" | §5.12.5 | stated §5.12.5, 05-agents.md:676 (`docs: env-vars.md | Variables — CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`) | Turns on agent teams, under which a plugin agent can be a teammate and `name` on an Agent call starts one; §5 says "enabled" without naming the switch. |
| partly | "Variables — CLAUDE_CODE_FORK_SUBAGENT" | §5.12.3 | stated §5.12.3, 05-agents.md:646 (`docs: env-vars.md | Variables — CLAUDE_CODE_FORK_SUBAGENT`) | Fork mode decides whether the main conversation can wait for a plugin agent or only start it in the background; §5.12.3 refers to fork mode without naming the switch. |
| partly | "Variables — CLAUDE_CODE_REMOTE_SESSION_ID"; "Variables — CLAUDE_JOB_DIR" | §3 | stated §3.3, 03-environment.md:168 and :172 (`docs: env-vars.md | Variables — CLAUDE_CODE_REMOTE_SESSION_ID`, `… | Variables — CLAUDE_JOB_DIR`) | Variables a hook or MCP server process inherits: the cloud session id; a background session's `~/.claude/jobs/<id>` directory. |
| partly | "Variables — ENABLE_TOOL_SEARCH" | §8.10 | stated §8.10.10 items 2–3, 08-mcp.md:793 (`docs: env-vars.md | Variables — ENABLE_TOOL_SEARCH`) | Whether a plugin server's tools are sent upfront or deferred behind tool search (`true`, `auto` at 10% of context, `false`), and which cases keep tool search off. `alwaysLoad` is stated; the variable and the `auto` threshold are not. |

### `errors.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| should be in | "a hook changed this call's input after auto mode reviewed it"; "MCP server URL is missing or not a valid URL"; "Tool input schema is invalid"; "MCP tool name over 128 characters"; "Server rejected the Authorization header minted by the configured headersHelper"; "Unknown command"; "Skipping connection (recent failure cached; retries automatically in 15 min, or edit the plugin config to retry now)"; "Command blocked by the worktree isolation checks"; "Managed settings contain invalid entries, including PreToolUse/PermissionRequest hooks that are NOT loaded"; "headersHelper not run" | §5.3, §7.4, §8, §14, §17 | stated (§7.4 results, §8.3/§8.5/§8.6/§8.8/§8.10.3, §14, 17-cli.md) | Diagnostics a plugin's hook, server or skill produces. |
| partly | "MCP server needs you to sign in again"; "Couldn't read the stored credentials for MCP server"; "Issuer mismatch in authorization response"; "Refusing to send credentials to non-https token endpoint" | §8.7 | stated §8.7.3 items 1–4, 08-mcp.md:454–478 (`docs: errors.md | <each heading>`) | What a plugin's remote server sees on an expired token or a bad OAuth endpoint, and the message the user gets. |
| partly | "Model switch was blocked by a PreModelSwitch hook" | §7.5.33 | stated §7.5.33, 07-hooks/events.md:1128–1142 (`docs: errors.md | Model switch was blocked by a PreModelSwitch hook`) | The text shown when a plugin's `PreModelSwitch` hook blocks: `Model switch to <model> was blocked by a PreModelSwitch hook: <reason>`. |
| partly | "Custom output styles can't be selected over Remote Control"; "Output styles are saved to local settings which this session doesn't load" | §6 | stated §6.1.4, 06-styles.md:114 and :120 (`docs: errors.md | <each heading>`) | When a plugin output style cannot be selected (sources without `local`, Remote Control). |
| partly | "MCP server connection closed before the tool call was answered" | §8.10.2 | stated §8.10.2, 08-mcp.md:587 (`docs: errors.md | MCP server connection closed before the tool call was answered`) | The message when a call is lost without the hints; the retry with them is stated. |
| partly | "MCP tool call timed out with the server's question unanswered" | §8.10.5 | stated §8.10.5 item 3, 08-mcp.md:638 (`docs: errors.md | MCP tool call timed out with the server's question unanswered`) | An elicitation during a `-p` call that outlives the time limit ends the call with a fixed message to Claude. |

### `headless.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| partly | whole page | §17 | stated 17-cli.md:782 §17.15.2, "Load diagnostics in `-p` stream output" (`docs: headless.md | Fail CI when a plugin or MCP server doesn't load`, `… | Track plugin installs`); `--bare` as before | `--bare` skipping plugin discovery and not running a flag-loaded plugin's hooks is stated (17-cli.md `--bare` row). Not stated: the `system/init` event's `plugins` and `plugin_errors` (`plugin`, `type`, `message`, `path` for a failed `--plugin-dir`) and the `system/plugin_install` events under `CLAUDE_CODE_SYNC_PLUGIN_INSTALL`: the load diagnostics a plugin's CI reads. Output formats, retries and SIGTERM are correctly out. |

### `hooks-guide.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| partly | "Hook not firing"; "Hook error in output"; "Fields at the wrong level"; "Check what a hook did" | §7.4 | stated §7.4 (non-blocking notice, `Hook JSON output had unrecognized keys`, skill hooks listed after invocation) | Facts inside the advice; the advice is out. |

### `keybindings.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| partly | whole page | §10.20–§10.28 | stated §10.27.5, 10-mods/interface.md:425, the default contexts, actions, chords and fields (`docs: keybindings.md | Contexts`, `… | Above-prompt actions`, `… | Pane actions`, `… | Unbind default shortcuts`, `… | Text fields`) | The `Pane`, `PaneField`, `AbovePrompt*` contexts and their default actions (Tab, Shift+Tab, Enter, Escape, arrows, PageUp/Down, Home/End, Ctrl+X chords) decide which keys reach a mod's pane or band and which the client keeps; a user's rebinding changes that. The text names actions but not the default table. The rest of the page is correctly out. |

### `mcp.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| should be in | "How Claude Code stops a stdio server" | §8.2.1 | stated §8.2.1 | SIGINT, SIGTERM after 100 ms, SIGKILL after 400 ms more; on Windows stdin closed, tree ended after 300 ms. |
| should be in | "Dynamic tool updates"; "Automatic reconnection"; "Mid-session drops of a remote server"; "Failed first connections"; "Stdio servers that exit or fail to start"; "Failed discovery requests"; "How Claude learns that a server failed" | §8.8 | stated §8.8 (items 1, 7, 8) | How the client treats a plugin server that changes its lists, drops, fails or exits. |
| should be in | "Time limits on MCP tool calls" | §3, §8 | stated §3 (`MCP_TOOL_TIMEOUT`, `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT`) | Wall-clock and idle limits on a plugin tool call. |
| should be in | "MCP tasks that run on the server"; "Stop an MCP task or get its result"; "Answer a question from an MCP task"; "Exit, clear, or resume while an MCP task runs"; "What a call needs to become an MCP task"; "Status messages on an MCP task"; "Time limits on MCP tasks"; "Make Claude wait for the result of an MCP task"; "MCP tasks for server authors"; "Answer the call with a task"; "Report status, results, and questions" | §8.10 | stated §8.10.8 items 1–10, 08-mcp.md:681–769 (`docs: mcp.md | <each of the 11 headings>`) | The task protocol a plugin's MCP server can answer with on revision 2026-07-28: when a call may become a task, the `resultType: "task"` result (`taskId`, `status`, `statusMessage`, `pollIntervalMs`, `ttlMs`), the refusal `Unsupported result type 'task' for tools/call`, status and questions, cancellation, limits, and what survives exit, `/clear` and resume. |
| partly | "MCP client runtimes"; "Notification streams on the v2 runtime" | §8.8 | stated §8.8 items 9–10, 08-mcp.md:520 and :527 (`docs: mcp.md | MCP client runtimes`, `… | Notification streams on the v2 runtime`) | Which protocol revision a plugin server is offered and, on v2, how often a closed `list_changed` stream is reopened (three times within 10 s; after five reopens in an hour, a six-hour wait). The reopen limits are missing. |
| partly | "Automatic backgrounding of long tool calls" | §8.10 | stated §8.10.7 items 1–3, 08-mcp.md:668 (`docs: mcp.md | Automatic backgrounding of long tool calls`) | A plugin tool call still running after two minutes becomes a background task; stopping it cancels the call though the server may finish. The variable is stated; the cancel and notification behaviour is not. |
| partly | "Use MCP resources"; "Reference MCP resources" | §8.10 | stated §8.10.9, 08-mcp.md:782 (`docs: mcp.md | Use MCP resources`, `… | Reference MCP resources`; J8.28) | A plugin server's resources are offered in the `@` typeahead and read with `resources/read` when mentioned; the UI part is out, the requests the server receives are not stated. |
| partly | "Scale with MCP tool search"; "Tool search for MCP server authors"; "Change the description length limits"; "Mark a tool to load upfront or stay deferred"; "Configure tool search"; "Tools that stay deferred below the ENABLE_TOOL_SEARCH=auto threshold"; "Exempt a server from deferral"; "Defer a server's tools" | §8.2, §8.10 | stated §8.10.10 items 1–5, 08-mcp.md:788–813 (`docs: mcp.md | <each of the 8 headings>`) | Whether a plugin server's tools are deferred, and how long its instructions and descriptions may be (4,096 upfront, 16,384 deferred). The `ENABLE_TOOL_SEARCH` modes and the `auto` threshold are missing. |

### `memory.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| partly | whole page | §7.5, §10 | stated §7.5 (InstructionsLoaded), 10-mods/README.md | `InstructionsLoaded` does not fire for an `AGENTS.md` read directly, only for one a `CLAUDE.md` imports; `AGENTS.md` is read by the built-in plugin `cc-plugin-agents-md@builtin`, configured under `pluginConfigs`, disabled from `/plugin`. Both are in the text. CLAUDE.md, rules and auto memory themselves are correctly out. |

### `model-config.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| partly | whole page | §4.9.3, §5.8, §12 | stated §4.9.3, §5.8, §12 | How a skill's or agent's `model`/`effort` frontmatter resolves: aliases, `inherit`, the `availableModels`/`deniedModels` allowlist (a blocked skill override is ignored, a blocked agent model falls back), `maxEffortLevel` caps, subagent effort on another model. All in the text; pickers, fallback chains, 1M context, pricing are correctly out. |

### `plugins/dependencies.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| should be in | "Dependencies when your plugin loads from claude.ai" | §16.23–§16.30 | stated 16-dependencies.md (`@synced` dependents) | How a synced dependent's marketplace dependencies are met. |

### `plugins/host-marketplace.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| partly | "Distribute through organization settings" | §1 | stated §1 (top-level `bin/` refused by hosted surfaces) | The organization-sync refusals a plugin hits (`bin/`, accepted sources); the sync service is out. |

### `plugins/install.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| partly | "Plugins from your claude.ai account"; "Add a marketplace from claude.ai"; "Manage plugins synced from claude.ai" | §16.10 | stated §16.10 | The client side of synced plugins; the claude.ai pages are out. |

### `plugins/loading.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| should be in | "Plugins synced from claude.ai"; "Sync timing in terminal sessions"; "Sign-in requirements for terminal sync"; "Control which synced plugins load" | §16.10 | stated §16.10 | A synced plugin loads as `<name>@synced` with installed-plugin trust; when sync runs; how it is disabled or required. |
| partly | "Sync timing in cloud Cowork sessions" | §16.10 | stated §16.10 (Cowork download at start) | Cowork timing is a hosted surface; the download at session start is in the text. |

### `plugins/mods/troubleshoot.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| partly | "Find out why a mod does nothing"; "Read the debug log" | §10.40–§10.46 | stated 10-mods/troubleshooting.md | The debug-log lines a mod produces; the UI walk-through is out. |

### `plugins/org.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| should be in | "When each surface applies the plugin keys" | §14.8 | stated 14-policy-org.md item on `-p` background installs and cloud sessions | When managed and repository `enabledPlugins`/`extraKnownMarketplaces` take effect per surface. |
| partly | "Marketplaces hosted on claude.ai" | §2, §15 | stated §15.8.1, 15-marketplaces.md:522 (`docs: plugins/org.md | Marketplaces hosted on claude.ai`) | A plugin from a claude.ai-hosted marketplace; the hosting service is out. |

### `prompt-caching.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| partly | whole page | §16 | stated §16 (reload, `--force`, `/cd`, `--plugin-dir` folders) | "Enabling or disabling a plugin" and "When plugin changes apply": which component changes need a full re-read and when a change applies (menu close, command source, install activation, `/cd`, a `--plugin-dir` folder). In the text; cache costs are correctly out. |

### `sandboxing.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| partly | whole page | §8.2.1, §9.1.4 | stated §8.2.1 (08-mcp.md:136), §9.1.4 item 8 (09-lsp-monitors-channels.md:142) (`docs: sandboxing.md | What runs outside the sandbox`) | "What runs outside the sandbox": command hooks, local MCP servers, plugin monitors, LSP servers, the status line and mods run with full access even when the sandbox is on. Hooks, monitors and mods are stated; stdio MCP servers (§8.2.1) and LSP servers (§9.1.4) are not. The sandbox itself is correctly out. |

### `scheduled-tasks.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| partly | whole page | §4 | stated §4 (`/loop`) | A scheduled `/loop` fire runs only skills Claude may invoke itself (not `disable-model-invocation`, not hidden by `skillOverrides` or a `Skill` deny rule). In the text; the scheduler is correctly out. |

### `sessions.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| partly | whole page | §17 | stated 17-cli.md:751 §17.15.1 item 5, 03-environment.md:526 §3.6.3 (`docs: sessions.md | What a resumed session restores`) | On `--resume`/`--continue` the `--plugin-dir`, `--settings` and `--mcp-config` of the original launch are not restored: the session resumes without those plugins unless passed again. |

### `settings-reference.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| should be in | "Settings index — skillListingBudgetFraction"; "Settings index — skillListingMaxDescChars"; "skillListingBudgetFraction"; "skillListingMaxDescChars" | §4 | stated §4 (listing budget) | How much of a plugin skill's description reaches the model. |
| should be in | "Settings index — subagentStatusLine"; "subagentStatusLine" | §12.6 | stated §12.6.1 (12-settings.md:424) and the §12.7.1 index row (12-settings.md:511) (`docs: settings-reference.md | subagentStatusLine`, `… | Settings index — subagentStatusLine`) | The one setting besides `agent` a plugin may ship: what its command receives and prints, and the gates that apply (see `statusline.md` above). |
| partly | "Settings index — autoCompactWindow"; "autoCompactWindow" | §5.10.4 | stated §5.10.4 | The session value against an agent's `autoCompactWindow`. |
| partly | "Settings index — availableModels"; "Settings index — availableModelsMatch"; "Settings index — deniedModels"; "Settings index — effortLevel"; "Settings index — enforceAvailableModels"; "Settings index — maxEffortLevel"; "Settings index — model"; "availableModels"; "availableModelsMatch"; "deniedModels"; "effortLevel"; "enforceAvailableModels"; "maxEffortLevel"; "model" | §4.9.3, §5.8, §12 | stated §4.9.3, §5.8, §12.4 | Whether a skill's or agent's `model`/`effort` frontmatter is honoured or replaced. The pickers and defaults are correctly out. |
| partly | "Settings index — cleanupPeriodDays"; "cleanupPeriodDays" | §16 | stated §16.6 (set-aside files age out) | Plugin install-record copies age out on this schedule; the scratchpad hooks receive goes with the transcript (not stated, see `claude-directory.md`). |
| partly | "Settings index — defaultShell"; "defaultShell" | §7.6.9 | stated §7.6.9 (J7.208) | Shell selection for `!` commands; hook and skill shells are their own fields. |
| partly | "Settings index — sandbox"; "sandbox" | §8.2.1, §9.1.4 | stated §9.1.4 item 8 (09-lsp-monitors-channels.md:142, `docs: settings-reference.md | sandbox`), §8.2.1; the index heading "Settings index — sandbox" has no marker of its own | Only "what runs outside the sandbox" touches a plugin: hooks, MCP and LSP servers, monitors and mods are never wrapped. |

### `settings.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| partly | "Settings in cloud sessions" | §16 | stated §16 (cloud sessions) | Which settings, and so which plugins, reach a cloud session. |

### `skills.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| should be in | "Skills synced from claude.ai"; "Where synced skills load"; "When a synced skill name matches another command"; "Names reserved for synced skills"; "How Claude Code handles the frontmatter of a synced skill"; "How Claude Code handles the body of a synced skill" | §4.5.6 | stated §4.5.6, §4.5 (names) | Name collisions between a plugin skill and a synced one; the reserved `synced` folder. |
| partly | "Bundled skills"; "Use skills in Cowork and cloud sessions"; "Skill not triggering"; "Claude stops following a skill" | §4 | stated §4.4.1 (unparsable frontmatter), §4.5 (bundled-name collisions), §4 compaction, §16 (cloud) | Malformed YAML loads the body with empty metadata; bundled names a plugin skill shadows; truncation after compaction; plugins from repository settings not loading in cloud sessions. The advice itself is out. |

### `statusline.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| partly | whole page | §12.6 | stated §12.6 item 5 and §12.6.1, 12-settings.md:408 and :431 (`docs: statusline.md | Subagent status lines`, `… | Task fields`) | "Subagent status lines" and "Task fields": the run contract of the `subagentStatusLine` a plugin ships as a default. The command runs once per refresh tick with the base hook fields, `columns` and a `tasks` array (id, name, type, agentType, status, description, label, startTime, model, effort, contextWindowSize, tokenCount, tokenSamples, cwd) on stdin; it prints one `{"id","content"}` line per row (no id keeps the default row, empty content hides it); the trust and `disableAllHooks` gates apply, and a plugin value is not subject to `allowManagedHooksOnly` even when force-enabled. §12.6 states only the value shape and precedence. The rest of the page (the user's own `statusLine`) is correctly out. |

### `sub-agents.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| should be in | "Enable persistent memory" | §5.10.3 | stated §5.10.3 | A plugin agent's `memory` field. |
| should be in | "Run subagents in foreground or background"; "Which subagents run in the background"; "Let Claude wait for a subagent"; "Tools, permissions, and results of background subagents" | §5.12.3, §5.7.1 | stated §5.12.3, §5.7.1 | A plugin agent's `background` field and the reduced tool set of a background subagent. |
| should be in | "Concurrent subagent limit" | §5.12.2 | stated §5.12.2 | When a plugin agent's spawn waits for a slot. |
| should be in | "What loads at startup" | §5.10.1 | stated §5.10.1 | What a plugin agent starts with (CLAUDE.md unless `omitClaudeMd`, git status, preloaded skills). |
| should be in | "Auto-compaction" | §5.10.4 | stated §5.10.4 | A plugin agent's `autoCompactWindow`. |

### `tools-reference.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| should be in | "PowerShell tool"; "Enable the PowerShell tool" | §7.6.9 | stated §7.6.9 | Which shell a hook or skill `shell: powershell` gets. |
| should be in | "Task tool availability"; "Task-tracking tools in subagents and agent teams" | §5.7.1 | stated §5.7.1 | Which Task tools a plugin agent receives. |
| partly | "LSP tool behavior" | §9.1.4 | stated §9.1.4 item 5, 09-lsp-monitors-channels.md:132 (`docs: tools-reference.md | LSP tool behavior`; J9.16) | The operations the LSP tool asks a plugin's language server for (definition, references, hover, document and workspace symbols, implementations, call hierarchy) and the error result for each call on a file whose server cannot start. |

### `worktrees.md`

| Class | Excluded | Chapter | Ours | What a plugin sees differently |
| --- | --- | --- | --- | --- |
| partly | whole page | §3, §5, §7.5, §12 | stated §3 (project dir vs cwd), §5.3/§5.6 (isolation), §7.5 (WorktreeCreate/Remove), §12 (project plugins in a worktree) | A hook's `${CLAUDE_PROJECT_DIR}` stays at the start directory while `cwd` follows Claude into a worktree; project-scope plugins load in worktrees of the same repository; `isolation: worktree` branches from the default branch and is removed when unchanged; the sweep keeps hook-created worktrees. All stated; `--worktree`, cleanup prompts and manual git are correctly out. |

## Pages seen by neither list

Pages in the docs folder that are neither a requirement page nor an excluded page.

| Page | Class | Why |
| --- | --- | --- |
| `plugins/measure.md` | correctly out | Its 13 headings are all excluded (ui, telemetry): the cost figures, `/plugin` usage, `/doctor` unused list and OpenTelemetry events are the client's accounting of a plugin, which the plugin never sees. |
| `plugins/mods/test.md` | correctly out | Its 9 headings are all excluded (tooling): the mods test kit stubs the client for an author's tests and changes nothing at run time. |
| `claude-tag.md` | correctly out (unverified) | Listed in `llms.txt` but absent from the cache: Claude in Slack, a product surface. Not read. |

## Correctly out

Everything not named above. Per page: the excluded reason, then the items. A whole page is marked
*(page)*.

- `accessibility.md`: *(page)* product: another product surface or UI.
- `admin-setup.md`: *(page)* hosting: hosting, CI and gateways.
- `advisor.md`: *(page)* engine: the host engine.
- `agent-sdk/agent-loop.md`: *(page)* sdk-api: the Agent SDK client API.
- `agent-sdk/configuration.md`: *(page)* sdk-api: the Agent SDK client API.
- `agent-sdk/cost-tracking.md`: *(page)* sdk-api: the Agent SDK client API.
- `agent-sdk/custom-tools.md`: *(page)* sdk-api: the Agent SDK client API.
- `agent-sdk/examples.md`: *(page)* sdk-api: the Agent SDK client API.
- `agent-sdk/file-checkpointing.md`: *(page)* sdk-api: the Agent SDK client API.
- `agent-sdk/hooks.md`: *(page)* sdk-api: SDK callback hooks are host code; the plugin hook contract they share is §7.
- `agent-sdk/hosting.md`: *(page)* hosting: hosting, CI and gateways.
- `agent-sdk/mcp.md`: *(page)* sdk-api: SDK-created servers are host servers; plugin servers are §8.
- `agent-sdk/migration-guide.md`: *(page)* sdk-api: the Agent SDK client API.
- `agent-sdk/modifying-system-prompts.md`: *(page)* sdk-api: the Agent SDK client API.
- `agent-sdk/observability.md`: *(page)* sdk-api: the Agent SDK client API.
- `agent-sdk/overview.md`: *(page)* sdk-api: the Agent SDK client API.
- `agent-sdk/permissions.md`: *(page)* sdk-api: `canUseTool` is the host's prompt; rules and modes are §13.
- `agent-sdk/plugins.md`: *(page)* sdk-api: the `plugins` option is the SDK form of `--plugin-dir` (stated in §16/§17); `reloadPlugins()` is the SDK form of `/reload-plugins`.
- `agent-sdk/python.md`: *(page)* sdk-api: the Agent SDK client API.
- `agent-sdk/quickstart.md`: *(page)* sdk-api: the Agent SDK client API.
- `agent-sdk/secure-deployment.md`: *(page)* hosting: hosting, CI and gateways.
- `agent-sdk/session-storage.md`: *(page)* sdk-api: the Agent SDK client API.
- `agent-sdk/sessions.md`: *(page)* sdk-api: the Agent SDK client API.
- `agent-sdk/skills.md`: *(page)* sdk-api: filesystem skills load as §4 says; the SDK only chooses sources.
- `agent-sdk/streaming-output.md`: *(page)* sdk-api: the Agent SDK client API.
- `agent-sdk/streaming-vs-single-mode.md`: *(page)* sdk-api: the Agent SDK client API.
- `agent-sdk/structured-outputs.md`: *(page)* sdk-api: the Agent SDK client API.
- `agent-sdk/subagents.md`: *(page)* sdk-api: programmatic agent definitions are host input, like `--agents` (§5.5.1).
- `agent-sdk/todo-tracking.md`: *(page)* sdk-api: the Agent SDK client API.
- `agent-sdk/tool-search.md`: *(page)* sdk-api: the Agent SDK client API.
- `agent-sdk/troubleshooting.md`: *(page)* sdk-api: the Agent SDK client API.
- `agent-sdk/typescript-v2-preview.md`: *(page)* sdk-api: the Agent SDK client API.
- `agent-sdk/typescript.md`: *(page)* sdk-api: the Agent SDK client API.
- `agent-sdk/user-input.md`: *(page)* sdk-api: the Agent SDK client API.
- `agents.md`: *(page)* guide: overview or guide.
- `amazon-bedrock.md`: *(page)* provider: model providers and install.
- `analytics.md`: *(page)* billing: billing, legal, usage.
- `artifacts.md`: *(page)* product: another product surface or UI.
- `authentication.md`: *(page)* provider: model providers and install.
- `auto-mode-classifier-billing.md`: *(page)* billing: billing, legal, usage.
- `auto-mode-config.md`: *(page)* engine: the classifier's rules; what a `PermissionDenied` hook receives is §7.5.
- `best-practices.md`: *(page)* guide: overview or guide.
- `champion-kit.md`: *(page)* marketing: marketing.
- `changelog.md`: *(page)* digest: release history; the targeted release's behaviour is in the reference pages.
- `channels-reference.md`: advice (1): Overview; tutorial (3): Example: build a webhook receiver, Add relay to a chat bridge, Full example; container (1): Relay permission prompts; navigation (1): See also.
- `channels.md`: builtin (1): Supported channels; tutorial (1): Quickstart; container (1): Enterprise controls; advice (2): Research preview, How channels compare; navigation (1): Next steps.
- `checkpointing.md`: *(page)* engine: rewind restores files; nothing in a plugin changes.
- `chrome.md`: *(page)* product: another product surface or UI.
- `claude-apps-gateway-config.md`: *(page)* hosting: hosting, CI and gateways.
- `claude-apps-gateway-deploy.md`: *(page)* hosting: hosting, CI and gateways.
- `claude-apps-gateway-on-aws.md`: *(page)* hosting: hosting, CI and gateways.
- `claude-apps-gateway-on-gcp.md`: *(page)* hosting: hosting, CI and gateways.
- `claude-apps-gateway-spend-limits.md`: *(page)* hosting: hosting, CI and gateways.
- `claude-apps-gateway.md`: *(page)* hosting: hosting, CI and gateways.
- `claude-code-on-the-web.md`: *(page)* hosting: the hosted surface; `CLAUDE_CODE_REMOTE` and cloud plugin rules are stated (§12, §16).
- `claude-platform-on-aws.md`: *(page)* provider: model providers and install.
- `claude-projects.md`: *(page)* product: cloud threads load plugins from project settings on claude.ai, a hosted service.
- `claude-security.md`: *(page)* product: describes one plugin, not the contract plugins rely on.
- `cli-reference.md`: runtime (83): claude, claude "query", claude -p "query", cat file | claude -p "query", claude -c, claude -c -p "query", claude -r "<session>" "query", claude update, claude gateway, claude install [version], claude auth login, claude auth logout, claude auth status, claude agents, claude attach <id|name>, claude auto-mode defaults, claude auto-mode reset, claude daemon logs, claude daemon run, claude daemon status, claude daemon stop --any, claude doctor, claude import [source], claude logs <id|name>, claude mcp, claude mcp login <name>, claude mcp logout <name>, claude purge [path], claude remote-control, claude respawn <id>, claude rm <id>, claude self-hosted-runner, claude setup-token, claude stop <id>, claude ultrareview [target], --advisor <model>, --append-system-prompt, --append-system-prompt-file, --autocompact <auto|tokens>, --ax-screen-reader, --betas, --bg / --background, --chrome, --cloud, --desktop, --effort, --enable-auto-mode, --environment <environment-id>, --exclude-dynamic-system-prompt-sections, --exec, --fallback-model, --fork-session, --forward-subagent-text, --from-pr, --ide, --include-hook-events, --include-partial-messages, --input-format, --json-schema, --max-budget-usd, --max-turns, --model, --name / -n, --no-chrome, --no-session-persistence, --output-format, --permission-prompt-tool, --permission-prompts, --print / -p, --prompt-suggestions, --ref <branch>, --remote, --remote-control / --rc, --remote-control-session-name-prefix <prefix>, --replay-user-messages, --session-id, --system-prompt, --system-prompt-file, --system-prompt-snapshot, --teleport, --tmux, --verbose, --version / -v; model (2): System prompt flags, System prompt flags in resumed conversations; navigation (1): See also.
- `code-review-costs.md`: *(page)* hosting: hosting, CI and gateways.
- `code-review-customize.md`: *(page)* hosting: hosting, CI and gateways.
- `code-review-local.md`: *(page)* product: another product surface or UI.
- `code-review-pull-requests.md`: *(page)* hosting: hosting, CI and gateways.
- `code-review-setup.md`: *(page)* hosting: hosting, CI and gateways.
- `code-review-troubleshooting.md`: *(page)* hosting: hosting, CI and gateways.
- `code-review.md`: *(page)* hosting: hosting, CI and gateways.
- `common-workflows.md`: *(page)* guide: overview or guide.
- `communications-kit.md`: *(page)* marketing: marketing.
- `computer-use.md`: *(page)* product: another product surface or UI.
- `corporate-launcher.md`: *(page)* hosting: hosting, CI and gateways.
- `costs.md`: *(page)* billing: billing, legal, usage.
- `data-usage.md`: *(page)* billing: billing, legal, usage.
- `debug-your-config.md`: ui (1): See what loaded into context; advice (2): Check MCP servers, Check common causes; navigation (1): Related resources.
- `deep-links.md`: *(page)* product: another product surface or UI.
- `desktop-ios-simulator.md`: *(page)* product: another product surface or UI.
- `desktop-linux.md`: *(page)* product: another product surface or UI.
- `desktop-quickstart.md`: *(page)* product: another product surface or UI.
- `desktop-scheduled-tasks.md`: *(page)* product: another product surface or UI.
- `desktop-wsl.md`: *(page)* product: another product surface or UI.
- `devcontainer.md`: *(page)* hosting: hosting, CI and gateways.
- `env-vars.md`: runtime (316): ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN, ANTHROPIC_AWS_API_KEY, ANTHROPIC_AWS_BASE_URL, ANTHROPIC_AWS_WORKSPACE_ID, ANTHROPIC_BASE_URL, ANTHROPIC_BEDROCK_BASE_URL, ANTHROPIC_BEDROCK_MANTLE_BASE_URL, ANTHROPIC_BEDROCK_REGION_PREFIX, ANTHROPIC_BEDROCK_SERVICE_TIER, ANTHROPIC_BETAS, ANTHROPIC_CUSTOM_HEADERS, ANTHROPIC_CUSTOM_MODEL_OPTION, ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION, ANTHROPIC_CUSTOM_MODEL_OPTION_NAME, ANTHROPIC_CUSTOM_MODEL_OPTION_SUPPORTED_CAPABILITIES, ANTHROPIC_DEFAULT_FABLE_MODEL, ANTHROPIC_DEFAULT_FABLE_MODEL_DESCRIPTION, ANTHROPIC_DEFAULT_FABLE_MODEL_NAME, ANTHROPIC_DEFAULT_FABLE_MODEL_SUPPORTED_CAPABILITIES, ANTHROPIC_DEFAULT_HAIKU_MODEL, ANTHROPIC_DEFAULT_HAIKU_MODEL_DESCRIPTION, ANTHROPIC_DEFAULT_HAIKU_MODEL_NAME, ANTHROPIC_DEFAULT_HAIKU_MODEL_SUPPORTED_CAPABILITIES, ANTHROPIC_DEFAULT_MODEL, ANTHROPIC_DEFAULT_OPUS_MODEL, ANTHROPIC_DEFAULT_OPUS_MODEL_DESCRIPTION, ANTHROPIC_DEFAULT_OPUS_MODEL_NAME, ANTHROPIC_DEFAULT_OPUS_MODEL_SUPPORTED_CAPABILITIES, ANTHROPIC_DEFAULT_SONNET_MODEL, ANTHROPIC_DEFAULT_SONNET_MODEL_DESCRIPTION, ANTHROPIC_DEFAULT_SONNET_MODEL_NAME, ANTHROPIC_DEFAULT_SONNET_MODEL_SUPPORTED_CAPABILITIES, ANTHROPIC_FEDERATION_RULE_ID, ANTHROPIC_FOUNDRY_API_KEY, ANTHROPIC_FOUNDRY_AUTH_TOKEN, ANTHROPIC_FOUNDRY_BASE_URL, ANTHROPIC_FOUNDRY_RESOURCE, ANTHROPIC_MODEL, ANTHROPIC_ORGANIZATION_ID, ANTHROPIC_PROFILE, ANTHROPIC_SMALL_FAST_MODEL, ANTHROPIC_SMALL_FAST_MODEL_AWS_REGION, ANTHROPIC_VERTEX_BASE_URL, ANTHROPIC_VERTEX_PROJECT_ID, ANTHROPIC_WORKSPACE_ID, API_FORCE_IDLE_TIMEOUT, API_TIMEOUT_MS, AWS_BEARER_TOKEN_BEDROCK, BASH_DEFAULT_TIMEOUT_MS, BASH_MAX_OUTPUT_LENGTH, BASH_MAX_TIMEOUT_MS, BETA_TRACING_ENDPOINT, CCR_FORCE_BUNDLE, CLAUDE_AGENT_SDK_MCP_NO_PREFIX, CLAUDE_ASYNC_AGENT_STALL_TIMEOUT_MS, CLAUDE_AUTOCOMPACT_PCT_OVERRIDE, CLAUDE_AUTO_BACKGROUND_TASKS, CLAUDE_AX_PREPARK_MS, CLAUDE_AX_SCREEN_READER, CLAUDE_AX_STARTUP_QUIET_MS, CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR, CLAUDE_BYTE_STREAM_IDLE_TIMEOUT_MS, CLAUDE_CLIENT_PRESENCE_FILE, CLAUDE_CODE_ACCESSIBILITY, CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD, CLAUDE_CODE_ALT_SCREEN_FULL_REPAINT, CLAUDE_CODE_ALWAYS_ENABLE_EFFORT, CLAUDE_CODE_API_KEY_HELPER_TTL_MS, CLAUDE_CODE_ARTIFACT_AUTO_OPEN, CLAUDE_CODE_ARTIFACT_COMMENTS, CLAUDE_CODE_ARTIFACT_COMMENTS_AUTOREACT, CLAUDE_CODE_ARTIFACT_PUBLISH_EDITS, CLAUDE_CODE_ATTRIBUTION_HEADER, CLAUDE_CODE_AUTO_BACKGROUND_WORKER_CHECKIN_SECONDS, CLAUDE_CODE_AUTO_CONNECT_IDE, CLAUDE_CODE_AUTO_MODE_MODEL, CLAUDE_CODE_AUTO_MODE_SERVER, CLAUDE_CODE_AWS_CHAIN_RESOLVE_TIMEOUT_MS, CLAUDE_CODE_BASH_EDIT_DIFF, CLAUDE_CODE_BG_TASKS_REPORT_RUNNING, CLAUDE_CODE_BS_AS_CTRL_BACKSPACE, CLAUDE_CODE_CERT_STORE, CLAUDE_CODE_CLIENT_CERT, CLAUDE_CODE_CLIENT_KEY, CLAUDE_CODE_CLIENT_KEY_PASSPHRASE, CLAUDE_CODE_CONFIG_LOCK_WAIT_MS, CLAUDE_CODE_CONNECT_TIMEOUT_MS, CLAUDE_CODE_DEBUG_LOGS_DIR, CLAUDE_CODE_DEBUG_LOG_LEVEL, CLAUDE_CODE_DISABLE_1M_CONTEXT, CLAUDE_CODE_DISABLE_ADAPTIVE_THINKING, CLAUDE_CODE_DISABLE_ADVISOR_TOOL, CLAUDE_CODE_DISABLE_AGENT_VIEW, CLAUDE_CODE_DISABLE_ALTERNATE_SCREEN, CLAUDE_CODE_DISABLE_ARTIFACT, CLAUDE_CODE_DISABLE_ATTACHMENTS, CLAUDE_CODE_DISABLE_AUTH_REFRESH_LOCK, CLAUDE_CODE_DISABLE_AUTO_MEMORY, CLAUDE_CODE_DISABLE_BEDROCK_CONTENT_TYPE_DEFAULT, CLAUDE_CODE_DISABLE_BEDROCK_CONTENT_TYPE_GUARD, CLAUDE_CODE_DISABLE_BG_EXIT_HANDOFF, CLAUDE_CODE_DISABLE_BG_SHELL_PRESSURE_REAP, CLAUDE_CODE_DISABLE_BG_STABLE_PATH, CLAUDE_CODE_DISABLE_CFC_PROMPT, CLAUDE_CODE_DISABLE_CLAUDE_MDS, CLAUDE_CODE_DISABLE_CRON, CLAUDE_CODE_DISABLE_DANGEROUS_RM_TIMEOUT, CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS, CLAUDE_CODE_DISABLE_FAST_MODE, CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY, CLAUDE_CODE_DISABLE_FILE_CHECKPOINTING, CLAUDE_CODE_DISABLE_FILE_MENTIONS, CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS, CLAUDE_CODE_DISABLE_INLINE_SHELL_RM_PROMPT, CLAUDE_CODE_DISABLE_LEGACY_MODEL_REMAP, CLAUDE_CODE_DISABLE_MODEL_ACCESS_FALLBACK, CLAUDE_CODE_DISABLE_MOUNTED_DRIVE_RM_PROMPT, CLAUDE_CODE_DISABLE_MOUSE, CLAUDE_CODE_DISABLE_MOUSE_CLICKS, CLAUDE_CODE_DISABLE_MTLS_RELOAD_ON_STALE_CONNECTION, CLAUDE_CODE_DISABLE_NONSTREAMING_FALLBACK, CLAUDE_CODE_DISABLE_NOTIFICATION_PRESENCE_CHECK, CLAUDE_CODE_DISABLE_POWERSHELL_CMD_RM_DENY, CLAUDE_CODE_DISABLE_REFUSAL_FALLBACK, CLAUDE_CODE_DISABLE_STRUCTURED_OUTPUTS, CLAUDE_CODE_DISABLE_SUBSTITUTION_RM_PROMPT, CLAUDE_CODE_DISABLE_TERMINAL_TITLE, CLAUDE_CODE_DISABLE_THINKING, CLAUDE_CODE_DISABLE_ULTRAREVIEW_TRUST_CHECK, CLAUDE_CODE_DISABLE_UNKNOWN_MODEL_WINDOW_ENFORCEMENT, CLAUDE_CODE_DISABLE_VIRTUAL_SCROLL, CLAUDE_CODE_DISABLE_WEB_FETCH, CLAUDE_CODE_DISABLE_WINDOWS_SHELL_LAUNCHER, CLAUDE_CODE_DROP_UNAVAILABLE_DEFERRED_TOOL, CLAUDE_CODE_EMIT_SESSION_STATE_EVENTS, CLAUDE_CODE_ENABLE_AUTO_MODE, CLAUDE_CODE_ENABLE_AWAY_SUMMARY, CLAUDE_CODE_ENABLE_CFC, CLAUDE_CODE_ENABLE_FEEDBACK_SURVEY_FOR_OTEL, CLAUDE_CODE_ENABLE_FINE_GRAINED_TOOL_STREAMING, CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY, CLAUDE_CODE_ENABLE_OPUS_4_7_FAST_MODE, CLAUDE_CODE_ENABLE_PROMPT_SUGGESTION, CLAUDE_CODE_ENABLE_SHARE_BUNDLE, CLAUDE_CODE_ENABLE_TELEMETRY, CLAUDE_CODE_ENABLE_TODO_TOOLS, CLAUDE_CODE_EVEN_MORE_DANGEROUSLY_SKIP_PERMISSIONS, CLAUDE_CODE_EXIT_AFTER_STOP_DELAY, CLAUDE_CODE_EXTRA_BODY, CLAUDE_CODE_FILE_READ_MAX_OUTPUT_TOKENS, CLAUDE_CODE_FORCE_SESSION_PERSISTENCE, CLAUDE_CODE_FORCE_STRIKETHROUGH, CLAUDE_CODE_FORCE_SYNC_OUTPUT, CLAUDE_CODE_FORCE_TERMINAL_IMAGES, CLAUDE_CODE_FORWARD_SUBAGENT_TEXT, CLAUDE_CODE_GATEWAY_HINT_HEADERS, CLAUDE_CODE_GATEWAY_MODEL_DISCOVERY_TIMEOUT_MS, CLAUDE_CODE_GLOB_HIDDEN, CLAUDE_CODE_GLOB_NO_IGNORE, CLAUDE_CODE_GLOB_TIMEOUT_SECONDS, CLAUDE_CODE_GOAL_CHECKIN_MINUTES, CLAUDE_CODE_GZIP_REQUEST_BODIES, CLAUDE_CODE_HIDE_CWD, CLAUDE_CODE_IDE_HOST_OVERRIDE, CLAUDE_CODE_IDE_SKIP_AUTO_INSTALL, CLAUDE_CODE_IDE_SKIP_VALID_CHECK, CLAUDE_CODE_IDLE_COMPACT_MIN_TOKENS, CLAUDE_CODE_MAX_CONTEXT_TOKENS, CLAUDE_CODE_MAX_OUTPUT_TOKENS, CLAUDE_CODE_MAX_RETRIES, CLAUDE_CODE_MAX_SUBAGENTS_PER_SESSION, CLAUDE_CODE_MAX_TURNS, CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION, CLAUDE_CODE_NATIVE_CURSOR, CLAUDE_CODE_NEW_INIT, CLAUDE_CODE_NONBLOCKING_STDOUT, CLAUDE_CODE_NONSTREAMING_TIMEOUT_RETRIES, CLAUDE_CODE_NO_FLICKER, CLAUDE_CODE_OAUTH_REFRESH_TOKEN, CLAUDE_CODE_OAUTH_SCOPES, CLAUDE_CODE_OAUTH_TOKEN, CLAUDE_CODE_OPUS_4_6_FAST_MODE_OVERRIDE, CLAUDE_CODE_OTEL_CONTENT_MAX_LENGTH, CLAUDE_CODE_OTEL_DIAG_STDERR, CLAUDE_CODE_OTEL_FLUSH_TIMEOUT_MS, CLAUDE_CODE_OTEL_HEADERS_HELPER_DEBOUNCE_MS, CLAUDE_CODE_OTEL_SHUTDOWN_TIMEOUT_MS, CLAUDE_CODE_OVERLOADED_RETRY_BASE_DELAY_MS, CLAUDE_CODE_OVERLOADED_RETRY_MAX_DELAY_MS, CLAUDE_CODE_PACKAGE_MANAGER_AUTO_UPDATE, CLAUDE_CODE_PERFORCE_MODE, CLAUDE_CODE_POWERSHELL_RESPECT_EXECUTION_POLICY, CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS, CLAUDE_CODE_PROMPT_CACHE_TTL, CLAUDE_CODE_PROPAGATE_TRACEPARENT, CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST, CLAUDE_CODE_PROXY_RESOLVES_HOSTS, CLAUDE_CODE_RESTRICTED, CLAUDE_CODE_RESUME_INTERRUPTED_TURN, CLAUDE_CODE_RESUME_INTERRUPTED_TURN_MAX_AGE_MS, CLAUDE_CODE_RESUME_PROMPT, CLAUDE_CODE_RESUME_SHOWS_CUT_OFF_CALLS, CLAUDE_CODE_RETRY_WATCHDOG, CLAUDE_CODE_RETRY_WATCHDOG_MAX_WAIT_MS, CLAUDE_CODE_RETRY_WATCHDOG_USAGE_LIMIT_RECHECK_MS, CLAUDE_CODE_SCRIPT_CAPS, CLAUDE_CODE_SCROLL_SPEED, CLAUDE_CODE_SEND_FEEDBACK, CLAUDE_CODE_SHELL, CLAUDE_CODE_SIMPLE_SYSTEM_PROMPT, CLAUDE_CODE_SKIP_ANTHROPIC_AWS_AUTH, CLAUDE_CODE_SKIP_AWS_CRED_CACHE, CLAUDE_CODE_SKIP_BEDROCK_AUTH, CLAUDE_CODE_SKIP_FAST_MODE_NETWORK_ERRORS, CLAUDE_CODE_SKIP_FAST_MODE_ORG_CHECK, CLAUDE_CODE_SKIP_FOUNDRY_AUTH, CLAUDE_CODE_SKIP_MANTLE_AUTH, CLAUDE_CODE_SKIP_MODEL_ACCESS_MEMORY, CLAUDE_CODE_SKIP_PROMPT_HISTORY, CLAUDE_CODE_SKIP_VERTEX_AUTH, CLAUDE_CODE_STARTUP_FAILURE_RESULTS, CLAUDE_CODE_SYNTAX_HIGHLIGHT, CLAUDE_CODE_TASK_LIST_ID, CLAUDE_CODE_TMUX_TRUECOLOR, CLAUDE_CODE_TOOL_MEMORY_CGROUP_EXCLUDE, CLAUDE_CODE_TOOL_MEMORY_LIMIT, CLAUDE_CODE_TRANSCRIPT_LOCAL_GC, CLAUDE_CODE_USER_DIALOG_TIMEOUT_MS, CLAUDE_CODE_USE_ANTHROPIC_AWS, CLAUDE_CODE_USE_BEDROCK, CLAUDE_CODE_USE_FOUNDRY, CLAUDE_CODE_USE_MANTLE, CLAUDE_CODE_USE_VERTEX, CLAUDE_CODE_WARN_DISK_FREE_GIB, CLAUDE_CODE_WARN_MEMORY_FREE_GIB, CLAUDE_CODE_WEBFETCH_CACHE_TTL_MS, CLAUDE_CODE_WEBFETCH_DEADLINE_MS, CLAUDE_CODE_WEB_SEARCH_REFILLS_PER_HOUR, CLAUDE_CODE_WORKER_CHECKIN_SCHEDULE, CLAUDE_CODE_WORKFLOW_PREFIX_STAGGER_MS, CLAUDE_CODE_YOU_SHOULD_KNOW_DEBUG, CLAUDE_ENABLE_BYTE_WATCHDOG, CLAUDE_ENABLE_BYTE_WATCHDOG_BEDROCK, CLAUDE_ENABLE_STREAM_WATCHDOG, CLAUDE_REMOTE_CONTROL_SESSION_NAME_PREFIX, CLAUDE_STREAM_FIRST_BYTE_TIMEOUT_MS, CLAUDE_STREAM_IDLE_TIMEOUT_MS, CLAUDE_SUBAGENT_BG_SHELL_MAX_MS, DEBUG, DISABLE_AUTO_COMPACT, DISABLE_COMPACT, DISABLE_COST_WARNINGS, DISABLE_DOCTOR_COMMAND, DISABLE_ERROR_REPORTING, DISABLE_EXTRA_USAGE_COMMAND, DISABLE_FEEDBACK_COMMAND, DISABLE_GROWTHBOOK, DISABLE_INSTALLATION_CHECKS, DISABLE_INSTALL_GITHUB_APP_COMMAND, DISABLE_INTERLEAVED_THINKING, DISABLE_LOGIN_COMMAND, DISABLE_LOGOUT_COMMAND, DISABLE_PROMPT_CACHING, DISABLE_PROMPT_CACHING_FABLE, DISABLE_PROMPT_CACHING_HAIKU, DISABLE_PROMPT_CACHING_OPUS, DISABLE_PROMPT_CACHING_SONNET, DISABLE_UPGRADE_COMMAND, ENABLE_BETA_TRACING_DETAILED, ENABLE_PROMPT_CACHING_1H, ENABLE_PROMPT_CACHING_1H_BEDROCK, FORCE_HYPERLINK, FORCE_PROMPT_CACHING_5M, HTTP_PROXY, HTTPS_PROXY, IS_DEMO, MAX_STRUCTURED_OUTPUT_RETRIES, MAX_THINKING_TOKENS, NO_PROXY, OTEL_ATTRIBUTE_VALUE_LENGTH_LIMIT, OTEL_LOG_ASSISTANT_RESPONSES, OTEL_LOG_RAW_API_BODIES, OTEL_LOG_TOOL_CONTENT, OTEL_LOG_TOOL_DETAILS, OTEL_LOG_USER_PROMPTS, OTEL_METRICS_INCLUDE_ACCOUNT_UUID, OTEL_METRICS_INCLUDE_ENTRYPOINT, OTEL_METRICS_INCLUDE_REPOSITORY, OTEL_METRICS_INCLUDE_RESOURCE_ATTRIBUTES, OTEL_METRICS_INCLUDE_VERSION, TASK_MAX_OUTPUT_LENGTH, USE_BUILTIN_RIPGREP, VERTEX_REGION_CLAUDE_3_5_HAIKU, VERTEX_REGION_CLAUDE_3_5_SONNET, VERTEX_REGION_CLAUDE_3_7_SONNET, VERTEX_REGION_CLAUDE_4_0_OPUS, VERTEX_REGION_CLAUDE_4_0_SONNET, VERTEX_REGION_CLAUDE_4_1_OPUS, VERTEX_REGION_CLAUDE_4_5_OPUS, VERTEX_REGION_CLAUDE_4_5_SONNET, VERTEX_REGION_CLAUDE_4_6_OPUS, VERTEX_REGION_CLAUDE_4_6_SONNET, VERTEX_REGION_CLAUDE_4_7_OPUS, VERTEX_REGION_CLAUDE_4_8_OPUS, VERTEX_REGION_CLAUDE_5_5_OPUS, VERTEX_REGION_CLAUDE_5_5_SONNET, VERTEX_REGION_CLAUDE_5_OPUS, VERTEX_REGION_CLAUDE_5_SONNET, VERTEX_REGION_CLAUDE_FABLE_5, VERTEX_REGION_CLAUDE_FABLE_5_1, VERTEX_REGION_CLAUDE_FABLE_5_2, VERTEX_REGION_CLAUDE_HAIKU_4_5, VERTEX_REGION_CLAUDE_HAIKU_5_5, Features that need feature-flag fetching, First session after an install or upgrade; model (1): CLAUDE_CODE_SUBAGENT_PROMPT_CACHE_TTL; service (3): CLAUDE_CODE_SYNC_SKILLS, CLAUDE_CODE_SYNC_SKILLS_INSTALL_TIMEOUT_MS, CLAUDE_CODE_SYNC_SKILLS_WAIT_TIMEOUT_MS; telemetry (2): OTEL_LOG_MANAGED_SETTINGS, OTEL_METRICS_INCLUDE_SESSION_ID; container (1): Set environment variables; machine (1): Set variables in your shell; navigation (1): See also.
- `errors.md`: runtime (250): Find your error, Automatic retries, What you see while Claude Code retries or waits, Waiting for API response, The waiting banner comes and goes behind a gateway, Tune retry behavior, Server errors, API Error: 500 Internal server error, API Error: Repeated 529 Overloaded errors, Request timed out, No response from API, The response above may be incomplete, Auto mode cannot determine the safety of an action, The server returned no safety verdict, Was not reviewed and did not run, Agent terminated early due to an API error, Usage limits, You've hit your session limit, Usage credits required for 1M context, The prompt to confirm went unanswered, Server is temporarily limiting requests, Request rejected (429), You've hit your monthly spend limit, Spend limit reached, Credit balance is too low, Could not update your spend limit, Authentication errors, Not logged in, Could not resolve authentication method, Invalid API key, Your apiKeyHelper script is failing, Claude Code didn't send your claude.ai login, Invalid request header value, This organization has been disabled, Your organization has disabled API key authentication, Your organization has disabled Claude subscription access, Scheduled tasks are off for your organization, Remote Control requires the Anthropic API, Remote Control couldn't refresh your login, Remote Control could not renew this computer's connection, Remote Control stopped because the signed-in account changed, Remote Control stopped because the app running the session signed out or switched accounts, OAuth token revoked or expired, API Error: 401 Invalid authentication credentials, Login expired, Could not refresh your login because another Claude Code process is refreshing it, Couldn't save your login, Sign in again to take your previous account or API key off the config file, Your account or API key may still be in the config file, Couldn't start the local listener that receives the browser sign-in, Claude login not accepted, Artifacts need a claude.ai login, Administrator policy requires a Cloud gateway sign-in, Your account is on hold, Anthropic profile login expired, OAuth scope requirement, claude.ai rejected the session token, AWS credentials expired or invalid, AWS authentication failed, Google Cloud credentials expired or invalid, Google Cloud authentication failed, Microsoft Foundry authentication failed, Could not load AWS or Google Cloud credentials, AWS default-chain credential resolve timed out, Bedrock setup verification timed out waiting for AWS, Cloud gateway session expired, Sign-in timed out while waiting for you to continue, Gateway refused the request, Network and connection errors, Unable to connect to API, Unable to connect to Anthropic services, Socket is closed, API returned an empty or malformed response, Streaming response ended before any complete data was received, Bedrock streaming response has an unexpected content-type, SSL certificate errors, Host not allowed in a cloud session, The proxy refused the connection, The cloud environments service returned an empty or unexpected response, Failed to fetch session from Sessions API, Couldn't reconnect to your Remote Control session, Sessions ended while this machine was offline, Couldn't share the transcript, Couldn't send feedback, Feedback payload too large, MCP server connection timed out during a sleep or clock change, Request errors, Prompt is too long, Context exceeds the token limit, Request too large, Image was too large, Unable to resize image, Request rejected as unprocessable by the model, PDF errors, Extra inputs are not permitted, tool\_use.name over 200 characters, There's an issue with the selected model, Model is not a recognized model id, Model not found, Couldn't confirm model with the API, API error when checking the picked model, Claude Opus is not available with the Claude Pro plan, Claude Code does not support this model, Model is restricted by your organization's settings, Can't switch to the default model, Couldn't save it as your default, Advisor is less capable than the current main model, thinking.type.enabled is not supported for this model, Effort isn't available with thinking turned off, Thinking budget exceeds output limit, Response exceeded the output token maximum, Tool use or thinking block mismatch, Invalid data in redacted\_thinking block, Unsupported tool content removed, role 'system' must precede an 'assistant' message, Invalid encrypted\_content in search\_result block, Usage Policy refusal, Safety measures flagged a cybersecurity topic, Safeguards flagged a request for Claude's reasoning, Output blocked by content filtering policy, Command-line errors, Conflict between --bg and --print, Couldn't tell whether --bg is a flag or text, Conflict between a system prompt flag and its file form, Cloud sessions cannot be created from a --restricted session, Cloud sessions are disabled by your organization's policy, Cloud sessions use your claude.ai login, Couldn't verify your organization's policy for cloud sessions, Nothing was stashed because a folder replaced a tracked file, The --json-schema value is not a valid JSON Schema, Configuration error in \~/.claude.json, Claude configuration file was empty and no backup holds anything, The current directory no longer exists, Temp directory refused or cannot be created, Directory couldn't be resolved to a real location, Workspace not trusted when starting Remote Control, Workspace not trusted when running claude ultrareview, Not carried over to the sessions Remote Control starts, --sandbox or --no-sandbox is not supported by claude remote-control, claude import is not yet available in this build, Could not read Claude Code config, Could not import a server from Claude Desktop, MCP server was not saved or removed, MCP server may not have been saved or removed, Server is Anthropic-hosted and doesn't support local OAuth, OAuth callback port is already in use, No available ports for OAuth redirect, /security-review fails without origin/HEAD, Input must be provided when using --print, Claude Code can't read the keyboard here, Input contained only whitespace, stream-json input carried over 256M characters with no newline, Diff is too large for ultrareview, Could not find merge-base with the base branch, Your checkout has no branches, No GitHub account is connected to your Claude account, Your connected GitHub account can't see the repository, The GitHub App preflight failed transiently, The repository upload can't follow a git setting, GitHub isn't connected to your Claude account, A GitHub organization policy is blocking Claude, Single sign-on authorization needed, Failed to resume the conversation, No conversation found with the session ID, Windows reported an error (EBADF) when Claude Code read this session's transcript file, Cannot switch renderers in this session, Can't restart while work is running or Remote Control is connected, Claude Code couldn't restart, Couldn't open Claude Desktop, /terminal-setup left your Zed keymap unchanged, Skill usage reports are not available on this connection, /recap only runs when you ask for it yourself, /feedback is disabled by your organization's policy, Tool errors, Permission prompt tool returned an invalid result, File is covered by a Read deny rule, Setting blocks writes outside the working directories, Writes to Claude Code settings files are blocked, Path cannot contain null bytes, Command contains an invisible character, Command approved before Claude Code restarted was not run, File is too large to read as an image, Memory index is over its read limit, pkill pattern matches the Claude Code process, Failed to write to a teammate's inbox, Teammate's agent definition was not restored, Only a teammate can approve a shutdown request, A command-line deny rule cannot be handed to a teammate intact, Message too large for cross-session delivery, Too many messages to this session just now, Cross-session message was dropped at the recipient session's inbox, Refusing to send a cross-session message, Refusing to read, write, or search a path, Task output swap refused, Disk full or disk quota used up, git is not installed on this Mac, File is not valid UTF-8, The source file is not valid UTF-8 text, Not published: that file is on a network share, Not published: Claude sent the same content again after a newer version of the artifact turned it away, Reading a local file from outside the connected folders in a Cowork session, WebFetch cannot fetch localhost, WebFetch domain safety check failed, Background session errors, Commands refused in a background session, Write or command blocked because the path cannot be safely resolved, Write or command blocked because the path names a network location, This session has no saved transcript, This session is running in another terminal, This session's saved conversation is no longer on disk, Worktree has commits that are not pushed anywhere, Terminal host process died, Session isn't responding, Session was stopped while the respawn was in flight, Session agent no longer available, This session restarted after its next /loop wakeup was due, No LLM gateway: a gateway set in your shell isn't passed to a session opened from another folder, CLAUDE\_CODE\_PROCESS\_WRAPPER launcher errors, EUNKNOWN when starting a background session, EACCES when starting a background session, Background service exited before it became reachable, Working directory no longer exists when starting a background session, Workspace not trusted when dispatching a background session, Wrapper and IDE errors, Claude Code process exited with code N, Could not locate the Claude CLI on PATH, The Claude Code program for this computer could not be found, The connection to Claude Code ended before this message completed, Rewind warnings and errors, Restored the code, but skipped files, No files were restored, Session saving warnings, Transcript writes are failing, Transcript saving is off because CLAUDE\_CODE\_SKIP\_PROMPT\_HISTORY is set, Transcript saving is off because of an inherited CLAUDE\_CODE\_CHILD\_SESSION marker, Configuration warnings, Claude Code exited after an unrecoverable interface error, Instruction file not loaded, Working directory is a network path, Managed settings block the default model, Managed settings don't allow this API provider, otelHeadersHelper failed, ANTHROPIC\_FOUNDRY\_RESOURCE must be a Foundry resource name, The 200K limit isn't enforced, Unrecognized model ID on a request, Sandbox mask files left behind at write-deny paths, Two Claude Code config files exist, Make this change again later: \~/.claude.json could not be updated, Responses seem lower quality than usual, Report an error; container (1): Plugin errors; tooling (1): plugin eval is currently in early access.
- `fast-mode.md`: *(page)* engine: the host engine.
- `feature-availability.md`: *(page)* provider: model providers and install.
- `features-overview.md`: *(page)* guide: overview of features stated in their own pages.
- `fullscreen.md`: *(page)* product: another product surface or UI.
- `gateways.md`: *(page)* hosting: hosting, CI and gateways.
- `github-actions-cloud-providers.md`: *(page)* hosting: hosting, CI and gateways.
- `github-actions.md`: *(page)* hosting: hosting, CI and gateways.
- `github-enterprise-server.md`: *(page)* hosting: GHES marketplaces clone with the machine's git credentials, as any git source (§15).
- `gitlab-ci-cd.md`: *(page)* hosting: hosting, CI and gateways.
- `glossary.md`: *(page)* guide: overview or guide.
- `goal.md`: *(page)* engine: `/goal` is the client's own Stop evaluator; `GoalEvaluate` is §7.5.
- `google-vertex-ai.md`: *(page)* provider: model providers and install.
- `hipaa-setup.md`: *(page)* billing: billing, legal, usage.
- `hooks-guide.md`: tutorial (8): Set up your first hook, Get notified when Claude needs input, Auto-format code after edits, Block edits to protected files, Re-inject context after compaction, Audit configuration changes, Reload environment when directory or files change, Auto-approve specific permission prompts; container (4): What you can automate, Read input and return output, Limitations and troubleshooting, Hook JSON has no effect; advice (1): /hooks shows no hooks configured; navigation (1): Learn more.
- `hooks.md`: ui (1): The /hooks menu; container (7): Hook input and output, Hook events, Persist environment variables, Agent-based hooks, Run hooks in the background, Security considerations, Windows PowerShell tool; machine (1): Get terminal notifications inside tmux or GNU screen; tutorial (2): Check multiple conditions before stopping, Run tests after file changes; advice (3): Disclaimer, Security best practices, Debug hooks.
- `how-claude-code-works.md`: *(page)* guide: overview or guide.
- `interactive-mode.md`: *(page)* product: the prompt UI; the built-in mods it names are stated in §10.
- `jetbrains.md`: *(page)* product: IDE integration UI.
- `large-codebases.md`: *(page)* engine: per-directory project skills and advice; plugin skills are namespaced and unaffected.
- `legal-and-compliance.md`: *(page)* billing: billing, legal, usage.
- `llm-gateway-connect.md`: *(page)* hosting: hosting, CI and gateways.
- `llm-gateway-protocol.md`: *(page)* hosting: hosting, CI and gateways.
- `llm-gateway-rollout.md`: *(page)* hosting: hosting, CI and gateways.
- `llm-gateway.md`: *(page)* hosting: hosting, CI and gateways.
- `managed-mcp.md`: advice (1): Choose a pattern; container (4): Exclusive control with managed-mcp.json, Provide servers through managed settings, Match servers by URL, command, or name, How a server is evaluated; machine (1): Validate the configuration; tutorial (1): Example configuration; ui (1): How restrictions appear to users; telemetry (1): Monitor MCP usage; duplicate (1): Configuration summary; navigation (1): Related resources.
- `managed-settings.md`: container (1): Check that a policy is in force; ui (1): Read the source in /status; telemetry (1): Turn telemetry off for your organization; navigation (1): See also.
- `mcp-quickstart.md`: *(page)* duplicate: duplicate of `mcp.md`.
- `mcp.md`: advice (2): What you can do with MCP, Find and build MCP servers; container (4): Installing MCP servers, MCP installation scopes, Environment variable expansion in .mcp.json, Use MCP prompts as commands; tutorial (7): Add a server from setup instructions written for another client, Add a server from a URL, Add a server from an npx, uvx, or binary command, Add a server from an mcpServers JSON block, Practical examples, Example: Connect to GitHub for code reviews, Example: Query your PostgreSQL database; ui (7): Managing your servers, Server status, Server status detail, Configuration warnings, Tool availability, Authenticate from the command line, Sign in to an MCP server behind a gateway that requires a header; runtime (4): Retry failed servers yourself, Import MCP servers from Claude Desktop, Use Claude Code as an MCP server, Read a background command's output as an MCP client; duplicate (1): Push messages with channels; service (5): Use MCP servers from claude.ai, How connectors reach Claude Code, Organization controls on connector tools, Disable claude.ai connectors, Answer an elicitation request in a cloud session; model (1): Tool search through an LLM gateway.
- `microsoft-foundry.md`: *(page)* provider: model providers and install.
- `mobile.md`: *(page)* product: another product surface or UI.
- `monitoring-usage.md`: *(page)* billing: OpenTelemetry events about plugins and skills are emitted by the client; a plugin never receives them.
- `network-config.md`: *(page)* hosting: hosting, CI and gateways.
- `output-styles.md`: builtin (6): Built-in output styles, Default, Proactive, Concise, Explanatory, Learning; ui (1): Change your output style; advice (1): Choose between an output style and other features; navigation (1): Related resources.
- `overview.md`: *(page)* guide: overview or guide.
- `permission-modes.md`: container (1): Available modes; advice (1): Common setups; service (1): Permission modes with the HIPAA configuration; ui (3): Switch permission modes, Review and approve a plan, claude agents shows the bypass permissions warning that interactive sessions skip; model (14): Eliminate permission prompts with auto mode, Auto mode on Bedrock, Agent Platform, or Foundry, Server-side classifier review, Default classifier model, Choose the classifier model, When your model doesn't review, Check which model the classifier used, What the classifier blocks by default, The first read outside the working directories, Boundaries you state in conversation, Approvals you state in conversation, When auto mode falls back, Repeated-block thresholds, How auto mode evaluates actions; runtime (16): Critical paths, Which paths are critical, Other targets that count as critical paths, Removals inside nested commands and inline scripts, Rewrite a flagged command, The Dangerous rm operation not ruled out prompt, The mounted drive prompt, Paths that get the mounted drive prompt, Turn off the mounted drive prompt, Removals that still prompt with the mounted drive prompt off, Critical-path removals in each permission mode, Time limits and denials in auto and bypassPermissions modes, Turn off the critical-path removal prompt in bypassPermissions mode, Startup notices about the critical-path removal prompt, Why the critical-path removal prompt stays on, Remove-Item in PowerShell; navigation (1): See also.
- `permissions.md`: ui (2): Add a comment when you answer a permission prompt, Manage permissions; container (8): Permission rule syntax, Tool-specific permission rules, Bash, Read and Edit, Symlinks, WebFetch, Extend permissions with hooks, Additional directories grant file access, not configuration; runtime (1): How permissions interact with sandboxing; duplicate (1): Managed settings; tutorial (1): Example configurations; navigation (1): See also.
- `platforms.md`: *(page)* guide: overview or guide.
- `plugin-evals.md`: *(page)* engine: `claude plugin eval` is authoring tooling, left out on purpose by J17.1; the `experimental.evals` key is stated in §2.
- `plugins/anthropic-marketplaces.md`: container (1): Anthropic's marketplaces; advice (2): Find plugins in the official marketplace, Third-party marketplaces; tutorial (2): Browse and install from Anthropic's marketplaces, Add the community marketplace; navigation (1): Next steps.
- `plugins/cli-hints.md`: ui (1): Preview what the user sees; navigation (1): Next steps.
- `plugins/cli-reference.md`: container (5): claude plugin commands, plugin update, plugin validate, claude plugin marketplace commands, /reload-plugins; tooling (4): plugin init, plugin eval, plugin eval init, plugin test; ui (1): /plugin in a session; navigation (1): Next steps.
- `plugins/code-intelligence.md`: tutorial (1): Install a code intelligence plugin; container (1): See what Claude gains; ui (5): Read the diagnostics yourself, Accept or dismiss the recommendation dialog, When the recommendation dialog appears, Respond to the recommendation dialog, Turn recommendations back on; advice (1): Troubleshoot code intelligence; navigation (1): Next steps.
- `plugins/components.md`: container (5): Add each kind of component, Commands, Agents, Ask the user for configuration values, Reference plugin paths and store data; service (1): Reach users on claude.ai and Cowork; navigation (1): Next steps.
- `plugins/create-marketplace.md`: tutorial (2): Create a marketplace, Add plugin entries; container (2): Rules for plugin entries, Validate and test; duplicate (1): Host your marketplace; navigation (1): Next steps.
- `plugins/create.md`: advice (1): Decide when to use a plugin; tutorial (3): Create your first plugin, Share your plugin, Convert an existing .claude/ setup; container (3): Develop without a marketplace, Load a plugin for one session, Make a plugin load in every session; duplicate (5): A component path isn't found, --plugin-dir at a marketplace root doesn't load the plugins under plugins/, The plugin loads but its skills are missing, The userConfig dialog never appears, Check that the plugin changes Claude's behavior; navigation (1): Next steps.
- `plugins/dependencies.md`: container (3): Declare dependencies, Release a plugin that others depend on, How dependencies behave for your users; navigation (1): See also.
- `plugins/host-marketplace.md`: container (3): Host your marketplace, Keep users up to date, Rename or remove a plugin; advice (1): Roll out to a whole company; navigation (1): Next steps.
- `plugins/install.md`: container (2): Add a marketplace and install in one command, Keep plugins updated; ui (2): See what an installed plugin adds to your sessions, Find plugins you no longer use; navigation (1): Next steps.
- `plugins/loading.md`: container (7): Find where a plugin came from, Plugins shared through a repository, Find where a plugin is enabled, Find plugins on disk, Node.js package dependencies, Versions and updates, When auto-update runs; navigation (1): Next steps.
- `plugins/manifest-reference.md`: container (4): Manifest file, Component path forms, Path rules, Marketplace entries and the manifest; navigation (1): Next steps.
- `plugins/marketplace-reference.md`: container (3): Marketplace file, How an entry combines with plugin.json, Validation messages; navigation (1): Next steps.
- `plugins/measure.md`: ui (8): Measure what a plugin costs, Lower the always-on figure, Cost shown to users before install, Check whether a plugin is used, Not used recently in /plugin, Find skills that never run, Unused plugins in /doctor, Usage share in /usage; telemetry (4): Measure across a fleet, OpenTelemetry events for plugin installs and use, Redacted plugin names in your backend, Query the Analytics API; navigation (1): Next steps.
- `plugins/mods/admin.md`: advice (2): Decide whether to leave mods on, Review what a mod can do; container (1): Run your organization's own mods; tutorial (1): Refuse mods when your check fails; navigation (1): Next steps.
- `plugins/mods/api.md`: container (4): Add a command or a tool, Call a model, Run work in the background, Calls and background work after the user interrupts a turn; model (1): Check for cache hits; navigation (1): Next steps.
- `plugins/mods/create.md`: tutorial (6): Ask Claude for a mod, Use the mod in other sessions, Write a mod yourself, How the example mod works, Change a mod with Claude, Share your mod; container (1): Keep working on a mod; tooling (2): Get type definitions for your version, Test the mod; navigation (1): Next steps.
- `plugins/mods/events.md`: container (4): How a hook handles an event, Hook what Claude is doing, Change or refuse a settings read, Run alongside other mods; navigation (1): Next steps.
- `plugins/mods/gallery.md`: tutorial (1): Try a sample; advice (1): Pick an element; container (5): Show text, Show code and changes, Arrange elements, Take input, Draw pictures; duplicate (13): Text, Markdown, Link, Code, Code as a diff, Box, Button, Input, Select, Raster, Svg, Image and Client, Draw an Image inside tmux; navigation (1): Next steps.
- `plugins/mods/interface.md`: tutorial (3): Build a pane with tabs, Take typed input and draw a row for each item, Change hello-tabs to use $.state; container (5): Respond to presses and typing, Keyboard focus and hotkeys, Redraw a site, Keep state, Keep a value in $.state; navigation (1): Next steps.
- `plugins/mods/overview.md`: advice (2): What a mod can do, Compare mods, settings hooks, skills, and MCP servers; tutorial (3): Get a mod, Install or update a mod, Try a sample mod; container (2): Decide whether to trust a mod, Mods built into Claude Code; ui (2): List what a mod does before you install one, See which mods a session loaded; builtin (1): Read the source of built-in mods; navigation (1): Next steps.
- `plugins/mods/reference.md`: container (2): Events, Text typography props.
- `plugins/mods/test.md`: tooling (8): Write a test, Stub what Claude Code would answer, Follow the test kit's rules, Look up what a stub returns, Test a timer, Test a drawing, Test a drawing after /clear, Test a policy mod; navigation (1): Next steps.
- `plugins/mods/troubleshoot.md`: container (6): The mod doesn't load, A hook is skipped or a mod is unloaded, A tool call is denied, A toast appears after a turn is stopped, A drawing doesn't appear or respond, An edit or a value is lost; navigation (1): Next steps.
- `plugins/org.md`: container (3): Pre-install and require plugins, Choose a delivery mechanism, Set update policy; ui (1): Confirm the rollout; telemetry (3): Audit and review, OpenTelemetry events, Analytics API; navigation (1): Next steps.
- `plugins/overview.md`: advice (3): Understand what a plugin is, Decide whether you need a plugin, Tell Anthropic's marketplaces from third-party ones; tutorial (1): Get plugins from a marketplace; navigation (1): Next steps.
- `plugins/publish.md`: advice (2): Choose how to distribute, Tell users how to install; container (3): Share a plugin without a marketplace, Publish through your own marketplace, Ship updates, renames, and removals; service (2): Submit to Anthropic's directory, How a listed plugin reaches Claude Code users; duplicate (1): Declare dependencies; navigation (1): Next steps.
- `plugins/relevance.md`: container (2): Field reference, relevance.signals; ui (1): Preview what the user sees; navigation (1): See also.
- `plugins/security.md`: advice (3): Understand what a plugin can do, Review a plugin before you install, Remove a plugin you no longer trust; container (2): Identify Anthropic's marketplaces by name, Recognize when Claude Code refuses or warns; telemetry (1): Find plugins in telemetry; navigation (1): Next steps.
- `plugins/troubleshooting.md`: machine (9): Find where /plugin runs, /plugin isn't available in this environment, zsh: no such file or directory: /plugin, The term '/plugin' is not recognized as the name of a cmdlet, claude: command not found after claude plugin ..., Unknown command and command spellings that don't exist, SSH authentication failed or HTTPS authentication failed, SSH host key is not in your known_hosts file, Command 'git' not found or is in an unsafe location; container (10): Add a marketplace, Install a plugin, Plugin "<name>" not found in marketplace "<marketplace>", Plugin installed but not working, Failed to load hooks from <path> and hooks that don't fire, Invalid MCP server config for "<server>" and MCP servers that don't start, Language server doesn't start, uses too much memory, or reports wrong diagnostics, Build a plugin, Host a marketplace, Blocked by your organization; advice (2): Language server uses too much memory, False positive diagnostics in a monorepo; tooling (1): <directory> is not a plugin or skill folder from claude plugin eval init; navigation (1): Next steps.
- `prompt-library.md`: *(page)* marketing: marketing.
- `quickstart.md`: *(page)* guide: overview or guide.
- `remote-control.md`: *(page)* product: another product surface or UI.
- `routines.md`: *(page)* hosting: hosting, CI and gateways.
- `sandbox-environments.md`: *(page)* hosting: hosting, CI and gateways.
- `security-guidance.md`: *(page)* product: describes one plugin, not the contract plugins rely on.
- `security.md`: *(page)* guide: overview or guide.
- `self-hosted-environments-configuration.md`: *(page)* hosting: hosting, CI and gateways.
- `self-hosted-environments-deploy.md`: *(page)* hosting: hosting, CI and gateways.
- `self-hosted-environments-identity.md`: *(page)* hosting: hosting, CI and gateways.
- `self-hosted-environments-quickstart.md`: *(page)* hosting: hosting, CI and gateways.
- `self-hosted-environments-reference.md`: *(page)* hosting: hosting, CI and gateways.
- `self-hosted-environments-testing.md`: *(page)* hosting: hosting, CI and gateways.
- `self-hosted-environments.md`: *(page)* hosting: hosting, CI and gateways.
- `server-managed-settings.md`: service (7): Requirements, Configure server-managed settings, Access control, Fetch and caching behavior, Approval memory, Platform availability, Audit logging; advice (2): Choose between server-managed and endpoint-managed settings, Security considerations; ui (1): Verify settings delivery; container (1): Settings delivery; runtime (2): When a machine's apiKeyHelper isn't in effect, Environment variables and the approval dialog; navigation (1): See also.
- `settings-example.md`: *(page)* duplicate: duplicate of `settings-reference.md`.
- `settings-reference.md`: runtime (308): advisorModel, agentPushNotifEnabled, allowedProviders, alwaysThinkingEnabled, apiKeyHelper, askUserQuestionTimeout, attribution, attribution.commit, attribution.pr, attribution.sessionUrl, autoCompactEnabled, autoConnectIde, autoContinueAtUsageLimit, autoInstallIdeExtension, autoMemoryDirectory, autoMemoryEnabled, autoScrollEnabled, awaySummaryEnabled, awsAuthRefresh, awsCredentialExport, axScreenReader, bashEditDiffEnabled, bashOutputMaxChars, browserExternalPageTools, claudeInChromeDefaultEnabled, claudeMd, claudeMdExcludes, companyAnnouncements, copyFullResponse, copyOnSelect, defaultToAgentsView, desktopSessionCleanupPeriodDays, dialogExpiry, diffTool, disableArtifact, disableBrowserExternalNavigation, disableDeepLinkRegistration, disableDesktopLocalSessions, disableMobileSimulatorTools, disableRemoteControl, editorMode, emojiCompletionEnabled, enableArtifact, externalEditorContext, fallbackModel, fastMode, fastModePerSessionOptIn, feedbackDrafts, feedbackSurveyRate, fileCheckpointingEnabled, fileSuggestion, footerLinksRegexes, forceLoginGatewayUrl, forceLoginMethod, forceLoginOrgUUID, gatewayInternalNetworks, gcpAuthRefresh, idleCompaction, includeCoAuthoredBy, includeGitInstructions, inputNeededNotifEnabled, keybindingFlavor, language, leftArrowOpensAgents, maxProseWidth, modelOverrides, modelPicker, modelPricing, modelSettings, otelHeadersHelper, permissionExplainerEnabled, plansDirectory, preferredNotifChannel, prefersReducedMotion, promptCacheTtl, promptSuggestionEnabled, prStatusFooterEnabled, prUrlTemplate, remote.defaultEnvironmentId, remoteControlAtStartup, respectGitignore, respondToBashCommands, sandbox.allowAppleEvents, sandbox.allowNestedUserNamespaces, sandbox.allowUnsandboxedCommands, sandbox.autoAllowBashIfSandboxed, sandbox.bwrapPath, sandbox.credentials, sandbox.credentials.allowPlaintextInject, sandbox.credentials.awsPairs, sandbox.credentials.envVars, sandbox.credentials.files, sandbox.credentials.sigv4, sandbox.enabled, sandbox.enableWeakerNestedSandbox, sandbox.enableWeakerNetworkIsolation, sandbox.excludedCommands, sandbox.failIfUnavailable, sandbox.filesystem, sandbox.filesystem.allowManagedReadPathsOnly, sandbox.filesystem.allowRead, sandbox.filesystem.allowWrite, sandbox.filesystem.denyRead, sandbox.filesystem.denyWrite, sandbox.filesystem.disabled, sandbox.ignoreViolations, sandbox.network, sandbox.network.allowAllUnixSockets, sandbox.network.allowedDomains, sandbox.network.allowLocalBinding, sandbox.network.allowMachLookup, sandbox.network.allowManagedDomainsOnly, sandbox.network.allowUnixSockets, sandbox.network.deniedDomains, sandbox.network.httpProxyPort, sandbox.network.socksProxyPort, sandbox.network.strictAllowlist, sandbox.network.tlsTerminate, sandbox.ripgrep, sandbox.socatPath, showClearContextOnPlanAccept, showThinkingSummaries, showTurnDuration, skipWebFetchPreflight, spellcheck, spinnerTipsEnabled, spinnerTipsOverride, spinnerVerbs, sshConfigs, sshHostAllowlist, sshHostCommands, subagentPromptCacheTtl, switchModelsOnFlag, syntaxHighlightingDisabled, taskOutputMaxChars, teammateDefaultModel, terminalProgressBarEnabled, terminalTitleFromRename, timeFormat, timeZone, tui, ultracode, verbose, viewMode, vimInsertModeRemaps, voice, voiceEnabled, wheelScrollAccelerationEnabled, advisorModel, alwaysThinkingEnabled, fallbackModel, fastMode, fastModePerSessionOptIn, language, modelOverrides, modelPicker, Fields for modelPicker, modelPricing, Fields for modelPricing, Which models a modelPricing row applies to, modelSettings, promptCacheTtl, showThinkingSummaries, subagentPromptCacheTtl, switchModelsOnFlag, ultracode, sandbox.enabled, sandbox.failIfUnavailable, sandbox.autoAllowBashIfSandboxed, sandbox.excludedCommands, sandbox.allowUnsandboxedCommands, sandbox.filesystem, Sandbox path prefixes, sandbox.filesystem.allowWrite, sandbox.filesystem.denyWrite, sandbox.filesystem.denyRead, sandbox.filesystem.allowRead, sandbox.filesystem.allowManagedReadPathsOnly, sandbox.filesystem.disabled, sandbox.ignoreViolations, sandbox.enableWeakerNestedSandbox, sandbox.enableWeakerNetworkIsolation, sandbox.allowAppleEvents, sandbox.allowNestedUserNamespaces, sandbox.ripgrep, sandbox.bwrapPath, sandbox.socatPath, sandbox.credentials, Invalid credential entries in managed settings, sandbox.credentials.files, Mask fields for files, sandbox.credentials.envVars, Mask fields for environment variables, sandbox.credentials.allowPlaintextInject, sandbox.credentials.awsPairs, sandbox.credentials.sigv4, sandbox.network, sandbox.network.allowUnixSockets, sandbox.network.allowAllUnixSockets, sandbox.network.allowLocalBinding, sandbox.network.allowMachLookup, sandbox.network.allowedDomains, sandbox.network.deniedDomains, sandbox.network.strictAllowlist, sandbox.network.allowManagedDomainsOnly, sandbox.network.httpProxyPort, sandbox.network.socksProxyPort, sandbox.network.tlsTerminate, autoCompactEnabled, autoMemoryDirectory, autoMemoryEnabled, bashOutputMaxChars, claudeMd, claudeMdExcludes, fileCheckpointingEnabled, idleCompaction, Change the idle compaction threshold, Idle compaction in VS Code and the desktop app, plansDirectory, taskOutputMaxChars, askUserQuestionTimeout, autoContinueAtUsageLimit, autoScrollEnabled, axScreenReader, bashEditDiffEnabled, companyAnnouncements, dialogExpiry, editorMode, emojiCompletionEnabled, fileSuggestion, Command input and output, footerLinksRegexes, Badge constraints, keybindingFlavor, maxProseWidth, prefersReducedMotion, promptSuggestionEnabled, respectGitignore, respondToBashCommands, showClearContextOnPlanAccept, showTurnDuration, spellcheck, spinnerTipsEnabled, spinnerTipsOverride, spinnerVerbs, syntaxHighlightingDisabled, terminalProgressBarEnabled, terminalTitleFromRename, timeFormat, timeZone, tui, verbose, viewMode, vimInsertModeRemaps, voice, voiceEnabled, wheelScrollAccelerationEnabled, attribution, includeCoAuthoredBy, includeGitInstructions, prUrlTemplate, attribution.commit, attribution.pr, attribution.sessionUrl, agentPushNotifEnabled, awaySummaryEnabled, disableArtifact, disableDeepLinkRegistration, disableDesktopLocalSessions, disableRemoteControl, enableArtifact, inputNeededNotifEnabled, preferredNotifChannel, remote.defaultEnvironmentId, remoteControlAtStartup, sshConfigs, sshHostAllowlist, sshHostCommands, allowedProviders, Endpoints that need a pin in managed env, apiKeyHelper, awsAuthRefresh, awsCredentialExport, forceLoginMethod, forceLoginGatewayUrl, forceLoginOrgUUID, gatewayInternalNetworks, gcpAuthRefresh, otelHeadersHelper, browserExternalPageTools, disableBrowserExternalNavigation, disableMobileSimulatorTools, desktopSessionCleanupPeriodDays, feedbackDrafts, feedbackSurveyRate, skipWebFetchPreflight, autoConnectIde, autoInstallIdeExtension, claudeInChromeDefaultEnabled, copyFullResponse, copyOnSelect, defaultToAgentsView, diffTool, externalEditorContext, leftArrowOpensAgents, permissionExplainerEnabled, prStatusFooterEnabled, teammateDefaultModel; container (17): Model and responses, Permission settings, Sandbox settings, Memory and context, Interface and terminal, Git and attribution, Hooks and automation, Plugins and skills, MCP, Agents, sessions, and worktrees, Remote, desktop, and notifications, Authentication and providers, Updates and versioning, Tools, Privacy and telemetry, Enterprise and managed settings, Global config settings; duplicate (87): outputStyle, allowManagedPermissionRulesOnly, autoMode, autoMode.classifyAllShell, disableAutoMode, permissions, useAutoModeDuringPlan, permissions.allow, permissions.ask, permissions.deny, permissions.additionalDirectories, permissions.blockReadsOutsideWorkingDirectories, permissions.blockWritesOutsideWorkingDirectories, permissions.defaultMode, permissions.denyInsteadOfPrompting, permissions.disableBypassPermissionsMode, skipAutoPermissionPrompt, skipDangerousModePermissionPrompt, env, statusLine, theme, allowedHttpHookUrls, allowManagedHooksOnly, disableAllHooks, disableWorkflows, enableWorkflows, hooks, httpHookAllowedEnvVars, workflowKeywordTriggerEnabled, workflowSizeGuideline, disableBundledSkills, disableSkillShellExecution, skillOverrides, syncClaudeAiSkills, syncClaudeAiPlugins, allowedChannelPlugins, blockedMarketplaces, channelsEnabled, disableCommandPluginSources, pluginSuggestionMarketplaces, pluginTrustMessage, strictKnownMarketplaces, strictPluginOnlyCustomization, strictPluginOnlyCustomization.skills, strictPluginOnlyCustomization.agents, strictPluginOnlyCustomization.hooks, strictPluginOnlyCustomization.mcp, enabledPlugins, extraKnownMarketplaces, pluginConfigs, prependPlugins, appendPlugins, allowAllClaudeAiMcps, allowClaudeInChromeWithManagedMcp, allowedMcpServers, allowManagedMcpServersOnly, deniedMcpServers, disableClaudeAiConnectors, disabledMcpjsonServers, enableAllProjectMcpServers, enabledMcpjsonServers, managedMcpServers, agent, crossSessionInbound, disableAgentView, isolatePeerMachines, processWrapper, teammateMode, worktree, worktree.baseRef, worktree.symlinkDirectories, worktree.sparsePaths, worktree.bgIsolation, worktree.location, autoUpdatesChannel, minimumVersion, requiredMaximumVersion, requiredMinimumVersion, disableSideloadFlags, forceRemoteSettingsRefresh, managedSourcesBehavior, parentSettingsBehavior, policyHelper, policyHelper.path, policyHelper.timeoutMs, policyHelper.refreshIntervalMs, wslInheritsWindowsSettings; model (1): Classifier billing notice; navigation (1): See also.
- `settings.md`: container (5): Settings files and who they affect, Keep personal settings out of a repository, Change a setting, Precedence examples, Troubleshoot a setting that doesn't apply; advice (1): Share settings with your team; ui (4): Check what your organization enforces, Use the /config menu, Confirm what loaded, A change you made in Claude Code is lost in new sessions; tutorial (4): Team settings override personal settings, Organization settings override everything, The command line overrides your files for one session, A flag or environment variable sets the same thing; navigation (1): What's next.
- `setup.md`: *(page)* provider: model providers and install.
- `skills.md`: builtin (4): Check your setup with /doctor, Run and verify your app, Run your checks before each commit, Work on Claude API projects; tutorial (3): Getting started, Create your first skill, Generate visual output; container (5): Load skills from a directory outside the project, Configure skills, Pre-approve tools for a skill, Advanced patterns, Troubleshooting; advice (3): Types of skill content, Share skills, Skill triggers too often; ui (1): Find unused skills; tooling (2): Evaluate and iterate on a skill, Run evals with skill-creator; navigation (1): Related resources.
- `slack.md`: *(page)* product: another product surface or UI.
- `sub-agents.md`: tutorial (9): Quickstart: create your first subagent, Isolate high-volume operations, Run parallel research, Chain subagents, Example subagents, Code reviewer, Debugger, Data scientist, Database query validator; container (6): Configure subagents, Choose an effort level, Control subagent capabilities, Define hooks for subagents, Work with subagents, Common patterns; advice (2): Understand automatic delegation, Choose between subagents and main conversation; ui (2): Finished subagents in the panel and task list, Observe and steer running forks; runtime (7): API errors in subagents, Subagent output scanning, Manage subagent context, Resume subagents, Fork the current conversation, How forks differ from other subagents, Turn fork mode off; navigation (1): Next steps.
- `terminal-config.md`: machine (4): Enter multiline prompts, Enable Option key shortcuts on macOS, Configure tmux, Fix Backspace deleting a whole word on Windows; ui (9): Get a terminal bell or notification, See session status in your terminal, Switch to fullscreen rendering, Cap response width in wide terminals, Paste large content, How Claude treats pasted text, Delete and restore a collapsed paste, Recall a prompt that had pasted text, Edit prompts with Vim keybindings; tutorial (1): Play a sound with a Notification hook; container (1): Match the color theme; navigation (1): Related resources.
- `third-party-integrations.md`: *(page)* hosting: hosting, CI and gateways.
- `tools-reference.md`: runtime (33): AskUserQuestion tool behavior, Question auto-continue timeout, Bash tool behavior, What persists between commands, Timeout and output limits, Output limits, Background commands, When a background command stops, Time limit for background commands, Raise the time limit for background commands, Foreground commands that move to the background, Memory limit on Linux and WSL, Edit tool behavior, Non-UTF-8 files, EndConversation tool behavior, EnterWorktree tool behavior, Glob tool behavior, Grep tool behavior, Monitor tool, WebSocket source, Addresses and hosts denied to WebSocket watches, Bash rules that deny or prompt for WebSocket watches, NotebookEdit tool behavior, Exit code 1 from searches and git diff in PowerShell, Windows encoding and exit codes, Preview limitations, Read tool behavior, Large files, WebFetch tool behavior, WebFetch availability, WebSearch tool behavior, Session search limit, Write tool behavior; service (7): SendFeedback tool behavior, What you see when Claude drafts, Review and edit a draft, Send a draft, Discard or keep a draft, Turn Claude-drafted feedback off, Sessions without Claude-drafted feedback; ui (1): Check which tools are available; navigation (1): See also.
- `troubleshoot-install.md`: *(page)* provider: model providers and install.
- `troubleshooting.md`: *(page)* guide: overview or guide.
- `ultrareview.md`: *(page)* product: another product surface or UI.
- `voice-dictation.md`: *(page)* product: another product surface or UI.
- `vs-code.md`: *(page)* product: a graphical front end over the same install, enable and `userConfig` flow (§16, §3).
- `web-quickstart.md`: *(page)* hosting: hosting, CI and gateways.
- `whats-new/2026-w13.md`: *(page)* digest: release digest.
- `whats-new/2026-w14.md`: *(page)* digest: release digest.
- `whats-new/2026-w15.md`: *(page)* digest: release digest.
- `whats-new/2026-w16.md`: *(page)* digest: release digest.
- `whats-new/2026-w17.md`: *(page)* digest: release digest.
- `whats-new/2026-w18.md`: *(page)* digest: release digest.
- `whats-new/2026-w19.md`: *(page)* digest: release digest.
- `whats-new/2026-w20.md`: *(page)* digest: release digest.
- `whats-new/2026-w21.md`: *(page)* digest: release digest.
- `whats-new/2026-w22.md`: *(page)* digest: release digest.
- `whats-new/2026-w23.md`: *(page)* digest: release digest.
- `whats-new/2026-w24.md`: *(page)* digest: release digest.
- `whats-new/2026-w25.md`: *(page)* digest: release digest.
- `whats-new/2026-w26.md`: *(page)* digest: release digest.
- `whats-new/2026-w27.md`: *(page)* digest: release digest.
- `whats-new/2026-w28.md`: *(page)* digest: release digest.
- `whats-new/2026-w29.md`: *(page)* digest: release digest.
- `whats-new/2026-w30.md`: *(page)* digest: release digest.
- `whats-new/2026-w32.md`: *(page)* digest: release digest.
- `whats-new/2026-w33.md`: *(page)* digest: release digest.
- `whats-new/2026-w34.md`: *(page)* digest: release digest.
- `whats-new/2026-w35.md`: *(page)* digest: release digest.
- `whats-new/2026-w36.md`: *(page)* digest: release digest.
- `whats-new/2026-w37.md`: *(page)* digest: release digest.
- `whats-new/index.md`: *(page)* digest: release digest.
- `workflows.md`: advice (2): When to use a workflow, Cost; ui (6): Run a bundled workflow, Watch the run, Ask for a workflow in your prompt, Dismiss or turn off the keyword, Where the keyword works, Approve the plan before it runs; builtin (1): Bundled workflows; container (4): Have Claude write a workflow, How a workflow runs, Manage runs, Resume after a pause; model (2): Let Claude decide with ultracode, Prompt caching in a fan-out; tutorial (7): Example workflow prompts, Audit many files for the same issue, Keep fixing until a check passes, Migrate many files in parallel, Review every changed file and write one summary, Research a topic across many sources, Find issues until the list stops growing; navigation (1): Related resources.
- `zero-data-retention.md`: *(page)* billing: billing, legal, usage.

## Method

Read the scope files and scripts named in `spec/scope-audit.md`; for every excluded page, the lines
naming plugins, hooks, skills, agents or MCP; for every included page, the excluded headings and rows
by reason; for each candidate the documentation section and a search of `extend/spec/1.1.0/`.
Container, duplicate, navigation and tutorial items were taken as out unless a finding sat inside
them; advice items were read where they could hold a rule. A "stated" verdict means the fact is in
the chapter text, not that its wording was checked against the documentation.
