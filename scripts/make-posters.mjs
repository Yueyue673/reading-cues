/* Reproducible poster layout using verified screenshots from the actual extension. */
import './build.mjs';
import {createRequire} from 'node:module';
import {readFile,mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(import.meta.url),{chromium}=require('playwright');
const posterRequire=createRequire(path.join(root,'artifacts','poster-tools','package.json'));
const QRCode=posterRequire('qrcode'),jsQR=posterRequire('jsqr'),{PNG}=posterRequire('pngjs');
const out=path.join(root,'docs','posters'),screens=path.join(out,'screens'),qa=path.join(root,'artifacts','poster-qa');
for(const folder of [out,screens,qa,path.join(out,'previews')])await mkdir(folder,{recursive:true});
const download='https://github.com/Yueyue673/reading-cues/releases/latest';
const launch={headless:true,...(process.env.READING_CUES_BROWSER_EXECUTABLE?{executablePath:process.env.READING_CUES_BROWSER_EXECUTABLE}:{})};
const report={release:'v0.6.1',sourceCommit:'5b68e811e8a79cc1bf9a03ee7e099ea40d7aef45',download,posters:[]};
if(!process.argv.includes('--layout-only'))await capture();
else {
  try{report.capture={...(JSON.parse(await readFile(path.join(qa,'capture-verification.json'),'utf8'))),reusedScreens:true};}
  catch{report.capture={reusedScreens:true};}
}
await QRCode.toFile(path.join(screens,'download-qr.png'),download,{errorCorrectionLevel:'M',margin:4,scale:10,color:{dark:'#244536',light:'#ffffff'}});
await verifyQR(path.join(screens,'download-qr.png'));
const browser=await chromium.launch(launch);
try{
  const page=await browser.newPage({viewport:{width:1080,height:1350},deviceScaleFactor:2,colorScheme:'light'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.join(out,'posters.html')).href);
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode()));});
  for(const [i,name]of ['01-phrase','02-focus','03-personal','04-install'].entries()){
    const poster=page.locator('#poster-'+(i+1));
    const metric=await poster.evaluate(el=>{
      const box=el.getBoundingClientRect(),footer=el.querySelector('footer').getBoundingClientRect();
      const content=[...el.children].filter(node=>node.tagName!=='FOOTER').map(node=>node.getBoundingClientRect().bottom-box.y);
      return {width:box.width,height:box.height,contentBottom:Math.max(...content),footerTop:footer.top-box.y,text:el.innerText};
    });
    await poster.screenshot({path:path.join(out,name+'.png'),animations:'disabled'});
    console.log(name+': '+JSON.stringify({...metric,text:undefined}));
    assert.equal(metric.width,1080);assert.equal(metric.height,1350);
    assert.ok(metric.contentBottom<=metric.footerTop-18,`${name}: content overlaps footer`);
    assert.ok(metric.text.includes('轻读')&&metric.text.includes('github.com/Yueyue673/reading-cues'));
    assert.ok(!metric.text.includes('\ufffd'));
    const meta=PNG.sync.read(await readFile(path.join(out,name+'.png')));
    assert.equal(meta.width,2160);assert.equal(meta.height,2700);
    report.posters.push({file:name+'.png',width:meta.width,height:meta.height,contentBottom:metric.contentBottom,footerTop:metric.footerTop});
    for(const width of [360,540]){
      const phone=await browser.newPage({viewport:{width,height:width*1.25},deviceScaleFactor:1});
      await phone.goto(pathToFileURL(path.join(out,'posters.html')).href);
      await phone.evaluate(async({id,width})=>{
        document.querySelectorAll('.poster').forEach(el=>el.style.display=el.id===id?'block':'none');
        const el=document.getElementById(id);el.style.transform=`scale(${width/1080})`;el.style.transformOrigin='top left';el.style.position='absolute';el.style.top='0';
        document.body.style.width=width+'px';document.body.style.height=width*1.25+'px';document.body.style.overflow='hidden';
        await document.fonts.ready;await Promise.all([...el.querySelectorAll('img')].map(img=>img.decode()));
      },{id:'poster-'+(i+1),width});
      await phone.screenshot(width===360?{path:path.join(qa,name+'-phone.png')}:{path:path.join(out,'previews',name+'.jpg'),type:'jpeg',quality:94});
      await phone.close();
    }
  }
  await verifyQR(path.join(out,'04-install.png'));
  const hero=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1,colorScheme:'light'});
  await hero.goto(pathToFileURL(path.join(root,'docs','artwork','hero.html')).href);
  await hero.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(img=>img.decode()));});
  await hero.screenshot({path:path.join(root,'docs','assets','hero-zh.jpg'),type:'jpeg',quality:94});
  await hero.evaluate(()=>{
    document.documentElement.lang='en';document.body.classList.add('en');
    document.getElementById('title').innerHTML='See phrases,<br>on the page.';
    document.getElementById('description').innerHTML='A reading aid for Chinese web pages.<br>Adjust the marks. Keep your text local.';
    document.getElementById('note').textContent='Concept illustration · See actual output in the examples';
  });
  await hero.screenshot({path:path.join(root,'docs','assets','hero-en.jpg'),type:'jpeg',quality:94});await hero.close();
  assert.deepEqual(errors,[]);
  await writeFile(path.join(qa,'verification.json'),JSON.stringify(report,null,2));
  console.log('Generated four separate 2160 × 2700 posters and two 1600 × 900 README covers; full-poster QR verified.');
}finally{await browser.close();}

