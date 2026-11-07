# Project state

Updated 2026-11-08. Step 6 page 02 «Каркас» shipped 2026-11-08. Intensive redesign, blocking, the /admin page, voice messages, edit/delete and name + surname shipped 2026-11-08. Step 6 page 01 «Внутрь» shipped 2026-11-07. Step 7 pages 02–03 shipped 2026-11-07. Step 6 hero «Внутренняя сфера» (scene + home card) shipped 2026-11-07. App icon and favicon «Выход» shipped 2026-11-07. Intensive chat shipped 2026-11-07. Step 2's last page «Лабиринт», five UI fixes, the panel edge fix and text wrapping shipped 2026-11-07. Stuck-release self-heal shipped 2026-11-02. Light themes removed from the site 2026-11-01. Latest on `main`: Step 7 «Динамическая сфера» (text, hero, page 01
scene), Step 5 pages 04–07 and Step 6 with placeholders, all 2026-11-01. Every Step 4 page
has its own scene (since 2026-10-31).
Art's rule (2026-10-31): small fixes are pushed at once via `/ship-to-main`; big changes such
as animations stay local until he says to ship them. Unsure which it is: ask.
Keep this file short: replace stale lines instead of appending history (`/handoff`).

## Step 2 last page «Лабиринт» (branch `claude/step-2-final-scene-85869e`, on `main` 2026-11-07)
Closing page 3/3 (art kind `author-intention`). Art asked for a richer scene and a properly
drawn person, chose the labyrinth: first-person walk, rise over the plan, light runs the path,
a figure of light forms in the court and breaks the walls; 50 s loop, still at 43 s. Crate
`graphics/hero-labyrinth` (beats in its `README.txt`), bridge `HeroLabyrinth.web.tsx`,
`webScene` set in `StepTwoTaskPage.tsx`. Art approved Тишина («Ок, подключай»); wired and
checked in the export at phone, tablet and PC in all 4 dark themes. Матрица and Искра dim the
figure's body and ink its lines paler (one pure hue). Shipped to `main` 2026-11-07 (Art: «Пушим»).

## Step 4 «Практика заземления и прямого узнавания»: page → scene
Text and page ids live in `src/features/product/stepFourContent.ts`. Two reading blocks
(6 + 8 pages) with four answerable questions between them; each block counts from 01.
Scenes are web only (Rust WebGL2); the native app keeps the engine art.

