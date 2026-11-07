import { api, type ApiOptions, type ApiResult } from '../csrf'

type Method = 'GET' | 'POST' | 'DELETE'

/**
 * `api()` for the per-user endpoints. A 401 is Orman saying "no session": never signed in, signed out elsewhere, or the session was
 * revoked / ended by the Sessions rules. The component then calls `onSignedOut` (clear what it shows, offer the login) instead of
 * rendering an error. Nothing per-user is ever cached by the kit: every call is `no-store`.
 */
export function callAccount(onSignedOut: (() => void) | undefined, options?: ApiOptions) {
  return async function call<T>(method: Method, url: string, data?: Record<string, unknown>): Promise<ApiResult<T>> {
    const result = await api<T>(method, url, data, options)
    if (!result.ok && result.status === 401) onSignedOut?.()
    return result
  }
}

/** The first message of a failed call. */
export function failure(result: ApiResult<unknown>): string {
  return result.ok ? '' : (result.errors && Object.values(result.errors)[0]?.[0]) || result.message
}
