import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ApiOptions, ApiResult } from '../csrf'
import { callAccount, failure } from './account-api'

export interface TwoFactorLabels {
  title: string
  on: string
  off: string
  enable: string
  scan: string
  secret: string
  code: string
  confirm: string
  disable: string
  password: string
  recovery: string
  show: string
  renew: string
  download: string
  signedOut: string
  required: string
  codesIntro: string
}

export const DEFAULT_TWO_FACTOR_LABELS: TwoFactorLabels = {
  title: 'Two-step sign-in',
  on: 'Two-step sign-in is on.',
  off: 'Two-step sign-in is off.',
  enable: 'Turn on',
  scan: 'Scan this code with your authenticator app, then type the code it shows.',
  secret: 'Or type this key in your app:',
  code: 'Authentication code',
  confirm: 'Confirm',
  disable: 'Turn off',
  password: 'Your password',
  recovery: 'Recovery codes',
  show: 'Show recovery codes',
  renew: 'Make new recovery codes',
  download: 'Download as .txt',
  signedOut: 'You are signed out.',
  required: 'Two-step sign-in is required for your account and cannot be turned off.',
  codesIntro: 'Keep these codes somewhere safe. Each works once.',
}

export interface TwoFactorProps {
  /** Base of the account endpoints. Default `/!/account/two-factor`. */
  base?: string
  /** Where the password confirmation lives. Default `/!/account/confirm-password`. */
  confirmPassword?: string
  labels?: Partial<TwoFactorLabels>
  api?: ApiOptions
  /** A 401 from any call: the person is signed out (or the session was revoked). */
  onSignedOut?: () => void
  className?: string
}

interface Status {
  enabled: boolean
  confirmed?: boolean
  required?: boolean
}

/** The browser builds the recovery-codes file; nothing is sent anywhere. */
export function recoveryCodesFile(codes: string[], title = 'Recovery codes'): Blob {
  return new Blob([`${title}\n\n${codes.join('\n')}\n`], { type: 'text/plain;charset=utf-8' })
}

/**
 * The account's two-step sign-in: status, turn on (QR + confirm code), turn off (password), recovery codes (show, renew,
 * download as .txt). Per-user, never cached. A 403 `{needs:'password'}` asks for the password once, then retries.
 * Class hooks: `orman-two-factor`, `__status|__qr|__secret|__field|__button|__codes|__error`.
 */
