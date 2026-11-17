# Agent Plugins Extended

The [Agent Plugins Specification](../README.md) grown to the whole plugin contract of Claude Code
2.1.321. A client that implements it runs every Agent Plugins package as the core specification
says, and every Claude Code plugin exactly as Claude Code does.

- [The specification](../extend/spec/1.1.0/README.md), version `1.1.0+claude-code.2.1.321`,
  working draft
- [Schemas](../extend/schemas/1.1.0/claude-code/README.md), twelve, for the files of a Claude Code
  plugin
- [Conformance reports](../extend/conformance/README.md): what the text states, what was checked
  against the documentation, what the schemas do on real plugins
- [Judgments](../extend/spec/judgments.md): where the documentation is silent and the
  specification decides

## Who it is for

| Reader | What it gives them |
| --- | --- |
| A plugin author | The exact rules a Claude Code plugin is loaded, validated, installed and run by, file by file and field by field, and how to write one package that loads both as an Agent Plugins package and as a Claude Code plugin. |
| A client implementer | A contract precise enough to implement and to test: every behaviour a host must reproduce to run Claude Code plugins unchanged, each paragraph tied to the documentation section it comes from. |
| Someone checking compatibility | Generated reports that say how much of the contract is stated and verified, and where the text deliberately follows Claude Code over its documentation. |

## What it covers

Eighteen chapters, one area each. Every chapter ends with "Design decisions" (why) and "Judgments"
(what it decides where the documentation is silent).

| § | Chapter | Covers |
| --- | --- | --- |
| 1 | [Packages](../extend/spec/1.1.0/01-packages.md) | The two forms, how a client tells them apart, dual packages, default locations |
| 2 | [The Claude Code manifest](../extend/spec/1.1.0/02-manifest.md) | `.claude-plugin/plugin.json`: fields, names, paths, validation, load diagnostics |
| 3 | [Environment](../extend/spec/1.1.0/03-environment.md) | Path variables, `${...}` substitution, process environments, `userConfig` |
| 4 | [Skills and commands](../extend/spec/1.1.0/04-skills.md) | Discovery, frontmatter, commands, listing and invocation, expansion |
| 5 | [Agents](../extend/spec/1.1.0/05-agents.md) | Agent files, frontmatter, tools, model and effort, running subagents |
| 6 | [Output styles and themes](../extend/spec/1.1.0/06-styles.md) | Style and theme files |
| 7 | [Hooks](../extend/spec/1.1.0/07-hooks/README.md) | Configuration, handler types, results, every event, the tools hooks see |
| 8 | [MCP servers](../extend/spec/1.1.0/08-mcp.md) | Server configuration, transports, MCP settings and policy |
| 9 | [LSP servers, monitors and channels](../extend/spec/1.1.0/09-lsp-monitors-channels.md) | Language servers, background monitors, message channels |
| 10 | [Mods](../extend/spec/1.1.0/10-mods/README.md) | The hooks module, its events, the interface, the API, failures |
| 11 | [Workflows](../extend/spec/1.1.0/11-workflows.md) | Workflow scripts a plugin ships, their API, runs and limits |
| 12 | [Settings](../extend/spec/1.1.0/12-settings.md) | Settings files and scopes, precedence, merge, plugin default settings |
| 13 | [Permissions and trust](../extend/spec/1.1.0/13-permissions.md) | Rule syntax and evaluation, permission modes, workspace trust |
| 14 | [Managed policy](../extend/spec/1.1.0/14-policy.md) | Managed settings, plugin and mods policy |
| 15 | [Marketplaces](../extend/spec/1.1.0/15-marketplaces.md) | `marketplace.json`, sources, hosting |
| 16 | [Install, updates and dependencies](../extend/spec/1.1.0/16-install.md) | Install scopes, the plugin store on disk, updates, dependencies |
| 17 | [The plugin CLI](../extend/spec/1.1.0/17-cli.md) | `claude plugin` commands and their diagnostics |
| 18 | [The core and Claude Code in one client](../extend/spec/1.1.0/18-bridge.md) | Both forms in one session, event mapping, dual packages, conversion |

## How it relates to the core

```text
                 Agent Plugins Extended 1.1.0+claude-code.2.1.321
  +---------------------------------------------------------------------+
  |  extend/spec/1.1.0/   the Claude Code form: chapters 1-17           |
  |                       both forms in one client: chapter 18          |
  +---------------------------------------------------------------------+
  |  spec/1.1.0.md        the core: Agent Plugins 1.1.0, untouched      |
  +---------------------------------------------------------------------+
```

