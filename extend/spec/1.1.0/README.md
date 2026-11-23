# Agent Plugins Extended

**Version: 1.1.0+claude-code.2.1.330**

**Status: Working Draft**

Agent Plugins Extended is the [Agent Plugins Specification 1.1.0](../../../spec/1.1.0.md) (the
*core*) grown to the whole plugin contract of Claude Code 2.1.330. A client that implements it runs
every Agent Plugins package as the core says, and every Claude Code plugin as Claude Code does:
the same files found, the same fields accepted and refused, the same hooks run with the same
inputs and outputs, the same settings, policy, marketplaces and installs.

This document is derived from the Agent Plugins Specification, licensed under
[CC BY 4.0](../../../LICENSES/CC-BY-4.0.txt), and extends it; it does not modify it. Claude and
Claude Code are trademarks of Anthropic, PBC; this specification is independent of Anthropic.

## Version

The version is `<core version>+claude-code.<release>`: the core release it extends and the Claude
Code release whose behaviour it states. A new Claude Code release that changes the contract is a
new version of this specification, even when the core is unchanged.

## Conformance

The key words MUST, MUST NOT, REQUIRED, SHOULD, SHOULD NOT, RECOMMENDED, MAY and OPTIONAL are to be
interpreted as in RFC 2119 and RFC 8174 when, and only when, they appear in all capitals. Text
marked non-normative and the "Design decisions" of each chapter are non-normative.

A **conformant client** satisfies the core and every chapter below. A client that implements only
some chapters MUST name them when it claims support, and conforms to those chapters only; the
chapters' failure rules still apply to what it does not implement (core §11.2 and §11.3). A
**conformant plugin** is a core package, a Claude Code plugin, or both in one directory (§1.2).

## How to read this specification

This section is non-normative.

### Reading paths

| Reader | Read |
| --- | --- |
| A plugin author | §1 (the forms and where components live), §2 (the manifest), then the chapter of each component the plugin ships (§4–§11). §15 to publish through a marketplace, §17.13 for what `claude plugin validate` checks, §18.3 to write a package that also loads in a core client. |
| A client implementer | The core first (`spec/1.1.0.md`), then §1–§3 in order: every later chapter assumes how a plugin root is classified, its manifest read and its environment built. Then the component chapters the client supports, §12–§14 (settings, permissions, policy, which every component is subject to), §15–§17 (distribution and the CLI), and §18 when the client also loads core packages. |
| Someone checking compatibility | [`conformance/README.md`](../../conformance/README.md) for what each report counts, then a chapter's markers and its "Judgments" table for what the text states and what it decides. |

Each chapter has the same shape: numbered sections with the normative rules, then "Design
decisions" (why a rule is as it is, non-normative), then "Judgments" (what the chapter decides
where the documentation is silent, normative).

### References

| Written | Means |
| --- | --- |
| `§7.4` | A section of this specification, by the number of its heading. Chapters split over several files keep one numbering (§7.4 is in `07-hooks/results.md`). |
| `core §7.3` | A section of the core, Agent Plugins 1.1.0 (`spec/1.1.0.md`). |
| `J7.30`, "Judgment J7.30" | Row `J7.30` of a "Judgments" table of chapter 7 (here `07-hooks/results.md`): `J<chapter>.<n>`, unique across the chapter's files. The text that applies a judgment names it. |
| `hooks.md`, "Exit code 2 behavior" | A page and section of the Claude Code documentation of the targeted release, the evidence for the text beside it. |
| E4a | A rule of [`extend/AGENTS.md`](../../AGENTS.md); rule ids there are U, E, C and W. |

### Markers

Each normative paragraph that states a requirement of the Claude Code contract ends with an HTML
comment naming it. Rendered Markdown hides the comments; read the source to see them. The comment
holds one of two texts:

- `req:` followed by one or more ids separated by ` | `: the paragraph states these requirements of
  [`requirements.json`](../../conformance/requirements.json). An id reads
  `<category>.<kind>.<section>[.<item>]`, for example `hooks.behavior.Exit code 2 behavior.PreToolUse`,
  and is the only key between the text, the reports and an implementation's tests.
