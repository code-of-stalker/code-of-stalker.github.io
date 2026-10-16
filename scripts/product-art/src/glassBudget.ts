/** Glass renders at CSS resolution; artwork and text have independent resolution. */
import { glassBufferLayout } from '../../../src/features/product/motion/effectQuality';
export { glassBufferLayout };
export const glassDensity = (width: number, height: number, requested: number) => glassBufferLayout(width, height, requested).density;
