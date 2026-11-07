// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Login } from '../src/components/login'
import { TwoFactor, recoveryCodesFile } from '../src/components/two-factor'
import { Sessions } from '../src/components/sessions'
import { Comments, MyComments } from '../src/components/comments'
import { Inbox } from '../src/components/inbox'
import { followStream } from '../src/components/stream'

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

/** Routes by "METHOD path"; the CSRF token is answered for every non-GET. */
function route(map: Record<string, (body?: unknown) => Response>) {
  const calls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(url).split('?')[0]}`
    if (String(url).endsWith('/csrf-token')) return json(200, { csrf_token: 't' })
    calls.push(key)
    const handler = map[key]
    if (!handler) return json(404, { message: `no route ${key}` })
    return handler(init?.body ? JSON.parse(String(init.body)) : undefined)
  }))
  return calls
}

describe('<Login>', () => {
  it('goes credentials → code → signed in', async () => {
    const calls = route({
      'POST /!/auth/json/login': () => json(200, { needs: 'two_factor', two_factor: true }),
      'POST /!/account/two-factor/challenge': () => json(200, { needs: null, signed_in: true }),
    })
    const done = vi.fn()
    const { container } = render(<Login onSignedIn={done} />)
    fireEvent.change(container.querySelector('input[name=email]')!, { target: { value: 'a@b.c' } })
    fireEvent.change(container.querySelector('input[name=password]')!, { target: { value: 'x' } })
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(container.querySelector('[data-step=two_factor]')).not.toBeNull())
    fireEvent.change(container.querySelector('input[name=code]')!, { target: { value: '123456' } })
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(done).toHaveBeenCalled())
    expect(calls).toEqual(['POST /!/auth/json/login', 'POST /!/account/two-factor/challenge'])
  })

  it('waits for approval and follows the request until denied', async () => {
    let state = 'pending'
    route({
      'POST /!/auth/json/login': () => json(200, { needs: 'approval', request: { id: 4, expires_at: '2030-01-01T00:00:00Z' } }),
      'GET /!/sessions/awaiting/status': () => json(200, { state }),
    })
    const { container } = render(<Login pollMs={20} />)
    fireEvent.change(container.querySelector('input[name=email]')!, { target: { value: 'a@b.c' } })
    fireEvent.change(container.querySelector('input[name=password]')!, { target: { value: 'x' } })
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(container.querySelector('[data-step=approval]')).not.toBeNull())
    state = 'denied'
    await waitFor(() => expect(container.querySelector('.orman-login__notice')?.textContent).toMatch(/denied/))
  })
})

describe('<TwoFactor>', () => {
  it('asks for the password on 403 {needs:password}, then retries', async () => {
    let elevated = false
    route({
      'GET /!/account/two-factor': () => json(200, { enabled: false }),
      'POST /!/account/confirm-password': () => ((elevated = true), json(200, {})),
      'POST /!/account/two-factor/enable': () => (elevated ? json(200, { qr_svg: '<svg/>', secret: 'SECRET' }) : json(403, { needs: 'password' })),
    })
    const { container } = render(<TwoFactor />)
    fireEvent.click(await screen.findByText('Turn on'))
    await waitFor(() => expect(container.querySelector('input[name=password]')).not.toBeNull())
    const pw = container.querySelector('input[name=password]')!
    fireEvent.change(pw, { target: { value: 'x' } })
    fireEvent.submit(pw.closest('form')!)
    await waitFor(() => expect(container.querySelector('.orman-two-factor__secret')?.textContent).toContain('SECRET'))
  })

  it('shows signed out on 401', async () => {
    route({ 'GET /!/account/two-factor': () => json(401, { message: 'Unauthenticated.' }) })
    const out = vi.fn()
    render(<TwoFactor onSignedOut={out} />)
    await waitFor(() => expect(out).toHaveBeenCalled())
    expect(screen.getByText('You are signed out.')).toBeTruthy()
  })

  it('builds the recovery codes file in the browser', async () => {
    const text = await recoveryCodesFile(['a-1', 'b-2']).text()
    expect(text).toContain('a-1\nb-2')
  })
})

describe('<Sessions>', () => {
  const account = {
    policy: { rule: 'multiple', label: 'Many', description: 'd', source: 'site', editable: false, locked_reason: 'Set by your role.' },
    rules: [],
    pending: [{ id: 9, device_label: 'Phone', ip_address: null, requested_at_human: 'now', seconds_left: 60, actions: { approve: '/!/sessions/9/approve', deny: '/!/sessions/9/deny', revoke: '/!/sessions/9/revoke' } }],
    active: [],
    history: [],
    needs_code: false,
    elevated: false,
  }
  it('lists waiting sign-ins, approves one, shows the locked reason', async () => {
    const calls = route({
      'GET /!/sessions/account': () => json(200, account),
      'POST /!/sessions/9/approve': () => json(200, {}),
    })
    render(<Sessions stream={false} pollMs={100000} />)
    expect(await screen.findByText('Set by your role.')).toBeTruthy()
    fireEvent.click(screen.getByText('Approve'))
    await waitFor(() => expect(calls).toContain('POST /!/sessions/9/approve'))
  })
})

describe('<Comments> / <MyComments>', () => {
  const block = { thread: 't', context: 'ctx', signature: 'sig', open: true, login_required: false, captcha: null, honeypot: 'username', post: '/!/diskussiya/comments-json', count: 1, comments: [{ id: 1, parent_id: null, depth: 0, author: { name: 'Ann' }, text: 'Hi', created_at: null }] }
  it('posts with the signed context and shows the new comment as waiting', async () => {
    let sent: Record<string, unknown> = {}
    route({
      'POST /!/diskussiya/comments-json': body => ((sent = body as Record<string, unknown>), json(200, { success: true, comment: { id: 2, parent_id: null, depth: 0, author: { name: 'Bob' }, text: 'Yo', created_at: null } })),
    })
    const { container } = render(<Comments block={block} site={{ addons: {} }} />)
    expect(screen.getByText('Ann')).toBeTruthy()
    fireEvent.change(container.querySelector('input[name=name]')!, { target: { value: 'Bob' } })
    fireEvent.change(container.querySelector('input[name=email]')!, { target: { value: 'b@b.c' } })
    fireEvent.change(container.querySelector('textarea[name=comment]')!, { target: { value: 'Yo' } })
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(container.querySelector('[data-pending=true]')).not.toBeNull())
    expect(sent._diskussiya_context).toBe('ctx')
    expect(sent._diskussiya_context_signature).toBe('sig')
    expect(screen.getByText('Waiting for approval')).toBeTruthy()
  })

  it('lists my comments with their status', async () => {
    route({ 'GET /!/diskussiya/mine': () => json(200, { comments: [{ id: 3, parent_id: null, depth: 0, author: { name: 'Me' }, text: 'Mine', created_at: null, status: 'accepted', page: { title: 'Post', url: '/post', uri: '/post' } }] }) })
    render(<MyComments />)
    expect(await screen.findByText('Accepted')).toBeTruthy()
    expect(screen.getByText('Post').getAttribute('href')).toBe('/post')
  })
})

describe('<Inbox> and the stream', () => {
  it('lists items and dismisses one', async () => {
    const item = { id: 'm1', title: 'Hello', body: null, level: 'info', action_url: null, action_label: null, created_at: '', read: true, status: 'seen', requires_acceptance: false, accepted: false, can_accept: false, can_snooze: false, can_dismiss: true }
    const calls = route({
      'GET /!/notifications/inbox/recent': () => json(200, { items: [item] }),
      'GET /!/notifications/inbox/stream': () => json(200, { stream: null, poll_seconds: 30 }),
      'POST /!/notifications/inbox/dismiss/m1': () => json(200, {}),
    })
    render(<Inbox />)
    fireEvent.click(await screen.findByText('Dismiss'))
    await waitFor(() => expect(calls).toContain('POST /!/notifications/inbox/dismiss/m1'))
  })

  it('reads hub events with the bearer header (no token in the URL) and polls when the site has no hub', async () => {
    const seen: { url: string; auth?: string }[] = []
    const events: unknown[] = []
    const body = new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('data: {"type":"sessions.pending"}\n\n')); c.close() } })
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      seen.push({ url, auth: (init?.headers as Record<string, string>).Authorization })
      return new Response(body, { status: 200 })
    }) as unknown as typeof fetch
    route({ 'GET /!/notifications/inbox/stream': () => json(200, { stream: { hub: 'https://hub.test/.well-known/mercure', topic: 'n/1', token: 'TOK', expires_at: new Date(Date.now() + 900000).toISOString() }, poll_seconds: 30 }) })
    const stop = followStream({ onEvent: e => events.push(e), onPoll: () => {}, fetchImpl })
    await waitFor(() => expect(events).toEqual([{ type: 'sessions.pending' }]))
    stop()
    expect(seen[0].auth).toBe('Bearer TOK')
    expect(seen[0].url).not.toContain('TOK')

    route({ 'GET /!/notifications/inbox/stream': () => json(200, { stream: null, poll_seconds: 30 }) })
    const poll = vi.fn()
    const stop2 = followStream({ onEvent: () => {}, onPoll: poll })
    await waitFor(() => expect(poll).toHaveBeenCalled())
    stop2()
  })
})
