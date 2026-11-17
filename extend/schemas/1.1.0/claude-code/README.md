# Claude Code plugin schemas

JSON Schema 2020-12 schemas for the files of a Claude Code plugin, as Claude Code 2.1.321 accepts
them (Agent Plugins Extended 1.1.0, rule W4 of [`extend/AGENTS.md`](../../../AGENTS.md)). Each
`$id` is `https://localix.ai/schemas/agent-plugins-extended/1.1.0/claude-code/<name>.schema.json`.
**These identifiers are not published**: nothing is served at them yet, so a validator loads the
files of this folder and refers to them by `$id` (the schemas refer to one another that way).

| Schema | The file it describes | Specification |
| --- | --- | --- |
| [`plugin.schema.json`](plugin.schema.json) | `.claude-plugin/plugin.json` | [§2](../../../spec/1.1.0/02-manifest.md), `userConfig` [§3.4](../../../spec/1.1.0/03-environment.md), `commands` entries §4.6.2, `channels` [§9.3](../../../spec/1.1.0/09-lsp-monitors-channels.md) |
| [`marketplace.schema.json`](marketplace.schema.json) | `.claude-plugin/marketplace.json` | [§15](../../../spec/1.1.0/15-marketplaces.md) |
| [`hooks.schema.json`](hooks.schema.json) | `hooks/hooks.json` and a hooks file the manifest names; `$defs/eventMap` is the unwrapped map of the manifest's inline `hooks` | [§7.1.3, §7.2, §7.3](../../../spec/1.1.0/07-hooks/configuration.md), `modules` [§10.3.1](../../../spec/1.1.0/10-mods/reference.md) |
| [`mcp.schema.json`](mcp.schema.json) | `.mcp.json` and an MCP file the manifest names; `$defs/inlineMap` is the manifest's inline `mcpServers` | [§8.1–§8.3](../../../spec/1.1.0/08-mcp.md) |
| [`lsp.schema.json`](lsp.schema.json) | `.lsp.json`, a named LSP file, the inline `lspServers` | §9.1 |
| [`monitors.schema.json`](monitors.schema.json) | `monitors/monitors.json`, a named monitors file, the inline array | §9.2 |
| [`plugin-settings.schema.json`](plugin-settings.schema.json) | the plugin root's `settings.json`, the manifest's `settings` | [§12.6](../../../spec/1.1.0/12-settings.md) |
| [`skill-frontmatter.schema.json`](skill-frontmatter.schema.json) | the frontmatter of `SKILL.md` | [§4.4](../../../spec/1.1.0/04-skills.md) |
| [`command-frontmatter.schema.json`](command-frontmatter.schema.json) | the frontmatter of a command file | §4.6 |
| [`agent-frontmatter.schema.json`](agent-frontmatter.schema.json) | the frontmatter of an agent file | [§5.4, §5.6](../../../spec/1.1.0/05-agents.md) |
| [`output-style-frontmatter.schema.json`](output-style-frontmatter.schema.json) | the frontmatter of an output style | [§6.1.1](../../../spec/1.1.0/06-styles.md) |
| [`theme.schema.json`](theme.schema.json) | a theme file | §6.2.1 |

## Open where Claude Code is open

A schema refuses what Claude Code refuses: a file or entry it does not load, which its validator
reports as an error. It accepts what Claude Code ignores: an unknown top-level key of a manifest, a
hook entry dropped under an event other than `PreToolUse` and `PermissionRequest` (§7.2.1.1), and
every value of a file Claude Code never fails for its values. Frontmatter (after the YAML parses),
themes and plugin default settings are such files: Claude Code drops a bad value and loads the file.
Their root accepts any value, and `$defs/effective` states the values that take effect, the schema
an editor or a linter wants (`…/skill-frontmatter.schema.json#/$defs/effective`).

What a JSON Schema cannot state stays with a validator: that a path exists or stays inside the
plugin, the reserved names of §2.3 and §15.3.2, a `userConfig` default among its `options`, unique
names across entries, and `${user_config.KEY}` references across files. Each schema's `$comment`
names them.

## Measured against Claude Code

`bun run corpus` in `extend/tools/` validates every file these schemas cover in the plugins of the
official and community marketplaces and compares each verdict with Claude Code's own
`claude plugin validate` on the same plugin. The result is
[`conformance/CORPUS.md`](../../../conformance/CORPUS.md): the false rejects (the target is zero),
the oracle errors matched, and the kinds of oracle error that remain.
