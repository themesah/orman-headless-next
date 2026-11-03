import * as react from 'react';
import { FormCaptcha, SiteResponse } from './types.js';

interface CaptchaLabels {
    /** Turnstile: the message when the form is sent before the check ran. */
    required: string;
    /** Kaptcha: the input's accessible name, the refresh button, and the image's alt text. */
    answer: string;
    refresh: string;
    image: string;
}
declare const DEFAULT_CAPTCHA_LABELS: CaptchaLabels;
interface CaptchaProps {
    /** `data.captcha` of the form's schema; `null` renders nothing. */
    captcha: FormCaptcha | null | undefined;
    /** The cached `/site` answer: the addons' public config comes from here. */
    site: Pick<SiteResponse, 'addons'>;
    labels?: Partial<CaptchaLabels>;
    /** Turnstile theme: auto (default), light or dark. */
    theme?: 'auto' | 'light' | 'dark';
    className?: string;
}
/**
 * The captcha a form asks for, inside a {@link Form}: the Turnstile widget, or a Kaptcha challenge (image, refresh, answer box).
 * It adds the field names the Blade forms post (`cf-turnstile-response`; `kaptcha` + `kaptcha_token`) so the server side does not
 * change, and asks for a fresh token or image after every attempt. Client-only: a challenge is one visitor's, never rendered on
 * the server. Class hooks: `orman-captcha`, `orman-captcha--turnstile|kaptcha`, `orman-captcha__image|refresh|input`.
 */
declare function Captcha({ captcha, site, labels, theme, className }: CaptchaProps): react.JSX.Element | null;
type TurnstileApi = {
    render: (el: HTMLElement, options: Record<string, unknown>) => string;
    getResponse: (id?: string) => string | undefined;
    reset: (id?: string) => void;
    remove: (id?: string) => void;
};
/** Loads Cloudflare's script once per address and resolves with `window.turnstile` (explicit rendering). */
declare function loadTurnstile(script: string): Promise<TurnstileApi>;

export { Captcha, type CaptchaLabels, type CaptchaProps, DEFAULT_CAPTCHA_LABELS, loadTurnstile };
