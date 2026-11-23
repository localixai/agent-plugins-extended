# 10. Mods: the mods API

The mods API is what a mod calls to act. Every hook receives it as its first argument, `$`, its
methods grouped in namespaces (`$.ui`, `$.fs`, ...). Every call is itself an event named for its
namespace and method without the `$.` (`fs.read` for `$.fs.read`): a mod earlier in the chain MAY
observe, rewrite or refuse it (`events.md`), which is how an organisation restricts what mods
reach. This part states the methods and how a client shapes and answers each request; the numeric
limits are in `reference.md`, "Limits"; drawing is in `interface.md`.

Evidence: `plugins/mods/api.md` unless a section names another page. Shapes follow the declarations
Claude Code 2.1.330 writes beside a mod (`claude-code/index.d.ts`, interface `CoreEngineInterface`
and the `*Args`/`*Result` types named below), which win over the prose (E2).

## 10.30 Commands and tools

A mod registers its commands and tools in a `session.start` hook. The client MUST wait for every
`session.start` hook before the first prompt, so what they register is available from the first
turn.

### 10.30.1 Commands

1. `$.command.register({ name, description, argumentHint?, immediate? })` adds `/<name>` to the
   command list with `description`; `argumentHint` shows in the prompt after the command and a
   space (`/standup [days]`). It resolves `{ command }`.
2. The mod answers the command in a `command.run` hook, usually matched `{ command: '<name>' }`.
   `e.args` is the text after the name, or `''`. A hook that returns `{ text }` prints the text in
   the transcript after the plugin's name and the model reads it; `{}` prints nothing. A command
   that has no behaviour but the mod's need not call `next`.
3. A command typed during a turn waits for the turn to end, unless it was registered with
   `immediate: true`.
4. A name a built-in command holds MUST be refused: the call throws, as in `"/focus" refused: it is
   the built-in /focus`. A name another mod holds is refused likewise (`"/x" refused: it is already
   registered by <mod>`, Judgment J10.140). A throw skips the rest of the hook like any other.

#### Hiding command text from Claude

From 2.1.326, a `command.run` hook that answers without calling `next` and returns `{ text,
isTextDisplayOnly: true }`, for a command registered without `immediate`, MUST print `text` in the
transcript and MUST NOT give it to the model. Otherwise, or on an earlier release, the model can
read the text. <!-- req: mods.apiGuide.Hide command text from Claude -->

### 10.30.2 Tools

1. `$.tool.register({ name, description, inputSchema?, isDeferred? })` gives the model a tool
   named `mcp__<plugin>__<name>`; `inputSchema` is the JSON Schema of its input. It resolves
   `{ tool }`, the full name.
2. The mod answers calls in a `tool.call` hook matched to the full name. The tool's arguments are
   fields of `e` (`e.id`). The hook returns `{ result }`, which the model reads as the tool's
   result.
3. When MCP tool search defers the tool the model sees its name and not its description until it
   searches. `isDeferred: false` (Claude Code 2.1.293 or later; earlier releases ignore it) loads
   the full tool upfront. <!-- req: mods.apiGuide.Add a tool -->

## 10.31 Calling a model

| In the request | `$.model.complete` | `$.model.fork` |
| --- | --- | --- |
| Model | the `model` passed (an alias such as `haiku`, or an id resolved like `--model`) | the session's |
| System prompt | an attribution block, then `system` when passed | the session's |
| Messages | one user message, `prompt` | the conversation so far, then `prompt` as a user message |
| CLAUDE.md and project context | not included | included, as in the conversation's last request |
| Tools | none | Claude's tools, every call denied |

Both bill to the session's credentials. A fork repeats the main thread's last request, so the
prompt cache serves most of it.

### 10.31.1 `$.model.complete`

1. `$.model.complete({ model, prompt, system?, maxTokens?, effort?, timeoutMs? }, { signal? })`.
   `maxTokens` defaults as `reference.md` says.
