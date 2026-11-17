# Spec fixes found by the implementation audit and the completeness checks

Collected on 2026-11-16 from the audit of `agent-plugins` (`../IMPLEMENTATIONS.md`, the notes of
each ledger in `../implementations/agent-plugins/`) and the completeness checks in this folder.
Each item is a place where the **specification** text, not the implementation, should change, or
a decision the specification still owes. Items are resolved in the chapter and struck here.

## Chapters 1–3, 6, 11

- §2.11 and J2.4: per oracle 2.1.325 only a `skills/` tree makes a manifest-less directory a plugin
  for `validate`; a directory with only `agents/` or only `commands/` gets "No manifest found".
  Re-check against the 2.1.321 corpus verdicts and restate. — resolved: restated in §2.11/J2.4: skills tree or `.claude/` folders; only `agents/` or `commands/` → No manifest found (2.1.319, 2.1.322; none in the 2.1.321 corpus)
- §2.1 item 2 and the hooks file: 2.1.321's own validator says an invalid `hooks/hooks.json`
  "breaks the entire plugin load"; the docs say the plugin loads without those hooks. Decide
  under E4a with the corpus verdicts as evidence (`validator-messages.md`). — resolved: docs stand (load oracle 2.1.319/2.1.322: plugin loads, Hooks (0)); validator tail stated as wording only, J2.5, no deviation
- J2.3: the loader of the reference implementation strips a BOM from `hooks/hooks.json`; limit the
  rule to the validator or keep it for both, with evidence. — resolved: kept for both: a BOM hooks file loads no hooks (load oracle 2.1.319/2.1.322)
- §3.3: the table gives Monitor no session variables, while the `CLAUDECODE` text says every
  subprocess gets it. Make them agree. — resolved: CLAUDECODE narrowed to the documented list; monitor/LSP none required (J3.23)
- §3.4.4 against §3.4.6: "no saved value" against the `default`. Make them agree. — resolved: §3.4.4 defines 'set' as a saved value; a default does not set an option (oracle `plugin configure`: `not set`)
- §3.1.2 item 4 and J3.19: state that ids differing only in case share the data folder. — resolved: stated in §3.1.2 item 2 and J3.19
- J6.2: say whether a number is a valid `name` (the implementation reads it as text). — resolved: a number `name` is read as text (any non-string by JS conversion), oracle 2.1.319/2.1.322

## Chapters 4–5

- §4.10: says the validator does not report wrong-type values; the oracle reports `name` and
  `allowed-tools` type errors, a non-map `metadata`, and a missing description. Re-check against the
  2.1.321 corpus verdicts. — resolved: §4.10 now tables every frontmatter finding with its exact text and severity (corpus 2.1.321; type errors from 2.1.325, J4.26), J4.6 narrowed
- Gap: a command and a skill of one plugin with the same command name — which wins (oracle 2.1.319:
  the command). State it. — resolved: §4.6.1 item 4, the command wins (oracle 2.1.325 re-run, J4.27)
- §4.5.2 item 3 (prefer the directory-qualified variant in monorepos): say whether this is listing
  text a library supplies or host prompt text. — resolved: the variant entries are listing content, the instruction is the client's prompt text (J4.28)
- §5.3 item 4 (worktree isolation refuses commands that reach the main checkout): say whether a
  plugin-host library owns it or the host. — resolved: the client's command execution owns it, not agent loading (J5.18)
- §5.7.1: filter 1 misses `ExitWorktree` (withheld from subagents already in their own directory). — resolved: row added to filter 1
- J5.5: a quoted `maxTurns: "5"` — accept as 5 or drop; decide with evidence. — resolved: accepted as the number (oracle 2.1.325, local API stand-in, §5.4.3)

## Chapter 7

