# 14.9 Mods policy

Part of §14, [Managed policy](14-policy.md). A mod is a plugin whose code runs inside the client
with the permissions of the user who installed it (§10); it is not sandboxed. This part states how
managed settings decide whether mods run, which ones, and in what order: the built-in guard, its
options, the organization's own mods, and a policy mod that judges the others. Evidence:
`plugins/mods/admin.md` unless a section names another page; `settings-reference.md` for
`prependPlugins`, `appendPlugins`, `pluginConfigs`, `allowManagedHooksOnly` and `disableAllHooks`.
§10 defines mods, their events and the order they run in; this part states only what policy adds.
<!-- req: policy.overview.Control mods for your organization -->

## 14.9.1 Stopping user-installed mods

Managed `pluginConfigs["cc-plugin-sec-default@builtin"].options.allowManagedModsOnly: true` sets the
guard's option (§14.9.6). <!-- req: policy.mods.Stop user-installed mods from loading -->

```json
{
  "pluginConfigs": {
    "cc-plugin-sec-default@builtin": { "options": { "allowManagedModsOnly": true } }
  }
}
```

With it set in managed settings, wherever the guard loads:

- **No mod a user brings runs its hooks**: a mod in a plugin the user installed, one loaded with
  `--plugin-dir`, and one Claude wrote during a session. <!-- req: policy.mods.Stop user-installed mods from loading.No mod a user brings runs its hooks -->
- **The organization's mods still run**: a mod that counts as the organization's (§14.9.5) is not
  checked; every other mod counts as a user's and is refused, including a mod in a plugin enabled
  from a GitHub or other remote marketplace and one the organization turns on for members on
  claude.ai. When no mod counts as the organization's, no installed mod runs its hooks. <!-- req: policy.mods.Stop user-installed mods from loading.Your organization's mods still run -->
- **Users cannot undo it**: the guard reads the option from managed settings only; the same entry in
  a user, project, local or `--settings` file changes nothing. <!-- req: policy.mods.Stop user-installed mods from loading.Users can't undo it -->
- **Users' other customizations keep working**: hooks in settings files and in plugins'
  `hooks/hooks.json`, status lines and `/goal`. <!-- req: policy.mods.Stop user-installed mods from loading.Users' other customizations keep working -->
- **Built-in mods keep running**, each with its own switch (§10). <!-- req: policy.mods.Stop user-installed mods from loading.Built-in mods keep running -->

Delivered as a file or by MDM, the option works the same on every API provider. A refused mod's
hooks do not run, and the debug log, and the transcript of a session that hot-reloads a plugin
directory (one started with `--plugin-dir`, for example), carry the guard's line `refused by
cc-plugin-sec-default: mods are limited to your organization's by policy (allowManagedModsOnly)`
(`plugins/mods/troubleshoot.md`, "Messages from the built-in guard").
`CLAUDE_CODE_ENABLE_FUNCTION_HOOKS` is ignored at any value; a `0` there leaves mods on.

## 14.9.2 The default

With no mod settings, a client MUST behave as follows. <!-- req: policy.mods.Know what happens by default -->

1. **Mods are on.** A user can install a plugin holding a mod from any marketplace the plugin policy
   allows (§14.8), or load one with `--plugin-dir`. <!-- req: policy.mods.Know what happens by default.Mods are on -->
2. **A built-in guard runs first.** The client loads the built-in mod `sec-default@builtin`, listed
   in `/plugin` and the debug log as `cc-plugin-sec-default`, ahead of every mod a user installs,
   when the machine has managed settings or a `managed-mcp.json`, or the session runs on a `/login`
   credential of a Team or Enterprise plan. An API key, a third-party provider or a long-lived
   `CLAUDE_CODE_OAUTH_TOKEN` gets the guard only on a machine with managed settings or
   `managed-mcp.json`; the token does not count as a Team or Enterprise `/login` even when such a
   login is stored on the machine. Users cannot turn it off. <!-- req: policy.mods.Know what happens by default.A built-in guard runs first -->
