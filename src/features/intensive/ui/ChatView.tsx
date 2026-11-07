import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent, TextInputKeyPressEventData } from 'react-native';
import { useIsFocused } from 'expo-router';

import { DiaryWaveform } from '../../product/diary/DiaryAudio';
import { DiaryGlass } from '../../product/diary/DiaryGlass';
import { DiaryDesignPanel } from '../../product/diary/DiaryDesignPanel';
import { DiaryIcon } from '../../product/diary/DiaryIcons';
import { DiaryRecordButton } from '../../product/diary/DiaryRecordButton';
import { diaryClock } from '../../product/diary/feed';
import { useDiaryKeyboard } from '../../product/diary/useDiaryKeyboard';
import { useObservationPlayer } from '../../product/hooks/useObservationPlayer';
import { useProductSpacing } from '../../product/layout';
import { BottomSheet } from '../../product/motion/BottomSheet';
import { PanelArtwork } from '../../product/motion/PanelArtwork';
import { PanelBorder } from '../../product/PanelBorder';
import { useThemeColors, useThemeStyles } from '../../product/ProductTheme';
import { useProduct } from '../../product/state/ProductProvider';
import type { ProductColors } from '../../product/theme';
import { fonts } from '../../product/theme';
import { ProductButton, ProductIconButton, ProductText } from '../../product/ui';
import type { ChatSummary, Member, Place } from '../backend';
import { draftFor, keepDraft, keepPreview, markSeen, previewFor, seenId } from '../chatMemory';
import type { VoiceMeta } from '../crypto';
import type { DecodedMessage, IntensiveSession, VoiceDraft } from '../session';
import { Avatar, ConfirmSheet, DayRow, Glyph, GlassField, ListItem, Plate, useIntensiveFrames } from './chrome';
import { problemText, useFormal } from './parts';
import { useChatVoice, VOICE_LIMIT_SECONDS } from './useChatVoice';

const MAX_LENGTH = 4000;
/** Older messages appear on request, so a long chat opens fast. */
const PAGE = 150;
/** Messages closer than this from one person form one group. */
const GROUP_MS = 5 * 60_000;
/** Edits and deletions are asked for with this overlap, so a slow write is not missed. */
const CHANGE_OVERLAP_MS = 2 * 60_000;
/** The message menu closes before the next sheet or the keyboard opens. */
const SHEET_GAP_MS = 280;
const finePointer = () => Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches;
const canCopy = () => Platform.OS === 'web' && typeof navigator !== 'undefined' && !!navigator.clipboard?.writeText;

export const shortPlace: Record<Place, string> = { walker: 'ИДУЩИЙ', guide: 'ПРОВОДНИК', admin: 'АДМИН', main: 'ГЛАВНЫЙ АДМИН' };

const time = (iso: string) => new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
const dayKey = (iso: string) => new Date(iso).toDateString();
function dayLabel(iso: string) {
  const date = new Date(iso), today = new Date(), yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'СЕГОДНЯ';
  if (date.toDateString() === yesterday.toDateString()) return 'ВЧЕРА';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', ...(date.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }) }).toUpperCase();
}
/** Telegram-style list time: clock today, weekday this week, date before. */
function listTime(iso: string) {
  const date = new Date(iso), now = new Date();
  if (date.toDateString() === now.toDateString()) return time(iso);
  if (now.getTime() - date.getTime() < 6 * 86_400_000) return date.toLocaleDateString('ru-RU', { weekday: 'short' }).toUpperCase();
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', ...(date.getFullYear() === now.getFullYear() ? {} : { year: '2-digit' }) });
}
const at = (iso: string | null) => (iso ? Date.parse(iso) || 0 : 0);
/** The latest server time a message carries: sent, edited or deleted. */
const changedAt = (message: DecodedMessage) => Math.max(at(message.createdAt), at(message.editedAt), at(message.deletedAt));
const voiceLabel = (voice: VoiceMeta) => `Голосовое сообщение · ${diaryClock(voice.durationMs)}`;

// ------------------------------------------------------------------ list

function useChatPreviews(session: IntensiveSession, chats: ChatSummary[]) {
  const [, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    void (async () => {
      for (const chat of chats) {
        if (!alive) return;
        if (!chat.lastMessageId || previewFor(chat.chatId, chat.lastMessageId, chat.lastEditedAt)) continue;
        try {
          if (!await session.chatCipher(chat.chatId)) continue;
          const rows = await session.messages(chat.chatId, chat.lastMessageId - 1);
          const last = rows.find(m => m.id === chat.lastMessageId);
          if (last) keepPreview(chat.chatId, { messageId: last.id, editedAt: chat.lastEditedAt, senderId: last.senderId, senderRole: last.senderRole, text: last.voice ? voiceLabel(last.voice) : last.text });
          if (alive) setVersion(current => current + 1);
        } catch { /* The row keeps its plain line; the next refresh tries again. */ }
      }
    })();
    return () => { alive = false; };
  }, [session, chats]);
}

