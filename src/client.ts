import 'server-only'
import type { EntriesResponse, GlobalsResponse, NavResponse, PageResponse, PathsResponse, SiteResponse, Tagged, TreeResponse } from './types'

const DEFAULT_PREFIX = '/api/headless/v1'

export interface ClientOptions {
  /** The Orman origin, e.g. `https://orman.example.com`. */
  origin: string
  /** The read token (`Authorization: Bearer`). It is only ever sent from the server. */
  token: string
  /** Defaults to `/api/headless/v1`. */
  apiPrefix?: string
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch
  /** Tries per request for network failures (not for HTTP statuses). Default 3. */
  attempts?: number
  /** Pause before retry n is `retryDelayMs * n`. Default 500. */
  retryDelayMs?: number
}

export interface GetOptions {
  /**
   * A live-preview token (`X-Orman-Token`). The answer is then never cached. Pass it only when a draft cookie and a token are both
   * present: a draft cookie alone is not a preview.
   */
  previewToken?: string
  /** Extra `fetch` init, merged over the kit's (`next.tags` and `revalidate`, or `cache: 'no-store'` for a preview). */
  init?: RequestInit
}

// Layer 1 of the tag strategy: tags knowable from the request alone.
export function tagsForPath(path: string): string[] {
  const tags = ['orman:all']
  const [route, query = ''] = path.split('?', 2)
  const segments = route.split('/').filter(Boolean)

  if (segments[0] === 'page') {
    const uri = new URLSearchParams(query).get('uri')
    if (uri) tags.push(`path:${uri}`)
  } else if (segments[0] === 'paths') {
    tags.push('paths')
  } else if (segments[0] === 'site') {
    tags.push('site')
  } else if (segments[0] === 'collections' && segments[1]) {
    tags.push(`collection:${decodeURIComponent(segments[1])}`)
  } else if (segments[0] === 'trees' && segments[1] === 'collections' && segments[2]) {
    tags.push(`collection:${decodeURIComponent(segments[2])}`)
  } else if (segments[0] === 'navs' && segments[1]) {
    tags.push(`nav:${decodeURIComponent(segments[1])}`)
  } else if (segments[0] === 'globals' && segments[1]) {
    tags.push(`global:${decodeURIComponent(segments[1])}`)
  }
  return tags
}

type Query = Record<string, string | number | boolean | undefined | null>

function withQuery(path: string, query?: Query): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${path}?${qs}` : path
}

export interface OrmanClient {
  /** The raw call: `path` starts with `/` and is relative to the API prefix, e.g. `/page?uri=/about`. */
  get<T>(path: string, options?: GetOptions): Promise<T & Tagged>
  paths(query?: { site?: string; page?: number; per_page?: number }, options?: GetOptions): Promise<PathsResponse>
  /** A 404 is data (`{ type: 'not_found' }`), cached like any page so publishing refreshes it. */
  page(uri: string, query?: { site?: string }, options?: GetOptions): Promise<PageResponse>
  site(query?: { site?: string }, options?: GetOptions): Promise<SiteResponse>
  /** One global set when `handle` is given, else the list. */
  globals(handle?: string, query?: { site?: string }, options?: GetOptions): Promise<GlobalsResponse>
  navs(handle: string, query?: { site?: string }, options?: GetOptions): Promise<NavResponse>
  trees(handle: string, query?: { site?: string; fields?: string[] }, options?: GetOptions): Promise<TreeResponse>
  /** Entries of a collection (pagination and filters pass through as query parameters). */
  entries(handle: string, query?: Query, options?: GetOptions): Promise<EntriesResponse>
}

/**
 * The typed read client. Server-only: the token must never reach a client bundle, so this module imports `server-only` and
 * a client component that imports it fails the build.
 */
export function createOrmanClient(options: ClientOptions): OrmanClient {
  const { origin, token } = options
  const prefix = options.apiPrefix || DEFAULT_PREFIX
  const doFetch = options.fetch ?? ((url: string, init: RequestInit) => fetch(url, init))
  const attempts = options.attempts ?? 3
  const delay = options.retryDelayMs ?? 500

  // Network failures (connect timeouts while a cold Orman is hit by parallel build workers) are retried;
  // HTTP error statuses are not, they are answers.
  async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await doFetch(url, init)
      } catch (error) {
        if (attempt >= attempts) throw error
        await new Promise(resolve => setTimeout(resolve, delay * attempt))
      }
    }
  }

  async function get<T>(path: string, opts: GetOptions = {}): Promise<T & Tagged> {
    const headers: Record<string, string> = { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    const preview = !!opts.previewToken
    if (preview) headers['X-Orman-Token'] = opts.previewToken as string

    const res = await fetchWithRetry(`${origin}${prefix}${path}`, {
      headers,
      ...(preview ? { cache: 'no-store' as const } : { next: { tags: tagsForPath(path), revalidate: false as const } }),
      ...opts.init,
    })
    // A 404 is data (type "not_found").
    if (res.status === 404) return (await res.json()) as T & Tagged
    if (!res.ok) throw new Error(`Orman ${res.status} for ${path}`)
    return (await res.json()) as T & Tagged
  }

  const call = <T>(path: string, query: Query | undefined, o?: GetOptions) => get<T>(withQuery(path, query), o)

  return {
    get,
    paths: (query, o) => call<PathsResponse>('/paths', query, o),
    page: (uri, query, o) => call<PageResponse>('/page', { uri, ...query }, o),
    site: (query, o) => call<SiteResponse>('/site', query, o),
    globals: (handle, query, o) => call<GlobalsResponse>(handle ? `/globals/${encodeURIComponent(handle)}` : '/globals', query, o),
    navs: (handle, query, o) => call<NavResponse>(`/navs/${encodeURIComponent(handle)}`, query, o),
    trees: (handle, query, o) =>
      call<TreeResponse>(`/trees/collections/${encodeURIComponent(handle)}`, { site: query?.site, fields: query?.fields?.join(',') }, o),
    entries: (handle, query, o) => call<EntriesResponse>(`/collections/${encodeURIComponent(handle)}/entries`, query, o),
  }
}