3. **The guard protects what the organization manages.** A user's mod cannot change what managed
   hooks receive or decide, the system prompt, the managed `CLAUDE.md` and other managed
   instructions, what any mod reads as settings, or the tools and descriptions of managed MCP
   servers. Outside that, a user's mod acts as the user: it reads and writes files, starts processes,
   makes network requests, rewrites tool calls and prompts, denies tool calls and draws in the
   interface. With the guard loaded, a user's mod cannot approve a call a `deny` rule refuses or an
   `ask` rule prompts for, whichever file holds the rule, nor one any `PreToolUse` hook blocked;
   `allowModsToOverrideDenyRules` (§14.9.6) lifts the two rule outcomes and the outcomes of hooks
   outside managed settings, never a managed hook's.
   Permission rules and hooks govern Claude's tool calls, not a mod's `$.fs` and `$.process` calls.
   <!-- req: policy.mods.Know what happens by default.The guard protects what you manage -->
4. **A user's mod can still skip some prompts.** In auto mode a call the mod approves runs without
   the classifier, except where the guard is loaded and the session runs with
   `--permission-prompt-tool` or an Agent SDK `canUseTool` callback: there the classifier checks the
   call first (§13). <!-- req: policy.mods.Know what happens by default.A user's mod can still skip some prompts -->

## 14.9.3 Controls that still apply

| Control | Rule |
| --- | --- |
| Settings hooks keep working | Command, HTTP, prompt and agent hooks in settings files and plugins' `hooks/hooks.json` run beside mods. <!-- req: policy.mods.Know which controls still apply.Settings hooks keep working --> |
| Managed hooks run first | A managed `PreToolUse` hook runs before any mod's `tool.call` hook; when it blocks, no mod's `tool.call` runs for that call; when a mod rewrites the call, managed hooks run again on the rewritten call. `PreToolUse` hooks of other files and of plugins run after the last mod, and not at all when a mod answers the call itself. <!-- req: policy.mods.Know which controls still apply.Managed hooks run first --> |
| Network policy covers `$.http.fetch` | Where the organization's policy does not allow WebFetch, every mod's `$.http.fetch` is refused. Turning the WebFetch tool off with `CLAUDE_CODE_DISABLE_WEB_FETCH` or a `WebFetch` deny rule does not stop `$.http.fetch`. `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC` stops only built-in mods' requests and any request carrying the session's Anthropic credentials. None covers a program a mod starts with `$.process.run`. <!-- req: policy.mods.Know which controls still apply.Network policy covers $.http.fetch --> |
| Plugin controls cover mods | A mod is a plugin: the marketplace keys (§14.8.3) decide whether it can be installed. <!-- req: policy.mods.Know which controls still apply.Plugin controls cover mods --> |
| Mods cannot change the permission prompt | A mod restyles the interface but not the permission prompt; it may still approve or deny before the prompt appears. <!-- req: policy.mods.Know which controls still apply.Mods can't change the permission prompt --> |
| Trust prompts come first | In an interactive session in an untrusted directory no mod loads until the user answers the trust prompt. <!-- req: policy.mods.Know which controls still apply.Trust prompts come first --> |

`--safe-mode` turns every installed mod off, the organization's included. None of these sandboxes a
mod. <!-- req: policy.mods.Know which controls still apply -->

## 14.9.4 Hooks of a user's mod that do not run

Where the guard loads, a hook a user's mod registers on one of these events never runs, and
`/plugin` shows that user a note:

