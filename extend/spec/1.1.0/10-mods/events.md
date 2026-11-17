# 10. Mods: events

This part of §10 states how a hook handles an event (observe, rewrite, answer), how it filters the
events it sees, the order the hooks of several mods run in, what happens when a hook fails, and
every event a client fires, with its fields and the answers a hook may give. The arguments of a hook
and the members of `next` are in `reference.md` (§10.6); what each `$` method does is in `api.md`;
`ui.render` and the interface events in depth are in `interface.md`.

Evidence: `plugins/mods/events.md` and `plugins/mods/reference.md`, "Events", unless a section names
another page. Each event's input and result are the declarations' `<Event>Input` and `<Event>Result`
types of 2.1.321 (`ToolCallInput`, `ToolCallResult`, and so on, named after the event), which win
where the prose differs; this part names their fields and states the behaviour around them.

## 10.13 How a hook handles an event

The hooks on one event form a middleware chain. A hook receives `$`, the event `e` and `next`;
`next(e)` calls the next hook, or, at the end of the chain, the client's own behaviour, and resolves
to the result. What a hook does with `next` decides what it does, and the client MUST honour each:

1. **Observe.** The hook does its work and returns `next(e)`, or awaits `next(e)`, does its work and
   returns what it resolved to. The event goes on as without the mod; a hook that awaits sees the
   result after the hooks below it and the client's behaviour have run. <!-- req: mods.events.Observe an event -->
2. **Rewrite.** The hook calls `next` with a changed copy of `e` (`next({ ...e, text: e.text.trim()
   })`). Later hooks and the client's behaviour receive the copy and never the original; `e` itself
   is deeply frozen and an assignment to it throws. A hook MAY also await `next(e)` and return a
   copy of the result with a field replaced. <!-- req: mods.events.Rewrite an event -->
3. **Answer.** The hook returns a result without calling `next`. The chain stops there: later hooks
   and the client's behaviour do not run, and the result is the event's. Each event has its own
   result shape (§10.16–§10.19); a result of the wrong shape is a failure (§10.15). <!-- req: mods.events.Answer an event -->
4. A hook MAY call `next` more than once; each call runs everything below again (a retry, §10.16.1).
   A hook that returns nothing fails.

### 10.13.1 Streaming events

`turn.step` and `process.spawn` stream. A hook on either is an async generator: `next(e)` returns a
stream of the pieces below, whose return value is the result; `yield* next(e)` forwards each piece
as it arrives and evaluates to the result, and a hook that transforms reads `for await (const chunk
of stream)` and then `await stream.result`. Every other hook is an async function. A module whose
hook has the wrong form does not load (§10.4.2).

### 10.13.2 Shorthand for answers

In the tables of this part, `next(e)` passes the event on unchanged; `next({ ...e, text })` passes
a copy with the named field changed; an object such as `{ deny: reason }` answers the event without
`next`, `reason` standing for a string the hook writes.

### 10.13.3 Matchers and patterns

1. **Matcher.** The optional second argument of `on` is an object whose fields are compared with the
   event's; the hook runs only when every field matches. A field's value is a value, compared with
   `===`; an array, matching when any element matches; a regular expression, tested against the
   event's value as a string; or an object, matched as a partial of an object field. Against an
   array field, a pattern holds when some element matches. A field the event lacks matches nothing,
   so `isReadOnly: false` on `tool.check` never matches (§10.16.3). The matcher is tested against
   the event as it reaches the hook, after earlier hooks rewrote it (Judgment J10.12).

   ```javascript
   on('tool.call', { tool: 'Bash' }, hook)            // Bash only
   on('tool.call', { tool: ['Edit', 'Write'] }, hook) // Edit or Write
   on('tool.call', { tool: /^mcp__github__/ }, hook)  // every tool of one MCP server
   ```

2. **Patterns.** The first argument is an event name; `*`, every event; `<namespace>.*`, every event
   whose name starts with that namespace (`classic.*`, `ui.*`); or a negation `!<name>` or
   `!<namespace>.*`, every event but those (`!*` is no pattern). Neither `*` nor a negation selects a
   telemetry event in a mod outside the `builtin` tier: those are hooked by name or by `telemetry.*`,
   with the `{ to: 'collector' }` filter (§10.19.6). A glob hook handles only the events whose form
   (async function or generator) fits it. The documentation names `*` and `classic.*`; the
   declarations' `Pattern` adds namespace globs and negations (Judgment J10.13).
3. **Once per matcher.** An event registered twice with no matcher keeps the whole module from
   loading: `on("session.start") is registered twice without a matcher` (§10.4.2). The same event
   once per matcher is allowed. <!-- req: mods.events.Filter which events a hook handles -->

## 10.14 The order mods run in

1. The hooks on one event run outermost first: the first sees the event before the others and the
   result after them, and decides whether the others run at all. A later mod cannot stop an earlier
   one from seeing an event.
2. A client MUST order the chain in five tiers, outermost first (declarations, `TIERS`):

   | Tier | Mods |
   | --- | --- |
   | `prepend` | the built-in guard `sec-default@builtin` where it loads (§14), first; then the mods managed `prependPlugins` lists, in its order; then any other mod that counts as the organisation's and is not in `appendPlugins`. A managed `prependPlugins` replaces that default: the guard then loads only when the list names it, at the place the list gives it (§10.12.1, §14) |
   | `user` | the mods the user installed, or loaded with `--plugin-dir` |
   | `append` | the mods managed `appendPlugins` lists, in its order |
   | `builtin` | the other mods built into the client |
   | `core` | the client's own behaviour, always last |

3. Among the user's mods, a mod runs before the mods it lists under `dependencies` (§16). Within one
   module, hooks run in the order `register` called `on`. Mods of one tier otherwise run in the order
   they first loaded (Judgment J10.9). <!-- req: mods.events.The order mods run in -->

### 10.14.1 Where settings hooks run in the order

