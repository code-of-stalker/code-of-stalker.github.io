import type { LiquidGlassControl } from './settings'

export const materialNumberDefaults = {
  facetWidth: 4,
  facetStrength: 0.65,
  cutSize: 0.12,
  cutSizeTopLeft: 0.12,
  cutSizeTopRight: 0.12,
  cutSizeBottomRight: 0.12,
  cutSizeBottomLeft: 0.12,
  touchStrength: 0.65,
  touchRadius: 0.28,
  touchLag: 0.16,
  rimStrength: 0.32,
  rimWidth: 1.5,
  rimAngle: 135,
  scanDuration: 1.8,
  scanSoftness: 0.07,
  scanStrength: 0.65,
  pulseDuration: 1.8,
  pulseCellSize: 20,
  pulseSoftness: 0.3,
  pulseStrength: 0.65,
  pulseOpacity: 1,
}

export const materialBooleanDefaults = {
  facetEnabled: false,
  cutTopLeft: false,
  cutTopRight: true,
  cutBottomRight: false,
  cutBottomLeft: true,
  touchEnabled: false,
  rimEnabled: false,
  scanEnabled: false,
  pulseRevealEnabled: false,
}

export type MaterialNumberKey = keyof typeof materialNumberDefaults
export type MaterialBooleanKey = keyof typeof materialBooleanDefaults

export const materialControlCopy: Record<MaterialNumberKey, Record<'en' | 'ru', { label: string; help: string }>> = {
  pulseDuration: {
    en: { label: 'Pulse duration', help: 'Time for pixel light to travel across the already visible panel.' },
    ru: { label: 'Время пробежки', help: 'За сколько секунд свет проходит по уже видимой плашке.' },
  },
  pulseCellSize: {
    en: { label: 'Zone size', help: 'Size of square light patches in logical pixels.' },
    ru: { label: 'Размер зон', help: 'Размер квадратных зон, по которым пробегает свет.' },
  },
  pulseSoftness: {
    en: { label: 'Wave softness', help: 'Width of the passing band of illuminated zones.' },
    ru: { label: 'Мягкость волны', help: 'Ширина полосы освещённых зон во время пробежки.' },
  },
  pulseStrength: {
    en: { label: 'Zone light', help: 'Brightness of the contact pulse in the selected pixel color.' },
    ru: { label: 'Свет зон', help: 'Яркость пробежки в выбранном цвете пикселей.' },
  },
  pulseOpacity: {
    en: { label: 'Wave transparency', help: '0% shows the full wave; 100% hides its light. Glass and text stay visible.' },
    ru: { label: 'Прозрачность волны', help: '0% — волна полностью видна, 100% — её свет скрыт. Плашка и текст остаются видимыми.' },
  },
  facetWidth: {
    en: { label: 'Clear edge width', help: 'A transparent bevel around the frosted body; measured in logical pixels.' },
    ru: { label: 'Ширина фаски', help: 'Прозрачная полоска вдоль матовой середины. Ширина в пикселях.' },
  },
  facetStrength: {
    en: { label: 'Bevel refraction', help: 'Extra refraction inside the clear bevel. Follows the IOR direction.' },
    ru: { label: 'Преломление фаски', help: 'Усиливает изгиб изображения вдоль прозрачной грани. Направление задаёт IOR.' },
  },
  cutSize: {
    en: { label: 'Corner cut size', help: '45° cuts measured against the shorter side. Each corner can be enabled separately.' },
    ru: { label: 'Размер срезов', help: 'Доля короткой стороны. Каждый угол срезается под 45° и включается отдельно.' },
  },
  cutSizeTopLeft: {
    en: { label: 'Top left cut', help: 'Cut depth as a percentage of the shorter panel side.' },
    ru: { label: 'Левый верхний', help: 'Глубина среза в процентах от короткой стороны плашки.' },
  },
  cutSizeTopRight: {
    en: { label: 'Top right cut', help: 'Cut depth as a percentage of the shorter panel side.' },
    ru: { label: 'Правый верхний', help: 'Глубина среза в процентах от короткой стороны плашки.' },
  },
  cutSizeBottomRight: {
    en: { label: 'Bottom right cut', help: 'Cut depth as a percentage of the shorter panel side.' },
    ru: { label: 'Правый нижний', help: 'Глубина среза в процентах от короткой стороны плашки.' },
  },
  cutSizeBottomLeft: {
    en: { label: 'Bottom left cut', help: 'Cut depth as a percentage of the shorter panel side.' },
    ru: { label: 'Левый нижний', help: 'Глубина среза в процентах от короткой стороны плашки.' },
  },
  touchStrength: {
    en: { label: 'Touch depth', help: 'Local surface indentation while pressing; gently settles after release.' },
    ru: { label: 'Глубина касания', help: 'Насколько стекло прогибается под пальцем. После отпускания поверхность успокаивается.' },
  },
  touchRadius: {
    en: { label: 'Touch area', help: 'Radius of the indentation relative to the shorter panel side.' },
    ru: { label: 'Область касания', help: 'Радиус прогиба относительно короткой стороны плашки.' },
  },
  touchLag: {
    en: { label: 'Surface lag', help: 'How softly the deformation follows the finger or pressed mouse.' },
    ru: { label: 'Инерция поверхности', help: 'Запаздывание за пальцем или зажатой мышью. Чем выше значение, тем медленнее поверхность следует за движением.' },
  },
  rimStrength: {
    en: { label: 'Edge light', help: 'Muted yellow light on the facing edge and subtle absorption on the opposite edge.' },
    ru: { label: 'Свет на грани', help: 'Приглушённый жёлтый свет на обращённом к нему крае и лёгкая тень на противоположном.' },
  },
  rimWidth: {
    en: { label: 'Light width', help: 'A narrow highlight clipped to the glass silhouette.' },
    ru: { label: 'Ширина кромки', help: 'Тонкая светлая линия внутри контура стекла.' },
  },
  rimAngle: {
    en: { label: 'Light direction', help: 'Base light direction; follows panel movement, pointer movement and scrolling.' },
    ru: { label: 'Направление света', help: 'Базовый угол света. Кромка реагирует на перемещение плашки, курсора и прокрутку.' },
  },
  scanDuration: {
    en: { label: 'Reveal duration', help: 'One scan reveals glass and layout together. Use Replay to preview again.' },
    ru: { label: 'Время проявления', help: 'Один проход проявляет стекло и весь макет вместе. Анимацию можно повторить.' },
  },
  scanSoftness: {
    en: { label: 'Reveal softness', help: 'Softness of the shared transition for glass, text, frame and illustrations.' },
    ru: { label: 'Мягкость проявления', help: 'Плавность появления стекла, текста, рамки и иллюстраций за полосой.' },
  },
  scanStrength: {
    en: { label: 'Scan line light', help: 'Brightness of the scan line; it disappears completely after the reveal.' },
    ru: { label: 'Свет полосы', help: 'Яркость полосы сканирования. После прохода полоса полностью исчезает.' },
  },
}

