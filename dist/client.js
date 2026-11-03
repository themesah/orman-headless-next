// src/client.ts
import "server-only";
var DEFAULT_PREFIX = "/api/headless/v1";
function tagsForPath(path) {
  const tags = ["orman:all"];
  const [route, query = ""] = path.split("?", 2);
  const segments = route.split("/").filter(Boolean);
  if (segments[0] === "page") {
    const uri = new URLSearchParams(query).get("uri");
    if (uri) tags.push(`path:${uri}`);
  } else if (segments[0] === "paths") {
    tags.push("paths");
  } else if (segments[0] === "forms" && segments[1]) {
    tags.push(`form:${decodeURIComponent(segments[1])}`);
  } else if (segments[0] === "site") {
    tags.push("site");
  } else if (segments[0] === "collections" && segments[1]) {
    tags.push(`collection:${decodeURIComponent(segments[1])}`);
  } else if (segments[0] === "trees" && segments[1] === "collections" && segments[2]) {
    tags.push(`collection:${decodeURIComponent(segments[2])}`);
  } else if (segments[0] === "navs" && segments[1]) {
    tags.push(`nav:${decodeURIComponent(segments[1])}`);
  } else if (segments[0] === "globals" && segments[1]) {
    tags.push(`global:${decodeURIComponent(segments[1])}`);
  }
  return tags;
}
function withQuery(path, query) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== void 0 && value !== null) params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
function createOrmanClient(options) {
  const { origin, token } = options;
  const prefix = options.apiPrefix || DEFAULT_PREFIX;
  const doFetch = options.fetch ?? ((url, init) => fetch(url, init));
  const attempts = options.attempts ?? 3;
  const delay = options.retryDelayMs ?? 500;
  async function fetchWithRetry(url, init) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await doFetch(url, init);
      } catch (error) {
        if (attempt >= attempts) throw error;
        await new Promise((resolve) => setTimeout(resolve, delay * attempt));
      }
    }
  }
  async function get(path, opts = {}) {
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
    const preview = !!opts.previewToken;
    if (preview) headers["X-Orman-Token"] = opts.previewToken;
    const res = await fetchWithRetry(`${origin}${prefix}${path}`, {
      headers,
      ...preview ? { cache: "no-store" } : { next: { tags: tagsForPath(path), revalidate: false } },
      ...opts.init
    });
    if (res.status === 404) return await res.json();
    if (!res.ok) throw new Error(`Orman ${res.status} for ${path}`);
    return await res.json();
  }
  const call = (path, query, o) => get(withQuery(path, query), o);
  return {
    get,
    paths: (query, o) => call("/paths", query, o),
    page: (uri, query, o) => call("/page", { uri, ...query }, o),
    site: (query, o) => call("/site", query, o),
    form: (handle, o) => get(`/forms/${encodeURIComponent(handle)}`, o),
    globals: (handle, query, o) => call(handle ? `/globals/${encodeURIComponent(handle)}` : "/globals", query, o),
    navs: (handle, query, o) => call(`/navs/${encodeURIComponent(handle)}`, query, o),
    trees: (handle, query, o) => call(`/trees/collections/${encodeURIComponent(handle)}`, { site: query?.site, fields: query?.fields?.join(",") }, o),
    entries: (handle, query, o) => call(`/collections/${encodeURIComponent(handle)}/entries`, query, o)
  };
}
export {
  createOrmanClient,
  tagsForPath
};
