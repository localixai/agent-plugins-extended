import { join } from 'node:path'
import { z } from 'zod'
import { CONFORMANCE } from '../../paths.ts'
import { pageUrl } from '../paths.ts'
import { CATEGORIES } from './sources.ts'

/** The committed list of requirements (conformance/README.md). */
export const REQUIREMENTS_FILE = join(CONFORMANCE, 'requirements.json')

/** The sections the audit leaves out, each with its reason (conformance/README.md, "Sections and scope"). */
export const OUT_OF_SCOPE_FILE = join(CONFORMANCE, 'out-of-scope.json')

const requirementSchema = z.strictObject({
  /** `<category path>.<key>`, such as `hooks.handler.common.timeout`. */
  id: z.string().min(1),
  category: z.enum(CATEGORIES),
  /** The docs page, relative to https://code.claude.com/docs/en/. */
  page: z.string().min(1),
  /** The heading the requirement sits under. */
  section: z.string(),
})
export type Requirement = z.infer<typeof requirementSchema>

const fileSchema = z.strictObject({
  /** The Claude Code release the docs described when the list was extracted. */
  claudeCode: z.string(),
  requirements: z.array(requirementSchema),
})
export type RequirementsFile = z.infer<typeof fileSchema>

export async function readRequirements(): Promise<RequirementsFile> {
  return fileSchema.parse(await Bun.file(REQUIREMENTS_FILE).json())
}

/** A citation for a requirement: its page's URL and section. */
export const citation = (requirement: Requirement): string => `${pageUrl(requirement.page)} § ${requirement.section}`
