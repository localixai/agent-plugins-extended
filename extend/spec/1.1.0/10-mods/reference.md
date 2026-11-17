# 10. Mods: the reference

This part of §10 states the parts of a mod a client reads and the surface it hands a mod: the files,
the hooks module and the static analysis that reads it before it runs, `register` and `on`, the
three arguments of a hook and the members of `next`, the namespaces of the mods API and the state
helpers, the lifecycle of a loaded mod, the render sites and elements with their props, the limits,
and the settings, environment variables and commands that affect mods. How a hook handles an event,
the order mods run in and every event are in `events.md`; how a mod draws is in `interface.md`;
what each API method does is in `api.md`.

Evidence: `plugins/mods/reference.md` unless a section names another page; `create.md` for the
static analysis and for mods Claude writes. Shapes follow the declarations Claude Code 2.1.321
writes beside a mod (`claude-code/index.d.ts`), named by type, which win over the prose on the mods
surface (README.md).

## 10.3 The files of a mod

| File | Required | What the client reads from it |
| --- | --- | --- |
| `.claude-plugin/plugin.json` | yes | The manifest (§2). Mods add no required field. <!-- req: mods.file..claude-plugin/plugin.json --> |
| `hooks/hooks.json` | yes | `modules`, the hooks module's path (§10.3.1); settings hooks under `hooks` (§7). <!-- req: mods.file.hooks/hooks.json --> |
| The hooks module, such as `hooks/register.js` | yes | The mod's entry point, an ES module exporting `register(on, options)` (§10.4, §10.5). <!-- req: mods.file.hooks/register.js --> |
| `types/index.d.ts`, or the file the manifest's `types` names | when the mod uses `$.state` or adds a namespace to `$` | The mod's own contract: its `PluginState` values and the namespaces it adds (§10.3.2). <!-- req: mods.file.types/index.d.ts --> |
| files whose names end in `.test.ts` or `.test.tsx` | no | Tests `claude plugin test` runs; never loaded as part of the mod (`test.md`). <!-- req: mods.file..test.ts --> |

A manifest field `capabilities`, of any value, is not read: what a hooks module hooks and calls
on `$` is read from its source (§10.4). The plugin loads, and `claude plugin validate` MUST warn at
`capabilities`: `'capabilities' is no longer read: what a hooks module hooks and calls on $ is read
from its source and listed under its hooks.json below. Delete the field.` (oracle 2.1.321, corpus;
Judgment J10.21).

### 10.3.1 `modules`

1. `modules` MUST be an array holding exactly one string: the path of the hooks module, relative to
   `hooks/hooks.json`, as in `"modules": ["./register.js"]`. A `hooks.json` without `modules` holds
   no mod, and the plugin loads as an ordinary plugin. One with neither `modules` nor `hooks` is a
   validation error (§10.42.3 item 1).
2. A second entry is an error and the mod does not load. Claude Code 2.1.325's validator reads
   ``hooks.json `modules` names one hooks module per plugin; a second entry is refused`` (Judgment
   J10.2).
3. The path follows the plugin path rules of §2.5: it MUST NOT be absolute or climb out of the
   plugin root, and a symbolic link on it MUST NOT lead outside it.
4. The module's name, and the name of every file it imports, MUST end in `.js`, `.mjs`, `.cjs`,
   `.jsx`, `.ts`, `.mts`, `.cts` or `.tsx`. A file named otherwise is not loaded, and the mod with
   it (Claude Code 2.1.325: `<path> is not named like code and was not loaded: a hooks module and
   the files it imports end in .ts, .tsx, .jsx, .js, .mjs, .cjs, .mts or .cts`). Whatever its
   suffix, every file is an ES module (§10.4.1).

### 10.3.2 The types file

1. The client reads the mod's declaration file at the manifest's `types` path, else at
   `types/index.d.ts`. Reading the default path without a `types` field requires Claude Code
   v2.1.299; an Extended client MUST read it.
2. The file declares the mod's `$.state` values as members of `interface PluginState` inside
   `declare module 'claude-code'`, one entry under the plugin's name (§10.28.1), and each namespace
   the mod adds to `$` as a member of `interface EngineInterface`, exporting the namespace's types
   at its top level with names led by the namespace's PascalCase name, with no `import` or
   reference of its own (declarations, the header comment):

   ```typescript
   export type Topo = { layers: () => Promise<string[]> }
   declare module 'claude-code' {
     interface EngineInterface { topo: Topo }
     interface PluginState { 'my-mod': { count: number } }
   }
   ```

3. A module that reads or writes a `$.state` value its declarations do not name MUST NOT load
   (Claude Code 2.1.325: `<plugin>.<key> is not declared: the manifest's types contract must name it
   in interface PluginState { <plugin>: { <key>: ... } }`). A value of another plugin is listed and
   not checked (§10.4.3).
4. A mod that adds a namespace in `engine.create` MUST ship a types file declaring it. A client
   SHOULD NOT refuse such a mod for the file's absence (Judgment J10.3).
5. A plugin that lists another under `dependencies` (§16) is typed against that plugin's types file:
   the client writes it beside the mod's own declarations (§10.3.3).

### 10.3.3 The declarations the client writes

