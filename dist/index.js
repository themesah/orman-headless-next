// src/types.ts
function isBardValue(value) {
  return typeof value === "object" && value !== null && value.type === "bard" && Array.isArray(value.content);
}

// src/components/roadmap.ts
var COMPONENT_ROADMAP = [];
export {
  COMPONENT_ROADMAP,
  isBardValue
};
