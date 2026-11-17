# 14. Managed policy

Managed settings are the settings an organization deploys to every machine. They form the highest
tier of the settings hierarchy (§12): no user, project, local or `--settings` value overrides them,
apart from the exceptions §12 lists, where a stricter lower value still counts. This chapter states
where managed settings come from, how a client composes several managed sources into one policy,
how it treats a managed value it cannot read, and which keys only a managed source can set. Two
further files of this chapter state the managed keys that govern plugins:

- [§14.8 Plugin policy](14-policy-org.md): requiring marketplaces and plugins, the marketplace
  allowlist and blocklist, seeds, the control matrix, update policy and the messages users read.
- [§14.9 Mods policy](14-policy-mods.md): the built-in guard, its options, the organization's own
  mods and their order.

Evidence: `managed-settings.md` and `server-managed-settings.md` unless a section names another page;
`settings-reference.md` for each key's entry. The keys' types follow the `Settings` type of
`@anthropic-ai/claude-agent-sdk` 0.3.321. MCP policy (`managed-mcp.json`, `managedMcpServers`,
`allowedMcpServers`, `deniedMcpServers`) is §8.11; permission rules and their locks are §13; settings
files and their merge are §12. This chapter does not repeat them.

## 14.1 Sources

### 14.1.1 Delivery mechanisms

1. A client MUST read managed settings from four mechanisms, each carrying the same keys in the
   shape of `settings.json`:

   | Mechanism | Delivered as | When the client reads it |
   | --- | --- | --- |
   | Server-managed | JSON saved in the claude.ai admin console, or served by a Claude apps gateway | Fetched at startup and polled hourly (§14.3) <!-- req: policy.managed.Choose a delivery mechanism.Server-managed settings --> |
   | MDM or OS-level policy | A macOS configuration profile or a Windows `HKLM` registry value | Read at startup, checked for changes every 30 minutes <!-- req: policy.managed.Choose a delivery mechanism.MDM or OS-level policy --> |
   | File-based | `managed-settings.json` and `managed-settings.d/` in a system directory | Read at startup, reloaded when a file changes <!-- req: policy.managed.Choose a delivery mechanism.File-based --> |
   | HKCU registry (Windows and WSL) | A Windows `HKCU` registry value | Read at startup, checked every 30 minutes; used only when no admin document is present above it (§14.2.2) and no parent settings supply a restrictive key (§14.2.6) <!-- req: policy.managed.Choose a delivery mechanism.HKCU registry, Windows and WSL --> |

   The MDM and file mechanisms are *endpoint-managed*: the policy is stored on the device. Every
   mechanism applies one policy to everyone it reaches; a per-group policy needs a different file or
   profile per group, or a gateway policy per group.
2. A few keys are tied to particular sources: the delivery controls `policyHelper` (§14.2.5),
   `wslInheritsWindowsSettings` (§14.2.7) and `managedSourcesBehavior` (§14.2.3), and the gateway
   login keys `forceLoginGatewayUrl`, `gatewayInternalNetworks` and the `"gateway"` value of
   `forceLoginMethod`. Each key's scope in the settings reference says which.

### 14.1.2 Where each mechanism stores the policy

| Mechanism | Store |
| --- | --- |
| Server-managed | Anthropic's servers or the gateway hold it; the client keeps a local cache, `~/.claude/remote-settings.json`, which it applies at startup and replaces on each successful fetch (§14.3.2). <!-- req: policy.managed.Where each mechanism stores the policy.Server-managed --> |
| macOS configuration profile | The managed preferences domain `com.anthropic.claudecode`, with the top-level keys of `managed-settings.json`, nested settings as dictionaries and lists as plist arrays. <!-- req: policy.managed.Where each mechanism stores the policy.macOS configuration profile --> |
| Windows HKLM registry | The whole JSON document as a `REG_SZ` or `REG_EXPAND_SZ` value named `Settings` under `HKLM\SOFTWARE\Policies\ClaudeCode`. <!-- req: policy.managed.Where each mechanism stores the policy.Windows HKLM registry --> |
| Windows HKCU registry | The same `Settings` value under `HKCU\SOFTWARE\Policies\ClaudeCode`. <!-- req: policy.managed.Where each mechanism stores the policy.Windows HKCU registry --> |
| File-based | `managed-settings.json`, an optional `managed-settings.d/` directory, and `managed-mcp.json` (§8.11.3) in the system directory below. <!-- req: policy.managed.Where each mechanism stores the policy.File-based --> |

The system directory, and the path of the managed settings file in it, is one per platform:

| Platform | `managed-settings.json` |
| --- | --- |
| macOS | `/Library/Application Support/ClaudeCode/managed-settings.json` <!-- req: policy.managed.Deploy a managed settings file.macOS --> |
| Linux and WSL | `/etc/claude-code/managed-settings.json` <!-- req: policy.managed.Deploy a managed settings file.Linux and WSL --> |
| Windows | `C:\Program Files\ClaudeCode\managed-settings.json` <!-- req: policy.managed.Deploy a managed settings file.Windows --> |

1. The client MUST NOT read the legacy Windows path `C:\ProgramData\ClaudeCode\managed-settings.json`.
2. Any of these files MAY be a symbolic link; the client reads its target. When the target lies
   outside the system directory, or the client cannot confirm that it stays inside, the policy still
   applies and `/status` and `claude doctor` show a warning naming the file.
3. **Drop-ins.** The client merges `managed-settings.json` first, then every `*.json` file of
   `managed-settings.d/` in alphabetical order, ignoring hidden files and files not ending in
   `.json`. When two files set one key: a single value is replaced by the later file's; lists
   concatenate with duplicates removed; nested blocks such as `env` and `sandbox` merge key by key by
   these same rules; `fallbackModel` and `modelPicker` are replaced whole; an `extraKnownMarketplaces`
   or `managedMcpServers` entry is replaced whole by a later entry of the same name (Judgment J14.1).
4. On one machine, `/status` run inside the client shows `Enterprise managed settings (file)` in its
   `Setting sources` line once the file applies (§14.5).

### 14.1.3 Where and when a policy applies

