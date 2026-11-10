// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AddToCart, Cart, Checkout, OrderConfirmation, formatMoney } from '../src/components/shop'
import { CompleteLesson, CourseProgress, LockedLesson } from '../src/components/courses'
import { MyScore, MyTasks } from '../src/components/scoring'
import type { CargoProductBlock, CartData } from '../src/types'

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** Answers by "METHOD url" and records every call; the CSRF token is always granted. */
function routes(map: Record<string, (init: RequestInit) => Response>) {
  const calls: { key: string; init: RequestInit }[] = []
  const f = vi.fn<typeof fetch>(async (url, init = {}) => {
    if (url === '/!/csrf-token') return json(200, { csrf_token: 'tok' })
    const key = `${init.method ?? 'GET'} ${url}`
    calls.push({ key, init })
    const handler = map[key] ?? map[key.split('?')[0]]
    return handler ? handler(init) : json(404, { message: 'no route ' + key })
  })
  vi.stubGlobal('fetch', f)
  return calls
}

const product: CargoProductBlock = { price: 5000, currency: 'GBP', in_stock: true, variants: [] }
const cart: CartData = {
  id: 'c1',
  line_items: [{ id: 'li1', quantity: 2, variant: null, unit_price: '£50.00', total: '£100.00', product: { id: 'p1', title: 'Mug', uri: '/shop/mug', ...product } }],
  sub_total: '£100.00', discount_total: '£0.00', tax_total: '£0.00', shipping_total: '£0.00', grand_total: '£100.00', is_free: false,
}

describe('formatMoney', () => {
  it('formats minor units by the currency and returns nothing without a price', () => {
    expect(formatMoney(5000, 'GBP', 'en-GB')).toBe('£50.00')
    expect(formatMoney(null, 'GBP')).toBe('')
  })
})

describe('<AddToCart>', () => {
  it('posts the product and quantity, then says it was added', async () => {
    const calls = routes({ 'POST /!/cargo/cart/line-items': () => json(200, { data: cart }) })
    const onAdded = vi.fn()
    render(<AddToCart productId="p1" product={product} quantity={2} onAdded={onAdded} />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('Added'))
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ product: 'p1', quantity: 2 })
    expect(onAdded).toHaveBeenCalledWith(cart)
  })

  it('is disabled when out of stock, and asks for a variant before posting', async () => {
    const calls = routes({})
    const { rerender } = render(<AddToCart productId="p1" product={{ ...product, in_stock: false }} />)
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true)
    rerender(<AddToCart productId="p1" product={{ ...product, variants: [{ key: 'S', name: 'Small', price: 4000, in_stock: true }] }} />)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('alert').textContent).toBe('Choose an option')
    expect(calls).toHaveLength(0)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'S' } })
    routes({ 'POST /!/cargo/cart/line-items': () => json(200, { data: cart }) })
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getByRole('button').textContent).toBe('Added'))
  })

  it('shows the refusal of the shop', async () => {
    routes({ 'POST /!/cargo/cart/line-items': () => json(422, { message: 'Not enough stock.' }) })
    render(<AddToCart productId="p1" product={product} />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Not enough stock.'))
  })
})

describe('<Cart>', () => {
  it('lists the lines with the totals the shop calculated, and an empty cart (404) is not an error', async () => {
    routes({ 'GET /!/cargo/cart': () => json(200, { data: cart }) })
    render(<Cart checkoutHref="/shop/checkout" />)
    await screen.findByText('Mug')
    expect(screen.getByText('Total: £100.00')).toBeTruthy()
    expect(screen.getByText('Checkout').getAttribute('href')).toBe('/shop/checkout')
    cleanup()
    routes({ 'GET /!/cargo/cart': () => json(404, { message: 'Not found.' }) })
    render(<Cart />)
    await screen.findByText('Your cart is empty.')
  })

  it('changes a quantity with a spoofed PATCH and removes a line with DELETE', async () => {
    const calls = routes({
      'GET /!/cargo/cart': () => json(200, { data: cart }),
      'POST /!/cargo/cart/line-items/li1': () => json(200, { data: cart }),
      'DELETE /!/cargo/cart/line-items/li1': () => json(200, []),
    })
    render(<Cart />)
    await screen.findByText('Mug')
    fireEvent.change(screen.getByLabelText('Quantity'), { target: { value: '3' } })
    await waitFor(() => expect(calls.some(c => c.key === 'POST /!/cargo/cart/line-items/li1')).toBe(true))
    expect(JSON.parse(calls.find(c => c.key.startsWith('POST'))!.init.body as string)).toEqual({ _method: 'PATCH', quantity: 3 })
    fireEvent.click(screen.getByText('Remove'))
    await waitFor(() => expect(calls.some(c => c.key === 'DELETE /!/cargo/cart/line-items/li1')).toBe(true))
  })
})

