# Where the requirements come from

`requirements.json` lists every requirement of the Claude Code plugin-host contract for one Claude
Code release: 2,730 ids for Claude Code 2.1.321, each with its category and the documentation page
and section it was extracted from. It is a snapshot, never edited by hand (C2).

| | |
| --- | --- |
| Release | Claude Code 2.1.321 (`claudeCode` in the file) |
| Taken from | `spec/requirements.json` of `llx-plugin` at `018f293` (2026-11-12) |
| SHA-256 | `951539aa59389049810021273bc841bf0ceb7377d8ba43f69bfbdcda40832811` |
| Evidence | the official Claude Code documentation of that release, page and section per id |
| Scope | the plugin-host contract: what loads, validates, installs, configures and runs a plugin; the application around it (its model, scheduler, menus) is not in it |

An id reads `<category>.<kind>.<section>[.<item>]`: `hooks.behavior.Exit code 2 behavior.PreToolUse`
is the behaviour the `hooks` category takes from the section "Exit code 2 behavior" for the item
`PreToolUse`. The id is the only key a marker (C1) uses.

## Updating to a new Claude Code release

1. Extract the requirements of the new release with the same scope (the extractor and its scope
   rules live with the reference implementation; run it there, never edit its files from here).
2. Replace `requirements.json`, update the table above (release, source revision, hash).
3. `bun run coverage` in `extend/tools/` lists the ids that disappeared (their markers now fail) and
   the new ones (uncovered). Re-read each changed section in the docs and update the chapter.
