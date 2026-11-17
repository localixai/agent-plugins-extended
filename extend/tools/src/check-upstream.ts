/**
 * U1: since the last merge of `upstream/main`, no file upstream owns has changed. Ours is
 * everything under `extend/`, the root `CLAUDE.md` and `.github/README.md` (the GitHub front
 * page; upstream has no `.github/`); any other path in the diff against the merge base, committed
 * or not, fails the check.
 *
 *   bun run check:upstream
 */
import { ROOT } from './paths.ts'

const OURS = [/^extend\//, /^CLAUDE\.md$/, /^\.github\/README\.md$/]

function git(...args: string[]): string {
  const run = Bun.spawnSync(['git', '-C', ROOT, ...args])
  if (run.exitCode !== 0) throw new Error(`git ${args.join(' ')}: ${run.stderr.toString().trim()}`)
  return run.stdout.toString()
}

const base = git('merge-base', 'HEAD', 'upstream/main').trim()
const changed = new Set([
  ...git('diff', '--name-only', base).split('\n'),
  ...git('ls-files', '--others', '--exclude-standard').split('\n'),
])
const theirs = [...changed].filter((path) => path && !OURS.some((ours) => ours.test(path)))

if (theirs.length > 0) {
  console.error(`U1: upstream files changed since ${base.slice(0, 7)}:`)
  for (const path of theirs.sort()) console.error(`  ${path}`)
  console.error('Move the change under extend/, or record a judgment (U3).')
  process.exit(1)
}
console.log(`U1 ok: only extend/, CLAUDE.md and .github/README.md differ from upstream ${base.slice(0, 7)}`)
