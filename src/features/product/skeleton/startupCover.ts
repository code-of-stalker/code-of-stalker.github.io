/** Which startup skeleton covers the app. The first one dissolves into the device setup screen.
 * Leaving that screen before the graphics engine has arrived (keeping the default settings on a
 * slow network) holds the next screen again, so a fresh skeleton covers it instead of a blank page. */
export type StartupCover = { count: number; holding: boolean };
export const startupCover = (holding: boolean): StartupCover => ({ count: 0, holding });
export function nextStartupCover(cover: StartupCover, holding: boolean): StartupCover {
  if (cover.holding === holding) return cover;
  return { count: cover.count + (holding ? 1 : 0), holding };
}
