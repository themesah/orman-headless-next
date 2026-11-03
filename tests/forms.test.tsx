// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Captcha } from '../src/components/captcha'
import { FormFields } from '../src/components/form-fields'
import { Form } from '../src/components/form'
import type { FormSchema, SiteResponse } from '../src/types'

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  delete (window as unknown as { turnstile?: unknown }).turnstile
})

const schema = (over: Partial<FormSchema> = {}): FormSchema => ({
  handle: 'contact',
  title: 'Contact',
  honeypot: 'company',
  captcha: null,
  tags: [],
  fields: [
    { handle: 'name', type: 'text', display: 'Your name', instructions: null, required: true, validate: ['required'], placeholder: 'Jane' },
    { handle: 'email', type: 'text', input_type: 'email', display: 'E-mail', instructions: 'We reply here.', required: true, validate: ['required', 'email'] },
    { handle: 'topic', type: 'select', display: 'Topic', instructions: null, required: false, validate: [], options: [{ value: 'sales', label: 'Sales' }, { value: 'help', label: 'Help' }] },
    { handle: 'message', type: 'textarea', display: 'Message', instructions: null, required: true, validate: ['required'] },
  ],
  ...over,
})

const site = (addons: Record<string, unknown>) => ({ addons }) as Pick<SiteResponse, 'addons'>

describe('<FormFields>', () => {
  it('renders each field with its label, control, instructions and the honeypot', () => {
    const { container } = render(
      <Form action="/!/forms/contact">
        <FormFields schema={schema()} />
      </Form>,
    )
    expect(screen.getByLabelText(/Your name/)).toHaveProperty('placeholder', 'Jane')
    expect(screen.getByLabelText(/E-mail/)).toHaveProperty('type', 'email')
    expect(screen.getByLabelText(/Topic/).tagName).toBe('SELECT')
    expect(screen.getByLabelText(/Message/).tagName).toBe('TEXTAREA')
    expect(container.querySelectorAll('.orman-field__instructions')).toHaveLength(1)
    expect(container.querySelector('[data-field=email] .orman-field__instructions')?.textContent).toBe('We reply here.')
    const trap = container.querySelector<HTMLInputElement>('.orman-form__trap input')!
    expect(trap.name).toBe('company')
    expect(trap.tabIndex).toBe(-1)
    expect(container.querySelector('.orman-form__trap')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('shows a 422 per field next to the field', async () => {
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async url => (url === '/!/csrf-token' ? json(200, { csrf_token: 't' }) : json(422, { errors: { email: ['Bad e-mail.'] } }))))
    const { container } = render(
      <Form action="/!/forms/contact">
        <FormFields schema={schema()} />
      </Form>,
    )
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(container.querySelector('[data-field=email] .orman-form__error')?.textContent).toBe('Bad e-mail.'))
  })

  it('lets a caller replace one control and keeps its label and error', () => {
    render(
      <Form action="/!/forms/contact">
        <FormFields schema={schema()} render={{ topic: (_f, p) => <input id={p.id} name={p.name} data-custom /> }} />
      </Form>,
    )
    expect(screen.getByLabelText(/Topic/).hasAttribute('data-custom')).toBe(true)
  })
})

describe('<Captcha> with Turnstile', () => {
  const config = { sitekey: '1x00000000000000000000AA', script: 'https://challenges.cloudflare.com/turnstile/v0/api.js', field: 'cf-turnstile-response', protects: { forms: true, registration: false } }

  function install(token: string | undefined) {
    const turnstile = { render: vi.fn(() => 'w1'), getResponse: vi.fn(() => token), reset: vi.fn(), remove: vi.fn() }
    ;(window as unknown as { turnstile: unknown }).turnstile = turnstile
    return turnstile
  }

  it('adds the token under the field name Orman verifies, and resets the widget after the attempt', async () => {
    const t = install('TOKEN-1')
    const f = vi.fn<typeof fetch>(async url => (url === '/!/csrf-token' ? json(200, { csrf_token: 'tok' }) : json(200, { success: true })))
    vi.stubGlobal('fetch', f)
    const { container } = render(
      <Form action="/!/forms/contact">
        <input name="message" defaultValue="hi" />
        <Captcha captcha={{ kind: 'turnstile', handle: 'captcha' }} site={site({ turnstile: config })} theme="dark" />
      </Form>,
    )
    await waitFor(() => expect(t.render).toHaveBeenCalled())
    expect((t.render.mock.calls[0] as unknown[])[1]).toEqual({ sitekey: config.sitekey, theme: 'dark' })

    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(t.reset).toHaveBeenCalledWith('w1'))
    const body = (f.mock.calls[1][1] as RequestInit).body as FormData
    expect(body.get('cf-turnstile-response')).toBe('TOKEN-1')
    expect(body.get('message')).toBe('hi')
  })

  it('does not send the form before the check ran', async () => {
    install(undefined)
    const f = vi.fn<typeof fetch>(async () => json(200, {}))
    vi.stubGlobal('fetch', f)
    const { container } = render(
      <Form action="/!/forms/contact">
        <Captcha captcha={{ kind: 'turnstile', handle: 'captcha' }} site={site({ turnstile: config })} labels={{ required: 'Do the check.' }} />
      </Form>,
    )
    await waitFor(() => expect((window as unknown as { turnstile: { render: { mock: { calls: unknown[] } } } }).turnstile.render.mock.calls.length).toBe(1))
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(container.querySelector('.orman-form__message')?.textContent).toBe('Do the check.'))
    expect(f).not.toHaveBeenCalled()
  })

  it('shows a refused token as the form message (Laravel keys it by position)', async () => {
    install('BAD')
    vi.stubGlobal('fetch', vi.fn<typeof fetch>(async url => (url === '/!/csrf-token' ? json(200, { csrf_token: 'tok' }) : json(422, { message: 'x', errors: { 0: ['The captcha was not accepted.'] } }))))
    const { container } = render(
      <Form action="/!/forms/contact">
        <Captcha captcha={{ kind: 'turnstile', handle: 'captcha' }} site={site({ turnstile: config })} />
      </Form>,
    )
    await waitFor(() => expect((window as unknown as { turnstile: { render: { mock: { calls: unknown[] } } } }).turnstile.render.mock.calls.length).toBe(1))
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(container.querySelector('.orman-form__message')?.textContent).toBe('The captcha was not accepted.'))
  })

  it('renders nothing when the form has no captcha', () => {
    const { container } = render(<Captcha captcha={null} site={site({})} />)
    expect(container.innerHTML).toBe('')
  })
})

