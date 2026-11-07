import * as react from 'react';
import { ApiOptions } from './csrf.js';

interface TwoFactorLabels {
    title: string;
    on: string;
    off: string;
    enable: string;
    scan: string;
    secret: string;
    code: string;
    confirm: string;
    disable: string;
    password: string;
    recovery: string;
    show: string;
    renew: string;
    download: string;
    signedOut: string;
    required: string;
    codesIntro: string;
}
declare const DEFAULT_TWO_FACTOR_LABELS: TwoFactorLabels;
interface TwoFactorProps {
    /** Base of the account endpoints. Default `/!/account/two-factor`. */
    base?: string;
    /** Where the password confirmation lives. Default `/!/account/confirm-password`. */
    confirmPassword?: string;
    labels?: Partial<TwoFactorLabels>;
    api?: ApiOptions;
    /** A 401 from any call: the person is signed out (or the session was revoked). */
    onSignedOut?: () => void;
    className?: string;
}
/** The browser builds the recovery-codes file; nothing is sent anywhere. */
declare function recoveryCodesFile(codes: string[], title?: string): Blob;
/**
 * The account's two-step sign-in: status, turn on (QR + confirm code), turn off (password), recovery codes (show, renew,
 * download as .txt). Per-user, never cached. A 403 `{needs:'password'}` asks for the password once, then retries.
 * Class hooks: `orman-two-factor`, `__status|__qr|__secret|__field|__button|__codes|__error`.
 */
declare function TwoFactor({ base, confirmPassword, labels, api: apiOptions, onSignedOut, className }: TwoFactorProps): react.JSX.Element;

export { DEFAULT_TWO_FACTOR_LABELS, TwoFactor, type TwoFactorLabels, type TwoFactorProps, recoveryCodesFile };
