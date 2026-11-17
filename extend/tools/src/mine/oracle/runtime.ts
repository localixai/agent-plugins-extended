/**
 * `oracle:record runtime`: for each fixture of `conformance/oracle/runtime/<case>/` (a plugin of
 * its own, written for this purpose), what a Claude Code session registers from it (`session.ts`),
 * recorded as the fixture's `expected.json`. The case's name is the plugin's.
 */
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { pool } from '../corpus/pool.ts'
import { ORACLE_DIR, record, type RecordContext, type Recorded } from './paths.ts'
import { EXPECTED_FILE, registryOf, sessionInit } from './session.ts'

export const RUNTIME_DIR = join(ORACLE_DIR, 'runtime')

export async function recordRuntime({ release, check }: RecordContext): Promise<Recorded> {
  const names = (await readdir(RUNTIME_DIR, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted()
  const changes = await pool(names, 4, async (name) => {
    const dir = join(RUNTIME_DIR, name)
    const init = await sessionInit(release, dir)
    if (init === undefined) throw new Error(`runtime/${name}: Claude Code printed no init`)
    const changed = await record(join(dir, EXPECTED_FILE), registryOf(init, [name]), check)
    if (changed) console.log(`  runtime/${name}: ${check ? 'differs' : 'recorded'}`)
    return changed
  })
  return { changed: changes.filter(Boolean).length, summary: `${names.length} fixtures` }
}
