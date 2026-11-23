/** Hook integration, policy delivery and tool-permission contracts, not Claude's session engine. */
import { NAVIGATION, under, type PageScope } from './scope.ts'

/** A page that restates tables other pages own: each section stays one requirement. */
const EVERY_SECTION = (): boolean => true

export const HOST_SCOPES: readonly PageScope[] = [
  {
    page: 'hooks-guide.md',
    category: 'hooks',
    slug: 'guide',
    whole: [EVERY_SECTION],
    skip: [
      ['Set up your first hook', 'tutorial'],
      [under(/^What you can automate$/), 'tutorial'],
      [
        /^(Hook not firing|Hook error in output|\/hooks shows no hooks configured|Fields at the wrong level|Check what a hook did)$/,
        'advice',
      ],
      ['Learn more', 'navigation'],
    ],
  },
  {
    page: 'server-managed-settings.md',
    category: 'policy',
    slug: 'server',
    skip: [
      ['Fetch and caching behavior', 'service'],
      ["When a machine's apiKeyHelper isn't in effect", 'runtime'],
      ['Approval memory', 'service'],
      ['Environment variables and the approval dialog', 'runtime'],
      ['Security considerations', 'advice'],
      ['Requirements', 'service'],
      ['Choose between server-managed and endpoint-managed settings', 'advice'],
      ['Configure server-managed settings', 'service'],
      ['Verify settings delivery', 'ui'],
      ['Access control', 'service'],
      ['Platform availability', 'service'],
      ['Audit logging', 'service'],
      NAVIGATION,
    ],
  },
  {
    page: 'debug-your-config.md',
    category: 'cli',
    slug: 'debug',
    skip: [
      ['See what loaded into context', 'ui'],
      ['Check MCP servers', 'advice'],
      ['Check common causes', 'advice'],
      NAVIGATION,
    ],
  },
  {
    page: 'tools-reference.md',
    category: 'tools',
    slug: 'behavior',
    skip: [
      [
        /^(AskUserQuestion tool behavior|Bash tool behavior|Edit tool behavior|EndConversation tool behavior|EnterWorktree tool behavior|Glob tool behavior|Grep tool behavior|LSP tool behavior|Monitor tool|NotebookEdit tool behavior|Read tool behavior|Task tool availability|WebFetch tool behavior|WebSearch tool behavior|Write tool behavior)$/,
        'runtime',
      ],
      [
        under(
          /^(AskUserQuestion tool behavior|Bash tool behavior|Edit tool behavior|EndConversation tool behavior|EnterWorktree tool behavior|Glob tool behavior|Grep tool behavior|LSP tool behavior|Monitor tool|NotebookEdit tool behavior|Read tool behavior|Task tool availability|WebFetch tool behavior|WebSearch tool behavior|Write tool behavior)$/,
        ),
        'runtime',
      ],
      ['PowerShell tool', 'runtime'],
      [
        under(
          /^PowerShell tool$/,
          /^(Bash deny rules also turn off the PowerShell tool|Shell selection in settings, hooks, and skills)$/,
        ),
        'runtime',
      ],
      [/^SendFeedback tool behavior$/, 'service'],
      [under(/^SendFeedback tool behavior$/), 'service'],
      ['Check which tools are available', 'ui'],
      NAVIGATION,
    ],
  },
  {
    // Code Mode (2.1.330, experimental): the REPL tool and how each call inside its code meets
    // permission rules and PreToolUse/PostToolUse hooks are a host contract; turning it on, the
    // sandbox, the countdown and stopping code are Claude Code's own session.
    page: 'code-mode.md',
    category: 'hooks',
    slug: 'code-mode',
    skip: [
      [/^(How Code Mode works|Requirements|Try Code Mode|Turn off Code Mode)$/, 'runtime'],
      ['Block Code Mode for your organization', 'runtime'],
      ['When to use Code Mode', 'advice'],
      ['Monitor Code Mode with OpenTelemetry', 'telemetry'],
      [/^(Answer a permission prompt while code runs|Stop code in progress)$/, 'ui'],
      [/^(Limit shell commands with the sandbox|Long-running code)$/, 'runtime'],
      [/^(Code Mode doesn't start)$/, 'runtime'],
      ['Permission prompt with a countdown', 'ui'],
      NAVIGATION,
    ],
  },
]
