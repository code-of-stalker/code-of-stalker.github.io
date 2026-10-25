import { stepThreeBlocks } from './stepThreeContent';
import { stepThreePractice } from './stepThreePractice';
import type { PracticeStage } from './state/model';

export type StepDestination = { step: 1 | 2 | 3; stage: PracticeStage; chapter: 0 | 1; page: number; section: boolean };
export type StepSection = { title: string; destination: StepDestination };
export type StepSectionGroup = { title: string; items: StepSection[] };
const item = (step: 1 | 2 | 3, title: string, stage: PracticeStage, chapter: 0 | 1, page = 0): StepSection =>
  ({ title, destination: { step, stage, chapter, page, section: true } });
export function stepSections(step: 1 | 2 | 3): StepSectionGroup[] {
  if (step === 1) return [
    { title: 'Материал', items: [item(1, 'Ловушка подобия', 0, 0), item(1, 'Но они не ты', 0, 0, 1)] },
    { title: 'Практика', items: [item(1, 'Наблюдение', 1, 0), item(1, 'Внимание', 2, 0), item(1, 'Среди множества', 3, 0), item(1, 'Вопросы к себе', 4, 0)] },
  ];
  if (step === 2) return [
    { title: 'Материал', items: [
      item(2, 'Отражения', 0, 0), item(2, 'Главный Герой', 0, 0, 1), item(2, 'Книга Жизни', 0, 0, 2),
      item(2, 'Сон как метафора', 0, 1), item(2, 'Пробуждение', 0, 1, 1), item(2, 'Пьеса одного Героя', 0, 1, 2), item(2, 'Единственный, Кто Смотрит', 0, 1, 3),
    ] },
    { title: 'Практика', items: [item(2, 'Заметь сегодня', 1, 0), item(2, 'Жизнь как книга', 2, 0), item(2, 'Вопросы к себе', 3, 0), item(2, 'Присмотрись к телу', 4, 0)] },
  ];
  return [
    { title: 'Материал', items: stepThreeBlocks.map((block, page) => item(3, block.title ?? 'Мысли и Наблюдение', 0, 0, page)) },
    { title: 'Практика', items: stepThreePractice.map((block, page) => item(3, [
      'Останься в тишине', 'Я слышу свой голос', 'Отец и сын', 'Слышание и чувствование', 'Дыхание Осознавания', 'Говори с собой', 'Нить Ариадны',
    ][page] ?? block.title ?? 'Практика', 0, 1, page)) },
  ];
}
