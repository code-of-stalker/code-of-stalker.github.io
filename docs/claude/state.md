# Project state

Updated 2026-11-13. Step 4 «Механизм обусловленности» «Шкатулка» (`persona-program`, branch `claude/step-4-stage-6`) shipped to `main` 2026-11-13 in all 4 dark themes (Art: «Пушим»): a ray-marched music box, a wooden figurine on the lid, one beat per verb. Step menu fix (branch `claude/step-menu-motion`) shipped to `main` 2026-11-13 as a small fix: scenes keep moving under the open step menu, its bottom edge is back. Step 4 «Персонаж» (`persona-dream`, branch `claude/step-4-stage-6`): the standing rework shipped to `main` 2026-11-13 (Art: «"Персонаж" окей»). The main body and the three others (a bearded man with folded arms, a woman akimbo in a dress, a heavy man with hands behind his back) are baked anew by the Rust example `bake_people` (38b1df4); the first standing try b832827 was rejected (stump arm, one-legged stance, reused drawings). The words МОЖНО/НЕЛЬЗЯ/ХОРОШО/ПЛОХО fit their cells (shipped 2026-11-12). Intensive admin edits (branch `claude/intensive-admin-fixes`, Art's six notes of 2026-11-12) shipped to `main` 2026-11-12 as small fixes. Step 7 page 10 «Дом в разрезе» (`graphics/day-house`, 402.5 s, round 9, branch `claude/step-7-dynamic-0682ec`) shipped to `main` 2026-11-12 in all 4 dark themes (Art: «Пушим»). Telegram-style message edit/delete (branch `claude/message-edit`) shipped to `main` 2026-11-12 (Art: «Пушим»). Step 2 edits (branch `claude/step-2-edits`, 00888c3: each projection/echo a different approved figure, the hero's legs opaque under the beam, a different person in task 1, a new bound life book with a computed page turn) shipped to `main` 2026-11-12 (Art: «запуш правки»). Step 3 edits stage 5 fixes (branch `claude/step-3-edits`) shipped to `main` 2026-11-12 (Art: «Сначала пушим правки»); the Step 3 hero «Камертон» (`graphics/voice-fork`) and screen 6 «Всплытие» (`graphics/voice-surface`), branch `claude/step-3-witness`, approved by Art 2026-11-13 («да там всё ок, меня устраивает») in all 4 dark themes and wired into the app (fb4d18d). Quiet body text everywhere + soft bold (branch `claude/quiet-text`) shipped to `main` 2026-11-11. Diary filters fix (branch `claude/diary-filters-fill`) shipped to `main` 2026-11-11: chosen option filled with the accent, dark text, text/voice filters removed. UI motion leftovers (chat delete, skeleton lists; branch `claude/motion-leftovers`) shipped to `main` 2026-11-11. UI animations set (branch `claude/ui-motion`) shipped to `main` 2026-11-11 (Art: «пушить сразу», without a preview). Icon tap animations «Характер» (branch `claude/icon-motion`) shipped to `main` 2026-11-11 (Art: «Пушим»). Art's fixes of 11.11 (branch `claude/art-fixes-1111-569d08`) shipped to `main` 2026-11-11 (standing rule: small fixes go at once). Step 7 page 09 «Канатоходец на рассвете» (`graphics/rope-dawn`) on branch `claude/step-7-dynamic-0682ec`: the reworked second version (96 s, a beat per phrase) shipped to `main` 2026-11-09 in all 4 dark themes (Art: «Пушим»). Step 7 pages 07 «Автопилот» and 08 «Эхо в переходе» (branch `claude/step-7-dynamic-0682ec`) shipped 2026-11-09 (Art: «Пушим 07 и 08»). Step 7 page 06 «Ночной город» and the Step 7 home card shipped 2026-11-08 (Art: «залей предыдущую страницу»). Step 7 page 05 «Третье кольцо» shipped 2026-11-08. Step 6 page 03 «Тело как форма» shipped 2026-11-08. Step 7 page 04 «Второе кольцо» shipped 2026-11-08. Step 6 page 02 «Каркас» shipped 2026-11-08. Intensive redesign, blocking, the /admin page, voice messages, edit/delete and name + surname shipped 2026-11-08. Intensive daily reports and Rust role marks shipped 2026-11-11. Step 6 page 01 «Внутрь» shipped 2026-11-07. Step 7 pages 02–03 shipped 2026-11-07. Step 6 hero «Внутренняя сфера» (scene + home card) shipped 2026-11-07. App icon and favicon «Выход» shipped 2026-11-07. Intensive chat shipped 2026-11-07. Step 2's last page «Лабиринт», five UI fixes, the panel edge fix and text wrapping shipped 2026-11-07. Stuck-release self-heal shipped 2026-11-02. Light themes removed from the site 2026-11-01. Latest on `main`: Step 7 «Динамическая сфера» (text, hero, page 01
scene), Step 5 pages 04–07 and Step 6 with placeholders, all 2026-11-01. Every Step 4 page
has its own scene (since 2026-10-31).
Art's rule (2026-10-31): small fixes are pushed at once via `/ship-to-main`; big changes such
as animations stay local until he says to ship them. Unsure which it is: ask.
## Step menu (branch `claude/step-menu-motion`, on `main` 2026-11-13)
Art: «открытое окно выбора шага опять останавливает анимации… куда пропала нижняя грань».
Rule now: a step screen's art `active` never includes the menu (`!open`, `!selectorOpen`);
only input waits (`enabled`, canNavigate, canAdvance, ObservationScreen `effectsActive`).
The pinned menu's clip (`TaskStepSelector.web.tsx`, `bleed`) opens 1px past the menu, else
the 1-device-pixel bottom hairline is cut at 125%. Checked 100/125/150%, phone, 4 dark themes.
## Step 3 edits, stage 5 (branch `claude/step-3-edits`, on `main` 2026-11-12)
Done: reading 1 repeated «чёрт» → «КАК ЖЕ ВСЁ ДОСТАЛО.» (`thought_terminal.rs` + svg); father
and trinity light at the jugular notch (`FATHER_NOTCH`, `UNSEAL_NOTCH`); trinity arm gaps filled
by trunk-masked copies (`unseal_pit_defs`, `Look.pit`) so no cut shows as the arms open; girl
on stage: the voice hits the belly (`practice_shadow.rs` `BELLY`); last screen: standing legs
half-turned like the torso, crossfading to profile legs as the walk starts (`heroine_walking`).
Checked in Тишина and Матрица.
## Step 3 reworks (branch `claude/step-3-witness`, not shipped)
Hero «Камертон» (`graphics/voice-fork`, Art: «давай камертон»): her portrait (Art's painted
pick, the only raster; her mouth opens from 3 drawn frames, assets/heroine{,-half,-open}.png
via the dispatcher) over Rust matrix code in six depth layers (near = big blurred bokeh, far =
fine haze). 10 s loop, one note: her voice leaves her lips as a wave, a crest every 0.3 s; the
first two ripple through the whole code (bend, flare, hidden glyphs), the third breaks it from
her lips outwards, near layers first: middle layers crumble into dust, near/far melt; rings
run on through the clear air, then the code is written back from the top (commit 2720c24,
2026-11-13, after Art: «не хватает звуковой волны… глубины слоёв»). The Chladni note pattern
was dropped (Art: «код превращается в паутину»): the rings have no spokes. Prototype
`output/prototypes/voice-fork/index.html`. Detail in its README.txt.
Art approved it in Тишина 2026-11-13 («камертон ок»); Искра, Астрал, Матрица checked by
screenshots and sent to him (`output/for-art/step3/kamerton-*.png`), no change needed.
Screen 6 «Всплытие» (`graphics/voice-surface`, no raster, Art: «насчет 6 экрана там не нужен
растр»): camera on the surface of a dark sea of matrix code; she stands still, eyes open, in a
dark long-sleeved dress; the whole frame starts under water; each time she speaks (lips move)
a ray from her lips raises a knot that opens into БОЛЬ/ВИНА/МЫСЛЬ over the water, and the
water falls a step (brow, face, shoulders, then gone); 44 s loop (dress and flood: 2720c24). Reworked after
Art's notes of 2026-11-12 (water moved by speech, words raised by speech, matrix code). Art's
«не проигрывается» was a ~120 s D3D11 shader compile; fixed (link ~2.4 s, see README and qa.md).
Prototype `output/prototypes/voice-surface/index.html`. Old direction A `voice-witness` was
rejected. Face rebuilt 2026-11-13 (commit e407817) after Art: «лицо у неё конечно кошмар…
разрез глаз странный, подбородок…, скулы, ухо, челюсть, брови»: adult proportions, almond
eyes with lids, narrow brows, hair over the ears, one small chin, wider mouth along the dental
arch, normal nose wings, thicker neck, portrait light from slightly above (detail in README).
Art then liked her except the eyes (lids inside a hole) and asked why she shows through:
fixed in 357d4ca (the horizon glow no longer adds over her; lids swell from a shallow orbit
bowl flush with the face; lit whites). Art: «Ок, делай темы» (2026-11-13): Искра, Астрал,
Матрица read well, no change (`output/for-art/step3/vsurface-{iskra,astral,matrix}.png`).
Wired 2026-11-13 (fb4d18d): bridges `motion/VoiceFork.web.tsx` (hero, `webScene="voice-fork"`
in `StepThreeScreen.tsx`) and `motion/VoiceSurface.web.tsx` (`webScene: 'voice-surface'` on
block `witness` in `stepThreeContent.ts`; Step 3 pages with a scene are 3:2; buffer ≤ 1.5×).
Both renderers link in the background (KHR_parallel_shader_compile, `ready()`); Камертон's
cold freeze 7.2 s → ready ~1.9 s, frames pixel-identical. Checked in the export: phone Тишина,
PC Матрица, ready in 1–5 s, 60 fps, no errors. tsc, lint, web-cache tests pass. Next: on Art's
«пушим» `/ship-to-main` (merge fresh origin/main first). Nothing shipped.
Keep this file short: replace stale lines instead of appending history (`/handoff`).

