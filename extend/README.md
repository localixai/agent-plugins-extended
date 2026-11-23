# extend/

Everything of Agent Plugins Extended lives in this folder: the [Agent Plugins Specification](../README.md)
grown to the whole Claude Code 2.1.330 plugin contract. What it is, who it is for and how
compatibility is measured is on the [front page](../.github/README.md); this file is the map of the
folder.

| Path | What it is |
| --- | --- |
| [`spec/1.1.0/`](spec/1.1.0/README.md) | The specification, `1.1.0+claude-code.2.1.330`, working draft: 18 chapters, and how to read them |
| [`spec/judgments.md`](spec/judgments.md) | Where the Claude Code documentation is silent and the specification decides: 470 judgments, indexed by chapter (generated) |
| [`schemas/1.1.0/claude-code/`](schemas/1.1.0/claude-code/README.md) | JSON Schema 2020-12 for the twelve kinds of Claude Code plugin file |
| [`conformance/`](conformance/README.md) | The requirements snapshot, the verification ledgers and the generated reports |
| [`tools/`](tools/README.md) | The checks and generators, and `sync` for merging upstream |
| [`AGENTS.md`](AGENTS.md) | The rules every change follows (U, E, C, W) |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | How a change is made |
| [`CHANGELOG.md`](CHANGELOG.md) | What changed, release by release |

## Where things stand

From the generated reports, not from reading:

| Report | Result |
| --- | --- |
| [`REPORT.md`](conformance/REPORT.md) | 2,810 of 2,816 requirements stated (99.8%), 6 deviations (E4a), none missing |
| [`VERIFIED.md`](conformance/VERIFIED.md) | 2,689 of 2,816 requirements read against their documentation section, all by passes of the 2.1.321 documentation; no pass has read 2.1.330's yet |
| [`CORPUS.md`](conformance/CORPUS.md) | 2,489 real plugins, 25,347 files, 0 false rejects against Claude Code 2.1.330's verdicts |

## How it relates to the core

The core (`spec/`, `schemas/`) is upstream's and is never edited here (U1): everything of ours is
in `extend/`, plus the root `CLAUDE.md` and `.github/README.md`, so merging upstream never
conflicts. The core is the portable floor; this specification adds the Claude Code form of a plugin
beside it (`.claude-plugin/plugin.json`, its components and the host contract around them), says how
a client tells the two forms apart (§1.3 of the specification), and maps one onto the other (§18).

## Working on it

```sh
cd extend/tools
bun install
bun run check      # what must pass before a change is done
bun run corpus     # after a schema change: conformance/CORPUS.md
./sync --dry-run   # what merging upstream would bring
```

Every script is in [`tools/README.md`](tools/README.md).

## Licence

As the core: the specification text is CC BY 4.0, schemas and tools Apache 2.0
([LICENSE.md](../LICENSE.md)). It is derived from the Agent Plugins Specification and extends it.
Claude and Claude Code are trademarks of Anthropic, PBC; this project is independent of Anthropic.
