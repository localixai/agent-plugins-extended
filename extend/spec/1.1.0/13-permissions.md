# 13. Permissions and trust

A Claude Code client decides, for every tool call Claude makes, whether the call runs, prompts the
user, or is refused. It decides from permission rules, the session's permission mode, the working
directories, hooks and mods. This chapter states that decision. Workspace trust, which gates what a
repository may grant, and the plugin security model are in [13-trust.md](13-trust.md) (§13.15
onward).

Evidence: `permissions.md` unless a section names another page; `permission-modes.md` for the
modes (§13.9–§13.11), `settings-reference.md`, "Permission settings", for the keys (§13.13). The rule
values follow the SDK's `PermissionRuleValue`, `PermissionBehavior` and `PermissionMode`
(`@anthropic-ai/claude-agent-sdk`). How settings files are found and merged is §12; the keys only
managed settings may set (`allowManagedPermissionRulesOnly`, the `allowManaged*Only` locks) are
§14; a hook's permission output is §7; a mod's `tool.check` is §10.

## 13.1 The permission system

1. The client MUST enforce permission rules itself. Instructions in a prompt, in `CLAUDE.md`, in a
   skill or in an agent's prompt shape what Claude attempts and MUST NOT change what the client
   allows.
2. With no rule, no hook and the `default` mode (Manual), each kind of tool behaves as this table
   says. "Saved" is what the "Yes, and don't ask again" answer of a prompt records.

   | Tool kind | Example | Prompts in Manual mode | What a "don't ask again" answer keeps |
   | --- | --- | --- | --- |
   | Read-only | Read, Grep, Glob | No inside the working directories (§13.12), except a network path (§13.5.7) | — <!-- req: permissions.behavior.Permission system.Read-only --> |
   | Bash commands | Bash, PowerShell | Yes, except Bash's read-only commands (§13.4.5); no PowerShell command is in that set (Judgment J13.37) | A rule per repository and command, saved <!-- req: permissions.behavior.Permission system.Bash commands --> |
   | File modification | Edit, Write, NotebookEdit | Yes | An approval for the rest of the session, not saved <!-- req: permissions.behavior.Permission system.File modification --> |
   | Web fetch | WebFetch | Yes, except the preapproved documentation domains | A rule per repository and domain, saved <!-- req: permissions.behavior.Permission system.Web fetch --> |
   | Web search | WebSearch | Yes | A rule per repository, saved <!-- req: permissions.behavior.Permission system.Web search --> |

3. A saved rule MUST be written to `.claude/settings.local.json` at the root of the git repository,
   resolved through a worktree to the main checkout, so it applies to later sessions anywhere in
   that repository; outside a repository and on Windows the file is the one §12 names for those
   cases. A prompt MUST offer "don't ask again" and "for the rest of the session" only when it can
   show everything the saved rule would allow; otherwise it offers a one-time approval only.
4. Approving a compound command (§13.4.2) with "don't ask again" MUST save one rule per subcommand
   that needed approval, at most 5, never one rule for the whole text; a `cd` to a directory
   outside the working directories saves a `Read` rule for that directory.
5. When a rule is added or removed mid-turn (`/permissions`), the change MUST apply from Claude's
   next tool call in the same turn.

## 13.2 Rule syntax

1. A rule is `Tool` or `Tool(specifier)`, written as a string in `permissions.allow`,
   `permissions.ask` or `permissions.deny`, or passed in `--allowedTools` and `--disallowedTools`.
   Parentheses inside the specifier are literal and need no escaping; the rule MUST end at its
   closing `)`. A rule of any other shape is skipped and reported as
   `Invalid permission rule "<rule>" was skipped: Malformed Tool(content) rule. Rules take the form Tool or Tool(content) and must end at the closing ")"; parentheses inside the content are literal`
   (errors.md, "Malformed Tool(content) rule"). Surrounding whitespace is trimmed, and `Tool()`
   reads as `Tool` (Judgment J13.1). <!-- req: permissions.reference.Permission rule syntax.Bash -->
2. The tool name is the canonical name of the tools reference (`TaskStop`), never the label a
   transcript shows (`Stop Task`). `Task` is read as `Agent`, its former name.
3. Common shapes:

   | Rule | Matches |
   | --- | --- |
   | `Bash` | Every Bash command. `Bash(*)` is the same rule. <!-- req: permissions.rule.Bash --> |
   | `Read` | Every file read. <!-- req: permissions.rule.Read --> |
   | `WebFetch` | Every fetch (§13.6 for how it differs from `WebFetch(domain:*)`). <!-- req: permissions.rule.WebFetch --> |
   | `Bash(npm run build)` | Exactly `npm run build`, not `npm run build --watch`. <!-- req: permissions.rule.Bash(npm run build) --> |
   | `Bash(npm run *)` | Commands that start with `npm run`, `npm run` itself included. <!-- req: permissions.reference.Permission rule syntax.Bash(npm run *) --> |
   | `Read(./.env)` | Reads of `.env` in the current directory. <!-- req: permissions.rule.Read(./.env) | permissions.reference.Permission rule syntax.Read(./.env) --> |
   | `WebFetch(domain:example.com)` | Fetches whose host is `example.com`. <!-- req: permissions.rule.WebFetch(domain:example.com) | permissions.reference.Permission rule syntax.WebFetch(domain:example.com) --> |

### 13.2.1 Tool-name wildcards

1. Deny and ask rules MAY put a glob in the tool-name position. The glob MUST match the whole tool
   name: `*` matches every tool and `mcp__*` every MCP tool. Only `*` is a wildcard there
   (Judgment J13.2). A glob with a specifier is skipped as an error. <!-- req: permissions.behavior.Tool name wildcards -->
2. An allow rule MAY use a tool-name glob only after a literal `mcp__<server>__` prefix whose
   server segment holds no glob: `mcp__puppeteer__*`, `mcp__github__get_*`. Any other allow glob
   (`*`, `B*`, `mcp__*`) is skipped and approves nothing.
