# 11. Workflows

A *workflow* is a JavaScript script that orchestrates many subagents. The model writes one for a
task, the user saves it, or a plugin ships it; the client's workflow runtime executes it in the
background while the session stays responsive, and the model sees only the script's result.

This chapter has two halves. §11.1–§11.4 are the **plugin contract**: the file, where a plugin puts
it, how it is named, and the functions and globals a script may use. §11.5–§11.9 are the **host
engine**: how the runtime schedules, limits, restarts and resumes the agents a script starts. A
script written for Claude Code behaves the same in an Extended client only if both halves hold, so
both are normative for a client that offers workflows; §11.10 says which part is which. Evidence:
`workflows.md` unless a paragraph names another page; the tool's shapes are the Agent SDK's
`WorkflowInput` and `WorkflowOutput` (`sdk-tools.d.ts`).

## 11.1 The script file

1. A workflow is a `.js` file. Its first statement MUST be `export const meta = { … }`, a plain
   object literal with a string `name` and a string `description`. Only comments may come before it.
   <!-- req: workflows.behavior.What the saved script looks like -->
2. `meta` MAY carry `phases`, an array of the stage titles the body passes to `phase()` (§11.3).
   Each entry MUST be exactly the title the body passes; a `phase()` title with no entry gets a
   progress group of its own. <!-- req: workflows.behavior.Edit a saved script.phases -->
3. The client reads `meta` without running the script. A `meta` that holds anything but literal
   values (a variable, a function call, a spread), that is not the first statement, or that lacks
   `name` or `description`, makes the script no command: the client MUST NOT offer `/<name>` in
   `/` autocomplete. A field of `meta` the client does not know is ignored (Judgment J11.1).
   <!-- req: workflows.behavior.Edit a saved script.meta block -->
4. After `meta` comes the body: plain JavaScript with top-level `await`. The value the body returns
   is the run's result, handed to the model when the run finishes. The client does not check the
   body when it lists the script: a syntax error in the body is reported when the workflow runs,
   and the `Workflow` tool returns `status: "async_launched"` with `error` set, and the run never
   starts (`agent-sdk/typescript.md`, "Workflow"). <!-- req: workflows.behavior.Edit a saved script.Body -->

Example, a plugin's `workflows/audit-routes.js`:

```javascript
export const meta = {
  name: 'audit-routes',
  description: 'Audit every route handler for missing auth checks',
  phases: ['Discover', 'Audit'],
}

phase('Discover')
const found = await agent('List every .ts file under src/routes/.', {
  schema: { type: 'object', required: ['files'], properties: { files: { type: 'array', items: { type: 'string' } } } },
})

phase('Audit')
const audits = await pipeline(found.files, file =>
  agent(`Audit ${file} for missing authentication checks.`, { label: file }),
)

return audits.filter(Boolean)
```

## 11.2 Workflows in a plugin, saved workflows, and their names

### 11.2.1 In a plugin

1. A plugin ships workflows as the `*.js` files directly in `workflows/` under its root, or at the
   paths of the manifest's `workflows` key, which replaces `workflows/` (§2.2, §2.6). A listed path
   that does not exist fails validation (§2.5). In a scanned directory, a subdirectory is not read
   and a file of another extension is not a workflow; a path the manifest lists as a file is read
   whatever its extension (Judgment J11.2).
2. A plugin workflow is namespaced by the plugin's `name` (§2.3) and named by its `meta.name`, not
   its file name: a script whose `meta.name` is `release-audit` in plugin `acme-tools` runs as
   `/acme-tools:release-audit`.
3. A plugin workflow is offered in `/` autocomplete and to the model beside the plugin's skills and
   commands, with its `meta.description`. When two scripts of one plugin have the same `meta.name`,
   the client MUST keep one, the first in UTF-16 code-unit order of the path (Judgment J11.3).
4. Run by name, a plugin workflow is one the approval prompt can remember: the client offers "don't
   ask again for `<name>` in `<path>`" for it (§11.5, §13).
   <!-- req: workflows.behavior.Distribute a workflow in a plugin -->

### 11.2.2 Saved workflows

A plugin workflow loads beside the workflows the user saves. A client that saves workflows MUST
follow these rules, so that a name means one script:

1. Saving a run's script (`s` in `/workflows`) writes it to one of two places: the project's
   `.claude/workflows/`, shared with the repository, or the personal `~/.claude/workflows/`
   (`workflows/` under `CLAUDE_CONFIG_DIR` when that is set). A saved workflow runs as `/<name>`.
