/** Art 2026-11-11: the report plate folds by a vertical drag, not by an arrow beside the plus.
 * Open plate: drag up folds it. Folded strip: drag down unfolds it. A tap still opens the report. */
const claimDistance = 8, foldDistance = 24;

const vertical = (dx: number, dy: number) => Math.abs(dy) > Math.abs(dx);
const toward = (collapsed: boolean, dy: number) => collapsed ? dy : -dy;

/** True once the finger has moved far enough the right way to take the gesture from the tap. */
export function claimsReportFold(collapsed: boolean, dx: number, dy: number) {
  return vertical(dx, dy) && toward(collapsed, dy) > claimDistance;
}

/** True when the released drag should flip the plate. */
export function flipsReportFold(collapsed: boolean, dx: number, dy: number) {
  return vertical(dx, dy) && toward(collapsed, dy) >= foldDistance;
}
