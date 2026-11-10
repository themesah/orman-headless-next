import type { CSSProperties, ReactNode } from 'react'
import type { BardMark, BardNode, BardValue } from '../types'

/**
 * Bard as React, for sites whose Bard fields are JSON (`HEADLESS_BARD=json`). A server component: no hooks, no state, no
 * `"use client"`, and no raw HTML anywhere (no `dangerouslySetInnerHTML`); text is always text.
 *
 * What it renders: paragraphs, headings (1–6), lists, quotes, code blocks, rules, breaks, images, tables, details; the marks bold,
 * italic, strike, underline, code, link, sub/superscript, small, highlight; and the editor addons' data:
 *
 *   `textColor` (Editor-Color)   `style={{ color }}` when the value is a color, otherwise the text without it
 *   `fontSize` (Font-Size)       `style={{ fontSize }}` when the value is a size
 *   `btsSpan` (Texstyle)         a `<span>` with the class names in `attrs.class`
 *   `attrs.class` on any block   `className` (class-name characters only: a quote or bracket drops the attribute)
 *   `btsDiv` (Texstyle)          a `<div>` with its class
 *   `btsPin` (Texstyle)          the component you give for its `values.type` in `pins`; a pin with no component renders nothing
 *   `set` (Bard sets)            the component you give for its handle in `sets`; none renders nothing
 *
 * Anything else, a node or mark it does not know included, renders as its content (nodes) or its text (marks): nothing is invented.
 * Pass `nodes` / `marks` to replace the rendering of one type (an `<Image>` from next/image, a router `<Link>`).
 */
export interface BardRenderers {
  /** Replace how one node type renders. Return `undefined` to fall back to the default. `children` is the node's rendered content. */
  nodes?: Record<string, (node: BardNode, children: ReactNode) => ReactNode | undefined>
  /** Replace how one mark type renders. `children` is the text (or the marks inside). */
  marks?: Record<string, (mark: BardMark, children: ReactNode) => ReactNode | undefined>
  /** Texstyle pins by `values.type`: receives the pin's values (augmented, only the fields the pin declares) and its id. */
  pins?: Record<string, (values: Record<string, unknown>, id: string | number | null) => ReactNode>
  /** Bard sets by set handle: receives the set's augmented values and its id. */
  sets?: Record<string, (values: Record<string, unknown>, id: string | null) => ReactNode>
}

export interface BardProps extends BardRenderers {
  /** A Bard field as `/page` sends it in json mode. Anything else (null, an HTML string) renders nothing. */
  value: BardValue | null | undefined
  className?: string
  /** The wrapper element; `false` renders the nodes bare (a fragment). Default `div`. */
  as?: 'div' | 'article' | 'section' | false
}

