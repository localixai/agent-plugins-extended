# 4. Skills and commands

A skill is a directory holding a `SKILL.md`: YAML frontmatter that says when and how it runs, and a
Markdown body that becomes Claude's instructions when it does. A command is the older, single-file
form of the same thing. This chapter defines where a client finds both, how it names them, which
frontmatter it reads, how it lists them to the model and the `/` menu, how it expands their text,
and what holds while one runs. Evidence: `skills.md` unless a paragraph names another page;
`plugins/components.md` ("Skills", "Commands") and `plugins/manifest-reference.md` (`commands`) for
the plugin layout. The row type of the `/` menu is the Agent SDK's `SlashCommand` (`name`,
`description`, `argumentHint`, `aliases`, `builtin`).

## 4.1 The skill format and the core

1. Core §7.1 makes a core package's skills conform to the Agent Skills specification and has the
   client skip a skill that does not. A Claude Code skill is a superset of that format: it reads
   every Agent Skills field (`name`, `description`, `license`, `compatibility`, `metadata`,
   `allowed-tools`) and the Claude Code fields of §4.4, and it loads a skill the Agent Skills
   specification would refuse, such as one with no `name` or no `description`.
2. An Extended client MUST read the skills of a Claude Code plugin by this chapter and the skills of
   a core package by core §7.1. A skill whose frontmatter uses only the six Agent Skills fields
   loads the same way under both. A dual package loads as a Claude Code plugin (§1.3.1), so its
   `skills/` is read by this chapter.
3. Outside Claude Code, the Claude Code fields do not travel: an upload of a skill to claude.ai, the
   Skills API, or packaging with Anthropic's packaging script accepts only the six Agent Skills
   fields and fails on any other key, with a message of the form `Unexpected key(s) in SKILL.md
   frontmatter: <keys>. Allowed properties are: allowed-tools, compatibility, description, license,
   metadata, name`. Body features of §4.8, such as injected shell commands, do not work there
   either. An Extended client that offers a portability check SHOULD report exactly that set of keys
   as unexpected, in the order they appear, comparing names exactly (`Name` is unexpected).
   <!-- req: skills.behavior.Using skill frontmatter outside Claude Code -->

## 4.2 Skills in a plugin

### 4.2.1 Where a plugin's skills are

1. **Default location.** Each skill is a directory directly under `skills/` that holds a file named
   `SKILL.md`; the directory's name is the skill's name. Only the immediate children of `skills/`
   are skills, and a skill directory is not searched for further skills. A `SKILL.md` placed
   directly in `skills/` is not a skill, and the child directories are still read (Judgment J4.2).
   <!-- req: skills.behavior.Choose where skills load.Plugin -->
2. **Manifest paths.** The manifest `skills` key lists more directories to read. They add to
   `skills/`, which is still read, unlike `commands` and `agents`, which replace their defaults
   (§2.6). Each entry is a directory (§2.5): a directory that holds a `SKILL.md` itself is that one
   skill; any other directory is read like `skills/`, each child directory with a `SKILL.md` being a
   skill. `"."` names the plugin root. <!-- req: skills.components.Skills.Additional directories -->
3. **A single skill at the plugin root.** A plugin with no `skills/` directory and no `skills`
   manifest key, whose root holds a `SKILL.md`, loads that file as its one skill, its directory
   being the plugin root. This is the single-skill rule §1.4 refers to. Its name is the frontmatter
   `name`, else the plugin's directory name; because a marketplace install copies the plugin into a
   cache directory whose name is not the plugin's (§16), the author SHOULD set `name`, and a
   validator SHOULD suggest it. <!-- req: skills.components.Skills.A single skill at the plugin root -->
4. **Supporting files.** A skill directory MAY hold any other files beside `SKILL.md`: reference
   documents, examples, scripts. The client MUST NOT load them into context with the skill; they
   are read or run only when the skill's text leads Claude to them, and `${CLAUDE_SKILL_DIR}`
   (§4.8.2) gives their location. The author links each from `SKILL.md` and keeps `SKILL.md`
   itself short (under 500 lines is the documented advice). <!-- req: skills.behavior.Add supporting files -->
5. A file reached twice inside the plugin through a symbolic link loads once. Symbolic links are
   kept or dereferenced when a plugin is copied into the cache by the rules of §16; inside the
   plugin they behave as ordinary directories.
6. A `CLAUDE.md` at the plugin root is not a skill and is not loaded (§1.4); instructions a plugin
   ships are written as skills.

Example: a plugin with a default skill, a skill in a listed directory, and a listed folder of
skills.

```text
deploy-tools/
├── .claude-plugin/plugin.json      {"name": "deploy-tools", "skills": ["./extra/release", "./more"]}
├── skills/review/SKILL.md          /deploy-tools:review
├── extra/release/SKILL.md          /deploy-tools:<its name, else release>
└── more/
    ├── lint/SKILL.md               /deploy-tools:lint
    └── notes.md                    (not a skill)
```

### 4.2.2 The command name of a plugin skill

1. Every plugin skill is namespaced: its command is `<plugin>:<skill name>`, so
   `skills/review/SKILL.md` in plugin `my-plugin` runs as `/my-plugin:review`. A plugin skill never
   clashes with a skill of another location (§4.5.4).
2. **Which name.** A skill a scan finds — a child directory of `skills/` or of a listed folder of
   skills — is listed under its directory's name: a frontmatter `name` on it MUST NOT change the
   command the `/` menu and Claude's listing show. The client MUST also run the skill when the
   user types `/<plugin>:<name>` or, while no other command holds it, the bare `/<name>`, and MUST
   accept those names where a skill is named elsewhere, such as an agent's `skills` field (§5). A
   skill whose directory a manifest path names itself, and the plugin-root skill, take the
   frontmatter `name` as their listed name, falling back to the directory name. The documentation
   says the frontmatter `name` replaces the directory name in the listed command of every plugin
   skill; this rule follows Claude Code's behaviour instead (Judgment J4.1, E4a).
   <!-- deviates: skills.behavior.How a skill gets its command name.skills/ | skills.components.Skills.Command name -->
3. **Self-named skills.** For the plugin-root skill and a skill a manifest path names, the
   frontmatter `name` supplies the whole last segment. A `name` that already starts with the
   plugin's own `<plugin>:` prefix is not prefixed again (`name: my-plugin:fancy` is
   `/my-plugin:fancy`). In the command, every character other than an ASCII letter, a digit, `_`
   and `-` becomes `-` (`Plan Review` is `/my-plugin:Plan-Review`); a listing of the plugin's
   contents shows the name as written (Judgment J4.4).
   <!-- req: skills.behavior.How a skill gets its command name.SKILL.md -->
4. **Directory names a command cannot hold.** A plugin skill always loads when its directory name
   holds a character §4.3 refuses: each refused character becomes `-` in the command, and the user
   types the command with the hyphens. A refused frontmatter `name` is not used: the skill is not
   shown or run under it and keeps its directory name (Judgment J4.5).
5. In a non-interactive session the names `help` and `feedback` are not taken by their
   terminal-only built-in commands, so a plugin skill with one of those names keeps its bare
   command there; every other terminal-only built-in name, such as `login`, stays taken.

### 4.2.3 Who invokes a plugin skill

A plugin skill is invoked by Claude, by the user, or by both, as its frontmatter says (§4.7.1). By
default both may. `skillOverrides` (§4.7.4) does not apply to a plugin skill; the user controls a
plugin's skills by enabling or disabling the plugin (§16).
<!-- req: skills.components.Skills.Who invokes it -->

## 4.3 Names a command cannot hold

1. The client MUST refuse a command name, or a frontmatter `name`, that holds any of: a zero-width
   space or a control character; a private-use or unassigned character; a character that changes
   the direction of the surrounding text; a blank other than one plain space between two words (a
   no-break space, two spaces in a row, a leading or trailing space); `<` or `>`. It MUST also
   refuse a name over 256 characters, counted in Unicode code points as an option label is (§3.4.2). Judgment J4.5 fixes the character classes.
2. **Consequence by place.** Outside a plugin, a skill directory or command file whose name is
   refused does not load: it is missing from the `/` menu and Claude cannot invoke it. A refused
   frontmatter `name` leaves the skill loaded under its directory name, and the `name` value is
   neither shown nor accepted. In a plugin, §4.2.2 item 4 applies.
