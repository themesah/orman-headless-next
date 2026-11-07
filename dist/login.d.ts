import * as react from 'react';
import { ReactNode } from 'react';
import { ApiOptions } from './csrf.js';

interface LoginLabels {
    email: string;
    password: string;
    remember: string;
    submit: string;
    code: string;
    recoveryCode: string;
    useRecovery: string;
    useCode: string;
    verify: string;
    waiting: string;
    waitingHint: string;
    cancel: string;
    denied: string;
    expired: string;
}
declare const DEFAULT_LOGIN_LABELS: LoginLabels;
interface LoginProps {
    /** Step 1. Default `/!/auth/json/login`; `addons.account.login` of /site. */
    action?: string;
    /** Step 2 (code or recovery code). Default `/!/account/two-factor/challenge`; `addons.account.challenge`. */
    challenge?: string;
    /** Where the approval wait is followed (`status` and `cancel` live under it). Default `/!/sessions/awaiting`. */
    awaiting?: string;
    /** Called once the person is signed in. Reload or navigate here: the session cookie is set. */
    onSignedIn?: () => void;
    labels?: Partial<LoginLabels>;
    api?: ApiOptions;
    /** How often the approval is looked up (ms). A pushed `sessions.changed` event may call `refreshRef` earlier. Default 3000. */
    pollMs?: number;
    /** Extra form pieces for the credentials step, e.g. `<Captcha>`. */
    children?: ReactNode;
    className?: string;
}
/**
 * Renders whatever step Orman asks for: credentials → (code or recovery code) → (waiting for another device to approve) → signed in.
 * The half-done login stays in Orman's session; the kit only follows the answers (`needs: 'two_factor' | 'approval' | null`).
 * Class hooks: `orman-login`, `orman-login__step` (`data-step`), `orman-login__field`, `orman-login__submit|switch|cancel|status`.
 */
declare function Login({ action, challenge, awaiting, onSignedIn, labels, api: apiOptions, pollMs, children, className }: LoginProps): react.JSX.Element;

export { DEFAULT_LOGIN_LABELS, Login, type LoginLabels, type LoginProps };
