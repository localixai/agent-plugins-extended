/**
 * Every `§n.m` the specification cites exists as a numbered heading in `extend/spec/`. A citation
 * of the core (`core §7.3`) is the core's and is not checked here.
 *
 *   bun run check:sections
 */
import { readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { ROOT, SPEC } from './paths.ts'

const HEADING = /^#{1,6}\s+(\d+(?:\.\d+)*)[.\s]/gm
const CITATION = /(core\s+)?§\s?(\d+(?:\.\d+)*)/g

const files = (await readdir(SPEC, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
  .map((entry) => join(entry.parentPath, entry.name))
const texts = await Promise.all(files.map(async (file) => [file, await Bun.file(file).text()] as const))

const sections = new Set<string>()
for (const [, text] of texts) for (const [, number = ''] of text.matchAll(HEADING)) sections.add(number)

const missing = new Map<string, Set<string>>()
for (const [file, text] of texts) {
  for (const [, core, number = ''] of text.matchAll(CITATION)) {
    const cited = number.replace(/\.$/, '')
    if (core || sections.has(cited)) continue
    const where = missing.get(cited) ?? new Set<string>()
    where.add(relative(ROOT, file))
    missing.set(cited, where)
  }
}
if (missing.size > 0) {
  console.error(`Cited sections with no heading (${missing.size}):`)
  for (const [number, where] of [...missing].sort()) console.error(`  §${number}: ${[...where].join(', ')}`)
  process.exit(1)
}
console.log(`Sections ok: ${sections.size} headings`)
