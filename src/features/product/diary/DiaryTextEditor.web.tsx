import { useEffect, useRef, useState } from 'react';
import { Asset } from 'expo-asset';
import { useThemeColors } from '../ProductTheme';
import { textEditorDocument } from './text-editor-document';
import { validateTextRuns } from './text-format';
import { DIARY_TEXT_LIMIT } from '../state/model';
import type { DiaryTextEditorProps } from './DiaryTextEditor.types';
import { diaryTextColors } from './text-colors';

export function DiaryTextEditor({ text, runs, onChange, size }: DiaryTextEditorProps) {
  const colors = diaryTextColors(useThemeColors()), frame = useRef<HTMLIFrameElement>(null), changed = useRef(onChange);
  useEffect(() => { changed.current = onChange; }, [onChange]);
  const [html] = useState(() => textEditorDocument({ runs: runs.length ? runs : text ? [{ text, style: {} }] : [], colors, size, limit: DIARY_TEXT_LIMIT },
    new URL(Asset.fromModule(require('../../../../assets/product/fonts/Disket-Mono-Regular.ttf')).uri, document.baseURI).href,
    new URL(Asset.fromModule(require('../../../../assets/product/fonts/Disket-Mono-Bold.ttf')).uri, document.baseURI).href));
  useEffect(() => {
    const message = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || typeof event.data !== 'string') return;
      try { const value = JSON.parse(event.data); if (value.kind !== 'diary-editor' || typeof value.text !== 'string' || value.text.length > DIARY_TEXT_LIMIT) return;
        validateTextRuns(value.runs, value.text); changed.current(value.text, value.runs);
      } catch { /* Ignore unrelated or incomplete frame messages. */ }
    };
    window.addEventListener('message', message); return () => window.removeEventListener('message', message);
  }, []);
  return <iframe ref={frame} data-testid="diary-editor" title="Редактор наблюдения" srcDoc={html} style={{ flex: 1, width: '100%', minHeight: 0, border: 0, background: 'transparent' }} />;
}