- **The core is the portable floor and stays upstream's.** `spec/`, `schemas/` and the other root
  files are merged from `agentplugins/agent-plugins-spec` and never edited here. A disagreement with
  the core is recorded as a judgment, never as an edit.
- **The Claude Code form sits beside it.** A directory with `.claude-plugin/plugin.json` is a Claude
  Code plugin and loads under chapters 1-17; a directory whose root `plugin.json` carries a core
  `$schema` is a core package and loads under the core (§1.3).
- **A dual package carries both manifests.** It loads in a core client and in Claude Code; an
  Extended client loads it as a Claude Code plugin only, so it behaves exactly as in Claude Code
  (§1.3.1).
- **Chapter 18 joins them.** It says how core packages and Claude Code plugins coexist in one
  session, how each core hook event and result maps onto Claude Code's, how to write a dual package
  (§18.3), and what a converter between the forms must do (§18.4).

## How compatibility is measured

Compatibility is not claimed from reading; it is counted, and every count below comes from a
generated report.

```text
 Claude Code docs (2.1.321)      requirements.json        extend/spec/          REPORT.md
 50 pages              ------->  2,730 ids, 28  -------> <!-- req: id -->  ---> stated share
                       extracted categories      markers   per paragraph
                                                                |
                         each id read against its docs section  +-------->  VERIFIED.md
                                                                |
 2,495 real plugins + claude plugin validate verdicts  --------------------> CORPUS.md
```

**Requirements and markers.** [`requirements.json`](../extend/conformance/requirements.json) holds
every requirement of the Claude Code plugin-host contract, extracted from the official documentation
of the targeted release, each with its page and section
([where it came from](../extend/conformance/SOURCE.md)). Each normative paragraph of the
specification ends with a marker naming the requirements it states, and `bun run coverage` counts
them. [`REPORT.md`](../extend/conformance/REPORT.md): **2,723 of 2,730 stated (99.7%), 7
deviations, none missing.**

**Verification.** A marker says a paragraph claims a requirement; it does not say the paragraph is
right. Fourteen verification passes read every requirement against its documentation section and
recorded the outcome in a ledger. [`VERIFIED.md`](../extend/conformance/VERIFIED.md): **2,730 of
2,730 verified**; the passes found 115 statements to correct and corrected them, re-checked the 7
deviations, and re-examined judgments 407 times (389 kept, 15 corrected, 2 promoted to normative
text, 1 removed).

**The corpus.** The [schemas](../extend/schemas/1.1.0/claude-code/README.md) are run over every file
they cover in the plugins of the official and community marketplaces, and each verdict is compared
with what Claude Code 2.1.321's own `claude plugin validate` reports for the same plugin.
[`CORPUS.md`](../extend/conformance/CORPUS.md): **2,495 plugins, 25,514 files, 0 false rejects**
(a file we refuse and Claude Code accepts). Of Claude Code's errors, 436 are matched by ours and 278
remain; the remainder is what a JSON Schema cannot state: reserved names (151), paths on disk (94),
and directories with nothing to validate (33).

**Deviations (E4a).** In 7 requirements the documentation and Claude Code's behaviour disagree:
how a skill's listed command name is formed, which file a validator reports as missing, what a
directory validation reads, and the error a mod hook receives on re-entry. The specification follows
the behaviour, because running plugins as Claude Code does is what it promises. Each deviation
carries a judgment that states both sides (J2.1, J4.1, J4.13, J10.7, J17.14) and the black-box runs
of Claude Code releases around the target that show the behaviour. A deviation is reported apart
and never counted as stated.

**Judgments (E4).** Where the documentation is silent, a chapter decides, names the decision in the
text ("Judgment J7.3") and records it with its evidence: a black-box run of Claude Code's own
commands on an input of ours, with the release named, or a reading of the reference implementation
checked against the documentation. There are 405, [indexed by chapter](../extend/spec/judgments.md).
A judgment is normative but carries no requirement marker: it never raises the stated share.

## Quick start

### For a plugin author

The smallest Claude Code plugin is a manifest and one skill:

```text
hello/
├── .claude-plugin/
│   └── plugin.json
└── skills/
    └── greet/
        └── SKILL.md
```

`.claude-plugin/plugin.json`:

