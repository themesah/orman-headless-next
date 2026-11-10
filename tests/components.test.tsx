// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FieldError, Form } from '../src/components/form'
import { MaintenancePage } from '../src/components/maintenance-page'
import { COMPONENT_ROADMAP } from '../src/components/roadmap'

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function stub(answer: Response) {
  const f = vi.fn<typeof fetch>(async url => (url === '/!/csrf-token' ? json(200, { csrf_token: 'tok' }) : answer))
  vi.stubGlobal('fetch', f)
  return f
}

const contact = (props = {}) =>
  render(
    <Form action="/!/forms/contact" {...props}>
      <input name="email" defaultValue="a@b.test" />
      <FieldError name="email" />
      <button type="submit">Send</button>
    </Form>,
  )

describe('<Form>', () => {
  it('posts the fields with the CSRF token and reports success', async () => {
    const f = stub(json(200, { ok: true }))
    const onSuccess = vi.fn()
    const { container } = contact({ onSuccess })
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(f.mock.calls.map(c => c[0])).toEqual(['/!/csrf-token', '/!/forms/contact'])
    const init = f.mock.calls[1][1] as RequestInit
    expect((init.headers as Record<string, string>)['X-CSRF-TOKEN']).toBe('tok')
    expect((init.body as FormData).get('email')).toBe('a@b.test')
    expect(container.querySelector('form')!.className).toContain('orman-form--done')
  })

  it('shows 422 messages at their field and no general message', async () => {
    stub(json(422, { errors: { email: ['Not valid'] } }))
    const { container } = contact()
    fireEvent.submit(container.querySelector('form')!)
    const err = await screen.findByText('Not valid')
    expect(err.getAttribute('data-field')).toBe('email')
    expect(err.className).toBe('orman-form__error')
    expect(container.querySelector('.orman-form__message')).toBeNull()
  })

  it('shows a general message for other failures', async () => {
    stub(json(429, {}))
    const { container } = contact()
    fireEvent.submit(container.querySelector('form')!)
    expect((await screen.findByRole('alert')).className).toBe('orman-form__message')
  })

  it('sends JSON when asked', async () => {
    const f = stub(json(200, {}))
    const { container } = contact({ json: true })
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(f).toHaveBeenCalledTimes(2))
    expect((f.mock.calls[1][1] as RequestInit).body).toBe('{"email":"a@b.test"}')
  })

  it('keeps every value of a repeated name in JSON', async () => {
    const f = stub(json(200, {}))
    const { container } = contact({ json: true, prepare: (d: FormData) => void d.append('email', 'c@d.test') })
    fireEvent.submit(container.querySelector('form')!)
    await waitFor(() => expect(f).toHaveBeenCalledTimes(2))
    expect((f.mock.calls[1][1] as RequestInit).body).toBe('{"email":["a@b.test","c@d.test"]}')
  })

  it('prepare can add fields, and a throw stops the post', async () => {
    const f = stub(json(200, {}))
    const first = contact({ prepare: (d: FormData) => void d.set('captcha', 'T') })
    fireEvent.submit(first.container.querySelector('form')!)
    await waitFor(() => expect(f).toHaveBeenCalledTimes(2))
    expect(((f.mock.calls[1][1] as RequestInit).body as FormData).get('captcha')).toBe('T')
    cleanup()

    const g = stub(json(200, {}))
    const second = contact({
      prepare: () => {
        throw new Error('Solve the captcha first')
      },
    })
    fireEvent.submit(second.container.querySelector('form')!)
    expect(await screen.findByText('Solve the captcha first')).toBeTruthy()
    expect(g).not.toHaveBeenCalled()
  })
})

describe('<MaintenancePage>', () => {
  it('renders class hooks and children', () => {
    const { container } = render(<MaintenancePage title="Down" message="Soon">extra</MaintenancePage>)
    expect(container.querySelector('main.orman-maintenance')).not.toBeNull()
    expect(container.querySelector('.orman-maintenance__title')?.textContent).toBe('Down')
    expect(container.querySelector('.orman-maintenance__message')?.textContent).toBe('Soon')
    expect(container.querySelector('.orman-maintenance__extra')?.textContent).toBe('extra')
  })
})

describe('roadmap', () => {
  it('names the wave of every component not built yet (none left after Wave 4)', () => {
    expect(COMPONENT_ROADMAP.map(e => e.component)).toEqual([])
    for (const entry of COMPONENT_ROADMAP) expect(entry.wave).toMatch(/^6\.\d Wave \d$/)
  })
})
