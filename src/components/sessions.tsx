import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ApiOptions } from '../csrf'
import type { SessionRow, SessionsAccount } from '../types'
import { callAccount, failure } from './account-api'
import { followStream } from './stream'

export interface SessionsLabels {
  pending: string
  approve: string
  deny: string
  active: string
  history: string
  current: string
  revoke: string
  revokeOthers: string
  rule: string
  save: string
  password: string
  code: string
  confirm: string
  signedOut: string
}

export const DEFAULT_SESSIONS_LABELS: SessionsLabels = {
  pending: 'Waiting sign-ins',
  approve: 'Approve',
  deny: 'Deny',
  active: 'Signed in on',
  history: 'Sign-in history',
  current: 'This device',
  revoke: 'Sign out',
  revokeOthers: 'Sign out all other devices',
  rule: 'When I sign in on another device',
  save: 'Save',
  password: 'Your password',
  code: 'Authentication code or recovery code',
  confirm: 'Confirm',
  signedOut: 'You are signed out.',
}

export interface SessionsProps {
  /** `addons.sessions.account`. Default `/!/sessions/account`. */
  account?: string
  /** Password confirmation. Default `/!/account/confirm-password`. */
  confirmPassword?: string
  /** Stream URL used to learn of waiting sign-ins at once. Default `/!/notifications/inbox/stream`; pass `false` to poll only. */
  stream?: string | false
  /** Poll every this many ms when no stream. Default 15000. */
  pollMs?: number
  labels?: Partial<SessionsLabels>
  api?: ApiOptions
  onSignedOut?: () => void
  className?: string
}

/**
 * Login history, active sessions (device, place, last seen, this one), sign out one or all others, approve or deny waiting
 * sign-ins, and the person's own rule when the roles allow it (read-only with the reason otherwise). Per-user, never cached;
 * a 401 means signed out. Class hooks: `orman-sessions`, `__pending|__active|__history|__row|__button|__rule|__locked|__error`.
 */