2. A Claude API failure MUST NOT reject the call. It resolves `{ isAnswered: true, text, usage }`
   when the model answered, else `{ isAnswered: false, reason, usage }` with `reason` `api-error`
   (with `status` and `error`), `empty-reply` or `aborted`. `text` exists only when `isAnswered`.
3. The call rejects for a request the client will not send: a model the organisation blocks, a bad
   cap, a request of the wrong shape. <!-- req: mods.apiGuide.Send one prompt -->

### 10.31.2 Prompt caching

1. `prompt` and `system` each MAY be an array of `{ text, cache? }` blocks instead of a string
   (2.1.292 or later; earlier releases reject an array `prompt` with an error ending `takes {
   model, prompt } (host check)` and leave an array `system` out). The client sends a block with
   `cache: true` with the API's `cache_control`, a cache breakpoint at its end.
2. The TTL comes from the user's settings (`subagentPromptCacheTtl`), five minutes by default. The
   API takes up to four breakpoints; a fifth comes back as an `api-error` in `reason`.
3. When a `DISABLE_PROMPT_CACHING` variable applies to the model, the client removes the
   breakpoints and sends the text uncached.
4. `usage` carries the API's `cache_creation_input_tokens` and `cache_read_input_tokens`. <!-- req: mods.apiGuide.Use prompt caching -->

### 10.31.3 Choosing between `prompt` and `system`

`system` precedes `prompt` in the cached prefix, so a breakpoint in `prompt` covers `system` and a
different `system` misses. The attribution block that opens the system prompt carries a fingerprint
of the start of the user message; `api.anthropic.com` strips it before caching, other endpoints
(Amazon Bedrock, Claude Platform on AWS, Google Cloud's Agent Platform, Microsoft Foundry, an LLM
gateway) do not. A mod whose requests may go through such an endpoint, or that other people run,
SHOULD put its shared static content at the start of `prompt`. <!-- req: mods.apiGuide.Choose between prompt and system -->

### 10.31.4 What a `model.complete` hook receives

A call to `$.model.complete` raises `model.complete`. Its event:

- `e.prompt` is always a string: given an array, the blocks' text concatenated in order. <!-- req: mods.apiGuide.What a model.complete hook receives.e.prompt -->
- `e.system` is a string built the same way, absent when the caller passed none. <!-- req: mods.apiGuide.What a model.complete hook receives.e.system -->
- `e.promptBlocks` and `e.systemBlocks` are the caller's arrays, each present only when the caller
  passed an array for that field. <!-- req: mods.apiGuide.What a model.complete hook receives.e.promptBlocks and e.systemBlocks -->

The client sends the strings a hook passes to `next`. It keeps the leading blocks whose text still
matches the start of the string, with their breakpoints, and sends the rest of the string as one
block with no breakpoint: appending to `prompt` keeps the caller's breakpoints, changing its start
removes them (Judgment J10.141).

## 10.32 Background work

1. A hook runs for one event under the time limit of `reference.md`. Time waiting on `next` or on a
   mods API call does not count, except `$.clock.sleep`.
2. `$.clock.after(ms, fn)` and `$.clock.every(ms, fn)` replace `setTimeout` and `setInterval`, the
   delay first; each returns a timer with `cancel()`. `await $.clock.now()` is the time in
   milliseconds. A timer's callback runs outside any event, between turns, and starts no turn. A
   callback that throws is written to the debug log and an `every` timer runs again at the next
   interval.
3. **Stopping.** A mod's timers stop when its module reloads. `next.signal` is an `AbortSignal`
   that aborts when the event a hook handles is abandoned, as when the user interrupts; a hook
   SHOULD pass it to long-running work. <!-- req: mods.apiGuide.Stop background work -->

### 10.32.1 Showing something without starting a turn

