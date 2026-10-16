import { useThemeColors } from '../ProductTheme';
import { RustMotion, hidden, shown } from './RustMotion.web';
import { ScanLight } from './ScanLight.web';
import { practiceEntryScan as scan, type PracticeEntryTransitionProps } from './PracticeEntryTransition.types';

/** Keep both live layouts for the sweep. The task's parent survives completion
 * and subsequent question changes, so scroll and artwork are never restarted. */
export function PracticeEntryTransition({ intro, children, showTask, scanning, reducedMotion, onComplete }: PracticeEntryTransitionProps) {
  const colors = useThemeColors();
  const duration = (value: number) => reducedMotion ? 0 : value;
  return <div data-testid="practice-entry-transition" data-phase={scanning ? 'scanning' : showTask ? 'task' : 'intro'}
    style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column', isolation: 'isolate' }}>
    {(!showTask || scanning) && <RustMotion key="intro" target={scanning ? hidden : shown}
      duration={duration(scan.fade)} delay={scanning ? duration(scan.fadeDelay) : 0} aria-hidden={showTask}
      style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', pointerEvents: showTask ? 'none' : 'auto' }}>
      {intro}
    </RustMotion>}
    {showTask && <RustMotion key="task" scanDuration={scanning ? duration(scan.reveal) : undefined}
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1,
        background: colors.background, pointerEvents: scanning ? 'none' : 'auto' }}>
      {children}
    </RustMotion>}
    {scanning && <>
      {/* Rust panel_reveal writes this unmasked sibling from the exact same
          scan profile as the task mask, including its soft leading edge. */}
      <ScanLight />
      <RustMotion key="completion" initial={hidden} target={shown} duration={duration(scan.complete)} onComplete={onComplete}
        aria-hidden style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }} />
    </>}
  </div>;
}
