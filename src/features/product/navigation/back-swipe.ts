/** Horizontal intent never takes over a vertical scroll or a short tap. */
export class BackSwipe {
  private start: { x: number; y: number; at: number; threshold: number } | null = null;
  private claimed = false;
  begin(x: number, y: number, at: number, width = 320) { this.claimed = false; this.start = { x, y, at, threshold: Math.max(72, Math.min(120, width * .24)) }; }
  cancel() { this.start = null; }
  move(x: number, y: number) {
    if (!this.start) return null;
    const dx = x - this.start.x, dy = Math.abs(y - this.start.y);
    if (dx < -18 || !this.claimed && dy > 12 && dy > Math.abs(dx) * .8) { this.cancel(); return null; }
    if (!this.claimed && dx > 12 && dx > dy * 1.7) this.claimed = true;
    return { claimed: this.claimed, distance: Math.max(0, dx), progress: Math.min(1, Math.max(0, dx) / this.start.threshold), y: this.start.y };
  }
  finish(x: number, y: number, at: number) {
    const sample = this.move(x, y), start = this.start; this.cancel();
    if (!start) return false;
    const dx = x - start.x, dy = Math.abs(y - start.y), elapsed = at - start.at;
    return !!sample?.claimed && dx >= start.threshold && dx > dy * 1.7 && elapsed >= 0;
  }
}
