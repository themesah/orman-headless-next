import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { api } from '../csrf'
import type { FormCaptcha, KaptchaSite, SiteResponse, TurnstileSite } from '../types'
import { FieldError, useFormHook } from '@orman/headless-next/form'

export interface CaptchaLabels {
  /** Turnstile: the message when the form is sent before the check ran. */
  required: string
  /** Kaptcha: the input's accessible name, the refresh button, and the image's alt text. */
  answer: string
  refresh: string
  image: string
}

export const DEFAULT_CAPTCHA_LABELS: CaptchaLabels = {
  required: 'Please complete the check.',
  answer: 'Type the characters you see',
  refresh: 'New image',
  image: 'Captcha',
}

export interface CaptchaProps {
  /** `data.captcha` of the form's schema; `null` renders nothing. */
  captcha: FormCaptcha | null | undefined
  /** The cached `/site` answer: the addons' public config comes from here. */
  site: Pick<SiteResponse, 'addons'>
  labels?: Partial<CaptchaLabels>
  /** Turnstile theme: auto (default), light or dark. */
  theme?: 'auto' | 'light' | 'dark'
  className?: string
}

/**
 * The captcha a form asks for, inside a {@link Form}: the Turnstile widget, or a Kaptcha challenge (image, refresh, answer box).
 * It adds the field names the Blade forms post (`cf-turnstile-response`; `kaptcha` + `kaptcha_token`) so the server side does not
 * change, and asks for a fresh token or image after every attempt. Client-only: a challenge is one visitor's, never rendered on
 * the server. Class hooks: `orman-captcha`, `orman-captcha--turnstile|kaptcha`, `orman-captcha__image|refresh|input`.
 */
export function Captcha({ captcha, site, labels, theme = 'auto', className }: CaptchaProps) {
  const text = { ...DEFAULT_CAPTCHA_LABELS, ...labels }
  if (!captcha) return null
  if (captcha.kind === 'turnstile') {
    const config = site.addons.turnstile
    if (!config) return missing('turnstile')
    return <TurnstileWidget config={config} labels={text} theme={theme} className={className} />
  }
  const config = site.addons.kaptcha
  if (!config) return missing('kaptcha')
  return <KaptchaChallenge config={config} labels={text} className={className} />
}

function missing(kind: string) {
  // The schema asks for a captcha the site does not publish: show nothing in production, say why in development.
  if (process.env.NODE_ENV !== 'production') console.warn(`<Captcha>: the form asks for ${kind} but /site has no addons.${kind} block.`)
  return null
}

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string
  getResponse: (id?: string) => string | undefined
  reset: (id?: string) => void
  remove: (id?: string) => void
}

const scripts = new Map<string, Promise<TurnstileApi>>()

/** Loads Cloudflare's script once per address and resolves with `window.turnstile` (explicit rendering). */
export function loadTurnstile(script: string): Promise<TurnstileApi> {
  const win = window as unknown as { turnstile?: TurnstileApi }
  if (win.turnstile) return Promise.resolve(win.turnstile)
  let loading = scripts.get(script)
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const el = document.createElement('script')
      el.src = `${script}${script.includes('?') ? '&' : '?'}render=explicit`
      el.async = true
      el.onload = () => (win.turnstile ? resolve(win.turnstile) : reject(new Error('turnstile did not load')))
      el.onerror = () => reject(new Error('turnstile script failed'))
      document.head.appendChild(el)
    })
    loading.catch(() => scripts.delete(script))
    scripts.set(script, loading)
  }
  return loading
}

function TurnstileWidget({ config, labels, theme, className }: { config: TurnstileSite; labels: CaptchaLabels; theme: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const widget = useRef<{ id: string; api: TurnstileApi } | null>(null)

  useEffect(() => {
    let cancelled = false
    loadTurnstile(config.script)
      .then(api => {
        if (cancelled || !box.current) return
        widget.current = { id: api.render(box.current, { sitekey: config.sitekey, theme }), api }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
      widget.current?.api.remove(widget.current.id)
      widget.current = null
    }
  }, [config.script, config.sitekey, theme])

  useFormHook({
    prepare(data) {
      const token = widget.current?.api.getResponse(widget.current.id)
      if (!token) throw new Error(labels.required)
      data.set(config.field, token)
    },
    reset() {
      if (widget.current) widget.current.api.reset(widget.current.id)
    },
  })

  return <div ref={box} className={['orman-captcha', 'orman-captcha--turnstile', className].filter(Boolean).join(' ')} />
}

function KaptchaChallenge({ config, labels, className }: { config: KaptchaSite; labels: CaptchaLabels; className?: string }) {
  const id = useId()
  const [challenge, setChallenge] = useState<{ token: string; image: string } | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    const result = await api<{ token: string; image: string }>('POST', config.challenge)
    if (result.ok) setChallenge({ token: result.body.token, image: result.body.image })
    if (input.current) input.current.value = ''
  }, [config.challenge])

  // Fetched in the browser on mount: a challenge is one visitor's and is never part of a cached page.
  useEffect(() => {
    void load()
  }, [load])

  useFormHook({ reset: () => void load() })

  return (
    <div className={['orman-captcha', 'orman-captcha--kaptcha', className].filter(Boolean).join(' ')}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a data: URI, there is nothing to optimise */}
      {challenge ? <img className="orman-captcha__image" src={challenge.image} width={config.width} height={config.height} alt={labels.image} /> : null}
      <button type="button" className="orman-captcha__refresh" onClick={() => void load()}>
        {labels.refresh}
      </button>
      <input ref={input} id={id} className="orman-captcha__input" type="text" name={config.fields.answer} autoComplete="off" autoCapitalize="off" spellCheck={false} required aria-label={labels.answer} />
      <input type="hidden" name={config.fields.challenge} value={challenge?.token ?? ''} />
      <FieldError name={config.fields.answer} />
    </div>
  )
}
