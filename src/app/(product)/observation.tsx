import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ObservationFlow } from '../../features/product/ObservationFlow';
import { useProduct } from '../../features/product/state/ProductProvider';
import { resumePracticeStage } from '../../features/product/state/model';
import type { ProductProgress } from '../../features/product/state/model';

/** Where an entry to this address belongs: the questions open only where the course reached
 * them; otherwise the step's reading, or the level choice before a level is chosen. */
function entry(progress: ProductProgress) {
  if (!progress.selectedLevel) return '/levels';
  const stage = resumePracticeStage(progress);
  return progress.step === 1 && stage === 4 || progress.step === 2 && stage === 3 ? null : '/practice';
}

export default function Observation() {
  const { progress } = useProduct();
  // Decided once on entry: answering moves the progress on, and the flow navigates itself then.
  const [redirect] = useState(() => entry(progress));
  return redirect ? <Redirect href={redirect} /> : <ObservationFlow />;
}
