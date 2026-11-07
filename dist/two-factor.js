"use client";
// src/components/two-factor.tsx
import { useCallback, useEffect, useMemo, useState } from "react";

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

// src/components/account-api.ts
function callAccount(onSignedOut, options) {
  return async function call(method, url, data) {
    const result = await api(method, url, data, options);
    if (!result.ok && result.status === 401) onSignedOut?.();
    return result;
  };
}
function failure(result) {
  return result.ok ? "" : result.errors && Object.values(result.errors)[0]?.[0] || result.message;
}

// src/components/two-factor.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var DEFAULT_TWO_FACTOR_LABELS = {
  title: "Two-step sign-in",
  on: "Two-step sign-in is on.",
  off: "Two-step sign-in is off.",
  enable: "Turn on",
  scan: "Scan this code with your authenticator app, then type the code it shows.",
  secret: "Or type this key in your app:",
  code: "Authentication code",
  confirm: "Confirm",
  disable: "Turn off",
  password: "Your password",
  recovery: "Recovery codes",
  show: "Show recovery codes",
  renew: "Make new recovery codes",
  download: "Download as .txt",
  signedOut: "You are signed out.",
  required: "Two-step sign-in is required for your account and cannot be turned off.",
  codesIntro: "Keep these codes somewhere safe. Each works once."
};
function recoveryCodesFile(codes, title = "Recovery codes") {
  return new Blob([`${title}

${codes.join("\n")}
`], { type: "text/plain;charset=utf-8" });
}
function TwoFactor({ base = "/!/account/two-factor", confirmPassword = "/!/account/confirm-password", labels, api: apiOptions, onSignedOut, className }) {
  const text = { ...DEFAULT_TWO_FACTOR_LABELS, ...labels };
  const [out, setOut] = useState(false);
  const call = useMemo(
    () => callAccount(() => {
      setOut(true);
      onSignedOut?.();
    }, apiOptions),
    [apiOptions, onSignedOut]
  );
  const [status, setStatus] = useState(null);
  const [setup, setSetup] = useState(null);
  const [codes, setCodes] = useState(null);
  const [message, setMessage] = useState(null);
  const [needsPassword, setNeedsPassword] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const res = await call("GET", base);
    if (res.ok) setStatus(res.body);
    else if (res.status !== 401) setMessage(failure(res));
  }, [base, call]);
  useEffect(() => {
    void load();
  }, [load]);
  async function sensitive(run, then) {
    setBusy(true);
    setMessage(null);
    const res = await run();
    setBusy(false);
    if (res.ok) return then(res.body);
    if (res.status === 403 && res.body?.needs === "password") {
      return setNeedsPassword(() => () => sensitive(run, then));
    }
    if (res.status !== 401) setMessage(failure(res));
  }
  async function confirmAndRetry(form) {
    const password = String(new FormData(form).get("password") ?? "");
    const retry = needsPassword;
    const res = await call("POST", confirmPassword, { password });
    if (!res.ok) return setMessage(failure(res));
    setNeedsPassword(null);
    await retry?.();
  }
  const root = ["orman-two-factor", className].filter(Boolean).join(" ");
  if (out) return /* @__PURE__ */ jsx("p", { className: root, children: text.signedOut });
  if (!status) return /* @__PURE__ */ jsx("div", { className: root, "aria-busy": "true" });
  return /* @__PURE__ */ jsxs("section", { className: root, children: [
    /* @__PURE__ */ jsx("p", { className: "orman-two-factor__status", "data-enabled": status.enabled, children: status.enabled ? text.on : text.off }),
    needsPassword ? /* @__PURE__ */ jsxs(
      "form",
      {
        className: "orman-two-factor__field",
        onSubmit: (event) => {
          event.preventDefault();
          void confirmAndRetry(event.currentTarget);
        },
        children: [
          /* @__PURE__ */ jsxs("label", { children: [
            /* @__PURE__ */ jsx("span", { children: text.password }),
            /* @__PURE__ */ jsx("input", { name: "password", type: "password", autoComplete: "current-password", required: true, autoFocus: true })
          ] }),
          /* @__PURE__ */ jsx("button", { type: "submit", className: "orman-two-factor__button", children: text.confirm })
        ]
      }
    ) : null,
    !status.enabled && !setup && !needsPassword ? /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        className: "orman-two-factor__button",
        disabled: busy,
        onClick: () => sensitive(() => call("POST", `${base}/enable`), (body) => setSetup(body)),
        children: text.enable
      }
    ) : null,
    setup ? /* @__PURE__ */ jsxs(
      "form",
      {
        className: "orman-two-factor__setup",
        onSubmit: (event) => {
          event.preventDefault();
          const code = String(new FormData(event.currentTarget).get("code") ?? "");
          void sensitive(
            () => call("POST", `${base}/confirm`, { code }),
            (body) => {
              setCodes(body.recovery_codes ?? null);
              setSetup(null);
              void load();
            }
          );
        },
        children: [
          /* @__PURE__ */ jsx("p", { children: text.scan }),
          /* @__PURE__ */ jsx("img", { className: "orman-two-factor__qr", alt: "", src: `data:image/svg+xml;utf8,${encodeURIComponent(setup.qr_svg)}` }),
          /* @__PURE__ */ jsxs("p", { className: "orman-two-factor__secret", children: [
            text.secret,
            " ",
            /* @__PURE__ */ jsx("code", { children: setup.secret })
          ] }),
          /* @__PURE__ */ jsxs("label", { className: "orman-two-factor__field", children: [
            /* @__PURE__ */ jsx("span", { children: text.code }),
            /* @__PURE__ */ jsx("input", { name: "code", inputMode: "numeric", autoComplete: "one-time-code", required: true })
          ] }),
          /* @__PURE__ */ jsx("button", { type: "submit", className: "orman-two-factor__button", disabled: busy, children: text.confirm })
        ]
      }
    ) : null,
    status.enabled && !needsPassword ? /* @__PURE__ */ jsxs("div", { className: "orman-two-factor__manage", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "orman-two-factor__button",
          disabled: busy,
          onClick: () => sensitive(() => call("GET", `${base}/recovery-codes`), (body) => setCodes(body.recovery_codes)),
          children: text.show
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "orman-two-factor__button",
          disabled: busy,
          onClick: () => sensitive(() => call("POST", `${base}/recovery-codes`), (body) => setCodes(body.recovery_codes)),
          children: text.renew
        }
      ),
      status.required ? /* @__PURE__ */ jsx("p", { className: "orman-two-factor__hint", children: text.required }) : /* @__PURE__ */ jsxs(
        "form",
        {
          className: "orman-two-factor__field",
          onSubmit: (event) => {
            event.preventDefault();
            const password = String(new FormData(event.currentTarget).get("password") ?? "");
            void sensitive(
              () => call("POST", `${base}/disable`, { password }),
              () => {
                setCodes(null);
                void load();
              }
            );
          },
          children: [
            /* @__PURE__ */ jsxs("label", { children: [
              /* @__PURE__ */ jsx("span", { children: text.password }),
              /* @__PURE__ */ jsx("input", { name: "password", type: "password", autoComplete: "current-password", required: true })
            ] }),
            /* @__PURE__ */ jsx("button", { type: "submit", className: "orman-two-factor__button", disabled: busy, children: text.disable })
          ]
        }
      )
    ] }) : null,
    codes ? /* @__PURE__ */ jsx(RecoveryCodes, { codes, text }) : null,
    message ? /* @__PURE__ */ jsx("p", { className: "orman-two-factor__error", role: "alert", children: message }) : null
  ] });
}
function RecoveryCodes({ codes, text }) {
  const [href, setHref] = useState(null);
  useEffect(() => {
    const url = URL.createObjectURL(recoveryCodesFile(codes, text.recovery));
    setHref(url);
    return () => URL.revokeObjectURL(url);
  }, [codes, text.recovery]);
  return /* @__PURE__ */ jsxs("div", { className: "orman-two-factor__codes", children: [
    /* @__PURE__ */ jsx("p", { children: text.codesIntro }),
    /* @__PURE__ */ jsx("ul", { children: codes.map((code) => /* @__PURE__ */ jsx("li", { children: /* @__PURE__ */ jsx("code", { children: code }) }, code)) }),
    href ? /* @__PURE__ */ jsx("a", { className: "orman-two-factor__download", href, download: "recovery-codes.txt", children: text.download }) : null
  ] });
}
export {
  DEFAULT_TWO_FACTOR_LABELS,
  TwoFactor,
  recoveryCodesFile
};
