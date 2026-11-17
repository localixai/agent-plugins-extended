# Conformance

How much of the Claude Code plugin contract the specification states, how each statement was
checked, and how the schemas fare on real plugins. Everything here is either a snapshot that is
never edited by hand or a report that a script writes; the specification never states its own
compatibility (E5).

| File | What it is | Produced by | When it changes |
| --- | --- | --- | --- |
| [`requirements.json`](requirements.json) | Every requirement of the Claude Code plugin-host contract for one release: 2,730 ids in 28 categories, from 50 documentation pages | Extracted from the documentation of Claude Code 2.1.321 ([`SOURCE.md`](SOURCE.md)) | Only with a new Claude Code release (C2) |
| [`SOURCE.md`](SOURCE.md) | Where the snapshot came from: release, source revision, hash, scope; how to update it | By hand, with the snapshot | With the snapshot |
| [`REPORT.md`](REPORT.md) | The stated share: per category and per chapter file | `bun run coverage` | Whenever a marker is added, removed or changed |
| [`verification/`](verification/) | The ledgers: one JSON file per verification pass | By the reader of each pass | When a pass is made |
| [`VERIFIED.md`](VERIFIED.md) | Which requirements were read against their documentation section, and the outcomes | `bun run verification`, from the ledgers | When a ledger changes |
| [`CORPUS.md`](CORPUS.md) | The schemas against every plugin of the official and community marketplaces, compared with Claude Code's own validator | `bun run corpus` | When a schema changes |

The scripts are run in `extend/tools/` ([`tools/README.md`](../tools/README.md)). `bun run check`
fails when `REPORT.md` or `VERIFIED.md` is stale; `CORPUS.md` needs the corpus on disk and is
refreshed by hand.

## How the pieces connect

```text
requirements.json --(ids)--> markers in extend/spec/ ----> REPORT.md    stated, deviating, missing
        |                            |
        |                            +-- read against docs --> verification/*.json --> VERIFIED.md
        |
Claude Code docs, 2.1.321

extend/schemas/ + corpus of real plugins + claude plugin validate verdicts ----> CORPUS.md
```

## `requirements.json`

```json
{
  "claudeCode": "2.1.321",
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
passes counts twice, while the category table counts each id once. That is why the judgments re-examined (407) exceed the judgments that exist ([405](../spec/judgments.md)).
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

`bun run verification --check` fails on an unknown requirement id, an unknown status or a stale
`VERIFIED.md`. A later pass that re-checks an id adds its own entry in its own file.

## Reading `CORPUS.md`

Every file a schema of [`extend/schemas/1.1.0/claude-code/`](../schemas/1.1.0/claude-code/README.md)
covers, in every plugin of the corpus, is validated and compared, file by file, with the errors
Claude Code 2.1.321's `claude plugin validate` printed for the same plugin (the *oracle*).

| Line | Means |
| --- | --- |
| Plugins checked | Plugins with a fetched directory and an oracle run; those not fetched or without a run are counted apart |
| False rejects | Files we refuse and the oracle has no error for. The target is zero: a false reject is a plugin Claude Code runs and our schema turns away |
| Refusals no oracle error confirms | Errors of ours that reach no oracle error on the same file, even where that file has others |
| Matched | Oracle errors one of ours names on the same file: the same field, or a part or a whole of it |
| Remainder | Oracle errors none of ours matches: what a JSON Schema cannot state (a reserved name, a path on disk, a directory with nothing to validate), and what our schemas could state but do not yet |
| Values Claude Code ignores | Values that `$defs/effective` refuses in files Claude Code never fails for their values (frontmatter, themes, plugin default settings); none is a false reject |

The per-schema table counts errors on validated files only; the remainder in the summary also
counts oracle errors on no file a schema covers (the plugin directory itself), which is why it is
larger than the table's.
