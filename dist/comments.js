"use client";
// src/components/comments.tsx
import { useEffect as useEffect2, useMemo, useState as useState2 } from "react";

// src/components/captcha.tsx
import { useCallback, useEffect, useId, useRef, useState } from "react";

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

// src/components/captcha.tsx
import { FieldError, useFormHook } from "@orman/headless-next/form";
import { jsx, jsxs } from "react/jsx-runtime";
var DEFAULT_CAPTCHA_LABELS = {
  required: "Please complete the check.",
  answer: "Type the characters you see",
  refresh: "New image",
  image: "Captcha"
};
function Captcha({ captcha, site, labels, theme = "auto", className }) {
  const text = { ...DEFAULT_CAPTCHA_LABELS, ...labels };
  if (!captcha) return null;
  if (captcha.kind === "turnstile") {
    const config2 = site.addons.turnstile;
    if (!config2) return missing("turnstile");
    return /* @__PURE__ */ jsx(TurnstileWidget, { config: config2, labels: text, theme, className });
  }
  const config = site.addons.kaptcha;
  if (!config) return missing("kaptcha");
  return /* @__PURE__ */ jsx(KaptchaChallenge, { config, labels: text, className });
}
function missing(kind) {
  if (process.env.NODE_ENV !== "production") console.warn(`<Captcha>: the form asks for ${kind} but /site has no addons.${kind} block.`);
  return null;
}
var scripts = /* @__PURE__ */ new Map();
function loadTurnstile(script) {
  const win = window;
  if (win.turnstile) return Promise.resolve(win.turnstile);
  let loading = scripts.get(script);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const el = document.createElement("script");
      el.src = `${script}${script.includes("?") ? "&" : "?"}render=explicit`;
      el.async = true;
      el.onload = () => win.turnstile ? resolve(win.turnstile) : reject(new Error("turnstile did not load"));
      el.onerror = () => reject(new Error("turnstile script failed"));
      document.head.appendChild(el);
    });
    loading.catch(() => scripts.delete(script));
    scripts.set(script, loading);
  }
  return loading;
}
function TurnstileWidget({ config, labels, theme, className }) {
  const box = useRef(null);
  const widget = useRef(null);
  useEffect(() => {
    let cancelled = false;
    loadTurnstile(config.script).then((api2) => {
      if (cancelled || !box.current) return;
      widget.current = { id: api2.render(box.current, { sitekey: config.sitekey, theme }), api: api2 };
    }).catch(() => void 0);
    return () => {
      cancelled = true;
      widget.current?.api.remove(widget.current.id);
      widget.current = null;
    };
  }, [config.script, config.sitekey, theme]);
  useFormHook({
    prepare(data) {
      const token = widget.current?.api.getResponse(widget.current.id);
      if (!token) throw new Error(labels.required);
      data.set(config.field, token);
    },
    reset() {
      if (widget.current) widget.current.api.reset(widget.current.id);
    }
  });
  return /* @__PURE__ */ jsx("div", { ref: box, className: ["orman-captcha", "orman-captcha--turnstile", className].filter(Boolean).join(" ") });
}
function KaptchaChallenge({ config, labels, className }) {
  const id = useId();
  const [challenge, setChallenge] = useState(null);
  const input = useRef(null);
  const load = useCallback(async () => {
    const result = await api("POST", config.challenge);
    if (result.ok) setChallenge({ token: result.body.token, image: result.body.image });
    if (input.current) input.current.value = "";
  }, [config.challenge]);
  useEffect(() => {
    void load();
  }, [load]);
  useFormHook({ reset: () => void load() });
  return /* @__PURE__ */ jsxs("div", { className: ["orman-captcha", "orman-captcha--kaptcha", className].filter(Boolean).join(" "), children: [
    challenge ? /* @__PURE__ */ jsx("img", { className: "orman-captcha__image", src: challenge.image, width: config.width, height: config.height, alt: labels.image }) : null,
    /* @__PURE__ */ jsx("button", { type: "button", className: "orman-captcha__refresh", onClick: () => void load(), children: labels.refresh }),
    /* @__PURE__ */ jsx("input", { ref: input, id, className: "orman-captcha__input", type: "text", name: config.fields.answer, autoComplete: "off", autoCapitalize: "off", spellCheck: false, required: true, "aria-label": labels.answer }),
    /* @__PURE__ */ jsx("input", { type: "hidden", name: config.fields.challenge, value: challenge?.token ?? "" }),
    /* @__PURE__ */ jsx(FieldError, { name: config.fields.answer })
  ] });
}

