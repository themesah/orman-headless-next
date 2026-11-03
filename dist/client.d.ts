import { Tagged, PathsResponse, PageResponse, SiteResponse, GlobalsResponse, NavResponse, TreeResponse, EntriesResponse } from './types.js';

interface ClientOptions {
    /** The Orman origin, e.g. `https://orman.example.com`. */
    origin: string;
    /** The read token (`Authorization: Bearer`). It is only ever sent from the server. */
    token: string;
    /** Defaults to `/api/headless/v1`. */
    apiPrefix?: string;
    /** Defaults to the global `fetch`. */
    fetch?: typeof fetch;
    /** Tries per request for network failures (not for HTTP statuses). Default 3. */
    attempts?: number;
    /** Pause before retry n is `retryDelayMs * n`. Default 500. */
    retryDelayMs?: number;
}
interface GetOptions {
    /**
     * A live-preview token (`X-Orman-Token`). The answer is then never cached. Pass it only when a draft cookie and a token are both
     * present: a draft cookie alone is not a preview.
     */
    previewToken?: string;
    /** Extra `fetch` init, merged over the kit's (`next.tags` and `revalidate`, or `cache: 'no-store'` for a preview). */
    init?: RequestInit;
}
declare function tagsForPath(path: string): string[];
type Query = Record<string, string | number | boolean | undefined | null>;
interface OrmanClient {
    /** The raw call: `path` starts with `/` and is relative to the API prefix, e.g. `/page?uri=/about`. */
    get<T>(path: string, options?: GetOptions): Promise<T & Tagged>;
    paths(query?: {
        site?: string;
        page?: number;
        per_page?: number;
    }, options?: GetOptions): Promise<PathsResponse>;
    /** A 404 is data (`{ type: 'not_found' }`), cached like any page so publishing refreshes it. */
    page(uri: string, query?: {
        site?: string;
    }, options?: GetOptions): Promise<PageResponse>;
    site(query?: {
        site?: string;
    }, options?: GetOptions): Promise<SiteResponse>;
    /** One global set when `handle` is given, else the list. */
    globals(handle?: string, query?: {
        site?: string;
    }, options?: GetOptions): Promise<GlobalsResponse>;
    navs(handle: string, query?: {
        site?: string;
    }, options?: GetOptions): Promise<NavResponse>;
    trees(handle: string, query?: {
        site?: string;
        fields?: string[];
    }, options?: GetOptions): Promise<TreeResponse>;
    /** Entries of a collection (pagination and filters pass through as query parameters). */
    entries(handle: string, query?: Query, options?: GetOptions): Promise<EntriesResponse>;
}
/**
 * The typed read client. Server-only: the token must never reach a client bundle, so this module imports `server-only` and
 * a client component that imports it fails the build.
 */
declare function createOrmanClient(options: ClientOptions): OrmanClient;

export { type ClientOptions, type GetOptions, type OrmanClient, createOrmanClient, tagsForPath };