When an interactive session loads a mod from `--plugin-dir`, or a mod Claude wrote (§10.8.4), a
client SHOULD write, into the mod's `.claude-plugin/types/`, the declarations of its own build:
`claude-code/index.d.ts` (every event, every `$` namespace and method, the elements of each surface,
`claude-code/testing`), `claude-code-tools/index.d.ts` (the built-in tools' inputs and results),
`claude-code-mcp/index.d.ts` (the inputs of the MCP tools connected when the mod last reloaded), one
`<plugin>/index.d.ts` per plugin in the mod's `dependencies`, and a `tsconfig.json` fitting a hooks
module; and, when the mod has no `tsconfig.json`, one at the mod's root that extends it. The first
line of `claude-code/index.d.ts` names the version that wrote it (`// Written by Claude Code
2.1.321.`), and the file is written again, never edited, after an update (`create.md`, "Get type
definitions for your version").

### 10.3.4 `options`

`register` receives `options`: a frozen object holding the value of each `userConfig` field the
manifest declares (§3.4), the value saved in `pluginConfigs` (§10.12.1) or else the field's
default. A field with neither is left out, unless it is `required`: for a mod, `required` binds
more than the configuration dialog (§3.4.1). A `required` field with neither a saved value nor a
default MUST keep the mod from loading, with the line `options do not fit plugin.json userConfig`
(§10.42.3 item 3; Judgment J10.4). The options are fixed for one
activation: a change to them reloads the mod, and `register` runs again with the new object
(declarations, `Register`).

## 10.4 The hooks module

### 10.4.1 Its environment

1. A hooks module and every file it imports are ES modules: `import` declarations at the top of a
   file, never `require` and never a dynamic `import()`. A module holding `import()` MUST NOT load
   (`a dynamic import(); a hooks module imports its own files with an import declaration, as in
   import { name } from "./file.js"`).
2. A file imports only files inside the plugin directory, by relative path, and the one bare
   specifier `claude-code`, which carries types and the state helpers of §10.7.2. Any other bare
   import MUST NOT load (`cannot import "<specifier>" (from <file>): a hooks module imports its own
   files by relative path and "claude-code", nothing else`).
3. The module runs in an environment of its own, apart from the interface (§10.20), with the
   globals the declarations list and no others: no DOM, no Node, no timers (a module waits on
   `$.clock`), no `eval` or `new Function` over a string, no `WebAssembly`. It has `URL`,
   `TextEncoder`, `TextDecoder`, `AbortController`, `AbortSignal`, `crypto.subtle` and the JSX
   factory `h` with `Fragment`. A `.tsx` or `.jsx` file compiles against `h`, with no pragma of its
   own. `obj.__proto__ = p` on anything but a function writes an own key (declarations, the global
   block).
4. The module's own variables are shared by all its hooks and live until the module reloads
   (§10.8).

### 10.4.2 What the static analysis requires

Before a hooks module runs, the client analyses its source, the same analysis `claude plugin
validate` runs (`create.md`, "Check what Claude Code reads from your mod"). A module that breaks a
rule MUST NOT load, and the validator reports it as an error. Every message below is Claude Code
2.1.325's. The validator prints each one, at the path `modules.<entry>` (`modules../register.js`
for the entry `./register.js`), as one line:

```text
<plugin>: <absolute file>:<line>: <message>; $ is always spelled $.noun.event(...) at the call site, on is always on("<event>", hook), and next.to always next.to(e, "<tier>")
```

`<plugin>` is the name of the plugin's directory, not the manifest's `name`; `<absolute file>` is
the module's absolute path; `<message>` is the table's text, joined to the fixed reminder by `; `
(Judgment J10.2).

| Rule | Message |
| --- | --- |
| The module exports `register`. | `no export named register (export function register(on, options) {...})` |
| Each event name passed to `on` is a string literal. | `the event name passed to on() is not a string literal` |
| Each event name is an event, a glob or a negation (§10.13.3). | `"tool.calls" is not an event` |
| Inside `register`, no second variable or parameter is named `on`. | `"on" is declared again (shadowed)` |
| Each mods API call is written in full, `$`, namespace, method, as in `$.store.get('k')`. `$` and its namespaces are never assigned, destructured, passed to a method or indexed by a computed name. | `$.ui is used as a value (a noun of $ bound, passed or read)` |
| `$` itself is never bound to a name, passed, spread, returned or read as a value. | `$ itself is bound to a name (bound, passed, spread, returned or read)` |
| No member of `$` is read by a computed name or optional access (`$['store']`, `$?.store`). | `a computed or optional member access on $` |
| `$` MAY be passed to a function declared at the top level of the same file (a `const` arrow counts), whose calls are then listed `(via <name>)`, and to the `read` and `update` helpers of `claude-code`; not to a function defined inside a hook or imported from another file. | as above |
| `on` is called at most once per event without a matcher. | `on("<event>") is registered twice without a matcher; the first is at <file>:<line>` |
| A hook on `turn.step` or `process.spawn` is an async generator, every other hook an async function. | `the hook on "turn.step" is not an async generator: turn.step streams, so it takes async function* ($, e, next) { ... }, which yields the chunks and returns the result` |
| A telemetry hook in a mod outside the `builtin` tier carries the filter `{ to: 'collector' }` (Judgment J10.19). | `its hooks stand on the telemetry stream "anthropic" ... name the collector on each telemetry hook: on("telemetry.log", { to: "collector" }, hook)` |
| A `$.state` value it reads or writes is declared (§10.3.2). | `<plugin>.<key> is not declared ...` |
| No file nests functions, blocks and loops more than 2,000 deep (§10.11). | — |

These rules let the analysis find every hook and call, and they are binding on a mod. <!-- req: mods.create.Check what Claude Code reads from your mod -->

A module that calls `require` is not refused by Claude Code 2.1.321 or 2.1.325, though no `require`
exists at run time; an Extended client MUST refuse it (Judgment J10.5).

### 10.4.3 What the validator reports

`claude plugin validate <directory>` (§17) prints, for each hooks module, one line per kind of fact,
each led by the module's path as written in `modules`:

| Line | Lists |
| --- | --- |
| `hooks:` | each `on` call's pattern, with its matcher in braces as `field=value` pairs joined by commas: `session.start, tool.call{tool=Bash}, command.run{command=tally}` |
| `calls:` | every `$` method called, as `$.command.register`, `$.store.get (via loadNotes)`; `nothing on $` when none |
| `gating hook without .catch:` / `gating hook with .catch:` | one line per hook that can refuse an action (`tool.call`, `tool.check`, `prompt.submit`, `config.set`, `plugin.register`, the telemetry events, and a glob or negation that selects one) |
| `answers its own command:` | a `command.run` hook whose matcher names a command |
| `env reads:`, `env writes:` | the names given to `$.env.get` and `$.env.set`; a computed name is `(computed)` |
| `state reads:`, `state writes:` | `<plugin>.<key>` of each `$.state` value; `nothing` when none |
| `state of other plugins, not checked ...:` | values of plugins not loaded beside it |
| `adds to $:`, `withholds from $:` | the namespaces an `engine.create` hook adds and withholds |
| `hooks telemetry for:` | the telemetry streams its hooks stand on |
| `types <path> declares on $:`, `types <path> declares state:` | what the types file declares |

`--strict` turns warnings into failures and `--json` prints the same report as data. `e.uses` of
`plugin.register` (§10.19.5) carries the same lists. A misspelt event name is the usual reason an
event is missing from `hooks:`, and the client does not call that hook either. (Line names follow
Claude Code 2.1.325; Judgment J10.2.)

## 10.5 `register` and `on`

1. The client imports the module and calls its `register(on, options)` once per activation.
   `register` MAY be async: its returned promise is awaited, and its value dropped. A call to `on`
   after `register` has returned throws (declarations, `Register`, `Registration`).
2. `on(pattern, hook)` and `on(pattern, matcher, hook)` register a hook. `pattern` is an event name,
   a glob or a negation (§10.13.3); `matcher` filters by the event's fields (§10.13.3). `on` returns
   a **registration** with one method, `.catch(handler)`, which sets the hook's error handler
   (§10.15). A second `.catch` on one registration throws, and so does a `.catch` on an
   `engine.create` hook, whose failure is the load's.
3. Within one module, hooks on one event run in the order `register` called `on` (§10.14).

## 10.6 A hook's arguments

Every hook is called as `hook($, e, next)` (an async generator for a streaming event, §10.13.1).

| Argument | What a client MUST hand it |
| --- | --- |
| `$` | The mods API built for this mod (§10.7), every method under its namespace. <!-- req: mods.hookArgument.$ --> |
| `e` | The event's input as plain data, deeply frozen: assigning to a field throws. A hook changes an event only by passing a copy to `next` (§10.13). <!-- req: mods.hookArgument.e --> |
| `next(e)` | The rest of the chain (§10.6.1). <!-- req: mods.hookArgument.next(e) --> |

### 10.6.1 `next`

`next` is made once per dispatch for each hook, frozen (declarations, `Next`).

1. **`next(e)`** runs the hooks after this one and then the client's own behaviour, and resolves to
   the event's result. Each call runs everything below again. Called with no argument it rejects,
   naming the hook; at the end of the chain, below the client's own behaviour, it rejects. On a
   streaming event it returns a stream (§10.13.1).
2. **`next.signal`** is an `AbortSignal` that aborts when the dispatch is abandoned: the user
   interrupted, a hook above settled first, or this hook ran out of time. Work the hook started
   SHOULD stop on it. A hook MAY keep running for 5 seconds after it aborts before the client
   reports it as lingering; the dispatch has already gone on without it. <!-- req: mods.hookArgument.next.signal -->
3. **`next.origin`** is `{ plugin, tier }` of whoever raised the event: the client itself is
   `{ plugin: 'engine', tier: 'core' }`; a mod's `$` call carries that mod's name and tier
   (`prepend`, `user`, `append` or `builtin`, §10.14); a `Client` element's post carries `client`.
   The client sets it from where the call came from; nothing a mod writes reaches it, and every hook
   of one dispatch sees the same origin. <!-- req: mods.hookArgument.next.origin -->
4. **`next.budget`** is the hook's time limit, read fresh on each access: `ms` the whole limit and
   `remainingMs` what is left, never below 0. It stands still while a `next` or `$` call of the hook
   is in flight (a `$.clock` wait excepted). In a `.catch` handler it is the handler's grace; on
   `session.end` it is what the shared bound left (§10.11). Where nothing meters it, `ms` is 0 and
   `remainingMs` is `Infinity`. <!-- req: mods.hookArgument.next.budget -->
5. **`next.to(e, tier)`** continues the dispatch at a later tier, skipping every hook between the
   caller's tier and that one: `next.to(e, 'append')` skips the mods a user installed. Only a hook
   of a mod in `prependPlugins` or `appendPlugins` (§10.12.1) MAY call it, and only with a tier after
   its own: a `prepend` hook names `user`, `append`, `builtin` or `core`, and `user` skips only the
   `prepend` peers below it; an `append` hook names `builtin` or `core`. It never skips a tier of
   more authority, and an outer `next.to` to a deeper tier wins. A refused call rejects. The
   documentation lists the targets as `append`, `builtin` and `core`; the declarations add `user`
   (Judgment J10.6). <!-- req: mods.hookArgument.next.to(e, tier) -->
6. **`next.event`** is the event's name, for a glob hook to switch on; **`next.is(pattern, e)`** says
   whether the event is one `pattern` selects, narrowing `e` (declarations, `Next`).
7. **`next.trace`** lists what settled below the hook on its latest `next` call, nearest first and
   the client's own behaviour last: per link `index`, `plugin`, `tier`, `event`, `outcome`
   (`returned`, `passed`, `skipped`, `kept`, `expired`, `caught` or `rejected`), `reason` (as
   `bypassed by <plugin>`), `ms`, `chunks` on a stream, `received` and `returned`. Empty before
   `next` is called (declarations, `TraceEntry`).

In a `.catch` handler (§10.15) `next` also carries:

8. **`next.error`**, why the hook failed, frozen: `kind` is `throw` (it threw, returned a result of
   the wrong shape, or its worker ended under it) or `timeout` (it outran its budget); `message` is
   what was thrown, or for a timeout what its last `next()` rejected with, and is absent for a
   timeout with nothing rejected; `budget` is the handler's grace in milliseconds. These two are the
   only kinds: a hook skipped for re-entry is not a failure and no handler is asked (below,
   Judgment J10.7). <!-- deviates: mods.hookArgument.next.error -->
9. **`next.called`**, `true` when the failed hook had called `next()` or `next.to()` at least once,
   settled or in flight; the handler runs once that call settled. <!-- req: mods.hookArgument.next.called -->

A hook is **skipped for re-entry** when the event it would handle came from inside a `$` call made
by that same hook, or by the mod's code outside its hooks (then every hook of the mod is skipped).
The documentation calls the second cause `lent` when a method another mod added to `$` raised the
event, and `rewritten` when a `tool.call` or `PreToolUse` hook changed the call, or an
`agent.spawn` hook changed an agent the call started. The client MUST skip such a hook, run the next
handler in its place, ask no `.catch` handler and report no skip line: the declarations of 2.1.321
give `next.error.kind` only `throw` and `timeout` and no `cause`, where the documentation describes
a `re-entry` kind (v2.1.292) with a `cause` (`lent` v2.1.292, `rewritten` v2.1.300); this rule
follows the declarations and Claude Code's behaviour (Judgment J10.7, E4a).
<!-- deviates: mods.hookArgument.next.error.cause -->

## 10.7 The mods API

### 10.7.1 Namespaces

`$` holds the namespaces below, each method a property of its namespace. Every method is also an
event a mod can hook (§10.19.7). The methods are those of the declarations' `EngineInterface`; a
row's version note is the documentation's. `api.md` specifies what each method does.

| Namespace | Methods | Notes |
| --- | --- | --- |
| `$.plugin` | `name`, `root` | Values, not calls: this plugin's name and directory. No event is raised for them. <!-- req: mods.api.$.plugin --> |
| `$.ui` | `resolve`, `invalidate`, `open`, `close`, `panes`, `place`, `focus`, `scroll`, `toast`, `notify`, `cancelNotify`, `status`, `log`, `notice`, `ask`, `copy`, `selection`, `blit`, `view` | `view` from v2.1.300, `place` from v2.1.314. `resolve`, `invalidate`, `log`, `toast`, `status` and `notice` are synchronous. `invalidate` takes `ui.render`, `prompt.section`, `prompt.context`, `prompt.attachment`, `tool.describe`, `command.describe` or `config.describe`. §10.20–§10.28. <!-- req: mods.api.$.ui --> |
| `$.theme` | `set`, `clear` | Set and take off a backdrop the Desktop or mobile app draws; from v2.1.319 (§10.25.6). <!-- req: mods.api.$.theme --> |
| `$.command` | `register`, `run`, `list` | <!-- req: mods.api.$.command --> |
| `$.tool` | `register`, `call`, `check`, `list` | <!-- req: mods.api.$.tool --> |
| `$.agent` | `register`, `spawn`, `list` | `list()` returns the session's subagents and teammates, each with `status` `pending`, `running`, `waiting`, `idle`, `completed`, `failed` or `killed` (`idle` and `waiting` from v2.1.289). <!-- req: mods.api.$.agent --> |
| `$.model` | `complete`, `fork`, `classify` | <!-- req: mods.api.$.model --> |
| `$.prompt` | `submit`, `read`, `media`, `fill`, `paint`, `suggest`, `compose` | Claude reads text from `submit({ text })` after a sentence naming the mod as sender; `submit({ text, asUser: true })` sends it as the user's own words without that sentence. <!-- req: mods.api.$.prompt --> |
| `$.turn` | `abort` | <!-- req: mods.api.$.turn --> |
| `$.session` | `messages`, `cwd`, `root`, `model`, `turns`, `id`, `repo`, `surfaces`, `surface`, `usage`, `version`, `compact`, `send`, `append`, `authorize`, `identity` | `usage()` resolves to `{ startedAt, context, rateLimits, cost }`: `context` holds `tokens`, `window` and `percent`; `rateLimits` is a list of `{ kind, percentUsed, resetsAt }`. <!-- req: mods.api.$.session --> |
| `$.config` | `list`, `set` | <!-- req: mods.api.$.config --> |
| `$.settings` | `read` | §10.18.3. <!-- req: mods.api.$.settings --> |
| `$.env` | `get`, `set` | <!-- req: mods.api.$.env --> |
| `$.fs` | `read`, `write`, `list`, `exists`, `stat`, `ancestors` | `write` is not atomic: it replaces the file's content in place, so another process can read a partly written file. <!-- req: mods.api.$.fs --> |
| `$.store` | `get`, `set`, `delete`, `keys` | A JSON key-value store every session on the machine shares (§10.28). <!-- req: mods.api.$.store --> |
| `$.state` | `get`, `set` | Session values with versions, and the helpers of §10.7.2. <!-- req: mods.api.$.state --> |
| `$.clock` | `now`, `sleep`, `after`, `every` | `after` and `every` return a timer; a reload cancels a mod's pending waits. <!-- req: mods.api.$.clock --> |
| `$.http` | `fetch` | <!-- req: mods.api.$.http --> |
| `$.process` | `run`, `spawn` | `spawn` streams (§10.13.1). <!-- req: mods.api.$.process --> |
| `$.mcp` | `call`, `connect` | `connect(server)` connects an MCP server the mod's own plugin's manifest lists. <!-- req: mods.api.$.mcp --> |
| `$.audio` | `play`, `speak` | <!-- req: mods.api.$.audio --> |
| `$.telemetry` | `log`, `mark` | A record is sent only when the client or a built-in mod makes the call. <!-- req: mods.api.$.telemetry --> |

`$.ui.cancelNotify`, `$.prompt.media`, `$.prompt.paint`, `$.session.surface` and
`$.session.identity` are in the declarations and not in the documentation's table; a client MUST
offer them (Judgment J10.8). A namespace another mod adds in `engine.create` (§10.19.5) is on `$`
beside these.

### 10.7.2 `$.state` and its helpers

1. `$.state.get({ plugin, key, id? })` resolves to `{ value, version }`; a value never written is
   `undefined` at version 0. Every `get` of one dispatch reads one moment. `plugin` and `key` MUST be
   literals in source; only a family member's `id` may be computed.
2. `$.state.set(ref, value, { ifVersion? })` writes JSON data (never `undefined`) under a ref of the
   mod's own and resolves to `{ isSet, version }`; `isSet` is `false` when `ifVersion` missed. It is
   refused while a `ui.render` hook draws, and for another plugin's value (a mod hooks that plugin's
   `state.set` instead). Each site that read the value while drawing is drawn again, at the redraw
   rate (§10.22). Any plugin reads any value.
