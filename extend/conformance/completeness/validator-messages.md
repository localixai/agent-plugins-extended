# Validator messages of Claude Code 2.1.321 against the specification

Re-measured 2026-11-16 after the fixes: every template is now stated, at its oracle severity.

Every distinct message `claude plugin validate` (2.1.321) printed on the corpus, normalised to a
template, and whether `extend/spec/1.1.0/` states it. Source: the oracle verdicts of 2496 plugins
(`~/Documents/llx-plugin/.cache/corpus/oracle/2.1.321/`), 4166 findings. A template replaces quoted
names, paths, numbers, field names, commands and parser text with placeholders and keeps the
fixed wording. First written 2026-11-16 against the specification before the fixes.

- **stated**: the message (its fixed wording) is quoted, at its severity.
- **stated loosely (prefix only)**: the opening of the message is quoted, the rest is not.
- **stated loosely**: the rule is there, but not the message, or not the severity.
- **missing**: neither rule nor message.

## Summary

| Status | Templates | Findings |
| --- | --- | --- |
| stated | 72 | 4166 |
| stated loosely (prefix only) | 0 | 0 |
| stated loosely | 0 | 0 |
| missing | 0 | 0 |
| total | 72 | 4166 |

Severity: no template has one severity in the oracle and another in the specification. The one
conflict of the first measurement is gone: ``hooks.json must have `hooks` (the hook matchers) or
`modules` (hooks modules), or both`` is an error in §7.2.1.1 and in §10.42.3 item 1 and J10.174,
now an E4a deviation from the docs. §2.1 item 2 (J2.5) and §7.2.1.1 keep the plugin loading
without an invalid hooks file and quote the validator's tail "At runtime this breaks the entire
plugin load." as its wording only.

Before the fixes: 16 stated, 11 stated loosely (prefix only), 36 stated loosely, 9 missing. The
"Was" column below gives each template's earlier status.

## Missing

None.

## Stated loosely

None.

## Stated loosely: prefix only

None.

## Stated

