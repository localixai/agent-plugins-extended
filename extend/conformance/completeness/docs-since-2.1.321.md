# Claude Code documentation since 2.1.321

What the official Claude Code documentation changed between the snapshot that
`requirements.json` was extracted from (2.1.321) and the documentation published on 2026-11-16.
This is a reading aid for the next update of the snapshot (`SOURCE.md`, "Updating to a new Claude
Code release"); it changes no requirement and no chapter.

## Releases

- **Documentation now describes Claude Code 2.1.325** (changelog's first entry, 2026-11-13).
- Releases since the snapshot: 2.1.322 (one line: fast mode on Vertex), 2.1.323 (2026-11-12),
  2.1.325 (2026-11-13). 2.1.324 has no changelog entry, but pages cite "v2.1.324 or later" for
  several features shipped in the 2.1.325 entry (MCP bundles under `mcpb/`, marketplace `ref` by
  SHA, remote-marketplace mods counting as the organization's, sandbox auto-allow default).
- The changelog entries below 2.1.321 are unchanged except two wording edits.

## Counts

| | |
| --- | ---: |
| Pages in the 2.1.321 snapshot | 227 |
| Pages now | 204 |
| New pages | 2 |
| Removed pages | 25 (`whats-new/index.md` and 24 weekly `whats-new/2026-w*.md`; the index no longer links them) |
| Index entry that moved off the docs site | 1 (`claude-tag.md` now redirects to claude.com) |
| Pages changed | 136 |
| Pages that `requirements.json` cites | 50, of which 40 changed |
| Changed sections (by heading), all pages | 646: 574 changed, 63 added, 9 removed |
| Changed sections on cited pages | 263: 225 changed, 34 added, 4 removed |
| Of those, sections that own requirement ids | 111 |
| Sections whose only change is dropping an old "Requires Claude Code v2.1.2xx" note | 7 (more mixed in) |

Most edits on cited pages are rewording, dropped version notes for old releases, and new
provider text (Claude Models on Google Cloud). The list below keeps only the changes that alter
what the contract says. Ids are those `requirements.json` files under the changed page and
section; "no id" means the section has no requirement of its own (it needs a new one or is
outside the extracted scope).

## Changes by chapter

### 01-packages.md, 02-manifest.md (manifest and layout)

- **Plugin default settings removed from the docs.** The `settings` manifest field, the plugin-root
  `settings.json`, its row in the standard layout and the plugin explorer are gone
  (`plugins/manifest-reference.md` Fields, `settings`, Standard layout). Changelog 2.1.323: a
  plugin's `agent` setting is deprecated (still applies, now warns in startup, `plugin list`,
  `plugin validate`), and `subagentStatusLine` is removed. Ids: `manifest.field.settings`,
  `layout.Settings`. Chapters: 01-packages, 02-manifest (also 12-settings, 17-errors below).
- **MCP bundle extraction moved.** `.mcpb`/`.dxt` bundles extract into `mcpb/` under the plugins
  root (`~/.claude/plugins`), not `.mcpb-cache/` in the plugin folder; a URL bundle is downloaded
  again once (v2.1.324). Section `Component path forms > mcpServers` (no id; `manifest.field.mcpServers`
  nearby). Chapters: 02-manifest (table lines 192-193), 08-mcp (lines 33-34).
- **Containment, new message.** For an `mcpServers` or `lspServers` file, `path not read: <path>
  is absolute or has a ".." part` means the path is absolute or holds `..` (even if it stays
  inside); the rest of the plugin loads. Id: `manifest.rule.Containment and existence`; new
  errors section "Server file path not read" (no id). Chapters: 02-manifest, 17-errors.
- **Changelog only, not yet in the docs:** `engines["claude-code"]` in `plugin.json` (2.1.323:
  plugins outside the range are not installed, updated or loaded; install picks the newest
  version that fits); plugin loading skips, and `plugin validate` reports, unsafe paths and links
  (2.1.325). Chapter: 02-manifest, 16-install.

### 03-environment.md

- `CLAUDE_CODE_PLUGIN_DIR_WATCH`: mods in skills directories now reload in any session of more
  than one prompt, headless included; `--plugin-dir` mods reload only in interactive terminal
  sessions; `1` makes them behave like skills-directory mods, `0` turns reloading off. Ids:
  `environment.host.CLAUDE_CODE_PLUGIN_DIR_WATCH`, `mods.setting.CLAUDE_CODE_PLUGIN_DIR_WATCH`.
  Chapters: 03-environment, 10-mods/reference.
- New variables: `CLAUDE_CODE_EXPERIMENTAL_CODE_MODE` (not honoured from project, local or
  managed `1`; a `0` in managed blocks it), `CLAUDE_CODE_AUTOMOUNT_ROOTS` (skips automount roots
  when looking upward for `CLAUDE.md`, skills, `.mcp.json`), `CLAUDE_CODE_RESUME_HINT_COMMAND`,
  `CLAUDE_CODE_DISABLE_FEATURE_FLAGS` (supersedes `DISABLE_GROWTHBOOK`), Google Cloud provider
  variables. Section `Variables` (56 ids, none for these). Chapter: 03-environment.

### 04-skills.md

- **Skill tool can now prompt.** `tools-reference.md`: `Skill` needs permission for "Some skills":
  those that set `allowed-tools`, `disallowed-tools` or `hooks`. Changelog 2.1.325: scheduled
  tasks and `/loop` ask before such a skill; `Skill(name)` in `permissions.allow` runs it
  unattended. Id: `tools.tool.Skill`. Chapters: 04-skills, 07-hooks/tools.
- **Injected `!` commands.** `allowed-tools` no longer covers a Bash command containing `git` (or
  unparseable) when the nearest repository looks bare (`HEAD` beside `refs` or `commondir`).
  Id: `skills.behavior.Permission checks on injected commands`. Chapter: 04-skills.
- `disable-model-invocation`: Claude's call is blocked unless the user's message has `/name` as a
  separate word. Ids: `skills.invocation.*`. Synced skills: `!`, `@` and placeholders are not
  processed "in a terminal or VS Code session" (was "any other session"). Edit-during-session:
  a mod's module file under `hooks/` reloads on its own. Ids:
  `skills.behavior.Edit a skill during a session`. Chapter: 04-skills.
- Custom commands: the docs now state Claude can invoke `.claude/commands/` files on its own,
  stopped by `disable-model-invocation: true` (top section, no id). Chapter: 04-skills.
- Changelog 2.1.321/2.1.325: nested `.claude/skills` inside `~/.claude/plugins`, and inside
  `--plugin-dir` plugins from a session started above them, no longer load. Chapter: 04-skills.

### 05-agents.md

- **Nested subagent model.** A nested subagent (and `inherit`, built-ins, forks) now runs on the
  *spawning subagent's* model, not the main conversation's; the model order's last step and
  `inherit` are redefined accordingly; new sections "Which model a nested subagent runs on",
  "Which version a model alias selects", "When an allowlist blocks a subagent model", "Check a
  subagent's model", "Extended thinking in subagents" (no ids). In plan mode with `opusplan` or
  `haiku` those run on Opus or Sonnet. Ids: `agents.behavior.Choose a model` (+ `.Full model ID`,
  `.Model alias`, `.inherit`), `agents.behavior.Built-in subagents`,
  `agents.behavior.Let subagents spawn their own subagents`,
  `agents.behavior.Run every subagent on one model`. Chapter: 05-agents.
- Forks skip both tool filters and receive the parent's exact tool pool. Id:
  `agents.behavior.Available tools` (and its 7 items). Chapter: 05-agents.

### 07-hooks (README, configuration, events, handlers, results, tools)

- **`continue: false` no longer blocks a `PreToolUse` call**; return `permissionDecision: "deny"`
  too. The stop does not apply when the permission check refuses the call. Ids:
  `hooks.output.JSON.continue`, `hooks.output.common.continue`. Chapter: 07-hooks/events.
- `suppressOutput`: now just "Has no effect". Id: `hooks.output.JSON.suppressOutput`.
- **Plain-text stdout**: the claim that stdout of most events goes only to the debug log is
  removed; the list is now of events whose plain-text stdout reaches Claude. Ids:
  `hooks.behavior.Exit code 0`, `hooks.behavior.Other exit codes`. Chapter: 07-hooks/results.
- **Background processes**: a non-async hook that leaves a child's stdout/stderr open takes up
  to 10 s to finish; the error text gains `stdio went quiet`. Id:
  `hooks.behavior.Hooks that start a background process`. Chapter: 07-hooks/results.
- **MCP tool hooks**: new text: when the tool's answer can't be read (too large, no text), the
  hook gives no verdict; on `PreToolUse` the call is refused, elsewhere non-blocking. Section
  `MCP tool hook fields > How the tool's result is read` (no id). Chapter: 07-hooks/handlers.
- **Code Mode** (new page `code-mode.md`): each tool call in Claude's code passes `PreToolUse`
  hooks; a hook that fails or times out *refuses* the call even with `onFailure` unset; the
  `REPL` tool carries the code in `tool_input.code`; `UserPromptSubmit` command/http/mcp_tool
  hooks also run on code output (`source: "poll_event"`), and a block `reason` then reaches
  context. Notes added at `hooks.behavior.Timeouts`, `hooks.behavior.Block the action when a hook
  fails`, `hooks.event.UserPromptSubmit`, `hooks.output.UserPromptSubmit.reason`. Chapters:
  07-hooks/events, 07-hooks/results.
- **Permission update entries**: `rules` entries map `Tool(specifier)` to `toolName` /
  `ruleContent`; `Bash` and `Bash(*)` have no `ruleContent`; an MCP allow rule with
  `ruleContent` matches nothing. Ids: `hooks.permissionUpdate.*` (6). Chapter: 07-hooks/results;
  same rule added under `permissions.behavior.MCP` (13-permissions).
- **ConfigChange**: rules saved by "don't ask again", `/permissions` or `/model` take effect
  without running the hooks in the saving session (they run in other sessions). Ids:
  `hooks.event.ConfigChange`, `hooks.matcherValue.ConfigChange.*`. Chapter: 07-hooks/events.
- `PostToolUse.updatedToolOutput` ignored for `AskUserQuestion`/`ExitPlanMode` in Cowork cloud
  sessions; `PostToolUseFailure` can't rewrite a result. Ids:
  `hooks.output.PostToolUse.updatedToolOutput`, `hooks.behavior.Decision control`.
- `hooks.behavior.Hook locations`: `subagentStatusLine` dropped from the settings narrowed to
  managed. `hooks.output.Elicitation.*`: the sentence mapping Decline/Esc to `decline`/`cancel`
  is removed (changelog: Esc on a background MCP task's question now means "answer later").
- Changelog 2.1.323, not in the hooks pages: a `PreToolUse` "allow" followed by a failing
  permission check is decided as if no hook answered; input rewritten by a `PermissionRequest`
  hook that then fails the check asks again; `tool.list` plugin hooks apply to every agent.

### 08-mcp.md, 08-mcp-policy.md

- Bundle extraction under `mcpb/` (see 02-manifest).
- `--strict-mcp-config` reworded: skips servers from `.mcp.json`, `~/.claude.json` *or a plugin*,
  loads `--mcp-config`. Ids: `cli.flag.--strict-mcp-config`, `mcpSettings.behavior.Project scope`.
  Chapters: 08-mcp-policy, 17-cli.
- `managed-mcp.json` exclusive control does not stop the server Claude Code creates for tools a
  mod adds (section `Exclusive control with managed-mcp.json`, no id). Mods admin: a user's mod
  can keep a managed MCP server from connecting (v2.1.323). Chapters: 08-mcp-policy, 14-policy-mods.
- MCP task questions: Esc means answer later; reopen from `/tasks` (v2.1.324). Desktop Code tab
  precedence sentence for duplicate stdio names removed
  (`mcpSettings.behavior.Scope hierarchy and precedence`). Changelog: project `.mcp.json`
  approvals match the exact server name.

### 10-mods (README, api, events, interface, reference, troubleshooting)

- **One row per mod above the prompt** (v2.1.323). The band no longer holds one shared drawing:
  each mod draws its own row, stacked in mod order; a new render site `AbovePromptList` (`rows`
  of `{ plugin, tree }`); the rows share one tree's limits; new `ui.render (AbovePrompt) refused:
  a row past the limits of the band` line. Ids: `mods.site.AbovePrompt`, `mods.limit.*`,
  `mods.interface.Pick where to draw`, `mods.troubleshoot.Another mod's band shows and yours
  doesn't`. Chapters: 10-mods/interface, reference, troubleshooting.
- **Matchers need `plugin` to reach other mods' UI** (v2.1.323). `ui.press`, `ui.input`,
  `ui.select`, `ui.focus` and `ui.render` hooks skip other mods' controls, panes and rows unless
  the matcher has `plugin` (`{ plugin: '*' }` for all); wildcards without a matcher still see
  all. New section "Hook other mods' drawings and controls" (no id); `plugin validate` and
  `review` print `(default matcher key: plugin)`. Chapters: 10-mods/events, 14-policy-mods.
- **Backdrop renamed fields** (v2.1.323): `$.theme.set({ backdrop: { scene }, overrideColorScheme })`;
  render-site props `scene`, `overrideColorScheme` replace `id`, `colorScheme`; `$.theme.set` now
  also carries `colors` (Desktop Code tab theme, v2.1.324; new sections on colors mods). Ids:
  `mods.site.Backdrop`, `mods.api.$.theme`, `mods.interface.Put a backdrop behind the
  conversation.*`, `mods.limit.*` (backdrop `scene` name). Chapters: 10-mods/interface, reference.
- **Mods' own tool calls never prompt**: `$.tool.call` that needs approval resolves with
  `{ deny: "<tool> wasn't run: ... a mod's own call can't ask for it." }`; `$.mcp.call` has no
  prompt but is refused by deny rules, managed ask rules, `requiresUserInteraction` tools and
  org `ask` connectors. Ids: `mods.api.$.tool`; mods admin "Review what a mod can do" (no id).
  Chapters: 10-mods/reference, 14-policy-mods.
- **API-call events also fire for Claude Code's own actions**: check `next.origin.plugin ===
  'engine'`; a hook no longer only "intercepts calls from the mods that run after it". New
  section on Claude Code's own `http.fetch` (`e.init.compress`, `value.isStreaming`, v2.1.321).
  Id: `mods.reference.Mods API calls`. Chapter: 10-mods/events, reference.
- `next.error`: the `re-entry` kind and `next.error.cause` are removed from the table. Ids:
  `mods.hookArgument.next.error`, `mods.hookArgument.next.error.cause`. Chapter: 10-mods/reference.
- `$.ui.open` rejects when another mod has a pane open with that `id`; `AbovePrompt` prop
  `isCollapsed`; render-site keys "the drawn row's id", `InfoNotice` key `notice:<text>`;
  hotkey clashes across mods' rows press neither button. Ids: `mods.interface.Open a pane at the
  right time.*`, `mods.site.*`, `mods.element.*`, `mods.troubleshoot.Hotkeys do nothing.*`.
- Claude-written mods: load without asking in auto and bypass modes; resumed sessions load the
  mods already in the mods folder without asking; not loaded in `dontAsk` or the `-p` run that
  writes them. Ids: `mods.create.Sessions where a mod Claude writes can't load.*`.
- Reload: `reload failed: <reason>` vs `reload failed, the previous version stays loaded`
  (new section, no id); guard message text now `the rules and hooks in your settings could not be
  checked`. Ids: `mods.troubleshoot.Messages from the built-in guard`,
  `mods.troubleshoot.A message about the deny rules in your settings`.
- Test kit: a `ui.render` hook returning `next(e)` mounts without a stub; new `keepsBeneath()`
  (page `plugins/mods/test.md`, not cited).
- Changelog only: `isPromptCovered` pane prop; `engine.create` hooks with `*`, namespace or negated
  matchers only observe, and `plugin validate` fails a non-canonical `engine.create` hook;
  `$.model.complete` / `classify` count toward cost and `--max-budget-usd`.

### 11-workflows.md

- Usage-limit pause now also in the Desktop Code tab (v2.1.319), not with usage-based billing;
  agents failed at a usage limit rerun on relaunch (v2.1.318). Ids:
  `workflows.behavior.When a run hits your usage limit`,
  `workflows.behavior.Which agents run again.*`. Chapter: 11-workflows.

### 12-settings.md

- **`subagentStatusLine` removed** (settings index, its section, statusline "Subagent status
  lines", the managed-only narrowing, the status-line gates). Changelog: files that hold it still
  load. Id: `settings.reference.Status line and file suggestion gates`; the key has no id of its
  own. Chapter: 12-settings (lines 147, 231, 384-402, 463, 518).
- **Plugin default settings** section removed (see 02-manifest). Ids:
  `settings.components.Default settings.*` (3), `settings.key.agent` (the sentence about plugins
  supplying it is gone). Chapter: 12-settings §12.6.
- **`sandbox.autoAllowBashIfSandboxed` default is now `false`** (v2.1.324); a managed `true` must be
  in the highest-ranked managed source. No id (outside the extracted settings). Chapter:
  13-permissions line 736 states the old default `true`.
- `strictPluginOnlyCustomization`: now "blocks from user and project sources" (not "lock to plugin
  and managed sources"), does not reject sideload flags; pair with `disableSideloadFlags`. Ids:
  `settings.key.strictPluginOnlyCustomization` (+4), `policy.org.Control matrix.strictPluginOnlyCustomization`.
  Chapters: 12-settings, 14-policy-org.
- `enabledPlugins` in project settings doesn't install; `extraKnownMarketplaces` points at the
  loading page. `skipDangerousModePermissionPrompt` also from `--settings` files; background
  sessions count only user and managed. New managed key `disableRemotePreviewScripts` (Desktop).
  `ConfigChange` runs only for direct file edits (`settingsMerge.settings.When edits take effect`).
- `sandbox.failIfUnavailable` doesn't stop Anthropic-hosted sessions.

### 13-permissions.md, 13-trust.md

- Sandbox auto-allow default flipped (see 12-settings); `permissions.md` "How permissions interact
  with sandboxing" reworded for an explicit `true`. No id. Chapter: 13-permissions.
- New pointer to `permissions.denyInsteadOfPrompting` under permission modes. Ids:
  `permissions.mode.*`. Plan mode: Shift+Tab at the approval prompt approves the plan. Id:
  `permissions.modes.Analyze before you edit with plan mode`. Protected paths: each mode has its
  own rule. Id: `permissions.modes.Protected paths`. `--setting-sources` without `user` brings the
  bypass dialog back (`permissions.modes.Skip all checks with bypassPermissions mode`).
- MCP allow rules must not carry a specifier. Id: `permissions.behavior.MCP`.
- Trust: the VS Code extension now asks for folder trust (`Trust this folder in Claude Code?`).
  Ids: `trust.behavior.Project allow rules and workspace trust`,
  `trust.behavior.What runs before you trust a folder`. Chapter: 13-trust.
- Plugin install warning now says plugins can run code with access to files and shell. Id:
  `trust.security.Trust warning before you install`. Chapter: 13-trust.
- Changelog: sandbox refuses writes to `.claude` settings, skills, agents, commands and hooks in
  added directories; relative deny rules apply in added directories; `mcp__plugin_*_` rules match
  any letter case; worktree `--trust-workspace false` stops repo settings disabling hooks or
  toggling plugins.

### 14-policy.md, 14-policy-org.md, 14-policy-mods.md

- **Group configurations in server-managed settings** (Enterprise): one configuration per group,
  ranked, a catch-all, no merging. New section "Give groups different settings" (no id). Ids:
  `policy.server.Current limitations`, `policy.managed.Choose a delivery mechanism.*`,
  `policy.org.Plan for what managed settings can't enforce`,
  `updates.org.Assign release channels to user groups`. Chapters: 14-policy, 14-policy-org, 16-updates.
- **Server-managed cache expires 24 h after the last successful fetch**; after that a failed fetch
  starts with no remote policy. Ids: `policy.server.Enforce fail-closed startup`,
  `cli.errors.Remote managed settings failed to load.No cache`. Chapters: 14-policy, 17-errors.
- **Remote-marketplace mods can count as the organization's** (v2.1.324): enable in managed
  `enabledPlugins`, declare in `extraKnownMarketplaces`, list in `prependPlugins`/`appendPlugins`.
  Previously every cached plugin counted as a user's. `pluginDigests` deprecated (changelog). Ids:
  `policy.mods.Install your organization's mods and set the order.*` (9),
  `policy.mods.Stop user-installed mods from loading.*`,
  `policy.mods.Apply your plugin controls to mods.*`. Chapter: 14-policy-mods.
- Guard: a user's mod can withhold a managed MCP server and add or remove tools. Ids:
  `policy.mods.Know what happens by default.*`. A `ui.focus` hook needs a wider matcher; deny
  only after checking the caller. Ids: `policy.mods.Enforce a policy with a mod of your own.*`.
- `strictPluginOnlyCustomization` (see 12-settings); per-repository plugins need each
  contributor's `--scope project` install. Id: `policy.org.Require plugins per repository`.

### 15-marketplaces.md, 15-marketplace-hosting.md

- **`ref` accepts a full lowercase commit SHA** on a branch or tag (v2.1.324), refused for
  reserved names; older clients can't load such a marketplace. Ids: `marketplace.sourceField.ref`,
  `cli.plugin.plugin marketplace list.ref`, `policy.reference.Allowed source types.github`.
  Chapters: 15-marketplaces, 17-cli, 14-policy-org.
- **`npm`, `pip`, `uv`, `cargo`, `github`, `gh` are no longer reserved names** (bullet and
  validation row removed; changelog 2.1.323 "fixed ... being refused"). Id:
  `marketplace.rule.Reserved names.npm, pip, uv, cargo, github, and gh` (now has no text).
  Chapter: 15-marketplaces.
- Changelog: installs fail when a git submodule isn't on its recorded commit; downloads use a
  CONNECT tunnel with only `ALL_PROXY`; one malformed `renames` entry no longer voids the others.

### 16-install.md, 16-updates.md, 16-dependencies.md

- **Project-enabled plugins**: rewritten "Enabled in project settings but not installed": by
  default not loaded until installed per clone (`--scope project`); relative-path plugins from a
  git marketplace load with `/reload-plugins` (or `CLAUDE_CODE_SYNC_PLUGIN_INSTALL=1` in `-p`);
  the `not cached at <path>` message now also covers this case. New section "Enabled in an
  `--add-dir` directory but not loaded" (`--setting-sources`). Ids:
  `install.loading.Enabled in project settings but not installed`,
  `install.guide.Choose an install scope.Project scope`. Chapters: 16-install, 17-errors.
- `mcpb/` added to the plugins-root table (`plugins/loading.md` "Find plugins on disk", no id).
- Changelog only: `engines["claude-code"]` gates install, update and load (2.1.323);
  `unsetOptionCount` in `plugin install --json`; install shows a warning when the install command
  writes to stderr; plugins with a version list in `enabledPlugins` now say why they're off.

### 17-cli.md, 17-errors.md

- `plugin list --json` `hasUserConfig`: the "saved values are never included" sentence is gone.
  Id: `cli.plugin.JSON output.hasUserConfig`.
- `plugin validate`: changelog adds TypeScript type checking of a hooks module (warnings,
  `--strict` fails), unsafe-path reports, and `engine.create` checks (not yet on the CLI page).
  Id area: `cli.plugin.Validate a directory`.
- `Path escapes plugin directory` no longer lists `settings.json`. Id:
  `cli.errors.Path escapes plugin directory.settings.json`. Chapter: 17-errors.
- New errors: `Server file path not read`; `Skill, command, or hook over the 4,000,000-character
  limit` (a `PreToolUse` prompt/agent hook over it doesn't block outside Code Mode); `Refusing to
  apply edits ... a hook is configured for file edits` (Artifact one-step updates off while a
  `PreToolUse` hook or mod is on Edit/Write); `PreModelSwitch` "could not be checked" refusal only
  before v2.1.323. No ids. Chapter: 17-errors.
- `claude mcp reset-project-choices` is the way to re-ask project MCP approvals
  (`debug-your-config.md`, no id).

## New pages

| Page | What it is | Contract relevance |
| --- | --- | --- |
| `code-mode.md` | Code Mode, an experimental opt-in (v2.1.323) in which Claude writes JavaScript run by the `REPL` tool that calls its tools | High for hooks and permissions: per-call `PreToolUse` hooks fail closed, `UserPromptSubmit` runs on code output with `source: "poll_event"`, classifier reviews code not calls, blocked by any installed mod that checks tool calls, `CLAUDE_CODE_EXPERIMENTAL_CODE_MODE` honoured only from shell/user/`--settings`, `0` in managed blocks it. Chapters 07-hooks, 13-permissions, 03-environment, 10-mods |
| `claude-models-on-google-cloud-anthropic-managed.md` | A new provider, Claude Models on Google Cloud (Anthropic managed) | Low: provider variables (03-environment), `allowedProviders` value `anthropicGoogleCloud` (12-settings) |

## Where this came from

- Current pages: downloaded 2026-11-16 from `https://code.claude.com/docs/llms.txt` and every
  `https://code.claude.com/docs/en/*.md` it links (kept outside the repository).
- Snapshot: the 2.1.321 pages the reference implementation holds.
- Sections are compared by heading path after collapsing blank lines; each section is matched to
  requirement ids by `page` and the last heading (`section`), and to chapters by the `req:`
  markers under `extend/spec/1.1.0/`.
