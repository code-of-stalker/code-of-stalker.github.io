import { Modal } from 'react-native';
import type { ModalProps } from 'react-native';
import { useBackSwipeBlocked } from '../navigation/BackSwipeProvider';

export function MotionModal({ visible = true, ...props }: ModalProps) {
  useBackSwipeBlocked(visible);
  return <Modal {...props} visible={visible} />;
}
