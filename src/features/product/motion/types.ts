import type { StyleProp, ViewStyle } from 'react-native';
import type { VoiceSpectrum } from '../audio/spectrum';
import type { VoiceSignal } from '../audio/voice-signal';
import type { RefObject } from 'react';
import type { GlassShape } from './glassShape';
import type { ArtInteraction } from './gesture';

export type DreamArtKind = 'dream-world' | 'dream-wake' | 'dream-inward' | 'dreamer';
export type StepOneArtKind = 'identity-imprints' | 'lived-paths';
export type StepThreeArtKind = 'thought-loop' | 'spoken-thought' | 'voice-origin' | 'breath-axis' | 'voice-unseal' | 'voice-witness';
export type StepFourArtKind = 'grounding-here' | 'grounding-drift' | 'grounding-trace' | 'grounding-contact' | 'grounding-voice' | 'grounding-persona' | 'grounding-signal' | 'grounding-presence';
export type PracticeArtKind = 'practice-room' | 'practice-father' | 'practice-listening' | 'practice-trinity' | 'practice-awareness' | 'practice-thread' | 'home-shade';
export type StepTwoTaskArtKind = 'hero-discernment' | 'life-book' | 'body-breath' | 'body-senses' | 'author-intention';
export type ArtKind = 'distance' | 'cells' | 'diary' | 'basic' | 'intensive' | 'guidance' | 'parallel' | 'comparison' | 'attention' | 'crowd' | 'gallery' | 'mirror' | 'voice-presence' | 'grounding-hero' | 'voice' | 'insight' | 'glass' | 'rain' | 'book' | 'reflections' | 'single-hero' | DreamArtKind | StepOneArtKind | StepTwoTaskArtKind | StepThreeArtKind | PracticeArtKind | StepFourArtKind;
export const isDreamArt = (kind: ArtKind): kind is DreamArtKind => kind.startsWith('dream');
export const isStepOneArt = (kind: ArtKind): kind is StepOneArtKind => kind === 'identity-imprints' || kind === 'lived-paths';
export const isInlineReadingArt = (kind: ArtKind) => kind === 'book' || kind === 'reflections' || kind === 'single-hero' || isDreamArt(kind) || isStepOneArt(kind);
/** Live Rust illustrations that replace a page's artwork in the browser. */
export type WebScene = 'theatre-marionette' | 'world-in-glasses' | 'simple-practice' | 'hear-state' | 'tuning-questions' | 'persona-dream' | 'persona-program' | 'persona-belief' | 'awakening' | 'witnessing' | 'call-bell' | 'essence-flame' | 'true-sight';
export type ArtController = { interact(value: ArtInteraction): void };
export type ArtProps = {
  kind: ArtKind;
  /** Optional live Rust illustration in the browser; native keeps its current scene. */
  webScene?: WebScene;
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
  'grounding-here': 'Сидящий человек у окна ощущает вес тела и опору ступней',
  'grounding-hero': 'Световой человек сидит в матричном пространстве, обе ступни опираются на пол',
  'grounding-drift': 'Над телом движется сеть мыслей, внимание возвращается к опоре',
  'grounding-contact': 'Свет проходит через тело к ступням, плоскость пола становится ощутимой',
  'grounding-voice': 'Голос рождается из дыхания, человек слышит собственное состояние',
  'grounding-trace': 'Вывод разворачивается в цепочку: ощущение, образ, мысль, вывод',
  'grounding-persona': 'Слои образа и установок отделяются от непрозрачного человеческого силуэта',
  'grounding-signal': 'Тихий импульс проходит сквозь механизм мыслей',
  'grounding-presence': 'Целостный силуэт стоит на земле, свет от опоры наполняет форму',
  'home-shade': 'Мягкое затемнение под текстом',
  'practice-room': 'Человек на стуле произносит четыре фразы, комната постепенно проявляется',
  'practice-father': 'Свет мальчика становится Отцом; каждая из четырёх фраз входит в него и снимает одно кольцо, и Отец светом возвращается в него',
  'practice-listening': 'Голос уходит шумом и возвращается к груди Зовом; рамка наблюдения держит звучание',
  'practice-trinity': 'Слова Отца разбивают стекло программы вокруг Сына, и Дух становится дыханием между ними',
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
