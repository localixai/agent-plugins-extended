# Changelog

All notable changes to Agent Plugins Extended. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/). A version is
`<core version>+claude-code.<release>` (see the [specification](spec/1.1.0/README.md#version)).

## [Unreleased]

The first working draft, `1.1.0+claude-code.2.1.321`: the Agent Plugins Specification 1.1.0
extended to the plugin contract of Claude Code 2.1.321.

### Added

- The specification, 18 chapters in `spec/1.1.0/`: packages and the two forms (§1), the Claude Code
  manifest (§2), environment and user configuration (§3), skills and commands (§4), agents (§5),
  output styles and themes (§6), hooks (§7), MCP servers (§8), LSP servers, monitors and channels
  (§9), mods (§10), workflows (§11), settings (§12), permissions and trust (§13), managed policy
  (§14), marketplaces (§15), install, updates and dependencies (§16), the plugin CLI and its
  diagnostics (§17), and the core and Claude Code in one client (§18), with dual packages and
  conversion.
- "How to read this specification" in the specification's front page: reading paths, references,
  markers.
- 405 judgments where the documentation is silent, each with its evidence, and a generated index
  (`spec/judgments.md`).
- The requirements snapshot of Claude Code 2.1.321 (`conformance/requirements.json`, 2,730 ids)
  and the coverage report: 2,723 stated, 7 deviations (E4a), none missing.
- Verification of every requirement against its documentation section, in 14 passes recorded as
  ledgers (`conformance/verification/`), and the report `conformance/VERIFIED.md`.
- JSON Schema 2020-12 for the twelve kinds of Claude Code plugin file
  (`schemas/1.1.0/claude-code/`), and the corpus check against 2,495 real plugins and Claude Code's
  own validator: 0 false rejects (`conformance/CORPUS.md`).
- Tools (`tools/`): the U1 check, links, section citations, coverage, verification, the judgments
  index, the corpus check, and `sync` for merging upstream.
- Documentation: the GitHub front page (`.github/README.md`), and guides for `conformance/`,
  `tools/` and contributing.
