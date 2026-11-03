// src/components/maintenance-page.tsx
import { jsx, jsxs } from "react/jsx-runtime";
function MaintenancePage({ title = "Back soon", message = "The site is down for maintenance. Please check back shortly.", children, className, ...rest }) {
  return /* @__PURE__ */ jsxs("main", { ...rest, className: ["orman-maintenance", className].filter(Boolean).join(" "), children: [
    /* @__PURE__ */ jsx("h1", { className: "orman-maintenance__title", children: title }),
    message ? /* @__PURE__ */ jsx("p", { className: "orman-maintenance__message", children: message }) : null,
    children ? /* @__PURE__ */ jsx("div", { className: "orman-maintenance__extra", children }) : null
  ] });
}
export {
  MaintenancePage
};
