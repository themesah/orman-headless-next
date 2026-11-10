// src/components/bard.tsx
import { jsx } from "react/jsx-runtime";
var CLASS_NAMES = /^[A-Za-z0-9_:/.[\]%#@ -]+$/;
var COLOR = /^(?:#[0-9a-f]{3,8}|[a-z]{3,30}|(?:rgb|hsl|hwb|lab|lch|oklab|oklch)a?\(\s*[-\d.%,/\sa-z]+\))$/i;
var SIZE = /^\d{1,4}(?:\.\d{1,4})?(?:px|rem|em|%|pt|vw|vh|ch|ex)?$/i;
var SAFE_HREF = /^(?:https?:\/\/|\/(?!\/)|#|mailto:|tel:)/i;
var SAFE_SRC = /^(?:https?:\/\/|\/(?!\/))/i;
function isSafeColor(value) {
  return typeof value === "string" && value.length <= 80 && COLOR.test(value.trim()) && !/url|expression|javascript|var\(/i.test(value);
}
function isSafeSize(value) {
  return (typeof value === "string" || typeof value === "number") && SIZE.test(String(value).trim());
}
function className(attrs) {
  const value = attrs?.class;
  return typeof value === "string" && value.length <= 200 && CLASS_NAMES.test(value) ? value.trim() : void 0;
}
function renderBard(nodes, options = {}) {
  return (nodes ?? []).map((node, i) => /* @__PURE__ */ jsx(Node, { node, options }, i));
}
function Bard({ value, className: wrapperClass, as = "div", ...options }) {
  if (!value || typeof value !== "object" || value.type !== "bard" || !Array.isArray(value.content)) return null;
  const content = renderBard(value.content, options);
  if (as === false) return content;
  const Tag = as;
  return /* @__PURE__ */ jsx(Tag, { className: wrapperClass, children: content });
}
function Node({ node, options }) {
  if (node.type === "text") return /* @__PURE__ */ jsx(Text, { node, options });
  if (node.type === "set") return renderSet(node, options);
  if (node.type === "btsPin") return renderPin(node, options);
  const children = node.content?.length ? renderBard(node.content, options) : null;
  const custom = options.nodes?.[node.type]?.(node, children);
  if (custom !== void 0) return custom;
  const cls = className(node.attrs);
  switch (node.type) {
    case "paragraph":
      return /* @__PURE__ */ jsx("p", { className: cls, children });
    case "heading": {
      const Tag = `h${Math.min(6, Math.max(1, Number(node.attrs?.level) || 2))}`;
      return /* @__PURE__ */ jsx(Tag, { className: cls, children });
    }
    case "bulletList":
      return /* @__PURE__ */ jsx("ul", { className: cls, children });
    case "orderedList": {
      const start = Number(node.attrs?.start);
      return /* @__PURE__ */ jsx("ol", { className: cls, start: Number.isInteger(start) && start > 1 ? start : void 0, children });
    }
    case "listItem":
      return /* @__PURE__ */ jsx("li", { className: cls, children });
    case "blockquote":
      return /* @__PURE__ */ jsx("blockquote", { className: cls, children });
    case "codeBlock":
      return /* @__PURE__ */ jsx("pre", { className: cls, children: /* @__PURE__ */ jsx("code", { children }) });
    case "horizontalRule":
      return /* @__PURE__ */ jsx("hr", { className: cls });
    case "hardBreak":
      return /* @__PURE__ */ jsx("br", {});
    case "image": {
      const src = node.attrs?.src;
      if (typeof src !== "string" || !SAFE_SRC.test(src)) return null;
      return /* @__PURE__ */ jsx("img", { src, alt: typeof node.attrs?.alt === "string" ? node.attrs.alt : "", title: typeof node.attrs?.title === "string" ? node.attrs.title : void 0, className: cls });
    }
    case "table":
      return /* @__PURE__ */ jsx("table", { className: cls, children: /* @__PURE__ */ jsx("tbody", { children }) });
    case "tableRow":
      return /* @__PURE__ */ jsx("tr", { children });
    case "tableHeader":
      return /* @__PURE__ */ jsx("th", { colSpan: span(node.attrs?.colspan), rowSpan: span(node.attrs?.rowspan), children });
    case "tableCell":
      return /* @__PURE__ */ jsx("td", { colSpan: span(node.attrs?.colspan), rowSpan: span(node.attrs?.rowspan), children });
    case "details":
      return /* @__PURE__ */ jsx("details", { className: cls, children });
    case "detailsSummary":
      return /* @__PURE__ */ jsx("summary", { children });
    case "detailsContent":
      return /* @__PURE__ */ jsx("div", { children });
    case "btsDiv":
      return /* @__PURE__ */ jsx("div", { className: cls, children });
    default:
      return children;
  }
}
function span(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 1 && n <= 50 ? n : void 0;
}
function renderSet(node, options) {
  const set = node;
  const render = typeof set.set === "string" ? options.sets?.[set.set] : void 0;
  return render ? render(set.values ?? {}, set.id ?? null) : null;
}
function renderPin(node, options) {
  const values = node.attrs?.values ?? {};
  const render = typeof values.type === "string" ? options.pins?.[values.type] : void 0;
  const id = node.attrs?.id;
  return render ? render(values, typeof id === "string" || typeof id === "number" ? id : null) : null;
}
function Text({ node, options }) {
  let out = node.text ?? "";
  for (const mark of node.marks ?? []) {
    const custom = options.marks?.[mark.type]?.(mark, out);
    out = custom !== void 0 ? custom : defaultMark(mark, out);
  }
  return out;
}
function defaultMark(mark, children) {
  switch (mark.type) {
    case "bold":
      return /* @__PURE__ */ jsx("strong", { children });
    case "italic":
      return /* @__PURE__ */ jsx("em", { children });
    case "strike":
      return /* @__PURE__ */ jsx("s", { children });
    case "underline":
      return /* @__PURE__ */ jsx("u", { children });
    case "code":
      return /* @__PURE__ */ jsx("code", { children });
    case "subscript":
      return /* @__PURE__ */ jsx("sub", { children });
    case "superscript":
      return /* @__PURE__ */ jsx("sup", { children });
    case "small":
      return /* @__PURE__ */ jsx("small", { children });
    case "highlight":
      return /* @__PURE__ */ jsx("mark", { children });
    case "link": {
      const href = mark.attrs?.href;
      if (typeof href !== "string" || !SAFE_HREF.test(href.trim())) return children;
      const blank = mark.attrs?.target === "_blank";
      return /* @__PURE__ */ jsx("a", { href: href.trim(), target: blank ? "_blank" : void 0, rel: blank ? "noopener noreferrer" : void 0, className: className(mark.attrs), children });
    }
    case "textColor": {
      const color = mark.attrs?.color;
      return isSafeColor(color) ? /* @__PURE__ */ jsx("span", { style: { color: color.trim() }, children }) : children;
    }
    case "fontSize": {
      const size = mark.attrs?.fontSize;
      return isSafeSize(size) ? /* @__PURE__ */ jsx("span", { style: { fontSize: String(size).trim() }, children }) : children;
    }
    case "btsSpan": {
      const cls = className(mark.attrs);
      return cls ? /* @__PURE__ */ jsx("span", { className: cls, children }) : children;
    }
    default:
      return children;
  }
}
export {
  Bard,
  isSafeColor,
  isSafeSize,
  renderBard
};
