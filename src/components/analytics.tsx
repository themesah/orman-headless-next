import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import type { AnalitikaSite } from '../types'

export interface PageViewProps {
  /** `addons.analitika` of the cached `/site`. Absent (the addon is off, or views are not counted) renders and sends nothing. */
  site: AnalitikaSite | undefined
  /** The entry's id (`page.data.id`), so the dashboard can name the page. */
  entryId?: string
  /** The path to count. Default: the current address. */
  path?: string
  /** Do not count visitors whose browser says Do Not Track / Global Privacy Control. Default true: the addon stores no cookie and no address, so this is a courtesy, not a requirement. */
  respectDnt?: boolean
}

/** The request that counts one view, or null when the browser asks not to be counted. Exported for the tests. */
export function hitUrl(site: AnalitikaSite, input: { path: string; entryId?: string; referrer?: string; host?: string }): string {
  const params = new URLSearchParams()
  if (input.entryId) params.set('e', input.entryId)
  params.set('p', input.path)
  const from = referrerHost(input.referrer, input.host)
  if (from) params.set('r', from)
  return `${site.hit}?${params.toString()}`
}

/** Host of the page the visitor came from; nothing for a direct visit or a link from the site itself. */
export function referrerHost(referrer: string | undefined, ownHost: string | undefined): string | undefined {
  if (!referrer) return undefined
  try {
    const host = new URL(referrer).host
    return host && host !== ownHost ? host : undefined
  } catch {
    return undefined
  }
}

function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string }
  return nav.doNotTrack === '1' || nav.msDoNotTrack === '1' || nav.globalPrivacyControl === true
}

/**
 * Counts one page view in the Analitika addon, from the visitor's browser: the same pixel `{{ analitika:pixel }}` prints on Blade pages
 * (`GET /!/analitika/hit`), so the addon filters bots by user agent as ever, and, through the proxy, sees the visitor's own address
 * only via the edge secret. Put it in a page's template (once per page), not in the layout, so a page that is not an entry is not counted.
 * A page is counted once per path: re-renders, Strict Mode's second effect and a navigation to the same path send nothing more.
 * No cookie is sent or stored (`credentials: 'omit'`); the answer is `no-store`. Renders nothing.
 */
export function PageView({ site, entryId, path, respectDnt = true }: PageViewProps) {
  const pathname = usePathname()
  const sent = useRef<string | null>(null)
  const counted = site?.track_pageviews === true

  useEffect(() => {
    if (!counted || !site) return
    const target = path ?? pathname ?? window.location.pathname
    if (sent.current === target) return
    sent.current = target
    if (respectDnt && optedOut()) return
    const url = hitUrl(site, { path: target, entryId, referrer: document.referrer, host: window.location.host })
    // Analytics never breaks a page: a failed request is simply a view not counted.
    void fetch(url, { method: 'GET', credentials: 'omit', cache: 'no-store', keepalive: true }).catch(() => {})
  }, [counted, site, entryId, path, pathname, respectDnt])

  return null
}
