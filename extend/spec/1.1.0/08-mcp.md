# 8. MCP servers

A Claude Code plugin can bundle Model Context Protocol servers. This chapter defines where a
plugin declares them, the configuration each server accepts, how its values are substituted, what
the servers and their tools are named, when they start and stop, how their tools and results are
treated, and how they rank against the servers a user or an organization configures. The settings
and the managed policy that govern MCP servers are §8.11, in [08-mcp-policy.md](08-mcp-policy.md).

The MCP wire protocol is the MCP specification's; this chapter states only what Claude Code adds
to it or decides about it. Evidence: `mcp.md` and `plugins/components.md` ("MCP servers"), unless a
section names another page. Shapes follow the official types `McpStdioServerConfig`,
`McpSSEServerConfig` and `McpHttpServerConfig` of `@anthropic-ai/claude-agent-sdk` 0.3.330, which
type neither the `ws` transport, `headersHelper` nor `oauth` (Judgment J8.3).

## 8.1 Where a plugin declares its servers

1. A plugin declares MCP servers in `.mcp.json` at the plugin root, in the shape of a project
   `.mcp.json`, and through the manifest's `mcpServers` key (§2.9). When the plugin is enabled, the
   client starts its servers and offers their tools beside the servers the user configured
   (§8.8). Plugin servers are added and removed by installing and uninstalling the plugin, not by
   `claude mcp add` or `claude mcp remove`; a user can still turn one off in `/mcp` (§8.10.6).
   <!-- req: mcp.components.MCP servers | mcp.behavior.Plugin-provided MCP servers -->
2. **`.mcp.json`** is a JSON object. It either wraps the servers in a top-level `mcpServers` key or
   is itself the map of server name to configuration. The file is the wrapped form when its
   `mcpServers` member is an object that has neither a `command` nor a `url` member; otherwise the
   whole file is the map, so a server a plugin names `mcpServers` still loads (Judgment J8.1).
3. **The manifest's `mcpServers`** takes the four shapes of §2.9, and an array mixing them:

   | Shape | Behaviour |
   | --- | --- |
   | A `.json` file path | The file is read like `.mcp.json`. <!-- req: mcp.source..json --> |
   | An inline map | The object is the map of server name to configuration. <!-- req: mcp.source.Inline map --> |
   | A bundle path ending `.mcpb` or `.dxt` | The bundle inside the plugin is extracted into `mcpb/` under the plugins root (§16.6), never into the plugin's own folder, so a read-only plugin folder loads, and its server read (§8.9). <!-- req: mcp.source.MCP bundle path --> |
   | A bundle URL (`https://`, ending `.mcpb` or `.dxt`) | The bundle is downloaded, then extracted into `mcpb/` and read as a bundle path is (§8.9). <!-- req: mcp.source.MCP bundle URL --> |

   A string that starts with `http://` or `https://` is a URL, and only an `https://` URL is
   accepted; a string that ends in `.json` is a file; any other string is a bundle path, which
   MUST end in `.mcpb` or `.dxt` (Judgment J8.13). The §2.5 path rules apply to every path.
4. **Merge order.** The client reads `.mcp.json` first, then each manifest value in array order. A
   server name declared later replaces the earlier entry whole; fields are not merged. A file that
   is named twice, including a declared `./.mcp.json`, is read once.
5. **Failure boundaries.** A `.mcp.json` or declared file that is not valid JSON, or not an object,
   contributes no servers and the plugin's other components still load. A `.json` file the manifest
   names that does not exist contributes no servers either, and the loader reports nothing; only a
   validator reports it (§8.3.1). An entry of `.mcp.json`
   or of a declared file that fails §8.2 is dropped and the other servers load (§8.3). An entry of
   the manifest's **inline** map that fails §8.2 fails the manifest, so the plugin does not load;
   a `type: "sdk"` entry is the exception and is only dropped (Judgment J8.2).

Example: a plugin with one server in `.mcp.json` and one inline in the manifest.

```json
{
  "mcpServers": {
    "db": {
      "command": "${CLAUDE_PLUGIN_ROOT}/servers/db-server",
      "args": ["--config", "${CLAUDE_PLUGIN_ROOT}/config.json"],
      "env": { "DB_URL": "${DB_URL}" }
    }
  }
}
```

```json
{
  "name": "my-plugin",
  "mcpServers": {
    "api": { "type": "http", "url": "https://api.example.com/mcp" }
  }
}
```

## 8.2 Server configuration

Every entry is a JSON object. Its `type` selects the transport; an entry without `type` is a stdio
server. The client MUST support the four transports below for plugin servers, though a given
server may support only some of them. <!-- req: mcp.behavior.Plugin-provided MCP servers.Multiple transport types -->

| `type` | Transport | Required | Optional |
| --- | --- | --- | --- |
| absent or `"stdio"` | A local process over stdin and stdout | `command` | `args`, `env`, `timeout`, `alwaysLoad` |
| `"http"`, or its alias `"streamable-http"` | MCP Streamable HTTP | `url` | `headers`, `headersHelper`, `oauth`, `timeout`, `alwaysLoad` |
| `"sse"` | The deprecated HTTP+SSE transport | `url` | `headers`, `headersHelper`, `oauth`, `timeout`, `alwaysLoad` |
| `"ws"` | A WebSocket connection | `url` | `headers`, `headersHelper`, `timeout`, `alwaysLoad` |

| Field | Type | Meaning |
| --- | --- | --- |
| `command` | non-empty string | The executable to run (§8.2.1). |
| `args` | string[] | Its arguments, each passed as one argument with no shell. |
| `env` | object of strings | Variables added to the process environment. |
| `url` | string | The endpoint. An empty string is a placeholder: the server shows as `not configured` and is not connected (§8.8). |
| `headers` | object of strings | Headers sent on every request. |
| `headersHelper` | string | A shell command that prints more headers at connect time (§8.6). |
| `oauth` | object | `clientId`, `callbackPort`, `authServerMetadataUrl`, `scopes` (§8.7). |
| `timeout` | number | Milliseconds a tool call may run; a value below 1000 is ignored. |
| `alwaysLoad` | boolean | `true` loads the server's tools upfront rather than behind tool search, and startup waits for the server up to the 5-second connect timeout; `false` keeps every tool deferred, even a tool the server marks to load upfront. |

1. A field present with the wrong type, an empty `command`, an unknown `type`, or a missing
   required field makes the entry invalid (§8.3). A field the table does not name is kept and
   ignored (Judgment J8.3). `"streamable-http"` is read as `"http"` (Judgment J8.4).
2. An entry with a `url` and no `type` is invalid: it would be read as a stdio server without a
   `command`. The client skips it and reports `MCP server "<name>" has a "url" but no "type"; add
   "type": "http" (or "sse" / "ws") to this entry`.
3. A `"type": "sdk"` entry names an in-process server that only an SDK host application registers.
   The client skips it and reports `Skipped — MCP server "<name>" declares type "sdk", which only an
   SDK host application can register`.
4. The JSON a plugin writes for a server is the same configuration `claude mcp add-json <name>
   '<json>'` accepts for a user's server, and is read by the same rules. <!-- req: mcp.behavior.Add MCP servers from JSON configuration -->

### 8.2.1 stdio

A stdio server is a local process the client starts with `command` and `args` and talks to over
stdin and stdout. The client MUST set `CLAUDE_PROJECT_DIR` in its environment to the stable
project root, which does not change when working directories are added mid-session, and MUST
answer the MCP `roots/list` request with the session's launch directory plus every additional
working directory, sending `notifications/roots/list_changed` when that set changes. A plugin's
stdio process also receives `CLAUDE_PLUGIN_ROOT` and `CLAUDE_PLUGIN_DATA` (§8.4).
<!-- req: mcp.behavior.Option 3: Add a local stdio server -->

To stop a stdio server, on macOS and Linux the client sends `SIGINT`, then `SIGTERM` if the
process still runs 100 ms later, then `SIGKILL` after a further 400 ms; on Windows it closes the
server's stdin, then ends its process tree if it still runs 300 ms later.

When `CLAUDE_CODE_SHELL_PREFIX` is set in the client's environment, the client MUST start a stdio
server through that prefix: it runs the prefix followed by one argument, the server's whole command
line (`command` and each `args` element, after §8.4 substitution) as a single shell-quoted string.
Each element is quoted on its own and the elements are joined by spaces (Judgment J8.26), so a
server that is `npx` with `["-y", "<package>"]` reaches the prefix with `$1` holding
`'npx' '-y' '<package>'`, and the client runs, through bash:

```sh
<prefix> ''\''npx'\'' '\''-y'\'' '\''<package>'\'''
```

The prefix must re-evaluate `$1` with a shell (`exec bash -c "$1"`); one that treats `$1` as
an executable path breaks every server with arguments. The same prefix wraps hook commands (§7)
and the `statusLine` command (§12.7.1, §12.7.3), not PowerShell or exec-form hooks.
<!-- docs: env-vars.md | Variables — CLAUDE_CODE_SHELL_PREFIX -->

Starting and keeping the server's process is the host's: a library that resolves a plugin's servers
starts no process. For each stdio server it MUST return the start command, with or without the
prefix: without one, an exec of `command` and `args`; with a non-blank prefix, the shell command
`<prefix> '<line>'` above, to be run by bash (or by the shell the host runs hook commands with when
it has no bash). The host launches that command with the environment of this section, speaks MCP
over its stdin and stdout, and stops it as described above (Judgment J8.29).

