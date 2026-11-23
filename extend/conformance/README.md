# Conformance

How much of the Claude Code plugin contract the specification states, how each statement was
checked, and how the schemas fare on real plugins. Everything here is either a snapshot that is
never edited by hand or a report that a script writes; the specification never states its own
compatibility (E5).

| File | What it is | Produced by | When it changes |
| --- | --- | --- | --- |
| [`requirements.json`](requirements.json) | Every requirement of the Claude Code plugin-host contract for one release: 2,816 ids in 28 categories, from 52 documentation pages | `bun run spec:extract`, from the documentation of Claude Code 2.1.330 ([`SOURCE.md`](SOURCE.md)) | Only with a new Claude Code release (C2) |
| [`SOURCE.md`](SOURCE.md) | Where the snapshot came from: release, source revision, hash, scope; how to update it | By hand, with the snapshot | With the snapshot |
| [`out-of-scope.json`](out-of-scope.json) | Every section of an audited page the snapshot leaves out, with its page and reason; and the rows of the mixed settings, environment and CLI tables it rejects | `bun run spec:extract`, with `requirements.json` | With the snapshot |
| [`out-of-scope-pages.json`](out-of-scope-pages.json) | Every documentation page not audited, with its reason | By hand: a person classifies each page ("Pages and scope") | When a release adds or removes a page |
| [`scope-audit.md`](scope-audit.md) | The owner's scope decision, and what of each excluded page stays covered elsewhere | By hand | With the scope |
| [`docs-tables.json`](docs-tables.json) | The tables of the mods reference (events, API methods, limits, elements, render sites, settings) as data, for implementations' tests | `bun run spec:extract` | With the snapshot |
| [`tools-table.json`](tools-table.json) | The tools table of tools-reference.md as data: each built-in tool with "Permission required", and the tools each permission rule format applies to, for an implementation to check its own copy against | `bun run spec:extract` | With the snapshot |
| [`oracle/`](oracle/) | Fixtures written for Claude Code to run, and what it did on each: the outcomes an implementation's tests compare with ("Oracle runs") | Fixtures by hand; outcomes by `bun run oracle:record` | When a fixture is added, or with a new release |
| [`mods-declarations.json`](mods-declarations.json) | What the mods declarations of the release declare: events and their fields, `$` and its members, `next`, the elements and their props, the exports, the built-in tools' inputs, each with its line | `bun run types:extract` | With the snapshot |
| [`REPORT.md`](REPORT.md) | The stated share: per category and per chapter file | `bun run coverage` | Whenever a marker is added, removed or changed |
| [`verification/`](verification/) | The ledgers: one JSON file per verification pass | By the reader of each pass | When a pass is made |
| [`VERIFIED.md`](VERIFIED.md) | Which requirements were read against their documentation section, and the outcomes | `bun run verification`, from the ledgers | When a ledger changes |
| [`CORPUS.md`](CORPUS.md) | The schemas against every plugin of the official and community marketplaces, compared with Claude Code's own validator | `bun run corpus` | When a schema changes |

The scripts are run in `extend/tools/` ([`tools/README.md`](../tools/README.md)). `bun run check`
fails when `REPORT.md` or `VERIFIED.md` is stale; `CORPUS.md` needs the corpus on disk and is
refreshed by hand.

This repository owns the evidence: the snapshots here are mined from Claude Code by the tools in
`extend/tools/src/mine/` (`bun run mine <release>`), and an implementation takes them from here
and never mines its own. How each one is mined is below, from "Mining the snapshots" on.

## How the pieces connect

```text
requirements.json --(ids)--> markers in extend/spec/ ----> REPORT.md    stated, deviating, missing
        |                            |
        |                            +-- read against docs --> verification/*.json --> VERIFIED.md
        |
Claude Code docs, 2.1.330  --spec:extract-->  requirements.json, out-of-scope.json, docs-tables.json
mods declarations, 2.1.330 --types:extract-->  mods-declarations.json

extend/schemas/ + corpus of real plugins + claude plugin validate verdicts ----> CORPUS.md
```

## `requirements.json`

```json
{
  "claudeCode": "2.1.330",
  "requirements": [
    { "id": "agents.behavior.Available tools.Agent", "category": "agents",
      "page": "sub-agents.md", "section": "Available tools" }
  ]
}
```

`id` reads `<category>.<kind>.<section>[.<item>]` and is the only key a marker uses. `page` and
`section` name where in the documentation the requirement is stated: that is what a reader opens to
check the text.

## Reading `REPORT.md`

- **Stated**: an id named by at least one `req:` marker in `extend/spec/`.
- **Deviate**: an id named by a `deviates:` marker (E4a). The text follows Claude Code's behaviour
  over its documentation, with a judgment holding the oracle runs. It is never counted as stated,
  and an id may not carry both markers.
