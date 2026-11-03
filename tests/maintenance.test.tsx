// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NextRequest } from 'next/server.js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MaintenancePage } from '../src/components/maintenance-page'
import { bardToHtml, renderMaintenanceHtml } from '../src/maintenance-html'
import { maintenanceGate } from '../src/proxy'
import type { MaintenanceGate, MaintenanceSite, SiteResponse } from '../src/types'

afterEach(cleanup)

const addon = (over: Partial<MaintenanceSite> = {}): MaintenanceSite => ({
  type: 'maintenance',
  title: 'Back <soon>',
  message: { type: 'bard', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'We are ', marks: [] }, { type: 'text', text: 'updating', marks: [{ type: 'bold' }] }, { type: 'text', text: ' & fixing.' }] }] },
  ends_at: null,
  show_countdown: false,
  price: '',
  contact_email: '',
  collect_emails: false,
  has_access: false,
  subscribe: '/!/maintenance/subscribe',
  unlock: '/!/maintenance/unlock',
  labels: { back_soon: 'We will be back shortly.', contact: 'Contact', price: 'Asking price' },
  ...over,
})

const decision = (over: Partial<MaintenanceGate> = {}): MaintenanceGate => ({
  active: true,
  status: 503,
  retry_after: 3600,
  valid_until: null,
  allow_paths: ['up', 'assets/*', 'contact'],
  bypass: { cookie: 'orman_maintenance_bypass', param: 'maintenance_bypass', unlock: '/!/maintenance/unlock', check: '/!/maintenance/check', check_all: false },
  ...over,
})

const siteWith = (gate: MaintenanceGate | undefined, block: MaintenanceSite | undefined = addon()): SiteResponse =>
  ({ contract_version: 1, site: 'default', addons: block ? { maintenance: block } : {}, gates: gate ? { maintenance: gate } : {}, tags: ['site'] }) as SiteResponse

const req = (path: string, headers: Record<string, string> = {}, method = 'GET') => new NextRequest(`https://site.test${path}`, { method, headers })
const OPTS = { origin: 'https://orman.test', edgeSecret: 'edge-secret' }

describe('the page', () => {
  it('<MaintenancePage site> and renderMaintenanceHtml() give the same title, message, countdown, price and contact', () => {
    const cases = [
      addon(),
      addon({ ends_at: '2026-12-01T10:00:00+00:00', show_countdown: true, contact_email: 'help@example.com' }),
      addon({ type: 'sell_domain', price: '$5 000', contact_email: 'sale@example.com', message: { type: 'bard', content: [{ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'For sale' }] }, { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'one', marks: [{ type: 'link', attrs: { href: 'https://example.com/a?b=1&c=2' } }] }] }] }] }] } }),
    ]
    for (const block of cases) {
      const react = renderToStaticMarkup(<MaintenancePage site={block} />)
      const html = renderMaintenanceHtml(block)
      const body = /<main class="orman-maintenance">([\s\S]*)<\/main>/.exec(html)![1]
      expect(body).toBe(/<main class="orman-maintenance">([\s\S]*)<\/main>/.exec(react)![1])
    }
  })

  it('escapes what an editor typed, and drops unknown marks and unsafe links', () => {
    const html = bardToHtml([{ type: 'paragraph', content: [{ type: 'text', text: '<script>alert(1)</script>', marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }, { type: 'evil' }] }] }])
    expect(html).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>')
    expect(renderMaintenanceHtml(addon({ title: '"><img src=x>' }))).not.toContain('<img')
  })

  it('has the subscribe and unlock forms only when the site offers them', () => {
    const plain = renderMaintenanceHtml(addon())
    expect(plain).not.toContain('<form')
    expect(plain).not.toContain('<script>')
    const both = renderMaintenanceHtml(addon({ collect_emails: true, has_access: true }))
    expect(both).toContain('action="/!/maintenance/subscribe"')
    expect(both).toContain('action="/!/maintenance/unlock"')
    const { container } = render(<MaintenancePage site={addon({ collect_emails: true, has_access: true })} />)
    expect(container.querySelector('form.orman-maintenance__subscribe')?.getAttribute('action')).toBe('/!/maintenance/subscribe')
    expect(container.querySelector('form.orman-maintenance__unlock input[type=password]')).not.toBeNull()
  })

  it('still takes a plain title and message', () => {
    const { container } = render(<MaintenancePage title="Down" message="Soon">extra</MaintenancePage>)
    expect(container.querySelector('.orman-maintenance__title')?.textContent).toBe('Down')
    expect(container.querySelector('.orman-maintenance__message')?.textContent).toBe('Soon')
  })
})