| Call | What the user sees |
| --- | --- |
| `$.ui.status(text)` | One line under the prompt, `⚠ <mod>: <text>`, until the mod's next call replaces it; `undefined` removes it. One per mod. <!-- req: mods.apiGuide.Show something without starting a turn.$.ui.status(text) --> |
| `$.ui.toast(text, { timeoutMs? })` | A toast with the mod's name for 4 seconds by default (`timeoutMs` a whole number from 1 to 60000; another value drops the call with `<mod>: $.ui.toast dropped: timeoutMs is a whole number of ms, 1 to 60000`). A box at the top right in fullscreen rendering, one line at the right under the prompt in the classic renderer. <!-- req: mods.apiGuide.Show something without starting a turn.$.ui.toast(text) --> |
| `$.ui.log(text, { to? })` | A dim line in the transcript, `● <mod>: <text>`, that the model does not read; with `{ to: 'debug' }` the debug log alone. <!-- req: mods.apiGuide.Show something without starting a turn.$.ui.log(text) --> |
| `$.ui.notify(text, { title? })` | A notification from the user's terminal sent through their `preferredNotifChannel`, titled with the mod's name unless a non-empty `title` is given, shown as given. <!-- req: mods.apiGuide.Show something without starting a turn.$.ui.notify(text) --> |

In the VS Code extension status lines and toasts show above the prompt box and log lines in the
conversation (`interface.md`, §10.25.4).

`$.ui.notify` alone answers. It resolves `{ isSent: true, channel }` when the channel wrote the
notification (`channel` the setting's value, such as `kitty` or `terminal_bell`; `terminal_bell`
rings and shows no text). Otherwise `{ isSent: false, reason }`:

| `reason` | When |
| --- | --- |
| `disabled` | `preferredNotifChannel` is `notifications_disabled`. <!-- req: mods.apiGuide.Show something without starting a turn.disabled --> |
| `no-channel` | The setting is `auto` and the terminal has no notification the client can send. <!-- req: mods.apiGuide.Show something without starting a turn.no-channel --> |
| `no-surface` | The session has no terminal (a `-p` run, the Agent SDK, the Desktop app, the VS Code extension, a cloud session), the call came before the session started while the mod loaded, or the client is exiting. <!-- req: mods.apiGuide.Show something without starting a turn.no-surface --> |
| `refused` | Another mod's `ui.notify` hook answered in the client's place without sending. <!-- req: mods.apiGuide.Show something without starting a turn.refused --> |

The call rejects when `text` is not a string, when a `ui.notify` hook returns `{ deny }`, or when
writing to the terminal fails. A mod cannot choose the channel and the client does not rate-limit
notifications. When the call reaches a running session the user's `Notification` hooks run with
the type `plugin_notification`, also for `disabled` and `no-surface`, but not for a call before
the session starts or while exiting; the hook the call came from is left out of that run.

## 10.33 Starting a turn

`$.prompt.submit({ text, asUser?, attachments? })` raises `prompt.submit` through every hook but
the calling one, waits until the session is idle, and starts a new turn; it resolves when that turn
starts, so a hook running during a turn SHOULD NOT await it. The model reads `text` after a sentence
that names the mod as the sender; `asUser: true` sends it as the user's own words without that
sentence. <!-- req: mods.apiGuide.Start a turn from a background job -->

### 10.33.1 After the user interrupts a turn