During a tool call, the `PreToolUse` settings hooks (§7) run at fixed points of the chain:

1. `PreToolUse` hooks from managed settings run before the first mod's `tool.call` hook. When one
   blocks the call, no mod's `tool.call` hook runs for it.
2. `PreToolUse` hooks from every other settings file and from plugins' `hooks/hooks.json` run after
   the last mod calls `next`, as part of the client's own behaviour: a mod that answers `tool.call`
   without `next` keeps them from running, and a mod that calls `next` sees their decision in the
   result.
3. `tool.check` fires after the `PreToolUse` hooks have run (§10.16.3). <!-- req: mods.events.Where settings hooks run in the order -->

## 10.15 When a hook fails

A hook **fails** when it throws, runs past its time limit (§10.11), or returns a result of the wrong
shape; a `ui.render` hook whose tree does not validate returned the wrong shape (§10.24). A failure
never ends the session. Without a `.catch` handler, what follows depends on `next`:

1. **It failed before calling `next`**: the client skips it, and the next handler runs in its place,
   as if the hook were not there. <!-- req: mods.events.Handle a hook that fails.It failed before calling next -->
2. **It failed after `next` resolved**: that result stands, and nothing below runs a second time.
   A hook that called `next` and failed before the call resolved keeps that call's result, the
   latest when it called several times (Judgment J10.14). <!-- req: mods.events.Handle a hook that fails.It failed after next resolved -->
3. The client reports one line naming the mod, the event and the reason, as `my-mod: tool.call hook
   skipped: threw Error: boom`, where `troubleshooting.md` says.

A **`.catch` handler** (§10.5) answers in the failed hook's place. It is called with the same `$`
and `e`, and a `next` that also carries `next.error` and `next.called` (§10.6.1). Its `next(e)` is
replay-safe: when `next.called` is true it resolves to what the hook's last call settled to, running
nothing below again; when false it runs the hooks below once. The handler's answer, within its 1
second (§10.11), is the hook's result for the dispatch. A handler that itself throws or times out
leaves the hook skipped as if it had no handler.

This guard fails closed:

```javascript
on('tool.call', { tool: 'Bash' }, guard).catch(async ($, e, next) => {
  if (next.called) return next(e)
  return { deny: 'The command guard failed, so this command was not run: ' + next.error.kind }
})
```

- **`guard` failed before it called `next`**: the command does not run, and Claude reads the `deny`
  text, ending with the kind. <!-- req: mods.events.Handle a hook that fails.guard failed before it called next -->
- **`guard` failed after it called `next`**: the handler's `next(e)` resolves to the result `guard`'s
  call produced, without running the command again, and Claude reads that. <!-- req: mods.events.Handle a hook that fails.guard failed after it called next -->

When `next.called` is false, a handler answers with the refusal of its event: `{ drop: reason }` on
`prompt.submit`, `{ deny: reason }` on `config.set` and `tool.call`. At two events a refusal returned
after `next` resolved still holds, so a handler returns it without testing `next.called`:

- **`tool.check`**: `{ decision: 'deny', reason }`. <!-- req: mods.events.Handle a hook that fails.tool.check -->
- **`plugin.register`**: `{ refuse: reason }` (§14). <!-- req: mods.events.Handle a hook that fails.plugin.register -->

At `tool.call`, a `deny` returned after `next` resolved withholds the result (§10.16.1).

## 10.16 Tool events

| Event | Fires when | A hook can return |
| --- | --- | --- |
| `tool.call` | a tool is about to run | `next(e)`, `{ deny: reason }`, `{ result }` <!-- req: mods.event.tool.call --> |
| `tool.check` | the client decides whether a tool call may run (§10.16.3) | `next(e)`'s result, or `{ decision, reason? }` with `decision` `allow`, `ask` or `deny` <!-- req: mods.event.tool.check --> |
| `tool.describe` | once for each tool, when its description is first sent to Claude (§10.16.4) | `{ description, isDeferred?, breakPromptCache? }` <!-- req: mods.event.tool.describe --> |

### 10.16.1 `tool.call`

`tool.call` fires for every tool call, a subagent's and an MCP tool's included. `e.tool` is the
tool's name, `e.tool_use_id` the call's id, `e.agentId` is set for a subagent's call, and the tool's
arguments are fields of `e` (`e.command` for Bash, `e.file_path` for Edit). `next(e)` runs the
permission check (§13, §10.16.3) and then the tool, and resolves to one of three results
(declarations, `ToolCallResult`): `{ deny }` for a refused call; `{ result, text?, context?,
isReadOnly?, ref? }` for a call the tool answered, `result` being the tool's record (typed per
built-in tool), `text` what Claude reads, `context` text Claude reads after it; or `{ isError: true,
result, text? }` for a call that failed.

A hook MAY:

- **Refuse the call**: return `{ deny: reason }` without `next`. The tool does not run, no
  permission prompt appears, and Claude reads `reason` as the tool's error result.
- **Change the call**: pass changed arguments to `next`. <!-- req: mods.events.Guard or change a tool call.Change the call -->
- **Retry the call**: call `next(e)` again, as after a first result with `isError`, and return the
  second result. <!-- req: mods.events.Guard or change a tool call.Retry the call -->
- **Answer the call itself**: return `{ result }` without `next`, `result` having the shape of the
  tool's own result for a built-in tool. No prompt appears and the tool does not run; the client
  validates the result against the tool's output schema where it has one and records it as the
  tool's result. <!-- req: mods.events.Guard or change a tool call.Answer the call yourself -->
- **Withhold the result**: return `{ deny: reason }` after `await next(e)`. Claude reads the reason
  in place of the result; nothing the tool did is undone. When the tool ran and succeeded, the
  reason follows `<tool> ran, and a plugin withheld its result: `, as `Bash ran, and a plugin
  withheld its result: `. <!-- req: mods.events.Guard or change a tool call.Withhold the result from Claude -->

