interface RoadmapEntry {
    component: string;
    /** The task in `docs/addons-headless-plan.md` that builds it. */
    wave: string;
    needs: string;
}
/**
 * Components the plan lists for the kit and that are not built yet (none since 0.5.0: Cargo, Courses and Scoring were the last). Nothing is exported for them: a stub that renders
 * nothing would hide the gap, and the doctor is where a missing piece is reported.
 */
declare const COMPONENT_ROADMAP: readonly RoadmapEntry[];

export { COMPONENT_ROADMAP, type RoadmapEntry };