export function ChatList({ session, chats, onOpen }: { session: IntensiveSession; chats: ChatSummary[]; onOpen: (chat: ChatSummary) => void }) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  const [query, setQuery] = useState('');
  useChatPreviews(session, chats);
  const sorted = useMemo(() => [...chats].sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? '') || a.walkerName.localeCompare(b.walkerName, 'ru')), [chats]);
  if (!chats.length) return <Plate glyph="chat" title="Переписок пока нет">Они появятся, когда Яна назначит идущих.</Plate>;
  const needle = query.trim().toLocaleLowerCase('ru');
  const shown = needle ? sorted.filter(chat => [chat.walkerName, chat.guideName, chat.adminName].some(name => name?.toLocaleLowerCase('ru').includes(needle))) : sorted;
  return <View style={styles.list}>
    {chats.length >= 6 ? <GlassField value={query} onChangeText={setQuery} placeholder="Поиск по имени" accessibilityLabel="Поиск по имени"
      right={<Glyph name="search" size={18} color={colors.faint} />} /> : null}
    <View>
      {shown.map((chat, index) => {
        const preview = chat.lastMessageId ? previewFor(chat.chatId, chat.lastMessageId, chat.lastEditedAt) : undefined;
        const own = preview?.senderId === session.id;
        const unread = !!chat.lastMessageId && !own && chat.lastMessageId > (seenId(chat.chatId) ?? 0);
        const author = !preview ? '' : own ? 'Ты' : preview.senderId === chat.guideId ? chat.guideName : preview.senderId === chat.adminId ? chat.adminName
          : preview.senderId === chat.walkerId ? chat.walkerName : shortPlace[preview.senderRole as Place];
        const line = !chat.lastMessageId ? (chat.guideName ? `Проводник: ${chat.guideName}` : 'Проводник не назначен')
          : !preview ? 'Сообщение' : preview.text === null ? `${author}: не удалось расшифровать` : `${author}: ${preview.text.replace(/\s+/g, ' ')}`;
        return <Pressable key={chat.chatId} accessibilityRole="button" accessibilityLabel={`${chat.walkerName}${unread ? ', есть новые сообщения' : ''}`} onPress={() => onOpen(chat)}
          style={({ pressed }) => [styles.chatRow, pressed && { backgroundColor: colors.subtle }]}>
          <Avatar name={chat.walkerName} size={48} accent={unread} />
          <View style={[styles.chatBody, index < shown.length - 1 && styles.chatLine]}>
            <View style={styles.chatTop}>
              <ProductText variant="title" numberOfLines={1} style={styles.chatName}>{chat.walkerName}</ProductText>
              {chat.lastMessageAt ? <ProductText maxFontSize={10} style={[styles.chatTime, unread && { color: colors.accent }]}>{listTime(chat.lastMessageAt)}</ProductText> : null}
            </View>
            <View style={styles.chatTop}>
              <ProductText numberOfLines={1} style={[styles.chatPreview, unread && { color: colors.text }]}>{line}</ProductText>
              {unread ? <View accessible={false} style={styles.unreadMark} /> : null}
            </View>
          </View>
        </Pressable>;
      })}
      {!shown.length ? <ProductText style={styles.nothing}>Никого не нашлось.</ProductText> : null}
    </View>
  </View>;
}

// ------------------------------------------------------------------ chat

type Pending = { key: string; createdAt: string; failed: boolean } & ({ kind: 'text'; text: string } | { kind: 'voice'; voice: VoiceDraft });
/** A sheet keeps its message while it slides away. */
type Sheet = { message: DecodedMessage; open: boolean } | null;
const closed = (sheet: Sheet): Sheet => sheet && { ...sheet, open: false };

