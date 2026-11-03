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
export {
  DEFAULT_MESSAGES,
  api,
  csrfToken,
  errorMessage
};