3. The module `claude-code` exports pure helpers that run in the mod's environment and call only
   `$.state`:

   | Helper | What it does |
   | --- | --- |
   | `atom(ref, initial, { shape }?)` | A frozen description of a value with its initial, so a read is never `undefined`. With `shape`, a stored value under another tag reads as absent. |
   | `read($, source)` | Reads an atom, a derived value or a ref through `$.state.get`; while a `ui.render` hook draws, subscribes the drawing. |
   | `update($, target, fn)` | Reads, applies `fn`, writes with `ifVersion`, and tries again on a miss. |
   | `derive(sources, fn)` | A value computed from atoms and refs, cached by their versions: `read` runs `fn` again only when one moved. |
   | `memberOf(family, e)` | The member of a family for the instance being drawn, keyed by `e.requestId`. |

   The same module exports `TIERS`, `['prepend', 'user', 'append', 'builtin', 'core']`, and
   `INSTRUCTION_FILE_KINDS`. How state survives reloads and `/clear` is in §10.28.

## 10.8 Lifecycle

### 10.8.1 Loading

A client loads each mod the policy lets load (§14), in the order of §10.14:

1. It reads the manifest and `hooks/hooks.json` (§10.3) and analyses the module (§10.4); fits
   `options` (§10.3.4); fires `plugin.register` to the mods already loaded, which MAY refuse it
   (§10.19.5); builds the mod's `$`, firing `engine.create`; imports the module and calls
   `register`. A failure at any step loads nothing of the mod, and the client reports `<plugin>:
   hooks module did not load: <reason>` or `<plugin>: refused by <mod>: <reason>`
   (`troubleshooting.md`). The rest of the plugin still loads.