2. Before writing, the client MUST refuse to write through a symbolic link: at the project location
   when `.claude`, `.claude/workflows` or the target file is one; at the personal location only when
   the target file is one.
3. The project location is the closest `.claude/workflows/` that already exists between the working
   directory and the repository root, or the repository root's when none does. Project workflows
   load from every `.claude/workflows/` on that path; for one name, the closest to the working
   directory wins, and a project workflow wins over a personal one.
4. After an edit, `/reload-skills` re-reads the workflow directories; the edited script runs from
   the next `/<name>`. <!-- req: workflows.behavior.Save the workflow for reuse -->

## 11.3 The script API

The body runs with these globals. A client MUST provide each with the behaviour stated, because a
plugin's script is written against them.

| Global | Behaviour |
| --- | --- |
| `agent(prompt, options?)` | Starts one subagent with `prompt` and resolves to its result: its final text, or with `options.schema` a JSON value of that shape. Resolves to `null` when the agent is stopped mid-run or meets an unrecoverable API error. |
| `pipeline(items, fn)` | Calls `fn(item)` for each item, one agent task per item, and resolves to the array of results in item order; a `null` result keeps its slot. |
| `parallel(tasks)` | Runs a set of agent tasks at once and resolves when all have finished, to their results in order; a `null` result keeps its slot. |
| `phase(title)` | Groups the agents started after it under `title` in the progress view. |
| `log(message)` | Shows `message` above the phases in the progress view. |
| `args` | The input the run was given (§11.4), or `undefined`. |

`options` of `agent()`:

| Option | Meaning |
| --- | --- |
| `schema` | A JSON Schema the agent's output must match; the agent returns JSON instead of prose. |
| `label` | The agent's name in the progress view. |
| `stallMs` | This agent's stall window in milliseconds (§11.7). |
| `model` | The model for this agent; it counts as the per-invocation model in the subagent model order (§5), and an `availableModels` allowlist substitutes as it does for subagents. |

1. **Schemas.** Before starting an agent with `schema`, the client MUST check the schema and fail
   the call, naming the contradiction, when it can prove the schema contradicts itself; at least a
   `required` key that `additionalProperties: false` rules out. The agent then never starts. When
   the output still fails validation after `MAX_STRUCTURED_OUTPUT_RETRIES` attempts (default 5), the
   call fails with an error that includes the last validation failure.
2. **Determinism.** `Date.now()`, `Math.random()` and `new Date()` without arguments MUST throw
   inside the script, so that a relaunched run makes the same `agent()` calls in the same order
   (§11.8). A script that needs a time or a seed takes it from `args`.
   <!-- req: workflows.behavior.Edit a saved script.Timestamps and randomness -->
3. **No modules.** A script that contains `import()` MUST fail before the run starts; the script is
   plain JavaScript and work that needs a library belongs in an agent's task.
   <!-- req: workflows.behavior.Behavior and limits.import() -->
4. **No direct access.** The script itself has no filesystem, shell or network access; agents read,
   write and run commands, and the script coordinates them (Judgment J11.4).
5. **Fan-out results.** `parallel()` and `pipeline()` accept at most 4,096 items in one call; the
   runtime MUST reject a longer list with an error rather than run part of it. A failed agent inside
   either keeps the run going with `null` in its slot (§11.7).
   <!-- req: workflows.behavior.Behavior and limits.parallel() -->
6. A value the script hands back that nests deeper than 100,000 levels is refused with an error
   naming the limit (`changelog.md`).

In auto permission mode, the prompt a script passes to `agent()` is text the script computed, not a
request from the user, and the classifier reviewing that agent's actions MUST treat it so (§13).

## 11.4 Input

1. A run takes one input value, the `args` field of the `Workflow` tool call, which the script reads
   as the global `args`. The value is structured JSON: an array or object arrives as one, not as a
   JSON-encoded string, so the script calls its methods directly.
2. When the call has no `args`, the global is `undefined`.
3. A value JSON cannot hold (a function, a cycle) cannot be `args`; the call is refused with an
   error (Judgment J11.5). <!-- req: workflows.behavior.Pass input to a saved workflow -->

## 11.5 Starting a run

