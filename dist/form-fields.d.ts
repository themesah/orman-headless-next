import * as react from 'react';
import { ReactNode } from 'react';
import { FormSchema, SiteResponse, FormFieldSchema } from './types.js';
import { CaptchaProps } from '@orman/headless-next/captcha';

interface FormFieldsProps {
    /** `data` of `client.form(handle)`. */
    schema: FormSchema;
    /** With the cached `/site`, the form's captcha is rendered after the fields. Omit it to place `<Captcha>` yourself. */
    site?: Pick<SiteResponse, 'addons'>;
    captcha?: Pick<CaptchaProps, 'labels' | 'theme'>;
    /** Replace the control of one field (by handle); the label, instructions and error stay. */
    render?: Record<string, (field: FormFieldSchema, props: {
        id: string;
        name: string;
    }) => ReactNode>;
}
/**
 * Renders a form's schema inside a {@link Form}, unstyled: a label, the control, the instructions and the field's error for each
 * field, the honeypot, and (with `site`) the captcha. Class hooks: `orman-field`, `orman-field--<type>`, `__label`, `__instructions`,
 * `__control`, `orman-form__trap`. Anything it does not know renders as a text input; write your own inputs for a field it should
 * not render (use `render`).
 */
declare function FormFields({ schema, site, captcha, render }: FormFieldsProps): react.JSX.Element;
/** The trap field bots fill in. Off-screen rather than `display: none`, which some bots skip; keyboard and screen readers pass over it. */
declare function Honeypot({ name }: {
    name: string;
}): react.JSX.Element;

export { FormFields, type FormFieldsProps, Honeypot };
