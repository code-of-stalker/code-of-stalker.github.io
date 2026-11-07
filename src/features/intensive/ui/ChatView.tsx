import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import type { NativeSyntheticEvent, TextInputKeyPressEventData } from 'react-native';

import { PanelBorder } from '../../product/PanelBorder';
import { useThemeColors, useThemeStyles } from '../../product/ProductTheme';
import type { ProductColors } from '../../product/theme';
import { fonts } from '../../product/theme';
import { ProductButton, ProductText } from '../../product/ui';
import type { ChatSummary, Member } from '../backend';
import type { DecodedMessage, IntensiveSession } from '../session';
import { formatTime, Note, placeLabels, problemText, Row } from './parts';

const MAX_LENGTH = 4000;
const finePointer = () => Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches;

export function ChatList({ chats, onOpen }: { chats: ChatSummary[]; onOpen: (chat: ChatSummary) => void }) {
  const styles = useThemeStyles(createStyles);
  if (!chats.length) return <Note>Переписок пока нет. Они появятся, когда Яна назначит идущих.</Note>;
  return <View style={styles.list}>
    {chats.map(chat => <Row key={chat.chatId} title={chat.walkerName} onPress={() => onOpen(chat)}
      detail={[
        chat.guideName ? `ПРОВОДНИК: ${chat.guideName}` : 'БЕЗ ПРОВОДНИКА',
        chat.adminName ? `АДМИН: ${chat.adminName}` : null,
        chat.lastMessageAt ? formatTime(chat.lastMessageAt) : 'НЕТ СООБЩЕНИЙ',
      ].filter(Boolean).join(' · ')} />)}
  </View>;
}

export function ChatView({ session, chat }: { session: IntensiveSession; chat: ChatSummary }) {
  const colors = useThemeColors();
  const styles = useThemeStyles(createStyles);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<DecodedMessage[]>([]);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'no-key'>('loading');
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const lastId = useRef<number | undefined>(undefined);
  const chatId = chat.chatId;

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
      try { const rows = await session.messages(chatId, lastId.current); if (alive) take(rows); }
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
        await pull();
        if (!alive) return;
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

  const names = useMemo(() => new Map(members.map(m => [m.userId, m.name])), [members]);
  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try { merge([await session.send(chatId, text)]); setDraft(''); setError(''); }
    catch (problem) { setError(problemText(problem, 'Сообщение не ушло. Попробуй ещё раз.')); }
    finally { setSending(false); }
  };
  const onKey = (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    const native = event.nativeEvent as TextInputKeyPressEventData & { shiftKey?: boolean };
    if (native.key === 'Enter' && !native.shiftKey && finePointer()) { event.preventDefault(); void send(); }
  };

  const others = members.filter(m => m.userId !== session.id);
  return <View style={styles.chat}>
    <ProductText variant="label" numberOfLines={3} style={styles.members}>
      {others.length ? others.map(m => `${placeLabels[m.place]}: ${m.name}`).join(' · ') : ' '}
    </ProductText>
    <ScrollView ref={scroll} style={styles.scroll} contentContainerStyle={styles.messages}
      onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {phase === 'loading' ? <Note>Открываю переписку…</Note> : null}
      {phase === 'no-key' ? <Note>Ключ переписки ещё не передан тебе. Он придёт, когда кто-то из участников откроет чат. Подожди немного.</Note> : null}
      {phase === 'ready' && !messages.length ? <Note>Сообщений пока нет. Напиши первым.</Note> : null}
      {messages.map(message => {
        const own = message.senderId === session.id;
        return <View key={message.id} style={[styles.bubble, own ? styles.own : styles.other]}>
          <PanelBorder color={own ? colors.accent : undefined} />
          <ProductText variant="label" numberOfLines={2} style={styles.meta}>
            {`${own ? 'ТЫ' : names.get(message.senderId) ?? 'БЫВШИЙ УЧАСТНИК'} · ${placeLabels[message.senderRole]} · ${formatTime(message.createdAt)}`}
          </ProductText>
          {message.text === null
            ? <ProductText style={[styles.text, { color: colors.faint }]}>Не удалось расшифровать это сообщение.</ProductText>
            : <ProductText selectable style={styles.text}>{message.text}</ProductText>}
        </View>;
      })}
    </ScrollView>
    {error ? <Note tone="error">{error}</Note> : null}
    <View style={styles.composer}>
      <View style={styles.input}>
        <PanelBorder />
        <TextInput value={draft} onChangeText={setDraft} multiline maxLength={MAX_LENGTH} placeholder="Сообщение" placeholderTextColor={colors.faint}
          editable={phase === 'ready'} onKeyPress={onKey} style={styles.field} accessibilityLabel="Сообщение" />
      </View>
      <ProductButton label={sending ? '…' : 'ОТПРАВИТЬ'} onPress={() => { void send(); }} disabled={phase !== 'ready' || sending || !draft.trim()} style={styles.send} />
    </View>
  </View>;
}

const createStyles = (colors: ProductColors) => StyleSheet.create({
  list: { gap: 8 },
  chat: { flex: 1, gap: 8, minHeight: 0 },
  members: { color: colors.muted, lineHeight: 14 },
  scroll: { flex: 1, minHeight: 0 },
  messages: { gap: 10, paddingVertical: 8 },
  bubble: { maxWidth: '86%', paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  own: { alignSelf: 'flex-end', backgroundColor: colors.subtle },
  other: { alignSelf: 'flex-start', backgroundColor: colors.surface },
  meta: { color: colors.muted, fontSize: 8, lineHeight: 12, letterSpacing: 1.2 },
  // Disket Mono has capitals only; people's own words need lowercase, so messages use Tektur.
  text: { fontFamily: fonts.title, fontWeight: '400', fontSize: 15, lineHeight: 21, letterSpacing: 0.2 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingBottom: 8 },
  input: { flex: 1, minHeight: 44, justifyContent: 'center' },
  field: {
    minHeight: 44, maxHeight: 140, paddingHorizontal: 12, paddingVertical: 12, color: colors.text, fontFamily: fonts.title, fontSize: 15, lineHeight: 21,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } as object : {}),
  },
  send: { paddingHorizontal: 14 },
});
