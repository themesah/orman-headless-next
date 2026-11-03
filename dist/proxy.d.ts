import { NextRequest } from 'next/server.js';
import { MaintenanceSite, MaintenanceGate, SiteResponse } from './types.js';

interface MaintenanceHtmlOptions {
    lang?: string;
    dir?: 'ltr' | 'rtl';
    /** Extra markup for `<head>` (a stylesheet link). */
    head?: string;
    /** The CSRF address the inline script uses. */
    csrfUrl?: string;
}

/**
 * The routes a frontend hands to Orman: its own `/!/` routes, Glide images and uploaded files. For reference and tests only:
 * Next reads `config.matcher` statically at build time, so `proxy.ts` must write the literal out (a spread fails the build).
 */
declare const FORWARDED_MATCHER: readonly ["/!/:path*", "/img/:path*", "/assets/:path*"];
/** Matches a path the matcher above covers; for a `proxy()` that also does other work (redirects) on other URLs. */
declare const FORWARDED: RegExp;
/**
 * The visitor's IP as the platform saw it, never a value the visitor typed.
 * Vercel sets x-vercel-forwarded-for / x-real-ip itself and always overwrites them; self-hosted, only the entry our own reverse
 * proxy appended (the right-most) is trustworthy.
 */
declare function clientIp(headers: Headers): string | null;
interface ForwardOptions {
    /** Defaults to `process.env.ORMAN_ORIGIN`. */
    origin?: string;
    /** Defaults to `process.env.ORMAN_EDGE_SECRET`. Sent as `X-Orman-Edge`. */
    edgeSecret?: string;
    /**
     * Without an edge secret Orman treats the request as direct (and ignores `X-Orman-Client-IP`), so by default the proxy fails
     * closed with a 502. Set `false` only for a dev setup that really has no secret: the request is then forwarded without
     * `X-Orman-Edge` and without a client IP.
     */
    requireEdgeSecret?: boolean;
    /** Defaults to {@link clientIp}. */
    clientIp?: (headers: Headers) => string | null;
}
/**
 * Forwards a request to Orman through `NextResponse.rewrite`. The upstream answer goes back to the visitor as Orman sent it:
 * `Set-Cookie` (the session) and `Cache-Control` are not touched here, so a guest answer Orman marks `private` stays private.
 *
 * Header rules, each tested:
 * - `X-Orman-Edge` is set from the configured secret and overwrites a client-sent value (deleted when no secret is configured).
 * - `X-Forwarded-Host` / `-Proto` are set from the request, overwriting client values.
 * - `X-Forwarded-For` is exactly one trusted IP (Orman reads the left-most entry, so a client chain would pick its own IP).
 * - `X-Orman-Client-IP` is **always deleted** from the client's request and set from the platform's IP **only when an edge secret
 *   is configured**: Orman (Headless `TrustEdge`) believes it only together with a valid `X-Orman-Edge`.
 *
 * The response also carries `x-middleware-rewrite` with the origin URL. Next adds it itself after the proxy returns, so it cannot be stripped.
 */
declare function forwardToOrman(req: NextRequest, options?: ForwardOptions): Response;
/**
 * A request gate: look at a request and either answer it (a `Response`, e.g. the maintenance page or a redirect to sign-in) or
 * return nothing to let it through. The Maintenance (6.4) and Sessions (6.5) gates plug in here, fed by the contributors'
 * `gate()` decisions. Keep `/!/csrf-token` reachable in any gate that blocks pages.
 */
type ProxyGate = (req: NextRequest) => Response | void | undefined | Promise<Response | void | undefined>;
/** A gate that lets everything through; the default until an addon brings one. */
declare const noopGate: ProxyGate;
/** The first gate that answers wins; with none answering, `undefined`. Gates run in order and one at a time. */
declare function runGates(gates: readonly ProxyGate[], req: NextRequest): Promise<Response | undefined>;
/** Wraps a handler so the gates run first: `proxy = gated([maintenanceGate], req => forwardToOrman(req))`. */
declare function gated(gates: readonly ProxyGate[], next: (req: NextRequest) => Response | Promise<Response>): (req: NextRequest) => Promise<Response>;
interface MaintenanceGateOptions {
    /** Defaults to `process.env.ORMAN_ORIGIN`. */
    origin?: string;
    /** Defaults to `process.env.ORMAN_EDGE_SECRET`. */
    edgeSecret?: string;
    /** Defaults to the global `fetch`. */
    fetch?: typeof fetch;
    /** Extra paths (patterns like `allow_paths`, with or without the leading slash) that stay open. */
    allow?: readonly string[];
    /** How long one process keeps the `/site` answer, at most (it never outlives `valid_until`). Default 15 000 ms. */
    ttlMs?: number;
    /** Options for the built-in page (`lang`, `dir`, `head`). */
    page?: MaintenanceHtmlOptions;
    /** Your own answer instead of the built-in page: a Response with the status and headers you pick. */
    render?: (context: {
        site: MaintenanceSite | undefined;
        gate: MaintenanceGate;
    }) => Response | Promise<Response>;
    /** For tests. */
    now?: () => number;
}
/**
 * The Maintenance gate: while the site is in maintenance mode, a visitor gets the maintenance page (HTTP 503 with `Retry-After`,
 * `noindex`, `no-store`) instead of the site, unless the path is one of the open ones or Orman recognises the visitor.
 *
 * `getSite` returns the (cached) `/site` answer, e.g. `() => orman.site()`; the decision is `gates.maintenance` in it. This process
 * keeps the answer for `ttlMs` at most, and never past `valid_until` (the moment the window opens or closes by itself). The
 * editor's change reaches here through `revalidateTag('site')` for the cached client and within `ttlMs` for this memory.
 *
 * Open paths: `/!/*` (including `/!/csrf-token`, the form posts and the unlock/subscribe routes), `/img/*`, `/assets/*`, `/_next/*`,
 * `favicon.ico`, `robots.txt`, the editor's `allow_paths`, and `allow`. A visitor holding the bypass cookie (or, when the CP keeps an
 * address allow-list, any visitor) is checked by Orman at `/!/maintenance/check`, because the cookie is an HMAC with Orman's key;
 * a link with `?maintenance_bypass=<key>` is passed on to it and the cookie it sets is returned with a redirect to the clean URL.
 *
 * If `/site` cannot be read the gate lets the request through and logs: a broken read API must not take a public site down.
 */
declare function maintenanceGate(getSite: () => Promise<SiteResponse>, options?: MaintenanceGateOptions): ProxyGate;

export { FORWARDED, FORWARDED_MATCHER, type ForwardOptions, type MaintenanceGateOptions, type ProxyGate, clientIp, forwardToOrman, gated, maintenanceGate, noopGate, runGates };
