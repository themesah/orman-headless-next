// src/proxy.ts
import { NextResponse } from "next/server.js";
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
export {
  FORWARDED,
  FORWARDED_MATCHER,
  clientIp,
  forwardToOrman,
  gated,
  noopGate,
  runGates
};
