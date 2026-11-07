import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent, TextInputKeyPressEventData } from 'react-native';
import { useIsFocused } from 'expo-router';

import { DiaryGlass } from '../../product/diary/DiaryGlass';
import { DiaryDesignPanel } from '../../product/diary/DiaryDesignPanel';
import { DiaryAsset, DiaryIcon } from '../../product/diary/DiaryIcons';
import { useDiaryKeyboard } from '../../product/diary/useDiaryKeyboard';
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
import type { DecodedMessage, IntensiveSession } from '../session';
import { Avatar, DayRow, Glyph, GlassField, Plate, useIntensiveFrames } from './chrome';
import { problemText } from './parts';

const MAX_LENGTH = 4000;
/** Older messages appear on request, so a long chat opens fast. */
const PAGE = 150;
/** Messages closer than this from one person form one group. */
const GROUP_MS = 5 * 60_000;
const finePointer = () => Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches;

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

// ------------------------------------------------------------------ list

function useChatPreviews(session: IntensiveSession, chats: ChatSummary[]) {
  const [, setVersion] = useState(0);
  useEffect(() => {
    let alive = true;
    void (async () => {
      for (const chat of chats) {
        if (!alive) return;
        if (!chat.lastMessageId || previewFor(chat.chatId, chat.lastMessageId)) continue;
        try {
          if (!await session.chatCipher(chat.chatId)) continue;
          const rows = await session.messages(chat.chatId, chat.lastMessageId - 1);
          const last = rows[rows.length - 1];
          if (last) keepPreview(chat.chatId, { messageId: chat.lastMessageId, senderId: last.senderId, senderRole: last.senderRole, text: last.text });
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
        const preview = chat.lastMessageId ? previewFor(chat.chatId, chat.lastMessageId) : undefined;
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

type Pending = { key: string; text: string; createdAt: string; failed: boolean };

export function ChatView({ session, chat, onBack, action }: { session: IntensiveSession; chat: ChatSummary; onBack: () => void; action?: ReactNode }) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  const frames = useIntensiveFrames();
  const { gutter } = useProductSpacing();
  const { width } = useWindowDimensions();
  const { settings } = useProduct();
  const focused = useIsFocused();
  const keyboard = useDiaryKeyboard();
  const chatId = chat.chatId;
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<DecodedMessage[]>([]);
  const [pending, setPending] = useState<Pending[]>([]);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'no-key'>('loading');
  const [error, setError] = useState('');
  const [draft, setDraftState] = useState(() => draftFor(chatId));
  const [limit, setLimit] = useState(PAGE);
  const [unreadFrom, setUnreadFrom] = useState<number | null | undefined>(undefined);
  const [below, setBelow] = useState(0);
  const [atBottom, setAtBottom] = useState(true);
  const [info, setInfo] = useState(false);
  const [placed, setPlaced] = useState(false);
  const composerHeight = width >= 375 ? 48 : 44;
  const [inputHeight, setInputHeight] = useState(composerHeight);
  const scroll = useRef<ScrollView>(null);
  const input = useRef<TextInput>(null);
  const lastId = useRef<number | undefined>(undefined);
  const bottom = useRef(true);
  const metrics = useRef({ offset: 0, height: 0, content: 0 });
  const positioned = useRef(false);
  const holdOffset = useRef<number | null>(null);
  const followNext = useRef(false);
  const dividerY = useRef<number | null>(null);
  const seenCount = useRef(0);
  const expectDivider = useRef(false);

  const setDraft = (text: string) => { setDraftState(text); keepDraft(chatId, text); };

  const merge = useCallback((incoming: DecodedMessage[]) => {
    if (!incoming.length) return;
    setMessages(current => {
      const known = new Set(current.map(m => m.id));
      const fresh = incoming.filter(m => !known.has(m.id));
      if (!fresh.length) return current;
      const next = [...current, ...fresh].sort((a, b) => a.id - b.id);
      lastId.current = next[next.length - 1].id;
      return next;
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
      try { const rows = await session.messages(chatId, lastId.current); if (alive) { take(rows); setError(''); } }
      catch { /* The next poll or live event catches up. */ }
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
        setError(problemText(problem, 'Не удалось открыть переписку.'));
        retry = setTimeout(() => { void start(); }, 8000);
      }
    };
    void start();
    return () => { alive = false; unwatch(); if (retry) clearTimeout(retry); if (poll) clearInterval(poll); if (roster) clearInterval(roster); };
  }, [session, chatId, merge]);

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

  const deliver = async (item: Pending) => {
    setPending(current => current.map(p => p.key === item.key ? { ...p, failed: false } : p));
    try {
      const message = await session.send(chatId, item.text);
      setPending(current => current.filter(p => p.key !== item.key));
      merge([message]);
      setError('');
    } catch (problem) {
      setPending(current => current.map(p => p.key === item.key ? { ...p, failed: true } : p));
      setError(problemText(problem, 'Сообщение не ушло. Нажми «Повторить».'));
    }
  };
  const send = () => {
    const text = draft.trim();
    if (!text || phase !== 'ready') return;
    const item = { key: `${Date.now()}-${Math.random()}`, text, createdAt: new Date().toISOString(), failed: false };
    setDraft(''); setInputHeight(composerHeight);
    followNext.current = true;
    setPending(current => [...current, item]);
    void deliver(item);
  };
  const onKey = (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const native = event.nativeEvent as TextInputKeyPressEventData & { shiftKey?: boolean; isComposing?: boolean };
    if (native.key === 'Enter' && !native.shiftKey && !native.isComposing && finePointer()) { event.preventDefault(); send(); }
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
    const at = Date.parse(message.createdAt);
    const newDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt);
    const divider = message.id === unreadFrom;
    if (newDay) feed.push(<DayRow key={`day-${message.id}`} label={dayLabel(message.createdAt)} />);
    if (divider) feed.push(<View key="unread" onLayout={event => { dividerY.current = event.nativeEvent.layout.y; place(); }}><DayRow accent label="НОВЫЕ СООБЩЕНИЯ" /></View>);
    const first = newDay || divider || previous.senderId !== message.senderId || at - Date.parse(previous.createdAt) > GROUP_MS;
    const author = names.get(message.senderId);
    feed.push(<Bubble key={message.id} own={own} first={first} frame={own ? frames.own : frames.other}
      author={!own && first ? `${author?.name ?? 'Бывший участник'} · ${shortPlace[message.senderRole]}` : undefined}
      text={message.text} time={time(message.createdAt)} status={own ? 'sent' : undefined} />);
  });
  pending.forEach((item, index) => {
    const previous = index ? null : shown[shown.length - 1];
    const first = index === 0 && (!previous || previous.senderId !== session.id);
    if (index === 0 && previous && dayKey(previous.createdAt) !== dayKey(item.createdAt)) feed.push(<DayRow key="day-pending" label="СЕГОДНЯ" />);
    feed.push(<Bubble key={item.key} own first={first} frame={frames.own} text={item.text} time={time(item.createdAt)}
      status={item.failed ? 'failed' : 'sending'} onRetry={() => { void deliver(item); }}
      onDrop={() => setPending(current => current.filter(p => p.key !== item.key))} />);
  });

  const empty = phase === 'ready' && !messages.length && !pending.length;
  const ready = phase === 'ready';
  return <>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
      style={[styles.chat, keyboard.visible && { paddingBottom: keyboard.bottomInset }]}>
      <View style={[styles.header, { paddingHorizontal: gutter }]}>
        <ProductIconButton icon="back" onPress={onBack} />
        <Pressable accessibilityRole="button" accessibilityLabel={`${title}. Участники и шифрование`} onPress={() => setInfo(true)} style={styles.headerMiddle}>
          <Avatar name={title} size={36} accent />
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
          {empty ? <Plate glyph="lock" title="Сообщений пока нет">Напиши первым. Переписку видят только её участники.</Plate> : null}
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
        <View style={styles.composerRow}>
          <View style={styles.inputWrap}>
            <DiaryGlass shape="input" /><PanelArtwork source={frames.input} />
            <TextInput ref={input} value={draft} onChangeText={setDraft} multiline scrollEnabled maxLength={MAX_LENGTH} editable={ready}
              placeholder={ready ? 'Сообщение' : 'Подожди немного…'} placeholderTextColor={colors.faint} selectionColor={colors.accent}
              onKeyPress={onKey} accessibilityLabel="Сообщение"
              onContentSizeChange={event => setInputHeight(Math.max(composerHeight, Math.min(132, event.nativeEvent.contentSize.height)))}
              style={[styles.field, { paddingVertical: (composerHeight - 22) / 2, height: draft ? Math.max(composerHeight, inputHeight) : composerHeight }]} />
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Отправить" accessibilityState={{ disabled: !ready || !draft.trim() }} disabled={!ready || !draft.trim()}
            onPress={send} style={[styles.sendButton, { width: composerHeight, height: composerHeight }, (!ready || !draft.trim()) && { opacity: .4 }]}>
            <DiaryGlass /><PanelBorder color={colors.accent} /><DiaryIcon name="send" size={20} />
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="О шифровании переписки" onPress={() => setInfo(true)} style={styles.secureNote}>
          <ProductText style={styles.secureText}>ПЕРЕПИСКА ЗАШИФРОВАНА</ProductText><DiaryAsset name="info" dim />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
    <BottomSheet open={info} onClose={() => setInfo(false)} reducedMotion={settings.reducedMotion} bottomInset={keyboard.bottomInset}>
      <DiaryDesignPanel title="УЧАСТНИКИ ПЕРЕПИСКИ" onClose={() => setInfo(false)}
        footer={<ProductButton label="ПОНЯТНО" kind="outline" onPress={() => setInfo(false)} />}>
        <View style={styles.sheetStack}>
          <View>
            {members.map((member, index) => <View key={member.userId} style={[styles.member, index < members.length - 1 && styles.memberLine]}>
              <Avatar name={member.name} size={36} accent={member.place !== 'walker'} />
              <View style={styles.memberCopy}>
                <ProductText variant="title" numberOfLines={1} style={styles.memberName}>{member.userId === session.id ? `${member.name} (ты)` : member.name}</ProductText>
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

function Bubble({ own, first, frame, author, text, time: at, status, onRetry, onDrop }: {
  own: boolean; first: boolean; frame: { uri: string }; author?: string; text: string | null; time: string;
  status?: 'sending' | 'sent' | 'failed'; onRetry?: () => void; onDrop?: () => void;
}) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  const failed = status === 'failed';
  return <View style={[styles.bubbleRow, own ? styles.ownRow : styles.otherRow, { marginTop: first ? 12 : 3 }]}>
    <View style={[styles.bubble, status === 'sending' && { opacity: .75 }]}>
      <PanelArtwork source={frame} />
      {author ? <ProductText numberOfLines={1} maxFontSize={10} style={styles.author}>{author}</ProductText> : null}
      {text === null
        ? <ProductText style={[styles.text, { color: colors.faint }]}>Не удалось расшифровать это сообщение.</ProductText>
        : <ProductText selectable style={styles.text}>{text}</ProductText>}
      <View style={styles.meta}>
        <ProductText maxFontSize={10} style={styles.time}>{at}</ProductText>
        {status ? <Glyph name={status === 'sending' ? 'clock' : status === 'failed' ? 'alert' : 'check'} size={12} color={failed ? colors.error : colors.accent} /> : null}
      </View>
    </View>
    {failed ? <View style={styles.failRow}>
      <ProductText maxFontSize={10} style={[styles.failText, { color: colors.error }]}>НЕ ОТПРАВЛЕНО</ProductText>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.failAction}><ProductText maxFontSize={10} style={styles.failLink}>ПОВТОРИТЬ</ProductText></Pressable>
      <Pressable accessibilityRole="button" onPress={onDrop} style={styles.failAction}><ProductText maxFontSize={10} style={[styles.failLink, { color: colors.muted }]}>УБРАТЬ</ProductText></Pressable>
    </View> : null}
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
  failRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  failText: { fontSize: 8, lineHeight: 12, letterSpacing: .8 },
  failAction: { minHeight: 32, justifyContent: 'center' },
  failLink: { fontSize: 8, lineHeight: 12, color: colors.accent, letterSpacing: .8, textDecorationLine: 'underline' },
  jump: { position: 'absolute', bottom: 12, width: 44, height: 42, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -8, left: -6, minWidth: 20, height: 18, paddingHorizontal: 4, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 8, lineHeight: 12, color: colors.background },
  composer: { flexShrink: 0, paddingTop: 8, paddingBottom: 4, gap: 6 },
  composerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-end' },
  inputWrap: { flex: 1, minWidth: 0, minHeight: 44, overflow: 'hidden' },
  field: {
    position: 'relative', zIndex: 1, fontFamily: fonts.title, fontSize: 16, lineHeight: 22, color: colors.text, paddingHorizontal: 14, minHeight: 44, maxHeight: 132, textAlignVertical: 'top',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as object : {}),
  },
  sendButton: { justifyContent: 'center', alignItems: 'center' },
  error: { fontSize: 10, lineHeight: 16, color: colors.error },
  secureNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 25 },
  secureText: { fontSize: 8, lineHeight: 11, color: colors.faint, letterSpacing: 3 },
  sheetStack: { gap: 18 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  memberLine: { borderBottomWidth: .25, borderBottomColor: colors.border },
  memberCopy: { flex: 1, minWidth: 0, gap: 2 },
  memberName: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  memberRole: { fontSize: 8, lineHeight: 12, color: colors.muted, letterSpacing: .8 },
  secureBlock: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  sheetCopy: { flex: 1, fontSize: 12, lineHeight: 20 },
});