export function TwoFactor({ base = '/!/account/two-factor', confirmPassword = '/!/account/confirm-password', labels, api: apiOptions, onSignedOut, className }: TwoFactorProps) {
  const text = { ...DEFAULT_TWO_FACTOR_LABELS, ...labels }
  const [out, setOut] = useState(false)
  const call = useMemo(
    () =>
      callAccount(() => {
        setOut(true)
        onSignedOut?.()
      }, apiOptions),
    [apiOptions, onSignedOut],
  )
  const [status, setStatus] = useState<Status | null>(null)
  const [setup, setSetup] = useState<{ qr_svg: string; secret: string } | null>(null)
  const [codes, setCodes] = useState<string[] | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [needsPassword, setNeedsPassword] = useState<null | (() => Promise<void>)>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await call<Status>('GET', base)
    if (res.ok) setStatus(res.body)
    else if (res.status !== 401) setMessage(failure(res))
  }, [base, call])
  useEffect(() => {
    void load()
  }, [load])

  /** Runs a call that may need a fresh password confirmation; on 403 it asks, then retries. */
  async function sensitive(run: () => Promise<ApiResult<any>>, then: (body: unknown) => void) {
    setBusy(true)
    setMessage(null)
    const res = await run()
    setBusy(false)
    if (res.ok) return then(res.body)
    if (res.status === 403 && (res.body as { needs?: string } | null)?.needs === 'password') {
      return setNeedsPassword(() => () => sensitive(run, then))
    }
    if (res.status !== 401) setMessage(failure(res))
  }

  async function confirmAndRetry(form: HTMLFormElement) {
    const password = String(new FormData(form).get('password') ?? '')
    const retry = needsPassword
    const res = await call('POST', confirmPassword, { password })
    if (!res.ok) return setMessage(failure(res))
    setNeedsPassword(null)
    await retry?.()
  }

  const root = ['orman-two-factor', className].filter(Boolean).join(' ')
  if (out) return <p className={root}>{text.signedOut}</p>
  if (!status) return <div className={root} aria-busy="true" />

  return (
    <section className={root}>
      <p className="orman-two-factor__status" data-enabled={status.enabled}>
        {status.enabled ? text.on : text.off}
      </p>

      {needsPassword ? (
        <form
          className="orman-two-factor__field"
          onSubmit={event => {
            event.preventDefault()
            void confirmAndRetry(event.currentTarget)
          }}
        >
          <label>
            <span>{text.password}</span>
            <input name="password" type="password" autoComplete="current-password" required autoFocus />
          </label>
          <button type="submit" className="orman-two-factor__button">
            {text.confirm}
          </button>
        </form>
      ) : null}

      {!status.enabled && !setup && !needsPassword ? (
        <button
          type="button"
          className="orman-two-factor__button"
          disabled={busy}
          onClick={() => sensitive(() => call<{ qr_svg: string; secret: string }>('POST', `${base}/enable`), body => setSetup(body as { qr_svg: string; secret: string }))}
        >
          {text.enable}
        </button>
      ) : null}

      {setup ? (
        <form
          className="orman-two-factor__setup"
          onSubmit={event => {
            event.preventDefault()
            const code = String(new FormData(event.currentTarget).get('code') ?? '')
            void sensitive(
              () => call<{ recovery_codes?: string[] }>('POST', `${base}/confirm`, { code }),
              body => {
                setCodes((body as { recovery_codes?: string[] }).recovery_codes ?? null)
                setSetup(null)
                void load()
              },
            )
          }}
        >
          <p>{text.scan}</p>
          <img className="orman-two-factor__qr" alt="" src={`data:image/svg+xml;utf8,${encodeURIComponent(setup.qr_svg)}`} />
          <p className="orman-two-factor__secret">
            {text.secret} <code>{setup.secret}</code>
          </p>
          <label className="orman-two-factor__field">
            <span>{text.code}</span>
            <input name="code" inputMode="numeric" autoComplete="one-time-code" required />
          </label>
          <button type="submit" className="orman-two-factor__button" disabled={busy}>
            {text.confirm}
          </button>
        </form>
      ) : null}

      {status.enabled && !needsPassword ? (
        <div className="orman-two-factor__manage">
          <button
            type="button"
            className="orman-two-factor__button"
            disabled={busy}
            onClick={() => sensitive(() => call<{ recovery_codes: string[] }>('GET', `${base}/recovery-codes`), body => setCodes((body as { recovery_codes: string[] }).recovery_codes))}
          >
            {text.show}
          </button>
          <button
            type="button"
            className="orman-two-factor__button"
            disabled={busy}
            onClick={() => sensitive(() => call<{ recovery_codes: string[] }>('POST', `${base}/recovery-codes`), body => setCodes((body as { recovery_codes: string[] }).recovery_codes))}
          >
            {text.renew}
          </button>
          {status.required ? (
            <p className="orman-two-factor__hint">{text.required}</p>
          ) : (
            <form
              className="orman-two-factor__field"
              onSubmit={event => {
                event.preventDefault()
                const password = String(new FormData(event.currentTarget).get('password') ?? '')
                void sensitive(
                  () => call('POST', `${base}/disable`, { password }),
                  () => {
                    setCodes(null)
                    void load()
                  },
                )
              }}
            >
              <label>
                <span>{text.password}</span>
                <input name="password" type="password" autoComplete="current-password" required />
              </label>
              <button type="submit" className="orman-two-factor__button" disabled={busy}>
                {text.disable}
              </button>
            </form>
          )}
        </div>
      ) : null}

      {codes ? <RecoveryCodes codes={codes} text={text} /> : null}
      {message ? (
        <p className="orman-two-factor__error" role="alert">
          {message}
        </p>
      ) : null}
    </section>
  )
}

function RecoveryCodes({ codes, text }: { codes: string[]; text: TwoFactorLabels }) {
  const [href, setHref] = useState<string | null>(null)
  useEffect(() => {
    const url = URL.createObjectURL(recoveryCodesFile(codes, text.recovery))
    setHref(url)
    return () => URL.revokeObjectURL(url)
  }, [codes, text.recovery])
  return (
    <div className="orman-two-factor__codes">
      <p>{text.codesIntro}</p>
      <ul>
        {codes.map(code => (
          <li key={code}>
            <code>{code}</code>
          </li>
        ))}
      </ul>
      {href ? (
        <a className="orman-two-factor__download" href={href} download="recovery-codes.txt">
          {text.download}
        </a>
      ) : null}
    </div>
  )
}
