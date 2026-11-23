# Changelog

All notable changes to Agent Plugins Extended. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). A version is
`<core version>+claude-code.<release>` (see the [specification](spec/1.1.0/README.md#version)).

## [Unreleased]

The first working draft, now `1.1.0+claude-code.2.1.330`: the Agent Plugins Specification 1.1.0
extended to the plugin contract of Claude Code 2.1.330. It was first written against Claude Code
2.1.321 (`1.1.0+claude-code.2.1.321`).

### Changed: Claude Code 2.1.321 to 2.1.330

- **The snapshot.** `conformance/requirements.json` re-extracted from the 2.1.330 documentation:
  2,816 ids (was 2,730), 127 added and 41 removed (most removals are renamed sections whose rule
  lives on under a new id), from 52 pages (was 50). The new page `code-mode.md` is audited; the
  whats-new digests left the docs. `mods-declarations.json`, `docs-tables.json`,
  `tools-table.json` and the scope files are of 2.1.330 too. Coverage: 2,810 stated, 6 deviations
  (E4a), none missing.
- **Manifest and packages (§1, §2).** `engines` (a `claude-code` semver range: outside it a plugin
  is not installed, updated or loaded, except from a local folder) and `network` (the hosts a
  plugin reaches, listed by the validator, never enforced). A malformed display field (`$schema`,
  `displayName`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`) no
  longer stops a plugin: it loads with a note, while the validator still errors. The plugin
  `settings` key and a root `settings.json` are no longer documented but still read; only `agent`
  applies, with a deprecation warning.
- **Environment, skills and agents (§3–§5).** A `SKILL.md` directly in `skills/` makes that folder
  one skill; `/reload-skills`; a refused `disable-model-invocation` call carries no fixed text; the
  permission checks of a skill's injected commands; subagent `autoCompactWindow` has no upper
  bound; a background subagent's built-in tools; `CLAUDE_CODE_SUBAGENT_MODEL=inherit`; a skill's
  `model` no longer carries to subagents, forks and compaction.
- **Hooks (§7).** Code Mode (§7.6.11): what it limits, how permission checks and `PreToolUse`
  apply to calls made from code, redacting output with `PostToolUse`, and the calls a hook refuses.
  `onFailure` on `mcp_tool` hooks (2.1.328). Managed `PostToolUse` hooks no longer fire for calls
  refused before they ran. The exit-code-2 table and `continue: false` rewritten; `TaskCompleted`
  and `TeammateIdle` read a top-level `decision`; `StopFailure` loses `overloaded`.
- **MCP, LSP and monitors (§8, §9).** MCP bundles extract under the plugins root's `mcpb/`, not
  into the plugin folder, and an uninstall deletes them unless another plugin uses the same bundle;
  the time to live and poll interval of a server's results; exclusive control with
  `managed-mcp.json`; the built-in servers that skip the allowlist. The chapter-9 validator texts
  re-run on 2.1.330, unchanged.
- **Mods (§10).** Mod colors in the Desktop app, a backdrop behind the conversation, the theme's
  newer attributes; the render sites `AgentRow`, `AbovePromptList` and `ContextMenu`, the elements
  `Progress` and `Shader`; hooking other mods' drawings and controls; the events the declarations
  add (`tool.list`, `tool.offer`, `agent.report`, `ui.pointer`) and the experimental `vcs.*`;
  `$.session.machine`; testing with `expect`; troubleshooting entries. A hook skipped for re-entry
  is no longer a deviation: the docs now agree with the declarations' `HookFailure`.
- **Settings, permissions and policy (§12–§14).** `subagentStatusLine` is removed and has no effect
  anywhere; a managed `allowedHttpHookUrls` or `httpHookAllowedEnvVars` covers managed hooks.
  Restricted mode refuses `bypassPermissions`; `sandbox.autoAllowBashIfSandboxed` defaults to
  `false` from 2.1.324; a mod's approval skips auto mode's classifier, or approves what only
  `dontAsk` denies, only without the built-in guard; a permission rule does not stop a mod's own
  tool calls. Managed delivery: groups with different settings, when endpoint-managed settings take
  over, per-key exceptions across sources, seed marketplaces in containers and CI.
- **Marketplaces, install and the CLI (§15–§17).** `engines` on a marketplace entry; a git `ref`
  may be a commit SHA; `npm`, `pip`, `uv`, `cargo`, `github` and `gh` are no longer reserved
  marketplace names; a plugin enabled in an `--add-dir` directory but not loaded; `restore-set-aside`
  documented; the `Successfully …` lines without `Successfully` in a terminal; `Folder (<path>)` in
  `marketplace list`; `commandPrinted` and `commandFailed` in `install --json`; what an uninstall
  deletes and keeps; an entry with a malformed display field cannot be installed (J15.15); the
  validator's `hosts` result and its `Hosts` lines; `managed_lock` on a `plugin_errors` entry in
  `system/init`; `engines` on the plugins of a `settings` marketplace source.
- **Skills.** A skill without `context: fork` that Claude runs no longer moves that turn's
  subagents, forks, compaction or `/recap` to its `model` (changelog 2.1.330).
- **Judgments.** 470 (was 445): added J1.3, J2.9, J2.10, J4.29, J4.30, J5.19, J5.20,
  J7.212–J7.216, J8.30, J10.22–J10.24, J10.113, J12.17, J12.18, J13.38, J14.16, J15.15,
  J17.33–J17.37;
  removed J12.13 and J12.16 (`subagentStatusLine` no longer runs); revised among others J2.6
  (display fields), J4.2, J7.121, J10.7 (no longer a deviation), J12.10, J12.14, J15.3, J15.6,
  J16.15, J17.1, J17.18, J17.27, J18.20. Deviations (E4a): 6 (was 8).
- **Schemas** (`schemas/1.1.0/claude-code/`, as 2.1.330 accepts files): `plugin.json` gains
  `engines` and `network`, and its display fields, `engines` and `network` accept any value, since
  Claude Code ignores a malformed one; `$defs/effective` states the values that take effect. A
  marketplace entry gains `engines` and keeps strict display fields (2.1.330 still refuses to
  install such an entry). `mcp_tool` hooks take `onFailure`; an agent's `autoCompactWindow` has no
  maximum; plugin default settings keep only `agent`, deprecated.
- **Verification.** The ledgers stay records of the 2.1.321 passes: `bun run verification` lists
  the ids they name that 2.1.330 no longer has as retired (41) instead of failing, and says how
  many verified ids were read against the snapshot's own release (none yet). The implementation
  ledgers (`conformance/implementations/`) now name the release whose text they audited (2.1.321
  for every pass so far) and list retired ids the same way.
- **Official types.** The chapters follow `@anthropic-ai/claude-agent-sdk` 0.3.330 (built for
  2.1.330, pinned in `tools/`), not 0.3.321. Its hook types are unchanged; the shapes the chapters
  gained from it are `managed_lock` on `plugin_errors` (§17.15) and `engines` on a `settings`
  source's plugins (§15).
- **Corpus.** `bun run corpus` against Claude Code 2.1.330's verdicts (`RELEASE` in
  `tools/src/corpus/main.ts`): 2,489 plugins, 25,347 files, 0 false rejects, 0 unconfirmed
  refusals, 380 oracle errors matched, 334 left. Of those left, 55 are validator errors on a
  malformed `repository` or `author` that Claude Code ignores at load and the schema accepts on
  purpose; the remainder classifier now files such errors under their own kind instead of
  "expressible" (from the next run).

### Added

- The specification, 18 chapters in `spec/1.1.0/`: packages and the two forms (§1), the Claude Code
  manifest (§2), environment and user configuration (§3), skills and commands (§4), agents (§5),
  output styles and themes (§6), hooks (§7), MCP servers (§8), LSP servers, monitors and channels
  (§9), mods (§10), workflows (§11), settings (§12), permissions and trust (§13), managed policy
  (§14), marketplaces (§15), install, updates and dependencies (§16), the plugin CLI and its
  diagnostics (§17), and the core and Claude Code in one client (§18), with dual packages and
  conversion.
- "How to read this specification" in the specification's front page: reading paths, references,
  markers.
- 405 judgments where the documentation is silent, each with its evidence, and a generated index
  (`spec/judgments.md`).
- The requirements snapshot of Claude Code 2.1.321 (`conformance/requirements.json`, 2,730 ids)
  and the coverage report: 2,723 stated, 7 deviations (E4a), none missing.
- Verification of every requirement against its documentation section, in 14 passes recorded as
  ledgers (`conformance/verification/`), and the report `conformance/VERIFIED.md`.
- JSON Schema 2020-12 for the twelve kinds of Claude Code plugin file
  (`schemas/1.1.0/claude-code/`), and the corpus check against 2,495 real plugins and Claude Code's
  own validator: 0 false rejects (`conformance/CORPUS.md`).
- Tools (`tools/`): the U1 check, links, section citations, coverage, verification, the judgments
  index, the corpus check, and `sync` for merging upstream.
- Mining Claude Code (`tools/src/mine/`, `bun run mine <release>`): the docs and the mods
  declarations of a release, the requirements and the scope audit that selects them, the
  declarations snapshot, the corpus and Claude Code's verdicts on it. The snapshots beside
  `requirements.json` (`mods-declarations.json`, `docs-tables.json`, `out-of-scope.json`,
  `out-of-scope-pages.json`, `scope-audit.md`) live in `conformance/`; implementations sync them.
- Oracle runs (`tools/src/mine/oracle/`, `bun run oracle:record`): Claude Code run as a black box
  on fixtures written for it (a session's registry, the settings merge and starting mode, the hook
  scrub, remote MCP and `headersHelper` credential names, what the model reads of a skill), recorded
  in `conformance/oracle/` for implementations to sync, and on the corpus (a session per plugin,
  validator timings), cached in `.cache/oracle/<release>/`. `conformance/tools-table.json`: the
  tools table of tools-reference.md as data.
- Documentation: the GitHub front page (`.github/README.md`), and guides for `conformance/`,
  `tools/` and contributing.

### Changed

- Ten judgments settled against the implementation's disagreements, recorded in the verification
  ledger `v16-disagreements`: the kebab-case advice by how badly a name breaks (J2.8, new), a
  skill's `!` command among the pasted surfaces with J3.5's MAY, `disableAllHooks` sparing
  managed-directory and bundled frontmatter hooks (J7.19), integer-like LSP server names first
  (J9.4), buttons sharing a key (J10.176, new), drop-in list order as J14.1 (J12.8), the known-safe
  variables as a table (J13.8), `Tool(*)` bare only for the command format (J13.36, new), no
  PowerShell read-only set (J13.37, new) and an empty managed `sandbox` list in force (J14.15, new);
  `autoMode` is read from `--settings` too (§13.13), and an exec-form hook gets `CLAUDE_ENV_FILE`
  (§7.6.9 item 5).
