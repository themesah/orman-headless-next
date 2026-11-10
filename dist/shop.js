"use client";
// src/components/shop.tsx
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

// src/components/shop.tsx
import { jsx, jsxs } from "react/jsx-runtime";
function formatMoney(amount, currency, locale) {
  if (amount === null || !currency) return "";
  try {
    const digits = new Intl.NumberFormat(locale, { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
    return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amount / 10 ** digits);
  } catch {
    return String(amount);
  }
}
var DEFAULT_ADD_TO_CART_LABELS = { add: "Add to cart", adding: "Adding\u2026", added: "Added", outOfStock: "Out of stock", chooseOption: "Choose an option" };
function AddToCart({ productId, product, site, quantity = 1, labels, api: apiOptions, onAdded, className }) {
  const text = { ...DEFAULT_ADD_TO_CART_LABELS, ...labels };
  const [variant, setVariant] = useState("");
  const [state, setState] = useState("idle");
  const [error, setError] = useState(null);
  const chosen = product.variants.find((v) => v.key === variant);
  const needsVariant = product.variants.length > 0 && !chosen;
  const available = chosen ? chosen.in_stock : product.in_stock;
  async function add() {
    if (needsVariant) return setError(text.chooseOption);
    setState("busy");
    setError(null);
    const res = await api("POST", site?.line_items ?? "/!/cargo/cart/line-items", {
      product: productId,
      quantity,
      ...chosen ? { variant: chosen.key } : {}
    }, apiOptions);
    if (!res.ok) {
      setState("idle");
      return setError(res.message);
    }
    setState("done");
    onAdded?.(res.body?.data ?? null);
  }
  const root = ["orman-addtocart", className].filter(Boolean).join(" ");
  return /* @__PURE__ */ jsxs("div", { className: root, children: [
    product.variants.length ? /* @__PURE__ */ jsxs("select", { className: "orman-addtocart__variant", value: variant, onChange: (e) => setVariant(e.target.value), "aria-label": text.chooseOption, children: [
      /* @__PURE__ */ jsx("option", { value: "", children: text.chooseOption }),
      product.variants.map((v) => /* @__PURE__ */ jsxs("option", { value: v.key, disabled: !v.in_stock, children: [
        v.name,
        v.price !== null ? ` \u2014 ${formatMoney(v.price, product.currency)}` : ""
      ] }, v.key))
    ] }) : null,
    /* @__PURE__ */ jsx("button", { type: "button", className: "orman-addtocart__button", disabled: !available || state === "busy", onClick: () => void add(), children: !available ? text.outOfStock : state === "busy" ? text.adding : state === "done" ? text.added : text.add }),
    error ? /* @__PURE__ */ jsx("p", { role: "alert", className: "orman-addtocart__error", children: error }) : null
  ] });
}
var DEFAULT_CART_LABELS = { title: "Your cart", empty: "Your cart is empty.", remove: "Remove", quantity: "Quantity", subtotal: "Subtotal", total: "Total", checkout: "Checkout" };
function Cart({ site, labels, api: apiOptions, checkoutHref, onChange, className }) {
  const text = { ...DEFAULT_CART_LABELS, ...labels };
  const cartUrl = site?.cart ?? "/!/cargo/cart";
  const linesUrl = site?.line_items ?? "/!/cargo/cart/line-items";
  const [cart, setCart] = useState(void 0);
  const [error, setError] = useState(null);
  const set = useCallback((value) => {
    setCart(value);
    onChange?.(value);
  }, [onChange]);
  const load = useCallback(async () => {
    const res = await api("GET", cartUrl, void 0, apiOptions);
    if (res.ok) set(res.body.data);
    else if (res.status === 404) set(null);
    else setError(res.message);
  }, [apiOptions, cartUrl, set]);
  useEffect(() => {
    void load();
  }, [load]);
  const change = useMemo(() => async (id, quantity) => {
    const res = quantity > 0 ? await api("POST", `${linesUrl}/${encodeURIComponent(id)}`, { _method: "PATCH", quantity }, apiOptions) : await api("DELETE", `${linesUrl}/${encodeURIComponent(id)}`, void 0, apiOptions);
    if (!res.ok) return setError(res.message);
    setError(null);
    await load();
  }, [apiOptions, linesUrl, load]);
  const root = ["orman-cart", className].filter(Boolean).join(" ");
  if (cart === void 0) return /* @__PURE__ */ jsx("div", { className: root, "aria-busy": "true" });
  if (!cart || !cart.line_items.length) return /* @__PURE__ */ jsx("p", { className: `${root} orman-cart__empty`, children: text.empty });
  return /* @__PURE__ */ jsxs("div", { className: root, children: [
    /* @__PURE__ */ jsx("ul", { "aria-live": "polite", children: cart.line_items.map((line) => /* @__PURE__ */ jsxs("li", { className: "orman-cart__line", children: [
      /* @__PURE__ */ jsx("span", { className: "orman-cart__title", children: line.product?.title }),
      /* @__PURE__ */ jsx(
        "input",
        {
          className: "orman-cart__quantity",
          type: "number",
          min: 1,
          value: line.quantity,
          "aria-label": text.quantity,
          onChange: (e) => void change(line.id, Number(e.target.value))
        }
      ),
      /* @__PURE__ */ jsx("span", { className: "orman-cart__total", children: line.total }),
      /* @__PURE__ */ jsx("button", { type: "button", className: "orman-cart__remove", onClick: () => void change(line.id, 0), children: text.remove })
    ] }, line.id)) }),
    /* @__PURE__ */ jsxs("p", { className: "orman-cart__total orman-cart__grand", children: [
      text.total,
      ": ",
      cart.grand_total
    ] }),
    error ? /* @__PURE__ */ jsx("p", { role: "alert", className: "orman-cart__error", children: error }) : null,
    checkoutHref ? /* @__PURE__ */ jsx("a", { className: "orman-cart__checkout", href: checkoutHref, children: text.checkout }) : null
  ] });
}
var DEFAULT_CHECKOUT_LABELS = { gateway: "Pay with", pay: "Place order", paying: "Placing order\u2026" };
function Checkout({ site, labels, api: apiOptions, onPlaced, className }) {
  const text = { ...DEFAULT_CHECKOUT_LABELS, ...labels };
  const [gateway, setGateway] = useState(site.gateways[0]?.handle ?? "");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState([]);
  async function place() {
    setBusy(true);
    setErrors([]);
    const res = await api("POST", site.checkout, { payment_gateway: gateway }, apiOptions);
    if (res.ok) {
      if (onPlaced) onPlaced(res.body.confirmation_url);
      else window.location.assign(res.body.confirmation_url);
      return;
    }
    setBusy(false);
    const bag = res.body?.errors;
    setErrors(bag ? Object.values(bag).flat() : [res.message]);
  }
  return /* @__PURE__ */ jsxs("div", { className: ["orman-checkout", className].filter(Boolean).join(" "), children: [
    site.gateways.length > 1 ? /* @__PURE__ */ jsx("select", { className: "orman-checkout__gateway", value: gateway, onChange: (e) => setGateway(e.target.value), "aria-label": text.gateway, children: site.gateways.map((g) => /* @__PURE__ */ jsx("option", { value: g.handle, children: g.title }, g.handle)) }) : null,
    /* @__PURE__ */ jsx("button", { type: "button", className: "orman-checkout__submit", disabled: busy, onClick: () => void place(), children: busy ? text.paying : text.pay }),
    errors.map((message) => /* @__PURE__ */ jsx("p", { role: "alert", className: "orman-checkout__error", children: message }, message))
  ] });
}
function OrderConfirmation({ site, query, labels, api: apiOptions, className }) {
  const text = { title: "Thank you for your order", number: "Order", total: "Total", invalid: "This confirmation link is no longer valid.", ...labels };
  const [order, setOrder] = useState(void 0);
  useEffect(() => {
    if (!query.order || !query.expires || !query.signature) return setOrder(null);
    const base = (site?.order ?? "/!/cargo/orders/{id}").replace("{id}", encodeURIComponent(query.order));
    void api("GET", base, { expires: query.expires, signature: query.signature }, apiOptions).then((res) => setOrder(res.ok ? res.body : null));
  }, [apiOptions, query.expires, query.order, query.signature, site?.order]);
  const root = ["orman-order", className].filter(Boolean).join(" ");
  if (order === void 0) return /* @__PURE__ */ jsx("div", { className: root, "aria-busy": "true" });
  if (!order) return /* @__PURE__ */ jsx("p", { role: "alert", className: `${root} orman-order__error`, children: text.invalid });
  return /* @__PURE__ */ jsxs("div", { className: root, children: [
    /* @__PURE__ */ jsx("h2", { children: text.title }),
    /* @__PURE__ */ jsxs("p", { children: [
      text.number,
      " #",
      order.order_number
    ] }),
    /* @__PURE__ */ jsx("ul", { children: order.line_items.map((line) => /* @__PURE__ */ jsxs("li", { className: "orman-order__line", children: [
      line.quantity,
      " \xD7 ",
      line.product?.title,
      " \u2014 ",
      formatMoney(line.total, order.currency)
    ] }, line.id)) }),
    /* @__PURE__ */ jsxs("p", { className: "orman-order__total", children: [
      text.total,
      ": ",
      formatMoney(order.grand_total, order.currency)
    ] })
  ] });
}
export {
  AddToCart,
  Cart,
  Checkout,
  DEFAULT_ADD_TO_CART_LABELS,
  DEFAULT_CART_LABELS,
  DEFAULT_CHECKOUT_LABELS,
  OrderConfirmation,
  formatMoney
};
