import { ApiOptions, ApiResult } from './csrf.js';

type Method = 'GET' | 'POST' | 'DELETE';
/**
 * `api()` for the per-user endpoints. A 401 is Orman saying "no session": never signed in, signed out elsewhere, or the session was
 * revoked / ended by the Sessions rules. The component then calls `onSignedOut` (clear what it shows, offer the login) instead of
 * rendering an error. Nothing per-user is ever cached by the kit: every call is `no-store`.
 */
declare function callAccount(onSignedOut: (() => void) | undefined, options?: ApiOptions): <T>(method: Method, url: string, data?: Record<string, unknown>) => Promise<ApiResult<T>>;
/** The first message of a failed call. */
declare function failure(result: ApiResult<unknown>): string;

export { callAccount, failure };
