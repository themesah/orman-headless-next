export interface RoadmapEntry {
  component: string
  /** The task in `docs/addons-headless-plan.md` that builds it. */
  wave: string
  needs: string
}

/**
 * Components the plan lists for the kit and that are not built yet. Nothing is exported for them: a stub that renders
 * nothing would hide the gap, and the doctor is where a missing piece is reported.
 */
export const COMPONENT_ROADMAP: readonly RoadmapEntry[] = [
  { component: '<AddToCart> / <Cart>', wave: '6.7 Wave 4', needs: 'Cargo actions' },
  { component: '<CodeCheck>', wave: '6.7 Wave 4', needs: 'Courses / Scoring actions' },
]
