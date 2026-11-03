// src/types.ts
function isBardValue(value) {
  return typeof value === "object" && value !== null && value.type === "bard" && Array.isArray(value.content);
}

// src/components/roadmap.ts
var COMPONENT_ROADMAP = [
  { component: "<Captcha>", wave: "6.4 Wave 1", needs: "Turnstile and Kaptcha widgets that feed <Form> a token field (see Form.prepare)" },
  { component: "<Comments>", wave: "6.5 Wave 2", needs: "Diskussiya actions (per-user, no-store)" },
  { component: "<Inbox>", wave: "6.5 Wave 2", needs: "Notifications actions" },
  { component: "<Login>", wave: "6.5 Wave 2", needs: "front login and the built-in 2FA" },
  { component: "<SessionGate>", wave: "6.5 Wave 2", needs: "Sessions gate() decision in proxy" },
  { component: "<AddToCart> / <Cart>", wave: "6.7 Wave 4", needs: "Cargo actions" },
  { component: "<CodeCheck>", wave: "6.7 Wave 4", needs: "Courses / Scoring actions" }
];
export {
  COMPONENT_ROADMAP,
  isBardValue
};
