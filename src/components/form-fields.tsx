import { useId, type ReactNode } from 'react'
import type { FormFieldSchema, FormSchema, SiteResponse } from '../types'
import { Captcha, type CaptchaProps } from '@orman/headless-next/captcha'
import { FieldError } from '@orman/headless-next/form'

export interface FormFieldsProps {
  /** `data` of `client.form(handle)`. */
  schema: FormSchema
  /** With the cached `/site`, the form's captcha is rendered after the fields. Omit it to place `<Captcha>` yourself. */
  site?: Pick<SiteResponse, 'addons'>
  captcha?: Pick<CaptchaProps, 'labels' | 'theme'>
  /** Replace the control of one field (by handle); the label, instructions and error stay. */
  render?: Record<string, (field: FormFieldSchema, props: { id: string; name: string }) => ReactNode>
}

/**
 * Renders a form's schema inside a {@link Form}, unstyled: a label, the control, the instructions and the field's error for each
 * field, the honeypot, and (with `site`) the captcha. Class hooks: `orman-field`, `orman-field--<type>`, `__label`, `__instructions`,
 * `__control`, `orman-form__trap`. Anything it does not know renders as a text input; write your own inputs for a field it should
 * not render (use `render`).
 */
export function FormFields({ schema, site, captcha, render }: FormFieldsProps) {
  return (
    <>
      {schema.fields.map(field => (
        <Field key={field.handle} field={field} render={render?.[field.handle]} />
      ))}
      {schema.honeypot ? <Honeypot name={schema.honeypot} /> : null}
      {site ? <Captcha captcha={schema.captcha} site={site} {...captcha} /> : null}
    </>
  )
}

/** The trap field bots fill in. Off-screen rather than `display: none`, which some bots skip; keyboard and screen readers pass over it. */
export function Honeypot({ name }: { name: string }) {
  return (
    <div className="orman-form__trap" aria-hidden="true" style={{ position: 'absolute', left: '-10000px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
      <input type="text" name={name} tabIndex={-1} autoComplete="off" defaultValue="" />
    </div>
  )
}

function Field({ field, render }: { field: FormFieldSchema; render?: NonNullable<FormFieldsProps['render']>[string] }) {
  const id = useId()
  const props = { id, name: field.handle }
  const bare = field.type === 'hidden'
  const control = render ? render(field, props) : <Control field={field} id={id} />

  if (bare) return <>{control}</>

  const grouped = field.type === 'radio' || field.type === 'checkboxes'
  const label = (
    <>
      {field.display}
      {field.required ? <span aria-hidden="true"> *</span> : null}
    </>
  )

  return (
    <div className={`orman-field orman-field--${field.type}`} data-field={field.handle}>
      {grouped ? (
        <fieldset>
          <legend className="orman-field__label">{label}</legend>
          {field.instructions ? <p className="orman-field__instructions">{field.instructions}</p> : null}
          {control}
        </fieldset>
      ) : (
        <>
          <label className="orman-field__label" htmlFor={id}>
            {label}
          </label>
          {field.instructions ? <p className="orman-field__instructions">{field.instructions}</p> : null}
          {control}
        </>
      )}
      <FieldError name={field.handle} />
    </div>
  )
}

function Control({ field, id }: { field: FormFieldSchema; id: string }) {
  const name = field.handle
  const common = { id, name, required: field.required || undefined, className: 'orman-field__control' }
  const placeholder = field.placeholder || undefined
  const initial = field.default === null || field.default === undefined ? undefined : String(field.default)

  switch (field.type) {
    case 'hidden':
      return <input type="hidden" name={name} defaultValue={initial ?? ''} />
    case 'textarea':
      return <textarea {...common} placeholder={placeholder} rows={field.rows} maxLength={field.character_limit} defaultValue={initial} />
    case 'select':
      return (
        <select {...common} multiple={field.multiple} name={field.multiple ? `${name}[]` : name} defaultValue={field.multiple ? undefined : (initial ?? '')}>
          {field.multiple ? null : <option value="">{placeholder ?? ''}</option>}
          {(field.options ?? []).map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )
    case 'radio':
      return (
        <>
          {(field.options ?? []).map(option => (
            <label key={option.value} className="orman-field__option">
              <input type="radio" name={name} value={option.value} required={field.required || undefined} defaultChecked={initial === option.value} /> {option.label}
            </label>
          ))}
        </>
      )
    case 'checkboxes':
      return (
        <>
          {(field.options ?? []).map(option => (
            <label key={option.value} className="orman-field__option">
              <input type="checkbox" name={`${name}[]`} value={option.value} /> {option.label}
            </label>
          ))}
        </>
      )
    case 'toggle':
    case 'checkbox':
      return (
        <>
          <input type="hidden" name={name} value="0" />
          <input id={id} className="orman-field__control" type="checkbox" name={name} value="1" required={field.required || undefined} defaultChecked={initial === '1' || initial === 'true'} />
        </>
      )
    case 'integer':
    case 'float':
    case 'range':
      return <input {...common} type="number" min={field.min} max={field.max} step={field.step ?? (field.type === 'integer' ? 1 : 'any')} placeholder={placeholder} defaultValue={initial} />
    case 'date':
      return <input {...common} type="date" defaultValue={initial} />
    case 'assets':
    case 'files': {
      const multiple = (field.max_files ?? 1) > 1
      return <input {...common} type="file" multiple={multiple} name={multiple ? `${name}[]` : name} />
    }
    default:
      return <input {...common} type={field.input_type || 'text'} placeholder={placeholder} maxLength={field.character_limit} defaultValue={initial} />
  }
}