```json
{
  "name": "hello",
  "version": "1.0.0",
  "description": "Greets the user."
}
```

`skills/greet/SKILL.md`:

```markdown
---
name: greet
description: Greet the user and offer help. Use when the user says hello.
---

Greet the user and offer help.
```

`claude plugin validate ./hello` checks it as Claude Code does (§17). The rules it applies are §2
(the manifest), §1.4 (where components are found) and §4 (skills). To make the same directory load
in a core client too, add a root `plugin.json` with the core `$schema` and keep the two halves
equivalent by [§18.3](../extend/spec/1.1.0/18-bridge.md#183-writing-a-dual-package), which ends
with a complete dual package (§18.3.5).

### For a client implementer

1. Read the core, [`spec/1.1.0.md`](../spec/1.1.0.md), §1-§11: an Extended client implements it for
   every core package.
2. Read the specification's [front page](../extend/spec/1.1.0/README.md), then §1 and §2: how a
   plugin root is classified and its manifest read.
3. Read §3-§11 for the component types you support, then §12-§14 (settings, permissions, policy)
   and §15-§17 (marketplaces, installs, the CLI). A client that implements only some chapters names
   them when it claims support.
4. Read §18 if the client also loads core packages.
5. Validate files with the [schemas](../extend/schemas/1.1.0/claude-code/README.md), and use the
   [conformance reports](../extend/conformance/README.md) to map each requirement id to the
   paragraph that states it: the ids are the natural keys for an implementation's tests.

## Repository layout

```text
.
├── README.md, AGENTS.md, ...   upstream's: the core project, never edited here
├── spec/, schemas/             upstream's: the core specification and its schemas
├── CLAUDE.md                   ours: loads both guides for an agent working here
├── .github/README.md           ours: this page
└── extend/                     ours: everything else
    ├── README.md               the guide inside extend/
    ├── AGENTS.md               the rules for every change (U, E, C, W)
    ├── CONTRIBUTING.md         how a change is made
    ├── CHANGELOG.md
    ├── spec/
    │   ├── 1.1.0/              the chapters
    │   └── judgments.md        the judgments, indexed by chapter (generated)
    ├── schemas/1.1.0/claude-code/   JSON Schema 2020-12 for the Claude Code files
    ├── conformance/            requirements, verification ledgers, generated reports
    └── tools/                  the checks and generators (Bun, TypeScript)
```

## Working on it

```sh
cd extend/tools
bun install
bun run check        # everything: types, upstream untouched, links, sections, reports current
bun run coverage     # rewrite conformance/REPORT.md
bun run verification # rewrite conformance/VERIFIED.md from the ledgers
bun run judgments    # rewrite the index in spec/judgments.md
bun run corpus       # schemas against real plugins: conformance/CORPUS.md
./sync --dry-run     # what merging upstream would bring; ./sync merges it
```

Every script is described in [`extend/tools/README.md`](../extend/tools/README.md); the rules for a
change are in [`extend/AGENTS.md`](../extend/AGENTS.md) and
[`extend/CONTRIBUTING.md`](../extend/CONTRIBUTING.md).

## Status

A working draft. It targets Claude Code 2.1.321: the requirements, the oracle verdicts of the corpus
and the official types it follows are all of that release. What comes next:

- **Newer Claude Code releases.** Each release that changes the contract becomes a new version of
  the specification, from a new snapshot of the requirements (`extend/conformance/SOURCE.md`,
  "Updating").
- **A language-neutral conformance suite.** Test cases keyed by requirement id that any
  implementation can run, so that a client's compatibility is measured the way the text's is.
- **Published schema identifiers.** The schemas' `$id`s are not served yet; a validator loads them
  from this repository.

Changes are listed in [`extend/CHANGELOG.md`](../extend/CHANGELOG.md).

## Implementation

[`@localix-ai/agent-plugins`](https://github.com/localixai/agent-plugins) runs Claude Code plugins
in any agent through ports its host implements, and is moving onto this specification.

## Licence

As the core: the specification text and documentation are CC BY 4.0, the schemas and tools Apache
2.0 ([LICENSE.md](../LICENSE.md)). Agent Plugins Extended is derived from the Agent Plugins
Specification and extends it; it does not modify it.

Claude and Claude Code are trademarks of Anthropic, PBC. This project is independent of Anthropic.

A project of [Localix Lab](https://github.com/localixai). Exploring what's next, and making it.
