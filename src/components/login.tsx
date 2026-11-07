import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { api, type ApiOptions } from '../csrf'
import { FieldError, Form } from '@orman/headless-next/form'
import type { LoginStep } from '../types'

export interface LoginLabels {
  email: string
  password: string
  remember: string
  submit: string
  code: string
  recoveryCode: string
  useRecovery: string
  useCode: string
  verify: string
  waiting: string
  waitingHint: string
  cancel: string
  denied: string
  expired: string
}

export const DEFAULT_LOGIN_LABELS: LoginLabels = {
  email: 'E-mail',
  password: 'Password',
  remember: 'Remember me',
  submit: 'Sign in',
  code: 'Authentication code',
  recoveryCode: 'Recovery code',
  useRecovery: 'Use a recovery code',
  useCode: 'Use an authentication code',
  verify: 'Verify',
  waiting: 'Waiting for approval',
  waitingHint: 'Open one of your signed-in devices and approve this sign-in.',
  cancel: 'Cancel',
  denied: 'This sign-in was denied.',
  expired: 'This sign-in request expired.',
}

export interface LoginProps {
  /** Step 1. Default `/!/auth/json/login`; `addons.account.login` of /site. */
  action?: string
  /** Step 2 (code or recovery code). Default `/!/account/two-factor/challenge`; `addons.account.challenge`. */
  challenge?: string
  /** Where the approval wait is followed (`status` and `cancel` live under it). Default `/!/sessions/awaiting`. */
  awaiting?: string
  /** Called once the person is signed in. Reload or navigate here: the session cookie is set. */
  onSignedIn?: () => void
  labels?: Partial<LoginLabels>
  api?: ApiOptions
  /** How often the approval is looked up (ms). A pushed `sessions.changed` event may call `refreshRef` earlier. Default 3000. */
  pollMs?: number
  /** Extra form pieces for the credentials step, e.g. `<Captcha>`. */
  children?: ReactNode
  className?: string
}

type Step = { kind: 'credentials' } | { kind: 'two_factor' } | { kind: 'approval'; expiresAt: string | null } | { kind: 'done' }

/**
 * Renders whatever step Orman asks for: credentials → (code or recovery code) → (waiting for another device to approve) → signed in.
 * The half-done login stays in Orman's session; the kit only follows the answers (`needs: 'two_factor' | 'approval' | null`).
 * Class hooks: `orman-login`, `orman-login__step` (`data-step`), `orman-login__field`, `orman-login__submit|switch|cancel|status`.
 */
export function Login({ action = '/!/auth/json/login', challenge = '/!/account/two-factor/challenge', awaiting = '/!/sessions/awaiting', onSignedIn, labels, api: apiOptions, pollMs = 3000, children, className }: LoginProps) {
  const text = { ...DEFAULT_LOGIN_LABELS, ...labels }
  const [step, setStep] = useState<Step>({ kind: 'credentials' })
  const [notice, setNotice] = useState<string | null>(null)
  const [recovery, setRecovery] = useState(false)
  const signedIn = useRef(onSignedIn)
  signedIn.current = onSignedIn

  const follow = useCallback((body: unknown) => {
    const answer = body as Partial<LoginStep> | null
    if (answer?.needs === 'two_factor') return setStep({ kind: 'two_factor' })
    if (answer?.needs === 'approval') return setStep({ kind: 'approval', expiresAt: (answer as { request?: { expires_at?: string } }).request?.expires_at ?? null })
    setStep({ kind: 'done' })
    signedIn.current?.()
  }, [])

  useEffect(() => {
    if (step.kind !== 'approval') return
    let stop = false
    const timer = setInterval(async () => {
      const res = await api<{ state: string }>('GET', `${awaiting}/status`, undefined, apiOptions)
      if (stop || !res.ok) return
      const state = res.body.state
      if (state === 'approved') return follow({ needs: null, signed_in: true })
      if (state === 'denied' || state === 'expired' || state === 'gone') {
        setNotice(state === 'expired' ? text.expired : text.denied)
        setStep({ kind: 'credentials' })
      }
    }, pollMs)
    return () => {
      stop = true
      clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.kind, awaiting, pollMs])

  async function cancel() {
    await api('POST', `${awaiting}/cancel`, undefined, apiOptions)
    setNotice(null)
    setStep({ kind: 'credentials' })
  }

  const root = ['orman-login', className].filter(Boolean).join(' ')

  if (step.kind === 'done') return <div className={root} data-step="done" />

  if (step.kind === 'approval') {
    return (
      <div className={root}>
        <div className="orman-login__step" data-step="approval" role="status">
          <p className="orman-login__status">{text.waiting}</p>
          <p className="orman-login__hint">{text.waitingHint}</p>
          <button type="button" className="orman-login__cancel" onClick={cancel}>
            {text.cancel}
          </button>
        </div>
      </div>
    )
  }

  if (step.kind === 'two_factor') {
    const field = recovery ? 'recovery_code' : 'code'
    return (
      <div className={root}>
        <Form className="orman-login__step" data-step="two_factor" action={challenge} json api={apiOptions} onSuccess={result => follow(result.body)}>
          {({ pending }) => (
            <>
              <label className="orman-login__field">
                <span>{recovery ? text.recoveryCode : text.code}</span>
                <input key={field} name={field} type="text" inputMode={recovery ? 'text' : 'numeric'} autoComplete="one-time-code" autoFocus required />
                <FieldError name={field} />
              </label>
              <button type="submit" className="orman-login__submit" disabled={pending}>
                {text.verify}
              </button>
              <button type="button" className="orman-login__switch" onClick={() => setRecovery(!recovery)}>
                {recovery ? text.useCode : text.useRecovery}
              </button>
            </>
          )}
        </Form>
      </div>
    )
  }

  return (
    <div className={root}>
      {notice ? (
        <p className="orman-login__notice" role="alert">
          {notice}
        </p>
      ) : null}
      <Form className="orman-login__step" data-step="credentials" action={action} json api={apiOptions} onSuccess={result => follow(result.body)}>
        {({ pending }) => (
          <>
            <label className="orman-login__field">
              <span>{text.email}</span>
              <input name="email" type="email" autoComplete="username" required />
              <FieldError name="email" />
            </label>
            <label className="orman-login__field">
              <span>{text.password}</span>
              <input name="password" type="password" autoComplete="current-password" required />
              <FieldError name="password" />
            </label>
            <label className="orman-login__field orman-login__field--remember">
              <input name="remember" type="checkbox" value="1" />
              <span>{text.remember}</span>
            </label>
            {children}
            <button type="submit" className="orman-login__submit" disabled={pending}>
              {text.submit}
            </button>
          </>
        )}
      </Form>
    </div>
  )
}
