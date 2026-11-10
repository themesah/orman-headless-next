import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, type ApiOptions } from '../csrf'
import type { CargoOrder, CargoProductBlock, CargoSite, CartData } from '../types'

/** Minor units as text: 5000 GBP → "£50.00". Rial and other zero-decimal currencies keep their own digits through Intl. */
export function formatMoney(amount: number | null, currency: string | null, locale?: string): string {
  if (amount === null || !currency) return ''
  try {
    const digits = new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount / 10 ** digits)
  } catch {
    return String(amount)
  }
}

export interface AddToCartLabels {
  add: string
  adding: string
  added: string
  outOfStock: string
  chooseOption: string
}

export const DEFAULT_ADD_TO_CART_LABELS: AddToCartLabels = { add: 'Add to cart', adding: 'Adding…', added: 'Added', outOfStock: 'Out of stock', chooseOption: 'Choose an option' }

export interface AddToCartProps {
  /** The product's id (`page.id`). */
  productId: string
  /** `addons.cargo` of the product page. */
  product: CargoProductBlock
  /** `addons.cargo` of the cached `/site`. Default addresses are used when omitted. */
  site?: Pick<CargoSite, 'line_items'>
  quantity?: number
  labels?: Partial<AddToCartLabels>
  api?: ApiOptions
  /** Called with the cart after the line was added (open a drawer, update a badge). */
  onAdded?: (cart: CartData | null) => void
  className?: string
}

/**
 * The add button of a product: a variant select when the product has variants, the button, the answer. Out of stock renders a disabled
 * button, not nothing. Per-person: the cart is a cookie, nothing is cached. Class hooks `orman-addtocart`, `__variant`, `__button`,
 * `__error` (role="alert").
 */
