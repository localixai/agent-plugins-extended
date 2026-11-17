# 8.11 MCP settings and managed policy

Part of §8, [MCP servers](08-mcp.md). This part states how a plugin's servers rank against the
servers a user or an organization configures, which settings keys approve, reject and filter
servers, and the organization's managed MCP configuration, as each applies to plugin servers.
Evidence: `mcp.md` ("MCP installation scopes", "Managed MCP configuration"), `managed-mcp.md` and
`settings-reference.md` ("MCP"). The keys' types follow the `Settings` type of
`@anthropic-ai/claude-agent-sdk` 0.3.321. §12 defines how settings files merge and §14 the managed
tier in general.

## 8.11.1 Scopes, precedence and project approval

1. **Scopes.** Besides plugins, a user configures servers in three scopes:

   | Scope | Loads in | Stored in |
   | --- | --- | --- |
   | Local, the default of `claude mcp add` | The current project only, private to the user | `~/.claude.json`, under `projects["<project path>"].mcpServers` <!-- req: mcpSettings.behavior.Local scope --> |
   | Project | The current project, shared through version control | `.mcp.json` at the project root, in the `mcpServers` wrapper <!-- req: mcpSettings.behavior.Project scope --> |
   | User | Every project of the user | `~/.claude.json`, top-level `mcpServers` <!-- req: mcpSettings.behavior.User scope --> |

   "Local scope" here is not `.claude/settings.local.json`.
2. **Precedence.** When one server is defined in more than one place, the client connects it once,
   from the highest source below, using that source's entry whole; fields are never merged:
   local, then project, then user, then plugin-provided servers, then claude.ai connectors. A
   server provided through `managedMcpServers` (§8.11.4) ranks above all five. The three scopes
   match duplicates by name. Plugins and connectors match by **endpoint**: a plugin server whose
   URL, or command and arguments, equals that of an enabled server above it is a duplicate and is
   not connected. Two URLs are one endpoint when they differ only in the case of the scheme or host,
   the scheme's default port written out, or a trailing slash; a different path, query string,
   userinfo or non-default port makes two (Judgment J8.19). When one name is defined in several
   scopes with different endpoints, the client warns in `claude mcp list` and `/mcp`, quoting each
   endpoint with its `${VAR}` references unexpanded. <!-- req: mcpSettings.behavior.Scope hierarchy and precedence -->
