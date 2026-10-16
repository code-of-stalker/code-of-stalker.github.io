import { ArchitectureCover } from '../architecture/ArchitectureCover'
import type { ArchitectureSettings } from '../architecture/architectureSettings'
import { DiaryCover } from '../diary/DiaryCover'
import type { DiarySettings } from '../diary/diarySettings'
import { LabIcon } from '../LabIcon'

export type HomeSection = 'architecture' | 'diary'
export function HomeSectionPreview({ section, language, architecture, diary, active, onBack }: {
  section: HomeSection; language: 'ru' | 'en'; architecture: ArchitectureSettings; diary: DiarySettings; active: boolean; onBack: () => void
}) {
  const ru = language === 'ru', isArchitecture = section === 'architecture'
  return <>
    <header className="home-section-header"><button type="button" className="home-section-back" onClick={onBack} aria-label={ru ? 'На главную' : 'Back to Home'}>
      <svg className="home-section-button-frame" viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth=".7" aria-hidden="true"><path d="M.5 .5H33L43.5 11V43.5H11L.5 33Z"/></svg><LabIcon name="back"/></button>
      <h2>{isArchitecture ? (ru ? 'ЗАДАНИЕ' : 'EXERCISE') : (ru ? 'ДНЕВНИК' : 'DIARY')}</h2>
      <button type="button" className="home-section-close" onClick={onBack} aria-label={ru ? 'Закрыть раздел' : 'Close section'}><svg className="home-section-button-frame" viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth=".7" aria-hidden="true"><path d="M.5 .5H33L43.5 11V43.5H11L.5 33Z"/></svg><LabIcon name="close"/></button>
    </header>
    {isArchitecture ? <>
      <small className="home-section-caption">{architecture.illustration === 'guidance' ? (architecture.guidanceVariant === 'parallel' ? (ru ? 'ВОДИТЕЛЬСТВО · ПАРАЛЛЕЛЬНЫЙ ПУТЬ' : 'GUIDANCE · PARALLEL PATH') : (ru ? 'ВОДИТЕЛЬСТВО · ПОДСКАЗКА В УЗЛЕ' : 'GUIDANCE · HINT AT THE JUNCTION')) : architecture.illustration === 'distance' ? (ru ? 'ВЫСТАВЬ ДИСТАНЦИЮ' : 'SET A DISTANCE') : (ru ? 'БАЗОВЫЙ · ШАГ 1 · ОЩУТИ СЕБЯ' : 'BASIC · STEP 1 · FEEL YOURSELF')}</small>
      <div className="home-section-text">
        {architecture.illustration === 'guidance' ? <>
          <p><strong>{ru ? 'Водительство от проводника' : 'Guidance from a guide'}</strong></p>
          <p>{architecture.guidanceVariant === 'parallel' ? (ru ? 'Два самостоятельных источника света. Движение рядом, каждый по своему пути.' : 'Two independent sources of light. Moving side by side, each on their own path.') : (ru ? 'На развилке появляется подсказка. Следующий шаг остаётся твоим.' : 'A hint appears at the junction. The next step remains yours.')}</p>
        </> : architecture.illustration === 'distance' ? <>
          <p><strong>{ru ? 'Выставь дистанцию.' : 'Set a distance.'}</strong></p>
          <p>{ru ? 'Дистанцию с персонажным собой, с образным.' : 'A distance from your persona, from the image of yourself.'}</p>
        </> : <>
          <p>{ru ? 'Когда человек смотрит на других, привычно возникает вывод: «я такой же, я один из множества».' : 'When we look at other people, a familiar conclusion arises: “I am the same, one among many.”'}</p>
          <p><strong>{ru ? 'Это — первая и самая сильная ловушка матрицы.' : 'This is the first and strongest trap of the matrix.'}</strong></p>
          <p>{ru ? 'Она строится на подобии форм: лица, тела, поступки, биографии.' : 'It rests on similarities of form: faces, bodies, actions, biographies.'}</p>
          <p>{ru ? 'Но «похожие» не значит «одно», не значит тождество себя.' : 'But “similar” does not mean “one.” It does not mean an identical self.'}</p>
        </>}
      </div>
      <div className="home-section-art home-section-art--architecture" aria-hidden="true"><ArchitectureCover settings={architecture} language={language} presentation="artwork" interactive={false} active={active}/></div>
      <span className="home-section-step">{architecture.illustration === 'guidance' ? (ru ? 'ВОДИТЕЛЬСТВО' : 'GUIDANCE') : architecture.illustration === 'distance' ? (ru ? 'ВЫСТАВЬ ДИСТАНЦИЮ' : 'SET A DISTANCE') : (ru ? 'ШАГ 1. ОЩУТИ СЕБЯ' : 'STEP 1. FEEL YOURSELF')}</span>
    </> : <>
      <div className="home-section-art home-section-art--diary" aria-hidden="true"><DiaryCover settings={diary} language={language} presentation="artwork" interactive={false} active={active}/></div>
      <div className="home-section-diary-copy"><small>{ru ? 'АРХИВ МОМЕНТОВ' : 'ARCHIVE OF MOMENTS'}</small><h3>{ru ? 'Сохрани то, что заметил' : 'Keep what you noticed'}</h3>
        <p>{ru ? 'Мысль, ощущение, звук твоего голоса. Момент, к которому можно вернуться.' : 'A thought, a sensation, the sound of your voice. A moment to return to.'}</p>
        <div className="home-section-empty"><LabIcon name="archive"/><strong>{ru ? 'Наблюдений пока нет' : 'No observations yet'}</strong><span>{ru ? 'Здесь появятся твои сохранённые моменты.' : 'Your saved moments will appear here.'}</span></div>
      </div>
    </>}
  </>
}