export function AddToCart({ productId, product, site, quantity = 1, labels, api: apiOptions, onAdded, className }: AddToCartProps) {
  const text = { ...DEFAULT_ADD_TO_CART_LABELS, ...labels }
  const [variant, setVariant] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const chosen = product.variants.find(v => v.key === variant)
  const needsVariant = product.variants.length > 0 && !chosen
  const available = chosen ? chosen.in_stock : product.in_stock

  async function add() {
    if (needsVariant) return setError(text.chooseOption)
    setState('busy')
    setError(null)
    const res = await api<{ data?: CartData }>('POST', site?.line_items ?? '/!/cargo/cart/line-items', {
      product: productId,
      quantity,
      ...(chosen ? { variant: chosen.key } : {}),
    }, apiOptions)
    if (!res.ok) {
      setState('idle')
      return setError(res.message)
    }
    setState('done')
    onAdded?.(res.body?.data ?? null)
  }

  const root = ['orman-addtocart', className].filter(Boolean).join(' ')
  return (
    <div className={root}>
      {product.variants.length ? (
        <select className="orman-addtocart__variant" value={variant} onChange={e => setVariant(e.target.value)} aria-label={text.chooseOption}>
          <option value="">{text.chooseOption}</option>
          {product.variants.map(v => (
            <option key={v.key} value={v.key} disabled={!v.in_stock}>
              {v.name}
              {v.price !== null ? ` — ${formatMoney(v.price, product.currency)}` : ''}
            </option>
          ))}
        </select>
      ) : null}
      <button type="button" className="orman-addtocart__button" disabled={!available || state === 'busy'} onClick={() => void add()}>
        {!available ? text.outOfStock : state === 'busy' ? text.adding : state === 'done' ? text.added : text.add}
      </button>
      {error ? (
        <p role="alert" className="orman-addtocart__error">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export interface CartLabels {
  title: string
  empty: string
  remove: string
  quantity: string
  subtotal: string
  total: string
  checkout: string
}

export const DEFAULT_CART_LABELS: CartLabels = { title: 'Your cart', empty: 'Your cart is empty.', remove: 'Remove', quantity: 'Quantity', subtotal: 'Subtotal', total: 'Total', checkout: 'Checkout' }

export interface CartProps {
  site?: Pick<CargoSite, 'cart' | 'line_items'>
  labels?: Partial<CartLabels>
  api?: ApiOptions
  /** Shown under the totals; usually a link to the checkout page. When omitted no checkout control is rendered. */
  checkoutHref?: string
  onChange?: (cart: CartData | null) => void
  className?: string
}

/**
 * The person's cart: lines with a quantity and a remove button, the totals Cargo calculated (formatted by the site's currency; the kit
 * does no arithmetic). A guest with no cart yet sees the empty state, not an error. Class hooks `orman-cart`, `__line`, `__title`,
 * `__quantity`, `__remove`, `__total`, `__checkout`, `__empty`.
 */
export function Cart({ site, labels, api: apiOptions, checkoutHref, onChange, className }: CartProps) {
  const text = { ...DEFAULT_CART_LABELS, ...labels }
  const cartUrl = site?.cart ?? '/!/cargo/cart'
  const linesUrl = site?.line_items ?? '/!/cargo/cart/line-items'
  const [cart, setCart] = useState<CartData | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const set = useCallback((value: CartData | null) => { setCart(value); onChange?.(value) }, [onChange])

  const load = useCallback(async () => {
    const res = await api<{ data: CartData }>('GET', cartUrl, undefined, apiOptions)
    // A person with no cart yet gets a 404: that is an empty cart.
    if (res.ok) set(res.body.data)
    else if (res.status === 404) set(null)
    else setError(res.message)
  }, [apiOptions, cartUrl, set])

  useEffect(() => { void load() }, [load])

  const change = useMemo(() => async (id: string, quantity: number) => {
    // Laravel reads `_method` on a POST: the kit's fetch helper sends GET, POST and DELETE only.
    const res = quantity > 0
      ? await api<{ data: CartData }>('POST', `${linesUrl}/${encodeURIComponent(id)}`, { _method: 'PATCH', quantity }, apiOptions)
      : await api<unknown>('DELETE', `${linesUrl}/${encodeURIComponent(id)}`, undefined, apiOptions)
    if (!res.ok) return setError(res.message)
    setError(null)
    await load()
  }, [apiOptions, linesUrl, load])

  const root = ['orman-cart', className].filter(Boolean).join(' ')
  if (cart === undefined) return <div className={root} aria-busy="true" />
  if (!cart || !cart.line_items.length) return <p className={`${root} orman-cart__empty`}>{text.empty}</p>
  return (
    <div className={root}>
      <ul aria-live="polite">
        {cart.line_items.map(line => (
          <li key={line.id} className="orman-cart__line">
            <span className="orman-cart__title">{line.product?.title}</span>
            <input
              className="orman-cart__quantity"
              type="number"
              min={1}
              value={line.quantity}
              aria-label={text.quantity}
              onChange={e => void change(line.id, Number(e.target.value))}
            />
            <span className="orman-cart__total">{line.total}</span>
            <button type="button" className="orman-cart__remove" onClick={() => void change(line.id, 0)}>
              {text.remove}
            </button>
          </li>
        ))}
      </ul>
      <p className="orman-cart__total orman-cart__grand">
        {text.total}: {cart.grand_total}
      </p>
      {error ? <p role="alert" className="orman-cart__error">{error}</p> : null}
      {checkoutHref ? (
        <a className="orman-cart__checkout" href={checkoutHref}>
          {text.checkout}
        </a>
      ) : null}
    </div>
  )
}

export interface CheckoutLabels {
  gateway: string
  pay: string
  paying: string
}

export const DEFAULT_CHECKOUT_LABELS: CheckoutLabels = { gateway: 'Pay with', pay: 'Place order', paying: 'Placing order…' }

export interface CheckoutProps {
  site: Pick<CargoSite, 'checkout' | 'gateways'>
  labels?: Partial<CheckoutLabels>
  api?: ApiOptions
  /** Called with the address to go to (`confirmation_url`). Default: `location.assign`. */
  onPlaced?: (confirmationUrl: string) => void
  className?: string
}

/**
 * The last step: pick a gateway, place the order. A gateway that takes the money on the spot (or a free cart) answers an order, and the
 * person is sent to the site's confirmation page; Cargo's refusals (no address, no stock) arrive as `422 {errors}` and are shown as they
 * are. A gateway that leaves for the bank's page is the site's own button (`payment-gateways` gives its `checkout_url`): the bank sends
 * the person back through the proxy, and Orman ends on the confirmation page. Class hooks `orman-checkout`, `__gateway`, `__submit`,
 * `__error` (role="alert").
 */
export function Checkout({ site, labels, api: apiOptions, onPlaced, className }: CheckoutProps) {
  const text = { ...DEFAULT_CHECKOUT_LABELS, ...labels }
  const [gateway, setGateway] = useState(site.gateways[0]?.handle ?? '')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])

  async function place() {
    setBusy(true)
    setErrors([])
    const res = await api<{ order_id: string; confirmation_url: string }>('POST', site.checkout, { payment_gateway: gateway }, apiOptions)
    if (res.ok) {
      if (onPlaced) onPlaced(res.body.confirmation_url)
      else window.location.assign(res.body.confirmation_url)
      return
    }
    setBusy(false)
    const bag = (res.body as { errors?: Record<string, string[]> } | null)?.errors
    setErrors(bag ? Object.values(bag).flat() : [res.message])
  }

  return (
    <div className={['orman-checkout', className].filter(Boolean).join(' ')}>
      {site.gateways.length > 1 ? (
        <select className="orman-checkout__gateway" value={gateway} onChange={e => setGateway(e.target.value)} aria-label={text.gateway}>
          {site.gateways.map(g => (
            <option key={g.handle} value={g.handle}>
              {g.title}
            </option>
          ))}
        </select>
      ) : null}
      <button type="button" className="orman-checkout__submit" disabled={busy} onClick={() => void place()}>
        {busy ? text.paying : text.pay}
      </button>
      {errors.map(message => (
        <p key={message} role="alert" className="orman-checkout__error">
          {message}
        </p>
      ))}
    </div>
  )
}

export interface OrderConfirmationProps {
  site?: Pick<CargoSite, 'order'>
  /** `searchParams` of the confirmation page: `order`, `expires`, `signature`. */
  query: { order?: string; expires?: string; signature?: string }
  labels?: Partial<{ title: string; number: string; total: string; invalid: string }>
  api?: ApiOptions
  className?: string
}

/** The confirmation page's body: the order behind the signed query the checkout put in the address. Class hooks `orman-order`, `__line`, `__total`, `__error`. */
export function OrderConfirmation({ site, query, labels, api: apiOptions, className }: OrderConfirmationProps) {
  const text = { title: 'Thank you for your order', number: 'Order', total: 'Total', invalid: 'This confirmation link is no longer valid.', ...labels }
  const [order, setOrder] = useState<CargoOrder | null | undefined>(undefined)

  useEffect(() => {
    if (!query.order || !query.expires || !query.signature) return setOrder(null)
    const base = (site?.order ?? '/!/cargo/orders/{id}').replace('{id}', encodeURIComponent(query.order))
    void api<CargoOrder>('GET', base, { expires: query.expires, signature: query.signature }, apiOptions).then(res => setOrder(res.ok ? res.body : null))
  }, [apiOptions, query.expires, query.order, query.signature, site?.order])

  const root = ['orman-order', className].filter(Boolean).join(' ')
  if (order === undefined) return <div className={root} aria-busy="true" />
  if (!order) return <p role="alert" className={`${root} orman-order__error`}>{text.invalid}</p>
  return (
    <div className={root}>
      <h2>{text.title}</h2>
      <p>
        {text.number} #{order.order_number}
      </p>
      <ul>
        {order.line_items.map(line => (
          <li key={line.id} className="orman-order__line">
            {line.quantity} × {line.product?.title} — {formatMoney(line.total, order.currency)}
          </li>
        ))}
      </ul>
      <p className="orman-order__total">
        {text.total}: {formatMoney(order.grand_total, order.currency)}
      </p>
    </div>
  )
}