## Icon motion «Характер» (branch `claude/icon-motion`, on `main` 2026-11-11)
Art asked for Telegram-like icon animations and chose «Характер»: every icon plays its own
short spring scene on tap. Rust: `graphics/product-engine/engine/src/icon_motion.rs` (glyphs,
scenes, on/off states: Fill, Select for radios, Slide for toggles) and `icon_dom.rs` (SVG in a
host div). Bridge `motion/RustIcon.web.tsx` listens to the nearest pressable ancestor;
`autoplay` plays once on mount for glyphs that are not pressable (arrows, entry kinds, lock,
section headings, sparkle); `ground` colors a control's track. Native keeps the still glyph.
Known gaps: the top diary bookmark swaps Pressables, so it changes without motion; the step
selector and recording player were checked only in code, not in the app. The unused diary
illustration has no scene.

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
| 2 / 01 | grounding-character «Персонаж: сон, в который поверил Абсолют» | persona-dream | plates lock into a mosaic shell over the standing person, three different people stand deep in the room, matrix frame, «Я…» tags; people baked in Rust (`bake_people`), on `main` 2026-11-13 |
| 2 / 02 | grounding-program «Механизм обусловленности» | persona-program | live: «Шкатулка» (shipped 2026-11-13, replaced the old dark-room circuit): a music box ray-marched in Rust/WebGL2, a jointed wooden figurine on the lid, the camera goes down into the pinned drum and the comb, one beat per verb |
| 2 / 03 | grounding-belief «Я это действительно знаю?» | persona-belief «Оттиск» | macro of sand under a raking lamp, seals and imprints; no room, no person |
| 2 / 04 | grounding-call «Сила Зова» | call-bell «Колокол» | bell in a stone tower held by threads; threads snap, clapper strikes, sound floods the tower |
| 2 / 05 | grounding-awakening «Пробуждение» | awakening | portrait with a cracking, peeling mask |
| 2 / 06 | grounding-witnessing «Живое Осознавание» | witnessing | witnessing story, own light-theme artwork |
| 2 / 07 | grounding-recognition «Сущностные ощущения» | essence-flame «Пламя» | the candle is a wax figure of a person, flame in its crown; it melts into a plain candle, camera closes on the flame |
| 2 / 08 | grounding-real «Истинное распознавание» | true-sight «Глаз» | macro eye: dreams through the closed lid melt into each other; it opens, the world on the cornea becomes a grid that runs over the face; the lens goes through the pupil to a person of light |

