/** Native screens draw their artwork in web views of their own: nothing waits
 * for a shared engine before a screen can be shown. */
export function useGraphicsEngineLoading() {
  return false;
}
