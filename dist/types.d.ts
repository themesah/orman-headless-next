interface Tagged {
    tags: string[];
}
interface Seo {
    title: string | null;
    description: string | null;
    canonical: string | null;
    /** True when the editor typed a title in the entry's SEO tab; false for the default `<title> | <site name>`. */
    title_is_custom?: boolean;
    og_image: string | null;
    noindex: boolean;
}
/**
 * `addons.<handle>`: the block each enabled contributor adds to a page (omitted when empty). The shape is the addon's own,
 * so it is `unknown` here; an addon's components narrow it.
 */
type AddonBlocks = Record<string, unknown>;
interface ContentPage extends Tagged {
    site: string;
    uri: string;
    template: string;
    data: Record<string, unknown>;
    seo: Seo | null;
    addons?: AddonBlocks;
    updated_at: string;
}
interface EntryPage extends ContentPage {
    type: 'entry';
}
interface TermPage extends ContentPage {
    type: 'term';
}
interface TaxonomyPage extends ContentPage {
    type: 'taxonomy';
}
interface RedirectPage extends Tagged {
    type: 'redirect';
    to: string;
    status: 301 | 302 | number;
}
interface NotFound extends Tagged {
    type: 'not_found';
}
type PageResponse = EntryPage | TermPage | TaxonomyPage | RedirectPage | NotFound;
interface PathItem {
    uri: string;
    updated_at: string;
    priority: number;
}
interface PathsResponse extends Tagged {
    data: PathItem[];
    meta: {
        page: number;
        last_page: number;
        total: number;
    };
}
/** GET /site: the enabled contributors with their public blocks (`{}` when an addon has none). */
interface SiteResponse extends Tagged {
    contract_version: number;
    site: string;
    addons: Record<string, Record<string, unknown>>;
}
interface GlobalsResponse extends Tagged {
    data: Record<string, unknown> | Record<string, unknown>[];
}
interface NavItem {
    id: string;
    title: string;
    url: string | null;
    entry_id: string | null;
    children: NavItem[];
}
interface NavResponse extends Tagged {
    data: {
        handle: string;
        title: string;
        tree: NavItem[];
    };
}
interface EntriesResponse extends Tagged {
    data: Record<string, unknown>[];
    links?: Record<string, string | null>;
    meta?: Record<string, unknown>;
}
interface TreeNode {
    id: string;
    title: string;
    uri: string;
    fields: Record<string, unknown>;
    children: TreeNode[];
}
interface TreeResponse extends Tagged {
    data: TreeNode[];
}
/** Select, Radio and Button group fields. */
interface SelectValue {
    value: string;
    label: string;
    key: string;
}
/** Bard as ProseMirror JSON (`HEADLESS_BARD=json`): every Bard value, however deep, is `{ type: 'bard', content }`. */
interface BardMark {
    type: string;
    attrs?: Record<string, unknown>;
}
interface BardNode {
    type: string;
    attrs?: Record<string, unknown>;
    text?: string;
    marks?: BardMark[];
    content?: BardNode[];
}
/** An inline set inside Bard: its `values` are augmented like Replicator fields (a nested Bard is `BardValue` again). */
interface BardSetNode extends BardNode {
    type: 'set';
    id: string;
    set: string;
    values: Record<string, unknown>;
}
interface BardValue {
    type: 'bard';
    content: BardNode[];
}
declare function isBardValue(value: unknown): value is BardValue;

export { type AddonBlocks, type BardMark, type BardNode, type BardSetNode, type BardValue, type EntriesResponse, type EntryPage, type GlobalsResponse, type NavItem, type NavResponse, type NotFound, type PageResponse, type PathItem, type PathsResponse, type RedirectPage, type SelectValue, type Seo, type SiteResponse, type Tagged, type TaxonomyPage, type TermPage, type TreeNode, type TreeResponse, isBardValue };
