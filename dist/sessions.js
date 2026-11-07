"use client";
// src/components/sessions.tsx
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

// src/components/stream.ts
function followStream(options) {
  const doFetch = options.fetchImpl ?? fetch;
  let stopped = false;
  let abort = null;
  let timers = [];
  let poller = null;
  let failures = 0;
  const later = (ms, run) => {
    const t = setTimeout(run, ms);
    timers.push(t);
  };
  const startPolling = (seconds) => {
    if (poller || stopped) return;
    options.onPoll();
    poller = setInterval(options.onPoll, seconds * 1e3);
  };
  const stopPolling = () => {
    if (poller) clearInterval(poller);
    poller = null;
  };
  async function connect() {
    if (stopped) return;
    const res = await api("GET", options.url ?? "/!/notifications/inbox/stream", void 0, options.api);
    if (stopped) return;
    if (!res.ok) {
      if (res.status === 401) return options.onSignedOut?.();
      startPolling(30);
      return later(Math.min(6e4, 2e3 * 2 ** failures++), connect);
    }
    const poll = res.body.poll_seconds ?? 30;
    const info = res.body.stream;
    if (!info) {
      startPolling(poll);
      return later(5 * 6e4, connect);
    }
    abort = new AbortController();
    const renewIn = Math.max(1e4, new Date(info.expires_at).getTime() - Date.now() - 6e4);
    later(renewIn, () => {
      abort?.abort();
      void connect();
    });
    try {
      const url = new URL(info.hub);
      url.searchParams.append("topic", info.topic);
      const response = await doFetch(url.toString(), { headers: { Authorization: `Bearer ${info.token}`, Accept: "text/event-stream" }, signal: abort.signal, cache: "no-store" });
      if (!response.ok || !response.body) throw new Error(`hub ${response.status}`);
      failures = 0;
      stopPolling();
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (; ; ) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let at;
        while ((at = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, at);
          buffer = buffer.slice(at + 2);
          const data = block.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n");
          if (!data) continue;
          let parsed = {};
          try {
            parsed = JSON.parse(data);
          } catch {
          }
          options.onEvent(parsed);
        }
      }
    } catch {
      if (stopped || abort?.signal.aborted) return;
    }
    if (stopped || abort?.signal.aborted) return;
    startPolling(poll);
    later(Math.min(6e4, 2e3 * 2 ** failures++), connect);
  }
  void connect();
  return () => {
    stopped = true;
    abort?.abort();
    timers.forEach(clearTimeout);
    timers = [];
    stopPolling();
  };
}

