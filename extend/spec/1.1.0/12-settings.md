# 12. Settings

Settings are the JSON keys that change how the client behaves. A plugin meets them three ways: the
user's and the organization's settings decide whether it is enabled, which marketplaces are known
and which of its hooks, mods, monitors and channels may run; its user configuration is saved in
them; and it can ship two defaults of its own (§12.6). This chapter states the settings files, how
the same key set in several of them resolves, how the managed tier composes its sources, and every
key the contract names. Evidence: `settings.md` for §12.1–§12.4, `managed-settings.md` for §12.5,
`plugins/components.md` ("Default settings") for §12.6 and `settings-reference.md` for §12.7, unless
a paragraph names another page. Permission rules and workspace trust are §13's; what each managed
policy key enforces is §14's, the marketplace keys are also §15's.

## 12.1 Settings files and scopes

### 12.1.1 The files

1. A client MUST read settings from these files, each a JSON object of keys. `~/.claude` is the
   `.claude` directory of the configuration directory (`CLAUDE_CONFIG_DIR`, §3.6.3, default the
   home directory's), and a bare `.claude` is the project's:

   | Scope | File | Applies to |
   | --- | --- | --- |
   | User | `~/.claude/settings.json` | The user, in every project on this machine; nobody else's machine and no cloud session. <!-- req: settingsMerge.settings.Compare the scope of each settings file.~/.claude/settings.json --> |
   | Shared project | `.claude/settings.json` | Everyone who works in the project folder. It reaches a teammate's clone or a cloud session only once it is committed to version control. <!-- req: settingsMerge.settings.Compare the scope of each settings file.acme-app/.claude/settings.json --> |
   | Project local | `.claude/settings.local.json` | The user, in this project only. When the client first writes it in a git repository that does not already ignore it, it adds `**/.claude/settings.local.json` to the user's global git excludes file (§12.1.2). <!-- req: settingsMerge.settings.Compare the scope of each settings file.acme-app/.claude/settings.local.json --> |
   | Managed | `managed-settings.json`, `managed-settings.d/`, an MDM or OS policy, server-managed settings (§12.5) | Every project on every machine the organization deploys it to, or that signs in with the organization's account. Only server-managed settings reach a cloud session. <!-- req: settingsMerge.settings.Compare the scope of each settings file.Managed settings --> |

2. Besides the files, a session can carry `--settings` JSON (§12.2.2), a plugin's default settings
   (§12.6), the parent settings an embedding host passes (§14), and, for two keys only, the settings
   of a directory added with `--add-dir` (§12.3.1).
3. `~/.claude.json` is not a settings file. The client writes it for itself (account details, MCP
   servers of the user and local scopes, per-project state such as trust decisions) and reads from
   it only the keys the settings index marks `Global config`. A `Global config` key in a settings
   file, `--settings` included, does not apply (Judgment J12.6).
4. Installing the client MUST NOT create a settings file. A file that exists came from one of
   these: <!-- req: settingsMerge.settings.Find or create your settings files.Managed | settingsMerge.settings.Find or create your settings files.Shared project | settingsMerge.settings.Find or create your settings files.User -->
   - **Managed**: the organization deploys it; the user neither creates nor edits it.
   - **Shared project**: committed with the project, or created by the user at `.claude/settings.json`.
   - **User** and **project local**: created by the user, or by the client when it first saves a
     choice there. The client writes `~/.claude/settings.json` the first time the user changes a
     `/config` option stored in user settings (the theme, for one), and
     `.claude/settings.local.json` the first time the user gives a standing approval on a permission
     prompt ("Yes, and don't ask again"). A few `/config` options, **Show tips** among them, save to
     the local file instead.

### 12.1.2 Where the project files are read

1. The shared `.claude/settings.json` is read from the session's primary working directory (§13),
   with no fallback to a parent directory. After the session moves with `/cd`, both project files
   are read from the new directory (2.1.246 and later).
2. The local file lives at the **git repository root** when the session starts in a subdirectory of
   a repository, and the client reads and writes it there; in a worktree it is the main checkout's
   root. The file stays beside `.claude/settings.json` in the primary working directory instead
   when the session is outside a git repository, when the repository root is the home directory, on
   Windows, or when the repository root or its `.git` or `.claude` entry is not owned by the user.
3. Placing the file at the root does not move its paths: a permission rule that starts with `/`
   and a relative sandbox path anchor at the primary working directory (§13).
4. A file an earlier release left in the starting directory (before 2.1.211) MUST still be read
   beside the root file. Where both set one key, the root's value applies; permission rules from
   both apply. The Agent SDK's `resolveSettings()` reads the file from the starting directory.
5. The global excludes file the client appends to is `core.excludesFile` when the user's global git
   configuration sets it to an absolute or `~`-prefixed path, otherwise
   `$XDG_CONFIG_HOME/git/ignore`, or `~/.config/git/ignore` when `XDG_CONFIG_HOME` is unset. A file
   the user created by hand is not added until the client first writes it.
6. While the local file is untracked its `allow` rules apply without the workspace-trust step that
   the committed file needs; once git tracks it, the trust step applies to it too (§13).
   <!-- req: settingsMerge.settings.Where Claude Code keeps the local file in a git repository -->

## 12.2 Changing settings

### 12.2.1 Editing a file

1. A settings file MUST be strict JSON: a `//` comment or a trailing comma is a syntax error and
   makes the file a Settings Error (§12.2.4). A `$schema` key naming the published settings schema
   is accepted for editors and has no effect. <!-- req: settingsMerge.settings.Edit a settings file -->
2. The `/config` menu writes most options to the user file, a few (**Show tips**) to the local
   file, and the global config options to `~/.claude.json`. `/status` lists, in its `Setting
   sources` line, each settings file the session loaded, and for managed settings in parentheses
   how they arrived; it does not say which file supplied which key.

### 12.2.2 Changing a setting for one session

A value can be set for one session without writing any file, three ways:

1. **`--settings <file-or-json>`**: JSON given inline or as a path. It is the command-line level of
   the stack (§12.3): above user, project and local settings, below managed settings. It can set any
   key the user file can set, and MUST NOT set a `Managed` or `Global config` key. A key it leaves
   out keeps its value from the files. <!-- req: settingsMerge.settings.Change a setting for one session.--settings -->
2. **A flag for that key**, such as `--model` for `model`, `--effort` for `effortLevel` and
   `modelSettings`, `--agent` for `agent`, `--teammate-mode` for `teammateMode`. A flag is not a
   level of the stack; the key's entry says that the flag wins over it. <!-- req: settingsMerge.settings.Change a setting for one session.A flag for that key -->
3. **An environment variable** paired with the key, such as `ANTHROPIC_MODEL` for `model`. Which of
   the pair applies is decided per pair, not by level (§12.3.2). <!-- req: settingsMerge.settings.Change a setting for one session.An environment variable -->

Commands run inside a session mostly save the choice: `/config` writes the settings files and
`/model` saves the user's default, except the `s` key of the `/model` picker, which switches for
the session only.

### 12.2.3 When edits take effect

1. The client MUST watch the settings files of every non-managed scope and the managed settings
   files, and apply a saved change to the running session without a restart, `permissions`,
   `hooks` and credential helpers such as `apiKeyHelper` included.
2. A file created mid-session MUST be loaded when its directory existed at session start; the
   project's `.claude/settings.json` and `.claude/settings.local.json` are loaded even when the
   `.claude/` directory itself was created in the same session.
3. For each settings-file change it detects the client runs the `ConfigChange` hook (§7). Managed
   settings that arrive through MDM or server delivery reach the session on that source's schedule
   (§12.5.1) and do not fire the hook.
4. A few keys are read only at session start, so an edit reaches the next session only: `model`
   (switch with `/model`), `effortLevel` and `modelSettings` (switch with `/effort`), and the
   managed keys §14 lists, such as `requiredMinimumVersion` (Judgment J12.7).
5. Removing `permissions.blockReadsOutsideWorkingDirectories` mid-session does not lift the block in
   the running session; it lifts only once no file sets it and the session restarts.
   <!-- req: settingsMerge.settings.When edits take effect -->

### 12.2.4 A broken settings file

What the client does with a file it cannot fully read depends on how much of it is affected:

| Case | What the client does |
| --- | --- |
| **Settings Error**: a user, project or local file is not valid JSON, or a value the schema rejects | At the start of an interactive session the client shows a dialog that offers to fix the file with Claude's help, to exit, or to continue without the broken settings (Judgment J12.5). <!-- req: settingsMerge.settings.Fix a broken settings file.Settings Error --> |
| **Settings Warning**: only individual entries fail, such as a malformed permission rule or an unknown hook event | The client skips those entries and keeps the rest of the file in effect. <!-- req: settingsMerge.settings.Fix a broken settings file.Settings Warning --> |
| **Managed settings** with an invalid entry | The client keeps enforcing the rest of the document; what it drops, and which keys fall back to a stricter value, is §14's. A managed document that is not valid JSON stops the client at startup (§14). <!-- req: settingsMerge.settings.Fix a broken settings file.Managed settings --> |
| **Configuration error**: `~/.claude.json` does not parse | A `claude -p` run exits and leaves the file unchanged. The client copies the broken file to `~/.claude/backups/.claude.json.corrupted.<timestamp>` and, in an interactive session, asks whether to exit and fix it or reset to the default configuration. A blank file with no backup to restore starts with the defaults. <!-- req: settingsMerge.settings.Fix a broken settings file.Configuration error --> |

A `-p` run shows no dialog: it skips a broken user, project or local file, or its broken values,
and continues, unless a managed document cannot be parsed. After continuing, `/status` names the
affected files and `claude doctor` gives each error.

## 12.3 Precedence

### 12.3.1 The stack

When one key is set in more than one place, the client MUST use the value from the highest level
that sets it, unless §12.4 gives the key another way to combine. Highest first:

| Level | Source | Rule |
| --- | --- | --- |
| 1 | Managed settings | Nothing in the user's files or `--settings` overrides a managed key, and a flag such as `--model` chooses only among what the organization allows. A managed `model` is a starting default, not a lock (the locks are `availableModels` and `deniedModels`). §12.5 says which managed source supplies each key. <!-- req: settingsMerge.settings.Settings precedence.Managed settings --> |
| 2 | Command line, `--settings` | For the session only; overrides project and user files key by key. <!-- req: settingsMerge.settings.Settings precedence.Command line --> |
| 3 | Project local, `.claude/settings.local.json` | The user's own settings for this project. <!-- req: settingsMerge.settings.Settings precedence.Project local settings --> |
| 4 | Shared project, `.claude/settings.json` | The team's settings, in source control. <!-- req: settingsMerge.settings.Settings precedence.Shared project settings --> |
| 5 | User, `~/.claude/settings.json` | The user's settings for every project. <!-- req: settingsMerge.settings.Settings precedence.User settings --> |
| 6 | `--add-dir` directories | Only `enabledPlugins` and `extraKnownMarketplaces` are read from an added directory's two settings files, and of `enabledPlugins` only a `true` entry counts (`plugins/loading.md`, `permissions.md`; Judgment J12.1). |
| 7 | Plugin defaults | `agent` and `subagentStatusLine` from enabled plugins (§12.6). |

1. Permission rules follow the same stack, managed highest: no other level, command-line arguments
   included, overrides a managed rule. In addition, a tool denied at any level cannot be allowed at
   another, in either direction (a user deny blocks a project allow, a project deny a user allow),
   because deny rules of every scope are evaluated before allow rules; `--allowedTools` cannot lift
   a managed deny, and `--disallowedTools` adds to what managed settings deny. §13 states how rules
   from the levels combine (`permissions.md`, "Settings precedence").
   <!-- req: settingsMerge.behavior.Settings precedence -->
2. An embedding host's parent settings belong to the managed tier; §14 says when they apply and
   which keys they carry.

### 12.3.2 Environment variables and flags

Environment variables are not a level of the stack. Where a behaviour has both a variable and a
settings key, which applies is decided per pair: `ANTHROPIC_MODEL` applies over `model` from any
file, while `ANTHROPIC_DEFAULT_MODEL` applies only when no file sets `model` (`env-vars.md`,
"Precedence"; §3.6). A flag that sets one thing for the session (`--model`, `--agent`) overrides the
key whatever file set it. An `env` object inside a settings file is an ordinary key and follows the
stack (§12.7.4).

### 12.3.3 Exceptions to managed precedence

For a few keys whose values restrict a session, the client MUST honour a restrictive value from a
scope that could not otherwise override managed settings:

| Key | Value honoured, and from where | Notes |
| --- | --- | --- |
| `disableClaudeAiConnectors` | `true` from any scope | Over a managed `false`. <!-- req: settingsMerge.settings.Exceptions to managed settings precedence.disableClaudeAiConnectors --> |
| `enableArtifact` | `false` from any scope, and `disableArtifact: true` from any scope | Over a managed `true`; nothing turns the Artifact tool back on (2.1.242 and later). <!-- req: settingsMerge.settings.Exceptions to managed settings precedence.enableArtifact --> |
| `isolatePeerMachines` | `true` from any scope | Over a managed `false`. <!-- req: settingsMerge.settings.Exceptions to managed settings precedence.isolatePeerMachines --> |
| `permissions.blockReadsOutsideWorkingDirectories`, `permissions.blockWritesOutsideWorkingDirectories` | `true` from any scope | Over a managed `false` (2.1.257 and 2.1.314 and later); §13. |
| `permissions.denyInsteadOfPrompting` | `true` from `~/.claude/settings.json` or `--settings` | Over a managed `false` (2.1.319 and later); §13. <!-- req: settingsMerge.settings.Exceptions to managed settings precedence.permissions.denyInsteadOfPrompting --> |
| `autoMode.classifyAllShell` | `true` from `~/.claude/settings.json` or `--settings` | Over a managed `false`. <!-- req: settingsMerge.settings.Exceptions to managed settings precedence.autoMode.classifyAllShell --> |
| `remoteControlAtStartup` | `false` from `.claude/settings.json` or `.claude/settings.local.json` | Over a managed `true`; a project or local `true` is ignored. <!-- req: settingsMerge.settings.Exceptions to managed settings precedence.remoteControlAtStartup --> |
| `crossSessionInbound` | A stricter value from `.claude/settings.json` or `.claude/settings.local.json`, on the ladder `accept` < `hold` < `refuse` | Over managed, `--settings` and user values; a project or local value that is not stricter is ignored (§12.7). <!-- req: settingsMerge.settings.Exceptions to managed settings precedence.crossSessionInbound --> |
| `useAutoModeDuringPlan` | `false` from any managed source, `--settings`, `~/.claude/settings.json` or `.claude/settings.local.json` | Over the winning managed source's `true`; a `false` in `.claude/settings.json` is ignored, and so is one in a file left out with `--setting-sources` (2.1.314 and later). <!-- req: settingsMerge.settings.Exceptions to managed settings precedence.useAutoModeDuringPlan --> |
| `syncClaudeAiSkills` | `false` from any managed source, `--settings`, `~/.claude/settings.json` or `.claude/settings.local.json` | Over the winning managed source's `true`; a `false` in `.claude/settings.json` is ignored. <!-- req: settingsMerge.settings.Exceptions to managed settings precedence.syncClaudeAiSkills --> |
| `syncClaudeAiPlugins` | The same as `syncClaudeAiSkills` | The same. <!-- req: settingsMerge.settings.Exceptions to managed settings precedence.syncClaudeAiPlugins --> |
| `maxEffortLevel` | A lower cap from any scope, `--settings` included | The lowest cap applies, even when the managed settings in force set a higher one (2.1.267 and later). <!-- req: settingsMerge.settings.Exceptions to managed settings precedence.maxEffortLevel --> |

A value that is not on a key's ladder is never honoured as an exception, and a project or local
value that restricts nothing (a lone `accept`, a lone `true` for `remoteControlAtStartup`) is
ignored (Judgment J12.15).

An embedding application that sets `CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST` is also an exception: its
model configuration wins over `model`, `fallbackModel`, `modelPicker` and `modelOverrides` from every
managed source and over the model-selection variables of a managed `env`; a managed
`availableModels` stays in force unless the application supplies its own list.

### 12.3.4 Why a value does not apply

These are the causes a client MUST reproduce, so that a value is ignored exactly where Claude Code
ignores it:

1. **A higher level sets it**: another file, `--settings`, or a managed source sets the key above
   the user's, or a flag or variable overrides the key on its own (§12.3.2). <!-- req: settingsMerge.settings.A value you set is ignored.A higher level sets it -->
2. **A security key keeps its strict value**: a restrictive value from any file holds (§12.3.3), so
   a project `true` for `disableClaudeAiConnectors` stays on. <!-- req: settingsMerge.settings.A value you set is ignored.A security key keeps its strict value -->
3. **The file cannot set that value**: `permissions.defaultMode` values `auto` and
   `bypassPermissions` do not take effect from project or local settings (before 2.1.257
   `bypassPermissions` did); the telemetry export variables of an `env` block do not take effect
   from project or local settings apart from a few off values (§12.7.4). <!-- req: settingsMerge.settings.A value you set is ignored.The file can't set that value -->
4. **The file is broken**: the file or the entry is skipped (§12.2.4). <!-- req: settingsMerge.settings.A value you set is ignored.The file is broken -->
5. **A committed key does not reach teammates** when the key's scope excludes a repository file
   (`User, local, or managed`, `User or managed`, `User`, `Managed` or `Global config` in the
   settings index; a few of them can still be switched off from the repository, as their entry
   says), or when the key waits for workspace trust: `permissions.allow`,
   `permissions.additionalDirectories`, `extraKnownMarketplaces` and most `env` values apply only
   after each user trusts the folder, while `deny` and `ask` rules apply at once (§13). Until then
   a user gets no plugin from a marketplace the file declares. <!-- req: settingsMerge.settings.A committed key doesn't reach teammates -->
6. **A managed change has not reached the session**: managed sources arrive on their delivery
   schedule (§12.5.1), so the first remedy is a restart; if `/status` then names another source
   than the one the administrator changed, a higher-ranked source applies (§12.5.2). <!-- req: settingsMerge.settings.A managed change hasn't reached you -->
7. **Permission rules combine differently**: a standing approval saves an `allow` rule to the local
   file, and that rule does not outrank an `ask` rule of a project or managed file; managed `allow`
   rules apply beside the user's unless `allowManagedPermissionRulesOnly` is set. In the CLI a
   standing approval is written only to the local file (§13). <!-- req: settingsMerge.settings.Permission rules combine differently than you expected -->

## 12.4 How values combine

The stack decides which file wins; the kind of the value decides whether the files combine.

1. **A single value** (a string, number or Boolean, or an object the key's entry treats as one
   value, such as `statusLine`, `subagentStatusLine` or a `fallbackModel` chain) comes whole from the
   highest level that sets it.
2. **A list** (such as `permissions.allow`, `allowedHttpHookUrls`, `httpHookAllowedEnvVars`,
   `sandbox.network.allowedDomains`) MUST combine across files: each file adds its entries and none
   removes another file's. Repeated entries appear once (Judgment J12.2). <!-- req: settingsMerge.settings.Lists merge instead of overriding -->
3. **A map keyed by name** combines per name: for each name, the entry of the highest level that
   names it applies whole, and a level that does not name it leaves the lower value in effect. This
   holds for `enabledPlugins` (`plugins/loading.md`, "Find where a plugin is enabled"),
   `extraKnownMarketplaces` (§12.7.2), and, by Judgment J12.3, `pluginConfigs` and
   `skillOverrides`.
4. **A nested block** with no rule of its own (`env`, `sandbox`, `worktree`, `attribution`) merges
   key by key, each inner key following these same rules (Judgment J12.3).
5. **`hooks`** merge across files rather than replacing each other: every file's matcher groups
   run, and a managed hook cannot be removed by another file (§7).
6. Four model keys follow their own rules:
   - `fallbackModel` is an ordered chain: the whole value of the highest file that defines it.
   - `modelPicker` (2.1.242 and later) never merges rows from two sources: the whole value of the
     highest of managed settings, `--settings` and user settings; it is ignored in project and
     local settings.
   - `availableModels`: when the managed settings in force define it, that list applies as-is and
     entries added in user, project or local settings are ignored, unless an embedding application
     supplies its own list (§12.3.3). Across managed sources it never merges (§12.5). Across the
     other scopes the lists merge as usual.
   - `modelSettings` resolves one model at a time together with `effortLevel`; its entry says which
     file's value applies to a model.

```json
// ~/.claude/settings.json
{ "enabledPlugins": { "fmt@team": true, "lint@team": true }, "permissions": { "allow": ["Bash(npm test)"] } }
// .claude/settings.json
{ "enabledPlugins": { "lint@team": false }, "permissions": { "allow": ["Bash(npm run lint)"] } }
// In effect: fmt@team on (only the user names it), lint@team off (project is higher),
// permissions.allow: ["Bash(npm run lint)", "Bash(npm test)"]
```

## 12.5 The managed tier

An organization can deliver managed settings by more than one mechanism. Every mechanism carries the
same keys as a `settings.json` file; this section states which sources a client reads and how it
composes them into the one managed level of §12.3. The policy each key enforces is §14's.

### 12.5.1 Sources

| Source | Where | Read |
| --- | --- | --- |
| Remote | Server-managed settings from the claude.ai admin console or a Claude apps gateway | At startup and polled hourly; a change that needs approval (a hook, an `env` variable) waits for the user to accept it. Fetched only when the session authenticates to Anthropic's API directly with an eligible credential, signs in to a gateway with `/login`, or runs in the desktop app's Code tab behind a gateway that serves it settings; with another provider, or an `ANTHROPIC_BASE_URL` elsewhere, the client starts at the next source. |
| MDM / OS policy | The macOS `com.anthropic.claudecode` managed preferences domain; the Windows `HKLM\SOFTWARE\Policies\ClaudeCode` value `Settings` (`REG_SZ` or `REG_EXPAND_SZ` JSON) | At startup and every 30 minutes. |
| Files | `managed-settings.json` and `managed-settings.d/*.json` in `/Library/Application Support/ClaudeCode/` (macOS), `/etc/claude-code/` (Linux and WSL) or `C:\Program Files\ClaudeCode\` (Windows; never `C:\ProgramData\ClaudeCode\`) | At startup and on every change. A symbolic link is followed even outside the directory, with a warning in `/status` and `claude doctor`. |
| HKCU | `HKCU\SOFTWARE\Policies\ClaudeCode` value `Settings`, on Windows, and on WSL when the HKLM value or the Windows managed settings file turns on `wslInheritsWindowsSettings` and the HKCU value sets it too | As MDM; user-writable, so it is not an admin source (§12.5.2). |

### 12.5.2 Split file-based policy

1. The file source is `managed-settings.json` merged first, then every `*.json` file of
   `managed-settings.d/` in alphabetical order of file name (Judgment J12.8). Hidden files and files
   that do not end in `.json` MUST be ignored.
2. When two files set one key, the later file combines with the earlier by these rules: <!-- req: settingsMerge.managed.Split a file-based policy across teams -->
   - **Single values** (`"model": "opus"`, `"cleanupPeriodDays": 7`): the later value replaces the earlier. <!-- req: settingsMerge.managed.Split a file-based policy across teams.Single values -->
   - **Lists** (`permissions.deny`, `sandbox.network.allowedDomains`): the two lists combine with duplicates removed, each entry at its first occurrence in file order (Judgment J14.1). <!-- req: settingsMerge.managed.Split a file-based policy across teams.Lists -->
   - **Nested blocks** (`env`, `sandbox`): merge key by key, each inner key by these same rules. <!-- req: settingsMerge.managed.Split a file-based policy across teams.Nested blocks -->
   - **`fallbackModel`**: the later chain replaces the earlier whole. <!-- req: settingsMerge.managed.Split a file-based policy across teams.fallbackModel -->
   - **`extraKnownMarketplaces`** and **`managedMcpServers`**: a later entry with the same name replaces the earlier whole; **`modelPicker`**: the later lineup replaces the earlier whole.

### 12.5.3 Choosing among sources

1. **Terms.** A *policy key* is any key other than the two control keys `wslInheritsWindowsSettings`
   and `managedSourcesBehavior`; a document that holds only control keys does not count, and the
   client moves to the next source. An *admin source* is one of remote, MDM and files; HKCU is not. <!-- req: settingsMerge.managed.How Claude Code combines managed sources.Policy key | settingsMerge.managed.How Claude Code combines managed sources.Admin source -->
2. **Rank**, highest first: remote, MDM or OS policy, the files (the drop-ins and
   `managed-settings.json` as one source), HKCU. HKCU is read only when no admin document is present
   above it and no parent settings supply a restrictive key. <!-- req: settingsMerge.managed.How Claude Code combines managed sources -->
3. **Present.** An admin document is present when it sets any policy key to a value other than
   `null`, even an unreadable value, or when it is an HKLM value, a managed settings file or a
   `managed-settings.d` directory that exists but cannot be read. The client MUST NOT apply HKCU
   beneath a present admin document. On WSL `/etc/claude-code` is user-writable too, and
   `wslInheritsWindowsSettings` decides when the Windows documents stand above it (§14). <!-- req: settingsMerge.managed.When an admin document counts as present -->
4. **`managedSourcesBehavior`** decides what happens to the other sources:
   - **`"first-wins"`, the default**: the client uses the highest-ranked source that delivers at
     least one policy key and ignores the rest, without merging and without a warning, apart from
     the keys of item 5. `/status` names the source used and those skipped. <!-- req: settingsMerge.managed.How Claude Code combines managed sources."first-wins", the default -->
   - **`"merge"`** (2.1.242 and later): every admin source that delivers a policy key applies,
     combined by kind of key (§12.5.4). <!-- req: settingsMerge.managed.How Claude Code combines managed sources."merge" -->
5. **Keys read from every admin source.** Under `"first-wins"` a key is read only from the selected
   source, even when that source leaves it unset; these keys are read from every admin source
   instead, HKCU left out (HKCU applies like a selected source when it is the only one and no host
   supplies parent settings): <!-- req: settingsMerge.managed.Keys read from every admin source -->
   - `sandbox.network.allowManagedDomainsOnly` and `sandbox.filesystem.allowManagedReadPathsOnly`: a
     `true` in any admin source turns the lock on, and while it is on the allowlist it locks
     (`sandbox.network.allowedDomains` with `WebFetch(domain:…)` allow rules, or
     `sandbox.filesystem.allowRead`) is the union across admin sources. Without the lock the
     allowlist is an ordinary key. <!-- req: settingsMerge.managed.Keys read from every admin source.sandbox.network.allowManagedDomainsOnly -->
   - `allowAllClaudeAiMcps`. <!-- req: settingsMerge.managed.Keys read from every admin source.allowAllClaudeAiMcps -->
   - `allowManagedMcpServersOnly`: a `true` in any admin source locks the MCP allowlist, and the
     list then comes whole from the highest-ranked admin source that sets one, a server-managed list
     replacing a lower one; with no list anywhere every server the denylist passes loads, unless
     parent settings supply one. Without the lock `allowedMcpServers` is read from the source
     applied (2.1.273 and later; §8.11). <!-- req: settingsMerge.managed.Keys read from every admin source.allowManagedMcpServersOnly -->
   - `deniedMcpServers` and `disableClaudeAiConnectors`: an entry or a `true` in any admin source
     applies (2.1.273 and later). <!-- req: settingsMerge.managed.Keys read from every admin source.deniedMcpServers -->
   - `sandbox.bwrapPath`, `sandbox.socatPath`, `sandbox.ripgrep`, `sandbox.filesystem.disabled` and
     `sandbox.network.strictAllowlist`. <!-- req: settingsMerge.managed.Keys read from every admin source.sandbox.filesystem.disabled -->
   - `useAutoModeDuringPlan`, `syncClaudeAiSkills`, `syncClaudeAiPlugins`: a `false` in any admin
     source turns the behaviour off, and so does a `false` in user or local settings (§12.3.3).
   - `enableArtifact`: a `false` in any admin source, or in user, project or local settings, turns
     the Artifact tool off for good.
   - `maxEffortLevel`: the lowest cap in any admin source, or a lower one of the user's own.
   - A commit-trailer opt-out in `attribution` (or `includeCoAuthoredBy`), from any tier;
     `forceRemoteSettingsRefresh`.
   - `env`, per variable: each variable comes from the highest-ranked admin source that defines it,
     lower sources filling in the rest (2.1.223 and later; before, the selected source's whole
     block). A few variables have their own rule (`server-managed-settings.md`, "Per-key exceptions
     across managed sources"). <!-- req: settingsMerge.managed.Keys read from every admin source.env -->
   - `allowedProviders` combines as its own entry says (2.1.285 and later).

   When an admin source sets `allowManagedMcpServersOnly` or `allowedMcpServers` and that value is
   not the one in force, `/status` and `claude doctor` name the source and key.
6. **Login keys.** On a machine with an MDM policy or a managed settings file, the login keys come
   from that policy or file, even for a key remote settings also set. With both, the MDM policy
   wins: when it sets any policy key, login keys in the file are ignored, under `"merge"` too. The
   login keys are `forceLoginOrgUUID` and `forceLoginMethod` set to `"claudeai"` or `"console"` (when
   the policy or file omits one, the remote value applies), and the gateway login keys
   (`forceLoginGatewayUrl`, `gatewayInternalNetworks`, `forceLoginMethod: "gateway"`), for which a
   remote value is never used. <!-- req: settingsMerge.managed.Which managed source supplies login keys -->

### 12.5.4 Composing every source

1. `managedSourcesBehavior: "merge"` MUST be read only from the highest-ranked source that carries
   either that key or a policy key, so a lower source cannot opt itself into merging with a source
   above it. HKCU never merges with another source. Under `"merge"` a lower source's list entries,
   `permissions.allow` rules and hooks included, join the policy.
2. Under `"merge"` each kind of key combines so:

   | Kind | How | Examples |
   | --- | --- | --- |
   | Lists | The entries of every source combine. | `permissions.allow`, `hooks`, `sandbox.network.allowedDomains`, `deniedMcpServers`, `deniedModels` <!-- req: settingsMerge.managed.Compose every managed source.Lists --> |
   | Locks | The strictest value any source sets applies; a looser value applies only from the highest-ranked source (Judgment J12.9). | `allowManagedHooksOnly`, `permissions.disableBypassPermissionsMode`, `crossSessionInbound`, `availableModelsMatch` <!-- req: settingsMerge.managed.Compose every managed source.Locks --> |
   | Restriction allowlists | The list whole from the highest-ranked source that sets it; lower sources add nothing. | `availableModels`, `allowedMcpServers`, `strictKnownMarketplaces`, `allowedChannelPlugins`, the `fallbackModel` chain <!-- req: settingsMerge.managed.Compose every managed source.Restriction allowlists --> |
   | Values taken whole | The value whole from the highest-ranked source that sets it, no entries or fields from lower sources. | `sandbox.credentials.awsPairs`, `sandbox.ripgrep` <!-- req: settingsMerge.managed.Compose every managed source.Values taken whole --> |
   | Provided MCP servers | Server names from every source combine; for one name the higher-ranked source's whole entry applies. | `managedMcpServers` <!-- req: settingsMerge.managed.Compose every managed source.Provided MCP servers --> |
   | Highest-ranked source only | The key is ignored in every lower source, even when the highest leaves it unset. | `modelPicker`, `permissions.defaultMode`, credential helpers such as `apiKeyHelper` |
   | `env` | Per variable, under either behaviour (§12.5.3). | <!-- req: settingsMerge.managed.Compose every managed source.env --> |
   | Login keys | Under either behaviour, from the higher-ranked of the MDM policy and the file that carries a policy key, ahead of remote (§12.5.3). | `forceLoginOrgUUID`, `forceLoginMethod`, the gateway login keys <!-- req: settingsMerge.managed.Compose every managed source.Login keys --> |
   | Every other key | The value of the highest-ranked source that sets it. | `model`, `cleanupPeriodDays` <!-- req: settingsMerge.managed.Compose every managed source.Every other key --> |

3. A `policyHelper` whose output carries a `managedSettings` object makes that object the only
   managed settings of the session, for the keys of §12.5.3 item 5 too, apart from
   `forceRemoteSettingsRefresh`; and parent settings from an embedding host add to the policy as §14
   states.

## 12.6 Plugin default settings

A plugin MAY ship default settings that apply while it is enabled, in a `settings.json` at the
plugin root (§1.4) or as the `settings` object of its manifest (§2.4).

1. Only `agent` and `subagentStatusLine` take effect. Every other key MUST be dropped at load and
   MUST NOT reach any settings layer: a plugin cannot set permissions, hooks, `env` or any policy
   through its defaults. A value of the wrong type for one of the two keys (`agent` not a string,
   `subagentStatusLine` not an object with `type: "command"` and a `command` string) is dropped as
   well. A dropped key or value, and a `settings.json` that does not parse, is at most a load
   warning: it never fails the plugin, whose other components load, and a validator reports none
   of them (Judgment J12.10).
2. **File over manifest.** When both exist and `settings.json` sets at least one supported key, the
   client MUST apply `settings.json` and ignore the manifest's `settings` entirely; the two are never
   combined key by key. A `settings.json` that sets no supported key (none, or only dropped keys, or
   one that is not a readable JSON object) does not count, and the manifest's `settings` applies
   (Judgment J12.10). <!-- req: settings.components.Default settings.File over manifest -->
3. **User settings over plugin defaults.** Plugin defaults are the lowest settings layer (§12.3.1):
   a value of the same key at any settings level, the user's own `agent` in
   `~/.claude/settings.json` for one, replaces the plugin's, and `--agent` replaces both (§5). <!-- req: settings.components.Default settings.User settings over plugin defaults -->
4. **Two plugins set the same key.** The value of the plugin loaded last applies, in the client's
   plugin load order (§16; Judgment J12.12), and the client logs under `claude --debug` a line
   containing `overrides setting` (Judgment J12.11). The two keys resolve independently: one plugin
   can supply `agent` and another `subagentStatusLine`. <!-- req: settings.components.Default settings.Two plugins set the same key -->
5. A default `agent` names one of the plugin's own agents and runs the main thread as it, with that
   agent's system prompt and model (§5). A default `subagentStatusLine` runs as §12.6.1 says,
   under the gates of §12.7.3. A plugin's value MUST NOT run under `allowManagedHooksOnly`, even
   when managed `enabledPlugins` force-enables the plugin, unlike that plugin's hooks; nor, being no
   managed value, while the other gates narrow the key to managed settings (Judgment J12.13).
   <!-- docs: statusline.md | Subagent status lines -->
6. The defaults stop applying when the plugin is disabled or uninstalled.
7. A plugin's `agent` default is a supported key of the target release. A validator for that release
   MUST NOT warn that it is deprecated, in `settings.json` or in the manifest's `settings` (Judgment
   J12.14).

```json
// my-plugin/settings.json: applies; the manifest's "settings" is ignored
{ "agent": "security-reviewer", "model": "opus" }
// "model" is dropped. With "agent": "code-reviewer" in ~/.claude/settings.json, the user's wins.
```

### 12.6.1 The subagent status line

`subagentStatusLine`, from a plugin's defaults or any settings file, replaces the body of the rows
of the subagent task display below the prompt (by default `name · description · token count`).
<!-- docs: settings-reference.md | subagentStatusLine -->

1. **When it runs.** The client runs `command` through a shell, as it runs a `statusLine` command
   (Git Bash on Windows when installed, otherwise PowerShell; wrapped by `CLAUDE_CODE_SHELL_PREFIX`,
   §8.2.1), once per refresh tick of the display, with every visible subagent row in one input.
2. **Input.** One JSON object on stdin: the common input fields hooks receive (§7.5.2), `columns`
   (the usable row width), and `tasks`, one entry per visible row. A field marked optional is
   omitted when it has no value: <!-- docs: statusline.md | Task fields -->

   | Field | Type | Value |
   | --- | --- | --- |
   | `id` | string | The task's identifier, echoed back in the output. |
   | `name` | string, optional | The name the subagent is addressed by, when it has one. |
   | `type` | string | The kind of task: `local_agent`. |
   | `agentType` | string | The subagent type, the value hooks receive as `agent_type` (§7), such as `Explore` or a plugin agent's scoped name (2.1.293 and later). |
   | `status` | string | Such as `running`, `completed`, `failed` or `killed`. |
   | `description` | string | The task's short description, such as the one Claude gave when it spawned it. |
   | `label` | string | A short progress summary when the client has one, otherwise `description`. |
   | `startTime` | number | Start time, milliseconds since the Unix epoch. |
   | `model` | string, optional | The resolved model ID; omitted until resolved. |
   | `effort` | string or number, optional | The effort set in the agent's frontmatter or on the invocation: `low`, `medium`, `high`, `xhigh`, `max` or a token budget; the configured value, not necessarily the applied one. |
   | `contextWindowSize` | number, optional | The context window of `model` in tokens, computed as the status line's `context_window.context_window_size`; omitted when `model` is. |
   | `tokenCount` | number | The running token count, the figure the default row shows. |
   | `tokenSamples` | number[] | Up to the last 16 `tokenCount` readings, one per tick, oldest first, ending with the current one. |
   | `cwd` | string | The subagent's own working directory, such as an isolated worktree, otherwise the session's. |

3. **Output.** One JSON line on stdout per row the command overrides, `{"id": "<task id>",
   "content": "<row body>"}`. `content` is rendered as is, ANSI colours and OSC 8 hyperlinks
   included; an empty `content` hides the row; a row whose `id` no line names keeps the default
   rendering. A line that is not such an object, or names an unknown `id`, is ignored; a command
   that exits non-zero, or is still running when the next tick starts it again (it is cancelled),
   leaves every row at its default (Judgment J12.16).
4. **Gates.** The trust, `disableAllHooks` and `allowManagedHooksOnly` gates of `statusLine` apply
   (§12.7.3); a plugin's value never runs under `allowManagedHooksOnly` (§12.6 item 5).

```json
{ "subagentStatusLine": { "type": "command",
  "command": "jq -c '.tasks[] | {id, content: \"\\(.name): \\(.tokenCount) tokens\"}'" } }
```

## 12.7 Settings keys a plugin meets

Each key's **scope** is the set of files it is read from: *Any file* is user, project, local and
managed settings and `--settings`; *Managed* is managed settings only; *User or managed* excludes
project, local and `--settings` unless the row says otherwise. A key read from a file its scope
excludes MUST be ignored. **Combines** is §12.4's rule. Unless the row says otherwise a key is
unset by default and a client MUST accept exactly the type given.

### 12.7.1 Index

| Key | Type | Scope | Combines | Effect |
| --- | --- | --- | --- | --- |
| `agent` | string, a built-in or custom agent name | Any file; plugin default (§12.6) | single | Runs the main thread as that agent; also the default agent of sessions dispatched from `claude agents`. `--agent` wins for a session (§5). <!-- req: settings.key.agent --> |
| `allowedChannelPlugins` | array of `{ "marketplace", "plugin" }`, or `"plugin@marketplace"` strings (2.1.267 and later; earlier releases reject the whole value) | Managed | restriction allowlist | Replaces the default Anthropic allowlist of channel plugins; `[]` blocks every channel plugin. Takes effect once channels pass the `channelsEnabled` gate (§9.3, §14). <!-- req: settings.key.allowedChannelPlugins --> |
| `allowedHttpHookUrls` | array of URL patterns, `*` a wildcard | Any file | list | When defined, an HTTP hook runs only if its URL matches a pattern; others are blocked without running, and `[]` blocks every HTTP hook. Host matching ignores case and a trailing dot. Applies to hooks of every source, managed included. A list with entries in the Agent SDK's `managedSettings` is ignored (§7, §14). <!-- req: settings.key.allowedHttpHookUrls --> |
| `allowManagedHooksOnly` | Boolean | Managed | lock | `true` runs only managed, SDK and force-enabled plugins' hooks (§12.7.3). <!-- req: settings.key.allowManagedHooksOnly --> |
| `appendPlugins` | array of `plugin@marketplace` | Managed; user only on a machine with no managed settings and no `managed-mcp.json`, in a session whose credential is not a Team or Enterprise `/login`; never project, local or `--settings` | single | Mods of these plugins run after every mod the user installs, in list order; an id in both `prependPlugins` and `appendPlugins` is prepended; in managed settings an id whose plugin does not count as the organization's is skipped (§10). <!-- req: settings.key.appendPlugins --> |
| `blockedMarketplaces` | array of marketplace source objects (`strictKnownMarketplaces` forms; `"owner/*"` for `github`, 2.1.223 and later; `{ "source": "skills-dir" }`) | Managed | list | Blocks matching sources at marketplace add and at plugin install, update, refresh and auto-update, before any download; `skills-dir` stops `@skills-dir` plugins (§14, §15). <!-- req: settings.key.blockedMarketplaces --> |
| `channelsEnabled` | Boolean | Managed | single | `true` allows channels for the organization; `false` is unset. Unset, channels are blocked on Team and Enterprise plans and on Console accounts with managed settings, allowed otherwise (§9.3). <!-- req: settings.key.channelsEnabled --> |
| `crossSessionInbound` | `"accept"`, `"hold"` or `"refuse"` | Any file; project and local only when stricter | exception (§12.3.3) | What the session does with messages from the user's other sessions. Managed, then `--settings`, then user: the first value found applies; a project or local `hold` or `refuse` applies when stricter, or when none of those sets one. An unrecognized value in a user, project, local or `--settings` file holds messages even over an `accept` (a `refuse` elsewhere still applies); in managed settings it reads as `refuse`. Unset, the client decides per message (2.1.224 and later). <!-- req: settings.key.crossSessionInbound --> |
| `disableAgentView` | Boolean | Any file | single | `true` turns off `claude agents`, `--bg`, `/background` and the on-demand supervisor. `CLAUDE_CODE_DISABLE_AGENT_VIEW` also turns it off, and neither can turn it back on against the other. <!-- req: settings.key.disableAgentView --> |
| `disableAllHooks` | Boolean | Any file; only managed settings disable managed hooks | single | Turns off hooks, the custom status lines and the custom file suggestion; reach by file in §12.7.3. While hooks are off `/goal` cannot run and `/hooks` shows a notice (§7, §10). <!-- req: settings.key.disableAllHooks --> |
| `disableBundledSkills` | Boolean | Any file | single | `true` removes the bundled skills and workflows; built-in commands such as `/init` stay typable but hidden from the model. Plugin, `.claude/skills/` and `.claude/commands/` skills are unaffected. `CLAUDE_CODE_DISABLE_BUNDLED_SKILLS=1` also turns them off, irreversibly for the session (§4). <!-- req: settings.key.disableBundledSkills --> |
| `disableCommandPluginSources` | Boolean | Managed | lock | `true`: the client never runs a marketplace's `command` source, installs or updates no command-sourced plugin and stops loading those installed. `false` allows them explicitly. Unset, it follows `allowManagedHooksOnly`. Whenever command sources are blocked, marketplace `headersHelper` commands are blocked too, except for a marketplace managed settings declare (2.1.229 and 2.1.238 and later; §15, §16). <!-- req: settings.key.disableCommandPluginSources --> |
| `disableSkillShellExecution` | Boolean | Any file; a managed `true` cannot be overridden | single | `true` replaces each inline shell command of a user, project, plugin or added-directory skill or command with `[shell command execution disabled by policy]`; bundled and managed skills are unaffected (§4). <!-- req: settings.key.disableSkillShellExecution --> |
| `disableWorkflows` | Boolean, default `false` | Any file | single | `true` turns off dynamic workflows and the bundled workflow commands; `false` is unset. `CLAUDE_CODE_DISABLE_WORKFLOWS` also turns them off, and neither undoes the other (§11). <!-- req: settings.key.disableWorkflows --> |
| `enabledPlugins` | object, `plugin@marketplace` to Boolean | Any file; `--add-dir` (`true` only) | per name | Whether each plugin is on (§12.7.2). <!-- req: settings.key.enabledPlugins --> |
| `enableWorkflows` | Boolean | Any file | single | The user's own on or off for dynamic workflows; unset, on except on the Pro plan. Cannot turn workflows on while any source, `disableWorkflows` or the environment variable included, turns them off (§11). <!-- req: settings.key.enableWorkflows --> |
| `env` | object, variable name to string | Any file | block, per variable | Variables for the session and its subprocesses (§12.7.4, §3.6). <!-- req: settings.key.env --> |
| `extraKnownMarketplaces` | object, marketplace name to `{ "source", "autoUpdate"? }`; alias `additionalMarketplaces` | Any file; project and local only after trust; `--add-dir` | per name | Registers each marketplace the client does not know (§12.7.2, §15). <!-- req: settings.key.extraKnownMarketplaces --> |
| `hooks` | object, hook event to an array of `{ "matcher", "hooks" }` groups whose handlers have `type` `command`, `prompt`, `agent`, `http` or `mcp_tool` | Any file | hooks (§12.4) | Handlers run at lifecycle events (§7). <!-- req: settings.key.hooks --> |
| `httpHookAllowedEnvVars` | array of variable names | Any file | list | An outer limit on every HTTP hook's own `allowedEnvVars`: a hook may interpolate a variable only when both name it. Unset, each hook's own list applies. Applies to every source; a list with entries in the SDK's `managedSettings` is ignored (§7). <!-- req: settings.key.httpHookAllowedEnvVars --> |
| `isolatePeerMachines` | Boolean | Any file | `true` from any scope | `true` asks the user's approval before `SendMessage` reaches a session on another machine, even in `bypassPermissions` mode (2.1.224 and later). A repository file can turn it on, not off. <!-- req: settings.key.isolatePeerMachines --> |
| `outputStyle` | string, a built-in or custom style name | Any file | single | The active output style, from the next message after a change (§6.1). <!-- req: settings.key.outputStyle --> |
| `pluginConfigs` | object, plugin id to `{ "options", "mcpServers"? }`; `options` maps an option to a string, number, Boolean or array of strings, `mcpServers` holds per-server values in the same shape | User or managed; project and local entries ignored | per name | The non-sensitive `userConfig` answers, written by the client (§3.4). Built-in plugins use the `@builtin` suffix; an entry under the pre-2.1.285 id of a renamed built-in plugin is still read. A repository cannot supply them because they are substituted into hook, MCP and LSP configuration. <!-- req: settings.key.pluginConfigs --> |
| `pluginSuggestionMarketplaces` | array of marketplace names | Managed | single | Marketplaces whose plugins' `relevance` declarations may appear as install suggestions (spinner tips, top of `/plugin` Discover). A name counts only when that marketplace is registered and its registered source is declared in the same managed settings, as its `extraKnownMarketplaces` entry or a `strictKnownMarketplaces` entry; the official marketplace needs only its name (§15). <!-- req: settings.key.pluginSuggestionMarketplaces --> |
| `pluginTrustMessage` | string | Managed | single | The organization's text added to the plugin trust warning shown before an install (§16). <!-- req: settings.key.pluginTrustMessage --> |
| `prependPlugins` | array of `plugin@marketplace` | As `appendPlugins` | single | Mods of these plugins run before every mod the user installs, in list order; managed settings that set it name `sec-default@builtin` to keep the built-in guard (§10). <!-- req: settings.key.prependPlugins --> |
| `processWrapper` | string, an argv prefix | User or managed | single | On macOS and Linux, a launcher placed in front of the background processes the client starts, with the client's command line appended; ignored on Windows. `CLAUDE_CODE_PROCESS_WRAPPER` wins for a session (2.1.210 and later). <!-- req: settings.key.processWrapper --> |
| `skillOverrides` | object, skill name to `"on"`, `"name-only"`, `"user-invocable-only"` or `"off"` | Any file; `/skills` writes the local file | per name | Visibility of a skill to the model and to `/` autocomplete; does not apply to plugin skills (§4). <!-- req: settings.key.skillOverrides --> |
| `statusLine` | `{ "type": "command", "command", "padding"?, "refreshInterval"? (seconds, minimum 1), "hideVimModeIndicator"? }` | Any file | single | A command that renders the status line; gated as §12.7.3 says. <!-- req: settings.key.statusLine --> |
| `strictKnownMarketplaces` | array of marketplace source objects; alias `allowedMarketplaces` | Managed | restriction allowlist | The marketplaces users may add and install from, checked before any network or file operation; `[]` blocks every source, the official one included; any list stops `@skills-dir` plugins unless it holds `{ "source": "skills-dir" }`. It registers nothing (§14, §15). <!-- req: settings.key.strictKnownMarketplaces --> |
| `strictPluginOnlyCustomization` | `true`, or an array of `"skills"`, `"agents"`, `"hooks"`, `"mcp"`; unknown names ignored | Managed | single | Locks the named surfaces so their customization comes only from plugins or managed settings; any lock also stops skills-directory plugins (§14). <!-- req: settings.key.strictPluginOnlyCustomization --> |
| `strictPluginOnlyCustomization` `"skills"` | — | Managed | — | Stops user and project skills and commands, those of `--add-dir` directories and claude.ai-synced skills; bundled, managed and plugin skills load. <!-- req: settings.key.strictPluginOnlyCustomization.skills --> |
| `strictPluginOnlyCustomization` `"agents"` | — | Managed | — | Stops agents of `~/.claude/agents/`, `.claude/agents/` and `--add-dir` directories; built-in, managed and plugin agents load. <!-- req: settings.key.strictPluginOnlyCustomization.agents --> |
| `strictPluginOnlyCustomization` `"hooks"` | — | Managed | — | Stops hooks of user, project and local settings and the frontmatter hooks of the skills, commands and agents a `skills` or `agents` lock would block; such a user or project skill also loses its `allowed-tools` pre-approval unless it runs with `context: fork`. Managed and plugin hooks run. <!-- req: settings.key.strictPluginOnlyCustomization.hooks --> |
| `strictPluginOnlyCustomization` `"mcp"` | — | Managed | — | Stops servers of `~/.claude.json` and `.mcp.json`; `managed-mcp.json`, `managedMcpServers` and plugin servers load (§8.11). <!-- req: settings.key.strictPluginOnlyCustomization.mcp --> |
| `subagentStatusLine` | `{ "type": "command", "command" }` | Any file; plugin default (§12.6) | single | A command that rewrites the rows of the subagent task display: it gets the visible rows on stdin as one JSON object with a `tasks` array and writes `{"id", "content"}` lines; unwritten rows keep the default (§12.6.1). Gated as §12.7.3 says; under `allowManagedHooksOnly` or `disableAllHooks` outside managed settings only the managed value runs. <!-- docs: settings-reference.md | Settings index — subagentStatusLine --> |
| `syncClaudeAiPlugins` | Boolean; only `false` has an effect | User, local, managed and `--settings` | `false` wins (§12.3.3) | `false` stops downloading the account's plugins into `~/.claude/plugins/synced/` and stops loading `<name>@synced`; in user or managed settings it also moves them to `~/.claude/plugins/.trash/`. One synced plugin is turned off with `"<name>@synced": false` in `enabledPlugins` (2.1.273 and later; §16). <!-- req: settings.key.syncClaudeAiPlugins --> |
| `syncClaudeAiSkills` | Boolean; only `false` has an effect | User, local, managed and `--settings` | `false` wins (§12.3.3) | The same for skills, in `~/.claude/skills/synced/` and `~/.claude/skills/.trash/` (§4). <!-- req: settings.key.syncClaudeAiSkills --> |
| `teammateMode` | `"in-process"` (default), `"auto"`, `"tmux"` or `"iterm2"` | Any file; a value left in `~/.claude.json` is still read | single | Where agent-team teammates are shown. `--teammate-mode` wins for a session. <!-- req: settings.key.teammateMode --> |
| `theme` | `"auto"`, `"dark"` (default), `"light"`, `"dark-daltonized"`, `"light-daltonized"`, `"dark-ansi"`, `"light-ansi"`, `"custom:<slug>"` or `"custom:<plugin-name>:<slug>"` | Any file; a `~/.claude.json` value applies when no file sets it | single | The interface theme, a plugin's theme by its `custom:<plugin-name>:<slug>` value (§6.2). <!-- req: settings.key.theme --> |
| `workflowKeywordTriggerEnabled` | Boolean, default `true` | Any file | single | `false` lets a prompt contain `ultracode` without triggering a workflow (§11). <!-- req: settings.key.workflowKeywordTriggerEnabled --> |
| `workflowSizeGuideline` | `"unrestricted"`, `"small"`, `"medium"` or `"large"`; default `"medium"`, `"small"` on Pro (2.1.271 and later) | Any file | single | Advice to Claude on agent count (fewer than 5, 10, 50); over the `/config` choice kept in `~/.claude.json` (§11). <!-- req: settings.key.workflowSizeGuideline --> |
| `worktree` | object with `baseRef`, `symlinkDirectories`, `sparsePaths`, `bgIsolation`, `location` | Any file | block | How git worktrees are created for `--worktree`, `EnterWorktree`, isolated subagents and background sessions (§5). <!-- req: settings.key.worktree --> |
| `worktree.baseRef` | `"fresh"` (default) or `"head"` | Any file | single | `fresh` branches from `origin/<default-branch>`, `head` from the local `HEAD`, a linked worktree's own `HEAD` inside one. <!-- req: settings.key.worktree.baseRef --> |
| `worktree.symlinkDirectories` | array of repository-relative directories | Any file | list | Symlinked from the main checkout into each new worktree. <!-- req: settings.key.worktree.symlinkDirectories --> |
| `worktree.sparsePaths` | array of repository-relative directories | Any file | list | Only these directories and root-level files are checked out, by sparse-checkout; git then enables `extensions.worktreeConfig` in the shared `.git/config`. <!-- req: settings.key.worktree.sparsePaths --> |
| `worktree.bgIsolation` | `"worktree"` (default) or `"none"` | Any file | single | `worktree` blocks `Edit` and `Write` in the main checkout for a background session until it calls `EnterWorktree`; `none` edits in place. A session moved to the background edits in place regardless; outside git a failing `WorktreeCreate` hook releases the block. <!-- req: settings.key.worktree.bgIsolation --> |
| `worktree.location` | an absolute or `~/` path | User, on the remote machine | single | Where desktop SSH sessions create worktrees; read by the desktop app only. <!-- req: settings.key.worktree.location --> |

### 12.7.2 Plugins and marketplaces

1. **`enabledPlugins`.** For each plugin id the entry of the highest source that names the id
   decides (§12.4): local over project over user, `--settings` above them, managed above all, an
   `--add-dir` directory below all and only by `true`. A plugin no source names follows its
   `defaultEnabled` (§2.4). A managed `true` force-enables the plugin and no other source turns it
   off; a managed `false` blocks its installation at every scope and hides it from the marketplace.
   So a user's `false` does not disable a plugin the project enables; a local `false` does. A
   project file that enables a plugin from an external source does not install it for others: the
   client reports it as not installed until each user installs it (§16). The client writes this key
   when the user enables or disables a plugin with `/plugin` or `claude plugin enable` (§17). An
   entry that is not a Boolean counts as enabled (Judgment J12.4).
2. **`extraKnownMarketplaces`.** The client MUST register each named marketplace it does not
   already know; whether a plugin `enabledPlugins` names from it then installs is §16's. In a
   project's `.claude/settings.json` or `.claude/settings.local.json` the entries apply only after
   the user accepts the workspace trust dialog for that folder; in an untrusted folder, a `-p` run
   there included, they are ignored without a message. For one name across files, the entry of the
   highest file applies whole and inherits no field of a lower one, so one file's `source.headers`
   never joins another file's URL (2.1.228 and later; before, fields merged). `autoUpdate`, when
   omitted, is `true` for the official Anthropic marketplaces and `false` for others. The source
   forms (`github`, `git`, `url`, `file`, `directory`, `settings`), `headersHelper` and the header
   filter for repository files are §15's. With both spellings in one file, `extraKnownMarketplaces`
   applies and the alias is ignored; the alias is read only from 2.1.232 on.

### 12.7.3 Hook gates

1. Under **`allowManagedHooksOnly: true`** the client MUST load hooks and hook-like commands so:
   - **Managed and SDK hooks run**: hooks of managed settings and hooks the Agent SDK registers in
     process. <!-- req: settings.reference.What runs under allowManagedHooksOnly.Managed and SDK hooks run -->
   - **Force-enabled plugin hooks run**: hooks of plugins that managed `enabledPlugins` sets `true`,
     matched on the full `plugin@marketplace` id, so a plugin of the same name from another
     marketplace stays blocked. A mod in such a plugin loads only when it counts as the
     organization's (§10). <!-- req: settings.reference.What runs under allowManagedHooksOnly.Force-enabled plugin hooks run -->
   - **Monitors from other plugins are blocked**: a plugin's monitors start only when the plugin is
     force-enabled (2.1.310 and later; §9.2). <!-- req: settings.reference.What runs under allowManagedHooksOnly.Monitors from other plugins are blocked -->
   - **Everything else is blocked**: user, project and local hooks, hooks and mods of other
     installed plugins, and hooks in agent frontmatter. Mods built into the client keep running. A skill's frontmatter hooks run only for a skill of the managed settings directory or of a force-enabled plugin (§7.1.4 item 5, Judgment J7.3). <!-- req: settings.reference.What runs under allowManagedHooksOnly.Everything else is blocked -->
   - **Command-sourced plugins are disabled**, force-enabled ones included, unless
     `disableCommandPluginSources` is explicitly `false`; and marketplace `headersHelper` commands are
     blocked on the same condition, except for a marketplace managed settings declare (2.1.238 and
     later). <!-- req: settings.reference.What runs under allowManagedHooksOnly.Command-sourced plugins are disabled -->
   - `statusLine`, `fileSuggestion` and `subagentStatusLine` narrow to managed settings (item 3),
     and `/goal` cannot run. <!-- req: settings.reference.What runs under allowManagedHooksOnly -->
2. **`disableAllHooks: true`** reaches according to the file that carries it:
   - in managed settings: every configured hook, managed ones included, and the mods of every
     installed plugin, the organization's included; Agent SDK in-process hooks keep running
     (2.1.242 and later);
   - in the Agent SDK's `managedSettings`: ignored on a machine where an administrator deploys
     managed settings unless the administrator lets an embedding host add policy (§14); where it
     applies, user, project, local and plugin hooks and those of the SDK's `settings` option stop,
     while managed hooks, force-enabled plugins' hooks and SDK hook callbacks run (2.1.309 and
     later);
   - in any other file: user, project, local and plugin hooks and the mods the user installed stop;
     managed hooks, SDK hooks, force-enabled plugins' hooks and the organization's mods keep running.
   Built-in mods keep running in every case. An `"disableAllHooks": false` in a lower file does not
   undo a higher `true` (single value, §12.4).
3. **Status line and file suggestion gates.** For `statusLine`, `fileSuggestion` and
   `subagentStatusLine` the client MUST decide, in this order: <!-- req: settings.reference.Status line and file suggestion gates -->
   1. **Off entirely** when managed settings set `disableAllHooks`, or when the folder is not trusted
      under the workspace-trust rule for hooks in settings files (§13).
   2. **Narrowed to managed settings** when `allowManagedHooksOnly` is set, when `disableAllHooks`
      is `true` outside managed settings after precedence, or when the client starts with
      `--safe-mode`. Narrowed, a managed value runs if one is deployed; otherwise the user's value is
      skipped without a warning, the status line is off and `@` autocomplete uses the built-in file
      suggestion.

### 12.7.4 `env`

§3.6.2 states how a variable reaches the client; this section states how settings files carry it.

1. **Against the shell.** An `env` value replaces the same variable exported in the shell, and
   between files the highest-precedence one applies (per variable, §12.4). When the desktop app or a
   self-hosted environment runner builds the launch environment, a variable it already sets wins
   over every settings file and the debug log names each ignored one. An empty value cancels a
   shell export: it counts as unset for provider selection, and subprocesses inherit it empty.
   `NO_COLOR` and `FORCE_COLOR` from `env` reach subprocesses only. <!-- req: settings.reference.How env values interact with your shell -->
2. **When values apply.** From user settings, `--settings` and managed settings: at startup, and
   again when a saved change alters the merged `env`. From project and local settings: after the
   user trusts the workspace, or at startup in `-p` mode, which never shows the trust dialog, and
   again on a change. Variables the client classifies as safe (model selection, timeouts and limits,
   feature toggles) apply at startup from every file, except those of item 3. After `/cd` (2.1.246
   and later) the new directory's project and local values apply on top of the previous ones. <!-- req: settings.reference.When Claude Code applies env values -->
3. **Variables ignored.** Project and local settings MUST NOT set, and the client drops with a
   warning in `claude --debug`: <!-- req: settings.reference.Variables Claude Code ignores in env -->
   - the variables that choose where the client stores or writes its files (`CLAUDE_CONFIG_DIR`,
     `CLAUDE_CODE_TMPDIR`, `HOME`, `TMPDIR`, `TMP`, `TEMP`, the `XDG_*` family);
   - the Windows variables that pick programs and machine-wide configuration (`SystemRoot`,
     `ComSpec`, `ProgramData`, `LOCALAPPDATA`, `PATHEXT`, `PSModulePath`, the `ProgramFiles` family);
   - the variables that export session content (`OTEL_LOG_RAW_API_BODIES`,
     `ENABLE_BETA_TRACING_DETAILED`, `BETA_TRACING_ENDPOINT`);
   - the OpenTelemetry exporter variables that turn telemetry on, route it or choose its content:
     `CLAUDE_CODE_ENABLE_TELEMETRY`, `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA`,
     `ENABLE_ENHANCED_TELEMETRY_BETA`, `OTEL_LOGS_EXPORTER`, `OTEL_METRICS_EXPORTER`,
     `OTEL_TRACES_EXPORTER`, `OTEL_LOG_USER_PROMPTS`, `OTEL_LOG_ASSISTANT_RESPONSES`,
     `OTEL_LOG_TOOL_CONTENT`, `OTEL_LOG_TOOL_DETAILS`, `OTEL_EXPORTER_OTLP_*` names ending in
     `_ENDPOINT`, `_HEADERS`, `_PROTOCOL`, `_CERTIFICATE`, `_CLIENT_KEY` or `_INSECURE` (generic and
     per signal), `OTEL_EXPORTER_PROMETHEUS_HOST` and `OTEL_EXPORTER_PROMETHEUS_PORT` (2.1.282 and
     later). Only off values still apply from a repository file: `none` for the three exporter
     selectors, and an off value such as `0` for `OTEL_LOG_USER_PROMPTS`, `OTEL_LOG_TOOL_CONTENT`
     and `OTEL_LOG_TOOL_DETAILS`; such a value overrides the user file but not the launch
     environment, `--settings` or managed settings. A local interactive session shows a notice at
     startup when a repository file sets one of these; `/status` and `claude doctor` list the names,
     never the values;
   - the variables that change how the client starts or syncs (`CLAUDE_CODE_PROCESS_WRAPPER`,
     `CLAUDE_CODE_SYNC_SKILLS`, `CLAUDE_CODE_SYNC_PLUGINS`, `CLAUDE_CODE_PLUGIN_CACHE_DIR`,
     `CLAUDE_CODE_PLUGIN_SEED_DIR`), the claude.ai sign-in variables (`CLAUDE_CODE_OAUTH_TOKEN`,
     `CLAUDE_CODE_OAUTH_REFRESH_TOKEN`, `CLAUDE_CODE_OAUTH_SCOPES`), `CLAUDE_AX_*`,
     `CLAUDE_CODE_USER_DIALOG_TIMEOUT_MS`, `CLAUDE_CODE_DISABLE_ATTACHMENTS` and
     `CLAUDE_CODE_DISABLE_FILE_MENTIONS`.

   From **every** file the client ignores the identity variables its hosting environments own
   (`CLAUDE_CODE_REMOTE`, `CLAUDE_CODE_ACCOUNT_UUID`), the variables it exports itself
   (`CLAUDE_CODE_MESSAGING_SOCKET`, `CLAUDE_CODE_MESSAGING_TOKEN`), and the variables read from the
   launch environment only: `CLAUDE_CODE_PROJECT_DIR_NAME`, `CLAUDE_CODE_RESTRICTED`,
   `CLAUDE_CODE_DISABLE_POWERSHELL_CMD_RM_DENY`, `CLAUDE_CODE_DISABLE_DANGEROUS_RM_TIMEOUT`,
   `CLAUDE_CODE_DISABLE_SUBSTITUTION_RM_PROMPT`, `CLAUDE_CODE_DISABLE_INLINE_SHELL_RM_PROMPT`,
   `CLAUDE_CODE_DISABLE_MOUNTED_DRIVE_RM_PROMPT`, `CLAUDE_CODE_EVEN_MORE_DANGEROUSLY_SKIP_PERMISSIONS`,
   `CLAUDE_CODE_WARN_DISK_FREE_GIB` and `CLAUDE_CODE_WARN_MEMORY_FREE_GIB`.

## Design decisions

### Why a plugin's defaults hold only two keys

A plugin installed from a marketplace is code the user chose to run, not policy the user chose to
accept. Letting it set permissions, hooks, `env` or a policy key through a settings layer would let
one install widen what every other plugin and every session may do, without the trust dialogs that
guard those keys elsewhere (§13). Claude Code takes two presentation-level keys and drops the rest,
and an Extended client drops them at load so that no later layer can read them by accident.

### Why the stack and the merge rule are stated separately

A client that only ranks files would replace a project's `permissions.allow` with the local file's,
and one that only merges would let a user's `enabledPlugins` override nothing. Claude Code ranks the
files and then combines by kind of value, and the same split recurs inside the managed tier with its
own ranking. Stating rank (§12.3, §12.5.3) and combination (§12.4, §12.5.4) separately lets one
implementation serve both, which is what the reference implementation does with one merge strategy
per kind of key.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J12.1 | A `--add-dir` directory's settings rank below user settings for both keys they carry; of `enabledPlugins` only a `true` counts, so such an entry never overrides another source and never turns a plugin off (§12.3.1). | `plugins/loading.md` ("Find where a plugin is enabled") ranks `--add-dir` lowest for `enabledPlugins`; `permissions.md` says the two keys are all it carries and gives no rank for `extraKnownMarketplaces`. The same rank keeps one stack. Lead: the reference implementation (`src/settings/layers.ts`). |
| J12.2 | A combined list keeps each identical entry (same text, or same JSON for an object) once, the highest file's entries first, in every scope; a list over a value that is not a list replaces it (§12.4). | `managed-settings.md` says "duplicates removed" for managed drop-ins only; `settings.md` says lists combine and is silent on repeats and order. One rule for every scope keeps a rule list the same wherever it is read. Lead: reference `src/settings/merge.ts`. |
| J12.3 | `pluginConfigs` and `skillOverrides` combine per name, the highest file's entry whole; a nested block without its own rule (`env`, `sandbox`, `worktree`, `attribution`) merges key by key (§12.4). | The docs fix the per-name rule for `enabledPlugins` and `extraKnownMarketplaces` and the block rule for managed drop-ins, and are silent for these keys and scopes. Whole entries per name keep one plugin's options or one skill's state from two files apart, as §3.4.3 already states for `pluginConfigs`. Lead: reference `src/settings/merge.ts`, `src/settings/plugins/plugin-config.ts`. |
| J12.4 | An `enabledPlugins` entry that is not a Boolean counts as enabled; only `false` turns a plugin off (§12.7.2). | The settings docs type the value as Boolean; the SDK's `Settings` type also admits `string[]` and an object (version constraints). Reading them as enabled follows the SDK. Lead: reference `src/settings/plugins/enabled-plugins.ts`. |
| J12.5 | A broken user, project, local or `--settings` source is reported as `Settings Error: <source> is not a valid JSON object and is skipped (<reason>)`; an entry that fails inside a file is a Settings Warning (§12.2.4). | `settings.md` names the kinds and what each skips but quotes no text, and is silent on a broken `--settings`. Treating it like a file keeps one rule for non-managed sources. Lead: reference `src/settings/broken-file.ts`. |
| J12.6 | A key whose scope is `Global config` is dropped from every settings file, `--settings` included, with a warning naming `~/.claude.json` (§12.1.1). | `settings.md` says `--settings` cannot set such keys and that they apply only from `~/.claude.json`; it quotes no warning. Lead: reference `src/settings/read-layer.ts`. |
| J12.7 | The keys read once at session start are `model`, `effortLevel`, `modelSettings` and the managed keys `requiredMinimumVersion`, `forceRemoteSettingsRefresh` and `policyHelper`; every other key applies on save (§12.2.3). | `settings.md` lists "the ones you're most likely to edit" and `managed-settings.md` adds the managed three; no page gives a closed list. Lead: reference `src/settings/general/edit-effect.ts`. |
| J12.8 | "Alphabetical order" of `managed-settings.d/` is code-unit order of the file names (an upper-case name before a lower-case one). Two lists combine as Judgment J14.1 says: each entry at its first occurrence in file order, `managed-settings.json` first, a later duplicate dropped (§12.5.2). | The page says alphabetical with numeric prefixes and nothing of case or entry order. A byte order is the same on every file system. The entry order is J14.1's, so the two chapters give one rule. Lead: reference `src/settings/managed/drop-in.ts`. |
| J12.9 | Under `"merge"`, "a looser value applies only from the highest-ranked source" means a lower source's looser lock value (`false`, `accept`) is ignored even when the highest source sets none (§12.5.4). | The table states the rule without that case; ignoring it never loosens a lock from a lower source. Lead: reference `src/settings/managed/combine.ts`. |
| J12.10 | A plugin `settings.json` that does not parse, is not an object, or holds no valid value of `agent` or `subagentStatusLine` sets no supported key, so the manifest's `settings` applies. A dropped key, an invalid value and an unreadable file are warnings at load, never a plugin failure, and a validator reports none of them; only a manifest `settings` that is not an object fails validation (§12.6). | `plugins/components.md` says other keys are "dropped" and gives the file-over-manifest condition, not what a broken file does. Oracle 2.1.321, corpus: no finding at all on the plugins whose `settings.json` sets only dropped keys (`permissions`, `hooks`, `statusLine`, `$schema`, unknown keys; for example `kindex`, `claude-crew`, `claude-music`, `just-ship`), and each loads. Oracle 2.1.325: `claude plugin validate` passes a plugin whose `settings.json` is `[1]`, `{bad` or `{"agent":5}`, and fails `"settings": "str"` with `settings: Invalid input: expected record, received string`. Lead: reference `src/format/plugin-settings.ts`. |
| J12.11 | The debug line is `Plugin "<later>" overrides setting "<key>" set by plugin "<earlier>"` (§12.6). | The docs quote only `overrides setting`. Lead: reference `src/settings/general/plugin-defaults.ts`. |
| J12.12 | "The plugin loaded last" is the last in the order the client loads the enabled plugins (§16); the two keys resolve independently (§12.6). | The docs name no order. Using the load order every other cross-plugin rule uses (§9, J9.4) keeps one order per session. |
| J12.13 | A plugin's default `subagentStatusLine` follows the gates of `statusLine`; besides the documented rule that it never runs under `allowManagedHooksOnly`, it never runs while `disableAllHooks` outside managed settings or `--safe-mode` narrows the key to managed settings, since a plugin default is not managed (§12.6). | statusline.md ("Subagent status lines") states the `allowManagedHooksOnly` case for plugin values, force-enabled plugins included; settings-reference.md gives the other narrowing causes for the key without naming the plugin layer. Lead: reference `src/host/session-agents.ts`. |
| J12.14 | The 2.1.325 deprecation warning for a plugin's `agent` default is not part of the target release, so a validator does not give it (§12.6 item 7). | Oracle 2.1.325: `claude plugin validate` reports `agent: A plugin's \`agent\` setting is deprecated and will stop applying in a future release. …` for both `settings.json` and the manifest's `settings.agent`. The 2.1.321 documentation states the key as supported with no deprecation; the documented behaviour is kept. |
| J12.15 | A project or local value of a key that takes part in precedence only when stricter is compared with the winning value, or with the ladder's first rung when nothing wins; a lone `accept` or a lone `remoteControlAtStartup: true` is ignored, and a value off the ladder is never honoured (§12.3.3). | `settings.md` says a project or local value "that isn't stricter is ignored" without the case where no other source sets the key. Lead: reference `src/settings/general/exceptions.ts`. |
| J12.16 | The `subagentStatusLine` command runs as a `statusLine` command does: the same shell choice (Git Bash or PowerShell on Windows) and `CLAUDE_CODE_SHELL_PREFIX` wrapping; its output counts only after exit code 0, an in-flight run is cancelled when the next tick starts, and a line that is not a `{"id", "content"}` object or names an unknown `id` is ignored, so any failure leaves the default rows (§12.6.1). | statusline.md gives these rules for `statusLine` ("Windows configuration", "Script errors or hangs", "How status lines work") and says the same gates apply to `subagentStatusLine`, but states no failure rule for it; env-vars.md says the prefix wraps "status line commands". Keeping the default rows on any failure never hides a subagent by accident. |