A `tool.call` hook that throws or times out is skipped and the call goes on (§10.15). Managed
`PreToolUse` hooks run before it (§10.14.1).

### 10.16.2 Holding a call until the user decides

A `tool.call` hook MAY await before it calls `next` or returns; the call stays pending until then.
`$.ui.ask(question, options)` shows the question above a numbered list of the options in the dialog
Claude asks in, adds a row for typing another answer and a **Chat about this** row, and resolves to
the label picked. Time inside a `$` call does not count against the hook's limit; time awaiting a
promise of the hook's own does. For a hook that asks before a risky Bash command:

- **The user picks Run it**: `$.ui.ask` resolves to `Run it`, the hook calls `next(e)`, and the usual
  permission check still runs after it. <!-- req: mods.events.Hold a tool call until the user decides.The user picks Run it -->
- **The user picks Refuse**: it resolves to `Refuse`; the hook returns `{ deny }`, and the command
  does not run. <!-- req: mods.events.Hold a tool call until the user decides.The user picks Refuse -->
- **The user types an answer**: it resolves to the typed text. <!-- req: mods.events.Hold a tool call until the user decides.The user types an answer -->
- **Nobody answers**: it rejects when the user dismisses the question or picks **Chat about this**,
  and always in a `claude -p` run, where nobody can be asked. <!-- req: mods.events.Hold a tool call until the user decides.Nobody answers -->

A hook that times out while holding is skipped, so the held command runs; a `.catch` handler makes
it refuse instead.

### 10.16.3 `tool.check`

`tool.check` fires where the client decides whether a call may run: after the `tool.call` hooks and
the `PreToolUse` hooks, and before the permission prompt, auto mode's classifier or a
`PermissionRequest` hook. <!-- req: mods.events.Approve or refuse a tool call before the user is asked.When tool.check fires | mods.events.Approve or refuse a tool call before the user is asked -->

1. **Its fields.** `e.tool` names the tool and `e.input` holds its arguments (`e.input.command` for
   Bash); `e.tool_use_id` the call. <!-- req: mods.events.Approve or refuse a tool call before the user is asked.Arguments -->
   - `e.agentId` is set when a subagent or an in-process teammate makes the call, and absent for the
     main conversation; `e.ceiling` is `ask` for a connector tool the organisation set to `ask`, in
     sessions where that setting reaches the client (both from v2.1.290). <!-- req: mods.reference.Agent and organization fields on tool.check -->
   - `e.isReadOnly` is `true` when the tool reports this call as read-only, and otherwise absent,
     never `false` (from v2.1.304). <!-- req: mods.reference.The e.isReadOnly field on tool.check -->
   - `e.approver` is `host` or `person` (declarations, `ToolCheckInput`).