Block 1 pages 04–06 and block 2 pages 01–02 share one look (dark room, seated person in
profile, card bottom-right, focus pulls). Do not make a sixth one like them.
«Шкатулка» (2026-11-13): `graphics/persona-program` rewritten (one ray-marched `scene.frag`,
`finish.frag`, text pass; the old dark-room figure, geometry and shaders deleted). 70 s loop.
Beats: видеть = the lamp switches on (25 s); рассматривать = close on the brass pins (34 s);
ощущать = the comb trembles (40 s); наблюдать = wide slow orbit (45 s); осознавать = the pins
read НАДО (50 s) / НЕЛЬЗЯ (54 s); различать = the drum stops, the figurine freezes (60 s).
Prototype `output/prototypes/persona-program/index.html` (theme chips), stills `keyframes.png`
(Тишина) and `themes.png` (4 themes x 6 beats) beside it. Art approved Тишина 2026-11-13
(«Ок, дальше темы»); the other 3 themes needed no code change (shared palette). In Искра and
Матрица the 34 s pin close-up is a large bright accent field: change it only if Art asks.
Shipped to `main` 2026-11-13 in all 4 dark themes (Art: «Пушим»).
Shader lessons are in the crate README.

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
- Page 03 «Тело как форма» (inner-body-form), shipped to `main` 2026-11-08 (Art: «Пушим»),
  direction В «Наполнение»: crate `graphics/inner-vessel`, bridge `InnerVessel.web.tsx`,
  `webScene: 'inner-vessel'`. One ray-marched pass, no textures: a glass man sits upright on a
  chair; thought sparks in the head sink to the soles on «Ощути его», warm light fills him feet →
  crown word by word, breathes, grows heavy, runs down the chair legs, roots into the floor on
  «заземление» (3/4 view from above); then it drains into the head and cools. 50 s loop, still
  at 38 s; beats in the crate README. Тишина approved with no notes («Ок, делай темы»); Искра,
  Астрал, Матрица needed no change (sheets `output/prototypes/inner-vessel/kadry.jpg`,
  `temy.jpg`). Export checked at 1440×900 (all 4 dark themes) and 390×844: ready, no graphics
  error. Known: on «дыхание» (≈14–18 s) the camera is closer and the feet leave the frame.
