# 10. Mods: failures and diagnostics

When a mod's module or one of its hooks fails, the client skips it and the session continues. This
part states every failure the troubleshooting page names as client behaviour: what the client does,
the line it writes, and where that line goes. The exact lines are part of the contract: tests,
authors and Claude itself search for them.

Evidence: `plugins/mods/troubleshoot.md` unless a section names another page.

## 10.40 Where a line goes, and whether mods can load

### 10.40.1 Where a line goes

When a module does not load, a hook is skipped, or another mod refuses one of this mod's calls, the
client writes one line that starts with the mod's name. It MUST put it:

1. in a session that hot-reloads a plugin directory (an interactive session started with
   `--plugin-dir`, or one with hot reloading on for mods Claude wrote): as a dim line in the
   transcript, and in the debug log;
2. in any other interactive session, as for an installed mod: in the debug log only;
3. in a `claude -p` run with `--plugin-dir`, in the default text output format: on stderr; a
   refusal by another mod goes to the debug log only (Judgment J10.170).

`claude plugin validate <dir>` reports, without a session, a misspelt event, a bad manifest and a
module the client cannot read (§17).

### 10.40.2 Whether mods can load

`claude plugin test`, run from a directory that holds no mod, MUST say whether mods can load:

| Message includes | Meaning |
| --- | --- |
| `no hooks module to load` | Mods can load; there is nothing here to test. The command exits 0; Claude Code 2.1.325 prints `claude plugin test: <dir>: no hooks module to load; there is no hooks/hooks.json naming one in "modules"`. <!-- req: mods.troubleshoot.Check whether mods can load.no hooks module to load --> |
| `hooks modules are turned off here` | `disableAllHooks` in the user's settings, or the organisation's policy, blocks mods. The command exits 1; Claude Code 2.1.325 prints `claude plugin test: hooks modules are turned off here (disableAllHooks, allowManagedHooksOnly or a policy)`. <!-- req: mods.troubleshoot.Check whether mods can load.hooks modules are turned off here --> |
| `hooks modules are turned off in this process: the rollout switch served off` | Installed mods are turned off remotely. |
| `hooks modules are turned off in this process: the rollout switch was saved off by an earlier session` | The value an earlier session saved was used; a session started once refreshes it. |

`allowManagedModsOnly` is not reported here; it refuses an installed mod with the guard's message
(§10.42.2).

## 10.41 A hook is skipped or a mod is unloaded

### 10.41.1 `hook skipped`

A hook that throws, exceeds its time limit (`reference.md`) or returns a result of the wrong shape
(`events.md`) is skipped: the chain continues as if the hook had passed the event on. The client
writes `<mod>: <event> hook skipped: <reason>`, as in `first-mod: tool.call hook skipped: threw
Error: boom`, where §10.40.1 says, once for each event and kind of failure (throw, timeout, wrong
shape) until the mod reloads; the debug log has a line for every occurrence. <!-- req: mods.troubleshoot.hook skipped -->

### 10.41.2 `no command.run hook answered it`

A command a mod registered that reaches the end of the `command.run` chain with no answer, because
no hook matched it, a hook returned `next(e)`, or the answering hook was skipped (for example for
passing `focus: false` to `$.ui.open`), MUST be answered by the client with `<mod> registered
/<command> but no command.run hook answered it`, followed by a sentence telling the author to add
the hook (Judgment J10.171). A test that runs the command fails with the same reason. <!-- req: mods.troubleshoot.no command.run hook answered it -->

### 10.41.3 `it crashed the hooks worker`

Installed mods share one hooks worker. When the worker stops responding or crashes and the client
traces the stop to one mod, it MUST unload that mod, replace the worker, and write `<mod> was
unloaded: it crashed the hooks worker`. A hook that blocks the thread, such as a loop that never
awaits, is one cause. <!-- req: mods.troubleshoot.it crashed the hooks worker -->

### 10.41.4 `mods that run in the hooks worker are off for this session`

When the worker stops three times and the client cannot trace the stops to one mod, it MUST unload
every mod that is not built in, the organisation's included, and write, in the transcript of every
interactive session, `hooks: mods that run in the hooks worker are off for this session: it crashed
3 times`. `/reload-plugins` loads them again and starts the count over (Judgment J10.172). <!-- req: mods.troubleshoot.mods that run in the hooks worker are off for this session -->

### 10.41.5 `its session.start ran again in a fresh copy`

