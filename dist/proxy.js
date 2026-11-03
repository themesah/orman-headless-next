// src/proxy.ts
import { NextResponse } from "next/server.js";

// src/maintenance-html.ts
var ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}
var TAGS = { paragraph: "p", bulletList: "ul", orderedList: "ol", listItem: "li", blockquote: "blockquote" };
var MARKS = { bold: "strong", italic: "em", underline: "u", strike: "s" };
function bardToHtml(nodes = []) {
  return nodes.map((node) => nodeToHtml(node)).join("");
}
function nodeToHtml(node) {
  if (node.type === "text") return markText(node);
  if (node.type === "hardBreak") return "<br>";
  const inner = bardToHtml(node.content);
  if (node.type === "heading") {
    const level = Math.min(6, Math.max(2, Number(node.attrs?.level) || 2));
    return `<h${level}>${inner}</h${level}>`;
  }
  const tag = TAGS[node.type];
  return tag ? `<${tag}>${inner}</${tag}>` : "";
}
function markText(node) {
  let html = escapeHtml(node.text ?? "");
  for (const mark of node.marks ?? []) {
    if (mark.type === "link" && typeof mark.attrs?.href === "string" && /^(https?:\/\/|\/|mailto:)/i.test(mark.attrs.href)) {
      html = `<a href="${escapeHtml(mark.attrs.href)}">${html}</a>`;
    } else if (MARKS[mark.type]) {
      html = `<${MARKS[mark.type]}>${html}</${MARKS[mark.type]}>`;
    }
  }
  return html;
}
function maintenanceView(site) {
  const labels = site?.labels ?? {};
  return {
    title: site?.title || "Back soon",
    messageNodes: site?.message?.content ?? null,
    endsAt: site?.ends_at ?? null,
    showPrice: site?.type === "sell_domain" && !!site.price,
    price: site?.price ?? "",
    contact: site?.contact_email ?? "",
    labels: {
      backSoon: labels.back_soon ?? "We will be back shortly.",
      contact: labels.contact ?? "Contact",
      price: labels.price ?? "Asking price",
      email: labels.email_label ?? "Your email",
      notify: labels.notify_me ?? "Notify me",
      password: labels.access_code ?? "Password or key",
      unlock: labels.unlock ?? "Enter"
    },
    collectEmails: !!site?.collect_emails,
    hasAccess: !!site?.has_access,
    subscribe: site?.subscribe ?? "/!/maintenance/subscribe",
    unlock: site?.unlock ?? "/!/maintenance/unlock"
  };
}
function renderMaintenanceHtml(site, options = {}) {
  const v = maintenanceView(site);
  const lang = options.lang ?? site?.lang ?? "en";
  const dir = options.dir ?? site?.dir ?? "ltr";
  const message = v.messageNodes ? bardToHtml(v.messageNodes) : `<p>${escapeHtml(v.labels.backSoon)}</p>`;
  const parts = [
    `<h1 class="orman-maintenance__title">${escapeHtml(v.title)}</h1>`,
    `<div class="orman-maintenance__message">${message}</div>`,
    v.endsAt ? `<p class="orman-maintenance__countdown"><time dateTime="${escapeHtml(v.endsAt)}">${escapeHtml(v.endsAt)}</time></p>` : "",
    v.showPrice ? `<p class="orman-maintenance__price">${escapeHtml(v.labels.price)}: ${escapeHtml(v.price)}</p>` : "",
    v.contact ? `<p class="orman-maintenance__contact">${escapeHtml(v.labels.contact)}: <a href="mailto:${escapeHtml(v.contact)}">${escapeHtml(v.contact)}</a></p>` : "",
    v.collectEmails ? `<form class="orman-maintenance__subscribe" method="post" action="${escapeHtml(v.subscribe)}" data-orman-json><label>${escapeHtml(v.labels.email)} <input type="email" name="email" required></label> <button type="submit">${escapeHtml(v.labels.notify)}</button><p class="orman-maintenance__status" role="status"></p></form>` : "",
    v.hasAccess ? `<form class="orman-maintenance__unlock" method="post" action="${escapeHtml(v.unlock)}" data-orman-json data-orman-reload><label>${escapeHtml(v.labels.password)} <input type="password" name="password" required autocomplete="off"></label> <button type="submit">${escapeHtml(v.labels.unlock)}</button><p class="orman-maintenance__status" role="status"></p></form>` : ""
  ].filter(Boolean);
  const script = v.collectEmails || v.hasAccess ? `<script>${INLINE_SCRIPT.replace("__CSRF__", JSON.stringify(options.csrfUrl ?? "/!/csrf-token"))}</script>` : "";
  return `<!doctype html><html lang="${escapeHtml(lang)}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>${escapeHtml(v.title)}</title>${options.head ?? ""}</head><body><main class="orman-maintenance">${parts.join("")}</main>${script}</body></html>`;
}
var INLINE_SCRIPT = `document.querySelectorAll('form[data-orman-json]').forEach(function(f){f.addEventListener('submit',function(e){e.preventDefault();var s=f.querySelector('[role=status]'),b=f.querySelector('button');b.disabled=true;s.textContent='';fetch(__CSRF__,{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}}).then(function(r){return r.json()}).then(function(t){var d={};new FormData(f).forEach(function(v,k){d[k]=v});return fetch(f.action,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json','X-CSRF-TOKEN':t.csrf_token},body:JSON.stringify(d)})}).then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(r.ok){if(f.hasAttribute('data-orman-reload'))return location.reload();s.textContent='\\u2713';f.reset()}else{var m=j&&j.errors&&Object.values(j.errors)[0];s.textContent=(m&&m[0])||j.message||'Error'}})}).catch(function(){s.textContent='Error'}).then(function(){b.disabled=false})})})`;

