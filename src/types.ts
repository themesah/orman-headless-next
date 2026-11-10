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
export type AddonBlocks = Record<string, unknown> & { seo?: SeoExtras; diskussiya?: DiskussiyaBlock; per_page_theme?: PerPageThemeBlock }

/** `addons.seo` of a page: what the top-level `seo` block does not carry. Each key is present only when the page has it. */
export interface SeoExtras {
  /** Parsed JSON-LD objects (Organization, Person, BreadcrumbList, the editor's own schema). Render each in `<script type="application/ld+json">`. */
  json_ld?: Record<string, unknown>[]
  /** The page in its other languages; `alternates` also lists the page itself and `x-default`. `uri` is a path on the frontend. */
  hreflang?: { current: string | null; alternates: Hreflang[] }
}

export interface Hreflang {
  hreflang: string
  uri: string
}

/** `addons.seo` of GET /site: what robots.txt needs, and the search engines' site-verification codes (only those set). */
export interface SeoSite {
  robots: { sitemap?: boolean; humans?: string; indexing: 'index' | 'noindex' }
  verification?: { google?: string; bing?: string }
}

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
  /** SEO addon: `always`..`never`; present when the addon is on. */
  change_frequency?: string
  /** SEO addon: only on pages that exist in more than one language. */
  alternates?: Hreflang[]
}

export interface PathsResponse extends Tagged {
  data: PathItem[]
  meta: { page: number; last_page: number; total: number }
}

/** GET /site: the enabled contributors with their public blocks (`{}` when an addon has none), and the request gates' decisions. */
export interface SiteResponse extends Tagged {
  contract_version: number
  site: string
  addons: Record<string, Record<string, unknown>> & {
    turnstile?: TurnstileSite
    kaptcha?: KaptchaSite
    maintenance?: MaintenanceSite
    seo?: SeoSite
    account?: AccountSite
    sessions?: SessionsSite
    diskussiya?: DiskussiyaSite
    notifications?: NotificationsSite
    redirect?: RedirectSite
    analitika?: AnalitikaSite
    tracking_code?: TrackingCodeSite
  }
  /** `gates.<handle>`: the decision of an addon's request gate, the same for every visitor (Maintenance today). */
  gates?: { maintenance?: MaintenanceGate } & Record<string, unknown>
}

/** `addons.turnstile`: everything the widget needs. The secret key never leaves Orman. */
export interface TurnstileSite {
  sitekey: string
  /** The Cloudflare script to load (explicit rendering). */
  script: string
  /** The form field the token is posted as (`cf-turnstile-response`). */
  field: string
  protects: { forms: boolean; registration: boolean }
}

/** `addons.kaptcha`: which surfaces are protected and how to fetch a challenge. The answer is never published. */
export interface KaptchaSite {
  surfaces: { forms: boolean; user_login: boolean; user_registration: boolean; password_reset: boolean }
  /** `POST` here (with the CSRF token) for `{ token, image, expires_in }`; never render or cache it on the server. */
  challenge: string
  width: number
  height: number
  /** The two body fields: the typed `answer`, and the `challenge` token. */
  fields: { answer: string; challenge: string }
}

/** `gates.maintenance`: may the frontend show pages? */
export interface MaintenanceGate {
  active: boolean
  /** 503 normally, 200 when the editor chose to answer 200. */
  status: number
  retry_after: number | null
  /** ISO 8601: when the window opens or closes by itself. A cached decision must not outlive it. */
  valid_until: string | null
  /** Paths (no leading slash, `*` wildcard) that stay open. */
  allow_paths: string[]
  bypass: { cookie: string; param: string; unlock: string; check: string; check_all: boolean }
}

/** `addons.maintenance`: the page's public content. */
export interface MaintenanceSite {
  type: 'maintenance' | 'coming_soon' | 'sell_domain' | 'none'
  title: string
  message: BardValue
  ends_at: string | null
  show_countdown: boolean
  price: string
  contact_email: string
  collect_emails: boolean
  has_access: boolean
  subscribe: string
  unlock: string
  labels: Record<string, string>
  lang?: string
  dir?: 'ltr' | 'rtl'
}

/** One field of a form as `GET /forms/{handle}` describes it (an allowlist: no recipients, no storage settings). */
export interface FormFieldSchema {
  handle: string
  type: string
  display: string
  instructions: string | null
  required: boolean
  /** The rules a browser can check; database and pattern rules stay on the server. */
  validate: string[]
  placeholder?: string | null
  input_type?: string | null
  multiple?: boolean
  inline?: boolean
  max_files?: number
  character_limit?: number
  rows?: number
  min?: number
  max?: number
  step?: number
  prepend?: string
  append?: string
  default?: string | number | boolean | null
  options?: { value: string; label: string }[]
}

