import { useEffect, useRef } from 'react'
import { api } from '../csrf'
import type { RedirectSite, SiteResponse } from '../types'

export interface NotFoundBeaconProps {
  /** The cached `/site`: with it, nothing is sent while the Redirect addon is off or its error log is disabled. Without it the beacon always sends. */
  site?: Pick<SiteResponse, 'addons'>
  /** Where to report. Default `/!/redirect/not-found`, or `addons.redirect.not_found` when `site` is given. */
  action?: string
}

/**
 * Tells the Redirect addon that a visitor reached the frontend's 404 page, so it shows in the CP's "errors" list with the visitor's address
 * (through the proxy, only via the edge secret), user agent and referrer, as a 404 on an Orman page does. Put it in `app/not-found.tsx`.
 *
 * It runs in the browser on purpose: the not-found page is cached like any page, so a call made while rendering it would count the first
 * visitor only. Once per visit (Strict Mode's second effect sends nothing more). Orman checks that the path really is missing, so a made-up
 * path cannot fill the list. Renders nothing; a failure is silent.
 */
export function NotFoundBeacon({ site, action }: NotFoundBeaconProps) {
  const sent = useRef(false)
  const redirect = site?.addons.redirect as RedirectSite | undefined
  const off = site !== undefined && (redirect === undefined || redirect.log_errors === false)

  useEffect(() => {
    if (off || sent.current) return
    sent.current = true
    const { pathname, search } = window.location
    void api('POST', action ?? redirect?.not_found ?? '/!/redirect/not-found', { path: pathname + search, referrer: document.referrer || undefined })
  }, [off, action, redirect?.not_found])

  return null
}