- 06, 09, 10 need his pictures (briefs in the doc). Next: pages 04–08 on `claude/step-6-scenes`,
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
- Shipped to `main` 2026-11-08 (Art: «Пушим»): page 04 «Второе кольцо» (chapter 4,
  `dynamic-inner`), direction Б «Не проваливаться». The figure walks on (96 steady steps);
  five warm events flare and branch (thought at the head, emotion in the chest, a spark in the
  belly, impulse at the right fingertips, sensation at the left knee), each drags the body its
  way (`INNER_PULL`, `inner_way`), the crown dims and the world darkens; the thought lifts him
  0.2 m and melts him from the feet up while he keeps walking. The warm scanner reaches each,
  it folds into a warm bead, the crown relights; five beads fade by the loop's end. Warm light
  rides in the frame's alpha (`warm.frag` after the recolor), pages 00–03 pixel-identical.
  Checked in the 4 dark themes (sheet `output/prototypes/step-seven/kadry-04-temy.jpg`) and in
  a production export. Ring 3 joins on page 05.
- Shipped to `main` 2026-11-08 (Art: «Пушим»): page 05 «Третье кольцо — ДЕЙСТВИЕ» (chapter 5,
  `dynamic-action`), direction А «Темп дня». One day in a row (sit, rise, walk, drink, speak aloud, a
  phone call, carry a box, stop and breathe, walk on with lit support, sit). Ring 3 joins at
  the start and spins with the body's tempo, fastest with the box, slowing to the breath;
  rings 1 and 2 stay steady. Held things (cup, phone, box) build in the hand (line kind 16).
  On the call his own voice returns from the glass, the caller's comes from far. Art approved
  Матрица 2026-11-08 («Ок, другие темы»); Тишина, Искра, Астрал checked (sheet
  `output/shots/page05-themes.jpg`) and in a production export (ready, gpu-error 0).
- Pages 06–10 get a NEW scene (Art is tired of the sphere world). Art chose direction А
  «Ночной город» 2026-11-08: new crate `graphics/night-city`. A walker on a wet night street in the rain: lamps, shops with lit rooms behind the
  glass, signs, puddles, steam, car light trails, towers; camera in levels (his eyes → over
  the shoulder → beside the face → low → crane). Cold light goes through the theme recolor,
  warm light (sodium lamps, warm shops, tail lights) is added after it in `Look.warm`.
  Page 06 «Фазы шага» (chapter Fact, 64 s loop) is built; beats in the crate's `README.txt`.
- 2026-11-08 Art: «сцена не запустилась». Cause: the one world shader took Chrome on Windows
  (ANGLE/D3D11) ~3 min to compile and Chrome dropped it. Fixed in `28ef595`: the world is
  drawn in parts (hits pass + 4 light passes, linked in parallel), ready in ~10 s with
  «Загружаю сцену…» meanwhile; frames identical to before. Details in the crate's README.
  Any new scene: keep each shader small, D3D11 compile time grows faster than its size.
- 2026-11-08 Art's notes on the first showing, all done on the branch (round 2): a raincoat
  instead of the flap, cars with bodies, two passers-by (umbrella, phone), the sphere with its
  three rings back but barely visible, code rain on the walls, and inside the sphere things
  (pole, passer, pavement) show their code; he does not. Details in the crate's README.
- 2026-11-08 Art approved round 2 in Матрица («Супер! её же поставь на главную страницу если
  открыт 7 шаг»). Тишина, Искра, Астрал checked, no color change (sheet
  `output/prototypes/night-city/temy.jpg`). Wired on the branch: bridge `NightCity.web.tsx`
  (waits for `ready()` before the first frame, card mode like `InnerHero`), `WebScene`
  `night-fact` on page 06, and the home card «Архитектура наблюдения» plays it when step ≥ 7.
  Production export checked at 1440 and 390 wide: page 06 and the home card ready, 60 fps,
  gpu-error 0, no console errors (sheet `glavnaya.jpg`). Shipped to `main` 2026-11-08 (Art: «так
  же залей предыдщую страницу уже»), export rechecked before the merge.