export function ChatView({ session, chat, onBack, action }: { session: IntensiveSession; chat: ChatSummary; onBack: () => void; action?: ReactNode }) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  const frames = useIntensiveFrames();
  const { gutter } = useProductSpacing();
  const { width } = useWindowDimensions();
  const { settings } = useProduct();
  const focused = useIsFocused();
  const keyboard = useDiaryKeyboard();
  // Opened from the admin page, the chat speaks to the main admin with «Вы».
  const formal = useFormal();
  const say = (informal: string, polite: string) => formal ? polite : informal;
  const chatId = chat.chatId;
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<DecodedMessage[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'no-key'>('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraftState] = useState(() => draftFor(chatId));
  const [limit, setLimit] = useState(PAGE);
  const [unreadFrom, setUnreadFrom] = useState<number | null | undefined>(undefined);
  const [below, setBelow] = useState(0);
  const [atBottom, setAtBottom] = useState(true);
  const [info, setInfo] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [menu, setMenu] = useState<Sheet>(null);
  const [doomed, setDoomed] = useState<Sheet>(null);
  const [removing, setRemoving] = useState(false);
  const [editing, setEditing] = useState<DecodedMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeVoice, setActiveVoice] = useState<number | null>(null);
  const composerHeight = width >= 375 ? 48 : 44;
  const [inputHeight, setInputHeight] = useState(composerHeight);
  const scroll = useRef<ScrollView>(null);
  const input = useRef<TextInput>(null);
  /** The highest message id seen, deleted ones included: new messages are asked for after it. */
  const lastId = useRef<number | undefined>(undefined);
  /** The latest server time seen: edits and deletions are asked for from shortly before it. */
  const cursor = useRef(0);
  /** Deleted messages never come back, whatever order the updates arrive in. */
  const gone = useRef(new Set<number>());
  const bottom = useRef(true);
  const metrics = useRef({ offset: 0, height: 0, content: 0 });
  const positioned = useRef(false);
  const holdOffset = useRef<number | null>(null);
  const followNext = useRef(false);
  const dividerY = useRef<number | null>(null);
  const seenCount = useRef(0);
  const expectDivider = useRef(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setDraft = (text: string) => { setDraftState(text); keepDraft(chatId, text); };
  const flash = (text: string) => {
    setNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(''), 2200);
  };
  useEffect(() => { const timer = noticeTimer; return () => { if (timer.current) clearTimeout(timer.current); }; }, []);

  const merge = useCallback((incoming: DecodedMessage[]) => {
    if (!incoming.length) return;
    for (const message of incoming) {
      if (message.deletedAt) gone.current.add(message.id);
      if (message.id > (lastId.current ?? 0)) lastId.current = message.id;
      cursor.current = Math.max(cursor.current, changedAt(message));
    }
    setMessages(current => {
      const byId = new Map(current.map(m => [m.id, m]));
      let changed = false;
      for (const message of incoming) {
        const known = byId.get(message.id);
        if (gone.current.has(message.id)) { if (known) { byId.delete(message.id); changed = true; } continue; }
        // Only a later edit replaces what is shown, so a stale copy never undoes one.
        if (!known || at(message.editedAt) > at(known.editedAt)) { byId.set(message.id, message); changed = true; }
      }
      return changed ? [...byId.values()].sort((a, b) => a.id - b.id) : current;
    });
  }, []);

  useEffect(() => {
    let alive = true, retry: ReturnType<typeof setTimeout> | null = null, poll: ReturnType<typeof setInterval> | null = null;
    let roster: ReturnType<typeof setInterval> | null = null;
    let unwatch = () => {};
    let known = new Set<string>();
    const showMembers = (list: Member[]) => { known = new Set(list.map(m => m.userId)); setMembers(list); };
    const reloadMembers = async () => {
      try { const list = await session.members(chatId); if (alive) showMembers(list); }
      catch { /* The next roster check catches up. */ }
    };
    // A guide or admin assigned while this chat is open writes under their name, not «бывший участник».
    const take = (incoming: DecodedMessage[]) => {
      merge(incoming);
      if (incoming.some(m => m.senderId !== session.id && !known.has(m.senderId))) void reloadMembers();
    };
    const pull = async () => {
      try {
        const since = cursor.current ? new Date(cursor.current - CHANGE_OVERLAP_MS).toISOString() : null;
        const [rows, changed] = await Promise.all([session.messages(chatId, lastId.current), since ? session.changes(chatId, since) : Promise.resolve([])]);
        if (alive) { take([...rows, ...changed]); setError(''); }
      } catch { /* The next poll or live event catches up. */ }
    };
    const start = async () => {
      try {
        const [list, cipher] = await Promise.all([session.members(chatId), session.chatCipher(chatId)]);
        if (!alive) return;
        showMembers(list);
        if (!cipher) { setPhase('no-key'); retry = setTimeout(() => { void start(); }, 8000); return; }
        unwatch = session.backend.watch(chatId,
          row => { void session.decode(chatId, row).then(message => { if (alive) take([message]); }); },
          () => { poll ??= setInterval(() => { void pull(); }, 5000); });
        const rows = await session.messages(chatId);
        if (!alive) return;
        // The first message from someone else after the last one read here opens the «new» divider.
        const seen = seenId(chatId);
        setUnreadFrom(seen === undefined ? null : rows.find(m => m.id > seen && m.senderId !== session.id)?.id ?? null);
        take(rows);
        setPhase('ready');
        setError('');
        // A slow safety net in case a live event is lost without an error.
        poll ??= setInterval(() => { void pull(); }, 20000);
        // The header names whoever can read the chat, so a new admin shows up before writing.
        roster ??= setInterval(() => { void reloadMembers(); }, 30000);
      } catch (problem) {
        if (!alive) return;
        setError(problemText(problem, 'Не удалось открыть переписку.', formal));
        retry = setTimeout(() => { void start(); }, 8000);
      }
    };
    void start();
    return () => { alive = false; unwatch(); if (retry) clearTimeout(retry); if (poll) clearInterval(poll); if (roster) clearInterval(roster); };
  }, [session, chatId, merge, formal]);

  // Read marks move only while the newest message is on screen and the page is visible.
  const newest = messages[messages.length - 1]?.id;
  useEffect(() => {
    const visible = typeof document === 'undefined' || document.visibilityState === 'visible';
    if (placed && atBottom && newest !== undefined && visible && focused) markSeen(chatId, newest);
  }, [atBottom, chatId, focused, newest, placed]);

  // New messages from others below the visible part are counted on the jump button.
  useEffect(() => {
    const count = messages.length;
    if (!positioned.current) { seenCount.current = count; return; }
    if (count > seenCount.current && !bottom.current) {
      const fresh = messages.slice(seenCount.current).filter(m => m.senderId !== session.id).length;
      if (fresh) setBelow(current => current + fresh);
    }
    seenCount.current = count;
  }, [messages, session.id]);

  const toEnd = (animated: boolean) => {
    scroll.current?.scrollToEnd({ animated });
    bottom.current = true; setAtBottom(true); setBelow(0);
  };
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    metrics.current = { offset: contentOffset.y, height: layoutMeasurement.height, content: contentSize.height };
    const near = contentSize.height - contentOffset.y - layoutMeasurement.height < 64;
    if (near !== bottom.current) { bottom.current = near; setAtBottom(near); }
    if (near) setBelow(0);
  };
  const onContentSize = (_: number, height: number) => {
    const previous = metrics.current.content;
    metrics.current.content = height;
    if (holdOffset.current !== null) {
      // Older messages were added above: keep the same message under the reader's eyes.
      scroll.current?.scrollTo({ y: holdOffset.current + height - previous, animated: false });
      holdOffset.current = null;
      return;
    }
    if (phase !== 'ready') return;
    if (!positioned.current) { place(); return; }
    if (bottom.current || followNext.current) { followNext.current = false; toEnd(true); }
  };
  // The chat opens at the «new» divider when there is one, otherwise at the newest message.
  const place = () => {
    if (positioned.current || phase !== 'ready') return;
    if (expectDivider.current && dividerY.current === null) return;
    positioned.current = true;
    seenCount.current = messages.length;
    setPlaced(true);
    if (expectDivider.current && dividerY.current !== null && metrics.current.content - dividerY.current > metrics.current.height * .6) {
      scroll.current?.scrollTo({ y: Math.max(0, dividerY.current - 72), animated: false });
      bottom.current = false; setAtBottom(false);
    } else toEnd(false);
  };

  // ------------------------------------------------------------- sending
  const deliver = async (item: Pending) => {
    setPending(current => current.map(p => p.key === item.key ? { ...p, failed: false } : p));
    try {
      const message = item.kind === 'voice' ? await session.sendVoice(chatId, item.voice) : await session.send(chatId, item.text);
      setPending(current => current.filter(p => p.key !== item.key));
      if (item.kind === 'voice') item.voice.audio.fill(0);
      merge([message]);
      setError('');
    } catch (problem) {
      setPending(current => current.map(p => p.key === item.key ? { ...p, failed: true } : p));
      setError(problemText(problem, say('Сообщение не ушло. Нажми «Повторить».', 'Сообщение не ушло. Нажмите «Повторить».'), formal));
    }
  };
  const queue = (item: Pending) => {
    followNext.current = true;
    setPending(current => [...current, item]);
    void deliver(item);
  };
  const newKey = () => `${Date.now()}-${Math.random()}`;
  const drop = (item: Pending) => {
    setPending(current => current.filter(p => p.key !== item.key));
    if (item.kind === 'voice') item.voice.audio.fill(0);
  };

  // An edit ends by itself when its message is deleted elsewhere.
  const editingNow = editing && messages.some(m => m.id === editing.id) ? editing : null;
  const ready = phase === 'ready';
  const voice = useChatVoice({
    active: focused && ready, enabled: ready && !editingNow,
    onRecorded: recorded => queue({ key: newKey(), kind: 'voice', voice: recorded, createdAt: new Date().toISOString(), failed: false }),
  });
  const voiceReady = Platform.OS === 'web' && voice.recorder.supported;

  const stopEditing = () => { setEditing(null); setEditText(''); setInputHeight(composerHeight); };
  const startEditing = (message: DecodedMessage) => {
    setEditing(message); setEditText(message.text ?? '');
    setTimeout(() => input.current?.focus(), 60);
  };
  const saveEdit = async (message: DecodedMessage) => {
    const text = editText.trim();
    if (!text || saving) return;
    if (text === message.text) { stopEditing(); return; }
    setSaving(true);
    try { merge([await session.edit(chatId, message.id, text)]); stopEditing(); setError(''); }
    catch (problem) { setError(problemText(problem, say('Не удалось изменить сообщение. Попробуй ещё раз.', 'Не удалось изменить сообщение. Попробуйте ещё раз.'), formal)); }
    finally { setSaving(false); }
  };
  const send = () => {
    if (!ready) return;
    if (editingNow) { void saveEdit(editingNow); return; }
    const text = draft.trim();
    if (!text) return;
    setDraft(''); setInputHeight(composerHeight);
    queue({ key: newKey(), kind: 'text', text, createdAt: new Date().toISOString(), failed: false });
  };
  const onKey = (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const native = event.nativeEvent as TextInputKeyPressEventData & { shiftKey?: boolean; isComposing?: boolean };
    if (native.key === 'Escape' && editingNow) { event.preventDefault(); stopEditing(); return; }
    if (native.key === 'Enter' && !native.shiftKey && !native.isComposing && finePointer()) { event.preventDefault(); send(); }
  };

  // ------------------------------------------------------------- message menu
  const actionsFor = (message: DecodedMessage) => {
    const own = message.senderId === session.id;
    return { copy: message.text !== null && canCopy(), edit: own && message.kind === 'text' && message.text !== null, remove: own };
  };
  const closeMenu = () => setMenu(closed);
  const afterMenu = (next: () => void) => { closeMenu(); setTimeout(next, SHEET_GAP_MS); };
  const copy = (text: string) => {
    closeMenu();
    navigator.clipboard.writeText(text).then(() => flash('СКОПИРОВАНО'), () => flash('Не удалось скопировать.'));
  };
  const removeMessage = async () => {
    const message = doomed?.message;
    if (!message || removing) return;
    setRemoving(true);
    try { merge([await session.remove(chatId, message.id)]); setError(''); }
    catch (problem) { setError(problemText(problem, say('Не удалось удалить сообщение. Попробуй ещё раз.', 'Не удалось удалить сообщение. Попробуйте ещё раз.'), formal)); }
    finally { setRemoving(false); setDoomed(closed); }
  };

  const names = useMemo(() => new Map(members.map(m => [m.userId, m])), [members]);
  const others = members.filter(m => m.userId !== session.id);
  const walker = !session.status?.mainAdmin && !session.status?.roles.length;
  const titleId = walker ? chat.guideId : chat.walkerId;
  const title = walker ? chat.guideName ?? 'Переписка' : chat.walkerName;
  const titlePlace = names.get(titleId ?? '')?.place ?? (walker ? 'guide' : 'walker');
  // The title already names one person: lead with their role, then the rest of the room.
  const rest = others.filter(m => m.userId !== titleId).map(m => `${shortPlace[m.place]} ${m.name}`);
  const subtitle = error && phase !== 'ready' ? 'НЕТ СВЯЗИ…' : phase === 'loading' ? 'ПОДКЛЮЧАЮСЬ…'
    : titleId ? [shortPlace[titlePlace], ...rest].join(' · ') : rest.length ? rest.join(' · ') : 'ТОЛЬКО ТЫ';

  // ------------------------------------------------------------- feed
  const shown = messages.slice(-limit);
  const hidden = messages.length - shown.length;
  const dividerShown = unreadFrom != null && shown.some(m => m.id === unreadFrom);
  // Read by place() from layout callbacks, which run after this commit.
  useLayoutEffect(() => { expectDivider.current = dividerShown; }, [dividerShown]);
  const feed: ReactNode[] = [];
  shown.forEach((message, index) => {
    const previous = shown[index - 1];
    const own = message.senderId === session.id;
    const sent = Date.parse(message.createdAt);
    const newDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
    const divider = message.id === unreadFrom;
    if (newDay) feed.push(<DayRow key={`day-${message.id}`} label={dayLabel(message.createdAt)} />);
    if (divider) feed.push(<View key="unread" onLayout={event => { dividerY.current = event.nativeEvent.layout.y; place(); }}><DayRow accent label="НОВЫЕ СООБЩЕНИЯ" /></View>);
    const first = newDay || divider || previous.senderId !== message.senderId || sent - Date.parse(previous.createdAt) > GROUP_MS;
    const author = names.get(message.senderId);
    const actions = actionsFor(message);
    feed.push(<Bubble key={message.id} own={own} first={first} frame={own ? first ? frames.own : frames.ownRest : first ? frames.other : frames.otherRest}
      author={!own && first ? `${author?.name ?? 'Бывший участник'} · ${shortPlace[message.senderRole]}` : undefined}
      time={time(message.createdAt)} edited={!!message.editedAt} status={own ? 'sent' : undefined} marked={editingNow?.id === message.id || (!!menu?.open && menu.message.id === message.id)}
      onMenu={actions.copy || actions.edit || actions.remove ? () => setMenu({ message, open: true }) : undefined} holdsControls={message.kind === 'voice'}>
      {message.kind === 'voice' && message.voice
        ? <VoiceBody voice={message.voice} active={activeVoice === message.id} onActivate={() => setActiveVoice(message.id)} source={{ session, chatId, message }} />
        : <MessageText text={message.text} />}
    </Bubble>);
  });
  pending.forEach((item, index) => {
    const previous = index ? null : shown[shown.length - 1];
    const first = index === 0 && (!previous || previous.senderId !== session.id);
    if (index === 0 && previous && dayKey(previous.createdAt) !== dayKey(item.createdAt)) feed.push(<DayRow key="day-pending" label="СЕГОДНЯ" />);
    feed.push(<Bubble key={item.key} own first={first} frame={first ? frames.own : frames.ownRest} time={time(item.createdAt)} holdsControls={item.kind === 'voice'}
      status={item.failed ? 'failed' : 'sending'} onRetry={() => { void deliver(item); }} onDrop={() => drop(item)}>
      {item.kind === 'voice' ? <VoiceBody voice={item.voice} active={false} /> : <MessageText text={item.text} />}
    </Bubble>);
  });

  const empty = phase === 'ready' && !messages.length && !pending.length;
  const value = editingNow ? editText : draft;
  const showSend = !voice.capturing && (!!editingNow || !voiceReady || !!value.trim());
  const sendDisabled = !ready || !value.trim() || saving;
  const hint = error && ready ? '' : voice.error || voice.hint || notice;
  const menuActions = menu ? actionsFor(menu.message) : null;
  return <>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
      style={[styles.chat, keyboard.visible && { paddingBottom: keyboard.bottomInset }]}>
      <View style={[styles.header, { paddingHorizontal: gutter }]}>
        <ProductIconButton icon="back" onPress={onBack} />
        <Pressable accessibilityRole="button" accessibilityLabel={`${title}. Участники и шифрование`} onPress={() => setInfo(true)} style={styles.headerMiddle}>
          <View style={styles.headerCopy}>
            <ProductText variant="title" numberOfLines={1} style={styles.headerTitle}>{title}</ProductText>
            <ProductText numberOfLines={1} maxFontSize={10} style={[styles.headerSubtitle, error && phase !== 'ready' && { color: colors.error }]}>{subtitle}</ProductText>
          </View>
        </Pressable>
        {action ?? <View style={styles.headerSpacer} />}
      </View>
      <View style={styles.feedWindow}>
        <ScrollView ref={scroll} style={styles.feed} contentContainerStyle={[styles.feedContent, { paddingHorizontal: gutter }, (empty || !ready) && styles.feedCentered]}
          onScroll={onScroll} scrollEventThrottle={32} onContentSizeChange={onContentSize}
          onLayout={event => { metrics.current.height = event.nativeEvent.layout.height; }}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
          {phase === 'loading' ? <ProductText maxFontSize={10} style={styles.loading}>{error || 'ОТКРЫВАЮ ПЕРЕПИСКУ…'}</ProductText> : null}
          {phase === 'no-key' ? <Plate glyph="key" title="Ждём ключ переписки">Он придёт, когда кто-то из участников откроет чат. Обычно это пара минут.</Plate> : null}
          {empty ? <Plate glyph="lock" title="Сообщений пока нет">{say('Напиши первым.', 'Напишите первым.')} Переписку видят только её участники.</Plate> : null}
          {hidden > 0 ? <Pressable accessibilityRole="button" onPress={() => { holdOffset.current = metrics.current.offset; setLimit(current => current + PAGE); }} style={styles.earlier}>
            <ProductText maxFontSize={10} style={styles.earlierText}>{`ПОКАЗАТЬ РАНЬШЕ · ${hidden}`}</ProductText>
          </Pressable> : null}
          {feed}
        </ScrollView>
        {ready && !atBottom ? <Pressable accessibilityRole="button" accessibilityLabel={below ? `Вниз, новых сообщений: ${below}` : 'Вниз, к последним сообщениям'}
          onPress={() => toEnd(true)} style={[styles.jump, { right: gutter }]}>
          <DiaryGlass shape="icon" /><PanelArtwork source={frames.icon} />
          <Glyph name="down" size={20} />
          {below ? <View style={styles.badge}><ProductText maxFontSize={10} style={styles.badgeText}>{below > 99 ? '99+' : String(below)}</ProductText></View> : null}
        </Pressable> : null}
      </View>
      <View style={[styles.composer, { paddingHorizontal: gutter }]}>
        {error && ready ? <ProductText accessibilityRole="alert" maxFontSize={12} style={styles.error}>{error}</ProductText> : null}
        {hint ? <ProductText accessibilityRole={voice.error ? 'alert' : undefined} maxFontSize={12} style={[styles.notice, !!voice.error && { color: colors.error }]}>{hint}</ProductText> : null}
        {editingNow ? <View style={styles.editBar}>
          <Glyph name="edit" size={18} />
          <View style={styles.editCopy}>
            <ProductText maxFontSize={10} style={styles.editLabel}>ИЗМЕНЕНИЕ СООБЩЕНИЯ</ProductText>
            <ProductText numberOfLines={1} style={styles.editQuote}>{(editingNow.text ?? '').replace(/\s+/g, ' ')}</ProductText>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Отменить изменение" disabled={saving} onPress={stopEditing} style={styles.editClose}><DiaryIcon name="close" size={16} /></Pressable>
        </View> : null}
        <View style={styles.composerRow}>
          <View style={styles.inputWrap}>
            <DiaryGlass shape="input" /><PanelArtwork source={frames.input} />
            {voice.capturing ? <View style={[styles.recordingInput, { height: composerHeight }]}>
              <View style={[styles.recordingDot, { backgroundColor: colors.accent }]} />
              <ProductText maxFontSize={12} style={styles.recordingTime}>{`${diaryClock(voice.recorder.durationMs)} / ${diaryClock(VOICE_LIMIT_SECONDS * 1000)}`}</ProductText>
              <ProductText maxFontSize={10} color={colors.muted} style={styles.recordingHint}>{voice.recorder.phase === 'preparing' ? 'МИКРОФОН…' : voice.recorder.phase === 'stopping' ? 'ЗАВЕРШАЕМ…'
                : voice.locked ? 'ЗАПИСЬ ЗАКРЕПЛЕНА' : voice.cancelProgress === 1 ? say('ОТПУСТИ — ОТМЕНА', 'ОТПУСТИТЕ — ОТМЕНА') : '← ОТМЕНА'}</ProductText>
              {voice.locked ? <Pressable accessibilityRole="button" accessibilityLabel="Отменить голосовое сообщение" onPress={() => { void voice.discard(); }} style={styles.cancelRecord}><DiaryIcon name="trash" size={16} /></Pressable> : null}
            </View> : <TextInput ref={input} value={value} onChangeText={editingNow ? setEditText : setDraft} multiline scrollEnabled maxLength={MAX_LENGTH} editable={ready && !saving}
              placeholder={ready ? 'Сообщение' : say('Подожди немного…', 'Подождите немного…')} placeholderTextColor={colors.faint} selectionColor={colors.accent}
              onKeyPress={onKey} accessibilityLabel={editingNow ? 'Текст сообщения' : 'Сообщение'}
              onContentSizeChange={event => setInputHeight(Math.max(composerHeight, Math.min(132, event.nativeEvent.contentSize.height)))}
              style={[styles.field, { paddingVertical: (composerHeight - 22) / 2, height: value ? Math.max(composerHeight, inputHeight) : composerHeight }]} />}
          </View>
          {showSend ? <Pressable accessibilityRole="button" accessibilityLabel={editingNow ? 'Сохранить изменение' : 'Отправить'} accessibilityState={{ disabled: sendDisabled, busy: saving }} disabled={sendDisabled}
            onPress={send} style={[styles.sendButton, { width: composerHeight, height: composerHeight }, sendDisabled && !saving && { opacity: .4 }]}>
            <DiaryGlass /><PanelBorder color={colors.accent} />
            {saving ? <ProductText>···</ProductText> : editingNow ? <Glyph name="check" size={20} /> : <DiaryIcon name="send" size={20} />}
          </Pressable> : <DiaryRecordButton voice={voice} size={composerHeight} disabled={!ready} />}
        </View>
      </View>
    </KeyboardAvoidingView>
    <BottomSheet open={!!menu?.open} onClose={closeMenu} reducedMotion={settings.reducedMotion} bottomInset={keyboard.bottomInset}>
      {menu && menuActions ? <DiaryDesignPanel title="СООБЩЕНИЕ" onClose={closeMenu}>
        <View>
          {menuActions.copy ? <ListItem glyph="copy" title="Копировать" chevron={false} last={!menuActions.edit && !menuActions.remove}
            onPress={() => copy(menu.message.text ?? '')} /> : null}
          {menuActions.edit ? <ListItem glyph="edit" title="Изменить" chevron={false} last={!menuActions.remove}
            onPress={() => afterMenu(() => startEditing(menu.message))} /> : null}
          {menuActions.remove ? <ListItem glyph="trash" title="Удалить" tone="error" chevron={false} last
            onPress={() => afterMenu(() => setDoomed({ message: menu.message, open: true }))} /> : null}
        </View>
      </DiaryDesignPanel> : null}
    </BottomSheet>
    <ConfirmSheet open={!!doomed?.open} title="УДАЛИТЬ СООБЩЕНИЕ?" text="Сообщение исчезнет у всех участников переписки." confirmLabel="УДАЛИТЬ"
      busy={removing} onConfirm={() => { void removeMessage(); }} onClose={() => setDoomed(closed)} />
    <BottomSheet open={info} onClose={() => setInfo(false)} reducedMotion={settings.reducedMotion} bottomInset={keyboard.bottomInset}>
      <DiaryDesignPanel title="УЧАСТНИКИ ПЕРЕПИСКИ" onClose={() => setInfo(false)}
        footer={<ProductButton label="ПОНЯТНО" kind="outline" onPress={() => setInfo(false)} />}>
        <View style={styles.sheetStack}>
          <View>
            {members.map((member, index) => <View key={member.userId} style={[styles.member, index < members.length - 1 && styles.memberLine]}>
              <Avatar name={member.name} size={36} accent={member.place !== 'walker'} />
              <View style={styles.memberCopy}>
                <ProductText variant="title" numberOfLines={1} style={styles.memberName}>{member.userId === session.id ? `${member.name} (${say('ты', 'вы')})` : member.name}</ProductText>
                <ProductText maxFontSize={10} style={styles.memberRole}>{shortPlace[member.place]}</ProductText>
              </View>
            </View>)}
          </View>
          <View style={styles.secureBlock}>
            <Glyph name="shield" size={24} />
            <ProductText style={styles.sheetCopy}>Сообщения шифруются на устройстве, до отправки. Сервер хранит только шифр: прочесть переписку могут лишь её участники. Новый проводник или админ видит всю историю этой переписки.</ProductText>
          </View>
        </View>
      </DiaryDesignPanel>
    </BottomSheet>
  </>;
}