When the client loads a mod's module again (a replaced worker, for example) the fresh copy's
`session.start` runs. A `$.prompt.submit`, `$.command.run` or `$.agent.spawn` call it repeats MUST
resolve with the result of the first copy's call instead of running again, and the client writes
`<mod>: its session.start ran again in a fresh copy; the $.<call> call it had already made was not
made again`. The rest of the hook runs as usual. Before 2.1.292 the call ran twice. A call is
matched by its kind and its place among the calls of that kind in the hook; a call that failed the
first time runs again (Judgment J10.173). <!-- req: mods.troubleshoot.its session.start ran again in a fresh copy -->

### 10.41.6 A change to a mod Claude wrote

When a change to a mod Claude wrote in the session cannot load, the client writes a transcript line
that starts with the mod's name and is one of:

- `This mod's change didn't load, so the earlier version is still running: <reason>.`
- `This mod didn't load, and the earlier version is no longer running: <reason>.`

The model does not see the line. <!-- req: mods.troubleshoot.This mod's change didn't load or the earlier version is no longer running -->

### 10.41.7 `$.agent.register refused`

A call from code still running in a copy of the module that was reloaded or unloaded (a hook that
had not returned) MUST be refused. For `$.agent.register` the call rejects and the client writes
`<mod>: $.agent.register refused: the hooks module that made the call is no longer loaded (it was
reloaded or removed)`; the agent is not registered. A hook that does not catch the rejection is
skipped. The fresh copy's `session.start` registers it again. <!-- req: mods.troubleshoot.$.agent.register refused: the hooks module that made the call is no longer loaded -->

## 10.42 The mod does not load

Nothing the mod adds appears. The client MUST still load the rest of the plugin when only its
hooks module is stopped (§10, `README.md`).

1. **The release is too old.** A client older than the release mods need loads none (`overview.md`,
   "Turn mods on or off"). <!-- req: mods.troubleshoot.Your version is too old -->
2. **The `mods active` line does not name it.** `/plugin` shows a `mods active` line naming each
   loaded mod; a mod whose hooks module did not load is not named. When the client refused it, the
   debug log has `hooks module <mod>@<source> not loaded: <reason>`, as in `hooks module
   first-mod@inline not loaded: disableAllHooks in managed settings` for a mod loaded with
   `--plugin-dir` (§10.42.1). <!-- req: mods.troubleshoot.The mods active line doesn't name the mod -->
3. **A `claude -p` run.** The run has no transcript, so the line goes to stderr, starting with the
   mod's name: `<mod>: hooks module not loaded: <reason>` (Judgment J10.170). <!-- req: mods.troubleshoot.A claude -p run prints hooks module not loaded -->

### 10.42.1 Refusal messages

Each reason follows `hooks module <mod> not loaded:` in the debug log.

| Reason starts with | Cause |
| --- | --- |
| `hooks modules are turned off for installed plugins in this process: the rollout switch served off` | Installed mods are turned off remotely. |
| `hooks modules are turned off for installed plugins in this process: the rollout switch was saved off by an earlier session` | A value an earlier session saved was used. |
| `disableAllHooks in managed settings` | The organisation turned off hooks from installed plugins. <!-- req: mods.troubleshoot.Refusal messages.disableAllHooks in managed settings --> |
| `only managed plugins and built-in plugins run` | `allowManagedHooksOnly` is set, or `disableAllHooks` is set in a settings file other than managed settings. |
| `installed plugins that are not managed load no hooks module in this mode (--bare)` | The client was started with `--bare`. |
| `another plugin of that name loads first` | Another enabled plugin of the same name holds the name (§1), so this hooks module does not load. <!-- req: mods.troubleshoot.Refusal messages.another plugin of that name loads first --> |

### 10.42.2 Messages from the built-in guard

Where the built-in guard loads (`admin.md`), it can refuse a mod or one of its answers; each message
names the setting that changes the rule.

| Message contains | Meaning | Where |
| --- | --- | --- |
| `mods are limited to your organization's by policy (allowManagedModsOnly)` | Only the organisation's own mods load; this one was refused. | The debug log, and the transcript in a session that hot-reloads a plugin directory. |
| `tried to lift a deny rule in your settings` | A mod's `tool.check` hook approved a call a `deny` rule refuses; the call stays denied. | The transcript and the debug log, once per mod per session; in a `claude -p` run the debug log only. |
| `the deny rules in your settings could not be checked for this call, so it is refused` | The guard failed while checking a call a mod approved, and refused it. | The reason the model reads for the denied call. |