| Case | Rule |
| --- | --- |
| Surfaces | On the developer's machine, the terminal, the IDE extensions, the desktop app's Code tab and Agent SDK sessions read every source. An Agent SDK session loads managed settings even when `settingSources` excludes the user, project and local files. <!-- req: policy.managed.Where and when a policy applies.Surfaces --> |
| Cloud sessions | A session in an Anthropic-hosted environment reads no device profile or file: its policy comes from server-managed settings. A session in a self-hosted environment also reads the managed settings file of its runner image, by default only when server-managed settings deliver no policy key, apart from the cross-source keys (§14.2.4); `"merge"` (§14.2.3) applies both. <!-- req: policy.managed.Where and when a policy applies.Cloud sessions --> |
| Claude Tag sessions | They run in cloud environments but receive no server-managed settings; in a self-hosted environment they read the runner image's managed settings file. <!-- req: policy.managed.Where and when a policy applies.Claude Tag sessions --> |
| Cowork sessions | The client never fetches server-managed settings in a Cowork session, even for a Team or Enterprise sign-in. On the user's machine it reads that device's MDM policy and managed settings file; inside a full VM sandbox and on remote Cowork VMs there is no device policy to read. Wherever the session runs, claude.ai itself applies the console's `strictKnownMarketplaces` and `blockedMarketplaces` when someone adds a marketplace from a git repository on claude.ai or from **Customize** (§14.8.3). <!-- req: policy.managed.Where and when a policy applies.Cowork sessions --> |
| Running sessions | Most changes reach a running session on the schedule of §14.1.1 without a restart. `forceRemoteSettingsRefresh`, `requiredMinimumVersion` and some user-editable keys (§12) take effect at the next session start. A new or changed `policyHelper` takes effect at the next launch; when server-managed settings shadowed it at that launch, the helper runs as soon as a fetch reports those settings removed. <!-- req: policy.managed.Where and when a policy applies.Running sessions --> |
| Changes that need approval | A server-managed change to a setting that needs approval (§14.3.4), such as a hook or an `env` variable, waits for the developer to accept the dialog in an interactive session, and applies for the current run in a session an IDE extension or the Agent SDK hosts. Other server-managed changes apply on the next poll, apart from the updates that wait for the next launch (§14.3.2). <!-- req: policy.managed.Where and when a policy applies.Changes that need approval --> |
| Long-lived sessions | A session left open can lag a rollout: `requiredMinimumVersion` stops an outdated binary from starting and does not end a running session. <!-- req: policy.managed.Where and when a policy applies.Long-lived sessions --> |

## 14.2 Composing managed sources

### 14.2.1 Ranking

1. **Terms.** A *policy key* is any settings key other than the two control keys
   `wslInheritsWindowsSettings` and `managedSourcesBehavior`; a source holding only control keys
   does not count, and the client moves on to the next. An *admin source* is one of the first three
   sources below; the user-writable HKCU registry is not one.
2. The client ranks the sources, highest first:
   1. **Remote settings**: server-managed settings from claude.ai or a Claude apps gateway. The
      client fetches them only when the session authenticates to Anthropic's API directly with an
      eligible credential (§14.3.1), signs in to a gateway with `/login`, or runs in the desktop
      app's Code tab behind a gateway that serves that session settings. On another provider, or
      with `ANTHROPIC_BASE_URL` set elsewhere than Anthropic's API, it starts at the next source.
   2. **MDM or OS-level policy**: the macOS plist or the HKLM value.
   3. **Managed settings files**: `managed-settings.json` and `managed-settings.d/*.json` merged
      (§14.1.2).
   4. **HKCU registry**, on Windows, and on WSL once the Windows chain is on (§14.2.7) and the HKCU
      value also sets `wslInheritsWindowsSettings`. Read only when no admin document is present
      above it and no parent settings supply a restrictive key.
3. Within the managed tier, server-managed settings and endpoint-managed settings stand together
   above every other tier (§12); the ranking above decides between them. A `policyHelper` that the
   selected MDM or file source names and that emits settings replaces that source (§14.2.5). While
   server-managed settings deliver a policy key, the client does not consult a helper configured in
   MDM or file settings. When an organization clears its server-managed configuration, the cached
   copy (§14.3.2) applies until the next successful fetch, and keys that apply only at the next
   launch, such as `model`, stay until each client relaunches.
   <!-- req: policy.server.Settings precedence -->

### 14.2.2 When an admin document is present

The client never applies the HKCU registry beneath an admin document that is *present*. A document
is present when it sets any policy key to a value other than `null`, even one the client cannot
read, or when it is an HKLM value, a managed settings file or a `managed-settings.d` directory that
exists but cannot be read; a document whose only policy keys are `null` is not present. On WSL, `/etc/claude-code` is user-writable as well; §14.2.7 says when the
Windows documents stand above it.

### 14.2.3 `managedSourcesBehavior`

| Value | Behaviour |
| --- | --- |
| `"first-wins"` (default) | The client uses the highest-ranked source that delivers at least one policy key and ignores the others whole, apart from the cross-source keys (§14.2.4). It ignores a lower source's value even for a key the selected source leaves unset. It shows no warning for a skipped source; `/status` names it (§14.5). |
| `"merge"` | The client applies every admin source that delivers a policy key, combined by kind of key as below. |

1. The client reads `managedSourcesBehavior` only from the highest-ranked source that carries either
   this key or a policy key, and ignores it in every lower source, so a lower source cannot opt
   itself into merging with the one above. A machine that never receives server-managed settings
   needs the key in its MDM profile too. A `managed-settings.json` is the lowest admin source, so
   `"merge"` there has nothing below it to combine with. The HKCU registry and parent settings never
   take part in the merge. <!-- req: policy.key.managedSourcesBehavior | policy.managed.Keys only a managed source can set.managedSourcesBehavior -->
2. Under `"merge"` the client combines each key by its kind:

   | Kind | Rule | Keys |
   | --- | --- | --- |
   | Lists | Entries from every source combine | `permissions.allow`, `hooks`, `sandbox.network.allowedDomains`, `deniedMcpServers`, `deniedModels` and other list keys |
   | Locks | The strictest value any source sets applies; a looser value applies only from the highest source | `allowManagedHooksOnly`, `allowManagedPermissionRulesOnly`, `permissions.disableBypassPermissionsMode`, `crossSessionInbound`, `availableModelsMatch` and other boolean or enum locks |
   | Restriction allowlists | Taken whole from the highest source that sets one, never adding a lower source's entries | exactly `availableModels`, `allowedMcpServers`, `allowedProviders`, `strictKnownMarketplaces`, `allowedChannelPlugins` and the `fallbackModel` chain |
   | Values taken whole | Taken whole from the highest source that sets it | exactly `sandbox.credentials.awsPairs` and `sandbox.ripgrep` |
   | Provided MCP servers | Names from every source combine; for a shared name the higher source's whole entry applies | `managedMcpServers` |
   | Read from the highest source only | Read only from the highest source that carries a policy key, even when it leaves the key unset | exactly `apiKeyHelper`, `awsAuthRefresh`, `awsCredentialExport`, `gcpAuthRefresh`, `otelHeadersHelper`, `proxyAuthHelper`, `parentSettingsBehavior`, `modelPicker`, `policyHelper`, `permissions.defaultMode` |
   | `env` | Per variable across admin sources, under either value (§14.2.4) | `env` |
   | Login keys | From the MDM policy or managed settings file, ahead of remote settings (§14.2.4) | `forceLoginOrgUUID`, `forceLoginMethod`, the gateway login keys |
   | Every other key | The highest source that sets it | `model`, `cleanupPeriodDays` |

   Further conditions: `policyHelper` is honoured only when the highest source carrying a policy key
   is an MDM policy or a managed settings file; `modelOverrides` is taken from the highest source
   that sets it unless a higher source sets `availableModels` without it, in which case no source's
   `modelOverrides` applies; `allowedProviders` is further limited by the machine's own list.
