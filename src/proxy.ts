import { NextResponse, type NextRequest } from 'next/server.js'

/** The routes a frontend hands to Orman: its own `/!/` routes, Glide images and uploaded files. */
export const FORWARDED_MATCHER = ['/!/:path*', '/img/:path*', '/assets/:path*'] as const

/** Matches a path the matcher above covers; for a `proxy()` that also does other work (redirects) on other URLs. */
export const FORWARDED = /^\/(?:!|img|assets)(?:\/|$)/

/**
 * The visitor's IP as the platform saw it, never a value the visitor typed.
 * Vercel sets x-vercel-forwarded-for / x-real-ip itself and always overwrites them; self-hosted, only the entry our own reverse
 * proxy appended (the right-most) is trustworthy.
 */
export function clientIp(headers: Headers): string | null {
  const vercel = first(headers.get('x-vercel-forwarded-for')) ?? first(headers.get('x-real-ip'))
  if (vercel) return vercel
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