A stdio server, like every process the client starts on its own behalf, runs outside the client's
sandbox with the user's full access: the sandbox wraps the Bash tool's shell commands only, so a
plugin's local server is not confined by `sandbox` settings and needs none of their allowances.
<!-- docs: sandboxing.md | What runs outside the sandbox -->

### 8.2.2 http and sse

`http` is the recommended transport for a remote server. `sse` is deprecated and still accepted.
Neither falls back to the other once declared in a file: the fallback from HTTP to SSE that
`claude mcp add --transport http` performs is a property of that command, not of a configuration
entry (§17). <!-- req: mcp.behavior.Option 1: Add a remote HTTP server | mcp.behavior.Option 2: Add a remote SSE server -->

The client stops reading a response from an `http` or `sse` server that passes 16 MiB after
decompression, counted per JSON response body or per event of an event stream, and fails that
request (§8.10.1). Each request also runs under a timer to the server's first response byte, set
to the greatest of 60 seconds, the tool timeout that applies to the server, and `MCP_TIMEOUT`.

### 8.2.3 ws

A `ws` server holds a persistent bidirectional connection. It accepts the `url`, `headers`,
`headersHelper`, `timeout` and `alwaysLoad` fields of `http`. Authentication is by headers only,
static or from `headersHelper`; it has no OAuth. When a `ws` server sends one message over 16 MiB,
the client closes the connection and the calls in progress on it fail. A `ws` server's first
connection is not retried automatically. <!-- req: mcp.behavior.Option 4: Add a remote WebSocket server -->

## 8.3 Invalid entries and load diagnostics

1. **Dropped at read.** An entry of `.mcp.json` or of a declared file that fails §8.2 is dropped.
   It does not appear in the plugin manager's **Errors** tab; the client records `Invalid MCP server
   config for <server> in <path>` in its debug log only. A validator (`claude plugin validate`,
   §17) MUST report such an entry as an error, with the messages of §8.3.1. <!-- req: mcp.troubleshooting.Server is configured but never connects -->
2. **Refused at resolve.** An entry that passes §8.2 but cannot be resolved for the session is not
   started, and the **Errors** tab shows `Invalid MCP server config for "<server>": <error>`. The
   text after the colon names the cause:

   | Cause | `<error>` begins | What fixes it |
   | --- | --- | --- |
   | A `${VAR}` reference names an unset variable with no default (§8.4.2) | `Missing environment variables: <names>` | Setting the variables in the environment Claude Code starts from, then a new session. <!-- req: mcp.troubleshooting.Invalid MCP server config for "<server>": <error>.Missing environment variables: <names> --> |
   | The `url` uses a `${user_config.KEY}` option that is not set, so it does not resolve | `URL is unset or invalid` | `/plugin configure <plugin>`. <!-- req: mcp.troubleshooting.Invalid MCP server config for "<server>": <error>.URL is unset or invalid --> |
   | The plugin's own `url` does not parse once resolved, or its `headersHelper` references `${user_config.*}` (§8.6.4) | `has an invalid MCP url`, or `headersHelper for MCP server '<server>' references ${user_config.*}` | A fix in the plugin. <!-- req: mcp.troubleshooting.Invalid MCP server config for "<server>": <error>.has an invalid MCP url --> |

3. **Validator checks.** Besides the entries a client drops, a validator MUST report as errors a
   `${user_config.KEY}` reference to an option neither the manifest's `userConfig` nor the server's
   `channels` entry declares, and a remote `url` that is not an absolute URL once its references are
   set aside; and as warnings an `http://` or `ws://` URL to a non-loopback host and a header value
   that looks like a literal credential (§2.9).
4. **Configuration warnings.** The client warns, without changing the value, when `command`,
   `url`, an `args` entry, or a key or value under `env` or `headers` carries leading or trailing
   whitespace, naming the fields and never their values.
5. **Works from the source, fails installed.** An installed plugin runs from the client's cache copy
   (§16), so a server path that is right only in the source directory fails once installed. Paths
   inside the plugin MUST be written with `${CLAUDE_PLUGIN_ROOT}`. <!-- req: mcp.troubleshooting.Server works with --plugin-dir but fails after install -->

### 8.3.1 Validator messages

A validator MUST report an MCP server file and its entries with these messages, at these
severities (oracle 2.1.321, corpus). `<path>` in a finding is the key path inside the file: in the
wrapped form `mcpServers.<server>.<field>`, in the bare map `<server>.<field>`. Every error message
for an entry ends with the loader's consequence, because the loader drops the entry without telling
the user (§8.3 item 1).

| Severity | Where | Message | When |
| --- | --- | --- | --- |
| error | `<server>.type` | `unknown server type "<type>" — expected "stdio" (or no type) for a local command, or "http", "sse", "ws" for a remote server. The plugin loader silently drops this server at load.` | `type` is not one of §8.2's values, most often `"url"`. |
| error | `<server>.type` | `server has a "url" but no "type". Remote servers must set "type" to "http" (or "sse" / "ws"); without it the entry is parsed as a stdio server, fails for lacking "command", and is silently dropped at load.` | §8.2 item 2. |
| error | `<server>` | `server config must be an object (got <kind>). The plugin loader silently drops this server at load.` | The value of a server name is not an object; `<kind>` is `array`, `string`, `number`, `boolean` or `null`. A flat `.mcp.json` written as one server (`{"command": …, "args": […]}`) reads as servers named `command` and `args` and draws this for each (Judgment J8.27). |
| error | `<server>.<field>` | `<schema message>. The plugin loader silently drops this server at load.` | A field of the wrong type or a missing required field. The schema message names the expected and received kinds: `Invalid input: expected string, received undefined` for a stdio entry with no `command`, `Invalid input: expected string, received array` for an array `oauth.scopes` (§8.7.2). |
| error | the manifest's `mcpServers` | `Path not found: <path>. The plugin loader skips a missing MCP servers file without reporting it, so none of its servers will load.` | A `.json` path the manifest names does not exist (§8.1 item 5). |
| warning | `directory` of the file | `The file is not a regular file (a symlink, a FIFO, a directory) and was not read — MCP server files are read without following symlinks and are capped at 1048576 bytes. The plugin loader has neither limit, so validate the real file separately.` | The validator never follows a link to an MCP server file and reads at most 1,048,576 bytes of one. The loader follows the link and reads the whole file, so a linked `.mcp.json` still loads its servers. A regular file over the cap draws the same warning opening `The file is past the size cap and was not read` (Judgment J8.27). |

## 8.4 Substitution and the environment

### 8.4.1 Path placeholders and plugin options

1. In a plugin's server, `${CLAUDE_PLUGIN_ROOT}` resolves to the plugin's installed directory,
   `${CLAUDE_PLUGIN_DATA}` to its persistent data directory, and `${CLAUDE_PROJECT_DIR}` to the
   stable project root, with no default needed (§3). They are substituted in a stdio server's
   `command`, `args` and `env`, and in a remote server's `url`, `headers` and `headersHelper`.
   An `args` element is passed as one argument, so a substituted path needs no quoting there.
   <!-- req: mcp.behavior.Plugin-provided MCP servers.Path placeholders | mcp.components.Server names, tool names, and reloads.Substitution -->
2. A stdio server's process environment also receives `CLAUDE_PLUGIN_ROOT`, `CLAUDE_PLUGIN_DATA`
   and `CLAUDE_PROJECT_DIR`. A remote server has no process.
