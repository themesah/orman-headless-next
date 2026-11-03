// Response shapes of the Orman Headless read API (`Orman/Headless/README.md`). Every response carries `tags`.

export interface Tagged {
  tags: string[]
}

export interface Seo {
  title: string | null
  description: string | null
  canonical: string | null
  /** True when the editor typed a title in the entry's SEO tab; false for the default `<title> | <site name>`. */
  title_is_custom?: boolean
  og_image: string | null
  noindex: boolean
}

/**
 * `addons.<handle>`: the block each enabled contributor adds to a page (omitted when empty). The shape is the addon's own,
 * so it is `unknown` here; an addon's components narrow it.
 */
export type AddonBlocks = Record<string, unknown>

interface ContentPage extends Tagged {
  site: string
  uri: string
  template: string
  data: Record<string, unknown>
  seo: Seo | null
  addons?: AddonBlocks
  updated_at: string
}

export interface EntryPage extends ContentPage {
  type: 'entry'
}

export interface TermPage extends ContentPage {
  type: 'term'
}

export interface TaxonomyPage extends ContentPage {
  type: 'taxonomy'
}

export interface RedirectPage extends Tagged {
  type: 'redirect'
  to: string
  status: 301 | 302 | number
}

export interface NotFound extends Tagged {
  type: 'not_found'
}

export type PageResponse = EntryPage | TermPage | TaxonomyPage | RedirectPage | NotFound

export interface PathItem {
  uri: string
  updated_at: string
  priority: number
}

export interface PathsResponse extends Tagged {
  data: PathItem[]
  meta: { page: number; last_page: number; total: number }
}

/** GET /site: the enabled contributors with their public blocks (`{}` when an addon has none). */
export interface SiteResponse extends Tagged {
  contract_version: number
  site: string
  addons: Record<string, Record<string, unknown>>
}

// Globals and listings reuse Orman's built-in API resources; their inner shape depends on the
// site's blueprints, so `data` stays loosely typed. `/globals` returns a list, `/globals/{h}` one set.
// A missing nav or global answers 404 with `{ type: 'not_found' }`, which the client returns as data.
export interface GlobalsResponse extends Tagged {
  data: Record<string, unknown> | Record<string, unknown>[]
}

export interface NavItem {
  id: string
  title: string
  url: string | null
  entry_id: string | null
  children: NavItem[]
}

export interface NavResponse extends Tagged {
  data: { handle: string; title: string; tree: NavItem[] }
}

export interface EntriesResponse extends Tagged {
  data: Record<string, unknown>[]
  links?: Record<string, string | null>
  meta?: Record<string, unknown>
}

// GET /trees/collections/{handle}?fields=a,b: a structured collection's published, unprotected entries nested in tree
// order. `fields` holds the requested blueprint fields as the API augments them (a select is `{ value, label, key }`).
export interface TreeNode {
  id: string
  title: string
  uri: string
  fields: Record<string, unknown>
  children: TreeNode[]
}

export interface TreeResponse extends Tagged {
  data: TreeNode[]
}

/** Select, Radio and Button group fields. */
export interface SelectValue {
  value: string
  label: string
  key: string
}

/** Bard as ProseMirror JSON (`HEADLESS_BARD=json`): every Bard value, however deep, is `{ type: 'bard', content }`. */
export interface BardMark {
  type: string
  attrs?: Record<string, unknown>
}

export interface BardNode {
  type: string
  attrs?: Record<string, unknown>
  text?: string
  marks?: BardMark[]
  content?: BardNode[]
}

/** An inline set inside Bard: its `values` are augmented like Replicator fields (a nested Bard is `BardValue` again). */
export interface BardSetNode extends BardNode {
  type: 'set'
  id: string
  set: string
  values: Record<string, unknown>
}

export interface BardValue {
  type: 'bard'
  content: BardNode[]
}

export function isBardValue(value: unknown): value is BardValue {
  return typeof value === 'object' && value !== null && (value as { type?: unknown }).type === 'bard' && Array.isArray((value as { content?: unknown }).content)
}
