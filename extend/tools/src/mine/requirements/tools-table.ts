/**
 * The tools table of tools-reference.md as data: each built-in tool with its "Permission required",
 * and the tools each permission rule format applies to ("Configure tools with permission rules and
 * hooks"), so that an implementation checks its own copy of the table against a committed snapshot
 * and never reads the pulled docs. `bun run spec:extract` writes it as `conformance/tools-table.json`.
 */
import { join } from 'node:path'
import { CONFORMANCE } from '../../paths.ts'
import { readToolsReference } from './mods-reference.ts'

export const TOOLS_TABLE_FILE = join(CONFORMANCE, 'tools-table.json')

/** The snapshot of the pulled tools reference, or undefined when the page is not pulled. */
export async function pulledToolsTable(docs: string, release: string): Promise<unknown> {
  const page = Bun.file(join(docs, 'tools-reference.md'))
  if (!(await page.exists())) return undefined
  const { tools, ruleFormats } = readToolsReference(await page.text())
  return { claudeCode: release, tools, ruleFormats }
}