describe('maintenanceGate', () => {
  let now = 1_000_000
  beforeEach(() => {
    now = 1_000_000
  })
  const gateFor = (site: SiteResponse, options = {}) => maintenanceGate(async () => site, { ...OPTS, now: () => now, ...options })

  it('lets everything through while maintenance is off or there is no gate', async () => {
    expect(await gateFor(siteWith(decision({ active: false })))(req('/about'))).toBeUndefined()
    expect(await gateFor(siteWith(undefined))(req('/about'))).toBeUndefined()
  })

  it('answers a page with 503, Retry-After, noindex, no-store and the maintenance page', async () => {
    const res = (await gateFor(siteWith(decision()))(req('/about')))!
    expect(res.status).toBe(503)
    expect(res.headers.get('Retry-After')).toBe('3600')
    expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow')
    expect(res.headers.get('Cache-Control')).toBe('no-store')
    expect(res.headers.get('Content-Type')).toContain('text/html')
    const html = await res.text()
    expect(html).toContain('class="orman-maintenance__title">Back &lt;soon&gt;</h1>')
  })

  it('answers 200 without Retry-After when the editor chose 200, and HEAD without a body', async () => {
    const ok = (await gateFor(siteWith(decision({ status: 200 })))(req('/about')))!
    expect(ok.status).toBe(200)
    expect(ok.headers.get('Retry-After')).toBeNull()
    const head = (await gateFor(siteWith(decision()))(req('/about', {}, 'HEAD')))!
    expect(head.status).toBe(503)
    expect(await head.text()).toBe('')
  })

  it('keeps /!/*, /img/*, /assets/*, /_next/*, the editor\'s allowed paths and the extra ones open', async () => {
    const gate = gateFor(siteWith(decision()), { allow: ['/status', 'docs/*'] })
    for (const path of ['/!/csrf-token', '/!/forms/contact', '/!/maintenance/unlock', '/img/a.jpg', '/assets/x.pdf', '/_next/static/a.js', '/favicon.ico', '/robots.txt', '/up', '/contact', '/status', '/docs/a/b']) {
      expect(await gate(req(path)), path).toBeUndefined()
    }
    for (const path of ['/', '/contactus', '/about', '/status/x', '/sitemap.xml']) {
      expect((await gate(req(path)))?.status, path).toBe(503)
    }
  })

  it('does not match a path that merely starts like an open one', async () => {
    const gate = gateFor(siteWith(decision()))
    expect((await gate(req('/assetsx/a')))?.status).toBe(503)
    expect((await gate(req('/!x')))?.status).toBe(503)
  })

  it('asks Orman about a visitor holding the bypass cookie, with the cookie and the visitor address, and lets a passing one through', async () => {
    const f = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ pass: true }), { status: 200 }))
    vi.stubEnv('VERCEL', '1')
    const gate = gateFor(siteWith(decision()), { fetch: f })
    expect(await gate(req('/about', { cookie: 'orman_maintenance_bypass=abc; other=1', 'x-vercel-forwarded-for': '198.51.100.4' }))).toBeUndefined()
    const [url, init] = f.mock.calls[0] as [URL, RequestInit]
    expect(String(url)).toBe('https://orman.test/!/maintenance/check')
    const headers = init.headers as Record<string, string>
    expect(headers.Cookie).toBe('orman_maintenance_bypass=abc')
    expect(headers['X-Orman-Edge']).toBe('edge-secret')
    expect(headers['X-Orman-Client-IP']).toBe('198.51.100.4')
    vi.unstubAllEnvs()
  })

  it('shows the page when Orman says the cookie is not valid, when it is unreachable, and never asks without a cookie', async () => {
    const no = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ pass: false }), { status: 200 }))
    expect((await gateFor(siteWith(decision()), { fetch: no })(req('/about', { cookie: 'orman_maintenance_bypass=forged' })))?.status).toBe(503)
    const down = vi.fn<typeof fetch>(async () => {
      throw new Error('down')
    })
    expect((await gateFor(siteWith(decision()), { fetch: down })(req('/about', { cookie: 'orman_maintenance_bypass=abc' })))?.status).toBe(503)
    const none = vi.fn<typeof fetch>()
    expect((await gateFor(siteWith(decision()), { fetch: none })(req('/about')))?.status).toBe(503)
    expect(none).not.toHaveBeenCalled()
  })

  it('asks for every visitor when the CP keeps an address allow-list', async () => {
    const f = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ pass: true }), { status: 200 }))
    const gate = gateFor(siteWith(decision({ bypass: { ...decision().bypass, check_all: true } })), { fetch: f })
    expect(await gate(req('/about'))).toBeUndefined()
    expect(f).toHaveBeenCalledOnce()
  })

  it('passes a link with the right key on to Orman and redirects to the clean URL carrying Orman\'s cookie', async () => {
    const headers = new Headers({ 'Content-Type': 'application/json' })
    headers.append('Set-Cookie', 'orman_maintenance_bypass=tok; Path=/; HttpOnly; SameSite=Lax')
    const f = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ pass: true }), { status: 200, headers }))
    const res = (await gateFor(siteWith(decision()), { fetch: f })(req('/about?maintenance_bypass=KEY&x=1')))!
    expect(String((f.mock.calls[0][0] as URL))).toBe('https://orman.test/!/maintenance/check?maintenance_bypass=KEY')
    expect(res.status).toBe(307)
    expect(res.headers.get('Location')).toBe('https://site.test/about?x=1')
    expect(res.headers.get('Set-Cookie')).toContain('orman_maintenance_bypass=tok')
  })

  it('shows the page for a wrong key', async () => {
    const f = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ pass: false }), { status: 200 }))
    expect((await gateFor(siteWith(decision()), { fetch: f })(req('/about?maintenance_bypass=nope')))?.status).toBe(503)
  })

  it('without an origin or edge secret it cannot vouch for a cookie: the page shows', async () => {
    const f = vi.fn<typeof fetch>()
    const gate = maintenanceGate(async () => siteWith(decision()), { fetch: f, origin: '', edgeSecret: '' })
    expect((await gate(req('/about', { cookie: 'orman_maintenance_bypass=abc' })))?.status).toBe(503)
    expect(f).not.toHaveBeenCalled()
  })

  it('keeps the /site answer for ttlMs and not past valid_until', async () => {
    const getSite = vi.fn(async () => siteWith(decision({ valid_until: new Date(now + 5000).toISOString() })))
    const gate = maintenanceGate(getSite, { ...OPTS, now: () => now, ttlMs: 60_000 })
    await gate(req('/a'))
    now += 4000
    await gate(req('/a'))
    expect(getSite).toHaveBeenCalledTimes(1)
    now += 2000
    await gate(req('/a'))
    expect(getSite).toHaveBeenCalledTimes(2)
  })

  it('lets requests through (and says so) when /site cannot be read, keeping the last good answer if it has one', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let fail = false
    const getSite = vi.fn(async () => {
      if (fail) throw new Error('down')
      return siteWith(decision())
    })
    const gate = maintenanceGate(getSite, { ...OPTS, now: () => now, ttlMs: 1 })
    expect((await gate(req('/a')))?.status).toBe(503)
    fail = true
    now += 10
    expect((await gate(req('/a')))?.status, 'the last good decision still holds').toBe(503)
    const fresh = maintenanceGate(async () => {
      throw new Error('down')
    }, OPTS)
    expect(await fresh(req('/a'))).toBeUndefined()
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  it('can answer with the app\'s own page', async () => {
    const gate = gateFor(siteWith(decision()), { render: ({ site }: { site?: MaintenanceSite }) => new Response(site?.title, { status: 503 }) })
    expect(await (await gate(req('/a')))!.text()).toBe('Back <soon>')
  })
})
