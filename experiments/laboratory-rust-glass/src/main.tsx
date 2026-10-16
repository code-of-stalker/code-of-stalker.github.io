import {memo,useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AttentionAwareness} from '../reference/src/components/matrix/AttentionAwareness';
import {initial,type Settings} from './parameters';
import {createDriver,type Driver,type EngineName,type ResourceSnapshot} from './drivers';
import {observerCycleSeconds,sceneLabels,workloadVersion,type SceneKind} from './workload';
import {benchmarkProtocol,FrameSampler,frameStats,runDurationMs,summarizeRun,type FrameSample} from './benchmark';
import {ObserverPlaybackProbe,observerPlaybackLabels,readObserverSample,type ObserverPlayback} from './observerPlayback';
import './style.css';

type Workload=ReturnType<Driver['describe']>;
type ResourcePoint=ResourceSnapshot&{atMs:number};
type Result=ReturnType<typeof summarizeRun>&{startedAt:string;engine:EngineName;backend:string;ratio:number;width:number;height:number;settings:Settings;workload:Workload;resources:ResourcePoint[];observerPlayback:ObserverPlayback|null;setupMs:number;observerEvidence:string};
type Measurement={start:number|null;startedAt:string;frames:FrameSample[];backend:string;engine:EngineName;settings:Settings;width:number;height:number;resources:ResourcePoint[];nextResourceMs:number;workload?:Workload;observer:ObserverPlaybackProbe|null;setupMs:number};
const empty=frameStats([]);
const Observer=memo(AttentionAwareness);
const sliders:[keyof Settings,string,number,number,number][]=[['pixelRatio','Плотность',1,2,.25],['backgroundBlur','Размытие',0,30,1],['figmaRefraction','Преломление',0,1,.01],['figmaDepth','Глубина',0,100,1],['figmaDispersion','Дисперсия',0,1,.01],['fillOpacity','Заливка',0,.8,.01],['touchStrength','Сила касания',0,3,.1]];

