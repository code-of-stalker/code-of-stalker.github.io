import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { Platform, type LayoutChangeEvent, type View } from 'react-native';

/** RN Web rounds onLayout dimensions. Contours need the actual fractional layout size. */
export function usePanelSize(initial: {width:number;height:number}, sharedRef?: RefObject<View|null>) {
  const ownRef = useRef<View>(null), ref = sharedRef ?? ownRef;
  const [size, setSize] = useState(initial);
  const update = (width:number,height:number) => {
    if (width>0&&height>0) setSize(old => old.width===width&&old.height===height?old:{width,height});
  };
  useLayoutEffect(() => {
    if (Platform.OS!=='web'||!ref.current) return;
    const element=ref.current as unknown as HTMLElement;
    const observer=new ResizeObserver(([entry])=>{
      const box=entry.borderBoxSize[0];
      const width=box.inlineSize,height=box.blockSize;
      if(width>0&&height>0)setSize(old=>old.width===width&&old.height===height?old:{width,height});
    });
    observer.observe(element,{box:'border-box'});
    return ()=>observer.disconnect();
  },[ref]);
  const onLayout=(event:LayoutChangeEvent)=>{if(Platform.OS!=='web')update(event.nativeEvent.layout.width,event.nativeEvent.layout.height);};
  return {ref,size,onLayout};
}
