export type DiaryInk = 'text' | 'accent' | 'secondary' | 'muted' | 'faint';
export type DiaryTextStyle = { size?: 12 | 16 | 20 | 24; color?: DiaryInk; bold?: boolean; italic?: boolean; underline?: boolean };
export type DiaryTextRun = { text: string; style: DiaryTextStyle };

export function normalizeTextRuns(runs: readonly DiaryTextRun[]): DiaryTextRun[] {
  const result: DiaryTextRun[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const style: DiaryTextStyle = {};
    if (run.style.size !== undefined) style.size = run.style.size;
    if (run.style.color && run.style.color !== 'text') style.color = run.style.color;
    if (run.style.bold) style.bold = true;
    if (run.style.italic) style.italic = true;
    if (run.style.underline) style.underline = true;
    const last = result.at(-1);
    if (last && JSON.stringify(last.style) === JSON.stringify(style)) last.text += run.text;
    else result.push({ text: run.text, style });
  }
  return result;
}
export function sliceTextRuns(runs: readonly DiaryTextRun[], start: number, end: number): DiaryTextRun[] {
  let offset = 0;
  return normalizeTextRuns(runs.flatMap(run => {
    const from = Math.max(0, start - offset), to = Math.min(run.text.length, end - offset);
    offset += run.text.length;
    return to > from ? [{ text: run.text.slice(from, to), style: run.style }] : [];
  }));
}
export function replaceTextRuns(runs: readonly DiaryTextRun[], start: number, end: number, text: string, style: DiaryTextStyle): DiaryTextRun[] {
  const length = runs.reduce((n, run) => n + run.text.length, 0);
  return normalizeTextRuns([...sliceTextRuns(runs, 0, start), { text, style }, ...sliceTextRuns(runs, end, length)]);
}
export function formatTextRuns(runs: readonly DiaryTextRun[], start: number, end: number, patch: DiaryTextStyle): DiaryTextRun[] {
  const length = runs.reduce((n, run) => n + run.text.length, 0);
  return normalizeTextRuns([...sliceTextRuns(runs, 0, start), ...sliceTextRuns(runs, start, end).map(run => ({ ...run, style: { ...run.style, ...patch } })), ...sliceTextRuns(runs, end, length)]);
}
/** A compact-field edit retains the formatting of untouched text. */
export function rebaseTextRuns(before: string, after: string, runs: readonly DiaryTextRun[]): DiaryTextRun[] {
  if (!runs.length) return after ? [{ text: after, style: {} }] : [];
  let start = 0, tail = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  while (tail < before.length - start && tail < after.length - start && before[before.length - 1 - tail] === after[after.length - 1 - tail]) tail++;
  const inherited = sliceTextRuns(runs, Math.max(0, start - 1), Math.max(1, start))[0]?.style ?? {};
  return replaceTextRuns(runs, start, before.length - tail, after.slice(start, after.length - tail), inherited);
}
export function trimTextRuns(text: string, runs: readonly DiaryTextRun[]): DiaryTextRun[] {
  const start = text.length - text.trimStart().length;
  return sliceTextRuns(runs, start, text.trimEnd().length);
}
export function validateTextRuns(value: unknown, text: string): asserts value is DiaryTextRun[] {
  if (!Array.isArray(value) || value.length > 10000 || value.some(run => !run || typeof run.text !== 'string' || !run.text || !run.style ||
    Object.keys(run.style).some(key => !['size', 'color', 'bold', 'italic', 'underline'].includes(key)) ||
    (run.style.size !== undefined && ![12, 16, 20, 24].includes(run.style.size)) ||
    (run.style.color !== undefined && !['text', 'accent', 'secondary', 'muted', 'faint'].includes(run.style.color)) ||
    ['bold', 'italic', 'underline'].some(key => run.style[key] !== undefined && typeof run.style[key] !== 'boolean')) ||
    value.map(run => run.text).join('') !== text) throw new Error('Некорректное оформление текста дневника.');
}
