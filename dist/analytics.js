"use client";
// src/components/analytics.tsx
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
function hitUrl(site, input) {
  const params = new URLSearchParams();
  if (input.entryId) params.set("e", input.entryId);
  params.set("p", input.path);
  const from = referrerHost(input.referrer, input.host);
  if (from) params.set("r", from);
  return `${site.hit}?${params.toString()}`;
}
function referrerHost(referrer, ownHost) {
  if (!referrer) return void 0;
  try {
    const host = new URL(referrer).host;
    return host && host !== ownHost ? host : void 0;
  } catch {
    return void 0;
  }
}
function optedOut() {
  const nav = navigator;
  return nav.doNotTrack === "1" || nav.msDoNotTrack === "1" || nav.globalPrivacyControl === true;
}
function PageView({ site, entryId, path, respectDnt = true }) {
  const pathname = usePathname();
  const sent = useRef(null);
  const counted = site?.track_pageviews === true;
  useEffect(() => {
    if (!counted || !site) return;
    const target = path ?? pathname ?? window.location.pathname;
    if (sent.current === target) return;
    sent.current = target;
    if (respectDnt && optedOut()) return;
    const url = hitUrl(site, { path: target, entryId, referrer: document.referrer, host: window.location.host });
    void fetch(url, { method: "GET", credentials: "omit", cache: "no-store", keepalive: true }).catch(() => {
    });
  }, [counted, site, entryId, path, pathname, respectDnt]);
  return null;
}
export {
  PageView,
  hitUrl,
  referrerHost
};
