// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CodeCheck } from '../src/components/code-check'
import { NotFoundBeacon } from '../src/components/not-found'
import { PageView, hitUrl, referrerHost } from '../src/components/analytics'
import type { AnalitikaSite, FormSchema, SiteResponse, TrackingCodeSite } from '../src/types'

vi.mock('next/navigation', () => ({ usePathname: () => '/about' }))

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const analitika: AnalitikaSite = { track_pageviews: true, hit: '/!/analitika/hit', ignore_bots: true }

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  Object.defineProperty(navigator, 'doNotTrack', { value: null, configurable: true })
})
beforeEach(() => Object.defineProperty(navigator, 'doNotTrack', { value: null, configurable: true }))

function stub() {
  const f = vi.fn<typeof fetch>(async url => (url === '/!/csrf-token' ? json(200, { csrf_token: 'tok' }) : json(200, { logged: true })))
  vi.stubGlobal('fetch', f)
  return f
}

describe('<PageView>', () => {
  it('requests the pixel once per path, without cookies, even if it renders again', async () => {
    const f = stub()
    const { rerender } = render(<PageView site={analitika} entryId="abc" />)
    rerender(<PageView site={analitika} entryId="abc" />)
    await waitFor(() => expect(f).toHaveBeenCalledTimes(1))
    const [url, init] = f.mock.calls[0]
    expect(url).toBe('/!/analitika/hit?e=abc&p=%2Fabout')
    expect(init).toMatchObject({ method: 'GET', credentials: 'omit', cache: 'no-store', keepalive: true })
  })

  it('sends nothing when views are not counted, or the browser says do not track', async () => {
    const f = stub()
    render(<PageView site={undefined} />)
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true })
    render(<PageView site={analitika} />)
    await new Promise(r => setTimeout(r, 10))
    expect(f).not.toHaveBeenCalled()
  })

  it('counts a do-not-track visitor when the site chooses to', async () => {
    const f = stub()
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true })
    render(<PageView site={analitika} respectDnt={false} />)
    await waitFor(() => expect(f).toHaveBeenCalledTimes(1))
  })

  it('names the referring host only when it is another site', () => {
    expect(hitUrl(analitika, { path: '/x', referrer: 'https://news.example/a?b=1', host: 'me.example' })).toBe('/!/analitika/hit?p=%2Fx&r=news.example')
    expect(referrerHost('https://me.example/y', 'me.example')).toBeUndefined()
    expect(referrerHost('', 'me.example')).toBeUndefined()
    expect(referrerHost('not a url', 'me.example')).toBeUndefined()
  })
})

describe('<NotFoundBeacon>', () => {
  const site = (redirect?: unknown) => ({ addons: redirect ? { redirect } : {} }) as Pick<SiteResponse, 'addons'>

  it('reports the missing path once, with the CSRF token', async () => {
    const f = stub()
    window.history.pushState({}, '', '/no-such-page?x=1')
    const { rerender } = render(<NotFoundBeacon site={site({ not_found: '/!/redirect/not-found', log_errors: true })} />)
    rerender(<NotFoundBeacon site={site({ not_found: '/!/redirect/not-found', log_errors: true })} />)
    await waitFor(() => expect(f).toHaveBeenCalledTimes(2))
    expect(f.mock.calls.map(c => c[0])).toEqual(['/!/csrf-token', '/!/redirect/not-found'])
    const init = f.mock.calls[1][1] as RequestInit
    expect(JSON.parse(init.body as string)).toEqual({ path: '/no-such-page?x=1' })
    expect((init.headers as Record<string, string>)['X-CSRF-TOKEN']).toBe('tok')
  })

  it('stays quiet while the Redirect addon is off or its log is', async () => {
    const f = stub()
    render(<NotFoundBeacon site={site()} />)
    render(<NotFoundBeacon site={site({ not_found: '/!/redirect/not-found', log_errors: false })} />)
    await new Promise(r => setTimeout(r, 10))
    expect(f).not.toHaveBeenCalled()
  })
})

describe('<CodeCheck>', () => {
  const tracking: TrackingCodeSite = { form: 'code_check', field: 'code', redeem: '/!/tracking-code/redeem', require_login: false, min_length: 10, max_length: 36 }
  const schema = {
    handle: 'code_check',
    title: 'Check',
    honeypot: 'honeypot',
    captcha: null,
    fields: [{ handle: 'code', type: 'text', display: 'Code', required: true }],
  } as unknown as FormSchema

  it('posts the code to the redeem action and shows the answer once', async () => {
    const f = vi.fn<typeof fetch>(async url => (url === '/!/csrf-token' ? json(200, { csrf_token: 'tok' }) : json(200, { success: true, message: 'Code redeemed.' })))
    vi.stubGlobal('fetch', f)
    const { container } = render(<CodeCheck tracking={tracking} schema={schema} submitLabel="Check it" />)
    fireEvent.change(container.querySelector('input[name="code"]')!, { target: { value: 'ABCDEFGHJK23' } })
    fireEvent.submit(container.querySelector('form')!)
    expect(await screen.findByText('Code redeemed.')).toBeTruthy()
    expect(f.mock.calls[1][0]).toBe('/!/tracking-code/redeem')
    expect(((f.mock.calls[1][1] as RequestInit).body as FormData).get('code')).toBe('ABCDEFGHJK23')
  })

  it('shows the refusal at the code field and no result', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async url => (url === '/!/csrf-token' ? json(200, { csrf_token: 'tok' }) : json(422, { message: 'Invalid.', errors: { code: ['Invalid.'] } }))))
    const { container } = render(<CodeCheck tracking={tracking} schema={schema} />)
    fireEvent.submit(container.querySelector('form')!)
    expect(await screen.findByText('Invalid.')).toBeTruthy()
    expect(container.querySelector('.orman-codecheck__result')).toBeNull()
  })
})