3. Under `"merge"` a lower source's list entries, such as `permissions.allow` rules and hooks, join
   the policy, so an organization SHOULD set it only where every source below its highest one is
   under an administrator's control.

### 14.2.4 Keys read from every admin source

Under `"first-wins"` most keys come only from the selected source. These keys the client reads from
every admin source, so a lower MDM policy or file still sets them when the selected source does not;
the HKCU registry stays out of the scan, except that when HKCU is the only source and no host
supplies parent settings it applies like any selected source:

- `sandbox.network.allowManagedDomainsOnly` and `sandbox.filesystem.allowManagedReadPathsOnly`: a
  `true` in any admin source turns the lock on, and while it is on the allowlist it locks
  (`sandbox.network.allowedDomains` with `WebFetch(domain:...)` allow rules, or
  `sandbox.filesystem.allowRead`) is the union across admin sources; without the lock the allowlist
  is an ordinary key.
- `allowAllClaudeAiMcps`, `allowManagedMcpServersOnly`, `deniedMcpServers` and
  `disableClaudeAiConnectors` (§8.11).
- The sandbox binaries `sandbox.bwrapPath`, `sandbox.socatPath`, `sandbox.ripgrep`, and
  `sandbox.filesystem.disabled` and `sandbox.network.strictAllowlist`.
- `useAutoModeDuringPlan`, `syncClaudeAiSkills` and `syncClaudeAiPlugins`: a `false` from any admin
  source turns the behaviour off, and a `false` in the developer's user or local settings does too;
  each key can only deny. For `useAutoModeDuringPlan`, a `false` in a user or local file the session
  leaves out (`--setting-sources`) does not count.
- `enableArtifact`: a `false` from any admin source, or from user, project or local settings, turns
  the Artifact tool off and no source turns it back on.
- `maxEffortLevel`: the lowest cap of any admin source, or a lower one the developer sets, applies.
- A commit-trailer opt-out in `attribution` (or `includeCoAuthoredBy`) from any tier.
- `forceRemoteSettingsRefresh` (§14.3.3).
- `env`, per variable: each variable comes from the highest admin source that defines it, lower
  sources filling the variables higher ones leave unset, with the exceptions of §14.3.5.

`allowedProviders` has its own combination rule (§14.3.5). When an admin source sets
`allowManagedMcpServersOnly` or an `allowedMcpServers` list whose value is not the one in force,
`/status` and `claude doctor` name that source and key.

**Login keys.** On a machine with an MDM policy or a managed settings file, the client takes the
login keys from it, even for a key remote settings also set. With both, it uses the MDM policy: when
that policy sets any policy key, the file's login keys are ignored, under `"merge"` too.
`forceLoginOrgUUID` and the `"claudeai"` and `"console"` values of `forceLoginMethod` fall back to
remote settings when the endpoint source omits them; the gateway login keys are never read from
remote settings.

### 14.2.5 `policyHelper`

A `policyHelper` is an executable that computes managed settings at startup.
<!-- req: policy.managed.Compute the policy with a helper program -->

1. **Scope.** The client reads `policyHelper` from the macOS plist, the HKLM value or the managed
   settings file, from the highest-ranked source carrying a policy key, and runs the helper only when
   that source is one of those three. It ignores the key in server-managed settings, in HKCU and in
   parent settings; when server-managed settings deliver the policy at launch the helper does not
   run. <!-- req: policy.key.policyHelper | policy.managed.Keys only a managed source can set.policyHelper -->
2. **Shape.** An object:

   | Field | Type and default |
   | --- | --- |
   | `path` | Required. An absolute path in normalized form, with no `.` or `..` segment; on Windows a drive-letter or UNC path ending in `.exe`. <!-- req: policy.key.policyHelper.path --> |
   | `timeoutMs` | Integer milliseconds, at least `1000`; default `10000`. A run still going when it elapses fails. <!-- req: policy.key.policyHelper.timeoutMs --> |
   | `refreshIntervalMs` | Integer milliseconds, `0` (no refresh) or at least `60000`; unset runs the helper once at startup. A successful refresh replaces the managed settings without a restart; a failed one keeps the last policy, and `/status` shows the failing refresh and its reason until one succeeds. <!-- req: policy.key.policyHelper.refreshIntervalMs --> |

   An invalid value, such as a bare path string or a `timeoutMs` below its minimum, is reported as a
   dropped entry (§14.4) and the session starts on the remaining managed settings without a helper.
3. **Running.** The client runs the helper with no arguments and `CLAUDE_CODE_VERSION` in its
   environment, before it accepts the first prompt, and reads one JSON object from stdout, capped at
   1 MiB. The settings go under `managedSettings`; an envelope without that key applies nothing,
   with no error, and the other sources apply as usual; other envelope keys are ignored (Judgment J14.4). With `--debug` the helper's stderr from
   every run goes to the debug log. <!-- req: policy.reference.Write the helper output -->
4. **Effect.** When the helper emits `managedSettings`, that object is the only managed settings of
   the session: the client ignores the MDM, file and HKCU sources, reads the cross-source keys
   (§14.2.4) from the helper's output alone, and never merges parent settings, whatever
   `parentSettingsBehavior` says. The exception is `forceRemoteSettingsRefresh`, whose startup check
   runs before the helper and reads every admin source.
5. **Failures.** A run fails when `path` breaks the rules above; no regular file is at `path`
   (checked within the same `timeoutMs`); the helper exits non-zero, times out or cannot start; it
   writes more than 1 MiB to stdout or stderr; or stdout is not a single JSON object, or its
   `managedSettings` has a schema violation the entry repairs of §14.4 cannot fix. A failed startup
   run prints the reason and the client refuses to start: interactive sessions, `claude -p`, Agent
   SDK sessions, background sessions and most subcommands. After a non-zero exit the reason carries
   the helper's stderr, or its stdout when stderr is empty; after a timeout it names the `timeoutMs`
   limit and carries no output. A helper that needs resilience SHOULD serve from its own cache and
   exit `0`. When a later fetch reports server-managed settings removed, the client runs the helper
   then; its output governs the rest of the session, and a failed run there ends the session with
   the startup message. To turn a helper off, the organization removes the key.
   <!-- req: policy.reference.Helper failures -->