describe('<Checkout>', () => {
  const site = { checkout: '/!/cargo/checkout', gateways: [{ handle: 'fake', title: 'Fake' }, { handle: 'cod', title: 'Pay on delivery' }] }

  it('places the order with the chosen gateway and hands over the confirmation address', async () => {
    const calls = routes({ 'POST /!/cargo/checkout': () => json(200, { order_id: 'o1', confirmation_url: '/shop/thanks?order=o1&expires=1&signature=s' }) })
    const onPlaced = vi.fn()
    render(<Checkout site={site} onPlaced={onPlaced} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'cod' } })
    fireEvent.click(screen.getByText('Place order'))
    await waitFor(() => expect(onPlaced).toHaveBeenCalledWith('/shop/thanks?order=o1&expires=1&signature=s'))
    expect(JSON.parse(calls[0].init.body as string)).toEqual({ payment_gateway: 'cod' })
  })

  it('shows the errors of a refused checkout as the shop worded them', async () => {
    routes({ 'POST /!/cargo/checkout': () => json(422, { errors: { checkout: ['Order cannot be created without an address.'] } }) })
    render(<Checkout site={site} onPlaced={vi.fn()} />)
    fireEvent.click(screen.getByText('Place order'))
    await screen.findByText('Order cannot be created without an address.')
  })
})