const CLASS_NAMES = /^[A-Za-z0-9_:/.[\]%#@ -]+$/
const COLOR = /^(?:#[0-9a-f]{3,8}|[a-z]{3,30}|(?:rgb|hsl|hwb|lab|lch|oklab|oklch)a?\(\s*[-\d.%,/\sa-z]+\))$/i
const SIZE = /^\d{1,4}(?:\.\d{1,4})?(?:px|rem|em|%|pt|vw|vh|ch|ex)?$/i
const SAFE_HREF = /^(?:https?:\/\/|\/(?!\/)|#|mailto:|tel:)/i
const SAFE_SRC = /^(?:https?:\/\/|\/(?!\/))/i

/** A CSS color the kit will write into `style` (the server checks the same; this is the second wall). */
export function isSafeColor(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 80 && COLOR.test(value.trim()) && !/url|expression|javascript|var\(/i.test(value)
}

/** A CSS size the kit will write into `style`. */
export function isSafeSize(value: unknown): value is string {
  return (typeof value === 'string' || typeof value === 'number') && SIZE.test(String(value).trim())
}

function className(attrs: BardNode['attrs'] | BardMark['attrs']): string | undefined {
  const value = attrs?.class
  return typeof value === 'string' && value.length <= 200 && CLASS_NAMES.test(value) ? value.trim() : undefined
}

/** The nodes of a Bard field as React elements (see {@link BardProps}). */
export function renderBard(nodes: BardNode[] | undefined, options: BardRenderers = {}): ReactNode {
  return (nodes ?? []).map((node, i) => <Node key={i} node={node} options={options} />)
}

/** A Bard field (json mode) rendered as React. A server component. */
export function Bard({ value, className: wrapperClass, as = 'div', ...options }: BardProps): ReactNode {
  if (!value || typeof value !== 'object' || value.type !== 'bard' || !Array.isArray(value.content)) return null
  const content = renderBard(value.content, options)
  if (as === false) return content
  const Tag = as
  return <Tag className={wrapperClass}>{content}</Tag>
}

function Node({ node, options }: { node: BardNode; options: BardRenderers }): ReactNode {
  if (node.type === 'text') return <Text node={node} options={options} />
  if (node.type === 'set') return renderSet(node, options)
  if (node.type === 'btsPin') return renderPin(node, options)

  const children = node.content?.length ? renderBard(node.content, options) : null
  const custom = options.nodes?.[node.type]?.(node, children)
  if (custom !== undefined) return custom

  const cls = className(node.attrs)
  switch (node.type) {
    case 'paragraph':
      return <p className={cls}>{children}</p>
    case 'heading': {
      const Tag = `h${Math.min(6, Math.max(1, Number(node.attrs?.level) || 2))}` as 'h2'
      return <Tag className={cls}>{children}</Tag>
    }
    case 'bulletList':
      return <ul className={cls}>{children}</ul>
    case 'orderedList': {
      const start = Number(node.attrs?.start)
      return <ol className={cls} start={Number.isInteger(start) && start > 1 ? start : undefined}>{children}</ol>
    }
    case 'listItem':
      return <li className={cls}>{children}</li>
    case 'blockquote':
      return <blockquote className={cls}>{children}</blockquote>
    case 'codeBlock':
      return (
        <pre className={cls}>
          <code>{children}</code>
        </pre>
      )
    case 'horizontalRule':
      return <hr className={cls} />
    case 'hardBreak':
      return <br />
    case 'image': {
      const src = node.attrs?.src
      if (typeof src !== 'string' || !SAFE_SRC.test(src)) return null
      // eslint-disable-next-line @next/next/no-img-element -- the kit stays framework-neutral; pass `nodes.image` for next/image
      return <img src={src} alt={typeof node.attrs?.alt === 'string' ? node.attrs.alt : ''} title={typeof node.attrs?.title === 'string' ? node.attrs.title : undefined} className={cls} />
    }
    case 'table':
      return (
        <table className={cls}>
          <tbody>{children}</tbody>
        </table>
      )
    case 'tableRow':
      return <tr>{children}</tr>
    case 'tableHeader':
      return <th colSpan={span(node.attrs?.colspan)} rowSpan={span(node.attrs?.rowspan)}>{children}</th>
    case 'tableCell':
      return <td colSpan={span(node.attrs?.colspan)} rowSpan={span(node.attrs?.rowspan)}>{children}</td>
    case 'details':
      return <details className={cls}>{children}</details>
    case 'detailsSummary':
      return <summary>{children}</summary>
    case 'detailsContent':
      return <div>{children}</div>
    case 'btsDiv':
      return <div className={cls}>{children}</div>
    default:
      // A node the kit does not know: its content, no wrapper.
      return children
  }
}

function span(value: unknown): number | undefined {
  const n = Number(value)
  return Number.isInteger(n) && n > 1 && n <= 50 ? n : undefined
}

function renderSet(node: BardNode, options: BardRenderers): ReactNode {
  const set = node as BardNode & { id?: string | null; set?: string; values?: Record<string, unknown> }
  const render = typeof set.set === 'string' ? options.sets?.[set.set] : undefined
  return render ? render(set.values ?? {}, set.id ?? null) : null
}

function renderPin(node: BardNode, options: BardRenderers): ReactNode {
  const values = (node.attrs?.values ?? {}) as Record<string, unknown>
  const render = typeof values.type === 'string' ? options.pins?.[values.type] : undefined
  const id = node.attrs?.id
  return render ? render(values, typeof id === 'string' || typeof id === 'number' ? id : null) : null
}

function Text({ node, options }: { node: BardNode; options: BardRenderers }): ReactNode {
  let out: ReactNode = node.text ?? ''

  for (const mark of node.marks ?? []) {
    const custom: ReactNode | undefined = options.marks?.[mark.type]?.(mark, out)
    out = custom !== undefined ? custom : defaultMark(mark, out)
  }

  return out
}

function defaultMark(mark: BardMark, children: ReactNode): ReactNode {
  switch (mark.type) {
    case 'bold':
      return <strong>{children}</strong>
    case 'italic':
      return <em>{children}</em>
    case 'strike':
      return <s>{children}</s>
    case 'underline':
      return <u>{children}</u>
    case 'code':
      return <code>{children}</code>
    case 'subscript':
      return <sub>{children}</sub>
    case 'superscript':
      return <sup>{children}</sup>
    case 'small':
      return <small>{children}</small>
    case 'highlight':
      return <mark>{children}</mark>
    case 'link': {
      const href = mark.attrs?.href
      if (typeof href !== 'string' || !SAFE_HREF.test(href.trim())) return children
      const blank = mark.attrs?.target === '_blank'
      return (
        <a href={href.trim()} target={blank ? '_blank' : undefined} rel={blank ? 'noopener noreferrer' : undefined} className={className(mark.attrs)}>
          {children}
        </a>
      )
    }
    case 'textColor': {
      const color = mark.attrs?.color
      return isSafeColor(color) ? <span style={{ color: color.trim() } satisfies CSSProperties}>{children}</span> : children
    }
    case 'fontSize': {
      const size = mark.attrs?.fontSize
      return isSafeSize(size) ? <span style={{ fontSize: String(size).trim() } satisfies CSSProperties}>{children}</span> : children
    }
    case 'btsSpan': {
      const cls = className(mark.attrs)
      return cls ? <span className={cls}>{children}</span> : children
    }
    default:
      return children
  }
}
