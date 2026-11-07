import assert from 'node:assert/strict';
import test from 'node:test';
import { typeset, flowLines } from './typeset.ts';

const N = ' ';

test('a break inside a sentence becomes a space', () => {
  assert.equal(flowLines('Когда ты говоришь или молчишь, идешь, садишься или стоишь —\nмир вокруг тебя вибрирует, движется и звучит.'),
    'Когда ты говоришь или молчишь, идешь, садишься или стоишь — мир вокруг тебя вибрирует, движется и звучит.');
});

test('paragraphs, list items, quotes, sentence ends and short couplets keep their breaks', () => {
  for (const text of ['Первый абзац,\n\nвторой.', 'Отследи:\n— Кто это говорит?\n— Из какого состояния идёт голос?',
    '«Я Здесь».\n«Я Говорю»\n«Я Слышу».', 'Это — заземление.\nБез него внутреннее Наблюдение превращается в размышление.',
    'Ты не расследуешь —\nты сканируешь и считываешь.', 'Мысли могут быть быстрыми,\nэмоции — тихими или резкими,'])
    assert.equal(flowLines(text), text);
});

test('a dash and short words never sit at a line edge', () => {
  assert.equal(typeset('не отключая мир, —\nпоявляется потенциальность активации третьего уровня, и в мире форм'),
    `не${N}отключая мир,${N}— появляется потенциальность активации третьего уровня, и${N}в${N}мире форм`);
  assert.equal(typeset('Я — здесь. «Я Есть»'), `Я${N}— здесь. «Я${N}Есть»`);
});

test('double spaces collapse and words stay the same', () => {
  const source = 'Ты живешь, дышишь, говоришь и взаимодействуешь  — не теряя Позицию';
  const result = typeset(source);
  assert.equal(result.replaceAll(N, ' '), source.replace('  ', ' '));
});
