# 2. The Claude Code manifest

The manifest of a Claude Code plugin is `.claude-plugin/plugin.json`. It carries the plugin's
metadata and user configuration, and declares the components that are inline or outside their
default locations (§1.4). Evidence: `plugins/manifest-reference.md` unless a section names another
page.

## 2.1 Loading

1. The manifest is optional (§1.2). A plugin without one loads the components in its default
   locations.
2. The manifest MUST be a JSON object. A file that is not valid JSON, or not an object, stops the
   plugin from loading; the client reports it with the parse error, and a validator reports it as
   an error at `json`, `Invalid JSON syntax: <parse error>.` A manifest that opens with a UTF-8
   byte order mark is read past it (Judgment J2.3). (`plugins/troubleshooting.md`,
   "`claude plugin validate` reports errors".) <!-- req: manifest.troubleshooting.claude plugin validate reports errors.Invalid JSON syntax: <parse error> -->
   A `hooks/hooks.json` that is not valid JSON, one that opens with a byte order mark included,
   does **not** stop the plugin: the client MUST load the plugin's other components without the
   hooks of that file and report `Failed to load hooks from <path>: <reason>` (§7;
   `plugins/troubleshooting.md`, "Hooks fail to load"). A validator reports the file as an error
   at `json` in Claude Code 2.1.321's words, `Invalid JSON syntax: <parse error>. At runtime this
   breaks the entire plugin load.`; that tail is the validator's own text and does not describe
   loading (Judgment J2.5). A hooks file that parses but declares a `PreToolUse` or
   `PermissionRequest` hook the client cannot load does stop the whole plugin (§7.2.1.1).
3. `name` is the only required field. Every other field is optional and MUST match the type in
   §2.2 when present; a type mismatch stops the plugin from loading. A validator reports each
   mismatch as an error at the field's path, in the wording of Claude Code's schema check
   (Judgment J2.6):

   | Problem | Message | Example path |
   | --- | --- | --- |
   | A value of another type | `Invalid input: expected <type>, received <type>` | `repository: Invalid input: expected string, received object`; `author: Invalid input: expected object, received string` |
   | A required field missing | `Invalid input: expected <type>, received undefined` | `name`; `userConfig.<key>.title` (§3.4.1) |
   | A value that fits none of a field's shapes | `Invalid input` | `commands`, `skills`, `agents`, `mcpServers`, `workflows` |
   | A value outside a fixed list | `Invalid option: expected one of <values>` | `userConfig.<key>.type` (§3.4.1) |
   | A path without `./`, an agent that is not `.md` | `Invalid string: must start with "./"`, `Invalid string: must end with ".md"` | §2.5 |
4. An unrecognised **top-level** field is removed and the plugin loads; a validator reports each
   one as a warning. An unrecognised key inside a **strict object** — a `userConfig` option, a
   `channels` entry, an `lspServers` configuration or a `monitors` entry — is an error and the
   plugin does not load.
   <!-- req: manifest.rule.Unrecognized fields | manifest.troubleshooting.claude plugin validate reports errors.Unknown field '<key>' -->
   The warning for a top-level field is the first of these that fits (Judgment J2.7):

   | The field | Warning |
   | --- | --- |
   | belongs to a marketplace entry: `category`, `tags`, `id`, `strict`, `source` | `Field '<key>' belongs in the marketplace entry (marketplace.json), not plugin.json. It's harmless here but unused — Claude Code ignores it at load time.` |
   | is `user_config` | `Field 'user_config' is the cross-tool spelling of Claude Code's 'userConfig'. Rename it to 'userConfig' for Claude Code to read it (the option shapes differ slightly — re-run validate after renaming to check). As-is, Claude Code ignores it at load time.` |
   | is a known field of another manifest format | `Unknown field '<key>' (commonly seen in <format>). Claude Code ignores unrecognized fields at load time, so it's safe to keep.`, with `<format>` one of `an npm package.json` (`main`, `type`, `contributors`, `scripts`, `bin`, `files`, `private`), `a VS Code/Cursor extension manifest` (`categories`, `publisher`, `engines`, `activationEvents`, `contributes`, `preview`), `an MCPB/DXT manifest` (`compatibility`, `dxt_version`), `an MCP server manifest` (`server`, `tools`, `prompts`) or `manifests across many tools` (`logo`, `changelog`, `readme`, `support`, `_comment`, `privacy_policy`, `privacy_policies`) |
   | is close to a documented field: the same ignoring letter case and `_`, or at most two edits away (`keyword`, `display_name`, `Name`, `versoin`, `auth`) | `Unknown field '<key>' — did you mean '<field>'? Claude Code ignores unrecognized fields at load time, so this field has no effect.` |
   | anything else | `Unknown field '<key>'. Claude Code ignores it at load time.` |

## 2.2 Fields

A *path* is a string relative to the plugin root that follows §2.5.

