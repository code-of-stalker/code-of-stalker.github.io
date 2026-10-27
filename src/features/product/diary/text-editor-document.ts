import type { ProductColors } from '../theme';
import type { DiaryTextRun, DiaryTextStyle } from './text-format';
import { diaryTextEditorScript } from './text-editor-runtime.generated';
import assets from '../../../../assets/product/diary/revision-1288/sources.json';
import { iconSource } from '../icon-source';
type Config = { runs: DiaryTextRun[]; colors: Pick<ProductColors, 'text' | 'accent' | 'muted' | 'background' | 'border'> & { faint?: string; secondary?: string; onAccent?: string }; size: number; limit: number };

/** Self-contained DOM adapter used by both the browser and native WebView. */
export function textEditorRuntime(config: Config) {
  const root = document.getElementById('editor')!, toolbar = document.getElementById('toolbar')!;
  let runs = config.runs, selection = { start: 0, end: 0 }, typing: DiaryTextStyle = {}, composing = false, typingAt: number | null = null;
  const history: { runs: DiaryTextRun[]; selection: typeof selection }[] = [], future: typeof history = [];
  const bridge = window as typeof window & { ReactNativeWebView?: { postMessage(text: string): void } };
  const text = () => runs.map(run => run.text).join('');
  function publish() {
    const message = JSON.stringify({ kind: 'diary-editor', text: text(), runs });
    if (bridge.ReactNativeWebView) bridge.ReactNativeWebView.postMessage(message);
    else window.parent.postMessage(message, '*');
  }
  function normalize(items: DiaryTextRun[]) {
    const result: DiaryTextRun[] = [];
    for (const run of items) {
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
  function slice(start: number, end: number) {
    let offset = 0;
    return runs.flatMap(run => {
      const from = Math.max(0, start - offset), to = Math.min(run.text.length, end - offset); offset += run.text.length;
      return to > from ? [{ text: run.text.slice(from, to), style: run.style }] : [];
    });
  }
  function remember() { history.push({ runs: structuredClone(runs), selection: { ...selection } }); if (history.length > 80) history.shift(); future.length = 0; }
  function readSelection() {
    const selected = window.getSelection();
    if (!selected?.rangeCount || !root.contains(selected.anchorNode) || !root.contains(selected.focusNode)) return;
    const range = selected.getRangeAt(0), before = document.createRange(); before.selectNodeContents(root); before.setEnd(range.startContainer, range.startOffset);
    selection = { start: before.toString().length, end: before.toString().length + range.toString().length };
    if (selection.start === selection.end && typingAt !== selection.start) { typingAt = null; typing = { ...(slice(Math.max(0, selection.start - 1), Math.max(1, selection.start))[0]?.style ?? {}) }; }
    updateTools();
  }
  function restore() {
    const nodes: Text[] = [], walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    const point = (index: number): [Node, number] => { for (const node of nodes) { if (index <= node.length) return [node, index]; index -= node.length; } return [root, root.childNodes.length]; };
    const range = document.createRange(), [start, startAt] = point(selection.start), [end, endAt] = point(selection.end);
    range.setStart(start, startAt); range.setEnd(end, endAt); const selected = window.getSelection(); selected?.removeAllRanges(); selected?.addRange(range);
  }
  function render(focus = false) {
    const scroll = root.scrollTop; root.replaceChildren();
    for (const run of runs) {
      const span = document.createElement('span'), style = run.style;
      span.textContent = run.text; span.style.fontSize = `${style.size ?? config.size}px`;
      span.style.color = config.colors[style.color ?? 'text'] ?? config.colors.text; span.dataset.ink = style.color ?? 'text';
      span.style.fontFamily = style.bold ? 'DisketMonoBold,monospace' : 'DisketMono,monospace';
      span.style.fontWeight = style.bold ? '700' : '400'; span.style.fontStyle = style.italic ? 'italic' : 'normal';
      span.style.textDecoration = style.underline ? 'underline' : 'none'; root.append(span);
    }
    if (focus) { root.focus({ preventScroll: true }); restore(); } root.scrollTop = scroll; updateTools();
  }
  function updateTools() {
    const styles = selection.start === selection.end ? [typing] : slice(selection.start, selection.end).map(run => run.style);
    for (const key of ['bold', 'italic', 'underline'] as const) toolbar.querySelector(`[data-format="${key}"]`)?.setAttribute('aria-pressed', String(styles.length > 0 && styles.every(style => style[key])));
    for (const button of toolbar.querySelectorAll<HTMLButtonElement>('[data-size]')) button.setAttribute('aria-pressed', String(styles.length > 0 && styles.every(style => (style.size ?? config.size) === Number(button.dataset.size))));
    for (const button of toolbar.querySelectorAll<HTMLButtonElement>('[data-color]')) {
      const pressed = styles.length > 0 && styles.every(style => (style.color ?? 'text') === button.dataset.color);
      button.setAttribute('aria-pressed', String(pressed));
      const image = button.querySelector('img'); if (image) image.src = (pressed ? button.dataset.selectedIcon : button.dataset.unselectedIcon)!;
    }
  }
  function apply(patch: DiaryTextStyle) {
    remember();
    if (selection.start === selection.end) { typing = { ...typing, ...patch }; typingAt = selection.start; updateTools(); return; }
    runs = normalize([...slice(0, selection.start), ...slice(selection.start, selection.end).map(run => ({ ...run, style: { ...run.style, ...patch } })), ...slice(selection.end, text().length)]);
    render(true); publish();
  }
  function insert(value: string) {
    remember(); const available = config.limit - text().length + selection.end - selection.start, added = value.slice(0, Math.max(0, available));
    runs = normalize([...slice(0, selection.start), { text: added, style: { ...typing } }, ...slice(selection.end, text().length)]);
    selection = { start: selection.start + added.length, end: selection.start + added.length }; typingAt = selection.start; render(true); publish();
  }
  function undo(redo: boolean) {
    const stack = redo ? future : history, target = stack.pop(); if (!target) return;
    (redo ? history : future).push({ runs: structuredClone(runs), selection: { ...selection } }); runs = target.runs; selection = target.selection; render(true); publish();
  }
  const palette = Object.fromEntries(Object.entries(config.colors).map(([key, color]) => { const probe = document.createElement('span'); probe.style.color = color; document.body.append(probe); const resolved = getComputedStyle(probe).color; probe.remove(); return [key, resolved]; }));
  function acceptInput() {
    if (composing) return;
    readSelection(); remember(); const next: DiaryTextRun[] = [], walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode, css = getComputedStyle(node.parentElement!), inherited = node.parentElement!.closest<HTMLElement>('[data-ink]')?.dataset.ink;
      const color = inherited && ['text', 'accent', 'secondary', 'muted', 'faint'].includes(inherited) ? inherited : Object.keys(palette).find(key => palette[key] === css.color) ?? 'text';
      next.push({ text: node.textContent ?? '', style: { size: [12, 16, 20, 24].includes(parseInt(css.fontSize)) ? parseInt(css.fontSize) as DiaryTextStyle['size'] : undefined,
        color: ['text', 'accent', 'secondary', 'muted', 'faint'].includes(color) ? color as DiaryTextStyle['color'] : 'text', bold: Number(css.fontWeight) >= 600,
        italic: css.fontStyle === 'italic', underline: css.textDecorationLine.includes('underline') } });
    }
    runs = normalize(next); if (text().length > config.limit) { runs = slice(0, config.limit); selection.start = Math.min(selection.start, config.limit); selection.end = Math.min(selection.end, config.limit); }
    render(true); publish();
  }
  document.addEventListener('selectionchange', readSelection);
  root.addEventListener('compositionstart', () => { composing = true; });
  root.addEventListener('compositionend', () => { composing = false; acceptInput(); });
  root.addEventListener('input', acceptInput);
  root.addEventListener('beforeinput', (event: InputEvent) => {
    readSelection();
    if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') { event.preventDefault(); insert('\n'); }
    else if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') { event.preventDefault(); undo(event.inputType === 'historyRedo'); }
    else if (event.inputType === 'insertText' && event.data && !event.isComposing) { event.preventDefault(); insert(event.data); }
  });
  root.addEventListener('paste', (event: ClipboardEvent) => { event.preventDefault(); readSelection(); insert(event.clipboardData?.getData('text/plain') ?? ''); });
  root.addEventListener('drop', event => event.preventDefault());
  root.addEventListener('keydown', (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
    if (['b', 'i', 'u'].includes(key)) { event.preventDefault(); readSelection(); const style = { b: 'bold', i: 'italic', u: 'underline' }[key] as 'bold' | 'italic' | 'underline'; apply({ [style]: !(slice(selection.start, Math.max(selection.end, selection.start + 1))[0]?.style[style] ?? typing[style]) }); }
    if (key === 'z') { event.preventDefault(); undo(event.shiftKey); }
  });
  toolbar.addEventListener('mousedown', event => event.preventDefault());
  toolbar.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!button || button.disabled) return;
    if (button.dataset.history) { undo(button.dataset.history === 'redo'); return; }
    if (button.dataset.format === 'clear') apply({ size: undefined, color: 'text', bold: false, italic: false, underline: false });
    else if (button.dataset.format) { const key = button.dataset.format as 'bold' | 'italic' | 'underline'; apply({ [key]: button.getAttribute('aria-pressed') !== 'true' }); }
    else if (button.dataset.size) apply({ size: Number(button.dataset.size) as DiaryTextStyle['size'] });
    else if (button.dataset.color) apply({ color: button.dataset.color as DiaryTextStyle['color'] });
  });
  render(); publish();
}

