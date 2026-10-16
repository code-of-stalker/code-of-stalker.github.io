import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useIsFocused } from 'expo-router';
import { motionCommand, nextMotionId, subscribeRustText } from './nativeMotionBridge';
export function useRustTextFrame(text: string, effect: number, active: boolean, reduced: boolean) {
  const [id] = useState(nextMotionId), [frame, setFrame] = useState({ text: text.toUpperCase(), opacity: 0, scale: 1 });
  const focused = useIsFocused(), [systemReduced, setSystemReduced] = useState(true);
  useEffect(() => { let mounted = true; AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setSystemReduced(value); }); const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReduced); return () => { mounted = false; sub.remove(); }; }, []);
  useEffect(() => { motionCommand('register_text', id, text, effect); return subscribeRustText(id, (text, opacity, scale) => setFrame({ text, opacity, scale })); }, [id, text, effect]);
  useEffect(() => { motionCommand('text_active', id, active && focused, reduced || systemReduced); return () => motionCommand('text_active', id, false, true); }, [id, active, focused, reduced, systemReduced]);
  return reduced || systemReduced ? { text, opacity: 0, scale: 1 } : frame;
}