| Block/page | Page id, title | Scene crate | Image |
|---|---|---|---|
| 1 / 01 | grounding-default «Практика заземления и прямого узнавания» | world-in-glasses | girl in glasses among ruins, gold gum pops, the world cracks in the lenses (Art's lens mask) |
| 1 / 02 | grounding-absent «Где ты сейчас?» | cloud-drift (inline) | Art's painting with drifting clouds |
| 1 / 03 | grounding-automatic «Откуда берётся вывод?» | theatre-marionette | marionette theatre painting |
| 1 / 04 | grounding-contact «Простая практика» | simple-practice | seated figure, contact with the floor, presence light soles→crown; also the step 4 home card |
| 1 / 05 | grounding-speaking «Услышь своё состояние» | hear-state | one card per word, calm body scan, voice fronts |
| 1 / 06 | grounding-questions-origin «Вопросы настройки» | tuning-questions | conclusion as a waveform at lip height, sights over body points |
| questions | «Наблюдение или мысль?» as 4 questions | none (ObservationFlow) | voice answers like steps 1–2; hint = pages 04–06 |
| 2 / 01 | grounding-character «Персонаж: сон, в который поверил Абсолют» | persona-dream | plates lock into a mosaic shell over the person, matrix frame, «Я…» tags |
| 2 / 02 | grounding-program «Механизм обусловленности» | persona-program | the shell as a circuit, the same impulse path, six verbs on the card |
| 2 / 03 | grounding-belief «Я это действительно знаю?» | persona-belief «Оттиск» | macro of sand under a raking lamp, seals and imprints; no room, no person |
| 2 / 04 | grounding-call «Сила Зова» | call-bell «Колокол» | bell in a stone tower held by threads; threads snap, clapper strikes, sound floods the tower |
| 2 / 05 | grounding-awakening «Пробуждение» | awakening | portrait with a cracking, peeling mask |
| 2 / 06 | grounding-witnessing «Живое Осознавание» | witnessing | witnessing story, own light-theme artwork |
| 2 / 07 | grounding-recognition «Сущностные ощущения» | essence-flame «Пламя» | the candle is a wax figure of a person, flame in its crown; it melts into a plain candle, camera closes on the flame |
| 2 / 08 | grounding-real «Истинное распознавание» | true-sight «Глаз» | macro eye: dreams through the closed lid melt into each other; it opens, the world on the cornea becomes a grid that runs over the face; the lens goes through the pupil to a person of light |

Block 1 pages 04–06 and block 2 pages 01–02 share one look (dark room, seated person in
profile, card bottom-right, focus pulls). Do not make a sixth one like them.
Next: nothing queued; wait for Art.

## Step 5 «Внешнее кольцо» (branch `claude/step-5-sphere-fcddf0`)
Branch head: the handoff for shipping page 07 (2026-11-01); every Step 5 page is on `main`. Shipped to `main` 2026-10-31: hero, home card, forward scroll and page 01 (Art: «как сделаешь
первую анимацию запуш»), then page 01's head sway and page 02 «Якорь» (Art: «Пушим»), then page 03 «Скан комнаты» (Art: «Пушим»), then page 04 «Ты не точка», page 05 «Используй свой голос» and page 06 «Итог» on 2026-11-01 (Art: «Пушим» each), then page 07 «Позволь телу запомнить» on 2026-11-01
(Art: «пуш так»). 7 reading pages (text in `stepFiveContent.ts`), access via
step 4 page 14 or settings «ОТКРЫТЬ ПЯТЫЙ ШАГ». Art's illustration packs in `graphics/sphere-*/`,
briefs in `docs/step-five-illustrations-ru.md`. Page scenes go through `StepFiveScene.web.tsx`
(`webScene` on the page); pages without one keep their placeholder.
- Hero «Скан в глубине» (`graphics/sphere-hero`): drifting parallax camera, a wave of light from
  the feet every 10 s, the bird sings. All 7 themes (light: a muted two-ink print). Native and
  the web fallback keep Art's still (`StepFiveStill.tsx`). The home card from step 5 on plays it
  in card mode (Rust `cover(true)`).
- Step 4's last page (block 2, 08/08) scrolls on into Step 5 page 01.
- 01 «Мир вокруг» (`graphics/sphere-world`): we stand inside the sphere, the view turns once
  through Art's dark panorama in 90 s; beats at 2/20/38/56/74 s (gust, ripple, bird, ring with
  meridians, stars and a falling star). Light themes print the panorama as a sepia engraving
  (Art chose A). Prototype: 0 px lighter over the whole loop in Дюна/Мираж/Рассвет.
  Art asked for depth and a living head: a Depth Anything V2 depth map (`assets/depth.webp`,
  tools in `tools/`) gives parallax; the head sways, leans in and zooms a little at each beat;
  the pitch keeps the bird painted in the sky out of the 3:2 frame (Art: a still raster bird
  «выглядит тупо»).
- 02 «Якорь» (`graphics/sphere-anchor`): Art's glowing figure on a floor grid in a 48 s loop;
  the world stops, a band grounds the body, support points light, the form's outline draws up
  from the floor at 27 s, an axis and anchor sink in. After Art's notes: an even outline from a
  distance field (Rust `form_field`), Matrix-like dot rain in three depths behind, breathing,
  a soft floor reflection.
- 03 «Скан комнаты» (`graphics/sphere-room`, shipped to `main` 2026-10-31): Art's
  night room as a cloud of points placed by a depth map made here (`assets/depth.webp`); a plane
  of light sweeps the room once per list line and wakes one layer (sound waves, trees and
  curtain, floor draft, moonbeam motes, cup wisp and breathing, sphere and lattice); 60 s loop.
  Wired to page `sphere-scan`. Art OK'd Тишина («Ок, делай темы»); all 7 themes checked in the
  prototype (`output/prototypes/sphere-room/index.html`, sheets `kadry.jpg`, `temy.jpg`): light
  themes engrave in their inks, 0 px lighter than the page over the loop (120 frames each).
