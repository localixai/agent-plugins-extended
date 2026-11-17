/** Where the tools find the repository and the parts of it they read. */
import { dirname, join } from 'node:path'

export const ROOT = join(dirname(import.meta.path), '..', '..', '..')
export const EXTEND = join(ROOT, 'extend')
export const SPEC = join(EXTEND, 'spec')
export const CONFORMANCE = join(EXTEND, 'conformance')
