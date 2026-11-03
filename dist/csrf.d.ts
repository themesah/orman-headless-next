/**
 * Browser side of Orman's `/!/` routes, which are session-cookie + CSRF based: every non-GET fetches a fresh token first
 * (`/!/csrf-token`, header `X-CSRF-TOKEN`). The page is statically cached, so there is no token in the HTML worth trusting.
 */
interface Messages {
    network: string;
    tooManyAttempts: string;
    sessionExpired: string;
    signInRequired: string;
}
declare const DEFAULT_MESSAGES: Messages;
type ApiResult<T = unknown> = {
    ok: true;
    status: number;
    body: T;
} | {
    ok: false;
    status: number;
    message: string;
    /** Per-field validation messages when the answer was a 422 with `errors: { field: [..] }`. */
    errors?: Record<string, string[]>;
};
interface ApiOptions {
    /** The text for each failure the kit words itself; defaults to English. */
    messages?: Partial<Messages>;
    /** Where the token comes from. Default `/!/csrf-token`. */
    csrfUrl?: string;
}
declare function csrfToken(csrfUrl?: string): Promise<string>;
/** First human-readable message in a Laravel / Orman error body. */
declare function errorMessage(status: number, body: unknown, messages?: Partial<Messages>): string;
/**
 * JSON in, JSON out. `data` as FormData is sent as multipart. Never throws: a transport failure is an ordinary `{ ok: false }`.
 */
declare function api<T = unknown>(method: 'GET' | 'POST' | 'DELETE', url: string, data?: Record<string, unknown> | FormData, options?: ApiOptions): Promise<ApiResult<T>>;

export { type ApiOptions, type ApiResult, DEFAULT_MESSAGES, type Messages, api, csrfToken, errorMessage };
