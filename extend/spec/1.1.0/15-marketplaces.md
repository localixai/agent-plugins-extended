# 15. Marketplaces

A marketplace is a catalog of Claude Code plugins: a `.claude-plugin/marketplace.json` file that
names the marketplace, its owner, and one entry per plugin, each entry saying where the plugin is
fetched from. This chapter states the file, its names, its entries and how an entry combines with
the plugin's own `plugin.json` (§2), every plugin source and every marketplace source, relevance
signals, and what a validator reports. Hosting, private access, archive download headers and
publishing are in the second file of this chapter, [Marketplace hosting](15-marketplace-hosting.md)
(§15.11 to §15.17). Installing, the plugin cache, versions, updates and dependency resolution are
§16; the allow and block lists administrators write (`strictKnownMarketplaces`,
`blockedMarketplaces`) are §14; `extraKnownMarketplaces` as a settings key is §12; the
`claude plugin marketplace` commands and their flags are §17.

Evidence: `plugins/marketplace-reference.md` unless a section names another page.

## 15.1 The marketplace file

1. A marketplace's catalog is the file `.claude-plugin/marketplace.json`. The directory that holds
   `.claude-plugin/` is the **marketplace root**; every relative plugin source resolves from the
   root, never from `.claude-plugin/`. A catalog kept at another path inside a repository is found
   only through a marketplace source that sets `path` (§15.8); the add command has no option for
   it.
2. A marketplace and a plugin MAY share one repository: `.claude-plugin/marketplace.json` beside
   `.claude-plugin/plugin.json`, with one entry whose `source` is `"./"` (the repository root) and
   whose `name` equals the manifest's `name` (`plugins/publish.md`, "Add the marketplace file to
   your repository"). <!-- req: marketplace.publish.Add the marketplace file to your repository -->
