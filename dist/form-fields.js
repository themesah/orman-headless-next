"use client";
// src/components/form-fields.tsx
import { useId } from "react";
import { Captcha } from "@orman/headless-next/captcha";
import { FieldError } from "@orman/headless-next/form";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
function FormFields({ schema, site, captcha, render }) {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    schema.fields.map((field) => /* @__PURE__ */ jsx(Field, { field, render: render?.[field.handle] }, field.handle)),
    schema.honeypot ? /* @__PURE__ */ jsx(Honeypot, { name: schema.honeypot }) : null,
    site ? /* @__PURE__ */ jsx(Captcha, { captcha: schema.captcha, site, ...captcha }) : null
  ] });
}
function Honeypot({ name }) {
  return /* @__PURE__ */ jsx("div", { className: "orman-form__trap", "aria-hidden": "true", style: { position: "absolute", left: "-10000px", top: "auto", width: 1, height: 1, overflow: "hidden" }, children: /* @__PURE__ */ jsx("input", { type: "text", name, tabIndex: -1, autoComplete: "off", defaultValue: "" }) });
}
function Field({ field, render }) {
  const id = useId();
  const props = { id, name: field.handle };
  const bare = field.type === "hidden";
  const control = render ? render(field, props) : /* @__PURE__ */ jsx(Control, { field, id });
  if (bare) return /* @__PURE__ */ jsx(Fragment, { children: control });
  const grouped = field.type === "radio" || field.type === "checkboxes";
  const label = /* @__PURE__ */ jsxs(Fragment, { children: [
    field.display,
    field.required ? /* @__PURE__ */ jsx("span", { "aria-hidden": "true", children: " *" }) : null
  ] });
  return /* @__PURE__ */ jsxs("div", { className: `orman-field orman-field--${field.type}`, "data-field": field.handle, children: [
    grouped ? /* @__PURE__ */ jsxs("fieldset", { children: [
      /* @__PURE__ */ jsx("legend", { className: "orman-field__label", children: label }),
      field.instructions ? /* @__PURE__ */ jsx("p", { className: "orman-field__instructions", children: field.instructions }) : null,
      control
    ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("label", { className: "orman-field__label", htmlFor: id, children: label }),
      field.instructions ? /* @__PURE__ */ jsx("p", { className: "orman-field__instructions", children: field.instructions }) : null,
      control
    ] }),
    /* @__PURE__ */ jsx(FieldError, { name: field.handle })
  ] });
}
function Control({ field, id }) {
  const name = field.handle;
  const common = { id, name, required: field.required || void 0, className: "orman-field__control" };
  const placeholder = field.placeholder || void 0;
  const initial = field.default === null || field.default === void 0 ? void 0 : String(field.default);
  switch (field.type) {
    case "hidden":
      return /* @__PURE__ */ jsx("input", { type: "hidden", name, defaultValue: initial ?? "" });
    case "textarea":
      return /* @__PURE__ */ jsx("textarea", { ...common, placeholder, rows: field.rows, maxLength: field.character_limit, defaultValue: initial });
    case "select":
      return /* @__PURE__ */ jsxs("select", { ...common, multiple: field.multiple, name: field.multiple ? `${name}[]` : name, defaultValue: field.multiple ? void 0 : initial ?? "", children: [
        field.multiple ? null : /* @__PURE__ */ jsx("option", { value: "", children: placeholder ?? "" }),
        (field.options ?? []).map((option) => /* @__PURE__ */ jsx("option", { value: option.value, children: option.label }, option.value))
      ] });
    case "radio":
      return /* @__PURE__ */ jsx(Fragment, { children: (field.options ?? []).map((option) => /* @__PURE__ */ jsxs("label", { className: "orman-field__option", children: [
        /* @__PURE__ */ jsx("input", { type: "radio", name, value: option.value, required: field.required || void 0, defaultChecked: initial === option.value }),
        " ",
        option.label
      ] }, option.value)) });
    case "checkboxes":
      return /* @__PURE__ */ jsx(Fragment, { children: (field.options ?? []).map((option) => /* @__PURE__ */ jsxs("label", { className: "orman-field__option", children: [
        /* @__PURE__ */ jsx("input", { type: "checkbox", name: `${name}[]`, value: option.value }),
        " ",
        option.label
      ] }, option.value)) });
    case "toggle":
    case "checkbox":
      return /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("input", { type: "hidden", name, value: "0" }),
        /* @__PURE__ */ jsx("input", { id, className: "orman-field__control", type: "checkbox", name, value: "1", required: field.required || void 0, defaultChecked: initial === "1" || initial === "true" })
      ] });
    case "integer":
    case "float":
    case "range":
      return /* @__PURE__ */ jsx("input", { ...common, type: "number", min: field.min, max: field.max, step: field.step ?? (field.type === "integer" ? 1 : "any"), placeholder, defaultValue: initial });
    case "date":
      return /* @__PURE__ */ jsx("input", { ...common, type: "date", defaultValue: initial });
    case "assets":
    case "files": {
      const multiple = (field.max_files ?? 1) > 1;
      return /* @__PURE__ */ jsx("input", { ...common, type: "file", multiple, name: multiple ? `${name}[]` : name });
    }
    default:
      return /* @__PURE__ */ jsx("input", { ...common, type: field.input_type || "text", placeholder, maxLength: field.character_limit, defaultValue: initial });
  }
}
export {
  FormFields,
  Honeypot
};
