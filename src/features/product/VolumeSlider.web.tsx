import {useThemeColors} from './ProductTheme';
export function VolumeSlider({value,onChange,disabled=false}:{value:number;onChange(value:number):void;disabled?:boolean}){
  const colors=useThemeColors();
  return <><style>{`.product-volume-slider{appearance:none;display:block;height:44px;flex:1;min-width:0;width:100%;margin:0;background:transparent;touch-action:none}
    .product-volume-slider::-webkit-slider-runnable-track{height:2px;background:${colors.accent}}
    .product-volume-slider::-moz-range-track{height:2px;background:${colors.accent}}
    .product-volume-slider::-webkit-slider-thumb{appearance:none;width:7px;height:16px;margin-top:-7px;border:0;border-radius:0;background:${colors.accent}}
    .product-volume-slider::-moz-range-thumb{width:7px;height:16px;border:0;border-radius:0;background:${colors.accent}}`}</style>
    <input className="product-volume-slider" aria-label="Громкость записи" type="range" min="0" max="100" step="1" value={Math.round(value*100)} disabled={disabled}
      onChange={e=>onChange(Number(e.currentTarget.value)/100)}/></>;
}