2. Once loaded, `session.start` fires for that mod before the first prompt (§10.19.2), and
   `ui.resolve` once for each app, render site and mod.

### 10.8.2 Reloading

1. A plugin loaded with `--plugin-dir` is watched: in an interactive session, saving a file of it
   reloads its hooks module; a long-running non-interactive session does so when
   `CLAUDE_CODE_PLUGIN_DIR_WATCH` is `1` (§3, §10.12.2).
2. `/reload-plugins` reloads plugins when run (§10.12.3); an install or update from the shell while
   a session is open loads in that session only through it.
3. A reload unloads the old module (§10.8.3), then loads the new one as in §10.8.1, which runs
   `register` again: module-level variables start over, and `$.state` values survive. A transcript
   line names the mod and lists its hooks. A reload that fails keeps the previous version loaded,
   unless its reason ends `; the version loaded before is unloaded`, when no version runs until
   `/reload-plugins` (§10.42.3, §10.46). The mod keeps its place in its tier (Judgment J10.9).

### 10.8.3 Unloading

When a mod unloads (a reload, disabling it, the session ending), the client MUST remove its hooks,
abort the `next.signal` of every dispatch its hooks are in, cancel its pending `$.clock` waits, and
close its panes with `ui.close` `origin.kind` `unload`. `session.end` (§10.19.2) fires when the
session ends, not on a reload.

### 10.8.4 Mods Claude writes

When the user asks for a mod, Claude writes it from the built-in `plugin-authoring` skill into
`~/.claude/dev-mods/<session id>/<mod>/`, a protected path (§13): in `default` and `acceptEdits`
modes each file is approved before it is written. On the first file, the client asks whether to
enable hot reloading for the session; **Turn them on** loads the session's mods when the turn ends
and reloads them at the end of each turn that changes them, for the session and after it is resumed;
**Not now** loads nothing until the session next starts. In `auto` and `bypassPermissions` modes the
mods load when the turn ends without the question. Such a mod loads only in the session that made it,
and the folder is deleted once older than `cleanupPeriodDays` (`create.md`, "Ask Claude for a mod").