function Bubble({ own, first, frame, author, time: sentAt, edited = false, status, marked = false, holdsControls = false, onMenu, onRetry, onDrop, children }: {
  own: boolean; first: boolean; frame: { uri: string }; author?: string; time: string; edited?: boolean;
  status?: 'sending' | 'sent' | 'failed'; marked?: boolean; holdsControls?: boolean; onMenu?: () => void; onRetry?: () => void; onDrop?: () => void; children: ReactNode;
}) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  const failed = status === 'failed';
  return <View style={[styles.bubbleRow, own ? styles.ownRow : styles.otherRow, { marginTop: first ? 12 : 3 }]}>
    {/* A voice bubble holds its own play button, and a button cannot sit inside a button on the web:
        the bubble then offers its menu as an accessibility action instead of a role. */}
    <Pressable accessibilityRole={onMenu && !holdsControls ? 'button' : undefined} accessibilityHint={onMenu && !holdsControls ? 'Действия с сообщением' : undefined}
      accessibilityActions={onMenu && holdsControls ? [{ name: 'menu', label: 'Действия с сообщением' }] : undefined}
      onAccessibilityAction={onMenu && holdsControls ? () => onMenu() : undefined} disabled={!onMenu}
      onPress={onMenu} onLongPress={onMenu} delayLongPress={350}
      style={({ pressed }) => [styles.bubble, status === 'sending' && { opacity: .75 }, (pressed || marked) && { opacity: .7 }]}>
      <PanelArtwork source={frame} />
      {author ? <ProductText numberOfLines={1} maxFontSize={10} style={styles.author}>{author}</ProductText> : null}
      {children}
      <View style={styles.meta}>
        <ProductText maxFontSize={10} style={styles.time}>{edited ? `ИЗМЕНЕНО ${sentAt}` : sentAt}</ProductText>
        {status ? <Glyph name={status === 'sending' ? 'clock' : status === 'failed' ? 'alert' : 'check'} size={12} color={failed ? colors.error : colors.accent} /> : null}
      </View>
    </Pressable>
    {failed ? <View style={styles.failRow}>
      <ProductText maxFontSize={10} style={[styles.failText, { color: colors.error }]}>НЕ ОТПРАВЛЕНО</ProductText>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.failAction}><ProductText maxFontSize={10} style={styles.failLink}>ПОВТОРИТЬ</ProductText></Pressable>
      <Pressable accessibilityRole="button" onPress={onDrop} style={styles.failAction}><ProductText maxFontSize={10} style={[styles.failLink, { color: colors.muted }]}>УБРАТЬ</ProductText></Pressable>
    </View> : null}
  </View>;
}

