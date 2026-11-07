import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useIsFocused } from 'expo-router';

import { useProductLayout, useProductSpacing } from '../../product/layout';
import { MatrixBackdrop } from '../../product/motion/MatrixBackdrop';
import { useThemeStyles } from '../../product/ProductTheme';
import { useProduct } from '../../product/state/ProductProvider';
import { ProductButton, ProductIconButton, ProductScreen } from '../../product/ui';
import { BackendError } from '../backend';
import type { BackendFactory, ChatSummary, TotpEnrollment } from '../backend';
import type { Bytes } from '../crypto';
import type { DemoPersona } from '../demoBackend';
import { intensiveFactory } from '../config';
import { confirmationPositions, newPhrase, parseSecret, phraseKey } from '../phrase';
import { hasDevice, IntensiveSession, isFullName, shortCode, wipeDevice } from '../session';
import { AccountView } from './AccountView';
import { AdminConsole } from './AdminConsole';
import { AdminPanel } from './AdminPanel';
import { ChatList, ChatView } from './ChatView';
import { ConfirmSheet, GlassIconButton, Plate } from './chrome';
import { ConfirmWords, NameStep, PhraseView, RestoreStep, TotpEnroll, TotpVerify, Unavailable, Waiting, Welcome } from './EntrySteps';
import { FormalTone, Header, Note, PinPad, problemText, Tabs } from './parts';

/** Locks the account when the page stays hidden this long. */
const LOCK_AFTER_MS = 5 * 60_000;

type Step =
  | { kind: 'loading' }
  | { kind: 'unavailable'; title: string; lines: string[] }
  | { kind: 'welcome'; notice?: string }
  | { kind: 'phrase'; words: string[]; entropy: Bytes }
  | { kind: 'confirm'; words: string[]; entropy: Bytes; positions: number[] }
  | { kind: 'restore'; notice?: string }
  | { kind: 'name'; adding?: boolean }
  | { kind: 'pin'; first?: string; change?: boolean }
  | { kind: 'unlock'; forgot?: boolean }
  | { kind: 'totp-enroll'; required: boolean; enrollment: TotpEnrollment | null; back: 'home' | 'account' }
  | { kind: 'totp-verify' }
  | { kind: 'home' }
  | { kind: 'chat'; chat: ChatSummary }
  | { kind: 'account' };

const isWeakPin = (pin: string) => /^(\d)\1{5}$/.test(pin) || '0123456789'.includes(pin) || '9876543210'.includes(pin);

/** `console` is the main admin's page: it signs in only, never creates an account or seals a device. */
export type FlowMode = 'app' | 'console';

function initialStep(factory: BackendFactory | null, mode: FlowMode): Step {
  if (Platform.OS !== 'web') return { kind: 'unavailable', title: mode === 'console' ? 'ОТКРОЙТЕ НА САЙТЕ' : 'ОТКРОЙ НА САЙТЕ', lines: ['Интенсив пока работает только на сайте code-of-stalker.github.io.'] };
  if (!factory) return { kind: 'unavailable', title: 'ИНТЕНСИВ ГОТОВИТСЯ', lines: ['Этот уровень пока готовится. Сейчас доступен базовый путь наблюдения.'] };
  if (!globalThis.crypto?.subtle) return { kind: 'unavailable', title: 'НУЖЕН ДРУГОЙ БРАУЗЕР', lines: ['Для шифрования нужен современный браузер и защищённое соединение (https).'] };
  if (hasDevice()) return { kind: 'unlock' };
  return mode === 'console' ? { kind: 'restore' } : { kind: 'welcome' };
}