A mod Claude writes MUST NOT load in these sessions (`create.md`, "Sessions where a mod Claude
writes can't load"):

- **Nobody is there to approve**: the session can show no prompt, as `claude -p` outside `auto` and
  `bypassPermissions`, or `dontAsk` mode. <!-- req: mods.create.Sessions where a mod Claude writes can't load.Nobody is there to approve -->
- **The workspace isn't trusted**: the trust prompt for the directory has not been accepted. <!-- req: mods.create.Sessions where a mod Claude writes can't load.The workspace isn't trusted -->
- **Mods are disabled**: the session started with `--safe-mode` or `--bare`, `disableAllHooks` is
  set, or managed settings block it (§14). <!-- req: mods.create.Sessions where a mod Claude writes can't load.Mods are disabled -->

## 10.9 Render sites

A render site is a place in the interface a `ui.render` hook draws at (§10.21). Each is a value of
`e.component`; `e.props` are the site's (declarations, `RenderPropsOf`), `e.requestId` names the
instance, and `e.surface` the app drawing (`terminal`, `desktop`, `mobile`, `vscode`). The client
MUST raise each site where the last column says, and nowhere else.

| Site | `e.props` | `e.requestId` | Raised in |
| --- | --- | --- | --- |
| `Pane` | `title`, `isFocused`, `bodyColumns`, `placement` (`dock` or `inline`), `scroll` (`{ bodyRows, offset }`), `view` (`{ agentId? }`) | the pane's `id` | terminal, Desktop, VS Code <!-- req: mods.site.Pane --> |
| `AbovePrompt` (the band) | `hasSurvey`, `isCollapsed`, `isWorking`, `maxRows`, `bodyColumns`, `scroll`, `view` | one instance | terminal, Desktop <!-- req: mods.site.AbovePrompt --> |
| `Placed` | `id`, `plugin`, `onScreen` | the `requestId` `$.ui.place` returned | terminal <!-- req: mods.site.Placed --> |
| `Backdrop` | `id`, `plugin`, `glass` (`{ blur, opacity, tint? }` or `false`), `colorScheme` (`light` or `dark`) | `backdrop` | the `desktop` and `mobile` surfaces, when the app asks to draw a backdrop <!-- req: mods.site.Backdrop --> |
| `UserMessage` | `text`, `origin`, `isExpanded`, `task` or `from` by origin, `onScreen` | the message id | terminal, Desktop, VS Code <!-- req: mods.site.UserMessage --> |
| `AssistantMessage` | `text`, `isFirstOfReply`, `isSummary`, `onScreen` | the message id | terminal, Desktop, VS Code <!-- req: mods.site.AssistantMessage --> |
| `ToolUse` | `tool_use_id`, `tool`, `input`, `isRunning`, `isErrored`, `isInterrupted`, `isExpanded`, `output`, `onScreen` | the tool call id | terminal, Desktop, VS Code <!-- req: mods.site.ToolUse --> |
| `ToolResult` | `tool_use_id`, `tool`, `output`, `isErrored`, `isExpanded`, `onScreen` | the tool call id | terminal, Desktop, VS Code <!-- req: mods.site.ToolResult --> |
| `ToolGroup` | `calls`, `isActive`, `isExpanded`, `isCallsOnly`, `onScreen` | the tool call id | terminal, Desktop, VS Code <!-- req: mods.site.ToolGroup --> |
| `CommandOutput` | `command`, `args`, `text`, `isErrored`, `onScreen` | the message id | terminal, Desktop <!-- req: mods.site.CommandOutput --> |
| `AskUserQuestion` | `tool`, `questions`, `metadataSource` | the tool call id | terminal, Desktop, VS Code <!-- req: mods.site.AskUserQuestion --> |
| `ToolProgress` | `tool_use_id`, `kind` (`background_hint`), `hint` | the tool call id | terminal <!-- req: mods.site.ToolProgress --> |
| `Spinner` | `word`, `message`, `suffix`, `mode` (`requesting`, `responding`, `thinking`, `tool-input`, `tool-use`) | the agent id | terminal, Desktop, VS Code <!-- req: mods.site.Spinner --> |
| `TurnDuration` | `word`, `durationMs`, `isExpanded`, `waitingFor`, `onScreen` | the message id | terminal <!-- req: mods.site.TurnDuration --> |
| `InfoNotice` | `text`, `command`, `onScreen` | the message id | terminal <!-- req: mods.site.InfoNotice --> |
| `SessionMode` | `modes` | one instance | terminal, Desktop <!-- req: mods.site.SessionMode --> |
| `PromptHint` | `isDraft`, `isWorking`, `hint`, `tail` | one instance | terminal, Desktop <!-- req: mods.site.PromptHint --> |

1. Rendering in the VS Code extension requires extension version 2.1.299, and 2.1.304 in a session
   that does not fetch feature flags.
2. `e.viewport` holds `columns`, `rows` and `isFullscreen`. In the terminal and the Desktop app it is
   absent until the app has measured its window, and its `rows` is the whole window's height, not
   the pane's; in the VS Code extension it is always present.
3. A tree is fitted to its site from the props: its width is `e.props.bodyColumns` for a `Pane` and
   the band; a docked pane (`placement: 'dock'`) has `e.props.scroll.bodyRows` rows; an inline pane
   (`'inline'`) grows with its tree up to `bodyRows` (the `rows` field of `$.ui.open` asks for
   another limit). A tree taller than its pane scrolls as a whole.

## 10.10 Elements

A tree is built from the elements `$.ui.resolve(e)` returns for `e.surface` (§10.23). The props are
the declarations' (`Elements`); a check mark means the surface draws the element, and the client
MUST refuse in a tree an element its surface's table lacks.

| Element | Props (`?` optional) | terminal | Desktop | mobile | VS Code |
| --- | --- | :-: | :-: | :-: | :-: |
| `Box` | `key?`, the flex layout props `flexDirection?`, `flexGrow?`, `flexShrink?`, `flexWrap?`, `alignItems?`, `alignSelf?`, `justifyContent?`, the spacing props of §10.10.2, `width?`, `height?`, `minWidth?`, `minHeight?`, `borderStyle?` (§10.10.1), `borderColor?`, `borderDimColor?`, `backgroundColor?`, `position?`, `top?`, `left?`, `right?`, `bottom?`, `overflow?`, `display?`, `hover?` | ✓ | ✓ | ✓ | ✓ <!-- req: mods.element.Box --> |
| `Text` | `color?`, `backgroundColor?`, `bold?` (§10.10.4), `italic?`, `underline?`, `strikethrough?`, `dimColor?`, `inverse?`, `wrap?`, `size?`, `weight?`, `mono?`, `tabular?` (§10.10.3), `dir?`, `hover?` | ✓ | ✓ | ✓ | ✓ <!-- req: mods.element.Text --> |
| `Button` | `onPress`, `key?`, `label?`, children, `hotkey?`, `plain?`, `dimColor?`, `autoFocus?`, `action?`, `variant?`, `role?`, `hover?` (§10.10.5) | ✓ | ✓ | ✓ | ✓ <!-- req: mods.element.Button --> |
| `Link` | `href`, `label?` | ✓ | ✓ | ✓ | ✓ <!-- req: mods.element.Link --> |
| `Code` | `source`, `language?`, `path?`, `startLine?`, `format?` (`'diff'` for a diff), `wrap?` | ✓ | ✓ | ✓ | ✓ <!-- req: mods.element.Code --> |
| `Markdown` | `text`, `key?`, `dimColor?`, `onLinkPress?`, `pressableLinks?` | ✓ | ✓ | ✓ | ✓ <!-- req: mods.element.Markdown --> |
| `Input` | `key`, `onSubmit`, `label?`, `placeholder?`, `value?`, `submitLabel?`, `rows?`, `onInput?`, `autoFocus?` | ✓ | ✓ | ✓ | ✓ <!-- req: mods.element.Input --> |
| `Select` | `key`, `options`, `onSelect`, `label?`, `value?`, `autoFocus?` | ✓ | ✓ | ✓ | ✓ <!-- req: mods.element.Select --> |
| `Svg` | `source` (SVG markup, at most 131,072 characters), `alt`, `width?`, `height?`, `isInteractive?` | | ✓ | ✓ | ✓ <!-- req: mods.element.Svg --> |
| `Client` | `key`, `module`, `props?`, `width?`, `height?`, `flexGrow?` | ✓ | ✓ | | <!-- req: mods.element.Client --> |
| `Raster` | `key`, `columns` (at most 512), `rows` (at most 256), `cells` | ✓ | | | <!-- req: mods.element.Raster --> |
| `Image` | `source` (PNG or RGBA bytes up to 2 MiB, or a file path), `columns` and `rows` (each at most 255), `alt`, `key?` | ✓ | | | <!-- req: mods.element.Image --> |

1. `autoFocus` accepts only `true`, on any control.
2. The VS Code extension draws an element as if these props were absent: `Box` `position` with
   `top`, `left`, `right` and `bottom`, `alignSelf`, `borderDimColor`, `hover`; `Text` `size`,
   `mono`, `tabular`, `hover`; `Button` `hotkey`, `plain`, `autoFocus`, `action`, `hover`, `variant`,
   `role` (a button there is pressed with a click, or Enter once focused); `Code` `language`, `path`,
   `startLine`, `format`, `wrap` (no colours or line numbers, a diff shown as raw text); `Input` and
   `Select` `autoFocus`, and `Input` `rows`; `Svg` `isInteractive`.

### 10.10.1 `Box` border styles

`borderStyle` names one of these; the terminal draws:

| `borderStyle` | Lines | Top edge |
| --- | --- | --- |
| `'single'` | thin, square corners | `┌──┐` <!-- req: mods.reference.Box border styles.'single' --> |
| `'double'` | double | `╔══╗` <!-- req: mods.reference.Box border styles.'double' --> |
| `'round'` | thin, rounded corners | `╭──╮` <!-- req: mods.reference.Box border styles.'round' --> |
| `'bold'` | thick | `┏━━┓` <!-- req: mods.reference.Box border styles.'bold' --> |
| `'singleDouble'` | thin top and bottom, double sides | `╓──╖` <!-- req: mods.reference.Box border styles.'singleDouble' --> |
| `'doubleSingle'` | double top and bottom, thin sides | `╒══╕` <!-- req: mods.reference.Box border styles.'doubleSingle' --> |
| `'classic'` | the ASCII `+`, `-` and `\|` | `+--+` <!-- req: mods.reference.Box border styles.'classic' --> |
| `'arrow'` | arrows pointing into the box | `↘↓↓↙` <!-- req: mods.reference.Box border styles.'arrow' --> |
| `'dashed'` | dashed lines, blank corners | ` ╌╌ ` <!-- req: mods.reference.Box border styles.'dashed' --> |
| `'quote'` | a bar `▎` down the left side, blank cells on the other three | blank <!-- req: mods.reference.Box border styles.'quote' --> |

Any other name, such as `'rounded'`, draws no border; it is not an error.

### 10.10.2 `Box` spacing steps

The spacing props are `gap`, `columnGap`, `rowGap`, `padding`, `margin`, and the one-side and
one-axis forms (`paddingX`, `paddingY`, `paddingTop`, `paddingRight`, `paddingBottom`,
`paddingLeft`, and the same for `margin`). Each takes a number of cells or a step name. In the
terminal and the VS Code extension:

| Step | Cells across | Cells down |
| --- | --- | --- |
| `'xs'` | 1 | 0 <!-- req: mods.reference.Box spacing steps.'xs' --> |
| `'sm'` | 1 | 0 <!-- req: mods.reference.Box spacing steps.'sm' --> |
| `'md'` | 2 | 1 <!-- req: mods.reference.Box spacing steps.'md' --> |
| `'lg'` | 3 | 1 <!-- req: mods.reference.Box spacing steps.'lg' --> |
| `'xl'` | 4 | 2 <!-- req: mods.reference.Box spacing steps.'xl' --> |

A step on `gap`, `padding` or `margin` applies across and down at once: `padding: 'md'` is two cells
each side and one row above and below. Step names exist from v2.1.299.

### 10.10.3 `Text` typography

| Prop | Values | Terminal | VS Code |
| --- | --- | --- | --- |
| `size` | `'caption'`, `'footnote'`, `'body'`, `'heading'`, `'title'` | ignored | ignored |
| `weight` | `'regular'`, `'medium'`, `'semibold'`, `'bold'` | `semibold` and `bold` draw bold | `semibold` and `bold` draw bold |
| `mono` | `true` | ignored | ignored |
| `tabular` | `true` | ignored | ignored |

An app that ignores one of these draws the text as if it were absent. They exist from v2.1.299.

### 10.10.4 `bold` and `weight`

`bold` is deprecated in favour of `weight` and still works: `bold: true` on a `Text` with no
`weight` draws as `weight: 'semibold'`. When both are set, `bold` has no effect. <!-- req: mods.reference.Replace bold with weight -->

### 10.10.5 `Button`

1. **`action`** names one of the client's keybinding actions; the user's binding for it presses the
   button when that binding is a chord or a modified key.
2. **A digit `hotkey`** on a button in the band also fires when the user types that digit alone into
   an empty prompt and pauses.
3. While the band is collapsed, neither an `action` binding nor a hotkey presses a button in it.
4. Two buttons of one drawing with the same `hotkey`: the later one gets it.
5. **`variant`** is `primary` or `secondary`, and any other value throws; in the terminal a `primary`
   button draws in the accent colour unless `plain`.
6. **`role`** is `dismiss`, and any other value throws. It marks a close button; the mod does the
   closing in `onPress`. In a band holding text and a row of buttons, the Desktop app MAY draw the
   row's first `dismiss` button as its own close control; the terminal draws it as without `role`.
7. **Children** in place of a `label` are strings and `Text` elements only; any other element inside
   a `Button` is refused. The `label` names the button and defaults to its children's text; a button
   whose children are more than one string needs a `key` or a `label`. The terminal draws the
   children where the label would be and counts a press anywhere on them as one press; the Desktop
   app and the VS Code extension draw the `label`. Children other than one string exist from
   v2.1.295.

## 10.11 Limits

A client MUST enforce these. A hook that exceeds a time limit is skipped (§10.15); a tree over a
nesting, element, `Raster` cell or `Image` byte limit is not drawn (§10.24).

| Limit | Value |
| --- | --- |
| A hook's own time for one event, not counting time inside `next` or a `$` call other than `$.clock.sleep` | 10 seconds; 50 milliseconds for a `prompt.edit` hook |
| A `.catch` handler's time | 1 second, a fresh budget from when it is called <!-- req: mods.limit..catch --> |
| All `session.end` hooks together | the SessionEnd hook budget (§7), 1.5 seconds unless the user changes it, counted from when the settings `SessionEnd` hooks finish; this clock never stops, `$` waits included, and a later hook starts with what earlier ones left <!-- req: mods.limit.session.end --> |
| `$.process.run` timeout | 30 seconds by default, 10 minutes at most <!-- req: mods.limit.$.process.run --> |
| `$.process.run` `stdout` | 4 MiB; `isStdoutTruncated` is `true` when cut <!-- req: mods.limit.stdout --> |
| `$.process.run` `stderr` | 4 MiB; `isStderrTruncated` is `true` when cut <!-- req: mods.limit.stderr --> |
| `$.model.complete` `maxTokens` | 1,024 by default, up to 64,000 or the model's output limit <!-- req: mods.limit.$.model.complete | mods.limit.maxTokens --> |
| `$.fs.read` | 4 MiB for one file <!-- req: mods.limit.$.fs.read --> |
| `$.fs.write` | 4 MiB for one file <!-- req: mods.limit.$.fs.write --> |
| `$.http.fetch` | a request body of at most 4 MiB counted in characters, or the call rejects; a response body read to its first 4 MiB in `text`, the rest unread, except that a `Content-Length` declaring more rejects the call with a reason ending `is over the 4194304-byte limit` (not when the last request after redirects is `HEAD`, from v2.1.296); 30 seconds for the whole call, redirects and body included; at most 5 redirects <!-- req: mods.limit.$.http.fetch --> |
| A hook's `drop` reason, or a `config.set` `deny` reason | 4,096 characters; the end of a longer reason is cut and the drop or deny still applies (before v2.1.292 the hook failed instead) <!-- req: mods.limit.drop --> |
| Text in one tree | the first 100,000 characters are drawn <!-- req: mods.limit.Text in one tree --> |
| A `Code`'s `language` or `path`, a `Select` option's `value`, a `Client`'s `module` | 10,000 characters; a longer one fails the `ui.render` hook that returned it <!-- req: mods.limit.Code --> |
| A `Link`'s `href` | 2,048 characters; a longer one fails the `ui.render` hook <!-- req: mods.limit.Link --> |
| Nesting depth of one tree | 32 levels below the root element <!-- req: mods.limit.Nesting depth of one tree --> |
| Elements and text children in one tree | 20,000 <!-- req: mods.limit.Elements and text children in one tree --> |
| `Raster` cells in one tree, each `Raster`'s `columns` × `rows` | 262,144 <!-- req: mods.limit.Raster --> |
| PNG or RGBA bytes of all `Image`s in one tree | 2 MiB <!-- req: mods.limit.Image --> |
| `$.store` | 4 MiB of JSON in total <!-- req: mods.limit.$.store --> |
| `$.session.messages()` | the newest 4,096 entries <!-- req: mods.limit.$.session.messages() --> |
| `$.ui.invalidate('ui.render')` redraws | 10 a second; 30 in the terminal for the visible pane, the expanded band and the hint line under the prompt; calls that come sooner are coalesced <!-- req: mods.limit.$.ui.invalidate('ui.render') --> |
| `$.ui.toast` | shown 4 seconds unless `{ timeoutMs }` is given; in the classic renderer a mod's newer toast MAY take the place of its older one that is showing or waiting <!-- req: mods.limit.$.ui.toast --> |
| A pane opened without the user asking | placed from 144 terminal columns, 110 once the user has opened it <!-- req: mods.limit.A pane opened without the user asking --> |
| Rows one mod has placed with `$.ui.place` in a conversation at one time | 500; at the limit a call with a new `id` resolves to `{ isPlaced: false, reason: 'a plugin holds at most 500 placed rows' }` <!-- req: mods.limit.$.ui.place --> |
| Nesting depth of a `$` call's arguments | 28,000 levels; past it the call rejects with a message ending `nesting deeper than 28000 levels is not supported` <!-- req: mods.limit.Nesting depth of a mods API call's arguments --> |
| Nesting depth of a changed event passed to `next`, outside async generator hooks | 28,000 levels; past it `next` rejects with a message ending as above <!-- req: mods.limit.next --> |
| Nesting depth of a hook's return value, outside `ui.render`, `ui.resolve` and async generator hooks | 28,000 levels; past it the result is refused and the skip line includes `nesting deeper than 28000 levels is not supported` <!-- req: mods.limit.ui.render --> |
| Scopes (functions, blocks, loops) nested in one another in one file of a hooks module | 2,000 <!-- req: mods.limit.Scopes, such as functions, blocks, and loops, nested inside one another in one file of a hooks module --> |
| Command, tool, subagent type and pane names, and the `id` of a placed row or a backdrop | letters, digits, `_` and `-`, up to 64 characters <!-- req: mods.limit.id --> |
| One `claude plugin test` test | 5 seconds unless the test sets `timeoutMs` <!-- req: mods.limit.claude plugin test --> |

The 28,000-level limits exist from v2.1.299. A level is one array or object: a scalar is 0 levels
and `[1]` is 1 (Judgment J10.10).

## 10.12 Settings, environment variables and commands

### 10.12.1 Settings

| Name | Read from | What it does |
| --- | --- | --- |
| `prependPlugins`, `appendPlugins` | managed settings; user settings only on a machine with no managed settings and no `managed-mcp.json`, in a session whose credential is not a Team or Enterprise `/login` | Lists of plugin ids (`acme-guard@acme-tools`). Mods in `prependPlugins` run before every mod a user installs, those in `appendPlugins` after, each in the listed order (§10.14, §14). <!-- req: mods.setting.prependPlugins | mods.setting.appendPlugins --> |
| `allowManagedModsOnly` | managed settings, as an option of the built-in guard | Only mods counted as the organisation's, and built-in mods, run their hooks; users' settings hooks keep running (§14). <!-- req: mods.setting.allowManagedModsOnly --> |
| `allowModsToOverrideDenyRules` | managed settings, as an option of the built-in guard | Lets a user's mod approve a tool call past most of the outcomes that stay in place by default, a `deny` rule included (§13, §14). <!-- req: mods.setting.allowModsToOverrideDenyRules --> |
| `allowManagedHooksOnly` | managed settings | Blocks hooks and installed mods that are not the organisation's (§12, §14). <!-- req: mods.setting.allowManagedHooksOnly --> |
| `disableAllHooks` | any settings file | In managed settings, no mod or hook from an installed plugin runs; in the user's own, what the organisation manages keeps running (§12). <!-- req: mods.setting.disableAllHooks --> |
| `disableSideloadFlags` | managed settings | `--plugin-dir` and `--plugin-url` are rejected at startup (§14). <!-- req: mods.setting.disableSideloadFlags --> |
| `pluginConfigs` | user or managed settings | A mod's `userConfig` values (§10.3.4), keyed by plugin id (`acme-guard@acme-tools`), or by the name and `@inline` (`first-mod@inline`) for one loaded with `--plugin-dir`. <!-- req: mods.setting.pluginConfigs --> |

`sec-default@builtin`, listed as `cc-plugin-sec-default` in `/plugin` and the debug log, is the
built-in guard. Where it loads (§14) it runs ahead of every mod a person installs; when managed
`prependPlugins` is set, it loads only if that list names it, at the listed position.

### 10.12.2 Environment variables

| Name | Read from | What it does |
| --- | --- | --- |
| `CLAUDE_CODE_PLUGIN_DIRS` | the environment, or `env` in `~/.claude/settings.json` | Plugin directories to load as `--plugin-dir` does, for apps no flag can be passed to: absolute paths separated by `:`, or `;` on Windows (§3). <!-- req: mods.setting.CLAUDE_CODE_PLUGIN_DIRS --> |
| `CLAUDE_CODE_PLUGIN_DIR_WATCH` | the environment | `1` makes a long-running non-interactive session reload `--plugin-dir` mods on save (§3, §10.8.2). <!-- req: mods.setting.CLAUDE_CODE_PLUGIN_DIR_WATCH --> |

### 10.12.3 Commands

| Command | What a client MUST do |
| --- | --- |
| `/plugin` | Show, under its tabs, a line such as `1 mod active · first-mod` when a mod that is not built in has loaded: the count and the names, joined by `, ` (Judgment J10.11). <!-- req: mods.command./plugin --> |
| `claude plugin validate <directory>` | Read the plugin's manifest and hooks module and report errors, the events the module handles and the `$` calls it makes (§10.4.3); `--strict` treats warnings as errors and `--json` prints a machine-readable report (§17). <!-- req: mods.command.claude plugin validate <directory> --> |
| `claude plugin test [directory]` | Run every file under the directory, or the current directory, whose name ends in `.test.ts` or `.test.tsx`, and exit with status 1 when a test fails (`test.md`). <!-- req: mods.command.claude plugin test [directory] --> |
| `claude --plugin-dir <directory>` | Load the directory as a plugin for one session and reload its hooks module on save (§10.8.2); the flag repeats to load several. <!-- req: mods.command.claude --plugin-dir <directory> --> |
| `/reload-plugins` | Reload plugins when run. <!-- req: mods.command./reload-plugins --> |

## Design decisions

### Why the module is analysed before it runs

The rules of §10.4.2 make every hook and every `$` call visible in the source. That one fact carries
review (`hooks:` and `calls:`), policy (`plugin.register` decides on `e.uses`), and the absence of a
second way out of the module. The rules cost an author little, a call written in full, and a client
that relaxed them would let a mod hide what it does from all three.

### Why the declarations decide the surface

The documentation is a guide over a surface that changes between releases and points authors at the
declarations for the exact shape. Following the declarations of the targeted release is what lets a
mod type-checked against them run unchanged in an Extended client.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J10.2 | The messages and report lines this part quotes are Claude Code 2.1.325's; a client SHOULD use them word for word. | The documentation quotes some (`"tool.calls" is not an event`, `$.ui is used as a value`, the `hooks:`/`calls:` lines) and not others. Oracle 2.1.325, `claude plugin validate` on minimal mods of ours (two modules, a `.txt` module, a duplicate `on`, an undeclared state value, a bare import, a missing export, a generator mismatch, a telemetry hook without a filter). Oracle 2.1.326, plugins whose directory name differs from the manifest `name`: `const x = $`, `const u = $.ui` and `$["store"]` each print `<directory>: <absolute file>:1: <message>; $ is always spelled …` at `modules../register.js`, with the bare-`$` and computed-access texts of §10.4.2. The installed release is 2.1.325, not the target 2.1.321. |
| J10.3 | A mod that adds a `$` namespace without a types file loads. | reference.md, "Files", says the file is required then; oracle 2.1.325 validates such a mod and lists `adds to $: topo`. A module that only withholds a namespace cannot be told from one that adds by its source alone. |
| J10.4 | A `userConfig` field with no saved value and no default is absent from `options`, unless it is `required: true`: then the mod does not load (`options do not fit plugin.json userConfig`), as it does not for a value that does not fit its field. Outside mods `required` binds only the dialog (§3.4.1). | reference.md says "with defaults filled in" and nothing of a field with none; troubleshoot.md, "`options do not fit plugin.json userConfig`", names "a required field has no value" as a reason the module does not load. Lead: the reference implementation's rows for `src/mods/load/options.ts`. |
| J10.5 | A module that calls `require` is refused. | create.md says to write every file "with `import` and not `require`", and the environment has no `require`. Oracle 2.1.325 and the reference implementation's oracle on 2.1.321 both found Claude Code validates and loads such a module; refusing it is the documented rule and costs no working mod. |
| J10.6 | `next.to` accepts `user` from a `prepend` hook, skipping only its `prepend` peers below it. | The declarations' `TargetTier` excludes only `prepend` and say `user` "is for a prepend hook alone"; reference.md lists `append`, `builtin` and `core`. Declarations win (E2). |
| J10.7 | A hook skipped for re-entry runs no `.catch` handler and reports nothing; `next.error` has no `re-entry` kind and no `cause`. E4a deviation, on `next.error` and `next.error.cause`. | **Docs:** reference.md, "The hook function", describes a `re-entry` kind of `next.error` with a `cause` (`lent`, `rewritten`). **Claude Code:** the 2.1.321 declarations' `HookFailure` is `{ kind: 'throw' \| 'timeout', message?, budget }` (E2), and the reference implementation's oracle on 2.1.322 found the `.catch` handler is not asked for a re-entry skip. |
| J10.8 | `$.ui.cancelNotify`, `$.prompt.media`, `$.prompt.paint`, `$.session.surface` and `$.session.identity` are part of `$`. | They are in the declarations' `EngineInterface` and not in reference.md's table, which the page itself says is not complete. |
| J10.9 | A reloaded mod keeps its place among the mods of its tier. | events.md orders mods by tier and by `dependencies`, and does not say whether a reload is a new load; moving a mod on each save would change what a guard sees. Lead: the reference implementation's rows for `src/mods/chain/registry.ts`. |
| J10.10 | A nesting level is one array or object; 28,000 are allowed and the 28,001st refused. | reference.md gives "28,000 levels. Past that, ..." without defining a level. |
| J10.11 | The `mods active` line is plural for several mods (`2 mods active · a, b`). | overview.md shows the line for one mod only. |
| J10.21 | The `capabilities` warning is given whatever the field's value, and the plugin still loads. | The docs do not name the field. Oracle 2.1.321, corpus (`claude-plugins-community/dominion-flow`, `gatekeeper-ai`, object values): a warning, no error; oracle 2.1.325 gives the same warning for `"capabilities": 5`. |
