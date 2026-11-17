/**
 * C1 and E5: reads every `<!-- req: id | id -->` marker in `extend/spec/`, checks each id against
 * `extend/conformance/requirements.json`, and writes `extend/conformance/REPORT.md`: the share of
 * requirements the text states, overall, per category and per chapter.
 *
 *   bun run coverage            write the report
 *   bun run coverage --check    fail on an unknown id or a stale report
 */
import { readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { CONFORMANCE, SPEC } from './paths.ts'
import { renderReport, type Coverage } from './report.ts'

interface Requirement {
  readonly id: string
  readonly category: string
  readonly page: string
  readonly section: string
}

const MARKER = /<!--\s*req:\s*([\s\S]*?)-->/g
const DEVIATION = /<!--\s*deviates:\s*([\s\S]*?)-->/g
/** Documented behaviour the requirement snapshot leaves out (a scope gap), cited by page and section. */
const BEYOND = /<!--\s*docs:\s*([\s\S]*?)-->/g

async function markdownFiles(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { recursive: true, withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort()
}

const idsIn = (text: string, pattern: RegExp): string[] =>
  [...text.matchAll(pattern)].flatMap((match) =>
    (match[1] ?? '').split(' | ').map((id) => id.trim()).filter(Boolean),
  )

async function markersBy(
  files: readonly string[],
  pattern: RegExp,
): Promise<Map<string, string[]>> {
  const byFile = new Map<string, string[]>()
  for (const file of files) byFile.set(relative(SPEC, file), idsIn(await Bun.file(file).text(), pattern))
  return byFile
}

const { claudeCode, requirements } = (await Bun.file(
  join(CONFORMANCE, 'requirements.json'),
).json()) as { claudeCode: string; requirements: Requirement[] }
const known = new Map(requirements.map((each) => [each.id, each]))
const files = await markdownFiles(SPEC)
const byFile = await markersBy(files, MARKER)
const deviationsByFile = await markersBy(files, DEVIATION)

const unknown = [...byFile, ...deviationsByFile].flatMap(([file, ids]) =>
  ids.filter((id) => !known.has(id)).map((id) => `${file}: ${id}`),
)
const deviates = new Set([...deviationsByFile.values()].flat().filter((id) => known.has(id)))
const covered = new Set([...byFile.values()].flat().filter((id) => known.has(id) && !deviates.has(id)))
const both = [...byFile.values()].flat().filter((id) => deviates.has(id))
if (both.length > 0) {
  console.error('E4a: an id is marked both stated and deviating; keep only `deviates:`:')
  for (const id of new Set(both)) console.error(`  ${id}`)
  process.exit(1)
}
const beyond = new Set<string>()
for (const file of files) for (const match of (await Bun.file(file).text()).matchAll(BEYOND)) beyond.add((match[1] ?? '').trim())
const coverage: Coverage = { release: claudeCode, requirements, covered, deviates, beyond, byFile }
const report = renderReport(coverage)
const target = Bun.file(join(CONFORMANCE, 'REPORT.md'))

if (unknown.length > 0) {
  console.error('C1: markers name ids that are not requirements:')
  for (const line of unknown) console.error(`  ${line}`)
  process.exit(1)
}
if (process.argv.includes('--check')) {
  if ((await target.exists() ? await target.text() : '') !== report) {
    console.error('E5: extend/conformance/REPORT.md is stale; run `bun run coverage`.')
    process.exit(1)
  }
} else {
  await Bun.write(target, report)
}
console.log(
  `Coverage: ${covered.size} of ${requirements.length} requirements stated, ${deviates.size} deviate (E4a), ${requirements.length - covered.size - deviates.size} missing; ${beyond.size} documented sections beyond the snapshot`,
)
