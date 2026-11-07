import { ApiOptions } from './csrf.js';

interface StreamOptions {
    /** `addons.notifications.inbox` + `/stream`. Default `/!/notifications/inbox/stream`. */
    url?: string;
    api?: ApiOptions;
    /** Called for every pushed update (parsed JSON; `{}` when the data is not JSON). */
    onEvent: (event: Record<string, unknown>) => void;
    /** Called on every poll tick while the hub is unreachable (or the site has none). */
    onPoll: () => void;
    /** A 401 while asking for the token: the person is signed out. */
    onSignedOut?: () => void;
    /** Test seam. */
    fetchImpl?: typeof fetch;
}
/**
 * Follows the person's own Mercure topic. The token comes from Orman (`/!/…/stream`, 15 minutes, subscribe to this topic only) and
 * goes in an Authorization header (fetch-based SSE), never in a URL. The browser talks to the hub directly, not through the proxy.
 * Before the token runs out it asks for a new one and reconnects; when the hub cannot be reached, or the site has none, it polls
 * instead (`onPoll` every `poll_seconds`). Returns a stop function.
 */
declare function followStream(options: StreamOptions): () => void;

export { type StreamOptions, followStream };