3. **Project approval.** In an interactive session the client asks the user to approve each server
   of a project `.mcp.json` before using it; `claude -p`, SDK sessions and cloud sessions outside a
   project's threads load them without asking, and so does a session started in `bypassPermissions`
   mode with `skipDangerousModePermissionPrompt` set in user or managed settings; `claude mcp
   reset-project-choices` clears the user's answers. `enableAllProjectMcpServers` and
   `enabledMcpjsonServers` approve, `disabledMcpjsonServers` rejects, and rejection wins. In a
   folder whose workspace trust dialog has not been accepted, an approval committed to the
   project's `.claude/settings.json` is ignored, in the session and in `claude mcp list` and `claude
   mcp get`, and the server stays `⏸ Pending approval (run `claude` to approve)`. Approvals from
   the user's `~/.claude/settings.json`, managed settings and `--settings` still apply there. An
   untracked `.claude/settings.local.json` applies only in a trusted folder, because the client
   runs git to check that the file is untracked only there, or in the user's configuration home. A
   `disabledMcpjsonServers` entry in any settings file always rejects.
   <!-- req: mcpSettings.behavior.Project server approvals and workspace trust | mcpSettings.behavior.Project scope -->
4. **Plugin servers are not project servers.** A plugin's `.mcp.json` is not a project `.mcp.json`:
   enabling the plugin is the approval, and `enableAllProjectMcpServers`, `enabledMcpjsonServers`
   and `disabledMcpjsonServers` neither approve nor reject a plugin's server. The `/mcp` toggle
   (§8.10.6), the allowlist and denylist (§8.11.5) and `managed-mcp.json` (§8.11.3) do apply to it
   (Judgment J8.20).
5. **Per-run flags.** `--strict-mcp-config` makes the client use only the servers passed with
   `--mcp-config`, so a plugin's servers do not load in that run (Judgment J8.21).

## 8.11.2 Settings keys

| Key | Scope | Type and default | Effect on plugin servers |
| --- | --- | --- | --- |
| `enableAllProjectMcpServers` | Any file; in an untrusted folder honoured only from user, managed and `--settings` sources | Boolean; unset asks for each server | Approves every project `.mcp.json` server. In a trusted folder a `false` in a higher-precedence file overrides a `true` in a lower one; in an untrusted folder a `true` in any honoured file suffices. The client writes it to `.claude/settings.local.json` when the user approves all. Not a plugin server's approval (§8.11.1). <!-- req: mcpSettings.key.enableAllProjectMcpServers --> |
| `enabledMcpjsonServers` | As above | string[] of `.mcp.json` server names; unset | Approves the named project servers; written to `.claude/settings.local.json` when the user approves one. <!-- req: mcpSettings.key.enabledMcpjsonServers --> |
| `disabledMcpjsonServers` | Any file, the shared project file included | string[]; unset | Rejects the named project servers in every permission mode: never connected or asked about, shown by `claude mcp get` as `✘ Rejected (see disabledMcpjsonServers in settings)`; written to `.claude/settings.local.json` when the user rejects one; wins over both approvals. <!-- req: mcpSettings.key.disabledMcpjsonServers --> |
| `disableClaudeAiConnectors` | Any file; `true` anywhere wins | Boolean; default `false` | Turns off the claude.ai connectors the client fetches itself, neither fetched nor connected; not the connectors a cloud host or the desktop app delivers. A project-level `false` cannot undo a `true` elsewhere. `ENABLE_CLAUDEAI_MCP_SERVERS=false` does the same for one session; neither can undo the other. Plugin servers and servers passed with `--mcp-config` are unaffected. <!-- req: mcpSettings.key.disableClaudeAiConnectors --> |
| `allowedMcpServers` | Any file; lists from every file merge unless `allowManagedMcpServersOnly` | array of one-key entries; unset allows all, `[]` blocks every server users add | The allowlist (§8.11.5); plugin servers must match it. <!-- req: mcpSettings.key.allowedMcpServers --> |
| `deniedMcpServers` | Any file; lists from every file always merge | array of one-key entries; unset or `[]` blocks nothing | The denylist (§8.11.5); applies to plugin servers and wins over the allowlist. <!-- req: mcpSettings.key.deniedMcpServers --> |
| `allowManagedMcpServersOnly` | Managed only; `true` in any admin source locks | Boolean; default `false` | Reads `allowedMcpServers` from managed settings alone; denylists still merge from every scope. <!-- req: mcpSettings.key.allowManagedMcpServersOnly --> |
| `managedMcpServers` | Managed only; dropped with a warning elsewhere | object of server name to `http`/`sse` entry; unset | Remote servers provided to every user (§8.11.4); outrank a plugin server at the same endpoint. <!-- req: mcpSettings.key.managedMcpServers --> |
| `allowAllClaudeAiMcps` | Managed only | Boolean; default `false` | Loads fetched claude.ai connectors beside `managed-mcp.json`; plugin servers stay suppressed (§8.11.3). <!-- req: mcpSettings.key.allowAllClaudeAiMcps --> |
| `allowClaudeInChromeWithManagedMcp` | The device's own managed settings only: an MDM plist, an HKLM key or a system `managed-settings.json` | Boolean; default `false` | Lets the built-in Claude in Chrome server run beside `managed-mcp.json`. No effect on plugin servers. <!-- req: mcpSettings.key.allowClaudeInChromeWithManagedMcp --> |

An entry of `allowedMcpServers` or `deniedMcpServers` is an object with exactly one of `serverName`
(string), `serverCommand` (a non-empty array of strings) or `serverUrl` (string). An invalid entry
is stripped as §14 says for invalid managed entries.

## 8.11.3 `managed-mcp.json`: exclusive control

1. An organization MAY deploy `managed-mcp.json` to fix the set of MCP servers. It is a standalone
   file, never delivered through server-managed settings, in the format of a project `.mcp.json`.
   The client reads it at one path per platform: <!-- req: mcp.behavior.Managed MCP configuration -->

   | Platform | Path |
   | --- | --- |
   | macOS | `/Library/Application Support/ClaudeCode/managed-mcp.json` <!-- req: mcpSettings.managed.Deploy managed-mcp.json.macOS --> |
   | Linux and WSL | `/etc/claude-code/managed-mcp.json` <!-- req: mcpSettings.managed.Deploy managed-mcp.json.Linux and WSL --> |
   | Windows | `C:\Program Files\ClaudeCode\managed-mcp.json` <!-- req: mcpSettings.managed.Deploy managed-mcp.json.Windows --> |

   A file that is empty, not JSON or not an object takes no control, and `claude mcp list` marks the
   enterprise config as failed to parse in its `MCP config diagnostics` (Judgment J8.22).
2. While a readable file is deployed, the client loads only: the servers it defines; the servers
   provided through `managedMcpServers`; in-process servers the host application registers; and
   the built-in Claude in Chrome server when allowed (item 8). **Plugin servers do not load**, nor do
   the user's own servers or the claude.ai connectors the client fetches itself, unless item 7
   allows the connectors. `claude mcp add` fails with `Cannot add MCP server: enterprise MCP
   configuration is active and has exclusive control over MCP servers`.
3. **Disable MCP.** A file whose `mcpServers` is the empty object blocks every server but those of
   item 2; servers configured earlier stop loading at the next session with no warning. Leaving
   `managedMcpServers` and the item 7 and 8 keys unset turns MCP off completely.
   <!-- req: mcpSettings.managed.Disable MCP entirely -->
4. **Credentials.** Every user of the machine can read the file, so an organization SHOULD NOT put
   credentials in its `env` blocks, and passes per-user credentials through `${VAR}` expansion,
   OAuth or per-user headers, or `headersHelper` instead. <!-- req: mcpSettings.managed.Authenticate with per-user credentials -->
5. **Per-run flags.** On a workstation, a session given `--mcp-config` servers while a readable file
   is deployed exits at startup with `You cannot dynamically configure MCP servers when an
   enterprise MCP config is present`. In a cloud session on a host carrying the file, the session
   starts with the managed servers only, drops the `--mcp-config` servers the host delivers, and
   names them in a warning on stderr. `--strict-mcp-config` exits at startup in both.
   <!-- req: mcpSettings.managed.Servers passed with --mcp-config or --strict-mcp-config -->
6. **Lists over the managed set.** `deniedMcpServers` applies to the file's servers, including a
   user's own denylist. They need no `allowedMcpServers` entry unless their command, arguments, URL
   or headers use `${VAR}` expansion; a reference only in `env` does not count.
   <!-- req: mcpSettings.managed.How allowlists and denylists apply to the managed set -->
7. **claude.ai connectors.** `allowAllClaudeAiMcps: true`, read only from admin-controlled sources
   (server-managed settings, an MDM plist or HKLM key, a system `managed-settings.json`), loads the
   fetched connectors as if the file were absent; the lists still apply to them, and plugin servers
   stay suppressed. A file on the host of a cloud session suppresses that session's delivered
   connectors regardless. <!-- req: mcpSettings.managed.Allow claude.ai connectors alongside the managed set -->
8. **Claude in Chrome.** Under the file, the built-in Claude in Chrome server is blocked in terminal
   sessions: no install prompt, a Chrome-by-default session starts without it silently, and `claude
   --chrome` exits with `Claude in Chrome is blocked by your organization's managed MCP
   configuration (managed-mcp.json). An administrator can allow it with
   allowClaudeInChromeWithManagedMcp in device policy.` `allowClaudeInChromeWithManagedMcp: true` in
   the device's own managed settings lets it run; a `deniedMcpServers` entry for `claude-in-chrome`
   still blocks it. <!-- req: mcpSettings.managed.Allow Claude in Chrome alongside the managed set -->

## 8.11.4 `managedMcpServers`: provided servers

1. **Entries.** Each entry has the shape of an `http` or `sse` entry of `.mcp.json`. The client loads
   an entry only when all of these hold, and otherwise drops it with a notice readable in `/status`
   and loads the others: `type` is `http`, `streamable-http` or `sse`; `url` is `https://`, a plain
   `http://` URL being refused even to `localhost`; no `command`, `args`, `env` or `headersHelper`
   member; no `${VAR}` reference in any value, since none is expanded; and a server name of letters,
   digits, `-` and `_`, with no control or invisible formatting character in any key or value. An
   array value is refused with a notice. <!-- req: mcpSettings.managed.What an entry can contain -->