| Severity | Count | Template | Where | Was |
| --- | --- | --- | --- | --- |
| warning | 998 | `Shell command uses <vars> without quotes: <command>. If the expanded path contains a space the command can spl…` | §3.2.3 item 5, 03-environment.md | stated |
| warning | 666 | `No frontmatter block found. Add YAML frontmatter between --- delimiters at the top of the file to set descript…` | §2.11 table (02-manifest.md), §4.10 (04-skills.md), §5.4.4 (05-agents.md) | stated loosely (prefix only) |
| warning | 488 | `CLAUDE.md at the plugin root is not loaded as project context. To ship context with your plugin, use a skill (…` | §17.13.1, 17-cli.md | stated |
| warning | 325 | `No marketplace description provided. Adding a description helps users understand what this marketplace offers` | §15.10 table, 15-marketplaces.md | stated |
| warning | 320 | `Unknown field '<field>'. Claude Code ignores it at load time.` | §2.1 item 4 table (02-manifest.md), §15.10 table | stated |
| warning | 145 | `No version specified. Consider adding a version following semver (e.g., "1.0.0")` | §2.11 table, 02-manifest.md | stated loosely |
| warning | 118 | `No author information provided. Consider adding author details for plugin attribution` | §2.11 table, 02-manifest.md | stated loosely |
| error | 105 | `Invalid string: must start with "./"` | §2.1 item 3 table, §2.5 item 1 (02-manifest.md); §15.6.1 | stated loosely |
| warning | 100 | `Field '<field>' belongs in the marketplace entry (marketplace.json), not plugin.json. It's harmless here but u…` | §2.1 item 4 table, 02-manifest.md (J2.7) | stated loosely |
| error | 91 | `Plugin name "<s>" is reserved: it passes as one of Anthropic's own. A third party's plugin name cannot start w…` | §2.3 item 2, 02-manifest.md | stated loosely (prefix only) |
| error | 90 | `Path is a file; skills entries must be directories containing SKILL.md — point to the parent directory '<field…` | §2.5 item 4, 02-manifest.md (which variant when) | stated loosely (prefix only) |
| error | 60 | `Plugin name "<s>" is reserved: it passes as one of Anthropic's own. A third party's plugin name cannot start w…` | §2.3 item 2, 02-manifest.md (marketplace-entry ending) | stated loosely (prefix only) |
| warning | 59 | `Entry declares version "<s>" but <path> says "<s>". At install time, plugin.json wins (calculatePluginVersion …` | §15.5.4, 15-marketplaces.md | stated loosely (prefix only) |
| error | 46 | `Invalid input` | §2.1 item 3 table, 02-manifest.md (J2.6) | stated loosely |
| error | 39 | `Invalid input: expected string, received object` | §2.1 item 3 table, §2.2 `repository` row (02-manifest.md) | stated loosely |
| warning | 35 | `Unknown field '<field>' (commonly seen in manifests across many tools). Claude Code ignores unrecognized field…` | §2.1 item 4 table, 02-manifest.md (`manifests across many tools`) | stated loosely |
| error | 33 | `No manifest found in directory. Expected .claude-plugin/marketplace.json or .claude-plugin/plugin.json` | §2.11, §17.13.1 | stated |
| warning | 33 | `Unknown field '<field>' (commonly seen in a VS Code/Cursor extension manifest). Claude Code ignores unrecogniz…` | §2.1 item 4 table, 02-manifest.md (`a VS Code/Cursor extension manifest`) | stated loosely |
| error | 29 | `Invalid input: expected string, received undefined. The plugin loader silently drops this server at load.` | §8.3.1 table, 08-mcp.md | stated loosely |
| error | 29 | `Invalid string: must end with ".md"` | §2.1 item 3 table, §2.5 item 4 (02-manifest.md) | stated loosely |
| error | 28 | `unknown server type "<s>" — expected "stdio" (or no type) for a local command, or "http", "sse", "ws" for a re…` | §8.3.1 table, 08-mcp.md | stated loosely |
| error | 27 | `Invalid input: expected string, received undefined` | §2.1 item 3 table (02-manifest.md), §3.4.1 (03-environment.md) | stated loosely |
| warning | 27 | `No description in frontmatter. A description helps users and Claude understand when to use this agent.` | §5.4.4 table (05-agents.md), §2.11 table | missing |
| error | 20 | `Invalid option: expected one of <options>` | §2.1 item 3 table, §3.4.1 `type` row (03-environment.md) | stated loosely |
| error | 20 | `server has a "url" but no "type". Remote servers must set "type" to "http" (or "sse" / "ws"); without it the e…` | §8.3.1 table, 08-mcp.md | stated loosely |
| warning | 19 | `Plugin name "<s>" reads as one of Anthropic's own. Name it for what it does. If this is one of Anthropic's own…` | §2.3 item 2, 02-manifest.md | stated loosely (prefix only) |
| warning | 17 | `Unknown field '<field>' — did you mean '<field>'? Claude Code ignores unrecognized fields at load time, so thi…` | §2.1 item 4 table, 02-manifest.md (closeness rule, J2.7) | stated loosely |
| error | 16 | `Invalid input: expected object, received string` | §2.1 item 3 table, 02-manifest.md | stated loosely |
| warning | 16 | `Plugin name "<s>" is not kebab-case. Claude Code accepts it, but the Claude.ai marketplace sync requires kebab…` | §2.3 item 1 (02-manifest.md), §15.10 table | stated loosely (prefix only) |
| error | 13 | `Path not found: <path>. The runtime loader will report this as a load failure.` | §2.5 item 3, 02-manifest.md | stated |
| warning | 12 | `hooks.<key>: unknown hook event; entry ignored at runtime` | §7.2.1.1 table (07-hooks/configuration.md), J7.100 | stated |
| error | 9 | `Invalid input: expected object, received undefined` | §15.2, 15-marketplaces.md | stated |
| warning | 8 | `Plugin name "<s>" reads as one of Anthropic's own. Name it for what it does.` | §2.3 item 2, 02-manifest.md (marketplace-entry ending) | stated loosely (prefix only) |
| warning | 8 | `This directory is a symlink, so the validator read nothing in it. An installed plugin loads it only if it poin…` | §17.13.1 table, 17-cli.md | stated loosely |
| error | 7 | `YAML frontmatter failed to parse: <parser message>. At runtime this agent loads with its name taken from the f…` | §5.4.4 table (05-agents.md), §2.11 table, J5.17 | stated |
| warning | 7 | `No description in frontmatter. A description helps users and Claude understand when to use this command.` | §4.10 table (04-skills.md, `<kind>` command), §2.11 table | missing |
| error | 6 | `<path> is declared at the top level, outside the "hooks" object — a <path> hook that cannot be loaded may be w…` | §7.2.1.1 table, last row (07-hooks/configuration.md) | stated loosely |
| error | 6 | `Plugin name cannot contain spaces. Use kebab-case (e.g., "my-plugin")` | §2.3 item 1 (02-manifest.md), §15.4 `name` row | stated |
| warning | 6 | `<n> component here was not read — the path is not a regular file (a symlink, a FIFO, a directory). A FIFO or a…` | §17.13.1 table, 17-cli.md (not regular files, plugin) | stated loosely |
| warning | 6 | `<n> entries here are symlinks and were not read — components are read without following symlinks. A session st…` | §17.13.1 table, 17-cli.md (linked entries, plugin) | stated loosely |
| warning | 6 | `Unknown field '<field>' (commonly seen in an npm package.json). Claude Code ignores unrecognized fields at loa…` | §2.1 item 4 table, 02-manifest.md (`an npm package.json`) | stated loosely |
| error | 5 | `Claude Code cannot install plugin "<s>". Each part of a plugin id (plugin@marketplace) may use only the letter…` | §15.3.1, 15-marketplaces.md | stated |
| error | 5 | `Path not found: <path>. The plugin loader skips a missing MCP servers file without reporting it, so none of it…` | §2.5 item 3 (02-manifest.md), §8.3.1 table (08-mcp.md) | stated loosely |
| error | 5 | `hooks.json must have 'hooks' (the hook matchers) or 'modules' (hooks modules), or both` | §7.2.1.1 table (07-hooks/configuration.md), §10.42.3 item 1 and J10.174 (10-mods/troubleshooting.md) | stated loosely |
| warning | 5 | `Plugin name "<s>" is not accepted by Claude Desktop (letters, digits, ".", "_", "-"; must start alphanumeric; …` | §15.3.2, 15-marketplaces.md | stated |
| error | 4 | `Path is a file; skills entries must be directories containing SKILL.md: <path>` | §2.5 item 4, 02-manifest.md | stated |
| error | 4 | `YAML frontmatter failed to parse: <parser message>. At runtime this skill loads with empty metadata (all front…` | §4.10 table (04-skills.md), §2.11 table | stated loosely |
| warning | 4 | `No description in frontmatter. A description helps users and Claude understand when to use this skill.` | §4.10 table (04-skills.md), §2.11 table | missing |
| error | 3 | `hooks.<key>: Hook matcher "hooks" must be an array of hook entries; received undefined — a <path> hook that ca…` | §7.2.1.1 table and item 1 (07-hooks/configuration.md): the guard row with the group-without-`hooks` problem | stated loosely |
| warning | 3 | `.claude-plugin/plugin.json is a symlink or is not a regular file, so it was not validated. Install reads it an…` | §15.10 table, 15-marketplaces.md (`<path> is a symlink or ...`) | missing |
| warning | 3 | `The file is not a regular file (a symlink, a FIFO, a directory) and was not read — MCP server files are read w…` | §8.3.1 table (08-mcp.md), §17.13.1 table | missing |
| warning | 3 | `Unknown field '<field>' (commonly seen in an MCPB/DXT manifest). Claude Code ignores unrecognized fields at lo…` | §2.1 item 4 table, 02-manifest.md (`an MCPB/DXT manifest`) | stated loosely |
| warning | 3 | `hooks.<key>: Hook matcher "hooks" must be an array of hook entries; received undefined; entry ignored at runti…` | §7.2.1.1 table (07-hooks/configuration.md) | stated loosely |
| error | 2 | `A path component of <path> is not a directory, so the file cannot be read. The entry will fail to load at inst…` | §15.10 table, 15-marketplaces.md | missing |
| error | 2 | `Invalid JSON syntax: <parser message>.` | §2.1 item 2, §15.10 | stated |
| error | 2 | `Invalid input: expected array, received undefined` | §15.2, 15-marketplaces.md | stated loosely |
| error | 2 | `YAML frontmatter failed to parse: <parser message>. At runtime this command loads with empty metadata (all fro…` | §4.10 table (04-skills.md), §2.11 table | stated loosely (prefix only) |
| warning | 2 | `'<field>' is no longer read: what a hooks module hooks and calls on $ is read from its source and listed under…` | §10.3 (10-mods/reference.md), J10.21 | missing |
| warning | 2 | `No description provided. Adding a description helps users understand what your plugin does` | §2.11 table, 02-manifest.md | stated loosely |
| warning | 2 | `The hooks directory is a link (a symlink or a Windows junction) and was not read — hooks are read without foll…` | §7.2.1.1 item 3 (07-hooks/configuration.md), §17.13.1 table | missing |
| error | 1 | `File not found: <path>` | §2.11, §17.13.4 | stated |
| error | 1 | `Invalid JSON syntax: <parser message>. At runtime this breaks the entire plugin load.` | §2.1 item 2 and J2.5 (02-manifest.md), §7.2.1.1 table | stated loosely (prefix only) |
| error | 1 | `Invalid input: expected array, received object` | §15.2, 15-marketplaces.md | stated loosely |
| error | 1 | `Invalid input: expected string, received array. The plugin loader silently drops this server at load.` | §8.3.1 table, 08-mcp.md | stated loosely |
| error | 1 | `Path contains "<s>" which could be a path traversal attempt: <path>` | §2.5 item 2, 02-manifest.md | stated |
| error | 1 | `server config must be an object (got array). The plugin loader silently drops this server at load.` | §8.3.1 table (08-mcp.md), J8.27 | stated loosely |
| error | 1 | `server config must be an object (got string). The plugin loader silently drops this server at load.` | §8.3.1 table (08-mcp.md), J8.27 | stated loosely |
| warning | 1 | `'<field>' must be a mapping (key: value pairs); got string. It is dropped at load time.` | §4.10 table (04-skills.md), §2.11 table | stated loosely |
| warning | 1 | `<n> entries here are symlinks and were not read — components are read without following symlinks. A session lo…` | §17.13.1 table, 17-cli.md (linked entries, `.claude`) | stated loosely |
| warning | 1 | `<n> entry here is a symlink and was not read — components are read without following symlinks. A session loadi…` | §17.13.1 table, 17-cli.md (linked entries, `.claude`, one entry) | stated loosely |
| warning | 1 | `Could not parse <path> for version cross-check: <parser message>` | §15.5.4, §15.10 table (15-marketplaces.md) | missing |
| warning | 1 | `Local source "./" is or traverses a symlink, so .claude-plugin/plugin.json was not read — validation never fol…` | §15.6.1 item 4, 15-marketplaces.md | stated loosely (prefix only) |

## How this was made

Scripts (outside both repositories): `collect.py` reads every oracle verdict and groups findings
by (severity, template); `search.py` looks for each template's fixed fragments in
`extend/spec/`; the status of each template was then read by hand against the sections found.
The re-measurement ran `search.py` again on the fixed specification and read each hit by hand.