When the user stops a running turn (Esc, **Stop**, the Agent SDK's `interrupt()`), the client MUST
refuse the calls that start new work in the session until the user's next input, with the reason
`the session was stopped and nobody has sent input since`. Apart from `$.prompt.submit` and
`$.command.run`, this handling requires 2.1.304 or later (Judgment J10.142). Nothing queues or
repeats a refused call.

A refused call returns, `<reason>` being the reason:

| Call | Result |
| --- | --- |
| `$.prompt.submit` | Resolves `{ drop: '<reason>' }` and queues no prompt. <!-- req: mods.apiGuide.What refused calls return.$.prompt.submit --> |
| `$.command.run` | Rejects with an error whose message ends with `<reason>`. <!-- req: mods.apiGuide.What refused calls return.$.command.run --> |
| `$.agent.spawn` | Resolves `{ deny: '<reason>' }` and starts no subagent. <!-- req: mods.apiGuide.What refused calls return.$.agent.spawn --> |
| `$.session.send` | To a subagent that finished: `{ isDelivered: false, reason: 'Agent "<id>" was not resumed: <reason>.' }`; a subagent still running receives the message. To an agent-team teammate: `{ isDelivered: false, reason: 'Teammate "<name>" was not messaged: <reason>.' }`. <!-- req: mods.apiGuide.What refused calls return.$.session.send --> |
| `$.tool.call` | Of Bash with `run_in_background: true`, Monitor or CronCreate: `{ deny: '<tool> was not run: it starts background work, a schedule or a goal, and <reason>' }`. Other tools run. <!-- req: mods.apiGuide.What refused calls return.$.tool.call --> |

In an interactive session a refused `$.session.send` or `$.tool.call` raises the toast `stopped ·
type a message to continue` (§10.43.2; before 2.1.330 `Stopped: type a message to continue; a mod
cannot resume work after Stop`).

Work the mod started before the interruption, until the user's next input:

| Work | What happens |
| --- | --- |
| A prompt from `$.prompt.submit` still queued | Dropped; the call resolves `{ drop: 'the prompt was removed from the queue before it ran' }`. <!-- req: mods.apiGuide.Work your mod started before the interruption.$.prompt.submit --> |
| A command from `$.command.run` still queued | Dropped; the call rejects with a message that includes `the command was removed from the queue before it ran`. <!-- req: mods.apiGuide.Work your mod started before the interruption.$.command.run --> |
| A one-time scheduled job (CronCreate) that comes due | Starts no turn then, runs after that input. |
| A recurring scheduled job that comes due | Starts no turn; loses that run, keeps its schedule. |
| An event from a monitor the mod started | The monitor keeps running, and the client drops the events it raises meanwhile (2.1.330; before, the notice that it ended was kept and arrived after that input). <!-- req: mods.apiGuide.Work your mod started before the interruption.An event from a monitor your mod started --> |
| A spawned subagent resumed with `$.session.send` that finishes | Its finish notice waits and reaches the conversation after that input. <!-- req: mods.apiGuide.Work your mod started before the interruption.$.session.send --> |
| A foreground Bash or PowerShell command from `$.tool.call` already running that reaches its timeout | Stopped at the timeout instead of moving to the background; resolves with `isError` set and the output line `Ended instead of moving to the background: plugins' input is held, by a Stop or by the host's limits.` <!-- req: mods.apiGuide.Work your mod started before the interruption.$.tool.call --> |

### 10.33.2 Retrying

A mod that wants a refused or dropped call made SHOULD keep its arguments when the result or error
contains `the session was stopped and nobody has sent input since` or `was removed from the queue
before it ran`, and make it again from a `turn.complete` hook. `turn.complete` can fire before the
user's next input (for the interrupted turn, for a subagent's turn) and the retry is then refused
again, so the mod keeps the arguments until a call is accepted. A function that takes `$` MUST be
declared outside `register`: validation refuses `$` passed to a function declared inside it. <!-- req: mods.apiGuide.Retry a refused or dropped call -->

### 10.33.3 Refusals in `claude -p` runs and Agent SDK sessions

In a `claude -p` run or an Agent SDK session a call that starts work is refused with the results of
§10.33.1 and one of these reasons:

- `the run reached its --max-turns limit`: turns from the mod's prompts and from subagents it
  spawned count toward `--max-turns` or the SDK's turn limit. A new prompt from the user or the SDK
  application resets the count.
- `the run is past its --max-budget-usd limit`: the run's total cost so far, which a new prompt
  does not reset.
- `the host has ended its input`: the SDK application ended its streaming input, or stdin closed
  under `--input-format stream-json`; the run is ending.
- `the session was stopped and nobody has sent input since`: the run was interrupted (§10.33.1). <!-- req: mods.apiGuide.Calls refused in claude -p runs and Agent SDK sessions -->