// src/components/sessions.tsx
import { jsx, jsxs } from "react/jsx-runtime";
var DEFAULT_SESSIONS_LABELS = {
  pending: "Waiting sign-ins",
  approve: "Approve",
  deny: "Deny",
  active: "Signed in on",
  history: "Sign-in history",
  current: "This device",
  revoke: "Sign out",
  revokeOthers: "Sign out all other devices",
  rule: "When I sign in on another device",
  save: "Save",
  password: "Your password",
  signedOut: "You are signed out."
};
function Sessions({ account = "/!/sessions/account", stream = "/!/notifications/inbox/stream", pollMs = 15e3, labels, api: apiOptions, onSignedOut, className }) {
  const text = { ...DEFAULT_SESSIONS_LABELS, ...labels };
  const [data, setData] = useState(null);
  const [out, setOut] = useState(false);
  const [message, setMessage] = useState(null);
  const call = useMemo(
    () => callAccount(() => {
      setOut(true);
      onSignedOut?.();
    }, apiOptions),
    [apiOptions, onSignedOut]
  );
  const load = useCallback(async () => {
    const res = await call("GET", account);
    if (res.ok) setData(res.body);
  }, [account, call]);
  useEffect(() => {
    void load();
    if (stream === false) {
      const t = setInterval(() => void load(), pollMs);
      return () => clearInterval(t);
    }
    return followStream({
      url: stream,
      api: apiOptions,
      onEvent: () => void load(),
      onPoll: () => void load(),
      onSignedOut: () => setOut(true)
    });
  }, [load, stream, pollMs, apiOptions]);
  async function post(url, body) {
    setMessage(null);
    const res = await call("POST", url, body);
    if (!res.ok && res.status !== 401) setMessage(failure(res));
    await load();
  }
  const root = ["orman-sessions", className].filter(Boolean).join(" ");
  if (out) return /* @__PURE__ */ jsx("p", { className: root, children: text.signedOut });
  if (!data) return /* @__PURE__ */ jsx("div", { className: root, "aria-busy": "true" });
  const row = (r) => /* @__PURE__ */ jsxs("li", { className: "orman-sessions__row", "data-current": r.is_current || void 0, children: [
    /* @__PURE__ */ jsx("span", { children: r.device_label }),
    " ",
    /* @__PURE__ */ jsx("span", { children: r.area_label }),
    " ",
    /* @__PURE__ */ jsx("span", { children: r.ip_address }),
    " ",
    /* @__PURE__ */ jsx("span", { children: r.last_active_at_human ?? r.login_at_human }),
    r.is_current ? /* @__PURE__ */ jsx("strong", { children: text.current }) : r.active ? /* @__PURE__ */ jsx("button", { type: "button", className: "orman-sessions__button", onClick: () => post(r.actions.revoke), children: text.revoke }) : r.ended_reason_label ? /* @__PURE__ */ jsx("em", { children: r.ended_reason_label }) : null
  ] }, r.id);
  return /* @__PURE__ */ jsxs("section", { className: root, children: [
    data.pending.length ? /* @__PURE__ */ jsxs("div", { className: "orman-sessions__pending", role: "alert", children: [
      /* @__PURE__ */ jsx("h3", { children: text.pending }),
      /* @__PURE__ */ jsx("ul", { children: data.pending.map((p) => /* @__PURE__ */ jsxs("li", { className: "orman-sessions__row", children: [
        /* @__PURE__ */ jsx("span", { children: p.device_label }),
        " ",
        /* @__PURE__ */ jsx("span", { children: p.ip_address }),
        " ",
        /* @__PURE__ */ jsx("span", { children: p.requested_at_human }),
        /* @__PURE__ */ jsx("button", { type: "button", className: "orman-sessions__button", onClick: () => post(p.actions.approve), children: text.approve }),
        /* @__PURE__ */ jsx("button", { type: "button", className: "orman-sessions__button", onClick: () => post(p.actions.deny), children: text.deny })
      ] }, p.id)) })
    ] }) : null,
    /* @__PURE__ */ jsxs("div", { className: "orman-sessions__rule", children: [
      /* @__PURE__ */ jsxs("p", { children: [
        /* @__PURE__ */ jsx("strong", { children: data.policy.label }),
        " ",
        data.policy.description
      ] }),
      data.policy.editable ? /* @__PURE__ */ jsxs(
        "form",
        {
          onSubmit: (event) => {
            event.preventDefault();
            void post(`${account.replace(/\/account$/, "")}/rule`, { rule: String(new FormData(event.currentTarget).get("rule")) });
          },
          children: [
            /* @__PURE__ */ jsxs("label", { children: [
              /* @__PURE__ */ jsx("span", { children: text.rule }),
              /* @__PURE__ */ jsx("select", { name: "rule", defaultValue: data.policy.rule, children: data.rules.map((r) => /* @__PURE__ */ jsx("option", { value: r.rule, children: r.label }, r.rule)) })
            ] }),
            /* @__PURE__ */ jsx("button", { type: "submit", className: "orman-sessions__button", children: text.save })
          ]
        }
      ) : data.policy.locked_reason ? /* @__PURE__ */ jsx("p", { className: "orman-sessions__locked", children: data.policy.locked_reason }) : null
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "orman-sessions__active", children: [
      /* @__PURE__ */ jsx("h3", { children: text.active }),
      /* @__PURE__ */ jsx("ul", { children: data.active.map(row) }),
      data.active.length > 1 ? /* @__PURE__ */ jsx("button", { type: "button", className: "orman-sessions__button", onClick: () => post(`${account.replace(/\/account$/, "")}/revoke-others`), children: text.revokeOthers }) : null
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "orman-sessions__history", children: [
      /* @__PURE__ */ jsx("h3", { children: text.history }),
      /* @__PURE__ */ jsx("ul", { children: data.history.map(row) })
    ] }),
    message ? /* @__PURE__ */ jsx("p", { className: "orman-sessions__error", role: "alert", children: message }) : null
  ] });
}
export {
  DEFAULT_SESSIONS_LABELS,
  Sessions
};