function MessageText({ text }: { text: string | null }) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  return text === null
    ? <ProductText style={[styles.text, { color: colors.faint }]}>Не удалось расшифровать это сообщение.</ProductText>
    : <ProductText style={styles.text}>{text}</ProductText>;
}

type VoiceSource = { session: IntensiveSession; chatId: string; message: DecodedMessage };

/** Recorded levels are quiet; the bars are drawn against the loudest moment. */
function useLevels(waveform: readonly number[]) {
  return useMemo(() => {
    const peak = Math.max(.05, ...waveform);
    return waveform.map(level => Math.min(1, level / peak));
  }, [waveform]);
}

function VoiceBody({ voice, active, onActivate, source }: { voice: VoiceMeta; active: boolean; onActivate?: () => void; source?: VoiceSource }) {
  const styles = useThemeStyles(createStyles);
  const levels = useLevels(voice.waveform);
  if (active && source) return <LoadedVoice voice={voice} levels={levels} source={source} />;
  return <View style={styles.voice}>
    <View style={styles.voiceRow}>
      <Pressable accessibilityRole="button" accessibilityLabel="Слушать голосовое сообщение" disabled={!onActivate || !source} onPress={onActivate}
        style={[styles.play, (!onActivate || !source) && { opacity: .5 }]}>
        <DiaryGlass /><PanelBorder /><DiaryIcon name="play" />
      </Pressable>
      <DiaryWaveform waveform={levels} durationMs={voice.durationMs} />
    </View>
  </View>;
}