1. A run starts through the `Workflow` tool (`WorkflowInput`): `script` (inline), `name` (a bundled,
   saved or plugin workflow), or `scriptPath`, at least one of them; `scriptPath` takes precedence and
   is refused when the session's tools do not include `Read`. A script path MUST be one the session
   is allowed to read (§13). `args` is the input (§11.4); `resumeFromRunId` relaunches a run of the
   same session (§11.8); `title` and `description` are ignored in favour of `meta`.
2. The tool returns at once (`WorkflowOutput`), with `status` `"async_launched"`, the `taskId`, the
   `runId` to resume with, `workflowName` (`meta.name`) and `scriptPath`; the result arrives later as
   a task completion. Unless the run started from a script path, the client writes the run's script
   to a file under the session's directory and returns that path.
3. Approval follows the permission mode: in manual and accept-edits modes the client asks on every
   run unless the user chose "don't ask again" for that named workflow in that project; in auto mode
   only the first launch; in bypass mode never; in `claude -p` and the SDK never, and there the call goes
   through ordinary permission evaluation instead (`Workflow`, `Workflow(<name>)` rules, hooks, the
   permission prompt tool; §13). The agents a run starts use the session's permission rules (§13).
4. The runtime executes the script in an isolated environment, separate from the conversation; the
   script's variables hold the intermediate results, and the runtime records each agent's result,
   which is what makes the run resumable (§11.8).

## 11.6 Limits

The runtime MUST apply these limits:

| Limit | Value |
| --- | --- |
| Mid-run user input | None. A run pauses on its own only for an agent's permission prompt and a usage-limit wait (§11.9); sign-off between stages means running each stage as its own workflow. <!-- req: workflows.behavior.Behavior and limits.No mid-run user input --> |
| Concurrent agents | 16 by default, fewer when fewer CPUs are available (a CPU-limited container included); `CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS` sets 1 to 256, other values keep the default. Queued `agent()` calls wait for a slot. |
| Shared-prefix stagger | In a fan-out, agents whose prompt-cache prefix matches the first one's are held until its response begins, at most `CLAUDE_CODE_WORKFLOW_PREFIX_STAGGER_MS` (default 5000; `0` disables it, and so does `DISABLE_PROMPT_CACHING`). |
| Items per `parallel()` or `pipeline()` | 4,096 (§11.3). |
| Agents per run | 1,000. The call that would start the 1,001st agent fails; a restart of a stalled agent is not a new agent (Judgment J11.6). <!-- req: workflows.behavior.Behavior and limits.1,000 agents total per run --> |

**Size guideline.** The `workflowSizeGuideline` setting (§12) is advice the client sends to the
model when it writes a workflow, not a cap, and a prompt that asks for another scale overrides it.
A settings file's value takes precedence over the `/config` choice, and the `/config` row is hidden
while a settings file sets it. The default is `medium`, or `small` for a user signed in on the Pro
plan. The limits above apply whatever the guideline.

| Value | The model aims for |
| --- | --- |
| `unrestricted` | No guideline: the workflow is sized to the task. <!-- req: workflows.behavior.Set a size guideline.unrestricted --> |
| `small` | Fewer than 5 agents. <!-- req: workflows.behavior.Set a size guideline.small --> |
| `medium` | Fewer than 10 agents. <!-- req: workflows.behavior.Set a size guideline.medium --> |
| `large` | Fewer than 50 agents. <!-- req: workflows.behavior.Set a size guideline.large --> |

A run that schedules more than 25 agents (or the agent count of a guideline the user chose), or
whose projected token total passes 1.5 million, shows a `Large workflow` warning; the warning does
not pause or limit the run, and does not appear while ultracode is on.

## 11.7 Stalls and restarts

1. An agent whose output stops arriving for the stall window MUST be ended and started again from
   the same prompt, without the stalled attempt's transcript. Files it changed stay changed and its
   tokens stay in the run's total. Time spent waiting on its own tool calls or on a usage-limit
   reset does not count toward the window. The progress view shows the name with `(retry 1)` and
   the detail `attempt 2 (stalled)`. <!-- req: workflows.behavior.When an agent stalls and restarts -->
2. The window is, in order: the call's `stallMs`; else `CLAUDE_ASYNC_AGENT_STALL_TIMEOUT_MS`, which
   also covers subagents outside workflows; else the default 600000 ms, which rises with
   `CLAUDE_STREAM_IDLE_TIMEOUT_MS` while the stream watchdog is on (`env-vars.md`).
   <!-- req: workflows.behavior.When an agent stalls and restarts.One agent | workflows.behavior.When an agent stalls and restarts.Every agent -->