export function IntensiveFlow({ onExit, mode = 'app' }: { onExit: () => void; mode?: FlowMode }) {
  const adminPage = mode === 'console';
  // The admin page addresses the main admin with «Вы»: `say(informal, formal)`.
  const say = (informal: string, formal: string) => adminPage ? formal : informal;
  const styles = useThemeStyles(createStyles);
  const wide = useProductLayout().columns === 2;
  const { settings } = useProduct();
  const focused = useIsFocused();
  const [factory] = useState(intensiveFactory);
  const [step, setStep] = useState<Step>(() => initialStep(factory, mode));
  const [session, setSession] = useState<IntensiveSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [personas, setPersonas] = useState<DemoPersona[] | null>(null);
  const [homeTab, setHomeTab] = useState<'chats' | 'people'>('chats');
  const sessionRef = useRef<IntensiveSession | null>(null);
  // The admin page keeps a words sign-in for this page only; the PIN is set in the app.
  const skipSeal = useRef(adminPage);

  const go = useCallback((next: Step) => { setError(''); setStep(next); }, []);
  const run = useCallback(async (work: () => Promise<void>, fallback?: string) => {
    setBusy(true); setError('');
    try { await work(); }
    catch (problem) { setError(problemText(problem, fallback, adminPage)); }
    finally { setBusy(false); }
  }, [adminPage]);

  useEffect(() => {
    if (!factory?.demo) return;
    void (factory as typeof factory & { personas(): Promise<DemoPersona[]> }).personas().then(setPersonas);
  }, [factory]);

  // Secrets leave memory when the screen closes or the page stays hidden.
  useEffect(() => () => { sessionRef.current?.lock(); sessionRef.current = null; }, []);
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
      const current = sessionRef.current;
      if (hiddenAt && Date.now() - hiddenAt > LOCK_AFTER_MS && current && (current.sealed || adminPage)) {
        current.lock(); sessionRef.current = null; setSession(null); go(initialStep(factory, mode));
      }
      hiddenAt = 0;
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [adminPage, factory, go, mode]);

  const enroll = useCallback((s: IntensiveSession, required: boolean, back: 'home' | 'account') => {
    go({ kind: 'totp-enroll', required, enrollment: null, back });
    s.enrollTotp()
      .then(enrollment => setStep(current => current.kind === 'totp-enroll' ? { ...current, enrollment } : current))
      .catch(problem => setError(adminPage ? problemText(problem, 'Не удалось подготовить ключ. Попробуйте ещё раз.', true)
        : problemText(problem, 'Не удалось подготовить ключ. Попробуй ещё раз.')));
  }, [adminPage, go]);

  /** A closed door: the session leaves memory and only the reason stays on screen. */
  const deny = useCallback((title: string, lines: string[]) => {
    sessionRef.current?.lock(); sessionRef.current = null; setSession(null);
    go({ kind: 'unavailable', title, lines });
  }, [go]);

  const enter = useCallback((s: IntensiveSession) => {
    sessionRef.current = s; setSession(s);
    const status = s.status!;
    if (status.blocked) return deny('ДОСТУП ЗАКРЫТ', ['Главный админ закрыл этому аккаунту доступ к Интенсиву. Переписка сохранена.', `Код аккаунта: ${shortCode(s.id)}. ${adminPage ? 'Назовите' : 'Назови'} его главному админу, если это ошибка.`]);
    if (adminPage && !status.mainAdmin) return deny('ТОЛЬКО ДЛЯ ГЛАВНОГО АДМИНА', ['Эта страница управляет Интенсивом: людьми, проводниками и доступом. Ваш аккаунт её не открывает.']);
    if (!status.hasProfile) return go({ kind: 'name' });
    if (!s.sealed && !skipSeal.current) return go({ kind: 'pin' });
    if (status.needsTotp && !status.hasTotp) return enroll(s, true, 'home');
    if (s.needsTotpStep) return go({ kind: 'totp-verify' });
    // After the TOTP step: staff may change their profile only in a verified session.
    if (!isFullName(status.name)) return go({ kind: 'name', adding: true });
    go({ kind: 'home' });
  }, [adminPage, deny, enroll, go]);

  const leave = useCallback((notice?: string) => {
    sessionRef.current?.lock(); sessionRef.current = null; setSession(null); skipSeal.current = adminPage;
    go(adminPage ? { kind: 'restore', notice } : { kind: 'welcome', notice });
  }, [adminPage, go]);

  const verifyCode = (code: string, factorId: string | undefined, after: () => void) => run(async () => {
    try { await session!.verifyTotp(code, factorId); }
    catch (problem) {
      if (!(problem instanceof BackendError && problem.code === 'invalid')) throw problem;
      setError(say('Код не подошёл. Проверь, что время на телефоне ставится автоматически, и введи свежий код.',
        'Код не подошёл. Проверьте, что время на телефоне ставится автоматически, и введите свежий код.'));
      return;
    }
    after();
  });

  // ------------------------------------------------------------- views

  // A bare step draws its own header and fills the screen, as a messenger chat does.
  let subtitle = adminPage ? 'АДМИНКА' : 'ВХОД', body: ReactNode = null, bare = false, back: (() => void) = onExit, action: ReactNode = undefined;
  const accountButton = <ProductIconButton icon="settings" onPress={() => go({ kind: 'account' })} />;

  switch (step.kind) {
    case 'loading': body = <Note>Загружаю…</Note>; break;
    case 'unavailable': subtitle = adminPage ? 'АДМИНКА' : ''; body = <Unavailable title={step.title} lines={step.lines} onBack={onExit} />; break;
    case 'welcome':
      body = <View style={styles.stack}>
        {step.notice ? <Plate glyph="alert" title="Аккаунт убран с устройства">{step.notice}</Plate> : null}
        <Welcome busy={busy} personas={personas}
          onCreate={() => { const { words, entropy } = newPhrase(); go({ kind: 'phrase', words, entropy }); }}
          onRestore={() => go({ kind: 'restore' })}
          onPersona={persona => { void run(async () => {
            skipSeal.current = true;
            const s = await IntensiveSession.restore(factory!, persona.entropy);
            if (s) enter(s);
          }); }} />
        {error ? <Note tone="error">{error}</Note> : null}
      </View>;
      break;
    case 'phrase':
      subtitle = 'НОВЫЙ АККАУНТ'; back = () => go({ kind: 'welcome' });
      body = <PhraseView words={step.words} keyLine={phraseKey(step.entropy)} title="ЗАПИШИ 12 СЛОВ" doneLabel="СЛОВА ЗАПИСАНЫ"
        intro={['Это ключ от аккаунта, как в криптокошельке. Почты и пароля нет: по этим словам аккаунт открывается на любом устройстве.', 'Запиши слова на бумаге по порядку.']}
        onDone={() => go({ kind: 'confirm', words: step.words, entropy: step.entropy, positions: confirmationPositions() })} />;
      break;
    case 'confirm':
      subtitle = 'НОВЫЙ АККАУНТ'; back = () => go({ kind: 'phrase', words: step.words, entropy: step.entropy });
      body = <ConfirmWords words={step.words} positions={step.positions} busy={busy} error={error}
        onBack={() => go({ kind: 'phrase', words: step.words, entropy: step.entropy })}
        onConfirmed={() => { void run(async () => { enter(await IntensiveSession.create(factory!, step.entropy)); }, 'Не удалось создать аккаунт. Попробуй ещё раз.'); }} />;
      break;
    case 'restore':
      subtitle = adminPage ? 'АДМИНКА · ВХОД' : 'ВХОД ПО СЛОВАМ';
      if (!adminPage) back = () => go({ kind: 'welcome' });
      body = <RestoreStep notice={step.notice ?? (adminPage ? 'На этом устройстве нет сохранённого аккаунта. Войдите по 12 словам главного админа: вход действует, пока открыта эта страница. Чтобы входить по PIN, задайте его в Интенсиве.' : undefined)}
        busy={busy} error={error} onSubmit={text => {
        const entropy = parseSecret(text);
        if (!entropy) { setError(say('Не похоже на 12 слов или строку из 32 знаков. Проверь написание.', 'Не похоже на 12 слов или строку из 32 знаков. Проверьте написание.')); return; }
        void run(async () => {
          const s = await IntensiveSession.restore(factory!, entropy);
          if (!s) { setError(say('Аккаунт с этими словами не найден. Проверь слова или создай новый аккаунт.', 'Аккаунт с этими словами не найден. Проверьте слова.')); return; }
          enter(s);
        });
      }} />;
      break;
    case 'name': {
      const adding = !!step.adding;
      subtitle = adding ? adminPage ? 'АДМИНКА' : 'АККАУНТ' : 'НОВЫЙ АККАУНТ';
      body = <NameStep adding={adding} initial={adding ? session?.status?.name ?? '' : ''} busy={busy} error={error} onSubmit={name => { void run(async () => {
        if (adding) await session!.rename(name); else await session!.createProfile(name);
        enter(session!);
      }); }} />;
      break;
    }
    case 'pin': {
      // Restoring by the words lands here too, so the subtitle names the device, not a new account.
      subtitle = step.change ? 'НОВЫЙ PIN' : 'ЭТО УСТРОЙСТВО';
      if (step.change) back = () => go({ kind: 'account' });
      const repeat = step.first !== undefined;
      body = <PinPad key={repeat ? 'repeat' : 'first'} busy={busy} error={error}
        title={repeat ? 'ПОВТОРИ PIN' : 'ПРИДУМАЙ PIN'}
        detail={repeat ? undefined : '6 цифр. PIN нужен при каждом входе на этом устройстве. 5 неверных PIN подряд убирают аккаунт с устройства.'}
        onComplete={pin => {
          if (!repeat) {
            if (isWeakPin(pin)) { setError('Слишком простой PIN. Придумай другой.'); return; }
            go({ ...step, first: pin }); return;
          }
          if (pin !== step.first) { setStep({ kind: 'pin', change: step.change }); setError('PIN не совпал. Придумай заново.'); return; }
          void run(async () => {
            await session!.sealDevice(pin);
            if (step.change) go({ kind: 'account' }); else enter(session!);
          });
        }} />;
      break;
    }
    case 'unlock':
      body = <View style={styles.stack}>
        <PinPad title={say('ВВЕДИ PIN', 'ВВЕДИТЕ PIN')} detail={adminPage ? 'PIN этого устройства из Интенсива. Потом нужен код из приложения-аутентификатора.' : undefined}
          busy={busy} error={error} onComplete={pin => { void run(async () => {
          // The admin page signs in on its own, so the app tab keeps its session.
          const result = await IntensiveSession.unlock(factory!, pin, { fresh: adminPage });
          if (result.status === 'ok') { enter(result.session); return; }
          if (result.status === 'wrong') { setError(`Неверный PIN. Осталось попыток: ${result.left}.`); return; }
          leave(say('После 5 неверных PIN аккаунт убран с этого устройства. Войди снова по 12 словам.', 'После 5 неверных PIN аккаунт убран с этого устройства. Войдите снова по 12 словам.'));
        }, say('Не удалось открыть. Проверь интернет: попытка не засчитана.', 'Не удалось открыть. Проверьте интернет: попытка не засчитана.')); }} />
        <ProductButton label={say('ЗАБЫЛ PIN', 'ЗАБЫЛИ PIN?')} kind="ghost" onPress={() => go({ kind: 'unlock', forgot: true })} disabled={busy} />
        <ConfirmSheet open={!!step.forgot} title={say('ЗАБЫЛ PIN?', 'ЗАБЫЛИ PIN?')} confirmLabel="ВОЙТИ ПО СЛОВАМ"
          text="Без PIN аккаунт открывается только по 12 словам. Убрать его с этого устройства и войти по словам?"
          onConfirm={() => { wipeDevice(); go({ kind: 'restore' }); }} onClose={() => go({ kind: 'unlock' })} />
      </View>;
      break;
    case 'totp-enroll':
      subtitle = 'ВТОРОЙ КЛЮЧ';
      if (step.back === 'account') back = () => go({ kind: 'account' });
      body = <TotpEnroll enrollment={step.enrollment} required={step.required} busy={busy} error={error}
        onSkip={step.required ? undefined : () => go({ kind: 'account' })}
        onVerify={code => { void verifyCode(code, step.enrollment?.factorId, () => go({ kind: step.back })); }} />;
      break;
    case 'totp-verify':
      subtitle = adminPage ? 'АДМИНКА · ВТОРОЙ КЛЮЧ' : 'ВТОРОЙ КЛЮЧ';
      body = <TotpVerify busy={busy} error={error} onVerify={code => { void verifyCode(code, undefined, () => enter(session!)); }} />;
      break;
    case 'home': {
      if (adminPage) {
        subtitle = 'АДМИНКА';
        action = <GlassIconButton label="Выйти из админки" glyph="logout" onPress={() => {
          sessionRef.current?.lock(); sessionRef.current = null; setSession(null); go(initialStep(factory, mode));
        }} />;
        body = <AdminConsole session={session!} onOpenChat={chatId => { void run(async () => {
          const chat = (await session!.myChats()).find(item => item.chatId === chatId);
          if (chat) go({ kind: 'chat', chat });
        }, 'Не удалось открыть переписку.'); }} />;
        break;
      }
      const status = session!.status!;
      const staff = status.mainAdmin || status.roles.length > 0;
      action = accountButton;
      if (!staff) { bare = true; body = <WalkerHome session={session!} account={accountButton} onExit={onExit} onRecheck={() => enter(session!)} />; break; }
      subtitle = status.mainAdmin && homeTab === 'people' ? 'ЛЮДИ' : 'ПЕРЕПИСКИ';
      body = <View style={styles.stack}>
        {status.mainAdmin ? <Tabs value={homeTab} onChange={setHomeTab} options={[{ id: 'chats', label: 'ПЕРЕПИСКИ' }, { id: 'people', label: 'ЛЮДИ' }]} /> : null}
        {status.mainAdmin && homeTab === 'people'
          ? <AdminPanel session={session!} onOpenChat={chatId => { void run(async () => {
            const chat = (await session!.myChats()).find(item => item.chatId === chatId);
            if (chat) go({ kind: 'chat', chat });
          }); }} />
          : <StaffChats session={session!} onOpen={chat => go({ kind: 'chat', chat })} />}
        {error ? <Note tone="error">{error}</Note> : null}
      </View>;
      break;
    }
    case 'chat':
      bare = true;
      body = <ChatView session={session!} chat={step.chat} onBack={() => go({ kind: 'home' })} />;
      break;
    case 'account':
      subtitle = 'АККАУНТ'; back = () => go({ kind: 'home' });
      body = <AccountView session={session!} busy={busy} error={error}
        onEnableTotp={() => enroll(session!, false, 'account')}
        onChangePin={() => go({ kind: 'pin', change: true })}
        onForget={() => { void run(async () => { await session!.forgetDevice(); sessionRef.current = null; setSession(null); skipSeal.current = false; go({ kind: 'welcome' }); }); }} />;
      break;
  }

  const backdrop = <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: .32 }]}>
    <MatrixBackdrop active={focused} reducedMotion={settings.reducedMotion} />
  </View>;
  // On a wide screen the admin console is a workspace: its list and card scroll on their own.
  const workspace = adminPage && step.kind === 'home' && wide;
  return <FormalTone value={adminPage}>
    <ProductScreen scroll={!bare && !workspace} headerStyle={{ paddingTop: 16 }} background={backdrop} layout={adminPage && step.kind === 'home' ? 'wide' : 'column'}
      contentStyle={bare ? styles.bare : workspace ? styles.workspace : styles.content}
      header={bare ? undefined : <Header subtitle={subtitle} onBack={back} action={action} />}>
      <View style={bare || workspace ? styles.fillBody : styles.body}>{body}</View>
    </ProductScreen>
  </FormalTone>;
}