// src/components/comments.tsx
import { FieldError as FieldError2, Form } from "@orman/headless-next/form";

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

// src/components/comments.tsx
import { Fragment, jsx as jsx2, jsxs as jsxs2 } from "react/jsx-runtime";
var DEFAULT_COMMENTS_LABELS = {
  title: "Comments",
  empty: "No comments yet.",
  name: "Name",
  email: "E-mail (never shown)",
  comment: "Comment",
  submit: "Post comment",
  waiting: "Waiting for approval",
  closed: "Comments are closed.",
  loginRequired: "Sign in to comment.",
  reply: "Reply"
};
function Comments({ block, site, labels, api: apiOptions, className }) {
  const text = { ...DEFAULT_COMMENTS_LABELS, ...labels };
  const [own, setOwn] = useState2([]);
  const [replyTo, setReplyTo] = useState2(null);
  if (!block) return null;
  const root = ["orman-comments", className].filter(Boolean).join(" ");
  return /* @__PURE__ */ jsxs2("section", { className: root, children: [
    /* @__PURE__ */ jsxs2("h2", { className: "orman-comments__title", children: [
      text.title,
      " (",
      block.count,
      ")"
    ] }),
    block.comments.length || own.length ? /* @__PURE__ */ jsxs2("ol", { className: "orman-comments__list", children: [
      block.comments.map((c) => /* @__PURE__ */ jsxs2("li", { className: "orman-comments__item", "data-depth": c.depth, children: [
        /* @__PURE__ */ jsx2("strong", { className: "orman-comments__author", children: c.author.name }),
        " ",
        /* @__PURE__ */ jsx2("time", { className: "orman-comments__date", children: c.created_at }),
        /* @__PURE__ */ jsx2("p", { className: "orman-comments__text", children: c.text }),
        block.open ? /* @__PURE__ */ jsx2("button", { type: "button", className: "orman-comments__reply", onClick: () => setReplyTo(c.id), children: text.reply }) : null
      ] }, c.id)),
      own.map((c) => /* @__PURE__ */ jsxs2("li", { className: "orman-comments__item", "data-depth": c.depth, "data-pending": "true", children: [
        /* @__PURE__ */ jsx2("strong", { className: "orman-comments__author", children: c.author.name }),
        " ",
        /* @__PURE__ */ jsx2("em", { className: "orman-comments__status", children: text.waiting }),
        /* @__PURE__ */ jsx2("p", { className: "orman-comments__text", children: c.text })
      ] }, `own-${c.id}`))
    ] }) : /* @__PURE__ */ jsx2("p", { className: "orman-comments__empty", children: text.empty }),
    !block.open ? /* @__PURE__ */ jsx2("p", { className: "orman-comments__closed", children: text.closed }) : /* @__PURE__ */ jsx2(
      Form,
      {
        className: "orman-comments__form",
        action: block.post,
        json: true,
        api: apiOptions,
        onSuccess: (result) => {
          const comment = result.body?.comment;
          if (comment) setOwn((list) => [...list, { ...comment, status: "pending" }]);
          setReplyTo(null);
        },
        children: ({ pending }) => /* @__PURE__ */ jsxs2(Fragment, { children: [
          /* @__PURE__ */ jsx2("input", { type: "hidden", name: "_diskussiya_context", value: block.context }),
          /* @__PURE__ */ jsx2("input", { type: "hidden", name: "_diskussiya_context_signature", value: block.signature }),
          replyTo ? /* @__PURE__ */ jsx2("input", { type: "hidden", name: "ids", value: replyTo }) : null,
          /* @__PURE__ */ jsx2("input", { type: "text", name: block.honeypot, tabIndex: -1, autoComplete: "off", "aria-hidden": "true", style: { position: "absolute", left: "-9999px" }, defaultValue: "" }),
          /* @__PURE__ */ jsxs2("label", { children: [
            /* @__PURE__ */ jsx2("span", { children: text.name }),
            /* @__PURE__ */ jsx2("input", { name: "name", type: "text", required: true }),
            /* @__PURE__ */ jsx2(FieldError2, { name: "name" })
          ] }),
          /* @__PURE__ */ jsxs2("label", { children: [
            /* @__PURE__ */ jsx2("span", { children: text.email }),
            /* @__PURE__ */ jsx2("input", { name: "email", type: "email", required: true }),
            /* @__PURE__ */ jsx2(FieldError2, { name: "email" })
          ] }),
          /* @__PURE__ */ jsxs2("label", { children: [
            /* @__PURE__ */ jsx2("span", { children: text.comment }),
            /* @__PURE__ */ jsx2("textarea", { name: "comment", required: true }),
            /* @__PURE__ */ jsx2(FieldError2, { name: "comment" })
          ] }),
          /* @__PURE__ */ jsx2(Captcha, { captcha: block.captcha, site }),
          /* @__PURE__ */ jsx2("button", { type: "submit", disabled: pending, children: text.submit })
        ] })
      }
    )
  ] });
}
var DEFAULT_MY_COMMENTS_LABELS = {
  title: "My comments",
  empty: "You have not commented yet.",
  signedOut: "You are signed out.",
  status: { pending: "Waiting for approval", accepted: "Accepted", rejected: "Rejected", replied: "Replied to" }
};
function MyComments({ url = "/!/diskussiya/mine", labels, api: apiOptions, onSignedOut, className }) {
  const text = { ...DEFAULT_MY_COMMENTS_LABELS, ...labels, status: { ...DEFAULT_MY_COMMENTS_LABELS.status, ...labels?.status } };
  const [items, setItems] = useState2(null);
  const [out, setOut] = useState2(false);
  const [error, setError] = useState2(null);
  const call = useMemo(
    () => callAccount(() => {
      setOut(true);
      onSignedOut?.();
    }, apiOptions),
    [apiOptions, onSignedOut]
  );
  useEffect2(() => {
    void call("GET", url).then((res) => {
      if (res.ok) setItems(res.body.comments);
      else if (res.status !== 401) setError(failure(res));
    });
  }, [call, url]);
  const root = ["orman-my-comments", className].filter(Boolean).join(" ");
  if (out) return /* @__PURE__ */ jsx2("p", { className: root, children: text.signedOut });
  if (error) return /* @__PURE__ */ jsx2("p", { className: root, role: "alert", children: error });
  if (!items) return /* @__PURE__ */ jsx2("div", { className: root, "aria-busy": "true" });
  if (!items.length) return /* @__PURE__ */ jsx2("p", { className: root, children: text.empty });
  return /* @__PURE__ */ jsx2("ul", { className: root, children: items.map((c) => /* @__PURE__ */ jsxs2("li", { className: "orman-my-comments__item", "data-status": c.status, children: [
    c.page?.url ? /* @__PURE__ */ jsx2("a", { href: c.page.url, children: c.page.title }) : c.page?.title ? /* @__PURE__ */ jsx2("span", { children: c.page.title }) : null,
    /* @__PURE__ */ jsx2("p", { children: c.text }),
    /* @__PURE__ */ jsx2("em", { children: text.status[c.status] })
  ] }, c.id)) });
}
export {
  Comments,
  DEFAULT_COMMENTS_LABELS,
  DEFAULT_MY_COMMENTS_LABELS,
  MyComments
};
