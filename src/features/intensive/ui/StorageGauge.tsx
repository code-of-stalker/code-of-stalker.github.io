import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useThemeColors, useThemeStyles } from '../../product/ProductTheme';
import type { ProductColors } from '../../product/theme';
import type { Storage } from '../backend';
import type { IntensiveSession } from '../session';
import { ListGroup, ListItem } from './chrome';
import { Note, problemText } from './parts';

/** From this share of the database on, the main admin is warned. */
const WARN_AT = .8;

/** MB as the server counts them (1,000,000 bytes), one decimal below 10. */
const mb = (bytes: number) => bytes < 10_000_000 ? (bytes / 1e6).toFixed(1).replace('.', ',') : String(Math.round(bytes / 1e6));

/**
 * The main admin's gauge of the database: the free project holds 500 MB, voice stops at 90%
 * (the server refuses it), text goes on. Nothing is deleted by itself.
 */
export function StorageGauge({ session }: { session: IntensiveSession }) {
  const styles = useThemeStyles(createStyles), colors = useThemeColors();
  const [storage, setStorage] = useState<Storage | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    session.storage().then(
      next => { if (alive) { setStorage(next); setError(''); } },
      problem => { if (alive) setError(problemText(problem, 'Не удалось узнать, сколько места занято.', true)); });
    return () => { alive = false; };
  }, [session]);

  if (!storage) return <View style={styles.stack}>
    <ListGroup card caption="МЕСТО НА СЕРВЕРЕ"><ListItem glyph="storage" title={error ? 'Нет данных' : 'Считаю место…'} last /></ListGroup>
    {error ? <Note tone="error">{error}</Note> : null}
  </View>;

  const { usedBytes, totalBytes, voiceStopBytes } = storage;
  const share = Math.min(1, usedBytes / totalBytes);
  const stopped = usedBytes >= voiceStopBytes, low = !stopped && share >= WARN_AT;
  const tone = stopped ? 'error' : 'text';
  const title = `Занято ${mb(usedBytes)} МБ из ${mb(totalBytes)} МБ`;
  const detail = stopped ? 'ГОЛОСОВЫЕ НЕ ПРИНИМАЮТСЯ · ТЕКСТ РАБОТАЕТ' : `${Math.round(share * 100)}% · ГОЛОСОВЫЕ ДО ${mb(voiceStopBytes)} МБ`;
  const bar = <View style={styles.track} accessible={false}>
    <View style={[styles.fill, { width: `${Math.max(share * 100, 1)}%`, backgroundColor: stopped || low ? colors.error : colors.accent }]} />
    <View style={[styles.stop, { left: `${voiceStopBytes / totalBytes * 100}%` }]} />
  </View>;

  return <View style={styles.stack}>
    <ListGroup card caption="МЕСТО НА СЕРВЕРЕ"
      footer={`Текст сервер принимает всегда. Голосовые перестанет принимать на ${mb(voiceStopBytes)} МБ. Само ничего не удаляется.`}>
      <ListItem glyph="storage" tone={tone} title={title} detail={detail} badge={bar} accessibilityLabel={`${title}. ${detail}`} last />
    </ListGroup>
    {stopped ? <Note tone="error">{`Голосовые сейчас не принимаются: занято ${mb(usedBytes)} МБ из ${mb(totalBytes)}. Текст работает.`}</Note>
      : low ? <Note tone="error">{`Место кончается: занято ${mb(usedBytes)} МБ из ${mb(totalBytes)}. На ${mb(voiceStopBytes)} МБ сервер перестанет принимать голосовые, текст будет работать.`}</Note>
        : null}
  </View>;
}

const createStyles = (colors: ProductColors) => StyleSheet.create({
  stack: { gap: 12 },
  track: { position: 'relative', height: 3, marginTop: 8, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  // Where voice stops.
  stop: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: colors.muted },
});
