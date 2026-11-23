# 10. Mods

A **mod** is a Claude Code plugin that carries a *hooks module*: JavaScript or TypeScript code that
the client loads into its own process and calls when an event happens, such as a tool call, a
submitted prompt or a part of the interface being drawn. A mod changes how the client looks and
behaves from inside it; everything else a plugin ships (skills, agents, MCP servers, settings hooks)
works from outside. This chapter states what a client does with a mod, so that every mod written
for Claude Code 2.1.330 runs in an Extended client as it does there.

Evidence: `plugins/mods/overview.md`, `reference.md`, `events.md`, `create.md`, `gallery.md`,
`interface.md`, `api.md`, `test.md` and `troubleshoot.md` of the 2.1.330 documentation, and the
TypeScript declarations Claude Code 2.1.330 writes beside a mod (`claude-code/index.d.ts`, cited as
*the declarations* with the type they name). The documentation itself calls the declarations the
complete reference and tells authors to trust them where the two disagree, so on the mods surface
(events and their fields, `$` and its members, `next`, the elements and their props, the state
helpers) a declaration wins over the prose, and each such case is a judgment of this chapter.
Managed policy for mods (`allowManagedModsOnly`, the built-in guard's options, policy mods) is
§14's; this chapter names those settings only where they change what a mod sees.

## The parts of this chapter

| File | § | What it states |
| --- | --- | --- |
| [README.md](README.md) | 10.1–10.2 | What a mod is, what a hook can do, where mods run, how they are turned on and off, what a mod can reach. |
| [reference.md](reference.md) | 10.3–10.12 | The files of a mod, the hooks module and its static analysis, `register` and `on`, the hook's arguments and `next`, the `$` surface and the state helpers, the lifecycle, render sites, elements, limits, settings, environment variables and commands. |
| [events.md](events.md) | 10.13–10.19 | How a hook observes, rewrites or answers an event, matchers and patterns, the order mods run in, what happens when a hook fails, and every event with its fields and its answers. |
| [interface.md](interface.md) | 10.20–10.28 | How a mod draws: render sites, `ui.render`, element trees and their validation, redraws, panes, the band, placed rows, the backdrop, controls, the keyboard and state. |
| [api.md](api.md) | 10.30– | What each method of the mods API does: commands, tools, models, the prompt, sessions, files, processes, the network, timers and storage. |
| [troubleshooting.md](troubleshooting.md) | 10.40– | The lines a client prints when a mod does not load or does nothing, the debug log, and what each reported cause means. |

## 10.1 What a mod is

### 10.1.1 The three files

A mod is a plugin directory (§1) whose `hooks/hooks.json` names one hooks module. The smallest mod
has three files:

```text
first-mod/
├── .claude-plugin/
│   └── plugin.json
└── hooks/
    ├── hooks.json
    └── register.js
```

1. **`plugin.json`** is the plugin's ordinary manifest (§2). A mod adds no required field to it; the
   optional `types` field names the mod's declaration file (§10.3). <!-- req: mods.overview.How a mod works.plugin.json -->
2. **`hooks.json`** points to the code: its `modules` key holds the path of the hooks module,
   relative to `hooks.json` (§10.3). Having `modules` is what makes a plugin a mod; the same file
   MAY also hold settings hooks under `hooks` (§7). <!-- req: mods.overview.How a mod works.hooks.json -->
3. **`register.js`**, the hooks module, exports `register(on, options)`. The client calls it once
   each time the module loads; each call to `on` inside it registers a hook for the event it names
   (§10.5). <!-- req: mods.overview.How a mod works.register.js -->

A complete hooks module that counts tool calls and shows the count beside the spinner:

```javascript
let calls = 0

export function register(on) {
  on('tool.call', async ($, e, next) => {
    calls += 1
    $.ui.invalidate('ui.render')
    return next(e)
  })
  on('ui.render', { component: 'Spinner' }, async ($, e, next) => {
    return next({ ...e, props: { ...e.props, suffix: ' · tool calls: ' + calls + '…' } })
  })
}
```

A client that loads this module MUST run the first hook before every tool call and the second each
time it draws the spinner, both hooks sharing the module-level `calls`, and MUST draw its own
spinner with the hook's `suffix` after the word, as in `Thinking · tool calls: 3…`. <!-- req: mods.overview.How a mod works -->

### 10.1.2 Hooks, settings hooks and the mods API

On these pages, and in this specification's chapter on mods, a **hook** is a function a mod
registers with `on`; the command, HTTP, prompt and agent handlers configured in settings files and
in a plugin's `hooks/hooks.json` under `hooks` are **settings hooks** (§7). A mod reaches settings
hooks' events through the `classic.<Event>` events (§10.18.2).

A hook runs before the client acts on its event, and decides what happens next (§10.13):

| A hook can | How | Example |
| --- | --- | --- |
| **Observe** | do its work and return `next(e)`, or `await next(e)` and return what it resolved to | count a tool call and let it run <!-- req: mods.overview.What a hook can do with an event.Observe --> |
| **Rewrite** | call `next` with a changed copy of the event, or return a changed copy of the result | add a suffix to the spinner's props <!-- req: mods.overview.What a hook can do with an event.Rewrite --> |
| **Answer** | return a result without calling `next`, so neither later mods nor the client's own behaviour run | refuse a command <!-- req: mods.overview.What a hook can do with an event.Answer --> |

Everything a hook does outside its own code (draw, add a command, call a model, read a file, start
a process, make a network request) goes through the **mods API**, the `$` argument (§10.7). A client
MUST give a hooks module no other way to reach the machine (§10.4.1); that is what lets
`claude plugin validate` list what a mod does before it is installed (§10.4.3).

### 10.1.3 Where a mod can draw

A mod draws in four kinds of place, each specified in the part named:

| Place | Specified in |
| --- | --- |
| A **pane** beside the transcript or above the prompt, and the **band** above the prompt | §10.21, §10.25 <!-- req: mods.gallery.See where a mod can draw.Pane and band --> |
| The client's **own rows**, such as the spinner, a tool call's row or a message | §10.21.1 <!-- req: mods.gallery.See where a mod can draw --> |
| A **toast**, the **status line** and a **log line** in the transcript, shown without starting a turn (`$.ui.toast`, `$.ui.status`, `$.ui.log`) | §10.7, §10.32.1 <!-- req: mods.gallery.See where a mod can draw.Toast, status line, and log line --> |
| The **question dialog** Claude asks in, opened by `$.ui.ask` while a hook holds an event | §10.16.2 <!-- req: mods.gallery.See where a mod can draw.Question dialog --> |

## 10.2 Where mods run

### 10.2.1 Hooks and drawing by place

A mod's hooks MUST run whichever provider serves the model (the Claude API, Amazon Bedrock, Google
Cloud's Agent Platform, Microsoft Foundry), in the places the table says. What a mod draws appears
only where an app draws it.

| Where the client runs | Hooks run | What the mod draws appears |
| --- | --- | --- |
| `claude` in a terminal, including an editor's integrated terminal and the JetBrains plugin | yes | yes <!-- req: mods.overview.Where mods run.claude --> |
| The Code tab of the Desktop app, outside a WSL or SSH session | yes | yes, except the elements §10.10 marks terminal-only |
| A WSL session of the Desktop app | no: plugins are not available there | no <!-- req: mods.overview.Where mods run.A WSL session in the Desktop app --> |
| An SSH session of the Desktop app, for a mod installed only on the user's own computer | no: the Desktop app does not copy its hooks to the remote machine | no |
| The VS Code extension's chat panel | yes | yes, from extension version 2.1.299; a session that does not fetch feature flags (such as one on Amazon Bedrock) needs 2.1.304. §10.9 and §10.10 mark what the panel draws. <!-- req: mods.overview.Where mods run.The VS Code extension's chat panel --> |
| `claude -p` and the Agent SDK | yes | no <!-- req: mods.overview.Where mods run.claude -p --> |
| Remote Control from claude.ai or the mobile app | yes, in the session on the user's machine | in the terminal on that machine |
| A cloud session | yes, for a plugin that reaches the cloud session | not in every session <!-- req: mods.overview.Where mods run.A cloud session --> |

Where nothing draws, a `ui.render` hook is never asked; a mod that draws SHOULD read where it runs
(`e.surface`, `$.session.surfaces()`) and fall back to a log line or a command's text reply.

### 10.2.2 Turning mods on and off

1. Mods are on by default. Claude Code supports them in the terminal from v2.1.287 and in the
   Desktop app from v2.1.286. A client MUST report the version a user checks against: the terminal
   with `claude --version`, the Desktop app in the **Claude Code** row of `/status` in a local Code
   tab session. <!-- req: mods.overview.Turn mods on or off | mods.overview.Turn mods on or off.Terminal | mods.overview.Turn mods on or off.Desktop app -->
2. `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS`, an early-access switch, MUST be ignored: setting it to `0`
   does not turn mods off.
3. A user turns mods off, and back on by undoing the same change, at three reaches:

   | Reach | How | What else stops |
   | --- | --- | --- |
   | One mod | disable or uninstall its plugin on the **Installed** tab of `/plugin` (§16) | the rest of that plugin <!-- req: mods.overview.Turn mods on or off.One mod --> |
   | Every installed mod, for one session | start with `--safe-mode` | the user's other customisations <!-- req: mods.overview.Turn mods on or off.Every installed mod, for one session --> |
   | Every mod the user installed, in every session | `"disableAllHooks": true` in `~/.claude/settings.json` | the user's settings hooks and custom status line; what the organisation manages keeps running (§10.12.1, §12) |

4. `disableAllHooks` and a managed `allowManagedModsOnly` stop a mod and leave the rest of its
   plugin loaded: its skills, commands, agents and MCP servers still load. `--bare`, `--safe-mode`
   and `allowManagedHooksOnly` reach further (§12, §14).
5. None of these stops a mod built into the client (§10.2.4).
6. A terminal session MUST show, in `/plugin`, a dim line under the tabs that counts and names the
   mods that loaded and are not built in, as `1 mod active · first-mod` (§10.12.3).

### 10.2.3 What a mod can reach

A mod is not sandboxed. It runs with the user's permissions, inside the client, and a client MUST
NOT promise more isolation than this list allows. Once loaded, a mod can:

| It can | Through |
| --- | --- |
| **Act on the machine as the user**: read and write any file the user's account can, start programs, make network requests | `$.fs`, `$.process`, `$.http` <!-- req: mods.overview.What a mod can reach.Act on your machine as you --> |
| **Read the user's secrets**: environment variables and settings files, including an API key kept in either | `$.env`, `$.settings`, `$.fs` <!-- req: mods.overview.What a mod can reach.Read your secrets --> |
| **See the session**: every prompt sent and every tool call Claude makes | the events of §10.16–§10.19, `$.session.messages` <!-- req: mods.overview.What a mod can reach.See your session --> |
| **Change the session**: rewrite a prompt or a tool call, submit a prompt as if typed, send a message to another of the user's sessions | `prompt.submit`, `tool.call`, `$.prompt.submit`, `$.session.send` <!-- req: mods.overview.What a mod can reach.Change your session --> |
| **Act without asking**: approve a tool call before the user is asked | `tool.check` (§10.16.3) <!-- req: mods.overview.What a mod can reach.Act without asking you --> |
| **Spend the user's usage**: call a model on the user's plan or API key | `$.model` <!-- req: mods.overview.What a mod can reach.Spend your usage --> |

1. A process a mod starts runs outside the Bash sandbox, even when sandboxing is on.
2. A mod can approve tool calls that the user's `deny` or `ask` rules or `PreToolUse` hooks would
   stop (§13), unless the built-in guard prevents it; where the guard loads, by default a user's mod
   cannot (§14).
3. A mod can restyle much of the interface but never the permission prompt: the client MUST NOT
   offer a render site, event or method that changes what a permission prompt shows (§10.21.1).

### 10.2.4 Mods built into the client

Claude Code ships features of its own as built-in mods, listed under **Built-in** on the
**Installed** tab of `/plugin`. They cannot be updated or uninstalled; the settings and flags that
stop installed mods (`disableAllHooks`, `--bare`, `--safe-mode`) do not stop them, and the `mods
active` line omits them. The table names those the documentation lists; `/plugin` shows what any
other built-in entry does in its details.

| Name in `/plugin` | What it does | Where it is on | How it is turned off |
| --- | --- | --- | --- |
| `cc-plugin-agents-md` | Loads `AGENTS.md` as project instructions | every session that can read `AGENTS.md` | disable it in `/plugin`, or choose the instruction files that load |
| `cc-plugin-diff` | Answers `/diff` and draws its pane | interactive terminal sessions | disable it; the client's own `/diff` then answers |
| `cc-plugin-plugin-authoring` | Gives Claude the `plugin-authoring` skill; holds no mod code | unless installed mods are turned off remotely | disable it |
| `cc-plugin-sec-default` | The built-in guard (`sec-default@builtin`, §14) | where the guard loads | cannot be; managed `prependPlugins` sets its place |
| `cc-plugin-telemetry` | Sends the analytics records the client and its built-in mods log | wherever the client's analytics are on | disable it, or turn analytics off |
| `cc-plugin-you-should-know` | A side agent that shows a note above the prompt | off until the user turns it on | disable it |
| `cc-plugin-easel` | Gives Claude a tool that draws charts, and draws a chart by itself under an MCP result in a supported time-series format (a Prometheus range query result, for one) | sessions that meet its requirements (below) | disable it; turning off **Auto charts** in `/config` stops only the charts it draws by itself |

`cc-plugin-easel` loads only where all of these hold, among others the documentation does not list:

- **Sign-in**: the session runs on a claude.ai subscription. <!-- req: mods.overview.Check the charts mod requirements.Sign-in -->
- **Version**: Claude Code 2.1.321 or later; 2.1.326 or later on a Team or Enterprise plan. <!-- req: mods.overview.Check the charts mod requirements.Version -->
- **Platform**: macOS, or Linux outside WSL. <!-- req: mods.overview.Check the charts mod requirements.Platform -->

An Extended client is not required to ship these features as mods; when it does, it MUST list and
order them as this section and §10.14 say (Judgment J10.1).

## Design decisions

### Why a mod is a plugin and not a new kind of package

A mod installs, updates, scopes and is trusted exactly as any plugin is (§15, §16), and one plugin
can hold a mod beside a skill and an MCP server. Making the hooks module one more component of a
plugin, found through a key in a file plugins already have, kept every install and policy path
unchanged.

### Why the mods API is the only way out

A hooks module that reaches the machine only through `$` can be read before it runs: the static
analysis of §10.4 lists every event it hooks and every call it makes, an administrator's
`plugin.register` hook can refuse it on that list, and another mod's hook can intercept each call.
A module with its own access to files or the network would defeat all three.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J10.1 | A client MAY implement the features Claude Code ships as built-in mods some other way; when it ships them as mods, they sit in the `builtin` tier (the guard excepted, §10.14) and are listed as §10.2.4 says. | overview.md, "Mods built into Claude Code", describes Claude Code's own packaging; nothing a plugin does depends on whether `/diff` is a mod, except the order of §10.14, which is kept. |
