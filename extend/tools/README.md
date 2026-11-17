# extend/tools

The checks and generators of Agent Plugins Extended, and the tools that mine Claude Code for the
evidence the specification is written against: Bun and TypeScript, three dependencies (`ajv` for
the schemas, `yaml` for frontmatter, `zod` for the mined files) and the TypeScript compiler, whose
checker also reads the mods declarations. Run everything from this folder.

```sh
cd extend/tools
bun install
bun run check
```

## Scripts

| Script | What it checks or writes | Rule | Run it |
| --- | --- | --- | --- |
| `bun run check` | All of the checks below, in order; stops at the first failure | — | Before calling any change done |
| `bun run typecheck` | `tsc` over `src/` | — | After changing a tool |
| `bun run check:upstream` | No file upstream owns differs from the merge base with `upstream/main`, committed or not. Ours: `extend/`, `CLAUDE.md`, `.github/README.md` | U1 | After touching anything outside `extend/`; `sync` runs it after a merge |
| `bun run check:links` | Every relative Markdown link in `extend/` names a file or directory that exists (anchors are not checked) | — | After moving, splitting or adding a file |
| `bun run check:sections` | Every `§n.m` cited in `extend/spec/` is a numbered heading there (`core §n` is the core's and is skipped) | — | After renumbering or citing a section |
| `bun run coverage` | Reads the `req:` and `deviates:` markers in `extend/spec/`, fails on an id not in `requirements.json` or an id marked both ways, writes `conformance/REPORT.md`; `--check` fails on a stale report instead of writing | C1, E4a, E5 | After any marker changes |
| `bun run verification` | Reads the ledgers in `conformance/verification/`, fails on an unknown id or status, writes `conformance/VERIFIED.md`; `--check` fails on a stale report | — | After adding or editing a ledger |
| `bun run judgments` | Writes the chapter index of `spec/judgments.md` from the "Judgments" tables of the chapters; `--check` fails on a stale index or an id two files define | E4 | After adding, removing or moving a judgment |
| `bun run corpus` | Validates every file the schemas cover in every corpus plugin and compares each verdict with Claude Code's `claude plugin validate`; writes `conformance/CORPUS.md` | W4 | After a schema change; not part of `check` |

## Mining Claude Code

The specification repository owns the evidence: every snapshot in `conformance/` is mined here from
one Claude Code release, and an implementation syncs it from here. The caches are under
`extend/.cache/` (git-ignored), keyed by release. `[release]` defaults to the newest one cached.

| Script | What it does | Reads | Writes |
| --- | --- | --- | --- |
| `bun run docs:pull` | Downloads every page `llms.txt` lists, as Markdown; `--dry-run` prints the release and page count and writes nothing | code.claude.com | `.cache/claude-docs/<release>/` |
| `bun run types:pull` | Lets Claude Code load a scratch mod in a private home, offline, and copies the declarations it writes | `CLAUDE_ORACLE_BIN` (else `claude`) | `.cache/claude-types/<release>/` |
| `bun run types:extract [release]` | The mods declarations through the TypeScript checker | `.cache/claude-types/<release>/` | `conformance/mods-declarations.json` |
| `bun run spec:extract [release]` | The requirements, by the table rules and the section and page audit (C2) | `.cache/claude-docs/<release>/`, `conformance/out-of-scope-pages.json` | `conformance/requirements.json`, `out-of-scope.json`, `docs-tables.json`, `tools-table.json` |
| `bun run corpus:fetch` | Clones the official and community marketplaces and fetches every plugin they list (§15.6); `--refresh` fetches again | github.com | `.cache/corpus/index.json` and the plugins |
| `bun run corpus:oracle [release]` | `claude plugin validate --json` and `claude plugin details` on every fetched plugin, cached per release; `--validate-only` skips the second | `CLAUDE_ORACLE_BIN` (else `claude`), the corpus | `.cache/corpus/oracle/<release>/`, `oracle-load/<release>/` |
| `bun run oracle:record [oracle…]` | Runs Claude Code as a black box on the fixtures written for it and records what it did; no oracle names every fixture oracle (`runtime`, `settings`, `subprocess-scrub`, `remote-mcp-env`, `headers-helper-env`, `model-content`); `corpus-runtime` and `validate-timings` run on the corpus only when named; `--check` writes nothing and fails on a change | `CLAUDE_ORACLE_BIN` (else `claude`), `conformance/oracle/`, the corpus | `conformance/oracle/` (fixture outcomes), `.cache/oracle/<release>/` (corpus outcomes, timings, the `init` cache) |
| `bun run mine <release>` | All of the above in order, pulling only what is not cached; `--refresh`, `--skip-corpus` | | |

`CORPUS_DIR` moves the corpus folder for `corpus:fetch`, `corpus:oracle`, `oracle:record` and `bun
run corpus`; `ORACLE_CACHE_DIR` moves `.cache/oracle`. A fixture oracle RUNS its fixtures (their
hooks, MCP servers and `!` commands): point it only at fixtures written for it. `corpus-runtime`
asks only the corpus plugins that run nothing at session start (`src/mine/oracle/session-start.ts`).
`conformance/README.md`, "Oracle runs", says what each oracle records and where.
`conformance/README.md`, "Mining the snapshots", says how each snapshot is read; `SOURCE.md` says
when to mine.

`check` runs `typecheck`, `check:upstream`, `check:links`, `check:sections`, `coverage --check`,
`verification --check` and `judgments --check`. It never fails because verification is
incomplete, only because a report is stale or an id is wrong.

## The corpus

`bun run corpus` reads, and never writes, a corpus outside the repository:

```text
$CORPUS_DIR/
├── index.json                                 { marketplace, name, dir?, skipped? } per plugin
├── <dir>/                                     each plugin's files, as fetched
└── oracle/2.1.321/<marketplace>/<name>.json   what claude plugin validate printed for it
```

`CORPUS_DIR` defaults to `extend/.cache/corpus`, filled by `corpus:fetch` and `corpus:oracle`. The
release the oracle runs are read for is `RELEASE` in `src/corpus/main.ts`. A plugin without a fetched directory or an oracle
run is counted apart, not checked.

## Merging upstream

`./sync` merges `upstream/main` (the core, `agentplugins/agent-plugins-spec`) into the current
branch.

```sh
./sync --dry-run   # fetch, list upstream's new commits and the files they change; change nothing
./sync             # the same, then merge and run check:upstream
```

1. Commit or set aside local changes: a merge needs a clean tree.
2. `./sync --dry-run`. When the incoming commits touch `spec/` or `schemas/`, it lists the chapters
   of `extend/spec/` that cite those files.
3. `./sync`. The merge cannot conflict while U1 holds.
4. Re-read every section the listed chapters cite from the changed core (U2). A rule of ours that
   now disagrees with the core becomes a judgment (U3), never an edit of the core.
5. `bun run check`.

## Layout

| File | What it does |
| --- | --- |
| `src/paths.ts` | Where the repository, `extend/`, `spec/` and `conformance/` are |
| `src/check-upstream.ts` | U1; the allow-list is `OURS` |
| `src/check-links.ts`, `src/check-sections.ts` | Links and section citations |
| `src/coverage.ts`, `src/report.ts` | Markers and `REPORT.md` |
| `src/verification.ts` | Ledgers and `VERIFIED.md` |
| `src/judgments-index.ts` | The index of `spec/judgments.md` |
| `src/corpus/` | The corpus check: plugin files, frontmatter, schemas, oracle verdicts, matching, `CORPUS.md` |
| `src/mine/paths.ts`, `src/mine/claude-bin.ts` | The release-keyed caches and the Claude Code program the oracles run |
| `src/mine/main.ts` | `mine`: the pipeline |
| `src/mine/docs/` | `docs:pull`, `types:pull` |
| `src/mine/requirements/` | `spec:extract`: the Markdown reader, the table rules (`sources.ts`, `tables-extra.ts`, `row-scope.ts`), the section audit (`scope*.ts`, `sections.ts`, `table-audit.ts`), the page audit (`page-scope.ts`), the mods tables (`mods-reference.ts`) |
| `src/mine/declarations/` | `types:extract`: the checker reader, shapes and the snapshot's schema |
| `src/mine/corpus/` | `corpus:fetch` (`plan.ts` plans each entry), `corpus:oracle` (`oracle.ts`, `load-oracle.ts`) |
| `src/mine/requirements/tools-table.ts` | `tools-table.json`: the tools table of tools-reference.md |
| `src/mine/oracle/` | `oracle:record` (`main.ts`): the isolation every run takes (`isolated.ts`), the session oracle and its `init` cache (`session.ts`), one recorder per oracle (`runtime.ts`, `settings.ts` with `settings-cases.ts`, `scrub.ts`, `remote-mcp-env.ts`, `headers-helper-env.ts`, `model-content.ts` with `model-request.ts`, `corpus-runtime.ts` with `session-start.ts`, `validate-timings.ts`), where outcomes go (`paths.ts`) |
| `sync` | Merging upstream |
