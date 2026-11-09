"use client";
// src/components/code-check.tsx
import { useState } from "react";
import { Form, useFormState } from "@orman/headless-next/form";
import { FormFields } from "@orman/headless-next/form-fields";
import { jsx, jsxs } from "react/jsx-runtime";
function Submit({ label }) {
  const { pending } = useFormState();
  return /* @__PURE__ */ jsx("button", { type: "submit", disabled: pending, className: "orman-codecheck__submit", children: label });
}
function CodeCheck({ tracking, schema, site, captcha, submitLabel = "Check" }) {
  const [result, setResult] = useState(null);
  return /* @__PURE__ */ jsxs(
    Form,
    {
      action: tracking.redeem,
      className: "orman-codecheck",
      onSuccess: (res) => setResult(res.body?.message ?? null),
      onError: () => setResult(null),
      children: [
        /* @__PURE__ */ jsx(FormFields, { schema, site, captcha }),
        /* @__PURE__ */ jsx(Submit, { label: submitLabel }),
        result ? /* @__PURE__ */ jsx("p", { role: "status", className: "orman-codecheck__result", children: result }) : null
      ]
    }
  );
}
export {
  CodeCheck
};
