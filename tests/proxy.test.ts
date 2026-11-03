import { NextRequest } from 'next/server.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clientIp, forwardToOrman, gated, noopGate, runGates, FORWARDED, type ProxyGate } from '../src/proxy'

const OPTS = { origin: 'https://origin.test', edgeSecret: 'edge-secret' }
const req = (path: string, headers: Record<string, string> = {}, method = 'GET') => new NextRequest(`https://site.test${path}`, { method, headers })
const forward = (path: string, headers: Record<string, string> = {}, options = OPTS) => forwardToOrman(req(path, headers), options)
// Next carries the rewrite target and the overridden request headers on the response.
const target = (res: Response) => res.headers.get('x-middleware-rewrite')
const sent = (res: Response, name: string) => res.headers.get(`x-middleware-request-${name}`)

// Runs as on Vercel unless a test says otherwise.
beforeEach(() => {
  vi.unstubAllEnvs()
  vi.stubEnv('VERCEL', '1')
})

describe('forwardToOrman', () => {
  it('rewrites to the origin keeping path and query', () => {
    const res = forward('/!/auth/json/login?x=1', {})
    expect(target(res)).toBe('https://origin.test/!/auth/json/login?x=1')
  })

  it('reads origin and secret from the environment by default', () => {
    vi.stubEnv('ORMAN_ORIGIN', 'https://env.test')
    vi.stubEnv('ORMAN_EDGE_SECRET', 'env-secret')
    const res = forwardToOrman(req('/img/a.jpg'))
    vi.unstubAllEnvs()
    expect(target(res)).toBe('https://env.test/img/a.jpg')
    expect(sent(res, 'x-orman-edge')).toBe('env-secret')
  })

  it('sets X-Orman-Edge and overwrites a client-sent value', () => {
    expect(sent(forward('/!/x'), 'x-orman-edge')).toBe('edge-secret')
    expect(sent(forward('/!/x', { 'x-orman-edge': 'forged' }), 'x-orman-edge')).toBe('edge-secret')
  })

  it('sets X-Forwarded-Host and -Proto over client values', () => {
    const res = forward('/img/a.jpg', { 'x-forwarded-host': 'evil.test', 'x-forwarded-proto': 'http' })
    expect(sent(res, 'x-forwarded-host')).toBe('site.test')
    expect(sent(res, 'x-forwarded-proto')).toBe('https')
  })

  it('sends one platform IP in X-Forwarded-For and X-Orman-Client-IP', () => {
    const res = forward('/!/csrf-token', { 'x-forwarded-for': '203.0.113.7', 'x-vercel-forwarded-for': '198.51.100.4' })
    expect(sent(res, 'x-forwarded-for')).toBe('198.51.100.4')
    expect(sent(res, 'x-orman-client-ip')).toBe('198.51.100.4')
  })

  it('strips a spoofed X-Orman-Client-IP and sets the platform one', () => {
    const res = forward('/!/x', { 'x-orman-client-ip': '6.6.6.6', 'x-vercel-forwarded-for': '198.51.100.4' })
    expect(sent(res, 'x-orman-client-ip')).toBe('198.51.100.4')
  })

  it('strips a spoofed X-Orman-Client-IP even when the platform gives no IP', () => {
    const res = forward('/!/x', { 'x-orman-client-ip': '6.6.6.6' })
    expect(sent(res, 'x-orman-client-ip')).toBeNull()
    expect(sent(res, 'x-forwarded-for')).toBeNull()
  })

  it('sets X-Orman-Client-IP only with an edge secret (no secret configured, secret not required)', () => {
    const res = forwardToOrman(req('/!/x', { 'x-orman-client-ip': '6.6.6.6', 'x-orman-edge': 'forged', 'x-vercel-forwarded-for': '198.51.100.4' }), {
      origin: 'https://origin.test',
      requireEdgeSecret: false,
    })
    expect(res.status).toBe(200)
    expect(sent(res, 'x-orman-client-ip')).toBeNull()
    expect(sent(res, 'x-orman-edge')).toBeNull()
    expect(sent(res, 'x-forwarded-for')).toBe('198.51.100.4')
  })

  it('self-hosted: uses the right-most X-Forwarded-For entry, never the left-most', () => {
    const res = forward('/!/x', { 'x-forwarded-for': '203.0.113.7, 198.51.100.4' })
    expect(sent(res, 'x-forwarded-for')).toBe('198.51.100.4')
    expect(sent(res, 'x-orman-client-ip')).toBe('198.51.100.4')
  })

  it('fails closed with 502 when the origin or the secret is missing, or the origin is not a URL', () => {
    for (const options of [{ origin: '', edgeSecret: 'x' }, { origin: 'https://o.test', edgeSecret: '' }, { origin: 'not a url', edgeSecret: 'x' }]) {
      vi.stubEnv('ORMAN_ORIGIN', '')
      vi.stubEnv('ORMAN_EDGE_SECRET', '')
      const res = forwardToOrman(req('/!/x'), options)
      vi.unstubAllEnvs()
      expect(res.status).toBe(502)
      expect(target(res)).toBeNull()
    }
  })

  it('leaves the answer alone: it adds no Set-Cookie and no Cache-Control of its own', () => {
    const res = forward('/!/auth/me')
    expect(res.headers.get('set-cookie')).toBeNull()
    expect(res.headers.get('cache-control')).toBeNull()
  })
})

