import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, errorMessage, DEFAULT_MESSAGES } from '../src/csrf'

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
afterEach(() => vi.unstubAllGlobals())

describe('api', () => {
  it('fetches a CSRF token before a POST and sends it', async () => {
    const f = vi.fn<typeof fetch>(async url => (url === '/!/csrf-token' ? json(200, { csrf_token: 'tok' }) : json(200, { a: 1 })))
    vi.stubGlobal('fetch', f)
    expect(await api('POST', '/!/x', { k: 'v' })).toEqual({ ok: true, status: 200, body: { a: 1 } })
    expect(f.mock.calls.map(c => c[0])).toEqual(['/!/csrf-token', '/!/x'])
    const init = f.mock.calls[1][1] as RequestInit
    expect((init.headers as Record<string, string>)['X-CSRF-TOKEN']).toBe('tok')
    expect(init.body).toBe('{"k":"v"}')
  })

  it('takes the token from a custom URL', async () => {
    const f = vi.fn<typeof fetch>(async url => (url === '/c' ? json(200, { csrf_token: 't' }) : json(200, {})))
    vi.stubGlobal('fetch', f)
    await api('POST', '/!/x', {}, { csrfUrl: '/c' })
    expect(f.mock.calls[0][0]).toBe('/c')
  })

  it('does not fetch a token for GET', async () => {
    const f = vi.fn<typeof fetch>(async () => json(200, {}))
    vi.stubGlobal('fetch', f)
    await api('GET', '/!/auth/me')
    expect(f).toHaveBeenCalledTimes(1)
  })

  it('puts GET data in the query string, never a body', async () => {
    const f = vi.fn<typeof fetch>(async () => json(200, {}))
    vi.stubGlobal('fetch', f)
    expect(await api('GET', '/!/search?site=en', { q: 'a b', tags: ['x', 'y'], skip: undefined })).toMatchObject({ ok: true })
    expect(f.mock.calls[0][0]).toBe('/!/search?site=en&q=a+b&tags=x&tags=y')
    expect((f.mock.calls[0][1] as RequestInit).body).toBeUndefined()
  })

  it('sends FormData without a JSON content type', async () => {
    const f = vi.fn<typeof fetch>(async url => (url === '/!/csrf-token' ? json(200, { csrf_token: 't' }) : json(200, {})))
    vi.stubGlobal('fetch', f)
    const form = new FormData()
    form.append('a', 'b')
    await api('POST', '/!/x', form)
    const init = f.mock.calls[1][1] as RequestInit
    expect(init.body).toBe(form)
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined()
  })

  it('returns field errors from a 422 and never throws', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => json(422, { errors: { email: ['Bad e-mail'], name: ['Required'] } })))
    expect(await api('GET', '/x')).toEqual({ ok: false, status: 422, message: 'Bad e-mail', errors: { email: ['Bad e-mail'], name: ['Required'] }, body: { errors: { email: ['Bad e-mail'], name: ['Required'] } } })
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => {
      throw new TypeError('offline')
    }))
    expect(await api('GET', '/x')).toEqual({ ok: false, status: 0, message: DEFAULT_MESSAGES.network })
  })

  it('uses custom messages', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => {
      throw new TypeError('offline')
    }))
    expect(await api('GET', '/x', undefined, { messages: { network: 'offline!' } })).toMatchObject({ message: 'offline!' })
  })

  it('reports a failed CSRF fetch as a network error', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => json(500, {})))
    expect(await api('POST', '/x', {})).toMatchObject({ ok: false, status: 0 })
  })
})

describe('errorMessage', () => {
  it('maps 419, 429 and 401', () => {
    expect(errorMessage(419, {})).toBe(DEFAULT_MESSAGES.sessionExpired)
    expect(errorMessage(429, {})).toBe(DEFAULT_MESSAGES.tooManyAttempts)
    expect(errorMessage(401, {})).toBe(DEFAULT_MESSAGES.signInRequired)
  })
  it('reads object, array and flat error shapes, then message, else the network text', () => {
    expect(errorMessage(422, { errors: { a: ['one'] } })).toBe('one')
    expect(errorMessage(422, { errors: ['arr'] })).toBe('arr')
    expect(errorMessage(422, { error: { a: 'flat' } })).toBe('flat')
    expect(errorMessage(400, { message: 'msg' })).toBe('msg')
    expect(errorMessage(500, { message: 'secret stack' })).toBe(DEFAULT_MESSAGES.network)
  })
})
