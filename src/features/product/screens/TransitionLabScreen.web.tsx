import { useEffect, useMemo, useRef, useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { ProductIconButton, ProductText } from '../ui';
import { useThemeColors } from '../ProductTheme';
import { useProduct } from '../state/ProductProvider';
import { useBackSwipe } from '../navigation/BackSwipeProvider';
import { Art } from '../motion/Art';
import { StepPanel } from '../motion/StepPanel';
import { TaskProgress } from '../motion/TaskProgress';
import { PanelArtwork } from '../motion/PanelArtwork';
import { stepPanelPaths } from '../motion/glassShape';
import { RustMotion, shown } from '../motion/RustMotion.web';
import { fonts } from '../theme';
import { firstStepExplanations, stepDescriptions } from '../content';

const variants = [
  {name:'Погружение',caption:'Плашка становится пространством задания. Текст растворяется, контур раскрывается до краёв экрана.'},
  {name:'Слои',caption:'Первый шаг мягко уходит в глубину. Задание поднимается на передний план одним непрерывным движением.'},
  {name:'Сканирование',caption:'Световая линия открывает задание сверху вниз. Продолжает язык сканера, который уже есть в приложении.'},
];

/** Isolated proposals: no progress writes and no change to the selected product transition. */
export function TransitionLabScreen() {
  const colors=useThemeColors(),{settings}=useProduct();
  const [variant,setVariant]=useState(2),[phase,setPhase]=useState<'intro'|'playing'|'task'>('intro'),[epoch,setEpoch]=useState(0),[slow,setSlow]=useState(false),[paused,setPaused]=useState(false);
  const preview=useRef<HTMLDivElement>(null),[size,setSize]=useState({width:375,height:680});
  const blurTarget=useRef<View|null>(null);
  useEffect(()=>{if(!preview.current)return;const observer=new ResizeObserver(([entry])=>setSize({width:entry.contentRect.width,height:entry.contentRect.height}));observer.observe(preview.current);return()=>observer.disconnect();},[]);
  const reset=()=>{setPhase('intro');setPaused(false);setEpoch(value=>value+1);};
  useBackSwipe(()=>{if(phase!=='intro')reset();else router.dismissTo('/practice');});
  const playing=phase==='playing',task=phase==='task',duration=slow?2:1,reduced=settings.reducedMotion;
  const ms=(value:number)=>reduced?0:value*duration;
  const gutter=size.width<375?16:20,heroHeight=Math.min((size.width-gutter*2)*206/288,size.height*.33),panelTop=gutter*2+heroHeight,panelHeight=Math.max(180,size.height-panelTop-gutter);
  const shell=useMemo(()=>({uri:`data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size.width-gutter*2} ${panelHeight}"><path d="${stepPanelPaths(size.width-gutter*2,panelHeight).body}" fill="${colors.background}" fill-opacity=".7" stroke="${colors.accent}" stroke-width=".25"/></svg>`)}`}),[size.width,gutter,panelHeight,colors]);
  const selected=variants[variant];
  const introTarget = variant===0 ? [0,0,-24,1.025,0,100] as const : variant===1 ? [0,0,-size.height*.17,.94,0,100] as const : [0,0,0,1,0,100] as const;
  const taskInitial = variant===0 ? [0,0,24,.985,0,100] as const : variant===1 ? [0,0,size.height*.6,.985,0,100] as const : shown;
  const buttonStyle={border:`.75px solid ${colors.accent}66`,color:colors.text,background:'transparent',fontFamily:fonts.body,fontSize:11,minHeight:38,padding:'8px 12px',cursor:'pointer'};
  return <main style={{height:'100dvh',minHeight:520,background:colors.background,color:colors.text,display:'flex',flexDirection:'column',fontFamily:fonts.body,overflow:'auto'}}>
    <style>{`.transition-layout{display:grid;grid-template-columns:minmax(200px,300px) minmax(300px,440px);gap:40px;width:min(940px,100%);box-sizing:border-box;padding:24px;margin:0 auto;flex:1;min-height:0}.transition-controls{display:flex;flex-direction:column;justify-content:center;gap:20px}.transition-preview{width:100%;height:min(800px,calc(100dvh - 104px));min-height:460px;position:relative;overflow:hidden;isolation:isolate}.transition-tabs{display:flex;gap:8px}.transition-transport{display:flex;gap:8px;flex-wrap:wrap}@media(max-width:700px){.transition-layout{display:flex;flex-direction:column;gap:12px;padding:12px;}.transition-controls{gap:10px}.transition-caption{min-height:36px;font-size:10px!important;line-height:1.6!important}.transition-preview{height:calc(100dvh - 252px);min-height:340px;max-width:440px;align-self:center}.transition-heading{font-size:15px!important}.transition-transport button{min-height:32px!important;padding:5px 8px!important;font-size:9px!important}}`}</style>
    <header style={{padding:'14px 20px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:`.25px solid ${colors.accent}44`,gap:12}}>
      <div className="transition-heading" style={{fontFamily:fonts.title,fontSize:20}}>ПЕРЕХОД В ЗАДАНИЕ</div>
      <button style={buttonStyle} onClick={()=>router.dismissTo('/practice')}>К ПРИЛОЖЕНИЮ ↗</button>
    </header>
    <div className="transition-layout">
      <aside className="transition-controls">
        <div style={{fontSize:9,letterSpacing:2,color:colors.muted}}>ПЕРВЫЙ ШАГ → ЗАДАНИЕ</div>
        <div className="transition-tabs" role="tablist" aria-label="Вариант перехода">
          {variants.map((item,index)=><button key={item.name} role="tab" aria-selected={variant===index} onClick={()=>{setVariant(index);reset();}} style={{...buttonStyle,flex:1,padding:'8px 6px',background:variant===index?colors.accent:'transparent',color:variant===index?colors.background:colors.text}}>{index+1} / {item.name}</button>)}
        </div>
        <p className="transition-caption" style={{fontSize:12,lineHeight:1.9,margin:0,color:colors.muted}}>{selected.caption}</p>
        <div className="transition-transport">
          <button data-testid="transition-play" disabled={playing} onClick={()=>{if(task)setEpoch(value=>value+1);setPaused(false);setPhase('playing');}} style={{...buttonStyle,background:colors.accent,color:colors.background,opacity:playing?.5:1}}>{task?'ПОВТОРИТЬ':'СМОТРЕТЬ ПЕРЕХОД'} →</button>
          {playing?<button style={buttonStyle} onClick={()=>setPaused(value=>!value)}>{paused?'ПРОДОЛЖИТЬ':'ПАУЗА'}</button>:<button style={buttonStyle} disabled={phase==='intro'} onClick={reset}>К ШАГУ</button>}
          <button style={buttonStyle} aria-pressed={slow} disabled={playing} onClick={()=>setSlow(value=>!value)}>{slow?'0.5×':'1×'}</button>
        </div>
      </aside>
      <div ref={preview} data-testid="transition-preview" data-phase={phase} data-variant={variant+1} className="transition-preview" style={{border:`.25px solid ${colors.accent}44`,background:colors.background}}>
        <div key={epoch} style={{position:'absolute',inset:0}}>
          {!task&&<RustMotion initial={shown} target={playing?introTarget:shown} active={!paused} duration={ms(variant===2?820:variant===1?660:380)} delay={playing&&variant===2?ms(100):0}
            style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',padding:gutter,boxSizing:'border-box',transformOrigin:`center ${panelTop+panelHeight*.35}px`,pointerEvents:'none'}}>
            <div style={{height:heroHeight,flexShrink:0,position:'relative',marginBottom:gutter}}><Art kind="mirror" height={heroHeight} active={!paused&&!task} reducedMotion={reduced}/><div style={{position:'absolute',right:0,top:0}}><ProductIconButton icon="close" onPress={reset}/></div></div>
            <StepPanel title="ШАГ 1. ОЩУТИ СЕБЯ" expanded={false} blurTarget={blurTarget} onSelect={()=>{}} background="clear" scanOnMount={false} reducedMotion={reduced} contentInset={12}>
              <div style={{overflowY:'auto',padding:12,flex:1,minHeight:0,scrollbarWidth:'none'}}>
                <ProductText style={{fontSize:12,lineHeight:17,textTransform:'uppercase'}}>{stepDescriptions[1]}</ProductText>
                <Art kind="insight" height={150} decoderVisible active={!paused&&!task} reducedMotion={reduced}/>
              </div>
            </StepPanel>
          </RustMotion>}
          {playing&&variant===0&&<RustMotion initial={[1,gutter,panelTop,1,0,(size.width-gutter*2)/size.width*100]} target={[1,0,-34,1,0,100]} initialHeight={panelHeight} height={size.height+34}
            duration={ms(880)} active={!paused} curve={[.3,.05,.2,1]} style={{position:'absolute',top:0,left:0,pointerEvents:'none',zIndex:3}}>
            <RustMotion initial={shown} target={[0,0,0,1,0,100]} duration={ms(180)} delay={ms(720)} active={!paused} style={{position:'absolute',inset:0}}><PanelArtwork source={shell}/></RustMotion>
          </RustMotion>}
          {(playing||task)&&<RustMotion initial={task?shown:taskInitial} target={shown} duration={ms(variant===1?820:600)} delay={task?0:ms(variant===0?240:variant===1?90:0)} active={!paused}
            scanDuration={variant===2&&!task?ms(820):undefined}
            style={{position:'absolute',inset:0,padding:gutter,boxSizing:'border-box',display:'flex',flexDirection:'column',background:variant===2?colors.background:'transparent',zIndex:4}}>
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:12}}><ProductIconButton icon="back" onPress={reset}/><ProductText variant="title" maxFontSize={24}>ЗАДАНИЕ</ProductText><ProductIconButton icon="close" onPress={reset}/></View>
            <TaskProgress part={1} reducedMotion={reduced}/>
            <div style={{flex:1,minHeight:0,display:'flex',flexDirection:'column',overflow:'hidden'}}>
              <ProductText style={{fontSize:12,lineHeight:17,textTransform:'uppercase',marginTop:8}}>{firstStepExplanations[0].runs.map(run=>run.text).join('')}</ProductText>
              <div style={{flex:1,minHeight:90,position:'relative',display:'flex',alignItems:'center',justifyContent:'center'}}><Art kind="comparison" width={size.width-gutter*2} height={Math.min(size.width-gutter*2,size.height*.43)*244/320} active={!paused} reducedMotion={reduced}/></div>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:12,color:colors.accent,fontSize:9,letterSpacing:1}}><span style={{border:`.25px solid ${colors.accent}`,padding:'7px 12px'}}>ШАГ 1⌄</span><span>ПРОКРУТИ ДАЛЬШЕ ↓</span></div>
          </RustMotion>}
          {playing&&variant===2&&<RustMotion initial={[0,0,-24,1,0,100]} target={[1,0,size.height+24,1,0,100]} duration={ms(920)} active={!paused} curve={[.25,.1,.25,1]}
            style={{position:'absolute',top:0,left:0,width:'100%',height:32,background:`linear-gradient(transparent,${colors.accent}24,${colors.accent}cc,${colors.accent}24,transparent)`,pointerEvents:'none',zIndex:8}}/>}
          {playing&&<RustMotion initial={[0,0,0,1,0,100]} target={shown} duration={ms(1160)} active={!paused} onComplete={()=>{setPhase('task');setPaused(false);}} style={{position:'absolute',width:0,height:0,overflow:'hidden',pointerEvents:'none'}}/>}
        </div>
      </div>
    </div>
  </main>;
}
