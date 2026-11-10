"use client";
// src/components/courses.tsx
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

// src/components/courses.tsx
import { jsx, jsxs } from "react/jsx-runtime";
function LockedLesson({ lesson, site, lessonId, children, locked, onSignedOut, api: apiOptions, className }) {
  const [state, setState] = useState({ kind: "loading" });
  useEffect(() => {
    const url = (site?.lesson ?? "/!/courses/lessons/{id}").replace("{id}", encodeURIComponent(lessonId));
    void api("GET", url, void 0, apiOptions).then((res) => {
      if (res.ok) return setState({ kind: "open", data: res.body.data });
      if (res.status === 401) onSignedOut?.();
      setState({ kind: "locked", reason: res.status === 401 ? "signed-out" : "not-enrolled" });
    });
  }, [apiOptions, lessonId, onSignedOut, site?.lesson]);
  const root = ["orman-lesson", className].filter(Boolean).join(" ");
  if (state.kind === "loading") return /* @__PURE__ */ jsx("div", { className: root, "aria-busy": "true" });
  if (state.kind === "locked") {
    return /* @__PURE__ */ jsxs("div", { className: `${root} orman-lesson--locked`, "data-reason": state.reason, children: [
      locked ?? /* @__PURE__ */ jsx("p", { children: state.reason === "signed-out" ? "Sign in to read this lesson." : "Enroll in the course to read this lesson." }),
      lesson.course ? /* @__PURE__ */ jsx("a", { href: lesson.course.uri ?? "#", children: lesson.course.title }) : null
    ] });
  }
  return /* @__PURE__ */ jsx("div", { className: root, children: children(state.data) });
}
function CompleteLesson({ lessonId, site, labels, onCompleted, onSignedOut, api: apiOptions, className }) {
  const text = { complete: "Mark as complete", completing: "Saving\u2026", done: "Completed", next: "Next lesson", ...labels };
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  async function complete() {
    setBusy(true);
    setError(null);
    const url = (site?.complete ?? "/!/courses/lessons/{id}/complete").replace("{id}", encodeURIComponent(lessonId));
    const res = await callAccount(onSignedOut, apiOptions)("POST", url);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setResult(res.body);
    onCompleted?.(res.body);
  }
  return /* @__PURE__ */ jsxs("div", { className: ["orman-complete", className].filter(Boolean).join(" "), children: [
    /* @__PURE__ */ jsx("button", { type: "button", className: "orman-complete__button", disabled: busy || !!result, onClick: () => void complete(), children: result ? text.done : busy ? text.completing : text.complete }),
    result?.next ? /* @__PURE__ */ jsxs("a", { className: "orman-complete__next", href: result.next.uri ?? "#", children: [
      text.next,
      ": ",
      result.next.title
    ] }) : null,
    error ? /* @__PURE__ */ jsx("p", { role: "alert", className: "orman-complete__error", children: error }) : null
  ] });
}
function CourseProgress({ course, courseId, site, onSignedOut, api: apiOptions, className }) {
  const [mine, setMine] = useState(null);
  useEffect(() => {
    void callAccount(onSignedOut, apiOptions)("GET", site?.me ?? "/!/courses/me").then((res) => res.ok && setMine(res.body));
  }, [apiOptions, onSignedOut, site?.me]);
  const done = new Set(mine?.completed ?? []);
  const nextId = mine?.courses.find((c) => c.id === courseId)?.next?.id;
  return /* @__PURE__ */ jsx("ol", { className: ["orman-progress", className].filter(Boolean).join(" "), children: course.lessons.map((lesson) => /* @__PURE__ */ jsx("li", { className: "orman-progress__lesson", "data-done": done.has(lesson.id) || void 0, "data-next": lesson.id === nextId || void 0, children: /* @__PURE__ */ jsx("a", { href: lesson.uri ?? "#", children: lesson.title }) }, lesson.id)) });
}
export {
  CompleteLesson,
  CourseProgress,
  LockedLesson
};
