import { useMemo } from 'react';
import { Image } from 'expo-image';
import type { Place } from '../backend';
import { roleMarkInk, roleMarkSize, roleMarkStills } from './roleMarks.generated';

/** The native app shows the role's sign at rest, drawn by graphics/role-marks;
 * the motion runs on the web, where the Rust adapter lives. */
export function RoleMark({ role, ink, size = roleMarkSize }: { role: Place; ink: string; size?: number }) {
  const source = useMemo(() => ({ uri: 'data:image/svg+xml;utf8,' + encodeURIComponent(roleMarkStills[role].split(roleMarkInk).join(ink)) }), [ink, role]);
  return <Image pointerEvents="none" accessible={false} source={source} style={{ width: size, height: size, flexShrink: 0 }} contentFit="contain" />;
}