<!-- req: mods.troubleshoot.Messages from the built-in guard -->

### 10.42.3 Load failures

1. **`validate` lists no `hooks` line.** A `hooks/hooks.json` with no `modules` key, or the key
   misspelt, names no module: no mod loads and the session writes no line. When the file still
   holds `hooks` (the settings hooks of §7), `claude plugin validate` checks those and passes, and
   lists no hooks module. When it holds neither `hooks` nor `modules` (`{}`, or only a misspelt
   `modlues`), the validator MUST report an error at `root` and fail:
   ``hooks.json must have `hooks` (the hook matchers) or `modules` (hooks modules), or both``.
   The docs say `validate` passes in both cases; Claude Code 2.1.321 does not (Judgment J10.174,
   E4a). <!-- deviates: mods.troubleshoot.validate passes and lists no hooks line -->
2. **`hooks module did not load`.** When the module cannot load, as when its top-level code throws,
   the client writes `<mod>: hooks module did not load: <reason>`, the reason giving the file and
   line when the fault is in the code. When the reason ends `; the version loaded before is
   unloaded`, no version of the mod runs until `/reload-plugins` loads it again. <!-- req: mods.troubleshoot.hooks module did not load -->
3. **`options do not fit plugin.json userConfig`.** When an option fails validation against its
   `userConfig` field (a number over `max`, a required field without a value, §3.4) the module does
   not load: `<mod>: hooks module did not load: options do not fit plugin.json userConfig: <reason>`,
   the line ending with the option's `pluginConfigs` entry in `settings.json`. <!-- req: mods.troubleshoot.options do not fit plugin.json userConfig -->
4. **`code nested too deep to scan: more than 2000 scopes`.** A file that nests scopes (functions,
   blocks, loops) more than 2,000 deep does not load: `<mod>: hooks module did not load: <file>:
   code nested too deep to scan: more than 2000 scopes`. `claude plugin validate` reports the same. <!-- req: mods.troubleshoot.code nested too deep to scan: more than 2000 scopes -->
5. **`the engine ran out of stack linking the file and its imports`.** Code nested too deeply, or
   a chain of imports too long, to link: the line gives a file's name and this reason. <!-- req: mods.troubleshoot.the engine ran out of stack linking the file and its imports -->
6. **`the parser stopped` or `the engine ran out of stack loading the file`.** One file nested so
   deeply that reading it ran out of stack; the line gives the file and `code nested too deep to
   scan (the parser stopped: <message>)` or `the engine ran out of stack loading the file (code
   nested too deep): <message>`, with no line number. <!-- req: mods.troubleshoot.the parser stopped or the engine ran out of stack loading the file -->
7. **A directory opened for the first time.** No mod loads until the user accepts the directory's
   trust prompt in an interactive session (§13). <!-- req: mods.troubleshoot.No mod loads in a directory you opened for the first time -->
8. **`--safe-mode`.** No installed plugin loads at all. <!-- req: mods.troubleshoot.No installed plugin loads at all -->
9. **Hot reloading stops being offered.** When the client's question whether to enable hot
   reloading for a mod Claude wrote ends three times without an answer picked (for example under
   `askUserQuestionTimeout`, since it is asked in the `AskUserQuestion` dialog), hot reloading stays
   off and the client does not ask again; a question the user dismisses does not count. Such a mod
   runs from a copy of its directory with `--plugin-dir`. <!-- req: mods.troubleshoot.Claude Code stops asking to enable hot reloading -->

## 10.43 A tool call is denied, a toast after Stop

### 10.43.1 `a hook changed this call's input after the model wrote it`