function App(){
  const [engine,setEngine]=useState<EngineName>('current'),[forceGL,setForceGL]=useState(false);
  const [scene,setScene]=useState<SceneKind>('rain-observer'),[animationRevision,setAnimationRevision]=useState(0);
  const [settings,setSettings]=useState(initial),[playing,setPlaying]=useState(true),[revision,setRevision]=useState(0);
  const [status,setStatus]=useState('Подготовка'),[ready,setReady]=useState(false),[failure,setFailure]=useState('');
  const [metrics,setMetrics]=useState(empty),[seconds,setSeconds]=useState(0),[running,setRunning]=useState(false),[results,setResults]=useState<Result[]>([]);
  const [measurementNotice,setMeasurementNotice]=useState(''),[pageVisible,setPageVisible]=useState(!document.hidden);
  const [sceneInView,setSceneInView]=useState(true);
  const [poseTime,setPoseTime]=useState<number|null>(null);
  const [reducedMotion,setReducedMotion]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const observerProbe=useRef(new ObserverPlaybackProbe());
  const [observerPlayback,setObserverPlayback]=useState<ObserverPlayback>(()=>new ObserverPlaybackProbe().snapshot());
  const stage=useRef<HTMLDivElement>(null),holder=useRef<HTMLDivElement>(null),content=useRef<HTMLDivElement>(null),driver=useRef<Driver|null>(null);
  const current=useRef({settings,playing,poseTime});
  useLayoutEffect(()=>{current.current={settings,playing,poseTime};},[settings,playing,poseTime]);
  const measurement=useRef<Measurement|null>(null);
  const pendingMeasurement=useRef(false);
  const resetObserver=()=>{observerProbe.current=new ObserverPlaybackProbe();setObserverPlayback(observerProbe.current.snapshot());};
  const resetUI=()=>{pendingMeasurement.current=false;setFailure('');setStatus('Подготовка');setReady(false);setMetrics(empty);measurement.current=null;setRunning(false);setSeconds(0);setMeasurementNotice('');resetObserver();setAnimationRevision(x=>x+1);};
  const chooseEngine=(next:EngineName)=>{if(next!==engine){resetUI();setEngine(next);}};
  const changeSettings=(next:Settings)=>{if(measurement.current)setMeasurementNotice('Замер отменён: изменились настройки.');measurement.current=null;setRunning(false);setSettings(next);};

  useEffect(()=>{
    let cancelled=false,raf=0,publish=0,sceneInView=true,liveFrames:FrameSample[]=[],configuredSize='';
    const sampler=new FrameSampler();
    const element=holder.current!,board=stage.current!,canvas=document.createElement('canvas');element.replaceChildren(canvas);
    canvas.setAttribute('aria-label','Сцена: '+engine);
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    const reveal=(value:number)=>{if(content.current)content.current.style.opacity=String(Math.max(0,Math.min(1,value)));};
    measurement.current=null;
    const sceneVisible=()=>{
      const r=board.getBoundingClientRect();
      const w=Math.max(0,Math.min(r.right,window.innerWidth)-Math.max(r.left,0));
      const h=Math.max(0,Math.min(r.bottom,window.innerHeight)-Math.max(r.top,0));
      return r.width>0&&r.height>0&&w*h/(r.width*r.height)>=.8;
    };
    const cancelForVisibility=()=>{
      const visible=sceneVisible();
      if(visible!==sceneInView){sceneInView=visible;setSceneInView(visible);liveFrames=[];sampler.reset();}
      if(!measurement.current||visible)return;
      measurement.current=null;setRunning(false);setSeconds(0);
      setMeasurementNotice('Замер отменён: сцена вышла за экран. Держи телефон вертикально и оставь сцену видимой.');
    };
    const sceneObserver=new IntersectionObserver(cancelForVisibility,{threshold:[0,.8,1]});
    sceneObserver.observe(board);
    const resize=()=>{
      if(!driver.current)return;
      const width=Math.round(board.clientWidth),height=Math.round(board.clientHeight);
      const key=`${width}×${height}:${reduced.matches}`;
      if(key===configuredSize)return;
      if(measurement.current)setMeasurementNotice(`Замер отменён: изменился размер области (${configuredSize.split(':')[0]} → ${width}×${height}). Запусти снова.`);
      configuredSize=key;
      measurement.current=null;setRunning(false);sampler.reset();liveFrames=[];
      driver.current.configure(current.current.settings,Math.round(board.clientWidth),Math.round(board.clientHeight),reduced.matches);
      if(!current.current.playing)driver.current.render(0);
    };
    const visibility=()=>{
      sampler.reset();liveFrames=[];driver.current?.resetClock();setPageVisible(!document.hidden);
      if(measurement.current)setMeasurementNotice('Замер отменён: вкладка была скрыта. Оставь её открытой и запусти снова.');
      measurement.current=null;setRunning(false);
    };
    const motionPreference=()=>{setReducedMotion(reduced.matches);resize();};
    const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(board);
    document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',motionPreference);
    async function init(){try{
      const next=await createDriver(engine,forceGL,scene,canvas,current.current.settings,Math.round(board.clientWidth),Math.round(board.clientHeight),reduced.matches,reveal);
      if(cancelled){next.dispose();return;}
      driver.current=next;resize();if(current.current.playing)next.replay();setStatus(next.backend);setReady(true);
      if(current.current.poseTime!==null)next.seekScene(current.current.poseTime);
      if(pendingMeasurement.current){
        pendingMeasurement.current=false;
        const r=next.resources();
        measurement.current={start:null,startedAt:new Date().toISOString(),frames:[],backend:next.backend,engine,settings:{...current.current.settings},width:board.clientWidth,height:board.clientHeight,resources:r?[{atMs:0,...r}]:[],nextResourceMs:benchmarkProtocol.bucketMs,observer:scene==='rain-observer'?new ObserverPlaybackProbe():null,setupMs:performance.now()-initializationStart};
        setRunning(true);setSeconds(runDurationMs/1000);
      }
      const observerSample=()=>next.observerSample?.()??readObserverSample(content.current,reduced.matches);
      canvas.dataset.backend=next.backend;
      const draw=(time:number)=>{
        if(cancelled)return;
        raf=requestAnimationFrame(draw);
        if(document.hidden||!current.current.playing){sampler.reset();liveFrames=[];return;}
        try{
          const start=performance.now(),work=next.render(time),cost=performance.now()-start;
          const sample=sampler.frame(time,work,cost);
          if(sample&&sceneInView)liveFrames.push(sample);
          while(liveFrames.length&&liveFrames[0].endMs<time-benchmarkProtocol.liveWindowMs)liveFrames.shift();
          if(measurement.current&&measurement.current.start===null)cancelForVisibility();
          const m=measurement.current;
          if(m){
            if(m.start===null){m.start=time;liveFrames=[];m.workload=next.describe();m.observer?.observe(observerSample(),time);}
            if(sample&&sample.startMs>=m.start)m.frames.push(sample);
            if(time-m.start>=m.nextResourceMs){
              const resources=next.resources();if(resources)m.resources.push({atMs:time-m.start,...resources});
              m.nextResourceMs=(Math.floor((time-m.start)/benchmarkProtocol.bucketMs)+1)*benchmarkProtocol.bucketMs;
            }
            if(time-m.start>=runDurationMs){
              const result:Result={...summarizeRun(m.frames,m.start),startedAt:m.startedAt,engine:m.engine,backend:m.backend,ratio:m.settings.pixelRatio,width:m.width,height:m.height,settings:m.settings,workload:m.workload!,resources:m.resources,observerPlayback:m.observer?.observe(observerSample(),time)??null,setupMs:m.setupMs,observerEvidence:engine==='rust-full'?'submitted GPU frames and Rust camera pose; not GPU pixel readback':'computed SVG transform and stable DOM node'};
              setResults(old=>[...old,result].slice(-12));
              measurement.current=null;setRunning(false);setSeconds(0);
              setMeasurementNotice('Минутный прогон завершён. Итог — за 15–60 с; ниже есть разбивка с самого начала.');
            }
          }
          if(time-publish>1000){
            if(scene==='rain-observer'){
              const sample=observerSample();
              setObserverPlayback(observerProbe.current.observe(sample,time));
              measurement.current?.observer?.observe(sample,time);
            }
            setMetrics(frameStats(liveFrames));publish=time;
            if(measurement.current?.start!=null)setSeconds(Math.max(0,Math.ceil((runDurationMs-(time-measurement.current.start))/1000)));
          }
        }catch(error){setFailure(String(error));cancelAnimationFrame(raf);measurement.current=null;setRunning(false);}
      };
      raf=requestAnimationFrame(draw);
    }catch(error){if(!cancelled){pendingMeasurement.current=false;setRunning(false);setFailure(String(error));setStatus('Движок не запущен');setReady(false);}}}
    const initializationStart=performance.now();void init();
    const contextLost=(event:Event)=>{event.preventDefault();setFailure('Графический контекст потерян. Нажми «Повторить запуск».');cancelAnimationFrame(raf);measurement.current=null;setRunning(false);};
    canvas.addEventListener('webglcontextlost',contextLost);
    return()=>{cancelled=true;cancelAnimationFrame(raf);resizeObserver.disconnect();sceneObserver.disconnect();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',motionPreference);canvas.removeEventListener('webglcontextlost',contextLost);driver.current?.dispose();driver.current=null;};
  },[engine,forceGL,scene,revision]);
  useEffect(()=>{
    const board=stage.current;
    if(board&&driver.current){driver.current.configure(settings,Math.round(board.clientWidth),Math.round(board.clientHeight),window.matchMedia('(prefers-reduced-motion: reduce)').matches);if(!playing)driver.current.render(0);}
  },[settings,playing]);
  useEffect(()=>{driver.current?.seekScene(poseTime);if(!current.current.playing)driver.current?.render(0);},[poseTime]);
  const pointer=(event:React.PointerEvent<HTMLDivElement>,down:boolean)=>{if(measurement.current)return;const bounds=event.currentTarget.getBoundingClientRect();driver.current?.pointer((event.clientX-bounds.left)/bounds.width,(event.clientY-bounds.top)/bounds.height,down);};
  const restartScene=()=>{driver.current?.restartScene();resetObserver();setAnimationRevision(x=>x+1);};
  const startMeasurement=()=>{
    if(!driver.current||failure)return;
    setMeasurementNotice('Пересоздаём движок. Замер начнётся с первого кадра.');setPlaying(true);setSeconds(runDurationMs/1000);setRunning(true);setReady(false);setMetrics(empty);resetObserver();setAnimationRevision(x=>x+1);
    stage.current!.scrollIntoView({block:'center',behavior:'auto'});
    pendingMeasurement.current=true;setRevision(x=>x+1);
  };
  const download=()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify({schemaVersion:5,benchmark:workloadVersion,protocol:benchmarkProtocol,recordedAt:new Date().toISOString(),userAgent:navigator.userAgent,results},null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='laboratory-rust-comparison-v5.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const comparisonMismatch=results.length>1&&results.some(r=>r.width!==results[0].width||r.height!==results[0].height||JSON.stringify(r.settings)!==JSON.stringify(results[0].settings)||JSON.stringify(r.workload)!==JSON.stringify(results[0].workload));
  const metricsVisible=playing&&sceneInView&&poseTime===null;
  return <main>
    <header>{location.pathname.startsWith('/rust-glass/')?<a href="/">← Laboratory</a>:<span>LABORATORY</span>}<span>ЭКСПЕРИМЕНТ 05</span></header>
    <h1>Вся сцена · Rust</h1><p className="intro">Стекло, дождь и «Наблюдающий». Сравниваем исходный режим, перенос стекла и перенос всей сцены в Rust / GPU.</p>
    <nav className="engines" aria-label="Движок"><button disabled={running} aria-pressed={engine==='current'} onClick={()=>chooseEngine('current')}>Текущий</button><button disabled={running} aria-pressed={engine==='rust'} onClick={()=>chooseEngine('rust')}>Rust · стекло</button><button disabled={running} aria-pressed={engine==='rust-full'} onClick={()=>chooseEngine('rust-full')}>Rust · всё</button></nav>
    <div className="workbench"><section>
      <div className="status" role="status">{status}</div>
      <button className="primary measurement-button" disabled={!ready||running||Boolean(failure)||poseTime!==null} onClick={startMeasurement}>{running?`${seconds>45?'Прогрев':'Измерение'} · осталось ${seconds} с`:'Измерить 60 секунд'}</button>
      <div ref={stage} className="stage" data-scene={scene} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);pointer(e,true);}} onPointerMove={e=>{if(e.buttons)pointer(e,true);}} onPointerUp={e=>pointer(e,false)} onPointerCancel={e=>pointer(e,false)}>
        <div ref={holder} className="canvas-holder"/>
        {engine!=='rust-full'&&<div ref={content} className="glass-copy has-illustration" data-fixed={poseTime!==null} style={{'--pose-offset':`${-(poseTime??0)}s`} as React.CSSProperties}>
          {scene==='rain-observer'&&<Observer className="scene-illustration" playing={playing&&pageVisible&&ready&&poseTime===null} cycleSeconds={observerCycleSeconds} replayKey={animationRevision}/>}
        </div>}
        {failure&&<div className="error" role="alert"><strong>Не удалось запустить</strong><p>{failure}</p><button onClick={()=>{resetUI();setRevision(x=>x+1);}}>Повторить запуск</button></div>}
      </div>
      <div className="actions"><button disabled={!ready||!playing} onClick={()=>{pendingMeasurement.current=false;measurement.current=null;setRunning(false);restartScene();}}>Повторить сцену</button><button onClick={()=>{pendingMeasurement.current=false;setPlaying(!playing);driver.current?.resetClock();measurement.current=null;setRunning(false);}}>{playing?'Стоп-кадр':'Продолжить'}</button></div>
      <div className="metrics"><span><b>{metricsVisible?metrics.fps.toFixed(0):'—'}</b> кадров/с · за 5 с</span><span><b>{metricsVisible?metrics.p95.toFixed(1):'—'}</b> мс · p95</span><span><b>{metricsVisible?metrics.cpuMs.toFixed(2):'—'}</b> мс · вызов</span>{scene!=='static'&&<span><b>{metricsVisible?metrics.sourceFps.toFixed(0):'—'}</b> обновл./с · дождь</span>}</div>
      {!sceneInView&&<p className="note">Сцена частично вне экрана. Счётчик приостановлен: для сравнения нужно видеть не меньше 80% сцены.</p>}
      <p className="note">{!playing&&'Стоп-кадр: показатели приостановлены. '}«Вызов» включает обработку дождя и передачу команд. Это не полное время отрисовки SVG и работы GPU.</p>
      {scene==='rain-observer'&&<p className="note observer-playback" role="status">Наблюдающий: {!playing||reducedMotion||poseTime!==null?'пауза':observerPlaybackLabels[observerPlayback.status]}.{engine==='rust-full'&&' Контроль: поза и отправленные GPU-кадры.'}</p>}
      {measurementNotice&&<p className="note" role="status">{measurementNotice}</p>}
      <p className="note">Каждый замер создаёт движок заново: 15 с прогрева + 45 с измерения. В отчёт попадут все 60 с с первого кадра, отдельно по 5 с, время подготовки и счётчики ресурсов. Оставь сцену видимой. Повтори сравнение в обратном порядке после отдыха телефона.</p>
      {reducedMotion&&<p className="note" role="status">На устройстве включено уменьшение движения. Дождь и иллюстрация остановлены; это отмечено в отчёте.</p>}
    </section><aside><h2>Общие настройки</h2>
      <label className="scene-select">Нагрузка<select aria-label="Нагрузка" value={scene} onChange={e=>{resetUI();setScene(e.target.value as SceneKind);}}>{Object.entries(sceneLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <p className="note">В режиме «Rust · всё» дождь, векторные фигуры, камера, свечение, маски и стекло рисуются одним Rust / wgpu движком. Дождь — до 30 обновлений/с во всех режимах, плотность — максимум 2. Кнопки и таблица остаются общей оболочкой React.</p>
      {sliders.map(([key,label,min,max,step])=><label key={key}>{label}<output>{Number(settings[key]).toFixed(step<1?2:0)}</output><input aria-label={label} type="range" min={min} max={max} step={step} value={Number(settings[key])} onChange={e=>changeSettings({...settings,[key]:Number(e.target.value)})}/></label>)}
      <label className="toggle"><input type="checkbox" checked={forceGL} onChange={e=>{resetUI();setForceGL(e.target.checked);}}/> Rust через WebGL2</label>
      <p className="note">Выключено: WebGPU, если доступен, иначе WebGL2. Включено: проверка пути для старых устройств.</p>
      <button onClick={()=>changeSettings({...initial})}>Исходные настройки</button>
      <details className="timeline"><summary>Сверить внешний вид</summary><label className="toggle"><input type="checkbox" checked={poseTime!==null} disabled={running} onChange={e=>{setPoseTime(e.target.checked?5.6:null);setAnimationRevision(x=>x+1);}}/> Одинаковый момент</label>{poseTime!==null&&<label>Момент цикла · {poseTime.toFixed(1)} с<input aria-label="Момент цикла" type="range" min="0" max="11.1" step="0.1" value={poseTime} onChange={e=>{setPoseTime(Number(e.target.value));setAnimationRevision(x=>x+1);}}/></label>}<p className="note">Переключай движки на одном моменте: сравни контуры, свет, маску и дождь. Замер FPS в этом режиме отключён.</p></details>
    </aside></div>
    {results.length>0&&<section className="results"><h2>Результаты · после прогрева</h2>{comparisonMismatch&&<p role="status" className="note">Замеры сделаны с разными сценами, настройками или размерами. Сравнивай только одинаковые условия.</p>}<div className="table-wrap"><table><thead><tr><th>Движок / сцена</th><th>Плотность</th><th>кадров/с · 15–60 с</th><th>p95, мс</th><th>Кадры &gt;34 мс</th><th>Дождь, обновл./с</th><th>Наблюдающий</th></tr></thead><tbody>{results.map(r=><tr key={r.startedAt}><td>{r.backend}<small>{sceneLabels[r.workload.scene]}</small></td><td>{r.ratio}</td><td>{r.fps.toFixed(1)}</td><td>{r.p95.toFixed(1)}</td><td>{r.over34.toFixed(1)}%</td><td>{r.workload.scene==='static'?'—':r.sourceFps.toFixed(1)}</td><td>{r.observerPlayback?observerPlaybackLabels[r.observerPlayback.status]:'—'}</td></tr>)}</tbody></table></div><button onClick={download}>Скачать результаты</button>
      {results.map((r,index)=><details className="timeline" key={r.startedAt}><summary>Прогон {index+1} · {r.backend} · по 5 секунд</summary><p className="note">Первые три отрезка — прогрев. «Дождь CPU» и «Команды CPU» не включают асинхронную работу GPU.</p><div className="table-wrap"><table><thead><tr><th>Время, с</th><th>кадров/с</th><th>p95, мс</th><th>Дождь CPU, мс</th><th>Команды CPU, мс</th></tr></thead><tbody>{r.timeline.map(b=><tr key={b.fromMs}><td>{b.fromMs/1000}–{b.toMs/1000}{b.phase==='warmup'?' · прогрев':''}</td><td>{b.frames?b.fps.toFixed(1):'—'}</td><td>{b.frames?b.p95.toFixed(1):'—'}</td><td>{b.sourceCpuMs.toFixed(2)}</td><td>{b.commandsCpuMs.toFixed(2)}</td></tr>)}</tbody></table></div></details>)}
    </section>}
    <footer>Сравниваем реализации всей сцены, включая смену способа отрисовки и GPU API. Это не тест одного языка. В Rust нет Canvas2D, SVG-анимации или загрузки фонового кадра из JavaScript. Векторные фигуры подготовлены из исходных путей; кэшируется только мягкое свечение. Версия 05 использует единый шрифт дождя и увеличенную область иллюстрации — сопоставляй только прогоны этой версии.</footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
