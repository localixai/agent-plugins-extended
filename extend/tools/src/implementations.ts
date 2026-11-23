/**
 * Implementation ledgers: how an implementation measures up to this specification, requirement by
 * requirement and judgment by judgment. Each audit pass of an implementation writes one file in
 * `extend/conformance/implementations/<implementation>/`:
 *
 *   { "implementation": "agent-plugins", "revision": "<git short sha>", "pass": "<name>",
 *     "date": "YYYY-MM-DD", "release": "2.1.330", "files": ["04-skills.md"],
 *     "requirements": [{ "id", "file", "status", "evidence", "note" }],
 *     "judgments": [{ "id": "J4.3", "status", "evidence", "note" }] }
 *
 * status: `conforms` (the implementation does what the text says; `evidence` names the code and the
 * test), `diverges` (it does something else; `note` says what, and which side is right),
 * `missing` (it does not do it at all), `not-applicable` (the paragraph binds a party the
 * implementation is not, such as a plugin author or a validator it does not ship).
 * `release` is the Claude Code release of the specification text the pass audited against.
 * This script writes `extend/conformance/IMPLEMENTATIONS.md`; `--check` fails on an unknown id in a
 * pass of the snapshot's release, an unknown status, or a stale report. An id that a pass of an
 * earlier release named and the snapshot no longer has is listed as retired, not an error.
 *
 *   bun run implementations [--check]
 */
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { CONFORMANCE } from './paths.ts'

interface Entry { readonly id: string; readonly file?: string; readonly status: string; readonly evidence?: string; readonly note?: string }
interface Pass {
  readonly implementation: string
  readonly revision: string
  readonly pass: string
  readonly date: string
  readonly release: string
  readonly files: readonly string[]
  readonly requirements: readonly Entry[]
  readonly judgments: readonly Entry[]
}

const STATUS = new Set(['conforms', 'diverges', 'missing', 'not-applicable'])
const ROOT = join(CONFORMANCE, 'implementations')
const { claudeCode: release, requirements } = (await Bun.file(join(CONFORMANCE, 'requirements.json')).json()) as {
  claudeCode: string
  requirements: { id: string }[]
}
const known = new Set(requirements.map((each) => each.id))

const problems: string[] = []
const sections: string[] = []
for (const implementation of (await readdir(ROOT).catch(() => [])).sort()) {
  const folder = join(ROOT, implementation)
  const names = (await readdir(folder).catch(() => [])).filter((name) => name.endsWith('.json')).sort()
  const passes = await Promise.all(names.map(async (name) => (await Bun.file(join(folder, name)).json()) as Pass))
  // A later pass (by file name: a re-audit `r…` sorts after the audit `a…`) replaces what an
  // earlier one said about the same id in the same file; an id conforms only when every file
  // that states it does.
  const latest = new Map<string, { pass: string; entry: Entry }>()
  const latestJudgments = new Map<string, { pass: string; entry: Entry }>()
  const retired = new Set<string>()
  for (const pass of passes) {
    for (const entry of pass.requirements ?? []) {
      if (!STATUS.has(entry.status)) problems.push(`${implementation}/${pass.pass}: ${entry.id}: status ${entry.status}`)
      if (!known.has(entry.id)) {
        if (pass.release === release) problems.push(`${implementation}/${pass.pass}: unknown id ${entry.id}`)
        else retired.add(entry.id)
        continue
      }
      latest.set(`${entry.id}\u0000${entry.file ?? ''}`, { pass: pass.pass, entry })
    }
    for (const entry of pass.judgments ?? []) {
      if (!STATUS.has(entry.status)) problems.push(`${implementation}/${pass.pass}: ${entry.id}: status ${entry.status}`)
      latestJudgments.set(entry.id, { pass: pass.pass, entry })
    }
  }
  const byId = new Map<string, string>()
  const tally = new Map<string, number>()
  const open: string[] = []
  const row = (entry: Entry, pass: string): string =>
    `| \`${entry.id}\` | ${entry.file ?? ''} | ${entry.status} | ${pass} | ${(entry.note ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')} |`
  for (const { pass, entry } of latest.values()) {
    const worst = byId.get(entry.id)
    if (worst === undefined || worst === 'conforms' || worst === 'not-applicable') byId.set(entry.id, entry.status)
    tally.set(entry.status, (tally.get(entry.status) ?? 0) + 1)
    if (entry.status === 'diverges' || entry.status === 'missing') open.push(row(entry, pass))
  }
  for (const { pass, entry } of latestJudgments.values()) {
    tally.set(`judgment ${entry.status}`, (tally.get(`judgment ${entry.status}`) ?? 0) + 1)
    if (entry.status === 'diverges' || entry.status === 'missing') open.push(row(entry, pass))
  }
  const audited = byId.size
  const conforming = [...byId.values()].filter((status) => status === 'conforms' || status === 'not-applicable').length
  const revisions = [...new Set(passes.map((pass) => pass.revision))].join(', ')
  const releases = [...new Set(passes.map((pass) => pass.release))].sort().join(', ')
  sections.push(
    `## ${implementation}`,
    '',
    `Audited at ${revisions || '—'}: **${audited} of ${requirements.length} requirements audited, ${conforming} conform** (an id counts as conforming only when every file that states it conforms).`,
    '',
    `The passes audited the specification text of Claude Code ${releases || '—'}; the snapshot is ${release}.`,
    '',
    '| Outcome | Count |',
    '| --- | ---: |',
    ...[...tally].sort().map(([status, count]) => `| ${status} | ${count} |`),
    '',
    `### Open: divergences and missing behaviour (${open.length})`,
    '',
    ...(open.length === 0 ? ['None.'] : ['| Id | File | Status | Pass | What |', '| --- | --- | --- | --- | --- |', ...open]),
    '',
    `### Retired (${retired.size})`,
    '',
    `Ids that passes of an earlier release audited and the ${release} snapshot no longer has; counted nowhere above.`,
    '',
    ...[...retired].sort().map((id) => `- \`${id}\``),
    '',
  )
}
if (problems.length > 0) {
  console.error('Implementation ledger problems:')
  for (const line of problems) console.error(`  ${line}`)
  process.exit(1)
}
const report = ['# Implementations', '', 'Generated by `bun run implementations` from `implementations/<name>/*.json`; do not edit. Each', 'implementation is audited paragraph by paragraph against this specification.', '', ...sections].join('\n')
const target = Bun.file(join(CONFORMANCE, 'IMPLEMENTATIONS.md'))
if (process.argv.includes('--check')) {
  if ((await target.exists() ? await target.text() : '') !== report) {
    console.error('extend/conformance/IMPLEMENTATIONS.md is stale; run `bun run implementations`.')
    process.exit(1)
  }
} else {
  await Bun.write(target, report)
}
console.log(`Implementations: ${sections.length > 0 ? 'written' : 'none yet'}`)