In auto mode, when a mod's `tool.call` or `turn.step` hook, or a `PreToolUse` settings hook,
changed a tool call's input after the server-side classifier reviewed it, the client MUST deny the
call with this reason, not saying which hook, and tell the model to issue the call once more as
recorded. In some interactive terminal and VS Code sessions the reason is `a hook changed this
call's input after auto mode reviewed it`; the repeated call there carries the first change, a
`tool.call` hook still runs on it, and a further change is dropped (`hooks.md`, "PreToolUse
updatedInput in auto mode"). <!-- req: mods.troubleshoot.a hook changed this call's input after the model wrote it -->

The two deny-rule messages come from the built-in guard (§10.42.2). <!-- req: mods.troubleshoot.A message about the deny rules in your settings -->

### 10.43.2 `Stopped: type a message to continue; a mod cannot resume work after Stop`

After the user stops a turn, a mod's attempt to start work on its own that the client refuses
(`api.md`, §10.33.1) raises this toast in an interactive session. After the user's next message
mods start work again and some of it returns by itself. <!-- req: mods.troubleshoot.Stopped: type a message to continue; a mod cannot resume work after Stop -->

## 10.44 A drawing does not appear or respond

### 10.44.1 Another mod's band shows and this one's does not

A mod earlier in the chain that returns a tree without the result of `next(e)` in it replaces the
bands after it (`interface.md`, §10.21). With a debug log the client writes `<mod> (<tier>) answered
ui.render without next()` for each mod that returned a tree without ever calling `next`; the line
does not name the site. A mod that calls `next(e)` and drops the result gets no line. A mod whose own
band tree does not validate is missing while the others stay (§10.44.2). <!-- req: mods.troubleshoot.Another mod's band shows and yours doesn't -->

### 10.44.2 A pane or band is empty, or shows Claude Code's usual content

A tree that does not validate skips the hook (§10.41.1) with the reason after `returned the wrong
shape`, as in:

```text
first-mod: ui.render hook skipped: returned the wrong shape (a tree Pane refuses: Box prop "flexDirection" must be one of row, column, row-reverse, column-reverse)
```

When the line is cut short, the debug log has the whole of it after `a hook returned a tree that
does not validate`. <!-- req: mods.troubleshoot.A pane or band is empty or shows Claude Code's usual content -->

### 10.44.3 `ui.render (<site>) refused`

A tree that validates and exceeds a size limit of `reference.md` is not drawn. The client writes
`ui.render (<site>) refused: <reason>`, the reason naming the limit, in the transcript, and
`ui.render (<site>): the chain settled on a tree that does not validate` in the debug log. When more
than one loaded mod has a `ui.render` hook for that site the transcript line starts `hooks:`, as in
`hooks: ui.render (AbovePrompt) refused: deeper than 32; nothing was drawn`. Before 2.1.307 any
invalid tree drew a `refused:` line, ending `; the engine drew its own` for `Pane` and
`AbovePrompt`. <!-- req: mods.troubleshoot.A ui.render line says refused -->

### 10.44.4 `threw while drawn`

When drawing the tree a hook returned, or drawing the site from props a hook passed to `next`,
throws, the client MUST draw its own content at the site and write `<mod>: ui.render (<site>) threw
while drawn: <error>; the engine drew its own`. Before 2.1.289 this error in a transcript row ended
the session. <!-- req: mods.troubleshoot.A ui.render line says threw while drawn -->

### 10.44.5 `the module failed without a message`

A `Client` that fails with an error with no message is reported in its place as `<mod>: Client
<module>: the module failed without a message` (before 2.1.289, `Error`). <!-- req: mods.troubleshoot.the module failed without a message -->

### 10.44.6 `needs a key`, `is drawn twice`, `key each once`

- `<Input> needs a key` and `<Select> needs a key`: the element's `key` is absent, empty or not a
  string.
- `<Button> needs a key`: a button with neither a key nor a label or single string child to take
  one from.
- `<Kind> "<key>" is drawn twice; each takes its own key`: two elements of that kind share a key,
  as in `Input "size" is drawn twice; each takes its own key`.
- `key each once`, from `press` in a test: more than one button has the key passed; buttons with the
  same label and no `key` share it (`test.md`). <!-- req: mods.troubleshoot.needs a key, is drawn twice, or key each once -->

### 10.44.7 `$.ui.open` runs and no pane appears

A pane the mod opened by itself in a terminal narrower than its floor waits (`interface.md`,
§10.25.3); `$.ui.open` resolved `{ isPlaced: false, reason }`. <!-- req: mods.troubleshoot.$.ui.open runs and no pane appears -->

### 10.44.8 A toast does not appear

Each `$.ui.toast` that runs writes `$.ui.toast (<mod>): <text>` to the debug log. Then:

1. **The line for the call is missing**: the call was dropped, and a line says why, as in
   `first-mod: $.ui.toast dropped: timeoutMs is a whole number of ms, 1 to 60000`. <!-- req: mods.troubleshoot.A toast doesn't appear.The line for the call is missing -->
2. **A pane is holding toasts**: a pane opened with `holdToasts` is showing (`interface.md`,
   §10.25.2); closing it ends the hold. <!-- req: mods.troubleshoot.A toast doesn't appear.A pane is holding toasts -->
3. **The toast is under the prompt**: the classic renderer draws a toast as one line at the right
   under the prompt, starting with the mod's name. <!-- req: mods.troubleshoot.A toast doesn't appear.The toast is under the prompt -->
4. **A newer toast of the same mod**: in the classic renderer a mod's newer toast takes the place of
   its older one, showing or waiting, and the debug log line for the older ends `gave way, cut
   short` (it was showing) or `gave way, unseen` (it never appeared). <!-- req: mods.troubleshoot.A toast doesn't appear.Your mod raised a newer toast -->
5. **Out of time undrawn**: fullscreen rendering draws at most three toasts at a time; a toast whose
   time runs out before it is drawn gets a debug log line ending `left the stack, never drawn`. <!-- req: mods.troubleshoot.A toast doesn't appear.The toast ran out of time undrawn -->

Before 2.1.290 a toast raised within two seconds of the mod's last shown toast was dropped
(`within 2000ms of the last; dropped`); a conformant client MUST NOT drop it.

### 10.44.9 `plugin panel hidden`

The band is collapsed (`interface.md`, §10.27.4) until the user expands it or the client starts
again; no hotkey or `action` binding presses a button in it meanwhile. <!-- req: mods.troubleshoot.The band shows plugin panel hidden -->

### 10.44.10 Hotkeys do nothing

- **No keyboard focus**: the pane or band does not have it; Ctrl+X then Tab, or a click in
  fullscreen rendering, gives it. <!-- req: mods.troubleshoot.Hotkeys do nothing.No keyboard focus -->
- **A collapsed band**: no button in it is pressed until it is expanded. <!-- req: mods.troubleshoot.Hotkeys do nothing.The button is in a collapsed band -->
- **The VS Code extension**: buttons have no hotkeys there. <!-- req: mods.troubleshoot.Hotkeys do nothing.In the VS Code extension -->

### 10.44.11 Works in the terminal, not in the Desktop app or VS Code

The site or element is not drawn by that app (`reference.md`), the VS Code extension is older than
2.1.299, or older than 2.1.304 in a session that does not fetch feature flags (Amazon Bedrock,
Google Cloud's Agent Platform, Microsoft Foundry, a Claude apps gateway). The mod's other hooks
still run. <!-- req: mods.troubleshoot.A drawing works in the terminal and not in the Desktop app or VS Code -->

## 10.45 An edit or a value is lost

1. **Edits do not take effect.** An installed plugin runs from the client's cached copy of its
   installed version (§16); a working copy loaded with `--plugin-dir` reloads on save. <!-- req: mods.troubleshoot.Your edits don't take effect -->
2. **A value resets when the module reloads.** Module-level variables are initialised again on
   every reload; `$.state` and `$.store` survive it (`interface.md`, §10.28). <!-- req: mods.troubleshoot.A value resets when the module reloads -->
3. **A value resets after `/clear`, `/resume` or `/branch`.** Each resets `$.state` to its defaults
   and `session.start` does not fire again (`interface.md`, §10.28.3). <!-- req: mods.troubleshoot.A value resets after /clear, /resume, or /branch -->

### 10.45.1 A key a `settings.read` hook returns does not take effect

On Claude Code's own read (`events.md`), permission rules a hook returns are not checked on tool
calls and `env` entries a hook returns do not become environment variables. For another key, the
debug log has one of these lines:

| Line | Meaning |
| --- | --- |
| `<mod>: settings.read hook skipped: <reason>` | The hook failed (§10.41.1). <!-- req: mods.troubleshoot.A key your settings.read hook returns doesn't take effect.settings.read hook skipped --> |
| `settings.read bypassed by cc-plugin-sec-default`, naming the mod ahead of it | The built-in guard skipped the hook; only the organisation's mods are asked. |
| `settings.read: the answer for <key> is no value the key can hold; the settings' own value stands` | §10.45.2. |
| `settings.read: the merge never settles for <key>` | The keys named keep the settings sources' values. |
| `<mod> (<tier>) answered settings.read without next()` | That mod answered without `next`; a hook after it in the chain did not run on that read. <!-- req: mods.troubleshoot.A key your settings.read hook returns doesn't take effect.answered settings.read without next() --> |
| `settings.read: refused to the engine (...)` | §10.45.3. <!-- req: mods.troubleshoot.A key your settings.read hook returns doesn't take effect.settings.read: refused to the engine --> |

### 10.45.2 `the answer for <key> is no value the key can hold`

When the value a `settings.read` hook returned for a key does not fit that key's schema (by type or
range, §12), the client MUST refuse that key alone, keep the value merged from the settings sources
before any hook answered, and write `settings.read: the answer for <key> is no value the key can
hold; the settings' own value stands`. <!-- req: mods.troubleshoot.the answer for <key> is no value the key can hold -->

### 10.45.3 `settings.read: refused to the engine`

When Claude Code's own read is refused, by a hook returning `{ deny: reason }`, the client MUST drop
every hook's value, use the settings' own values, and write `settings.read: refused to the engine
(engine: $.settings.read: <reason>); the settings' own values stand`. <!-- req: mods.troubleshoot.settings.read: refused to the engine -->

## 10.46 The debug log

With `--debug` or `--debug-file <path>` the client writes a line for every module it loads or
refuses, every hook that fails and every result it refuses. A loaded mod's line names it and lists
the events it handles; a mod loaded with `--plugin-dir` is named `<mod>@inline`:

```text
hooks module first-mod@inline loaded (worker, environment 2, tier user); events: session.start,tool.call,command.run,ui.render
```

`$.ui.log(text, { to: 'debug' })` writes a line of the mod's own there. While a mod loaded with
`--plugin-dir` is edited, the transcript shows a line for each reload naming the mod and its hooks;
a save that breaks the module writes `reload failed, the previous version stays loaded: <reason>`
and the last working version runs until plugins are next reloaded.

## Design decisions

### Why a failing mod is skipped, never fatal

A mod is third-party code inside the user's session. Ending the session, or refusing the whole
plugin, for one bad hook would let any mod take the session down; skipping it keeps the session and
the rest of the chain, and the one line that names it makes the skip visible without flooding.

### Why the lines are fixed text

Authors search the debug log, tests compare reasons, and Claude reads a line pasted back to it.
Fixed wording makes each failure findable across clients.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J10.170 | The line for a person is `<mod>: hooks module not loaded: <reason>`, the debug log keeping `hooks module <id> not loaded: <reason>`; a `claude -p` run in an output format other than text, or without `--plugin-dir`, writes the line to the debug log only. | troubleshoot.md says the line "starts with the mod's name" and names stderr only for `-p --plugin-dir` in the text format. Lead: the reference implementation's `load/line-channel.ts`. |
| J10.171 | The reply's second sentence is `Add a command.run hook for /<command> that returns { text }.` | troubleshoot.md quotes the first sentence and says the reply "tells you to add a hook". Lead: the reference implementation's `events/command.ts`. |
| J10.172 | The count of untraced worker stops is per session with no time window; a stop traced to a mod does not count; `/reload-plugins` starts it over and loads a traced mod again. | troubleshoot.md gives the three stops and the line, no window. Lead: the reference implementation's `load/health.ts`. |
| J10.173 | A fresh copy's repeated call is matched by kind and ordinal within `session.start`; one line is written for each kind; a call that failed in the first copy runs for real. | troubleshoot.md says what the mod sees, not how calls are matched across copies. Lead: the reference implementation's `api/replay.ts`. |
| J10.174 | A `hooks.json` with no `modules` key loads no mod and writes no session line. With `hooks` present, `validate` checks them and passes; with neither `hooks` nor `modules`, `validate` reports the error ``root: hooks.json must have `hooks` (the hook matchers) or `modules` (hooks modules), or both`` and fails (§10.42.3 item 1). E4a deviation. | **Docs:** troubleshoot.md, "`validate` passes and lists no `hooks` line": a `hooks.json` with no `modules` key, or the key misspelt, passes. **Claude Code:** oracle 2.1.321, corpus: the error on the 5 corpus plugins whose `hooks.json` has other keys at its top level (event names, or names of its own) (`claude-plugins-community/tap`, `ai-dev-kit`, `jhipster-forge`, `claude-cowork-personal-context-loader`, `magellan`); oracle 2.1.325 gives the same for `{}` and for `{"description": "x"}`, and passes `{"hooks": {}}` with no hooks-module line. |
