type TextFrame = [id: number, text: string, opacity: number, scale: number];
type NativeMessage = { type: string; values?: number[]; texts?: TextFrame[]; readings?: number[]; focuses?: [number, number[]][]; message?: string };
const readings = new Map<number, (values: number[]) => void>();
const focuses = new Map<number, (values: number[]) => void>();
let sequence = 0, send: ((method: string, args: unknown[]) => void) | undefined;
const queued: [string, unknown[]][] = [], values = new Map<number, (value: number, finished: boolean) => void>(), texts = new Map<number, (text: string, opacity: number, scale: number) => void>();
export const nextMotionId = () => ++sequence;
export function motionCommand(method: string, ...args: unknown[]) { if (send) send(method, args); else queued.push([method, args]); }
export function subscribeMotion(id: number, callback: (value: number, finished: boolean) => void) { values.set(id, callback); return () => { values.delete(id); motionCommand('remove', id); }; }
export function subscribeRustText(id: number, callback: (text: string, opacity: number, scale: number) => void) { texts.set(id, callback); return () => { texts.delete(id); motionCommand('remove', id); }; }
export function subscribeReading(id: number, callback: (values: number[]) => void) { readings.set(id, callback); return () => { readings.delete(id); motionCommand('remove', id); }; }
export function subscribeReadingFocus(id: number, callback: (values: number[]) => void) { focuses.set(id, callback); return () => { focuses.delete(id); motionCommand('remove', id); }; }
export function attachMotionBridge(sender: typeof send) { send = sender; if (send) for (const [method, args] of queued.splice(0)) send(method, args); }
export function receiveMotion(data: NativeMessage) {
  if (data.values) for (let i = 0; i < data.values.length; i += 3) values.get(data.values[i])?.(data.values[i + 1], data.values[i + 2] === 1);
  data.texts?.forEach(([id, text, opacity, scale]) => texts.get(id)?.(text, opacity, scale));
  data.focuses?.forEach(([id, flags]) => focuses.get(id)?.(flags));
  if (data.readings) for (let i = 0; i < data.readings.length; i += 19) readings.get(data.readings[i])?.(data.readings.slice(i + 1, i + 19));
}