- Page 07 «Главная проверка»: Art chose А «Автопилот на перекрёстке» 2026-11-08. Built as
  `Chapter::Check` (code 1). Round 2 after Art's note (a near miss, time rewinds, the right run),
  commit 1ed60ce: the tape plays twice, 126.9 s loop, still 71 s; beats in the crate README.
  Wrong take 0–26.6: phone, ring 1 then ring 2 go out, he steps off on red, a side-street car stops
  a hand from him. The tape freezes 0.8 s and rewinds to 1 s (tape shaders in `common.glsl`).
  Right take: phone out with rings 1–2 lit, away before the kerb, стопы → опора → дыхание →
  расхлопнутость → пространство, the car passes and turns, green, he walks. Second showing in
  Матрица sent 2026-11-08 (`output/prototypes/night-city/page07.jpg`, prototype chip «страница 07»
  or `?page=1`). Art approved it 2026-11-08 («супер продолжаем», relayed by the parent session).
  Тишина, Искра, Астрал checked, no color change (sheet `output/prototypes/night-city/page07-temy.jpg`).
  Wired on the branch (9fb606b): `WebScene` `night-check` → chapter 1 on `dynamic-check`.
  Production export checked at 1440 and 390 wide: ready, 60 fps, gpu-error 0, no console errors.
  Shipped to `main` 2026-11-09 together with page 08 (Art: «Пушим 07 и 08»).
- Page 08 «Используй свой голос (как настройку трех колец)»: Art chose А «Эхо в переходе»
  2026-11-09 (over Б «Неон отвечает» and В «Крыша»). Built as `Chapter::Voice` (code 2, 104 s
  loop, still 33 s), commit cdb33a4: down into a tiled underpass under the cross street, each
  phrase runs along the tiles as a shell and comes back as an echo (sphere, ring 1, ring 2,
  ring 3), up the far stairs with a hand on the rail, three echoes in one chord, «Я Есть» out
  into the rain under the crane; each phrase leaves a line of code in the tiles. Beats in the
  crate README. Pages 06–07 render as before (frames compared with the previous build).
  Wired on the branch: `WebScene` `night-voice` → chapter 2 on `dynamic-voice`. First showing
  in Матрица sent 2026-11-09 (`output/prototypes/night-city/page08.jpg`, prototype chip
  «страница 08» or `?page=2`). Art approved Матрица 2026-11-09 («Ок, другие темы»); Тишина,
  Искра, Астрал checked, no color change needed (sheet `output/prototypes/night-city/page08-temy.jpg`
  sent). Production export checked: Step 7 page 08/10 mounts `rust-night-city`, ready, 60 fps,
  gpu-error 0, no console errors at 1440 and 390 (the step picker also lists Step 5's page of
  the same name; pick the Step 7 entry). Shipped to `main` 2026-11-09 together with page 07
  (Art: «Пушим 07 и 08»), export rechecked before the merge.
- Page 09 «Итог третьего уровня» (dynamic-summary): Art wanted a NEW scene, not the rainy
  night city («там с дождем надоела»), and chose А «Канатоходец на рассвете» (2026-11-09)
  over Б «Заводной механизм» and В «Светящееся море». New crate `graphics/rope-dawn` (own
  ray-marched world: towers, rope, pole, walker, fog sea, waking city, dawn sky), bridge
  `RopeDawn.web.tsx`, `webScene: 'rope-dawn'`, dispatched in `Art.web.tsx` AND
  `StepFiveScene.web.tsx` (Step 5–7 pages render through the latter; without it the page
  shows its placeholder). First showing (72 s) got «скудненько… разбивки не очевидно
  показывают текст… это финал»; reworked into a second version (commit b6fe1ac): a city of
  glass and stone towers, fog with puffs and holes onto the living streets, cirrus, god rays,
  birds; 96 s loop that starts and ends inside the cloud, still 51.2 s; one beat per phrase
  (rings 1/2/3 each alone, then a chord; the world stops; a double rises and returns; the sun
  rises in him; the city opens below; his giant shadow with a glory panics, lags and crumbles
  into code). Beats in the crate README. Second showing in Матрица sent 2026-11-09 (sheet
  `output/prototypes/rope-dawn/kadry-v2.jpg`, prototype `output/prototypes/rope-dawn/index.html`);
  Art approved it 2026-11-09 («Ок, другие темы»). Тишина, Искра, Астрал rendered and sent
  (`output/prototypes/rope-dawn/kadry-tishina.jpg`, `kadry-iskra.jpg`, `kadry-astral.jpg`);
  each theme's own warm sun (`look()` in lib.rs) reads well, nothing retuned. Export checked
  in all 4 dark themes: page 09 mounts `rust-rope-dawn`, ready, 60 fps, gpu-error 0, no
  console errors, at 1440 (608 px, the plate width) and 390 (310 px). Shipped to `main`
  2026-11-09 (Art: «Пушим»).
