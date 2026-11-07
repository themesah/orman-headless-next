import * as react from 'react';
import { ApiOptions } from './csrf.js';

interface InboxLabels {
    title: string;
    empty: string;
    seen: string;
    accept: string;
    snooze: string;
    dismiss: string;
    signedOut: string;
}
declare const DEFAULT_INBOX_LABELS: InboxLabels;
interface InboxProps {
    /** `addons.notifications.inbox`. Default `/!/notifications/inbox`. */
    base?: string;
    labels?: Partial<InboxLabels>;
    api?: ApiOptions;
    /** Snooze length in minutes. Default 1440 (a day). */
    snoozeMinutes?: number;
    /** Follow the live stream (falls back to polling). Default true. */
    live?: boolean;
    onSignedOut?: () => void;
    className?: string;
}
/**
 * The person's notifications: seen, accept (when required), snooze, dismiss. Updates arrive over the Mercure stream when the
 * site has one reachable, otherwise by polling. Per-user, never cached. Class hooks: `orman-inbox`, `__item` (`data-level`,
 * `data-status`), `__title|__body|__action|__button`, `__empty`.
 */
declare function Inbox({ base, labels, api: apiOptions, snoozeMinutes, live, onSignedOut, className }: InboxProps): react.JSX.Element;

export { DEFAULT_INBOX_LABELS, Inbox, type InboxLabels, type InboxProps };