- `deviates:` followed by ids: the documentation says one thing and Claude Code does another; the
  paragraph follows Claude Code, states what the documentation says, and names the judgment that
  holds the evidence (E4a). A deviation is counted apart and never as stated.

A judgment carries no marker: it decides what the documentation does not say, so it adds nothing
to the stated share.

## Chapters

| § | Chapter | Files | Requirement categories |
| --- | --- | --- | --- |
| 1 | Packages: the two forms and how a client tells them apart | [01-packages](01-packages.md) | `layout` |
| 2 | The Claude Code manifest | [02-manifest](02-manifest.md) | `manifest` |
| 3 | Environment, substitution and user configuration | [03-environment](03-environment.md) | `environment`, `user-config` |
| 4 | Skills and commands | [04-skills](04-skills.md) | `skills`, `commands` |
| 5 | Agents | [05-agents](05-agents.md) | `agents` |
| 6 | Output styles and themes | [06-styles](06-styles.md) | `output-styles`, `themes` |
| 7 | Hooks | [README](07-hooks/README.md) (§7.1, §7.7), [configuration](07-hooks/configuration.md) (§7.2), [handlers](07-hooks/handlers.md) (§7.3), [results](07-hooks/results.md) (§7.4), [events](07-hooks/events.md) (§7.5), [tools](07-hooks/tools.md) (§7.6) | `hooks`, `tools` |
| 8 | MCP servers | [08-mcp](08-mcp.md), [08-mcp-policy](08-mcp-policy.md) (§8.11) | `mcp`, `mcp-settings` |
| 9 | LSP servers, monitors and channels | [09-lsp-monitors-channels](09-lsp-monitors-channels.md) | `lsp`, `monitors`, `channels` |
| 10 | Mods | [README](10-mods/README.md) (§10.1–2), [reference](10-mods/reference.md) (§10.3–12), [events](10-mods/events.md) (§10.13–19), [interface](10-mods/interface.md) (§10.20–28), [api](10-mods/api.md) (§10.30–36), [troubleshooting](10-mods/troubleshooting.md) (§10.40–46) | `mods` |
| 11 | Workflows | [11-workflows](11-workflows.md) | `workflows` |
| 12 | Settings | [12-settings](12-settings.md) | `settings`, `settings-merge` |
| 13 | Permissions and trust | [13-permissions](13-permissions.md) (§13.1–14), [13-trust](13-trust.md) (§13.15–20) | `permissions`, `trust` |
| 14 | Managed policy | [14-policy](14-policy.md) (§14.1–7), [14-policy-org](14-policy-org.md) (§14.8), [14-policy-mods](14-policy-mods.md) (§14.9) | `policy` |
| 15 | Marketplaces | [15-marketplaces](15-marketplaces.md) (§15.1–10), [15-marketplace-hosting](15-marketplace-hosting.md) (§15.11–17) | `marketplace` |
| 16 | Install, updates and dependencies | [16-install](16-install.md) (§16.1–15), [16-updates](16-updates.md) (§16.16–22), [16-dependencies](16-dependencies.md) (§16.23–30) | `install`, `updates`, `dependencies` |
| 17 | The plugin CLI and its diagnostics | [17-cli](17-cli.md), [17-errors](17-errors.md) | `cli` |
| 18 | The core and Claude Code in one client | [18-bridge](18-bridge.md) | — |

## See also

- [Judgments](../judgments.md): every judgment, indexed by chapter (generated).
- [Conformance](../../conformance/README.md): the requirements, how much of the contract the text
  states ([REPORT.md](../../conformance/REPORT.md)), the check of each requirement against its
  documentation section ([VERIFIED.md](../../conformance/VERIFIED.md)), and the schemas against
  real plugins ([CORPUS.md](../../conformance/CORPUS.md)).
- [Schemas](../../schemas/1.1.0/claude-code/README.md) for the Claude Code files.
- [Changelog](../../CHANGELOG.md).