- Page 10 «В быту» (dynamic-everyday), crate `graphics/day-house` «Дом в разрезе»: Art chose А
  («делай А… полноценный сюжет… на каждый образ и действие сцену… до 3х минут… филигранно»).
  A cutaway five-storey house on a lacquer table; one man's day, a scene per phrase. Wired
  (`DayHouse.web.tsx`, `webScene: 'day-house'`). Round 2 (219 s) was rejected 2026-11-11
  (kitchen start, rings not a sphere, tram, bread carry, child, quick laptop scene, roof
  treadmill, unclear finale; see art-feedback.md). Round 3, loop 271.9 s: rings ported from
  page 06 (sphere, second ring scans his body, first rides the sphere, third a meridian); she
  starts at the stove and pours; tram with straps leaves right and returns from the left;
  first-person shots in the tram, the shop and at the desk (typed page on the screen); bread at
  his side; a proper child; an evening street jog; finale: the rings sync and strike a chord,
  the line of his day lights its places, the sphere grows into a globe over the house and
  meets its reflection, dawn. Round 3 notes (2026-11-11, see art-feedback.md) led to round 4,
  loop 305.4 s (commit 3ca0c5b): rings steady up close, the mug to his mouth, a smooth ease
  out of the tram POV, no walk into the sign, the phone by his hand, no see-through laptop, no
  camera jerk on stops (`steady()` ignores cuts); the jog became a bicycle ride (the bike
  leans on the lamp's post all day; out right, back in from the left, leaned on the same
  post); finale 58 s (house sleeps window by window, the rings return one by one, chord,
  the line of his day with a glowing echo of him at each place, globe, dawn). Beats in the
  crate README. build.ps1 (31 tests), tsc, lint, export:web, app at 1440/390 clean. Shown in
  Матрица (`output/prototypes/day-house/index.html`, storyboard
  `output/prototypes/day-house/storyboard-round4.jpg`). Round 4 notes and extra notes
  (2026-11-12, see art-feedback.md) led to round 5, loop 402.5 s: he steps clear of the
  kitchen table; the shop's POV cuts ease in and out, the coin falls slower; while the tram
  has him away the day runs fast (sun past noon, shadows sweep, clouds, rooms' lights: a
  couple of hours), the same for the evening ride (BIKE_AWAY); the camera holds him, not
  the sphere, on the stair; three spoken-and-heard moments: at the wall by the door after the
  tram (phone held before him, then at his ear, circles of the voice), at the desk after he
  shuts the laptop (a moving lid), at the wall again after the ride; finale 82 s: the
  lacquer turns to water, a drop of light falls from the globe's crown and meets its
  reflection (the rings strike, the axis lights, a ring runs over the water), the camera goes
  under (mirrored world below, the world above through the surface, shafts, motes) and rises
  at dawn as the house comes back (commit 63bff82). Round 5 notes (2026-11-12, see
  art-feedback.md) led to round 6, same loop: Матрица code in the world (columns on the
  painted town, rain on the plinth's front, code inside his sphere, the house dissolves to
  code from the top and everything inside goes with it); the sphere centred on his pelvis;
  presence: the sphere shrinks and fades through the day and widens, with the rings bright,
  when he speaks and listens; a street clock left of the house, the lapses are one smooth
  pass of a couple of hours (no racing sun, no flicker); the phone sits in his palm; the bike
  return is one dolly, no cut; no meridian or inner dome in the finale globe (commit
  57f1439). Round 6 notes led to round 7, same loop: the phone at his ear sits beside the
  cheek (cast.rs in_palm keeps clear of the head); he lays the coin on the counter and it
  glints (tone 0.9 brass emits), the keeper takes it from there; no basket on the bike; the
  day's line and its lit places go out as the melt starts; the house is rebuilt bottom up
  under water, whole before the camera surfaces (commit d1d1bbc). Round 7 notes led to
  round 8, same loop: at the ear the phone lies on his cheek and the palm on its back,
  fingers up (cast.rs at_cheek, point_hand); presence is stronger (the sphere sinks to 0.6
  and nearly fades through the day, widens to 1.15 and its shell and inner code flare while
  he speaks, story.rs voice() into MELT.w); under water the camera sinks without closing in
  and pulling back, the water clears toward dawn, the camera makes one full roll round its
  axis (TURN) and surfaces level (commit fcf2dd4). Round 8 note led to round 9, same loop:
  no surfacing; under water the house hangs upside down, the camera sinks to its middle and
  turns over half a turn (TURN, DAWN−7..DAWN−1), the world under the water stands up and is
  the loop's first frame, the murk lifts by LOOP−1 (story.rs `turned_over`: under the water
  the eye is handed over turned about x = 0, y = TABLE; moon, meridian and beads mirrored
  there so the dive is continuous; the clouds come round to the start; commit 95c61c8).
  Shown in Матрица (storyboard `output/prototypes/day-house/storyboard-round9.jpg`); Art:
  «Пушим». Key frames checked in Тишина, Искра and Астрал; shipped to `main` 2026-11-12.