3. **Reporting.** An interactive client MUST say at startup that names were refused, with a count;
   Claude Code's notice reads `<n> skill or command name refused: run with --debug to see which
   ([names]), rename, then restart — a name may not hold hidden, direction-changing or blank-like
   characters, < or >, or be over 256 characters`. Each refused name has one debug-log line tagged
   `[names]`, with hidden characters written as code points (`\u{200B}`): `<name> is not offered`
   for a name that did not load, `<name value> is not shown for <skill>` for an ignored frontmatter
   `name`. §17 holds the message catalogue.
   After a rename the session is restarted, unless the file is in a watched directory (§4.5.3).
   <!-- req: skills.behavior.Characters a skill name can't hold -->

## 4.4 Frontmatter

### 4.4.1 Reading it

1. The frontmatter is the YAML between a `---` line that is the file's first line and the next
   `---` line. When the first line is not `---`, the whole file, markers included, is the body.
2. Before a block counts as not parsing, the client reads it once more with the value of each
   top-level `key: value` line put in single quotes, when that value is not already wrapped in one
   kind of quote and holds a character plain YAML refuses there (`{`, `}`, `[`, `]`, `*`, `&`, `#`,
   `!`, `|`, `>`, `%`, `@`, a backtick, or `: `), so `description: Does X: then Y` reads as the text
   written (Judgment J4.25). YAML that still does not parse leaves the skill loaded with no field
   set: the body is used, the user can still type its command, and Claude has no `description` to
   match. The parse error goes to the debug log.
3. Every field is optional. A field name MUST match §4.4.2 exactly, hyphens and case included
   (`when_to_use` is the one name with underscores); the client MUST ignore any other key without
   reporting it at load, and MUST keep loading the skill.
4. A boolean field accepts `true`, `false`, `yes`, `no`, `on`, `off`, `1` and `0`, in any letter
   case.
5. A value of the wrong type, or an enumerated value outside its list, is dropped: the field takes
   its default and the skill loads (Judgment J4.6). A list field accepts a YAML list or a string
   (Judgment J4.7 gives the separators).
6. A command file (§4.6) accepts every field except `name` and `paths`, which it ignores.

### 4.4.2 Fields

| Field | Value | Meaning |
| --- | --- | --- |
| `name` | string | The name the skill goes by; default the directory name (§4.2.2, §4.5.5). <!-- req: skills.frontmatter.name --> |
| `description` | string | What the skill does and when to use it; Claude chooses skills by it. Recommended. Without it, the `/` menu shows the first non-empty line of the body, trimmed; a skill with neither it nor `when_to_use` is not listed to Claude (§4.7.2 item 4). Listed under the cap of §4.7.2; `<` and `>` show escaped. <!-- deviates: skills.frontmatter.description --> |
| `when_to_use` | string | More context for when Claude should invoke it, such as trigger phrases. Appended to `description` in the listing, inside the same cap. <!-- req: skills.frontmatter.when_to_use --> |
| `argument-hint` | string | Shown after the command name while the user types, such as `[issue-number]` (Judgment J4.8). <!-- req: skills.frontmatter.argument-hint --> |
| `arguments` | string or list | Names for `$name` placeholders, mapped to argument positions in order (§4.8.1). <!-- req: skills.frontmatter.arguments --> |
| `disable-model-invocation` | boolean, default `false` | `true`: Claude does not invoke the skill on its own (§4.7.1). <!-- req: skills.frontmatter.disable-model-invocation --> |
| `user-invocable` | boolean, default `true` | `false`: hidden from the `/` menu, and typing `/name` does not run it (§4.7.1). <!-- req: skills.frontmatter.user-invocable --> |
| `allowed-tools` | string or list | Permission rules granted without a prompt during the invoking turn (§4.9.2). <!-- req: skills.frontmatter.allowed-tools --> |
| `disallowed-tools` | string or list | Tools removed from Claude's pool while the skill is active (§4.9.2). <!-- req: skills.frontmatter.disallowed-tools --> |
| `model` | string | Model for the rest of the turn, or of the forked subagent; `inherit` keeps the active model (§4.9.3). <!-- req: skills.frontmatter.model --> |
| `effort` | `low`, `medium`, `high`, `xhigh`, `max` | Effort level for the rest of the turn, or of the forked subagent (§4.9.3). <!-- req: skills.frontmatter.effort --> |
| `context` | `fork` | Run the skill in a new subagent (§4.9.4). <!-- req: skills.frontmatter.context --> |
| `agent` | string | The subagent type for `context: fork`; default `general-purpose`. <!-- req: skills.frontmatter.agent --> |
| `background` | boolean, default `true` | With `context: fork` only: `false` waits for the subagent's result in the invoking turn. <!-- req: skills.frontmatter.background --> |
| `hooks` | object | Hooks registered when the skill is invoked, kept for the rest of the session (§4.9.5). <!-- req: skills.frontmatter.hooks --> |
| `paths` | string or list | Glob patterns: Claude loads the skill on its own only while working with matching files (§4.7.3). <!-- req: skills.frontmatter.paths --> |
| `shell` | `bash` (default) or `powershell` | The shell of the skill's injected commands (§4.8.4). <!-- req: skills.frontmatter.shell --> |
| `metadata` | map | The author's own data. The client MUST NOT act on it and drops a value that is not a map. Authors SHOULD NOT reuse field names as its keys. <!-- req: skills.frontmatter.metadata --> |
| `license` | string | The skill's license (Agent Skills). Accepted and not acted on. <!-- req: skills.frontmatter.license --> |
| `compatibility` | string, up to 500 characters | Environment requirements (Agent Skills). Accepted and not acted on (Judgment J4.6 for a longer value). <!-- req: skills.frontmatter.compatibility --> |

## 4.5 Skills from other locations

A plugin is one of several places skills come from. A client that runs the whole Claude Code
contract also loads the others, because they decide which `/name` runs and what the listing holds
next to a plugin's skills. A client that implements only the plugin form MAY leave this section
out, and then MUST still namespace plugin skills as §4.2.2 says.

### 4.5.1 Locations

| Location | Path | Loads in |
| --- | --- | --- |
| Enterprise | `.claude/skills/<name>/SKILL.md` in the managed settings directory (§14) | Every session on the machine. <!-- req: skills.behavior.Choose where skills load.Enterprise --> |
| Personal | `~/.claude/skills/<name>/SKILL.md` | Every project on the machine, not cloud or Cowork sessions. <!-- req: skills.behavior.Choose where skills load.Personal --> |
| Project | `.claude/skills/<name>/SKILL.md` in the start directory and each parent up to the repository root | Sessions in the repository, not a project's cloud threads. <!-- req: skills.behavior.Choose where skills load.Project --> |
| Nested | `<subdir>/.claude/skills/<name>/SKILL.md` below the start directory | Sessions started in or below `<subdir>`; above it, once Claude reads or edits a file there; never a project's cloud threads. <!-- req: skills.behavior.Choose where skills load.Nested --> |
| Additional directory | `.claude/skills/<name>/SKILL.md` in a directory passed with `--add-dir` or `/add-dir` | That session. <!-- req: skills.behavior.Choose where skills load.Additional directory --> |
| Plugin | §4.2 | Wherever the plugin is enabled, as `/<plugin>:<skill>`. |
| claude.ai account | Skills enabled for the signed-in claude.ai account, downloaded into `~/.claude/skills/synced/` | Cowork and cloud sessions, and terminal sessions signed in with that account (§4.5.6). <!-- req: skills.behavior.Choose where skills load.claude.ai account --> |

Rules that hold across the folder locations:

- **Symbolic links.** A `<name>` entry in the enterprise, personal or project location MAY be a
  link to a directory elsewhere; the client reads `SKILL.md` from the target and loads one skill
  when several locations point at the same target. Plugin skills follow §4.2.1 item 5 instead.
  <!-- req: skills.behavior.Choose where skills load.Symlinked folders -->
- **`synced` is reserved.** A skill folder named `synced`, in any case, in the enterprise, personal
  or project location is skipped: `~/.claude/skills/synced/` holds the downloaded account skills.
  <!-- req: skills.behavior.Choose where skills load.Reserved name synced -->
- **`anthropic-skills` is reserved**, in every session whether or not the user is signed in.
  Outside a plugin, a skill folder, a frontmatter `name`, a file or subfolder of `.claude/commands/`
  or a saved workflow (§11) named `anthropic-skills` or starting with `anthropic-skills:` does not
  load, and an interactive client shows a startup notice naming the first item to rename, with a
  count of the rest (§17). A plugin named `anthropic-skills` loads; when one of its skills and a
  synced skill share `<name>`, `/anthropic-skills:<name>` runs the synced skill. An MCP server of
  that name connects, but its prompts are not offered as commands (§8). The match is exact and
  case-sensitive (Judgment J4.9). <!-- req: skills.behavior.Choose where skills load.Reserved name anthropic-skills -->
- **Refused characters.** Outside a plugin, a skill folder whose name §4.3 refuses does not load.
  <!-- req: skills.behavior.Choose where skills load.Characters in the name -->