- Art chose direction A for every page (2026-10-31): 02 the figure on a floor grid, everything
  freezes, a wave down from the feet lights the support points; 03 the room as a point cloud
  with a scanner plane, one layer per list line; 04 a point → orbit ring → meridians → sphere,
  camera orbits 360°; 05 a dome of sound, each phrase «Я Здесь»…«Я Есть» adds a wave and a
  pattern belt; 06 stilling: the ripple weakens with each «Не…», the last leaves a mirror;
  07 the ring of places (room, street, crowd, field) the sphere projects (round 4).
- 04 «Ты не точка» (`graphics/sphere-orbit`, shipped to `main` 2026-11-01): no images, all 3D.
  A point opens into a ticked ring with a runner at 3 s (Art: 9 s of the point alone was too
  long), the ring rises into meridians and parallels (glints at the crossings), one wave
  crosses the sphere from each named side (24–40 s), all sides on «вокруг» (44 s); the camera
  orbits once per 54 s loop; near motes soft, far ones sharp like stars. Wired to page
  `sphere-expand`; the exported app mounts it at phone and wide sizes. Art OK'd Тишина; all 7
  themes checked in the prototype (`output/prototypes/sphere-orbit/index.html`, sheets
  `frames.jpg`, `temy.jpg`): light themes engrave in their inks, 0 px lighter than the page
  over the loop (108 frames each).