- §7.5.8: `suppressOriginalPrompt` — "a blocking handler" in one place, "any" in another. Decide. — resolved: only a handler that itself blocks counts (docs wording), J7.144; §7.5.8 bullet and "Several handlers" agree.
- J7.107 is empty in effect: an expansion block never quotes the prompt. Say what the flag does. — resolved: accepted without a warning, no effect; §7.5.9 and J7.107 say so (oracle 2.1.325, `-p`).
- J7.136: name which tool events reset the count (PreToolUse, PostToolUse, PostToolUseFailure?). — resolved: the tool call resets; a library resets on PreToolUse, PostToolUse, PostToolUseFailure, not on PermissionRequest/PermissionDenied/PostToolBatch (J7.136).
- J7.57: say what a `null` value becomes. — resolved: `null` becomes the empty string; numbers and booleans their JSON text; non-string `input` values sent unchanged (J7.57).
- §7.4.12: the per-run debug line asks for duration and matched value; say which parts a library
  must expose and which the host prints. — resolved: §7.4.12 item 2 and J7.67: the runner exposes event, matched value, handler, plugin, ending, status, duration; the host formats the line.
- §7.6.3 item 4: `--tools ""` removes EndConversation when no MCP tools remain (cli-reference.md);
  the text says it never does. — resolved: §7.6.3 item 4 restated from cli-reference.md and tools-reference.md (`--tools ""` removes it when no MCP tools remain).
- §7.6.6: say whether a Read rule matches an LSP call's `filePath`. — resolved: yes, for every operation, relative paths resolved against the working directory (LSP row, J7.210).

## Chapters 8–9, 12

- §8.4.1 item 3: `${user_config.*}` is substituted in `command`, `args`, `env`, `url`, `headers`,
  not "every string" of a server configuration. Restate from the docs. — resolved: §8.4.1 item 3 names stdio `command`/`args`/`env` and remote `url`/`headers` only, `headersHelper` refused (manifest-reference.md).
