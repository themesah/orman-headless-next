import * as react from 'react';
import { ApiOptions } from './csrf.js';

interface SessionsLabels {
    pending: string;
    approve: string;
    deny: string;
    active: string;
    history: string;
    current: string;
    revoke: string;
    revokeOthers: string;
    rule: string;
    save: string;
    password: string;
    code: string;
    confirm: string;
    signedOut: string;
}
declare const DEFAULT_SESSIONS_LABELS: SessionsLabels;
interface SessionsProps {
    /** `addons.sessions.account`. Default `/!/sessions/account`. */
    account?: string;
    /** Password confirmation. Default `/!/account/confirm-password`. */
    confirmPassword?: string;
    /** Stream URL used to learn of waiting sign-ins at once. Default `/!/notifications/inbox/stream`; pass `false` to poll only. */
    stream?: string | false;
    /** Poll every this many ms when no stream. Default 15000. */
    pollMs?: number;
    labels?: Partial<SessionsLabels>;
    api?: ApiOptions;
    onSignedOut?: () => void;
    className?: string;
}
/**
 * Login history, active sessions (device, place, last seen, this one), sign out one or all others, approve or deny waiting
 * sign-ins, and the person's own rule when the roles allow it (read-only with the reason otherwise). Per-user, never cached;
 * a 401 means signed out. Class hooks: `orman-sessions`, `__pending|__active|__history|__row|__button|__rule|__locked|__error`.
 */
declare function Sessions({ account, confirmPassword, stream, pollMs, labels, api: apiOptions, onSignedOut, className }: SessionsProps): react.JSX.Element;

export { DEFAULT_SESSIONS_LABELS, Sessions, type SessionsLabels, type SessionsProps };
