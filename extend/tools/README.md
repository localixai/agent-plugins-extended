# extend/tools

The checks and generators of Agent Plugins Extended: Bun and TypeScript, two dependencies (`ajv`
for the schemas, `yaml` for frontmatter). Run everything from this folder.

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

`CORPUS_DIR` defaults to `~/Documents/llx-plugin/.cache/corpus`. The release the oracle runs are
read for is `RELEASE` in `src/corpus/main.ts`. A plugin without a fetched directory or an oracle
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
| `sync` | Merging upstream |