| Event | What it is |
| --- | --- |
| `classic.<Event>` | A settings hook event (§7). <!-- req: policy.mods.Know which hooks of a user's mod don't run.classic.<Event> --> |
| `prompt.compose` | The system prompt's list of sections. <!-- req: policy.mods.Know which hooks of a user's mod don't run.prompt.compose --> |
| `prompt.section` | One section of the system prompt. <!-- req: policy.mods.Know which hooks of a user's mod don't run.prompt.section --> |
| `prompt.context` | The context sent with a conversation's first message. <!-- req: policy.mods.Know which hooks of a user's mod don't run.prompt.context --> |
| `prompt.attachment` | A message the client adds for Claude, such as a reminder. <!-- req: policy.mods.Know which hooks of a user's mod don't run.prompt.attachment --> |
| `skill.prompt` | A skill's text as it is expanded for Claude. <!-- req: policy.mods.Know which hooks of a user's mod don't run.skill.prompt --> |
| `attribution.text` | Commit or pull request attribution text. <!-- req: policy.mods.Know which hooks of a user's mod don't run.attribution.text --> |
| `session.compact` | A compaction of the conversation. <!-- req: policy.mods.Know which hooks of a user's mod don't run.session.compact --> |
| `settings.read` | A read of settings, such as `$.settings.read`. <!-- req: policy.mods.Know which hooks of a user's mod don't run.settings.read --> |
| `session.append{door=attachment}` | The stored row of a message the client adds for Claude. <!-- req: policy.mods.Know which hooks of a user's mod don't run.session.append{door=attachment} --> |
| `session.append{door=hook-context}` | The stored row of context from a settings hook. <!-- req: policy.mods.Know which hooks of a user's mod don't run.session.append{door=hook-context} --> |
| `session.append{door=compaction}` | The stored rows of a compaction's summary and boundary. <!-- req: policy.mods.Know which hooks of a user's mod don't run.session.append{door=compaction} --> |

1. The guard also passes over a user's hooks in some cases without a note, such as the descriptions
   of the organization's tools on `tool.describe` and the stored row of a skill's text. A
   `session.append` hook with no `door` filter still runs, with no note, but those rows do not reach
   it.
2. The note appears in the plugin's details and in the **Errors** tab, names each hook as the mod
   registered it, and reads:

   ```text
   Its hooks on classic.Stop, prompt.section do not run here: where an organization manages Claude Code, these events pass over the plugins you install
   Only a plugin that counts as your organization's own runs hooks on these events. An administrator sets that up in managed settings
   ```

3. To let such hooks run, an organization installs the mod so that it counts as its own (§14.9.5),
   keeping `sec-default@builtin` in a `prependPlugins` it sets, or removes the guard by leaving
   `sec-default@builtin` out of `prependPlugins` (`[]` suffices), which drops the whole guard and its
   options. A list without the guard delivered by server-managed settings takes effect only once the
   server confirms the session's settings (§14.3.2).

## 14.9.5 The organization's mods and their order

1. **What counts as the organization's.** The client MUST treat a mod as the organization's only when
   all hold: managed `enabledPlugins` sets its plugin `true`; managed settings name the plugin's
   marketplace as a directory on the machine by absolute path (an `extraKnownMarketplaces`
   `directory` source does, and registers it); and that marketplace lists the plugin by relative
   path, so it loads in place (§16). A plugin the client copies into its cache, every GitHub, git,
   URL or npm source, counts as a user's even when managed settings enable it: its mod runs among
   users' mods, the order lists skip it, `allowManagedModsOnly` refuses it and
   `allowManagedHooksOnly` keeps it from loading; the debug log has a line starting with its id and
   `is enabled by managed settings, but`. Server-managed settings can carry the keys but cannot put
   the directory on a machine; the directory and its parents SHOULD be writable only by an
   administrator. <!-- req: policy.mods.Install your organization's mods and set the order | policy.mods.Install your organization's mods and set the order.enabledPlugins | policy.mods.Install your organization's mods and set the order.extraKnownMarketplaces -->
2. **Order.** An organization's mod runs before users' mods even when no list names it, after the
   guard and the mods `prependPlugins` lists (`plugins/mods/events.md`, "The order mods run in").
   Two lists, of `plugin@marketplace` ids, set its place:
   - **`prependPlugins`**: those mods see every event before any user's mod and every result after,
     in the listed order; they can change an event, refuse it, or skip users' mods.
     <!-- req: policy.mods.Install your organization's mods and set the order.prependPlugins -->
   - **`appendPlugins`**: those mods run after every user's mod and see only what those mods pass
     on. An id in both lists is prepended; the guard cannot be appended (Judgment J14.13). <!-- req: policy.mods.Install your organization's mods and set the order.appendPlugins -->