A mod that submits a prompt at the end of every turn keeps a `claude -p` run going until the user
stops it, unless `--max-turns` or `--max-budget-usd` is given; with either, the mod's next prompt
at the limit is refused and the run ends. The refusal at the limit applies from 2.1.299, subagent
turns count from 2.1.304. <!-- req: mods.apiGuide.A claude -p run with your mod never exits -->

## 10.34 Messages between sessions

`$.session.send({ to, text })` makes the same delivery the SendMessage tool makes, raising
`session.send` with `e.origin.kind` `plugin`. `to` is:

- `{ sessionId }` for another of the user's sessions; <!-- req: mods.apiGuide.Send and receive messages between sessions.Another of your sessions -->
- `{ agentId }` for a subagent or teammate, an id from `$.agent.list()`; <!-- req: mods.apiGuide.Send and receive messages between sessions.A subagent or teammate -->
- the string address a received message came from, to answer its sender. <!-- req: mods.apiGuide.Send and receive messages between sessions.The sender of a message you received -->

It resolves `{ isDelivered: true }` once the message is queued, else `{ isDelivered: false, reason
}`. `session.receive` fires for a message arriving, before the model reads it (`e.text`,
`e.origin.kind` such as `peer`, `peer-send-message`, `task-notification`, `scheduled-trigger`); a
hook returning `{ consumed: reason }` keeps it from the model. A session set to refuse inbound
messages refuses one before `session.receive` fires; a message held for approval reaches the hook
first. The hook's `next(e)` rejects when the message is not delivered. The sender's name is what
the sender wrote and a client MUST NOT treat it as verified.

## 10.35 Files, processes and the network

A mod reaches the system only through the mods API, with the permissions of the user running the
client. The hooks module MUST have no Node.js APIs, no timer globals and no network or file access
of its own; standard JavaScript and web APIs (`URL`, `TextEncoder`, `AbortController`,
`crypto.subtle`) are available. <!-- req: mods.apiGuide.Reach files, processes, and the network -->

| Namespace | Contract |
| --- | --- |
| `$.fs` | `read(path)`, `write(path, text)`, `exists(path)`, `stat(path)`, `list(path)` on files and directories; `read(path, { as: 'bytes' })` answers `{ base64 }`; `ancestors` finds named files above a path. <!-- req: mods.apiGuide.Reach files, processes, and the network.$.fs --> |
| `$.process` | `run(argv, { cwd?, env?, stdin?, timeoutMs? })` starts a command and resolves when it exits; `spawn({ argv, ... })` streams a long-running command's output. <!-- req: mods.apiGuide.Reach files, processes, and the network.$.process --> |
| `$.http` | `fetch(url, init)` over `http` or `https`, resolving `{ status, ok, headers, text }` once the body is read. <!-- req: mods.apiGuide.Reach files, processes, and the network.$.http --> |
| `$.store` | `get`, `set`, `delete`, `keys` on a JSON key-value store of the plugin's own, kept between sessions (`interface.md`, §10.28). <!-- req: mods.apiGuide.Reach files, processes, and the network.$.store --> |
| `$.env` | `get(name)` and `set(name, value)` environment variables; the name SHOULD be a string literal in the source, so the validator can list it: a computed name is not refused and is listed as `(computed)` (§10.4.3). <!-- req: mods.apiGuide.Reach files, processes, and the network.$.env --> |
| `$.settings` | `read()` the merged settings, or one source or key (§10.35.1). <!-- req: mods.apiGuide.Reach files, processes, and the network.$.settings --> |
| `$.session` | `messages()` the transcript as `{ role, text, toolUses }` entries; `cwd()`, `model()`, `id()` and the rest of §10.36; `usage()` context window use and plan limits. <!-- req: mods.apiGuide.Reach files, processes, and the network.$.session --> |
| `$.mcp` | `call(server, tool, args)` a tool on a connected MCP server. <!-- req: mods.apiGuide.Reach files, processes, and the network.$.mcp --> |
| `$.wasm` | `compile('./engine.wasm')` turns a file of up to 64 MiB, named by a string literal relative to the calling file, into a module to pass to `WebAssembly.instantiate` (2.1.326 or later; `reference.md` §10.4.1, §10.7.1). <!-- req: mods.apiGuide.Reach files, processes, and the network.$.wasm --> |

