import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { Form, FieldError } from '@orman/headless-next/form'
import { maintenanceView } from '../maintenance-html'
import type { BardNode, MaintenanceSite } from '../types'

export interface MaintenancePageProps extends Omit<ComponentPropsWithoutRef<'main'>, 'title'> {
  /** `addons.maintenance` of `/site`: the title, message, countdown, price, contact and the two forms come from it. */
  site?: Partial<MaintenanceSite>
  /** Overrides the title / message from `site` (or stands in for them without it). */
  title?: ReactNode
  message?: ReactNode
  /** Extra content under the page. */
  children?: ReactNode
}

/**
 * What a gate answers with while maintenance is on. Without client code of its own (the two forms are `<Form>`s), so it works as a
 * server component and as the body of a 503 answer. Class hooks: `orman-maintenance`, `__title`, `__message`, `__countdown`,
 * `__price`, `__contact`, `__subscribe`, `__unlock`, `__extra`. `renderMaintenanceHtml()` produces the same markup as a string, for
 * a `proxy.ts` that cannot render React.
 */
export function MaintenancePage({ site, title, message, children, className, ...rest }: MaintenancePageProps) {
  const v = maintenanceView(site)
  return (
    <main {...rest} className={['orman-maintenance', className].filter(Boolean).join(' ')}>
      <h1 className="orman-maintenance__title">{title ?? v.title}</h1>
      <div className="orman-maintenance__message">{message ?? (v.messageNodes ? <Nodes nodes={v.messageNodes} /> : <p>{v.labels.backSoon}</p>)}</div>
      {v.endsAt ? (
        <p className="orman-maintenance__countdown">
          <time dateTime={v.endsAt}>{v.endsAt}</time>
        </p>
      ) : null}
      {v.showPrice ? (
        <p className="orman-maintenance__price">
          {v.labels.price}: {v.price}
        </p>
      ) : null}
      {v.contact ? (
        <p className="orman-maintenance__contact">
          {v.labels.contact}: <a href={`mailto:${v.contact}`}>{v.contact}</a>
        </p>
      ) : null}
      {v.collectEmails ? (
        <Form action={v.subscribe} json className="orman-maintenance__subscribe">
          {state => (
            <>
              <label>
                {v.labels.email} <input type="email" name="email" required />
              </label>{' '}
              <button type="submit" disabled={state.pending}>
                {v.labels.notify}
              </button>
              <FieldError name="email" />
              {state.done ? <p className="orman-maintenance__status" role="status">✓</p> : null}
            </>
          )}
        </Form>
      ) : null}
      {v.hasAccess ? (
        <Form action={v.unlock} json className="orman-maintenance__unlock" onSuccess={() => window.location.reload()}>
          {state => (
            <>
              <label>
                {v.labels.password} <input type="password" name="password" required autoComplete="off" />
              </label>{' '}
              <button type="submit" disabled={state.pending}>
                {v.labels.unlock}
              </button>
              <FieldError name="password" />
            </>
          )}
        </Form>
      ) : null}
      {children ? <div className="orman-maintenance__extra">{children}</div> : null}
    </main>
  )
}

function Nodes({ nodes }: { nodes: BardNode[] }): ReactNode {
  return nodes.map((node, i) => <Node key={i} node={node} />)
}

const MARK_TAGS: Record<string, 'strong' | 'em' | 'u' | 's'> = { bold: 'strong', italic: 'em', underline: 'u', strike: 's' }

function Node({ node }: { node: BardNode }): ReactNode {
  if (node.type === 'text') {
    let out: ReactNode = node.text ?? ''
    for (const mark of node.marks ?? []) {
      const Tag = MARK_TAGS[mark.type]
      if (mark.type === 'link' && typeof mark.attrs?.href === 'string' && /^(https?:\/\/|\/|mailto:)/i.test(mark.attrs.href)) out = <a href={mark.attrs.href}>{out}</a>
      else if (Tag) out = <Tag>{out}</Tag>
    }
    return out
  }
  if (node.type === 'hardBreak') return <br />
  const inner = node.content ? <Nodes nodes={node.content} /> : null
  switch (node.type) {
    case 'paragraph':
      return <p>{inner}</p>
    case 'heading': {
      const level = Math.min(6, Math.max(2, Number(node.attrs?.level) || 2))
      const Tag = `h${level}` as 'h2'
      return <Tag>{inner}</Tag>
    }
    case 'bulletList':
      return <ul>{inner}</ul>
    case 'orderedList':
      return <ol>{inner}</ol>
    case 'listItem':
      return <li>{inner}</li>
    case 'blockquote':
      return <blockquote>{inner}</blockquote>
    default:
      return null
  }
}
