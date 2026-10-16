import type { LiquidGlassSettings } from './settings'
import { serializeLiquidGlassPreset } from './settings'
import { dispersionSpreadGLSL, spectralSampleGLSL } from './spectralDispersion'
import { glassLensGLSL, glassRefractionGLSL } from './glassRefraction'

const liquidGlassRepositoryUrl = 'https://github.com/i4w7w4a/Liquid_Prnc_Glass'
const liquidGlassProjectSiteUrl = 'https://liquid-prince.online/'

function getFadeModeLabel(fieldFadeMode: number) {
  return fieldFadeMode === 1 ? 'source dissolve' : 'optical mask'
}

function getShapeLabel(shapeType: number) {
  const labels = [
    'rounded rectangle',
    'circle',
    'ellipse',
    'diamond',
    'triangle',
    'hexagon',
    'soft blob',
    'wave capsule',
    'chipped frame',
    'petal lens',
    'torn oval',
    'sharp square',
    '45-degree cut corners',
  ]

  return labels[shapeType] ?? 'rounded rectangle'
}

function getFlowModeLabel(flowMode: number) {
  const labels = [
    'none',
    'left',
    'right',
    'up',
    'down',
    'clockwise',
    'counterclockwise',
    'from center',
    'to center',
    'organic curl',
    'shear',
    'standing wave',
  ]

  return labels[flowMode] ?? 'none'
}

