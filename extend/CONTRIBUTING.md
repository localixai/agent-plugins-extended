# Contributing to Agent Plugins Extended

The rules are in [`AGENTS.md`](AGENTS.md); each has an id, and a change cites the ones it touches.
The core's own process ([`../CONTRIBUTING.md`](../CONTRIBUTING.md)) governs upstream's files, which
are never changed here.

## Making a change

1. **Stay in `extend/`.** Never edit `spec/`, `schemas/` or any other file upstream owns (U1). A
   disagreement with the core is a judgment row, not an edit (U3).
2. **Start from the evidence.** Claude Code's behaviour comes from its documentation of the targeted
   release, cited by page and section beside the text (E1); shapes from its official types (E2).
   Write the contract in your own words.
3. **Mark what the text states.** A normative paragraph that states a requirement ends with its
   `req:` marker, ids exact (C1). Never edit `requirements.json` (C2).
4. **Record what the documentation does not say.** A decision where the documentation is silent is
   a judgment: named in the text ("Judgment J4.3"), a row in the chapter's "Judgments" table with
   its evidence, never a marker (E4). Where the documentation and Claude Code's behaviour disagree,
   the text follows the behaviour, the judgment states both with the releases it was run on, and
   the marker is `deviates:` (E4a).
5. **Write the reason down.** Why a rule is as it is goes to the chapter's "Design decisions" (W1).
6. **A new chapter or a large rewrite** follows "How to write a chapter" in `AGENTS.md`.
7. **A schema change** keeps the schema open where Claude Code is open and closed where it refuses
   (W4), and is followed by `bun run corpus`: false rejects stay at zero.
8. **A verification pass** adds a ledger to `conformance/verification/`
   ([the format](conformance/README.md#the-ledger-format)), then `bun run verification`.
9. **Note it** under `## [Unreleased]` in [`CHANGELOG.md`](CHANGELOG.md).

## Checks

```sh
cd extend/tools
bun run coverage     # after a marker changes
bun run judgments    # after a judgment is added, removed or moved
bun run check        # must pass before a change is done
```

[`tools/README.md`](tools/README.md) describes each script. Never claim compatibility from your own
reading: only the generated reports say it (E5).

## Commits

Commit only when the owner asks, and never push: the repository is local until the owner says
otherwise.
