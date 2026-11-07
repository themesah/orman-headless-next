/**
 * Browser side of Orman's `/!/` routes, which are session-cookie + CSRF based: every non-GET fetches a fresh token first
 * (`/!/csrf-token`, header `X-CSRF-TOKEN`). The page is statically cached, so there is no token in the HTML worth trusting.
 */

export interface Messages {
  network: string
  tooManyAttempts: string
  sessionExpired: string
  signInRequired: string
}

export const DEFAULT_MESSAGES: Messages = {
  network: 'Network error; please try again.',
  tooManyAttempts: 'Too many attempts; try again in a few minutes.',
  sessionExpired: 'Your session expired; reload the page and try again.',
  signInRequired: 'Sign in to continue.',
}

type ErrorBody = {
  message?: string
  errors?: Record<string, string[]> | string[]
  error?: Record<string, string>
}

export type ApiResult<T = unknown> =
  | { ok: true; status: number; body: T }
  | {
      ok: false
      status: number
      message: string
      /** Per-field validation messages when the answer was a 422 with `errors: { field: [..] }`. */
      errors?: Record<string, string[]>
      /** The parsed error body, for answers that carry more than a message (e.g. `{ needs: 'password' }`). */
      body?: unknown
    }

export interface ApiOptions {
  /** The text for each failure the kit words itself; defaults to English. */
  messages?: Partial<Messages>
  /** Where the token comes from. Default `/!/csrf-token`. */
  csrfUrl?: string
}

export async function csrfToken(csrfUrl = '/!/csrf-token'): Promise<string> {
  const res = await fetch(csrfUrl, {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`csrf-token ${res.status}`)
  return ((await res.json()) as { csrf_token: string }).csrf_token
}

/** First human-readable message in a Laravel / Orman error body. */
export function errorMessage(status: number, body: unknown, messages: Partial<Messages> = {}): string {
  const m = { ...DEFAULT_MESSAGES, ...messages }
  const b = body as ErrorBody | null
  if (status === 429) return m.tooManyAttempts
  if (status === 419) return m.sessionExpired
  if (status === 401) return m.signInRequired
  const errors = b?.errors
  if (Array.isArray(errors) && errors[0]) return errors[0]
  if (errors && !Array.isArray(errors)) {
    const first = Object.values(errors)[0]?.[0]
    if (first) return first
  }
  const flat = b?.error && Object.values(b.error)[0]
  if (flat) return flat
  return b?.message && status < 500 ? b.message : m.network
}

function fieldErrors(body: unknown): Record<string, string[]> | undefined {
  const errors = (body as ErrorBody | null)?.errors
  if (!errors || Array.isArray(errors) || typeof errors !== 'object') return undefined
  const out: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(errors)) {
    if (Array.isArray(value)) out[key] = value.filter((v): v is string => typeof v === 'string')
  }
  return Object.keys(out).length ? out : undefined
}

function withQuery(url: string, data: Record<string, unknown> | FormData): string {
  const params = new URLSearchParams()
  const entries = data instanceof FormData ? [...data.entries()] : Object.entries(data)
  for (const [key, value] of entries) {
    if (value === undefined || value === null || value instanceof Blob) continue
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, String(v))
  }
  const qs = params.toString()
  return qs ? `${url}${url.includes('?') ? '&' : '?'}${qs}` : url
}

/**
 * JSON in, JSON out. `data` as FormData is sent as multipart. Never throws: a transport failure is an ordinary `{ ok: false }`.
 */
export async function api<T = unknown>(
  method: 'GET' | 'POST' | 'DELETE',
  url: string,
  data?: Record<string, unknown> | FormData,
  options: ApiOptions = {},
): Promise<ApiResult<T>> {
  const messages = options.messages
  try {
    const headers: Record<string, string> = { Accept: 'application/json' }
    let body: BodyInit | undefined
    if (method === 'GET') {
      // A GET cannot carry a body (fetch rejects it), so its data goes into the query string.
      if (data) url = withQuery(url, data)
    } else {
      headers['X-CSRF-TOKEN'] = await csrfToken(options.csrfUrl)
    }
    if (method === 'GET') {
      // no body
    } else if (data instanceof FormData) {
      body = data
    } else if (data) {
      headers['Content-Type'] = 'application/json'
      body = JSON.stringify(data)
    }

    const res = await fetch(url, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      headers,
      body,
    })
    const text = await res.text()
    let parsed: unknown = null
    try {
      parsed = text ? JSON.parse(text) : null
    } catch {
      parsed = text
    }
    if (res.ok) return { ok: true, status: res.status, body: parsed as T }
    const errors = fieldErrors(parsed)
    return { ok: false, status: res.status, message: errorMessage(res.status, parsed, messages), ...(errors ? { errors } : {}), body: parsed }
  } catch {
    return { ok: false, status: 0, message: { ...DEFAULT_MESSAGES, ...messages }.network }
  }
}
