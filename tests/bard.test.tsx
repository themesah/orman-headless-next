import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Bard, isSafeColor, isSafeSize, renderBard } from '../src/components/bard'
import type { BardNode, BardValue } from '../src/types'

const doc = (...content: BardNode[]): BardValue => ({ type: 'bard', content })
const p = (...content: BardNode[]): BardNode => ({ type: 'paragraph', content })
const t = (text: string, marks: BardNode['marks'] = undefined): BardNode => ({ type: 'text', text, ...(marks ? { marks } : {}) })
const html = (value: BardValue | null | undefined, extra: Partial<React.ComponentProps<typeof Bard>> = {}) => renderToStaticMarkup(<Bard value={value} as={false} {...extra} />)

describe('<Bard>', () => {
  it('renders the usual nodes and marks as elements, escaping text', () => {
    expect(html(doc({ type: 'heading', attrs: { level: 3 }, content: [t('Hi <b>')] }, p(t('a', [{ type: 'bold' }, { type: 'italic' }]))))).toBe('<h3>Hi &lt;b&gt;</h3><p><em><strong>a</strong></em></p>')
  })

  it('renders a table, a list, an image and a rule', () => {
    const out = html(doc(
      { type: 'table', content: [{ type: 'tableRow', content: [{ type: 'tableHeader', content: [p(t('h'))] }, { type: 'tableCell', attrs: { colspan: 2 }, content: [p(t('c'))] }] }] },
      { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [p(t('x'))] }] },
      { type: 'image', attrs: { src: '/a.png', alt: 'A' } },
      { type: 'horizontalRule' },
    ))
    expect(out).toContain('<table><tbody><tr><th><p>h</p></th><td colSpan="2"><p>c</p></td></tr></tbody></table>')
    expect(out).toContain('<ol start="3"><li><p>x</p></li></ol>')
    expect(out).toContain('<img src="/a.png" alt="A"/>')
    expect(out).toContain('<hr/>')
  })

  it('maps Texstyle classes to className on blocks and spans, and only class-name characters', () => {
    const out = html(doc(
      { type: 'paragraph', attrs: { class: 'lead' }, content: [t('7th', [{ type: 'btsSpan', attrs: { class: 'mil-accent' } }])] },
      { type: 'paragraph', attrs: { class: 'x" onmouseover="alert(1)' }, content: [t('no')] },
      { type: 'btsDiv', attrs: { class: 'box' }, content: [p(t('in'))] },
    ))
    expect(out).toBe('<p class="lead"><span class="mil-accent">7th</span></p><p>no</p><div class="box"><p>in</p></div>')
  })

  it('renders a pin with the component for its type and nothing for an unknown one', () => {
    const pins = { quote_card: (values: Record<string, unknown>, id: unknown) => <blockquote data-id={String(id)}>{String(values.quote)}</blockquote> }
    const known: BardNode = { type: 'btsPin', attrs: { id: 'p1', values: { type: 'quote_card', quote: 'Hello' } } }
    const unknown: BardNode = { type: 'btsPin', attrs: { id: 'p2', values: { type: 'nope' } } }

    expect(html(doc(known, unknown), { pins })).toBe('<blockquote data-id="p1">Hello</blockquote>')
    expect(html(doc(known))).toBe('')
  })

  it('renders a set with the component for its handle', () => {
    const set = { type: 'set', id: 's1', set: 'cta', values: { label: 'Go' } } as BardNode
    expect(html(doc(set), { sets: { cta: values => <a href="/go">{String(values.label)}</a> } })).toBe('<a href="/go">Go</a>')
    expect(html(doc(set))).toBe('')
  })

  it('writes color and font size into style only when they are a color and a size', () => {
    const marked = (marks: BardNode['marks']) => html(doc(p(t('x', marks))))
    expect(marked([{ type: 'textColor', attrs: { color: '#c00' } }])).toBe('<p><span style="color:#c00">x</span></p>')
    expect(marked([{ type: 'fontSize', attrs: { fontSize: '24px' } }])).toBe('<p><span style="font-size:24px">x</span></p>')
    expect(marked([{ type: 'textColor', attrs: { color: 'red; background: url(x)' } }])).toBe('<p>x</p>')
    expect(marked([{ type: 'fontSize', attrs: { fontSize: '1em; x' } }])).toBe('<p>x</p>')
    expect(isSafeColor('rgb(1, 2, 3)')).toBe(true)
    expect(isSafeColor('var(--x)')).toBe(false)
    expect(isSafeSize('1.5rem')).toBe(true)
    expect(isSafeSize('calc(1px)')).toBe(false)
  })

  it('links only to safe addresses and opens new windows safely', () => {
    const link = (href: string, target?: string) => html(doc(p(t('l', [{ type: 'link', attrs: { href, target } }]))))
    expect(link('https://example.com/a')).toBe('<p><a href="https://example.com/a">l</a></p>')
    expect(link('/about', '_blank')).toBe('<p><a href="/about" target="_blank" rel="noopener noreferrer">l</a></p>')
    expect(link('javascript:alert(1)')).toBe('<p>l</p>')
    expect(link('//evil.example')).toBe('<p>l</p>')
  })

  it('never emits raw HTML: markup in text and in unknown attributes stays text or is dropped', () => {
    const out = html(doc({ type: 'image', attrs: { src: 'javascript:alert(1)' } }, p(t('<script>alert(1)</script>')), { type: 'mystery', content: [p(t('kept'))] }))
    expect(out).toBe('<p>&lt;script&gt;alert(1)&lt;/script&gt;</p><p>kept</p>')
    expect(out).not.toContain('<script')
  })

  it('lets a caller replace one type, and renders nothing for anything that is not a Bard value', () => {
    const out = html(doc({ type: 'image', attrs: { src: '/a.png', alt: 'A' } }), { nodes: { image: node => <figure data-src={String(node.attrs?.src)} /> } })
    expect(out).toBe('<figure data-src="/a.png"></figure>')
    expect(html(null)).toBe('')
    expect(html('<p>html</p>' as unknown as BardValue)).toBe('')
  })

  it('wraps in a div with the class unless told not to, and renderBard gives the bare nodes', () => {
    expect(renderToStaticMarkup(<Bard value={doc(p(t('a')))} className="prose" />)).toBe('<div class="prose"><p>a</p></div>')
    expect(renderToStaticMarkup(<>{renderBard([p(t('a'))])}</>)).toBe('<p>a</p>')
  })
})