async function verifyQR(file){
  const {data,width,height}=PNG.sync.read(await readFile(file));
  const result=jsQR(new Uint8ClampedArray(data),width,height);
  assert.equal(result?.data,download,'QR failed round-trip verification: '+file);
}

async function capture(){
  const fixture=await readFile(path.join(out,'example.html'));
  const phrase=await readFile(path.join(out,'phrase-example.html'));
  const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/phrase'?phrase:fixture);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let context;
  try{
    const dist=path.join(root,'dist','extension');
    context=await chromium.launchPersistentContext(await mkdtemp(path.join(tmpdir(),'reading-cues-posters-')),{...launch,channel:'chromium',viewport:{width:800,height:1000},deviceScaleFactor:2,colorScheme:'light',args:['--disable-extensions-except='+dist,'--load-extension='+dist]});
    const errors=[];context.on('page',page=>page.on('pageerror',e=>errors.push(e.message)));
    const worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker'),id=new URL(worker.url()).hostname;
    const base=`http://127.0.0.1:${server.address().port}`;
    const site=await context.newPage();await site.goto(base+'/phrase');
    const tabId=await worker.evaluate(async url=>(await chrome.tabs.query({url}))[0].id,site.url());
    const options=await context.newPage();await options.setViewportSize({width:390,height:844});
    await options.goto(`chrome-extension://${id}/options.html`);await options.waitForSelector('#personal-count');
    const config=async patch=>{
      const result=await options.evaluate(patch=>chrome.runtime.sendMessage({type:'settings',patch}),patch);assert.equal(result.ok,true);
      await worker.evaluate(id=>chrome.tabs.sendMessage(id,{type:'refresh'},{frameId:0}),tabId);
    };
    const wait=async test=>{
      const until=Date.now()+10000;
      while(Date.now()<until){let status;try{status=await worker.evaluate(id=>chrome.tabs.sendMessage(id,{type:'status'},{frameId:0}),tabId);}catch{}
        if(status&&!status.busy&&test(status))return status;await new Promise(resolve=>setTimeout(resolve,50));}
      throw new Error('Timed out waiting for extension');
    };
    const layout=()=>site.locator('article').evaluate(el=>({html:el.innerHTML,height:el.getBoundingClientRect().height,font:getComputedStyle(el).fontSize}));
    await site.bringToFront();await wait(s=>s.groups>0);const original=await layout();
    await site.locator('#lead').screenshot({path:path.join(screens,'automatic.png')});
    await config({enabled:false});await wait(s=>s.groups===0);
    await site.locator('#lead').screenshot({path:path.join(screens,'original.png')});assert.deepEqual(await layout(),original);
    await site.goto(base+'/example');const notice=await layout();
    await config({enabled:true,aidMode:'focus'});await wait(s=>s.groups>0);
    await site.bringToFront();await site.locator('#focus').hover();
    await site.waitForFunction(()=>getComputedStyle(document.querySelector('[data-reading-cues-aids]')).visibility==='visible');
    await site.locator('main').screenshot({path:path.join(screens,'focus.png')});assert.deepEqual(await layout(),notice);
    await config({mode:'personal',aidMode:'off'});await wait(s=>s.groups===0);
    await options.bringToFront();await options.reload();await options.waitForSelector('#personal-count');
    assert.equal(await options.locator('#reading-mode').inputValue(),'personal');
    await options.locator('#reading-mode').screenshot({path:path.join(screens,'mode.png')});
    await options.locator('#personal-term').fill('截止时间');await options.locator('h1').click();
    await options.locator('#personal-form').screenshot({path:path.join(screens,'form.png')});
    await options.locator('#personal-form button').click();await wait(s=>s.groups===2);
    const ranges=await worker.evaluate(async id=>(await chrome.scripting.executeScript({target:{tabId:id},func:()=>[...CSS.highlights].flatMap(([name,h])=>name.startsWith('reading-cues')?[...h].map(range=>range.toString()):[])}))[0].result,tabId);
    assert.deepEqual(ranges,['截止时间','截止时间']);
    await site.bringToFront();await site.locator('#personal').screenshot({path:path.join(screens,'personal.png')});assert.deepEqual(await layout(),notice);
    assert.deepEqual(errors,[]);
    report.capture={realExtension:true,originalTextAndLayoutPreserved:true,personalRanges:ranges,focusEnabled:true};
    await writeFile(path.join(qa,'capture-verification.json'),JSON.stringify(report.capture,null,2));
    console.log('Captured real automatic marks, paragraph focus and personal-term form/result.');
  }finally{await context?.close();await new Promise(resolve=>server.close(resolve));}
}
