import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ApiOptions } from '../csrf'
import type { InboxItem } from '../types'
import { callAccount } from './account-api'
import { followStream } from './stream'

export interface InboxLabels {
  title: string
  empty: string
  seen: string
  accept: string
  snooze: string
  dismiss: string
  signedOut: string
}

export const DEFAULT_INBOX_LABELS: InboxLabels = {
  title: 'Notifications',
  empty: 'Nothing new.',
  seen: 'Mark as seen',
  accept: 'Accept',
  snooze: 'Snooze',
  dismiss: 'Dismiss',
  signedOut: 'You are signed out.',
}

export interface InboxProps {
  /** `addons.notifications.inbox`. Default `/!/notifications/inbox`. */
  base?: string
  labels?: Partial<InboxLabels>
  api?: ApiOptions
  /** Snooze length in minutes. Default 1440 (a day). */
  snoozeMinutes?: number
  /** Follow the live stream (falls back to polling). Default true. */
  live?: boolean
  onSignedOut?: () => void
  className?: string
}

/**
 * The person's notifications: seen, accept (when required), snooze, dismiss. Updates arrive over the Mercure stream when the
 * site has one reachable, otherwise by polling. Per-user, never cached. Class hooks: `orman-inbox`, `__item` (`data-level`,
 * `data-status`), `__title|__body|__action|__button`, `__empty`.
 */
export function Inbox({ base = '/!/notifications/inbox', labels, api: apiOptions, snoozeMinutes = 1440, live = true, onSignedOut, className }: InboxProps) {
  const text = { ...DEFAULT_INBOX_LABELS, ...labels }
  const [items, setItems] = useState<InboxItem[] | null>(null)
  const [out, setOut] = useState(false)
  const call = useMemo(
    () =>
      callAccount(() => {
        setOut(true)
        onSignedOut?.()
      }, apiOptions),
    [apiOptions, onSignedOut],
  )

  const load = useCallback(async () => {
    const res = await call<{ items: InboxItem[] }>('GET', `${base}/recent`)
    if (res.ok) setItems(res.body.items)
  }, [base, call])

  useEffect(() => {
    void load()
    if (!live) return
    return followStream({ url: `${base}/stream`, api: apiOptions, onEvent: () => void load(), onPoll: () => void load(), onSignedOut: () => setOut(true) })
  }, [base, live, load, apiOptions])

  async function act(item: InboxItem, action: 'read' | 'acknowledge' | 'snooze' | 'dismiss') {
    await call('POST', `${base}/${action}/${encodeURIComponent(item.id)}`, action === 'snooze' ? { minutes: snoozeMinutes } : undefined)
    await load()
  }

  const root = ['orman-inbox', className].filter(Boolean).join(' ')
  if (out) return <p className={root}>{text.signedOut}</p>
  if (!items) return <div className={root} aria-busy="true" />
  if (!items.length) return <p className={`${root} orman-inbox__empty`}>{text.empty}</p>
  return (
    <ul className={root} aria-live="polite">
      {items.map(item => (
        <li key={item.id} className="orman-inbox__item" data-level={item.level} data-status={item.status}>
          <strong className="orman-inbox__title">{item.title}</strong>
          {item.body ? <p className="orman-inbox__body">{item.body}</p> : null}
          {item.action_url ? (
            <a className="orman-inbox__action" href={item.action_url}>
              {item.action_label ?? item.action_url}
            </a>
          ) : null}
          <span className="orman-inbox__buttons">
            {!item.read ? (
              <button type="button" className="orman-inbox__button" onClick={() => act(item, 'read')}>
                {text.seen}
              </button>
            ) : null}
            {item.can_accept ? (
              <button type="button" className="orman-inbox__button" onClick={() => act(item, 'acknowledge')}>
                {text.accept}
              </button>
            ) : null}
            {item.can_snooze ? (
              <button type="button" className="orman-inbox__button" onClick={() => act(item, 'snooze')}>
                {text.snooze}
              </button>
            ) : null}
            {item.can_dismiss ? (
              <button type="button" className="orman-inbox__button" onClick={() => act(item, 'dismiss')}>
                {text.dismiss}
              </button>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  )
}