describe('<OrderConfirmation>', () => {
  it('asks for the order with the signed query and shows what was bought', async () => {
    const calls = routes({ 'GET /!/cargo/orders/o1': () => json(200, { id: 'o1', order_number: 1001, status: 'payment_received', currency: 'GBP', sub_total: 5000, discount_total: 0, tax_total: 0, shipping_total: 0, grand_total: 5000, line_items: [{ id: 'li1', product: { id: 'p1', title: 'Mug', uri: null }, variant: null, quantity: 1, unit_price: 5000, total: 5000 }] }) })
    render(<OrderConfirmation query={{ order: 'o1', expires: '9', signature: 'sig' }} />)
    await screen.findByText(/Order #1001/)
    expect(calls[0].key).toBe('GET /!/cargo/orders/o1?expires=9&signature=sig')
  })

  it('says the link is invalid without a signature, and when the shop refuses it', async () => {
    render(<OrderConfirmation query={{ order: 'o1' }} />)
    await screen.findByRole('alert')
    cleanup()
    routes({ 'GET /!/cargo/orders/o1': () => json(403, { message: 'Invalid signature.' }) })
    render(<OrderConfirmation query={{ order: 'o1', expires: '9', signature: 'bad' }} />)
    await screen.findByRole('alert')
  })
})

describe('<LockedLesson>', () => {
  const lesson = { kind: 'lesson' as const, gated: true as const, course: { id: 'c1', title: 'Course', uri: '/courses/one' } }

  it('renders the body for an enrolled student', async () => {
    routes({ 'GET /!/courses/lessons/l1': () => json(200, { data: { body: 'Secret body' } }) })
    render(<LockedLesson lesson={lesson} lessonId="l1">{data => <p>{String(data.body)}</p>}</LockedLesson>)
    await screen.findByText('Secret body')
  })

  it('shows the locked state with its reason for a guest and for a student not enrolled', async () => {
    routes({ 'GET /!/courses/lessons/l1': () => json(401, { message: 'Unauthenticated.' }) })
    const { container } = render(<LockedLesson lesson={lesson} lessonId="l1">{() => <p>never</p>}</LockedLesson>)
    await screen.findByText('Sign in to read this lesson.')
    expect(container.querySelector('[data-reason]')?.getAttribute('data-reason')).toBe('signed-out')
    cleanup()
    routes({ 'GET /!/courses/lessons/l1': () => json(403, { message: 'Forbidden.' }) })
    render(<LockedLesson lesson={lesson} lessonId="l1">{() => <p>never</p>}</LockedLesson>)
    await screen.findByText('Enroll in the course to read this lesson.')
    expect(screen.queryByText('never')).toBeNull()
  })
})

describe('<CompleteLesson>', () => {
  it('posts the completion and links to the next lesson', async () => {
    const onCompleted = vi.fn()
    routes({ 'POST /!/courses/lessons/l1/complete': () => json(200, { completed: true, lesson_id: 'l1', course_id: 'c1', next: { id: 'l2', title: 'Two', uri: '/lessons/two' }, course_done: false }) })
    render(<CompleteLesson lessonId="l1" onCompleted={onCompleted} />)
    fireEvent.click(screen.getByRole('button'))
    await screen.findByText(/Next lesson: Two/)
    expect(screen.getByRole('button').textContent).toBe('Completed')
    expect(onCompleted).toHaveBeenCalled()
  })

  it('calls onSignedOut on a 401', async () => {
    const out = vi.fn()
    routes({ 'POST /!/courses/lessons/l1/complete': () => json(401, { message: 'Unauthenticated.' }) })
    render(<CompleteLesson lessonId="l1" onSignedOut={out} />)
    fireEvent.click(screen.getByRole('button'))
    await waitFor(() => expect(out).toHaveBeenCalled())
  })
})

describe('<CourseProgress>', () => {
  it('marks done lessons and the next one', async () => {
    routes({ 'GET /!/courses/me': () => json(200, { courses: [{ id: 'c1', title: 'C', uri: null, lessons: 2, completed: 1, progress: 0.5, next: { id: 'l2', title: 'Two', uri: null } }], completed: ['l1'] }) })
    const { container } = render(<CourseProgress courseId="c1" course={{ kind: 'course', free_enrollment: false, lessons: [{ id: 'l1', title: 'One', uri: '/l/1', position: 1 }, { id: 'l2', title: 'Two', uri: '/l/2', position: 2 }] }} />)
    await waitFor(() => expect(container.querySelector('[data-done]')).not.toBeNull())
    expect(container.querySelector('[data-next]')?.textContent).toBe('Two')
  })

  it('shows the plain list to a guest', async () => {
    routes({ 'GET /!/courses/me': () => json(401, { message: 'Unauthenticated.' }) })
    const { container } = render(<CourseProgress courseId="c1" course={{ kind: 'course', free_enrollment: false, lessons: [{ id: 'l1', title: 'One', uri: '/l/1', position: 1 }] }} />)
    expect(container.querySelectorAll('li')).toHaveLength(1)
    expect(container.querySelector('[data-done]')).toBeNull()
  })
})

describe('<MyScore> / <MyTasks>', () => {
  it('shows the own points and badges, and a sign-in text for a guest', async () => {
    routes({ 'GET /!/scoring/my-score': () => json(200, { balance: 42, history: [{ amount: 10, reason: 'Quiz', source_type: null, created_at: null }], badges: [{ key: 'b', name: 'Starter', description: null, icon: null, awarded_at: null }] }) })
    render(<MyScore />)
    await screen.findByText('Points: 42')
    expect(screen.getByText('Starter')).toBeTruthy()
    cleanup()
    routes({ 'GET /!/scoring/my-score': () => json(401, { message: 'Unauthenticated.' }) })
    render(<MyScore />)
    await screen.findByText('Sign in to see your points.')
  })

  it('submits a review task and shows it as waiting', async () => {
    let pending: (string | number)[] = []
    const calls = routes({
      'GET /!/scoring/my-tasks': () => json(200, { tasks: [{ id: 7, title: 'Write a review', description: null, points: 5, mode: 'review', submit_url: '/x' }], pendingSubmissionTaskIds: pending }),
      'POST /!/scoring/tasks/7/submit': () => { pending = [7]; return json(201, { id: 1, status: 'pending' }) },
    })
    render(<MyTasks />)
    fireEvent.click(await screen.findByText('Submit'))
    await screen.findByText('Waiting for review')
    expect(calls.some(c => c.key === 'POST /!/scoring/tasks/7/submit')).toBe(true)
  })
})