| Field | Type | Meaning |
| --- | --- | --- |
| `$schema` | string | A JSON Schema URL for editors. The client ignores it. <!-- req: manifest.field.$schema --> |
| `name` | string | Plugin identifier, required (§2.3). <!-- req: manifest.field.name --> |
| `displayName` | string | Name shown in place of `name` (§2.4). <!-- req: manifest.field.displayName --> |
| `version` | string | Version string (§2.4). <!-- req: manifest.field.version --> |
| `description` | string | Short explanation of what the plugin provides. <!-- req: manifest.field.description --> |
| `author` | object | `name` (string, required), `email` and `url` (strings, optional). A string such as `"Ada <ada@example.com>"` is a type mismatch and the plugin does not load (§2.1 item 3). <!-- req: manifest.field.author --> |
| `homepage` | string | Documentation URL. It MUST parse as a URL, or the plugin does not load. <!-- req: manifest.field.homepage --> |
| `repository` | string | Source repository URL. The client does not check that the string is a URL, but the value MUST be a string: an object such as npm's `{ "type": "git", "url": "…" }` is a type mismatch and the plugin does not load (§2.1 item 3). <!-- req: manifest.field.repository --> |
| `license` | string | SPDX identifier such as `MIT`. <!-- req: manifest.field.license --> |
| `keywords` | string[] | Discovery tags. <!-- req: manifest.field.keywords --> |
| `metadata` | object | Free-form data of the author's; the client does not read it (§2.4). <!-- req: manifest.field.metadata --> |
| `icon` | string | Directory listing field (§2.4). <!-- req: manifest.field.icon --> |
| `documentationUrl` | string | Directory listing field (§2.4). <!-- req: manifest.field.documentationUrl --> |
| `supportUrl` | string | Directory listing field (§2.4). <!-- req: manifest.field.supportUrl --> |
| `privacyPolicyUrl` | string | Directory listing field (§2.4). <!-- req: manifest.field.privacyPolicyUrl --> |
| `termsOfServiceUrl` | string | Directory listing field (§2.4). <!-- req: manifest.field.termsOfServiceUrl --> |
| `defaultEnabled` | boolean | Whether the plugin starts enabled when the user has not set it; default `true` (§2.4). <!-- req: manifest.field.defaultEnabled --> |
| `dependencies` | array of strings or objects | Plugins that must be enabled for this one to work (§2.4, §16). <!-- req: manifest.field.dependencies --> |
| `settings` | object | Defaults applied while the plugin is enabled (§2.4). <!-- req: manifest.field.settings --> |
| `userConfig` | object | Values the client asks the user for when the plugin is enabled (§3.4). <!-- req: manifest.field.userConfig --> |
| `types` | path | A `.d.ts` file declaring a mod's `$.state` values and `$` nouns (§10). <!-- req: manifest.field.types --> |
| `channels` | array of objects | Message channels, each bound to one of the plugin's MCP servers (§9.3). <!-- req: manifest.field.channels --> |
| `skills` | path or path[] | Directories to scan for skills, each a directory of `<name>/SKILL.md` folders or one folder holding `SKILL.md` directly; `"."` names the plugin root; adds to `skills/` (§2.6, §4). <!-- req: manifest.field.skills --> |
| `commands` | path, path[] or object | Command files, directories, or a map of command name to entry (§2.7); replaces `commands/`. <!-- req: manifest.field.commands --> |
| `agents` | path or path[] | Agent `.md` files, not directories; replaces `agents/` (§5). <!-- req: manifest.field.agents --> |
| `hooks` | path, object, or an array of either | Hook files or inline hook configuration; merges with `hooks/hooks.json` (§2.8). <!-- req: manifest.field.hooks --> |
| `mcpServers` | path, object, or an array of either | MCP configuration files, MCP bundles, or inline servers; merges with `.mcp.json` (§2.9). <!-- req: manifest.field.mcpServers --> |
| `lspServers` | path, object, or an array of either | LSP configuration files or inline servers; merges with `.lsp.json` (§2.10). <!-- req: manifest.field.lspServers --> |
| `outputStyles` | path or path[] | Output style files or directories; replaces `output-styles/` (§6.1). <!-- req: manifest.field.outputStyles --> |
| `workflows` | path or path[] | Workflow `.js` files or directories; replaces `workflows/` (§11). <!-- req: manifest.field.workflows --> |
| `experimental` | object | Holds `themes`, `monitors` and `evals`, whose shape may still change. <!-- req: manifest.field.experimental --> |
| `experimental.themes` | path or path[] | Theme files or directories; replaces `themes/` (§6.2). A top-level `themes` key still loads, with a validator warning. <!-- req: manifest.field.experimental.themes --> |
| `experimental.monitors` | path or array | A `.json` file holding the monitors array, or the array itself; default `monitors/monitors.json` (§9.2). A top-level `monitors` key still loads, with a validator warning. <!-- req: manifest.field.experimental.monitors --> |
| `experimental.evals` | path or path[] | The directory below the plugin root that holds the plugin's eval cases when it is not `evals/`; `claude plugin eval --eval-dir` overrides it. It is not a component path: §2.5 does not apply, it is checked by the eval runner, may omit `./`, and of an array only the first entry is used. <!-- req: manifest.field.experimental.evals --> |