- §8.5 item 5 (reserved server names for a user's configuration): it has no marker; source it or
  make it a judgment. — resolved: marked `cli.errors.MCP server name is reserved` (errors.md); the plugin-key exception stays J8.12.
- J12.10: state the severity — a broken plugin `settings.json` is a warning, never a failure. — resolved: §12.6 item 1 and J12.10 say load warning, never a failure, no validator finding (oracle 2.1.321 corpus).
- §9.3.2 item 5 (no channel registration on MCP revision 2026-07-28): no marker; source it or make
  it a judgment. — resolved: sourced from mcp.md, "Push messages with channels" (`docs:` marker), with the v1/`legacy` escape.

## Chapters 10, 13–17

- J10.174: the 2.1.321 corpus verdicts give an error for a `hooks.json` with neither `hooks` nor
  `modules` (5 plugins); the judgment says validation passes under 2.1.321. Correct it. — resolved: §10.42.3 item 1 and J10.174 are now an E4a deviation (error with neither key; `hooks` alone passes), marker `deviates:`.
- J10.4: say outright that `required` (§3.4) binds only the dialog. — resolved: the docs (troubleshoot.md) say a required field with no value keeps a mod from loading; §10.3.4 and J10.4 now say so outright, and that outside mods it binds only the dialog.
- §13.2.1 and §13.5.2: where a warning goes (row, stderr, debug log) is the client's output; say
  what a library must return. — resolved: both sections say the routing is the presenting client's; a library returns the warning as a value (Judgment J13.33).
- J14.1: "first occurrence's position" — add "in file order". — resolved: J14.1 names the file order (managed-settings.json, then drop-ins alphabetically).
- §14.9.2 against §14.9.6: does `allowModsToOverrideDenyRules` lift `ask` rules too? — resolved: yes, with non-managed hooks' outcomes; never a managed hook's or the callback (Judgment J14.14, §14.9.2 item 3, §14.9.6, §13.11 item 2).
- §15.13: what happens when `GIT_SSH_COMMAND`, `GIT_SSH` or `core.sshCommand` names an SSH program. — resolved: §15.13 runs the named program in git's order for clones, fetches and the probe, unrewritten (J15.14).
- §16.28.1 item 3 reads against J16.24 (`<name>@inline`); reword. — resolved: item 3 names the dependency as declared; `<name>@inline` means the local copy wherever used (J16.24 reworded).
- J17.3: `disable` with neither a name nor `--all` is a usage error. — resolved: listed in J17.3 and §17.6 (oracle 2.1.325: no stdout with `--json`, exit 1).
- J17.4: list `command_not_accepted`. — resolved: in J17.4 and §17.4.3.

## Completeness

- `validator-messages.md`: 36 templates whose rule is stated without the message, 11 quoted only
  in part, 9 missing — state each with its exact wording and severity in its chapter. — resolved: re-measured 2026-11-16, all 72 templates stated at the oracle severity, no severity conflict left
- `scope.md`: every `should be in` and `partly` item. — resolved: re-measured 2026-11-16, all 56 missing or partial items stated with `docs:` markers (the index row "Settings index — sandbox" shares the `sandbox` marker)
- `docs-since-2.1.321.md`: input to the next version of the specification (map APS-004), not to
  1.1.0+claude-code.2.1.321.

## Found while fixing the implementation (2026-11-16)

- §7.1 / §14: the spec does not say whether hooks of skills in the managed skills directory run
  under `allowManagedHooksOnly` (the implementation now lets them; decide and state). — resolved: run only for a managed-directory skill or a force-enabled plugin's skill; bundled and other skills' are blocked (§7.1.4 item 5, §12.7.3, J7.3).
- §13.12 / §14: the files kept beside `remote-settings.json` are cited to errors.md, which names
  none; name them or say they are the client's own. — resolved: the client's own names; a library protects the files its host names, no guessed prefix (§13.10.3 item 4, J13.35).
- §13.9 (auto mode, per-command allowed domains): the SDK's `BashInput` carries no such field;
  say the host supplies the domains. — resolved: §13.9.4 item 2 says the host supplies them with the call; no official input type carries them.
- J15.8: over 500 characters the oracle prints its own message; state it. — resolved: `command must not be longer than the install consent UI can display`, error at `source.command` (oracle 2.1.325, §15.6.6, J15.8).
- §15.6.5: add `Invalid URL`. §15.6.7: list the cases that stay `Invalid input`. — resolved: `Invalid URL` beside the https message (§15.6.5); §15.6.7 lists no source, unknown type, each type's missing or mistyped required field, npm `..` (oracle 2.1.325, J15.8).
- J16.24: "as declared" is unclear when the marketplace is implied (the implementation names the
  resolved id, `q2@m`); decide. — resolved: the error names the resolved id, `q2@m` when the dependent's marketplace is implied, bare name only when none is (oracle 2.1.325 installed case; §16.28.1 item 3, J16.24).
- J17.15: the mod validator's `gatingHooks` entries — plain strings or `{path, message}`; confirm. — resolved: `gatingHooks` items are `{module, pattern, hook, hasCatch}`; `notes` are plain strings; errors/warnings `{path, message}` (oracle 2.1.325, J17.15).
- §13 / §7.6: is `MultiEdit` a known tool in 2.1.321? Today a `MultiEdit(...)` deny rule draws
  `matches no tool` in the implementation; state which. — resolved: not a known tool: bare and path forms draw `matches no tool`, the path form also the file-permission warning (oracle 2.1.325 -p, §13.2.1 item 3, J13.34).
- §13.12.4: sandboxing.md keeps `hooks/` and `config` inside a worktree's common `.git`
  write-denied; the spec does not say so. — resolved: stated in §13.12.2 item 4 with a `docs:` marker (sandboxing.md, Filesystem isolation).
- J7.2: "the order §12 reads them" is unclear; the implementation registers settings hooks before
  plugin hooks, settings files highest precedence first. State the order exactly. — resolved: J7.2 states it: settings files in §12.3 order highest first, then plugins in load order, then frontmatter and session hooks as registered.
- §9.1.3: the "no `command`" row says `lspServers.go.command`; oracle 2.1.325 gives
  `lspServers: Invalid input`. Re-check against 2.1.321 evidence and restate. — resolved: no 2.1.321 corpus case; restated from oracle 2.1.325: empty `command` is `lspServers.go.command: Too small: expected string to have >=1 characters`, none is `lspServers: Invalid input` (§9.1.3).
- §9.2.4: monitor path variables — the implementation exports the referenced ones in its default
  mode; the spec says they are not exported. Decide. — resolved: not exported, pasted into `command` as the docs say; an environment-reference mode only as an opt-in off by default (§9.2.4, J9.17).

## Found in wave 4 (2026-11-17)

- §17.15.3 `--mcp-config`: the shorter self-hosted wait covers stdio servers only; say so. — resolved: the self-hosted wait replaces MCP_TIMEOUT, covers stdio only, 2 s or CLAUDE_CODE_MCP_STARTUP_WAIT_MS; HTTP/SSE connect in the background (§17.15.3).
- §16.5.6 item 5: names a Windows machine cannot store — the docs name `:`; the implementation also
  refuses reserved device names, a trailing dot or space and control characters (its judgment).
  State which. — resolved: the implementation's set, Windows' own naming rules (§16.5.6 item 5, J16.26).
- §10.27.5 keybindings: contexts, pane actions, unbinding and above-prompt actions are the
  client's keymap (`keybindings.json`, chords); say the host owns them and what, if anything, a
  library takes (action names). — resolved: the keymap is the host's; a library takes focus facts and an action's binding and returns the buttons pressed (§10.27.5, J10.175).
- §7.5.33: which report line the client prints for a blocked model switch is the host's choice; say so. — resolved: host picks and places the line; a library returns verdict, reason and both forms (§7.5.33, J7.211).
- §7.2.1.1 item 2: the oracle refuses any value under the guard key but `null` or `[]` (`5`, `{}`);
  restate. — resolved: any value but null or []; a non-empty array `hooks` too (oracle 2.1.326; §7.2.1.1 item 2, J7.20).
- §10.4.2: give the lead's `; ` joint and the oracle's bare-`$` wording
  (`<plugin>: <absolute file>:<line>: <message>; $ is always spelled …`, `<plugin>` the directory name). — resolved: the whole line, path modules.<entry>, and the bare-$ and computed-access texts stated (oracle 2.1.326; §10.4.2, J10.2).
- `CLAUDE_CODE_SHELL_PREFIX` for stdio MCP starts: one fixer judged it host-only (long-running
  processes are the host's); §8.2.1 says the client applies it. Decide whether a library returns
  the prefixed command for the host to start. — resolved: yes; a library returns the start command (exec, or bash `<prefix> '<line>'`), the host launches it; example shows per-element quoting (§8.2.1, J8.26, J8.29).

## Found while implementing chapter 18 (2026-11-17)

- §18.1 `UserPromptSubmit`: the official `source: system` mixes peer messages (fire) with task
  notifications (skip); say which turns are "client-started". — resolved: §18.1.2 classifies by origin, `system` split into peer/channel (fire) and task notification/auto-continuation (skip); the host must give a `system` turn's origin (J18.7)
- §18.2 profiles: the declared MCP tool name, the raw `CallToolResult` and the shell exit code exist
  only in the host; say the host supplies them and that the profile is omitted without them. — resolved: §18.2.7 "Facts only the host has" and J18.21: the host supplies them, else the profile is omitted; an ambiguous `mcp__` split and a `PostToolUse` with `returnCodeInterpretation` omit it too
- §18.2 `file.read`: the line-number format of `Read` text is unspecified. — resolved: the text is the call's `tool_result` string byte for byte, never renumbered; no profile without it (§18.2.7, J18.16)
- §18.1: the notice wording for a failed core handler, and how several reasons are joined. — resolved: §18.1.2 item 1 gives the exec-form hook-error line and a cause per failure, item 6 joins non-empty reasons by newline in handler order (J18.22)
- §18.4 / J18.7: a converter's hook adapter has no host to give a `system` turn's origin; say what it does. — resolved: §18.4.4 item 5 and J18.23: the adapter fires on `system` and absent `source`, skips only `loop_wakeup`/`schedule_wakeup`, and the converter lists the over-firing (skipping would break a MUST, firing only a SHOULD NOT)
- §5.3 item 4 / J5.18: say what a plugin-host library does with the worktree-isolation refusals. — resolved: it does not own them and returns only the parsed `isolation` value for the host to apply; an implementation records the item as not applicable (§5.3 item 4, J5.18)
