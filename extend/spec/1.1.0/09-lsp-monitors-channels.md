# 9. LSP servers, monitors and channels

Three components of a Claude Code plugin start long-lived processes beside the session: a language
server that gives Claude diagnostics and code navigation (§9.1), a monitor whose output reaches
Claude as notifications (§9.2), and a channel, an MCP server of the plugin that pushes outside
events into the session (§9.3). Evidence: `plugins/manifest-reference.md` ("lspServers",
"monitors", "Channels"), `plugins/components.md` ("LSP servers", "Monitors", "Channels"),
`plugins/code-intelligence.md`, `channels.md` and `channels-reference.md`, unless a paragraph names
another page. The Agent SDK declares none of these configurations (no LSP, monitor or channel type
in `sdk.d.ts`), so the shapes below follow the field tables of `plugins/manifest-reference.md`.

## 9.1 LSP servers

### 9.1.1 Sources

1. A plugin declares language servers in `.lsp.json` at the plugin root, in the `lspServers`
   manifest key, or both; §2.10 defines the forms of `lspServers` and the merge: `.lsp.json` first,
   then each declared value in order, a later server name replacing an earlier one whole (Judgment
   J9.4 for the order this leaves).
2. `.lsp.json`, and every `.json` file `lspServers` names, MUST be a JSON object that maps each
   server name directly to its configuration, with no wrapper key. An inline `lspServers` object
   is the same map.
3. When any entry of a file is invalid, the client MUST skip the whole file — no server of it
   loads — and report `Invalid LSP server config for "<file>"` (for `.lsp.json`,
   `Invalid LSP server config for ".lsp.json"`) among the plugin's errors; the plugin's other
   components still load. An invalid entry in the inline `lspServers` object is an unknown key or a
   type error in the manifest, so the plugin does not load (§2.1, §2.11). `claude plugin validate`
   does not read `.lsp.json` or a named LSP file (Judgment J9.5).
4. A plugin configures the connection only; it does not ship the language server. The client
   starts `command` as given, resolving a bare name on the user's `PATH` (§9.1.4).

Adding a language that has no official code intelligence plugin takes nothing more than such a
plugin: an `.lsp.json` naming the server command and the extensions it handles, loaded with
`--plugin-dir` (§17) or installed from a marketplace (§15, §16). A client MUST treat it exactly as
it treats an official code intelligence plugin. <!-- req: lsp.components.LSP servers | lsp.intelligence.Add a language without an official plugin -->

```json
{
  "gopls": {
    "command": "gopls",
    "args": ["serve"],
    "extensionToLanguage": { ".go": "go" }
  }
}
```

### 9.1.2 The server configuration

A server configuration is a strict object (§2.1): a key other than the fourteen below makes it
invalid. A *positive integer* is a JSON number that is an integer greater than zero; a fraction or
zero is invalid.

| Field | Type | Required | Default | Rule |
| --- | --- | --- | --- | --- |
| `command` | string | yes | — | The language server executable. It MUST NOT be empty and MUST NOT contain whitespace unless it starts with `/` (an absolute path may hold spaces); arguments go in `args` (Judgment J9.1). The validator's message is `Command should not contain spaces. Use args array for arguments.` `${...}` resolves in it (§3). <!-- req: lsp.field.command --> |
| `extensionToLanguage` | object of string to string | yes | — | Maps a file extension to the LSP language identifier sent for it. It MUST have at least one entry (`extensionToLanguage must have at least one mapping`), and every key MUST start with `.`, as `".go"`. <!-- req: lsp.field.extensionToLanguage --> |
| `args` | string[] | no | `[]` | Arguments passed to the server process. `${...}` resolves in each. <!-- req: lsp.field.args --> |
| `transport` | `"stdio"` or `"socket"` | no | `"stdio"` | Any other value is invalid. The client MUST accept `"socket"` and MUST still run the server over stdio, so the stdout rules of §9.1.4 apply to every server. <!-- req: lsp.field.transport --> |
| `env` | object of string to string | no | none | Variables added to the server's environment; a non-string value is invalid. `${...}` resolves in each value. <!-- req: lsp.field.env --> |
| `initializationOptions` | any JSON value | no | none | Sent unchanged as `initializationOptions` of the `initialize` request; omitted from the request when unset. `${...}` does not resolve in it. <!-- req: lsp.field.initializationOptions --> |
| `settings` | any JSON value | no | none | Sent unchanged as the `settings` of a `workspace/didChangeConfiguration` notification after initialization; without it the client sends none (Judgment J9.6). `${...}` does not resolve in it. <!-- req: lsp.field.settings --> |
| `workspaceFolder` | string | no | the project root | The workspace folder the server is given. `${...}` resolves in it (Judgment J9.6). <!-- req: lsp.field.workspaceFolder --> |
| `startupTimeout` | positive integer, milliseconds | no | none | How long the client waits for the server to start; when it elapses the start fails as in §9.1.4. Unset, there is no startup deadline (Judgment J9.3). <!-- req: lsp.field.startupTimeout --> |
| `shutdownTimeout` | positive integer, milliseconds | no | none | How long the client waits for a graceful shutdown before it terminates the process. Unset, no timeout applies: the client waits for the shutdown. <!-- req: lsp.field.shutdownTimeout --> |
| `requestTimeout` | positive integer, milliseconds | no | `60000` | How long the client waits for the answer to one request; a request the server does not answer in time fails, and the server keeps running. (Documented as requiring Claude Code 2.1.288 or later; this specification targets 2.1.321, so the field is always recognised.) <!-- req: lsp.field.requestTimeout --> |
| `restartOnCrash` | boolean | no | `true` | Whether the client restarts the server after it crashes. `false` leaves a crashed server stopped. <!-- req: lsp.field.restartOnCrash --> |
| `maxRestarts` | integer, zero or more | no | unbounded | Restart attempts before the client gives up on the server; `0` never restarts. A negative value is invalid (Judgment J9.2). <!-- req: lsp.field.maxRestarts --> |
| `diagnostics` | boolean | no | `true` | Whether the diagnostics the server reports after an edit are put into Claude's context (§9.1.4). `false` keeps the server for navigation only. <!-- req: lsp.field.diagnostics --> |

