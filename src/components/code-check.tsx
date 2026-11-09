import { useState } from 'react'
import { Form, useFormState } from '@orman/headless-next/form'
import { FormFields, type FormFieldsProps } from '@orman/headless-next/form-fields'
import type { FormSchema, SiteResponse, TrackingCodeSite } from '../types'

export interface CodeCheckProps {
  /** `addons.tracking_code` of the cached `/site`. */
  tracking: TrackingCodeSite
  /** `data` of `client.form(tracking.form)`: the code field, the customer's details, the honeypot and the captcha. */
  schema: FormSchema
  /** The cached `/site`, for the form's captcha. */
  site?: Pick<SiteResponse, 'addons'>
  captcha?: FormFieldsProps['captcha']
  submitLabel?: string
}

function Submit({ label }: { label: string }) {
  const { pending } = useFormState()
  return (
    <button type="submit" disabled={pending} className="orman-codecheck__submit">
      {label}
    </button>
  )
}

/**
 * The "check your product" form of the Tracking-Code addon: the form's own fields, posted to the addon's redeem action. A valid code is
 * used up by the check, so the answer (`message`) is shown once and never cached. Unstyled; class hooks `orman-codecheck`,
 * `orman-codecheck__submit`, `orman-codecheck__result` (role="status"), plus the form's own (`orman-form__error`).
 */
export function CodeCheck({ tracking, schema, site, captcha, submitLabel = 'Check' }: CodeCheckProps) {
  const [result, setResult] = useState<string | null>(null)

  return (
    <Form
      action={tracking.redeem}
      className="orman-codecheck"
      onSuccess={res => setResult((res.body as { message?: string } | null)?.message ?? null)}
      onError={() => setResult(null)}
    >
      <FormFields schema={schema} site={site} captcha={captcha} />
      <Submit label={submitLabel} />
      {result ? (
        <p role="status" className="orman-codecheck__result">
          {result}
        </p>
      ) : null}
    </Form>
  )
}
