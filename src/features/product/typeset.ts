/**
 * Body-text typesetting for the authored Russian texts, applied where they are rendered.
 *
 * 1. A manual line break inside a sentence becomes a space, so the text wraps by width and no
 *    ragged short line is left behind. A break is kept when the next line starts a list item,
 *    a quote or a number, when the previous line ends a sentence or opens a list (`.!?…:;`),
 *    around blank lines (paragraphs), and between two short lines: a short couplet or stanza
 *    («Ты не расследуешь —⏎ты сканируешь и считываешь.») fits on a phone line as authored.
 * 2. A dash never starts a line: the space before « — » is non-breaking.
 * 3. A one- or two-letter word (preposition, conjunction, particle, pronoun) never ends a
 *    line: the space after it is non-breaking.
 * 4. Double spaces collapse to one.
 *
 * The words themselves never change, so `page.bold` matching still uses the source string.
 */
const NBSP = ' ';
/** Lines up to this length fit one phone line of the reading text as authored. */
export const shortLine = 36;
const keepBefore = /^\s*([—–\-•«"„→]|\d+[.)])/;
const keepAfter = /([.!?…:;]|[.!?…][»"])\s*$/;
const shortWord = /^[«„"(]*[а-яёА-ЯЁa-zA-Z]{1,2}$/;

/** Joins the manual breaks that sit inside a sentence. */
export function flowLines(text: string) {
  const lines = text.split('\n');
  let out = lines[0];
  for (let i = 1; i < lines.length; i++) {
    const previous = lines[i - 1].trim(), next = lines[i].trim();
    const keep = !previous || !next || keepBefore.test(next) || keepAfter.test(previous)
      || (previous.length <= shortLine && next.length <= shortLine);
    out += keep ? '\n' + lines[i] : ' ' + lines[i].trimStart();
  }
  return out;
}

/** Glues dashes and short words to their neighbours within one line. */
function bindLine(line: string) {
  const words = line.split(/ +/);
  let out = words[0];
  for (let i = 1; i < words.length; i++) {
    const glue = words[i].startsWith('—') || shortWord.test(words[i - 1]);
    out += (glue ? NBSP : ' ') + words[i];
  }
  return out;
}

export function typeset(text: string) {
  return flowLines(text.replace(/ {2,}/g, ' ')).split('\n').map(bindLine).join('\n');
}
