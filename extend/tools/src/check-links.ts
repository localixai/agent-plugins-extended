/**
 * Every relative link in `extend/` names a file that exists: chapters were written by several
 * hands, and a moved or split file must not leave a dead link behind. Anchors are not checked.
 *
 *   bun run check:links
 */
import { readdir } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { EXTEND, ROOT } from './paths.ts'

const LINK = /\]\(([^)\s]+)\)/g

const files = (await readdir(EXTEND, { recursive: true, withFileTypes: true }))
  .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && !entry.parentPath.includes('node_modules') && !entry.parentPath.includes('/.cache'))
  .map((entry) => join(entry.parentPath, entry.name))

const dead: string[] = []
for (const file of files) {
  const text = await Bun.file(file).text()
  for (const [, target = ''] of text.matchAll(LINK)) {
    if (/^[a-z]+:/i.test(target) || target.startsWith('#')) continue
    const path = resolve(dirname(file), target.split('#')[0] ?? '')
    if (!(await Bun.file(path).exists()) && !(await readdir(path).then(() => true, () => false))) {
      dead.push(`${relative(ROOT, file)}: ${target}`)
    }
  }
}
if (dead.length > 0) {
  console.error('Dead links:')
  for (const line of dead) console.error(`  ${line}`)
  process.exit(1)
}
console.log(`Links ok: ${files.length} files`)