1. **Paths.** In `$.fs` and `$.process`, a relative path resolves against the working directory of
   the session, or of the subagent whose event the hook handles; a `$.wasm.compile` path is relative
   to the calling file. <!-- req: mods.apiGuide.Reach files, processes, and the network.Paths -->
2. **`$.fs.list`** returns one directory's entries as `{ name, kind, size, isLink }` and does not
   recurse. <!-- req: mods.apiGuide.Reach files, processes, and the network.$.fs.list -->
3. **`$.process.run`** takes an argument list and uses no shell. It resolves `{ exitCode, stdout,
   stderr }` (with `isStdoutTruncated`, `isStderrTruncated`) whatever the exit code. It rejects when
   the program cannot start or is still running at the timeout, 30 seconds by default and at most
   as `reference.md` says. <!-- req: mods.apiGuide.Reach files, processes, and the network.$.process.run -->
4. **`$.http.fetch`** follows up to five redirects. On a redirect to another origin it keeps only
   the `accept`, `accept-language`, `content-type` and `user-agent` request headers and drops the
   rest. A redirect to a URL that is not `http` or `https` rejects (Judgment J10.143). Its timeout
   and body sizes are in `reference.md`. <!-- req: mods.apiGuide.Reach files, processes, and the network.$.http.fetch -->
