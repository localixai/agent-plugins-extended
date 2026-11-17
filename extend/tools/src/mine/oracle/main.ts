/**
 * `bun run oracle:record [oracle…] [--check]`: runs Claude Code as a black box on inputs written for
 * it and records what it did, for an implementation to compare its own behaviour with (E4a;
 * conformance/README.md, "Oracle runs"). No oracle names every fixture oracle; `corpus-runtime` and
 * `validate-timings` read the corpus and run only when named. `--check` writes nothing and fails
 * when Claude Code now does something else than what is recorded.
 *
 * The program is `CLAUDE_ORACLE_BIN`, else `claude` on `PATH`; every outcome names its release.
 * A fixture oracle RUNS its fixtures (hooks, MCP servers, `!` commands): they are written for this.
 *
 *   CLAUDE_ORACLE_BIN=~/.local/share/claude/versions/2.1.322 bun run oracle:record [runtime …] [--check]
 */
import { CLAUDE_BIN, claudeVersion } from '../claude-bin.ts'
import { recordCorpusRuntime } from './corpus-runtime.ts'
import { recordHeadersHelperEnv } from './headers-helper-env.ts'
import { recordModelContent } from './model-content.ts'
import type { RecordContext, Recorded } from './paths.ts'
import { recordRemoteMcpEnv } from './remote-mcp-env.ts'
import { recordRuntime } from './runtime.ts'
import { recordScrub } from './scrub.ts'
import { recordSettings } from './settings.ts'
import { recordValidateTimings } from './validate-timings.ts'

type Recorder = (context: RecordContext) => Promise<Recorded>

/** The fixture oracles, committed under `conformance/oracle/`. */
const FIXTURES: Readonly<Record<string, Recorder>> = {
  runtime: recordRuntime,
  settings: recordSettings,
  'subprocess-scrub': recordScrub,
  'remote-mcp-env': recordRemoteMcpEnv,
  'headers-helper-env': recordHeadersHelperEnv,
  'model-content': recordModelContent,
}
/** The corpus oracles, cached under `extend/.cache/oracle/<release>/`. */
const CORPUS: Readonly<Record<string, Recorder>> = {
  'corpus-runtime': recordCorpusRuntime,
  'validate-timings': recordValidateTimings,
}
const ALL: Readonly<Record<string, Recorder>> = { ...FIXTURES, ...CORPUS }

const args = process.argv.slice(2)
const check = args.includes('--check')
const named = args.filter((arg) => !arg.startsWith('--'))
const unknown = named.filter((name) => ALL[name] === undefined)
if (unknown.length > 0) {
  console.error(`oracle:record: no oracle ${unknown.join(', ')}; the oracles are ${Object.keys(ALL).join(', ')}`)
  process.exit(2)
}
const release = await claudeVersion()
if (release === undefined) throw new Error(`${CLAUDE_BIN} --version did not run`)

let changed = 0
for (const name of named.length > 0 ? named : Object.keys(FIXTURES)) {
  const recorder = ALL[name]
  if (recorder === undefined) continue
  const result = await recorder({ release, check })
  changed += result.changed
  const verb = check ? 'differ' : 'changed'
  console.log(`${name}: ${result.summary}; ${result.changed} ${verb} (Claude Code ${release})`)
}
if (check && changed > 0) {
  console.error('Claude Code does something else than what is recorded: `bun run oracle:record` and read the diff')
  process.exit(1)
}