// src/proxy.ts
var FORWARDED_MATCHER = ["/!/:path*", "/img/:path*", "/assets/:path*"];
var FORWARDED = /^\/(?:!|img|assets)(?:\/|$)/;
function clientIp(headers) {
  if (process.env.VERCEL) {
    const vercel = first(headers.get("x-vercel-forwarded-for")) ?? first(headers.get("x-real-ip"));
    if (vercel) return vercel;
  }
  const chain = headers.get("x-forwarded-for")?.split(",").map((s) => s.trim()).filter(Boolean);
  return chain?.length ? chain[chain.length - 1] : null;
}
function first(value) {
  return value?.split(",")[0]?.trim() || null;
}
function forwardToOrman(req, options = {}) {
  const origin = options.origin ?? process.env.ORMAN_ORIGIN;
  const secret = options.edgeSecret ?? process.env.ORMAN_EDGE_SECRET;
  const requireSecret = options.requireEdgeSecret ?? true;
  let target;
  try {
    if (!origin || requireSecret && !secret) throw new Error("missing");
    target = new URL(req.nextUrl.pathname + req.nextUrl.search, origin);
  } catch {
    return new NextResponse("Bad gateway: ORMAN_ORIGIN or ORMAN_EDGE_SECRET is not configured", { status: 502 });
  }
  const headers = new Headers(req.headers);
  headers.delete("X-Orman-Client-IP");
  if (secret) headers.set("X-Orman-Edge", secret);
  else headers.delete("X-Orman-Edge");
  headers.set("X-Forwarded-Host", req.nextUrl.host);
  headers.set("X-Forwarded-Proto", req.nextUrl.protocol.replace(":", ""));
  const ip = (options.clientIp ?? clientIp)(req.headers);
  if (ip) {
    headers.set("X-Forwarded-For", ip);
    if (secret) headers.set("X-Orman-Client-IP", ip);
  } else {
    headers.delete("X-Forwarded-For");
  }
  return NextResponse.rewrite(target, { request: { headers } });
}
var noopGate = () => void 0;
async function runGates(gates, req) {
  for (const gate of gates) {
    const answer = await gate(req);
    if (answer) return answer;
  }
  return void 0;
}
function gated(gates, next) {
  return async (req) => await runGates(gates, req) ?? next(req);
}
var ALWAYS_OPEN = /^\/(?:!|img|assets|_next)(?:\/|$)|^\/(?:favicon\.ico|robots\.txt)$/;
function patternToRegExp(pattern) {
  const body = pattern.replace(/^\/+/, "").split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
  return new RegExp(`^/${body}$`);
}
function maintenanceGate(getSite, options = {}) {
  const now = options.now ?? Date.now;
  const ttl = options.ttlMs ?? 15e3;
  let memo = null;
  const extra = (options.allow ?? []).map(patternToRegExp);
  async function read() {
    if (memo && now() < memo.until) return memo.site;
    try {
      const site = await getSite();
      const validUntil = site.gates?.maintenance?.valid_until ? Date.parse(site.gates.maintenance.valid_until) : Infinity;
      memo = { site, until: Math.min(now() + ttl, validUntil) };
      return site;
    } catch (error) {
      console.error("maintenanceGate: could not read /site, letting the request through:", error);
      return memo?.site ?? null;
    }
  }
  return async (req) => {
    const site = await read();
    const gate = site?.gates?.maintenance;
    if (!site || !gate?.active) return void 0;
    const path = req.nextUrl.pathname;
    if (ALWAYS_OPEN.test(path) || extra.some((r) => r.test(path)) || gate.allow_paths.some((p) => patternToRegExp(p).test(path))) return void 0;
    const verdict = await check(req, gate, options);
    if (verdict.pass) {
      if (!verdict.setCookie) return void 0;
      const clean = req.nextUrl.clone();
      clean.searchParams.delete(gate.bypass.param);
      const response = NextResponse.redirect(clean);
      for (const cookie of verdict.setCookie) response.headers.append("Set-Cookie", cookie);
      return response;
    }
    const addon = site.addons.maintenance;
    if (options.render) return options.render({ site: addon, gate });
    const html = renderMaintenanceHtml(addon, options.page);
    const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
    if (gate.status === 503 && gate.retry_after) headers["Retry-After"] = String(gate.retry_after);
    return new Response(req.method === "HEAD" ? null : html, { status: gate.status, headers });
  };
}
async function check(req, gate, options) {
  const key = req.nextUrl.searchParams.get(gate.bypass.param);
  const cookie = req.cookies.get(gate.bypass.cookie);
  if (!key && !cookie && !gate.bypass.check_all) return { pass: false };
  const origin = options.origin ?? process.env.ORMAN_ORIGIN;
  const secret = options.edgeSecret ?? process.env.ORMAN_EDGE_SECRET;
  if (!origin || !secret) return { pass: false };
  try {
    const url = new URL(gate.bypass.check, origin);
    if (key) url.searchParams.set(gate.bypass.param, key);
    const headers = { Accept: "application/json", "X-Orman-Edge": secret };
    if (cookie) headers.Cookie = `${cookie.name}=${cookie.value}`;
    const ip = clientIp(req.headers);
    if (ip) {
      headers["X-Forwarded-For"] = ip;
      headers["X-Orman-Client-IP"] = ip;
    }
    const res = await (options.fetch ?? fetch)(url, { headers, cache: "no-store" });
    if (!res.ok) return { pass: false };
    const body = await res.json();
    return body.pass ? { pass: true, setCookie: key ? res.headers.getSetCookie() : void 0 } : { pass: false };
  } catch {
    return { pass: false };
  }
}
export {
  FORWARDED,
  FORWARDED_MATCHER,
  clientIp,
  forwardToOrman,
  gated,
  maintenanceGate,
  noopGate,
  runGates
};