2. **Loading.** A provided server outranks a same-named server of local, project or user scope and a
   plugin server or connector at the same URL. Beside `managed-mcp.json`, both load and the file's
   entry wins a shared name. Provided servers keep loading when `strictPluginOnlyCustomization`
   locks `mcp` (§14). `deniedMcpServers`, a user's own included, applies to them; they need no
   allowlist entry. Without `managed-mcp.json`, a `--mcp-config` server of the same name replaces a
   provided one for that run and is checked against the allowlist, and `--strict-mcp-config` leaves
   provided servers out. <!-- req: mcpSettings.managed.How provided servers load -->
3. **What users see.** A user cannot edit or remove a provided server: `claude mcp remove` reports
   `MCP server "<name>" is provided by your organization (managed settings) and cannot be removed
   locally.`; without `managed-mcp.json`, a user entry of the same name is saved but unused while
   the provided one is present; the user can still turn it off in `/mcp`, which lists it under
   **Managed MCPs**. `claude mcp get` and `/mcp` show its URL as the host only, such as
   `https://mcp.example.com/…`, and `claude mcp get` its header names without values.
   <!-- req: mcpSettings.managed.What users can see and change -->
4. **Sources.** The client reads the key from the managed source it selects (§14); under
   `managedSourcesBehavior: "merge"` from every admin source, the higher source's entry winning a
   shared name. It never reads it from the user-writable HKCU registry, from an embedding host's
   parent settings, or from user, project or local files, where it drops the key with a warning.
   <!-- req: mcpSettings.managed.Where managedMcpServers applies -->
