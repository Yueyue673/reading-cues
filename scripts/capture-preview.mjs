import './build.mjs';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const assets=path.join(root,'docs','assets');await mkdir(assets,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.READING_CUES_BROWSER_EXECUTABLE?{executablePath:process.env.READING_CUES_BROWSER_EXECUTABLE}:{})});
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,colorScheme:'light'});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const ready=()=>page.waitForFunction(()=>document.getElementById('compare-status').textContent.startsWith('当前 '));
  await page.goto(pathToFileURL(path.join(root,'dist','extension','compare.html')).href);await ready();
  await page.screenshot({path:path.join(assets,'workbench.png'),fullPage:true});
  await page.emulateMedia({colorScheme:'dark'});await page.screenshot({path:path.join(assets,'workbench-dark.png'),fullPage:true});await page.emulateMedia({colorScheme:'light'});
  await page.locator('[data-plan=annotate]').click();
  for(const phrase of ['周末早上','公交车','旧书店','几盆植物']){
    await page.locator('#compare-article').evaluate((el,phrase)=>{const start=el.textContent.indexOf(phrase),range=new Range();range.setStart(el.firstChild,start);range.setEnd(el.firstChild,start+phrase.length);getSelection().removeAllRanges();getSelection().addRange(range);},phrase);
    await page.locator('#annotation-add').click();
  }
  await page.screenshot({path:path.join(assets,'marking.png'),fullPage:true});
  await page.locator('#annotation-complete').click();await ready();
  await page.screenshot({path:path.join(assets,'comparison.png'),fullPage:true});
  await page.goto(pathToFileURL(path.join(assets,'cover.html')).href);
  const frame=page.frames().find(frame=>frame.url().endsWith('/compare.html'));
  if(!frame)throw new Error('Cover did not load the real workspace.');
  await frame.waitForFunction(()=>document.getElementById('compare-status').textContent.startsWith('当前 '));
  await page.setViewportSize({width:1440,height:820});await page.screenshot({path:path.join(assets,'cover.png')});
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Generated actual workspace, marking, comparison and cover images in docs/assets.');
}finally{await browser.close();}
