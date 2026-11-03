import type { BardNode, MaintenanceSite } from './types'

/**
 * The maintenance page as an HTML string, for the gate's answer in `proxy.ts` (which cannot render React). It mirrors
 * `<MaintenancePage site={…}>` element for element (a test compares the two), including the same class hooks, so one stylesheet
 * serves both. The subscribe and unlock forms are plain forms with a short script that posts JSON with the CSRF token.
 */

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, ch => ESCAPES[ch])
}

const TAGS: Record<string, string> = { paragraph: 'p', bulletList: 'ul', orderedList: 'ol', listItem: 'li', blockquote: 'blockquote' }
const MARKS: Record<string, string> = { bold: 'strong', italic: 'em', underline: 'u', strike: 's' }

export function bardToHtml(nodes: BardNode[] = []): string {
  return nodes.map(node => nodeToHtml(node)).join('')
}

function nodeToHtml(node: BardNode): string {
  if (node.type === 'text') return markText(node)
  if (node.type === 'hardBreak') return '<br>'
  const inner = bardToHtml(node.content)
  if (node.type === 'heading') {
    const level = Math.min(6, Math.max(2, Number(node.attrs?.level) || 2))
    return `<h${level}>${inner}</h${level}>`
  }
  const tag = TAGS[node.type]
  return tag ? `<${tag}>${inner}</${tag}>` : ''
}

function markText(node: BardNode): string {
  let html = escapeHtml(node.text ?? '')
  for (const mark of node.marks ?? []) {
    if (mark.type === 'link' && typeof mark.attrs?.href === 'string' && /^(https?:\/\/|\/|mailto:)/i.test(mark.attrs.href)) {
      html = `<a href="${escapeHtml(mark.attrs.href)}">${html}</a>`
    } else if (MARKS[mark.type]) {
      html = `<${MARKS[mark.type]}>${html}</${MARKS[mark.type]}>`
    }
  }
  return html
}

export interface MaintenanceHtmlOptions {
  lang?: string
  dir?: 'ltr' | 'rtl'
  /** Extra markup for `<head>` (a stylesheet link). */
  head?: string
  /** The CSRF address the inline script uses. */
  csrfUrl?: string
}

/** The text of the page's body, shared with the React component so the two cannot drift. */
export function maintenanceView(site: Partial<MaintenanceSite> | undefined) {
  const labels = site?.labels ?? {}
  return {
    title: site?.title || 'Back soon',
    messageNodes: site?.message?.content ?? null,
    endsAt: site?.ends_at ?? null,
    showPrice: site?.type === 'sell_domain' && !!site.price,
    price: site?.price ?? '',
    contact: site?.contact_email ?? '',
    labels: {
      backSoon: labels.back_soon ?? 'We will be back shortly.',
      contact: labels.contact ?? 'Contact',
      price: labels.price ?? 'Asking price',
      email: labels.email_label ?? 'Your email',
      notify: labels.notify_me ?? 'Notify me',
      password: labels.access_code ?? 'Password or key',
      unlock: labels.unlock ?? 'Enter',
    },
    collectEmails: !!site?.collect_emails,
    hasAccess: !!site?.has_access,
    subscribe: site?.subscribe ?? '/!/maintenance/subscribe',
    unlock: site?.unlock ?? '/!/maintenance/unlock',
  }
}

export function renderMaintenanceHtml(site: Partial<MaintenanceSite> | undefined, options: MaintenanceHtmlOptions = {}): string {
  const v = maintenanceView(site)
  const lang = options.lang ?? site?.lang ?? 'en'
  const dir = options.dir ?? site?.dir ?? 'ltr'
  const message = v.messageNodes ? bardToHtml(v.messageNodes) : `<p>${escapeHtml(v.labels.backSoon)}</p>`
  const parts = [
    `<h1 class="orman-maintenance__title">${escapeHtml(v.title)}</h1>`,
    `<div class="orman-maintenance__message">${message}</div>`,
    v.endsAt ? `<p class="orman-maintenance__countdown"><time dateTime="${escapeHtml(v.endsAt)}">${escapeHtml(v.endsAt)}</time></p>` : '',
    v.showPrice ? `<p class="orman-maintenance__price">${escapeHtml(v.labels.price)}: ${escapeHtml(v.price)}</p>` : '',
    v.contact ? `<p class="orman-maintenance__contact">${escapeHtml(v.labels.contact)}: <a href="mailto:${escapeHtml(v.contact)}">${escapeHtml(v.contact)}</a></p>` : '',
    v.collectEmails
      ? `<form class="orman-maintenance__subscribe" method="post" action="${escapeHtml(v.subscribe)}" data-orman-json><label>${escapeHtml(v.labels.email)} <input type="email" name="email" required></label> <button type="submit">${escapeHtml(v.labels.notify)}</button><p class="orman-maintenance__status" role="status"></p></form>`
      : '',
    v.hasAccess
      ? `<form class="orman-maintenance__unlock" method="post" action="${escapeHtml(v.unlock)}" data-orman-json data-orman-reload><label>${escapeHtml(v.labels.password)} <input type="password" name="password" required autocomplete="off"></label> <button type="submit">${escapeHtml(v.labels.unlock)}</button><p class="orman-maintenance__status" role="status"></p></form>`
      : '',
  ].filter(Boolean)
  const script = v.collectEmails || v.hasAccess ? `<script>${INLINE_SCRIPT.replace('__CSRF__', JSON.stringify(options.csrfUrl ?? '/!/csrf-token'))}</script>` : ''
  return `<!doctype html><html lang="${escapeHtml(lang)}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${escapeHtml(v.title)}</title>${options.head ?? ''}</head><body><main class="orman-maintenance">${parts.join('')}</main>${script}</body></html>`
}

// Posts a form as JSON with a fresh CSRF token and shows the answer (or the first field error) next to it.
const INLINE_SCRIPT = `document.querySelectorAll('form[data-orman-json]').forEach(function(f){f.addEventListener('submit',function(e){e.preventDefault();var s=f.querySelector('[role=status]'),b=f.querySelector('button');b.disabled=true;s.textContent='';fetch(__CSRF__,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}}).then(function(r){return r.json()}).then(function(t){var d={};new FormData(f).forEach(function(v,k){d[k]=v});return fetch(f.action,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json','X-CSRF-TOKEN':t.csrf_token},body:JSON.stringify(d)})}).then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(r.ok){if(f.hasAttribute('data-orman-reload'))return location.reload();s.textContent='\\u2713';f.reset()}else{var m=j&&j.errors&&Object.values(j.errors)[0];s.textContent=(m&&m[0])||j.message||'Error'}})}).catch(function(){s.textContent='Error'}).then(function(){b.disabled=false})})})`