function WalkerHome({ session, account, onExit, onRecheck }: { session: IntensiveSession; account: ReactNode; onExit: () => void; onRecheck: () => void }) {
  const styles = useThemeStyles(createStyles);
  const { gutter } = useProductSpacing();
  const [chat, setChat] = useState<ChatSummary | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const waiting = chat === null;
  useEffect(() => {
    let alive = true;
    const load = () => session.myChats().then(
      list => { if (alive) { setChat(list[0] ?? null); setError(''); } },
      problem => { if (alive) setError(problemText(problem)); });
    void load();
    // While waiting for a guide, look again now and then.
    const timer = waiting ? setInterval(() => { void load(); }, 30_000) : null;
    return () => { alive = false; if (timer) clearInterval(timer); };
  }, [session, version, waiting]);
  if (chat) return <ChatView session={session} chat={chat} onBack={onExit} action={account} />;
  return <ScrollView style={styles.fillBody} contentContainerStyle={[styles.waiting, { padding: gutter }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <Header subtitle={chat === undefined ? 'ВХОД' : 'ОЖИДАНИЕ'} onBack={onExit} action={account} />
    {chat === undefined ? (error ? <Note tone="error">{error}</Note> : <Note>Загружаю…</Note>) : <Waiting name={session.status!.name ?? ''} code={shortCode(session.id)} busy={busy} onRefresh={() => {
      setBusy(true);
      void session.refresh()
        .then(status => { if (status.roles.length || status.mainAdmin) onRecheck(); else setVersion(current => current + 1); })
        .catch(problem => setError(problemText(problem)))
        .finally(() => setBusy(false));
    }} />}
    {error && chat !== undefined ? <Note tone="error">{error}</Note> : null}
  </ScrollView>;
}

function StaffChats({ session, onOpen }: { session: IntensiveSession; onOpen: (chat: ChatSummary) => void }) {
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    const load = () => session.myChats().then(list => { if (alive) { setChats(list); setError(''); } })
      .catch(problem => { if (alive) setError(problemText(problem)); });
    void load();
    const timer = setInterval(() => { void load(); }, 30_000);
    return () => { alive = false; clearInterval(timer); };
  }, [session]);
  if (error && !chats) return <Note tone="error">{error}</Note>;
  if (!chats) return <Note>Загружаю…</Note>;
  return <ChatList session={session} chats={chats} onOpen={onOpen} />;
}

const createStyles = () => StyleSheet.create({
  content: { paddingTop: 24, paddingBottom: 32 },
  workspace: { paddingTop: 20, paddingBottom: 24 },
  bare: { padding: 0, paddingTop: 0, paddingBottom: 0 },
  waiting: { gap: 24 },
  body: { gap: 16 },
  fillBody: { flex: 1, minHeight: 0 },
  stack: { gap: 16 },
});
