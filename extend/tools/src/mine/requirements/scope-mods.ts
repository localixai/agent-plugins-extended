/** The mods pages of the audit (src/mine/requirements/scope.ts). */
import { NAVIGATION, type PageScope } from './scope.ts'

export const MOD_SCOPES: readonly PageScope[] = [
  {
    page: 'plugins/mods/overview.md',
    category: 'mods',
    slug: 'overview',
    routes: [{ category: 'policy', heading: /^Control mods for your organization$/ }],
    skip: [
      ['What a mod can do', 'advice'],
      ['Get a mod', 'tutorial'],
      ['Install or update a mod', 'tutorial'],
      ['Try a sample mod', 'tutorial'],
      ['See which mods a session loaded', 'ui'],
      ['List what a mod does before you install one', 'ui'],
      ['Compare mods, settings hooks, skills, and MCP servers', 'advice'],
      ['Read the source of built-in mods', 'builtin'],
      // What the built-in charts mod needs to load: its plan, release and platform are Claude Code's.
      ['Check the charts mod requirements', 'builtin'],
      NAVIGATION,
    ],
  },
  {
    page: 'plugins/mods/admin.md',
    category: 'policy',
    slug: 'mods',
    skip: [
      ['Decide whether to leave mods on', 'advice'],
      ['Review what a mod can do', 'advice'],
      ['Refuse mods when your check fails', 'tutorial'],
      NAVIGATION,
    ],
  },
  {
    page: 'plugins/mods/api.md',
    category: 'mods',
    slug: 'apiGuide',
    skip: [['Check for cache hits', 'model'], NAVIGATION],
  },
  {
    page: 'plugins/mods/create.md',
    category: 'mods',
    slug: 'create',
    skip: [
      ['Ask Claude for a mod', 'tutorial'],
      ['Use the mod in other sessions', 'tutorial'],
      ['Write a mod yourself', 'tutorial'],
      ['How the example mod works', 'tutorial'],
      ['Change a mod with Claude', 'tutorial'],
      ['Get type definitions for your version', 'tooling'],
      ['Test the mod', 'tooling'],
      ['Share your mod', 'tutorial'],
      NAVIGATION,
    ],
  },
  {
    page: 'plugins/mods/events.md',
    category: 'mods',
    slug: 'events',
    skip: [NAVIGATION],
  },
  {
    page: 'plugins/mods/gallery.md',
    category: 'mods',
    slug: 'gallery',
    skip: [
      ['Try a sample', 'tutorial'],
      ['Pick an element', 'advice'],
      [
        /^(Text|Markdown|Link|Code|Code as a diff|Box|Button|Input|Select|Raster|Svg|Image and Client|Draw an Image inside tmux)$/,
        'duplicate',
      ],
      NAVIGATION,
    ],
  },
  {
    page: 'plugins/mods/interface.md',
    category: 'mods',
    slug: 'interface',
    skip: [
      ['Build a pane with tabs', 'tutorial'],
      ['Take typed input and draw a row for each item', 'tutorial'],
      ['Change hello-tabs to use $.state', 'tutorial'],
      // The Desktop app's colours: Claude writing a colours mod is the built-in plugin-authoring
      // skill's flow, and `makeColors` ships in that skill; `$.theme.set` with `colors` is stated
      // under "Put a backdrop behind the conversation".
      ['Ask Claude for a colors mod', 'tutorial'],
      ['Write a colors mod yourself', 'builtin'],
      NAVIGATION,
    ],
    skipItems: [
      // The Desktop app's version, and its Claude Code's.
      ['Fix missing mod colors in the Desktop app', 'Old version', 'runtime'],
      // Points to the sections on when a mod loads.
      ['Fix missing mod colors in the Desktop app', 'Mod not loaded', 'advice'],
      // `makeColors`' problems (the built-in skill's file) and what the Desktop app paints.
      ['Fix missing mod colors in the Desktop app', 'Refused theme', 'builtin'],
      // Deleting a written mod's directory keeps it from loading: create.md, "Sessions that load a
      // mod without asking".
      ['Remove mod colors from the Desktop app', 'Claude wrote the mod', 'duplicate'],
    ],
  },
  {
    page: 'plugins/mods/test.md',
    category: 'mods',
    slug: 'test',
    skip: [
      [
        /^(Write a test|Stub what Claude Code would answer|Follow the test kit's rules|Look up what a stub returns|Test a timer|Test a drawing|Test a drawing after \/clear|Test a policy mod)$/,
        'tooling',
      ],
      NAVIGATION,
    ],
  },
  {
    page: 'plugins/mods/troubleshoot.md',
    category: 'mods',
    slug: 'troubleshoot',
    skip: [['Find out why a mod does nothing', 'ui'], ['Read the debug log', 'ui'], NAVIGATION],
  },
  {
    page: 'plugins/mods/reference.md',
    category: 'mods',
    slug: 'reference',
    skip: [],
  },
]
