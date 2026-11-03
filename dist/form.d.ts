import * as react from 'react';
import { ReactNode } from 'react';
import { ApiResult, ApiOptions } from './csrf.js';

interface FormState {
    pending: boolean;
    /** A message not tied to a field (network, 429, 419, a 422 without field errors). */
    message: string | null;
    /** Per-field messages from a 422 `errors` body. */
    errors: Record<string, string[]>;
    /** True after a successful submit until the next one. */
    done: boolean;
}
/** The form's current state, for a child that renders its own pieces (a submit button that disables while pending). */
declare function useFormState(): FormState;
interface FormProps extends Omit<React.ComponentPropsWithoutRef<'form'>, 'action' | 'method' | 'onSubmit' | 'children' | 'onError'> {
    /** Where to post: an addon action's `/!/…` URL (a twin such as `/!/forms/contact`), same origin through the proxy. */
    action: string;
    method?: 'POST' | 'DELETE';
    /** Send JSON instead of multipart. Multipart (the default) is what a file input needs. */
    json?: boolean;
    /**
     * Last look at the data before it is sent, e.g. a captcha widget adding its token. Return a replacement or nothing; throw to
     * stop (the message shows as the form's message).
     */
    prepare?: (data: FormData) => FormData | void | Promise<FormData | void>;
    onSuccess?: (result: Extract<ApiResult, {
        ok: true;
    }>) => void;
    onError?: (result: Extract<ApiResult, {
        ok: false;
    }>) => void;
    /** Wording for the failures the kit words itself, and the CSRF URL. */
    api?: ApiOptions;
    /** The form body, or a function of the state. */
    children: ReactNode | ((state: FormState) => ReactNode);
}
/**
 * Posts to an addon action with the CSRF token, and shows JSON errors per field. Unstyled; class hooks:
 * `orman-form` (+ `orman-form--pending`, `orman-form--done`), `orman-form__message` (role="alert"), `orman-form__error` (per field,
 * `data-field`). Put `<FieldError name="email" />` next to an input, or read `useFormState()`.
 */
declare function Form({ action, method, json, prepare, onSuccess, onError, api: apiOptions, children, className, ...rest }: FormProps): react.JSX.Element;
/** The messages for one field of the enclosing {@link Form}; renders nothing when there are none. */
declare function FieldError({ name, className }: {
    name: string;
    className?: string;
}): react.JSX.Element | null;

export { FieldError, Form, type FormProps, type FormState, useFormState };