5. **`$.process.spawn` refused late.** A mod MAY refuse a `$.process.spawn` after the command
   produced output or exited; nothing the command did is undone, and the call rejects with a
   message that ends with the refusing mod's reason after `$.process.spawn started, and a plugin
   withheld its result:` (the refusing mod had not read the output to the end; the client stops the
   command if it still runs) or `$.process.spawn ran, and a plugin withheld its result:` (it had,
   so the command had exited).

### 10.35.1 Reading settings

`$.settings.read({ source?, key? })`:

| Call | Resolves to |
| --- | --- |
| `$.settings.read()` | The settings of every source in use merged by precedence, one object whose top-level keys are a `settings.json`'s. <!-- req: mods.apiGuide.Read all settings, one source, or one key.$.settings.read() --> |
| `$.settings.read({ source })` | That source's settings, `{}` when it holds none. <!-- req: mods.apiGuide.Read all settings, one source, or one key.$.settings.read({ source: 'policy' }) --> |
| `$.settings.read({ key })` | The key's value in the merged settings, `undefined` when unset. |
| `$.settings.read({ key, source })` | The key's value in that source, `undefined` when it does not set it. |

`key` is the exact name of one top-level key, never a dotted path (2.1.304 or later). `source` is
one of:

- `user`: `~/.claude/settings.json`; <!-- req: mods.apiGuide.Read all settings, one source, or one key.user -->
- `project`: `.claude/settings.json`; <!-- req: mods.apiGuide.Read all settings, one source, or one key.project -->
- `local`: `.claude/settings.local.json`; <!-- req: mods.apiGuide.Read all settings, one source, or one key.local -->
- `flag`: what `--settings` and the SDK's inline settings give; <!-- req: mods.apiGuide.Read all settings, one source, or one key.flag -->
- `policy`: the managed settings, as §14 combines them. <!-- req: mods.apiGuide.Read all settings, one source, or one key.policy -->

Another `source` rejects (Judgment J10.144).

## 10.36 Every method

The namespaces of `$` and their methods, as the 2.1.330 declarations define them. The prose above
states the methods the API page covers; the event each raises and the rules of the other methods
are in `reference.md` and `events.md`.

| Namespace | Methods |
| --- | --- |
| `$.plugin` | `name`, `root` (values) |
| `$.ui` | `notice`, `invalidate`, `blit`, `resolve`, `log`, `ask`, `toast`, `notify`, `cancelNotify`, `status`, `open`, `close`, `panes`, `place`, `scroll`, `focus`, `copy`, `selection`, `view` |
| `$.theme` | `set`, `clear` |
| `$.model` | `complete`, `fork`, `classify` |
| `$.audio` | `play`, `speak` |
| `$.mcp` | `call`, `connect` |
| `$.session` | `messages`, `cwd`, `root`, `model`, `turns`, `id`, `repo`, `surfaces`, `surface`, `usage`, `version`, `info`, `machine`, `compact`, `send`, `append`, `authorize`, `identity` |
| `$.turn` | `abort` |
| `$.prompt` | `submit`, `read`, `media`, `fill`, `paint`, `suggest`, `compose` |
| `$.tool` | `list`, `call`, `check`, `register` |
| `$.command` | `list`, `run`, `register` |
| `$.config` | `list`, `set` |
| `$.telemetry` | `log`, `mark` |
| `$.agent` | `spawn`, `call`, `list`, `limits`, `register` |
| `$.fs` | `read`, `write`, `list`, `exists`, `stat`, `ancestors` |
| `$.store` | `get`, `set`, `delete`, `keys` |
| `$.state` | `get`, `set` |
| `$.clock` | `now`, `sleep`, `after`, `every` |
| `$.http` | `fetch` |
| `$.process` | `run`, `spawn`, `hookEnv` |
| `$.wasm` | `compile` |
| `$.vcs` | `detect`, `diff`, `isolate`, `list`, `release`, `status` (experimental) |
| `$.settings` | `read` |
| `$.env` | `get`, `set` |

## Design decisions

### Why a call refused after Stop resolves and does not reject, except `$.command.run`

(This is the refusal of §10.33.1. A `{ deny }` another mod's hook returns on a `$` call follows
§10.19.7 instead.)

A call that starts work is usually made from a timer or a `turn.complete` hook that the mod does
not await carefully; a rejection there would skip the hook and hide the reason. Resolving with
`drop` or `deny` makes the refusal a value the mod can test and keep for a retry. `$.command.run`
rejects because its result has no field for a refusal, and the page keeps that shape.

### Why a model call does not reject on an API failure

An API error is an ordinary outcome of a network call, not a bug of the mod; resolving with
`isAnswered: false` keeps the hook running so it can fall back. A request the client refuses to
send is the mod's own mistake, and rejecting makes it visible.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J10.140 | A command name another mod holds is refused `"/<name>" refused: it is already registered by <mod>`; registering the same name again from the same mod replaces its entry. | api.md quotes only the built-in refusal. Lead: the reference implementation's `api/command.ts`, `registries.ts`. |
| J10.141 | A hook's changed string is matched against the caller's blocks from the start: each whole block that is still a prefix keeps its text and breakpoint, and the remainder is one block with no breakpoint. | api.md says the leading blocks that "still match the start of the string" are kept; it does not say whether a block that matches only in part keeps its breakpoint. Lead: the reference implementation's `api/model-blocks.ts`. |
| J10.142 | A client targets the latest release: the interruption handling of every call, the refusal at the turn limit, and subagent turns counting toward it apply whatever the release a host reports. | api.md gives a minimum release for each (2.1.299, 2.1.304) and describes no older behaviour beyond "earlier versions". |
| J10.143 | A redirect to a scheme other than `http` or `https` rejects `$.http.fetch: a redirect to <url> is not an http or https URL`; a 303 turns any method but `HEAD` into `GET`, a 301 or 302 turns `POST` into `GET`, 307 and 308 keep the method and body; the body is dropped when the method changes. | api.md describes `http` and `https` only and the header rule; the method rule is the fetch standard's. Lead: the reference implementation's `api/http-redirects.ts`. |
| J10.144 | `$.settings.read` with a `source` other than `user`, `project`, `local`, `flag` or `policy` rejects. | api.md lists the five and says nothing of another. |