3. An agent restarts at most five times, a restart the user asks for with `r` included. When the
   sixth attempt ends the same way, the `agent()` call fails with an error that starts with:

   | Error starts with | When |
   | --- | --- |
   | `agent stalled on all 6 attempts` | Every attempt went the whole window without output. <!-- req: workflows.behavior.When an agent stalls and restarts.agent stalled on all 6 attempts --> |
   | `agent lost its reply on all 6 attempts` | Every attempt's response stream went silent and the streaming idle watchdog ended it; a longer stall window does not help. <!-- req: workflows.behavior.When an agent stalls and restarts.agent lost its reply on all 6 attempts --> |
   | `agent abandoned after 6 attempts` | The attempts ended in different ways; the error lists them in order. <!-- req: workflows.behavior.When an agent stalls and restarts.agent abandoned after 6 attempts --> |

4. The failure's effect depends on the call: inside `parallel()` or `pipeline()` the run carries on
   with `null` in that slot; an `agent()` call awaited directly ends the run with the error.
   <!-- req: workflows.behavior.When an agent stalls and restarts.Awaited directly -->

## 11.8 Stopping and resuming

1. A paused run resumes from `/workflows` (`p`). A stopped run continues only when the model
   relaunches it with a `Workflow` call (`resumeFromRunId`, same session); while agents of the
   stopped run have not exited, the client MUST refuse the relaunch.
2. A relaunch replays the run in the order agents start. Each agent either returns its saved result
   or runs again:

   | State in the previous run | On relaunch |
   | --- | --- |
   | Completed | Returns its saved result. The first agent whose prompt differs from the previous run's, because the script was edited or an earlier agent returned something else, runs again, and so does every agent after it. <!-- req: workflows.behavior.Which agents run again.Completed --> |
   | Still running when the run stopped | Starts over. Stopping the whole run does not count any agent as failed, so it does not make later agents run again (Judgment J11.7). <!-- req: workflows.behavior.Which agents run again.Still running when you stopped --> |
   | Failed | Runs again, and so does every agent the script starts after it. Stopping one agent alone (`x` on it) counts as failing. <!-- req: workflows.behavior.Which agents run again.Failed --> |

   For a script that starts A, B, C, D where B failed, a relaunch returns A from the record and runs
   B, C and D. An edit that makes it start A, C, B, D runs C, B and D. A call is compared by its
   prompt and its options (Judgment J11.7).
3. A run does not continue on its own when the session is backgrounded or the client exits. The
   client MUST keep the run's saved results under the session's directory, so that after
   `claude --resume` (or in the background session) a relaunch replays them. A relaunch for which no
   saved results exist fails with `nothing to resume` and does not start the run over by itself; a
   run started from a script path outside the session directory cannot be relaunched in a background
   session. A cloud session also keeps the saved results with its conversation history.
   <!-- req: workflows.behavior.Resume after you leave the session -->

## 11.9 Usage limits

When an agent hits the user's claude.ai usage limit, the run pauses instead of failing it: the
agents that hit the limit wait for the reset, no new agent starts, and shortly after the reset the
waiting agents run again and the run continues. The progress line and the `/workflows` header show
when the limit resets. The run pauses only when all of these hold, and otherwise the affected agent
fails:

1. the session is interactive and signed in with a claude.ai subscription (not `claude -p`, the
   SDK, a background session, a Remote Control or agent team teammate session);
2. `autoContinueAtUsageLimit` is on (§12); turning it off during a wait ends the wait and the
   waiting agents fail;
3. the limit resets within 24 hours;
4. the run has not already waited twice: the third hit fails the agent.
   <!-- req: workflows.behavior.When a run hits your usage limit -->

## 11.10 Turning workflows off

1. Workflows are off for a user when `disableWorkflows` is `true` in any settings file, when
   `CLAUDE_CODE_DISABLE_WORKFLOWS=1`, when `enableWorkflows` is `false`, or when the organization
   turns them off; on the Pro plan they are off unless `enableWorkflows` is `true`. Nothing that turns
   them off is undone by `enableWorkflows: true` (§12, §14). The rules are the same on every surface:
   the terminal, the desktop app, the IDE extensions, `claude -p` and the SDK.
