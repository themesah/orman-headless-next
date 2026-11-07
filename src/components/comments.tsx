import { useEffect, useMemo, useState } from 'react'
import type { ApiOptions } from '../csrf'
import { Captcha } from './captcha'
import { FieldError, Form } from '@orman/headless-next/form'
import type { CommentStatus, DiskussiyaBlock, OwnComment, PublicComment, SiteResponse } from '../types'
import { callAccount, failure } from './account-api'

export interface CommentsLabels {
  title: string
  empty: string
  name: string
  email: string
  comment: string
  submit: string
  waiting: string
  closed: string
  loginRequired: string
  reply: string
}

export const DEFAULT_COMMENTS_LABELS: CommentsLabels = {
  title: 'Comments',
  empty: 'No comments yet.',
  name: 'Name',
  email: 'E-mail (never shown)',
  comment: 'Comment',
  submit: 'Post comment',
  waiting: 'Waiting for approval',
  closed: 'Comments are closed.',
  loginRequired: 'Sign in to comment.',
  reply: 'Reply',
}

export interface CommentsProps {
  /** `page.addons.diskussiya` of the cached page. */
  block: DiskussiyaBlock | null | undefined
  /** The cached `/site` answer, for the captcha config. */
  site: Pick<SiteResponse, 'addons'>
  labels?: Partial<CommentsLabels>
  api?: ApiOptions
  className?: string
}

/**
 * The approved comments (public content, cached with the page) plus the form. A new comment is posted through `/!/` with the
 * signed context from the page and the captcha when the site asks for one; the author sees it at once as "waiting for approval"
 * (only in their own browser: the cached page never contains it). Never shows e-mails or addresses. Class hooks: `orman-comments`,
 * `__item` (`data-depth`, `data-pending`), `__author|__text|__date`, `__form`, `__closed`.
 */
export function Comments({ block, site, labels, api: apiOptions, className }: CommentsProps) {
  const text = { ...DEFAULT_COMMENTS_LABELS, ...labels }
  const [own, setOwn] = useState<OwnComment[]>([])
  const [replyTo, setReplyTo] = useState<number | null>(null)
  if (!block) return null
  const root = ['orman-comments', className].filter(Boolean).join(' ')

  return (
    <section className={root}>
      <h2 className="orman-comments__title">
        {text.title} ({block.count})
      </h2>
      {block.comments.length || own.length ? (
        <ol className="orman-comments__list">
          {block.comments.map(c => (
            <li key={c.id} className="orman-comments__item" data-depth={c.depth}>
              <strong className="orman-comments__author">{c.author.name}</strong> <time className="orman-comments__date">{c.created_at}</time>
              <p className="orman-comments__text">{c.text}</p>
              {block.open ? (
                <button type="button" className="orman-comments__reply" onClick={() => setReplyTo(c.id)}>
                  {text.reply}
                </button>
              ) : null}
            </li>
          ))}
          {own.map(c => (
            <li key={`own-${c.id}`} className="orman-comments__item" data-depth={c.depth} data-pending="true">
              <strong className="orman-comments__author">{c.author.name}</strong> <em className="orman-comments__status">{text.waiting}</em>
              <p className="orman-comments__text">{c.text}</p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="orman-comments__empty">{text.empty}</p>
      )}

      {!block.open ? (
        <p className="orman-comments__closed">{text.closed}</p>
      ) : (
        <Form
          className="orman-comments__form"
          action={block.post}
          json
          api={apiOptions}
          onSuccess={result => {
            const comment = (result.body as { comment?: OwnComment } | null)?.comment
            if (comment) setOwn(list => [...list, { ...comment, status: 'pending' }])
            setReplyTo(null)
          }}
        >
          {({ pending }) => (
            <>
              <input type="hidden" name="_diskussiya_context" value={block.context} />
              <input type="hidden" name="_diskussiya_context_signature" value={block.signature} />
              {replyTo ? <input type="hidden" name="ids" value={replyTo} /> : null}
              {/* honeypot: hidden from people, filled by bots */}
              <input type="text" name={block.honeypot} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }} defaultValue="" />
              <label>
                <span>{text.name}</span>
                <input name="name" type="text" required />
                <FieldError name="name" />
              </label>
              <label>
                <span>{text.email}</span>
                <input name="email" type="email" required />
                <FieldError name="email" />
              </label>
              <label>
                <span>{text.comment}</span>
                <textarea name="comment" required />
                <FieldError name="comment" />
              </label>
              <Captcha captcha={block.captcha} site={site} />
              <button type="submit" disabled={pending}>
                {text.submit}
              </button>
            </>
          )}
        </Form>
      )}
    </section>
  )
}

export interface MyCommentsLabels {
  title: string
  empty: string
  signedOut: string
  status: Record<CommentStatus, string>
}

export const DEFAULT_MY_COMMENTS_LABELS: MyCommentsLabels = {
  title: 'My comments',
  empty: 'You have not commented yet.',
  signedOut: 'You are signed out.',
  status: { pending: 'Waiting for approval', accepted: 'Accepted', rejected: 'Rejected', replied: 'Replied to' },
}

export interface MyCommentsProps {
  /** `addons.diskussiya.mine`. Default `/!/diskussiya/mine`. */
  url?: string
  labels?: Partial<Omit<MyCommentsLabels, 'status'>> & { status?: Partial<MyCommentsLabels['status']> }
  api?: ApiOptions
  onSignedOut?: () => void
  className?: string
}

/** The signed-in person's comments with their status, each linking to its page. Per-user, never cached. Hooks: `orman-my-comments`, `__item` (`data-status`). */
export function MyComments({ url = '/!/diskussiya/mine', labels, api: apiOptions, onSignedOut, className }: MyCommentsProps) {
  const text = { ...DEFAULT_MY_COMMENTS_LABELS, ...labels, status: { ...DEFAULT_MY_COMMENTS_LABELS.status, ...labels?.status } }
  const [items, setItems] = useState<OwnComment[] | null>(null)
  const [out, setOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const call = useMemo(
    () =>
      callAccount(() => {
        setOut(true)
        onSignedOut?.()
      }, apiOptions),
    [apiOptions, onSignedOut],
  )
  useEffect(() => {
    void call<{ comments: OwnComment[] }>('GET', url).then(res => {
      if (res.ok) setItems(res.body.comments)
      else if (res.status !== 401) setError(failure(res))
    })
  }, [call, url])

  const root = ['orman-my-comments', className].filter(Boolean).join(' ')
  if (out) return <p className={root}>{text.signedOut}</p>
  if (error) return <p className={root} role="alert">{error}</p>
  if (!items) return <div className={root} aria-busy="true" />
  if (!items.length) return <p className={root}>{text.empty}</p>
  return (
    <ul className={root}>
      {items.map(c => (
        <li key={c.id} className="orman-my-comments__item" data-status={c.status}>
          {c.page?.url ? <a href={c.page.url}>{c.page.title}</a> : c.page?.title ? <span>{c.page.title}</span> : null}
          <p>{c.text}</p>
          <em>{text.status[c.status]}</em>
        </li>
      ))}
    </ul>
  )
}

export type { PublicComment }
