// src/components/maintenance-page.tsx
import { Form, FieldError } from "@orman/headless-next/form";

// src/maintenance-html.ts
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

// src/components/maintenance-page.tsx
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
function MaintenancePage({ site, title, message, children, className, ...rest }) {
  const v = maintenanceView(site);
  return /* @__PURE__ */ jsxs("main", { ...rest, className: ["orman-maintenance", className].filter(Boolean).join(" "), children: [
    /* @__PURE__ */ jsx("h1", { className: "orman-maintenance__title", children: title ?? v.title }),
    /* @__PURE__ */ jsx("div", { className: "orman-maintenance__message", children: message ?? (v.messageNodes ? /* @__PURE__ */ jsx(Nodes, { nodes: v.messageNodes }) : /* @__PURE__ */ jsx("p", { children: v.labels.backSoon })) }),
    v.endsAt ? /* @__PURE__ */ jsx("p", { className: "orman-maintenance__countdown", children: /* @__PURE__ */ jsx("time", { dateTime: v.endsAt, children: v.endsAt }) }) : null,
    v.showPrice ? /* @__PURE__ */ jsxs("p", { className: "orman-maintenance__price", children: [
      v.labels.price,
      ": ",
      v.price
    ] }) : null,
    v.contact ? /* @__PURE__ */ jsxs("p", { className: "orman-maintenance__contact", children: [
      v.labels.contact,
      ": ",
      /* @__PURE__ */ jsx("a", { href: `mailto:${v.contact}`, children: v.contact })
    ] }) : null,
    v.collectEmails ? /* @__PURE__ */ jsx(Form, { action: v.subscribe, json: true, className: "orman-maintenance__subscribe", children: (state) => /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("label", { children: [
        v.labels.email,
        " ",
        /* @__PURE__ */ jsx("input", { type: "email", name: "email", required: true })
      ] }),
      " ",
      /* @__PURE__ */ jsx("button", { type: "submit", disabled: state.pending, children: v.labels.notify }),
      /* @__PURE__ */ jsx(FieldError, { name: "email" }),
      state.done ? /* @__PURE__ */ jsx("p", { className: "orman-maintenance__status", role: "status", children: "\u2713" }) : null
    ] }) }) : null,
    v.hasAccess ? /* @__PURE__ */ jsx(Form, { action: v.unlock, json: true, className: "orman-maintenance__unlock", onSuccess: () => window.location.reload(), children: (state) => /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsxs("label", { children: [
        v.labels.password,
        " ",
        /* @__PURE__ */ jsx("input", { type: "password", name: "password", required: true, autoComplete: "off" })
      ] }),
      " ",
      /* @__PURE__ */ jsx("button", { type: "submit", disabled: state.pending, children: v.labels.unlock }),
      /* @__PURE__ */ jsx(FieldError, { name: "password" })
    ] }) }) : null,
    children ? /* @__PURE__ */ jsx("div", { className: "orman-maintenance__extra", children }) : null
  ] });
}
function Nodes({ nodes }) {
  return nodes.map((node, i) => /* @__PURE__ */ jsx(Node, { node }, i));
}
var MARK_TAGS = { bold: "strong", italic: "em", underline: "u", strike: "s" };
function Node({ node }) {
  if (node.type === "text") {
    let out = node.text ?? "";
    for (const mark of node.marks ?? []) {
      const Tag = MARK_TAGS[mark.type];
      if (mark.type === "link" && typeof mark.attrs?.href === "string" && /^(https?:\/\/|\/|mailto:)/i.test(mark.attrs.href)) out = /* @__PURE__ */ jsx("a", { href: mark.attrs.href, children: out });
      else if (Tag) out = /* @__PURE__ */ jsx(Tag, { children: out });
    }
    return out;
  }
  if (node.type === "hardBreak") return /* @__PURE__ */ jsx("br", {});
  const inner = node.content ? /* @__PURE__ */ jsx(Nodes, { nodes: node.content }) : null;
  switch (node.type) {
    case "paragraph":
      return /* @__PURE__ */ jsx("p", { children: inner });
    case "heading": {
      const level = Math.min(6, Math.max(2, Number(node.attrs?.level) || 2));
      const Tag = `h${level}`;
      return /* @__PURE__ */ jsx(Tag, { children: inner });
    }
    case "bulletList":
      return /* @__PURE__ */ jsx("ul", { children: inner });
    case "orderedList":
      return /* @__PURE__ */ jsx("ol", { children: inner });
    case "listItem":
      return /* @__PURE__ */ jsx("li", { children: inner });
    case "blockquote":
      return /* @__PURE__ */ jsx("blockquote", { children: inner });
    default:
      return null;
  }
}
export {
  MaintenancePage
};