3. `${user_config.KEY}` (§3.4) is substituted in the same fields as the path placeholders, less
   one: a stdio server's `command`, `args` and `env`, and a remote server's `url` and `headers`. A
   remote server's `headersHelper` refuses it (§8.6.4), and no other field (`type`, `oauth`,
   `timeout`, `alwaysLoad`) is substituted. A sensitive option's value is substituted here; it is
   not masked as it is in skill content. (`plugins/manifest-reference.md`, "Where each variable
   resolves" and "Fields that run through a shell".)
4. Substitution is one pass: text a substitution brings in is not scanned again (Judgment J8.6).

### 8.4.2 Environment variables

1. A server's `command`, `args`, `env`, `url` and `headers` values MAY reference the environment the
   client started with, in two forms. `${VAR}` expands to the value of `VAR`. `${VAR:-default}`
   expands to the value of `VAR` when it is set and to `default` when it is unset. A plugin's server
   reads the same environment variables a server the user configured does.
   <!-- req: mcp.behavior.Plugin-provided MCP servers.User environment access -->

   ```json
   {
     "mcpServers": {
       "api-server": {
         "type": "http",
         "url": "${API_BASE_URL:-https://api.example.com}/mcp",
         "headers": { "Authorization": "Bearer ${API_KEY}" }
       }
     }
   }
   ```

   With `API_BASE_URL` unset, the URL is `https://api.example.com/mcp`; the `Authorization` header
   carries the value of `API_KEY`. <!-- req: mcpSettings.behavior.Example with variable expansion -->
2. **Unset, no default.** For a server in a user's local, project or user scope, a `${VAR}` naming
   an unset variable with no `:-default` leaves the configuration loading: the client warns in
   `claude mcp list` and `/mcp`, naming the variable, and uses the `${VAR}` text unexpanded. For a
   **plugin's** server the same reference makes the server invalid with `Missing environment
   variables: <names>` (§8.3) and the server does not start (Judgment J8.5).
   <!-- req: mcpSettings.behavior.Unset variables without a default -->
3. **Set to empty.** A variable set to the empty string counts as set: `${VAR:-default}` expands to
   the empty string, not to `default`. In the example above, `API_BASE_URL=""` makes the `url`
   `/mcp`, which is reported as `'url' is not a valid URL`. <!-- req: mcpSettings.behavior.Variables set to an empty string -->
4. **Credentials read as empty.** In a remote server's `url` and `headers`, the client MUST read
   credential variables as empty instead of expanding them, whether or not they are set, and MUST
   ignore a `:-default` on them. The set covers Claude Code's own credentials (such as
   `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN`), cloud-provider credentials (such as
   `AWS_BEARER_TOKEN_BEDROCK`) and other credentials the environment carries (such as
   `HTTPS_PROXY`, `NPM_TOKEN`) (Judgment J8.7). A provider base URL such as `ANTHROPIC_BASE_URL`
   still expands unless its value embeds a credential. A name outside the set, such as `API_KEY`,
   expands as written. For each covered variable a remote server references and the user has set,
   the client writes a debug-log line containing `never expanded toward a remote server`. A stdio
   server's fields are not affected, and a covered variable that reads as empty draws no
   missing-variable warning. <!-- req: mcpSettings.behavior.Credential variables that read as empty -->
5. **Grammar.** A reference is `${NAME}` or `${NAME:-default}` where `NAME` is a shell variable name;
   the default ends at the first `}` and nests nothing; there is no escape; text that is not a
   reference, such as `${}` or `${1A}`, stays as written with no warning (Judgment J8.6).

## 8.5 Names

1. **Server name.** A plugin's server registers under the scoped name `plugin:<plugin>:<server>`,
   where `<server>` is its key in the configuration and `<plugin>` the plugin's `name`: the `db`
   server of `my-plugin` is `plugin:my-plugin:db` in `/mcp`. That name is used wherever a configured
   server name is expected, such as an `mcp_tool` hook's `server` field (§7). Plugin servers appear
   in `/mcp` marked as coming from a plugin. <!-- req: mcp.components.Server names, tool names, and reloads.Server name -->
2. **Tool names.** A tool of a plugin's server is callable as
   `mcp__plugin_<plugin>_<server>__<tool>`, where every character of `plugin_<plugin>_<server>`
   outside `A-Z`, `a-z`, `0-9`, `_` and `-` is replaced by `_`, and `<tool>` is the tool name as the
   server declares it: tool `query` of server `database-tools` in plugin `my-plugin` is
   `mcp__plugin_my-plugin_database-tools__query`. Permission rules, a skill's `allowed-tools`, a
   subagent's `tools`, and hook matchers MUST use this full name; a matcher on the bare server key,
   such as `mcp__database-tools__.*`, never matches a plugin's tool.
   <!-- req: mcp.components.Server names, tool names, and reloads.Tool names -->
3. **Length.** The client MUST leave out of the tools it sends to the model any MCP tool whose full
   name is over 128 characters (Judgment J8.11), keep the server's other tools, and in a debug
   session write `Tool "<full name>" is not sent to Claude: its name has <N> characters and the API
   accepts at most 128`. The tool stays listed in `/mcp`. Because a plugin's tool name includes the
   plugin name, a plugin author SHOULD keep plugin, server and tool names short.
   <!-- req: mcp.behavior.Tools with names longer than 128 characters -->
4. **Prompts.** A server's MCP prompts become commands, listed in `/` as `/<server>:<prompt> (MCP)`
   and also runnable as `/mcp__<server>__<prompt>`, where in the second form the server name is
   normalised as in item 2 and the prompt name is used as declared. Arguments follow the command,
   split on whitespace, one token each; the prompt's result is injected into the conversation.
   For a plugin's server, `<server>` is its scoped name in the listing and `plugin_<plugin>_<server>`
   normalised in the `mcp__` form (Judgment J8.12). Prompts of a server whose name is
   `anthropic-skills` are not listed; its tools still work. <!-- req: mcp.behavior.Execute MCP prompts -->
5. **Reserved names.** The client skips a server a user's configuration names `workspace`,
   `claude-in-chrome`, `computer-use`, `Claude Preview` or `Claude Browser`, reporting
   `"<name>" is a reserved MCP server name and was not loaded`; the fix is to rename the server
   where it is defined. A plugin's server key is not checked against this list, because the server
   registers under its scoped name (Judgment J8.12). <!-- req: cli.errors.MCP server name is reserved -->

## 8.6 `headersHelper`

### 8.6.1 What it does

A remote server (`http`, `sse`, `ws`) MAY set `headersHelper` to a shell command that generates
headers at connection time, for authentication such as short-lived tokens or internal sign-on.
<!-- req: mcp.behavior.Use dynamic headers for custom authentication -->

1. The command MUST write to stdout one JSON object whose values are strings. The client runs it in
   a shell and gives up on it after 10 seconds. A helper that fails, times out or prints anything
   else contributes no headers, and the client reports it as an error of that server (Judgment
   J8.8).
2. The helper's headers are merged over the static `headers`; a helper header replaces a static
   one of the same name, compared without regard to case.
3. The client runs the helper afresh on every connection, at session start and on each reconnect,
   once §8.6.3 lets it run, and does not cache its output.
4. When a tool call returns `401` or `403`, the client re-runs the helper under the same rule,
   reconnects with the fresh headers and retries the call once; only if that retry fails does it
   mark the server as needing authentication.
5. When the helper's output holds an `Authorization` header, that credential is the server's
   authentication and the client MUST NOT fall back to OAuth for the server. If the server rejects
   it while connecting, the client reports a failed connection, not a server needing
   authentication.

The client sets these variables in the helper's environment, so one script can serve several
servers:

| Variable | Value |
| --- | --- |
| `CLAUDE_CODE_MCP_SERVER_NAME` | The server's name; for a plugin's server, its scoped name `plugin:<plugin>:<server>` (Judgment J8.9). <!-- req: mcp.behavior.Use dynamic headers for custom authentication.CLAUDE_CODE_MCP_SERVER_NAME --> |
| `CLAUDE_CODE_MCP_SERVER_URL` | The server's resolved `url`, with any part that carries the value of a removed credential variable (§8.6.2) replaced by `REDACTED`. <!-- req: mcp.behavior.Use dynamic headers for custom authentication.CLAUDE_CODE_MCP_SERVER_URL --> |
| `CLAUDE_PLUGIN_ROOT` | The plugin's root directory; set only when a plugin provides the server. <!-- req: mcp.behavior.Use dynamic headers for custom authentication.CLAUDE_PLUGIN_ROOT --> |

### 8.6.2 Where it runs and what it reads

The helper's working directory comes from the configuration that declares the server, not from the
session's current directory: a `cd` run through the Bash tool does not move it, and `/cd` moves it
only for the servers that run from the session's primary working directory. A relative path in the
command resolves against it.

| Where the server is configured | Working directory |
| --- | --- |
| A plugin | The plugin's root directory. <!-- req: mcp.behavior.Where the helper runs.A plugin --> |
| A project `.mcp.json`, or local scope | The project directory the server is declared in. <!-- req: mcp.behavior.Where the helper runs..mcp.json --> |
| An agent file in the project, the SDK's `mcpServers` option or `setMcpServers()`, or `--mcp-config` | The session's primary working directory. <!-- req: mcp.behavior.Where the helper runs.mcpServers --> |
| User scope, managed MCP, a claude.ai connector, or an agent file from outside the project, including one from an `--add-dir` directory | The configuration directory, `~/.claude` unless `CLAUDE_CONFIG_DIR` is set. <!-- req: mcp.behavior.Where the helper runs.--add-dir --> |

A helper that a repository or a plugin supplies is a command the user did not write, so the client
MUST run it without the credential variables of the user's environment. This applies to a server
in a project `.mcp.json` or in a plugin, and to an inline server in an agent file from the project
or an `--add-dir` directory. It does not apply to a server at user or local scope, in managed MCP,
from a claude.ai connector, supplied by the SDK or `--mcp-config`, or inline in an agent file from
`~/.claude/agents/`, managed settings or `--agents`. A credential variable is, apart from Git's
`GIT_CONFIG_KEY_<n>`, every variable whose name looks like one (it contains `TOKEN`, `SECRET`,
`PASSWORD`, `KEY` or `AUTH` in either case, such as `ANTHROPIC_API_KEY` or `MY_REGISTRY_TOKEN`)
and a fixed list of others such as `ANTHROPIC_CUSTOM_HEADERS` (§3.3.1; Judgment J8.7). A plugin's
helper therefore reads its credential from a file or a credential store.
<!-- req: mcp.behavior.Which variables a helper can read -->

### 8.6.3 Trust before a helper runs

A `headersHelper` is an arbitrary shell command. For a server in a project `.mcp.json` or at local
scope, the client runs the helper only after the user has accepted the workspace trust dialog for
the project directory the server is declared in (§13). The rule does not apply to a plugin's
server: enabling the plugin is the user's consent to what it runs.

- **Trust that does not count**: a parent folder's trust, and the automatic trust a `claude -p` or
  SDK session gets for hooks in settings files. <!-- req: mcp.behavior.Trust a folder before its headersHelper runs.Trust that doesn't count -->
- **Until the folder is trusted**: the client connects the server with its static `headers`
  alone. In a `claude -p` or SDK session it also prints one line per server to stderr,
  `MCP server '<name>': headersHelper not run — this workspace has no persisted trust; accept the
  trust dialog here once interactively, or set projects["<path>"].hasTrustDialogAccepted in
  <config>.`; an interactive session writes it to the debug log. <!-- req: mcp.behavior.Trust a folder before its headersHelper runs.Until you trust the folder -->
- **Trust without a dialog**: `projects["<path>"].hasTrustDialogAccepted` set to `true` in
  `~/.claude.json`, keyed on the folder §13 names, counts as trust. <!-- req: mcp.behavior.Trust a folder before its headersHelper runs.Trust without a dialog -->

The same rule covers a server inline in an agent file from the project or an `--add-dir`
directory; until that directory is trusted, such a server is not loaded at all.

### 8.6.4 Plugin options in a helper

A plugin's `headersHelper` MUST NOT reference `${user_config.*}`: the value would be spliced into a
shell command. The client refuses the server, without substituting, with `headersHelper for MCP
server '<server>' references ${user_config.*}. The substituted value would be passed to a shell;
read the value inside the helper script instead (e.g. from an env var set in the server's "env"
block).` The check runs on the template, so the error appears even when no value is saved
(Judgment J8.10). An option reaches a remote server through `headers`, which is not shell-parsed.

## 8.7 Authentication

### 8.7.1 When a server needs authentication

The client supports OAuth 2.0 for `http` and `sse` servers; `ws` and stdio servers have none. It
marks a remote server as needing authentication when the server answers `401` or `403`, with these
exceptions: a server whose `Authorization` header the configuration supplies, in `headers` or
from `headersHelper`, is reported as a failed connection instead, since the credential to fix is
the configured one, and the client does not fall back to OAuth for it.
<!-- req: mcp.behavior.Authenticate with remote MCP servers -->

1. When a signed-in server rejects the stored token with `401`, the client refreshes it and retries
   the request once if the login has a refresh token; without one, it connects once without the
   token, keeps the tools if the server answers, and deletes the rejected token.
2. A server's `WWW-Authenticate` header pointing to its authorization server is followed as in any
   discovery. Discovery checks RFC 9728 Protected Resource Metadata at
   `/.well-known/oauth-protected-resource`, then RFC 8414 metadata at
   `/.well-known/oauth-authorization-server`.
3. A `claude -p` or SDK run cannot run the browser flow; a user signs in beforehand from `/mcp` or
   `claude mcp login <name>`. The client stores tokens in secure storage and refreshes them.

### 8.7.2 The `oauth` object

| Field | Type | Meaning |
| --- | --- | --- |
| `clientId` | string | A pre-registered OAuth client, for a server without dynamic client registration or a client ID metadata document. |
| `callbackPort` | number | A fixed port for the redirect URI `http://localhost:<port>/callback`; without it the client picks a free port. |
| `authServerMetadataUrl` | string | An `https://` authorization-server metadata URL that replaces discovery. |
| `scopes` | string | The space-separated scopes to request, as RFC 6749 §3.3 writes `scope`. |

