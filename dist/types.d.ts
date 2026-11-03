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
/** GET /site: the enabled contributors with their public blocks (`{}` when an addon has none), and the request gates' decisions. */
interface SiteResponse extends Tagged {
    contract_version: number;
    site: string;
    addons: Record<string, Record<string, unknown>> & {
        turnstile?: TurnstileSite;
        kaptcha?: KaptchaSite;
        maintenance?: MaintenanceSite;
    };
    /** `gates.<handle>`: the decision of an addon's request gate, the same for every visitor (Maintenance today). */
    gates?: {
        maintenance?: MaintenanceGate;
    } & Record<string, unknown>;
}
/** `addons.turnstile`: everything the widget needs. The secret key never leaves Orman. */
interface TurnstileSite {
    sitekey: string;
    /** The Cloudflare script to load (explicit rendering). */
    script: string;
    /** The form field the token is posted as (`cf-turnstile-response`). */
    field: string;
    protects: {
        forms: boolean;
        registration: boolean;
    };
}
/** `addons.kaptcha`: which surfaces are protected and how to fetch a challenge. The answer is never published. */
interface KaptchaSite {
    surfaces: {
        forms: boolean;
        user_login: boolean;
        user_registration: boolean;
        password_reset: boolean;
    };
    /** `POST` here (with the CSRF token) for `{ token, image, expires_in }`; never render or cache it on the server. */
    challenge: string;
    width: number;
    height: number;
    /** The two body fields: the typed `answer`, and the `challenge` token. */
    fields: {
        answer: string;
        challenge: string;
    };
}
/** `gates.maintenance`: may the frontend show pages? */
interface MaintenanceGate {
    active: boolean;
    /** 503 normally, 200 when the editor chose to answer 200. */
    status: number;
    retry_after: number | null;
    /** ISO 8601: when the window opens or closes by itself. A cached decision must not outlive it. */
    valid_until: string | null;
    /** Paths (no leading slash, `*` wildcard) that stay open. */
    allow_paths: string[];
    bypass: {
        cookie: string;
        param: string;
        unlock: string;
        check: string;
        check_all: boolean;
    };
}
/** `addons.maintenance`: the page's public content. */
interface MaintenanceSite {
    type: 'maintenance' | 'coming_soon' | 'sell_domain' | 'none';
    title: string;
    message: BardValue;
    ends_at: string | null;
    show_countdown: boolean;
    price: string;
    contact_email: string;
    collect_emails: boolean;
    has_access: boolean;
    subscribe: string;
    unlock: string;
    labels: Record<string, string>;
    lang?: string;
    dir?: 'ltr' | 'rtl';
}
/** One field of a form as `GET /forms/{handle}` describes it (an allowlist: no recipients, no storage settings). */
interface FormFieldSchema {
    handle: string;
    type: string;
    display: string;
    instructions: string | null;
    required: boolean;
    /** The rules a browser can check; database and pattern rules stay on the server. */
    validate: string[];
    placeholder?: string | null;
    input_type?: string | null;
    multiple?: boolean;
    inline?: boolean;
    max_files?: number;
    character_limit?: number;
    rows?: number;
    min?: number;
    max?: number;
    step?: number;
    prepend?: string;
    append?: string;
    default?: string | number | boolean | null;
    options?: {
        value: string;
        label: string;
    }[];
}
interface FormCaptcha {
    kind: 'turnstile' | 'kaptcha';
    /** The captcha field's handle in the blueprint (not posted: the widget decides its field names). */
    handle: string;
}
interface FormSchema {
    handle: string;
    title: string;
    /** The hidden field bots fill in; a filled one is a silent success on the server. */
    honeypot: string;
    fields: FormFieldSchema[];
    captcha: FormCaptcha | null;
    tags: string[];
}
interface FormResponse extends Tagged {
    data: FormSchema;
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

export { type AddonBlocks, type BardMark, type BardNode, type BardSetNode, type BardValue, type EntriesResponse, type EntryPage, type FormCaptcha, type FormFieldSchema, type FormResponse, type FormSchema, type GlobalsResponse, type KaptchaSite, type MaintenanceGate, type MaintenanceSite, type NavItem, type NavResponse, type NotFound, type PageResponse, type PathItem, type PathsResponse, type RedirectPage, type SelectValue, type Seo, type SiteResponse, type Tagged, type TaxonomyPage, type TermPage, type TreeNode, type TreeResponse, type TurnstileSite, isBardValue };
