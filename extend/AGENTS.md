# extend/AGENTS.md

The guide for everything under `extend/`: Agent Plugins Extended, the Agent Plugins specification
grown to the whole Claude Code plugin contract. The root `AGENTS.md` is upstream's and governs the
upstream files; this file governs `extend/` and wins there. Read both.

Upstream's posture is the smallest portable floor. Ours is the opposite on purpose: a client that
implements this specification runs every Claude Code plugin exactly as Claude Code does, and still
runs every Agent Plugins package as the core specification says.

## Sync-safety: upstream is merged, never edited

This repository is a fork of `agentplugins/agent-plugins-spec` (remote `upstream`, push disabled).
The owner merges it in from time to time (`extend/tools/sync`); that merge must never conflict.

- **U1** Never change a file upstream owns. Everything of ours lives in `extend/`; the only files
  of ours outside it are the root `CLAUDE.md` and `.github/README.md` (the GitHub front page, shown
  before upstream's root `README.md`), neither of which upstream has. Gate: `check:upstream`.
- **U2** Refer to upstream text by version and section (`core §7.3.3`); never copy it into
  `extend/`. When upstream changes a section we build on, the sync report lists it and the chapter
  that cites it is re-read.
- **U3** The core is a dependency, not a draft: a disagreement with upstream is a judgment row
  (`extend/spec/judgments.md`), never an edit of `spec/` or `schemas/`.

## Evidence, not memory

- **E1** Claude Code behaviour comes from its official documentation of the targeted release, the
  same evidence the requirements were extracted from. Cite page and section beside the text that
  states it (`hooks.md`, "Exit code 2 behavior"). Write the contract in our own words; never paste
  the documentation.
- **E2** Shapes come from the official types of the same release (`@anthropic-ai/claude-agent-sdk`,
  and for mods the declarations Claude Code writes beside a mod). Name the type you follow.
- **E3** This repository owns the evidence: the docs, the declarations, the requirements and the
  corpus with Claude Code's verdicts are mined here (`extend/tools/src/mine/`, `bun run mine`), and
  the implementation, `agent-plugins` (`~/Documents/localixai/agent-plugins`), follows the
  specification and syncs those snapshots from `extend/conformance/`; it never mines its own. Read
  its code, tests and judgments to find what the docs imply; what it decided where the docs are
  silent is a lead, recorded as our own judgment with its reason, not copied as a fact.
  `~/Documents/llx-plugin` is an older copy and is **read-only**: never edit, build, test or write
  anything inside it.
- **E4** Where the docs are silent, decide, name it in the text ("Judgment J7.3"), and add its row
  to the "Judgments" table at the end of that chapter (`J<chapter>.<n>`, with the evidence); list
  the chapter in `extend/spec/judgments.md`. A judgment never carries a requirement marker.
- **E4a** Where the docs and Claude Code's own behaviour disagree, the specification follows the
  behaviour, because running plugins as Claude Code does is what it promises. It needs an oracle
  run on a release at or around the target that shows the behaviour (name the releases), a
  judgment that says what the docs say and what Claude Code does, and the marker
  `<!-- deviates: <id> -->` on the text instead of `req:`. The report counts deviations apart from
  stated requirements; a deviation is never counted as stated.
- **E5** Never state compatibility from your own reading: only `extend/conformance/REPORT.md`
  (`bun run coverage` in `extend/tools/`) says how much of the contract the text covers.

## Coverage

The target is `extend/conformance/requirements.json`: every requirement of the Claude Code plugin-host
contract for the targeted release (`extend/conformance/SOURCE.md` says where it came from).

- **C1** Every normative paragraph that states a requirement ends with a marker naming it (or
  `deviates:` under E4a):
  `<!-- req: hooks.behavior.Exit code 2 behavior.PreToolUse | hooks.field.... -->`, ids exact,
  separated by ` | `. Gate: `check:coverage` fails on an unknown id.
- **C4** Documented behaviour a plugin can observe that the snapshot's scope left out
  (`conformance/completeness/scope.md`) is still stated, with the marker
  `<!-- docs: <page> | <section> -->` instead of `req:`. The report lists these apart; they never
  count as stated requirements, and the next snapshot should carry them as ids.
- **C2** Never edit `requirements.json` by hand: `bun run spec:extract` writes it (with
  `out-of-scope.json` and `docs-tables.json`), and `bun run types:extract` writes
  `mods-declarations.json`. A new Claude Code release is a new snapshot
  (`extend/conformance/SOURCE.md`, "Updating").
- **C3** A chapter is done when every requirement of its categories carries a marker and the text
  around it states the behaviour precisely enough to implement and to test.

## Writing the specification

- **W1** RFC 2119 words, as in the core. Normative chapters say what a client and a plugin MUST do;
  the reason goes to "Design decisions" at the end of the chapter.
- **W2** A Claude Code plugin is the unit: name files, fields, events and values exactly as Claude
  Code does (`.claude-plugin/plugin.json`, `hookSpecificOutput`, `${CLAUDE_PLUGIN_ROOT}`).
- **W3** One chapter per area, one file per chapter, no file over 1,500 lines; split a chapter by
  responsibility before it grows past that (`hooks/` already is a folder).
- **W4** Schemas in `extend/schemas/<version>/` describe Claude Code's files as Claude Code accepts
  them: open where Claude Code is open, closed where it rejects. Every schema is checked against the
  real plugins of the official and community marketplaces (`bun run corpus`).
- **W5** English only. Never name other plugin hosts or products we learned from; Claude Code and
  Agent Plugins are named because the specification is defined against them.

## Commands (in `extend/tools/`)

| Task | Command |
| --- | --- |
| Everything (types, U1, links, sections, coverage, verification, judgments index) | `bun run check` |
| Upstream files untouched (U1) | `bun run check:upstream` |
| Coverage markers and the report (C1, E5) | `bun run coverage` (`--check` in `check`) |
| Schemas against the corpus (W4) | `bun run corpus` (writes `conformance/CORPUS.md`; reads `CORPUS_DIR`, default `extend/.cache/corpus`; not part of `check`) |
| Mine a Claude Code release (E3, C2) | `bun run mine <release>`; the steps alone: `docs:pull`, `types:pull`, `types:extract`, `spec:extract`, `corpus:fetch`, `corpus:oracle` (`tools/README.md`) |
| Merge upstream | `./sync` (fetch, merge `upstream/main`, report what changed) |

Commit only when asked, never push: the repository is local until the owner says otherwise.

## How to write a chapter

1. List its requirements: `jq -r '.requirements[] | select(.category == "<category>") | "\(.id)\t\(.page)\t\(.section)"' extend/conformance/requirements.json`.
2. Read every documentation section they name, in full, in the docs of the targeted release
   (2.1.321: `extend/.cache/claude-docs/2.1.321/<page>`, from `bun run docs:pull` or `mine`). Read
   the official types for the shapes (`@anthropic-ai/claude-agent-sdk/*.d.ts` in the
   implementation's `node_modules`; for mods `extend/.cache/claude-types/<release>/`).
3. Read how the implementation reads the same behaviour (`agent-plugins`: `src/`, its tests, and
   the rows of its `spec/judgments.md` for these pages) to find the edges the docs
   imply: exact messages, defaults, order, failure boundaries. Check each against the docs (E3).
4. Where a behaviour is still unclear, ask Claude Code itself: `claude plugin validate` and the
   other read-only `claude plugin` commands on a minimal input of your own in a scratch directory,
   never on the user's plugins or settings. Name the release in the judgment (`claude --version`).
   Claude Code is a black box: run its commands on inputs, never read, unpack or search its
   installed files or binaries (`strings` included) for evidence.
5. Write the chapter in the shape of `01-packages.md` and `02-manifest.md`: numbered sections, the
   normative rule, its marker, examples where an implementer would otherwise guess, "Design
   decisions", then "Judgments". Every id of the chapter's categories carries a marker exactly once
   or more; no invented ids.
6. `bun run coverage` in `extend/tools/` must pass, and every id of the chapter must be stated.
