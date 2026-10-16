import { chromium } from 'file:///C:/Users/qtas5/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ headless:true, executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-webgpu'] });
try {
 const page = await browser.newPage({ viewport:{width:1000,height:800} });
 await page.goto('http://127.0.0.1:8088/launch?graphics=rust-motion');
 await page.getByRole('button',{name:'ОТМЕНА',exact:true}).click(); await page.getByTestId('device-optimization').waitFor({state:'detached'});
 await page.goto('http://127.0.0.1:8088/diary?graphics=rust-motion');
 await page.getByRole('button',{name:'Записать наблюдение голосом',exact:true}).click(); await page.waitForTimeout(1000);
 console.log(await page.getByRole('button',{name:'Закрыть запись',exact:true}).evaluate(e=>e.outerHTML));
 console.log(await page.getByTestId('diary-voice-capture').evaluate(e=>{const s=e.querySelector('[data-graphics="rust-motion-svg"]').shadowRoot; const svg=s.querySelector('svg');return [...svg.querySelectorAll('path')].slice(-5).map(p=>({html:p.outerHTML,css:getComputedStyle(p).cssText,transform:getComputedStyle(p).transform,origin:getComputedStyle(p).transformOrigin,fill:getComputedStyle(p).fill,stroke:getComputedStyle(p).stroke}));}));
} finally {await browser.close();}