3. A relative path MUST be written from the marketplace root. A path containing `..` fails
   validation with a message that begins `Path contains "..": <path>` (for example
   `Path contains "..": ./../plugins/my-first-plugin`); a path to a directory that does not exist
   passes validation and fails at install with `Source path does not exist: <path>`, `<path>` being
   the absolute location the client checked (`plugins/create-marketplace.md`, "Write relative paths
   from the marketplace root"). <!-- req: marketplace.create.Write relative paths from the marketplace root -->
4. A user registers at most one marketplace per `name`: a second marketplace with a registered name
   cannot be registered beside it (§15.8.5). The name, not the repository or URL, identifies a
   marketplace.
5. An unknown top-level key, an unknown key in `metadata`, in an entry, or under an entry's
   `relevance` or `relevance.signals` is ignored at load and the marketplace loads. A validator
   reports each as the warning `Unknown field '<key>'. Claude Code ignores it at load time.`
   (§15.10).

## 15.2 Top-level fields

`name`, `owner` and `plugins` are REQUIRED. A missing required field, or one of the wrong type,
fails validation with the error `Invalid input: expected <type>, received <type>` under the field's
key: `owner: Invalid input: expected object, received undefined` for a missing `owner`, and, under
`plugins`, `Invalid input: expected array, received undefined` for a missing `plugins` and
`Invalid input: expected array, received object` for a `plugins` written as an object (oracle
2.1.321, corpus; Judgment J15.13).

| Field | Type | Meaning |
| --- | --- | --- |
| `$schema` | string | A JSON Schema URL for editors. The client ignores it at load. <!-- req: marketplace.field.$schema --> |
| `name` | string | The marketplace identifier (§15.3). Users type it after `@` in a plugin id, `my-plugin@my-marketplace`. <!-- req: marketplace.field.name --> |
| `owner` | object | The maintainer: `name` (string, REQUIRED, non-empty), `email` and `url` (strings, OPTIONAL). An empty `owner.name` fails validation with `Author name cannot be empty`. <!-- req: marketplace.field.owner --> |
| `plugins` | array | The plugin entries (§15.4). Each entry is validated on its own: an invalid entry is dropped and the rest of the marketplace loads. An empty array draws the validator warning `Marketplace has no plugins defined`. <!-- req: marketplace.field.plugins --> |
| `description` | string | The description shown to users. A validator warns when it is missing (§15.10). <!-- req: marketplace.field.description --> |
| `version` | string | The marketplace manifest's version. The client does not pin or compare it. <!-- req: marketplace.field.version --> |
| `metadata.description` | string | An alternate location for `description`, used when the top-level key is absent. <!-- req: marketplace.field.metadata.description --> |
| `metadata.version` | string | An alternate location for `version`, used when the top-level key is absent. <!-- req: marketplace.field.metadata.version --> |
| `metadata.pluginRoot` | string | The directory bare plugin source names resolve under (§15.6.2). Requires v2.1.239 or later. <!-- req: marketplace.field.metadata.pluginRoot --> |
| `forceRemoveDeletedPlugins` | boolean | When `true`, a plugin removed from `plugins` and not covered by `renames` is uninstalled from users' machines at session start (§15.16). <!-- req: marketplace.field.forceRemoveDeletedPlugins --> |
| `allowCrossMarketplaceDependenciesOn` | string[] | Names of marketplaces whose plugins may be installed as dependencies of this marketplace's plugins. Only the list in the installed plugin's own marketplace applies, for its whole dependency chain (§16). <!-- req: marketplace.field.allowCrossMarketplaceDependenciesOn --> |
| `renames` | object | A map from a former plugin `name` to its current name, or to `null` for a removed plugin (§15.16). <!-- req: marketplace.field.renames --> |

Judgment J15.1: where both `description` and `metadata.description` are set, the top-level value
is used; the same holds for `version`.

## 15.3 Names

### 15.3.1 The grammar

A marketplace `name` MUST consist of ASCII letters, digits, `.`, `_` and `-`, MUST start with a
letter or digit, and MUST NOT contain `..`. A plugin entry's `name` follows the same rule, without
the `..` clause. Both parts of a plugin id must fit it, because the client cannot install a plugin
whose id breaks it. A validator reports each break as an error, and may report more than one for
one name:

| Name | Error |
| --- | --- |
| empty | `Marketplace must have a name` |
| contains a space | `Marketplace name cannot contain spaces. Use kebab-case (e.g., "my-marketplace")` |
| contains `/` or `\`, contains `..`, or is `.` | `Marketplace name cannot contain path separators (/ or \), ".." sequences, or be "."` |
| contains a control (`Cc`) or bidirectional-formatting (`Bidi_Control`) character | `Marketplace name cannot contain control or bidirectional-formatting characters` |
| breaks the grammar | `Claude Code cannot install plugins from marketplace "<name>". Each part of a plugin id (plugin@marketplace) may use only the letters a-z and A-Z, digits, ".", "_" and "-", and must start with a letter or digit. Change the marketplace's "name".` |

Adding a marketplace whose catalog `name` breaks the grammar MUST be refused and nothing
registered. The refusal reads `Cannot add marketplace "<name>": Claude Code cannot install plugins
from a marketplace with this name.`, followed by the rule and `The name is set by "name" in the
marketplace's marketplace.json; ask its maintainer to change it.` (`plugins/troubleshooting.md`;
before v2.1.295 such an add was reported as successful). <!-- req: marketplace.troubleshooting.Cannot add marketplace "<name>": Claude Code cannot install plugins from a marketplace with this name -->

### 15.3.2 Reserved names

A client MUST refuse the following names for a marketplace. A refused name is refused when the
marketplace is added; a marketplace already registered under it stops loading, and so do the
plugins installed from it. <!-- req: marketplace.rule.Reserved names -->

1. **Official names**: `claude-code-marketplace`, `claude-code-plugins`, `claude-plugins-official`,
   `anthropic-marketplace`, `anthropic-plugins`, `agent-skills`, `anthropic-agent-skills`,
   `life-sciences`, `knowledge-work-plugins`, `claude-for-legal`,
   `claude-for-financial-services`, `financial-services-plugins`, `first-party-plugins` and
   `claude-tag-plugins`. They are allowed only for a marketplace whose source is `github` or `git`
   under `github.com/anthropics/`. The exact names pass validation; adding one from any other
   source is refused with a message that begins `The name '<name>' is reserved for official
   Anthropic marketplaces.`, continued by `Only repositories from 'github.com/anthropics/' can use
   this name.` for a `github` or `git` source and by `The name can only be used with GitHub sources from the
   'anthropics' organization.` for any other. <!-- req: marketplace.rule.Reserved names.Official marketplace names -->
2. **Community names** `claude-community`, `claude-plugins-community` and `healthcare`, and
   **plugin directory names** `anthropic-plugin-directory` and `claude-plugin-directory`, follow
   the rule of item 1. <!-- req: marketplace.rule.Reserved names.Community marketplace names | marketplace.rule.Reserved names.Plugin directory names -->
3. **Impersonation**: a name that reads as an official marketplace's, such as
   `official-claude-plugins` or `claude-plugins-v2`, and any name containing a non-ASCII character,
   is refused with `Marketplace name impersonates an official Anthropic/Claude marketplace`, by the
   validator and by the add command alike (Judgment J15.2 states the test). A control or
   bidirectional-formatting character also draws the control-character error of §15.3.1 (before
   v2.1.247 only the impersonation error). A registered marketplace refused this way is reported by
   `claude plugin list` and `/plugin`, for each of its plugins, as `Claude Code refuses the
   marketplace name "<name>"` (v2.1.282 or later), with the advice to remove it (removing
   uninstalls its plugins and deletes their data, options and secrets); the marketplace's own error reads `Claude Code refuses
   this marketplace's name: it looks like one of Anthropic's own` (`errors.md`, "Claude Code
   refuses the marketplace name"). For a marketplace a settings file declares inline, the advice
   says to rename the settings entry before removing the old name (v2.1.292 or later).
4. **Another spelling of a reserved name**: a name that differs from a name of items 1, 2 or 6
   only by trailing dots, or by a symbol other than `_` in place of a `-`, counts as that name:
   `claude.code.plugins` is `claude-code-plugins`. It passes validation. Adding it fails with
   `"<name>" is another spelling of "<reserved>", a reserved marketplace name` (or, when the name
   would need shell quoting, `This marketplace's name is another spelling of "<reserved>", a
   reserved marketplace name. It is not exactly the reserved name it appears to be.`); a registered
   one is ignored with `known_marketplaces.json has an entry named "<name>", another spelling of
   the reserved marketplace name "<reserved>", so it is ignored. Remove it with: claude plugin
   marketplace remove <name>` (`errors.md`, "Marketplace name is another spelling of a reserved
   name"). Requires v2.1.280 or later. <!-- req: marketplace.rule.Reserved names.Another spelling of a reserved name -->
5. **`npm`, `pip`, `uv`, `cargo`, `github` and `gh` are not reserved.** Claude Code 2.1.275 to
   2.1.324 refused them in any letter case; 2.1.325 and later accept them, and the 2.1.330 docs no
   longer list them. A client MUST accept a marketplace with one of these names (Judgment J15.3).
6. **Names of plugins that come from no marketplace**: `inline` (`--plugin-dir`), `builtin`,
   `skills-dir` (plugins loaded from `.claude/skills/`), `synced` (plugins synced from claude.ai)
   and `claude-plugin-test`. A validator reports each as `Marketplace name "inline" is reserved
   for --plugin-dir session plugins`, `... "builtin" is reserved for built-in plugins`,
   `... "skills-dir" is reserved for plugins auto-loaded from .claude/skills/`, `... "synced" is
   reserved for plugins synced from your claude.ai account` and `... "claude-plugin-test" is
   reserved for plugins loaded by claude plugin test` (Judgment J15.3).
7. **Member names every JavaScript object has**: `constructor`, `hasOwnProperty`,
   `isPrototypeOf`, `propertyIsEnumerable`, `toLocaleString`, `toString` and `valueOf`. They pass
   validation; adding one is refused and nothing is registered, with `Cannot add marketplace
   "<name>": Claude Code reserves this name and cannot register a marketplace under it. The name is
   set by "name" in the marketplace's marketplace.json; ask its maintainer to change it.` A settings
   file that declares such a marketplace fails the same way at startup, and the message is shown on
   the `/plugin` Errors tab. Requires v2.1.296 or later (`plugins/troubleshooting.md`). <!-- req: marketplace.troubleshooting.Cannot add marketplace "<name>": Claude Code reserves this name and cannot register a marketplace under it -->
8. **Names starting with `claudeai-`** are reserved for marketplaces hosted on claude.ai. Adding
   any other marketplace with such a name is refused with `Cannot add marketplace "<name>": names
   starting with "claudeai-" are reserved for marketplaces hosted on claude.ai`. <!-- req: marketplace.rule.Reserved names.Names starting with claudeai- -->
9. **The download folder of a registered GitHub marketplace**: a marketplace added from the
   `github` source `acme/x-tools` is downloaded through the folder `acme-x-tools`, whatever its
   own `name`. While it is registered under another name, adding a different marketplace named
   `acme-x-tools` is refused after the download with `Can't use the marketplace name
   "acme-x-tools"` (v2.1.290 or later).

A validator MAY also warn about names Claude Desktop rejects: `Marketplace name "<name>" is
reserved in Claude Desktop` for `org`, `org-provisioned` and `unknown` in any casing, and
`Marketplace name "<name>" is not accepted by Claude Desktop (letters, digits, ".", "_", "-"; must
start alphanumeric; max 128 chars)` (and the same for a plugin name). These are warnings; the client
accepts the names.

## 15.4 Plugin entries

Each element of `plugins` is an entry; `name` and `source` are REQUIRED. Besides the fields below,
an entry accepts every `plugin.json` field of §2.2 except the directory listing fields (`icon`,
`documentationUrl`, `supportUrl`, `privacyPolicyUrl`, `termsOfServiceUrl`), which a validator
reports as unknown in an entry (§2.4). §15.5 says when the `plugin.json` fields apply.

| Field | Type | Meaning |
| --- | --- | --- |
| `name` | string | The plugin identifier (§15.3.1): what users type before `@`, and the `enabledPlugins` key (§15.5.4). A validator reports `Plugin name cannot contain spaces. Use kebab-case (e.g., "my-plugin")`, `Plugin name cannot contain control or bidirectional-formatting characters`, `Claude Code cannot install plugin "<name>". Each part of a plugin id (plugin@marketplace) may use only the letters a-z and A-Z, digits, ".", "_" and "-", and must start with a letter or digit. Change this entry's "name".`, the reserved-name error and warning of §2.3, and `Duplicate plugin name "<name>" found in marketplace` for each of two entries sharing a name. <!-- req: marketplace.entry.name --> |
| `source` | string or object | Where the plugin is fetched from (§15.6). <!-- req: marketplace.entry.source --> |
| `description` | string | Shown in `/plugin` listings and details. A display field (§15.5.3). <!-- req: marketplace.entry.description --> |
| `version` | string | The plugin's version when `plugin.json` sets none (§15.5.4); ignored for a `command` source (§16.16.1). <!-- req: marketplace.entry.version --> |
| `category` | string | A free-form category for organizing the catalog. <!-- req: marketplace.entry.category --> |
| `tags` | string[] | Free-form tags for search. <!-- req: marketplace.entry.tags --> |
| `strict` | boolean | Default `true`. Whether `plugin.json` is the definitive source of the plugin's components (§15.5.2). <!-- req: marketplace.entry.strict --> |
| `relevance` | object | Signals for suggesting the plugin (§15.9). <!-- req: marketplace.entry.relevance --> |
| `dependencies` | array | Plugins that must be enabled for this one: `"name"`, `"name@marketplace"` or an object, as in §2.4; resolution is §16. <!-- req: marketplace.entry.dependencies --> |
| `defaultEnabled` | boolean | Default `true`. Whether the plugin starts enabled while `enabledPlugins` has no entry for it; it takes precedence over `plugin.json`'s (§2.4). <!-- req: marketplace.entry.defaultEnabled --> |
| `displayName` | string | The name shown in the UI. With neither the entry nor `plugin.json` setting one, users see `name`. <!-- req: marketplace.entry.displayName --> |
| `engines` | object | The Claude Code versions the plugin works on, `{ "claude-code": "<node-semver range>" }`, with the effect and messages of §2.4 at `plugins[<i>].engines.claude-code` and `plugins[<i>].engines` (2.1.323 or later). Claude Code 2.0.15 through 2.1.75 reject the whole `marketplace.json` when any entry has the field. <!-- req: marketplace.entry.engines --> |
| `metadata` | object | The author's own free-form object; the client MUST NOT read it. A value that is not an object draws the warning `'metadata' must be a free-form object; got <type>. It will be ignored at load time.` and is ignored. <!-- req: marketplace.entry.metadata --> |
| `headers` | object of strings | HTTP headers sent when this entry's `archive` is downloaded; a header here replaces one of the same name from the marketplace source's `headers` (v2.1.238 or later; §15.15). <!-- req: marketplace.entry.headers --> |
| `headersHelper` | string | A command that prints this entry's archive-download headers as one JSON object. The entry MUST also set `"strict": false` (v2.1.238 or later; §15.15). <!-- req: marketplace.entry.headersHelper --> |

An entry `experimental` that is not an object draws the warning `'experimental' must be an object
containing component declarations; got <type>. It will be ignored at load time.`

**Entry name and manifest name.** The entry's `name` is the install id (`<entry>@<marketplace>`),
what `claude plugin list` shows, and the key written under `enabledPlugins`. The `name` in the
plugin's own `plugin.json`, the *manifest name*, namespaces the plugin's components (§2.3) and is
the name `claude plugin details` takes. Installing by the manifest name when the two differ fails
with `Plugin "<manifest-name>" not found in marketplace "<marketplace>"`. Authors SHOULD keep the
two equal (`plugins/create-marketplace.md`, "Keep the entry name and the manifest name the same";
`plugins/manifest-reference.md`, "Metadata precedence"). <!-- req: marketplace.create.Keep the entry name and the manifest name the same | marketplace.rule.Metadata precedence.name -->

## 15.5 How an entry combines with `plugin.json`

### 15.5.1 Which is the manifest

The fetched plugin either has its own `.claude-plugin/plugin.json` or not
(`plugins/manifest-reference.md`, "How entry fields combine with `plugin.json`"):

- **No `plugin.json`.** The entry is the manifest, whatever `strict` says. Every manifest field the
  entry carries applies, `mcpServers`, `lspServers`, `userConfig` and `channels` included, and the
  plugin's name is the entry's `name`.
- **`plugin.json` present.** `plugin.json` is the manifest. `strict` (§15.5.2) decides what
  happens to the entry's six component fields, `commands`, `agents`, `skills`, `hooks`,
  `outputStyles` and `themes`. The entry's `mcpServers`, `lspServers`, `userConfig` and `channels`
  MUST NOT apply; they belong in `plugin.json`. The entry's other `plugin.json` fields apply only
  as §15.5.3 and §15.5.4 say (Judgment J15.4).

When an entry whose source is the marketplace root (`"."` or `"./"`) lists `skills`, only the
listed directories load and the plugin's default `skills/` is not scanned; a `skills` key in
`plugin.json` instead adds to the default (§2.6). <!-- req: marketplace.rule.How entry fields combine with plugin.json -->

### 15.5.2 Strict mode

| `strict` | `plugin.json` | Entry component fields | Result |
| --- | --- | --- | --- |
| any | absent | any | The entry is the manifest. <!-- req: marketplace.rule.Strict mode.any --> |
| `true` (default) | present | any | `plugin.json` is the authority. The entry's `commands`, `agents`, `skills`, `outputStyles` and `themes` are appended to the manifest's. For `hooks`, the entry's matchers for an event replace the manifest's matchers for that event (those from `plugin.json`'s `hooks` and from `hooks/hooks.json` alike); events only the manifest declares keep theirs. <!-- req: marketplace.rule.Strict mode.true --> |
| `false` | present | none | `plugin.json` is the manifest, as with `true`. |
| `false` | present | one or more | Conflict: the plugin MUST NOT load, and the client reports `Plugin <name> has conflicting manifests: both plugin.json and marketplace entry specify components` (§2.12). <!-- req: marketplace.rule.Strict mode.false --> |

Appending a path field means the manifest's paths, or its default location when the manifest does
not set the key, followed by the entry's paths, each under the rules of §2.5 and §2.6.

### 15.5.3 Hooks and display fields

**Hooks.** An entry's `hooks` MUST be an inline object mapping event names to matcher arrays. A file
path or an array passes validation, but those hooks never run, the rest of the plugin loads, and the
client reports for the plugin, on the `/plugin` Errors tab, an error containing `not yet supported
in a marketplace entry`. File-based hooks belong in the plugin's `hooks/hooks.json` or
`plugin.json`. <!-- req: marketplace.rule.Hooks in an entry -->

**Display fields.** `displayName`, `description`, `author`, `homepage`, `repository`, `license` and
`keywords` may be set on the entry and in `plugin.json`. For each one the entry sets, users see the
entry's value, before and after install, whatever `strict` says; for each one it leaves unset, they
see `plugin.json`'s. Before install, the client can read `plugin.json` only for an entry with a
relative-path source; for any other source, listings show only the entry's own fields until the
plugin is installed. <!-- req: marketplace.rule.Display fields -->

An entry's display field of the wrong type, or a `homepage` that is not a URL, makes that entry
invalid, unlike the same field in `plugin.json`, which the client ignores with a note (§2.1 item 3).
The marketplace still adds and its other entries install, but installing the invalid entry MUST fail
with `This plugin's marketplace entry is invalid: <field>: <problem>[, <field>: <problem>…]`, each
problem in the schema check's wording (`description: Invalid input: expected string, received
number`, `homepage: Invalid URL`), and nothing is installed. An entry's `engines` is not such a
field: a malformed value is ignored as in `plugin.json` (§2.4) and the entry installs (Judgment
J15.15).

### 15.5.4 Metadata precedence

Whatever `strict` says (`plugins/manifest-reference.md`, "Metadata precedence"):

- the entry's `defaultEnabled` and display fields override the manifest's; <!-- req: marketplace.rule.Metadata precedence.defaultEnabled and display fields -->
- the manifest's `version` overrides the entry's. A validator warns, for a relative-path entry
  whose `plugin.json` sets another `version`, under `plugins[<i>].version`:
  `Entry declares version "<a>" but <path> says "<b>". At install time, plugin.json wins
  (calculatePluginVersion precedence) — the entry version is silently ignored. Update this entry to
  "<b>" to match.`, `<path>` being the entry's `plugin.json` from the marketplace root without a
  leading `./` (`plugins/formatter/.claude-plugin/plugin.json`, or `.claude-plugin/plugin.json` for
  an entry at the root). When that `plugin.json` does not parse, the cross-check is skipped with the
  warning `Could not parse <path> for version cross-check: <parser message>` under
  `plugins[<i>].source`, beside the parse error itself (§15.10). The client itself uses
  `plugin.json`'s value without a warning (oracle 2.1.321, corpus; Judgment J15.13); <!-- req: marketplace.rule.Metadata precedence.version -->
- `name`: as §15.4 says, the entry name is the install id and `enabledPlugins` key, the manifest
  name the namespace.

Judgment J15.5: the entry's `dependencies` are added after the manifest's.

## 15.6 Plugin sources

An entry's `source` is either a relative path string or an object whose own `source` key names
the type: `"source": { "source": "github", "repo": "your-org/formatter" }`.
(`plugins/create-marketplace.md`, "Choose a plugin source", says which to pick: a relative path
for files inside the marketplace, `github` for a repository of its own, `git-subdir` for a
subdirectory of another repository, and `url`, `archive`, `npm` or `command` for the rest.)

| Type | Fields | What it fetches |
| --- | --- | --- |
| Relative path | the string | A directory inside the marketplace, from the marketplace root (§15.6.1). <!-- req: marketplace.source.Relative path | marketplace.create.Choose a plugin source.Relative path --> |
| `github` | `repo`, `ref`, `sha` | A GitHub repository, `repo` in `owner/repo` form. <!-- req: marketplace.source.github | marketplace.create.Choose a plugin source.github --> |
| `url` | `url`, `ref`, `sha` | Any git repository by URL. <!-- req: marketplace.source.url --> |
| `git-subdir` | `url`, `path`, `ref`, `sha` | One subdirectory of a git repository, by sparse checkout. <!-- req: marketplace.source.git-subdir | marketplace.create.Choose a plugin source.git-subdir --> |
| `npm` | `package`, `version`, `registry` | An npm registry package or tarball link, unpacked without running install scripts. <!-- req: marketplace.source.npm | marketplace.create.Choose a plugin source.npm --> |
| `archive` | `url`, `sha256` | A zip archive over HTTPS (v2.1.224 or later). <!-- req: marketplace.source.archive | marketplace.create.Choose a plugin source.archive --> |
| `command` | `command`, `timeout`, `mode` | The directory printed by a command run on the user's machine (v2.1.229 or later). <!-- req: marketplace.source.command | marketplace.create.Choose a plugin source.command --> |

`create-marketplace.md` lists the `url` source as "a git repository by URL, on any host". <!-- req: marketplace.create.Choose a plugin source.url -->

`url` and `github` are also marketplace source types with other meanings (§15.8); `git` exists
only as a marketplace source, `npm` as both, and `git-subdir`, `archive` and `command` only as
plugin sources. A client SHOULD reject a source type it does not support with `This plugin uses a
source type your Claude Code version does not support` at install (§16).

**`ref` and `sha`**, shared by `github`, `url` and `git-subdir`: `ref` is a branch or tag and
defaults to the repository's default branch; `sha` MUST be a full 40-character lower-case commit
SHA. With both set, the client checks out `sha`, so on hosts that fetch by commit an install still
works after `ref` is deleted as long as the commit is reachable; on hosts that cannot fetch by
SHA, `ref` must exist and reach the commit. A `sha` of another form fails validation (`Must be a
full 40-character lowercase git commit SHA`).

### 15.6.1 Relative path

1. The path resolves from the marketplace root: `./plugins/formatter` is `<root>/plugins/formatter`.
   It MUST start with `./`; `"."` alone, and `"./"`, name the root; a bare name under
   `metadata.pluginRoot` (§15.6.2) is the one other form. Any other string, an absolute path
   included, fails validation with `plugins.<i>.source: Invalid string: must start with "./"`
   (before v2.1.285, `Invalid input`).
2. A path containing `..` fails validation with `plugins[<i>].source: Path contains "..": <path>`.
   On macOS and Linux, the client refuses an entry path with a backslash anywhere after the leading
   `./`; validation does not report it.
3. A relative path resolves only when the client holds the marketplace's files, which depends on
   the marketplace source (§15.8):
   - `github`, `git`, `file` and `directory`: the client has the files, and the path resolves. <!-- req: marketplace.rule.Relative path plugin source.github, git, file, and directory -->
   - `url`: only `marketplace.json` was fetched, so a relative path cannot resolve. Each plugin of
     such a marketplace needs an object source (§15.11.2). <!-- req: marketplace.rule.Relative path plugin source.url -->
   - `settings`: a relative path is rejected outright. <!-- req: marketplace.rule.Relative path plugin source.settings -->
4. At install and at load, the client MUST refuse an entry path that is absolute, climbs out of the
   marketplace, is spelled like a network path, contains a backslash after `./` on macOS or Linux,
   or, in a marketplace fetched from a remote source, reaches its target through a symbolic link
   that resolves outside the marketplace directory. The install refusal reads `Cannot install
   <plugin>@<marketplace>: its marketplace entry path does not stay inside the marketplace
   directory (...)`; an installed plugin whose entry fails the check is listed as failed to load
   with `Plugin source path refused: <path> does not stay inside its marketplace directory. Check
   that the marketplace entry has a plain relative path.` (`errors.md`, "Marketplace entry path
   does not stay inside the marketplace directory"). A validator never follows a symbolic link in a
   local source. For a source that is or traverses one it warns, under `plugins[<i>].source`,
   `Local source "<source>" is or traverses a symlink, so <path> was not read — validation never
   follows one. Install dereferences symlinks that stay inside the marketplace, so this entry still
   loads. Validate the real path separately.`; §15.10 gives the messages for an entry `plugin.json`
   that is itself a link or that a file stands in the way of (oracle 2.1.321, corpus; Judgment
   J15.13).

### 15.6.2 Bare names under `pluginRoot`

A bare name is one directory name with no `/`, such as `"formatter"`. With
`"metadata": { "pluginRoot": "./plugins" }`, `"source": "formatter"` resolves to
`./plugins/formatter`. `pluginRoot` MUST be a relative path inside the marketplace; it has no
effect on a source that starts with `./`; and a source containing `/`, such as `team-a/formatter`,
is not a bare name and still needs `./`. Without `pluginRoot`, a bare name fails as item 1 of
§15.6.1 says. Requires v2.1.239 or later. Judgment J15.6 covers a `pluginRoot` without `./`. <!-- req: marketplace.rule.Bare names under pluginRoot -->

### 15.6.3 `github`, `url` and `git-subdir`

- **`github`**: `repo` is REQUIRED, in `owner/repo` form; `ref` and `sha` are OPTIONAL. <!-- req: marketplace.rule.github plugin source -->
- **`url`**: `url` is REQUIRED, a full git URL: `https://`, `http://`, `file://` or `git@`. A `.git`
  suffix is not required, so Azure DevOps and AWS CodeCommit URLs work as written. The type does
  not take `owner/repo` shorthand (Judgment J15.7). <!-- req: marketplace.rule.url plugin source -->
- **`git-subdir`**: `url` (a full git URL or GitHub `owner/repo` shorthand) and `path` (the
  subdirectory holding the plugin) are REQUIRED. The client checks out only `path`; over an `https`
  or SSH URL it asks the server for a partial clone, so a host that supports partial clones serves
  the plugin without the rest of the repository. <!-- req: marketplace.rule.git-subdir plugin source -->

Before running git, the client checks every git address and refuses one whose protocol it does not
support, or that git could read as naming another server or folder than the one it shows, with a
message containing `Invalid git URL` followed by what to change. The check applies to adding a
marketplace, installing a plugin and updating alike (`plugins/troubleshooting.md`, "Invalid git
URL"). <!-- req: marketplace.troubleshooting.Invalid git URL -->

### 15.6.4 `npm`

1. `package` (REQUIRED) is a registry package name (`@your-org/formatter`), a name with a version
   (`@your-org/formatter@2.0.0`), or an `https` link to the package's tarball. <!-- req: marketplace.rule.npm plugin source.package -->
2. `version` (OPTIONAL) is a version, a semver range or a dist-tag, used when `package` is a name
   without a version; without it the client fetches `latest`. <!-- req: marketplace.rule.npm plugin source.version -->
3. `registry` (OPTIONAL) is the registry URL for a package not on the default registry. It MUST use
   `https`, unless it is the installing user's own default npm registry; with any other `http`
   registry the install fails before npm is contacted. <!-- req: marketplace.rule.npm plugin source.registry -->
4. The client fetches the package with the user's npm client. Install scripts (`preinstall`,
   `postinstall`, ...) MUST NOT run, and dependencies are not installed by the fetch; a supported
   lockfile beside `package.json` leads to a separate dependency install, also with scripts off
   (§16). <!-- req: marketplace.rule.npm plugin source -->
5. Before fetching, the client checks `package` and refuses, naming the value and the reason
   (`plugins/troubleshooting.md`, "An npm plugin source must name a registry package"):
   - a git address, a folder or `file:` path, or an `npm:` alias;
   - a tarball link on github.com, gist.github.com, gitlab.com, bitbucket.org or git.sr.ht, a
     GitHub release download included, except a GitLab npm registry link under
     `gitlab.com/api/v4/`;
   - a tarball link over `http`, unless it points at the user's own default npm registry. <!-- req: marketplace.rule.npm plugin source.A tarball link over http -->

   A `package` containing `..` fails validation already, as `Invalid input` (§15.6.7).

### 15.6.5 `archive`

`url` (REQUIRED) MUST be a URL, MUST use `https://` and MUST NOT point at a loopback, link-local or
cloud-metadata host. A validator reports a `url` that does not parse as a URL as `Invalid URL`, and
one that breaks the scheme or host rule as `Archive URLs must use https:// and must not point at a
loopback, link-local, or cloud-metadata host`, both errors under `plugins.<i>.source.url`; a value
that does not parse gets both (oracle 2.1.325, Judgment J15.8). The plugin root may be the top of the zip or one
directory down. `sha256` (OPTIONAL) is the archive's digest, 64 hex characters in either case;
when set, the client MUST refuse a download that does not match. Download and extraction limits
are §15.12. <!-- req: marketplace.rule.archive plugin source -->

### 15.6.6 `command`

A `command` source names a tool on the user's machine that produces the plugin directory. The
client runs the command when the user installs or updates the plugin and again once per session
(§16 says when).

| Field | Rule |
| --- | --- |
| `command` | REQUIRED. A shell command that prints the plugin directory's absolute path as one line and exits 0. It MUST be printable ASCII, at most 500 characters, with no run of four or more spaces, because the user is shown the whole string before it runs. A validator reports a command over 500 characters as `command must not be longer than the install consent UI can display`, and a character or spacing break as `command must be printable ASCII (letters, digits, punctuation, single spaces) with no runs of 4 or more spaces`, both errors under `plugins.<i>.source.command`; a command that breaks both gets both (Judgment J15.8). <!-- req: marketplace.rule.command plugin source.command --> |
| `timeout` | OPTIONAL. A whole number of seconds from 1 to 600; default 60. <!-- req: marketplace.rule.command plugin source.timeout --> |
| `mode` | OPTIONAL. `copy` (default) or `link`. <!-- req: marketplace.rule.command plugin source.mode --> |

Administrators turn command sources off with `disableCommandPluginSources` (§14). The user accepts
the command before it runs (§16); a changed command must be accepted again (§15.16).

**What the command must do.**

- It is run through `sh`, or `cmd.exe` on Windows, with the user's home directory as working
  directory; it SHOULD be an absolute path or a command on `PATH`. <!-- req: marketplace.rule.What the command must do.Shell and working directory -->
- It MUST print exactly one line on stdout, the absolute path of the plugin directory, and exit 0
  within `timeout` seconds. <!-- req: marketplace.rule.What the command must do.Output -->
- The directory MUST hold the complete plugin when the command exits; the path MAY differ from one
  run to the next. <!-- req: marketplace.rule.What the command must do.Directory contents -->

**Output that fails the install or update.** The install or update MUST fail when the command exits
non-zero, runs past `timeout`, or prints anything other than one absolute path, and when the printed
directory is:

- without plugin content at its top level: no `.claude-plugin/`, `skills/`, `commands/`, `agents/`
  or `hooks/`; <!-- req: marketplace.rule.Output that fails the install or update.No plugin content -->
- the directory the client was started in, or one of its parents; <!-- req: marketplace.rule.Output that fails the install or update.The session's own directory -->
- on Windows, a UNC path; <!-- req: marketplace.rule.Output that fails the install or update.A network path -->
- in copy mode, larger than 256 MiB or holding more than 20,000 entries. <!-- req: marketplace.rule.Output that fails the install or update.Too large to copy -->

**Copy mode and link mode.** `mode` decides whether the client copies the printed directory or uses
it in place. <!-- req: marketplace.rule.Copy mode and link mode -->

- **`copy`**: the client copies the directory into the plugin cache and derives the plugin version
  from a hash of the copied files (§16). The tool MAY delete or rewrite the directory once the
  command exits; a re-run that produces identical files is up to date. Symbolic links are kept
  only when they resolve within the printed directory (§15.11.5). <!-- req: marketplace.rule.Copy mode and link mode.copy -->
- **`link`**: the client fills the plugin's cache entry with one link per top-level entry of the
  printed directory and loads the files in place: nothing is copied or hashed and the size limits
  do not apply. The version comes from the printed directory's real path and its top-level entries,
  so a tool signals new content by printing a different path. A top-level entry that is a symbolic
  link pointing outside the printed directory fails the install. <!-- req: marketplace.rule.Copy mode and link mode.link -->

A link-mode plugin also has these rules:

- The printed directory MUST stay in place while the plugin is installed: the client loads through
  the links at every startup. <!-- req: marketplace.rule.Copy mode and link mode.Keep the directory in place -->
- The client skips the Node.js dependency install (§16) for it, so the directory MUST already
  contain its `node_modules`. <!-- req: marketplace.rule.Copy mode and link mode.Include node_modules -->
- A session started in the printed directory or below it MUST NOT load the plugin. <!-- req: marketplace.rule.Copy mode and link mode.Sessions started inside the directory -->
- On Windows the client MUST refuse to install it; `"mode": "copy"` is the form there. <!-- req: marketplace.rule.Copy mode and link mode.Not on Windows -->

### 15.6.7 Invalid input on a source

An object source that matches no type fails validation with `plugins.<i>.source: Invalid input`.
The causes are: an entry with no `source` key; a `source` type that is not one of §15.6; a known
type with a required field missing or of the wrong type — `github` without `repo` or with a
non-string `repo`, `url` without `url`, `git-subdir` without `path`, `npm` without `package`,
`archive` without `url`, `command` without `command`; and an `npm` `package` containing `..`. Each
is the one error `plugins.<i>.source: Invalid input`, with no field named (oracle 2.1.325,
Judgment J15.8). A
field present with an invalid value names that field instead, as in `plugins.<i>.source.timeout:
Too small: expected number to be >0` or `plugins.<i>.source.sha: Must be a full 40-character
lowercase git commit SHA`. The type `"unsupported"` fails with `source.source: 'unsupported' is a
parse-time placeholder and cannot be authored`. <!-- req: marketplace.rule.Invalid input on a source -->

## 15.7 Git submodules in the marketplace repository

When the client clones a marketplace repository, it MUST fetch only the git submodules that hold
plugin files (v2.1.295 or later; earlier versions fetched every submodule, nested ones included,
which could run past the clone timeout). <!-- req: marketplace.rule.Git submodules in the marketplace repository -->

**A plugin in a subdirectory** (`./plugins/formatter`) gets a submodule when:

- the submodule is the plugin's directory or a directory above it; <!-- req: marketplace.rule.Git submodules in the marketplace repository.The plugin is inside the submodule -->
- the submodule is anywhere under the plugin's directory; <!-- req: marketplace.rule.Git submodules in the marketplace repository.The submodule is inside the plugin -->
- a symbolic link committed to the repository has its target in the submodule.

**A plugin at the root** (`"source": "./"`) gets every submodule or none. It gets every submodule
when any of these points into any submodule:

- a component directory at the root, such as `skills/`, `hooks/` or `bin/`; <!-- req: marketplace.rule.Git submodules in the marketplace repository.A component directory -->
- a path in the plugin's marketplace entry, its `plugin.json`, or a configuration file such as
  `.mcp.json` or `hooks/hooks.json`; <!-- req: marketplace.rule.Git submodules in the marketplace repository.A path in the plugin's configuration -->
- a symbolic link committed to the repository; <!-- req: marketplace.rule.Git submodules in the marketplace repository.A symbolic link -->
- a submodule's path, such as `vendor/tool`, written as text in a configuration file or in a file
  under a component directory. <!-- req: marketplace.rule.Git submodules in the marketplace repository.Text in the plugin's files -->

Otherwise it gets none. The client also fetches every submodule where it cannot tell: when a
`SKILL.md` is at the root (the whole repository is one skill's directory), and when it cannot read
the marketplace file, one of the plugin's configuration files, or `.gitmodules`. <!-- req: marketplace.rule.Git submodules in the marketplace repository.A SKILL.md at the root | marketplace.rule.Git submodules in the marketplace repository.A file Claude Code can't read -->

A marketplace added with `--sparse`, or whose source sets `sparsePaths`, checks out only the named
directories and fetches no submodule.

An author keeps an unused submodule out of the clone by placement: a submodule a subdirectory plugin
needs goes inside the plugin's directory and one it does not need outside it; a root plugin whose
repository has a large build-only submodule moves into a subdirectory (`plugins/create-marketplace.md`,
"Keep unused submodules out of the clone"). <!-- req: marketplace.create.Keep unused submodules out of the clone -->

A root plugin that runs a file from a submodule finds the submodule's directory empty after install
when no path the client can read names it; a path a script builds at run time is not seen. Writing
the path out in full, such as `${CLAUDE_PLUGIN_ROOT}/vendor/tool/run.sh` in a hook command, makes
the client fetch every submodule for that plugin (`plugins/troubleshooting.md`). <!-- req: marketplace.troubleshooting.A root plugin's files from a git submodule are missing after install -->

## 15.8 Marketplace sources

A marketplace source says where the client fetches a `marketplace.json`. The add command builds one
from the string typed (§15.8.3); an `extraKnownMarketplaces` entry (§12) holds one as its `source`
object; the policy lists `strictKnownMarketplaces` and `blockedMarketplaces` hold arrays of them
(§14). <!-- req: marketplace.rule.Marketplace sources -->

### 15.8.1 Types

| Type | Fields | As an `extraKnownMarketplaces` source |
| --- | --- | --- |
| `url` | `url`, `headers`, `headersHelper` | Loads: the client downloads that one `marketplace.json`. <!-- req: marketplace.rule.Marketplace sources.url --> |
| `github` | `repo`, `ref`, `path`, `sparsePaths` | Loads: the client clones the GitHub repository. <!-- req: marketplace.rule.Marketplace sources.github --> |
| `git` | `url`, `ref`, `path`, `sparsePaths` | Loads: the client clones the repository. <!-- req: marketplace.rule.Marketplace sources.git --> |
| `npm` | `package` | Fails to load: `NPM marketplace sources not yet implemented`. <!-- req: marketplace.rule.Marketplace sources.npm --> |
| `file` | `path` | Loads: the client reads the file in place. <!-- req: marketplace.rule.Marketplace sources.file --> |
| `directory` | `path` | Loads: the client reads the directory in place. <!-- req: marketplace.rule.Marketplace sources.directory --> |
| `settings` | `name`, `plugins`, `owner` | Loads: the catalog is inline, with no hosted file. <!-- req: marketplace.rule.Marketplace sources.settings --> |
| `skills-dir` | none | Fails to load: `Unsupported marketplace source type`. Valid only in the policy lists (§14). <!-- req: marketplace.rule.Marketplace sources.skills-dir --> |
| `hostPattern` | `hostPattern` | Fails to load: `Unsupported marketplace source type`. Valid only in the policy lists, as a regular expression tested against the host of a `github`, `git` or `url` source (§14). <!-- req: marketplace.rule.Marketplace sources.hostPattern --> |
| `pathPattern` | `pathPattern` | Fails to load: `Unsupported marketplace source type`. Valid only in the policy lists, as a regular expression tested against the `path` of a `file` or `directory` source (§14). <!-- req: marketplace.rule.Marketplace sources.pathPattern --> |

A marketplace hosted on claude.ai for the user's account, such as the organisation's plugin
library or the user's own uploads, has none of these sources: it is added by name (`claude plugin
marketplace add --claudeai <name>`, §17.14.1; v2.1.273 or later), is declared in no settings file,
and is listed with source `claudeai`. The policy lists match it by its host, `claude.ai` (§14.8.3):
an allowlist `hostPattern` for that host admits the organisation's claude.ai marketplaces and the
claude.ai default ones, never one of a member's own uploads or one whose scope claude.ai did not
state. <!-- docs: plugins/org.md | Marketplaces hosted on claude.ai --> <!-- docs: plugins/install.md | Add a marketplace from claude.ai -->

The names `url`, `git` and `github` mean different things here and in a plugin source: a `url`
marketplace source is a direct link to a `marketplace.json`, not a repository; a `git` plugin source
does not exist; and a `github` marketplace source takes `path` and `sparsePaths` but not `sha`.

### 15.8.2 Fields

| Field | Types | Rule |
| --- | --- | --- |
| `url` | `url` | The link to the `marketplace.json` file. Only that file is downloaded, so the marketplace's plugins cannot use relative-path sources (§15.6.1); download limits are §15.12. For `git`: the repository to clone. <!-- req: marketplace.sourceField.url --> |
| `headers` | `url` | A map of HTTP headers sent with the fetch, for authenticated hosts (§15.15). <!-- req: marketplace.sourceField.headers --> |
| `headersHelper` | `url` | A command printing headers too short-lived for `headers` (v2.1.238 or later; §15.15). <!-- req: marketplace.sourceField.headersHelper --> |
| `repo` | `github` | One repository, `owner/repo`. The add command refuses `owner/*` as not a valid shorthand; in `extraKnownMarketplaces` the client takes it literally and the clone fails. `owner/*` is valid only in the policy lists (§14). <!-- req: marketplace.sourceField.repo --> |
| `ref` | `github`, `git` | A branch, a tag, or the full lower-case SHA of a commit on a branch or tag; default, the repository's default branch. A SHA (2.1.324 or later) pins the marketplace, so refreshes and auto-updates do not move it off that commit; earlier clients cannot load a marketplace pinned this way. A SHA is refused for a marketplace with a reserved name (§15.3.2). A plugin entry with its own remote source can still update, so it is pinned with its own `sha` (§15.6). <!-- req: marketplace.sourceField.ref --> |
| `path` | `github`, `git` | The catalog's path inside the repository; default `.claude-plugin/marketplace.json`. For `file`: the catalog file itself, read in place, whose directory two levels up is the marketplace root, so the file belongs at `<root>/.claude-plugin/marketplace.json`. For `directory`: the marketplace root. <!-- req: marketplace.sourceField.path --> |
| `sparsePaths` | `github`, `git` | Directories for a sparse checkout, such as `[".claude-plugin", "plugins"]`; `--sparse` on the add command sets it. <!-- req: marketplace.sourceField.sparsePaths --> |
| `skipLfs` | `github`, `git` | Accepted and without effect (§15.11.4). <!-- req: marketplace.sourceField.skipLfs --> |
| `name` | `settings` | MUST equal the `extraKnownMarketplaces` key and MUST NOT be a reserved name (§15.3.2). <!-- req: marketplace.sourceField.name --> |
| `plugins` | `settings` | The inline catalog. Each item takes `name`, `source`, `description`, `version`, `strict`, `engines` (as an entry's, §15.4; the `Settings` type of `@anthropic-ai/claude-agent-sdk` 0.3.330), `headers` and `headersHelper`; each `source` MUST be an object type, because a relative path has no repository to resolve against. <!-- req: marketplace.sourceField.plugins --> |

### 15.8.3 What the add command builds

`claude plugin marketplace add <source>` (and `/plugin marketplace add`) builds a source from its
argument, trying the forms in this order (Judgment J15.9):

| Argument | Source |
| --- | --- |
| A path starting with `./`, `../`, `/` or `~/` (on Windows also `.\`, `..\`, `C:\`) | `file` when it ends in `.json`, otherwise `directory` |
| An `http://` or `https://` URL ending in `.git` (optionally `#ref`) or containing `/_git/` | `git`, the URL as written |
| `https://github.com/owner/repo` or `https://gitlab.com/namespace/project` (or over `http://`) | `git`, `.git` appended |
| Any other `http://` or `https://` URL | `url` |
| `user@host:path[.git][#ref]` | `git` over SSH |
| `owner/repo`, `owner/repo#ref` or `owner/repo@ref` | `github` |

`#ref` pins `ref`. The add command never produces `npm`, `settings`, `skills-dir`, `hostPattern` or
`pathPattern`. These inputs fail:

- An argument in none of the forms, such as a bare name (`claude-plugins-official`) or a bare host
  (`marketplace.anthropic.com`), fails with `Invalid marketplace source format. Try: owner/repo,
  https://..., or ./path` (the docs also give `That isn't a marketplace source`, Judgment J17.37);
  the same applies to `claude plugin install <plugin> --marketplace <source>`. <!-- req: marketplace.troubleshooting.Invalid marketplace source format -->
- A string with a slash that does not follow GitHub's naming rules for `owner/repo` (a host or an
  extra segment, as in `github.com/owner/repo` or `gitlab.example.com/group/project`) fails with
  `'<source>' is not a valid GitHub owner/repo shorthand.` followed by the accepted forms: the
  repository's full clone URL for a repository on any host, the `https://` URL of a hosted
  `marketplace.json`, or `./path` or an absolute path for a local checkout. <!-- req: marketplace.troubleshooting.'<source>' is not a valid GitHub owner/repo shorthand.A repository on any host | marketplace.troubleshooting.'<source>' is not a valid GitHub owner/repo shorthand.A hosted marketplace.json | marketplace.troubleshooting.'<source>' is not a valid GitHub owner/repo shorthand.A local checkout -->
- A local path where nothing exists fails with `Path does not exist: <path>`, the path resolved
  against the current directory; a path to a file that does not end in `.json` fails with `File
  path must point to a .json file (marketplace.json)`. <!-- req: marketplace.troubleshooting.Path does not exist: <path> -->
- A clone or download with no catalog at the expected path fails with `Failed to add marketplace:
  Marketplace file not found at <path>/.claude-plugin/marketplace.json` (or the source's `path`). <!-- req: marketplace.troubleshooting.Marketplace file not found at <path>/.claude-plugin/marketplace.json -->

On success the marketplace is listed by `/plugin marketplace list` under the catalog's `name`, not
the repository's or URL's; the shell command prints `Added marketplace: <name> (declared in <scope>
settings)` in a terminal and `Successfully added marketplace: …` otherwise (§17.2.1, §17.14.1).

### 15.8.4 Marketplace names in an install line

`/plugin install <plugin>@<name>` for a `<name>` not registered fails with `Marketplace "<name>" not
found`. The client has no index of marketplace names and MUST NOT guess a source from the name; a
`claudeai-` name is added from claude.ai by name (`claude plugin marketplace add --claudeai
<name>`), any other only from its source. `/plugin install <source>` with a path, URL or `owner/repo`
reports the same message instead of installing, even for an added source. The message also appears
on the `/plugin` Errors tab when a plugin enabled in settings names a marketplace that is not added
(`plugins/troubleshooting.md`). <!-- req: marketplace.troubleshooting.Marketplace "<name>" not found -->

The official marketplace, `claude-plugins-official` from `anthropics/claude-plugins-official`, is
registered by the client on its own the first time an interactive terminal session starts, unless a
policy blocks its source or `CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL` is set; a failed
attempt is retried later. The `claude plugin` shell commands never register it. Until it is
registered, an install from it fails with `Marketplace "claude-plugins-official" not found`, and
adding `anthropics/claude-plugins-official` fixes it (`plugins/troubleshooting.md`;
`plugins/anthropic-marketplaces.md`). <!-- req: marketplace.troubleshooting.Marketplace "claude-plugins-official" not found -->

### 15.8.5 Refreshing and removing

A marketplace is refreshed by `claude plugin marketplace update <name>` (`/plugin marketplace update
<name>` in a session), by `claude plugin update <plugin>@<name>`, and by background auto-update when
it is on (§15.14, §16). A git marketplace is refreshed by fetching or re-cloning; a `url` one by
downloading the file again; a `file` or `directory` one is read in place on each load. A successful
refresh prints `Updated marketplace: <name>` from the shell in a terminal (`Successfully updated
marketplace: <name>` otherwise, §17.2.1) and `✔ Updated 1 marketplace` in a session.

`claude plugin marketplace remove <name>` removes the marketplace's declaration; removing it from
the last scope that declares it also deletes its cache and uninstalls its plugins (§17.14.3;
`plugins/create-marketplace.md`, "Remove the marketplace to start over"). <!-- req: marketplace.create.Remove the marketplace to start over -->

## 15.9 Relevance

An entry's `relevance` tells the client when to suggest the plugin (`plugins/relevance.md`).

### 15.9.1 Fields

| Field | Type | Rule | Limit |
| --- | --- | --- | --- |
| `topic` | string | The phrase in "Working with *topic*?". Default: the plugin name with each hyphen-separated segment capitalized. | 64 characters |
| `signals` | object | The matchers. The client suggests the plugin only when at least one signal is set. | |
| `signals.cwd` | string[] | Glob patterns against the working directory (§15.9.2). | 10 patterns of 256 characters |
| `signals.cli` | string[] | Command names Claude has run this session, exact match (§15.9.2). | 10 entries of 64 characters |
| `signals.hosts` | string[] | Hostnames seen in `http://` or `https://` URLs in Bash commands this session; a bare lower-case hostname with no scheme, port or path, matched case-insensitively. | 20 entries of 128 characters |
| `signals.filesRead` | string[] | Glob patterns against paths of files Claude has read this session, forward-slash normalized and case-insensitive. | 10 patterns of 256 characters |
| `signals.manifestDeps` | `{ file, pattern }[]` | Dependencies in package manifests Claude has read (§15.9.2). | 10 entries, each value 256 characters; manifests over 512 KB are skipped |

`filesRead` and `manifestDeps` also match files Claude has written or edited this session and the
project's auto-loaded `CLAUDE.md` files. Unknown keys under `relevance` and `relevance.signals` are
ignored at load (a validator warns). A recognized field whose value exceeds its limit, or a `hosts`
entry with a scheme, port, path or upper-case letter, invalidates the whole entry: the plugin cannot
be installed from the marketplace until it is fixed (Judgment J15.10). A `relevance` that is not an
object is ignored with the warning `'relevance' must be an object containing topic and signals; got
<type>. It will be ignored at load time.` <!-- req: marketplace.relevance.relevance | marketplace.relevance.Add relevance to a plugin entry -->

### 15.9.2 Matching

Matching runs locally and adds no network traffic; the client MUST NOT report which signals matched,
or their values, to Anthropic or the marketplace operator.

- **`cwd`** is the only signal that can match at session start. Each pattern is matched against the
  working directory as an absolute path and, inside a git repository, also as a path relative to
  the repository root, forward-slash normalized and case-insensitively. A pattern matches the
  directory and everything under it, so `infra`, `infra/` and `infra/**` are the same. <!-- req: marketplace.relevance.Working directory matching -->
- **`cli`**: for each shell command Claude runs, the client records one command name, the first
  token after any leading environment assignments and `sudo`. A compound command records only its
  leading command: `cd infra && terraform plan` records `cd`. <!-- req: marketplace.relevance.Command name matching -->
- **`manifestDeps`**: `file` and `pattern` are JavaScript `RegExp` sources. `file` is matched
  case-insensitively against the manifest's path, which is typically absolute and not
  separator-normalized (backslashes on Windows); `pattern` is matched case-sensitively against the
  file's contents. <!-- req: marketplace.relevance.Manifest dependency matching -->

### 15.9.3 Where suggestions appear

A suggestion appears only for a plugin that is not installed, from a marketplace listed in the
managed `pluginSuggestionMarketplaces` whose registered source matches the source managed settings
declare for that name (§14). The client never installs a suggested plugin; the user confirms.

- **Spinner tip**: while Claude responds, `Working with <topic>? Install the <plugin> plugin:` and
  `/plugin install <plugin>@<marketplace>`. <!-- req: marketplace.relevance.Understand how plugin relevance works.Spinner tip -->
- **Session-start notification**: when a `cwd` signal matches, before the first message, `plugin
  suggestion: <plugin>@<marketplace> · /plugin`. <!-- req: marketplace.relevance.Understand how plugin relevance works.Session-start notification -->
- **`/plugin` Discover tab**: the plugin is pinned above the other results with an annotation naming
  the signal, such as `suggested for this directory`. The pin is shown the first time the tab is
  opened while the signals match; the client records that in `~/.claude.json`, and later openings
  show the plugin in normal order. <!-- req: marketplace.relevance.Understand how plugin relevance works./plugin Discover tab -->

The spinner tip and the notification together appear at most once every three sessions for a
plugin; the notification stops after the two have shown the plugin twice in total; neither repeats
once the plugin is installed. Both stop when `spinnerTipsEnabled` is `false` or a
`spinnerTipsOverride` with `excludeDefault` replaces the built-in tips; the Discover pin is not
affected.

### 15.9.4 Validation

A validator reports unknown keys under `relevance` and `relevance.signals` as warnings, a
`relevance` that is not an object as a warning, a value over its limit as an error, and a `hosts`
entry with a scheme, port or path as the error `must be a lowercase bare hostname (no scheme, port,
or path)`, each prefixed with the field's path (`plugins.<i>.relevance.signals.hosts.<j>`). <!-- req: marketplace.relevance.Validate your marketplace -->

## 15.10 Validation

`claude plugin validate <path>` validates a marketplace given its root, or the file itself when the
file is named `marketplace.json` (§2.11, §17). It reads only files inside the marketplace directory.
Messages name an entry by index, as `plugins.1.source` or `plugins[1].source`; a message prefixed
`plugins[<i>] plugin.json →` is about the `plugin.json` of a relative-path entry, which the
validator also checks with the rules of §2. A validator MUST reach the verdict `claude plugin
validate` reaches (Judgment J15.11).

It reports (`plugins/create-marketplace.md`, "Problems that validation reports"): JSON syntax
errors (`json: Invalid JSON syntax: <reason>`); missing required fields; marketplace and plugin names
that break §15.3; a relative `source` with `..`; unknown fields, as warnings; and the problems of
each relative-path plugin's `plugin.json`. <!-- req: marketplace.create.Problems that validation reports -->

Besides the messages of §15.2 to §15.9, the marketplace-level messages are:

| Message | Level |
| --- | --- |
| `Duplicate plugin name "<name>" found in marketplace` | Error |
| `plugins[<i>].source: Path contains "..": <path>` | Error <!-- req: marketplace.troubleshooting.Marketplace validation errors.Path contains "..": <path> --> |
| `Plugin "<name>" sets headersHelper but is not "strict": false` | Error |
| `renames.<old>: chain does not resolve (<reason>) — target must be a name in plugins[], a key in renames, or null`, the reason `target-missing` or `cycle` | Error |
| `renames.<old>: target "<x>" is not a valid plugin name (PluginIdSchema)` | Error |
| `Marketplace has no plugins defined` | Warning <!-- req: marketplace.troubleshooting.Marketplace validation errors.Marketplace has no plugins defined --> |
| `No marketplace description provided. Adding a description helps users understand what this marketplace offers` | Warning <!-- req: marketplace.troubleshooting.Marketplace validation errors.No marketplace description provided --> |
| `Plugin name "<name>" is not kebab-case`, under `plugins[<i>] plugin.json → name` | Warning <!-- req: marketplace.troubleshooting.Marketplace validation errors.Plugin name "<name>" is not kebab-case --> |
| `Plugin "<name>" sets headers/headersHelper, which only apply to "archive" sources; they have no effect on this entry.` | Warning |
| `Plugin "<name>" fetches its archive with a headersHelper but sets no sha256 pin` | Warning |
| `Header "<name>" is a request-routing/identity header that catalog entries may not set; Claude Code drops it at download time.` | Warning |
| `Unknown field '<key>'. Claude Code ignores it at load time.` | Warning |
| `<path> is a symlink or is not a regular file, so it was not validated. Install reads it anyway. Validate it separately.`, under `plugins[<i>].source` | Warning |
| `A path component of <path> is not a directory, so the file cannot be read. The entry will fail to load at install time.`, under `plugins[<i>] plugin.json → file` | Error |
| `Could not parse <path> for version cross-check: <parser message>`, under `plugins[<i>].source` (§15.5.4) | Warning |

The last three rows concern the `plugin.json` of a relative-path entry, `<path>` being that file from
the marketplace root without a leading `./`. The validator reads it without following a symbolic
link: when the file is a link, a FIFO or a directory, it warns and checks nothing in it, because the
install reads the file anyway; when a component of its path is a file (an entry `./skills/x.md`
whose `plugin.json` would be `skills/x.md/.claude-plugin/plugin.json`), the entry cannot load and
the run fails. A `plugin.json` that does not parse draws its own `plugins[<i>] plugin.json → json:
Invalid JSON syntax: <parser message>` error and the cross-check warning (oracle 2.1.321, corpus;
Judgment J15.13).

**What validation does not catch** (`plugins/create-marketplace.md`, "Problems that surface when you
add or install"; "Failures that validation doesn't catch"): the exact official names, other
spellings of reserved names, the JavaScript member names and `claudeai-` names pass validation and
are refused when the marketplace is added (§15.3.2); a wrong `repo` or `path` of a remote source,
and any fetch error, appear only at install, when the source is first fetched; a relative source
whose directory does not exist fails at install with `Source path does not exist: <path>`; an entry
`hooks` written as a path or array fails only at load (§15.5.3). `claude plugin list` shows a plugin
that failed to load with its error. <!-- req: marketplace.create.Problems that surface when you add or install | marketplace.rule.Failures that validation doesn't catch -->

## Design decisions

### Why an entry and `plugin.json` combine by fixed rules instead of a deep merge

The entry is written by the marketplace owner and `plugin.json` by the plugin author, often in
another repository and at another time. Fixed rules — `plugin.json` is the manifest, the entry adds
components only in strict mode, display fields and `defaultEnabled` belong to the catalog, `version`
to the plugin — let each side predict the result without seeing the other's file. A non-strict entry
that also declares components is refused rather than merged, because silently dropping one side's
components would ship a plugin neither author wrote.

### Why some reserved names pass validation

`claude plugin validate` checks a catalog without knowing where it will be hosted. An official name
is legitimate from `github.com/anthropics/`, so only adding the marketplace, which knows the source,
can refuse it; the same holds for the names whose refusal depends on what is already registered.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J15.1 | The top-level `description` and `version` win over `metadata.description` and `metadata.version` when both are set (§15.2). | The docs call `metadata.*` an "alternate location" without an order; the top-level key is the primary documented one. |
| J15.2 | The impersonation test: the name contains a non-ASCII character; or, lower-cased with every run of characters other than letters, digits and `_` read as one `-`, its words put `official` beside `claude`, `anthropic` or `anthropics`, or start with one of those brand words followed by `marketplace`, `marketplaces`, `plugin`, `plugins`, `official` or `directory`, or start with all the words of a reserved name that begins with a brand word. An exact reserved name and another spelling of one (§15.3.2 item 4) are not impersonation (§15.3.2). | The docs give only examples (`official-claude-plugins`, `claude-plugins-v2`, non-ASCII). Lead: the reference implementation's `src/format/marketplace/marketplace-names.ts`. Oracle 2.1.325: `official-claude-plugins`, `claude-plugins-v2` and `café` draw the error; `claude.code.plugins`, `claude_code_plugins` and `claude-plugins-official` pass validation. |
| J15.3 | `npm`, `pip`, `uv`, `cargo`, `github` and `gh` are ordinary marketplace names; the `claude-plugin-test` message is `Marketplace name "claude-plugin-test" is reserved for plugins loaded by claude plugin test` (§15.3.2). | The 2.1.321 docs reserved the six names; the 2.1.330 docs drop them from "Reserved names" and from the "Validation messages" table (the id `marketplace.rule.Reserved names.npm, pip, uv, cargo, github, and gh` is gone), and the 2.1.325 changelog reads "Fixed marketplaces named `npm`, `pip`, `uv`, `cargo`, `github` or `gh` being refused as reserved names". Oracle 2.1.325: `npm`, `gh` and `NPM` pass validation. Oracle 2.1.330, 2026-11-23, private config dir: `npm`, `GitHub` and `gh` pass validation and `claude plugin marketplace add ./<dir>` adds each. The `claude-plugin-test` wording is 2.1.325's. |
| J15.4 | With `plugin.json` present, entry `plugin.json` fields other than the component fields, the display fields, `defaultEnabled`, `version` and `dependencies` (such as `settings`, `workflows`, `types`, `experimental`) do not apply (§15.5.1). | The docs say `plugin.json` "is the manifest" then and name only which fields combine; a field they do not name is not combined. |
| J15.5 | With `plugin.json` present, the entry's `dependencies` are appended to the manifest's (§15.5.4). | The entry table lists `dependencies` as an entry field without saying how it combines; dropping it would ignore the catalog's declared requirements. Lead: the reference implementation's `entry-merge.ts`. |
| J15.6 | A `metadata.pluginRoot` without `./`, such as `"plugins"`, is read as `./plugins`; one that climbs out with `..` or is absolute makes bare names fail, with `plugins[<i>].source: Bare source name "<name>" cannot resolve: metadata.pluginRoot ("<value>") must be a relative path inside the marketplace (e.g. "./plugins").` beside `Invalid string: must start with "./"` (§15.6.2). | The docs require "a relative path inside the marketplace" without its spelling. Oracle 2.1.325, and 2.1.330 re-run 2026-11-23: `"pluginRoot": "plugins"` with `"source": "p"` passes validation; 2.1.330 on `"../x"` prints both errors quoted. |
| J15.7 | A validator does not check the form of a `url` plugin source's `url` beyond its being a non-empty string; an `owner/repo` value fails at install with `Invalid git URL` (§15.6.3). | The docs say the type does not take shorthand but give no validation message. Oracle 2.1.325, and 2.1.330 re-run 2026-11-23: `{"source":"url","url":"owner/repo"}` passes validation. |
| J15.8 | The `command` text rules draw two validator messages: over 500 characters, `command must not be longer than the install consent UI can display`; a non-printable character or a run of four spaces, `command must be printable ASCII (letters, digits, punctuation, single spaces) with no runs of 4 or more spaces`; both can appear for one command. A `timeout` out of range is reported as a range error on `source.timeout` (§15.6.6). An archive `url` that does not parse draws `Invalid URL` beside the https message (§15.6.5); a source matching no type, or a known type missing a required field or holding one of the wrong type, is the bare `plugins.<i>.source: Invalid input` (§15.6.7). | The docs give the rules, not the wording. Oracle 2.1.325 prints these texts (`Too small: expected number to be >0`, `Too big: expected number to be <=600`); a 500-character command validated, 501 characters drew the length message, and 501 with a four-space run drew both. `"url": "not a url"` on `archive` drew `Invalid URL` and the https message; `http://` only the https message. No `source`, `bogus`, `github` without or with a numeric `repo`, `url`, `git-subdir`, `npm`, `archive` and `command` without their required field, and `npm` `../x` each drew only `plugins.0.source: Invalid input`. |
| J15.9 | The add command tries a local path first, then an `http(s)` URL, then SSH, then GitHub shorthand; a path ending in `.json` in any letter case is a `file` source; an empty `#ref` is refused as an unrecognized format (§15.8.3). | `cli-reference.md` gives the forms as a table without precedence; the forms do not overlap except by these edges. Lead: the reference implementation's `src/marketplace/marketplace-input.ts`. |
| J15.10 | Relevance limits count UTF-16 code units; a `hosts` entry with an upper-case letter is invalid like one with a scheme (§15.9.1). | The docs say "characters" and "bare lowercase hostname". Oracle 2.1.325 reports `must be a lowercase bare hostname (no scheme, port, or path)`. |
| J15.11 | A validator that finds an entry failing its own checks (source, name, relevance limits, command text) need not also report the cross-entry checks (duplicate names, `renames`, `headersHelper` without `"strict": false`); the verdict, failed, is the same. A `renames` target is checked against the id grammar only when it names neither an entry nor a `renames` key; such a target draws `chain does not resolve (target-missing)` (§15.10). | Oracle 2.1.325 reports the cross-entry errors only on a file whose entries all parse, and reports `target-missing` for the targets `"bad name"`, `"x@y"`, `""` and `"_p"`; it accepts `"bad key"` as a target that is itself a `renames` key. The 2.1.321 table lists the PluginIdSchema message without saying when it wins. |
| J15.13 | The validator's messages about the `plugin.json` of a relative-path entry are those §15.2, §15.5.4, §15.6.1 and §15.10 quote: the `plugins` type errors, the full version-mismatch warning, the cross-check parse warning, the linked-source warning with its tail, the link-or-not-a-regular-file warning and the path-component error, at the severities given there. | The 2.1.321 docs give the version and linked-source messages only up to "plugin.json wins" and "was not read", and none of the others. Oracle 2.1.321, corpus (`~/Documents/llx-plugin/.cache/corpus/oracle/2.1.321/`): `kepler` (linked `plugin.json`, warning), `corivo` (`skills/corivo-save.md/.claude-plugin/plugin.json`, error), `claude-voice-cue` (cross-check parse warning beside the `Invalid JSON syntax` error), `pdd-skill` (linked `./`), 54 plugins with the version warning, `lean` and `strale` (`plugins` missing or an object). |
| J15.15 | A marketplace entry's malformed display field refuses the install of that entry, while a malformed `engines` does not; the marketplace and its other entries are unaffected (§15.5.3). | The docs say nothing of an invalid entry field; 2.1.326's changelog relaxed only `plugin.json` display fields. Oracle 2.1.330, 2026-11-23, private config dir, a directory marketplace with relative-path entries: `claude plugin marketplace add` succeeds; `claude plugin install` fails, exit 1, for an entry with `description: 5` (`This plugin's marketplace entry is invalid: description: Invalid input: expected string, received number`), `homepage: "x"` (`homepage: Invalid URL`), and `author: "A"`, `repository: { "url": "x" }`, `keywords: "a"` together (the three problems joined by `, `); entries with `engines: 5` or `engines: { "claude-code": "banana" }` install. `claude plugin validate` reports each display problem as an error at `plugins.<i>.<field>`. |