- **Missing**: neither. The target is none.
- **Markers per file**: how many ids each chapter file names; an id named in two files counts in
  both.

An unknown id in a marker fails `bun run coverage`: ids are never invented (C1).

## Reading `VERIFIED.md`

A marker says a paragraph claims a requirement; verification says a reader checked the claim. Each
pass took a set of chapter files, read every requirement they mark against its documentation
section, and re-examined the judgments of those files.

| Outcome | Means |
| --- | --- |
| `verified` | The text states the requirement as the documentation does. |
| `fixed` | It did not; the pass corrected the text, and the note says how. |
| `deviates` | E4a applies; the pass re-checked the evidence of the deviation. |
| `judgment kept` | The judgment still stands on its evidence. |
| `judgment fixed` | The judgment was corrected. |
| `judgment promoted` | The documentation does state it; it became normative text with a marker. |
| `judgment removed` | The judgment was not needed. |

The outcome counts are ledger entries, not distinct ids: a requirement or judgment examined by two
passes counts twice, while the category table counts each id once. That is why the judgments re-examined (483) exceed the judgments that exist ([470](../spec/judgments.md)).
"Not verified yet" lists the ids no pass has named; an incomplete ledger is progress, not a failure.

## The ledger format

One file per pass in `verification/`, named `v<nn>-<topic>.json`:

```json
{
  "pass": "v01-packages-env",
  "date": "2026-11-16",
  "release": "2.1.321",
  "files": ["01-packages.md", "02-manifest.md"],
  "requirements": [
    { "id": "layout.Manifest", "file": "01-packages.md", "status": "verified",
      "note": "Text matches the docs section of 2.1.321." }
  ],
  "judgments": [
    { "id": "J1.1", "status": "kept",
      "note": "Docs silent on a root plugin.json. Oracle 2.1.325 re-run: ..." }
  ]
}
```

| Field | Meaning |
| --- | --- |
| `pass`, `date`, `release` | The pass's name, the day it was made, the Claude Code release whose documentation it read |
| `files` | The chapter files it covered, relative to `extend/spec/1.1.0/` |
| `requirements[]` | `id` (from `requirements.json`), `file` (where it is marked), `status` (`verified`, `fixed` or `deviates`), `note` |
| `judgments[]` | `id` (`J<chapter>.<n>`), `status` (`kept`, `fixed`, `removed` or `promoted`), `note` |

`bun run verification --check` fails on an unknown requirement id in a pass of the snapshot's
release, an unknown status or a stale `VERIFIED.md`. A later pass that re-checks an id adds its own
entry in its own file. A ledger is never rewritten for a new release: an id that a pass of an
earlier release named and the new snapshot no longer has is listed under "Retired" in
`VERIFIED.md` and counts nowhere else, and the headline says how many verified ids were read
against the snapshot's own release.

## Reading `CORPUS.md`

Every file a schema of [`extend/schemas/1.1.0/claude-code/`](../schemas/1.1.0/claude-code/README.md)
covers, in every plugin of the corpus, is validated and compared, file by file, with the errors
the targeted Claude Code release's `claude plugin validate` printed for the same plugin (`RELEASE` in `extend/tools/src/corpus/main.ts`, 2.1.330) (the *oracle*).

| Line | Means |
| --- | --- |
| Plugins checked | Plugins with a fetched directory and an oracle run; those not fetched or without a run are counted apart |
| False rejects | Files we refuse and the oracle has no error for. The target is zero: a false reject is a plugin Claude Code runs and our schema turns away |
| Refusals no oracle error confirms | Errors of ours that reach no oracle error on the same file, even where that file has others |
| Matched | Oracle errors one of ours names on the same file: the same field, or a part or a whole of it |
| Remainder | Oracle errors none of ours matches: what a JSON Schema cannot state (a reserved name, a path on disk, a directory with nothing to validate), validator errors on values Claude Code ignores at load (a malformed `plugin.json` display field or `engines`, which the schemas accept on purpose), and what our schemas could state but do not yet. It counts the errors on every file, also those on a file no schema covers (a plugin with nothing to read): the per-schema table's **All** row counts only the files a schema covers, so the headline can be larger |
| Values Claude Code ignores | Values that `$defs/effective` refuses in files Claude Code never fails for their values (frontmatter, themes, plugin default settings); none is a false reject |

The per-schema table counts errors on validated files only; the remainder in the summary also
counts oracle errors on no file a schema covers (the plugin directory itself), which is why it is
larger than the table's.

## Mining the snapshots