3. Rules for the ids:
   - **The list replaces the default**: a managed `prependPlugins` MUST name `sec-default@builtin` to
     keep the guard, which needs no `enabledPlugins` entry, and the guard runs at the place the list gives it (Judgment J14.12). <!-- req: policy.mods.Install your organization's mods and set the order.The list replaces the default -->
   - **Own ids must count**: in managed settings the client skips an id whose plugin does not count
     as the organization's. <!-- req: policy.mods.Install your organization's mods and set the order.Your own ids must count as yours -->
   - **Repositories cannot set either list**: both are ignored in project and local settings and in
     a `--settings` file. <!-- req: policy.mods.Install your organization's mods and set the order.Repositories can't set either list -->
   - **A user may order their own mods** with both keys in `~/.claude/settings.json`, but only on a
     machine with no managed settings and no `managed-mcp.json`, in a session whose credential is not
     a Team or Enterprise `/login`; elsewhere the client ignores them there. A user list neither adds
     nor removes the guard.
4. **Debug log.** With `--debug`, an organization's mod logs `hooks module <id> loaded` with `tier
   prepend` (or its tier). The same line with `tier user` means the client treats it as a user's,
   followed by `prependPlugins names <id>, which is not an enabled managed plugin with a hooks module;
   skipped` when a list named it. <!-- req: policy.mods.Install your organization's mods and set the order.The same line with tier user -->

## 14.9.6 Guard options

Options are set under managed `pluginConfigs["cc-plugin-sec-default@builtin"].options`:

| Option | Unset | `true` |
| --- | --- | --- |
| `allowManagedModsOnly` | Users' mods run. | Only the organization's mods and built-in mods run their hooks; every other mod is refused (§14.9.1). |
| `allowModsToOverrideDenyRules` | Deny rules take precedence over users' mods. | A user's mod that approves calls can approve past most outcomes that stay in place by default, a `deny` rule included (§13.11 item 2): a `deny` rule's refusal, an `ask` rule's prompt, and the prompt or block of a `PreToolUse` hook from a file other than managed settings and of `permissions.blockReadsOutsideWorkingDirectories`. A managed hook's block or prompt, the `--permission-prompt-tool` or `canUseTool` callback, and what holds in every setup (auto, plan and `dontAsk` mode, a tool that requires user interaction) stay in place (Judgment J14.14). |

- **The id has one form here**: the options are read only under `cc-plugin-sec-default@builtin`;
  `prependPlugins` also accepts `sec-default@builtin`, `pluginConfigs` does not. <!-- req: policy.mods.Set options on the built-in guard.The id has one form here -->
- **Only managed settings count**: the same entry in a user, project, local or `--settings` file
  neither sets nor loosens an option. <!-- req: policy.mods.Set options on the built-in guard.Only managed settings count -->
- **The guard has to load**: where it does not (§14.9.2, or a `prependPlugins` without it), neither
  option applies. <!-- req: policy.mods.Set options on the built-in guard.The guard has to load -->
- **The guard fails closed**: if it cannot read managed settings it refuses every user's mod at load;
  if it cannot check the deny rules for a call a user's mod approved, it refuses the call. <!-- req: policy.mods.Set options on the built-in guard.The guard fails closed -->

## 14.9.7 How much to allow

| Policy | Settings |
| --- | --- |
| No installed mod runs; settings hooks untouched | `allowManagedModsOnly` and no mods of the organization's. |
| No installed mods and no hooks, managed ones included | Managed `disableAllHooks: true`. |
| Only the organization's mods | `allowManagedModsOnly`, with the organization's mods installed as §14.9.5 says. |
| Any mod from approved marketplaces | The marketplace restrictions (§14.8.3) and `disableSideloadFlags`. |
| Any mod, checked by the organization's own | The organization's mod listed with `sec-default@builtin` in `prependPlugins`. |

- **`allowManagedModsOnly`**: refuses users' own mods; settings hooks, status lines and `/goal` keep
  working. <!-- req: policy.mods.Choose how much to allow.allowManagedModsOnly | policy.mods.Choose how much to allow.Only your organization's mods -->
- **`allowManagedHooksOnly`**: wider. Only the organization's mods and built-in mods load; a mod a
  user installed does not; users' settings hooks are blocked too (§14.8.5). <!-- req: policy.mods.Choose how much to allow.allowManagedHooksOnly -->
- **`disableAllHooks`**: widest. In managed settings it stops the mods of every installed plugin, the
  organization's included, and every settings hook, managed ones included (hooks the Agent SDK
  registers in process keep running), so a managed `PreToolUse` hook no longer blocks; status lines
  and `/goal` stop. In any other file it stops the user's mods
  and keeps the organization's (§7). <!-- req: policy.mods.Choose how much to allow.disableAllHooks -->
- **`disableSideloadFlags`**: rejects `--plugin-dir`, `--plugin-url`, `--agents` and `--mcp-config`
  at startup and keeps mods Claude writes during a session from loading (§14.8.5).
  <!-- req: policy.mods.Choose how much to allow.disableSideloadFlags | policy.mods.Choose how much to allow.Any mod from marketplaces you approve -->

Built-in mods are affected by none of these. What a user can load as a mod follows the plugin
controls: with none, a mod from any marketplace, any `--plugin-dir` directory, or one Claude writes;
with an allowlist, a mod from allowed marketplaces or any `--plugin-dir`, and one Claude writes only
when the allowlist has `skills-dir`; with an allowlist and `disableSideloadFlags`, a mod from allowed
marketplaces only.

**Only the organization's mods, complete.** A managed file that registers the organization's
`directory` marketplace in `extraKnownMarketplaces`, enables its mod in `enabledPlugins`, lists it
first and the guard second in `prependPlugins`, sets `allowManagedModsOnly` in `pluginConfigs`, and
sets `disableSideloadFlags`. <!-- req: policy.mods.Allow only your organization's mods | policy.mods.Allow only your organization's mods.pluginConfigs | policy.mods.Allow only your organization's mods.disableSideloadFlags -->
Under it, with `--debug`:

- **The organization's mod**: its `hooks module` line has `tier prepend`. <!-- req: policy.mods.Allow only your organization's mods.Your mod -->
- **A mod the user installed**: a line reads `refused by cc-plugin-sec-default: mods are limited to
  your organization's by policy (allowManagedModsOnly)`, after an earlier line saying its hooks
  module `loaded`. <!-- req: policy.mods.Allow only your organization's mods.A mod the user installed -->
