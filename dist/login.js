"use client";
// src/components/login.tsx
import { useCallback, useEffect, useRef, useState } from "react";

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
    return { ok: false, status: res.status, message: errorMessage(res.status, parsed, messages), ...errors ? { errors } : {}, body: parsed };
  } catch {
    return { ok: false, status: 0, message: { ...DEFAULT_MESSAGES, ...messages }.network };
  }
}

// src/components/login.tsx
import { FieldError, Form } from "@orman/headless-next/form";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
var DEFAULT_LOGIN_LABELS = {
  email: "E-mail",
  password: "Password",
  remember: "Remember me",
  submit: "Sign in",
  code: "Authentication code",
  recoveryCode: "Recovery code",
  useRecovery: "Use a recovery code",
  useCode: "Use an authentication code",
  verify: "Verify",
  waiting: "Waiting for approval",
  waitingHint: "Open one of your signed-in devices and approve this sign-in.",
  cancel: "Cancel",
  denied: "This sign-in was denied.",
  expired: "This sign-in request expired."
};
function Login({ action = "/!/auth/json/login", challenge = "/!/account/two-factor/challenge", awaiting = "/!/sessions/awaiting", onSignedIn, labels, api: apiOptions, pollMs = 3e3, children, className }) {
  const text = { ...DEFAULT_LOGIN_LABELS, ...labels };
  const [step, setStep] = useState({ kind: "credentials" });
  const [notice, setNotice] = useState(null);
  const [recovery, setRecovery] = useState(false);
  const signedIn = useRef(onSignedIn);
  signedIn.current = onSignedIn;
  const follow = useCallback((body) => {
    const answer = body;
    if (answer?.needs === "two_factor") return setStep({ kind: "two_factor" });
    if (answer?.needs === "approval") return setStep({ kind: "approval", expiresAt: answer.request?.expires_at ?? null });
    setStep({ kind: "done" });
    signedIn.current?.();
  }, []);
  useEffect(() => {
    if (step.kind !== "approval") return;
    let stop = false;
    const timer = setInterval(async () => {
      const res = await api("GET", `${awaiting}/status`, void 0, apiOptions);
      if (stop || !res.ok) return;
      const state = res.body.state;
      if (state === "approved") return follow({ needs: null, signed_in: true });
      if (state === "denied" || state === "expired" || state === "gone") {
        setNotice(state === "expired" ? text.expired : text.denied);
        setStep({ kind: "credentials" });
      }
    }, pollMs);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [step.kind, awaiting, pollMs]);
  async function cancel() {
    await api("POST", `${awaiting}/cancel`, void 0, apiOptions);
    setNotice(null);
    setStep({ kind: "credentials" });
  }
  const root = ["orman-login", className].filter(Boolean).join(" ");
  if (step.kind === "done") return /* @__PURE__ */ jsx("div", { className: root, "data-step": "done" });
  if (step.kind === "approval") {
    return /* @__PURE__ */ jsx("div", { className: root, children: /* @__PURE__ */ jsxs("div", { className: "orman-login__step", "data-step": "approval", role: "status", children: [
      /* @__PURE__ */ jsx("p", { className: "orman-login__status", children: text.waiting }),
      /* @__PURE__ */ jsx("p", { className: "orman-login__hint", children: text.waitingHint }),
      /* @__PURE__ */ jsx("button", { type: "button", className: "orman-login__cancel", onClick: cancel, children: text.cancel })
    ] }) });
  }
  if (step.kind === "two_factor") {
    const field = recovery ? "recovery_code" : "code";
    return /* @__PURE__ */ jsx("div", { className: root, children: /* @__PURE__ */ jsx(Form, { className: "orman-login__step", "data-step": "two_factor", action: challenge, json: true, api: apiOptions, onSuccess: (result) => follow(result.body), children: ({ pending }) => /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("label", { className: "orman-login__field", children: [
        /* @__PURE__ */ jsx("span", { children: recovery ? text.recoveryCode : text.code }),
        /* @__PURE__ */ jsx("input", { name: field, type: "text", inputMode: recovery ? "text" : "numeric", autoComplete: "one-time-code", autoFocus: true, required: true }, field),
        /* @__PURE__ */ jsx(FieldError, { name: field })
      ] }),
      /* @__PURE__ */ jsx("button", { type: "submit", className: "orman-login__submit", disabled: pending, children: text.verify }),
      /* @__PURE__ */ jsx("button", { type: "button", className: "orman-login__switch", onClick: () => setRecovery(!recovery), children: recovery ? text.useCode : text.useRecovery })
    ] }) }) });
  }
  return /* @__PURE__ */ jsxs("div", { className: root, children: [
    notice ? /* @__PURE__ */ jsx("p", { className: "orman-login__notice", role: "alert", children: notice }) : null,
    /* @__PURE__ */ jsx(Form, { className: "orman-login__step", "data-step": "credentials", action, json: true, api: apiOptions, onSuccess: (result) => follow(result.body), children: ({ pending }) => /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("label", { className: "orman-login__field", children: [
        /* @__PURE__ */ jsx("span", { children: text.email }),
        /* @__PURE__ */ jsx("input", { name: "email", type: "email", autoComplete: "username", required: true }),
        /* @__PURE__ */ jsx(FieldError, { name: "email" })
      ] }),
      /* @__PURE__ */ jsxs("label", { className: "orman-login__field", children: [
        /* @__PURE__ */ jsx("span", { children: text.password }),
        /* @__PURE__ */ jsx("input", { name: "password", type: "password", autoComplete: "current-password", required: true }),
        /* @__PURE__ */ jsx(FieldError, { name: "password" })
      ] }),
      /* @__PURE__ */ jsxs("label", { className: "orman-login__field orman-login__field--remember", children: [
        /* @__PURE__ */ jsx("input", { name: "remember", type: "checkbox", value: "1" }),
        /* @__PURE__ */ jsx("span", { children: text.remember })
      ] }),
      children,
      /* @__PURE__ */ jsx("button", { type: "submit", className: "orman-login__submit", disabled: pending, children: text.submit })
    ] }) })
  ] });
}
export {
  DEFAULT_LOGIN_LABELS,
  Login
};
