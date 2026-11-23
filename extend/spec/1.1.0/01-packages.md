# 1. Packages

A plugin reaches a client in one of two forms. This chapter defines both, how a client tells them
apart, and where each Claude Code component lives in a package.

## 1.1 Terminology

| Term | Meaning |
| --- | --- |
| Core | The Agent Plugins Specification 1.1.0 (`spec/1.1.0.md`), cited as `core §n`. |
| Core package | A directory whose root holds a core manifest (`plugin.json`, core §5). |
| Claude Code plugin | A directory Claude Code loads as a plugin: one with `.claude-plugin/plugin.json`, or one without a manifest whose components sit in their default locations (§1.4). |
| Plugin root | The directory a plugin is loaded from, for either form. |
| Extended client | A client that conforms to this specification. |
| Component | A unit a plugin supplies: a skill, command, agent, hook handler, MCP server, LSP server, output style, theme, monitor, channel, workflow, executable, mod or default setting. |

## 1.2 The two forms

1. A **core package** is loaded as the core says. An Extended client MUST implement the core for
   every core package it loads; nothing in this specification changes core behaviour for a core
   package.
2. A **Claude Code plugin** is loaded as this specification says, which is how Claude Code 2.1.330
   loads it. The manifest, when present, is `.claude-plugin/plugin.json` (§2). The manifest is
   optional: without it, the client loads the components found in the default locations of §1.4.
   <!-- req: layout.Manifest -->
3. The name of a Claude Code plugin without a manifest is the name its marketplace entry gives it
   (§15), or, for a plugin loaded from a directory path, the name of that directory (§2.3).

## 1.3 Telling the forms apart

An Extended client decides the form of a plugin root before it reads any component:

| `.claude-plugin/plugin.json` | root `plugin.json` | Form |
| --- | --- | --- |
| present | absent | Claude Code plugin |
| present | present | Claude Code plugin (a *dual package*, §1.3.1) |
| absent | present, with a core `$schema` (core §5.2) | core package |
| absent | present, without a core `$schema` | Claude Code plugin without a manifest |
| absent | absent | Claude Code plugin without a manifest |

A root `plugin.json` whose `$schema` is not a canonical core identifier is not a core manifest. It
is an ordinary file of a Claude Code plugin, and a client MUST NOT reject the plugin because of it
(Judgment J1.1).

### 1.3.1 Dual packages

A dual package carries both manifests so that it loads in a core client and in Claude Code. An
Extended client MUST load a dual package as a Claude Code plugin only, so that it behaves exactly
as it does in Claude Code: the core manifest and the core component files (`mcp.json`, `hooks.json`)
are not read, and their components are not loaded a second time (Judgment J1.2). A client SHOULD say
in its plugin details that the package also carries a core manifest.

A plugin author who wants one behaviour everywhere keeps the two descriptions equivalent: the
skills under `skills/` are shared by both forms, and the core's `mcp.json` and `hooks.json` state
what `.mcp.json` and `hooks/hooks.json` state (§18 maps one onto the other).

## 1.4 Default locations of a Claude Code plugin