export function Sessions({ account = '/!/sessions/account', confirmPassword = '/!/account/confirm-password', stream = '/!/notifications/inbox/stream', pollMs = 15000, labels, api: apiOptions, onSignedOut, className }: SessionsProps) {
  const text = { ...DEFAULT_SESSIONS_LABELS, ...labels }
  const [data, setData] = useState<SessionsAccount | null>(null)
  const [out, setOut] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const call = useMemo(
    () =>
      callAccount(() => {
        setOut(true)
        onSignedOut?.()
      }, apiOptions),
    [apiOptions, onSignedOut],
  )

  const load = useCallback(async () => {
    const res = await call<SessionsAccount>('GET', account)
    if (res.ok) setData(res.body)
  }, [account, call])

  useEffect(() => {
    void load()
    if (stream === false) {
      const t = setInterval(() => void load(), pollMs)
      return () => clearInterval(t)
    }
    return followStream({
      url: stream,
      api: apiOptions,
      onEvent: () => void load(),
      onPoll: () => void load(),
      onSignedOut: () => setOut(true),
    })
  }, [load, stream, pollMs, apiOptions])

  // A sensitive action (approve, deny, sign out) may want the password again (403), then the second factor (422 `two_factor`).
  const [ask, setAsk] = useState<null | { kind: 'password' | 'code'; url: string; body: Record<string, unknown> }>(null)

  async function post(url: string, body: Record<string, unknown> = {}) {
    setMessage(null)
    const res = await call('POST', url, body)
    if (!res.ok && res.status === 403) setAsk({ kind: 'password', url, body })
    else if (!res.ok && res.status === 422 && (res.body as { two_factor?: boolean } | null)?.two_factor) {
      setAsk({ kind: 'code', url, body })
      if (body.code || body.recovery_code) setMessage(failure(res))
    } else {
      setAsk(null)
      if (!res.ok && res.status !== 401) setMessage(failure(res))
    }
    await load()
  }

  async function answer(form: HTMLFormElement) {
    if (!ask) return
    const value = String(new FormData(form).get('value') ?? '').trim()
    if (ask.kind === 'password') {
      const res = await call('POST', confirmPassword, { password: value })
      if (!res.ok) return setMessage(failure(res))
      return post(ask.url, ask.body)
    }
    // A recovery code has a dash; an authenticator code is digits.
    return post(ask.url, { ...ask.body, ...(/^\d{6}$/.test(value) ? { code: value } : { recovery_code: value }) })
  }

  const root = ['orman-sessions', className].filter(Boolean).join(' ')
  if (out) return <p className={root}>{text.signedOut}</p>
  if (!data) return <div className={root} aria-busy="true" />

  const row = (r: SessionRow) => (
    <li key={r.id} className="orman-sessions__row" data-current={r.is_current || undefined}>
      <span>{r.device_label}</span> <span>{r.area_label}</span> <span>{r.ip_address}</span> <span>{r.last_active_at_human ?? r.login_at_human}</span>
      {r.is_current ? <strong>{text.current}</strong> : r.active ? (
        <button type="button" className="orman-sessions__button" onClick={() => post(r.actions.revoke)}>
          {text.revoke}
        </button>
      ) : r.ended_reason_label ? <em>{r.ended_reason_label}</em> : null}
    </li>
  )

  return (
    <section className={root}>
      {data.pending.length ? (
        <div className="orman-sessions__pending" role="alert">
          <h3>{text.pending}</h3>
          <ul>
            {data.pending.map(p => (
              <li key={p.id} className="orman-sessions__row">
                <span>{p.device_label}</span> <span>{p.ip_address}</span> <span>{p.requested_at_human}</span>
                <button type="button" className="orman-sessions__button" onClick={() => post(p.actions.approve)}>
                  {text.approve}
                </button>
                <button type="button" className="orman-sessions__button" onClick={() => post(p.actions.deny)}>
                  {text.deny}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="orman-sessions__rule">
        <p>
          <strong>{data.policy.label}</strong> {data.policy.description}
        </p>
        {data.policy.editable ? (
          <form
            onSubmit={event => {
              event.preventDefault()
              void post(`${account.replace(/\/account$/, '')}/rule`, { rule: String(new FormData(event.currentTarget).get('rule')) })
            }}
          >
            <label>
              <span>{text.rule}</span>
              <select name="rule" defaultValue={data.policy.rule}>
                {data.rules.map(r => (
                  <option key={r.rule} value={r.rule}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="orman-sessions__button">
              {text.save}
            </button>
          </form>
        ) : data.policy.locked_reason ? (
          <p className="orman-sessions__locked">{data.policy.locked_reason}</p>
        ) : null}
      </div>

      <div className="orman-sessions__active">
        <h3>{text.active}</h3>
        <ul>{data.active.map(row)}</ul>
        {data.active.length > 1 ? (
          <button type="button" className="orman-sessions__button" onClick={() => post(`${account.replace(/\/account$/, '')}/revoke-others`)}>
            {text.revokeOthers}
          </button>
        ) : null}
      </div>

      <div className="orman-sessions__history">
        <h3>{text.history}</h3>
        <ul>{data.history.map(row)}</ul>
      </div>

      {ask ? (
        <form
          className="orman-sessions__confirm"
          onSubmit={event => {
            event.preventDefault()
            void answer(event.currentTarget)
          }}
        >
          <label>
            <span>{ask.kind === 'password' ? text.password : text.code}</span>
            <input name="value" type={ask.kind === 'password' ? 'password' : 'text'} autoComplete={ask.kind === 'password' ? 'current-password' : 'one-time-code'} required autoFocus />
          </label>
          <button type="submit" className="orman-sessions__button">
            {text.confirm}
          </button>
        </form>
      ) : null}

      {message ? (
        <p className="orman-sessions__error" role="alert">
          {message}
        </p>
      ) : null}
    </section>
  )
}