### 14.2.6 Parent settings from an embedding host

An application that launches the client, such as Claude Desktop, an IDE extension or an Agent SDK
application, MAY pass its own managed settings through the SDK `managedSettings` option: *parent
settings*. <!-- req: policy.managed.Let an embedding host add policy -->

1. By default the client ignores parent settings whenever an admin source is present (server-managed,
   MDM or a managed settings file). With no admin tier, parent settings are the only managed tier,
   filtered to restrictive values.
2. `parentSettingsBehavior`, read from the highest-priority admin source only, is `"first-wins"`
   (default: drop parent settings while an admin tier exists) or `"merge"` (apply them under the
   admin tier through a restrictive-only filter). Under `"merge"` the host's permission allow rules
   and sandbox allowlists still apply unless the `allowManaged*Only` locks are set. A `policyHelper`
   that emits settings turns parent merging off. <!-- req: policy.key.parentSettingsBehavior | policy.managed.Keys only a managed source can set.parentSettingsBehavior -->
3. Whatever the key says, the client applies these checks to parent-supplied values:
   - When any admin source sets `allowManagedPermissionRulesOnly`, parent allow rules and
     `additionalDirectories` are dropped as they are read, even when a higher source leaves the key
     unset (§13).
   - The `forceLoginOrgUUID`, `allowedMcpServers`, `availableModels` and `strictKnownMarketplaces`
     of the applied managed settings are enforced and a parent-supplied one is blocked; the parent's
     list applies only when no applied managed source sets one. While `allowManagedMcpServersOnly`
     is on, the list of the highest admin source that sets one blocks the parent's.
   - An `allowedProviders` list in the selected source, or under `"merge"` in any admin source,
     blocks the parent's.
   - A parent-supplied `blockedMarketplaces` applies in addition to every managed blocklist.
4. **Folder grants under managed rules only.** Cowork grants a session its working folders through
   allow rules it supplies at launch. Under `allowManagedPermissionRulesOnly` those rules are dropped,
   whether they come as parent settings, `--allowedTools` or a settings file, so writes there lose
   their pre-approval; in a session that asks before edits Cowork cannot show the prompt, and each
   write is reported as blocked. An
   organization restores them by putting allow rules for those folders, such as
   `Edit(~/CoworkProjects/**)`, in the managed source the client selects on those machines (the MDM
   policy on an MDM-managed fleet). <!-- req: policy.managed.Keep Cowork folder access when only managed rules apply -->

### 14.2.7 `wslInheritsWindowsSettings`

