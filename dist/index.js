// src/types.ts
function isBardValue(value) {
  return typeof value === "object" && value !== null && value.type === "bard" && Array.isArray(value.content);
}

// src/components/roadmap.ts
var COMPONENT_ROADMAP = [
  { component: "<AddToCart> / <Cart>", wave: "6.7 Wave 4", needs: "Cargo actions" }
];
export {
  COMPONENT_ROADMAP,
  isBardValue
};
