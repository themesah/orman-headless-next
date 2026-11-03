import { NextResponse, type NextRequest } from 'next/server.js'
import { renderMaintenanceHtml, type MaintenanceHtmlOptions } from './maintenance-html'
import type { MaintenanceGate, MaintenanceSite, SiteResponse } from './types'

/**
 * The routes a frontend hands to Orman: its own `/!/` routes, Glide images and uploaded files. For reference and tests only:
 * Next reads `config.matcher` statically at build time, so `proxy.ts` must write the literal out (a spread fails the build).
 */
export const FORWARDED_MATCHER = ['/!/:path*', '/img/:path*', '/assets/:path*'] as const

/** Matches a path the matcher above covers; for a `proxy()` that also does other work (redirects) on other URLs. */
export const FORWARDED = /^\/(?:!|img|assets)(?:\/|$)/

/**
 * The visitor's IP as the platform saw it, never a value the visitor typed.
 * Vercel sets x-vercel-forwarded-for / x-real-ip itself and always overwrites them; self-hosted, only the entry our own reverse
 * proxy appended (the right-most) is trustworthy.
 */
export function clientIp(headers: Headers): string | null {
  // Only on Vercel are these set by the platform; anywhere else a visitor can send them and pick their own IP.
  if (process.env.VERCEL) {
    const vercel = first(headers.get('x-vercel-forwarded-for')) ?? first(headers.get('x-real-ip'))
    if (vercel) return vercel
  }
  const chain = headers.get('x-forwarded-for')?.split(',').map(s => s.trim()).filter(Boolean)
  return chain?.length ? chain[chain.length - 1] : null
}

function first(value: string | null): string | null {
  return value?.split(',')[0]?.trim() || null
}