5. **Timing.** Delivered by server-managed settings, a cached copy of the key is withheld until the
   server confirms the session's settings, and MCP loading waits for that; if confirmation fails,
   the session runs without them and `/status` says they are withheld. On a first launch with
   nothing cached, an interactive session connects them when they arrive, and a `claude -p` run
   may finish without them. <!-- req: mcpSettings.managed.When provided servers connect -->
6. A running interactive session applies edits as they arrive:
   - **Add a server**: connected without a restart. <!-- req: mcpSettings.managed.When provided servers connect.Add a server -->
   - **Change a server's entry**: reconnected with the new definition. <!-- req: mcpSettings.managed.When provided servers connect.Change a server's entry -->
   - **Remove a server**: disconnected once the changed settings are read; a `claude -p` run keeps it
     until it ends. <!-- req: mcpSettings.managed.When provided servers connect.Remove a server -->

## 8.11.5 Allowlists and denylists

1. The lists filter servers that are already configured, by a user, a plugin or the organization;
   they install nothing. The denylist applies to every server except in-process `type: "sdk"`
   servers. Both lists also filter `--mcp-config` servers; `--strict-mcp-config` bypasses neither.
   Without `allowManagedMcpServersOnly`, allowlists from every scope merge, so a user can broaden
   one; denylists always merge. `allowManagedMcpServersOnly` is unrelated to
   `allowManagedPermissionRulesOnly`. <!-- req: mcpSettings.managed.Policy-based control with allowlists and denylists -->
2. **Evaluation.** Before loading a server, and again when a user reconnects it or turns it back on
   in `/mcp`, the client: merges the lists (under the lock, only the managed allowlist, from the
   highest admin source that sets one); blocks a server matching any denylist entry, by URL, command
   or name, with nothing overriding it; then, unless the server skips the allowlist (item 7), admits
   it when no allowlist is set anywhere, and otherwise only when it matches by its kind: a remote
   server needs a `serverUrl` match, a `serverName` match counting only when the allowlist holds no
   `serverUrl` entry; a stdio server needs a `serverCommand` match, a `serverName` match counting
   only when it holds no `serverCommand` entry. A plugin's `ws` server is a remote server here
   (Judgment J8.23).
