"use client";
// src/components/form.tsx
import { createContext, useContext, useId, useState } from "react";

// src/csrf.ts
var DEFAULT_MESSAGES = {
  network: "Network error; please try again.",
  tooManyAttempts: "Too many attempts; try again in a few minutes.",
  sessionExpired: "Your session expired; reload the page and try again.",
  signInRequired: "Sign in to continue."
};
async function csrfToken(csrfUrl = "/!/csrf-token") {
  const res = await fetch(csrfUrl, {
    credentials: "same-origin",
    cache: "no-store",
    headers: { Accept: "application/json" }
  });
  if (!res.ok) throw new Error(`csrf-token ${res.status}`);
  return (await res.json()).csrf_token;
}
function errorMessage(status, body, messages = {}) {
  const m = { ...DEFAULT_MESSAGES, ...messages };
  const b = body;
  if (status === 429) return m.tooManyAttempts;
  if (status === 419) return m.sessionExpired;
  if (status === 401) return m.signInRequired;
  const errors = b?.errors;
  if (Array.isArray(errors) && errors[0]) return errors[0];
  if (errors && !Array.isArray(errors)) {
    const first = Object.values(errors)[0]?.[0];
    if (first) return first;
  }
  const flat = b?.error && Object.values(b.error)[0];
  if (flat) return flat;
  return b?.message && status < 500 ? b.message : m.network;
}
function fieldErrors(body) {
  const errors = body?.errors;
  if (!errors || Array.isArray(errors) || typeof errors !== "object") return void 0;
  const out = {};
  for (const [key, value] of Object.entries(errors)) {
    if (Array.isArray(value)) out[key] = value.filter((v) => typeof v === "string");
  }
  return Object.keys(out).length ? out : void 0;
}
function withQuery(url, data) {
  const params = new URLSearchParams();
  const entries = data instanceof FormData ? [...data.entries()] : Object.entries(data);
  for (const [key, value] of entries) {
    if (value === void 0 || value === null || value instanceof Blob) continue;
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}${url.includes("?") ? "&" : "?"}${qs}` : url;
}
async function api(method, url, data, options = {}) {
  const messages = options.messages;
  try {
    const headers = { Accept: "application/json" };
    let body;
    if (method === "GET") {
      if (data) url = withQuery(url, data);
    } else {
      headers["X-CSRF-TOKEN"] = await csrfToken(options.csrfUrl);
    }
    if (method === "GET") {
    } else if (data instanceof FormData) {
      body = data;
    } else if (data) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(data);
    }
    const res = await fetch(url, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers,
      body
    });
    const text = await res.text();
    let parsed = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = text;
    }
    if (res.ok) return { ok: true, status: res.status, body: parsed };
    const errors = fieldErrors(parsed);
    return { ok: false, status: res.status, message: errorMessage(res.status, parsed, messages), ...errors ? { errors } : {} };
  } catch {
    return { ok: false, status: 0, message: { ...DEFAULT_MESSAGES, ...messages }.network };
  }
}

// src/components/form.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var EMPTY = { pending: false, message: null, errors: {}, done: false };
var FormContext = createContext(EMPTY);
function useFormState() {
  return useContext(FormContext);
}
function Form({ action, method = "POST", json = false, prepare, onSuccess, onError, api: apiOptions, children, className, ...rest }) {
  const [state, setState] = useState(EMPTY);
  async function submit(event) {
    event.preventDefault();
    if (state.pending) return;
    setState({ pending: true, message: null, errors: {}, done: false });
    let data = new FormData(event.currentTarget);
    try {
      data = await prepare?.(data) ?? data;
    } catch (error) {
      setState({ pending: false, message: error instanceof Error ? error.message : String(error), errors: {}, done: false });
      return;
    }
    const payload = json ? formDataToJson(data) : data;
    const result = await api(method, action, payload, apiOptions);
    if (result.ok) {
      setState({ pending: false, message: null, errors: {}, done: true });
      onSuccess?.(result);
    } else {
      setState({ pending: false, message: result.errors ? null : result.message, errors: result.errors ?? {}, done: false });
      onError?.(result);
    }
  }
  const classes = ["orman-form", state.pending && "orman-form--pending", state.done && "orman-form--done", className].filter(Boolean).join(" ");
  return /* @__PURE__ */ jsx(FormContext.Provider, { value: state, children: /* @__PURE__ */ jsxs("form", { ...rest, className: classes, method: "post", action, onSubmit: submit, "aria-busy": state.pending || void 0, children: [
    typeof children === "function" ? children(state) : children,
    state.message ? /* @__PURE__ */ jsx("p", { className: "orman-form__message", role: "alert", children: state.message }) : null
  ] }) });
}
function formDataToJson(data) {
  const out = {};
  for (const [key, value] of data.entries()) {
    if (!(key in out)) out[key] = value;
    else out[key] = [].concat(out[key], value);
  }
  return out;
}
function FieldError({ name, className }) {
  const id = useId();
  const messages = useContext(FormContext).errors[name];
  if (!messages?.length) return null;
  return /* @__PURE__ */ jsx("span", { id: `${id}-${name}`, className: ["orman-form__error", className].filter(Boolean).join(" "), "data-field": name, role: "alert", children: messages.join(" ") });
}
export {
  FieldError,
  Form,
  useFormState
};