2. While workflows are off, the client MUST NOT offer `/workflows`, any workflow command (bundled,
   saved or a plugin's) or the `/workflow-authoring` skill; the `ultracode` keyword does not start a
   run and the ultracode toggle is removed from `/effort`. A plugin with workflows still loads; only
   its workflow commands are absent.
3. A run already in progress when workflows are turned off keeps going.
   <!-- req: workflows.behavior.Turn workflows off -->

## 11.11 Plugin contract and host engine

| Part | Plugin contract (a plugin relies on it) | Host engine (the client's own) |
| --- | --- | --- |
| File and `meta` (§11.1) | yes | — |
| Location and name (§11.2) | yes | — |
| Globals and their results (§11.3), `args` (§11.4) | yes | — |
| Determinism, `import()`, no direct access (§11.3) | yes: a script that relies on them breaks | enforced by the runtime |
| `Workflow` tool, approval, permissions (§11.5) | — | yes, §13 |
| Limits, size guideline, warning (§11.6) | the 4,096 and 1,000 caps are observable | yes |
| Stalls, resume, usage limits (§11.7–§11.9) | `null` slots and failure errors are observable | yes |
| Enablement (§11.10) | — | yes |
| Which model writes a script, how the progress view looks | — | yes, not specified here |

A client that does not offer workflows MUST still load a plugin that has them, list them in its
plugin details, and run its other components; it claims support without this chapter, as the
README's "Conformance" section allows.

## Design decisions

### Why the host engine is specified at all

A workflow script's result depends on the runtime: whether a stalled agent yields `null` or ends
the run, whether a relaunch reruns completed work, whether `Date.now()` throws. A plugin author
tests against Claude Code; an Extended client that scheduled differently would return different
results from the same script. So the observable engine rules are normative, while presentation
(the progress view, keys, the warning's wording) is described only where Claude Code fixes it.

### Why `meta` is read without running the script

The command list, the approval prompt and the model's listing need a workflow's name and
description before anyone approves running it. Reading a literal is safe; running a plugin's code
to learn its name is not.

## Judgments

| Id | Judgment | Why, and the evidence |
| --- | --- | --- |
| J11.1 | A script whose `meta` is not first, is not a literal, or lacks `name` or `description` is no command; comments may precede `meta`; unknown `meta` fields are ignored (§11.1). | `workflows.md` says a non-literal `meta` drops `/<name>` and `agent-sdk/typescript.md` that the script must begin with the literal. Oracle 2.1.325 (`init.slash_commands` with `--plugin-dir`): scripts with `meta` after a statement, without `description`, or with a variable as `name` are not listed; one with a leading comment and an extra `whenToUse` field is. |
| J11.2 | Only `*.js` files directly in `workflows/` are workflows; a manifest-listed file is read whatever its extension (§11.2.1). | The docs name "`.js` files" in `workflows/`. Oracle 2.1.325: `workflows/sub/deep.js` and `workflows/notjs.txt` are not listed. Note that output styles are read recursively (Judgment J6.4); the two differ in the same release. |
| J11.3 | Of two scripts of one plugin with one `meta.name`, the first in code-unit order of the path is kept (§11.2.1). | Silent in the docs. The reference implementation observed this on 2.1.319; on 2.1.325 one name was listed once, and which file won is not visible in `init`. |
| J11.4 | The script has no filesystem, shell or network access (§11.3). | `workflows.md`, "Behavior and limits", says the workflow itself has no filesystem or shell access; network is added because a script with it could do what the rule forbids through a remote service. |
| J11.5 | An `args` value JSON cannot hold is refused (§11.4). | The docs say `args` is structured data; a value that cannot be serialized cannot reach an isolated runtime. Lead: the reference implementation. |
| J11.6 | The 1,001st `agent()` call fails; a restart is not a new agent (§11.6). | The docs give the cap, not where it bites. A restart reruns one agent and the restart cap (§11.7) already bounds it. |
| J11.7 | An agent still running at stop starts over without rerunning later agents unless its prompt changed; calls are compared by prompt and options (§11.8). | `workflows.md` gives three rules and two examples and compares prompts; `WorkflowInput.resumeFromRunId` says completed calls with unchanged inputs return their cached results, which includes the options. |

The installed release used for the oracle checks was 2.1.325; its `claude plugin validate` adds
"plugin directory checks" (README, licence, icon) and reports a string `workflows` path as
`workflows[0]`. Neither changes a verdict this chapter states.