function LoadedVoice({ voice, levels, source }: { voice: VoiceMeta; levels: number[]; source: VoiceSource }) {
  const styles = useThemeStyles(createStyles);
  const [uri, setUri] = useState<string | null>(null), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  const player = useObservationPlayer(uri), started = useRef(false);
  const formal = useFormal();
  const { session, chatId, message } = source;
  useEffect(() => {
    let live = true, owned: string | null = null;
    session.voiceAudio(chatId, message).then(bytes => {
      if (!live) return;
      owned = URL.createObjectURL(new Blob([bytes], { type: voice.mimeType }));
      setUri(owned);
    }, (problem: unknown) => { if (live) setError(problemText(problem, 'Не удалось открыть запись.', formal)); });
    return () => { live = false; if (owned) URL.revokeObjectURL(owned); };
  }, [session, chatId, message, voice.mimeType, attempt, formal]);
  const play = player.play;
  // It was opened by a tap on «play», so it starts at once.
  useEffect(() => { if (player.loaded && !started.current) { started.current = true; void play(); } }, [player.loaded, play]);
  const problem = error || player.error;
  return <View style={styles.voice}>
    <View style={styles.voiceRow}>
      <Pressable accessibilityRole="button" accessibilityLabel={problem ? 'Повторить загрузку записи' : player.playing ? 'Пауза' : 'Слушать голосовое сообщение'}
        disabled={!problem && !player.loaded}
        onPress={() => { if (problem) { started.current = false; setUri(null); setError(''); setAttempt(value => value + 1); } else void player.toggle(); }} style={styles.play}>
        <DiaryGlass /><PanelBorder />
        {problem || !player.loaded ? <ProductText>{problem ? '↻' : '···'}</ProductText> : <DiaryIcon name={player.playing ? 'pause' : 'play'} />}
      </Pressable>
      <DiaryWaveform waveform={levels} durationMs={voice.durationMs} positionMs={player.positionMs} onSeek={player.loaded ? ms => { void player.seekTo(ms / 1000); } : undefined} />
    </View>
    {problem ? <ProductText accessibilityRole="alert" maxFontSize={10} style={styles.voiceProblem}>{problem}</ProductText> : null}
  </View>;
}