export function textEditorDocument(config: Config, regularFont: string, boldFont: string) {
  const encoded = JSON.stringify(config).replace(/</g, '\\u003c');
  const image = (svg: string) => 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  const inkButton = (ink: 'text' | 'secondary' | 'muted' | 'faint', label: string) => {
    const color = config.colors[ink] ?? config.colors.muted;
    const circle = assets['muted-color'].replaceAll('#B69D4B', color);
    const selected = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="8" fill="${color}"/><path d="m4.5 8.1 2.3 2.4 4.9-5.1" fill="none" stroke="${config.colors.background}" stroke-width=".75" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    return `<button data-color="${ink}" aria-label="${label}" aria-pressed="false" data-unselected-icon="${image(circle)}" data-selected-icon="${image(selected)}"><img alt="" src="${image(circle)}" width="16" height="16"></button>`;
  };
  const clear = iconSource('M2 17 7 5l5 12M4 12h6M12 17l7-8 4 4-7 8h-4l-2-2ZM16 12l4 4', config.colors.faint ?? config.colors.muted, 16).uri;
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  @font-face{font-family:DisketMono;src:url('${regularFont}')}@font-face{font-family:DisketMonoBold;src:url('${boldFont}');font-weight:700}
  *{box-sizing:border-box}html,body{height:100%;margin:0;background:transparent;color:${config.colors.text};font-family:DisketMono,monospace}
  body{display:flex;flex-direction:column}#toolbar{height:69px;flex:none;display:flex;flex-direction:column;justify-content:space-between;padding:6px 12px 10px;background:${config.colors.background}}
  button{position:relative;min-width:17px;width:17px;height:27px;border:0;background:transparent;color:${config.colors.faint ?? config.colors.muted};font:12px DisketMono,monospace;padding:0;cursor:pointer;display:flex;align-items:center;justify-content:center}
  button:after{content:'';position:absolute;inset:-3px -3px}button:disabled{opacity:.3}button:focus-visible{outline:.75px solid ${config.colors.accent};outline-offset:2px}
  .tools{display:flex;justify-content:space-between;width:100%;height:27px}.tools button{width:27px;min-width:27px}.tools button[aria-pressed=true]{background:${config.colors.accent};color:${config.colors.onAccent ?? config.colors.background}}.palette{display:flex;gap:19.4286px;height:24px;align-items:center}.palette button{width:16px;min-width:16px;height:24px}.palette img{display:block}
  #editor{flex:1;min-height:0;margin-top:10px;background:${config.colors.background};overflow-y:auto;overflow-x:hidden;padding:12px 12px 6px;outline:none;font-size:${config.size}px;line-height:1.4;white-space:pre-wrap;overflow-wrap:anywhere;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:${config.colors.muted} transparent;caret-color:${config.colors.accent}}
  #editor:empty:before{content:'ЗАПИШИ ЧТО ОЩУТИЛ';color:${config.colors.faint ?? config.colors.muted};pointer-events:none}#editor::-webkit-scrollbar{width:4px}#editor::-webkit-scrollbar-thumb{background:${config.colors.muted}}::selection{background:${config.colors.accent};color:${config.colors.background}}
  </style></head><body><div id="toolbar" role="toolbar" aria-label="Форматирование текста">
  <div class="tools">${[12,16,20,24].map(size => `<button data-size="${size}" aria-label="Размер ${size}" aria-pressed="false">${size}</button>`).join('')}
  <button data-format="bold" aria-label="Жирный" aria-pressed="false"><b>Ж</b></button><button data-format="italic" aria-label="Курсив" aria-pressed="false"><i>К</i></button><button data-format="underline" aria-label="Подчёркнутый" aria-pressed="false"><u>Ч</u></button><button data-format="clear" aria-label="Убрать оформление" title="Убрать оформление"><img alt="" src="${clear}" width="16" height="16"></button></div>
  <div class="palette">${inkButton('text', 'Цвет текста')}${inkButton('secondary', 'Дополнительный акцент')}${inkButton('muted', 'Приглушённый цвет')}${inkButton('faint', 'Мягкий цвет')}</div>
  </div><div id="editor" role="textbox" aria-label="Большой редактор текста" aria-multiline="true" contenteditable="true" spellcheck="true"></div><script type="application/json" id="diary-editor-config">${encoded}</script><script>${diaryTextEditorScript}</script></body></html>`;
}