1. **Fixed port.** `callbackPort` alone keeps dynamic client registration; with `clientId` it
   matches a pre-registered redirect URI. The redirect host is `localhost`, never `127.0.0.1`.
   <!-- req: mcp.behavior.Use a fixed OAuth callback port -->
2. **Pre-configured credentials.** `clientId` names the client. A client secret is never part of
   the configuration: it is given only when a user adds a server (`--client-secret`, or
   `MCP_CLIENT_SECRET` beside it) and kept in secure storage, so a plugin's server can use only a
   public client or dynamic registration (Judgment J8.15). <!-- req: mcp.behavior.Use pre-configured OAuth credentials -->
3. **Metadata URL.** `authServerMetadataUrl` MUST use `https://`; an entry whose URL does not is
   invalid (§8.3). The document's `scopes_supported` replaces the scopes the server advertises.
   <!-- req: mcp.behavior.Override OAuth metadata discovery -->
4. **Scopes.** `scopes` takes precedence over both `authServerMetadataUrl` and discovery. Without
   it, the client does not request the full `scopes_supported` of automatically discovered
   metadata, but a configured metadata URL still supplies its `scopes_supported`. When the
   authorization server advertises `offline_access`, the client appends it. A later `403
   insufficient_scope` fails the call with a `needs additional permissions` message naming the
   scope, and the server shows as needing authentication; the client still requests the pinned
   scopes until `scopes` is changed. <!-- req: mcp.behavior.Restrict OAuth scopes -->
5. **Behind an authenticating proxy.** The client adds every configured header except
   `Authorization`, from `headers` or `headersHelper`, to the sign-in, token refresh and token
   revocation requests it sends to the server's origin (scheme, host and port of `url`). A server
   behind a gateway that checks its own header therefore declares that header and leaves
   `Authorization` out. <!-- req: mcp.behavior.Use OAuth with a server behind an authenticating proxy -->

### 8.7.3 Rejected credentials and refused sign-ins

1. **A credential rejected mid-session.** When a remote server rejects the credential on a tool
   call, the call fails and `/mcp` marks the server as needing authentication. The message names
   the credential to fix: for a server the user signed in to from the client, `MCP server "<name>"
   needs you to sign in again (run /mcp to re-authenticate)`; for one whose `headersHelper`
   supplies it, after the re-run and retry of §8.6.1 item 4, `MCP server "<name>" rejected the
   credential from its headersHelper (check the helper and run /mcp to reconnect, or to
   authenticate if the server also uses OAuth)`; for a static `Authorization` header, `MCP server
   "<name>" rejected the Authorization header in its config (update it, then run /mcp to
   reconnect)`. <!-- docs: errors.md | MCP server needs you to sign in again -->
2. **Unreadable credential store.** When the client cannot read the store that holds OAuth
   sign-ins, the request is not sent and the stored sign-ins are left unchanged: `Couldn't read the
   stored credentials for MCP server "<name>", so the request didn't run. Try again.`, with `If your
   Mac's keychain is locked, unlock it, then try again.` in place of the last sentence when the
   macOS keychain is locked. In a `claude -p` or SDK run on macOS, a request that went out before
   the keychain became readable fails with `A request to MCP server "<name>" was sent without your
   stored credentials, so the server rejected it. The credentials are available now. Try again.`
   <!-- docs: errors.md | Couldn't read the stored credentials for MCP server -->
3. **Issuer check.** On the v2 runtime (§8.8 item 9), when the authorization server's redirect
   carries an `iss` parameter that differs from the issuer of the server's OAuth metadata, the
   client fails the sign-in before exchanging the code: `Issuer mismatch in authorization response
   (RFC 9207): expected "<issuer>", received "<iss>"`, shown in the server's `/mcp` menu. A redirect
   without `iss` passes, unless the metadata sets `authorization_response_iss_parameter_supported`.
   The v1 runtime does not check. <!-- docs: errors.md | Issuer mismatch in authorization response -->
4. **Token endpoint over plain HTTP.** On the v2 runtime the client sends a token request, at
   sign-in and at every refresh, only to a token endpoint served over `https://` or at `localhost`,
   `127.0.0.1` or `::1`; otherwise it stops before sending, after the browser step has succeeded,
   with `Refusing to send credentials to non-https token endpoint '<endpoint>'. OAuth token requests
   MUST use TLS (localhost / 127.0.0.1 / ::1 are exempt).` `claude mcp login <name>` prints it after
   `Couldn't complete authentication for "<name>":`, and the debug log after `Error during auth
   completion:` or `Token refresh failed:`. For a server URL with a query string or a long
   random-looking path segment the client redacts the error to a short SDK error name, `from the
   MCP SDK for` and the redacted URL. The v1 runtime does not apply the rule.
   <!-- docs: errors.md | Refusing to send credentials to non-https token endpoint -->

## 8.8 Lifecycle

1. **Start.** At session start the client connects the servers of every enabled plugin, in the
   background unless `alwaysLoad` is `true`. A remote (`http` or `sse`) server the user has used
   before, whose tool list the client has in its discovery cache, may show as `cached` and connect
   on its first tool call. A stdio plugin server
   whose connection failed less than 15 minutes earlier is not started; the session reports
   `Skipping connection (recent failure cached; retries automatically in 15 min, or edit the plugin
   config to retry now)`, and the next session or run at least 15 minutes after the failure, or one
   whose `command`, `args` or `env` changed, tries again (Judgment J8.16). A user can reconnect it
   from `/mcp`.
2. **Enable and disable.** Enabling or disabling a plugin during a session connects or disconnects
   its servers when the change applies (§16). In a session without an interactive terminal,
   `/reload-plugins` does not change plugin servers; the next session does.
3. **Reload.** On a reload that applies, a server whose configuration is unchanged keeps its
   connection, a server whose configuration changed reconnects, and a removed server disconnects.
   The same holds when an SDK application replaces the session's server list without naming them.
   <!-- req: mcp.components.Server names, tool names, and reloads.Reload -->
4. **Directory moves.** `/cd` (2.1.246 and later) connects the servers of plugins the new directory's settings enable
   and disconnects those no longer enabled.
5. **On demand.** In a cloud session, a call to a plugin server that is not connected yet starts it
   and waits for the connection.
   <!-- req: mcp.behavior.Plugin-provided MCP servers.Automatic lifecycle -->
6. **Placeholders.** A remote server whose `url` is empty is `not configured`: it is listed, not
   connected and not reported as an error, and its detail view reads `No URL configured for this
   server`. A plugin MAY ship such an entry for a connector the user configures later.