const createStyles = (colors: ProductColors) => StyleSheet.create({
  list: { gap: 12 },
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 2, minHeight: 72 },
  chatBody: { flex: 1, minWidth: 0, minHeight: 72, justifyContent: 'center', gap: 4, paddingVertical: 12, paddingRight: 4 },
  chatLine: { borderBottomWidth: .25, borderBottomColor: colors.border },
  chatTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  chatName: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 22, fontWeight: '500' },
  chatTime: { fontSize: 8, lineHeight: 12, color: colors.faint, letterSpacing: .8 },
  chatPreview: { flex: 1, minWidth: 0, fontFamily: fonts.title, fontWeight: '400', fontSize: 13, lineHeight: 19, color: colors.muted },
  unreadMark: { width: 8, height: 8, backgroundColor: colors.accent, transform: [{ rotate: '45deg' }], marginRight: 4 },
  nothing: { fontSize: 10, lineHeight: 16, color: colors.muted, paddingVertical: 16, textAlign: 'center' },
  chat: { flex: 1, minHeight: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 16, paddingBottom: 10, borderBottomWidth: .25, borderBottomColor: colors.border, backgroundColor: colors.background },
  headerMiddle: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  headerTitle: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  headerSubtitle: { fontSize: 8, lineHeight: 12, color: colors.muted, letterSpacing: .8 },
  headerSpacer: { width: 8 },
  feedWindow: { flex: 1, minHeight: 0 },
  feed: { flex: 1, minHeight: 0 },
  feedContent: { flexGrow: 1, justifyContent: 'flex-end', paddingTop: 8, paddingBottom: 12 },
  feedCentered: { justifyContent: 'center' },
  loading: { fontSize: 8, lineHeight: 12, color: colors.muted, letterSpacing: 1.6, textAlign: 'center' },
  earlier: { alignSelf: 'center', minHeight: 36, justifyContent: 'center', paddingHorizontal: 12 },
  earlierText: { fontSize: 8, lineHeight: 12, color: colors.accent, letterSpacing: 1.6, textDecorationLine: 'underline' },
  bubbleRow: { maxWidth: '84%', gap: 4 },
  ownRow: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  otherRow: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { minWidth: 76, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, gap: 2 },
  author: { fontSize: 8, lineHeight: 12, color: colors.accent, letterSpacing: .8, marginBottom: 2 },
  // Disket Mono has capitals only; people's own words need lowercase, so messages use Tektur.
  text: { fontFamily: fonts.title, fontWeight: '400', fontSize: 15, lineHeight: 21, letterSpacing: .2, color: colors.text },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, minHeight: 14 },
  time: { fontSize: 8, lineHeight: 12, color: colors.faint },
  voice: { width: 216, gap: 4, paddingTop: 2 },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  play: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  voiceProblem: { fontSize: 8, lineHeight: 12, color: colors.error },
  failRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  failText: { fontSize: 8, lineHeight: 12, letterSpacing: .8 },
  failAction: { minHeight: 32, justifyContent: 'center' },
  failLink: { fontSize: 8, lineHeight: 12, color: colors.accent, letterSpacing: .8, textDecorationLine: 'underline' },
  jump: { position: 'absolute', bottom: 12, width: 44, height: 42, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -8, left: -6, minWidth: 20, height: 18, paddingHorizontal: 4, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 8, lineHeight: 12, color: colors.background },
  composer: { flexShrink: 0, paddingTop: 8, paddingBottom: 12, gap: 6 },
  composerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  inputWrap: { flex: 1, minWidth: 0, minHeight: 44, overflow: 'hidden' },
  field: {
    position: 'relative', zIndex: 1, fontFamily: fonts.title, fontSize: 16, lineHeight: 22, color: colors.text, paddingHorizontal: 14, minHeight: 44, maxHeight: 132, textAlignVertical: 'top',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as object : {}),
  },
  recordingInput: { position: 'relative', zIndex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 8 },
  recordingDot: { width: 5, height: 5, borderRadius: 3 },
  recordingTime: { fontSize: 10, lineHeight: 14, flexShrink: 0 },
  recordingHint: { fontSize: 8, lineHeight: 12, flex: 1, textAlign: 'right' },
  cancelRecord: { width: 28, height: 40, alignItems: 'center', justifyContent: 'center' },
  sendButton: { justifyContent: 'center', alignItems: 'center' },
  error: { fontSize: 10, lineHeight: 16, color: colors.error },
  notice: { fontSize: 10, lineHeight: 16, color: colors.muted },
  editBar: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingLeft: 10, borderLeftWidth: .75, borderLeftColor: colors.accent },
  editCopy: { flex: 1, minWidth: 0, gap: 2 },
  editLabel: { fontSize: 8, lineHeight: 12, color: colors.accent, letterSpacing: .8 },
  editQuote: { fontFamily: fonts.title, fontWeight: '400', fontSize: 13, lineHeight: 18, color: colors.muted },
  editClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  sheetStack: { gap: 18 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  memberLine: { borderBottomWidth: .25, borderBottomColor: colors.border },
  memberCopy: { flex: 1, minWidth: 0, gap: 2 },
  memberName: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  memberRole: { fontSize: 8, lineHeight: 12, color: colors.muted, letterSpacing: .8 },
  secureBlock: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  sheetCopy: { flex: 1, fontSize: 12, lineHeight: 20 },
});
