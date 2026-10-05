import type { EventItemOrigin, EventTimelineItem, TimelineDiff, TimelineItemLike } from '@unomed/react-native-matrix-sdk';

// These are the literal tags in the generated 0.10.2 bindings. Type-only
// imports keep this helper testable without loading a TurboModule in Node.
export function matchingRemoteEvent(
  event: EventTimelineItem | undefined,
  body: string,
  sender: string,
  requiredOrigin?: EventItemOrigin,
): string | undefined {
  if (!event?.isRemote || event.sender !== sender || event.eventOrTransactionId.tag !== 'EventId') return;
  if (requiredOrigin !== undefined && event.origin !== requiredOrigin) return;
  if (event.content.tag !== 'MsgLike') return;
  const kind = event.content.inner.content.kind;
  if (kind.tag !== 'Message' || kind.inner.content.msgType.tag !== 'Text' || kind.inner.content.body !== body) return;
  return event.eventOrTransactionId.inner.eventId;
}

export function changedTimelineItems(diffs: TimelineDiff[]): TimelineItemLike[] {
  return diffs.flatMap((diff) => {
    switch (diff.tag) {
      case 'Append':
      case 'Reset':
        return diff.inner.values;
      case 'PushFront':
      case 'PushBack':
      case 'Insert':
      case 'Set':
        return [diff.inner.value];
      default:
        return [];
    }
  });
}
