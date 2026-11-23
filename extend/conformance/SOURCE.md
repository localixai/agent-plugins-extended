# Where the requirements come from

`requirements.json` lists every requirement of the Claude Code plugin-host contract for one Claude
Code release: 2,816 ids for Claude Code 2.1.330, each with its category and the documentation page
and section it was extracted from. It is a snapshot, never edited by hand (C2). `bun run
spec:extract 2.1.330` in `extend/tools/` writes it again byte for byte from the 2.1.330 docs, and
`bun run types:extract 2.1.330` writes `mods-declarations.json` again from that release's
declarations. The other snapshots beside it come from the same release ([`README.md`](README.md),
"Mining the snapshots").

| | |
| --- | --- |
| Release | Claude Code 2.1.330 (`claudeCode` in the file) |
| Taken from | `bun run mine 2.1.330 --skip-corpus` in `extend/tools/` (2026-11-23), from the 2.1.330 docs; the previous snapshot was 2.1.321 (2,730 ids): 127 ids added, 41 removed |
| SHA-256 | `e825d5a9129bba9e4952112f96a3dec65dfe958dec637e14849a563ac78dfaf4` |
| Evidence | the official Claude Code documentation of that release, page and section per id |
| Scope | the plugin-host contract: what loads, validates, installs, configures and runs a plugin; the application around it (its model, scheduler, menus) is not in it |

An id reads `<category>.<kind>.<section>[.<item>]`: `hooks.behavior.Exit code 2 behavior.PreToolUse`
is the behaviour the `hooks` category takes from the section "Exit code 2 behavior" for the item
`PreToolUse`. The id is the only key a marker (C1) uses.

## Updating to a new Claude Code release

This repository mines Claude Code; an implementation takes the snapshots from here and never mines
its own. Everything runs in `extend/tools/`.

1. Install the release (`~/.local/share/claude/versions/<release>`, or set `CLAUDE_ORACLE_BIN`).
2. `bun run mine <release>`: pulls the docs (`docs:pull`, only the current release is served) and
   the mods declarations (`types:pull`) into `extend/.cache/`, writes `mods-declarations.json`
   (`types:extract`), `requirements.json`, `out-of-scope.json` and `docs-tables.json`
   (`spec:extract`, with `tools-table.json`), records what the release does on the fixtures of
   `oracle/` (`oracle:record`), then fetches the corpus (`corpus:fetch`) and asks the release about
   every plugin (`corpus:oracle`, `oracle:record corpus-runtime`). `--skip-corpus` stops after the
   snapshots and the fixture oracles; `--refresh` pulls again. Read the diff of `oracle/`: a changed
   outcome is a change of Claude Code's behaviour (a judgment or a deviation to revisit).
3. When `spec:extract` stops, the docs moved: a rule that finds nothing or a stale skip is fixed in
   `src/mine/requirements/`, and a new page is classified in `out-of-scope-pages.json` or audited
   in a `scope-*.ts` (`README.md`, "Pages and scope"). Read the added and removed ids it prints.
4. Update the table above (release, source, hash), set `RELEASE` in `src/corpus/main.ts`, and run
   `bun run corpus` for `CORPUS.md`.
5. `bun run coverage` lists the ids that disappeared (their markers now fail) and the new ones
   (uncovered). Re-read each changed section in the docs and update the chapter.
6. Commit the snapshots, the scope changes and the chapters together; implementations sync from
   that commit.
