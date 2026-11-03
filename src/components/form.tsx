import { createContext, useContext, useId, useState, type FormEvent, type ReactNode } from 'react'
import { api, type ApiOptions, type ApiResult } from '../csrf'

export interface FormState {
  pending: boolean
  /** A message not tied to a field (network, 429, 419, a 422 without field errors). */
  message: string | null
  /** Per-field messages from a 422 `errors` body. */
  errors: Record<string, string[]>
  /** True after a successful submit until the next one. */
  done: boolean
}

const EMPTY: FormState = { pending: false, message: null, errors: {}, done: false }
const FormContext = createContext<FormState>(EMPTY)

/** The form's current state, for a child that renders its own pieces (a submit button that disables while pending). */
export function useFormState(): FormState {
  return useContext(FormContext)
}

export interface FormProps extends Omit<React.ComponentPropsWithoutRef<'form'>, 'action' | 'method' | 'onSubmit' | 'children' | 'onError'> {
  /** Where to post: an addon action's `/!/…` URL (a twin such as `/!/forms/contact`), same origin through the proxy. */
  action: string
  method?: 'POST' | 'DELETE'
  /** Send JSON instead of multipart. Multipart (the default) is what a file input needs. */
  json?: boolean
  /**
   * Last look at the data before it is sent, e.g. a captcha widget adding its token. Return a replacement or nothing; throw to
   * stop (the message shows as the form's message).
   */
  prepare?: (data: FormData) => FormData | void | Promise<FormData | void>
  onSuccess?: (result: Extract<ApiResult, { ok: true }>) => void
  onError?: (result: Extract<ApiResult, { ok: false }>) => void
  /** Wording for the failures the kit words itself, and the CSRF URL. */
  api?: ApiOptions
  /** The form body, or a function of the state. */
  children: ReactNode | ((state: FormState) => ReactNode)
}

/**
 * Posts to an addon action with the CSRF token, and shows JSON errors per field. Unstyled; class hooks:
 * `orman-form` (+ `orman-form--pending`, `orman-form--done`), `orman-form__message` (role="alert"), `orman-form__error` (per field,
 * `data-field`). Put `<FieldError name="email" />` next to an input, or read `useFormState()`.
 */
export function Form({ action, method = 'POST', json = false, prepare, onSuccess, onError, api: apiOptions, children, className, ...rest }: FormProps) {
  const [state, setState] = useState<FormState>(EMPTY)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (state.pending) return
    setState({ pending: true, message: null, errors: {}, done: false })
    let data = new FormData(event.currentTarget)
    try {
      data = (await prepare?.(data)) ?? data
    } catch (error) {
      setState({ pending: false, message: error instanceof Error ? error.message : String(error), errors: {}, done: false })
      return
    }
    const payload = json ? formDataToJson(data) : data
    const result = await api(method, action, payload, apiOptions)
    if (result.ok) {
      setState({ pending: false, message: null, errors: {}, done: true })
      onSuccess?.(result)
    } else {
      // A 422's field messages are shown at their fields; the general message only when there are none.
      setState({ pending: false, message: result.errors ? null : result.message, errors: result.errors ?? {}, done: false })
      onError?.(result)
    }
  }

  const classes = ['orman-form', state.pending && 'orman-form--pending', state.done && 'orman-form--done', className].filter(Boolean).join(' ')
  return (
    <FormContext.Provider value={state}>
      <form {...rest} className={classes} method="post" action={action} onSubmit={submit} aria-busy={state.pending || undefined}>
        {typeof children === 'function' ? children(state) : children}
        {state.message ? (
          <p className="orman-form__message" role="alert">
            {state.message}
          </p>
        ) : null}
      </form>
    </FormContext.Provider>
  )
}

/** FormData as a JSON object; a name that repeats (checkboxes, a multi-select) becomes an array instead of keeping only its last value. */
function formDataToJson(data: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of data.entries()) {
    if (!(key in out)) out[key] = value
    else out[key] = ([] as unknown[]).concat(out[key], value)
  }
  return out
}

/** The messages for one field of the enclosing {@link Form}; renders nothing when there are none. */
export function FieldError({ name, className }: { name: string; className?: string }) {
  const id = useId()
  const messages = useContext(FormContext).errors[name]
  if (!messages?.length) return null
  return (
    <span id={`${id}-${name}`} className={['orman-form__error', className].filter(Boolean).join(' ')} data-field={name} role="alert">
      {messages.join(' ')}
    </span>
  )
}