describe('clientIp', () => {
  it('prefers the platform headers', () => {
    expect(clientIp(new Headers({ 'x-vercel-forwarded-for': '1.1.1.1, 2.2.2.2', 'x-real-ip': '3.3.3.3' }))).toBe('1.1.1.1')
    expect(clientIp(new Headers({ 'x-real-ip': '3.3.3.3' }))).toBe('3.3.3.3')
  })
  it('ignores the platform headers off Vercel, where a visitor can send them', () => {
    vi.stubEnv('VERCEL', '')
    expect(clientIp(new Headers({ 'x-vercel-forwarded-for': '6.6.6.6', 'x-real-ip': '6.6.6.6', 'x-forwarded-for': '6.6.6.6, 10.0.0.9' }))).toBe('10.0.0.9')
  })
  it('is null without any', () => {
    expect(clientIp(new Headers())).toBeNull()
  })
})

describe('FORWARDED', () => {
  it('matches the forwarded prefixes only', () => {
    for (const p of ['/!/x', '/img/a', '/assets/a', '/!']) expect(FORWARDED.test(p)).toBe(true)
    for (const p of ['/', '/imgx', '/assetsx', '/themes/!/x']) expect(FORWARDED.test(p)).toBe(false)
  })
})

describe('gates', () => {
  const answer = (body: string): ProxyGate => () => new Response(body, { status: 503 })

  it('noopGate lets everything through', async () => {
    expect(await runGates([noopGate], req('/x'))).toBeUndefined()
    expect(await runGates([], req('/x'))).toBeUndefined()
  })

  it('the first gate that answers wins and later ones do not run', async () => {
    const later = vi.fn<ProxyGate>()
    const res = await runGates([noopGate, answer('first'), later], req('/x'))
    expect(await res?.text()).toBe('first')
    expect(later).not.toHaveBeenCalled()
  })

  it('awaits async gates', async () => {
    const res = await runGates([async () => answer('late')(req('/x'))], req('/x'))
    expect(res?.status).toBe(503)
  })

  it('gated() answers from a gate, else runs the handler', async () => {
    const next = vi.fn(() => forward('/!/x'))
    expect((await gated([answer('down')], next)(req('/page'))).status).toBe(503)
    expect(next).not.toHaveBeenCalled()
    const res = await gated([noopGate], next)(req('/!/x'))
    expect(target(res)).toBe('https://origin.test/!/x')
  })

  it('a gate sees the request (so it can keep /!/csrf-token reachable)', async () => {
    const seen: string[] = []
    const gate: ProxyGate = r => {
      seen.push(r.nextUrl.pathname)
      return r.nextUrl.pathname === '/!/csrf-token' ? undefined : new Response('down', { status: 503 })
    }
    expect(await runGates([gate], req('/!/csrf-token'))).toBeUndefined()
    expect((await runGates([gate], req('/about')))?.status).toBe(503)
    expect(seen).toEqual(['/!/csrf-token', '/about'])
  })
})