Each component type has a default location under the plugin root, used when the manifest does not
point elsewhere (§2.6 says how a manifest key combines with its default). A client MUST discover
each kind of component in the table below from its default location alone, so that a plugin with
these components and no manifest loads them all (`plugins/components.md`, "Explore the plugin
directory"; `plugins/manifest-reference.md`, "Standard layout"). Only the manifest belongs inside
`.claude-plugin/`; a component directory inside `.claude-plugin/`, such as `.claude-plugin/skills/`,
is not scanned. <!-- req: layout.components.Explore the plugin directory -->

| Component | Default location | Contents |
| --- | --- | --- |
| Manifest | `.claude-plugin/plugin.json` | Plugin metadata and configuration, optional (§2). <!-- req: layout.Manifest --> |
| Skills | `skills/` | One `<name>/SKILL.md` directory per skill (§4). <!-- req: layout.Skills --> |
| Commands | `commands/` | Flat Markdown command files (§4.6). <!-- req: layout.Commands --> |
| Agents | `agents/` | Agent Markdown files; subdirectories are part of the agent name (§5). <!-- req: layout.Agents --> |
| Hooks | `hooks/hooks.json` | Hook configuration (§7). <!-- req: layout.Hooks --> |
| MCP servers | `.mcp.json` | MCP server definitions (§8). <!-- req: layout.MCP servers --> |
| LSP servers | `.lsp.json` | LSP server configurations (§9.1). <!-- req: layout.LSP servers --> |
| Output styles | `output-styles/` | Output style Markdown files (§6.1). <!-- req: layout.Output styles --> |
| Workflows | `workflows/` | Workflow `.js` files (§11). <!-- req: layout.Workflows --> |
| Themes | `themes/` | Theme JSON files (§6.2). <!-- req: layout.Themes --> |
| Monitors | `monitors/monitors.json` | The monitors array (§9.2). <!-- req: layout.Monitors --> |
| Executables | `bin/` | Files put on the shell tools' `PATH` while the plugin is enabled (§1.5). <!-- req: layout.Executables --> |
| Settings | `settings.json` | Deprecated plugin defaults: only `agent` applies while the plugin is enabled; `subagentStatusLine` has no effect (§12.6, Judgment J1.3). |

A plugin with a `SKILL.md` at its root, no `skills/` directory and no `skills` manifest key loads
as a single skill (§4.2). A `CLAUDE.md` at the plugin root is not loaded as context; a validator
SHOULD warn when it finds one (§17).

Example: a plugin that uses the default locations, and a `scripts/` folder its hooks call:

```text
deploy-tools/
├── .claude-plugin/
│   └── plugin.json
├── skills/deploy/SKILL.md
├── commands/status.md
├── agents/reviewer.md
├── hooks/hooks.json
├── monitors/monitors.json
├── output-styles/terse.md
├── themes/dracula.json
├── workflows/release-audit.js
├── bin/deploy-tool
├── scripts/format.sh
├── .mcp.json
└── .lsp.json
```

A client that shows a plugin's contents SHOULD list each of these components with its location, so
an author can see what loaded from where.

## 1.5 Executables

While a plugin is enabled, the files in its top-level `bin/` directory MUST be reachable as bare
commands from the shell the agent's Bash tool runs, and from a PowerShell tool command that runs
outside the sandbox; a sandboxed PowerShell command does not receive them. The client MUST append
each enabled plugin's `bin/` after the user's own `PATH` entries, so that a plugin cannot shadow a
command the user already has. A file in `bin/` is run as it is: it needs its executable permission
and, for a script, its interpreter line. <!-- req: layout.components.Executables | layout.Executables -->

A client that distributes plugins to hosted environments MAY refuse to install a plugin that has a
top-level `bin/` directory; Claude Code's hosted surfaces (claude.ai and Cowork) do. The refusal is
that client's own distribution policy, outside this specification, not a defect of the plugin.

## 1.6 Paths inside a package

The core's containment rules (core §4.1) apply to both forms: a client MUST NOT read or execute a
package path that resolves outside the plugin root. For a Claude Code plugin, the manifest's own
path rules (§2.5) add the `./` prefix and the existence check. An installed plugin is a copy in the
client's cache (§16), so a path that reached outside the plugin's source directory finds nothing
after install; a symbolic link inside the plugin root that points within it keeps working.

## Design decisions

### Why a dual package loads only as a Claude Code plugin

Loading both descriptions would run every hook twice and connect every MCP server twice in an
Extended client, and nowhere else. Choosing the Claude Code form makes an Extended client behave as
Claude Code does on the same directory, which is the compatibility this specification promises; a
core client still reads the core manifest, which is what the author wrote it for.

### Why a root `plugin.json` without a core `$schema` is just a file

Claude Code never reads a root `plugin.json`. Treating any such file as a core manifest would make
an Extended client reject Claude Code plugins that Claude Code loads, for a file Claude Code ignores.
The canonical `$schema` is what makes a file a core manifest (core §5.2), so it is what decides.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J1.1 | A root `plugin.json` without a canonical core `$schema` is an ordinary file of a Claude Code plugin, never a reason to reject it (§1.3). | Claude Code reads only `.claude-plugin/plugin.json`. Oracle 2.1.325: `claude plugin validate` on a directory with only a root `plugin.json` (core `$schema`, an unknown field) and `skills/` validates it as a plugin without a manifest and says nothing about the file. |
| J1.2 | A dual package loads only as a Claude Code plugin; its core manifest and core component files are not read (§1.3.1). | Loading both would run each hook and connect each MCP server twice, in an Extended client only. Oracle 2.1.325: the same directory with `.claude-plugin/plugin.json` added validates on that manifest alone. |
| J1.3 | A root `settings.json` stays a default location though the 2.1.330 docs no longer list it (`plugins/manifest-reference.md`, "Standard layout"; `plugins/components.md`): Claude Code 2.1.330 still reads it and warns that its `agent` key is deprecated (§2.4, Judgment J2.9). | The id `layout.Settings` is gone from the 2.1.330 requirements. Oracle 2.1.330, 2026-11-23: `claude plugin validate` on a plugin whose root `settings.json` sets `agent` prints `Validating plugin: settings.json` and the deprecation warning. |
