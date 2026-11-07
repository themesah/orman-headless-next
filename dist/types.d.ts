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
type AddonBlocks = Record<string, unknown> & {
    seo?: SeoExtras;
};
/** `addons.seo` of a page: what the top-level `seo` block does not carry. Each key is present only when the page has it. */
interface SeoExtras {
    /** Parsed JSON-LD objects (Organization, Person, BreadcrumbList, the editor's own schema). Render each in `<script type="application/ld+json">`. */
    json_ld?: Record<string, unknown>[];
    /** The page in its other languages; `alternates` also lists the page itself and `x-default`. `uri` is a path on the frontend. */
    hreflang?: {
        current: string | null;
        alternates: Hreflang[];
    };
}
interface Hreflang {
    hreflang: string;
    uri: string;
}
/** `addons.seo` of GET /site: what robots.txt needs, and the search engines' site-verification codes (only those set). */
interface SeoSite {
    robots: {
        sitemap?: boolean;
        humans?: string;
        indexing: 'index' | 'noindex';
    };
    verification?: {
        google?: string;
        bing?: string;
    };
}
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
    /** SEO addon: `always`..`never`; present when the addon is on. */
    change_frequency?: string;
    /** SEO addon: only on pages that exist in more than one language. */
    alternates?: Hreflang[];
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
        seo?: SeoSite;
        account?: AccountSite;
        sessions?: SessionsSite;
        diskussiya?: DiskussiyaSite;
        notifications?: NotificationsSite;
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
/** `addons.account` of GET /site: whether the site has a second sign-in step, and where the steps live. */
interface AccountSite {
    two_step: boolean;
    login: string;
    challenge: string;
    me: string;
    logout: string;
}
/** `addons.sessions` of GET /site: present only while the Sessions addon is on. Orman enforces its rules itself (401 on a revoked session). */
interface SessionsSite {
    enabled: true;
    approval_window_seconds: number;
    rules: string[];
    account: string;
    awaiting: string;
}
interface DiskussiyaSite {
    enabled: true;
    mine: string;
    post: string;
}
interface NotificationsSite {
    front_inbox: true;
    /** True when the site has a Mercure hub the browser can reach; otherwise the inbox polls. */
    realtime: boolean;
    inbox: string;
}
/** What the JSON login (and the second step) answers besides "signed in". */
type LoginStep = {
    needs: 'two_factor';
    two_factor?: true;
} | {
    needs: 'approval';
    request: {
        id: number;
        expires_at: string;
    };
} | {
    needs: null;
    signed_in: true;
};
/** `addons.diskussiya` of a page: the approved comments (public, cached with the entry) and what a form needs. */
interface DiskussiyaBlock {
    thread: string;
    context: string;
    signature: string;
    open: boolean;
    login_required: boolean;
    captcha: FormCaptcha | null;
    honeypot: string;
    post: string;
    count: number;
    comments: PublicComment[];
}
/** An approved comment. Text only, never an e-mail, an address or a moderation field. */
interface PublicComment {
    id: number;
    parent_id: number | null;
    depth: number;
    author: {
        name: string;
    };
    text: string;
    created_at: string | null;
}
type CommentStatus = 'pending' | 'accepted' | 'rejected' | 'replied';
/** A comment as its own author sees it (`/!/diskussiya/mine` and the answer to a post). */
interface OwnComment extends PublicComment {
    status: CommentStatus;
    page?: {
        title: string;
        url: string | null;
        uri: string | null;
    } | null;
}
interface SessionRow {
    id: number;
    is_current: boolean;
    area_label: string;
    device_label: string;
    ip_address: string | null;
    login_at_human: string | null;
    last_active_at_human: string | null;
    ended_at_human: string | null;
    ended_reason_label: string | null;
    active: boolean;
    actions: {
        approve: string;
        deny: string;
        revoke: string;
    };
}
interface PendingSignIn {
    id: number;
    device_label: string;
    ip_address: string | null;
    requested_at_human: string | null;
    seconds_left: number;
    actions: {
        approve: string;
        deny: string;
        revoke: string;
    };
}
interface SessionPolicyInfo {
    rule: string;
    label: string;
    description: string;
    source: string;
    editable: boolean;
    locked_reason: string | null;
}
interface SessionsAccount {
    policy: SessionPolicyInfo;
    rules: {
        rule: string;
        label: string;
        description: string;
    }[];
    pending: PendingSignIn[];
    active: SessionRow[];
    history: SessionRow[];
    needs_code: boolean;
    elevated: boolean;
}
interface InboxItem {
    id: string;
    title: string;
    body: string | null;
    level: string;
    action_url: string | null;
    action_label: string | null;
    created_at: string;
    read: boolean;
    status: string;
    requires_acceptance: boolean;
    accepted: boolean;
    can_accept: boolean;
    can_snooze: boolean;
    can_dismiss: boolean;
}
/** A subscriber token for the person's own Mercure topic (15 minutes). The hub is opened directly, not through the proxy. */
interface StreamInfo {
    hub: string;
    topic: string;
    token: string;
    expires_at: string;
}

export { type AccountSite, type AddonBlocks, type BardMark, type BardNode, type BardSetNode, type BardValue, type CommentStatus, type DiskussiyaBlock, type DiskussiyaSite, type EntriesResponse, type EntryPage, type FormCaptcha, type FormFieldSchema, type FormResponse, type FormSchema, type GlobalsResponse, type Hreflang, type InboxItem, type KaptchaSite, type LoginStep, type MaintenanceGate, type MaintenanceSite, type NavItem, type NavResponse, type NotFound, type NotificationsSite, type OwnComment, type PageResponse, type PathItem, type PathsResponse, type PendingSignIn, type PublicComment, type RedirectPage, type SelectValue, type Seo, type SeoExtras, type SeoSite, type SessionPolicyInfo, type SessionRow, type SessionsAccount, type SessionsSite, type SiteResponse, type StreamInfo, type Tagged, type TaxonomyPage, type TermPage, type TreeNode, type TreeResponse, type TurnstileSite, isBardValue };