const bounds: Record<MaterialNumberKey, [number, number, number]> = {
  facetWidth: [1, 16, 0.5], facetStrength: [0, 2, 0.05], cutSize: [0, 0.45, 0.01],
  cutSizeTopLeft: [0, 0.45, 0.01], cutSizeTopRight: [0, 0.45, 0.01],
  cutSizeBottomRight: [0, 0.45, 0.01], cutSizeBottomLeft: [0, 0.45, 0.01],
  touchStrength: [0, 6, 0.05], touchRadius: [0.08, 2, 0.01], touchLag: [0.08, 2, 0.01],
  rimStrength: [0, 1, 0.01], rimWidth: [0.5, 5, 0.25], rimAngle: [0, 360, 1],
  scanDuration: [0.6, 4, 0.1], scanSoftness: [0.01, 0.2, 0.01], scanStrength: [0, 1.5, 0.05],
  pulseDuration: [0.6, 4, 0.1], pulseCellSize: [10, 48, 1], pulseSoftness: [0.08, 0.6, 0.01], pulseStrength: [0, 1.5, 0.05],
  pulseOpacity: [0, 1, 0.01],
}

export const materialControls = (Object.keys(bounds) as MaterialNumberKey[]).map((key) => ({
  key,
  ...materialControlCopy[key].en,
  min: bounds[key][0], max: bounds[key][1], step: bounds[key][2],
  section: 'material' as const,
})) satisfies LiquidGlassControl[]
