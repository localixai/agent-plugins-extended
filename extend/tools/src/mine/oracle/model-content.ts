/**
 * `oracle:record model-content`: what the model reads when a plugin's skill or command is invoked.
 * Each case of `conformance/oracle/model-content/<case>/` is a tiny plugin (`plugin/`) and a
 * `case.json`: the `/plugin:skill args` prompt, the skill and its arguments (for an implementation
 * to invoke the same), and the settings the run takes. The model-request oracle (`model-request.ts`)
 * runs each case; the user text blocks Claude Code sent, normalized (`<PLUGIN_ROOT>`,
 * `<PLUGIN_DATA>`, `<CWD>`, `<SESSION_ID>`), are recorded as the case's `expected.json`:
 * `{ claudeCodeVersion, blocks }`. The harness's own `<system-reminder>` blocks are left out: they
 * are not the skill's text and name the model of whoever recorded.
 */
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { ORACLE_DIR, record, type RecordContext, type Recorded } from './paths.ts'
import { inlineDataDir, normalize, runModelOracle, userTexts } from './model-request.ts'

const DIR = join(ORACLE_DIR, 'model-content')

const caseSchema = z.object({ prompt: z.string(), skill: z.string(), arguments: z.string(), settings: z.unknown().optional() })

async function blocksOf(name: string): Promise<string[]> {
  const input = caseSchema.parse(JSON.parse(await readFile(join(DIR, name, 'case.json'), 'utf8')))
  const run = await runModelOracle({ plugin: join(DIR, name, 'plugin'), prompt: input.prompt, settings: input.settings })
  const first = run.requests[0]
  if (first === undefined) throw new Error(`model-content/${name}: Claude Code sent no request`)
  const pluginName = input.skill.split(':')[0] ?? ''
  const texts = userTexts(first).filter((text) => !text.startsWith('<system-reminder>'))
  return texts.map((text) =>
    normalize(text, { pluginRoot: run.paths.pluginRoot, pluginData: inlineDataDir(run.paths.config, pluginName), cwd: run.paths.cwd }),
  )
}

const blocksIn = (text: string): string => JSON.stringify(text === '' ? undefined : (JSON.parse(text) as { blocks?: unknown }).blocks)

export async function recordModelContent({ release, check }: RecordContext): Promise<Recorded> {
  const names = (await readdir(DIR, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .toSorted()
  let changed = 0
  for (const name of names) {
    const fresh = { claudeCodeVersion: release, blocks: await blocksOf(name) }
    const differs = await record(join(DIR, name, 'expected.json'), fresh, check, (previous) => blocksIn(previous) === JSON.stringify(fresh.blocks))
    if (differs) console.log(`  model-content/${name}: ${check ? 'differs' : 'recorded'}`)
    if (differs) changed += 1
  }
  return { changed, summary: `${names.length} cases` }
}
