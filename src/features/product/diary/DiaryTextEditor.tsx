import { useEffect, useState } from 'react';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { WebView } from 'react-native-webview';
import { useThemeColors } from '../ProductTheme';
import { ProductText } from '../ui';
import { DIARY_TEXT_LIMIT } from '../state/model';
import { textEditorDocument } from './text-editor-document';
import { validateTextRuns } from './text-format';
import type { DiaryTextEditorProps } from './DiaryTextEditor.types';
import { diaryTextColors } from './text-colors';

let fonts: Promise<string[]> | undefined;
function editorFonts() {
  return fonts ??= Promise.all([require('../../../../assets/product/fonts/Disket-Mono-Regular.ttf'), require('../../../../assets/product/fonts/Disket-Mono-Bold.ttf')].map(async module => {
    const asset = await Asset.fromModule(module).downloadAsync();
    if (!asset.localUri) throw new Error('Не удалось открыть шрифт редактора.');
    return 'data:font/ttf;base64,' + await new File(asset.localUri).base64();
  })).catch(error => { fonts = undefined; throw error; });
}
export function DiaryTextEditor({ text, runs, onChange, size }: DiaryTextEditorProps) {
  const colors = diaryTextColors(useThemeColors()), [initial] = useState({ text, runs, colors, size }), [html, setHtml] = useState(''), [error, setError] = useState('');
  useEffect(() => {
    let mounted = true;
    editorFonts().then(([regular, bold]) => { if (mounted) setHtml(textEditorDocument({ runs: initial.runs.length ? initial.runs : initial.text ? [{ text: initial.text, style: {} }] : [], colors: initial.colors, size: initial.size, limit: DIARY_TEXT_LIMIT }, regular, bold)); })
      .catch(() => { if (mounted) setError('Не удалось открыть редактор. Черновик сохранён — закрой шторку и попробуй ещё раз.'); });
    return () => { mounted = false; };
  }, [initial]);
  if (!html || error) return <ProductText>{error || 'ОТКРЫВАЕМ РЕДАКТОР…'}</ProductText>;
  return <WebView testID="diary-editor" source={{ html }} originWhitelist={['*']} style={{ flex: 1, backgroundColor: 'transparent' }}
    keyboardDisplayRequiresUserAction={false} hideKeyboardAccessoryView={false} automaticallyAdjustContentInsets={false}
    onShouldStartLoadWithRequest={request => request.url === 'about:blank'}
    onMessage={event => { try { const value = JSON.parse(event.nativeEvent.data); if (value.kind !== 'diary-editor' || typeof value.text !== 'string' || value.text.length > DIARY_TEXT_LIMIT) return; validateTextRuns(value.runs, value.text); onChange(value.text, value.runs); } catch { /* Preserve the draft on malformed messages. */ } }}
    onError={() => setError('Редактор не открылся. Черновик сохранён.')} />;
}