3. A deny or ask rule whose tool name matches no known tool MUST draw a startup warning, shown as
   `⚠ Deny rule <rule> matches no tool · check for typos` in an interactive session and as
   `Permission deny rule "<rule>" matches no known tool — check for typos.` on stderr in a
   non-interactive text run (`ask` in place of `deny` for an ask rule; errors.md, "Matches no tool ·
   check for typos"). In a background session or with `--output-format json` or `stream-json` the
   warning goes to the debug log instead of stderr. A name holding `_` or `*`, and the name of a tool
   Claude Code removed (`TaskOutput`), is exempt. `MultiEdit` is not a known tool in 2.1.321 and is
   not exempt: a `MultiEdit` or `MultiEdit(<path>)` deny or ask rule draws this warning, and a path
   form also draws the warning of §13.5.2 (Judgment J13.34). The rule is kept. Where the warning appears is
   the output of the client that presents the session; a rule engine that presents none, such as a
   library, MUST return it to its caller as a value: the rule as written, its behaviour, its
   source, and the kind `matches no tool` (Judgment J13.33).

### 13.2.2 Parameter rules

1. A deny or ask rule MAY match one top-level input field of a built-in tool with
   `Tool(param:value)`. Allow rules MUST NOT match by parameter: they keep each tool's own
   specifier, because one field's value never shows that the whole call is safe.

   | Rule | Matches |
   | --- | --- |
   | `Agent(model:opus)` | Agent calls whose input sets `model` to `opus` (the alias as sent, not a full model ID). <!-- req: permissions.rule.Agent(model:opus) --> |
   | `Agent(isolation:worktree)` | Agent calls that ask for a git worktree. <!-- req: permissions.rule.Agent(isolation:worktree) --> |
   | `Bash(run_in_background:true)` | Bash calls that run in the background. <!-- req: permissions.rule.Bash(run_in_background:true) --> |

2. The field MUST be a direct field of the input; a field nested in an object or array is not
   matchable. A rule names one field; a rule that names two matches neither call (Judgment J13.3).
   The value is compared with the literal input before any normalisation, exactly unless it holds
   `*`, which matches any run of characters. A field the call leaves out never matches, so
   `Agent(model:*)` misses a call without `model`. Whitespace around the colon is ignored. A
   number or boolean compares as its text (Judgment J13.4).
3. The primary content field of a tool MUST NOT be matched this way: `command` (Bash,
   PowerShell), `file_path` (Read, Edit, Write), `path` (Grep, Glob), `notebook_path`
   (NotebookEdit) and `url` (WebFetch). Such a rule is ignored with a startup warning, because a
   compound command would bypass it.
4. A settings file MUST skip any `mcp__` rule with parentheses and list it in the invalid-settings
   dialog and in `claude doctor`; an MCP parameter is matched only by a `--disallowedTools` deny
   rule. A `Skill(skill:<name>)` deny rule matches the skill under any of its names (§4).
5. How `name:value` is told from a command or path that holds a colon is Judgment J13.5.

## 13.3 Evaluation order

1. Rules MUST be evaluated deny first, then ask, then allow; the first matching rule in that order
   decides, and specificity does not change the order. `Bash(aws *)` in deny blocks
   `aws s3 ls` even when `Bash(aws s3 ls)` is allowed, and a matching ask rule prompts even when a
   narrower allow rule also matches. An allow rule cannot carve an exception out of a deny rule.
2. The order holds across every source: a deny from any settings file, managed settings or
   `--disallowedTools` blocks what any other source allows, and `--allowedTools` cannot lift a
   managed deny. Under `allowManagedPermissionRulesOnly`, managed settings are the only file source
   of rules: the client ignores the `allow`, `ask` and `deny` lists of user, project, local and
   `--settings` files and `--allowedTools`, hides the always-allow answers of prompts and saves no
   new rule, while `--disallowedTools` and the session's own deny and ask rules still apply (§14).
   <!-- req: permissions.setting.allowManagedPermissionRulesOnly -->
3. A deny rule that names a whole tool — a bare name, `Bash(*)`, or a tool-name glob without a
   specifier — MUST remove the tool from Claude's context, so Claude never sees it; added
   mid-session, it takes effect from Claude's next call. A scoped deny rule (`Bash(rm *)`) leaves
   the tool available and refuses each matching call. `Bash(*)` is the one `Tool(*)` form the
   docs make equal to the bare name; `Monitor(*)`, which shares Bash's rule format, reads the same,
   and for any other tool `Tool(*)` is a scoped rule whose `*` the tool's format reads, so the tool
   stays (Judgment J13.36).
4. `EndConversation` is exempt: no deny rule removes it while any other tool remains, no ask rule
   prompts for it, and PreToolUse hooks do not run for it.
5. The tool label never matches. Rules and hook matchers both use canonical names (§13.2).

## 13.4 Bash and PowerShell rules

### 13.4.1 Wildcards

1. A Bash rule matches the whole command text. `*` matches any text, spaces included; a rule
   without `*` matches one exact command. Everything before the first `*` is matched as written.
2. A trailing ` *` (space, star) that is the rule's only wildcard also matches the bare command:
   `Bash(ls *)` matches `ls`. The space is part of the rule, so `Bash(ls *)` does not match `lsof`
   while `Bash(ls*)` does. `:*` at the very end is the same as ` *` (`Bash(ls:*)`); anywhere else
   the colon is literal, so `Bash(git:* push)` matches no git command. A prompt's saved rule uses
   the space form.

   | Rule | Matches | Does not match |
   | --- | --- | --- |
   | `Bash(npm run *)` | `npm run build`, `npm run test --watch`, `npm run` | `npm install` <!-- req: permissions.rule.Bash(npm run *) --> |
   | `Bash(git log * main)` | `git log --oneline main`, `git log -5 main`, `git log --output=<file> main` | `git log main`, `git push origin main` <!-- req: permissions.rule.Bash(git log * main) --> |
   | `Bash(git * main)` | `git merge main`, `git push origin main`, `git -c core.fsmonitor=<script> diff main` | `git log` <!-- req: permissions.rule.Bash(git * main) --> |
   | `Bash(* --version)` | `node --version`, `bash -c 'echo hi' --version` | `node -v` <!-- req: permissions.rule.Bash(* --version) --> |
   | `Bash(ls *)` | `ls -la`, `ls` | `lsof` <!-- req: permissions.rule.Bash(ls *) --> |
   | `Bash(ls*)` | `ls -la`, `lsof` | — <!-- req: permissions.rule.Bash(ls*) --> |
   | `Bash(* --help *)` | `npm --help x` | `npm --help` (the trailing ` *` is not the only wildcard) <!-- req: permissions.rule.Bash(* --help *) --> |

3. An allow rule whose `*` comes before a later word that selects the command (`Bash(git * main)`,
   `Bash(git -C * status *)`) MUST draw a startup warning and still load unchanged: in an
   interactive session the row `⚠ Allow rule <rule> allows any option at its * · use an exact value`
   with the full text in the debug log, and on stderr in a non-interactive text run
   `Permission allow rule (<source>): <rule> has a wildcard before the rest of the command, so it also matches any options inserted at that position and approves them without a prompt.`
   followed, for git, by the sentence on `-c` and `--exec-path` and the advice to replace the `*`
   (errors.md, "Has a wildcard before the rest of the command"). Judgment J13.6 fixes which rules
   draw it.

### 13.4.2 Compound commands

1. The client MUST split a command at `&&`, `||`, `;`, `|`, `|&`, `&` and newlines, and MUST read
   commands nested in a subshell, a command substitution or a control-flow body (`for`, `if`) as
   subcommands too. A compound command runs without a prompt only when every subcommand is allowed,
   by an allow rule or by being read-only (§13.4.5). <!-- req: permissions.behavior.Compound commands -->
2. A deny or ask rule MUST apply when any subcommand matches it: an ask rule `Bash(git clean *)`
   prompts for `cd /tmp && git clean -f` and for `echo "$(git clean -f)"`, in auto mode too.
3. A command with nothing after `&&` or `||` (`npm test &&`) is unparseable: it is not split, and
   no allow rule approves it. How the client splits, and what else is unparseable, is Judgment
   J13.7.

### 13.4.3 Wrappers

1. Before matching, the client MUST strip these wrappers, each of which runs its argument as the
   command: `timeout`, `time`, `nice`, `nohup`, `stdbuf`, the builtins `command` and `builtin`, and
   zsh's `noglob`. `command -v` (a lookup) and zsh's `nocorrect` are not stripped. `xargs` is
   stripped only with no flags: `xargs grep x` matches `Bash(grep *)`, `xargs -n1 grep x` does not.
   The list is fixed and not configurable. <!-- req: permissions.behavior.Wrappers -->
2. A leading assignment of a known-safe environment variable is stripped for every rule
   (`NODE_ENV=test npm test` matches `Bash(npm test *)`; Judgment J13.8 names the variables). An
   allow rule MUST NOT match past an assignment of any other variable; a deny or ask rule MUST
   match past any leading assignment (`FOO=bar rm -rf tmp/` matches a `Bash(rm *)` deny).
3. Environment runners (`direnv exec`, `devbox run`, `mise exec`, `npx`, `docker exec`) are not
   wrappers: `Bash(devbox run *)` approves whatever follows `run`, so an author writes one exact
   rule per inner command.

### 13.4.4 Exec wrappers, `find` actions and what a rule does not match

1. A rule that holds a `*` MUST NOT auto-approve a command run through an exec wrapper (`watch`,
   `setsid`, `ionice`, `flock`) or a `find` with an action that runs, deletes or writes (`-exec`,
   `-delete`, `-rm`, `-fprint`) or with `-files0-from`; in Manual mode such a command prompts. Only
   an exact rule with no `*` approves it (`Bash(find build -type f -delete)`); a command that holds a
   `*` itself, such as `find . -name '*.tmp' -delete`, reads any rule as a pattern and still
   prompts. A PreToolUse hook MAY approve it. Judgment J13.9 completes the `find` list.
   <!-- req: permissions.behavior.Exec wrappers and find actions -->
2. A Bash rule matches the command as Claude writes it, after splitting and stripping. It is not a
   boundary around a program: a deny or ask rule stops the first form below and not the others,
   which the other rules and the mode then decide.

   | Rule | Stops | Does not stop |
   | --- | --- | --- |
   | `Bash(curl *)` | `curl https://example.com` | `/usr/bin/curl https://example.com`, `sh -c 'curl https://example.com'` <!-- req: permissions.rule.Bash(curl *) --> |
   | `Bash(rm *)` | `rm -rf build/` | `/bin/rm -rf build/`, `bash -c 'rm -rf build/'` <!-- req: permissions.rule.Bash(rm *) --> |
   | `Bash(git push *)` | `git push origin main` | `git -C . push origin main`, `git -c push.default=current push origin main` <!-- req: permissions.rule.Bash(git push *) --> |

### 13.4.5 Read-only commands

1. The client MUST run a fixed set of read-only commands without a prompt in every mode: `ls`,
   `cat`, `echo`, `pwd`, `head`, `tail`, `grep`, `find`, `wc`, `which`, `diff`, `stat`, `du`, `cd`
   and the read-only forms of `git` (Judgment J13.10), among others. The set is not configurable;
   an ask or deny rule makes one of them prompt or refuse. `permissions.blockReadsOutsideWorkingDirectories`
   changes this for outside paths (§13.12.2), and in auto mode such a command MAY wait for the
   classifier. <!-- req: permissions.behavior.Read-only commands -->
2. Unquoted globs are allowed for a command whose every flag is read-only (`ls *.ts`,
   `wc -l src/*.py`). A redirect adds a check on its target (§13.4.6).
3. In Manual mode a command of the set still prompts when:
   - **an unquoted glob meets a write- or exec-capable command** (`find`, `sort`, `sed`, `git`),
     since the glob could expand to `-delete`;
   - **`docker` is pointed at another daemon** with `-H`, `--context`, or Podman's `--url` or
     `--connection`; <!-- req: permissions.behavior.Read-only commands.docker pointed at another daemon -->
   - **`file` has a path-opening flag**, `-m`/`--magic-file` or `-f`/`--files-from`; <!-- req: permissions.behavior.Read-only commands.file with path-opening flags -->
   - **`ps` could print the environment**: an argument that can act as the `e` option (`ps auxe`,
     `ps aux -e`), while `ps aux` and `ps -ef` stay read-only;
   - **`which` has a flag beyond lookup and display** (`-i`/`--read-alias`, `--read-functions`);
     `which -a node` stays read-only;
   - **an argument is a network (UNC) path on Windows** (`\\server\share\file`), in Bash and in
     PowerShell commands alike; <!-- req: permissions.behavior.Read-only commands.Network paths on Windows -->
   - **the command writes a special shell variable**: it sets, unsets or loops over a variable
     such as `PATH` or `IFS` (Judgment J13.11 lists them); <!-- req: permissions.behavior.Read-only commands.Writes to special shell variables -->
   - **the analysis cannot parse it**, and always for a command longer than 10,000 characters.
     <!-- req: permissions.behavior.Read-only commands.Commands the analysis can't parse -->
4. A `cd` into a working directory or an additional directory is read-only, and `cd packages/api && ls`
   runs without a prompt when each part qualifies. Two combinations prompt even so:
   - **`cd` with `git`**, when the `cd` moves to another directory, because git may run that
     directory's hooks; a `cd` that resolves to the current directory does not count; <!-- req: permissions.behavior.Read-only commands.cd with git -->
   - **`cd` with a redirect**, when the client cannot tell which directory the redirect target
     resolves against after the `cd`; a target of `/dev/null` alone does not prompt. <!-- req: permissions.behavior.Read-only commands.cd with a redirect -->

### 13.4.6 Redirections

1. An output redirect (`> file`, `>> file`, `2> file`) MUST be checked as an edit of its target:
   against `Edit` allow and deny rules, the protected paths (§13.10.3) and the working directories.
   A rule such as `Bash(git commit *)` allows the command, not the target. A target that starts with
   `~` or holds a glob character needs approval. <!-- req: permissions.behavior.Redirections -->
2. An input redirect (`< file`) MUST be checked as a read: against `Read` allow and deny rules and
   the working directories. A target outside them needs approval unless an allow rule covers it; a
   target that holds a glob, or a relative path after a `cd` in the same command, needs approval
   even then.
3. Targets with no file behind them are not checked: `/dev/null`, `2>&1`, `<&3`, here-documents and
   here-strings. The files a `tee` writes, in a pipeline too (`make | tee build.log`), MUST be
   checked as output redirects; `Bash(tee *)` does not cover a destination outside the working
   directories. Judgment J13.12 fixes what lifts a redirect's prompt.

### 13.4.7 PowerShell

1. PowerShell rules have the shape of Bash rules; `PowerShell` and `PowerShell(*)` match every
   command. Matching is case-insensitive, and common aliases are canonicalised first, so
   `PowerShell(Get-ChildItem *)` also matches `gci`, `ls` and `dir` (Judgment J13.13). <!-- req: permissions.behavior.PowerShell -->
2. The client MUST parse the command and check each subcommand alone, splitting at `|`, `;`, and on
   PowerShell 7 and later `&&` and `||`. Every subcommand must be allowed for the command to run
   without a prompt.

## 13.5 Read and Edit rules

### 13.5.1 What they cover

1. `Edit` rules MUST apply to every built-in tool that edits files. `Read` deny rules MUST apply,
   best effort, to every built-in tool that reads files (Grep, Glob), to `@file` mentions, to the
   selection and open-file context an IDE shares, to an image path pasted or dragged into a prompt
   (the image is not attached; with no other image the path stays as text), and to an @-mentioned
   directory, whose listing leaves out the names the rule covers. <!-- req: permissions.behavior.What Read and Edit rules cover -->
2. A `Read` deny rule MUST also refuse the Edit and Write tools on the same path, a new file
   included, with `File is covered by a Read deny rule in your permission settings and cannot be edited.`
   (`cannot be written` for Write). NotebookEdit is not covered; an `Edit` deny covers it.
3. Read and Edit deny rules apply to the built-in file tools, to the file commands the client
   recognises in Bash (`cat`, `head`, `tail`, `sed`, `tee`) and to redirect targets. They do not
   reach a command that reads files without naming them (`grep -r x .`) or a program that opens
   files itself; only the sandbox does.
4. A `.claudeignore` file has no effect; its entries belong in `Read` deny rules.

### 13.5.2 `Write`, `Glob` and `Grep` path rules

A path rule other than `*` for `Write`, `NotebookEdit`, the legacy `MultiEdit`, `Glob` or `Grep` is
accepted but MUST NOT match any call: files are checked against `Edit` and `Read` rules only. A
`Grep(docs/**)` deny does not stop Grep. The client MUST keep a `Write`, `NotebookEdit`,
`MultiEdit` or `Glob` path rule and warn about it, from any settings file, managed settings,
`--allowedTools`, `--disallowedTools` or `--settings`: in an interactive session the full warning goes
to the debug log and a deny or ask rule also shows the row
`⚠ Deny rule Write(docs/**) never matches · use Edit(docs/**)` (`Glob(<path>) never matches · use Read(<path>)`
for Glob; an allow rule gets no row); a non-interactive text run prints
`Permission deny rule (<source>): Write(docs/**) is not matched by file permission checks — only Edit(path) rules are. Use Edit(docs/**) instead (Edit rules cover all file-editing tools).`
on stderr; a background session or `json`/`stream-json` output sends it to the debug log
(errors.md, "Is not matched by file permission checks"). `--allowedTools` accepts a `Glob` rule
silently. A bare `Write` or `Glob` matches every use and draws no warning. As an ask
rule, `Read(docs/**)` prompts when Grep or Glob is called on a matching path, not when a search of a
directory above it returns matching files. As in §13.2.1 item 3, the row, stderr line or debug-log
line is the presenting client's output; a library MUST return the warning as a value carrying the
rule as written, its behaviour, its source, the kind `never matches`, and the rule to use instead
(`Edit(<path>)`, or `Read(<path>)` for `Glob`), from which its caller writes the texts above
(Judgment J13.33). <!-- req: permissions.behavior.Write(path), Glob(path), and Grep(path) rules don't match -->

### 13.5.3 Path patterns

1. Read and Edit rules use gitignore pattern syntax: `*` matches within one path segment, `**`
   across segments. Four anchors exist:

   | Pattern | Anchored at | Example |
   | --- | --- | --- |
   | `//path` | The filesystem root | `Read(//Users/alice/secrets/**)` is `/Users/alice/secrets/**` <!-- req: permissions.rule.//path --> |
   | `~/path` | The home directory | `Read(~/Documents/*.pdf)` <!-- req: permissions.rule.~/path --> |
   | `/path` | The directory of the settings source (13.5.3.2) | `Edit(/src/**/*.ts)` in project settings is `<primary working directory>/src/**/*.ts` <!-- req: permissions.rule./path --> |
   | `path` | The current directory | `Read(*.env)` is `<cwd>/*.env` <!-- req: permissions.rule.path --> |
   | `./path` | The current directory, as `path` (Judgment J13.14) | `Read(./.env)` <!-- req: permissions.rule../path --> |

   `/Users/alice/file` is not an absolute path: one leading slash anchors at the settings source.
2. A `/path` pattern anchors by where the rule is defined: project settings, local settings, the
   command line and session rules at the primary working directory; user settings at `~/.claude`;
   a `--settings <file>` at that file's directory; managed settings at the primary working
   directory (Judgment J13.15). A rule added through `/permissions` follows the file it is saved
   to. Local settings anchor at the primary working directory, not at the repository root where the
   file is stored, so in a worktree `Edit(/src/**)` names that worktree's `src/`. A user-settings
   `Read(/secrets/**)` names `~/.claude/secrets/**`.
3. On Windows paths are normalised to POSIX form first: `C:\Users\alice` is `/c/Users/alice`, so
   `//c/**/.env` names every `.env` on drive C and `//**/.env` every drive.

### 13.5.4 Depth

1. A rule matches only under its anchor. A bare file name matches at any depth, gitignore-style.
   A relative pattern with one directory segment (`src/**`) matches by the rule's behaviour: as an
   allow rule only `<cwd>/src` and below, as a deny or ask rule a directory of that name at any depth
   under the cwd (Judgment J13.16 defines the shape). Every other shape matches at its anchored
   location only (`/src/**`, `src/components/**`), or at any depth when it says so (`**/src/**`).

   | Rule | Matches `src/app.ts` | Matches `vendor/pkg/src/lib.js` |
   | --- | --- | --- |
   | `Edit(src/**)` | Yes | Only as a deny or ask rule <!-- req: permissions.rule.Edit(src/**) --> |
   | `Edit(/src/**)` | Yes | No <!-- req: permissions.rule.Edit(/src/**) --> |
   | `Edit(**/src/**)` | Yes | Yes <!-- req: permissions.rule.Edit(**/src/**) --> |

   | Deny rule | Blocks | Does not block |
   | --- | --- | --- |
   | `Read(.env)` | Any `.env` at or under the cwd | A `.env` in a parent directory or another project <!-- req: permissions.rule.Read(.env) --> |
   | `Read(**/.env)` | The same as `Read(.env)` | The same <!-- req: permissions.rule.Read(**/.env) --> |
   | `Read(//**/.env)` | Any `.env` on the filesystem | — <!-- req: permissions.rule.Read(//**/.env) --> |

### 13.5.5 Special characters and `!` negation

1. A path approved with "don't ask again" MUST be saved with its gitignore characters (`[`, `]`,
   `*`) escaped, so the rule names only that literal path. Rules a user writes are not escaped.
   Parentheses need no escaping: `Edit(./Finance (2024)/**)` names that folder. <!-- req: permissions.behavior.Special characters and ! negation -->
2. A deny or ask rule whose path is not a usable gitignore pattern still guards the exact path it
   spells; an allow rule with an unusable pattern approves nothing.
3. A deny or ask pattern starting with `!` is a negation: it carves the paths it matches out of the
   `path` and `./path` rules listed before it in the same list of the same source.
   `Read(*.env)` then `Read(!sample.env)` in one `deny` list blocks every `*.env` except
   `sample.env`; a `!` rule listed first carves nothing. A negation never reaches another source:
   `Read(!.env)` in project settings or `--disallowedTools` does not cancel a managed `Read(./.env)`.
4. A `!` pattern is read relative to the current directory even when `/`, `~/` or `//` follows the
   `!`, so it cannot carve from a rule with one of those anchors. A negation cannot reopen a file in
   a directory blocked as a whole: with `Read(secrets/**)`, `Read(!secrets/public/**)` reopens
   nothing.

### 13.5.6 Symlinks

1. When a requested path goes through a symbolic link (or a Windows junction), the check MUST cover
   the requested path and the file it resolves to. An allow rule applies only when both match; a
   deny rule applies when either matches. A deny or ask rule written with `//`, `~/` or `/` through
   a linked directory also applies at its real location (`Read(//etc/**)` blocks
   `/private/etc/hosts` on macOS). Grep and Glob search, and are checked at, the directory their
   `path` resolves to.
2. A `Read` deny rule covers attachments by the named path and the resolved one: @-mentions,
   pasted images, files re-read after a change on disk and IDE context; a matching attachment is
   left out. Under the read block (§13.12.2) or `--restricted` an attachment from a refused path is
   left out too. A mention the client cannot examine becomes the line
   `Referenced <path> (not read: could not be examined)`.
3. The Edit and Write tools MUST refuse to write a path that is itself a link and direct Claude to
   its target. A write through a linked parent directory, or by a shell command, that resolves out
   of the working directories is not auto-approved in `acceptEdits` and prompts in auto mode unless
   an allow rule approves it; one that resolves to a protected path the requested path does not
   name prompts where the mode would otherwise route it to the classifier (§13.10.3).
4. A path whose links cannot be resolved (a loop) is refused by Read, Edit and Write, and a tool
   that opens an approved file MUST first confirm the path still resolves where the check approved.

### 13.5.7 Network paths

1. A read by Read, Grep or Glob from a network path — a UNC path (`\\server\share\file`) on
   Windows, a `/net` automount path on macOS and Linux — gets its own check, because looking it up
   can contact the host it names. No allow rule, not even a bare `Read`, pre-approves it; a
   PreToolUse hook's `"allow"` leaves the prompt in place; in auto mode the prompt comes to the user
   and not to the classifier. <!-- req: permissions.behavior.Network paths.Allow rules | permissions.behavior.Network paths.PreToolUse hooks | permissions.behavior.Network paths.Auto mode -->
2. `dontAsk` denies such a read. `bypassPermissions`, and plan mode at an interactive terminal with
   bypass available, run it without this prompt.
3. To read a share without the prompt, a user gives it a local path: on Windows a mapped drive
   letter passed with `--add-dir` at launch, on macOS and Linux a mount under `/mnt` or `/Volumes`.
   A network path MUST NOT be added as a working directory. <!-- req: permissions.behavior.Network paths.Windows | permissions.behavior.Network paths.macOS and Linux -->

## 13.6 WebFetch rules

1. A WebFetch rule uses `domain:` and matches the host name of the requested URL, ignoring case and
   a trailing `.` on either side. `WebFetch(domain:example.com)` matches `example.com` only;
   `WebFetch(domain:*.example.com)` matches any subdomain at any depth and not `example.com`;
   `WebFetch(domain:*)` matches every host. Anywhere other than a leading `*.` or a bare `*`, a `*`
   matches only within one label: `example.*` matches `example.org`, not `example.evil.com`
   (Judgments J13.17, J13.18).
2. A bare `WebFetch` and `WebFetch(domain:*)` both cover every URL but differ:

   | Rule | In `allow` | In `deny` |
   | --- | --- | --- |
   | `WebFetch` | Fetches without a prompt; the sandbox's host list is unchanged. | Removes the tool; the sandbox's host list is unchanged. |
   | `WebFetch(domain:*)` | Fetches without a prompt, and sandboxed commands may reach any host. | Keeps the tool and refuses each fetch; sandboxed commands reach no host. |

   Only the `domain:` form adds its domain to the sandbox's allowed or denied list. <!-- req: permissions.behavior.Allow or deny every fetch -->
3. A read of an artifact page is not covered by a bare `WebFetch` deny or ask rule; a `domain:`
   rule that covers `claude.ai` or the `*.claudeusercontent.com` content host (or `domain:*`)
   denies or prompts for it, as an `Artifact` rule does, and the denial names the rule.
4. In a Cowork session a deny rule naming the whole `Bash` or `WebFetch` tool MUST also apply to
   `mcp__workspace__bash` and `mcp__workspace__web_fetch`, with
   `Permission to use mcp__workspace__bash has been denied.`; allow rules never carry over.

## 13.7 MCP rules

1. `mcp__<server>__<tool>` names one tool; `mcp__<server>__*` and the bare `mcp__<server>` name
   every tool of the server.

   | Rule | Matches |
   | --- | --- |
   | `mcp__puppeteer` | Every tool of the `puppeteer` server. <!-- req: permissions.behavior.MCP.mcp__puppeteer --> |
   | `mcp__puppeteer__*` | Every tool of the `puppeteer` server, by wildcard. <!-- req: permissions.behavior.MCP.mcp__puppeteer__* --> |
   | `mcp__puppeteer__puppeteer_navigate` | Its `puppeteer_navigate` tool. <!-- req: permissions.behavior.MCP.mcp__puppeteer__puppeteer_navigate --> |

   <!-- req: permissions.behavior.MCP -->
2. `<server>` is the name as it appears in the server's tool names: characters such as `.` and
   spaces become `_` (`my.server` is `mcp__my_server__*`). A plugin's server takes the
   plugin-scoped form of §8, so server `database-tools` of plugin `my-plugin` is
   `mcp__plugin_my-plugin_database-tools__*`. <!-- req: permissions.behavior.MCP.Servers that a plugin provides -->
3. For a server whose name holds `__` or ends in `_`, an allow rule MUST use the wildcard form with
   the whole name (`mcp__reports__v2__*`): the bare `mcp__reports__v2` and `mcp__reports` are read
   as rules for a server `reports` and approve none of its tools. As deny or ask rules both names
   also cover every tool of `reports__v2`; to target a server `reports` alone, a rule per tool is
   written (Judgment J13.19). <!-- req: permissions.behavior.MCP.A <server> that contains __ or ends in _ -->
4. A connector tool the organisation set to `ask` (`mcp__claude_ai_<server>__<tool>`, when that
   setting reaches the session) prompts on every call whatever the allow rules and the mode,
   `auto` and `bypassPermissions` included; `dontAsk` denies it.

## 13.8 Agent, Skill and Cd rules

1. `Agent(<name>)` matches a call that starts the subagent of that name; deny rules (or
   `--disallowedTools`) disable an agent (Judgment J13.20 for a call without a type).

   | Rule | Matches |
   | --- | --- |
   | `Agent(Explore)` | The built-in Explore agent. <!-- req: permissions.behavior.Agent (subagents).Agent(Explore) --> |
   | `Agent(Plan)` | The built-in Plan agent. <!-- req: permissions.behavior.Agent (subagents).Agent(Plan) --> |
   | `Agent(my-custom-agent)` | A custom agent named `my-custom-agent`; a plugin agent goes by its namespaced name (§5). <!-- req: permissions.behavior.Agent (subagents).Agent(my-custom-agent) --> |

2. `Skill(...)` rules and how a skill's names match are §4's.
3. `Cd` rules govern the `/cd` command, which only the user runs; Claude cannot call it. A bare
   `Cd` deny disables `/cd`; a `Cd(<pattern>)` deny refuses matching targets, checked against
   every spelling of the target and each link it resolves through. Any `Cd` allow rule switches
   `/cd` to allowlist mode: the resolved target must match an allow rule or `/cd` refuses. With no
   `Cd` rule, `/cd` prompts to trust an unfamiliar directory. Patterns take the `//`, `~/` and `/`
   anchors of §13.5.3 but match the whole directory path: `*` is exactly one segment, `**` any
   number, and a trailing `/**` also matches its root.

   | Rule | Matches | Does not match |
   | --- | --- | --- |
   | `Cd(~/code/*)` | `~/code/app` | `~/code/app/src`, `~/code` <!-- req: permissions.behavior.Cd.Cd(~/code/*) --> |
   | `Cd(~/code/**)` | `~/code` and every directory under it | A directory outside `~/code` <!-- req: permissions.behavior.Cd.Cd(~/code/**) --> |
   | `Cd(**/node_modules)` | A `node_modules` directory at any depth under the cwd | `node_modules/pkg` <!-- req: permissions.behavior.Cd.Cd(**/node_modules) --> |

## 13.9 Permission modes

1. The permission mode sets the baseline for a call no rule decides. Its value is the SDK's
   `PermissionMode`; `manual` is accepted everywhere a mode is typed as an alias of `default`, which
   the CLI and the IDE surfaces label Manual. Rules layer on top of every mode: deny rules block in
   every mode, `bypassPermissions` included; ask rules prompt in every mode (deny in `dontAsk`);
   allow rules have no effect in `bypassPermissions`.

   | Mode | Runs without asking | Status bar |
   | --- | --- | --- |
   | `default` | Reads; every other tool prompts on first use. <!-- req: permissions.mode.default --> | `⏸ manual mode on` |
   | `acceptEdits` | Also file edits and common filesystem commands on paths in the working directories (§13.9.2). <!-- req: permissions.mode.acceptEdits --> | `⏵⏵ accept edits on` |
   | `plan` | Reads and read-only shell commands, plus classifier-approved commands when auto mode is available; edits wait for an approved plan (§13.9.3). <!-- req: permissions.mode.plan --> | `⏸ plan mode on` |
   | `auto` | Everything the classifier approves (§13.9.4). <!-- req: permissions.mode.auto --> | `⏵⏵ auto mode on` |
   | `dontAsk` | Reads in the working directories, the read-only commands and pre-approved calls; whatever would prompt is denied (§13.9.5). <!-- req: permissions.mode.dontAsk --> | `⏵⏵ don't ask on` |
   | `bypassPermissions` | Everything except the actions of §13.10.1 (§13.9.6). <!-- req: permissions.mode.bypassPermissions --> | `⏵⏵ bypass permissions on` |

2. `permissions.disableBypassPermissionsMode` and `permissions.disableAutoMode` (top-level
   `disableAutoMode` too), set to `"disable"` in any settings file, MUST keep the session out of
   that mode (§13.13).

### 13.9.1 Which mode a session starts in

1. A new terminal session MUST take its mode from the first of: the `--permission-mode` flag (or
   `--dangerously-skip-permissions`, which is `bypassPermissions`); `permissions.defaultMode` from
   the highest settings file that sets it (§12); the built-in default. An unknown flag value is
   refused (Judgment J13.21). <!-- req: permissions.modes.Which mode a session starts in -->
2. `defaultMode` `"auto"` in `.claude/settings.json` or `.claude/settings.local.json` MUST NOT take
   effect, and the session then uses the built-in default, not a lower user-settings value;
   `"bypassPermissions"` from those two files MUST NOT take effect either, and the session starts in
   `default`. Every other value applies from any file.
3. The built-in default is the first row that applies:

   | Session | Built-in mode |
   | --- | --- |
   | Any settings file sets `disableAutoMode` to `"disable"` | `default` <!-- req: permissions.modes.Which mode a session starts in.disableAutoMode --> |
   | `claude -p` or the Agent SDK | `default` <!-- req: permissions.modes.Which mode a session starts in.claude -p --> |
   | The organisation's HIPAA configuration applies to the session | `default`; auto stays selectable |
   | A terminal or the VS Code extension | `auto` |

4. A mode of `auto` from any source starts the session in `default` when auto mode is not
   available: the model does not support it, a settings file disables it, or Anthropic turned it
   off. The first session the built-in default starts in auto shows a one-time notice; the
   `skipAutoPermissionPrompt` key skips the notice a user's own first entry into auto shows.
5. To start one session in another mode, the user passes the flag (`claude --permission-mode
   default`); for every session, `defaultMode` in user, project (all values but `auto` and
   `bypassPermissions`) or managed settings. Sessions the VS Code extension starts read `defaultMode`
   only from user, managed and `--settings` files. <!-- req: permissions.modes.Start in a different permission mode.One session you're about to start -->
6. In `claude -p` and Agent SDK runs with no mode set, the session is in `default` and a call that
   needs approval MUST be denied unless an allow rule, a hook, the SDK's `canUseTool` callback or
   `--permission-prompt-tool` approves it; there is no prompt. <!-- req: permissions.modes.Tool calls denied in claude -p and Agent SDK runs -->
7. Shift+Tab cycles a running terminal session: from `auto` to `default`, then `default` →
   `acceptEdits` → `plan`, then the optional modes, `bypassPermissions` before `auto`. `auto` is in
   the cycle when available; `bypassPermissions` only when the session was started with it enabled
   (`--permission-mode bypassPermissions`, `--dangerously-skip-permissions`,
   `--allow-dangerously-skip-permissions`, or `defaultMode` `"bypassPermissions"` in user,
   `--settings` or managed settings); `dontAsk` never, only by flag.

### 13.9.2 `acceptEdits`

1. The client MUST approve without a prompt file creation and edits, and the Bash commands `mkdir`,
   `touch`, `rm`, `rmdir`, `mv`, `cp` and `sed`, when every path they name is inside the working
   directories (the session's and `additionalDirectories`); except for `touch`, also when prefixed
   by a safe assignment or a wrapper (§13.4.3). With the PowerShell tool, `Set-Content`,
   `Add-Content`, `Clear-Content` and `Remove-Item` and their aliases are approved the same way; a
   positional argument holding a quote character still prompts. The command list is the one of
   `permission-modes.md`; the shorter list of `permissions.md` is illustrative (Judgment J13.32).
   <!-- req: permissions.modes.Auto-approve file edits with acceptEdits mode -->
2. These still prompt: paths outside the working directories, a write that resolves outside them
   through a link, writes to protected paths, critical-path removals (§13.10.2), `touch` with
   anything but plain paths, and every other command outside the read-only set.
3. `Remove-Item`, and `rd`, `rmdir`, `del` and `erase` run through `cmd`, get their own check in
   every mode, the first matching case applying: a system path (the filesystem root and its
   top-level directories, a drive root and its top-level directories, the home directory) is denied
   without a prompt; for `Remove-Item`, a wildcard target (a bare `*`, a target ending in `/*` or
   `\*`, a glob under a variable) is denied without a prompt, before any classifier; the working
   directory or a parent of it with `-Recurse` is treated as any call that needs approval in the
   mode, and `bypassPermissions` skips this case (`permission-modes.md`, "Remove-Item in
   PowerShell"). `CLAUDE_CODE_DISABLE_POWERSHELL_CMD_RM_DENY=1` in the launch environment turns off
   the `cmd` case only.

### 13.9.3 `plan`

1. Claude reads, explores and writes a plan; edits are not approved until the user approves the
   plan, which switches the session to the mode the chosen answer names (auto, `acceptEdits`, or
   `default` for manual review). A call nothing approves asks (Judgment J13.22). <!-- req: permissions.modes.Analyze before you edit with plan mode -->
2. A shell command during planning is decided by the first case that applies: in an interactive
   terminal session with bypass available, neither prompt nor classifier applies; with auto mode
   available and `useAutoModeDuringPlan` on (the default), the classifier reviews it (not a
   critical-path removal); otherwise a command outside the read-only set prompts, sandbox auto-allow
   included.
3. Plan mode keeps its blocks wherever the client runs without an interactive terminal (`-p`, the
   SDK, the VS Code panel). `defaultMode` `"plan"` in `.claude/settings.json` makes plan the project
   default for terminal sessions. <!-- req: permissions.modes.Set plan mode as the default -->

### 13.9.4 `auto`

1. Calls go through a fixed order, the first matching step winning: rules (with the exceptions
   below); read-only calls and edits in the working directory are approved; everything else goes to
   a classifier, a model the client asks whether the action fits the user's request; a block returns
   the reason to Claude. The classifier itself, its rules and its `autoMode` configuration are the
   host's (Judgment J13.23).
2. Exceptions to the rules step: protected-path writes go to the classifier even when an allow rule
   matches; no allow rule approves a critical-path removal; `requiresUserInteraction` MCP tools and
   connector tools set to `ask` prompt; a shell command that carries per-command allowed domains goes
   to the classifier even when an allow rule matches (the hosts are the host's input: the official
   `BashInput` and `MonitorInput` types carry no field for them, and none types PowerShell's input, so the host that
   lets Claude name them supplies them with the call; sandboxing.md, "Per-command allowed domains in
   auto mode"); content-scoped ask rules (`Bash(git push *)`)
   prompt; a write the symlink check resolves to a protected path the requested path does not name
   prompts; network reads prompt; the first read outside the working directories by Read, Grep or Glob prompts once,
   except in `-p` runs and background sessions.
3. Entering auto mode MUST suspend allow rules that grant arbitrary code execution — `Bash(*)`,
   `PowerShell(*)`, wildcarded interpreters and shell-wrapper prefixes, package-manager run commands, `Agent` and `Monitor`
   allow rules (Judgment J13.24) — and restore them on leaving. `autoMode.classifyAllShell: true`
   suspends every Bash and PowerShell allow rule while auto mode is active. A subagent's
   `permissionMode` is ignored under auto mode.
4. After 3 blocks in a row or 20 in a session, auto mode pauses and the client prompts; a `-p` run
   without a prompt tool skips the action and continues.

### 13.9.5 `dontAsk`

Every call that would prompt MUST be denied, though a mod (§10) may still approve some. Calls that
need no approval in Manual mode, allowed calls and calls a PreToolUse hook approves run. Calls
matching an ask rule are denied; `AskUserQuestion`, MCP tools marked
`_meta["anthropic/requiresUserInteraction"]` and connector tools set to `ask` are denied even when
allowed. No allow rule or hook approves a critical-path removal or a network read. Cloud sessions
ignore `defaultMode: "dontAsk"`. <!-- req: permissions.modes.Allow only pre-approved tools with dontAsk mode -->

### 13.9.6 `bypassPermissions`

1. Prompts and safety checks are skipped, writes to protected paths included, except the actions of
   §13.10.1, which still prompt or are denied, the cross-session messaging safeguards and the
   `Remove-Item` denies of §13.9.2. A read of another organisation's public artifact needs an
   approval this mode never asks for, so it does not happen. At an
   interactive terminal with bypass available, plan mode's blocks are not enforced, though ask rules
   and critical-path removals still prompt. <!-- req: permissions.modes.Skip all checks with bypassPermissions mode -->
2. The mode MUST be enabled at launch (`--permission-mode bypassPermissions`,
   `--dangerously-skip-permissions`, or `defaultMode` from user, `--settings` or managed settings);
   a session started without it cannot enter it. It is refused under `--restricted`, under
   `disableBypassPermissionsMode` (`--dangerously-skip-permissions` is rejected and a `defaultMode`
   of bypass starts in `default`; an agent's `permissionMode: bypassPermissions` is ignored), and on
   Linux and macOS as root or under `sudo` outside a recognised sandbox, with
   `--dangerously-skip-permissions cannot be used with root/sudo privileges for security reasons`.
3. The first interactive session entering the mode MUST show a warning dialog; accepting writes
   `skipDangerousModePermissionPrompt: true` to `~/.claude/settings.json`, declining exits. A
   non-interactive run shows no dialog. Cloud sessions ignore `defaultMode` `"bypassPermissions"`.
4. A background session honours the acceptance only from user or managed settings: with none
   recorded `claude --bg --permission-mode bypassPermissions` is refused; with it only in
   `.claude/settings.local.json` the request is ignored (bypass left out of the cycle, or the
   session starts in `default`) and the session shows
   `Bypass permissions was requested at launch and ignored · if that was you, ~/.claude/settings.json needs "skipDangerousModePermissionPrompt": true`.
   <!-- req: permissions.modes.Bypass permissions ignored in a background session -->

## 13.10 What no mode approves

### 13.10.1 Actions no mode auto-approves

No mode, `bypassPermissions` included, MUST auto-approve: a call an explicit ask rule matches; a
connector tool the organisation set to `ask`; a tool requiring user interaction (`AskUserQuestion`,
`requiresUserInteraction` MCP tools); a recognised `rm` or `rmdir` critical-path removal, or a
command flagged `Dangerous rm operation not ruled out — the shell may read this command differently than it was parsed`;
the cross-session messaging safeguards; a read outside the working directories under the read block
by a recognised file-reading Bash command or an unsandboxed retry (and any command the parser cannot
trace), unless the sandbox enforces the block; a `Write`, `Edit` or `NotebookEdit` outside them under
the write block, which is refused. In each, `dontAsk` denies and the other modes prompt or refuse as
the relevant section says. <!-- req: permissions.modes.Actions no mode auto-approves -->

### 13.10.2 Critical paths

A critical path is a target of `rm` or `rmdir` the client recognises as the filesystem root, a
top-level directory, the home directory, a Windows drive root or its top-level directories, the
working directory or a parent, or a glob under an additional working directory or its parents
(`permission-modes.md`, "Critical paths", lists the other forms: a glob under a variable, a command
substitution target, and so on). No allow rule or PreToolUse `"allow"` approves such a removal; in
a mode that asks, a `PermissionRequest` hook may answer the prompt, and a matching ask rule prompts
in every mode with no time limit. Per mode (`permission-modes.md`, "Critical-path removals in each
permission mode"):

| Mode | Critical-path removal |
| --- | --- |
| `default`, `acceptEdits` | Prompts. |
| `plan` | Prompts; when the classifier reviews planning commands (§13.9.3) and bypass is not available, as in `auto`. |
| `auto` | Prompts at a terminal, with a two-minute countdown; denied wherever the client cannot show that prompt. |
| `dontAsk` | Denied. |
| `bypassPermissions` | Prompts at a terminal, with the same countdown; elsewhere denied unless a `PermissionRequest` hook allows it, or, in `-p` and SDK runs, the `--permission-prompt-tool` or `canUseTool` callback decides. With `CLAUDE_CODE_EVEN_MORE_DANGEROUSLY_SKIP_PERMISSIONS=1` in the launch environment it runs with no prompt, in this mode only. |

A countdown that runs out denies the command; a key press stops it; after three unanswered
countdowns in a session further removals are denied at once until the user sends a message. With
`CLAUDE_CODE_DISABLE_DANGEROUS_RM_TIMEOUT=1` the `bypassPermissions` prompt has no time limit and
`auto` leaves the removal to the classifier. How a client maps "a terminal" and "elsewhere" onto its
own surfaces is Judgment J13.25.

### 13.10.3 Protected paths

1. Writes to the protected paths below MUST NOT be auto-approved by an allow rule from settings,
   since the check runs before allow rules. Per mode:

   | Mode | Protected-path write |
   | --- | --- |
   | `default` | Prompts <!-- req: permissions.modes.Protected paths.default --> |
   | `acceptEdits` | Prompts <!-- req: permissions.modes.Protected paths.acceptEdits --> |
   | `plan` | Allowed at an interactive terminal with bypass available; else to the classifier when auto mode is available, else prompts <!-- req: permissions.modes.Protected paths.plan --> |
   | `auto` | Goes to the classifier; under `--restricted` it prompts (Judgment J13.26) <!-- req: permissions.modes.Protected paths.auto --> |
   | `dontAsk` | Denied <!-- req: permissions.modes.Protected paths.dontAsk --> |
   | `bypassPermissions` | Allowed <!-- req: permissions.modes.Protected paths.bypassPermissions --> |

   <!-- req: permissions.modes.Protected paths -->
2. A prompt for a write in the project's `.claude/` or in `~/.claude/` MAY offer to allow edits there
   for the rest of the session. Where a link leads a write to a protected path the requested path
   does not name, a classifier route becomes a prompt.
3. Protected directories: `.git` <!-- req: permissions.modes.Protected paths..git -->, `.config/git`
   <!-- req: permissions.modes.Protected paths..config/git -->, `.vscode`
   <!-- req: permissions.modes.Protected paths..vscode -->, `.idea`
   <!-- req: permissions.modes.Protected paths..idea -->, `.husky`
   <!-- req: permissions.modes.Protected paths..husky -->, `.cargo`
   <!-- req: permissions.modes.Protected paths..cargo -->, `.devcontainer`
   <!-- req: permissions.modes.Protected paths..devcontainer -->, `.yarn`
   <!-- req: permissions.modes.Protected paths..yarn -->, `.mvn`
   <!-- req: permissions.modes.Protected paths..mvn -->; `.claude`, except Claude's worktrees under
   `.claude/worktrees/`, the session's own plan files in `~/.claude/plans/` (or `plansDirectory`), a
   background session's `~/.claude/jobs/<id>/tmp/`, and Markdown files in the auto-memory and
   subagent-memory directories outside `--restricted` <!-- req: permissions.modes.Protected paths..claude -->;
   a directory loaded with `--plugin-dir`; and `~/.claude/dev-mods/` (or `dev-mods/` under
   `CLAUDE_CONFIG_DIR`), where Claude saves the mods it writes. <!-- req: permissions.modes.Protected paths.~/.claude/dev-mods/ -->
4. Protected files: `.gitconfig` <!-- req: permissions.modes.Protected paths..gitconfig --> and
   `.gitmodules`; `.bashrc` <!-- req: permissions.modes.Protected paths..bashrc -->, `.bash_profile`,
   `.bash_login`, `.bash_aliases`, `.bash_logout`, `.zshrc`, `.zprofile`, `.zshenv`, `.zlogin`,
   `.zlogout`, `.profile`, `.envrc`; `.npmrc` <!-- req: permissions.modes.Protected paths..npmrc -->,
   `.yarnrc`, `.yarnrc.yml`, `.pnp.cjs`, `.pnp.loader.mjs`, `.pnpmfile.cjs`, `bunfig.toml`,
   `.bunfig.toml`; `.bazelrc` <!-- req: permissions.modes.Protected paths..bazelrc -->,
   `.bazelversion`, `.bazeliskrc`; `.pre-commit-config.yaml`
   <!-- req: permissions.modes.Protected paths..pre-commit-config.yaml -->, `lefthook.yml`,
   `lefthook.yaml`, `.lefthook.yml`, `.lefthook.yaml`; `gradle-wrapper.properties`
   <!-- req: permissions.modes.Protected paths.gradle-wrapper.properties --> and
   `maven-wrapper.properties`; `.devcontainer.json`
   <!-- req: permissions.modes.Protected paths..devcontainer.json -->; `.ripgreprc`
   <!-- req: permissions.modes.Protected paths..ripgreprc --> and `pyrightconfig.json`; `.mcp.json`
   <!-- req: permissions.modes.Protected paths..mcp.json --> and `.claude.json`;
   `remote-settings.json` in the configuration directory, with the signature, sync and consent files
   the client keeps beside it, whose names are the client's own (Judgment J13.35)
   <!-- req: permissions.modes.Protected paths.remote-settings.json -->; a file passed
   to `--settings`, `--mcp-config` or `--agents`; and the target of a user, project or local settings
   file that is a symbolic link: in the modes that route protected-path writes to the classifier, a
   write to that target prompts instead, even when an allow rule matches, unless the target's own
   path is also a settings file's (another folder's `.claude/settings.json`), which goes to the
   classifier like any protected-path write.
5. Under `blockWritesOutsideWorkingDirectories`, writes to settings files are refused in every mode
   (§13.12.2).

## 13.11 Hooks, mods and rules

1. PreToolUse hooks run before the permission prompt, for every tool but `EndConversation`, and may
   deny the call, force a prompt or skip the prompt (§7). A hook decision MUST NOT bypass a rule: a
   matching deny rule blocks and a matching ask rule prompts even when the hook returned `"allow"`.
   This holds for hooks in settings files and in a plugin's `hooks/hooks.json` alike. A hook that
   blocks (exit code 2) stops the call before rules are evaluated, so the block holds over any allow
   rule. A hook's `"allow"` does not skip the prompt of a `requiresUserInteraction` MCP tool, a
   network read or a connector tool set to `ask`, and does not approve a critical-path removal or a
   protected-path write (Judgment J13.27). <!-- req: permissions.behavior.Precedence among rules, hooks, and mods -->
2. A mod that handles `tool.check` answers after the PreToolUse hooks (§10). With managed settings,
   a `managed-mcp.json` or a Team or Enterprise login as the session's credential, a mod's approval
   leaves deny rules refusing, ask rules, hook asks and the read block prompting, hook blocks
   blocking, and the prompt tool or `canUseTool` callback asked; the managed guard option
   `allowModsToOverrideDenyRules` lifts the rule outcomes and those of hooks outside managed
   settings, never a managed hook's decision or the callback (§14.9.6, Judgment J14.14). Without
   managed settings, a `managed-mcp.json` or such a login, a mod's approval lifts all of these. In every setup: under auto mode a mod's approval skips the
   classifier unless the callback could not be bypassed; under plan mode a mod cannot approve a call
   that is not read-only; under `dontAsk` it may approve what only the mode would deny. A mod never
   skips the prompt of a tool that requires user interaction.
3. In plan mode, apart from `ExitPlanMode`, a PreToolUse `"allow"` MUST have no effect on a call that
   is not read-only: the call gets what it would get with no hook, and any `updatedInput` still
   applies. `ExitPlanMode` answered `"allow"` with `updatedInput` runs without a prompt. A mod may
   block but not approve such a call. Approving the plan or leaving plan mode lifts this. <!-- req: permissions.behavior.Hook approvals in plan mode -->
4. With sandboxing on and `autoAllowBashIfSandboxed` at its default `true`, a sandboxed Bash command
   runs without a prompt despite a bare `Bash` (or `Bash(*)`) ask rule, except in plan mode;
   content-scoped ask rules still prompt.

## 13.12 Working directories

1. The primary working directory is the one the session started in, until `/cd` moves it. A user
   adds directories at startup with `--add-dir <path>`, during the session with `/add-dir`, and
   persistently with `permissions.additionalDirectories`. Files there follow the same rules: readable
   without a prompt apart from the network check, editable as the mode says. A network path cannot
   be added; one given at startup is dropped with a debug-log warning.
   <!-- req: permissions.behavior.Working directories.During startup | permissions.behavior.Working directories.During session | permissions.behavior.Working directories.Persistent configuration -->
2. An added directory grants file access, not configuration. From `--add-dir` and `/add-dir`
   directories only (and the SDK's `additionalDirectories`, passed as `--add-dir`), the client loads
   `.claude/skills/` (live), `.claude/commands/` (the project's command wins a name clash),
   `.claude/agents/`, the `enabledPlugins` and `extraKnownMarketplaces` keys of their settings, and
   `CLAUDE.md`, `.claude/rules/` and `CLAUDE.local.md` only with
   `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1` (`CLAUDE.local.md` also needs the `local` setting
   source). Skills, commands and agents from these directories load through the `project` setting
   source, so excluding it (`--setting-sources`, `settingSources`) skips them, and bare mode skips the
   commands and agents. Directories in
   `permissions.additionalDirectories` load none of it. `/add-dir` on a subdirectory of the primary
   working directory loads its skills, commands and agents without adding a directory.
3. Output styles load from the cwd and its parents, `~/.claude/` and managed settings; hooks and
   other settings keys from the cwd's `.claude/` with no parent fallback, plus user and managed
   settings; `.claude/settings.local.json` from the git repository root (§12). To share configuration
   across projects an author uses user-level files (`~/.claude/agents/`, `~/.claude/output-styles/`,
   `~/.claude/settings.json`), a plugin, or launches from the directory holding the `.claude/`.
   <!-- req: permissions.behavior.Where output styles, hooks, and local settings load from.User-level configuration | permissions.behavior.Where output styles, hooks, and local settings load from.Plugins | permissions.behavior.Where output styles, hooks, and local settings load from.Launch from the config directory -->

### 13.12.1 Moving the session

`/cd <path>` keeps the conversation, loads the new directory's `CLAUDE.md`, and prompts for
workspace trust if needed (§13.15); declining keeps the session where it is. On moving, the client
MUST apply the new directory's project settings (rules and hooks), its `.mcp.json` and local-scope
MCP servers under the usual approval, the plugins its settings enable, its skills and agents, and its
`env` on top of the previous; it disconnects the previous directory's project and local servers and
the servers of plugins no longer enabled, takes `additionalDirectories` from the new settings, keeps
`--add-dir`/`/add-dir` directories, and keeps `${CLAUDE_PROJECT_DIR}` at the starting root. An
untrusted target's trust prompt lists the allow rules, directories, hooks and helpers it would
activate. `Cd` rules (§13.8) restrict targets. <!-- req: permissions.behavior.Move the session to another directory -->

### 13.12.2 The read and write blocks

1. `permissions.blockReadsOutsideWorkingDirectories: true` MUST make Read, Grep, Glob and LSP refuse
   paths outside the working directories in every mode, telling Claude to ask for `/add-dir`; the
   client's own files under `~/.claude/` (skills, plugins, rules, agents, commands, `CLAUDE.md`) stay
   readable. `permissions.blockWritesOutsideWorkingDirectories: true` MUST make Write, Edit and
   NotebookEdit refuse paths outside them in every mode, with
   `<path> is outside <dirs>; the permissions.blockWritesOutsideWorkingDirectories setting blocks writes outside the working directories. Ask the user to add the directory with /add-dir, or to remove that setting.`,
   (or `<path>: Writes outside the working directories are blocked (permissions.blockWritesOutsideWorkingDirectories). Add the directory with /add-dir, or remove that setting.`;
   errors.md, "Setting blocks writes outside the working directories"), and removes or refuses
   `EnterWorktree` and `ExitWorktree`; it does not limit shell commands, MCP
   tools or hook programs. <!-- req: permissions.behavior.Block file-tool reads and writes outside the working directories -->
2. Only `--add-dir`, `/add-dir` and `additionalDirectories` in user or managed settings (or in a
   `.claude/settings.local.json` git reports as untracked) count as working directories for the
   blocks; a directory only repository settings add (`.claude/settings.json`, or a local file that
   is tracked or outside a git repository) does not. No allow
   rule lets a file tool through either block; adding the directory does. <!-- req: permissions.reference.Let one directory through the read or write block -->
3. The write block also refuses Claude Code settings files inside the working directories, with
   `<path>: Writes to Claude Code settings files are blocked while permissions.blockWritesOutsideWorkingDirectories is on, because a settings file can lift that block. While a managed settings folder cannot be resolved, any .json file counts as one.`
   (Judgment J13.28 names the files; adding a directory never lifts this case), a directory only repository settings add, an
   `isolation: worktree` subagent's worktree outside the working directories, and auto memory in a
   directory repository settings chose. Plan files, the scratchpad, a background session's `tmp`
   and this project's auto-memory `.md` files stay writable. <!-- req: permissions.reference.What the write block refuses and what stays writable -->
4. With sandboxing on, the read block also covers sandboxed commands: they lose read access to the
   home directory and `/Users`, `/home`, `/root`, `/Volumes`, `/mnt`, `/media`, `/run/media` and
   `/srv`, then regain the working directories, session worktrees, the session temp directory, the
   parts of `~/.claude` commands need, and the global git configuration files (`~/.gitconfig`, the
   `config`, `ignore` and `attributes` files under `$XDG_CONFIG_HOME/git`, and the files they name
   through `[include]`, `[includeIf]`, `core.excludesFile` or `core.attributesFile`), judged file by
   file: a configuration file a sandboxed command can write, directly or through a link, does not get
   the files it names re-opened. `~/.git-credentials` and `$XDG_CONFIG_HOME/git/credentials` stay
   blocked and a `denyRead` entry wins. In a linked git worktree the repository's common `.git`
   directory stays readable and writable to sandboxed commands, so `git commit` can update refs and
   the index, except `hooks/` and `config` inside it, which stay write-denied
   <!-- docs: sandboxing.md | Filesystem isolation -->. Repository `allowRead` and
   `allowWrite` entries do not count. The block does not reach
   sandboxed commands when filesystem isolation is off, `allowManagedReadPathsOnly` is set, or the
   start directory's path holds a glob character. <!-- req: permissions.reference.Sandboxed commands under the block -->

## 13.13 Settings keys

| Key | Scope | Type and meaning |
| --- | --- | --- |
| `permissions` | Any file | Object holding the keys below. <!-- req: permissions.setting.permissions --> |
| `permissions.allow` | Any file; a project's only after trust (§13.15) | Rules approved without a prompt; `--allowedTools` adds for one session. <!-- req: permissions.setting.permissions.allow --> |
| `permissions.ask` | Any file | Rules that prompt even where the mode would approve; `dontAsk` denies them. <!-- req: permissions.setting.permissions.ask --> |
| `permissions.deny` | Any file | Rules that block; matching files are also left out of discovery and search results. `--disallowedTools` adds for one session. Replaces the deprecated `ignorePatterns`. <!-- req: permissions.setting.permissions.deny --> |
| `permissions.additionalDirectories` | Any file; a project's only after trust | Directory paths added as working directories (§13.12). <!-- req: permissions.setting.permissions.additionalDirectories --> |
| `permissions.defaultMode` | Any file, with §13.9.1's exceptions | A `PermissionMode` or `manual`. <!-- req: permissions.setting.permissions.defaultMode --> |
| `permissions.disableBypassPermissionsMode` | Any file | `"disable"` (§13.9.6). <!-- req: permissions.setting.permissions.disableBypassPermissionsMode --> |
| `disableAutoMode` (also `permissions.disableAutoMode`) | Any file | `"disable"`: removes auto from the cycle; a session that would start in auto starts in `default`; a running auto session leaves it when the value arrives from an admin source, showing `auto mode disabled by settings`. <!-- req: permissions.setting.disableAutoMode --> |
| `permissions.blockReadsOutsideWorkingDirectories` | Any file; a `true` anywhere applies | Boolean (§13.12.2). The auto-mode first-read prompt can write `true` to user settings. <!-- req: permissions.setting.permissions.blockReadsOutsideWorkingDirectories --> |
| `permissions.blockWritesOutsideWorkingDirectories` | Any file; a `true` anywhere applies | Boolean (§13.12.2); also on while the managed `permissions` object cannot be read (§14). <!-- req: permissions.setting.permissions.blockWritesOutsideWorkingDirectories --> |
| `permissions.denyInsteadOfPrompting` | User, managed and `--settings` | Boolean (§13.13.1). <!-- req: permissions.setting.permissions.denyInsteadOfPrompting --> |
| `autoMode` | User or managed, and `--settings` (the flag or the Agent SDK's inline settings; `auto-mode-config.md`, "Where the classifier reads configuration"); never project or local | Object of prose-rule arrays `environment`, `allow`, `soft_deny`, `hard_deny` for the classifier; `"$defaults"` keeps the built-in entries at its position; arrays from several files concatenate. <!-- req: permissions.setting.autoMode --> |
| `autoMode.classifyAllShell` | Wherever `autoMode` is read | Boolean, default `false` (§13.9.4). <!-- req: permissions.setting.autoMode.classifyAllShell --> |
| `useAutoModeDuringPlan` | User, local or managed; a `false` in any of them or `--settings` wins | Boolean, default `true` (§13.9.3). <!-- req: permissions.setting.useAutoModeDuringPlan --> |
| `skipAutoPermissionPrompt` | User or managed | Boolean: skip the first-entry auto notice. <!-- req: permissions.setting.skipAutoPermissionPrompt --> |
| `skipDangerousModePermissionPrompt` | User, local or managed | Boolean: skip the bypass dialog (§13.9.6). <!-- req: permissions.setting.skipDangerousModePermissionPrompt --> |
| `allowManagedPermissionRulesOnly` | Managed | §13.3 and §14. |

A `false` for any Boolean block or lock key is the same as unset: another file's `true` still
applies. How an unreadable value of these keys is read in managed settings is §14.

### 13.13.1 `denyInsteadOfPrompting`

1. With the key `true`, a call that would wait on a prompt MUST be denied and the turn continue; a
   call an allow rule, the mode or the classifier approves runs, and a `PermissionRequest` hook (§7)
   may still answer. It applies in `-p` runs, terminal sessions, the IDE and desktop surfaces,
   subagents and agent teams.
2. With it on, the client also leaves out `AskUserQuestion`, `EnterPlanMode` and `ExitPlanMode` (a
   teammate keeps the two plan tools) <!-- req: permissions.reference.What else denyInsteadOfPrompting stops.Question and plan tools -->;
   cancels an MCP elicitation no `Elicitation` hook answers <!-- req: permissions.reference.What else denyInsteadOfPrompting stops.MCP elicitation -->;
   asks neither `canUseTool` nor `--permission-prompt-tool`, so code approves through a
   `PermissionRequest` hook, though some calls are denied before any hook is asked (an `auto`-mode
   critical-path removal no ask rule covers) <!-- req: permissions.reference.What else denyInsteadOfPrompting stops.Permission hosts -->;
   and denies the actions that need a billing-notice dialog. The workspace trust dialog and project
   MCP approval still wait.
3. The denial Claude reads opens with
   `Permission for this tool use was denied. It requires approval, and this session has no approval surface`;
   `stream-json` reports the `decision_reason`
   `no approval surface in this session; permission request denied automatically`. In auto mode,
   after 20 calls in a row refused with no work in between, the turn ends with
   `20 actions were refused and no work went ahead in between, so Claude stopped.`, which a `-p` run
   reports as `error_during_execution`. <!-- req: permissions.reference.Messages from denyInsteadOfPrompting -->

## 13.14 Plugin components and permissions

What a plugin contributes meets the rules as follows; the trust side is §13.18.

1. **Skills and commands**: `allowed-tools` (a command entry's `allowedTools`) grants its rules for
   the invoking turn and is not gated by workspace trust; `disallowed-tools` removes tools; both are
   §4.9.2, and `allowManagedPermissionRulesOnly` drops `allowed-tools` from the sources §4.9.2 names.
   Deny and ask rules still win over a skill's grant, by §13.3. The `Skill` tool itself is governed by
   rules (§4).
2. **Agents**: `tools` and `disallowedTools` shape a subagent's pool (§5); every subagent's calls go
   through the session's rules; a plugin agent's `permissionMode`, `hooks` and `mcpServers` are
   ignored (§5.6.1); `Agent(<plugin>:<agent>)` rules name it.
3. **Hooks**: a plugin hook's permission decisions are bound by §13.11 exactly as a settings hook's.
4. **MCP servers**: a plugin server's tools are named `mcp__plugin_<plugin>_<server>__<tool>` and
   matched by §13.7.
5. **`bin/`**: running a plugin executable is a Bash call, matched by its command text.

Judgments J13.1–J13.28 and J13.32 are below (J13.29–J13.31 are in 13-trust.md).

## Design decisions

### Why deny wins over every allow, however specific

A rule list that resolves by specificity lets a narrow allow written by a less trusted source
(a repository, a plugin's skill) override a broad deny written by a more trusted one (the user, the
organisation). Evaluating deny before ask before allow, across every source, makes a deny a
guarantee whoever wrote it. The cost, that an exception must be carved by narrowing the deny rather
than by adding an allow, is borne by the person who wrote the deny.

### Why Bash rules match text and not programs

A rule is checked before the command runs, from its text alone; it cannot know what `/usr/bin/curl`
or `sh -c` will do. Stating that rules are matched against the command as written, and naming the
forms they miss, keeps clients from implying a boundary the text cannot provide; the sandbox and
hooks are the places that see the program.

## Judgments

| Id | Decision | Evidence |
| --- | --- | --- |
| J13.1 | Surrounding whitespace of a rule is trimmed; `Tool()` reads as `Tool`; a tool-name glob with a specifier is skipped as an error. The wording of skipped-rule reports other than the two errors.md quotes is the client's, and their severity is `error` for a malformed rule, an `mcp__` rule with parentheses in a settings file and a glob with a specifier, `warning` for an ignored primary-field rule and an unanchored allow glob. | permissions.md gives the grammar and says "skipped"; *reference* `src/rules/parse.ts`. |
| J13.2 | A tool-name glob knows only `*` (case-sensitive, whole name); `?` and `[...]` are literal. | Every example of "Tool name wildcards" uses `*`; *reference* `src/rules/tool-pattern.ts`. |
| J13.3 | A rule naming two parameters (`Agent(model:opus, isolation:worktree)`) reads the text after the first colon as one value and matches neither call. | The docs say to write two rules, not what a combined rule does; *reference* `src/rules/param.ts`. |
| J13.4 | A number or boolean input compares as its text (`run_in_background:true` matches `true`, `timeout:5000` the number 5000); an object, array, null or missing field never matches; whitespace is trimmed at both ends of the name and the value. | The docs say "the literal input" and "scalar parameter"; *reference* `src/rules/param.ts`. |
| J13.5 | `name:value` is a parameter rule only in a deny or ask rule and only when `name` is a field of the tool's input (the SDK's input types; for PowerShell, Bash's fields); `name:*` at the end of a Bash, Monitor or PowerShell rule stays the `:*` suffix; `domain:` is WebFetch's own form; for Agent the name must be a field of `AgentInput` and for Skill it must be `skill`, so `Skill(deploy:deploy)` and `Agent(acme:reviewer)` stay names. | permissions.md fixes both forms but not how they are told apart; `git:* push` and `C:\x` must stay patterns; *reference* `src/rules/param.ts`, `src/rules/specifier-formats.ts`. |
| J13.6 | The wildcard-before-subcommand warning applies to a `Bash` allow rule whose first `*` follows only options after the program and is followed by a literal word (`git * main`, `git -C * status *`), never to `Bash(git log * main)`, to a rule with a wildcard program, or to a deny or ask rule; the git sentence is added only for a `git` rule. | errors.md gives two examples and one source; *reference* `src/rules/bash/wildcard-warning.ts`. |
| J13.7 | The command is split by a quote-aware scanner at the documented separators outside quotes and after a backslash; a `&` belonging to a redirect (`2>&1`, `&>`) is not a separator; `$()`, backticks, `( )`, process substitution and function bodies hold subcommands; `#` at a word start begins a comment. Unparseable are only: nothing after `&&` or `\|\|`, an unclosed quote, substitution or bracket, and nesting past the parser's depth. The 10,000-character limit belongs to the read-only set, not to rule matching. An unparseable command matches no allow rule; deny and ask rules still try its subcommands. | permissions.md names the separators and one unparseable form; *reference* `src/rules/bash/split.ts`, `scanner.ts`. |
| J13.8 | The known-safe environment variables are one table with a value check each, used by the read-only set and the allow rules alike: `LANG`, `LC_ALL`, `LC_CTYPE` take `C`, `POSIX`, empty or a UTF-8 locale; `COLUMNS`, `LINES` an integer; `TZ` a zone without a `..` segment; `NODE_ENV`, `NO_COLOR`, `LC_TIME`, `LANGUAGE`, `TERM`, `FORCE_COLOR`, `CLICOLOR`, `CI`, `RUST_LOG`, `RUST_BACKTRACE`, `PYTHONUNBUFFERED`, `PYTHONDONTWRITEBYTECODE`, `GOOS`, `GOARCH`, `GREP_COLOR`, `LS_COLORS`, `BLOCK_SIZE`, `TIME_STYLE` any value. A value the shell expands is never safe. A host MAY add variables, with any value, for the allow rules. An assignment is `NAME=value` with an identifier name. | permissions.md ("Wrappers") names `NODE_ENV` and says "certain known-safe"; permission-modes.md adds `LANG` and `NO_COLOR`; changelog.md names `LANG`, `TZ`, `NO_COLOR`, "etc.", so the set is wider than the three examples. Lead: the reference implementation's `src/rules/bash/safe-env.ts`, which records Claude Code 2.1.322 letting `LANG=C ls`, `LC_CTYPE=C echo hi` past `Bash(echo hi)` and asking for `LANG=x ls`, `LANG=en_US.ISO-8859-1 ls`, `COLUMNS=wide ls`, `TZ=../../etc ls`, `FOO=1 ls`. |
| J13.9 | Besides the documented `find` actions, `-execdir`, `-ok`, `-okdir`, `-fprint0`, `-fprintf` and `-fls` need an exact rule; the guard sees through wrappers and assignments and applies to allow rules holding `*` or `:*`, never to deny or ask rules. | The docs give the class ("runs commands, deletes files, or writes files") and four examples; *reference* `src/rules/bash/exec-wrappers.ts`. |
| J13.10 | The read-only forms of `git` are `status`, `log`, `diff` and `show` (without `--output`) and `branch` with listing flags only, the subcommand directly after `git`; `node -v`, `node --version`, `python --version` and `python3 --version` alone are read-only too. | permissions.md says "read-only forms of `git`" and "The set includes"; *reference* `src/rules/decide/read-only-set.ts`, *oracle* 2.1.319 for the version forms. |
| J13.11 | The special shell variables are `PATH`, `IFS`, `CDPATH`, `ENV`, `BASH_ENV`, `SHELLOPTS`, `BASHOPTS`, `PS4`, `PROMPT_COMMAND`, `GLOBIGNORE`, `LD_PRELOAD`, `LD_LIBRARY_PATH`, `DYLD_INSERT_LIBRARIES` and `DYLD_LIBRARY_PATH`. | The docs name `PATH` and `IFS` as examples of "certain special shell variables"; *reference* `src/rules/decide/read-only-set.ts`. |
| J13.12 | A redirect's target prompt is lifted by an `Edit` (output) or `Read` (input) allow rule covering the file, or by a tool-wide `Bash` allow in force (`Bash`, `Bash(*)`), never by a prefix rule; `bypassPermissions` checks no target; a target a variable or substitution hides needs approval. | permissions.md: "A rule such as `Bash(git commit *)` allows the command, not the target"; *reference* `src/rules/decide/redirects.ts` (oracle 2.1.322 there). |
| J13.13 | Beyond `gci`, `ls` and `dir`, the built-in aliases of Windows PowerShell 5.1 and 7 are resolved, on the first word of each subcommand and of the rule; `&`, `.` and a module-qualified name are read as the cmdlet. | permissions.md: "Common aliases are canonicalized", three examples; *reference* `src/rules/bash/powershell-aliases.ts`. |
| J13.14 | `./path` has the anchor of `path`, but a bare name or glob with no slash after `./` (`./.env`, `./*.env`) is anchored at the cwd and does not match at any depth, unlike `Read(.env)`; each leading `../` moves the anchor one directory up. | permissions.md lists the two as one type yet says `Read(./.env)` matches "the `.env` file in the current directory"; *reference* `src/rules/path/anchor.ts`. |
| J13.15 | A `/path` rule from managed settings, or from an embedding host's policy, anchors at the primary working directory, like command-line and session rules; a relative `--settings` path resolves against the primary working directory. | The anchor table lists five sources and no managed tier; *reference* `src/rules/path/anchor.ts`. |
| J13.16 | "A relative pattern with a single directory segment" is one literal directory name, one slash and something below it (`src/**`, `src/*.ts`, `src/index.ts`, `src/**/*.ts`); a pattern starting with `/`, `**` or `!`, or with a second directory segment, is not one. Path matching is case-sensitive on POSIX hosts and case-insensitive on Windows. | permissions.md gives `src/**` and `secrets/**`; *reference* `src/rules/path/depth.ts`, `glob.ts`. |
| J13.17 | A `*` inside a label (`docs-*.example.com`) matches any run within that label and never a dot; non-ASCII labels compare in punycode. | permissions.md: "matches only the text between two dots"; *reference* `src/rules/target/domain.ts`. |
| J13.18 | A URL that does not parse or has no host matches no `domain:` rule, `domain:*` included; a WebFetch specifier without `domain:` matches nothing. | Domain rules are defined over "the hostname of the requested URL"; *reference* `src/rules/target/domain.ts`. |
| J13.19 | As an allow rule, `mcp__<server>` covers `mcp__<server>__<tool>` only when `<server>` holds no `__`, does not end in `_` and `<tool>` holds no `__`; deny and ask rules also cover any name that starts with the rule's name and `__`. | permissions.md gives the `reports__v2` outcomes; a call carries no separate server name; *reference* `src/rules/target/mcp.ts`. |
| J13.20 | `Agent(<name>)` compares exactly with the call's `subagent_type` (case-sensitive, `*` literal); a call without `subagent_type` counts as `general-purpose` for deny and ask rules and matches no allow rule; `Agent(fork)` names the fork. | permissions.md and sub-agents.md give names only; *reference* `src/rules/target/agent.ts`. |
| J13.21 | An unknown `--permission-mode` value refuses the session start; a `defaultMode` of `bypassPermissions` that `disableBypassPermissionsMode` locks starts in `default`; a bypass request from `defaultMode` is held to the background-session acceptance like the flag; `--allow-dangerously-skip-permissions` with no acceptance in a background session is ignored. | permission-modes.md names the flags and the lock, not an invalid value or `defaultMode` in a background session; *reference* `src/settings/permissions/default-mode.ts`. |
| J13.22 | In plan mode a file edit or other call nothing approves asks (it is not denied), and an allow rule approves what it covers, as in `default`; only hook and mod approvals are void there. | The docs say edits "stay blocked until you approve the plan" and that a hook allow gets "the same prompt, block, or approval the call would get with no hook"; *reference* `src/rules/decide/modes.ts`. |
| J13.23 | The classifier is a host component outside this specification; with none, a call routed to it is denied, and its rule lists (`claude auto-mode defaults`) are not stated here. | permission-modes.md: with no verdict "Claude Code denies the action rather than run it unreviewed"; the block lists change per release; *reference* `src/rules/decide/classifier.ts`. |
| J13.24 | Auto mode drops allow rules for wildcarded `python`, `python3`, `node`, `ruby` and `perl`, for wildcarded shell wrappers (`bash`, `sh`, `zsh` and their `-c` forms), and for `npm`, `yarn`, `pnpm` and `bun` `run` commands; `PowerShell(*)` counts as blanket. `classifyAllShell` suspends only Bash and PowerShell allow rules: the read-only set and in-scope edits keep their auto-mode outcome. | The docs name "wildcarded interpreters like `Bash(python*)`" and "Package-manager run commands" without a list, and settings-reference.md, `autoMode.classifyAllShell`, adds "interpreter or shell-wrapper prefixes"; the shell wrappers are the safer reading of that class; *reference* `src/rules/decide/auto-dropped.ts` (interpreters and package managers only). |
| J13.25 | "At a terminal" in §13.10.2 means any session that can show the user an interactive prompt; "elsewhere" every other surface. A client with a chat panel or desktop surface of its own treats it as the docs treat the VS Code panel and the desktop app (denied in `auto`; in `bypassPermissions` denied unless a `PermissionRequest` hook allows). | permission-modes.md, "Time limits and denials in auto and bypassPermissions modes", gives the outcome per Claude Code surface (terminal, VS Code panel, desktop, `-p`/SDK), not for other clients; *reference* `src/rules/decide/modes.ts`. |
| J13.26 | Under `--restricted`, a protected-path write that would go to the classifier prompts instead. | permission-modes.md says the classifier "can't approve" them, not what happens; *reference* `src/rules/decide/modes.ts`. |
| J13.27 | A hook `"allow"` does not approve a protected-path write (as an allow rule does not); a mod approval never approves a critical-path removal, a protected-path write, a network read or a tool requiring user interaction. The order a client applies is: no-permission tools; the read and write blocks; a hook block; deny rules; deny-covered redirect targets; ask rules; hook asks; critical-path removals; user-interaction tools; connector `ask` tools; network reads; the read-block shell prompt; protected paths; redirect prompts; allow rules; hook allows; read-only calls; the mode's baseline; then a mod's answer. | The docs state these precedences piecemeal; "no mode auto-approves" is read as no approval; *reference* `src/rules/decide/decide.ts`. |
| J13.28 | The settings files the write block refuses everywhere are `settings.json` and `settings.local.json` in a `.claude` directory or the configuration directory, `managed-settings.json`, and the files of errors.md's list (`--agents`, `--mcp-config` files, the stored server-managed settings and the files kept with it, and any `.json` file while the `managed-settings.d/` folder cannot be resolved). | settings-reference.md says "Claude Code settings files" without a list; errors.md, "Writes to Claude Code settings files are blocked", lists only the files beyond "your settings files"; *reference* `src/rules/decide/block-exceptions.ts`. |
| J13.32 | `acceptEdits` approves exactly the seven Bash commands `mkdir`, `touch`, `rm`, `rmdir`, `mv`, `cp` and `sed` (§13.9.2). | Not a silence but two lists: permission-modes.md, "Auto-approve file edits with acceptEdits mode", names all seven as the mode's set, while permissions.md ("Permission modes" table) and the summary table of permission-modes.md say "such as `mkdir`, `touch`, `mv`, and `cp`" / "`mkdir`, `touch`, `mv`, `cp`, etc.", which mark their lists as examples. The same section lists "Recognized `rm` and `rmdir` critical-path removals" among what still prompts in this mode, which presupposes that other `rm` and `rmdir` calls are approved. *reference* `src/rules/decide/fs-operands.ts` approves the seven and `src/rules/decide/critical-removal.ts` carves the critical paths out. |
| J13.33 | Where a rule warning goes (a row, stderr, the debug log) belongs to the client that presents the session; a rule engine without output returns each warning as a value (rule as written, behaviour, source, kind, and for `never matches` the suggested rule), and its caller formats and routes it as §13.2.1 item 3 and §13.5.2 say. | errors.md, "Matches no tool · check for typos" and "Is not matched by file permission checks", describes the texts and surfaces of the CLI only; a library embedded in another host has no row or stderr of its own, and returning the parts keeps both texts derivable. |
| J13.34 | `MultiEdit` is not a known tool name in 2.1.321: a bare `MultiEdit` deny or ask rule draws `matches no tool`, and `MultiEdit(<path>)` draws both `matches no tool` and `is not matched by file permission checks`; the `TaskOutput` exemption does not extend to it (§13.2.1 item 3). | permissions.md and errors.md call `MultiEdit` legacy and list its path rules among those file checks skip; §18 notes 2.1.321 offers no such tool. Oracle 2.1.325 (`claude -p` with `--settings` deny `MultiEdit`, `MultiEdit(docs/**)`, `Bsh`, `TaskOutput`, private config dir): stderr printed `Permission deny rule "MultiEdit" matches no known tool — check for typos.`, the same for `MultiEdit(docs/**)` and `Bsh`, then the `MultiEdit(docs/**) is not matched by file permission checks` line; nothing for `TaskOutput`. |
| J13.35 | The signature, sync and consent files kept beside `remote-settings.json` are protected by the client that writes them, under its own names: the contract is that every file the client keeps with its server-managed settings cache is protected, not a list of names. A library protects `remote-settings.json` in the configuration directory and the files its host names to it; it does not guess names (no prefix match). | permission-modes.md, "Protected paths", names the files by role only ("the signature, sync, and consent files Claude Code keeps with it"); claude-directory.md and server-managed-settings.md name only `remote-settings.json`. A guessed pattern would protect files Claude Code does not, and miss ones it does. |
| J13.36 | `Tool(*)` is the bare tool name only for the command format (Bash, Monitor); `Read(*)`, `Agent(*)` or `PowerShell(*)` is a specifier rule, so as a deny rule it refuses the calls its pattern matches and does not remove the tool. | permissions.md, "Match all uses of a tool", makes only `Bash(*)` equal to `Bash` and says only of those two forms that a deny removes the tool; "PowerShell" says `PowerShell(*)` matches every command, not that it removes the tool. tools-reference.md gives Monitor Bash's rule format. Lead: the reference implementation's row for `src/rules/specifier-formats.ts`. |
| J13.37 | The read-only set of §13.4.5 is of Bash commands; a PowerShell command is never read-only, so in Manual mode every PowerShell command prompts unless a rule, a hook or `acceptEdits` (§13.9) approves it. | permissions.md, "Read-only commands", says "a built-in set of Bash commands" and lists only Bash commands; "PowerShell" gives rules and the AST split but no read-only set; the network-path check "applies to PowerShell tool commands" without naming any that would run unprompted. A client that guessed PowerShell members would approve commands Claude Code may prompt for. Lead: the reference implementation's row for `src/rules/decide/powershell-edits.ts`. |