Every snapshot is mined from one Claude Code release, from caches in `extend/.cache/` (git-ignored)
that are keyed by the release: `claude-docs/<release>/`, `claude-types/<release>/` and the corpus.
`bun run mine <release>` runs the steps in order; [`SOURCE.md`](SOURCE.md) says when.

### Requirements

`bun run docs:pull` downloads the documentation the site's `llms.txt` lists, as Markdown, into
`claude-docs/<release>/`, the release read from the changelog's first entry. `bun run spec:extract
[release]` reads it with the rules of `src/mine/requirements/` and writes `requirements.json`: one
entry per documented event, field, source, tool, rule example or element, with its category, page
and section. It stores identifiers, never the documentation's text.

- A table rule (`sources.ts`, `tables-extra.ts`) names a page, a heading pattern and optionally a
  header. Every rule must find something, so a page that is restructured stops the extraction.
- A cell listing several code spans (`` `min` / `max` ``) gives one requirement each.
- The mixed tables of the settings index, the environment variables and the CLI reference are
  filtered to the rows that concern plugins, hooks, skills, MCP, subagents, managed policy, updates
  and permissions; the rows they reject go to `out-of-scope.json` as `section — row`
  (`row-scope.ts` classifies the foreign rows by name).
- The output is sorted and stable; the extractor prints what was added and removed.
- It also writes `docs-tables.json`, the mods reference's tables as data (`mods-reference.ts`).

### Sections and scope

Tables give most requirements, but pages also state rules in prose. `src/mine/requirements/scope-*.ts`
audit the pages a client needs to load, install, update, configure and run plugins, section by
section:

- Every heading of level 2 to 4 of an audited page is **included** unless the page's scope skips
  it. A section the table rules already read keeps those rows; any other gives one requirement,
  `<category>.<page>.<heading>`. A section that lists rules gives one per rule: a top-level item
  that opens with a bold label or a code span, or a table row whose first cell is a short
  identifier (at most 40 characters, or the whole cell for a section the scope names `phrases`).
  The section's own id stays when it also holds unlabelled items, so prose is never dropped.
- A section a release adds therefore appears as a new requirement at the next extraction, and a
  skip that matches no heading fails it.
- A heading is **out of scope** only when its page's scope skips it for one of the reasons below,
  or it only groups sub-sections (`container`). `out-of-scope.json` lists each with its reason.

| Reason | Why a section is out of scope |
| --- | --- |
| `navigation` | Links to other pages; no behaviour. |
| `container` | Only groups sub-sections, which are classified on their own. |
| `runtime` | Claude Code's own interface, sandbox, model or account setting; a client has its own. |
| `ui` | Claude Code's own terminal, menu or dialog; nothing a client observes or implements. |
| `tutorial` | A walkthrough or sample; the behaviour it shows is stated in another section. |
| `advice` | Guidance for a person about when or how to choose; no rule. |
| `service` | Needs an Anthropic-hosted service. |
| `telemetry` | Claude Code's own telemetry and analytics pipelines. |
| `builtin` | What ships inside Claude Code, not how plugins load. |
| `model` | Model-side machinery: the classifier, caching, routing. |
| `tooling` | A Claude Code developer tool (evals, test kit, scaffolding) a client has no use for. |
| `machine` | The user's shell, terminal, git or network setup. |
| `duplicate` | Restates a rule a requirement already covers. |

### Pages and scope

Every page of the pulled documentation is classified once, by a person: **audited** (in `SCOPES`,
`src/mine/requirements/scopes.ts`) or **excluded** (in `out-of-scope-pages.json` as
`{ "page", "reason" }`; a `duplicate` also names the audited page in `of`). `spec:extract` fails when
a page is in neither list, when a listed page no longer exists or is also audited, when a reason is
unknown or has no row below, or when a `duplicate` names a page that is not audited. A page a
release adds therefore stops the extraction until someone reads it and decides. A page is audited
when it documents a plugin-host contract; [`scope-audit.md`](scope-audit.md) holds the owner's
decision and the partial-page calls.

| Reason | Why a page is out of scope |
| --- | --- |
| `product` | Claude Code surfaces (IDE, desktop, mobile, chat apps, terminal UI) and named services. |
| `hosting` | Cloud sessions, CI, self-hosted environments, gateways, containers and networking. |
| `provider` | Model provider, account, install and authentication setup. |
| `billing` | Cost, usage analytics, telemetry, data handling, legal and compliance. |
| `marketing` | Launch kits, champion guides and prompt libraries. |
| `digest` | Weekly digests and the changelog: a version index, with no rule of its own. |
| `guide` | Overview, quickstart, glossary or advice; every rule it states is on an audited page. |
| `engine` | Claude Code's own session, sandbox, context, cache and model machinery. |
| `sdk-api` | The Agent SDK's client API (options, streaming, sessions, cost); shapes are its types. |
| `duplicate` | Restates an audited page; the entry names it in `of`. |

### Declarations

Claude Code writes TypeScript declarations of the mods surface beside a mod it loads. `bun run
types:pull` gets them from the program `CLAUDE_ORACLE_BIN` names (else `claude`), in a private home
and config folder with an unusable key and no prompt typed, into `claude-types/<release>/`.
`bun run types:extract [release]` reads them through the TypeScript checker, never by their text,
into `mods-declarations.json` (E2).

### Oracle runs

Where the docs are silent or wrong, the evidence is what Claude Code does (E4a). `bun run
oracle:record` runs the program `CLAUDE_ORACLE_BIN` names (else `claude`) as a black box, isolated:
a private home, config folder and working folder, no inherited variable but `PATH`, an invalid key
and an API address nothing listens on, unless the oracle serves a fake one itself. Every outcome
names the release that answered (`claudeCodeVersion`), which may be another than the snapshot's.
`--check` writes nothing and fails when Claude Code now does something else.

Outcomes are kept by size. The fixture oracles are small, and an implementation's tests read them,
so they are committed in `oracle/` beside their fixtures and synced with the other snapshots. The
corpus oracles are large and belong to one machine's corpus checkout, so they are cached per release
in `extend/.cache/oracle/<release>/` (or `ORACLE_CACHE_DIR`) and never committed; an implementation
reads them from the checkout beside it.

| Oracle | Inputs | What Claude Code is asked | Outcome |
| --- | --- | --- | --- |
| `runtime` | `oracle/runtime/<case>/`: a plugin per case (its name is the plugin's), `oracle-settings.json` the user settings | `claude -p --plugin-dir <case> --output-format stream-json`, read up to `init` | `<case>/expected.json`: the registry, ids only (`loaded`, `agents`, `slashCommands`, `skills`, `mcpServers`, `outputStyle`) |
| `settings` | the cases of `tools/src/mine/oracle/settings-cases.ts` | the Agent SDK's `resolveSettings` and `filterEscalatingDefaultMode` per key; `claude -p` for the starting mode | `oracle/settings.json`: each case's files, keys, `sdk` values (canonical: keys sorted, lists as sorted sets) and `cli` mode; `managed` names only the keys the recording machine's managed settings set, which are not to be compared |
| `subprocess-scrub` | `oracle/subprocess-scrub/candidates.json` | a SessionStart hook's environment under `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` | `expected.json`: `left`, each value or `null` |
| `remote-mcp-env` | `oracle/remote-mcp-env/candidates.txt` | the header values `claude mcp get` sends a local server | `expected.json`: `empty`, `kept` |
| `headers-helper-env` | `oracle/headers-helper-env/candidates.txt` | the variables a supplied `headersHelper` receives | `expected.json`: `removed`, `kept` |
| `model-content` | `oracle/model-content/<case>/`: `plugin/` and `case.json` | the first request `claude -p "/<plugin>:<skill> <args>"` sends a local fake Messages API | `<case>/expected.json`: the user text blocks, normalized (`<PLUGIN_ROOT>`, `<PLUGIN_DATA>`, `<CWD>`, `<SESSION_ID>`) |
| `corpus-runtime` | every corpus plugin that runs nothing at session start | the session oracle, the built-in names taken out | `.cache/oracle/<release>/corpus-runtime/<marketplace>/<name>.json` |
| `validate-timings` | the first 30 corpus plugins by id | `claude plugin validate`, timed, median of 5 | `.cache/oracle/<release>/validate-timings.json` |

A fixture oracle RUNS its fixture (hooks, MCP servers, a skill's `!` commands): fixtures are written
for it, and a corpus plugin is asked only by `corpus-runtime`, only when it runs nothing on its way
to `init`. `init` events are cached by the folder's content hash in `.cache/oracle/<release>/init/`.
One fixture is known to answer two ways: `runtime/symlinked-duplicates` names a linked skill folder
by either name from run to run, so `--check` may report it.

### Corpus and verdicts

`bun run corpus:fetch` clones the official and community marketplaces and fetches every plugin
they list as a client would (§15.6: a relative path in place, a git source as a shallow, pinned,
sparse-when-a-subdirectory checkout; npm, archive and command sources are recorded as skipped),
writing `index.json`. `bun run corpus:oracle [release]` asks Claude Code about each plugin, as a
black box: `claude plugin validate --json` into `oracle/<release>/` (what `bun run corpus` compares
the schemas with) and `claude --plugin-dir <dir> plugin details <name>` into
`oracle-load/<release>/`. The corpus folder is `extend/.cache/corpus/`, or `CORPUS_DIR`.