3. **`serverName`** matches exactly, with no wildcards, and is not a security control: the name is a
   label anyone can choose. In `deniedMcpServers` it is any non-empty string without surrounding
   whitespace, so a connector's display name such as `"claude.ai Slack"` works; in
   `allowedMcpServers` it is letters, digits, `-` and `_` only. A plugin's server is matched by its
   scoped name `plugin:<plugin>:<server>`, so only a denylist `serverName` can name it (Judgment
   J8.24). <!-- req: mcpSettings.managed.How serverName entries match -->
4. **`serverCommand`** is the command and its arguments as one array, matched exactly, every
   argument in order: `["npx", "-y", "server"]` matches neither `["npx", "server"]` nor `["npx",
   "-y", "server", "--flag"]`. The `env` block is not compared. A plugin's stdio server is compared
   with its command and arguments as they will run, after §8.4 substitution (Judgment J8.24).
   <!-- req: mcpSettings.managed.How serverCommand entries match -->
5. **`serverUrl`** is a pattern where `*` matches any run of characters, including as the whole
   scheme. The host compares without regard to case and ignores a trailing FQDN dot; the path is
   case-sensitive; a pattern with no path matches any path. With no port in the pattern, a host
   written out in full matches only the scheme's default port (443 for `https`, 80 for `http`) and a
   host containing `*` matches every port. <!-- req: mcpSettings.managed.How serverUrl entries match | mcpSettings.managed.How serverUrl entries match.Hostname written out in full -->

   | Pattern | Matches |
   | --- | --- |
   | `https://mcp.example.com/*` | Every path on that host, port 443 only. <!-- req: mcpSettings.managed.How serverUrl entries match.https://mcp.example.com/* --> |
   | `https://mcp.example.com` | The same: no path matches any path. <!-- req: mcpSettings.managed.How serverUrl entries match.https://mcp.example.com --> |
   | `https://mcp.example.com:8443/*` | Every path on that host, port 8443 only. <!-- req: mcpSettings.managed.How serverUrl entries match.https://mcp.example.com:8443/* --> |
   | `https://mcp.example.com:*/*` | Every path on that host, any port, 443 included. <!-- req: mcpSettings.managed.How serverUrl entries match.https://mcp.example.com:*/* --> |
   | `https://*.example.com/*` | Any subdomain of `example.com`, any port. <!-- req: mcpSettings.managed.How serverUrl entries match.https://*.example.com/* --> |
   | `http://localhost:*/*` | Any port on `localhost`. <!-- req: mcpSettings.managed.How serverUrl entries match.http://localhost:*/* --> |
   | `*://mcp.example.com/*` | Any scheme to that host, each on its default port only. <!-- req: mcpSettings.managed.How serverUrl entries match.*://mcp.example.com/* --> |

   Denylist entries match ports the same way, so for a host `staging.example.com`:

   | Denylist pattern | Blocks |
   | --- | --- |
   | `https://staging.example.com/*` | `https` on port 443 only; not `https://staging.example.com:8443/api`. <!-- req: mcpSettings.managed.How serverUrl entries match.https://staging.example.com/* --> |
   | `https://staging.example.com:*/*` | `https` on every port. <!-- req: mcpSettings.managed.How serverUrl entries match.https://staging.example.com:*/* --> |
   | `*://staging.example.com:*/*` | Every scheme on every port. <!-- req: mcpSettings.managed.How serverUrl entries match.*://staging.example.com:*/* --> |

6. **Variables in entries.** `serverCommand` and `serverUrl` values, on both sides, go through
   `${VAR}` and `${VAR:-default}` expansion before matching; `serverName` never expands. The server's
   value expands from the live process environment; a policy entry from a pinned environment: for
   the allowlist, the environment the client started with plus `env` values of managed settings,
   an entry whose expansion would change a URL's scheme, host or path being ignored; for the
   denylist, the same, with a variable that has no startup value and no default filled from settings
   files outside the repository, such as user or managed settings, the entry still matching
   (Judgment J8.25). An entry relied on for enforcement SHOULD be literal.
   <!-- req: mcpSettings.managed.Environment variables in serverCommand and serverUrl entries -->
