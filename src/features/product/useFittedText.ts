export type FittedTextOptions = { enabled: boolean; text: string; size: number; minimum: number; tracking: number };
export function useFittedText({ size }: FittedTextOptions) {
  return { ref: undefined, fontSize: size, letterSpacing: undefined as number | undefined };
}
