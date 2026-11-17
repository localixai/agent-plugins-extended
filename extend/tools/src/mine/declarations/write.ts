/**
 * Writes `conformance/mods-declarations.json` from the pulled declarations of one release
 * (`bun run types:pull`): the snapshot an implementation's mods tests compare with (E2;
 * conformance/README.md, "Declarations").
 *
 *   bun run types:extract [release]    the newest pulled release when none is named
 */
import { releaseOf, TYPES_CACHE, typesDir } from '../paths.ts'
import { DECLARATIONS_FILE } from './snapshot.ts'
import { pulledDeclarations } from './extract.ts'

const release = releaseOf(process.argv.slice(2), TYPES_CACHE, 'bun run types:pull')
const declarations = await pulledDeclarations(typesDir(release))
if (!declarations) throw new Error(`no declarations of ${release} are pulled: run \`bun run types:pull\``)
await Bun.write(DECLARATIONS_FILE, `${JSON.stringify(declarations, null, 2)}\n`)
const methods = Object.values(declarations.api).reduce((sum, ns) => sum + Object.keys(ns).length, 0)
console.log(
  `Claude Code ${declarations.claudeCode}: ${Object.keys(declarations.events).length} events, ` +
    `${methods} members of $, ${Object.keys(declarations.props).length} elements`,
)