- 05 «Используй свой голос» (`graphics/sphere-voice`, shipped to `main` 2026-11-01): no
  images, one ray-traced pass. A string of light on a Chladni sand plate; each phrase (1–28 s)
  rings it, reshapes the sand, sends a bead up the axis, and builds one belt of a dome from the
  crown down (Art's note on round 1): «Я Здесь» grows the crown from a point, «Я Есть» sets the
  last belt on the plate; belts fade in softly. The camera climbs to look down on it (mandala),
  five pulses crown-down for the verbs (33.5–40.3 s), an inner and an outer dome open (42.5 s)
  and the floor's dials and glyph rings spin up each its own way («полное включение», Art),
  resting whole turns on by 55.5 s; the dome fades crown first (50 s); 56 s loop. Matrix hall behind: 4 walls of code rain,
  5 floating panels (scrolling code, the voice's wave), floor projection (dials, glyph rings,
  code streams). No floor mirror: a dome over its reflection reads as 04's sphere, and the
  mirror is 06's image. Wired to page `sphere-voice`. Prototype
  `output/prototypes/sphere-voice/index.html`. Art approved Тишина («Ок, делай темы»); all 7
  themes checked in the prototype (sheet `temy.jpg`), no per-theme changes needed: Дюна, Мираж,
  Рассвет 0 px lighter than the page over 108 frames each.
  The exported app mounts it at phone (295 px wide) and wide (544 px, the plate's width) sizes,
  no console or GPU error.
- 06 «Итог» (`graphics/sphere-lake`, shipped to `main` 2026-11-01): Art's night lake; the
  water below the shore line is computed (wave trains, rain rings, glossy reflection, glints).
  Starts as an almost-storm (slanting rain, clouds, big waves with foam, rocking camera).
  Each «Не…» (2.5/8.5/14.5/20.5 s) stills one cause of motion; the rain eases at the first and
  ends at the second. The lake is a mirror at 25 s and
  the ring closes into a whole circle with its reflection, the camera lowers to the shore line
  (31–39 s), the circle sounds at 42 s, the wind returns 52–60 s; 60 s loop, reduced motion
  shows 40 s. Wired to page `sphere-summary`; the exported app mounts it at phone (295 px) and
  wide (544 px) sizes, gpu error 0. Prototype `output/prototypes/sphere-lake/index.html`,
  sheets `kadry-tishina.png`, `temy.jpg` (all 7 themes). Art approved Тишина («Ок, делай
  темы»); light themes engrave the night painting (light pack unused), the storm water prints
  lighter there; Дюна, Мираж, Рассвет 0 px lighter than the page over 120 frames each.
- 07 «Позволь телу запомнить» «Везде» (`graphics/sphere-everywhere`, shipped to `main`
  2026-11-01, round 4): Art's 6:1 strip (room, street, crowd, field) uploaded as two
  halves, one ray-traced pass. Round 1 (a walk along the flat strip) was rejected except its
  ending (the ball in the ring of places); round 2 kept the whole loop in that ring with places
  simply lighting up. Round 3 per Art («сфера как бы проецировала эти изображения»): the ring
  is a blank screen and the ball a projector with a lamp at its centre; it throws each place
  onto the ring, beams visible in the air (18 ray-march samples, 58 fps in the export). The
  thrown place sits left-behind the ball (AIM) so the lamp stands against the dark. Round 4
  (Art: on and off «по очереди», all together on the run round): one place at a time. The
  room is thrown at first; the ring turns each next blank stretch under the beam (6/14.5/23 s),
  the ball rings (1.5/11.5/20/28.5 s), the place spreads behind the wave and the one before
  goes out (PASS); the lamp still grows with every place rung; the camera rises a step per
  place, then over the ring (30–37 s, the field alone); as a light runs round (39–45 s) the
  ball throws every place together (ALL 39–40.2 s); the seam heals with a flash (46–49 s);
  the camera comes down, the ball stops throwing the others, the seam opens (51–59 s); 60 s
  loop, reduced motion shows 49 s. Wired to
  page `sphere-anywhere`; the exported app mounts it at phone (295 px) and 1024 px wide (376 px)
  sizes, gpu error 0. Prototype `output/prototypes/sphere-everywhere/index.html`, sheet
  `frames.jpg`. Art OK'd Тишина; the dark themes (Искра, Астрал, Матрица) read right from the
  recolor. Light themes were NOT adapted: Art «забей на светлые темы пуш так», he thinks of
  removing them from the site. There the plain engraving prints the lamp and beams as dark ink;
  a lamp-colour wash for the ball's light was drafted and dropped (light pack unused).
  QA tip: in the hidden pane, open a Step 5 page via the step menu («Выбрать шаг» → the page's
  title), not by wheel.
- Step 5's last page (07) scrolls on into Step 6 page 01.

## Step 6 «Внутреннее кольцо» (scenes on branch `claude/step-6-scenes`)
Shipped to `main` 2026-11-01 with placeholders only (Art: «собери концепт после чего добавь на
сайт вместе с заглушками»). 10 reading pages, author's text unchanged
(`src/features/product/stepSixContent.ts`; emoji dropped, «потенциальностьПрисутствия» split).
Menu groups: Второй уровень [01], Обозревание Внутреннего Кольца [02–08], Итог [09, 10].
Access via step 5 page 07 (index 6) or settings «ОТКРЫТЬ ШЕСТОЙ ШАГ»; bookmark
`stepSixReading`, flag `sixthStepUnlocked`. Screen `StepSixScreen.tsx`, signature on page 10.
- Hero «Внутренняя сфера» (branch `claude/step-6-hero-deb7a4`), shipped to `main` 2026-11-07
  (Art: «Пушим»):
  Rust crate `graphics/inner-hero` from Art's painting (figure on a glass cube in a glass
  sphere); parallax by a depth map, the chest ring drawn in depth; every 18 s a scan plane goes
  head → feet, heart flares, ring runners, ripple from both feet. Beats in its `README.txt`.
  Wired: `InnerHero.web.tsx`, `StepSixHero*`, `StepSixStill.tsx`, home card from step 6 on.
  Art's fixes done (noise on the figure, ripple from the feet, the inner scan); Тишина
  approved 2026-11-07 («Ок, дальше»); Матрица, Искра, Астрал needed no color change. Page scenes are another branch
  (`claude/step-6-scenes`): both touch `types.ts`/`Art.web.tsx`, conflicts are one-line unions.
- Concept and briefs: `docs/step-six-illustrations-ru.md`. Hero «Внутренняя сфера», 01 «Внутрь»,
  02 «Каркас», 03 «Сосуд», 04 «Радар», 05 «Есть мысль», 06 «Облака», 07 «Гироскоп»,
  08 «Осциллограф», 09 «Тише шума», 10 «Любая среда». Seven pages fully 3D; raster needed for
  the hero, 06, 09, 10. Outer ring cold lamp, inner ring a warm second tone.
- Step 6's last page (10) scrolls on into Step 7 page 01.
- Page 01 «Внутрь» (inner-second-level), shipped to `main` 2026-11-07 (Art: «Пушим»),
  direction Б «Эхо»: crate `graphics/inner-echo`,
  bridge `InnerEcho.web.tsx`, `webScene: 'inner-echo'`. «Срез» (`inner-slice`) was rejected
  2026-11-07 and removed. A man sits upright on a chair; the outer ring is a turning orbit of
  perception, the inner one a warm level ring calmly scanning him feet ↔ crown (16.5 s). Four
  «Без…» beats with captions: on «Без проваливания» only the head with a thought knot stays; on
  «Без ухода в образы себя» the head beams out four different images of himself. 66 s loop;
  five rounds of Art's notes, history and beats in the crate README. Тишина approved
  2026-11-07 («Ок, делай темы»); Искра, Астрал, Матрица needed no color change (sheets
  `output/prototypes/inner-echo/kadry-tishina-5.jpg`, `kadry-temy-5.jpg`).
- Page 02 «Каркас» (inner-outer-orbit), shipped to `main` 2026-11-08 (Art: «Пушим»), direction
  В «Стройка»: crate `graphics/inner-frame`, bridge `InnerFrame.web.tsx`,
  `webScene: 'inner-frame'`. A ring truss on six legs as a 3D blueprint (hidden lines dashed,
  floor grid, plan circle), camera slowly orbiting; built module by module, then it spins; six
  signals with callouts light the node where they land; «якорь» piles into the floor; «не
  должен выключаться» everything dims but the truss; «каркас» warm posts and next tiers. 60 s
  loop, still at 51 s; beats in the crate README. Тишина approved with no notes («Ок, делай
  темы»); Искра, Астрал, Матрица needed no change (sheets
  `output/prototypes/inner-frame/kadry-tishina.jpg`, `kadry-temy.jpg`). Export checked at
  1440×900 and 390×844 in all 4 dark themes: ready, no graphics error.
- 06, 09, 10 need his pictures (briefs in the doc). Next: pages 03–08 on `claude/step-6-scenes`,
  2–3 directions each.

## Step 7 «Динамическая сфера» (branch `claude/step-7-dynamic-0682ec`)
Shipped to `main` 2026-11-01 (Art: «Пушим»): text, hero, page 01 scene, placeholders 02–10.
The finale of stage 1. 10 reading pages, author's text unchanged, emoji dropped
(`src/features/product/stepSevenContent.ts`). Menu groups: Третий уровень [01, 02], Три кольца
одновременно [03–08], Итог [09, 10]. Access via step 6 page 10 (index 9) or settings «ОТКРЫТЬ
СЕДЬМОЙ ШАГ»; bookmark `stepSevenReading`, flag `seventhStepUnlocked`. Screen
`StepSevenScreen.tsx`; the last step for now (no scroll-on).
- One 3D world for the whole step (`graphics/dynamic-rings`, concept A): a figure of light
  points walks a curved planet inside a glass sphere; ring 1 the crown sweeps the sphere, ring 2
  a scanner runs the body, ring 3 the sphere spins. Things get scanned and wires break on the
  glass, one at a time, then more. One chapter per page via Rust `chapter(code)`: 0 hero,
  1 page 01 (first person → over the shoulder → side). Bridge `DynamicRings.web.tsx`; beats in
  the crate's `README.txt`. Art approved Матрица, then all 7 themes («Ок, дальше», «Оставить»).
  Page 01's first-person look turns the head left, then right (about 45°), shipped the same
  day (Art: «Так, пушим»).
- Shipped to `main` 2026-11-07 (Art: «Б и предыдущие работы залей в мэин уже»): page 02
  «Жизнь в сфере» (chapter 2, `dynamic-life`), page 03 «Ночь и фонарь» (chapter 3,
  `dynamic-night`). Both checked in the 4 dark themes and in a production export (ready,
  gpu-error 0). Page 03 lights ring 1 only; ring 2 joins on page 04, ring 3 on page 05.
- In work: page 04 «Второе кольцо», Art chose Б «Не проваливаться» (2026-11-07): something
  arises inside and branches, the crown dims, the person is pulled in; the warm scanner (ring 2,
  like the Step 6 hero's inner warmth) touches it and it folds into one point, the crown
  relights. Chapter 4, Матрица first.
- Next: pages 05–10, each a new chapter of the same world; a stage-finale screen after
  page 10 needs Art's wording first.

## Level «Интенсив»: chat (branch `claude/intensive-chat-9e8099`)
Built 2026-11-07 after Art's «Да, делаем»; shipped to `main` 2026-11-07 (Art: «Пушим»). Everything
below (redesign … sign-out door) shipped to `main` together on 2026-11-08 (Art: «Пушим»), after
Art re-ran `supabase/intensive-schema.sql` on the real server.
- Three places per chat: идущий, его проводник, админ этого проводника; Яна is the main
  admin (also a guide), set only by SQL in `public.main_admins`. One chat per walker; the
  history stays with the walker when the guide changes.
- Supabase free plan (`supabase/intensive-schema.sql`: RLS, checked server functions,
  PGlite tests). Wallet-style account: 12 words → sign-in + identity key, no email;
  6-digit PIN per entry, 5 wrong PINs wipe the device. Authenticator codes required for
  guides/admins/Яна (database-enforced), optional for walkers. Messages are E2EE in the browser.
- Code `src/features/intensive/`, route `src/app/(product)/intensive.tsx`. Shared files:
  `levels.tsx` (opens /intensive), `package.json`/lock, `scripts/web-cache/shell-security.mjs`
  (connect-src adds the server read from config.ts via `scripts/intensive-server.mjs`).
  Daily keep-awake: `.github/workflows/intensive-keepalive.yml`.
- Switch-on: `intensiveServer` in `src/features/intensive/config.ts`. Empty → site keeps the
  «готовится» modal. Dev builds never use it: they use a local Supabase named in `.env.local`
  (`EXPO_PUBLIC_INTENSIVE_URL/KEY`), else the in-memory demo (Яна Орлова, Мира Соколова, Олег Ветров, Алекс Морозов, Ника Зорина…).
- Server set 2026-11-07 (5ddf367): `https://tcbqlkjtofanmdffjqyt.supabase.co`, schema run
  (ping answers), sign-ups on, confirm email off, anon reads refused. No test accounts made
  there by Claude. Next, Art: setup steps 5–7 (GitHub 2FA, Яна's account + SQL main admin,
  end to end, ideally a walker in Russia; check Auth → Multi-Factor → TOTP is on).
- End-to-end test 2026-11-07 on a local Supabase (recipe in `qa.md`): Яна + Мира + Олег on
  three PC origins, Алекс on Art's phone (Chrome over USB). Passed: sign-up, roles, guide/admin
  assignment, TOTP gate, live delivery both ways, ciphertext only in the DB, RLS per role
  (walker, stranger, staff at aal1, removed admin, anon), removed admin cannot send, 5 wrong
  PINs wipe the device, restore by words reopens the history. Fixed since: a guide/admin assigned while the chat was open showed as «бывший участник»
  (ChatView now reloads members), PIN step after restore said «новый аккаунт».
- Redesign 2026-11-07 (4d1074a) after Art: «выглядит как сыроватый
  прототип… телеграмма… бери компоненты из дневника». Shared chrome in `ui/chrome.tsx`
  (diary glass, `fitPanelPath` contours, Hero, ProfileHead, ListGroup/ListItem, ConfirmSheet on
  `BottomSheet`). Telegram-style chat list and chat (grouping, ticks, day rows, «новые
  сообщения», jump-down, retry/remove, drafts), PIN pad on contour keys, entry steps, account
  and people screens rebuilt. Seen ids in localStorage (`chatMemory.ts`), drafts/previews in
  memory only. Checked live in Тишина (3 PC origins + phone): welcome, 12 words, PIN, chats,
  unread mark and divider, chat as guide and walker, failed send, account, team, person card.
  Screenshots in `output/intensive-redesign/`. Other dark themes after Art's OK.
- Blocking + waiting (9deb99f): `profiles.blocked`, RPC `admin_block` (main admin only,
  never a main admin), restrictive RLS `not_blocked` on chats/messages/keys. A blocked account
  sees «ДОСТУП ЗАКРЫТ» with its code on entry; an already open session only gets «Нет доступа»
  on send until it re-enters. Directory carries `waitingSince` (last walker message unanswered).
- Admin page `/admin` (98db1db, reworked in df3c87e) after Art: «отдельную админку для
  Яны… назначать админов и управлять всем». His picks: page on this site, block people, see who
  waits, table + bulk move; no «назначать главных админов»; in-app ЛЮДИ tab stays. Route
  `src/app/(product)/admin.tsx` (no menu link), `IntensiveFlow mode="console"`,
  `ui/AdminConsole.tsx`, `ui/PersonCard.tsx` shared with the ЛЮДИ tab. Entry: fresh unlock = PIN
  + TOTP every time, session only in memory, never reseals the device; no device → 12 words;
  never creates accounts; locks after 5 min hidden; non-main-admins see «ТОЛЬКО ДЛЯ ГЛАВНОГО
  АДМИНА». Rework after Art's «исполнение кривоватое»: wide (2 columns) = fixed workspace, toolbar
  (tabs, search, «ОБНОВЛЕНО hh:mm», 30 s auto refresh), filter chips with counts, master table with
  64 px rows and a state column, side pane 400 (≥ 1200) / 340 with the card or an overview (ЖДУТ
  ОТВЕТА top 5, new walkers without a guide, guide load); checkboxes → bulk bar → move sheet.
  Phone: one column, the card replaces the list. All admin texts use «Вы» (`FormalTone` in
  `ui/parts.tsx`; walker screens keep «ты»). Screenshots `output/admin/1…9-*.png`.
- Chat edits (df3c87e) after Art: voice messages (diary hold gesture, `ui/useChatVoice.ts`,
  audio sealed apart in `message_media`, 3 min max), edit/delete own messages from a long-press
  menu, «ИЗМЕНЕНО» mark, follow-up bubbles without the cut corner on both sides, no member
  avatars over the chat, no «переписка зашифрована» footer. Shared files touched:
  `useObservationRecorder.ts` (optional bit rate), `DiaryRecordButton.tsx` (type export).
  Checked live in Тишина on the local server (PC + phone sizes): admin overview, card, bulk move,
  phone list/card; chat send, edit, delete, voice record/play/delete. Headless Chrome needs
  `--use-fake-device-for-media-stream` for voice tests.
- Admin + names (5f59508) after Art's marked screenshot: no avatars on /admin (table,
  overview, person card; `avatars={false}`, the ЛЮДИ tab and chats keep them), «ОБНОВЛЕНО» left
  of the search, plain square check boxes, panes facing each other keep square corners (list
  `cut="bottomLeft"`, side `cut="topRight"`; phone keeps both cuts), ПОСЛЕДНЕЕ column fits a date.
  Names = first name + surname (Art: «Имя и фамилия»): `NameStep` has two fields; a one-word
  account gets «ДОБАВЬ ФАМИЛИЮ» after TOTP (`session.rename`, existing `profiles_rename` RLS, no
  new SQL). Real accounts with one-word names will see that step once.
- Then (21afc53) after Art: «замочек чтобы закрыть? странное решение», «чекбоксы огромные», search
  icon pressed to the edge, search as wide as the plate below. Header button is now a sign-out
  door `logout` («Выйти из админки»: drops the session, back to the entry); check boxes 14 px;
  `GlassField` right icon at 14 px inset (all Intensive searches); PC search width = side pane.
  Screenshots `output/admin/admin-wide-v4.png`, `admin-phone-v4.png`, `name-surname-step.png`.
- Next, Art: check the live site (/intensive and /admin); the other dark themes after his OK.
  Small idea left: the list preview names a main admin by place
  («ГЛАВНЫЙ АДМИН: …») when she is not a chat role.

## Shipped features (all on main)
- App icon and favicon «Выход» (branch `claude/app-icon-exit`, shipped 2026-11-07, Art: «Да,
  выкладывай»): an exit-sign runner as a solid black pictogram goes into a lit doorway; the
  code rain is all around outside; the back foot still outside gets a light rim. Files
  `assets/branding/exit-door-*` (web: favicon 32, apple-touch 180, manifest 192/512, 1024),
  `assets/icon.png`, `assets/favicon.png` (48), Android adaptive: rain = background layer,
  door + runner = foreground in the safe zone, monochrome = the doorway with the runner cut out.
  16 px drops the rain. Generator lives outside the repo (resvg + MS Gothic glyphs).
- Themes: 4 dark on the site, Матрица default, then Тишина, Искра, Астрал (2026-11-01). The light
  ones (Дюна, Мираж, Рассвет) were taken off on Art's word, kept on `archive/light-themes`
  (5b67880); a saved light choice opens in Матрица. Their palettes and the Rust light branches
  are still in the code, unreachable. Матрица 00FF41 on black; Искра F5DD07 on black.
- Adaptive layout (`productLayout` in `layout.ts`): phone < 600 keeps the 480 column; 600+ uses
  a 720 column; two home columns at width ≥ 900 in landscape. Sheets stay 480. Native is portrait only.
- Performance: engine WASM 55 → 8.8 MB via external assets fetched per scene; service worker
  installs after `watcher-graphics-ready`; lossless WebP.
- Stuck releases self-heal (2026-11-02, `scripts/web-cache/bootstrap.js`): if the site offers
  a newer release that the phone's worker never installs (30 min, 4 checks), the page drops
  the worker and its snapshots and reloads from the network. Only phones that already run this
  bootstrap get it; an older stuck phone needs a one-time site data clear (backup first).
  Note: the old address watcher-observation-qtas5.cold-breezy.chatgpt.site still serves a
  frozen old build; github.io is blocked on Art's work VPN, which keeps the cached snapshot.
- Skeleton loading (`graphics/skeleton`, `src/features/product/skeleton/`) on every screen.
- Soft wheel scroll in the «Плавность» mode (`graphics/soft-scroll`; opt out with
  `data-soft-scroll="off"`). Touch, keys and native stay native.
- Security: CSP and an address guard in the web shell; Pages build job is read-only;
  `/network`, `/sdk`, `/recovery` redirect to `/launch` on web.
- Scrolling crosses step boundaries both ways: back from the start of Steps 2, 3 and 4 into
  the end of the previous step (Step 2's cover fixed 2026-10-31); Step 3 end scrolls into Step 4,
  Step 4 into Step 5, Step 5 into Step 6, Step 6 into Step 7.
- Steps 1–3 read page by page like Step 4, one illustration per page (`EconomyReadingPages`,
  pages in `motion/readingPages.ts`); the scrolling article is gone. The step menu groups
  pages by theme (`stepSections.ts`). Shipped 2026-10-31 (`fix/step-sections`).
- UI fixes (2026-11-07, `fix/ui-seven`): reading screens of Steps 3–7 have no doubled gutter on
  tablet/PC (`ProductScreen` `layout="reading"` pads 0 at every size), so their panel matches
  Steps 1–2; Step 1 page 2 caption larger and before the art; Step 2 pages 1–2 art no wider
  than the plate; crowd task text wraps naturally; «Дополнить ответ» max 340 px.
  Panel edges (2026-11-07, `fix/panel-edges`): the step panel's bottom line sits 1px inside
  (`stepPanelBodyPath`), because Chrome snaps the outline half a device pixel down and clipped it;
  on screens with DPR < 2 `PanelArtwork.web.tsx` draws sub-pixel outlines as 1 device px at the
  hairline's intensity, so diagonals are antialiased, not stairs. Headless Chrome hides both bugs:
  reproduce in a real Chrome window (`--app=` URL, DPR 1.25), not with device emulation.
- Text wrapping (2026-11-07, `fix/text-wrap`): authored texts are typeset at render by
  `typeset()` in `src/features/product/typeset.ts` (reading pages, titles, Step 2 tasks,
  questions, hint, Step 1 intro, cooldown). Mid-sentence `\n` becomes a space; breaks stay
  after `.!?…:;`, before `—`/`«`/numbers, around blank lines and between two lines ≤ 36 chars
  (short couplets). Non-breaking space before « — » and after 1–2-letter words. Write new
  texts with breaks only where a line must stand alone; the content files stay as authored.
- Every step ends with the «#Яна Корнилова» signature (`StepSignature`); step 4 got it on
  2026-10-31 at the end of block 2 page 08.

## Open decisions and ideas (nothing promised)
- Security, Art to decide: optional PIN lock for the diary; Expo SDK 58 upgrade later.
- Never enable GitHub Pages on another `code-of-stalker` repo: same origin means full access
  to diaries. (Hence no prototypes site.)
- Perf idea: a streaming XML parser for the long tracks (roxmltree peaks ~32 MB).
- Known limits: card text inside scenes 05/06 is tiny at phone width; `cargo fmt` issues in
  older code left untouched.

## Environment
- Art's PC «Blade»: `C:\Users\qtas5\Documents\Codex\2026-10-02\new-chat\watcher-matrix-check`
  (has `.local-rust` with cargo and wasm-bindgen 0.2.129 for `build.ps1`).
- GitHub and github.io are blocked on Art's work VPN.
- The repo was renamed from `code-of-stalker/watcher`; the old URL redirects.
- Claude project threads in the cloud also work here on `claude/project-thread-*` branches.
