import { stepDescriptions, stepTwoDream } from '../content';
import type { ArtKind, WebScene } from './types';
import { stepThreeBlocks } from '../stepThreeContent';
import { stepThreePractice } from '../stepThreePractice';
import { stepFourBlocks } from '../stepFourContent';

export type ReadingPage = {
  id: string; art?: ArtKind; webScene?: WebScene; paragraphs: readonly string[];
  spoken?: readonly string[]; after?: readonly string[];
  title?: string; emphasis?: string; conclusion?: string; firstStepConclusion?: boolean; statement?: string;
};
const one = stepDescriptions[1].split('\n\n'), two = stepDescriptions[2].split('\n\n');
const first: readonly ReadingPage[] = [
  { id: 'similarity', art: 'cells', paragraphs: one.slice(0, 2) },
  { id: 'identity', art: 'identity-imprints', paragraphs: one.slice(2), firstStepConclusion: true },
];
const hero: readonly ReadingPage[] = [
  { id: 'reflections', art: 'reflections', paragraphs: two.slice(0, 2) },
  { id: 'single-hero', art: 'single-hero', paragraphs: two.slice(2, 3) },
  { id: 'book', art: 'book', paragraphs: two.slice(3) },
];
const dream: readonly ReadingPage[] = stepTwoDream.blocks.map((block, index) => ({
  id: block.art, art: block.art, paragraphs: [block.text],
  ...(index === 0 ? { title: stepTwoDream.title } : {}),
  ...('emphasis' in block ? { emphasis: block.emphasis } : {}),
  ...('conclusion' in block ? { conclusion: block.conclusion } : {}),
}));
/** Reading order and content are application data; motion stays in Rust. */
const voice: readonly ReadingPage[] = stepThreeBlocks.map(({ emphasis, ...block }) => ({ ...block, statement: emphasis }));
export const readingPages = (step: 1 | 2 | 3 | 4, chapter: 0 | 1) => step === 4 ? stepFourBlocks[chapter] : step === 3 ? chapter === 0 ? voice : stepThreePractice : step === 1 ? first : chapter === 0 ? hero : dream;
