/**
 * `bun run corpus:oracle`: asks Claude Code itself about every fetched plugin of the corpus and keeps
 * its answers, the verdicts the schemas and an implementation are compared with (W4, E4a). Two
 * oracles, both run as a black box on the plugin's folder: `claude plugin validate --json`
 * (oracle.ts, `<corpus>/oracle/<release>/`) and `claude --plugin-dir <dir> plugin details <name>`
 * (load-oracle.ts, `<corpus>/oracle-load/<release>/`). A plugin already answered for the release is
 * not asked again. The program is `CLAUDE_ORACLE_BIN`, else `claude` on `PATH`; a named release
 * that is not the program's fails the run instead of filing answers under the wrong release.
 *
 *   CLAUDE_ORACLE_BIN=~/.local/share/claude/versions/2.1.330 bun run corpus:oracle [release] [--validate-only]
 */
import { CLAUDE_BIN, claudeVersion } from '../claude-bin.ts'
import { loadOracle } from './load-oracle.ts'
import { readCorpusTargets } from './location.ts'
import { oracle } from './oracle.ts'
import { lookupName } from './plugin-name.ts'
import { pool } from './pool.ts'

/** Few at once: each run is a whole Claude Code process. */
const LANES = 4

const args = process.argv.slice(2)
const release = await claudeVersion()
if (release === undefined) throw new Error(`${CLAUDE_BIN} --version did not run`)
const named = args.find((arg) => /^\d+\.\d+\.\d+$/.test(arg))
if (named !== undefined && named !== release) {
  throw new Error(
    `${CLAUDE_BIN} is Claude Code ${release}, not ${named}: set CLAUDE_ORACLE_BIN to the ${named} program`,
  )
}
const validateOnly = args.includes('--validate-only')

const targets = await readCorpusTargets()
let done = 0
let failed = 0
await pool(targets, LANES, async (target) => {
  const report = await oracle(release, target.key, target.dir)
  if (!report.ran) failed += 1
  if (!validateOnly) await loadOracle(release, target.key, target.dir, await lookupName(target.dir))
  done += 1
  if (done % 100 === 0) console.log(`${done}/${targets.length}`)
})
console.log(`Claude Code ${release}: ${targets.length} plugins asked, ${failed} without a validate verdict`)