7. **Reconnection.** A dropped remote server is reconnected up to five times with backoff from one
   second, doubling. When the five fail, an interactive session marks the server failed (or needing
   authentication) and says whether it keeps retrying: `MCP server "<name>" disconnected · still
   retrying · open /mcp to reconnect now` while background retries go on, for up to about a day,
   with the server shown as `retrying` in `/mcp` (turning the server off for the project stops
   them); `MCP server "<name>" disconnected · open /mcp to reconnect` when none do. In `claude -p`
   and SDK sessions the run goes on without the server's tools: after a transient error the client
   keeps retrying an `http` or `sse` server in the background for up to about half an hour, or about
   a day for some servers, and an SDK session reports the server `failed` meanwhile; a server that
   needs a new sign-in is reported `needs-auth`.
   <!-- docs: mcp.md | Mid-session drops of a remote server -->
   An `http` or `sse` server's first connection is retried up to three times after
   a transient error, not after an authentication or not-found error, except that a server whose
   only `Authorization` source is `headersHelper` is retried after an authentication error too. A
   stdio server that exits is marked failed in an interactive session and restarted on the next
   tool call in `claude -p` and SDK sessions.
8. **Dynamic lists.** On a `list_changed` notification the client fetches the server's new list (in
   `claude -p` and SDK sessions, the tool list only) and keeps the previous lists if the fetch fails.
9. **Client runtimes.** The client picks one of two MCP client runtimes when it starts and keeps it
   until it exits (`MCP_SDK_GENERATION`, §3). The v2 runtime asks `http`, stdio and claude.ai
   connector servers whether they support protocol revision 2026-07-28 and uses it with those that
   do; it connects `sse` and `ws` servers, and every server on v1, on the earlier handshake
   (`MCP_PROTOCOL_NEGOTIATION`, §3). Only the v2 runtime applies the OAuth checks of §8.7.3 items 3
   and 4, offers MCP tasks (§8.10.8), and does not register a channel server on the newer revision
   (§9.3.2). <!-- docs: mcp.md | MCP client runtimes -->
10. **Notification streams on v2.** A server on revision 2026-07-28 sends its `list_changed`
    notifications over a stream the client holds open. When the stream closes within 10 seconds of
    opening, the client reopens it at most three times, then stops for that connection; when it
    closes after staying open longer, the client reopens it, and after five such reopens within an
    hour waits about six hours before the next. Until it reopens, the server's last fetched tools,
    prompts and resources stay in use; reconnecting from `/mcp` picks up changes sooner.
    <!-- docs: mcp.md | Notification streams on the v2 runtime -->

## 8.9 MCPB bundles

1. `mcpServers` MAY name a packaged server, an MCPB file with the extension `.mcpb` or the older
   `.dxt`, as a path inside the plugin or an `https://` URL (§8.1). The server takes its name from the
   `name` in the bundle's manifest, and its configuration from the bundle's server definition, with
   the bundle's platform override for the running platform applied over it (Judgment J8.14).
   <!-- req: mcp.components.Include a packaged MCPB server -->
