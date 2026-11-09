import * as react from 'react';
import { FormFieldsProps } from '@orman/headless-next/form-fields';
import { TrackingCodeSite, FormSchema, SiteResponse } from './types.js';

interface CodeCheckProps {
    /** `addons.tracking_code` of the cached `/site`. */
    tracking: TrackingCodeSite;
    /** `data` of `client.form(tracking.form)`: the code field, the customer's details, the honeypot and the captcha. */
    schema: FormSchema;
    /** The cached `/site`, for the form's captcha. */
    site?: Pick<SiteResponse, 'addons'>;
    captcha?: FormFieldsProps['captcha'];
    submitLabel?: string;
}
/**
 * The "check your product" form of the Tracking-Code addon: the form's own fields, posted to the addon's redeem action. A valid code is
 * used up by the check, so the answer (`message`) is shown once and never cached. Unstyled; class hooks `orman-codecheck`,
 * `orman-codecheck__submit`, `orman-codecheck__result` (role="status"), plus the form's own (`orman-form__error`).
 */
declare function CodeCheck({ tracking, schema, site, captcha, submitLabel }: CodeCheckProps): react.JSX.Element;

export { CodeCheck, type CodeCheckProps };