describe('<Captcha> with Kaptcha', () => {
  const config = { surfaces: { forms: true, user_login: false, user_registration: false, password_reset: false }, challenge: '/!/kaptcha/challenge', width: 150, height: 40, fields: { answer: 'kaptcha', challenge: 'kaptcha_token' } }

  function stub(challenges: string[], contact: Response) {
    let n = 0
    const f = vi.fn<typeof fetch>(async (url, init) => {
      if (url === '/!/csrf-token') return json(200, { csrf_token: 'tok' })
      if (url === '/!/kaptcha/challenge') return json(200, { token: challenges[n], image: `data:image/png;base64,IMG${n++}`, expires_in: 300 })
      void init
      return contact
    })
    vi.stubGlobal('fetch', f)
    return f
  }

  it('fetches a challenge in the browser, posts the answer with its token, and asks for a new one after the attempt', async () => {
    const f = stub(['T1', 'T2'], json(200, { success: true }))
    const { container } = render(
      <Form action="/!/forms/contact">
        <Captcha captcha={{ kind: 'kaptcha', handle: 'captcha' }} site={site({ kaptcha: config })} />
      </Form>,
    )
    await waitFor(() => expect(container.querySelector<HTMLImageElement>('.orman-captcha__image')?.src).toContain('IMG0'))
    expect(container.querySelector<HTMLInputElement>('input[name=kaptcha_token]')!.value).toBe('T1')
    fireEvent.change(container.querySelector('input[name=kaptcha]')!, { target: { value: 'abc12' } })

    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(container.querySelector<HTMLImageElement>('.orman-captcha__image')?.src).toContain('IMG1'))
    const post = f.mock.calls.find(c => c[0] === '/!/forms/contact')!
    const body = (post[1] as RequestInit).body as FormData
    expect(body.get('kaptcha')).toBe('abc12')
    expect(body.get('kaptcha_token')).toBe('T1')
    expect(container.querySelector<HTMLInputElement>('input[name=kaptcha_token]')!.value).toBe('T2')
    expect(container.querySelector<HTMLInputElement>('input[name=kaptcha]')!.value).toBe('')
  })

  it('shows the kaptcha error at the answer box', async () => {
    stub(['T1', 'T2'], json(422, { errors: { kaptcha: ['Wrong characters.'] } }))
    const { container } = render(
      <Form action="/!/forms/contact">
        <Captcha captcha={{ kind: 'kaptcha', handle: 'captcha' }} site={site({ kaptcha: config })} />
      </Form>,
    )
    await waitFor(() => expect(container.querySelector('.orman-captcha__image')).not.toBeNull())
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(container.querySelector('[data-field=kaptcha]')?.textContent).toBe('Wrong characters.'))
  })

  it('lets the visitor ask for another image', async () => {
    stub(['T1', 'T2'], json(200, {}))
    const { container } = render(
      <Form action="/!/forms/contact">
        <Captcha captcha={{ kind: 'kaptcha', handle: 'captcha' }} site={site({ kaptcha: config })} labels={{ refresh: 'Again' }} />
      </Form>,
    )
    await waitFor(() => expect(container.querySelector('.orman-captcha__image')).not.toBeNull())
    fireEvent.click(screen.getByText('Again'))
    await waitFor(() => expect(container.querySelector<HTMLInputElement>('input[name=kaptcha_token]')!.value).toBe('T2'))
  })
})