2. A bundle's manifest MAY declare settings the server needs in a `user_config` block. The user
   supplies them in `/plugin` (the plugin's **Configure** action) or at install with `claude plugin
   install --config <server>.<key>=<value>`, which works only for a bundle inside the plugin. The
   values are saved under `pluginConfigs.<plugin id>.mcpServers.<server>` (§12) and answer the
   bundled server's `${user_config.KEY}` references; the plugin's own options do not.
3. A bundled server with a required setting that has no saved value, or whose saved value fails the
   bundle's own validation, is not started; the rest of the plugin works, and the **Errors** tab
   shows `Bundled MCP server "<name>" was not started: it needs configuration`. A saved empty string
   is no value. Once the values are saved, `/plugin` shows `Configuration saved.`, plugins reload,
   and the server starts when that reload applies. <!-- req: mcp.troubleshooting.Bundled MCP server "<name>" was not started: it needs configuration -->
4. The extracted files under `mcpb/` belong to the client, not to the plugin: they are deleted with
   the plugin's options at its last uninstall, unless another installed plugin uses an identical
   bundle, and otherwise once no session has used them for the `cleanupPeriodDays` period
   (§16.6, §17.5.1).

## 8.10 Tools, results and interaction

### 8.10.1 Output limits

<!-- req: mcp.behavior.MCP output limits and warnings.Output warning threshold | mcp.behavior.MCP output limits and warnings.Default limit | mcp.behavior.MCP output limits and warnings.Configurable limit | mcp.behavior.MCP output limits and warnings.Scope | mcp.behavior.MCP output limits and warnings.Over the limit | mcp.behavior.MCP output limits and warnings.Response size from HTTP and SSE servers | mcp.behavior.MCP output limits and warnings.Message size from WebSocket servers | mcp.behavior.MCP output limits and warnings.Character limit for text results | mcp.behavior.MCP output limits and warnings.Error results -->

| Limit | Value | Rule |
| --- | --- | --- |
| Warning threshold | 10,000 tokens | The client's transcript viewer warns when a tool's output exceeds it. Fixed. |
| Token limit | 25,000 tokens, or `MAX_MCP_OUTPUT_TOKENS` | Applies to tools that declare no limit of their own, and to image data always. A successful result with no image content over the limit is saved to a file in the session's `tool-results` directory under `~/.claude/projects/`, and the conversation carries a message naming the file instead. |
| Text limit | 50,000 characters, or the tool's `anthropic/maxResultSizeChars` (§8.10.2) | A successful foreground result with no image content longer than this is saved to a file the same way, whatever its token count; `MAX_MCP_OUTPUT_TOKENS` does not change it. |
| Error text | about 11,000 characters | The text of a result marked `isError: true` becomes the tool's error; longer text keeps its first and last 5,000 characters with a marker between them saying how many were removed (Judgment J8.17). |
| HTTP and SSE response | 16 MiB after decompression | Per JSON body or event; the client stops reading and the request fails. |
| WebSocket message | 16 MiB | The client closes the connection; calls in progress fail. |

A call moved to a background task reports its result through the task notification, and the
foreground text and error limits do not apply to it. A token count is the client's estimate
(Judgment J8.17).

### 8.10.2 What a tool's entry declares

A server marks individual tools in their `tools/list` entries.

- **`_meta["anthropic/maxResultSizeChars"]`**: raises that tool's text limit to the value, up to a
  ceiling of 500,000 characters, independently of `MAX_MCP_OUTPUT_TOKENS`. Image data stays under
  the token limit. <!-- req: mcp.behavior.Raise the limit for a specific tool -->
- **`_meta["anthropic/requiresUserInteraction"]`** set to the JSON Boolean `true` (any other value
  is ignored): the client shows the tool's permission prompt on every call Claude makes, in every
  permission mode including `acceptEdits`, `auto` and `bypassPermissions`, offers no "don't ask
  again", and lets no allow rule skip it; in `dontAsk` mode, and in a `-p` run with nothing to
  answer the prompt, it denies the call. With `--permission-prompt-tool`,
  an `allow` from the prompt tool becomes a deny, `MCP tool requires user interaction; not supported
  via --permission-prompt-tool`; an SDK `canUseTool` callback may approve. Remote surfaces withhold
  one-tap approval for it (§13). <!-- req: mcp.behavior.Require approval for a specific tool -->
- **`annotations.idempotentHint`** or **`annotations.readOnlyHint`** set to `true`: the client may
  repeat a call that was pending when an `http` or claude.ai connector connection closed, once, on
  a new connection; `readOnlyHint` also lets the call run in parallel with other read-only calls.
  <!-- req: mcp.behavior.Mark tools that are safe to call twice -->
  A pending call that is not repeated, because the tool has neither hint, gives Claude, in place
  of a result, `MCP server "<name>" connection closed before the tool call was answered. The tool
  may have run: check whether it did before running it again.` The next call to one of the
  server's tools connects it again. <!-- docs: errors.md | MCP server connection closed before the tool call was answered -->
- **`_meta["anthropic/alwaysLoad"]`**: `true` loads the tool upfront; `false` keeps it deferred
  when the configuration sets `alwaysLoad: true`, which applies to a plugin's server.

### 8.10.3 Tool input schemas

1. **Root combinators.** A tool whose input schema has `anyOf`, `oneOf` or `allOf` at its root stays
   available. Before sending it, the client flattens the schema into one object and prepends a
   sentence to the description saying which parameters belong together: for `allOf` the branches'
   properties merge and each branch's `required` still applies; for `anyOf` and `oneOf` they merge
   and each branch's `required` is described in the description. A tool the client cannot rewrite,
   or any such tool while feature-flag fetching is on but the flags have not arrived yet, is
   skipped with a reason in the server's log; the server's other tools stay. With flag fetching
   off, the rewrite runs (2.1.328 and later; earlier releases skipped the tool).
   Combinators nested inside `properties` are sent unchanged. <!-- req: mcp.behavior.Tool input schemas with a root-level combinator -->
2. **Invalid schemas.** The client excludes a tool whose top-level property names are not 1 to 64
   characters of ASCII letters, digits, `_`, `.` and `-`, or whose schema, declaring no `$schema` or
   draft 2020-12, is not valid against the draft 2020-12 meta-schema; a schema of another dialect
   skips only the second check. The client logs the reason and tells the model which tools it
   excluded and why; the tool returns when the server fixes it. Only while feature-flag fetching is
   on but the flags have not arrived yet (such as the first session after an install or upgrade) is
   the tool not excluded, the log then recording `input schema would be rejected by the Anthropic
   API`; with flag fetching off the checks apply (2.1.328 and later). <!-- req: mcp.behavior.Tools with invalid input schemas -->
3. **Refused by the API.** When the API rejects a tool's schema in a request, the client logs a line
   containing `the API refused this tool's input schema`, ending with `The API said:` and the reason,
   and resends the request with that tool declared without parameters. <!-- req: mcp.behavior.Tools whose input schema the API refuses -->

### 8.10.4 Images

When a tool returns a PNG, JPEG, GIF or WebP image, the model sees it inline, possibly scaled or
compressed to fit the model's limits, and the client saves the original bytes to a file in the
session's `tool-results` directory and gives the model its path. With `--no-session-persistence`
or `CLAUDE_CODE_SKIP_PROMPT_HISTORY`, no file is written and only the inline copy is given.
<!-- req: mcp.behavior.Images in tool results -->

### 8.10.5 Elicitation

1. A server MAY ask the user for input mid-task. In **form mode** the client shows a dialog of the
   fields the server defines and returns the answer; in **URL mode** it asks whether to open a link
   in the browser. The client passes the URL to the system's URL handler as a command-line argument
   and caps its escaped length: every character that needs escaping counts four times, so the cap
   is about 8,000 plain characters; a longer URL can only be declined. An `Elicitation` hook (§7)
   MAY answer instead of the dialog. <!-- req: mcp.behavior.Respond to MCP elicitation requests -->
2. The client declares `elicitation: {form: {}, url: {}}` on every connection on protocol revision
   2026-07-28, and on earlier revisions to the stdio, `sse`, `http` and `ws` servers of the user's
   MCP configuration, a plugin's servers included (Judgment J8.18). On its other earlier-revision
   connections, such as to claude.ai connectors, it declares the bare `elicitation: {}`, which
   permits form mode only. <!-- req: mcp.behavior.Elicitation modes Claude Code declares -->
3. **Unanswered in a non-interactive run.** In a `claude -p` or SDK run, an elicitation that no
   `Elicitation` hook or SDK `onElicitation` callback answers before the call's time limit
   (`timeout`, §8.2) ends the call with the result `MCP server "<name>" tool "<tool>" timed out
   after <N>s. The server asked the user a question, and no answer came before the time limit. Do
   not call this tool again in this turn. Tell the user that the server's question got no answer,
   and wait for their reply.` <!-- docs: errors.md | MCP tool call timed out with the server's question unanswered -->
4. A call waiting on an open elicitation dialog is not moved to the background while the dialog is
   open (§8.10.7).

### 8.10.6 Turning a server off and what `/mcp` shows

1. A user MAY turn a server off in `/mcp` without removing it. The client records the choice per
   project in `~/.claude.json`, in `disabledMcpServers` for user-configured servers, plugin
   servers, servers provided by managed settings, fetched claude.ai connectors and built-in servers
   that default to on, and in `enabledMcpServers` for built-in servers that default to off. It
   consults exactly one list per server and ignores an entry in the other. These lists are
   unrelated to `enabledMcpjsonServers` and `disabledMcpjsonServers` (§8.11.1).
   <!-- req: mcpSettings.behavior.Disable a server without removing it -->
2. For a server in local, project or user scope, the URL or command line in `/mcp` and in `claude mcp
   list` and `claude mcp get` shows a `${VAR}` reference by name, never its value. A server provided
   through `managedMcpServers` shows only its URL's host. <!-- req: mcpSettings.behavior.How references appear in /mcp and CLI output -->
3. `claude mcp get` hides the values of a plugin's stdio or `ws` server, because they can carry
   credentials. For a stdio
   server it prints `Command: stdio`, an empty `Args:` line and each environment variable as
   `NAME=[REDACTED]`. <!-- req: mcp.behavior.Plugin-provided MCP servers.stdio server -->
4. For a plugin's `ws` server it prints `URL: ws` and each header as `<name>: [REDACTED]`, and `claude
   mcp list` shows `ws` in place of the URL. An `http` or `sse` plugin server is shown as configured.
   <!-- req: mcp.behavior.Plugin-provided MCP servers.WebSocket server -->

### 8.10.7 Long calls in the background

1. An MCP tool call of the main conversation still running after two minutes
   (`CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS`, §3; `0` turns this off) moves to a background task: Claude
   gets the task ID at once and keeps working, and the result arrives as a task notification when
   the call settles. The task is listed in `/tasks` with the latest progress the server reported,
   and it does not survive the session's exit. <!-- docs: mcp.md | Automatic backgrounding of long tool calls -->
2. Stopping the task cancels the call and tells Claude that no result is coming; the server may
   already have done some of the work, or may still finish it. The per-call wall-clock and idle
   limits (§3) still apply in the background.
3. A call never moves when it comes from a subagent, goes to an IDE server, waits on an open
   elicitation dialog (it moves once the dialog closes), or runs in a non-interactive session
   unless `CLAUDE_AUTO_BACKGROUND_TASKS` is `1`. `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` also turns
   the move off.

### 8.10.8 MCP tasks

A plugin's server MAY answer a long-running `tools/call` with a task, as the MCP tasks extension
defines, and let the job run on the server while Claude keeps working (2.1.304 and later; public
beta). <!-- docs: mcp.md | MCP tasks that run on the server -->

1. **When a call may become a task.** All of these hold: the server supports tasks; it is an
   `http`, stdio or claude.ai connector server connected on revision 2026-07-28, so neither
   `MCP_SDK_GENERATION=v1` nor `MCP_PROTOCOL_NEGOTIATION=legacy` is set (§8.8 item 9); the session
   fetches feature flags (not on a third-party provider, not with telemetry or flag fetching off);
   the session is a terminal CLI, Agent SDK or GitHub Actions session, or a cloud session for an
   account or organization Anthropic turned tasks on for (VS Code and local desktop sessions have
   none); the call comes from the main
   conversation, not a subagent; and the session is interactive, or is an SDK session or a `claude
   -p` run reading `--input-format stream-json` with `CLAUDE_AUTO_BACKGROUND_TASKS=1`,
   `CLAUDE_CODE_DISABLE_MCP_TASK_BACKGROUND` not `1` and `CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS` not
   `0`. A one-shot `claude -p "<prompt>"` run gets no tasks. Any other call is a plain call
   (§8.10.7). <!-- docs: mcp.md | What a call needs to become an MCP task -->
2. **What the request carries.** On a 2026-07-28 connection every request carries the client's
   capabilities at `params._meta["io.modelcontextprotocol/clientCapabilities"]`, with
   `"io.modelcontextprotocol/tasks": {}` under `extensions` exactly when the call may become a task.
   <!-- docs: mcp.md | MCP tasks for server authors -->
3. **The task answer.** The JSON-RPC `result` of the `tools/call` response is the task object, with
   no `content` array: <!-- docs: mcp.md | Answer the call with a task -->

   | Field | Rule |
   | --- | --- |
   | `resultType` | `"task"` marks the answer as a task; without it the reply is a plain result. |
   | `taskId` | Required: at most 128 printable ASCII characters, no spaces; otherwise Claude gets a tool error beginning `MCP server "<name>" returned a malformed task handle for tool "<tool>"`. It must stay answerable across connections, since after a resume the client asks about it on a new one. |
   | `status` | Required: `working`, `input_required`, `completed`, `failed` or `cancelled`. |
   | `createdAt`, `lastUpdatedAt`, `ttlMs` | Required by the extension; `ttlMs` may be `null`. The client accepts an answer without them (2.1.317 and later) and never drops a task because `ttlMs` passed. |
   | `pollIntervalMs` | Optional: milliseconds between status requests, clamped to 250–30000, 2000 when absent or `null`, read again from each status response. |
   | `statusMessage` | Optional: `/tasks` shows the value of the latest status response; a response without it clears it. |

   A task answer to a request without the extension, or one with no `taskId` or no valid
   `status`, fails the call with the tool error `Unsupported result type 'task' for tools/call`.
   An `http` or connector server must start the answer within the per-request timer (§8.2.2), so it
   accepts the job and answers first.
4. **Status, results and questions.** Right after the answer, and then once per poll interval, the
   client sends `tasks/get` with `{ "taskId" }`; the response carries `"resultType": "complete"`,
   `taskId`, `status`, `createdAt`, `lastUpdatedAt` and `ttlMs`, and optionally `statusMessage` and
   `pollIntervalMs`. <!-- docs: mcp.md | Report status, results, and questions -->

   A server SHOULD keep a finished task's result for at least an hour, so that a user who exits and
   later resumes the session still gets it, and SHOULD send `ttlMs` and `pollIntervalMs` in the task
   answer and every `tasks/get` response: `ttlMs` as how long it keeps the task from its creation
   (its longest run time plus the time it keeps the result, such as `5400000` for a 30-minute job
   kept one hour), or `null` for no limit; `pollIntervalMs` as 10000 to 30000 for a job that runs
   longer than a minute and 2000 for a shorter one. <!-- req: mcp.behavior.Choose a time to live and a poll interval -->

   | Status or message | What the client does |
   | --- | --- |
   | `working` | Keeps polling. |
   | `completed` | Gives Claude the ordinary `tools/call` result in the top-level `result`; `isError: true` there is a failure (§8.10.1). |
   | `failed` | Tells Claude the `message` of the top-level `error` object `{ code, message, data }`, else `statusMessage`, else `Task failed`. |
   | `cancelled` | Tells Claude `statusMessage`, else `Task was cancelled by the server`. |
   | `input_required` | Reads `inputRequests`, a map of a key the server chooses to `{ method, params }`, and answers each key once with `tasks/update` `{ taskId, inputResponses }`, mapping the same key to that request's result; keys beyond 16 per task are ignored. `elicitation/create` is served only in an interactive terminal session, `roots/list` everywhere; a request the client cannot serve makes it ask the server to cancel the task. |
   | another `status` | Asks the server to cancel the task and reports it to Claude as failed. |
   | JSON-RPC error `-32602` | An unknown task ID: for a task in the background the client keeps asking for up to five minutes, then reports the outcome to Claude as unknown. |

   The client sends `tasks/cancel` when Claude or the user stops the task while the server is
   connected, never on exit; it does not use `tasks/result`, `tasks/list` or `notifications/tasks`,
   so the outcome belongs in the `tasks/get` responses.
5. **Stopping and the result.** The user stops a task from `/tasks` or by asking Claude; the client
   stops following it and asks the server to cancel it, though the server may still finish it. A
   disconnected server gets no cancel request until the user reconnects it from `/mcp`; the client
   never follows a stopped task again. `Esc` does not stop a background task. When a task ends the transcript shows `MCP task <server task id>
   (<server>/<tool>) completed.` and the result goes to Claude, which starts on it unprompted when
   idle. <!-- docs: mcp.md | Stop an MCP task or get its result -->
6. **Questions from a task.** A task may open an elicitation dialog (§8.10.5); declining is an
   answer to the server. Unless Claude waits for the task's result (item 10), `Esc` closes the
   dialog without answering, and the user reopens the question from the task's details in `/tasks`
   (2.1.324 and later). In a non-interactive session the client asks the server to cancel a task
   that requests input, without running `Elicitation` hooks or the SDK's `onElicitation`.
   <!-- docs: mcp.md | Answer a question from an MCP task -->
7. **Exit, clear and resume.** A task on a remote server keeps running after the client exits; a
   stdio server's process stops with the client, though `/tasks` says its tasks keep running after
   exit. After `/clear`, `/branch` or `/resume` of another session, the
   result still arrives in the current conversation while the client stays open. Resuming the
   task's session interactively (`--resume`, `--continue`, `/resume`, or with `--input-format
   stream-json`) follows the task again once the server connects under the same name and connection
   settings; a one-shot `-p` resume, a new session and `--fork-session` do not.
   <!-- docs: mcp.md | Exit, clear, or resume while an MCP task runs -->
8. **Status messages.** While the client cannot reach the server or the task, the task's `/tasks`
   entry or closing line shows one of: `reconnecting…`; `needs a sign-in to <server>`; `status
   requests come back with errors; retrying…`; `server '<name>' did not reconnect within 300s`;
   `server '<name>' asked for a sign-in, and none was accepted within 300s`; `status requests to
   server '<name>' came back with errors, and none succeeded in 300s`; `server '<name>' is not
   configured in this session; the task may still be running on it`; a message beginning `server
   '<name>' was reconfigured to a different transport since this task was created` (its URL,
   command, `args`, `env`, `headers` or `timeout` changed); `the server rejected this task's id;
   asking again…`; and a closing line ending `outcome unknown.` (one form `expired on the server:
   outcome unknown.`) once the client stops following it. The `300s` and configuration messages
   stay after contact returns. <!-- docs: mcp.md | Status messages on an MCP task -->
9. **Time limits.** A task in the background has no client time limit; the call's wall-clock and
   idle limits apply until the server answers with the task, and for the whole task when Claude
   waits for it. Answered status requests count as activity for the idle limit.
   <!-- docs: mcp.md | Time limits on MCP tasks -->
10. **Making Claude wait.** In an interactive session `CLAUDE_CODE_MCP_AUTO_BACKGROUND_MS=0` makes
    Claude wait for every MCP call, and `CLAUDE_CODE_DISABLE_MCP_TASK_BACKGROUND=1` for a task's
    result, the call then moving to a plain background call after the §8.10.7 threshold. While
    Claude waits, `Esc` or a time limit ends the call and the client asks the server to cancel the
    task. `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1` and bare mode alone do not make Claude wait.
    <!-- docs: mcp.md | Make Claude wait for the result of an MCP task -->

### 8.10.9 Resources

A server MAY offer resources. The client lists them with `resources/list` at discovery (retried
like the other discovery requests, §8.8) and again on a `list_changed` notification in an
interactive session. It offers them beside files in the `@` mention completion, referenced as
`@<server>:<protocol>://<path>`, and reads a mentioned resource with `resources/read`, attaching
its content to the prompt; a prompt may mention several. In `claude -p` a resource mention stays
plain text and nothing is attached. Claude also gets the
`ListMcpResourcesTool` and `ReadMcpResourceTool` tools when a connected server supports resources.
An MCP Apps UI resource (a `ui://` URI or the media type `text/html;profile=mcp-app`) is left out of
the `@` completion and of the list tool's results, so a server with only such resources shows an
empty list; reading one by its URI still works. For a plugin's server, `<server>` is its scoped
name (§8.5, Judgment J8.28). <!-- docs: mcp.md | Use MCP resources --> <!-- docs: mcp.md | Reference MCP resources -->

### 8.10.10 Tool search

1. **Deferral.** By default the client defers MCP tools behind tool search: only tool names and
   server instructions reach the model at session start, and Claude loads a tool's definition when
   it searches for it. A plugin's server is treated as any other. <!-- docs: mcp.md | Scale with MCP tool search -->
2. **`ENABLE_TOOL_SEARCH`**: unset or `true` defers; `auto` loads the tools that would be deferred
   upfront while their definitions total under 10% of the context window and turns tool search on
   at 10% or more, after which tools may stay deferred even if the total drops below it; `auto:N`
   uses `N` percent (0–100); `false` loads every MCP tool upfront. It may also be set in a settings
   `env` (§12.7.4). <!-- docs: env-vars.md | Variables — ENABLE_TOOL_SEARCH --> <!-- docs: mcp.md | Configure tool search -->
   <!-- docs: mcp.md | Tools that stay deferred below the ENABLE_TOOL_SEARCH=auto threshold -->
3. **Cases that keep tool search off**, whatever `ENABLE_TOOL_SEARCH` says: models before Opus 4,
   Sonnet 4 and Haiku 4.5 (on Google Cloud's Agent Platform, before the 4.5 generation); Microsoft
   Foundry deployments hosted on Azure, which reject it; `CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS`,
   unless managed settings keep it on (2.1.227 and later); a session with the HIPAA configuration.
   A `ToolSearch` deny rule or a `--tools` list without `ToolSearch` loads MCP tools upfront too.
   With tool search on, the client tells Claude which configured server failed to connect and its
   connection error, also in a `ToolSearch` result that finds no tool; with it off, it does not.
   <!-- docs: mcp.md | How Claude learns that a server failed -->
4. **Per server and per tool.** A server's `alwaysLoad` (§8.2) and a tool's
   `_meta["anthropic/alwaysLoad"]` (§8.10.2) decide what is upfront: `alwaysLoad: true` loads every
   tool of the server regardless of `ENABLE_TOOL_SEARCH`; `alwaysLoad: false` keeps every tool
   deferred, marked tools included (2.1.287 and later); with `alwaysLoad` unset a tool marked `true`
   loads upfront without holding startup. <!-- docs: mcp.md | Exempt a server from deferral --> <!-- docs: mcp.md | Defer a server's tools --> <!-- docs: mcp.md | Mark a tool to load upfront or stay deferred -->
5. **Description limits.** The client cuts server instructions and the description of a tool that
   loads upfront at 4,096 characters, and the description of a deferred tool at 16,384; tool
   search matches only within the shorter limit. `CLAUDE_CODE_MAX_MCP_DESCRIPTION_LENGTH` (§3)
   replaces both. A server author SHOULD put what Claude would search for near the start, and write
   instructions that say what tasks its tools serve and when to search for them.
   <!-- docs: mcp.md | Tool search for MCP server authors --> <!-- docs: mcp.md | Change the description length limits -->

## 8.11 Settings and managed policy

The settings keys that approve, reject and filter MCP servers, the scopes a plugin's server ranks
against, and the organization's managed MCP configuration are in [08-mcp-policy.md](08-mcp-policy.md).

## 8.12 How a Claude Code entry differs from a core `mcp.json` entry

Non-normative summary; §18 maps one format onto the other. A core package's `mcp.json` (core
§7.2) and a Claude Code plugin's `.mcp.json` describe the same servers differently:

| Aspect | Core `mcp.json` | Claude Code `.mcp.json` and `mcpServers` |
| --- | --- | --- |
| Where | Only `mcp.json` at the root; no inline configuration | `.mcp.json`, plus the manifest's files, inline map and bundles (§8.1) |
| Top level | `$schema` and `mcpServers`, nothing else | The `mcpServers` wrapper or the bare map |
| `type` | Required: `stdio`, `streamable-http`, `sse` | Optional (absent is stdio); `stdio`, `http` (alias `streamable-http`), `sse`, `ws` |
| Unknown fields | Make the entry invalid | Kept and ignored (Judgment J8.3) |
| `command` | One token, a bare name or `./` path; never expanded | Any string, expanded (`${CLAUDE_PLUGIN_ROOT}`, `${VAR}`, `${user_config.*}`) |
| `cwd` | Supported, default the plugin root | Not a field |
| Placeholders | `${PLUGIN_ROOT}`, `${PLUGIN_DATA}` in `args`, `env`, `cwd` only | `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_PROJECT_DIR}`, `${VAR}`, `${VAR:-default}`, `${user_config.KEY}` (§8.4) |
| Remote `url`, `headers` | Never expanded; HTTPS required off loopback; no userinfo or fragment | Expanded; `http://` off loopback only warned |
| Authentication | Client-managed; no fields | `oauth`, `headersHelper` (§8.6, §8.7) |
| Extra fields | `extensions` | `timeout`, `alwaysLoad` |

## Design decisions

### Why an invalid inline entry fails the plugin but an invalid `.mcp.json` entry does not

The manifest is validated as one document, so an inline server that does not fit fails the
manifest as any other mistyped field does (§2.1). `.mcp.json` is a separate file read server by
server, and dropping one bad entry keeps the rest of the plugin working. Matching Claude Code on
both sides means the same plugin loads, or fails, the same way in either client.

### Why a plugin's unset variable is an error while a user's is a warning

A user who writes `${VAR}` in their own configuration can see the warning and set the variable. A
plugin's server that starts with a literal `${VAR}` in its command or URL fails in ways its user
cannot trace, so refusing it with the missing names gives the user something to act on.

### Why credentials read as empty toward remote servers

A project's `.mcp.json` or a plugin names the servers it talks to. Expanding `${ANTHROPIC_API_KEY}`
into a header would let any such file send the user's own credentials to a server of its choosing,
so the client refuses to expand them there and lets a user opt in by copying a value to a name of
their own.

## Judgments

| Id | Judgment | Evidence |
| --- | --- | --- |
| J8.1 | `.mcp.json` is the wrapped form when its `mcpServers` member is an object with no `command` and no `url`; otherwise the file is the bare map. | components.md allows omitting the wrapper without saying how the two are told apart; the reference implementation reads it so. |
| J8.2 | An entry of the manifest's inline `mcpServers` that fails §8.2 fails the manifest and the plugin does not load; `type: "sdk"` is only dropped. | mcp.md's skip rules ("Option 1: Add a remote HTTP server") name entries in `.mcp.json`, `~/.claude.json`, settings and `claude mcp add-json`, not a manifest's inline map, so the docs are silent here and this is no E4a deviation. The reference implementation observed the plugin failing on 2.1.319, and `claude plugin validate` 2.1.325 reports `mcpServers: Invalid input` against the manifest for `{"mcpServers":{"m":{"url":"https://x.example"}}}`, and `claude --plugin-dir p plugin list` 2.1.325 (private config dir) shows the plugin `Failed to load` with the same validation error. |
| J8.3 | A server entry is an open object: fields §8.2 does not name are kept and ignored; an unknown key inside `oauth` is ignored. The shapes are the SDK types plus `ws` (the fields of `http`), `headersHelper` and `oauth`. | The SDK types lack `ws`, `headersHelper` and `oauth`; mcp.md gives no complete field table. `claude plugin validate` 2.1.325 reports nothing for an unknown field (`bogusField`) or an unknown `oauth` key, and reports wrong types, an empty `command`, a non-`https://` `authServerMetadataUrl` and an unknown `type` as entries the loader drops. |
| J8.4 | `"streamable-http"` is read as `"http"`; the server carries `type: "http"`. | mcp.md names the alias without saying whether the type is kept. |
| J8.5 | A plugin server's unset `${VAR}` with no default makes it invalid (`Missing environment variables: <names>`) and it does not start; a user-scope server keeps the literal with a warning. | Contradiction: mcp.md ("Unset variables without a default") says the config still loads with the text unexpanded; plugins/troubleshooting.md lists `Missing environment variables` as a cause of `Invalid MCP server config` for a plugin's server. The plugin-specific page decides for plugins. |
| J8.6 | Reference grammar: `${NAME}` with a shell variable name, a default up to the first `}`, no nesting, no escape, one pass, other `${...}` text literal and silent. | mcp.md names the two forms only; skills.md gives the single pass; the reference implementation's grammar. |
| J8.7 | The credential sets (read as empty in remote `url`/`headers`; removed from a supplied helper's environment) are the names the docs give plus the patterns of §3; a client SHOULD use Claude Code's observed set. | mcp.md lists the names "such as"; the reference implementation observed the sets on 2.1.319 and 2.1.321. |
| J8.8 | A helper that fails, times out or prints anything but a JSON object of strings contributes no headers and is reported as an error of the server; header names compare without regard to case. | mcp.md gives the output rule and the 10 seconds, not the failure. |
| J8.9 | `CLAUDE_CODE_MCP_SERVER_NAME` of a plugin's server is its scoped name `plugin:<plugin>:<server>`. | mcp.md says "the name of the MCP server" and that the server registers under the scoped name. |
| J8.10 | A plugin `headersHelper` referencing `${user_config.*}` is refused whether or not the plugin declares options or a value is saved. | errors.md: "The check runs on the command template". `claude plugin validate` 2.1.325 and 2.1.330 say instead that the loader refuses it "when the plugin declares any options" and otherwise passes the literal text to the shell; the 2.1.330 docs (`errors.md`, "Plugin command references user_config"; `mcp.md`; `plugins/manifest-reference.md`) still say the server is refused without that condition, and no oracle run observed the loader itself, so the docs decide. |
| J8.11 | The 128-character limit counts UTF-16 code units, and a tool over it is left out, never shortened. | mcp.md and errors.md say "characters". |
| J8.12 | A plugin server's prompts are listed under its scoped name and run as `/mcp__plugin_<plugin>_<server>__<prompt>` (normalised); the reserved-name check and the `anthropic-skills` rule apply to a server's registered name, so a plugin's server key `workspace` loads. | mcp.md gives the prompt forms for a server name and the reserved names for "your configuration"; `claude plugin validate` 2.1.325 reports nothing for a plugin server named `workspace`. |
| J8.13 | An `mcpServers` string that starts with `http://` or `https://` is a URL (only `https://` accepted), one ending `.json` a file, anything else a bundle path; the extension is matched exactly. | The table names the shapes, not how a string is classified. `claude plugin validate` 2.1.325 reports `./x.zip` as `Invalid string: must end with ".json"`, not as a bundle extension error. |
| J8.14 | A bundle's server is its manifest's server configuration with the running platform's override applied; a required setting saved as the empty string has no value. | components.md points to the MCPB format, not held in the docs; the reference implementation's reading. |
| J8.15 | A plugin's server cannot carry a client secret; `oauth` holds no secret field, and `oauth` on a `ws` or stdio server is ignored. | mcp.md: the secret is given only when adding a server and stored outside the config; the flags apply to HTTP and SSE only. `claude plugin validate` 2.1.325 reports nothing for `oauth` on a `ws` server. |
| J8.16 | A failure exactly 15 minutes old is old enough to retry; a failure dated in the future does not count. | The docs say "less than 15 minutes earlier". |
| J8.17 | The error-text cut applies past 11,000 characters; a token estimate is four characters per token. | mcp.md says "about 11,000"; the docs give budgets, not a counting rule. |
| J8.18 | A plugin's servers are among "the servers in a user's Claude Code MCP configuration" that get both elicitation modes on earlier revisions. | mcp.md contrasts them only with claude.ai connectors. |
| J8.26 | Under `CLAUDE_CODE_SHELL_PREFIX` a stdio server's command line is `command` and each `args` element, each quoted for a POSIX shell (single quotes, an embedded `'` written `'\''`) and joined by spaces, and that line is passed, quoted once more, as the one argument after the prefix as written; the result runs through the shell the client uses for hook commands. | env-vars.md says the wrapper gets "the command line as a single shell-quoted argument in `$1`" and gives `npx -y <package>` as such a line, without the quoting of each element. Quoting each element keeps an argument with a space one argument when the wrapper re-evaluates `$1`. |
| J8.27 | The validator's `server config must be an object (got <kind>)` names the JSON kind (`array`, `string`, `number`, `boolean`, `null`); a regular MCP server file over 1,048,576 bytes draws `The file is past the size cap and was not read — MCP server files are read without following symlinks and are capped at 1048576 bytes. The plugin loader has neither limit, so validate the real file separately.` (warning). | The 2.1.321 corpus shows only `array` and `string` and only the link case. Oracle 2.1.325 (`claude plugin validate`, private config dir) gives `got number`, `got boolean`, `got null` for `{"a":5,"b":true,"c":null}` under `mcpServers`, and the size-cap wording for a 2 MB `.mcp.json`. |
| J8.28 | A plugin server's resources are offered and mentioned under the server's scoped name `plugin:<plugin>:<server>`, as its prompts are listed (J8.12). | mcp.md gives `@server:protocol://resource/path` and the scoped name "where a configured server name is expected", nothing more for plugins. |
| J8.29 | Under `CLAUDE_CODE_SHELL_PREFIX` a library returns the prefixed start command of a stdio server (an exec without a prefix, a bash shell command `<prefix> '<line>'` with one) and the host launches and keeps the process; a blank prefix is no prefix. | `env-vars.md`, "CLAUDE_CODE_SHELL_PREFIX", says the client wraps the start commands of stdio MCP servers; the wrapping is a pure function of the server's `command`, `args` and the variable, which a library can compute and test, while the process lives as long as the session, which only the host owns. A blank prefix wraps nothing: a value of only blanks names no program to run the line with. |
