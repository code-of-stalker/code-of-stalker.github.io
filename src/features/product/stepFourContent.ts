import type { ReadingPage } from './motion/readingPages';

/** Authored reading order. Each page has one focal scene and keeps the supplied text. */
const pages: readonly ReadingPage[] = [
  { id: 'grounding-default', title: 'Практика заземления и прямого узнавания', art: 'grounding-drift', webScene: 'world-in-glasses', paragraphs: [
    'Мысли думают человека.\nПарадигмы живут им — по умолчанию.',
    'Ментал контролирует, воображение рисует образы, в которые он верит больше, чем в тело.',
    'И всё это называется «жизнью» — хотя жизни в этом практически нет.',
  ] },
  { id: 'grounding-absent', title: 'Где ты сейчас?', art: 'grounding-here', paragraphs: [
    'Когда нет Осознавания, когда Наблюдение схлопнуто или путается с вниманием, человек «плавает в мышлении, в голове» — не ощущая ни тела, ни земли, ни момента, в котором он действительно по факту есть.',
  ] },
  { id: 'grounding-automatic', title: 'Откуда берётся вывод?', art: 'grounding-trace', webScene: 'theatre-marionette', paragraphs: [
    'Человек реагирует, делает выводы, убеждён в своей искренности и правоте — но не замечает, откуда это берётся.',
    'Кто внутри него делает вывод?\nИз какой стартовой точки он пошёл?\nКакие ощущения сопровождали выбор?\nБыло ли это узнанное — или автоматическое?',
  ] },
  { id: 'grounding-contact', title: 'Простая практика', art: 'grounding-contact', webScene: 'simple-practice', paragraphs: [
    'Займи устойчивую позу. Опусти глаза вниз, но не закрывай.\nПоставь ноги на пол. Почувствуй ступни.',
    'Почувствуй тяжесть ног, их контакт с полом, почувствуй опору.',
    'Почувствуй корпус тела — не как образ, а как массу, вес, объём — как форму Присутствия.',
    'Не убегай в голову. Не улетай в образность и воображение. Позволь себе быть здесь, заземлённым, включённым, бдительным.',
  ] },
  { id: 'grounding-speaking', title: 'Услышь своё состояние', art: 'grounding-voice', webScene: 'hear-state', paragraphs: [
    'Теперь — начни говорить вслух. Любую мысль, любую фразу — как она есть.',
    'Слушай, как звучит твой голос. Не столько то, что ты говоришь — сколько как звучишь и как ты это ощущаешь в себе и собой.',
    'Отследи:\n— Кто это говорит?\n— Из какого состояния идёт голос?\n— Есть ли в нём уверенность, тревога, маска, отсутствие, автоматизм?',
  ] },
  { id: 'grounding-questions-origin', title: 'Вопросы настройки', art: 'grounding-trace', webScene: 'tuning-questions', paragraphs: [
    'Теперь — скажи вслух любой вывод. И задай себе вопросы:',
    '— Откуда пришёл этот вывод?\n— Что явилось стартовой точкой? (ощущение, образ, мысль?)\n— Есть ли факт, или это интерпретация?\n— Что я чувствую телом, пока думаю это?',
  ] },
  { id: 'grounding-character', title: 'Персонаж: сон, в который поверил Абсолют', art: 'grounding-persona', webScene: 'persona-dream', paragraphs: [
    'Человек живёт не собой, а персонажем — ментальной конструкцией, собранной из образов, заимствованных установок, страхов и памяти.',
    'Он живёт в картине мира, где уже ментальной матрицей задано, что можно, а что нельзя, что хорошо, а что плохо.',
    'Он верит в образ себя, верит в образ о себе — не в живое Я, не в Присутствие — а в «я такой-то», или «я не такой», «я должен», или «я хочу».',
  ] },
  { id: 'grounding-program', title: 'Механизм обусловленности', art: 'grounding-persona', webScene: 'persona-program', paragraphs: [
    'Персонаж — это не кто-то.',
    'Это механизм обусловленности, это программа, которая запускается и живёт собой, пока ты не начнёшь видеть, рассматривать, ощущать, наблюдать, осознавать и различать.',
  ] },
  { id: 'grounding-belief', title: 'Я это действительно знаю?', art: 'grounding-trace', webScene: 'persona-belief', paragraphs: [
    'Даже вера — является программой.',
    'Человек может верить в Бога, в Аллаха, в Будду, в Кришну, в правильность молитвы или мантры, но никогда не задаваться вопросом:',
    'А я это чувствую как Истину? Я это действительно Знаю?\nИли мне просто так сказали, и я поверил?',
  ] },
  { id: 'grounding-call', title: 'Сила Зова', art: 'grounding-signal', webScene: 'call-bell', paragraphs: [
    'Так работает персонажная программа: она управляет бескомпромиссно, жёстко, но незаметно.',
    'И пока не возникнет тотальное Разочарование — не возникнет чистый Запрос, не проявится Намерение и не раскроет Себя Сила Зова.',
    'А значит — Пробуждение не начнётся.',
  ] },
  { id: 'grounding-awakening', title: 'Пробуждение', art: 'grounding-presence', webScene: 'awakening', paragraphs: [
    'Пробуждение — это не «счастье» и не «успех».',
    'Это разотождествление с персонажем, с менталом, с образом себя и о себе, с ментальной обусловленностью и потребностью иметь подобную зависимость.',
  ] },
  { id: 'grounding-witnessing', title: 'Живое Осознавание', art: 'grounding-trace', webScene: 'witnessing', paragraphs: [
    'Это возвращение в Живое Осознавание, где ты не просто делаешь вывод — а становишься мониторингом всего процесса, Слышанием, Ощущением — становишься Свидетельствованием.',
  ] },
  { id: 'grounding-recognition', title: 'Сущностные ощущения', art: 'grounding-contact', webScene: 'essence-flame', paragraphs: [
    'Сущностные ощущения — это не про эмоции.',
    'Это про Живое Узнавание Сути в себе, узнавание через ощущения, через тело:',
  ], spoken: ['Я — Здесь.', 'Я — Не мысль.', 'Я — Не персонаж.', 'Я — Присутствие.'], after: ['Ощущение Себя — без обозначения Я.'] },
  { id: 'grounding-real', title: 'Истинное распознавание', art: 'grounding-presence', webScene: 'true-sight', paragraphs: [
    'И пока ты не ощутил ступни, не услышал голос, не отследил, как мысль делает вывод, ты не проснулся.',
  ], statement: 'Но как только возникло Истинное Видение, Истинное Распознавание и Различение — возникает Ты Абсолютный, Ты Настоящий.' },
];