export function generateLiquidGlassIntegrationBrief(settings: LiquidGlassSettings) {
  const presetJson = serializeLiquidGlassPreset(settings)
  const fadeModeLabel = getFadeModeLabel(settings.fieldFadeMode)
  const shapeLabel = getShapeLabel(settings.shapeType)
  const flowModeLabel = getFlowModeLabel(settings.flowMode)

  return `# Prince Laboratory integration brief

Нужно перенести на сайт эффект Liquid_Prnc_Glass и применить его к объекту, на котором нужен оптический слой.

Источник лаборатории и скачивание:
${liquidGlassRepositoryUrl}

Публичный сайт проекта:
${liquidGlassProjectSiteUrl}

Важно:
- оптическое преломление и размытие фона рассчитываются в WebGL;
- эффект должен быть WebGL/GLSL pass поверх исходного объекта;
- применяемый объект может быть изображением, canvas, DOM/WebGL source или другим rendered source;
- visual result должен совпасть с лабораторным preset ниже.
- локальная версия расширена: перенеси текущие GLSL, BackgroundBlurPass, GlassMotion, scanReveal, materialSettings, glassStyleSettings, spectralDispersion и glassHitTest вместе с компонентом.

Glass controls reference:
https://help.figma.com/hc/en-us/articles/360041488473-Apply-effects-to-layers
https://developers.figma.com/docs/plugins/api/Effect/
Это наша WebGL-реализация описанных параметров Glass, а не исходный рендерер Figma. Совпадение чисел не гарантирует одинаковую картинку.

Preset:

\`\`\`json
${presetJson}
\`\`\`

Current fade mode:
${settings.fieldFadeMode} - ${fadeModeLabel}

Active glass model:
${settings.figmaGlassEnabled ? 'Glass / Figma controls' : 'Original signed IOR and center field'}

Glass controls (active only when figmaGlassEnabled = true):
Light angle ${settings.rimAngle} degrees; Light intensity ${settings.rimStrength}; Refraction ${settings.figmaRefraction}; Depth ${settings.figmaDepth} logical px; Dispersion ${settings.figmaDispersion}; Frost ${settings.backgroundBlur} logical px; Splay ${settings.figmaSplay}

Panel fill:
color ${settings.fillColor} (sRGB HEX); opacity ${settings.fillOpacity}; 0 = transparent, 1 = solid; composited over optics, below text and illustrations

Highlight color:
${settings.highlightColor} (sRGB HEX); shared by directional edge light, original refraction highlights and Glass model reflections; independent of fill, scan and pixel-pulse color

Core optics:
ior ${settings.ior}; edgeThickness ${settings.edgeThickness}; cornerRadius ${settings.cornerRadius}; dispersion ${settings.dispersion}; edgeDarkening ${settings.edgeDarkening}; highlightStrength ${settings.highlightStrength}; pixelRatio ${settings.pixelRatio}

Backdrop blur:
backgroundBlur ${settings.backgroundBlur} px; independent of center field; sharp panel silhouette

Clear bevel:
${settings.facetEnabled ? 'enabled' : 'disabled'}; width ${settings.facetWidth} px; refraction ${settings.facetStrength}

Corner cuts:
top-left ${settings.cutTopLeft} / ${settings.cutSizeTopLeft}; top-right ${settings.cutTopRight} / ${settings.cutSizeTopRight}; bottom-right ${settings.cutBottomRight} / ${settings.cutSizeBottomRight}; bottom-left ${settings.cutBottomLeft} / ${settings.cutSizeBottomLeft}; sizes are fractions of the shorter panel side

Touch response:
${settings.touchEnabled ? 'enabled' : 'disabled'}; strength ${settings.touchStrength} (0–6); radius ${settings.touchRadius} (0.08–2, fraction of shorter panel side); lag ${settings.touchLag} s (0.08–2)

Directional edge light:
${settings.rimEnabled ? 'enabled' : 'disabled'}; strength ${settings.rimStrength}; width ${settings.rimWidth} px; angle ${settings.rimAngle} degrees

Scan reveal:
${settings.scanEnabled ? 'enabled' : 'disabled'}; duration ${settings.scanDuration} s; direction ${settings.scanDirection} (0 down, 1 up, 2 right, 3 left); softness ${settings.scanSoftness}; line strength ${settings.scanStrength}

Touch pixel light:
${settings.pulseRevealEnabled ? 'enabled' : 'disabled'}; color ${settings.pulseColor} (sRGB HEX, independent of highlightColor); opacity ${settings.pulseOpacity} (UI transparency ${Math.round((1 - settings.pulseOpacity) * 100)}%); duration ${settings.pulseDuration} s; cell size ${settings.pulseCellSize} logical px; softness ${settings.pulseSoftness}; light strength ${settings.pulseStrength}

Center field:
${settings.fieldEnabled ? 'enabled' : 'disabled'}; start ${settings.fieldStart}; softness ${settings.fieldSoftness}; fade mode ${settings.fieldFadeMode} - ${fadeModeLabel}; curve ${settings.fieldCurve}; strength ${settings.fieldStrength}

Shape geometry:
${settings.shapeType} - ${shapeLabel}; shapeWarp ${settings.shapeWarp}

Flow field:
${settings.flowEnabled ? 'enabled' : 'disabled'}; mode ${settings.flowMode} - ${flowModeLabel}; speed ${settings.flowSpeed}; strength ${settings.flowStrength}; scale ${settings.flowScale}; turbulence ${settings.flowTurbulence}; boundary damping ${settings.flowBoundaryDamping}; layer mix ${settings.flowLayerMix}

Effect regions:
top ${settings.regionTop}; right ${settings.regionRight}; bottom ${settings.regionBottom}; left ${settings.regionLeft}; width ${settings.regionWidth}; softness ${settings.regionSoftness}

Color correction:
exposure ${settings.exposure}; brightness ${settings.brightness}; contrast ${settings.contrast}; saturation ${settings.saturation}; temperature ${settings.temperature}; tint ${settings.tint}; gamma ${settings.gamma}

Core contract:
- figmaGlassEnabled выбирает две независимые модели: false использует signed IOR / center field, true использует Refraction / Depth / Dispersion. Переключение сохраняет параметры обеих моделей;
- в исходной модели center field преломление нарастает от центра к краям; размытие фона применяется независимо ко всей выбранной области стекла;
- жесткая линия старта недопустима;
- только в исходной модели IOR signed: 0 отключает основное преломление и преломление фаски, плюс и минус меняют направление; размытие и локальное касание независимы;
- в модели Glass плавный профиль линзы из glassRefraction.ts определяет преломление фона по всей плашке. Depth меняет длину пути луча, Refraction — силу деформации. getOpticalTravel мягко ограничивает смещение относительно размера плашки; обновляй uOpticalTravel при изменениях параметров, размеров и glassPanel. Внешний SDF задаёт только силуэт, фаску и узкую подсветку, без диагональных граней в середине. facetWidth сохраняет прозрачную фаску, facetStrength не используется;
- в модели Glass rimAngle и rimStrength задают Light angle и Light intensity независимо от старого rimEnabled; Splay расширяет угловое распределение света. IOR, center field, старые dispersion и highlightStrength в этой модели не используются;
- обе модели используют семь перекрывающихся спектральных выборок из spectralDispersion; веса каждого цветового канала в сумме равны 1, поэтому однотонный фон не получает дополнительный цвет. Расхождение учитывает изгиб луча и радиус размытия, ограничено 48 логическими пикселями. При нулевом преломлении цветовое расщепление отсутствует;
- backgroundBlur задает радиус Gaussian blur в логических пикселях (поддержка ядра 3 sigma); blur работает и при fieldEnabled = false;
- BackgroundBlurPass размывает исходник двумя проходами в линейном цветовом пространстве до преломления; итоговая маска плашки и блики не размываются;
- sampleGlassSource(uv, blurAmount) плавно смешивает резкий исходник у фаски с размытой серединой; снаружи плашки всегда остается чистый исходник;
- ширина фаски измеряется по расстоянию до реального внешнего SDF, в логических пикселях; учитывай pixelRatio;
- касание деформирует выборку локально, плавно следует за пальцем и затухает после отпускания; не меняй сам внешний контур;
- GlassMotion обновляется в цикле отрисовки; pointer up/cancel, потеря захвата и фокуса освобождают касание;
- направленная жёлтая кромка следует внешней нормали и реагирует на перемещение, курсор и scroll; свет ограничен маской стекла;
- scan запускается один раз при открытии, revealKey позволяет повторить его. Один progress из GlassMotion управляет стеклом и всеми дочерними слоями макета: рамкой, заголовком, текстом, SVG и меню. React bridge получает onRevealProgress от рендерера и обновляет CSS-маску из scanReveal без React-обновлений на каждом кадре. Маска учитывает положение и размеры glassPanel, направление и мягкость сканирования;
- световая полоса всегда идёт впереди проявления: alpha = 1 - smoothstep(front - softness, front, coordinate). Впереди front всё скрыто. Свет полосы композится отдельно от reveal, чтобы маска контента не скрывала саму полосу;
- pulseRevealEnabled включает реакцию светом по квадратным зонам, независимо от сканера первого появления. Перенеси pixelReveal.ts: triggerPulse(x, y) после завершения сканера запускает пробежку из координат касания от верхнего левого края всего исходного кадра (0–1). pixelPulseLight добавляет только свет к материалу; никогда не умножай прозрачность стекла или DOM-макета на эту анимацию. Текст, рамка, иллюстрации и меню остаются видимыми и интерактивными. Пробежка не меняет scanProgress; replayReveal повторяет сканер, previewPixelPulse отдельно показывает пробежку из центра;
- interactionMode = move поднимает поверхность перетаскивания над макетом и временно делает reader inert. В режиме touch позиция закреплена, работают чтение, меню и касание. Перетаскивание двигает одну общую glassPanel для стекла, рамки и текста; захватывай указатель и освобождай его при отмене, blur и переключении режима;
- progress = 1 полностью убирает полосу и CSS-маску, возвращает интерактивность макета; при prefers-reduced-motion сразу показывай весь макет со стеклом, без деформации и движения света. PNG экспортирует готовый материал;
- source texture должен читаться в рабочем color space, а итоговый цвет должен выходить через linearToOutputTexel;
- moving media texture без аппаратного sRGB unpack должен декодироваться перед optical math через sRGBTransferEOTF;
- color correction применяется после optical composition, затем накладывается fillColor / fillOpacity и выполняется output color-space conversion;
- fillColor принимается как sRGB HEX и переводится в линейный цвет перед смешиванием. Заливка ограничена panelMask и scan reveal, не затрагивает внешний исходник или DOM-текст. При fillOpacity = 1 готовая плашка имеет ровно выбранный цвет;
- highlightColor тоже переводится из sRGB в линейный цвет. Он заменяет цвет отражений в обеих моделях, но не меняет исходник, заливку или цвет сканирования; яркость управляется существующими highlightStrength / rimStrength;
- pulseColor переводится из sRGB в линейный цвет и управляет только светом пиксельной пробежки через uPulseColor. Цвет блика, заливка и сканер от него не зависят; яркость пробежки задаёт pulseStrength, прозрачность её света — pulseOpacity (0–1, по умолчанию 1). В интерфейсе показывается обратное значение: 0% прозрачности — полный свет, 100% — волна скрыта. Не меняй прозрачность самой плашки или DOM-макета;
- слои center field гасятся общей masterFade; фаска и направленная кромка рассчитываются независимо от него;
- shapeType должен менять реальный SDF / signed field, а не только UI icon;
- shapeType = 11 — квадрат с равными физическими сторонами и углами 90°; cornerRadius к нему не применяется;
- shapeType = 12 — прямоугольная плашка со срезами 45°; cutTopLeft, cutTopRight, cutBottomRight, cutBottomLeft включают углы; cutSizeTopLeft, cutSizeTopRight, cutSizeBottomRight, cutSizeBottomLeft задают четыре независимых размера от короткой стороны. Старый cutSize используется только при импорте пресетов без отдельных размеров;
- shapeDistance(p) должен давать границу формы, а нормаль должна вычисляться по central differences;
- flow должен применяться к normal/gradient через flowGradient(p, time), а не прибавляться как независимый UV offset после IOR;
- все слои материала ограничены panelMask и общей маской проявления scan.

Signed IOR:

\`\`\`glsl
float signedOpticalPower(float ior) {
  return ior * 0.18032787;
}
\`\`\`

Center-to-edge field:

\`\`\`glsl
vec2 centerVector = (panelUv - 0.5) * aspectCorrection;

vec2 normalizedCenter = vec2(
  abs(centerVector.x) / max(0.5 * aspect, 0.001),
  abs(centerVector.y) / 0.5
);

float ellipseTravel = length(normalizedCenter);
float rectTravel = max(normalizedCenter.x, normalizedCenter.y);
float edgeBlend = smoothstep(0.72, 1.18, ellipseTravel);
float edgeTravel = mix(ellipseTravel, rectTravel, edgeBlend * 0.16);

float fieldStart = clamp(uFieldStart, 0.0, 0.9);
float fieldSoftness = clamp(uFieldSoftness, 0.04, 1.0);
float fieldCurve = clamp(uFieldCurve, 0.35, 6.0);

float fadeProgress = clamp(
  (edgeTravel - fieldStart) / max(fieldSoftness, 0.001),
  0.0,
  1.0
);

float longRamp = smoothstep(
  max(0.0, fieldStart - fieldSoftness * 0.45),
  1.18,
  edgeTravel
);

float maskFade = pow(
  smoothstep(0.0, 1.0, fadeProgress) * longRamp,
  fieldCurve
);

float dissolveFade = pow(
  smootherstep01(fadeProgress),
  max(0.6, fieldCurve * 0.82)
) * longRamp;

float masterFade = mix(maskFade, dissolveFade, step(0.5, uFieldFadeMode)) * regionMask;
\`\`\`

Original model refraction:

\`\`\`glsl
vec2 normal = length(centerVector) > 0.00001 ? normalize(centerVector) : vec2(0.0);
vec2 flowGrad = flowGradient(p, uTime);
vec2 opticalNormal = normalize(normal + flowGrad * uFlowStrength * masterFade);

float pull =
  signedOpticalPower(uIOR)
  * masterFade
  * uFieldStrength
  * (0.055 + thickness * 0.38);

vec2 refractOffset = opticalNormal * pull / aspectCorrection * panelSize;
\`\`\`

Glass model refraction:

Use getOpticalTravel(figmaDepth, figmaRefraction, logicalPanelShortSide) from glassRefraction.ts for uOpticalTravel. Upload backgroundBlur as uBackgroundBlur in logical pixels. The contour light uses rimWidth only; do not feed Depth into edge lighting.

Lens helper (outside main):

\`\`\`glsl
${glassLensGLSL}
\`\`\`

Inside the Glass model branch:

\`\`\`glsl
${glassRefractionGLSL}
// uGlassOptics: enabled, Refraction, Depth, Dispersion.
writeOutputColor(mix(baseColor, opticalColor, regionMask), baseColor, panelMask, panelUv, edgeNormal, depthPx, regionMask);
\`\`\`

Source sampling:

\`\`\`glsl
vec4 texel = texture2D(uSourceTexture, clamp(coverUv(vUv), vec2(0.001), vec2(0.999)));
vec3 sourceColor = uDecodeSourceTexture > 0.5 ? sRGBTransferEOTF(texel).rgb : texel.rgb;
\`\`\`

Dispersion sampling:

\`\`\`glsl
vec3 sampleDispersedSource(vec2 uv, vec2 refractOffset, float chroma, float blurAmount) {
  vec2 centerUv = uv + refractOffset;
  float bendPixels = length(refractOffset * uResolution / max(uPixelRatio, 1.0));
${dispersionSpreadGLSL}
  if (spreadPixels < 0.01) return sampleGlassSource(centerUv, blurAmount);
  vec2 spreadUv = refractOffset * (spreadPixels / max(bendPixels, 0.00001));
  vec3 color = vec3(0.0);
${spectralSampleGLSL}
  return color;
}
\`\`\`

Final composition rule:

\`\`\`glsl
vec3 glassBaseColor = mix(baseColor, sampleGlassSource(vUv + surfaceOffset, blurAmount), regionMask);
vec3 finalColor = mix(glassBaseColor, opticalColor, masterFade);
// Adds directional lighting, fill, scan reveal and output conversion.
writeOutputColor(finalColor, baseColor, panelMask, panelUv, edgeNormal, depthPx, regionMask);
// Inside writeOutputColor, after lighting:
vec3 materialColor = mix(applyColorGrade(color), uFillColor, clamp(uFillOpacity, 0.0, 1.0));
gl_FragColor = linearToOutputTexel(vec4(mix(baseColor, materialColor, panelMask * reveal), 1.0));
\`\`\`

Acceptance:
- preset imports without changing numeric values;
- in Original mode, ior = 0 disables refraction; in Glass mode, figmaRefraction = 0 disables edge refraction; backgroundBlur = 0 disables blur;
- Glass controls and panel fill survive preset export/import, including explicit zero values;
- highlightColor survives export/import independently of fillColor; legacy presets default to #FFF59A;
- pulseColor survives export/import independently of highlightColor and fillColor; legacy presets default to #FFF59A;
- fillOpacity = 0 keeps optics unchanged; fillOpacity = 1 gives the chosen sRGB color after reveal;
- fill never changes the clean source outside the panel or the opacity of text and illustrations;
- dispersion preserves a uniform source color and does not add a rainbow emission;
- blur works with center field on or off and preserves a sharp silhouette;
- the original source remains sharp outside the glass panel;
- shapeType = 11 stays square with sharp corners at any frame aspect ratio;
- shapeType = 12 respects each corner toggle and keeps physical 45-degree cuts;
- touch releases after pointer cancellation and focus loss;
- reveal completes at the configured duration and does not loop;
- scan content never appears ahead of the light; its softness is entirely behind the front;
- contact pixel light never changes panel or layout opacity and never resets the scan;
- reduced motion and PNG export both show the finished material;
- negative ior reverses refraction direction in Original mode;
- center-to-edge transition has no visible hard cut;
- source object keeps cover-fit sizing inside its container;
- resize updates resolution and aspect uniforms;
- browser console has no shader/WebGL errors.
`
}
