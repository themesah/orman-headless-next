"use client";
// src/components/scoring.tsx
import { useEffect, useState } from "react";

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

// src/components/scoring.tsx
import { jsx, jsxs } from "react/jsx-runtime";
function MyScore({ site, labels, onSignedOut, api: apiOptions, className }) {
  const text = { balance: "Points", badges: "Badges", history: "History", signedOut: "Sign in to see your points.", ...labels };
  const [score, setScore] = useState(void 0);
  useEffect(() => {
    void callAccount(onSignedOut, apiOptions)("GET", site?.my_score ?? "/!/scoring/my-score").then((res) => setScore(res.ok ? res.body : null));
  }, [apiOptions, onSignedOut, site?.my_score]);
  const root = ["orman-score", className].filter(Boolean).join(" ");
  if (score === void 0) return /* @__PURE__ */ jsx("div", { className: root, "aria-busy": "true" });
  if (!score) return /* @__PURE__ */ jsx("p", { className: root, children: text.signedOut });
  return /* @__PURE__ */ jsxs("section", { className: root, children: [
    /* @__PURE__ */ jsxs("p", { className: "orman-score__balance", children: [
      text.balance,
      ": ",
      score.balance
    ] }),
    score.badges.length ? /* @__PURE__ */ jsx("ul", { className: "orman-score__badges", "aria-label": text.badges, children: score.badges.map((badge) => /* @__PURE__ */ jsxs("li", { className: "orman-score__badge", title: badge.description ?? void 0, children: [
      badge.icon ? /* @__PURE__ */ jsx("img", { src: badge.icon, alt: "" }) : null,
      badge.name
    ] }, badge.key)) }) : null,
    score.history.length ? /* @__PURE__ */ jsx("ul", { className: "orman-score__history", "aria-label": text.history, children: score.history.map((row, i) => /* @__PURE__ */ jsxs("li", { children: [
      row.amount > 0 ? "+" : "",
      row.amount,
      " ",
      row.reason
    ] }, `${row.created_at}-${i}`)) }) : null
  ] });
}
function MyTasks({ site, labels, onSignedOut, api: apiOptions, className }) {
  const text = { empty: "No tasks right now.", submit: "Submit", pending: "Waiting for review", signedOut: "Sign in to see your tasks.", ...labels };
  const [data, setData] = useState(void 0);
  const [error, setError] = useState(null);
  const call = callAccount(onSignedOut, apiOptions);
  async function load() {
    const res = await call("GET", site?.my_tasks ?? "/!/scoring/my-tasks");
    setData(res.ok ? res.body : null);
  }
  useEffect(() => {
    void load();
  }, [site?.my_tasks]);
  async function submit(id) {
    setError(null);
    const res = await call("POST", (site?.submit ?? "/!/scoring/tasks/{task}/submit").replace("{task}", encodeURIComponent(String(id))), {});
    if (!res.ok) return setError(res.message);
    await load();
  }
  const root = ["orman-tasks", className].filter(Boolean).join(" ");
  if (data === void 0) return /* @__PURE__ */ jsx("div", { className: root, "aria-busy": "true" });
  if (!data) return /* @__PURE__ */ jsx("p", { className: root, children: text.signedOut });
  if (!data.tasks.length) return /* @__PURE__ */ jsx("p", { className: `${root} orman-tasks__empty`, children: text.empty });
  const pending = new Set(data.pendingSubmissionTaskIds.map(String));
  return /* @__PURE__ */ jsxs("ul", { className: root, children: [
    data.tasks.map((task) => /* @__PURE__ */ jsxs("li", { className: "orman-tasks__task", children: [
      /* @__PURE__ */ jsx("strong", { children: task.title }),
      " ",
      /* @__PURE__ */ jsxs("span", { children: [
        "+",
        task.points
      ] }),
      task.description ? /* @__PURE__ */ jsx("p", { children: task.description }) : null,
      task.submit_url ? pending.has(String(task.id)) ? /* @__PURE__ */ jsx("em", { children: text.pending }) : /* @__PURE__ */ jsx("button", { type: "button", className: "orman-tasks__submit", onClick: () => void submit(task.id), children: text.submit }) : null
    ] }, task.id)),
    error ? /* @__PURE__ */ jsx("li", { role: "alert", children: error }) : null
  ] });
}
export {
  MyScore,
  MyTasks
};
