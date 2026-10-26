import type { StyleProp, ViewStyle } from 'react-native';
import type { VoiceSpectrum } from '../audio/spectrum';
import type { VoiceSignal } from '../audio/voice-signal';
import type { RefObject } from 'react';
import type { GlassShape } from './glassShape';
import type { ArtInteraction } from './gesture';

export type DreamArtKind = 'dream-world' | 'dream-wake' | 'dream-inward' | 'dreamer';
export type StepOneArtKind = 'identity-imprints' | 'lived-paths';
export type StepThreeArtKind = 'thought-loop' | 'spoken-thought' | 'voice-origin' | 'breath-axis' | 'voice-unseal' | 'voice-witness';
export type PracticeArtKind = 'practice-room' | 'practice-father' | 'practice-listening' | 'practice-trinity' | 'practice-awareness' | 'practice-thread' | 'home-shade';
export type StepTwoTaskArtKind = 'hero-discernment' | 'life-book' | 'body-breath' | 'body-senses' | 'author-intention';
export type ArtKind = 'distance' | 'cells' | 'diary' | 'basic' | 'intensive' | 'guidance' | 'parallel' | 'comparison' | 'attention' | 'crowd' | 'gallery' | 'mirror' | 'voice-presence' | 'voice' | 'insight' | 'glass' | 'rain' | 'book' | 'reflections' | 'single-hero' | DreamArtKind | StepOneArtKind | StepTwoTaskArtKind | StepThreeArtKind | PracticeArtKind;
export const isDreamArt = (kind: ArtKind): kind is DreamArtKind => kind.startsWith('dream');
export const isStepOneArt = (kind: ArtKind): kind is StepOneArtKind => kind === 'identity-imprints' || kind === 'lived-paths';
export const isInlineReadingArt = (kind: ArtKind) => kind === 'book' || kind === 'reflections' || kind === 'single-hero' || isDreamArt(kind) || isStepOneArt(kind);
export type ArtController = { interact(value: ArtInteraction): void };
export type ArtProps = {
  kind: ArtKind;
  glass?: GlassShape;
  scanOnMount?: boolean;
  onRevealProgress?(value: number): void;
  /** The embedded scene has committed and had an opportunity to draw. */
  onReady?(): void;
  /** The visible decoder has finished resolving its final copy. */
  onDecoderComplete?(): void;
  controllerRef?: RefObject<ArtController | null>;
  width?: number;
  height: number;
  active?: boolean;
  /** Decoder visibility in its outer scroll viewport, including native clipping. */
  decoderVisible?: boolean;
  reducedMotion?: boolean;
  /** Normalized live microphone/playback amplitude, 0..1. Never a fabricated spectrum. */
  level?: number;
  spectrum?: VoiceSpectrum;
  /** Direct live metering; lifecycle and playback remain ordinary props. */
  audioSource?: VoiceSignal;
  mode?: 'idle' | 'record' | 'playback';
  /** Decorative composer sphere; the parent provides the accessible controls. */
  voiceCompact?: boolean;
  lockProgress?: number; locked?: boolean;
  presentation?: 'card' | 'artwork';
  /** Migration bridge: the parent owns the shared Rust glass surface. */
  externalGlass?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};
export const artLabels: Record<ArtKind, string> = {
  'home-shade': 'Мягкое затемнение под текстом',
  'practice-room': 'Человек на стуле произносит четыре фразы, комната постепенно проявляется',
  'practice-father': 'Взрослое я спокойно обращается к младшему я; отец и сын слышат друг друга',
  'practice-listening': 'Голос уходит шумом и возвращается к груди Зовом; рамка наблюдения держит звучание',
  'practice-trinity': 'Отец, Сын и Дух: дыхание соединяет форму с Абсолютом, разделение растворяется',
  'practice-awareness': 'Голос касается Тени, и свет проходит сквозь неё; сцена и зрители растворяются',
  'practice-thread': 'Голос становится нитью света: рой мыслей рассыпается, стены лабиринта осыпаются, ворота открываются в Свет',
  distance: 'Выставь дистанцию', cells: 'Ощути себя', diary: 'Архив моментов',
  basic: 'Базовый уровень', intensive: 'Синхронизация', guidance: 'Водительство', parallel: 'Параллельный путь',
  comparison: 'Сравнение образов', attention: 'Наблюдающий', crowd: 'Среди людей',
  gallery: 'Галерея образов', mirror: 'Перед матрицей образов', voice: 'Голос',
  'voice-presence': 'Голос освобождает пространство матрицы',
  'thought-loop': 'Замкнутый механизм мыслей',
  'spoken-thought': 'Мысль становится отдельным звучанием',
  'voice-origin': 'Источник голоса в яремной впадине',
  'breath-axis': 'Вдох освобождает врата от цепей. Фразы «Я есть» и «Я знаю» создают платформы над матричной пропастью; человек проходит, и опоры растворяются позади.',
  'voice-unseal': 'Звучание раскрывает запечатанную форму',
  'voice-witness': 'Тот, кто слышит, и отдельная от него мысль',
  insight: 'Сфера и два круга', glass: 'Стеклянная поверхность', rain: 'Матричный дождь',
  book: 'Книга и проекция Главного Героя',
  reflections: 'Отражения и проекции', 'single-hero': 'Главный Герой всегда один',
  'dream-world': 'Спящий герой и путешествие по мирам сна', 'dream-wake': 'Пробуждение и воспоминания о сне',
  'dream-inward': 'Внимание разворачивается внутрь', dreamer: 'Один сновидец',
  'identity-imprints': 'Одинаковые очертания, разные отпечатки', 'lived-paths': 'Две независимые линии опыта',
  'hero-discernment': 'Подобие образов и прямое знание себя', 'life-book': 'Жизнь как книга одного Героя',
  'body-breath': 'Дыхание внутри своего тела', 'body-senses': 'Непосредственное ощущение себя', 'author-intention': 'Намерение Автора и Главный Герой',
};