7. **Servers that skip the allowlist** (the denylist still applies): every `managedMcpServers` entry
   and every `managed-mcp.json` entry with no `${VAR}` outside `env`; built-in servers, such as Claude
   in Chrome, the `ide` server and servers the CLI configures itself; and the Slack tools of a Claude
   Tag session. In-process `type: "sdk"` servers skip both lists. Every server a user, **a plugin** or
   claude.ai adds, and every `--mcp-config` server, is checked. <!-- req: mcpSettings.managed.Servers that skip the allowlist check -->
8. **Managed-only allowlist.** `allowManagedMcpServersOnly: true` with `allowedMcpServers`, both in
   managed settings, makes the managed allowlist the only one: allowlists in user, project and local
   settings are ignored, while denylists from every scope still merge. Users may still add servers;
   only matching ones load. <!-- req: mcpSettings.managed.Restrict the allowlist to managed settings only -->
9. **What users see.** A server blocked by a list disappears from `/mcp` and `claude mcp list` with
   no signal; `claude mcp add` refuses a denied one with `Cannot add MCP server "<name>": server is
   explicitly blocked by enterprise policy` and an unlisted one with `Cannot add MCP server
   "<name>": not allowed by enterprise policy`; reconnecting a server that became blocked mid-session
   reports `MCP server <name> is blocked by enterprise managed policy`.

## Design decisions

### Why plugin servers rank by endpoint, not by name

A user's scopes share one namespace of names the user chose. A plugin's server names are the
plugin author's, registered under the plugin's prefix, so a name cannot collide with a user's; what
can collide is the server itself. Matching plugins by endpoint keeps a user's own definition of the
same server, with its credentials, from being shadowed or duplicated by a plugin.

### Why exclusive control suppresses plugin servers

`managed-mcp.json` exists to fix the set of programs and endpoints MCP can reach. A plugin installs
its servers with the plugin, so letting them through would reopen what the file closes; the
organization that wants a plugin's server lists it in the file or in `managedMcpServers`.

## Judgments

| Id | Judgment | Evidence |
| --- | --- | --- |
| J8.19 | An endpoint is a URL normalised as mcp.md lists (scheme and host case, default port, trailing slash on a path longer than `/`) or a stdio command with its arguments as a list; the transport `type` is not part of it; two plugin servers at one endpoint are one server, the first loaded winning. | mcp.md lists the spellings that merge and that make two, not the stdio identity or a tie between plugins; the reference implementation's reading. |
| J8.20 | `enableAllProjectMcpServers`, `enabledMcpjsonServers` and `disabledMcpjsonServers` do not apply to a plugin's servers. | settings-reference.md scopes all three to "a project's `.mcp.json`"; mcp.md says enabling a plugin starts its servers automatically. |
| J8.21 | `--strict-mcp-config` excludes plugin servers from the run. | mcp.md ("Project scope"): the client "then uses only the MCP servers you pass with `--mcp-config`"; the reference implementation reads it so. |
| J8.22 | A `managed-mcp.json` that is empty, not JSON or not an object takes no control; one with some invalid entries takes control and the other entries load. | managed-mcp.md says only that a file that fails to parse is reported in the diagnostics and its servers do not appear. |
| J8.23 | For the allowlist, `ws` servers count as remote (matched by `serverUrl`). | The table names "Remote (HTTP or SSE)" and stdio only. |
| J8.24 | A plugin's server is matched by `serverName` against its scoped name, and by `serverCommand`/`serverUrl` against its substituted command or URL. | mcp.md: the scoped name is the name "where a configured server name is expected"; managed-mcp.md compares "the server's configured value" after expansion. |
| J8.25 | The pinned environment of a policy entry takes the startup value first, then managed `env`; the denylist fills from user, managed, `--settings` and parent settings, never from project, local or `--add-dir` files. | managed-mcp.md gives the two sources and "outside the repository" without an order; the reference implementation's reading. |
