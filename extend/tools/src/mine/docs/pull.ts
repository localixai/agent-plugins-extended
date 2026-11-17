/**
 * Pulls Claude Code's official documentation into `extend/.cache/claude-docs/<release>/` (never
 * committed): the evidence every requirement in `conformance/requirements.json` is extracted from
 * (E1, C2).
 *
 * The site publishes `llms.txt`, an index that links every page as Markdown, and only ever the
 * current release's. The release is read from the changelog's first entry before anything is
 * written; each linked page is then written at its URL path (`hooks.md`,
 * `plugins/manifest-reference.md`) under that release's folder, and a page the index no longer
 * lists, or that moved off the docs site, is removed from it. `VERSION` records the release.
 *
 *   bun run docs:pull             pull the current release's docs
 *   bun run docs:pull --dry-run   read the index and the changelog, print the release, write nothing
 */
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'
import { docsDir, DOCS_INDEX, DOCS_PREFIX } from '../paths.ts'

const CONCURRENCY = 16
const ATTEMPTS = 4
const TIMEOUT_MS = 30_000

class Gone extends Error {}

async function fetchMarkdown(url: string): Promise<string> {
  let last: unknown
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) })
      if (response.status === 404) throw new Gone(url)
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
      if (response.headers.get('content-type')?.includes('text/html')) {
        throw new Gone(`${url} (moved to ${response.url})`)
      }
      return await response.text()
    } catch (error) {
      if (error instanceof Gone) throw error
      last = error
      await Bun.sleep(500 * 2 ** (attempt - 1))
    }
  }
  throw last
}

function pagesOf(index: string): string[] {
  const escaped = DOCS_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return [...new Set(index.match(new RegExp(`${escaped}[^\\s)\\]"'>]+\\.md`, 'g')) ?? [])]
}

async function pool<T>(items: readonly T[], worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const run = async (): Promise<void> => {
    for (let item = items[next++]; item !== undefined; item = items[next++]) await worker(item)
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, run))
}

async function filesUnder(folder: string): Promise<string[]> {
  const entries = await readdir(folder, { recursive: true, withFileTypes: true }).catch(() => [])
  return entries.filter((entry) => entry.isFile()).map((entry) => relative(folder, join(entry.parentPath, entry.name)))
}

const releaseOf = (changelog: string): string | undefined => changelog.match(/\*\*(\d+\.\d+\.\d+)\*\*/)?.[1]

const index = await fetchMarkdown(DOCS_INDEX)
const pages = pagesOf(index)
if (pages.length === 0) throw new Error(`${DOCS_INDEX} links no pages; nothing is written`)
const version = releaseOf(await fetchMarkdown(`${DOCS_PREFIX}changelog.md`))
if (version === undefined) throw new Error('the changelog names no release; nothing is written')
const DOCS_DIR = docsDir(version)
if (process.argv.includes('--dry-run')) {
  console.log(`Claude Code ${version}: ${pages.length} pages listed; would write ${DOCS_DIR}`)
  process.exit(0)
}

await mkdir(DOCS_DIR, { recursive: true })
await writeFile(join(DOCS_DIR, 'llms.txt'), index)
const kept = new Set(['llms.txt', 'VERSION'])
const failed: string[] = []
const gone: string[] = []
let changed = 0

await pool(pages, async (url) => {
  const path = url.slice(DOCS_PREFIX.length)
  kept.add(path)
  try {
    const text = await fetchMarkdown(url)
    const file = Bun.file(join(DOCS_DIR, path))
    if ((await file.exists()) && (await file.text()) === text) return
    await mkdir(dirname(join(DOCS_DIR, path)), { recursive: true })
    await writeFile(join(DOCS_DIR, path), text)
    changed += 1
  } catch (error) {
    if (error instanceof Gone) {
      kept.delete(path)
      gone.push(error.message)
    } else failed.push(url)
  }
})

for (const path of await filesUnder(DOCS_DIR)) {
  if (!kept.has(path)) await rm(join(DOCS_DIR, path))
}

await writeFile(join(DOCS_DIR, 'VERSION'), `${version}\n`)

console.log(`Claude Code ${version}: ${pages.length} pages, ${changed} new or changed`)
for (const line of gone) console.log(`  gone: ${line}`)
for (const url of failed) console.log(`  failed: ${url}`)
process.exit(failed.length > 0 ? 1 : 0)