/** Page 07 is answered, not read: four questions with the hint and voice answer of steps 1–2. */
export const stepFourQuestionsTitle = 'Наблюдение или мысль?';
export const stepFourQuestions = [
  'Кто внутри меня решил, что это — истина?',
  'Где находится моё внимание сейчас — в голове, в теле, в ощущении?',
  'Есть ли Наблюдение, есть ли Присутствие в моменте — или только мысленный процесс, мысленное «я»?',
  'Кто находится впереди механизма мышления? Ощущается ли предтеча?',
] as const;
/** Like the step 2 hint, it repeats the practice that leads into the questions. */
export const stepFourHint = pages.slice(3, 6).map(page => `${page.title}:\n${page.paragraphs.join('\n\n')}`).join('\n\n');

/** The reading before and after the questions. Each block counts its own pages
 * (01 / 06, then 01 / 08), like the material and practice of step 3. */
export const stepFourBlocks = [pages.slice(0, 6), pages.slice(6)] as const;

/** One place index runs through the whole step (0–14): 0–5 the first block, 6 the
 * questions, 7–14 the second block. The bookmark and the sections menu keep it, so a
 * place saved by the earlier single 15-page reader still opens the same text. */
export const stepFourQuestionsAt = 6;
export type StepFourPart = 0 | 'questions' | 1;
export function stepFourPlace(index: number): { part: StepFourPart; page: number } {
  if (index < stepFourQuestionsAt) return { part: 0, page: Math.max(0, index) };
  if (index === stepFourQuestionsAt) return { part: 'questions', page: 0 };
  return { part: 1, page: Math.min(index - stepFourQuestionsAt - 1, stepFourBlocks[1].length - 1) };
}
export const stepFourIndex = (part: StepFourPart, page = 0) =>
  part === 0 ? page : part === 'questions' ? stepFourQuestionsAt : stepFourQuestionsAt + 1 + page;
export const stepFourTitle = (index: number) => {
  const { part, page } = stepFourPlace(index);
  return part === 'questions' ? stepFourQuestionsTitle : stepFourBlocks[part][page].title!;
};

export const stepFourGroups = [
  { title: 'Прямое узнавание', pages: [0, 1, 2] },
  { title: 'Практика заземления', pages: [3, 4, 5, 6] },
  { title: 'Персонаж', pages: [7, 8, 9, 10] },
  { title: 'Пробуждение', pages: [11, 12, 13, 14] },
] as const;