## 2.3 `name`

1. `name` MUST be non-empty and MUST NOT contain whitespace, `@`, `:`, a path separator (`/` or
   `\`), a control character (Unicode `Cc`) or a bidirectional-formatting character
   (`Bidi_Control`). A plugin whose name breaks this does not load: every component is namespaced
   under the name, so an agent `reviewer` of plugin `deploy-tools` is `deploy-tools:reviewer`. A
   validator reports a name with a space as `Plugin name cannot contain spaces. Use kebab-case
   (e.g., "my-plugin")` and one with a control or bidirectional-formatting character as `Plugin
   name cannot contain control or bidirectional-formatting characters`, and nothing else about
   that name. Kebab-case is RECOMMENDED; a validator warns about any other name,
   `Plugin name "<name>" is not kebab-case. <advice>`, where the advice says how badly the name
   breaks (Judgment J2.8):

   | The name | `<advice>` |
   | --- | --- |
   | holds other white space, `@`, `:`, `/`, `\` or an invisible mark (U+200B-U+200D, U+2060, U+FEFF, U+061C) | `Claude Code refuses a plugin with this name when it is loaded by path (such as --plugin-dir), and cannot install it from a marketplace that lists it under this name. The Claude.ai marketplace sync requires kebab-case (lowercase letters, digits, and hyphens only, e.g., "my-plugin").` |
   | is not an install id (`[A-Za-z0-9][A-Za-z0-9._-]*`) | `Claude Code cannot install it from a marketplace that lists it under this name, and the Claude.ai marketplace sync requires kebab-case (...)` |
   | any other | `Claude Code accepts it, but the Claude.ai marketplace sync requires kebab-case (...)` |

   (`(...)` is the parenthesis of the first row.)
2. A validator MUST refuse a name that passes as one of Anthropic's own plugins. The comparison
   ignores case and treats any run of non-alphanumeric characters as one separator:

   | Name | Result |
   | --- | --- |
   | starts with `claude-`, `anthropic-`, `anthropics-` or `cc-plugin-` | error <!-- req: manifest.rule.name.claude- --> |
   | is `claude`, `anthropic`, `anthropics`, `claude-code` or `claude-mods` | error <!-- req: manifest.rule.name.claude --> |
   | puts `official` beside `claude` or `anthropic`, as in `official-claude-tools` | error <!-- req: manifest.rule.name.official --> |
   | has `claude`, `anthropic` or `anthropics` as a whole word elsewhere, as in `mcp-for-claude` | warning |

   The error reads, for a `plugin.json`:

   ```text
   Plugin name "<name>" is reserved: it passes as one of Anthropic's own. A third party's plugin
   name cannot start with "claude-", "anthropic-", "anthropics-", or "cc-plugin-", be "claude",
   "anthropic", "anthropics", "claude-code", or "claude-mods", or put "official" beside "claude"
   or "anthropic". Name it for what it does. If this is one of Anthropic's own plugins, validate
   the marketplace that lists it.
   ```

   (one line, wrapped here), and the warning `Plugin name "<name>" reads as one of Anthropic's
   own. Name it for what it does. If this is one of Anthropic's own plugins, validate the
   marketplace that lists it.` For a marketplace entry's `name` both messages end at `Name it for
   what it does.`, without the last sentence (oracle 2.1.321, corpus). The check is the validator's and
   the scaffolding tools': a client still installs and loads a plugin whose name draws the error. A
   validator checking a marketplace does not apply this rule to the entries of a marketplace whose
   name is one of the official names of §15.3.2 item 1, nor to the manifests those entries point
   at; a plugin directory validated on its own is checked whatever lists it (Judgment J2.2). <!-- req: manifest.rule.name.claude | manifest.rule.name.claude- | manifest.rule.name.official -->
3. Without a manifest, the name is the marketplace entry's `name`, or the directory's name for a
   plugin loaded from a path (§1.2).

## 2.4 Metadata

- **`displayName`** MAY contain spaces and any casing. It is for presentation only and is never used
  for namespacing or lookup. For a plugin installed from a marketplace, the entry's `displayName`
  takes precedence. <!-- req: manifest.rule.displayName -->
- **`version`** is not checked against Semantic Versioning. When set, it pins the plugin: the client
  keeps users on that version until the value changes (§16). It does not pin a plugin whose
  marketplace source is a `command`, a plugin from a marketplace hosted on claude.ai, or a plugin
  loaded in place from a marketplace added from a local path. <!-- req: manifest.rule.version -->
- **`metadata`** is the author's own data, such as catalog or entitlement fields. The client MUST
  accept any object there and MUST NOT give it meaning. <!-- req: manifest.rule.metadata -->
- **Directory listing fields** — `icon` (the path of an image inside the plugin, such as
  `./logo.png`), `documentationUrl`, `supportUrl`, `privacyPolicyUrl` and `termsOfServiceUrl` (each
  an `https://` URL) — are read by Anthropic's plugin directory for a listing and ignored by the
  client at load. A validator MUST NOT report them as unknown in `plugin.json`, and MUST report each
  as an unknown field in a marketplace entry, where they do not belong. <!-- req: manifest.rule.Directory listing fields -->
- **`defaultEnabled`** applies only while the user's `enabledPlugins` (§12) has no entry for the
  plugin. A plugin that an enabled plugin depends on starts enabled regardless, and a marketplace
  entry's `defaultEnabled` overrides the manifest's. Once an `enabledPlugins` entry is written it
  persists across updates, so a later release that changes `defaultEnabled` does not change an
  existing user's setting. <!-- req: manifest.rule.defaultEnabled -->
- **`dependencies`**: each entry is `"name"`, `"name@marketplace"`, or an object
  `{ "name", "marketplace"?, "version"? }`. A bare name resolves against this plugin's own
  marketplace; §16 defines resolution and version constraints. <!-- req: manifest.rule.dependencies -->
- **`settings`**: only `agent` and `subagentStatusLine` take effect; every other key is dropped at
  load. A root `settings.json` that sets at least one supported key takes precedence over this
  field (§12.6). <!-- req: manifest.rule.settings -->

## 2.5 Path rules

1. Every component path in a manifest is relative to the plugin root and MUST start with `./`; a
   path such as `commands/foo.md` is an error, `Invalid string: must start with "./"` at the key
   (`hooks`) or the array element (`skills.0`), and like any schema error it stops the plugin from
   loading (Judgment J2.6). Two exceptions: `skills` also accepts `"."` (`"."` and `"./"` both name
   the plugin root), and `mcpServers` also accepts an `https://` bundle URL (§2.9).
2. **Containment.** A path that resolves outside the plugin root does not load. The client reports
   `<component> path escapes plugin directory: <path>` and drops the path; a validator reports a
   path containing `..` as `Path contains ".." which could be a path traversal attempt: <path>`.
3. **Existence.** A declared path that does not exist does not load. The client reports
   `<component> path not found: <absolute path>`, with the advice to check the path in the manifest
   or marketplace entry, for `commands`, `skills`, `agents` and `hooks` alike; a validator reports
   `Path not found: <path>. The runtime loader will report this as a load failure.` Only that path
   is dropped: the plugin's other components still load (Judgment J2.6). For an `mcpServers` file
   the validator's message is `Path not found: <path>. The plugin loader skips a missing MCP
   servers file without reporting it, so none of its servers will load.` (§2.9).
   <!-- req: manifest.rule.Containment and existence | manifest.troubleshooting.commands path not found: <path> -->
4. **Path-only fields.** `agents`, `skills`, `outputStyles`, `workflows` and `experimental.themes`
   take one path or an array of paths. `agents` entries MUST be `.md` files: any other is the
   schema error `Invalid string: must end with ".md"`, and the plugin does not load. `skills`
   entries MUST be directories. An entry naming a file is an error and is dropped, the rest of the
   plugin loading: for a file named `SKILL.md` the validator reports `Path is a file; skills
   entries must be directories containing SKILL.md — point to the parent directory '<dir>'
   instead: <path>`, for any other file `Path is a file; skills entries must be directories
   containing SKILL.md: <path>` (oracle 2.1.321, corpus). The other three accept a file or a
   directory. <!-- req: manifest.rule.Path-only fields -->

## 2.6 How a key combines with its default location

| Mode | Keys | Behaviour |
| --- | --- | --- |
| Replaces the default | `commands`, `agents`, `outputStyles`, `workflows`, `experimental.themes`, `experimental.monitors` | The default location is not scanned. To keep it, list it: `"commands": ["./commands/", "./extras/"]`. <!-- req: manifest.rule.How each key combines with its default location.Replaces the default --> |
| Adds to the default | `skills` | `skills/` is still scanned and the listed directories load beside it. <!-- req: manifest.rule.How each key combines with its default location.Adds to the default --> |
| Merges | `hooks`, `mcpServers`, `lspServers` | The default file loads first; what the manifest declares merges into it (§2.8–§2.10). <!-- req: manifest.rule.How each key combines with its default location.Merges --> |

When a default folder exists and the manifest sets the key that replaces it, the client loads the
manifest's paths, not the folder, and its plugin list shows `Default <folder>/ folder is ignored
because the manifest sets "<key>"`. A key that names a path inside the default folder, such as
`"commands": ["./commands/deploy.md"]`, does not draw the warning.

A `commands` path that exists but holds no `.md` file and no `SKILL.md` in a subdirectory loads
nothing, and the client records only a debug-log line, `Warning: No commands found in plugin <name>
custom directory: <path>. Expected .md files or SKILL.md in subdirectories.` <!-- req: manifest.troubleshooting.Warning: No commands found in plugin <name> custom directory -->

## 2.7 `commands`

A `commands` path names a flat `.md` command file or a directory of them. The object form maps a
command name to an entry; the key becomes the command name after the plugin prefix, so `"about"` in
plugin `deploy-tools` runs as `/deploy-tools:about`. An entry sets exactly one of `source` or
`content`; one that sets both or neither fails validation.

| Field | Type | Meaning |
| --- | --- | --- |
| `source` | path | The command's Markdown file. |
| `content` | string | Inline Markdown body, instead of `source`. |
| `description` | string | Description shown for the command. |
| `argumentHint` | string | Argument hint shown after the name, such as `[file]`. |
| `model` | string | Default model for the command. |
| `allowedTools` | string[] | Tools the command may use without prompting. |

## 2.8 `hooks`

`hooks` takes a `.json` file path, an inline object, or an array mixing both. A hooks **file** wraps
the event map in a top-level `"hooks"` key, as `hooks/hooks.json` does; a file holding only the
event map does not load. An **inline object** is the event map itself, with no wrapper. Whatever the
manifest declares merges with `hooks/hooks.json` when that file exists. §7 defines events and
handlers. <!-- req: manifest.rule.hooks -->

## 2.9 `mcpServers`

`mcpServers` takes a `.json` file path, an MCP bundle path or URL, an inline map of server name to
configuration, or an array mixing them. The client loads `.mcp.json` first, then each declared
value in order; a server name declared later replaces an earlier one. A declared file that does
not exist is skipped silently at load, so none of its servers start; a validator reports it as an
error, `Path not found: <path>. The plugin loader skips a missing MCP servers file without
reporting it, so none of its servers will load.` (oracle 2.1.321, corpus).

| Shape | Example | Behaviour |
| --- | --- | --- |
| `.json` file path | `"./mcp/servers.json"` | The file is read as an `mcpServers` map. |
| bundle path | `"./bundle.mcpb"` | The `.mcpb` or `.dxt` bundle is extracted into `.mcpb-cache/` under the plugin root and its server configuration read. |
| bundle URL | `"https://example.com/server.mcpb"` | The bundle is downloaded into `.mcpb-cache/`, then read. |
| inline map | `{ "api": { "command": "node" } }` | The map is used as server configurations keyed by name. |

A bundle path or URL MUST end in `.mcpb` or `.dxt`; any other extension fails validation. A
validator checks every server the plugin declares — in `.mcp.json`, in a named file, or inline —
and reports as errors an entry the client would drop, a `${user_config.KEY}` reference to an option
the manifest does not declare, and a remote `url` that is not an absolute URL; as warnings, an
`http://` or `ws://` URL to a non-loopback host and a header value that looks like a literal
credential. §8 defines server configuration.

## 2.10 `lspServers` and monitors

`lspServers` takes a `.json` file path, an inline map of server name to configuration, or an array
of either. The client loads `.lsp.json` first, then each declared value in order; a later name
replaces an earlier one. Each configuration is a strict object (§9.1).

`experimental.monitors` takes a `.json` file path or the inline array. Without the key, the client
loads `monitors/monitors.json` when it exists. Each entry is a strict object (§9.2).

## 2.11 Validation

`claude plugin validate <path>` is the reference validator, and an Extended client's validator
(§17) MUST reach the same verdict on the same input. A run with any error prints `Found N errors`
and `Validation failed` and exits with code 1 (§17):

- **Passed**: the manifest loads.
- **Passed with warnings**: the manifest loads, with something to fix — an unknown top-level field
  (§2.1 item 4), a `name` that is not kebab-case (§2.3), a missing `version`, `description` or
  `author`. `--strict` turns warnings into failures. The three missing-field warnings read, at
  `version`, `description` and `author`:

  | Missing | Warning |
  | --- | --- |
  | `version` | `No version specified. Consider adding a version following semver (e.g., "1.0.0")` |
  | `description` | `No description provided. Adding a description helps users understand what your plugin does` |
  | `author` | `No author information provided. Consider adding author details for plugin attribution` |
- **Failed**: a type mismatch, a path that is missing or escapes the plugin root, an unknown key in
  a strict object. The client reports the same problem when it loads the plugin.

The validator reads `.claude-plugin/plugin.json` for a plugin directory,
`.claude-plugin/marketplace.json` for a marketplace directory, and both for a directory holding
both; for a marketplace, a problem in an entry's own manifest is prefixed with the entry index, as
`plugins[1] plugin.json → json: ...`. Given a path that does not exist, it reports `File not found: <path>`. Given a directory
with no `.claude-plugin/` manifest, it validates the components it finds there as a plugin without
a manifest (§17), and with none to validate it reports `No manifest found in directory. Expected
.claude-plugin/marketplace.json or .claude-plugin/plugin.json`. The troubleshooting table gives
`File not found` also for a directory with no manifest; this rule follows Claude Code's behaviour
instead (Judgment J2.1, E4a). <!-- deviates: manifest.troubleshooting.claude plugin validate reports errors.File not found: <path> -->
For a plugin directory it also reads each skill, agent and command file of the default folders,
`skills/<name>/SKILL.md` and every `.md` under `agents/` and `commands/`; a folder the manifest
declares instead is not read, nor is any component of a marketplace root that has no `plugin.json`.
A directory with neither manifest counts as having components only when it has a skills tree
(`skills/<name>/SKILL.md`) or a project `.claude/` folder holding skills, agents or commands
(`.claude/skills/<name>/SKILL.md`, `.claude/agents/*.md`, `.claude/commands/*.md`); a directory
with only `agents/` or only `commands/`, or only a root `SKILL.md`, draws `No manifest found in
directory`. With a skills tree the validator reads `skills/`, `agents/` and `commands/`; with a
`.claude/` folder it reads that folder's three (Judgment J2.4).

Each file it reads is checked as below; the runtime effects are §4 (skills, commands) and §5
(agents). The missing-frontmatter and missing-description warnings, like `Unknown field '<key>'`,
stop validation only under `--strict`. <!-- req: manifest.troubleshooting.claude plugin validate reports errors.No frontmatter block found -->

| Finding | Severity | Message, at the path shown |
| --- | --- | --- |
| No frontmatter block | warning | `frontmatter: No frontmatter block found. Add YAML frontmatter between --- delimiters at the top of the file to set description and other metadata.` |
| No `description` | warning | `description: No description in frontmatter. A description helps users and Claude understand when to use this <kind>.`, with `<kind>` `skill`, `agent` or `command` |
| YAML that does not parse, a skill | error | `frontmatter: YAML frontmatter failed to parse: <error>. At runtime this skill loads with empty metadata (all frontmatter fields silently dropped).` |
| the same, a command | error | `frontmatter: YAML frontmatter failed to parse: <error>. At runtime this command loads with empty metadata (all frontmatter fields silently dropped).` |
| the same, an agent of a plugin's `agents/` | error | `frontmatter: YAML frontmatter failed to parse: <error>. At runtime this agent loads with its name taken from the filename and every other frontmatter field silently dropped.` |
| the same, an agent of a project's `.claude/agents/` | error | `frontmatter: YAML frontmatter failed to parse: <error>. At runtime this agent does not load at all — with no frontmatter name it is treated as a co-located reference document and skipped.` |
| A skill's `metadata` that is not a map | warning | `metadata: 'metadata' must be a mapping (key: value pairs); got <type>. It is dropped at load time.` (§4) |

(Claude Code 2.1.321 on the corpus for the skill and command messages, the plugin-agent YAML
message, the warnings; 2.1.319 and 2.1.322 for the `.claude/agents/` message.)

## 2.12 Load diagnostics

These are the failures an author meets while building a plugin, and what the client does in each.

- **A marketplace root given as a plugin.** `--plugin-dir` takes a plugin's root, the directory
  holding `.claude-plugin/plugin.json`. A marketplace root (its `.claude-plugin/` holds
  `marketplace.json` and no `plugin.json`) is read as a folder of plugins (§16.8 item 4): the
  client does not read `marketplace.json`, only its immediate subfolders with a manifest load, so
  the plugins under its `plugins/` do not, and no error is reported (`plugins/troubleshooting.md`,
  "`--plugin-dir` at a marketplace root doesn't load the plugins under `plugins/`"). Before 2.1.281
  such a root loaded as one empty plugin named after the directory. <!-- req: manifest.troubleshooting.--plugin-dir at a marketplace root doesn't load the plugins under plugins/ -->
- **Files outside the plugin.** An installed plugin is loaded from the client's cache copy (§16), so a
  path such as `../shared-utils` that worked from the source directory finds nothing; shared files
  belong inside the plugin, or behind a symbolic link inside it. <!-- req: manifest.troubleshooting.Files the plugin references outside its directory aren't found -->
- **Path separators on Windows.** A hook run through Git Bash receives `${CLAUDE_PLUGIN_ROOT}` with
  forward slashes (`C:/Users/...`) so that Bash does not read backslashes as escapes. An exec-form
  hook and a hook with `"shell": "powershell"` keep native backslashes (§3.2, §7). <!-- req: manifest.troubleshooting.${CLAUDE_PLUGIN_ROOT} shows forward slashes on Windows -->
- **Skills missing.** Skills load from `skills/` and commands from `commands/` at the plugin root; a
  `skills/` inside `.claude-plugin/` is not scanned (§1.4). <!-- req: manifest.troubleshooting.Plugin loads but its skills are missing -->
- **A skill the model never invokes.** A skill with `disable-model-invocation: true` is offered to the
  user only, and a description shortened to fit the listing budget can lose the words a request
  matches (§4). <!-- req: manifest.troubleshooting.Skill loads but Claude never invokes the skill -->
- **No configuration dialog.** An interactive install asks for `userConfig` values (§3.4.6); a
  non-interactive install never prompts, saves the `--config` values it is given and prints how
  many options remain unset, as §17.4.1 states. The options can be set later with
  `/plugin configure` (§3.4.6). <!-- req: manifest.troubleshooting.The userConfig dialog never appears -->
- **Conflicting manifests.** A plugin with its own `plugin.json` whose marketplace entry sets
  `strict: false` and declares any of `commands`, `agents`, `skills`, `hooks`, `outputStyles` or
  `themes` does not load: `Plugin <name> has conflicting manifests: both plugin.json and
  marketplace entry specify components.` (§15). <!-- req: manifest.troubleshooting.Plugin <name> has conflicting manifests -->

## Design decisions

### Why the client strips unknown top-level fields but rejects unknown keys in strict objects

A top-level field Claude Code does not know may be a newer release's field or an author's typo;
loading without it keeps old clients working with new plugins. A strict object configures something
the client runs or asks the user for, where a misspelt key would silently change what runs, so it
fails loudly instead. The core makes the same split at a different line (core §5.2): it reports and
ignores unknown top-level fields too.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J2.1 | A directory without a manifest is validated as a plugin without a manifest when it has components, and draws `No manifest found in directory. …` when it has none; `File not found` is only for a path that does not exist (§2.11). E4a deviation. | **Docs:** plugins/troubleshooting.md, "claude plugin validate reports errors", gives `File not found: <path>` for a path that "has no manifest, or doesn't exist" (plugins/cli-reference.md, "Validate a directory", does describe the component run). **Claude Code:** 2.1.319 (reference implementation) and 2.1.325, re-run 2026-11-16: a directory with `skills/` and no manifest prints `Validating components in: <dir>`; a directory holding only a `README` reports `directory: No manifest found in directory. Expected .claude-plugin/marketplace.json or .claude-plugin/plugin.json`; a missing path reports `file: File not found: <path>`. §17 (J17.14) states the same. |
| J2.2 | A marketplace run does not check the reserved-name rule of §2.3 item 2 for the entries of a marketplace named with an official name, nor for the manifests they point at; a plugin directory run always checks it (§2.3). | The docs state the rule and where it is checked, not an exemption. Oracle 2.1.325, 2026-11-16: a marketplace `claude-plugins-official` listing `claude-foo` at `./p` (whose manifest is also `claude-foo`), and one named `life-sciences` listing it from a `github` source, pass validation; the same marketplace named `my-market` fails with `plugins[0].name: Plugin name "claude-foo" is reserved: …`; `claude plugin validate` on `./p` alone draws the error and adds `If this is one of Anthropic's own plugins, validate the marketplace that lists it.` Lead: the reference implementation's `src/format/marketplace/entry-checks.ts`. |
| J2.3 | A `plugin.json` that opens with a UTF-8 byte order mark is read as if it had none; a `hooks/hooks.json` that does is not valid JSON, for the validator (`Invalid JSON syntax`) and for loading alike: the plugin loads without that file's hooks. The other JSON files of a plugin are not known to be read past one. | The docs do not mention the mark. Oracle 2.1.321 on the corpus of `bun run corpus` (`conformance/CORPUS.md`): the one plugin whose `plugin.json` and `hooks/hooks.json` both open with the mark draws a schema error from inside its manifest (so the manifest was read) and `json: Invalid JSON syntax: JSON Parse error: Unrecognized token` for the hooks file. Load oracle (`claude --plugin-dir <dir> plugin details <name>`), 2.1.319 and 2.1.322, 2026-11-16, on a plugin with one skill and a hooks file that opens with the mark and is otherwise valid: the plugin loads with `Skills (1)` and `Hooks (0)`, the same as without the file; the same file without the mark gives `Hooks (1)`. The reference implementation's loader strips the mark from the hooks file; this oracle overrides that lead. |
| J2.4 | `claude plugin validate` on a plugin directory reads the frontmatter of the default `skills/`, `agents/` and `commands/` only, never a folder the manifest declares; a marketplace root without `plugin.json` is validated as a marketplace only; a directory with neither manifest is a plugin without one only when it has a skills tree `skills/<name>/SKILL.md` or a `.claude/` folder with skills, agents or commands, and then `.mcp.json` and `hooks/hooks.json` are not read (§2.11). | The docs say the validator checks "skill, agent, and command frontmatter" without naming the folders. Oracle 2.1.321 on the corpus: no finding of any of 2,495 plugins names a Markdown file outside those folders, and a skill whose YAML does not parse under a declared `./.claude/skills/` draws none; 108 marketplace roots without `plugin.json` draw findings on `marketplace.json` only; directories holding only `hooks/`, only `.mcp.json`, or a `skills/` without any `SKILL.md` draw `No manifest found in directory`; one with skills and a `.mcp.json` server that has a `url` but no `type` passes; a project directory with `.claude/skills` and `.claude/agents` (and no manifest) is validated as components, its findings under those folders. The corpus has no manifest-less directory with only `agents/` or only `commands/`; 2.1.319 and 2.1.322 (2026-11-16) give `No manifest found` for each, and for a root `SKILL.md` alone or a folder of `<name>/SKILL.md` subfolders, while `skills/one/SKILL.md`, `.claude/skills/one/SKILL.md`, `.claude/agents/a.md` and `.claude/commands/c.md` each print `Validating components in`; beside a skills tree, a broken `agents/a.md` and `commands/c.md` are reported. |
| J2.5 | An invalid `hooks/hooks.json` (not JSON, or opening with a byte order mark) leaves the plugin loading without that file's hooks, as the docs say; the validator's tail `At runtime this breaks the entire plugin load.` is stated as its wording only (§2.1 item 2). No E4a deviation: the documented behaviour is what Claude Code does. | **Docs:** `plugins/troubleshooting.md`, "`claude plugin validate` reports errors" ("Until you fix `hooks/hooks.json`, a session loads the plugin without the hooks in that file") and "Hooks fail to load" (`Failed to load hooks from <path>: <reason>`). **Validator:** 2.1.321 on the corpus prints the tail (one plugin, `prompt-sentinel-v1`, whose load result is confounded by a manifest error), as do 2.1.319 and 2.1.322. **Loading:** the load oracle (`plugin details`) on 2.1.319 and 2.1.322, 2026-11-16 (and the chapter-7 runs on 2.1.325 with `--plugin-dir`, J7.11), on a plugin with one skill and a hooks file holding `{"hooks": {`: `Skills (1)`, `Hooks (0)`; the same for a hooks file that is a JSON array and one with neither `hooks` nor `modules` (2.1.321 corpus: the 4 plugins whose only error is that file load, without hooks). What does stop the plugin is a parsed file whose `PreToolUse`/`PermissionRequest` entry cannot load (2.1.321 corpus: `metal-lsp`, `mobazha`, `sosa-governor`, `sosa-orchestrator`, `xcode-cloud` do not load with no other error; 2.1.319: `Plugin "<name>" not found`), which §7.2.1.1 states. |
| J2.6 | Schema errors of `plugin.json` use the schema check's wording at the field path, and every one of them stops the plugin from loading; `Path not found` and `Path is a file` drop the one path and the plugin loads (§2.1 item 3, §2.5). | The docs say a manifest that fails validation does not load and name the paths' messages, not the type errors. Oracle 2.1.321, corpus verdicts against the load oracle of the same release (`oracle-load/2.1.321`), counting plugins whose only errors are one template: `repository` object (27), `agents` not `.md` (16), `author` string (5), a path without `./` (4 `skills`, 1 `agents`, 1 `hooks`), `Invalid input` for `skills` (2) and `agents` (1), a name with spaces (1): none loads. `Path not found` (3) and `Path is a file` (1): all load. The reserved-name error (38): all load (§2.3). |
| J2.7 | The unknown-field warning of §2.1 item 4 is chosen in the order of its table; the lists of marketplace-entry fields and of other formats' fields are those observed, and the closeness rule is the observed one. | The docs give only `Unknown field '<key>'` and say a close documented name is suggested. Oracle 2.1.321 corpus: `category`, `tags`, `id`, `strict` draw the marketplace-entry warning; `categories`, `publisher`, `type`, `contributors`, `main`, `compatibility`, `logo`, `privacy_policies`, `privacy_policy`, `support`, `_comment`, `changelog` the "commonly seen" families; `display_name`, `keyword`, `_description`, `note`, `authors`, `mcpServer`, `auth`, `_license`, `_repository` a suggestion. 2.1.319 and 2.1.322 (2026-11-16, one manifest holding 80 candidate fields, identical output): `source` the entry warning; `user_config` its own; `scripts`, `bin`, `files`, `private` npm, `engines`, `activationEvents`, `contributes`, `preview` VS Code, `dxt_version` MCPB, `server`, `tools`, `prompts` an MCP server manifest, `readme` many tools; `type` takes the npm family though `types` is one edit away, so the families come before the suggestion; `versoin`, `nmae`, `NAME`, `licence`, `outputstyles`, `dependencie`, `hook`, `theme` a suggestion; `xyzname`, `author_name`, `devDependencies`, `exports`, `website`, `maintainers`, `x` the plain warning. The tables are not known to be complete: a field outside them takes the suggestion or the plain warning. |
| J2.8 | The kebab-case warning's advice depends on how badly the name breaks: refused by path, not installable from a marketplace, or accepted (§2.3 item 1's table); a space or a control or bidirectional-formatting character is the only report on the name. | The docs name the kebab-case rule but quote no warning. `claude plugin validate` 2.1.326 on `{"name": ...}`: `MyPlugin`, `my_plugin`, `my.Plugin` accepted; `a+b` not installable; `my@plugin` refused by path; `My Plugin` the space error alone; a tab the control-character error alone. Lead: the reference implementation's rows for `src/format/names.ts` (oracle 2.1.319). |
