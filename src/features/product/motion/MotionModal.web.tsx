import { useMemo, useState } from 'react';
import { Modal, useWindowDimensions } from 'react-native';
import type { ModalProps } from 'react-native';
import { RustMotion, shown } from './RustMotion.web';
import type { MotionValues } from './RustMotion.web';
import { useBackSwipeBlocked } from '../navigation/BackSwipeProvider';

const enterCurve = [.215, .61, .355, 1] as const;
const exitCurve = [.47, 0, .745, .715] as const;

/** Keep the established 250 ms modal motion; Rust owns its interpolation. */
export function MotionModal({ visible = true, animationType = 'none', transparent = false, backdropColor = 'white', children, ...props }: ModalProps) {
  const [present, setPresent] = useState(visible);
  const { height } = useWindowDimensions();
  if (visible && !present) setPresent(true);
  useBackSwipeBlocked(visible || present);
  const hidden = useMemo<MotionValues>(() => animationType === 'slide'
    ? [1, 0, height, 1, 0, 100] : [0, 0, 0, 1, 0, 100], [animationType, height]);
  return <Modal {...props} visible={visible || present} transparent animationType="none">
    <RustMotion initial={animationType === 'none' ? shown : hidden} target={visible ? shown : hidden}
      duration={animationType === 'none' ? 0 : 250} curve={visible ? enterCurve : exitCurve}
      onComplete={() => { if (!visible) setPresent(false); }}
      style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: transparent ? undefined : String(backdropColor), pointerEvents: visible ? 'auto' : 'none' }}>
      {children}
    </RustMotion>
  </Modal>;
}