- Next: a stage-finale screen after page 10 needs Art's wording first.

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
  audio sealed apart in `message_media`, 5 min max), edit/delete own messages from a long-press
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
- Art checked the live site 2026-11-08 as main admin (his own account, SQL main admin, a test
  walker on his phone): «вроде всё работает». Then (159dd96, shipped 2026-11-08 as a small fix):
  bubbles of one run cut only the outer corners (`BubbleSpot` alone/head/middle/tail in
  `ui/chrome.tsx`). Voice cap raised to 5 min on Art's word (shipped 2026-11-08): one sealed row
  (`message_media.body` ≤ 1.5 M chars ≈ 1.1 MB, 5 min ≈ 0.9 MB at 24 kbit/s); longer needs a schema change.
- Chat top (Art 2026-11-11, shipped 2026-11-11 as a small fix): no line and no solid fill under the
  header; the feed melts over 24 px under it once scrolled (diary's mask, `--chat-fade-top` in `ChatView.tsx`).
- Admin edits, shipped to `main` 2026-11-12 (Art's notes via the main session): a Rust surface that
  cannot start stays empty, never shows its label (`ArtUnavailable`, native `Unavailable`; his phone
  showed «Стеклянная поверхность» on the PIN screen); button «ВОЙТИ В ДРУГОЙ АККАУНТ» under «Забыли PIN?»
  on both PIN screens (restore step `fromPin`): on /admin it signs in for this page only, the device and its
  PIN untouched; in the app a confirm first says the device keeps one account, so the current one comes
  back only by its 12 words once the new one sets a PIN (several accounts per device was not simple: one
  sealed vault, one server device id and PIN verifier); search over the list, filters under it; chosen filter chips filled like
  the Diary (`DiaryChoiceFace` exported from `DiaryFilters.tsx`); ИДУЩИЕ / КОМАНДА are text tabs (Rust sliding
  underline, muted rest, one thin baseline under the row, in the app's `Tabs` too; no filled tabs); the app's «Люди»
  has no second tab row: ЖДУТ / ИДУЩИЕ / КОМАНДА are the admin's filter chips (`Chip`, now in `parts.tsx`) under the search; person card on glass
  cards (`ListGroup card`: `DiaryGlass` + `PanelBorder`, no inner top/bottom padding; the PC table and panes are
  `DiaryGlass contour=` under the outline, nothing see-through), «Закрыть доступ» one card without a caption; a picked row's tint runs frame
  to frame; row sentences are `ListItem hint` (Tektur, sentence case, muted), data lines stay `detail` capitals;
  «ПРАВА» has one hairline between its two switches (`ListGroup divided`) and no role descriptions; roles as in the chat everywhere (`useRoleInks`, `RoleTag`, `ListItem badge` in `chrome.tsx`;
  `rolesOf`, `RoleTags` in `PersonCard.tsx`); on the phone the filter row runs to the screen edges
  (negative gutter margin, first chip on the page line; the Diary filters wrap, no change there); the app's
  «Люди» tab shows roles as `RoleTags` too, not text; Settings › Микрофон no longer logs «Unexpected text node». Checked in the local demo, 4 themes, 1280 and 390.
  The in-app ЛЮДИ tab (`AdminPanel.tsx`) still lists roles as text.
- Daily reports + role marks, shipped to `main` 2026-11-11 (Art: «Ок, пушим»). Daily reports in
  Intensive «как в дневнике», into the chat with the guide (Art: «В чат с проводником»): the report mark sealed inside the message
  (no server change), report mode for text and voice, report cards, reports-only view (header
  icon), the diary's guide sheet shared as `DiaryReportGuide` (the diary uses it too), and the
  walker's plate above the chat (shared `DiaryReportPrompt`): folds by the diary's drag (up folds,
  down unfolds), kept per device (`intensive.reportFolded.v1` in `chatMemory.ts`), leaves after
  today's report. Role marks: faint role tint on bubbles (`ROLE_TINTS`/`ROLE_WASH` in
  `ui/chrome.tsx`, all 4 dark themes, same hues by role: guide gold, admin blue, main violet,
  walker = accent; 3c5e25d also fixed a shared gradient id that gave every role bubble the
  first role's fill) and a live 16 px sign right of the role word. Rounds 1–2 rejected (see
  art-feedback). Round 3 = Art's subjects (prototype `output/prototypes/role-marks/index.html`):
  walker footprints, guide flame, admin eye, main admin wrench. Art: «Знаки 16 делай в раст» →
  built in Rust (110448f): crate `graphics/role-marks` (beats and build in its `README.txt`),
  bridge `ui/RoleMark.web.tsx`, native still `ui/RoleMark.tsx` + generated
  `ui/roleMarks.generated.ts`; replaced the static `roleGlyph`. Checked in the demo (Тишина, PC
  and 390 px phone, reduced motion). A person has one role per chat (`private.chat_role`:
  walker > guide > admin > main), so Яна leading a walker is ПРОВОДНИК (flame) in that chat.
  Art OK'd the marks in Тишина («Ок, другие темы») and the 4-theme tints (`output/role-themes.png`).
- Next: nothing waits on this branch. Walker screens keep naming Яна («Яна назначит…»)
  even while Art is the main admin (Art 2026-11-08: «Оставь Яну»). Small idea left: the list preview names a main admin by place
  («ГЛАВНЫЙ АДМИН: …») when she is not a chat role.

## Shipped features (all on main)
- Message edit/delete «как в телеграмме» (2026-11-12, branch `claude/message-edit`): one shared
  piece in `src/features/product/messages/` (`MessageMenu` with a Rust-driven appear and a soft
  dim that leaves the message bright via a clip-path hole, `EditBar`, `useMenuAnchor`:
  long-press, right-click, a11y action) used by the Intensive chat (replaced its BottomSheet
  menu) and the Diary (text entries: `editDiaryText`, `DiaryText.editedAt`, «ИЗМ.» before the
  time; delete for all entries through the old confirm and `Leave`). AI/others' messages copy
  only; voice has no «Изменить». Checked in the Diary in Тишина (menu, edit, mark, delete); the
  chat only by typecheck (the demo login asks a TOTP code). Other dark themes not looked at.
- UI motion set (2026-11-11, Art: «приятные анимации переключения табов, экранов, прогрузки…»):
  one style, 150–300 ms on `uiCurve` (`motion/uiMotion.ts`), Rust-driven via `RustMotion`
  (`ui_motion.rs`, `voice_wave.rs`, `element_motion` breathe). Screens fade and rise on focus
  (`ScreenTransition`); tab content `Appear`s and the tab underline slides (`SlideMark`); loading
  text breathes (`Breathe`, `Loading`); the diary report plate folds with `AutoHeight`; a deleted
  diary card collapses (`Leave`); voice playback glides the played wash and lifts bars near the
  playhead (`VoiceWaveBars`); the chosen diary filter fades in its accent fill. Reduced motion
  (system or app) snaps. RN shorthands go through `motion/webStyle.ts` on these DOM wrappers.
  Leftovers (branch `claude/motion-leftovers`, on `main` 2026-11-11): a deleted Intensive chat
  message leaves through `Leave` (data removed after the motion, comes back on error); Intensive
  chat list and admin people lists show a breathing `Skeleton` (`intensive/ui/parts.tsx`).
  `Leave.web` pins the real DOM height (onLayout gave 0, so the gap snapped shut).
- Soft emphasis (Art 11.11 chose variants A + C, shipped 2026-11-11): bold body text was harsh.
  Emphasis keeps Disket Mono Bold but at 90% of the text colour with 0.06em tracking; on a page
  or task text with an emphasis, the plain copy beside it is at 74% (`softBold`, `quietText`,
  `fade` in `theme.ts`; Art set 74/90). Site-wide: task explanations, reading pages (bold
  paragraphs, spoken, statement, emphasis, conclusion), Step 1 conclusion, Step 2 emphasis, diary
  labels. Quiet body text everywhere (branch `claude/quiet-text`, shipped 2026-11-11; Art: «обычный
  текст нужно везде сделать таким же приглушенным»): `ProductText` body in the plain text ink is
  74% on every screen and its bold runs are soft (90%, tracked), the diary's own bold included
  (editor `strong` colour). Titles, labels, buttons, accent and other inks stay as set; tappable
  body-variant labels (diary date/sort/filters, step menu, task question, glyph buttons) pass
  `color={colors.text}` to stay full. Not changed: the insight decoder (`.mx-decoder`, an animated
  effect) and the Matrix diagnostics pages (network, recovery, sdk).
- Levels screen «ВЫ ЗДЕСЬ» (2026-11-11): a small accent diamond and caption in the current level's
  header. Current = ИНТЕНСИВ if this device joined the Intensive (`hasDevice`) or progress chose it,
  else БАЗОВЫЙ once a level was started; nothing before any level is chosen.
- Art's fixes of 11.11 (`claude/art-fixes-1111-569d08`, shipped 2026-11-11): the diary's
  daily report plate folds by a drag up and unfolds by a drag down on its thin strip (Art: an
  arrow beside the plus is clumsy), tap still opens the report; the state is remembered
  (`settings.diaryReportCollapsed`; gesture rule `diary/report-fold-gesture.ts`; shared component
  `src/features/product/diary/DiaryReportPrompt.tsx`, meant for reuse by the Intensive diary);
  in recorded tasks the scroll cue sits centered at the very bottom under the step selector,
  never beside it (Art: «он не должен быть сбоку»), hidden while the selector is open; no
  marquee in tasks; levels: 2 plates, «Водительство» is now «ИНТЕНСИВ» (keeps the `guidance`
  id and art) and opens `/intensive`, the old Intensive plate is gone; both plates start open
  when they fit the screen height (Art), otherwise only the chosen one; Step 1 imprints have no
  arrow marks (`stepOneInserts.ts`, reading assets regenerated, engine rebuilt); Step 5 «хотя
  бы 3 — 5 минут»; Step 6 titles without numbers, no comma on page 9.
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
