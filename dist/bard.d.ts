import { ReactNode } from 'react';
import { BardNode, BardMark, BardValue } from './types.js';

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
interface BardRenderers {
    /** Replace how one node type renders. Return `undefined` to fall back to the default. `children` is the node's rendered content. */
    nodes?: Record<string, (node: BardNode, children: ReactNode) => ReactNode | undefined>;
    /** Replace how one mark type renders. `children` is the text (or the marks inside). */
    marks?: Record<string, (mark: BardMark, children: ReactNode) => ReactNode | undefined>;
    /** Texstyle pins by `values.type`: receives the pin's values (augmented, only the fields the pin declares) and its id. */
    pins?: Record<string, (values: Record<string, unknown>, id: string | number | null) => ReactNode>;
    /** Bard sets by set handle: receives the set's augmented values and its id. */
    sets?: Record<string, (values: Record<string, unknown>, id: string | null) => ReactNode>;
}
interface BardProps extends BardRenderers {
    /** A Bard field as `/page` sends it in json mode. Anything else (null, an HTML string) renders nothing. */
    value: BardValue | null | undefined;
    className?: string;
    /** The wrapper element; `false` renders the nodes bare (a fragment). Default `div`. */
    as?: 'div' | 'article' | 'section' | false;
}
/** A CSS color the kit will write into `style` (the server checks the same; this is the second wall). */
declare function isSafeColor(value: unknown): value is string;
/** A CSS size the kit will write into `style`. */
declare function isSafeSize(value: unknown): value is string;
/** The nodes of a Bard field as React elements (see {@link BardProps}). */
declare function renderBard(nodes: BardNode[] | undefined, options?: BardRenderers): ReactNode;
/** A Bard field (json mode) rendered as React. A server component. */
declare function Bard({ value, className: wrapperClass, as, ...options }: BardProps): ReactNode;

export { Bard, type BardProps, type BardRenderers, isSafeColor, isSafeSize, renderBard };
