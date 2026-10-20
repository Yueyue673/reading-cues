import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile, mkdir, mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const require = createRequire(import.meta.url);
const {chromium} = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root,'dist','extension'), artifacts = path.join(root,'artifacts');
await mkdir(artifacts,{recursive:true});
const fixture = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>兼容性测试</title><style>body{font:18px/2 system-ui;background:#fff;color:#222}article{max-width:700px;margin:30px auto}.dark{background:#17231f;color:#eee}.hidden{display:none}</style><body><article>
<p id="cross">这<span>不一</span><span>定</span>更快，但保留文字和布局很重要。</p>
<p id="pair">只有先看完原文，才可以理解其中的条件和限制。</p>
<p id="safe">不但支持中文，还支持英文。差点没赶上车。自然而然形成。</p>
<p id="strong">作者<strong>不一定</strong>希望我们重复强调这里。</p>
<p id="link">只有<a href="#">一个链接</a>才会打开。</p>
<p id="dark" class="dark">这个结果并非所有人都认可，请结合上下文判断。</p>
<p id="hidden" hidden>不一定应该被看见。</p>
<p id="dynamic">这一段之后会变成可编辑内容，不一定需要提示。</p>
<div contenteditable="true" id="editor">不一定，这是编辑器里的内容。</div>
<nav><p>不一定，这是导航。</p></nav><pre>不一定，这是代码。</pre>
<button>不一定</button><div aria-live="polite">不一定，这是动态通知。</div>
</article></body></html>`;
const server = createServer(async(req,res)=>{
  if(req.url.startsWith('/framed')){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fixture.replace('</article>','<iframe id="embedded" src="http://localhost:'+server.address().port+'/fixture"></iframe></article>'));return;}
  if(req.url.startsWith('/fixture')){res.setHeader('Content-Type','text/html; charset=utf-8');if(req.url.startsWith('/fixture-csp'))res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'none'; script-src 'none'");res.end(fixture);return;}
  try{
    const file = path.resolve(dist,'.'+new URL(req.url,'http://localhost').pathname);
    if(!file.startsWith(dist+path.sep)){res.writeHead(403);res.end();return;}
    const data=await readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':file.endsWith('.png')?'image/png':'text/html; charset=utf-8');res.end(data);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const results=[]; let browser, extension, browserVersion;
async function check(name,fn){const start=Date.now();await fn();results.push({name,passed:true,milliseconds:Date.now()-start});console.log('PASS '+name);}
const launchOptions = {headless:true,...(process.env.READING_CUES_BROWSER_EXECUTABLE?{executablePath:process.env.READING_CUES_BROWSER_EXECUTABLE}:{})};
const highlighted = page => page.evaluate(()=>[...CSS.highlights].flatMap(([name,h])=>[...h].map(r=>({name,text:r.toString(),id:r.startContainer.parentElement.closest('[id]')?.id}))));
async function installRenderer(page,settings={}){
  for(const name of ['core.js','lexicon.js','renderer.js'])await page.addScriptTag({path:path.join(dist,name)});
  await page.evaluate(async config=>{globalThis.renderer=ReadingCuesRenderer.create({settings:config});await renderer.scan();},settings);
}
const steady=page=>page.waitForFunction(()=>globalThis.renderer&&!renderer.getSnapshot().busy);
try{
  browser=await chromium.launch(launchOptions);browserVersion=browser.version();
  const context=await browser.newContext({viewport:{width:1360,height:1000},colorScheme:'light'});
  const page=await context.newPage(), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/fixture');
  const original=await page.locator('article').evaluate(el=>({html:el.innerHTML,text:el.textContent,height:el.getBoundingClientRect().height}));
  const originalSelection=await page.locator('article').evaluate(el=>{const r=document.createRange();r.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(r);const text=s.toString();s.removeAllRanges();return text;});
  await installRenderer(page);
  await check('cross-inline matching, complete pair, exclusions and dark bucket',async()=>{
    const marks=await highlighted(page);
    assert.equal(marks.find(x=>x.id==='cross')?.text,'不一定');
    assert.deepEqual(marks.filter(x=>x.id==='pair').map(x=>x.text),['只有','才']);
    assert.equal(marks.find(x=>x.id==='dark')?.name,'reading-cues-dark');
    assert.deepEqual(marks.filter(x=>x.id==='safe').map(x=>x.text),['不但']);
    for(const id of ['strong','link','hidden','editor'])assert.equal(marks.filter(x=>x.id===id).length,0,id);
  });
  await check('text, element identity, HTML, selection and layout are preserved',async()=>{
    const actual=await page.locator('article').evaluate(el=>({html:el.innerHTML,text:el.textContent,height:el.getBoundingClientRect().height}));assert.deepEqual(actual,original);
    assert.equal(await page.locator('article').evaluate(el=>{const r=document.createRange();r.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(r);return s.toString();}),originalSelection);
    await page.evaluate(()=>getSelection().removeAllRanges());
  });
  await check('dynamic append, removal, editable and hidden transitions clean old ranges',async()=>{
    await page.evaluate(()=>{const p=document.createElement('p');p.id='added';p.textContent='这不一定有用，仍然需要在日常阅读里观察。';document.querySelector('article').append(p);});
    await page.waitForFunction(()=>[...CSS.highlights.values()].some(h=>[...h].some(r=>r.startContainer.parentElement.id==='added')));
    await page.evaluate(()=>{document.getElementById('dynamic').contentEditable='true';document.getElementById('cross').hidden=true;document.getElementById('added').remove();});
    await page.waitForTimeout(300);await steady(page);
    const marks=await highlighted(page);for(const id of ['dynamic','cross','added'])assert.equal(marks.filter(x=>x.id===id).length,0,id);
  });
  await check('style switch, global pause, resume and destroy are reversible',async()=>{
    await page.evaluate(()=>renderer.setSettings({style:'underline'}));assert.ok((await highlighted(page)).every(x=>x.name==='reading-cues-line'));
    await page.evaluate(()=>renderer.setSettings({enabled:false}));assert.equal((await highlighted(page)).length,0);
    await page.evaluate(()=>renderer.setSettings({enabled:true}));assert.ok((await highlighted(page)).length>0);
    await page.evaluate(()=>renderer.destroy());assert.equal((await highlighted(page)).length,0);assert.equal(await page.locator('[data-reading-cues-style]').count(),0);
  });
  await check('unsupported browser fails quietly without changing page text',async()=>{
    await page.goto(base+'/fixture');await page.evaluate(()=>Object.defineProperty(globalThis,'Highlight',{value:undefined,configurable:true}));await installRenderer(page);assert.equal(await page.evaluate(()=>renderer.getSnapshot().supported),false);
    assert.equal(await page.locator('article').textContent(),original.text);
  });
  await check('long article yields between batches and respects resource limits',async()=>{
    await page.goto(base+'/fixture');await page.evaluate(()=>document.querySelector('article').replaceChildren(...Array.from({length:2400},()=>{const p=document.createElement('p');p.textContent='这是一个长文章中的普通段落，不一定能更快读完，但应当保留原文并允许随时暂停。';return p;})));
    await installRenderer(page);const snapshot=await page.evaluate(()=>renderer.getSnapshot());assert.ok(snapshot.limited);assert.ok(snapshot.groups<=2000);assert.ok(snapshot.milliseconds<5000);results.push({name:'long-article-measurement',...snapshot});
  });
  await check('demo light/dark/mobile, personal words, original and safe pasted text',async()=>{
    await page.goto(base+'/demo.html');await page.waitForFunction(()=>globalThis.readingCuesDemo&&!readingCuesDemo.getSnapshot().busy);
    assert.ok(await page.evaluate(()=>readingCuesDemo.getSnapshot().groups)>0);
    assert.ok((await highlighted(page)).length>0,'completed initial scan must actually paint');
    await page.screenshot({path:path.join(artifacts,'demo-light.png'),fullPage:true,caret:'initial'});
    await page.locator('[name=demo-style][value=original]').check();assert.equal((await highlighted(page)).length,0);
    await page.locator('[name=demo-style][value=underline]').check();await page.waitForFunction(()=>[...CSS.highlights.values()].some(h=>h.size));
    await page.locator('summary').click();await page.locator('#demo-term').fill('阅读环境');await page.locator('#demo-personal-form button').click();
    await page.waitForFunction(()=>[...CSS.highlights.values()].some(h=>[...h].some(r=>r.toString()==='阅读环境')));
    await page.locator('#custom-text').fill('<img src=x onerror=alert(1)> 这不一定需要额外解释。');await page.locator('#use-custom').click();assert.equal(await page.locator('#reading-article img').count(),0);assert.ok((await page.locator('#reading-article').textContent()).includes('<img'));
    await page.locator('#restore-sample').click();await page.emulateMedia({colorScheme:'dark'});await page.locator('[name=demo-style][value=background]').check();await page.waitForFunction(()=>!readingCuesDemo.getSnapshot().busy);await page.screenshot({path:path.join(artifacts,'demo-dark.png'),fullPage:true,caret:'initial'});
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(artifacts,'demo-mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors,[]);
  });
  await browser.close();browser=null;

  // Load the distributed manifest with its actual global static content scripts.
  const profile=await mkdtemp(path.join(tmpdir(),'reading-cues-test-'));
  extension=await chromium.launchPersistentContext(profile,{...launchOptions,channel:'chromium',viewport:{width:1100,height:900},args:['--disable-extensions-except='+dist,'--load-extension='+dist]});
  const worker=extension.serviceWorkers()[0]||await extension.waitForEvent('serviceworker');
  const id=new URL(worker.url()).hostname;
  const site=await extension.newPage();await site.goto(base+'/fixture');
  const other=await extension.newPage();await other.goto(base.replace('127.0.0.1','localhost')+'/fixture');
  const tabIdFor=page=>worker.evaluate(async url=>(await chrome.tabs.query({url}))[0].id,page.url());
  const siteTabId=await tabIdFor(site), otherTabId=await tabIdFor(other);
  const status=(tabId=siteTabId)=>worker.evaluate(id=>chrome.tabs.sendMessage(id,{type:'status'},{frameId:0}),tabId);
  async function waitStatus(predicate,tabId=siteTabId){
    const until=Date.now()+7000;
    while(Date.now()<until){let value;try{value=await status(tabId);}catch{}if(value&&predicate(value))return value;await new Promise(r=>setTimeout(r,40));}
    throw new Error('Timed out waiting for content status');
  }
  await check('fresh installation automatically marks two new origins without opening any extension UI',async()=>{
    await waitStatus(s=>s.groups>0&&!s.busy);await waitStatus(s=>s.groups>0&&!s.busy,otherTabId);
    const data=await worker.evaluate(()=>chrome.storage.local.get(['settings','excludedSites']));
    assert.equal(data.settings.enabled,true);assert.equal(data.settings.maxGroups,0);assert.deepEqual(data.excludedSites,[]);
    assert.deepEqual((await worker.evaluate(()=>chrome.permissions.getAll())).origins.sort(),['http://*/*','https://*/*']);
    assert.equal(await site.locator('article').innerHTML(),original.html);
    await site.screenshot({path:path.join(artifacts,'extension-fixture.png'),fullPage:true,caret:'initial'});
  });
  const options=await extension.newPage();await options.goto('chrome-extension://'+id+'/options.html');await options.waitForSelector('#personal-count');
  const send=message=>options.evaluate(msg=>chrome.runtime.sendMessage(msg),message);
  await check('personal library, import validation and automatic density UI',async()=>{
    assert.equal(await options.locator('#density').inputValue(),'0');assert.equal(await options.locator('[name=category]:checked').count(),9);
    await options.locator('#personal-term').fill('工作记忆');await options.locator('#personal-form button').click();await options.waitForFunction(()=>document.getElementById('personal-list').textContent.includes('工作记忆'));
    await options.locator('#ignored-term').fill('然而');await options.locator('#ignored-form button').click();await options.waitForFunction(()=>document.getElementById('ignored-list').textContent.includes('然而'));
    await options.locator('#personal-term').fill('不');await options.locator('#personal-form button').click();await options.waitForFunction(()=>document.getElementById('message').classList.contains('error'));
    assert.equal((await send({type:'import',text:JSON.stringify({schemaVersion:1,personal:['认知负荷'],ignored:[]})})).ok,true);
    assert.equal((await send({type:'import',text:'<bad>'})).ok,false);
    await options.locator('#personal-term').fill('');await options.screenshot({path:path.join(artifacts,'options.png'),fullPage:true,caret:'initial'});
  });
  await check('strict page CSP allows automatic cues and reload needs no activation',async()=>{
    await site.goto(base+'/fixture-csp');await waitStatus(s=>s.groups>0&&!s.busy);
    assert.equal(await site.locator('[data-reading-cues-style]').count(),0);
    assert.ok((await site.locator('#cross').evaluate(el=>getComputedStyle(el,'::highlight(reading-cues-light)').backgroundColor)).includes('0.17'));
    await site.reload();await waitStatus(s=>s.groups>0&&!s.busy);
    await site.goto(base+'/fixture');await waitStatus(s=>s.groups>0&&!s.busy);
  });
  await check('per-site pause persists across navigation while other origins stay automatic',async()=>{
    await send({type:'site',url:base+'/fixture',enabled:false});await waitStatus(s=>s.groups===0&&!s.busy);
    await waitStatus(s=>s.groups>0&&!s.busy,otherTabId);
    await site.reload();await waitStatus(s=>s.groups===0&&!s.busy);
    await send({type:'site',url:base+'/fixture',enabled:true});await waitStatus(s=>s.groups>0&&!s.busy);
    assert.equal((await worker.evaluate(()=>chrome.scripting.getRegisteredContentScripts())).length,0);
  });
  await check('global pause clears every open page and resume restores automatically',async()=>{
    await send({type:'settings',patch:{enabled:false}});await waitStatus(s=>s.groups===0&&!s.busy);await waitStatus(s=>s.groups===0&&!s.busy,otherTabId);
    await send({type:'settings',patch:{enabled:true,style:'underline'}});await waitStatus(s=>s.groups>0&&!s.busy);await waitStatus(s=>s.groups>0&&!s.busy,otherTabId);
    await site.goto(base+'/fixture');await waitStatus(s=>s.groups>0&&!s.busy);
    assert.ok((await site.locator('#cross').evaluate(el=>getComputedStyle(el,'::highlight(reading-cues-line)').textDecorationLine)).includes('underline'));
  });
  await check('cross-origin HTTP iframe is automatic and inherits the top-site pause',async()=>{
    await site.goto(base+'/framed');
    const frames=()=>worker.evaluate(tabId=>chrome.scripting.executeScript({target:{tabId,allFrames:true},func:()=>globalThis.__readingCuesGetStatus?.()}),siteTabId);
    const waitFrames=async predicate=>{for(let i=0;i<100;i++){const data=(await frames()).map(x=>x.result).filter(Boolean);if(predicate(data))return data;await new Promise(r=>setTimeout(r,40));}throw new Error('Timed out waiting for frame status');};
    await waitFrames(data=>data.length===2&&data.every(x=>x.groups>0&&!x.busy));
    await send({type:'site',url:base+'/framed',enabled:false});await waitFrames(data=>data.length===2&&data.every(x=>x.groups===0&&!x.busy));
    await waitStatus(s=>s.groups>0&&!s.busy,otherTabId);
    await send({type:'site',url:base+'/framed',enabled:true});await waitFrames(data=>data.length===2&&data.every(x=>x.groups>0&&!x.busy));
    await site.goto(base+'/fixture');await waitStatus(s=>s.groups>0&&!s.busy);
  });
  await check('popup defaults to automatic mode and only pauses or resumes',async()=>{
    await site.bringToFront();
    const created=extension.waitForEvent('page');await options.evaluate(()=>chrome.tabs.create({url:chrome.runtime.getURL('popup.html'),active:false}));const popup=await created;
    await popup.waitForFunction(()=>document.getElementById('site-name').textContent==='127.0.0.1');
    assert.equal(await popup.locator('#site-label').textContent(),'全局自动运行中');assert.equal(await popup.locator('#site-toggle').textContent(),'仅暂停这个网站');
    await popup.locator('#site-toggle').click();await waitStatus(s=>s.groups===0&&!s.busy);
    await popup.waitForFunction(()=>document.getElementById('site-toggle').textContent==='恢复这个网站的自动提示');await popup.locator('#site-toggle').click();await waitStatus(s=>s.groups>0&&!s.busy);
    await popup.setViewportSize({width:368,height:850});await popup.screenshot({path:path.join(artifacts,'popup.png'),fullPage:true,caret:'initial'});
    assert.equal(await popup.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await popup.bringToFront();await popup.reload();await popup.waitForFunction(()=>document.getElementById('site-toggle').disabled);
    assert.ok((await popup.locator('#site-name').textContent()).includes('无需'));await popup.close();
  });
  await check('dynamic additions preserve existing cues and do not insert page controls',async()=>{
    const before=await status();await site.evaluate(()=>{const p=document.createElement('p');p.id='streamed';p.textContent='由于材料已经齐全，因此可以在2026年10月20日提交。';document.querySelector('article').append(p);});
    const immediate=await worker.evaluate(tabId=>chrome.scripting.executeScript({target:{tabId},func:()=>[...CSS.highlights.values()].reduce((n,h)=>n+h.size,0)}),siteTabId);
    assert.ok(immediate[0].result>0,'adding text must not flash away all existing cues');await waitStatus(s=>!s.busy&&s.groups>before.groups);
    assert.equal(await site.locator('article button,article [data-reading-cues-control],article mark').count(),1); // The fixture already contains one original button.
  });
}catch(error){results.push({name:'failure',error:error.stack});throw error;}
finally{if(browser)await browser.close();if(extension)await extension.close();await new Promise(r=>server.close(r));await writeFile(path.join(artifacts,'browser-results.json'),JSON.stringify({testedAt:new Date().toISOString(),browserVersion,results},null,2));}
console.log(`Browser validation complete: ${results.filter(x=>x.passed).length} checks`);
