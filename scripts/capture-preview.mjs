import './build.mjs';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {mkdir,readFile,mkdtemp,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
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
  await captureCases(browser);
  // These are QA captures, not extra README illustrations.
  await page.setViewportSize({width:390,height:844});
  await page.goto(pathToFileURL(path.join(root,'dist','extension','compare.html')).href);await ready();
  await page.screenshot({path:path.join(root,'artifacts','studio-narrow.png'),fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  if(errors.length)throw new Error(errors.join('\n'));
  console.log('Generated workspace images and three verified extension cases in docs/assets.');
}finally{await browser.close();}

async function captureCases(browser){
  const evidence=path.join(root,'artifacts','doc-captures');await mkdir(evidence,{recursive:true});
  const fixture=await readFile(path.join(assets,'reading-example.html'));
  const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fixture);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url=`http://127.0.0.1:${server.address().port}/notice`;
  const dist=path.join(root,'dist','extension');
  let extension;
  try{
    extension=await chromium.launchPersistentContext(await mkdtemp(path.join(tmpdir(),'reading-cues-docs-')),{headless:true,channel:'chromium',colorScheme:'light',viewport:{width:680,height:800},
      ...(process.env.READING_CUES_BROWSER_EXECUTABLE?{executablePath:process.env.READING_CUES_BROWSER_EXECUTABLE}:{}),
      args:['--disable-extensions-except='+dist,'--load-extension='+dist]});
    const worker=extension.serviceWorkers()[0]||await extension.waitForEvent('serviceworker');
    const id=new URL(worker.url()).hostname;
    const site=await extension.newPage();await site.goto(url);
    const tabId=await worker.evaluate(async url=>(await chrome.tabs.query({url}))[0].id,url);
    const options=await extension.newPage();await options.setViewportSize({width:1100,height:1000});
    await options.goto(`chrome-extension://${id}/options.html`);await options.waitForSelector('#personal-count');
    const send=async patch=>{
      const result=await options.evaluate(patch=>chrome.runtime.sendMessage({type:'settings',patch}),patch);
      assert.equal(result.ok,true);
      await worker.evaluate(id=>chrome.tabs.sendMessage(id,{type:'refresh'},{frameId:0}),tabId);
    };
    async function waitStatus(test){
      const until=Date.now()+10000;
      while(Date.now()<until){
        let result;try{result=await worker.evaluate(id=>chrome.tabs.sendMessage(id,{type:'status'},{frameId:0}),tabId);}catch{}
        if(result&&!result.busy&&test(result))return result;
        await new Promise(resolve=>setTimeout(resolve,50));
      }
      throw new Error('Document capture timed out waiting for real extension output.');
    }
    const layout=()=>site.locator('article').evaluate(el=>({html:el.innerHTML,height:el.getBoundingClientRect().height}));
    const original=await layout();const automatic=await waitStatus(s=>s.groups>0);
    const save=async(name,locator=site.locator('main'))=>{
      await site.bringToFront();await site.mouse.move(0,0);
      return locator.screenshot({path:path.join(evidence,name+'.png'),animations:'disabled'});
    };
    const after=await save('automatic');
    await send({enabled:false});await waitStatus(s=>s.groups===0);
    const before=await save('original');assert.deepEqual(await layout(),original);
    const compose=async(name,shots,copy)=>{
      const canvas=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1,colorScheme:'light'});
      await canvas.goto(pathToFileURL(path.join(assets,'cover.html')).href);
      await canvas.evaluate(async({shots,copy})=>{
        for(const [id,text]of Object.entries(copy))document.getElementById(id).textContent=text;
        for(const [index,side]of ['left','right'].entries()){
          const img=document.getElementById(side+'-shot');img.src='data:image/png;base64,'+shots[index];await img.decode();
        }
        await document.fonts.ready;
      },{shots:shots.map(buffer=>buffer.toString('base64')),copy});
      await canvas.locator('.page').screenshot({path:path.join(assets,name+'.png')});await canvas.close();
    };
    await compose('cover',[before,after],{});

    // Exercise the actual settings form and saved dictionary, not a painted mockup.
    await send({enabled:true,mode:'personal'});await waitStatus(s=>s.groups===0);
    await options.reload();await options.waitForSelector('#personal-count');
    assert.equal(await options.locator('#reading-mode').inputValue(),'personal');
    await options.locator('#personal-term').fill('截止时间');
    const form=await options.locator('.card').first().screenshot();
    await options.locator('#personal-form button').click();
    await options.waitForFunction(()=>document.getElementById('personal-list').textContent.includes('截止时间'));
    await waitStatus(s=>s.groups===2);
    const ranges=await worker.evaluate(async id=>{
      const [result]=await chrome.scripting.executeScript({target:{tabId:id},func:()=>[...CSS.highlights].flatMap(([name,h])=>name.startsWith('reading-cues')?[...h].map(r=>r.toString()):[])});
      return result.result;
    },tabId);
    assert.deepEqual(ranges,['截止时间','截止时间']);assert.deepEqual(await layout(),original);
    const personal=await save('personal');
    await compose('case-personal',[form,personal],{
      eyebrow:'02 / 个人词库',title:'只提示自己常漏看的词。',description:'先选择“只提示个人词库”，再添加“截止时间”。通知中两次出现这个词，都按原样标出。',
      'left-label':'在设置中输入，再点“添加”','right-label':'回到同一份通知',note:'实际操作 · 词库保存在这台设备的浏览器里'
    });

    const aidShot=async mode=>{
      await send({mode:'chunks',aidMode:mode});await waitStatus(s=>s.groups>2);
      await site.bringToFront();await site.locator('#cancellation').hover();
      await site.waitForFunction(mode=>{const root=document.querySelector('[data-reading-cues-aids]');return root?.dataset.mode===mode&&getComputedStyle(root).visibility==='visible';},mode);
      return site.locator('main').screenshot({path:path.join(evidence,mode+'.png'),animations:'disabled'});
    };
    const ruler=await aidShot('ruler'),focus=await aidShot('focus');
    assert.deepEqual(await layout(),original);
    await compose('case-aids',[ruler,focus],{
      eyebrow:'03 / 按需开启的阅读辅助',title:'用横条定位一行，或突出一段。',description:'阅读尺跟随鼠标。段落聚焦让当前段落外的区域变暗。两种功能默认关闭，一次选择一种。',
      'left-label':'阅读尺','right-label':'段落聚焦',note:'同一份通知 · 同一鼠标位置 · 不改变正文'
    });
    const errors=[];options.on('pageerror',error=>errors.push(error.message));
    await options.emulateMedia({colorScheme:'dark'});await options.reload();await options.waitForSelector('#personal-count');
    await options.screenshot({path:path.join(evidence,'settings-dark.png'),fullPage:true});
    await options.setViewportSize({width:390,height:844});await options.emulateMedia({colorScheme:'light'});
    await options.screenshot({path:path.join(evidence,'settings-narrow.png'),fullPage:true});
    assert.equal(await options.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
    await writeFile(path.join(evidence,'verification.json'),JSON.stringify({automaticGroups:automatic.groups,personalRanges:ranges,unchangedTextAndLayout:true,visualAids:['ruler','focus'],narrowOverflow:false},null,2));
  }finally{
    await extension?.close();await new Promise(resolve=>server.close(resolve));
  }
}
