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
  { component: '<Comments>', wave: '6.5 Wave 2', needs: 'Diskussiya actions (per-user, no-store)' },
  { component: '<Inbox>', wave: '6.5 Wave 2', needs: 'Notifications actions' },
  { component: '<Login>', wave: '6.5 Wave 2', needs: 'front login and the built-in 2FA' },
  { component: '<SessionGate>', wave: '6.5 Wave 2', needs: 'Sessions gate() decision in proxy' },
  { component: '<AddToCart> / <Cart>', wave: '6.7 Wave 4', needs: 'Cargo actions' },
  { component: '<CodeCheck>', wave: '6.7 Wave 4', needs: 'Courses / Scoring actions' },
]