export interface ForwardOptions {
  /** Defaults to `process.env.ORMAN_ORIGIN`. */
  origin?: string
  /** Defaults to `process.env.ORMAN_EDGE_SECRET`. Sent as `X-Orman-Edge`. */
  edgeSecret?: string
  /**
   * Without an edge secret Orman treats the request as direct (and ignores `X-Orman-Client-IP`), so by default the proxy fails
   * closed with a 502. Set `false` only for a dev setup that really has no secret: the request is then forwarded without
   * `X-Orman-Edge` and without a client IP.
   */
  requireEdgeSecret?: boolean
  /** Defaults to {@link clientIp}. */
  clientIp?: (headers: Headers) => string | null
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
export function forwardToOrman(req: NextRequest, options: ForwardOptions = {}): Response {
  const origin = options.origin ?? process.env.ORMAN_ORIGIN
  const secret = options.edgeSecret ?? process.env.ORMAN_EDGE_SECRET
  const requireSecret = options.requireEdgeSecret ?? true
  let target: URL
  try {
    if (!origin || (requireSecret && !secret)) throw new Error('missing')
    target = new URL(req.nextUrl.pathname + req.nextUrl.search, origin)
  } catch {
    // Fail closed: without the secret Orman would treat the request as direct, and a bad origin has nowhere to go.
    return new NextResponse('Bad gateway: ORMAN_ORIGIN or ORMAN_EDGE_SECRET is not configured', { status: 502 })
  }

  const headers = new Headers(req.headers)
  headers.delete('X-Orman-Client-IP')
  if (secret) headers.set('X-Orman-Edge', secret)
  else headers.delete('X-Orman-Edge')
  headers.set('X-Forwarded-Host', req.nextUrl.host)
  headers.set('X-Forwarded-Proto', req.nextUrl.protocol.replace(':', ''))
  const ip = (options.clientIp ?? clientIp)(req.headers)
  if (ip) {
    headers.set('X-Forwarded-For', ip)
    if (secret) headers.set('X-Orman-Client-IP', ip)
  } else {
    headers.delete('X-Forwarded-For')
  }
  return NextResponse.rewrite(target, { request: { headers } })
}

/**
 * A request gate: look at a request and either answer it (a `Response`, e.g. the maintenance page or a redirect to sign-in) or
 * return nothing to let it through. The Maintenance (6.4) and Sessions (6.5) gates plug in here, fed by the contributors'
 * `gate()` decisions. Keep `/!/csrf-token` reachable in any gate that blocks pages.
 */
export type ProxyGate = (req: NextRequest) => Response | void | undefined | Promise<Response | void | undefined>

/** A gate that lets everything through; the default until an addon brings one. */
export const noopGate: ProxyGate = () => undefined

/** The first gate that answers wins; with none answering, `undefined`. Gates run in order and one at a time. */
export async function runGates(gates: readonly ProxyGate[], req: NextRequest): Promise<Response | undefined> {
  for (const gate of gates) {
    const answer = await gate(req)
    if (answer) return answer
  }
  return undefined
}

/** Wraps a handler so the gates run first: `proxy = gated([maintenanceGate], req => forwardToOrman(req))`. */
export function gated(
  gates: readonly ProxyGate[],
  next: (req: NextRequest) => Response | Promise<Response>,
): (req: NextRequest) => Promise<Response> {
  return async req => (await runGates(gates, req)) ?? next(req)
}

// ---- the Maintenance gate ----------------------------------------------------------------------------------------------------

export interface MaintenanceGateOptions {
  /** Defaults to `process.env.ORMAN_ORIGIN`. */
  origin?: string
  /** Defaults to `process.env.ORMAN_EDGE_SECRET`. */
  edgeSecret?: string
  /** Defaults to the global `fetch`. */
  fetch?: typeof fetch
  /** Extra paths (patterns like `allow_paths`, with or without the leading slash) that stay open. */
  allow?: readonly string[]
  /** How long one process keeps the `/site` answer, at most (it never outlives `valid_until`). Default 15 000 ms. */
  ttlMs?: number
  /** Options for the built-in page (`lang`, `dir`, `head`). */
  page?: MaintenanceHtmlOptions
  /** Your own answer instead of the built-in page: a Response with the status and headers you pick. */
  render?: (context: { site: MaintenanceSite | undefined; gate: MaintenanceGate }) => Response | Promise<Response>
  /** For tests. */
  now?: () => number
}

/** Always open, whatever the gate says: Orman's own routes, images, uploaded files and the framework's assets. */
const ALWAYS_OPEN = /^\/(?:!|img|assets|_next)(?:\/|$)|^\/(?:favicon\.ico|robots\.txt)$/

function patternToRegExp(pattern: string): RegExp {
  const body = pattern.replace(/^\/+/, '').split('*').map(part => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*')
  return new RegExp(`^/${body}$`)
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
export function maintenanceGate(getSite: () => Promise<SiteResponse>, options: MaintenanceGateOptions = {}): ProxyGate {
  const now = options.now ?? Date.now
  const ttl = options.ttlMs ?? 15_000
  let memo: { site: SiteResponse; until: number } | null = null
  const extra = (options.allow ?? []).map(patternToRegExp)

  async function read(): Promise<SiteResponse | null> {
    if (memo && now() < memo.until) return memo.site
    try {
      const site = await getSite()
      const validUntil = site.gates?.maintenance?.valid_until ? Date.parse(site.gates.maintenance.valid_until) : Infinity
      memo = { site, until: Math.min(now() + ttl, validUntil) }
      return site
    } catch (error) {
      console.error('maintenanceGate: could not read /site, letting the request through:', error)
      return memo?.site ?? null
    }
  }

  return async req => {
    const site = await read()
    const gate = site?.gates?.maintenance
    if (!site || !gate?.active) return undefined

    const path = req.nextUrl.pathname
    if (ALWAYS_OPEN.test(path) || extra.some(r => r.test(path)) || gate.allow_paths.some(p => patternToRegExp(p).test(path))) return undefined

    const verdict = await check(req, gate, options)
    if (verdict.pass) {
      if (!verdict.setCookie) return undefined
      // The key in the link was right: keep Orman's cookie and show the page without the key.
      const clean = req.nextUrl.clone()
      clean.searchParams.delete(gate.bypass.param)
      const response = NextResponse.redirect(clean)
      for (const cookie of verdict.setCookie) response.headers.append('Set-Cookie', cookie)
      return response
    }

    const addon = site.addons.maintenance
    if (options.render) return options.render({ site: addon, gate })
    const html = renderMaintenanceHtml(addon, options.page)
    const headers: Record<string, string> = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' }
    if (gate.status === 503 && gate.retry_after) headers['Retry-After'] = String(gate.retry_after)
    return new Response(req.method === 'HEAD' ? null : html, { status: gate.status, headers })
  }
}

async function check(req: NextRequest, gate: MaintenanceGate, options: MaintenanceGateOptions): Promise<{ pass: boolean; setCookie?: string[] }> {
  const key = req.nextUrl.searchParams.get(gate.bypass.param)
  const cookie = req.cookies.get(gate.bypass.cookie)
  if (!key && !cookie && !gate.bypass.check_all) return { pass: false }

  const origin = options.origin ?? process.env.ORMAN_ORIGIN
  const secret = options.edgeSecret ?? process.env.ORMAN_EDGE_SECRET
  if (!origin || !secret) return { pass: false }

  try {
    const url = new URL(gate.bypass.check, origin)
    if (key) url.searchParams.set(gate.bypass.param, key)
    const headers: Record<string, string> = { Accept: 'application/json', 'X-Orman-Edge': secret }
    if (cookie) headers.Cookie = `${cookie.name}=${cookie.value}`
    const ip = clientIp(req.headers)
    if (ip) {
      headers['X-Forwarded-For'] = ip
      headers['X-Orman-Client-IP'] = ip
    }
    const res = await (options.fetch ?? fetch)(url, { headers, cache: 'no-store' })
    if (!res.ok) return { pass: false }
    const body = (await res.json()) as { pass?: boolean }
    return body.pass ? { pass: true, setCookie: key ? res.headers.getSetCookie() : undefined } : { pass: false }
  } catch {
    // Orman unreachable: the visitor sees the maintenance page, the safe side of a gate.
    return { pass: false }
  }
}