`${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_PROJECT_DIR}` and `${user_config.KEY}`
resolve in `command`, `args`, `env` and `workspaceFolder`, and the three path variables are also
exported to the server process (§3, `plugins/manifest-reference.md`, "Where each variable
resolves").

### 9.1.3 Validation, by example

Oracle checks (Judgment J9.5) of an inline `lspServers` entry, each beside the valid
`{ "command": "gopls", "extensionToLanguage": { ".go": "go" } }`:

| Entry change | Verdict | Reported at |
| --- | --- | --- |
| adds `"foo": 1` | failed | `lspServers.go: Unrecognized key: "foo"` |
| `"command": "gopls serve"` | failed | `lspServers.go.command: Command should not contain spaces. Use args array for arguments.` |
| `"command": "/opt/my dir/gopls"` | passed | — |
| `"command": ""` | failed | `lspServers.go.command: Too small: expected string to have >=1 characters` |
| no `command` | failed | `lspServers: Invalid input` |
| `"extensionToLanguage": {}` | failed | `lspServers.go.extensionToLanguage: extensionToLanguage must have at least one mapping` |
| `"extensionToLanguage": { "go": "go" }` | failed | `lspServers` |
| `"transport": "tcp"` | failed | `lspServers` |
| `"transport": "socket"` | passed | — |
| `"startupTimeout": 0` | failed | `lspServers.go.startupTimeout: ... >0` |
| `"requestTimeout": 1.5` | failed | `lspServers` |
| `"maxRestarts": -1` / `0` | failed / passed | `lspServers.go.maxRestarts: ... >=0` |
| `"env": { "A": 1 }` | failed | `lspServers` |
| `"initializationOptions": 5`, `"settings": "x"` | passed | — |

An `lspServers` path MUST start with `./` and end in `.json` (`Invalid string: must end with
".json"`); §2.5 governs containment.

### 9.1.4 Runtime

1. **Cloud sessions.** A client that runs a session in a cloud sandbox MUST NOT start plugin
   language servers there (`plugins/code-intelligence.md`).
2. **Start.** The client starts a server lazily, the first time Claude edits or writes a file whose
   extension routes to it (item 4), as `command` with `args`, in the environment of the session
   plus `env` and the exported path variables. When the executable is not found, or the process
   fails to start, the client MUST record a plugin error with the reason — for a missing executable
   `Executable not found in $PATH: "<binary>"` — and write `LSP server <name> failed to start:
   <reason>` to its debug log. The session continues without that server. After the user installs
   the binary, the client tries again on the next matching edit; a `PATH` change made outside the
   session needs a new session. <!-- req: lsp.troubleshooting.Language server doesn't start -->
3. **Protocol on stdout.** The client reads the server's stdout as LSP messages only and accepts a
   message header block of up to 64 KiB and a message body of up to 32 MiB. A server that exceeds
   either limit or writes anything but protocol messages to stdout is disconnected, and the
   disconnect counts as a crash for `restartOnCrash` and `maxRestarts`; under `--debug` the client
   logs an error naming the cause. A server's own log output belongs on stderr.
4. **One server per extension.** The client routes a file to a server by its extension. When two
   enabled servers claim the same extension, whether from one plugin or two, the server registered
   first handles those files and the other is not used for them; the client MUST report the
   warning `LSP server "<name>" is not used for <ext> files` for the losing server and extension.
   Registration order, matching and the qualified name in the warning are Judgment J9.4.
5. **What Claude gains.** After each edit or write of a routed file, the client collects the
   diagnostics the server reports and, unless the server sets `diagnostics: false`, adds them to
   Claude's context; the transcript shows the summary `Found N new diagnostic issues in M files`.
   The client also offers Claude the read-only `LSP` tool, which stays inactive until a plugin
   provides a language server. Through it Claude asks the server routed for a file to jump to a
   symbol's definition, find its references, give type information at a position (hover), list
   the symbols of a file, search the workspace for a symbol by name, find the implementations of
   an interface and trace call hierarchies; the client sends the matching LSP requests
   (`textDocument/definition`, `textDocument/references`, `textDocument/hover`,
   `textDocument/documentSymbol`, `workspace/symbol`, `textDocument/implementation`, and the call
   hierarchy requests; Judgment J9.16). Each call on a file whose server the client cannot start
   returns an error result. <!-- docs: tools-reference.md | LSP tool behavior -->
6. **Crash and restart.** After a crash the client restarts the server while `restartOnCrash` is
   true and fewer than `maxRestarts` restarts have been made (Judgment J9.2); otherwise the server
   stays stopped for the session.
7. **Shutdown.** At session end, or when the plugin is disabled or reloaded, the client asks the
   server to shut down and terminates it once `shutdownTimeout`, when set, elapses.
8. **Outside the sandbox.** A language server runs with the user's full access even when the
   sandbox is on: the sandbox wraps the Bash tool's shell commands, not the processes the client
   starts itself, so `sandbox` settings neither confine a plugin's language server nor need to
   allow it anything. The same holds for stdio MCP servers (§8.2.1), hooks (§7) and monitors
   (§9.2.3). <!-- docs: sandboxing.md | What runs outside the sandbox --> <!-- docs: settings-reference.md | sandbox -->

The recommendation dialog that offers an official code intelligence plugin when its binary is on
`PATH` (`plugins/code-intelligence.md`, "Accept or dismiss the recommendation dialog") is the
client's own interface and not part of a plugin's contract; a client MAY implement it.

## 9.2 Monitors

A monitor is a shell command the client runs as a persistent background process for the session;
each line it prints reaches Claude as a notification, so Claude reacts to a log or a status change
without being asked to watch it (`tools-reference.md`, "Monitor tool", for the same behaviour of the
`Monitor` tool).

### 9.2.1 Sources

The monitors of a plugin are a JSON array of entries, read from `experimental.monitors` (a `.json`
path or the inline array), or, without that key, from `monitors/monitors.json` when it exists
(§2.6, §2.10). A top-level `monitors` key still loads, with the validator warning `'monitors' is an
experimental component; declare it under 'experimental.monitors' instead of at the top level.
Top-level still loads for now but will be removed in a future release.`; when
both are set, `experimental.monitors` is read (Judgment J9.7). A source that is not an array is
invalid. An invalid inline array fails the manifest (§2.11); an invalid monitors file is skipped
whole and reported, and the plugin's other components load (Judgment J9.7).

### 9.2.2 The monitor entry

An entry is a strict object (§2.1) with these fields:

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `name` | non-empty string | yes | Identifies the monitor within the plugin. Two entries of one plugin MUST NOT share a name; the validator reports `Monitor names must be unique within a plugin` and fails (Judgment J9.7 for the runtime). <!-- req: monitors.field.name --> |
| `command` | non-empty string | yes | The shell command, run as described in §9.2.3. `${CLAUDE_PLUGIN_ROOT}`, `${CLAUDE_PLUGIN_DATA}`, `${CLAUDE_PROJECT_DIR}` and `${ENV_VAR}` from the environment resolve anywhere in it; a substituted path SHOULD be written inside double quotes so a path with spaces stays one word. `${user_config.*}` never resolves in it (§9.2.4). <!-- req: monitors.field.command --> |
| `description` | non-empty string | yes | A short summary the client shows in its task panel and in the summary of each notification the monitor produces. `${...}` does not resolve in it. <!-- req: monitors.field.description --> |
| `when` | string | no, default `"always"` | `"always"` starts the monitor at session start and on plugin reload. `"on-skill-invoke:<skill>"` starts it the first time that skill runs, where `<skill>` is non-empty. Any other value is invalid: for an empty skill the validator reports `on-skill-invoke: must specify a skill name`, and for any other value both `Invalid string: must start with "on-skill-invoke:"` and that message (Judgment J9.8 for matching). <!-- req: monitors.field.when --> |

```json
[
  {
    "name": "deploy-status",
    "command": "\"${CLAUDE_PLUGIN_ROOT}\"/scripts/poll-deploy.sh",
    "description": "Deployment status changes",
    "when": "on-skill-invoke:deploy"
  }
]
```

### 9.2.3 Starting, running and stopping

1. The client runs `command` through a shell, as a background process, in the session's current
   working directory, with the user's full permissions and outside any sandbox (§13). It feeds each
   line the process writes to stdout to Claude as a notification labelled with `description`.
2. A monitor whose `when` is `"always"` starts when the session starts and when plugins reload; one
   whose `when` is `"on-skill-invoke:<skill>"` starts the first time that skill runs in the session.
   A monitor that is already running is not started a second time (Judgment J9.9).
3. Plugin monitors MUST NOT start in a non-interactive session: one run with `-p`, and any session
   with no person at it, such as one driven through the Agent SDK (Judgment J9.10). <!-- req: monitors.components.Monitors.Interactive sessions -->
4. When the client runs with feature-flag fetching off — on Amazon Bedrock, Claude Platform on AWS,
   Google Cloud's Agent Platform or Microsoft Foundry, or with `DISABLE_TELEMETRY` or
   `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` set — monitors are available only from Claude Code
   2.1.310. A client conforming to this specification (2.1.321) MUST start monitors in those
   configurations as in any other; a client that states the behaviour of an earlier release MUST
   NOT start them there. <!-- req: monitors.components.Monitors.Minimum version -->
5. Disabling a plugin mid-session MUST NOT stop its monitors that are already running; they stop
   when the session ends. Only a monitor that has not started yet is prevented by the disable. <!-- req: monitors.components.Monitors.Disabling mid-session -->
6. Moving the session to the background (`/background`, agent view) stops its running monitors,
   because a monitor cannot move to the background session; the client first asks the user to
   confirm in the `Background this session?` dialog, which names the work it would stop. A
   backgrounded subagent that owns a monitor stops with it. Once in the background, the session can
   start monitors again. <!-- docs: agent-view.md | What carries over when you background -->

### 9.2.4 No user configuration

A monitor `command` MUST NOT reference `${user_config.*}`. The client checks the template, before
any value is configured, and a monitor that references one does not start; the client reports
`Monitor "<name>" from plugin <plugin> references ${user_config.*} in its command. The substituted
value would be passed to a shell. Monitor commands cannot safely reference ${user_config.*}; have
the monitor script read the value from a config file or prompt instead.` (`errors.md`, "Plugin
command references user_config"). A monitor process MUST NOT receive `CLAUDE_PLUGIN_OPTION_<KEY>`
or any other option value, and the path variables are not exported to it: `${CLAUDE_PLUGIN_ROOT}`,
`${CLAUDE_PLUGIN_DATA}` and `${CLAUDE_PROJECT_DIR}` resolve inline in `command`, the path itself
written into the text before the shell parses it, and the process environment carries none of
them, referenced or not (Judgment J9.17). A monitor that needs a configured value obtains it
itself (§3). `claude plugin validate` does not report the reference:
the refusal is at start (Judgment J9.11). <!-- req: monitors.components.Monitors.No user configuration -->

## 9.3 Channels

A channel is an MCP server, spawned by the client as a subprocess and spoken to over stdio, that
pushes events into a running session: a chat bridge, a webhook receiver, a monitoring alert
forwarder. A one-way channel only pushes; a two-way channel also offers a reply tool; a channel with
a trusted sender path can relay permission prompts. Channels are a research preview in Claude Code
2.1.321, and the flags and protocol below are that release's.

### 9.3.1 The `channels` entry

In a plugin, a channel is one of the plugin's MCP servers (§8) plus an entry of the manifest's
`channels` array that binds to it. Each entry is a strict object (§2.1): <!-- req: channels.components.Channels -->

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `server` | non-empty string | yes | The key, in this plugin's merged MCP servers (`.mcp.json`, named files and inline `mcpServers`, §2.9), of the server the channel binds to. A channel whose `server` names no server of the plugin is not registered and the client reports it; the plugin otherwise loads (Judgment J9.12). <!-- req: channels.field.server --> |
| `displayName` | string | no | The name in the title of the channel's configuration dialog. Default: the value of `server`. <!-- req: channels.field.displayName --> |
| `userConfig` | object | no | Options to prompt for, in exactly the shape and with the strictness of the top-level `userConfig` (§3.4); an unknown key in an option fails the manifest (`channels.0.userConfig.<key>: Unrecognized key`). The values saved for them substitute into `${user_config.KEY}` references in the bound server's `env` (Judgment J9.13 for a key also declared at the top level). The client prompts for them when it prompts for the plugin's own options: on an interactive install, on enable, and with `/plugin configure` (§3.4, §16). <!-- req: channels.field.userConfig --> |

The validator's check of `${user_config.KEY}` references in MCP servers (§2.9) counts the options of
the channel bound to that server as declared.

```json
{
  "name": "chat-bridge",
  "mcpServers": {
    "chat": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/server.js"],
      "env": { "BOT_TOKEN": "${user_config.bot_token}" }
    }
  },
  "channels": [
    {
      "server": "chat",
      "displayName": "Chat",
      "userConfig": {
        "bot_token": {
          "type": "string",
          "title": "Bot token",
          "description": "The bot's API token",
          "sensitive": true
        }
      }
    }
  ]
}
```

### 9.3.2 Registering a channel for a session

1. Installing a channel plugin, or having a server with the channel capability in `.mcp.json`, does
   not make it a channel. The client registers a channel only when the user names it for the session:
   `--channels plugin:<name>@<marketplace>` for a plugin's channel, or
   `--dangerously-load-development-channels` with `plugin:<name>@<marketplace>` or `server:<name>`.
   The bound MCP server connects and its tools work either way; only registration makes its events
   and permission relay reach the session. <!-- req: channels.reference.Package as a plugin -->
2. A `--channels` entry MUST be on the effective allowlist to register: the organisation's
   `allowedChannelPlugins` when set, otherwise the default list, which is the channel plugins of
   `claude-plugins-official`; no other marketplace, the community marketplace included, is on it. A
   channel from any other marketplace runs only through the development flag, unless an
   administrator lists it. An entry not on the list does not register; the session starts and its
   startup notice says why.
3. The development flag bypasses the allowlist for its own entries only, after a confirmation
   prompt; it does not extend the bypass to `--channels` entries. It works only in an interactive
   session: with `-p` or through the Agent SDK the client ignores it and the channel does not
   register.
4. The organisation's `channelsEnabled` switch applies above both flags: while it is off, no channel
   registers, the development flag included, and the startup notice tells the user to have an
   administrator enable it. §14 defines the two managed settings and their defaults per
   account type.
5. On the client's v2 MCP runtime (§8.8 item 9), a channel server that negotiates MCP protocol
   revision 2026-07-28 MUST NOT be registered as a channel, since that revision cannot carry
   channel messages; its tools still work. A channel server that does not support the revision
   connects on the earlier handshake and registers as usual. The client asks stdio servers for the
   revision by default, so a stdio channel server that supports it stays registrable only on the v1
   runtime or under `MCP_PROTOCOL_NEGOTIATION=legacy`, which keeps every server on the earlier
   handshake (§3).
   <!-- docs: mcp.md | Push messages with channels -->

Every registered channel thus passes three gates: the user's opt-in for the session, the
organisation's controls, and the sender allowlist the server itself keeps (§9.3.6). Anyone a channel
admits can put text in front of Claude, and, when the channel declares relay, approve or deny tool
use; a channel server MUST gate on that allowlist both its inbound messages and its permission
verdicts. <!-- req: channels.overview.Security -->

### 9.3.3 What a channel server implements

A channel server MUST be an MCP server that connects over stdio and declares, in the
`capabilities` of its `initialize` result, the experimental capability `claude/channel` with the
value `{}`; its presence is what makes the client register a notification listener for it. It
then emits `notifications/claude/channel` (§9.3.4) when something happens. Any runtime and MCP
library that speaks this over stdio will do. <!-- req: channels.reference.What you need -->

| Option | Type | Rule |
| --- | --- | --- |
| `capabilities.experimental['claude/channel']` | object | Required, always `{}`. |
| `capabilities.experimental['claude/channel/permission']` | object or `false` | Optional. `{}` declares that the channel receives permission relay requests (§9.3.7). Omitting the key or setting it to `false` opts out; the client MUST treat `false` as not declared. |
| `capabilities.tools` | object | Two-way channels only, always `{}`: the standard MCP tool capability, so the client discovers the reply tool (§9.3.5). A one-way channel omits it. <!-- req: channels.reference.Server options.capabilities.tools --> |
| `instructions` | string | Recommended. The client delivers it to Claude as context when the server connects. It SHOULD say what events arrive, what the `<channel>` attributes mean, whether to reply, and through which tool with which attribute (such as `chat_id`). <!-- req: channels.reference.Server options.instructions --> |

### 9.3.4 Channel events

A channel event is the notification `notifications/claude/channel` with these params:

| Param | Type | Rule |
| --- | --- | --- |
| `content` | string | Required. The event body. |
| `meta` | object of string to string | Optional. Each entry becomes an attribute of the `<channel>` tag. A key MUST consist of letters, digits and underscores only; the client silently drops an entry whose key has any other character (Judgment J9.14 for a non-string value). |

The client MUST present the event to Claude as a `<channel>` element whose `source` attribute is the
server's configured name (for a plugin's channel its scoped name, such as
`plugin:fakechat:fakechat`, §8.5; `channels.md`, "Quickstart"), followed by one attribute per kept
`meta` entry, with `content` as its body:

```text
<channel source="ci-alerts" severity="high" run_id="1234">
build failed on main: https://ci.example.com/run/1234
</channel>
```

The transcript shows a one-line summary starting with `←`, such as `← webhook: <content>`, rather
than the element. The
client MUST NOT acknowledge a notification: the server learns only that it was written to the
transport. Events from a server the session has not registered as a channel, or that policy blocks,
are dropped silently with no error to the server. Events queue into the session and are processed
in order; those that arrive while Claude is busy are delivered together on the next turn, as one
group. <!-- req: channels.reference.Notification format -->

### 9.3.5 The reply tool

A two-way channel exposes an ordinary MCP tool through which Claude sends messages back; nothing in
its registration is channel-specific. It takes three parts: `tools: {}` in the server's
capabilities, `tools/list` and `tools/call` handlers that define and perform the tool, and
`instructions` (§9.3.3) that tell Claude when to call it and which tag attribute to pass back. The
client lists and calls the tool exactly as any MCP tool of the plugin (§8), under the same
permissions (§13). A channel that needs confirmation of delivery tracks it itself and reports it
through such a tool. <!-- req: channels.reference.Expose a reply tool -->

### 9.3.6 Gating inbound messages

An ungated channel lets anyone who reaches its endpoint put text in front of Claude. A channel that
listens to a chat platform or any endpoint others can reach MUST check each message's sender against
an allowlist before it emits a notification, and MUST drop a message from any other sender
silently. It MUST gate on the sender's identity, never on the chat or room: in a group the two
differ, and gating on the room would admit every member of an allowlisted group. How the allowlist
is filled — pairing by a code the user approves in the session, or the user's own addresses — is
the server's. <!-- req: channels.reference.Gate inbound messages -->

### 9.3.7 Permission relay

When a tool call needs the user's approval, a registered channel that declares
`claude/channel/permission` receives the same prompt in parallel with the local dialog. Only
tool-use approvals relay; project trust and MCP server consent dialogs appear only locally. The
client sends requests only to servers registered as channels for the session (§9.3.2) that declare
the capability.

The relay runs in four steps:

1. The client generates a request ID and sends the server
   `notifications/claude/channel/permission_request`.
2. The server forwards the prompt and its ID to the remote user.
3. The remote user replies with a yes or a no and the ID.
4. The server turns the reply into the verdict notification
   `notifications/claude/channel/permission` with params `request_id` (the ID) and `behavior`
   (`"allow"` or `"deny"`), sent instead of forwarding the reply as a chat message. The client
   applies a verdict only when its ID matches an open request; `allow` lets that one tool call
   proceed and `deny` rejects it, and neither affects later calls.

The local dialog stays open throughout, and the client applies whichever answer arrives first and
closes the other: an answer at the terminal drops the pending remote request. The client MUST drop
silently a verdict whose ID matches no open request, and, once an ID has been issued twice in a
session, every verdict carrying it. A server SHOULD accept `y`, `yes`, `n` or `no` followed by an ID
of the alphabet below, case-insensitively, and lowercase the ID it sends back. <!-- req: channels.reference.How relay works -->

The `params` of `permission_request` are four strings: <!-- req: channels.reference.Permission request fields -->

| Param | Rule |
| --- | --- |
| `request_id` | Five letters from `a`–`z` without `l`, so it is never misread as `1` or `I`. The local dialog does not show it, so the server MUST include it in its outgoing prompt for the reply to echo; the client accepts only a verdict carrying an ID it issued. <!-- req: channels.reference.Permission request fields.request_id --> |
| `tool_name` | The name of the tool Claude wants to use, such as `Bash` or `Write`. <!-- req: channels.reference.Permission request fields.tool_name --> |
| `description` | A human-readable summary of this call, never the command itself: for `Bash`, Claude's description of the command, or the constant `Run shell command` when the model gave none. <!-- req: channels.reference.Permission request fields.description --> |
| `input_preview` | The tool's arguments as JSON-shaped display text, keyed per top-level field: for `Bash` the command, for `Write` the path and content. The server decides how much of it to show. <!-- req: channels.reference.Permission request fields.input_preview --> |

Before relaying, the client MUST sanitise `description` and `input_preview`:

- neutralise direction-override characters, invisible characters, and quote and angle-bracket
  lookalikes;
- fold each run of whitespace to one space;
- keep a value of up to 3,500 code points whole, and for a longer one send its start and its end
  around a counted marker `⋯ N code points elided ⋯`; for `input_preview` the limit applies to each
  top-level field separately and the JSON's structural quotes are kept;
- put `(value unserializable)` in place of an `input_preview` field value it cannot serialise
  safely, keeping the key;
- replace a recognisable provider credential token with `[REDACTED]`, in key names as well as
  values, never masking a span that holds shell syntax, path characters or URL characters, so the
  command, path or destination being approved stays visible.

A secret without a recognisable prefix, or one spanning whitespace, reaches the server unmasked, so
a server MUST treat both fields as untrusted text. Because anyone who can reply through a channel
can approve tool calls, a server MUST NOT declare `claude/channel/permission` unless it gates
senders as §9.3.6 requires.

## Design decisions

### Why a language server file is skipped whole

A partial `.lsp.json` would route some extensions and silently not others; skipping the file and
reporting it makes the author fix the one mistake instead of chasing a missing language. The manifest
form fails the plugin instead, because the manifest is validated as a whole (§2.11).

### Why monitors refuse user configuration rather than quote it

A monitor command is parsed by a shell; a configured value holding `$(...)` or `;` would run as code.
Refusing the reference at the template, before any value exists, makes the failure visible to the
author on first run instead of to a user with an unusual token.

### Why channel registration needs the user's flag

A channel puts outside text in front of Claude and may approve tool calls. Installing a plugin is
consent to run its code, not to let a third party steer the session; the per-session flag, the
organisation's switch and the server's sender allowlist are three independent gates so that no one
of them failing open admits a stranger.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J9.1 | `command` is invalid when empty or when it holds any whitespace character and does not start with `/`. | The docs say "No spaces unless the value starts with `/`". Oracle 2.1.325 refuses `"gopls serve"` and `""` and accepts `"/opt/my dir/gopls"`; a tab could not be tested through the validator's JSON input, and any whitespace would split the command the same way. The reference implementation decides the same. |
| J9.2 | `maxRestarts` unset means unbounded restarts while `restartOnCrash` is true; it counts restarts already made, so `maxRestarts: 2` restarts after the first two crashes and leaves the server stopped after the third. | The docs say "Restart attempts before giving up, zero or more" and name no default. Oracle 2.1.325 accepts `0` and refuses `-1`. Lead: the reference implementation's J-L2. |
| J9.3 | `startupTimeout` unset means no startup deadline; when it elapses, the start fails as a start failure (§9.1.4 item 2) and counts toward restarts. | The docs name no default, unlike `requestTimeout`, and say of `shutdownTimeout` that unset means no timeout; the same reading is kept. |
| J9.4 | Registration order is plugin load order, then within a plugin the order in which a server name first appears across its sources (a replaced name keeps its first position), read as the keys of the parsed JSON objects: an integer-like name (`"9"`, `"10"`, a canonical array index) comes before the others, in ascending order, whatever its place in the file, as an ECMAScript object orders its keys. An extension matches case-sensitively at the end of the file's last path segment, a file name that is only the extension does not match, and the longest matching extension wins (`.d.ts` over `.ts`), the first registered among equals. Across plugins the warning names the server `<plugin>:<server>`. | The docs define "first registered" and "each file extension gets one server" but no order or matching. Lead: the reference implementation (`lsp-runtime.ts`). The integer-like rule is how a JSON object read into an ECMAScript object (`JSON.parse`, ECMA-262 OrdinaryOwnPropertyKeys) lists its keys: the written order of such names is not kept by the parse. |
| J9.5 | A named `lspServers` file is read like `.lsp.json`: invalid, it is skipped whole with `Invalid LSP server config for "<path>"` and the plugin loads; only the inline map fails the manifest. | The docs say `claude plugin validate` does not read `.lsp.json`. Oracle 2.1.325: it does not read a named file either (a named file with an unknown key validates), while the same entry inline fails. The table in §9.1.3 is oracle 2.1.325 output. |
| J9.6 | `settings` is sent once, after `initialized`, and again when the plugin reloads; unset, nothing is sent. `workspaceFolder` defaults to the project root. | The docs say only "Settings sent by `workspace/didChangeConfiguration`" and "Workspace folder path for the server". |
| J9.7 | When both keys are set, `experimental.monitors` is read and the top-level `monitors` ignored. An invalid monitors file is skipped whole and reported, the plugin loading otherwise; an invalid inline array fails the manifest. At runtime a repeated `name` keeps the first entry. | The docs give no precedence and no file-level failure rule. Oracle 2.1.325: the validator reports the top-level key as a warning, refuses an inline duplicate name (`Monitor names must be unique within a plugin`), an inline unknown key and a non-array, and does not read `monitors/monitors.json` or a named monitors file (both validate with an unknown key). |
| J9.8 | `when` is compared exactly (no trimming or case folding). `on-skill-invoke:<skill>` fires only for a skill of the monitor's own plugin, and `<skill>` may be written bare (`deploy`) or namespaced (`<plugin>:deploy`). | The docs' example writes the bare name; the docs say no more. Oracle 2.1.325 gives the two error messages quoted in §9.2.2. Lead: the reference implementation's J-L11. |
| J9.9 | A plugin reload does not start a second copy of a running `always` monitor; one that has stopped is started again by a reload. | The docs say `always` starts "at session start and on plugin reload" and that disabling does not stop running monitors; two copies of one watcher would duplicate every notification. Lead: J-L10. |
| J9.10 | "Non-interactive" covers every run without a person at it, not only `-p`: the Agent SDK and any headless run start no plugin monitor. | The docs name only `-p`; the reason (no one to see the task panel) holds for every headless run. Lead: J-L9. |
| J9.11 | The `${user_config.*}` refusal of a monitor is a runtime check only; a validator need not report it. | Oracle 2.1.325: a monitor whose `command` holds `${user_config.k}`, with `k` declared, validates. `errors.md` places the refusal at start. |
| J9.12 | A `channels` entry whose `server` names no MCP server of the plugin is reported as a plugin error and not registered; the plugin and its other channels load. | The docs say `server` "must match a key in `mcpServers`" without a failure rule. Oracle 2.1.325: the validator accepts such an entry (with or without any MCP server), so it is not a manifest failure; it fails only when the server's `env` references an option nobody declares. |
| J9.13 | For the bound server, the channel's `userConfig` options join the top-level ones, and a channel option wins over a top-level option of the same key; the options do not apply to other servers of the plugin. | The docs say the saved values substitute into the bound server's `env` and are silent on a shared key. Oracle 2.1.325's MCP check names "under `userConfig` (or in this server's `channels` entry)" as the places a reference is declared. |
| J9.14 | A `meta` entry whose value is not a string is dropped, like one whose key is not an identifier; a `meta` key `source` is dropped so the client's `source` stands; attribute values are escaped as XML attribute text. | The docs type `meta` as `Record<string, string>`, set `source` automatically, and say nothing of other values or quoting. |
| J9.15 | Installed Claude Code 2.1.325 was used as the oracle for the 2.1.321 contract. No difference was found in what this chapter states; the validator output in §9.1.3, §9.2.2 and these rows is 2.1.325's, and its messages may differ in wording from 2.1.321's. | `claude --version` reported 2.1.325; the 2.1.321 binary was not available. |
| J9.16 | The `LSP` tool's seven operations map to the standard requests `textDocument/definition`, `textDocument/references`, `textDocument/hover`, `textDocument/documentSymbol`, `workspace/symbol`, `textDocument/implementation`, and `textDocument/prepareCallHierarchy` with `callHierarchy/incomingCalls` and `callHierarchy/outgoingCalls`. | tools-reference.md names the operations in prose ("Jump to a symbol's definition", "Trace call hierarchies"), not the requests; these are the LSP 3.17 requests for them, and a language server a plugin configures answers only standard requests. |
| J9.17 | A monitor's path variables are written into `command` as paths and are not in its environment, even those `command` references; a client that wants a path kept from shell parsing MAY offer, as an option off by default, writing the reference and exporting the referenced variables instead, but its default is the pasted path (§9.2.4). | plugins/manifest-reference.md, "Where each variable resolves", gives monitor commands "Anywhere in `command`" and "Not exported", and "Quoting and path separators" has the author double-quote the variable in a monitor command, which only makes sense for a pasted path. An exported reference changes what a plugin observes: a single-quoted `'${CLAUDE_PLUGIN_ROOT}'` would stay unexpanded, and the variable would appear in the process environment. No oracle: monitors do not start under `-p`. |