- **Command files.** A Markdown file in `.claude/commands/` (personal `~/.claude/commands/`,
  project `.claude/commands/`, an added directory's) is a command (§4.6.1): the older format, with
  the frontmatter of §4.4 except `name` and `paths`. <!-- req: skills.behavior.Choose where skills load.Command files -->
- **A skill folder that is a plugin.** A personal or project skill folder that holds
  `.claude-plugin/plugin.json` also loads as a plugin named `<name>@skills-dir`, with its agents,
  hooks and MCP servers. In a project it requires the workspace trust dialog to have been accepted
  (§13), and anywhere it requires that managed policy has not blocked skills-directory plugins
  (§14); §16 defines how it loads. <!-- req: skills.behavior.Choose where skills load.Skill folder as a plugin -->

### 4.5.2 Parent, nested and added directories

1. Project skills load from `.claude/skills/` in the start directory and in every parent up to the
   repository root, so a session started in `packages/frontend/` has the root's skills. Moving the
   session with `/cd` adds the new directory's project skills. In a linked git worktree the search
   stops at the worktree root; when the worktree has no `.claude/skills` at its root, the main
   checkout's project skills load instead.
2. A nested `.claude/skills/` below the start directory loads the first time Claude reads or edits
   a file in that subdirectory, and stays for the session; until then its skills are not in the `/`
   menu and cannot be invoked. `/add-dir` with the subdirectory loads them at once.
3. When a nested skill's directory name matches another skill's, both stay. `/<name>` runs the root
   skill, and Claude's listing also carries the directory-qualified variant
   `/<path below the start directory>:<name>` with an instruction to prefer the one whose directory
   holds the files being worked on; the variant's description names its directory. The variant's
   name and description are listing entries (§4.7.2), which a client MUST produce as it produces
   every other entry; the instruction to prefer one of them is the client's own prompt text to
   the model, whose wording is not specified here (Judgment J4.28).
   <!-- req: skills.behavior.Load skills in monorepos and subdirectories -->
4. An added directory (`--add-dir`, `/add-dir`, or the Agent SDK's additional directories, which
   are passed as `--add-dir`) loads its `.claude/skills/`, `.claude/commands/` and `.claude/agents/`.
   `permissions.additionalDirectories` grants file access only and loads none of them (§13). These
   loads depend on the `project` setting source and are further restricted by
   `strictPluginOnlyCustomization` (§14), bare mode and safe mode.
5. An added directory's skill whose folder name clashes with an enterprise, personal or project
   skill, or one of a directory added earlier, runs as `/<prefix>:<name>` and is listed under that
   name. The prefix is the added directory's folder name; when two added directories share a folder
   name, the prefix of the later one starts with its parent folder's name (`/b/cli:verify`).
   <!-- req: skills.behavior.Run a same-named skill from an added directory -->

### 4.5.3 Changes during a session

1. Except in bare mode, the client MUST watch `~/.claude/skills/`, the project's `.claude/skills/`
   and the `.claude/skills/` of each directory added at launch, and add, update or remove a skill
   there within the session without a restart. A top-level skills directory created after the
   session started is not watched; `/reload-skills` reads it, once per change. An added
   directory's `.claude/commands/` and `.claude/agents/` are not watched.
2. Watching covers `SKILL.md` text only. For a skill folder that is also a plugin, a change to its
   `hooks/`, `.mcp.json`, `agents/` or `output-styles/` takes effect on `/reload-plugins` (§16).
3. A `SessionStart` hook can ask for a re-scan of the skill folders with `reloadSkills` (§7).
   <!-- req: skills.behavior.Edit a skill during a session -->

### 4.5.4 Skills that share a name

When two skills share a directory or file name, the client MUST decide which one `/name` runs by
where each came from:

| Same name in | Which one runs |
| --- | --- |
| Two of enterprise, personal and project | Enterprise over personal, personal over project. <!-- req: skills.behavior.Resolve skills that share a name.Two of enterprise, personal, and project --> |
| One of those locations and a bundled skill | The local skill replaces the bundled command, but not its aliases: a project `code-review` replaces `/code-review`, and the alias `/review` still runs the bundled skill. <!-- req: skills.behavior.Resolve skills that share a name.Any of those locations and a bundled skill --> |
| One of those locations and a built-in command | In a local terminal session, the skill replaces the built-in command, but not its aliases. <!-- req: skills.behavior.Resolve skills that share a name.Any of those locations and a built-in command --> |
| A skill and a `.claude/commands/` file | The skill, whatever the scope of either (Judgment J4.10). <!-- req: skills.behavior.Resolve skills that share a name..claude/commands/ --> |
| A project-root skill and a nested skill | Both load (§4.5.2 item 3). <!-- req: skills.behavior.Resolve skills that share a name.A project-root skill and a nested skill --> |
| An enterprise, personal or project skill and one in an added directory | The enterprise, personal or project skill; the other runs under its prefixed name. <!-- req: skills.behavior.Resolve skills that share a name.An enterprise, personal, or project skill and a skill in an added directory outside the project --> |
| Two added directories | The one added first, in `--add-dir` and `/add-dir` order; the other runs under its prefixed name. <!-- req: skills.behavior.Resolve skills that share a name.Two added directories outside the project --> |
| A plugin skill and a skill of any location above | Both load: the plugin skill is `/<plugin>:<name>`. <!-- req: skills.behavior.Resolve skills that share a name.A plugin skill and a skill at any of the locations above --> |
| Any of the above and the short name of a synced skill | The other skill or command; the synced skill is listed and runs only as `/anthropic-skills:<name>`. <!-- req: skills.behavior.Resolve skills that share a name.Any of the above and the short name of a skill synced from your claude.ai account --> |

### 4.5.5 Command names outside a plugin

| Where the file is | The command | Example |
| --- | --- | --- |
| A skill directory under `~/.claude/skills/` or `.claude/skills/` | The frontmatter `name`, unless another command already holds it, else the directory name; the directory name also runs the skill. | `.claude/skills/deploy-staging/SKILL.md` is `/deploy-staging`, or `/deploy` with `name: deploy`. <!-- req: skills.behavior.How a skill gets its command name.~/.claude/skills/ --> |
| A nested `.claude/skills/` whose directory name clashes | The subdirectory path below the start directory, `:`, the directory name. | `apps/web/.claude/skills/deploy/` is `/apps/web:deploy`. <!-- req: skills.behavior.How a skill gets its command name..claude/skills/ --> |
| A file in `.claude/commands/` | The file name without `.md`; each subdirectory below `commands/` is a segment joined by `:`. | `.claude/commands/frontend/component.md` is `/frontend:component`. <!-- req: skills.behavior.How a skill gets its command name..claude/commands/ --> |
| A skill synced from claude.ai | `anthropic-skills:<account name>`, and the short `<name>` while no other command holds it. | `/anthropic-skills:deploy`, or `/deploy`. <!-- req: skills.behavior.How a skill gets its command name.Skill synced from claude.ai --> |

### 4.5.6 Skills synced from claude.ai

1. A terminal session signed in with a claude.ai account through `/login`, and fetching feature
   flags, downloads the account's enabled skills into `~/.claude/skills/synced/` in the background
   and checks for changes while it runs (about every 10 minutes while active, 40 while idle). The
   download never delays startup: Claude waits only for a skill it invokes. A session that
   authenticates otherwise (an API key, `ANTHROPIC_AUTH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN`, an
   `apiKeyHelper`), that fetches no flags (Amazon Bedrock, `CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC`),
   that runs in bare or safe mode, under a `skills` lock (§14) or with `--setting-sources` lacking
   `user` does not sync. `CLAUDE_CODE_SYNC_SKILLS=1` makes a non-interactive run wait for the list.
   Skills synced earlier keep loading offline for the same account. `syncClaudeAiSkills: false`
   stops syncing and moves the synced skills to `~/.claude/skills/.trash/` at the next start.
2. The client downloads and never uploads: an edit under `synced/` is not saved to the account and a
   later sync may overwrite it.
3. The short name of a synced skill yields to any other command — a built-in or bundled command
   (even one turned off), a local skill or command file, a plugin skill, an MCP prompt. Names are
   compared ignoring case, spacing and invisible characters and folding compatibility forms; a
   look-alike letter of another alphabet is a different name. The `/` menu, `/skills` and
   `/context` show a synced skill under its short name, or its full name while the short one is
   taken, labelled as coming from claude.ai.
4. A synced skill's frontmatter applies in every session, and its display text is sanitized:
   control characters removed and, in text that reaches Claude, `<` and `>` escaped. Its body keeps
   local behaviour in a cloud session; in a Cowork session every `!` command is replaced by the
   `disableSkillShellExecution` text (§4.8.3); in any other session on the user's machine `!`
   commands do not run (they stay as literal text, or the policy text), `@` file references are not
   attached, and `${CLAUDE_PROJECT_DIR}` and `${CLAUDE_SESSION_ID}` stay as literal text.

### 4.5.7 Removing a skill

The client MUST honour each way a skill is removed:

- **Personal or project skill**: deleting its directory drops it from `/skills` in the session
  (§4.5.3); content already in the conversation follows §4.9.1. <!-- req: skills.behavior.Remove a skill.Personal or project skill -->
- **Enterprise skill**: an administrator deletes its directory from the managed settings
  directory. <!-- req: skills.behavior.Remove a skill.Enterprise skill -->
- **Plugin skill**: disabling or uninstalling the plugin (§16) unloads its skills when the change
  applies or at restart. <!-- req: skills.behavior.Remove a skill.Plugin skill -->
- **Synced skill**: turning it off on the account removes it from `synced/` at the next sync; a
  directory deleted by hand is downloaded again while the skill stays enabled. <!-- req: skills.behavior.Remove a skill.Skill synced from claude.ai -->
- **Bundled skill**: `disableBundledSkills: true` turns all off; a `skillOverrides` entry `"off"`
  hides one (§4.7.4). <!-- req: skills.behavior.Remove a skill.Bundled skill -->

To keep a skill but stop Claude invoking it, an author sets `disable-model-invocation: true`, or a
user sets `"user-invocable-only"` in `skillOverrides`.

The client MUST NOT move or delete a skill folder the user created under `~/.claude/skills/`:
synced skills live in their own `synced/` folder. What the client moves aside goes to
`~/.claude/skills/.trash/` (in a timestamped folder), from which a folder is restored by moving it
back, until the retention sweep deletes it (by default 30 days later). <!-- req: skills.behavior.Personal skills disappeared -->

## 4.6 Commands

A command is a single Markdown file the user runs by name. Skills supersede commands for new work;
a command takes the frontmatter of §4.4 except `name` and `paths`, and has no skill directory, so
`${CLAUDE_SKILL_DIR}` does not apply to it (§4.8.2). This is the section §1.4 refers to for
`commands/`.

### 4.6.1 Command files in a plugin

1. The default location is `commands/`. Each `.md` file is a command `/<plugin>:<file name without
   .md>`; each subdirectory adds a segment, so `commands/db/migrate.md` is `/my-plugin:db:migrate`.
   Files without `.md` are not commands.
2. A directory reached while reading a commands location that holds a `SKILL.md` is a skill, named
   by its path below the location with `:` between segments (`commands/nest/deep/SKILL.md` is
   `/my-plugin:nest:deep`), and nothing below it is read. A commands location that holds a
   `SKILL.md` itself is that one skill (Judgment J4.3).
3. The manifest `commands` key replaces `commands/` (§2.6): a path names one `.md` file or a
   directory read as in items 1 and 2. A location holding no `.md` file and no `SKILL.md` loads
   nothing (§2.6).
4. When a command and a skill of one plugin have the same command name (`commands/foo.md` and
   `skills/foo/SKILL.md` are both `/my-plugin:foo`), the command wins: the client lists one
   `/my-plugin:foo`, with the command's `description`, and runs the command's body. The skill is
   not reachable by that name (Judgment J4.27).

### 4.6.2 Commands in the manifest

The object form of `commands` (§2.7) defines commands without a separate file, or from a file kept
anywhere in the plugin. Each key is the command name after the plugin prefix: `"about"` in plugin
`my-plugin` runs as `/my-plugin:about`. A key is refused as a command name by §4.3, as a file name
is. <!-- req: commands.components.Define commands in the manifest -->

Each entry sets exactly one of `source` and `content`; an entry that sets both or neither fails
validation and loads nothing, with the message `Command must have either "source" (file path) or
"content" (inline markdown), but not both` at `commands.<key>`.

| Field | Type | Meaning |
| --- | --- | --- |
| `source` | path | The command's Markdown file. It follows the path rules of §2.5: it starts with `./`, stays inside the plugin and exists; a `source` that breaks them is an error for that entry and the file is not read. The file's frontmatter is read as a command file's. <!-- req: commands.entry.source --> |
| `content` | string | The command body, inline. It is the body as written: a leading `---` block in it is not frontmatter. <!-- req: commands.entry.content --> |
| `description` | string | The description shown for the command and listed to Claude, as a frontmatter `description`. <!-- req: commands.entry.description --> |
| `argumentHint` | string | The hint shown after the command name, as `argument-hint`. <!-- req: commands.entry.argumentHint --> |
| `model` | string | The model while the command runs, as `model` (§4.9.3). <!-- req: commands.entry.model --> |
| `allowedTools` | string[] | Tools the command may use without a prompt, as `allowed-tools` (§4.9.2), with the same variable substitution in Bash rules. <!-- req: commands.entry.allowedTools --> |

A field the entry sets replaces the same field of its `source` file's frontmatter; a field it leaves
out keeps the file's value (Judgment J4.11).

```json
{
  "name": "my-plugin",
  "commands": {
    "status": { "source": "./commands/status.md", "argumentHint": "[env]" },
    "about": { "content": "Summarize what this repository does in three sentences.", "description": "Summarize the repository" }
  }
}
```

## 4.7 Listing and invocation

### 4.7.1 Who invokes a skill

| Frontmatter | The user can invoke | Claude can invoke | In Claude's context |
| --- | --- | --- | --- |
| (default) | Yes | Yes | The description always; the whole skill when invoked. <!-- req: skills.invocation.(default) --> |
| `disable-model-invocation: true` | Yes | Not on its own | No description; the whole skill when invoked. <!-- req: skills.invocation.disable-model-invocation: true --> |
| `user-invocable: false` | No | Yes | The description always; the whole skill when invoked. <!-- req: skills.invocation.user-invocable: false --> |

1. With `disable-model-invocation: true`, the client MUST leave the skill out of Claude's listing,
   MUST refuse Claude's invocation of it, telling Claude not to carry out the skill's steps another
   way (so Claude suggests the user run `/name`), MUST NOT preload it into a subagent (§5), and MUST
   NOT run it when a session-scoped scheduled task fires with it as the prompt.
2. With `user-invocable: false`, the client MUST hide the skill from the `/` menu and MUST NOT run
   it when the user types `/name`; Claude may still invoke it.
3. In a subagent that preloads skills, the whole content of each preloaded skill is injected at
   start (§5), not only its description.

### 4.7.2 The listing Claude sees

1. Every turn, Claude sees a listing of the skills it may invoke. The listing MUST hold every such
   skill's name. Each entry's text is its `description`, then its `when_to_use`, capped together at
   `skillListingMaxDescChars` characters (default 1,536), whatever the budget; text past the cap is
   cut (Judgment J4.12 gives the line format).
2. The listing has a character budget: `skillListingBudgetFraction` of the model's context window
   (default `0.01`), or a fixed character count from `SLASH_COMMAND_TOOL_CHAR_BUDGET`, with a
   fallback of 8,000 characters. When the listing is over budget, the client keeps every name and
   drops descriptions, starting with the skills invoked least, so the most used keep their text; it
   writes a warning to the debug log. `/context` reports the listing's size after the budget is
   applied. `skillOverrides` `"name-only"` lists a skill without its description.
   <!-- req: skills.behavior.Skill descriptions are cut short -->
3. The client MUST show `<` and `>` of `description` and `when_to_use` as `&lt;` and `&gt;`. An
   author who wants a placeholder such as `<branch>` writes `[branch]`, or moves it to
   `argument-hint`, which shows as written. <!-- req: skills.behavior.Angle brackets in a skill description show as &lt; and &gt; -->
4. A skill whose frontmatter sets neither `description` nor `when_to_use` (a blank value is not
   set) MUST NOT be listed to Claude; the user can still run it, the `Skill` tool still runs it,
   and the `/` menu shows it with its first non-empty body line. With `when_to_use` alone the skill
   is listed, its first body line standing in for the description. The documentation makes the
   first body line the description of every skill without one; this rule follows Claude Code's
   behaviour instead (Judgment J4.13, E4a). <!-- deviates: skills.frontmatter.description -->

### 4.7.3 `paths`

`paths` limits when Claude loads the skill on its own: only while working with files that match a
pattern. Patterns use the glob format of path-specific memory rules, are relative to Claude's
current working directory, and never match a file outside it (such as one in a sibling worktree,
even an added one). The skill stays in the `/` menu and the user can type it. Until a matching file
is touched, the client lists the skill to Claude by name only (Judgment J4.14).

### 4.7.4 `skillOverrides`

`skillOverrides` (§12) maps a skill name to a visibility state, overriding the frontmatter without
editing it. A skill absent from it is `"on"`. It MUST NOT apply to plugin skills.

| Value | Listed to Claude | In the `/` menu |
| --- | --- | --- |
| `"on"` | Name and description | Yes <!-- req: skills.behavior.Override skill visibility from settings."on" --> |
| `"name-only"` | Name only | Yes <!-- req: skills.behavior.Override skill visibility from settings."name-only" --> |
| `"user-invocable-only"` | Hidden | Yes <!-- req: skills.behavior.Override skill visibility from settings."user-invocable-only" --> |
| `"off"` | Hidden | Hidden <!-- req: skills.behavior.Override skill visibility from settings."off" --> |

- A hidden state stops Claude's invocation, a subagent preload and a scheduled task's run, as
  `disable-model-invocation` does. `"off"` also hides the skill from the command lists given to
  Remote Control clients and Agent SDK callers, and typing its full name returns the
  `skillOverrides` error instead of running it.
- In user, project and local settings an entry matches skill names only. In managed settings or a
  `--settings` file, an entry under a bundled skill's alias (`checkup` for `/doctor`) applies to the
  skill behind it, and only to restrict it; an entry under the skill's own name in managed settings
  wins over it.
- The `/skills` menu writes the setting to `.claude/settings.local.json` and labels
  `"user-invocable-only"` `user-only`.

### 4.7.5 Where the user writes a skill's name

| Where | Example | What happens |
| --- | --- | --- |
| At the start of the message | `/deploy staging` | The client runs the skill with the rest as arguments. |
| After plain text, as a separate word with no punctuation attached | `go ahead and /deploy to staging` | Nothing runs. The name is the user's permission for that message: Claude may invoke the skill while it answers, even under `disable-model-invocation` (Judgment J4.15), and judges from the wording whether the user asked it to. |

Written without the slash, the name permits nothing. <!-- req: skills.behavior.Where you write the skill's name -->

### 4.7.6 Several skills in one message

At an interactive prompt, the user can stack skills at the start of one message: `/write-tests
/fix-issue 123` expands both and passes `123` to each as its arguments. The client expands the
first skill and at most five more, and stops at the first token that is not an inline,
user-invocable skill: a skill with `context: fork`, or one whose arguments may begin with another
command (such as `/loop`), ends the stack, and that token and the rest become the arguments of every
expanded skill. Through the Agent SDK or `claude -p` only the first skill loads, with the rest of
the line as its arguments. <!-- req: skills.behavior.Stack several skills in one message -->

### 4.7.7 Permission rules for the `Skill` tool

Claude invokes skills through the `Skill` tool, so permission rules (§13) govern it. A deny rule
`Skill` blocks every skill; `Skill(name)` matches the name exactly and `Skill(name *)` the name with
any arguments. Built-in commands are not reachable through the tool, except a few such as `/init`
and `/security-review`. A deny rule blocks more than the name it writes:

| The deny rule names | Example | Also blocked |
| --- | --- | --- |
| An alias | `Skill(review)` | The bundled `/code-review`, through its alias. <!-- req: skills.behavior.Restrict Claude's skill access.An alias --> |
| An unqualified name | `Skill(deploy)` | A nested skill listed as `apps/web:deploy`; not a plugin's `my-plugin:deploy` (Judgment J4.16). <!-- req: skills.behavior.Restrict Claude's skill access.An unqualified name --> |
| A synced skill | `Skill(anthropic-skills:deploy)` | That skill when the desktop app delivers it as a plugin. <!-- req: skills.behavior.Restrict Claude's skill access.A skill synced from claude.ai --> |
| The plugin form of a synced skill | `Skill(deploy:deploy)` | The synced skill. <!-- req: skills.behavior.Restrict Claude's skill access.The plugin form of a synced skill --> |
| A skill in the parameter form | `Skill(skill:deploy)` | The skill under whichever of its names Claude uses, alias and display name included. <!-- req: skills.behavior.Restrict Claude's skill access.A skill in the parameter form --> |

An allow rule matches only the skill's own name and the name in Claude's call. To approve synced
skills, the rule names the reserved namespace:

- `Skill(anthropic-skills:pdf)` approves the synced `pdf` skill. <!-- req: skills.behavior.Restrict Claude's skill access.Skill(anthropic-skills:pdf) -->
- `Skill(anthropic-skills *)` approves every synced skill. <!-- req: skills.behavior.Restrict Claude's skill access.Skill(anthropic-skills *) -->
- `Skill(anthropic *)` does not approve `anthropic-skills:pdf`: a prefix outside the namespace does
  not reach the names inside it. <!-- req: skills.behavior.Restrict Claude's skill access.Skill(anthropic *) -->

## 4.8 Expansion

When a skill is invoked, the client renders its body into the text Claude receives, in this order:
arguments are inserted (§4.8.1), then the variables are substituted (§4.8.2), then the injected
commands run and their output takes their place (§4.8.3). The rendered skill's text opens with the
line `Base directory for this skill: <skill directory>` and a blank line; a command's does not
(Judgment J4.17).

### 4.8.1 Arguments

Both the user (the text after the name) and Claude (the `Skill` tool's arguments) pass arguments.

| Placeholder | Expands to |
| --- | --- |
| `$ARGUMENTS` | The whole argument string as typed. <!-- req: skills.substitution.$ARGUMENTS --> |
| `$ARGUMENTS[N]` | The argument at 0-based index `N`. <!-- req: skills.substitution.$ARGUMENTS[N] --> |
| `$N` | Shorthand for `$ARGUMENTS[N]`: `$0` is the first argument. <!-- req: skills.substitution.$N --> |
| `$name` | The argument at the position of `name` in the `arguments` frontmatter: with `arguments: [issue, branch]`, `$issue` is the first and `$branch` the second. <!-- req: skills.substitution.$name --> |

1. Indexed arguments are split with shell-style quoting: `/my-skill "hello world" second` gives
   `$0` `hello world` and `$1` `second` (Judgment J4.18).
2. An indexed placeholder with no argument at its position stays as written. A named placeholder
   with no argument expands to the empty string.
3. When arguments were passed and no placeholder received one, the client appends
   `ARGUMENTS: <the arguments>` to the end of the content. `$ARGUMENTS`, an indexed placeholder with
   an argument, and every named placeholder count as receiving one; an indexed placeholder with no
   argument does not (Judgment J4.19).
4. An argument's own text is inserted literally: `$1` or `$ARGUMENTS` inside it is not expanded.
   `${CLAUDE_*}` variables are still substituted after the insertion.
5. A single backslash directly before an argument placeholder escapes it (`\$1.00` shows `$1.00`);
   a backslash before any other `$` stays. A doubled backslash (`\\$1`) keeps both backslashes and
   `$1` still expands. The escape does not stop a `${CLAUDE_*}` variable.
   <!-- req: skills.behavior.Pass arguments to skills -->

### 4.8.2 Variables

| Variable | Expands to |
| --- | --- |
| `${CLAUDE_SESSION_ID}` | The current session id. <!-- req: skills.substitution.${CLAUDE_SESSION_ID} --> |
| `${CLAUDE_EFFORT}` | The current effort level: `low`, `medium`, `high`, `xhigh` or `max`. <!-- req: skills.substitution.${CLAUDE_EFFORT} --> |
| `${CLAUDE_SKILL_DIR}` | The directory holding the skill's `SKILL.md`: for a plugin skill, the skill's own directory, not the plugin root. <!-- req: skills.substitution.${CLAUDE_SKILL_DIR} --> |
| `${CLAUDE_PROJECT_DIR}` | The project root, the same path hooks and MCP servers receive (§3). <!-- req: skills.substitution.${CLAUDE_PROJECT_DIR} --> |
| `${CLAUDE_PLUGIN_ROOT}` | The plugin's installed directory. Plugin skills and commands only (§3.2). <!-- req: skills.substitution.${CLAUDE_PLUGIN_ROOT} --> |
| `${CLAUDE_PLUGIN_DATA}` | The plugin's persistent data directory. Plugin skills and commands only (§3.3). <!-- req: skills.substitution.${CLAUDE_PLUGIN_DATA} --> |

1. The client substitutes `${CLAUDE_SKILL_DIR}` and `${CLAUDE_PROJECT_DIR}`, and in a plugin skill
   `${CLAUDE_PLUGIN_ROOT}` and `${CLAUDE_PLUGIN_DATA}`, in two places: the skill's content and the
   Bash rules of its `allowed-tools`. The same variable in both lets a skill run a bundled script
   without a prompt:

   ```yaml
   ---
   description: Render a chart from a CSV file
   allowed-tools: Bash(${CLAUDE_SKILL_DIR}/scripts/render.sh *)
   ---
   Run `${CLAUDE_SKILL_DIR}/scripts/render.sh <csv-file>` to render the chart.
   ```

2. The variables are not in the environment of commands Claude runs through the Bash tool; skill,
   command and agent content uses the `${...}` reference, which the client writes inline (§3.2).
3. `${user_config.KEY}` in a plugin skill's or command's content is substituted with the saved
   value of a non-sensitive option; a sensitive option becomes the placeholder
   `[sensitive option '<key>' not available in skill content]`, whether or not a value is saved; an
   option with no value, or one the manifest does not declare, stays as written (§3.4, Judgment
   J4.17).

### 4.8.3 Injected commands

1. `` !`<command>` `` runs `<command>` before Claude sees the skill, and its output replaces the
   placeholder. The form is recognised only where `!` starts a line or follows whitespace; after any
   other character, as in `` KEY=!`cmd` ``, it is literal text. A fenced block opened with a line
   ```` ```! ```` and closed by a line ```` ``` ```` holds a multi-line command (Judgment J4.20).
2. Substitution runs once over the original file: output is inserted as plain text and is not
   scanned for further placeholders, so a command cannot emit one for a later pass.
3. `disableSkillShellExecution: true` (§12; a managed `true` cannot be overridden) replaces each
   command of a skill or command from a user, project, plugin or added-directory source with
   `[shell command execution disabled by policy]` instead of running it. Bundled skills and skills
   deployed through managed settings are not affected. A synced skill's commands never run on the
   user's machine, whatever the setting (§4.5.6).
4. Including `ultrathink` anywhere in the content requests deeper reasoning for the turn.
   <!-- req: skills.behavior.Inject dynamic context -->

### 4.8.4 How injected commands run

The tool that runs a skill's commands is chosen from `shell` and the environment:

- `shell: powershell` with the PowerShell tool enabled: the PowerShell tool. The tool is on by
  default on Windows without Git Bash, and on Windows with Git Bash for claude.ai and Console
  accounts; it needs `CLAUDE_CODE_USE_POWERSHELL_TOOL=1` in Amazon Bedrock, Google Cloud's Agent
  Platform and Microsoft Foundry sessions and on macOS, Linux and WSL; the value `0` turns it off
  (the tools reference holds the rest). <!-- req: skills.behavior.How injected commands run.shell: powershell -->
- `shell: bash` written in the frontmatter, where bash is not available (Windows without Git Bash):
  the invocation fails before any command runs, with ``Skill <name> requires bash (`shell: bash` in
  frontmatter) but Git Bash was not found``. <!-- req: skills.behavior.How injected commands run.shell: bash -->
- Any other combination: the Bash tool when bash is available, otherwise the PowerShell tool
  (Judgment J4.21 for neither). <!-- req: skills.behavior.How injected commands run -->

Either tool runs the command as it runs Claude's own:

- **Working directory**: the session shell's current directory, which moves when Claude runs `cd`;
  paths that must not move use `${CLAUDE_SKILL_DIR}` or `${CLAUDE_PROJECT_DIR}`. <!-- req: skills.behavior.How injected commands run.Working directory -->
- **stderr**: with bash, merged into stdout and injected with it. <!-- req: skills.behavior.How injected commands run.stderr -->
- **Timeout**: the Bash tool's default of two minutes. When the tool moves a timed-out command to
  the background, the skill still renders and the injected text reports the move, naming the
  background task and its output file; a command the tool never backgrounds is killed at the
  timeout, which aborts the invocation. <!-- req: skills.behavior.How injected commands run.Timeout -->
- **Output size**: output past the tool's inline ceiling arrives as a file path and a short preview,
  never as cut text. <!-- req: skills.behavior.How injected commands run.Output size -->

The PowerShell tool applies the same timeout, backgrounding and ceiling.

### 4.8.5 Failures and permission checks

1. **A failed command aborts the whole invocation**: Claude receives none of the skill's content,
   and the client shows `Shell command failed for pattern "<placeholder>"` with the command's
   output. With bash, any non-zero exit fails, except exit 1 from the search and comparison
   commands the Bash tool's output-limits list names, which is a normal result; 2 and above fail
   for those too. Under `shell: powershell` the PowerShell tool's own list applies (it includes
   `grep` and `git diff`, not `find` or `diff`). An author appends `|| true` to a command expected
   to exit non-zero. <!-- req: skills.behavior.When an injected command fails -->
2. **Refused characters.** A command holding a character the tool refuses (a raw control character
   other than tab and newline; for PowerShell also U+FEFF and U+180E) runs nothing, and the client
   reports `No shell command in <name> was run, because the <tool> tool does not accept one of
   them: ...`, ending with the command and each refused character written `�` (§17). <!-- req: skills.behavior.When no shell command was run -->
3. **Permission checks.** Injected commands never prompt. Each is checked against the permission
   rules (§13) first: a deny match aborts the invocation with `Shell command permission check
   failed for pattern "<placeholder>"`. Outside auto mode, any answer other than allow — an ask rule
   included — aborts with the same message; `allowed-tools` pre-approves a command, and deny and ask
   rules still win over it. In auto mode, a command that would need approval does not abort: the
   skill loads with an instruction to Claude to run the command first, and Claude's call then goes
   through auto mode's checks; it still aborts in a forked skill that sets `agent` and in a session
   without the tool that runs injected commands. Under `allowManagedPermissionRulesOnly`, §4.9.2
   applies. <!-- req: skills.behavior.Permission checks on injected commands -->

## 4.9 While a skill runs

### 4.9.1 Its content in the conversation

1. The rendered content enters the conversation as one message and stays there on later turns; the
   client does not re-read the file. Its permissions do not persist (§4.9.2).
2. When Claude re-invokes a skill whose rendered content is identical to the copy in context, the
   client adds a short note that it is already loaded instead of a second copy; when the content
   differs (other arguments, new command output), it appends the full content again.
3. At auto-compaction the client re-attaches, after the summary, the most recent invocation of each
   skill, keeping its first 5,000 tokens, within a combined budget of 25,000 tokens filled from the
   most recently invoked skill; older skills can be dropped entirely (Judgment J4.22).
   <!-- req: skills.behavior.Skill content lifecycle -->

### 4.9.2 `allowed-tools` and `disallowed-tools`

1. `allowed-tools` grants its permission rules for the turn that invokes the skill, so Claude uses
   those tools without a prompt. The grant clears when the user sends the next message, though the
   content stays; invoking the skill again grants them again. It restricts nothing: every tool stays
   callable and the permission settings govern the rest. Workspace trust does not gate it: a project
   skill's grant applies even in a `-p` run in an untrusted folder.
2. `disallowed-tools` removes tools from Claude's pool while the skill is active; the restriction
   clears with the next message. Like a deny rule, it cannot remove `EndConversation` while any
   other tool remains.
3. **Managed permission rules only.** Under `allowManagedPermissionRulesOnly` (§13, §14) the client
   ignores `allowed-tools` in skills and command files from a repository's `.claude/`, from
   `~/.claude/skills/` and `~/.claude/commands/` (synced skills included), from an added
   directory, from skills-directory plugins, and from `@inline` plugins in the desktop sessions the
   setting's reference names. Managed and bundled skills, and other plugins, keep it, except an
   `@inline` plugin named `anthropic-skills`, which loses it in every session; `disallowed-tools`
   still applies. The tools such a skill lists go through the managed rules and
   the normal prompt; `/status` lists each skill whose `allowed-tools` was ignored in the session.
   <!-- req: skills.behavior.When only managed permission rules apply -->
4. **Hooks locked to plugins.** When managed `strictPluginOnlyCustomization` locks `hooks` (§14), a
   personal or project skill whose frontmatter declares `hooks` loses its `allowed-tools` grant, and
   its hooks do not run; plugin, bundled and managed skills keep both. Run in a subagent through
   `context: fork`, such a skill keeps its grant (settings-reference.md,
   `strictPluginOnlyCustomization`). The author's remedy is to drop
   `hooks` from the skill or move it into a plugin installed from a marketplace.
   <!-- req: skills.behavior.When managed settings lock hooks to plugins -->

### 4.9.3 `model` and `effort`

1. `model` sets the model for the rest of the current turn; it is not saved, and the session model
   resumes with the next prompt. It takes the values of `/model`, or `inherit`. A value excluded by
   the organisation's `availableModels` is not used, and the session keeps its model; in auto mode,
   and in plan mode while the classifier reviews commands, so is a model auto mode does not support.
   With `context: fork` it sets the forked subagent's model, and an excluded value follows the
   subagent rule (§5).
2. `effort` sets the effort level for the rest of the turn, over the session's level but not over
   `CLAUDE_CODE_EFFORT_LEVEL`; levels the model does not support fall back as the model
   configuration says. With `context: fork` it sets the subagent's level. Omitted, the level comes
   from the usual resolution order.

### 4.9.4 `context: fork`

1. With `context: fork`, the client starts a new subagent of the type `agent` names (a built-in
   such as `Explore`, `Plan` or `general-purpose`, or any custom agent of §5; default
   `general-purpose`) and gives it the rendered skill as its prompt. The subagent does not see the
   conversation: its system prompt comes from the agent type, its task is the skill content, and
   it loads `CLAUDE.md` per that agent's startup context (`Explore` and `Plan` load none). It is not
   a fork of the conversation. An `agent` that names no agent of the session is an error for the
   invocation (Judgment J4.23).
2. The subagent runs in the background and its result arrives in the conversation when it ends.
   `background: false` waits for it in the invoking turn. The client also waits, whatever
   `background` says, in non-interactive mode (`-p`, the Agent SDK), with
   `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`, when an earlier invocation of the same skill is still
   running, when a session-scoped scheduled task fires with the skill, and when an agent of a
   dynamic workflow invokes it (that agent receives the result, §11).
3. A background fork runs with the narrower tool set of background subagents (§5), and its edits
   fall outside the session's checkpoints, so `/rewind` does not restore them.
4. A skill holding only guidelines, without a task, gives a forked subagent nothing to do; authors
   use `context: fork` for skills with explicit instructions. <!-- req: skills.behavior.Run skills in a subagent -->

Example: a forked research skill. The client creates an isolated context, gives the `Explore`
subagent the rendered content ("Research `<arguments>` thoroughly: ...") as its prompt, the `Explore`
type decides its model, tools and permissions, and its summary returns to the main conversation
when it finishes. <!-- req: skills.behavior.Example: Research skill using Explore agent -->

```yaml
---
name: deep-research
description: Research a topic thoroughly
context: fork
agent: Explore
---
Research $ARGUMENTS thoroughly: find the files with Glob and Grep, read them, and summarize with file references.
```

### 4.9.5 Hooks in a skill's frontmatter

`hooks` takes the event map of a settings hooks file (§7). The client registers the hooks when the
skill is invoked, by the user or Claude, and keeps running them for the rest of the session, on
later turns too; a hook with `once: true` is removed after its first successful run. A project
skill's frontmatter hooks register on invocation even in a `-p` run in an untrusted folder. Per
session, the skills of one source (the project, the personal folder, each plugin) register at most
1,024 hooks whose matchers total at most 16,384 characters; a skill that would pass a limit
registers none of its hooks (§7 holds the limits and the lock of §4.9.2 item 4). A `hooks` block
that does not validate leaves the skill loaded without hooks (Judgment J4.6).

## 4.10 Validation

`claude plugin validate` reads the frontmatter of each `skills/<name>/SKILL.md` and of every `.md`
file below `commands/` and `agents/` at any depth, of a plugin directory and of a skills directory
given directly (`claude plugin validate .claude/skills`). Each finding names the file and the field
it is about (`frontmatter` for the block as a whole). An error fails validation; a warning fails it
only under `--strict` (§17). The messages below are fixed text, `<…>` marking what varies; `<kind>`
is `skill` or `command` (agents: §5.4.4).

| Severity | Field | Message | When |
| --- | --- | --- | --- |
| warning | `frontmatter` | `No frontmatter block found. Add YAML frontmatter between --- delimiters at the top of the file to set description and other metadata.` | The file has no block (§4.4.1 item 1, §2.11). |
| error | `frontmatter` | `YAML frontmatter failed to parse: <parser message>. At runtime this <kind> loads with empty metadata (all frontmatter fields silently dropped).` | The block does not parse, after the retry of §4.4.1 item 2 (Judgment J4.24). |
| warning | `description` | `No description in frontmatter. A description helps users and Claude understand when to use this <kind>.` | The block has no `description` key, whether or not it has `when_to_use` (Judgment J4.26). |
| warning | `metadata` | `'metadata' must be a mapping (key: value pairs); got <type>. It is dropped at load time.` | `metadata` is a string, a number or a list (`<type>` is `string`, `number`, `array`); an empty value is not reported. |
| error | `name` | `name must be a string, got <type>.` | `name` is a number, a boolean, a list or a map (`<type>` is `number`, `boolean`, or `object` for both a list and a map). A command file is checked too, though it ignores `name` (§4.4.1 item 6). |
| error | `description` | `description must be a string, got <type>. At runtime this value is dropped.` | `description` is a list or a map (`<type>` is `array` or `object`); a number or a boolean is not reported. |
| error | `allowed-tools` | `allowed-tools must be a string or array of strings, got <type>.` | `allowed-tools` is a number, a boolean or a map; an empty value is not reported. |
| error | `allowed-tools` | `allowed-tools array must contain only strings.` | A list with an item that is not a string. |
| error | `shell` | `shell must be a string, got <type>.` | `shell` is not a string. |
| error | `shell` | `shell must be 'bash' or 'powershell', got '<value>'.` | Any other string; the letter case is not checked (`Bash` passes). |

Nothing else in the frontmatter is reported: an unknown key, and a wrong type or an unlisted value
in any other field (`effort: light`, `context: inline`, `hooks: []`, a list `compatibility`, a map
`disallowed-tools`), pass silently, and the client drops them at load as §4.4.1 item 5 says. A
`skills` entry naming a `SKILL.md` file, and the `commands` entry errors of §4.6.2, are manifest
errors (§2.5). §17 defines the validator's output (Judgment J4.6).

## Design decisions

### Why a frontmatter problem never stops a skill

Claude Code loads a skill whose YAML does not parse, and ignores unknown keys. A value of the wrong
type is the same kind of mistake, so it is dropped the same way rather than refusing the file; the
user can still type the skill, and the validator is where the author learns of it.

### Why the listed name follows Claude Code over its page

The documentation says a frontmatter `name` renames a plugin skill found by a scan; Claude Code
2.1.319, 2.1.322 and 2.1.325 list it under its directory and still run it by the declared name. An
implementation that followed the page would list commands no Claude Code user sees. Accepting the
declared name as well keeps every invocation the page promises working.

### Why expansion is one ordered pass

Inserting the arguments before the variables and both before the commands run, with no second scan
of the output, means neither an argument nor a command's output can open a new placeholder; what
runs is what the author wrote, filled in.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J4.1 | A plugin skill a scan finds is listed under its directory name; its frontmatter `name` also invokes it (`/<plugin>:<name>`, and the bare name while free) and names it in an agent's `skills`. A skill whose directory a manifest path names, and the root skill, are listed under the frontmatter `name` (§4.2.2). E4a deviation. | **Docs:** components.md "Skills" ("Command name") and skills.md "How a skill gets its command name" say a plugin skill's frontmatter `name` replaces the directory name in the last segment (`/my-plugin:fancy`). **Claude Code:** 2.1.319 (reference implementation, `init.slash_commands`) lists only `alpha:greet` for `skills/greet/` with `name: fancy`; 2.1.322 (reference, `tests/host/preload-skill-alias.test.ts`) runs the body for `/alpha:fancy`, `/fancy` and `/alpha:greet` and preloads it for every one of those names in an agent's `skills`; 2.1.325, re-run 2026-11-16 (`claude --plugin-dir alpha plugin details alpha`), lists `review` for `skills/review/` with `name: fancy`, and earlier runs listed `three` for `extra/many/three/` with `name: declared-three` and `declared-one` for `extra/one/` named by a path. |
| J4.2 | A `SKILL.md` directly in the default `skills/` is no skill; its child directories load (§4.2.1). | The docs place each skill in its own directory under `skills/`. Reference implementation, oracle 2.1.319: `skills/SKILL.md` beside `skills/child/SKILL.md` loads only `child`. Oracle 2.1.325 differs: `plugin details` lists only the direct file's skill (`direct`) and not `b`. This text follows the observation nearest the 2.1.321 target. |
| J4.3 | A directory with a `SKILL.md` reached in a commands location is a skill named by its path with `:` (`nest:deep`), nothing below it loads, and a commands location holding `SKILL.md` itself is one skill (§4.6.1). | Docs: §2.6's debug line ("Expected .md files or SKILL.md in subdirectories") implies such skills, without a naming rule. Reference implementation, oracle 2.1.319. |
| J4.4 | A self-named skill's command drops the plugin's own prefix, then turns every character outside `A-Za-z0-9_-` into `-`; listings show the name as written (§4.2.2). | Docs give the prefix rule only. Reference implementation, oracle 2.1.319 (`init.slash_commands`: `Plan Review` is `plan:Plan-Review`); oracle 2.1.325 `plugin details` shows the name as written. |
| J4.5 | Refused characters are the Unicode categories Cc, Cf, Co, Cn, Cs, every blank other than one plain space between words, `<` and `>`; each refused character becomes one hyphen in a plugin directory name; a refused frontmatter `name` in a plugin is unused and the directory names the skill (§4.2.2, §4.3). | skills.md lists kinds of characters, not code points, and states the hyphen rule for folders only; errors.md adds the 256-character limit. Reference implementation's reading. |
| J4.6 | A frontmatter value of the wrong type, or an `effort`, `context` or `shell` outside its list (matched exactly), is dropped with a warning and the default applies; a `compatibility` over 500 characters is kept with a warning; `model` and `agent` are kept as text; a `hooks` block that does not validate leaves the skill loaded without hooks. | The docs list the values, not what an unlisted one does; only booleans are documented as case-insensitive. Reference implementation's judgments. The validator reports only the type errors of §4.10 (`name`, `description`, `allowed-tools`, `shell`, `metadata`) and none of the values this row drops: oracle 2.1.321 on the corpus (`~/Documents/llx-plugin/.cache/corpus/oracle/2.1.321/`, read against the frontmatter of the same files) reports none of 5 skill and 68 agent `effort` values outside the list (`light`, `HIGH`), 5 `context: inline`, 121 list or map `compatibility`, 10 list `hooks`, 1 empty `allowed-tools` and 1 empty agent `tools`; oracle 2.1.325, re-run 2026-11-16 on minimal skills, agrees for each shape and also reports none of `paths: 5`, `model: 7`, `user-invocable: maybe`, a map `disallowed-tools` or `arguments`. |
| J4.7 | `arguments`, `allowed-tools` and `disallowed-tools` split a string on spaces and commas outside parentheses; `paths` splits on commas only and keeps a `{a,b}` group whole. | The docs say "space-separated" or "space- or comma-separated" and "comma-separated" for `paths`; a Bash rule holds spaces inside parentheses. Reference implementation. |
| J4.8 | An unquoted `argument-hint: [issue-number]` (a YAML flow list) is the text `[issue-number]`; items are written back in their brackets. | The docs' own example is that text and YAML reads it as a list; the reference implementation observed Claude Code 2.1.319 load it as written. |
| J4.9 | The `anthropic-skills` reservation matches exactly and case-sensitively. | The docs give a case rule for `synced` only. Reference implementation. |
| J4.10 | A skill of any scope wins a name over a command file of any scope. | The docs say only that the skill wins. Reference implementation, oracle 2.1.322 (add-dir skill over project command, user skill over project command, project skill over user command). |
| J4.11 | A manifest command entry's fields replace the same fields of its `source` file's frontmatter, a field it omits keeps the file's; inline `content` is never parsed for frontmatter; a file's `name` and `paths` are ignored silently. | The manifest reference lists the fields without precedence. Reference implementation. |
| J4.12 | A listing entry is `- <name>: <description> - <when_to_use>`; the cap counts characters before `<` and `>` are escaped; the budget is window tokens × fraction × 4 characters. | The docs give the cap, escaping, budget and drop order, not the line or the order of cap and escape. Reference implementation, oracle 2.1.319 (the model request). |
| J4.13 | A skill with neither `description` nor `when_to_use` is not listed to Claude, though it runs and the menu shows its first body line; with `when_to_use` alone it is listed with the first body line for its description (§4.7.2). E4a deviation. | **Docs:** skills.md, "Frontmatter reference": a missing `description` "uses the first non-empty line of the markdown content", with no exception for the listing. **Claude Code:** 2.1.319 (reference implementation's oracle, its `spec/judgments.md` row for `src/skills/listing.ts`): such a skill is absent from `init.skills` and from the skill listing of the model request, and a `Skill` call to it answers `Launching skill`. 2.1.325 could not show the listing without a model call; its `claude plugin validate` warns `No description in frontmatter` for it, and `plugin details` counts a short fixed always-on cost for it, which is an estimate (Judgment J17.11), not the listing. |
| J4.14 | A skill with `paths` is listed to Claude by name only until a matching file is touched. | The docs say the listing holds every name and that Claude loads the skill on its own only for matching files, not whether the description shows meanwhile. Reference implementation. |
| J4.15 | A name written after plain text lifts `disable-model-invocation` for that message only; a hiding `skillOverrides` state still refuses. | The docs call it permission for the message without ranking it against `skillOverrides`. Reference implementation. |
| J4.16 | A deny rule's unqualified name does not reach a plugin skill's `<plugin>:<name>`. | The docs' table names nested, alias, synced and parameter forms only; plugin skills are namespaced (§4.2.2). Reference implementation. |
| J4.17 | A rendered skill opens with `Base directory for this skill: <dir>` and a blank line, a command does not; a sensitive `${user_config.*}` is `[sensitive option '<key>' not available in skill content]`. | The docs say only that a sensitive value "becomes a placeholder". Reference implementation, oracle 2.1.319 (the model request). |
| J4.18 | Argument quoting: single quotes literal; double quotes take `\"` and `\\`; outside quotes a backslash escapes whitespace, a quote or a backslash and stays before any other character; `""` is an empty argument; an unclosed quote runs to the end. | The docs say "shell-style quoting" with one example; strict POSIX would eat a Windows path's backslashes. Reference implementation. |
| J4.19 | `$N` takes every following digit; `$ARGUMENTS` and `$name` are whole tokens (`$ARGUMENTS_FILE` is text); an escaped placeholder does not count as receiving; the appended line follows a blank line; whitespace-only arguments are none. | The docs name the forms, not token boundaries or the separator. Reference implementation. |
| J4.20 | Any Unicode whitespace before `!` counts; a placeholder inside a Markdown code span or ordinary fence runs; an unclosed ```` ```! ```` block is literal text. | skills.md says "whitespace" without defining it. Reference implementation, oracle 2.1.322. |
| J4.21 | With neither bash nor the PowerShell tool available, the invocation fails naming the skill; a skill with no command to run needs no shell. | The docs' fallback names the PowerShell tool and stop there. Reference implementation. |
| J4.22 | The "already loaded" note makes the skill the most recent for compaction; a skill that does not fit the remaining compaction budget is dropped whole. | The docs give the budgets and the order, not the edge. Reference implementation. |
| J4.23 | A forked skill whose `agent` names no agent of the session fails, rather than falling back to `general-purpose`. | The docs make `general-purpose` the default only when `agent` is omitted. Reference implementation. |
| J4.24 | Unparsable frontmatter is a validation error; a missing block is a warning (§2.11 states the same). | plugins/troubleshooting.md lists `YAML frontmatter failed to parse` among messages that stop validation and names only `No frontmatter block found` and `Unknown field` as warnings. Oracle 2.1.325: `claude plugin validate` reports the parse failure under `Found 1 error` and exits 1; the entry-shape error for a command entry that sets neither field reads "... but not both" as for both. |
| J4.25 | A frontmatter block that does not parse is read again with each top-level plain value holding a character plain YAML refuses there put in single quotes; only a block that still fails is unparsable (§4.4.1 item 2). The same reading applies to agents, commands and output styles (§5.4, §6.1.1). | The docs say only that invalid YAML loads with no metadata. Oracle 2.1.321 on the corpus of `bun run corpus`: of the 20,114 blocks in the skills, agents and commands the validator reads, 132 are refused as written by the YAML parser of the runtime Claude Code runs on; 119 of them draw no error, and each parses with this retry; the 13 that still fail are exactly the 13 the oracle reports as `YAML frontmatter failed to parse`. Lead: the reference implementation's `src/format/frontmatter.ts` (oracle 2.1.319). |
| J4.26 | The validator's frontmatter findings are the table of §4.10: `No description in frontmatter` only when the `description` key is absent; type errors for `name`, `description` (a list or map only), `allowed-tools` and `shell`, at error severity; a non-map `metadata` at warning severity; nothing for any other field. | The docs name `claude plugin validate` and the parse and missing-block messages only. **Oracle 2.1.321, corpus** (2,496 plugins): `No description in frontmatter. … this skill.` 4 times, `… this command.` 7 times, `… this agent.` 27 times, each on a file without the key (a scan of the same files finds no file with an empty, null or non-text `description`, none with a non-text `name`, a non-text `shell` or a non-list `allowed-tools`, so the corpus neither confirms nor refutes the type errors); `'metadata' must be a mapping (key: value pairs); got string. It is dropped at load time.` once, as a warning; the parse error with the `skill` tail 4 times and the `command` tail 2 times. **Oracle 2.1.325**, re-run 2026-11-16 on minimal skills and commands: the same messages, plus `name must be a string, got number.` / `got boolean.` / `got object.` (a list too), `description must be a string, got array. At runtime this value is dropped.` (and `got object.`), `allowed-tools must be a string or array of strings, got number.` / `got object.`, `allowed-tools array must contain only strings.`, `shell must be a string, got number.`, `shell must be 'bash' or 'powershell', got 'zsh'.`, all errors; `metadata` warnings `got number.` and `got array.`; nothing for `description: 42`, `description: true`, an empty `description`, `name:` empty, `shell: Bash` or an empty `metadata`. The type errors are taken from 2.1.325 as the nearest observation; the next snapshot re-checks them. |
| J4.27 | A command and a skill of one plugin with the same command name: the command is listed and runs; the skill is not reachable by that name (§4.6.1 item 4). | The docs say a skill wins over a command file outside a plugin (J4.10) and are silent within a plugin. Reference implementation, oracle 2.1.319 (`init.slash_commands` and the description in the model request). Oracle 2.1.325, re-run 2026-11-16 with a private config directory and a local stand-in for the Messages API: plugin `p3` with `commands/foo.md` and `skills/foo/SKILL.md` lists `p3:foo` once in `init.slash_commands` and `init.skills`; `claude -p "/p3:foo"` sends the command's body and description, never the skill's. `claude plugin details` counts both, as an inventory. |
| J4.28 | The instruction that goes with a directory-qualified variant (§4.5.2 item 3) is the client's prompt text; its wording is not part of the contract. | skills.md, "Load skills in monorepos and subdirectories", describes what the instruction asks, not its text; a plugin observes the variant's name and description, which are listing entries, not the instruction. |