- **A plugin directory**: `claude --plugin-dir ./any-mod` exits with a message starting `--plugin-dir
  is disabled by your organization's managed settings (disableSideloadFlags)`. <!-- req: policy.mods.Allow only your organization's mods.A plugin directory -->

**Plugin controls apply to a plugin that holds a mod**: audit events (`claude_code.plugin_installed`,
`claude_code.plugin_loaded`, which redact third-party names unless `OTEL_LOG_TOOL_DETAILS=1`) show
which load across a fleet; update policy (§14.8.7) decides when a reviewed plugin updates; per-group
policy needs per-group endpoint settings; seeds (§14.8.4) serve CI and containers; and a mod offered
through a hosted marketplace that the client copies from a GitHub, git, URL or npm source counts as a
user's (§14.9.5). <!-- req: policy.mods.Apply your plugin controls to mods | policy.mods.Apply your plugin controls to mods.See which plugins load across your fleet | policy.mods.Apply your plugin controls to mods.Set up CI and containers | policy.mods.Apply your plugin controls to mods.Offer mods your users may install -->

## 14.9.8 A policy mod

An organization's mod in `prependPlugins` can judge other mods and record what they do. The client
MUST give it these (§10 states the events and the `$` API):

| Element | Rule |
| --- | --- |
| `plugin.register` | Fired each time another mod is about to load, carrying what `claude plugin validate` prints for it. Returning `{ refuse: '<reason>' }` keeps that mod from loading; the user's debug log, and the transcript of a session that hot-reloads a plugin directory, carry a line ending `refused by <mod>: <reason>`. A hook that throws or exceeds its time limit is skipped, so the check fails open unless a `.catch` handler returns the refusal. <!-- req: policy.mods.Enforce a policy with a mod of your own.plugin.register --> |
| `e.tier` | Where the mod would run: `prepend`, `user`, `append` or `builtin`; every mod a person installs is `user`. <!-- req: policy.mods.Enforce a policy with a mod of your own.e.tier --> |
| `e.uses.calls` | The `$` methods the mod's code calls, each `namespace.method` such as `process.run`, without `$.`, sorted and each once (`PluginRegisterUses`). <!-- req: policy.mods.Enforce a policy with a mod of your own.e.uses.calls --> |
| `tool.call` | Sees each tool call before any user's mod changes it; may log and pass it on unchanged. <!-- req: policy.mods.Enforce a policy with a mod of your own.tool.call --> |
| `fs.write` | A hook named after a `$` method without `$.` (`fs.write` for `$.fs.write`) sees every such call of every other mod, with `next.origin.plugin` naming the caller; returning `{ deny: '<reason>' }` blocks that call without refusing the mod. <!-- req: policy.mods.Enforce a policy with a mod of your own.fs.write --> |

