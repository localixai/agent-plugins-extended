/**
 * The corpus check (W4): every file a Claude Code schema covers, in every plugin of the official
 * and community marketplaces, validated with our schemas and compared with Claude Code's own
 * `claude plugin validate` verdict on the same plugin. Writes `extend/conformance/CORPUS.md`.
 * The corpus lives outside the repository and is only read.
 *
 *   bun run corpus            (CORPUS_DIR overrides ~/Documents/llx-plugin/.cache/corpus)
 */
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { CONFORMANCE } from '../paths.ts'
import { checkFiles, type FileVerdict } from './check.ts'
import { pluginFiles } from './files.ts'
import { readOracle } from './oracle.ts'
import { renderCorpus, type PluginVerdict } from './report.ts'
import { loadSchemas } from './schemas.ts'

export const RELEASE = '2.1.321'
const CORPUS = process.env.CORPUS_DIR ?? join(homedir(), 'Documents', 'llx-plugin', '.cache', 'corpus')

interface IndexEntry {
  readonly marketplace: string
  readonly name: string
  readonly dir?: string
  readonly skipped?: string
}

const index = JSON.parse(readFileSync(join(CORPUS, 'index.json'), 'utf8')) as IndexEntry[]
const schemas = await loadSchemas()
const plugins: PluginVerdict[] = []
let skipped = 0
let noOracle = 0
const unread: string[] = []
for (const entry of index) {
  if (entry.dir === undefined) {
    skipped += 1
    continue
  }
  const root = join(CORPUS, entry.dir)
  const oracle = readOracle(join(CORPUS, 'oracle', RELEASE, entry.marketplace, `${entry.name}.json`), root)
  if (!oracle?.ran || !existsSync(root)) {
    noOracle += 1
    continue
  }
  // The oracle found no plugin at the path and read nothing: there is nothing to compare.
  if (oracle.errors.some((error) => /^(directory|file)$/.test(error.path))) {
    unread.push(`${entry.marketplace}/${entry.name}`)
    plugins.push({ marketplace: entry.marketplace, name: entry.name, files: [], elsewhere: oracle.errors })
    continue
  }
  const files: FileVerdict[] = checkFiles(root, pluginFiles(root), oracle.errors, schemas)
  const placed = new Set(files.map((file) => file.file))
  const elsewhere = oracle.errors.filter((error) => !placed.has(error.file))
  plugins.push({ marketplace: entry.marketplace, name: entry.name, files, elsewhere })
}

const text = renderCorpus({ release: RELEASE, plugins, skipped, noOracle, unread })
await Bun.write(join(CONFORMANCE, 'CORPUS.md'), text)
const falseRejects = plugins.flatMap((p) => p.files).filter((f) => f.ours.length > 0 && f.oracle.length === 0)
console.log(`corpus: ${plugins.length} plugins, ${plugins.reduce((n, p) => n + p.files.length, 0)} files, ${falseRejects.length} false rejects`)