export interface FormCaptcha {
  kind: 'turnstile' | 'kaptcha'
  /** The captcha field's handle in the blueprint (not posted: the widget decides its field names). */
  handle: string
}

export interface FormSchema {
  handle: string
  title: string
  /** The hidden field bots fill in; a filled one is a silent success on the server. */
  honeypot: string
  fields: FormFieldSchema[]
  captcha: FormCaptcha | null
  tags: string[]
}

export interface FormResponse extends Tagged {
  data: FormSchema
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

// ---- Wave 2 (6.5): sign-in, sessions, comments, inbox -----------------------------------------------------------------------

/** `addons.account` of GET /site: whether the site has a second sign-in step, and where the steps live. */
export interface AccountSite {
  two_step: boolean
  login: string
  challenge: string
  me: string
  logout: string
}

/** `addons.sessions` of GET /site: present only while the Sessions addon is on. Orman enforces its rules itself (401 on a revoked session). */
export interface SessionsSite {
  enabled: true
  approval_window_seconds: number
  rules: string[]
  account: string
  awaiting: string
}

export interface DiskussiyaSite {
  enabled: true
  mine: string
  post: string
}

export interface NotificationsSite {
  front_inbox: true
  /** True when the site has a Mercure hub the browser can reach; otherwise the inbox polls. */
  realtime: boolean
  inbox: string
}

/** What the JSON login (and the second step) answers besides "signed in". */
export type LoginStep =
  | { needs: 'two_factor'; two_factor?: true }
  | { needs: 'approval'; request: { id: number; expires_at: string } }
  | { needs: null; signed_in: true }

/** `addons.diskussiya` of a page: the approved comments (public, cached with the entry) and what a form needs. */
export interface DiskussiyaBlock {
  thread: string
  context: string
  signature: string
  open: boolean
  login_required: boolean
  captcha: FormCaptcha | null
  honeypot: string
  post: string
  count: number
  comments: PublicComment[]
}

/** An approved comment. Text only, never an e-mail, an address or a moderation field. */
export interface PublicComment {
  id: number
  parent_id: number | null
  depth: number
  author: { name: string }
  text: string
  created_at: string | null
}

export type CommentStatus = 'pending' | 'accepted' | 'rejected' | 'replied'

/** A comment as its own author sees it (`/!/diskussiya/mine` and the answer to a post). */
export interface OwnComment extends PublicComment {
  status: CommentStatus
  page?: { title: string; url: string | null; uri: string | null } | null
}

export interface SessionRow {
  id: number
  is_current: boolean
  area_label: string
  device_label: string
  ip_address: string | null
  login_at_human: string | null
  last_active_at_human: string | null
  ended_at_human: string | null
  ended_reason_label: string | null
  active: boolean
  actions: { approve: string; deny: string; revoke: string }
}

export interface PendingSignIn {
  id: number
  device_label: string
  ip_address: string | null
  requested_at_human: string | null
  seconds_left: number
  actions: { approve: string; deny: string; revoke: string }
}

export interface SessionPolicyInfo {
  rule: string
  label: string
  description: string
  source: string
  editable: boolean
  locked_reason: string | null
}

export interface SessionsAccount {
  policy: SessionPolicyInfo
  rules: { rule: string; label: string; description: string }[]
  pending: PendingSignIn[]
  active: SessionRow[]
  history: SessionRow[]
  needs_code: boolean
  elevated: boolean
}

export interface InboxItem {
  id: string
  title: string
  body: string | null
  level: string
  action_url: string | null
  action_label: string | null
  created_at: string
  read: boolean
  status: string
  requires_acceptance: boolean
  accepted: boolean
  can_accept: boolean
  can_snooze: boolean
  can_dismiss: boolean
}

/** A subscriber token for the person's own Mercure topic (15 minutes). The hub is opened directly, not through the proxy. */
export interface StreamInfo {
  hub: string
  topic: string
  token: string
  expires_at: string
}

/** `addons.per_page_theme` of a page: the editor's choice of a page theme (the handle of an installed theme), only on a page that has one. */
export interface PerPageThemeBlock {
  /** Handle of the page theme (e.g. `inbio`). Map it to a React layout; an unknown handle falls back to the default one. */
  theme: string
  /** The page asked to be left out of the navigation and of listings. `/navs`, `/trees` and the collection entries already leave it out; the flags are for a frontend that builds its own lists. */
  hide_nav: boolean
  hide_listings: boolean
}

/** `addons.redirect` of GET /site: where the not-found page reports a 404 for the addon's error list. Present while the Redirect addon is on. */
export interface RedirectSite {
  not_found: string
  log_errors: boolean
}

/** `addons.analitika` of GET /site: present while page views are counted. Nothing about the data leaves Orman. */
export interface AnalitikaSite {
  track_pageviews: true
  /** The pixel to request once per page view (`GET`, same origin through the proxy, never cached). */
  hit: string
  ignore_bots: boolean
}

/** `addons.tracking_code` of GET /site: a product code check (not analytics). The form's fields come from `client.form(form)`. */
export interface TrackingCodeSite {
  form: string
  field: string
  /** `POST` here (CSRF + `Accept: application/json`): `200 {success, message}` or `422 {message, errors}`. */
  redeem: string
  require_login: boolean
  min_length: number
  max_length: number
  check_url?: string
}

// ---- Wave 4 (Headless 6.7): Cargo, Courses, Scoring ------------------------------------------------------------------------------

/** `addons.cargo` of GET /site: where the cart lives and which gateways exist (handle and title only, never a key). */
export interface CargoSite {
  currency: string | null
  /** `GET` the cart, `PATCH` its details, `DELETE` it. Per-person, `no-store`; a guest has a cart too (a cookie). */
  cart: string
  /** `POST {product, quantity, variant?}` adds; `PATCH|DELETE {url}/{id}` changes or removes a line. */
  line_items: string
  shipping: string
  payment_gateways: string
  /** `POST {payment_gateway}` → `200 {order_id, confirmation_url}` | `422 {errors}` | `404`. */
  checkout: string
  /** `GET` with the signed query of `confirmation_url` → the order. `{id}` is replaced. */
  order: string
  /** The frontend page the person lands on after paying (`headless.cargo.confirmation_path`), or null. */
  confirmation_page: string | null
  checkout_page: string | null
  gateways: { handle: string; title: string }[]
  cookie: string
}

/** `addons.cargo` of a product page. Prices are in minor units (pence, rial). */
export interface CargoProductBlock {
  price: number | null
  currency: string | null
  in_stock: boolean
  variants: { key: string; name: string; price: number | null; in_stock: boolean }[]
}

/** One line of the cart as `GET /!/cargo/cart` answers it (`data.line_items[]`). Totals are formatted by the site's currency. */
export interface CartLine {
  id: string
  quantity: number
  variant: unknown
  unit_price: string
  total: string
  product: ({ id: string; title: string; uri: string | null } & CargoProductBlock & Record<string, unknown>) | null
}

export interface CartData {
  id: string
  line_items: CartLine[]
  sub_total: string
  discount_total: string
  tax_total: string
  shipping_total: string
  grand_total: string
  is_free: boolean
}

/** `GET /!/cargo/orders/{id}` behind the signed query: the order without the person's details. Minor units. */
export interface CargoOrder {
  id: string
  order_number: number
  status: string
  currency: string | null
  sub_total: number
  discount_total: number
  tax_total: number
  shipping_total: number
  grand_total: number
  line_items: { id: string; product: { id: string; title: string; uri: string | null } | null; variant: string | null; quantity: number; unit_price: number; total: number }[]
}

/** `addons.courses` of GET /site. */
export interface CoursesSite {
  me: string
  lesson: string
  complete: string
  /** Only while the site allows free enrollment. */
  enroll?: string
}

/** `addons.courses` of a lesson page: the page is a stub, the body comes from `CoursesSite.lesson` for an enrolled student. */
export interface LessonPageBlock {
  kind: 'lesson'
  gated: true
  course?: { id: string; title: string; uri: string | null }
  position?: number
  total?: number
}

/** `addons.courses` of a course page. */
export interface CoursePageBlock {
  kind: 'course'
  lessons: { id: string; title: string; uri: string | null; position: number }[]
  free_enrollment: boolean
}

/** `GET /!/courses/me`. */
export interface MyCourses {
  courses: { id: string; title: string; uri: string | null; lessons: number; completed: number; progress: number; next: { id: string; title: string; uri: string | null } | null }[]
  completed: string[]
}

/** `POST /!/courses/lessons/{id}/complete`. */
export interface LessonCompleted {
  completed: boolean
  lesson_id: string
  course_id: string | null
  next: { id: string; title: string; uri: string | null } | null
  course_done: boolean
}

/** `addons.scoring` of GET /site: the badge catalogue and the three per-person addresses. */
export interface ScoringSite {
  my_score: string
  my_tasks: string
  submit: string
  badge_types: { key: string; name: string; description: string | null; icon: string | null }[]
}

/** `GET /!/scoring/my-score`. */
export interface MyScoreData {
  balance: number
  history: { amount: number; reason: string | null; source_type: string | null; created_at: string | null }[]
  badges: { key: string; name: string; description: string | null; icon: string | null; awarded_at: string | null }[]
}

/** `GET /!/scoring/my-tasks`. */
export interface MyTasksData {
  tasks: { id: string | number; title: string; description: string | null; points: number; mode: string; submit_url: string | null }[]
  pendingSubmissionTaskIds: (string | number)[]
}