1. On WSL, `true` makes the client read the Windows policy chain: HKLM and the Windows managed
   settings file rank above `/etc/claude-code`, and HKCU below it. While the chain is on,
   `/etc/claude-code` applies only when no Windows admin document is present in the HKLM value or
   `C:\Program Files\ClaudeCode\`. `false`, the default, reads only `/etc/claude-code`. The key has
   no effect on native Windows.
2. The client honours it only from the HKLM value or a managed settings file or drop-in under
   `C:\Program Files\ClaudeCode\`. Once an admin source turns the chain on, HKCU joins it only when
   HKCU also sets the key to `true`; that copy never turns the chain on alone. A Windows source that
   holds only this key, `true` or `false`, is not a policy source.
3. `true` and `false` are read with or without quotes, and `null` removes the key. An admin Windows
   source holding any other value counts as a present admin document with the chain on: neither
   `/etc/claude-code` nor HKCU applies, and a startup warning names the key. An HKLM value or
   Windows-folder file that exists but cannot be read keeps `/etc/claude-code` from applying whether
   or not the chain is on. <!-- req: policy.key.wslInheritsWindowsSettings | policy.managed.Keys only a managed source can set.wslInheritsWindowsSettings -->

## 14.3 Server-managed settings

### 14.3.1 Eligibility and configuration

1. Server-managed settings are for claude.ai Team and Enterprise organizations; an Owner or Primary
   Owner edits them as JSON. The console checks the JSON against the published settings schema and
   only warns; the client runs its own validation on load (§14.3.6).
2. The client fetches them only over a direct connection to `api.anthropic.com` (or from a gateway it
   is signed in to), and only for a Team or Enterprise OAuth login, a `CLAUDE_CODE_OAUTH_TOKEN`, a
   directly configured API key, or a `user_oauth` Anthropic profile whose `base_url` is Anthropic's
   API. A key from `apiKeyHelper` and Workload Identity Federation credentials do not trigger the
   fetch. A session receives the settings of the organization that owns its credential; a Console
   API key belongs to a separate Console organization. A `CLAUDE_CODE_USE_*` provider variable or a
   non-default `ANTHROPIC_BASE_URL` in the shell skips the fetch; neither a server-managed nor an
   endpoint-managed `env` block undoes that, since eligibility is checked first; an empty value in
   the user settings `env` does.
3. **Limitations.** Settings apply to every user of the organization: there is no per-group
   configuration. `managed-mcp.json` cannot be delivered this way; `allowedMcpServers`,
   `deniedMcpServers` and `managedMcpServers` can, and a `managed-mcp.json` at its system path still
   applies beside them (§8.11). Keys restricted to OS-level sources, `policyHelper` and
   `wslInheritsWindowsSettings`, are not honoured from server-managed settings.
   <!-- req: policy.server.Current limitations -->
4. Every other key a settings file accepts is accepted here: hooks, `env` and the managed-only keys
   of §14.7 included.
   <!-- req: policy.server.Managed-only settings -->

### 14.3.2 Fetch and cache

1. The client fetches at startup and polls hourly; the fetch sends `Cache-Control: no-cache`. A
   gateway client fetches from the gateway and waits for it before the session starts.
2. **First launch, no cache.** When the developer signs in at startup, the client waits up to five
   seconds for the fetch; a policy that arrives in time applies from the first screen, and one that
   needs approval ends the wait and applies once approved. Otherwise the session opens while the
   fetch continues. A failed fetch continues without server-managed settings, with a warning in
   interactive sessions and the Code tab; endpoint-managed settings still apply. Under
   `forceRemoteSettingsRefresh` the client exits instead (§14.3.3). For a Team or Enterprise claude.ai
   login stored on the machine, Anthropic MAY require the organization's settings before a session
   starts; the session then cannot start while the sign-in has expired, or while the client has
   neither the settings nor a recent cache, whatever items 2 and 3 say.
3. **Later launches.** The cache applies at startup, except: a cached `modelPricing` and a cached
   `managedMcpServers` (§8.11.4) wait until the session's fetch confirms the payload; withheld `env`
   variables (item 4) wait too; a cached `prependPlugins`, `appendPlugins` or `enabledPlugins` cannot
   remove, move or turn off the built-in guard (§14.9) until confirmation; and where an
   endpoint-managed source lists or enables plugins of its own, a plugin that only a cached list
   enables counts as the user's until confirmation. The cache survives network failures, with a
   warning; values withheld at startup stay withheld until a fetch succeeds.
4. **Withheld variables.** Until confirmation the client withholds from the cached `env` the proxy
   and TLS variables, API routing and provider selection, authentication credentials,
   `CLAUDE_CONFIG_DIR`, the Workload Identity Federation variables, `ANTHROPIC_PROFILE`,
   `ANTHROPIC_CONFIG_DIR`, `HOME`, `XDG_CONFIG_HOME`, `APPDATA` and `USERPROFILE`. Endpoint-managed
   `env` blocks are not withheld, and per variable they fill what the withheld cache leaves unset.
5. Most updates apply to a running session; OpenTelemetry exporter configuration, `model` and the
   removal of an `env` variable apply at the next launch.
6. A user who edits the cache gets the tampered file at startup, minus withheld values, until the
   next fetch restores it; one who deletes it gets first-launch behaviour. Server-managed settings
   are a client-side control, not a security boundary.

### 14.3.3 `forceRemoteSettingsRefresh`

1. `true` blocks startup until server-managed settings are freshly fetched, and exits if the fetch
   fails, rather than starting on a cached or absent policy. The client honours a `true` from any
   admin source, even one that is not the selected source, and even when a cached server payload is
   present; set in an MDM profile or managed settings file it enforces fail-closed startup before the
   first payload arrives. Once delivered from the server it is cached, so later startups enforce it
   before their first fetch. Default `false`. <!-- req: policy.key.forceRemoteSettingsRefresh | policy.managed.Keys only a managed source can set.forceRemoteSettingsRefresh -->
2. The check applies only in sessions that fetch server-managed settings; a session that does not
   (§14.3.1) starts without waiting. The `claude auth` subcommands are exempt, so a user can sign in
   again when an expired credential is why the fetch fails. When a `policyHelper` emits settings, its
   output replaces the other managed sources for keys read after startup, but this startup check
   still reads every admin source.
3. A gateway client waits for its startup fetch whether or not the key is set. When the gateway
   answers an attended interactive launch with `401` and the key is off, the client prints `Cloud
   gateway session expired — run /login to reconnect.` and opens signed out of the gateway; any other
   failure, or any other launch but a `claude auth` subcommand, exits with an error.
   <!-- req: policy.server.Enforce fail-closed startup -->

### 14.3.4 Security approval dialogs

1. In an interactive session the client MUST ask the user to approve a delivered payload that holds
   any of these before applying it, and MUST exit when the user rejects it:

   | Category | Settings |
   | --- | --- |
   | Shell command settings | Settings that run a command, such as `apiKeyHelper`, `statusLine` and `otelHeadersHelper`. <!-- req: policy.server.Security approval dialogs.Shell command settings --> |
   | Sandbox binary settings | `sandbox.bwrapPath`, `sandbox.socatPath` and `sandbox.ripgrep`, each naming an executable the client runs. <!-- req: policy.server.Security approval dialogs.Sandbox binary settings --> |
   | Sandbox network and isolation settings | `sandbox.network.tlsTerminate`, `sandbox.network.httpProxyPort`, `sandbox.network.socksProxyPort`, `sandbox.credentials` (unless it holds only `deny` rules), `sandbox.allowAppleEvents`, `sandbox.allowNestedUserNamespaces`, `sandbox.enableWeakerNestedSandbox`, `sandbox.enableWeakerNetworkIsolation`, `sandbox.filesystem.disabled`, `sandbox.network.allowAllUnixSockets`, `sandbox.network.allowUnixSockets` and `sandbox.network.allowMachLookup`. An approval of `sandbox.credentials` or `sandbox.network.tlsTerminate` also covers the payload's `sandbox.network.allowedDomains`, and a change to those entries asks again. <!-- req: policy.server.Security approval dialogs.Sandbox network and isolation settings --> |
   | Custom environment variables | Delivered `env` variables that need approval: a proxy or base-URL variable, `OTEL_EXPORTER_OTLP_ENDPOINT` and `CLAUDE_CODE_DISABLE_1M_CONTEXT` at any non-empty value; `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`, `DISABLE_ERROR_REPORTING`, `DISABLE_TELEMETRY`, `DO_NOT_TRACK` and `API_FORCE_IDLE_TIMEOUT` at a non-truthy non-empty value; `ENABLE_BETA_TRACING_DETAILED` and `OTEL_LOG_RAW_API_BODIES` at a non-falsy non-empty value; an `ANTHROPIC_CUSTOM_HEADERS` line naming a credential, tenant selector, routing or host override or API-behaviour header (matched by words inside the name), or one that is not a valid header. Feature toggles, model and compaction settings, UI options and numeric limits apply without approval. The dialog names each variable. <!-- req: policy.server.Security approval dialogs.Custom environment variables --> |
   | Hook configurations | Any hook definition. <!-- req: policy.server.Security approval dialogs.Hook configurations --> |

   A managed `claudeMd` needs no approval.
2. **Approval memory.** The client records the approval in its configuration directory: one per
   organization for a claude.ai or keyless Console sign-in, held by the account that approved most
   recently (another account of the same organization is asked again); one per gateway for a gateway
   sign-in (asked again when the approved settings change, for another gateway, or a new certificate;
   never saved for a loopback plain-HTTP gateway); and for any other credential one approval kept
   with the cache, asked again when the approved settings change and after `/logout`, which deletes
   the cache.
3. **When no dialog can be shown.** An interactive session that cannot show it, or an error that
   closes it, keeps the last-approved settings and asks in the next session that can. `claude
   install` and `claude update` run with the last-approved settings and show nothing, unless the
   client waits for the fetch at startup (`forceRemoteSettingsRefresh`, a gateway), when it shows the
   dialog during the command. A `claude plugin` command that prints to a terminal but cannot read the
   keyboard does not apply the delivered settings; without a cache, one that changes plugins or
   marketplaces stops with an error. A non-interactive run (`claude -p`, the Agent SDK, the IDE chat
   panel, the Code tab) applies settings that would need approval for that run only, records no
   approval, writes no cache, and fetches again at its next start.

### 14.3.5 Per-key exceptions across managed sources

| Exception | Rule |
| --- | --- |
| Cross-source lock keys | The keys of §14.2.4 are honoured from any admin source, HKCU excluded; a `policyHelper`'s output is the only source they read, apart from `forceRemoteSettingsRefresh`. <!-- req: policy.server.Per-key exceptions across managed sources.Cross-source lock keys --> |
| The `env` block | Merged per variable across admin sources: the highest source defining a variable wins, lower ones fill the rest, so an endpoint `env` entry applies whenever the server payload leaves it unset or withholds it. Two units are exceptions: the telemetry unit (`OTEL_EXPORTER_OTLP_*`, `OTEL_LOG_*`, `OTEL_LOGS_EXPORTER`, `ENABLE_BETA_TRACING_DETAILED`, `BETA_TRACING_ENDPOINT`) comes whole from the highest source that sets any of them, and a source delivering `otelHeadersHelper` claims it but fills it only when selected; routing variables paired with a selected-source-only credential key such as `apiKeyHelper` come only from the source that wins that key. An exporter endpoint never pairs with another source's credentials. <!-- req: policy.server.Per-key exceptions across managed sources.The env block --> |
| `allowedProviders` | A list set on the machine and a server-managed list combine as the key's entry states: the machine's own list still limits the result. <!-- req: policy.server.Per-key exceptions across managed sources.allowedProviders --> |
| First-party sign-in keys | `forceLoginOrgUUID` and the `"claudeai"` and `"console"` values of `forceLoginMethod` come from the MDM policy or file when one sets them, otherwise from remote settings (§14.2.4). <!-- req: policy.server.Per-key exceptions across managed sources.First-party sign-in keys --> |
| Gateway sign-in keys | `forceLoginGatewayUrl`, `gatewayInternalNetworks` and the `"gateway"` value of `forceLoginMethod` are never read from server-managed settings, so a value there neither applies nor hides an endpoint one; the highest admin source on the machine carrying a policy key supplies them. <!-- req: policy.server.Per-key exceptions across managed sources.Gateway sign-in keys --> |

### 14.3.6 Invalid entries in delivered settings

1. A payload with invalid parts applies every valid setting and reports the rest, as §14.4 says,
   with these additions. <!-- req: policy.server.Invalid entries in delivered settings -->
2. A startup on the cache treats invalid entries as the fetch that wrote it did: dropped entries
   stay dropped, fail-closed keys keep their stricter values, and an invalid `cleanupPeriodDays` or
   `desktopSessionCleanupPeriodDays` stays in the cache unapplied.
3. When every setting of a payload fails, none falls back to a stricter value, and the payload holds
   a key other than those two retention keys, the client applies nothing and leaves the cache
   unchanged; the startup notice, `/status` and `claude doctor` report the failed load with the cause
   `no setting in the server response could be applied as written`, and a client under
   `forceRemoteSettingsRefresh` exits instead.
4. The approval dialog evaluates the salvaged payload, so a stripped entry is never shown for
   approval and never runs.

## 14.4 Values the client cannot read

### 14.4.1 Documents that do not parse or cannot be read

1. A managed settings file, drop-in file, MDM plist or HKLM value that is present but does not parse
   as a JSON object makes the client refuse to start, printing an error naming the source, even when
   another admin source delivers a valid policy. A file fails when it is not valid JSON or its top
   level is not an object; a plist when `plutil` reports it malformed or its converted content is not
   an object; an HKLM value when `Settings` is not a string, is empty, or holds no JSON object.
2. These states do not refuse: an absent file, profile or value (the client runs without it); an
   empty managed settings file, which counts as `{}`; a malformed HKCU value, reported as a notice in
   `/status` and `claude doctor`.
3. A document that exists but cannot be read, while no admin source supplies a policy: when the
   operating system denied the read, every session starts without that source, `/status` and
   `claude doctor` record it, and `-p` also prints it to stderr; for any other failure, such as an
   I/O error, every session exits at startup with a message to contact an administrator.

### 14.4.2 Entries that fail validation

1. When a managed document fails schema validation, the client first skips each entry it can repair,
   such as one invalid permission rule, with a warning for each, then drops each value that still
   fails, unless its key fails closed (§14.4.3). A `policyHelper`'s output gets the same repairs, but
   a violation that survives fails the whole run (§14.2.5).
   <!-- req: policy.managed.Find entries Claude Code dropped -->
2. An interactive session shows the invalid entries in a dialog at startup; `-p` prints a summary to
   stderr; `claude doctor` lists each with its source and field. The client reports a source's
   failure by its kind: <!-- req: policy.managed.Find entries Claude Code dropped.Managed settings file or drop-in file | policy.managed.Find entries Claude Code dropped.MDM plist | policy.managed.Find entries Claude Code dropped.HKLM registry value -->

   | Source | Refuses to start when |
   | --- | --- |
   | Managed settings file or drop-in file | Not valid JSON, or the top level is not an object |
   | MDM plist | `plutil` reports it malformed, or the converted content is not an object |
   | HKLM registry value | `Settings` is not a string, is empty, or holds no JSON object |

3. This tolerance is the managed tier's only. User, project and local files stay strict: a file
   whose JSON or top-level shape fails is rejected whole, and a failing entry is skipped while the
   rest applies (§12).

### 14.4.3 Keys that fail closed

1. A managed top-level key with a single restrictive value, such as `allowManagedPermissionRulesOnly`,
   `disableAutoMode` or `skipDangerousModePermissionPrompt`, set to a value the client cannot read,
   reads as that restrictive value until fixed; the report says the key `was present but invalid`
   and names the value used. A `null` removes the key. The string `"true"` or `"false"` of a Boolean
   key reads as that Boolean, with a notice in `/status` to drop the quotes. An invalid
   `disableAllHooks`, a quoted Boolean included, is dropped with a warning, since enforcing `true`
   would unload the organization's own managed hooks. `requiredMinimumVersion` and `requiredMaximumVersion` fail
   open: an invalid value is dropped. <!-- req: policy.managed.Keys that fail closed -->
2. The `permissions`, `autoMode`, `worktree` and `attribution` blocks are repaired per field: a lock
   inside reads as its restrictive value; an invalid `permissions.defaultMode` reads as `default`;
   while the `permissions` object cannot be read, `permissions.blockWritesOutsideWorkingDirectories`
   is on (§13.12.2); while a `deny` or `ask` list cannot be read, `allow` and `additionalDirectories`
   are withheld, and in `autoMode` an unreadable or damaged `soft_deny` or `hard_deny` withholds `allow` and
   `environment`, the report naming each withheld grant and the list that could not be read.
3. These keys have their own fallback:

   | Key | When present but invalid |
   | --- | --- |
   | `allowedMcpServers` | Enforced as an empty allowlist; `managedMcpServers` and `managed-mcp.json` servers still load as §8.11.5 says; an invalid entry is stripped and the rest enforced. <!-- req: policy.managed.Keys that fail closed.allowedMcpServers --> |
   | `allowedProviders` | Enforced as an empty allowlist, so every provider is refused and the client does not start; an entry that is not a known provider is dropped and reported. <!-- req: policy.managed.Keys that fail closed.allowedProviders --> |
   | `allowedHttpHookUrls` | An empty managed allowlist is enforced; an HTTP hook runs only if another settings file lists its URL; an invalid entry is stripped. <!-- req: policy.managed.Keys that fail closed.allowedHttpHookUrls --> |
   | `httpHookAllowedEnvVars` | An empty managed allowlist is enforced; a header variable is interpolated only if another file names it; an invalid entry is stripped. <!-- req: policy.managed.Keys that fail closed.httpHookAllowedEnvVars --> |
   | `allowedChannelPlugins` | An empty allowlist is enforced: no channel plugin passed to `--channels` registers; an invalid entry is stripped. <!-- req: policy.managed.Keys that fail closed.allowedChannelPlugins --> |
   | `strictKnownMarketplaces` | An empty allowlist is enforced: no marketplace source is admitted. An entry that is invalid or cannot be enforced, such as a `hostPattern` that does not compile, is stripped and the rest enforced. <!-- req: policy.managed.Keys that fail closed.strictKnownMarketplaces --> |
   | `availableModels` | An empty allowlist: only the Default model; a non-string entry is stripped. <!-- req: policy.managed.Keys that fail closed.availableModels --> |
   | `availableModelsMatch` | Read as `exact`. <!-- req: policy.managed.Keys that fail closed.availableModelsMatch --> |
   | `forceLoginOrgUUID` | No organization may log in. <!-- req: policy.managed.Keys that fail closed.forceLoginOrgUUID --> |
   | `gatewayInternalNetworks` | From the highest managed source, `/login` refuses every new cloud gateway sign-in on the machine. <!-- req: policy.managed.Keys that fail closed.gatewayInternalNetworks --> |
   | `crossSessionInbound` | Read as `refuse`; the developer sees a warning. <!-- req: policy.managed.Keys that fail closed.crossSessionInbound --> |
   | `deniedMcpServers` | An invalid entry is stripped; a wholly invalid value is dropped with a warning. <!-- req: policy.managed.Keys that fail closed.deniedMcpServers --> |
   | `deniedModels` | A non-string entry is stripped; a wholly invalid value is dropped with a warning and blocks nothing. <!-- req: policy.managed.Keys that fail closed.deniedModels --> |
   | `blockedMarketplaces` | An invalid entry is stripped. An entry that parses but can never match, such as a `hostPattern` that does not compile, is kept with a warning: it blocks nothing, but the marketplace restriction stays active (§14.8.3). A wholly invalid value is dropped with a warning. <!-- req: policy.managed.Keys that fail closed.blockedMarketplaces --> |
   | `sandbox` | Validated per field (§14.4.4); never dropped whole. <!-- req: policy.managed.Keys that fail closed.sandbox --> |
   | `sandbox.credentials` | A recoverable invalid entry degrades to `mode: "deny"` with a warning; an unrecoverable one is stripped; valid entries stay. <!-- req: policy.managed.Keys that fail closed.sandbox.credentials --> |
   | `strictPluginOnlyCustomization` | Read as `true`, locking all four surfaces, when it is neither a Boolean nor an array. An array entry that is not a known surface locks nothing, and a status note counts such entries. <!-- req: policy.managed.Keys that fail closed.strictPluginOnlyCustomization --> |
   | `enabledPlugins` | An invalid entry is dropped with a warning and the others stay enforced; a value that is not a map of plugin ids, or whose every entry is invalid, is dropped whole with a warning. <!-- req: policy.managed.Keys that fail closed.enabledPlugins --> |

   `allowedHttpHookUrls` and `httpHookAllowedEnvVars` merge across settings files, so user, project
   and local entries still apply while the managed list is empty.

### 14.4.4 Invalid values inside `sandbox`

Each field of a managed `sandbox` block is validated alone; the warning names the field and its
fate. A quoted Boolean counts as that Boolean, with a notice. An invalid `failIfUnavailable` is
dropped, never read as `true`. Every other invalid Boolean reads as the strictest value: one that
turns the sandbox or a restriction on (`enabled`, `network.allowManagedDomainsOnly`) as `true`, one
that loosens it (`allowUnsandboxedCommands`) as `false`. In a list outside `credentials` an invalid
entry is dropped; a list that is not an array, or whose entries were all invalid, does not apply;
an empty list is a valid value and applies (Judgment J14.15). While
`network.deniedDomains` or an entry of it is invalid, `network.allowedDomains` is withheld; while
`filesystem.denyRead` or `filesystem.denyWrite` or an entry of either is invalid, both
`filesystem.allowRead` and `filesystem.allowWrite` are withheld.
<!-- req: policy.managed.Invalid values inside sandbox -->

## 14.5 Checking that a policy is in force

1. `/status` shows a `Setting sources` line listing `Enterprise managed settings` with the selected
   source: `(remote)`, `(plist)` or `(HKLM)`, `(file)`, `(drop-ins)` or `(file + drop-ins)`, a list
   ending in `, merged` under `"merge"`, its sources in ranking order (Judgment J14.3; a lower source
   can still supply `env` variables without appearing), `(HKCU)`, `(parent process)`, or `(helper)`. A `Skipped sources` line names each
   managed source found and not selected.
2. No such line means no source delivers a policy key. A file that is not valid JSON never produces
   this state; the client refuses to start (§14.4.1). For server-managed settings, `claude doctor`'s
   `Managed settings (remote)` line reports whether the payload loaded, the organization has none,
   the fetch failed (with the cause and whether a cache applies), or the fetch was skipped (with the
   reason); `/status` shows it after a failed fetch and for some skip causes.
3. `claude doctor` shows an `Organization policy` line for the console's organization settings, such
   as Remote Control and cloud sessions; `/status` shows it when that policy did not load.

## 14.6 What a developer can change

Lower tiers never override a managed value; these cases sit outside that rule, and an implementer
MUST NOT treat them as a lock:

| Case | Rule |
| --- | --- |
| The model for a session | A managed `model` is a default: `--model` and `ANTHROPIC_MODEL` still choose; `availableModels` restricts the choice. <!-- req: policy.managed.What a developer can change.The model for a session --> |
| The auto-compact window for a session | A managed `autoCompactWindow` is a default: `--autocompact` and `CLAUDE_CODE_AUTO_COMPACT_WINDOW` still set it. <!-- req: policy.managed.What a developer can change.The auto-compact window for a session --> |
| Local admin rights | A developer who administers the machine can edit the managed source itself. <!-- req: policy.managed.What a developer can change.Local admin rights --> |
| The server-managed cache | An edit to the local cache lasts until the next successful fetch (§14.3.2). <!-- req: policy.managed.What a developer can change.The server-managed cache --> |
| Other tools | Managed settings bind the client only. <!-- req: policy.managed.What a developer can change.Other tools --> |

## 14.7 Keys only a managed source can set

The client MUST read these keys only from a managed source; in a user, project, local or
`--settings` file they have no effect. Most are locks: the value a lock governs is an ordinary key
any tier sets, and the lock makes the client honour only the managed value. Each key's full rule is
in the section named.

| Key | Effect |
| --- | --- |
| `allowAllClaudeAiMcps` | Load fetched claude.ai connectors beside `managed-mcp.json` (§8.11.3). <!-- req: policy.managed.Keys only a managed source can set.allowAllClaudeAiMcps --> |
| `allowedChannelPlugins` | Replaces the default channel allowlist; needs `channelsEnabled: true` (§14.8.6). <!-- req: policy.managed.Keys only a managed source can set.allowedChannelPlugins --> |
| `allowManagedHooksOnly` | Only managed hooks, SDK hooks and force-enabled plugins' hooks run (§14.8.5). <!-- req: policy.managed.Keys only a managed source can set.allowManagedHooksOnly --> |
| `allowManagedMcpServersOnly` | Only the managed `allowedMcpServers` applies; denylists still merge (§8.11.5). <!-- req: policy.managed.Keys only a managed source can set.allowManagedMcpServersOnly --> |
| `allowManagedPermissionRulesOnly` | Managed settings are the only source of permission rules (§13). <!-- req: policy.managed.Keys only a managed source can set.allowManagedPermissionRulesOnly --> |
| `blockedMarketplaces` | Blocklist of marketplace sources, checked before any download (§14.8.3). <!-- req: policy.managed.Keys only a managed source can set.blockedMarketplaces --> |
| `channelsEnabled` | Allows channels for the organization (§14.8.6). <!-- req: policy.managed.Keys only a managed source can set.channelsEnabled --> |
| `disableCommandPluginSources` | Blocks `command` plugin sources and marketplace `headersHelper` commands (§14.8.5). <!-- req: policy.managed.Keys only a managed source can set.disableCommandPluginSources --> |
| `disableSideloadFlags` | Rejects `--plugin-dir`, `--plugin-url`, `--agents` and `--mcp-config` at startup; a cloud session starts and drops the delivered `--mcp-config` servers instead (§14.8.5). <!-- req: policy.managed.Keys only a managed source can set.disableSideloadFlags --> |
| `forceRemoteSettingsRefresh` | Fail-closed startup on the server fetch (§14.3.3). <!-- req: policy.managed.Keys only a managed source can set.forceRemoteSettingsRefresh --> |
| `managedMcpServers` | Remote MCP servers provided to every user; provides, locks nothing (§8.11.4). <!-- req: policy.managed.Keys only a managed source can set.managedMcpServers --> |
| `managedSourcesBehavior` | First-wins or merge of the managed sources (§14.2.3). |
| `parentSettingsBehavior` | Whether parent settings merge under the admin tier (§14.2.6). |
| `pluginSuggestionMarketplaces` | Marketplaces whose plugins may be suggested in the terminal (§14.8.5). <!-- req: policy.managed.Keys only a managed source can set.pluginSuggestionMarketplaces --> |
| `pluginTrustMessage` | Text appended to the plugin trust warning (§14.8.5). <!-- req: policy.managed.Keys only a managed source can set.pluginTrustMessage --> |
| `policyHelper` | Executable computing managed settings (§14.2.5). |
| `sandbox.filesystem.allowManagedReadPathsOnly` | Only managed `filesystem.allowRead` paths are honoured; `denyRead` merges from all sources. |
| `sandbox.network.allowManagedDomainsOnly` | Only managed `allowedDomains` and `WebFetch(domain:...)` allow rules are honoured; other domains are blocked without a prompt. <!-- req: policy.managed.Keys only a managed source can set.sandbox.network.allowManagedDomainsOnly --> |
| `strictKnownMarketplaces` | Allowlist of marketplace sources users can add and install from (§14.8.3). <!-- req: policy.managed.Keys only a managed source can set.strictKnownMarketplaces --> |
| `strictPluginOnlyCustomization` | Skills, agents, hooks and MCP servers only from plugins, managed settings and built-ins (§14.8.5). <!-- req: policy.managed.Keys only a managed source can set.strictPluginOnlyCustomization --> |
| `wslInheritsWindowsSettings` | WSL reads the Windows policy chain (§14.2.7). |

`managedSourcesBehavior`, `parentSettingsBehavior`, `policyHelper` and `wslInheritsWindowsSettings`
carry their markers in the sections named. Other managed-only keys are named by the scope of each
key's entry in the settings reference (§12). On Team and Enterprise plans an Owner also turns Remote
Control and cloud sessions on or off in the console; a connected Remote Control session disconnects
when its next hourly policy refresh finds it off, and `disableRemoteControl` disables it per device.

## Design decisions

### Why one managed source wins by default

Merging sources that different teams control lets a lower source add grants, such as allow rules or
hooks, that the higher one never approved. First-wins makes the policy a single document an
administrator can read, and `"merge"` is an explicit opt-in that only the highest source can make.
The cross-source keys are the exceptions where a lower source can only make things stricter, so
reading them everywhere cannot loosen the policy.

### Why invalid managed values fail closed and user values do not

A managed value exists to restrict; dropping an unreadable restriction would widen what users can do
because of a typo in the policy. A user file restricts nothing but itself, so rejecting it whole is
safe. The exceptions, `disableAllHooks`, the denylists and the version bounds, are the keys where the
strict reading would block what the policy never named.

## Judgments

| Id | Judgment | Evidence |
| --- | --- | --- |
| J14.1 | A drop-in directory merge that concatenates two lists removes duplicates by JSON equality of the entries, keeping each entry at the position of its first occurrence in file order: `managed-settings.json` first, then the drop-ins alphabetically, each file's entries in their own order; a later duplicate is dropped. | managed-settings.md says lists "combine, with duplicates removed" and gives no equality or order. |
| J14.3 | The `Setting sources` labels are matched as the docs spell them, in the ranking order of §14.2.1 when several are merged. | managed-settings.md gives `(remote + file, merged)` as one example and no order rule. |
| J14.4 | A `policyHelper` envelope whose stdout carries keys besides `managedSettings` is accepted and the other keys ignored. | settings-reference.md specifies the `managedSettings` key and a bare object applying nothing; it names no other envelope key. |
| J14.15 | In a managed `sandbox` block, "a list that has no valid entry" is one that held entries and lost every one to validation; an empty list is valid and stays in force. | managed-settings.md, "Invalid values inside `sandbox`", lists what Claude Code does with invalid values; an empty array is not one, so dropping it would warn about a value the section does not call invalid and would loosen a policy (`network.allowedDomains: []`) its author wrote. Lead: the reference implementation's row for `src/settings/general/sandbox-check.ts`. |