A session can still run without the policy mod: three crashes of the worker that runs installed mods
unload every non-built-in mod until `/reload-plugins` or a new session, and `--safe-mode` runs without
installed mods.

## Design decisions

### Why the organization's mods must load in place from a managed directory

The guard lets the organization's mods run where users' mods are refused and ahead of them, so the
client must know a mod came from the organization and not from a source a user can influence. A
copied plugin passes through the user's cache and a remote source the user can reach; a directory
the device management writes, named by absolute path in managed settings, is as trustworthy as the
managed settings file itself.

## Judgments

| Id | Judgment | Evidence |
| --- | --- | --- |
| J14.12 | A managed `prependPlugins` that names `sec-default@builtin` places the guard at that position among the listed mods; when it omits the guard, no guard loads even where the guard's load conditions (§14.9.2) hold. | admin.md: "Claude Code follows the order you list" (its example lists the organization's mod first and the guard second) and leaving it out removes "the whole guard"; events.md, "The order mods run in", names the guard before the `prependPlugins` mods without saying a list can move it, and is read as the default order. |
| J14.13 | `appendPlugins` cannot carry the guard: `sec-default@builtin` there is skipped like any id that is not an organization's mod. | admin.md and settings-reference.md accept `sec-default@builtin` only in `prependPlugins`, and settings-reference.md, `appendPlugins`, skips an id whose plugin does not count as the organization's, which the built-in guard never does; the reference implementation skips it the same way. |
| J14.14 | `allowModsToOverrideDenyRules` lifts the outcomes the guard keeps that come from permission rules and from hooks outside managed settings (`deny`, `ask`, a hook's or the read block's prompt, a non-managed hook's block); it never lifts a managed hook's decision or the asking of the permission prompt tool or `canUseTool` callback. | admin.md, "Set options on the built-in guard", and reference.md: the option lets a user's mod approve "past most of the outcomes that stay in place by default, including a `deny` rule", and links permissions.md's list of five outcomes, the `ask` rule's prompt among them, without saying which stay. "Most" is read as every outcome but those the guard protects on its own ground: what managed hooks decide (§14.9.2 item 3, which the guard protects with or without the option) and the callback, which the guard keeps in front of auto mode (§14.9.2 item 4). |
