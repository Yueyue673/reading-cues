import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
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
async function installRenderer(page,settings={mode:'cues',style:'background'}){
  for(const name of ['core.js','pos-data.js','chunker.js','lexicon.js','renderer.js'])await page.addScriptTag({path:path.join(dist,name)});
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
    assert.ok(marks.find(x=>x.id==='dark')?.name.startsWith('reading-cues-dark'));
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
  await check('scroll-driven style changes keep highlights visible and defer scanning until scrolling settles',async()=>{
    await page.goto(base+'/fixture');await installRenderer(page,{});await page.waitForTimeout(300);
    const probe=await page.evaluate(async()=>{
      const before=renderer.getSnapshot().scans,highlights=[...CSS.highlights.values()],ranges=highlights.flatMap(h=>[...h]);
      let blankFrames=0,maxDuring=before;
      for(let i=0;i<75;i++) {
        document.body.classList.toggle('scrolling-state',i%2===0);
        document.querySelector('article').style.transform=`translateY(${i%2}px)`;
        window.dispatchEvent(new Event('scroll'));
        await new Promise(requestAnimationFrame);
        if(![...CSS.highlights.values()].some(h=>h.size))blankFrames++;
        maxDuring=Math.max(maxDuring,renderer.getSnapshot().scans);
      }
      globalThis.scrollOldHighlights=highlights;globalThis.scrollOldRanges=ranges;
      return {before,maxDuring,blankFrames};
    });
    assert.equal(probe.blankFrames,0);assert.equal(probe.maxDuring,probe.before);
    results.push({name:'scroll-measurement',...probe});
    await page.waitForFunction(n=>renderer.getSnapshot().scans>n&&!renderer.getSnapshot().busy,probe.before);
    assert.equal(await page.evaluate(()=>scrollOldHighlights.every(h=>[...CSS.highlights.values()].includes(h))),true);
    assert.equal(await page.evaluate(()=>scrollOldRanges.every(r=>[...CSS.highlights.values()].some(h=>h.has(r)))),true);
  });
  await check('small appends scan only new paragraphs and text edits leave no stale ranges',async()=>{
    await page.goto(base+'/fixture');await page.evaluate(()=>document.querySelector('article').replaceChildren(...Array.from({length:180},(_,i)=>{const p=document.createElement('p');p.id='p'+i;p.textContent='公园里的树木沿着河岸生长，游客慢慢走过石桥。';return p;})));
    await installRenderer(page,{});
    const before=await page.evaluate(()=>{globalThis.oldParagraphRanges=[...CSS.highlights.values()].flatMap(h=>[...h]);return renderer.getSnapshot().scans;});
    await page.evaluate(()=>{const p=document.createElement('p');p.id='appended';p.textContent='今天准备乘坐火车去海边看日出。';document.querySelector('article').append(p);});
    await page.waitForFunction(n=>renderer.getSnapshot().scans>n&&!renderer.getSnapshot().busy,before);
    assert.ok(await page.evaluate(()=>renderer.getSnapshot().scannedCharacters)<100);
    assert.equal(await page.evaluate(()=>oldParagraphRanges.every(r=>[...CSS.highlights.values()].some(h=>h.has(r)))),true);
    await page.evaluate(()=>document.getElementById('appended').firstChild.replaceData(0,2,'明天清晨'));
    await page.waitForTimeout(350);await steady(page);
    const actual=await page.evaluate(()=>{
      const text=document.getElementById('appended').textContent;
      return {expected:ReadingCues.createReader(ReadingCuesLexicon).match(text).flatMap(g=>g.spans.map(s=>text.slice(s.start,s.end))),actual:[...CSS.highlights.values()].flatMap(h=>[...h]).filter(r=>r.startContainer.parentElement.id==='appended').map(r=>r.toString())};
    });
    assert.deepEqual(actual.actual.sort(),actual.expected.sort());
    await page.evaluate(()=>renderer.destroy());
  });
  await check('real video playback, pointer movement and animated controls never blank or repaint unchanged article ranges',async()=>{
    await page.goto(base+'/fixture');
    await page.evaluate(()=>{
      const panel=document.createElement('div');panel.id='media-panel';panel.innerHTML='<video muted playsinline width="160" height="90"></video><span role="timer">00:00</span><div role="progressbar" aria-label="播放进度"></div><div role="tooltip">播放提示</div>';
      document.body.append(panel);
    });
    await installRenderer(page,{});await page.waitForTimeout(600);
    await page.evaluate(async()=>{
      const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;const ctx=canvas.getContext('2d');
      const video=document.querySelector('video');video.srcObject=canvas.captureStream(30);
      let frame=0;globalThis.videoFrames=0;
      const count=()=>{videoFrames++;video.requestVideoFrameCallback(count);};video.requestVideoFrameCallback(count);
      globalThis.animateMedia=setInterval(()=>{
        ctx.fillStyle=frame++%2?'#f38':'#38f';ctx.fillRect(0,0,160,90);
        document.querySelector('[role=timer]').textContent='00:'+String(frame);
        document.querySelector('[role=progressbar]').style.width=frame%100+'px';
        document.querySelector('[role=tooltip]').classList.toggle('active',frame%2===0);
      },30);
      globalThis.mouseListener=()=>document.body.classList.toggle('mouse-active');document.addEventListener('pointermove',mouseListener);
      globalThis.baselineHighlights=[...CSS.highlights.values()];globalThis.baselineRanges=baselineHighlights.flatMap(h=>[...h]);
      globalThis.mediaStartScans=renderer.getSnapshot().scans;globalThis.blankMediaFrames=0;
      globalThis.watchMarks=setInterval(()=>{if(![...CSS.highlights.values()].some(h=>h.size))blankMediaFrames++;},5);
      await video.play();
    });
    const hashes=[];
    for(let i=0;i<10;i++){
      await page.mouse.move(50+i*12,40+i*8);await page.waitForTimeout(40);
      if(i%3===0)hashes.push(createHash('sha256').update(await page.locator('article').screenshot()).digest('hex'));
    }
    const measure=await page.evaluate(()=>({frames:videoFrames,blank:blankMediaFrames,scans:renderer.getSnapshot().scans,before:mediaStartScans}));
    assert.ok(measure.frames>=3,'must exercise decoded video frames');assert.equal(measure.blank,0);assert.equal(measure.scans,measure.before);
    assert.equal(new Set(hashes).size,1,'article pixels stay identical during playback and pointer movement');
    results.push({name:'video-pointer-measurement',...measure,identicalArticleScreenshots:hashes.length});
    await page.evaluate(()=>{clearInterval(animateMedia);clearInterval(watchMarks);document.removeEventListener('pointermove',mouseListener);document.querySelector('video').pause();document.querySelector('video').srcObject.getTracks().forEach(t=>t.stop());});
    await page.waitForTimeout(650);await steady(page);
    assert.equal(await page.evaluate(()=>baselineRanges.every(r=>[...CSS.highlights.values()].some(h=>h.has(r)))),true);
    assert.equal(await page.evaluate(()=>baselineHighlights.every(h=>[...CSS.highlights.values()].includes(h))),true);
    await page.evaluate(()=>renderer.destroy());
  });
  await check('unsupported browser fails quietly without changing page text',async()=>{
    await page.goto(base+'/fixture');await page.evaluate(()=>Object.defineProperty(globalThis,'Highlight',{value:undefined,configurable:true}));await installRenderer(page);assert.equal(await page.evaluate(()=>renderer.getSnapshot().supported),false);
    assert.equal(await page.locator('article').textContent(),original.text);
  });
  await check('nested open comment trees render, observe replies, exclude editors and clean up without changing comment HTML',async()=>{
    await page.goto(base+'/fixture');
    const originalComment=await page.evaluate(()=>{
      const host=document.createElement('bili-comments');host.id='comments';document.querySelector('article').append(host);
      const outer=host.attachShadow({mode:'open'});outer.innerHTML='<bili-comment-thread-renderer></bili-comment-thread-renderer><bili-comment-box></bili-comment-box>';
      const thread=outer.querySelector('bili-comment-thread-renderer').attachShadow({mode:'open'});thread.innerHTML='<bili-comment-renderer></bili-comment-renderer>';
      const comment=thread.querySelector('bili-comment-renderer').attachShadow({mode:'open'});comment.innerHTML='<bili-rich-text></bili-rich-text>';
      const rich=comment.querySelector('bili-rich-text').attachShadow({mode:'open'});rich.innerHTML='<p id="shadow-main">预约成功后，请在明天上午九点前取书，不需要重新提交申请。</p>';
      const editor=outer.querySelector('bili-comment-box').attachShadow({mode:'open'});editor.innerHTML='<div contenteditable="true">这是评论输入框，不需要重新提交申请。</div>';
      globalThis.commentThread=thread;globalThis.commentRich=rich;globalThis.editorRoot=editor;
      return rich.innerHTML;
    });
    const beforeImage=createHash('sha256').update(await page.locator('bili-comments').screenshot()).digest('hex');
    await installRenderer(page,{});
    const marks=await highlighted(page);assert.ok(marks.some(x=>x.id==='shadow-main'));
    assert.equal(await page.locator('#shadow-main').evaluate(el=>getComputedStyle(el,'::highlight(reading-cues-line)').textDecorationLine),'underline');
    assert.equal(await page.evaluate(()=>commentRich.innerHTML),originalComment);
    assert.equal(await page.evaluate(()=>[...CSS.highlights.values()].flatMap(h=>[...h]).some(r=>r.startContainer.getRootNode()===editorRoot)),false);
    assert.notEqual(createHash('sha256').update(await page.locator('bili-comments').screenshot()).digest('hex'),beforeImage,'shadow highlights must change actual pixels');
    await page.evaluate(()=>{const reply=document.createElement('bili-comment-reply-renderer');commentThread.append(reply);const root=reply.attachShadow({mode:'open'});root.innerHTML='<p id="shadow-reply">连续降雨时，空气会逐渐减少。</p>';globalThis.replyHost=reply;});
    await page.waitForFunction(()=>[...CSS.highlights.values()].some(h=>[...h].some(r=>r.startContainer.parentElement.id==='shadow-reply')));
    await page.evaluate(()=>document.getElementById('comments').hidden=true);await page.waitForTimeout(300);await steady(page);
    assert.equal((await highlighted(page)).some(x=>['shadow-main','shadow-reply'].includes(x.id)),false);
    await page.evaluate(()=>document.getElementById('comments').hidden=false);await page.waitForFunction(()=>[...CSS.highlights.values()].some(h=>[...h].some(r=>r.startContainer.parentElement.id==='shadow-main')));
    await page.evaluate(()=>{document.getElementById('comments').contentEditable='true';});await page.waitForTimeout(300);await steady(page);
    assert.equal((await highlighted(page)).some(x=>x.id==='shadow-main'),false);
    await page.evaluate(()=>{document.getElementById('comments').contentEditable='false';});await page.waitForFunction(()=>[...CSS.highlights.values()].some(h=>[...h].some(r=>r.startContainer.parentElement.id==='shadow-main')));
    await page.evaluate(()=>renderer.destroy());assert.equal(await page.evaluate(()=>commentRich.adoptedStyleSheets.length),0);
  });
  await check('late attachShadow is discovered without rescanning the page and closed trees remain untouched',async()=>{
    await page.goto(base+'/fixture');await page.evaluate(()=>{const host=document.createElement('x-late-comment');host.id='late-host';document.querySelector('article').append(host);const closed=document.createElement('x-private-comment');document.querySelector('article').append(closed);globalThis.closedRoot=closed.attachShadow({mode:'closed'});closedRoot.innerHTML='<p id="closed-content">这段封闭内容保持原样。</p>';});await installRenderer(page,{});
    await page.evaluate(()=>{document.getElementById('late-host').attachShadow({mode:'open'}).innerHTML='<p id="late-comment">提前一天申请，不收取费用。</p>';});
    await page.waitForFunction(()=>[...CSS.highlights.values()].some(h=>[...h].some(r=>r.startContainer.parentElement.id==='late-comment')));
    assert.equal(await page.evaluate(()=>closedRoot.adoptedStyleSheets.length),0);
    assert.ok(await page.evaluate(()=>renderer.getSnapshot().scannedCharacters)<100);
    await page.evaluate(()=>document.getElementById('late-host').remove());await page.waitForTimeout(300);await steady(page);assert.equal((await highlighted(page)).some(x=>x.id==='late-comment'),false);
    await page.evaluate(()=>renderer.destroy());
  });
  await check('stable multicolor and visual weight preserve layout, ranges and unchanged word colors',async()=>{
    await page.goto(base+'/fixture');await installRenderer(page,{colorMode:'multi'});
    const before=await highlighted(page);assert.ok(new Set(before.map(x=>x.name)).size>1);
    await page.evaluate(()=>renderer.scan());assert.deepEqual(await highlighted(page),before);
    const box=await page.locator('article').evaluate(el=>({html:el.innerHTML,height:el.offsetHeight}));
    await page.evaluate(()=>renderer.setSettings({style:'bold-underline',colorMode:'multi'}));
    assert.ok((await highlighted(page)).every(x=>x.name.startsWith('reading-cues-bold-line')));
    assert.equal(await page.locator('article').evaluate(el=>({html:el.innerHTML,height:el.offsetHeight})).then(x=>JSON.stringify(x)),JSON.stringify(box));
    const style=await page.locator('#cross').evaluate(el=>{const [name]=[...CSS.highlights].find(([,h])=>[...h].some(r=>r.startContainer.parentElement.closest('#cross')));return getComputedStyle(el,'::highlight('+name+')').textShadow;});
    assert.notEqual(style,'none');
    await page.evaluate(()=>renderer.setSettings({style:'bold'}));const weighted=createHash('sha256').update(await page.locator('article').screenshot()).digest('hex');
    await page.evaluate(()=>renderer.setSettings({enabled:false}));assert.notEqual(createHash('sha256').update(await page.locator('article').screenshot()).digest('hex'),weighted,'weight must change actual pixels, not only computed CSS');await page.evaluate(()=>renderer.destroy());
  });
  await check('custom strong colors preserve text contrast in light and dark paragraphs',async()=>{
    await page.goto(base+'/fixture');await installRenderer(page,{style:'background',lightColor:'#111111',darkColor:'#ffcc00',intensity:85});
    const data=await page.evaluate(()=>{
      const lum=rgb=>rgb.map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((s,n,i)=>s+n*[.2126,.7152,.0722][i],0);
      return [...CSS.highlights].flatMap(([name,h])=>[...h].filter(r=>['cross','dark'].includes(r.startContainer.parentElement.closest('[id]')?.id)).map(r=>{
        const el=r.startContainer.parentElement,style=getComputedStyle(el,'::highlight('+name+')'),fg=style.color.match(/[\d.]+/g).map(Number),fill=style.backgroundColor.match(/[\d.]+/g).map(Number);
        const dark=el.closest('#dark'),bg=dark?[23,35,31]:[255,255,255],result=bg.map((n,i)=>fill[i]*fill[3]+n*(1-fill[3]));
        const a=lum(fg),b=lum(result);return {name,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
      }));
    });
    assert.ok(data.length>=2);assert.ok(data.every(x=>x.ratio>=4.5),JSON.stringify(data));
    await page.evaluate(()=>renderer.destroy());
  });
  await check('long article yields between batches and respects resource limits',async()=>{
    await page.goto(base+'/fixture');await page.evaluate(()=>document.querySelector('article').replaceChildren(...Array.from({length:2400},()=>{const p=document.createElement('p');p.textContent='这是一个长文章中的普通段落，不一定能更快读完，但应当保留原文并允许随时暂停。';return p;})));
    await installRenderer(page,{});const snapshot=await page.evaluate(()=>renderer.getSnapshot());assert.ok(snapshot.limited);assert.ok(snapshot.groups<=6000);assert.ok(snapshot.milliseconds<5000);results.push({name:'long-article-measurement',...snapshot});
  });
  await check('demo light/dark/mobile, personal words, original and safe pasted text',async()=>{
    await page.goto(base+'/demo.html');await page.waitForFunction(()=>globalThis.readingCuesDemo&&!readingCuesDemo.getSnapshot().busy);
    assert.ok(await page.evaluate(()=>readingCuesDemo.getSnapshot().groups)>0);
    assert.ok((await highlighted(page)).length>0,'completed initial scan must actually paint');
    await page.screenshot({path:path.join(artifacts,'demo-light.png'),fullPage:true,caret:'initial'});
    await page.locator('[name=demo-style][value=original]').check();assert.equal((await highlighted(page)).length,0);
    await page.locator('[name=demo-style][value=underline]').check();await page.waitForFunction(()=>[...CSS.highlights.values()].some(h=>h.size));
    await page.locator('summary').filter({hasText:'试着加一个自己的词'}).click();await page.locator('#demo-term').fill('阅读环境');await page.locator('#demo-personal-form button').click();
    await page.waitForFunction(()=>[...CSS.highlights.values()].some(h=>[...h].some(r=>r.toString()==='阅读环境')));
    await page.locator('#custom-text').fill('<img src=x onerror=alert(1)> 这不一定需要额外解释。');await page.locator('#use-custom').click();assert.equal(await page.locator('#reading-article img').count(),0);assert.ok((await page.locator('#reading-article').textContent()).includes('<img'));
    await page.locator('#restore-sample').click();await page.emulateMedia({colorScheme:'dark'});await page.locator('[name=demo-style][value=background]').check();await page.waitForFunction(()=>!readingCuesDemo.getSnapshot().busy);await page.screenshot({path:path.join(artifacts,'demo-dark.png'),fullPage:true,caret:'initial'});
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(artifacts,'demo-mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    assert.deepEqual(errors,[]);
  });
  await check('comparison page switches between literal user annotations and algorithms without rewriting text',async()=>{
    await page.goto(base+'/compare.html');await page.waitForFunction(()=>globalThis.readingCuesComparison&&!readingCuesComparison.getSnapshot().busy);
    const text=await page.locator('#compare-article').textContent();
    await page.locator('[data-plan=personal]').click();await page.waitForFunction(()=>document.getElementById('compare-status').textContent.includes('10 组'));
    assert.equal((await page.locator('#chosen-pieces').textContent()).includes('介绍城市建筑的画册'),true);
    await page.locator('[data-plan=original]').click();await page.waitForFunction(()=>![...CSS.highlights.values()].some(h=>h.size));assert.equal(await page.locator('#compare-article').textContent(),text);
    await page.locator('#compare-sample').selectOption('3');assert.equal(await page.locator('#manual-plan').isDisabled(),true);
    await page.locator('[data-plan=chunks]').click();await page.waitForFunction(()=>[...CSS.highlights.values()].some(h=>h.size));
    await page.screenshot({path:path.join(artifacts,'comparison.png'),fullPage:true});
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
    assert.equal(data.settings.enabled,true);assert.equal(data.settings.mode,'chunks');assert.equal(data.settings.style,'underline');assert.equal(data.settings.maxGroups,0);assert.deepEqual(data.excludedSites,[]);
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
    assert.ok((await site.locator('#cross').evaluate(el=>getComputedStyle(el,'::highlight(reading-cues-light)').backgroundColor)).includes('0.5'));
    await site.reload();await waitStatus(s=>s.groups>0&&!s.busy);
    await site.goto(base+'/fixture');await waitStatus(s=>s.groups>0&&!s.busy);
  });
  await check('mode, custom colors and intensity persist and apply under strict CSP',async()=>{
    assert.equal(await options.locator('#reading-mode').inputValue(),'chunks');
    await options.locator('[name=style][value=background]').check();
    assert.equal(await options.locator('.palette button').count(),6);
    await options.locator('#light-color').fill('#ff66cc');await options.locator('#light-color').dispatchEvent('change');
    await options.locator('#dark-color').fill('#aa77ff');await options.locator('#dark-color').dispatchEvent('change');
    await options.locator('#intensity').fill('75');await options.locator('#intensity').dispatchEvent('change');
    await site.goto(base+'/fixture-csp');await waitStatus(s=>s.groups>0&&!s.busy);
    const style=await site.locator('#cross').evaluate(el=>getComputedStyle(el,'::highlight(reading-cues-light)').backgroundColor);
    assert.equal(style,'rgba(255, 102, 204, 0.75)');
    await options.reload();assert.equal(await options.locator('#light-color').inputValue(),'#ff66cc');assert.equal(await options.locator('#intensity').inputValue(),'75');
    await options.locator('#reading-mode').selectOption('personal');await waitStatus(s=>s.groups===0&&!s.busy);
    await options.locator('#reading-mode').selectOption('words');await waitStatus(s=>s.groups>0&&!s.busy);
    await site.goto(base+'/fixture');await waitStatus(s=>s.groups>0&&!s.busy);
  });
  await check('per-site pause persists across navigation while other origins stay automatic',async()=>{
    await send({type:'site',url:base+'/fixture',enabled:false});await waitStatus(s=>s.groups===0&&!s.busy);
    await waitStatus(s=>s.groups>0&&!s.busy,otherTabId);
    await site.reload();await waitStatus(s=>s.groups===0&&!s.busy);
    await send({type:'site',url:base+'/fixture',enabled:true});await waitStatus(s=>s.groups>0&&!s.busy);
    assert.equal((await worker.evaluate(()=>chrome.scripting.getRegisteredContentScripts())).length,0);
  });
  await check('actual extension styles nested comments even under strict page CSP',async()=>{
    await site.goto(base+'/fixture-csp');await waitStatus(s=>s.groups>0&&!s.busy);
    await site.evaluate(()=>{const host=document.createElement('x-csp-comments');host.id='csp-host';document.body.append(host);host.attachShadow({mode:'open'}).innerHTML='<p id="csp-comment">预约成功后，提前一天申请，不收取费用。</p><div contenteditable="true">编辑文字不收取费用。</div>';});
    await waitStatus(s=>s.shadowRoots>0&&!s.busy);
    const result=await worker.evaluate(async tabId=>(await chrome.scripting.executeScript({target:{tabId},func:()=>{
      const root=document.getElementById('csp-host').shadowRoot,p=root.getElementById('csp-comment');let count=0;
      for(const [,h]of CSS.highlights)for(const r of h)if(r.startContainer.parentElement===p)count++;
      return {count,sheets:root.adoptedStyleSheets.length,background:getComputedStyle(p,'::highlight(reading-cues-light)').backgroundColor,wrappers:root.querySelectorAll('mark,[data-reading-cues-control]').length};
    }}))[0].result,siteTabId);
    assert.ok(result.count>0);assert.equal(result.sheets,1);assert.equal(result.background,'rgba(255, 102, 204, 0.75)');assert.equal(result.wrappers,0);
    await site.goto(base+'/fixture');await waitStatus(s=>s.groups>0&&!s.busy);
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