2. **What `await next(e)` gives.** The client's own decision, `{ decision, reason?, rule?, hook?,
   setting?, plugin?, ceiling? }` (declarations, `ToolCheckResult`), with `decision` `allow`, `ask`
   or `deny`, reached by the rules, the permission mode and the `PreToolUse` hooks. No permission
   prompt appears while `next(e)` runs. <!-- req: mods.events.Approve or refuse a tool call before the user is asked.What await next(e) gives you -->
3. **What to return.** `{ decision: 'allow' }`, `{ decision: 'ask', reason }` or `{ decision: 'deny',
   reason }` to decide; what `next(e)` gave, to leave the decision alone. A hook's `deny` holds even
   where a rule allows the call: a hook that denies `git push` while the branch is `main` refuses it
   on `main`, and on any other branch the call gets the decision it would get without the mod. A
   `reason` is what Claude reads on a deny and what the dialog shows on an ask. The client sets
   `plugin` to the mod whose hook asked and drops what a hook writes there, and drops a hook's own
   `ceiling`. <!-- req: mods.events.Approve or refuse a tool call before the user is asked.What to return | mods.events.Approve or refuse a tool call before the user is asked.On main -->
4. **What a hook cannot loosen.** In plan mode, for a call that is not read-only, a hook's answer
   only tightens the decision `next(e)` returned (allow, then ask, then deny); a looser answer is
   replaced by the client's. With `e.ceiling` `ask`, a hook's `allow` becomes `ask`. For a tool that
   requires the person (a question, a plan to approve), an `allow` does not dismiss the dialog. The
   rules and `PreToolUse` decisions an `allow` cannot replace are §13's (Judgment J10.15).
5. **A failure.** A hook that throws or times out leaves the call its decision without the mod; a
   `.catch` handler returning `{ decision: 'deny', reason }` refuses it (§10.15). <!-- req: mods.events.Approve or refuse a tool call before the user is asked.The hook throws or times out -->

#### Read-only calls

`e.isReadOnly` is the tool's own report. Read, Grep, Glob and WebSearch report every call
read-only; Bash reports one when the command passes the client's read-only command check (§13); an
MCP tool when its server sets the `readOnlyHint` annotation to `true`. WebFetch and Agent calls also
report read-only though they fetch a URL or start a subagent, so a hook SHOULD NOT approve a call on
this field alone. <!-- req: mods.events.Check whether a tool call is read-only -->

A matcher `{ isReadOnly: true }` selects read-only calls. For the others a hook tests
`e.isReadOnly` in its body: a matcher `{ isReadOnly: false }` never matches, since the field is
absent rather than `false` (§10.13.3). <!-- req: mods.events.Filter a tool.check hook by whether the call is read-only -->

### 10.16.4 `tool.describe` and changed prompt text

`tool.describe` fires once for each tool, when its description is first sent to Claude, and a
second time for an MCP tool Claude loads through tool search, with `e.description` the text Claude
reads for the loaded tool. Its fields are `tool`, `description`, `isDeferred` and `provider` (`{
plugin, tier }` of whoever defined the tool). A hook returns `{ description }`, with `isDeferred:
true` to put the tool behind tool search or `false` to load it up front.

To change a tool description or a system prompt section in a running conversation, a mod calls
`$.ui.invalidate('tool.describe')` or `$.ui.invalidate('prompt.section')` so its hook runs again,
and returns `{ description, breakPromptCache: true }` or `{ text, breakPromptCache: true }`. The
client MUST send the changed text on the next turn, and the prompt cache starts over. Without the
field, Claude keeps the text saved with the conversation, for a section or a tool loaded up front,
until a new conversation or a compaction. The field exists from v2.1.321; from v2.1.299 to before
v2.1.321 a running conversation got the changed text on the next turn without it. <!-- req: mods.reference.Send a changed system prompt section or tool description with breakPromptCache -->

## 10.17 Prompt events

| Event | Fires when | A hook can return |
| --- | --- | --- |
| `prompt.submit` | a prompt is submitted (§10.17.1) | `next({ ...e, text })`, `next({ ...e, context })`, `{ drop: reason }` <!-- req: mods.event.prompt.submit --> |
| `prompt.fill` | text is about to go into the prompt box as a draft; `e.mode` is `append`, `insert` or `replace`, `e.origin` the engine or a plugin | `next(e)` with changed `text`; the result is `{ isFilled, refusal? }` <!-- req: mods.event.prompt.fill --> |
| `prompt.suggest` | text is about to show in the prompt box as a dim suggestion | `next(e)` with changed `text`; the result is `{ isShown }` <!-- req: mods.event.prompt.suggest --> |
| `prompt.edit` | the user edits the prompt box; `e.text`, `e.inputText`, `e.cursor`, `e.start`, `e.end`, `e.key` | `next(e)`; the result is `{ text, cursor, decorations? }`. Its time limit is 50 ms (§10.11). <!-- req: mods.event.prompt.edit --> |
| `prompt.autocomplete` | the user types and a word ends at the cursor: `e.token` is the word, with `e.text`, `e.cursor`, `e.start` | `{ suggestions }`, a list of `{ text, label?, description? }` shown below the client's own rows; choosing one writes its `text` over the word. The client does not wait for the hook: its own rows show first. <!-- req: mods.event.prompt.autocomplete --> |
| `prompt.compose` | the client renders a system prompt; `e.model`, `e.promptModel`, `e.tools`, `e.surfaces`, `e.traits`, `e.outputStyle` | `{ sections }`, a list of `{ id, text, scope }` in the order sent; `scope` is `shared` or `session`, every `shared` before every `session`; a plugin's own id is `<plugin>:<name>` <!-- req: mods.event.prompt.compose --> |
| `prompt.section` | once for each named section of the system prompt; `e.name` is its `id` in `prompt.compose` | `{ text }`, or `{ text: null }` to omit it; `breakPromptCache` (§10.16.4) <!-- req: mods.event.prompt.section --> |
| `prompt.context` | once for each conversation, for the context sent with the first message; `e.blocks` are `{ name, text }`, `e.instructionFiles` the instruction files read | `{ blocks, instructionFiles? }` <!-- req: mods.event.prompt.context --> |
| `prompt.attachment` | the client adds a message of its own for Claude, such as a reminder; `e.type` names the kind (`plan_mode`, `plan_mode_exit`, `plan_mode_reentry`, others), `e.detail` the facts the text was written from for the kinds the declarations name | `{ text }`, or `{ text: null }` to omit it <!-- req: mods.event.prompt.attachment --> |
| `prompt.mention` | the client is about to read a file a prompt @-mentions; `e.mention`, `e.path`, `e.offset`, `e.limit` (from v2.1.290) | `next({ ...e, path })` to read another file, or `{ deny: reason }`: nothing of the file is attached <!-- req: mods.event.prompt.mention --> |
| `skill.prompt` | a skill's text is expanded for Claude (§10.17.2) | `{ text }` <!-- req: mods.event.skill.prompt --> |
| `attribution.text` | the client composes commit or pull request attribution text; `e.kind` is `commit`, `pr`, `exemption` or `remedy` | `{ text }` <!-- req: mods.event.attribution.text --> |

The declarations also have `prompt.change`, which fires when the prompt box's text changes for a
reason other than typing (`e.origin.kind` `history`, `clear`, `undo`, `plugin`, `app` or `engine`)
and is answered `{ text }`; a client MUST fire it (Judgment J10.16).

### 10.17.1 `prompt.submit`

`e.text` is what was typed; `e.context` the lines added for Claude so far; `e.origin` where it came
from; also `attachments`, `command`, `isMeta`, `turnId` and `wait`. <!-- req: mods.events.Rewrite or add to a prompt -->

| To | Return |
| --- | --- |
| rewrite the prompt; the transcript and the prompt history show the new text | `next({ ...e, text: newText })` |
| add text only Claude reads, after the prompt | `next({ ...e, context: [...(e.context ?? []), extra] })` |
| stop the prompt from being sent | `{ drop: reason }` |

A `drop` returned without `next` stops the prompt: its text goes back into the prompt input, and
the user sees `Prompt dropped by a hook: ` followed by the reason. The prompt still goes through
when the hook returns a `drop` after its `next(e)` let it through (the turn runs, and the hook fails
with a message including `a drop after its next() was answered`), and when the hook throws or times
out (it is skipped). A reason over 4,096 characters is cut (§10.11). <!-- req: mods.events.Rewrite or add to a prompt.Stop the prompt from being sent -->

### 10.17.2 `skill.prompt`

`e.skill` is the skill's name and `e.text` the text Claude reads. From v2.1.299 the event also
carries:

| Field | Type | What it holds |
| --- | --- | --- |
| `e.source` | string | Who provides the skill: `policySettings`, `userSettings` or `projectSettings` for the enterprise, personal or project location (§4); `plugin`, `mcp`, `syncedSkills`, `built-in` or another word for the others. <!-- req: mods.skillPrompt.e.source --> |
| `e.pluginName` | string | The plugin's name, set only when `e.source` is `plugin`. <!-- req: mods.skillPrompt.e.pluginName --> |
| `e.path` | string | The absolute path of the skill's `SKILL.md`, or of its `.md` file for a skill written as a command file; absent when the skill has no file on this machine. <!-- req: mods.skillPrompt.e.path --> |
| `e.frontmatter` | object | The frontmatter of the skill's file as plain data; `{}` when there is none. <!-- req: mods.skillPrompt.e.frontmatter --> |
| `e.frontmatterProblem` | string | Why `e.frontmatter` misses the file's frontmatter or one of its keys, as `is a list or a single value, not a table`; absent when it holds the whole frontmatter or the skill has none. <!-- req: mods.skillPrompt.e.frontmatterProblem --> |

A hook MAY pass a changed `text` or `frontmatter` to `next`: the hooks after it read both, and
Claude reads the final `text`. A hook that changes any other field fails (§10.15).

## 10.18 Commands, configuration and settings

| Event | Fires when | A hook can return |
| --- | --- | --- |
| `command.run` | a command is about to run (§10.18.1) | `{ text }`, `{}`, or `next(e)` <!-- req: mods.event.command.run --> |
| `command.describe` | once for each command, for the command list; `e.command`, `e.description`, `e.argumentHint`, `e.isHidden`, `e.immediate`, `e.provider` | `{ description, argumentHint, isHidden }` <!-- req: mods.event.command.describe --> |
| `config.set` | a `/config` row is about to change; `e.key`, `e.value`, `e.previous`, `e.origin`, `e.provider` | `next({ ...e, value })` or `{ deny: reason }` (a reason over 4,096 characters is cut) <!-- req: mods.event.config.set --> |
| `config.describe` | once for each `/config` row; `e.key`, `e.label`, `e.description`, `e.isHidden`, `e.provider` | `{ label, description, isHidden }` <!-- req: mods.event.config.describe --> |
| `settings.read` | a mod calls `$.settings.read`, or the client builds the session's merged settings (§10.18.3) | `next(e)`, `{ value }` or `{ deny: reason }` <!-- req: mods.event.settings.read --> |

### 10.18.1 `command.run`

`e.command` is the command's name, `e.args` its arguments, `e.origin` who ran it and
`e.presentation` `{ columns, isFullscreen }`. A hook rewrites `args` only: a hook MUST NOT rewrite
`e.command` (declarations, `CommandRunInput`). The result is `{ text?, context?, isTextDisplayOnly?,
exitCode?, ref? }`: `text` prints as a transcript line led by the plugin's name (`first-mod: ...`),
`{}` prints nothing, `context` is what Claude reads after the output, and `exitCode` (0 to 255) is
what a headless run whose whole prompt was this command exits with. A command a mod registers
(`$.command.register`) runs only through this event (`api.md`).

### 10.18.2 Settings hook events

Each settings hook event (§7), such as `Stop`, `SessionEnd` or `PostToolUse`, is also an event named
`classic.<Event>`: `classic.ConfigChange`, `classic.CwdChanged`, `classic.DirectoryAdded`,
`classic.Elicitation`, `classic.ElicitationResult`, `classic.FileChanged`,
`classic.InstructionsLoaded`, `classic.MessageDisplay`, `classic.Notification`,
`classic.PermissionDenied`, `classic.PermissionRequest`, `classic.PostCompact`,
`classic.PostModelSwitch`, `classic.PostToolBatch`, `classic.PostToolUse`,
`classic.PostToolUseFailure`, `classic.PreCompact`, `classic.PreModelSwitch`, `classic.PreToolUse`,
`classic.SessionEnd`, `classic.SessionStart`, `classic.Setup`, `classic.Stop`, `classic.StopFailure`,
`classic.SubagentStart`, `classic.SubagentStop`, `classic.TaskCompleted`, `classic.TaskCreated`,
`classic.TeammateIdle`, `classic.UserPromptExpansion`, `classic.UserPromptSubmit`,
`classic.WorktreeCreate` and `classic.WorktreeRemove` (declarations, `ClassicHookEvent`). `e` is the
JSON a settings hook of that event receives on stdin, `transcript_path` included, and the result is
that event's settings hook output. A hook returning `next(e)` lets the settings hooks of the event
run as without the mod. Where the built-in guard loads, a hook on these events in a mod the user
installed does not run (§14). <!-- req: mods.reference.Settings hook events | mods.events.Handle the settings hook events -->

### 10.18.3 `settings.read`

`settings.read` fires on two reads (from v2.1.304 on the client's own read, and for `e.layers`):

- **A mod's read**: a mod calls `$.settings.read({ key?, source? })`.
- **The client's own read**: when it merges the session's settings, after the session's mods have
  loaded, and again when settings or loaded plugins change.

Where the built-in guard loads it MAY skip this hook in a mod the user installed or loaded with
`--plugin-dir`; the debug log then has `settings.read bypassed by cc-plugin-sec-default` (§14).

1. **What it receives.** `e.layers` holds one `{ source, settings }` for each source in use that
   holds settings, lowest precedence first: `plugin` (what enabled plugins supply; a layer name, not
   a source a mod may ask for), `user`, `project`, `local`, `flag` (`--settings`), `policy` (managed);
   empty in `claude plugin test`. `e.source` is the one source a mod asked for, as
   `$.settings.read({ source: 'policy' })`, and `e.layers` then holds that layer alone; it is absent
   on the client's own read and on any read of the merged settings. <!-- req: mods.events.What a settings.read hook receives | mods.reference.e.layers and e.source on settings.read -->
2. **Telling the reads apart.** `next.origin` is `{ plugin: 'engine', tier: 'core' }` on the
   client's own read; on a mod's read `plugin` is the calling mod's name. <!-- req: mods.events.Tell Claude Code's own read from a mod's read -->
3. **What `next(e)` gives.** `{ value }`, the merged settings or the one source's, or the `value` of a
   hook later in the order that answered; or `{ deny }`, when a later hook refused the read, which a
   hook SHOULD return unchanged. <!-- req: mods.events.What next(e) gives a settings.read hook -->
4. **What it can return.** <!-- req: mods.events.What a settings.read hook can return -->

   | Return | On the client's own read | On a mod's read |
   | --- | --- | --- |
   | `next(e)`'s result | the read as it is | the read as it is |
   | `{ value }` | each key changed replaces that key's whole value in the merged settings, if it fits the key's schema; a key left out is unset, so the value is built from `next(e)`'s | the call resolves to `value`, or to the `key` it asked for taken from `value`, so a hook returns a whole object, never an array |
   | `{ deny: reason }` | the session keeps the settings as merged before any hook answered, and the debug log records `reason` | the call rejects with `<calling mod>: $.settings.read: <reason>` |

5. **A value that does not fit.** On the client's own read, a key whose answered value is outside its
   schema keeps the value merged before any hook answered, and the debug log says `the answer for
   <key> is no value the key can hold`. A key the client reads from each source separately, such as
   `env`, is not changed by an answer.
6. **Changing one key.** A hook spreads `next(e)`'s `value` and sets the key, passing through a read
   of one source and a `{ deny }`: <!-- req: mods.events.Change one setting from a settings.read hook -->

   ```javascript
   on('settings.read', async ($, e, next) => {
     const read = await next(e)
     if (e.source || !read.value) return read
     return { value: { ...read.value, spinnerTipsEnabled: false } }
   })
   ```

## 10.19 Turns, sessions, subagents, the interface, other mods and telemetry

### 10.19.1 Turns

A turn is everything Claude does in answer to one prompt.

| Event | Fires when | Fields | A hook can |
| --- | --- | --- | --- |
| `turn.start` | a turn begins | `turnId`, which names the turn in the other two; `text`; `agentId` | observe: `next(e)` <!-- req: mods.event.turn.start | mods.events.Follow a turn.turn.start --> |
| `turn.step` | one request is about to go to the model; a turn with tool calls has several | `turnId`, `index`, `model`, `effort`, `messageCount`; `agentId` for a subagent's request | stream it (`yield* next(e)`), send it to another model (`next({ ...e, model })`) or effort (`next({ ...e, effort })`), or answer without calling the model <!-- req: mods.event.turn.step | mods.events.Follow a turn.turn.step --> |
| `turn.complete` | the turn ended, one the user interrupted included | `turnId`, `answer` (Claude's final text), `durationMs`, `usage` (the turn's token totals), `isAborted`, `reason` (`answer`, `aborted`, `refusal`, `error`), `refusal`, `agentId` | observe, or return `{ text }` to show a line under the answer <!-- req: mods.event.turn.complete | mods.events.Follow a turn.turn.complete --> |

1. `turn.step`'s result is `{ turnId, index, answer, toolUses, stopReason, usage, serverToolUses? }`.
   `usage` holds the token counts the Claude API reported (`input_tokens`, `output_tokens`,
   `cache_read_input_tokens`, `cache_creation_input_tokens`) and the `model` that answered.
   `serverToolUses`, from v2.1.290, lists the tool calls the API ran itself during the request, such
   as the advisor tool; it is absent when there were none, and no `tool.call` or `tool.check` fires
   for them.
2. `turn.step` and `turn.complete` fire for subagents too, with `e.agentId` set.
3. **Another model.** `yield* next({ ...e, model: 'haiku' })` sends the request to another model. The
   client MUST resolve an alias such as `haiku` to a full model id, as Claude Code does from v2.1.309;
   before it, an alias went out as written and failed. <!-- req: mods.events.Send a request to a different model -->

### 10.19.2 Sessions

| Event | Fires when | Fields | A hook can return |
| --- | --- | --- | --- |
| `session.start` | once for each loaded mod, before the first prompt, and again after a reload of that mod; not after `/clear`, `/resume` or `/branch` | `cwd`, `isInteractive`, `surface` | `next(e)` <!-- req: mods.event.session.start --> |
| `session.end` | the session ends, or `/clear`, `/resume` or `/branch` runs | `reason` (`clear`, `resume`, `logout`, `prompt_input_exit`, `other`; `/branch` reports `resume`), `sessionId`, `resume` (what `claude --resume` takes to return) | `next(e)`. The hooks share the bound of §10.11. <!-- req: mods.event.session.end --> |
| `session.compact` | the conversation is about to be compacted | `trigger` (`auto`, `manual`, `plugin`, `precompute`), `messages`, `instructions`, `agentId` | `{ skip: reason }` to skip it; `next(e)`'s result is `{ messages, tokensBefore?, tokensAfter?, usage? }` <!-- req: mods.event.session.compact --> |
| `session.receive` | a message arrives from another agent or session | `text`, `origin`, `event`, `agentId` | `next({ ...e, text })`, or `{ consumed: reason }`: the delivery is not queued, not written to the transcript and never reaches Claude <!-- req: mods.event.session.receive --> |
| `session.send` | a message is about to go to another agent or session | `text`, `to`, `origin`, `agentId` | `{ isDelivered: false, reason }` <!-- req: mods.event.session.send --> |
| `session.append` | once for each row the conversation keeps (a prompt, a response block, a tool result, a notice) before it is stored | `uuid`, `door`, `message`, `origin`, `agentId` | `next({ ...e, message })` with a changed `message.content`, rewriting the row's text blocks or a `tool_result` block's `content`; other changes are ignored (Judgment J10.17) <!-- req: mods.event.session.append --> |
| `session.attach`, `session.detach` | another app connects to or disconnects from the session | `clientId`, `surface`; `viewport` on attach, `reason` (`detach`, `end`) on detach | `next(e)` <!-- req: mods.event.session.attach | mods.event.session.detach --> |
| `session.measure` | after each turn, and when a plan limit's percent used changes | `changed` (`context`, `cost`, `rateLimits`), `context`, `cost`, `rateLimits` | `next(e)` <!-- req: mods.event.session.measure --> |

`session.send` and `session.receive` are specified with `$.session.send` in `api.md`.

### 10.19.3 Subagents

| Event | Fires when | A hook can return |
| --- | --- | --- |
| `agent.offer` | a subagent type is offered to Claude; `e.agent`, `e.description`, `e.source`, `e.provider` | `{ isOffered: false }` to withhold it <!-- req: mods.event.agent.offer --> |
| `agent.spawn` | a subagent or an agent-team teammate is about to start, or a subagent that finished or stopped is about to run again | `next({ ...e, model })` to choose the model of one starting, or `{ deny: reason }` <!-- req: mods.event.agent.spawn --> |

1. `agent.spawn`'s fields are `subagentType`, `prompt`, `description`, `model`, `parentModel`,
   `name`, `cwd`, `background`, `fork`, `permissionMode`, `parentAgentId`, `tool_use_id`,
   `workflow`, `provider`, `isTeammate` (`true` for a teammate) and `resume`. Its result is `{ model,
   agentId?, teammateId? }`, or `{ deny }`, which nothing starts after; a `deny` returned after a
   `next(e)` was answered fails the hook.
2. For a resumed run (from v2.1.299), as when Claude sends the subagent a message with `SendMessage`,
   `e.resume` is `{ agentId }`. A hook that counts subagents SHOULD skip events with `e.resume` set.
   `{ deny: reason }` refuses the resumed run: it does not start, the subagent stays as it was, and
   when a `SendMessage` call asked for it Claude reads `a plugin declined the resume: ` followed by
   the reason as that call's result. A changed event passed to `next` for a resumed run, such as
   another `model`, is ignored by the client's behaviour.

### 10.19.4 The interface

| Event | Fires when |
| --- | --- |
| `ui.render` | a render site (§10.9) is about to be drawn; answered with a tree (§10.21) <!-- req: mods.event.ui.render --> |
| `ui.resolve` | mods load, once for each app, render site and mod; the result is the element table `$.ui.resolve(e)` reads <!-- req: mods.event.ui.resolve --> |
| `ui.press` | a `Button` a mod drew is pressed, or a link of a `Markdown`; `e.element`, `e.plugin`, `e.requestId`, `e.link` <!-- req: mods.event.ui.press --> |
| `ui.input` | an `Input` a mod drew changes or is submitted; `e.kind` `change` or `submit`, `e.value` <!-- req: mods.event.ui.input --> |
| `ui.select` | a `Select` a mod drew is used; `e.value` <!-- req: mods.event.ui.select --> |
| `ui.focus` | the focused control of a pane or the band is about to change; `e.origin` `person` or a plugin; `{ deny }` keeps it <!-- req: mods.event.ui.focus --> |
| `ui.scroll` | the scroll position of a pane or the band is about to change; `e.by`, `e.offset`, `e.bodyRows`, `e.contentRows`, `e.pointer`; `{ deny }` keeps it <!-- req: mods.event.ui.scroll --> |
| `ui.close` | a pane is about to close; `e.id` is the pane and `e.origin.kind` is `plugin`, `person` or `unload` <!-- req: mods.event.ui.close --> |
| `ui.message` | a `Client` element posts data to its mod; `e.module`, `e.element`, `e.data`; `{ props }` answers it <!-- req: mods.event.ui.message --> |
| `ui.fault` | a `Client` element the mod drew failed to load, draw or run; `e.phase` is `load`, `render` or `run`, `e.reason` the error message (from v2.1.289) <!-- req: mods.event.ui.fault --> |

Each also carries `component`, `surface` and `requestId` where it concerns a site. Their behaviour
is §10.20–§10.27.

### 10.19.5 Other mods

| Event | Fires when | A hook can return |
| --- | --- | --- |
| `plugin.register` | a hooks module is about to load; `e.name`, `e.root`, `e.version`, `e.tier`, `e.provenance`, and `e.uses`: `{ events, calls, env?, state? }`, as `claude plugin validate` lists them, each call written without `$.` (`fs.read`) | `{ refuse: reason }`: the module does not load, and the debug log names the refusing plugin and the reason; `{ allow: true }` lets it load <!-- req: mods.event.plugin.register --> |
| `engine.create` | the mods API is being built for a mod; `e.plugins` | a changed `$`: `next(e)` resolves to `$` as built so far, and a returned namespace it lacks is added; a mod outside the `user` tier MAY also withhold a namespace, which is then a stub <!-- req: mods.event.engine.create --> |

When another mod's hook calls a method of a namespace a mod added in `engine.create`, that method's
`$` calls run in the calling hook's context until every hook on that event returns: a relative path
resolves against that hook's working directory, and `$.prompt.submit` rejects while the turn waits
on that hook. Calls the method makes afterwards run in its own mod's context. An `engine.create`
hook has no time limit; its failure is a failure to load. Policy mods are §14's.

### 10.19.6 Telemetry

| Event | Fires when | A hook can return |
| --- | --- | --- |
| `telemetry.log` | a telemetry record is about to be logged; `e.event`, `e.to` (`collector` or `anthropic`), `e.props`, `e.attributes`, `e.span`, `e.loggedAt` | `next(e)` or `{ deny: reason }` <!-- req: mods.event.telemetry.log --> |
| `telemetry.mark` | one use of a feature is marked; `e.feature`, `e.kind` (`ok`, `bad`, `sad`), `e.props`, `e.reason` | `next(e)` or `{ deny: reason }` <!-- req: mods.event.telemetry.mark --> |

A telemetry hook in a mod the user installs MUST carry the filter `{ to: 'collector' }` (§10.4.2),
as `on('telemetry.log', { to: 'collector' }, hook)`; a module without it fails validation and does
not load (§10.4.2). `*` and negations do not select these events (§10.13.3). <!-- req: mods.event.telemetry.log -->

The client applies the same rule to every mod outside the `builtin` tier, the `prepend` and
`append` mods included (Judgment J10.19).

A `telemetry.mark` event carries no `to`: a mark is always on the `anthropic` stream. A
`{ to: 'collector' }` filter therefore never matches it, so a mark hook of a mod outside the
`builtin` tier loads, passes validation and never runs; only `builtin` mods see marks. The client
MUST NOT add a `to` to the mark to let such a hook through (Judgment J10.20).

### 10.19.7 Mods API calls

Every mods API method (§10.7.1) other than `$.plugin.name` and `$.plugin.root` is also an event,
named by its namespace and method: `fs.read`, `model.complete`, `ui.open`. `e` is the call's
argument as it crosses to the client (`{ name }` for `env.get`, `{ tool, input }` for `tool.check`).
A hook on one intercepts the calls of the mods that run after it, and its own mod's calls from other
hooks; the calling hook alone is skipped (§10.6.1), and `next.origin` names the caller. It MAY
return `next(e)`, `{ deny: reason }` (the call rejects with `<calling mod>: $.<namespace>.<method>:
<reason>`) or `{ value }` (the call resolves to it). Where the method shares its name with an event
the client fires itself (`tool.call`, `tool.check`, `command.run`, `prompt.submit`, `prompt.fill`,
`prompt.suggest`, `session.send`, `agent.spawn`, `config.set`, `session.compact` and the others of
§10.16–§10.19), the call takes that event's result instead (Judgment J10.18). A guard on a call that
fails is skipped and the call goes on. <!-- req: mods.reference.Mods API calls -->

## Design decisions

### Why a failed hook is skipped rather than refusing

A session must outlive any mod's bug, so a hook that fails is treated as absent, the same answer an
uninstalled mod would give. A mod that guards something decides otherwise for itself with a `.catch`
handler, which costs one line and keeps the choice where the guard's author can see it.

### Why the chain has fixed tiers

A tier is a statement of authority: what the organisation prepends sees every event before the
user's mods and cannot be skipped by them, and what it appends runs after them. Ordering by tier
first and by install order only inside a tier means no user action reorders a guard.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J10.12 | A matcher is tested against the event as it reaches the hook, after earlier hooks rewrote it; a field the event lacks matches nothing; a regular expression is tested unanchored, its `g` and `y` flags ignored. | events.md says the matcher's fields "are compared with the event's" and the chain passes changed copies; it is silent on when and on the edges. The declarations' `Matcher` give the four kinds. Lead: the reference implementation's rows for `src/mods/chain/matcher.ts`. |
| J10.13 | Namespace globs (`ui.*`) and negations (`!tool.describe`) are patterns; `telemetry.*` selects the telemetry events. | The declarations' `Pattern`, `Glob` and `Negation`; events.md names `*` and `classic.*` only. Oracle 2.1.325 validates `on('ui.*')`, `on('!tool.describe')` and `on('telemetry.*', { to: 'collector' })`. |
| J10.14 | A hook that called `next` and failed before the call resolved keeps that call's result, the latest of several. | events.md gives "failed after `next` resolved" only; the declarations' `Caught` say the handler runs "once that call settled" and replays "the hook's last call". |
| J10.15 | Decisions order allow, ask, deny for "tighten" and "loosen"; with `e.ceiling` `ask`, a hook's `allow` becomes `ask` in every mode. | events.md says a hook "can tighten ... but can't loosen it" in plan mode; the declarations' `ToolCheckResult.ceiling` name the ceiling as "the most permissive verdict". Neither orders `ask` against `deny`. |
| J10.16 | `prompt.change` is an event a client fires, answered `{ text }`. | In the declarations (`PromptChangeInput`, origins `history`, `clear`, `undo`, `plugin`, `app`, `engine`); not in reference.md. Declarations win (E2). |
| J10.17 | On `session.append`, only `message.content` of the changed event reaches the client; other changes are ignored without failing. | reference.md names `message.content` only. Lead: the reference implementation's rows for `src/mods/events/session.ts`. |
| J10.18 | A `$` call whose method shares its name with an event the client fires resolves to that event's result; every other call resolves to `{ value }` and rejects on `{ deny }` as `<calling mod>: $.<namespace>.<method>: <reason>`. | reference.md says a hook "can return `next(e)`, `{ deny: reason }`, or `{ value }`" and events.md quotes the `settings.read` rejection in that form; the declarations type `$.tool.call`, `$.command.run` and the others by their event's result. Lead: the reference implementation's rows for `src/mods/api/call.ts`. |
| J10.19 | The `{ to: 'collector' }` filter is required of a telemetry hook in every mod outside the `builtin` tier (`prepend`, `user`, `append`), and any matcher whose `to` lets `collector` through counts as giving it (§10.19.6). | reference.md, "Telemetry", says only "In a mod you install" and that such a mod "fails `claude plugin validate`" without the filter; it names no tier. A `prepend` or `append` mod is installed too, by the organisation, and the validator cannot tell a mod's tier from its files, so one rule covers every mod the client does not build in. Lead: the reference implementation's row for `src/mods/chain/validate.ts`, which decides the same. |
| J10.20 | A `telemetry.mark` event has no `to`, so no hook filtered `{ to: 'collector' }` runs on it; a mod outside the `builtin` tier may register such a hook, which never runs (§10.19.6). | The 2.1.321 declarations (`claude-code/index.d.ts`, `TelemetryMarkInput` and `$.telemetry.mark`) say a mark "takes no `to` and always means `anthropic`" and that the built-in plugins hooking it "serve built-ins and the engine alone"; reference.md requires the filter of every telemetry hook in a mod you install. Read together (E2), an installed mod cannot see marks, which keeps first-party feature marks to built-in mods. The reference implementation leaves this open (its D6) and fires the mark with `to: 'collector'` so the filter passes; this specification does not, because that adds a field the declarations rule out. |
