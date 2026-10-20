(() => {
  'use strict';
  const CORE = globalThis.ReadingCues;
  const BLOCKS = new Set('ADDRESS ARTICLE ASIDE BLOCKQUOTE DD DIV DL DT FIGCAPTION FIGURE FOOTER H1 H2 H3 H4 H5 H6 HEADER LI MAIN OL P SECTION TABLE TBODY TD TH THEAD TR UL'.split(' '));
  const SKIP = 'script,style,noscript,template,svg,math,canvas,video,audio,track,iframe,object,embed,pre,code,kbd,samp,textarea,input,select,button,nav,header,footer,aside,a,strong,b,em,mark,h1,h2,h3,h4,h5,h6,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="button"],[role="slider"],[role="progressbar"],[role="timer"],[role="tooltip"],[role="navigation"],[role="menu"],[role="dialog"],[role="alert"],[aria-live]:not([aria-live="off"]),[aria-hidden="true"],[hidden],[inert],[data-reading-cues-ignore]';
  const NAMES = ['reading-cues-light', 'reading-cues-dark', 'reading-cues-line',
    'reading-cues-light-dark-ink','reading-cues-light-light-ink','reading-cues-dark-dark-ink','reading-cues-dark-light-ink'];
  const MAX_GROUPS = 6000;
  const CSS_TEXT = `
    ::highlight(reading-cues-light), ::highlight(reading-cues-light-dark-ink), ::highlight(reading-cues-light-light-ink) { background-color: rgb(var(--reading-cues-light-rgb, 255 201 64) / var(--reading-cues-opacity, .5)); }
    ::highlight(reading-cues-dark), ::highlight(reading-cues-dark-dark-ink), ::highlight(reading-cues-dark-light-ink) { background-color: rgb(var(--reading-cues-dark-rgb, 102 217 196) / var(--reading-cues-opacity, .5)); }
    ::highlight(reading-cues-light-dark-ink), ::highlight(reading-cues-dark-dark-ink) { color: #000000; }
    ::highlight(reading-cues-light-light-ink), ::highlight(reading-cues-dark-light-ink) { color: #ffffff; }
    ::highlight(reading-cues-line) { text-decoration-line: underline; text-decoration-style: solid; text-decoration-color: currentColor; text-decoration-thickness: 2px; text-underline-offset: 2px; }
    @media (forced-colors: active) {
      ${NAMES.filter(n=>n!==NAMES[2]).map(n=>'::highlight('+n+')').join(', ')} { color: CanvasText; background-color: transparent; text-decoration: underline; }
    }`;

  function* tokens(root, win) {
    const stack = [{node: root}];
    let visited = 0;
    while (stack.length) {
      const item = stack.pop();
      if (item.boundary) { yield {boundary:true}; continue; }
      const node = item.node;
      if (++visited > 60000) { yield {limit:true}; return; }
      if (node.nodeType === 3) { yield {node,text:node.data}; continue; }
      if (node.nodeType !== 1) continue;
      if (node.matches(SKIP)) { yield {boundary:true}; continue; }
      const style = win.getComputedStyle(node);
      if (style.display === 'none' || ['hidden','collapse'].includes(style.visibility) || style.contentVisibility === 'hidden') {
        yield {boundary:true}; continue;
      }
      if (['BR','HR'].includes(node.tagName)) { yield {boundary:true}; continue; }
      const block = BLOCKS.has(node.tagName) || ['block','list-item','table-cell','flex','grid'].includes(style.display);
      if (block) { yield {boundary:true}; stack.push({boundary:true}); }
      for (let i=node.childNodes.length-1;i>=0;i--) stack.push({node:node.childNodes[i]});
    }
  }
  function toRange(doc,pieces,span,expected) {
    const first=pieces.find(p=>p.end>span.start), last=pieces.find(p=>p.end>=span.end);
    if (!first || !last || !first.node.isConnected || !last.node.isConnected) return null;
    try {
      const range=doc.createRange(); range.setStart(first.node,span.start-first.start); range.setEnd(last.node,span.end-last.start);
      return range.toString()===expected ? range : null;
    } catch { return null; }
  }
  function parseColor(input) {
    const channels=input.match(/[\d.]+/g)?.map(Number);
    return channels?.length>=3 ? channels : [0,0,0,0];
  }
  function luminance(color) {
    return color.slice(0,3).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4)
      .reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
  }
  function contrast(a,b) {
    const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
  }
  function bucket(range,win,cache,config) {
    const el=range.startContainer.parentElement;
    if(cache.has(el)) return cache.get(el);
    const fg=parseColor(win.getComputedStyle(el).color),layers=[];
    let parent=el,image=false;
    while(parent) {
      const style=win.getComputedStyle(parent);if(style.backgroundImage!=='none')image=true;
      const color=parseColor(style.backgroundColor);layers.push(color);
      if((color[3]??1)>=.99)break;parent=parent.parentElement;
    }
    let bg=win.matchMedia('(prefers-color-scheme: dark)').matches?[24,24,24]:[255,255,255];
    for(const color of layers.reverse()) {const alpha=color[3]??1;bg=bg.map((n,i)=>color[i]*alpha+n*(1-alpha));}
    const dark=luminance(bg)<.2,hex=dark?config.darkColor:config.lightColor;
    const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)),alpha=config.intensity/100;
    const result=bg.map((n,i)=>rgb[i]*alpha+n*(1-alpha));
    let name=NAMES[dark?1:0];
    if(image)name=NAMES[2];
    else if(contrast(fg,result)+.01<Math.min(4.5,contrast(fg,bg))) {
      const ink=contrast([0,0,0],result)>=contrast([255,255,255],result)?'dark':'light';
      name=`reading-cues-${dark?'dark':'light'}-${ink}-ink`;
    }
    cache.set(el,name);return name;
  }

  function create({document:doc=document,lexicon=globalThis.ReadingCuesLexicon,settings={},onUpdate=()=>{},managedStyles=false}={}) {
    const win=doc.defaultView,supported=!!(win.CSS?.highlights&&win.Highlight);
    let config=CORE.normalizeSettings(settings),reader=CORE.createReader(lexicon,config);
    let generation=0,destroyed=false,timer=null,styleTimer=null,firstDirty=0,observer,styleNode,lastScroll=-Infinity;
    let activeGroups=[],painted=new Map(),dirty=new Set(),styleDirty=new Set(),fullPending=false;
    const nodeIds=new WeakMap();let nextNodeId=0;
    let snapshot={supported,segmentationSupported:reader.segmentationSupported,groups:0,ranges:0,limited:false,busy:false,milliseconds:0,scans:0,scannedCharacters:0};
    const publish=data=>{snapshot={...snapshot,...data};onUpdate({...snapshot});};
    function clear() {activeGroups=[];painted.clear();for(const name of NAMES)win.CSS?.highlights?.delete(name);}
    const valid=group=>group.parts.every(p=>p.range.startContainer.isConnected&&p.range.endContainer.isConnected&&p.range.toString()===p.expected);
    function key(part) {
      const id=node=>{if(!nodeIds.has(node))nodeIds.set(node,++nextNodeId);return nodeIds.get(node);};
      const r=part.range;return `${part.name}:${id(r.startContainer)}:${r.startOffset}:${id(r.endContainer)}:${r.endOffset}:${part.expected}`;
    }
    function paint(groups) {
      // Retain native Highlight objects and unchanged Range objects. Never blank
      // the page while computing replacements for a changed paragraph.
      const next=new Map();
      const oldParts=new Set(painted.values()), existing=new Map();
      for(const part of oldParts)if(part.range.startContainer.isConnected && part.range.toString()===part.expected)existing.set(key(part),part);
      for(const group of groups)for(let i=0;i<group.parts.length;i++) {
        const part=group.parts[i],k=key(part),old=existing.get(k);
        group.parts[i]=old||part;next.set(k,old||part);
      }
      const nextParts=new Set(next.values());
      for(const p of oldParts)if(!nextParts.has(p))win.CSS.highlights.get(p.name)?.delete(p.range);
      for(const name of NAMES)if(!win.CSS.highlights.has(name))win.CSS.highlights.set(name,new win.Highlight());
      for(const p of nextParts)if(!oldParts.has(p))win.CSS.highlights.get(p.name).add(p.range);
      painted=next;activeGroups=groups;
    }
    function applyColors() {
      for(const [name,value]of Object.entries(CORE.colorVariables(config)))doc.documentElement.style.setProperty(name,value);
    }
    const idle=()=>new Promise(resolve=>win.setTimeout(resolve,0));
    function blockFor(node) {
      let el=node.nodeType===1?node:node.parentElement;
      while(el&&el!==doc.body&&!BLOCKS.has(el.tagName))el=el.parentElement;
      return el||doc.body;
    }
    function compactRoots(roots) {
      const result=[];
      for(const root of roots) {
        if(!root?.isConnected||result.some(r=>r.contains(root)))continue;
        for(let i=result.length-1;i>=0;i--)if(root.contains(result[i]))result.splice(i,1);
        result.push(root);
      }
      return result;
    }
    async function run(roots,full=false) {
      const ticket=++generation;
      if(destroyed)return;
      if(!supported||!config.enabled||!doc.body){clear();publish({groups:0,ranges:0,limited:false,busy:false});return;}
      const started=win.performance.now();publish({busy:true});
      if(!managedStyles&&!styleNode?.isConnected){styleNode=doc.createElement('style');styleNode.dataset.readingCuesStyle='';styleNode.textContent=CSS_TEXT;(doc.head||doc.documentElement).append(styleNode);}
      roots=compactRoots(roots);
      const kept=full?[]:activeGroups.filter(g=>valid(g)&&!g.parts.some(p=>roots.some(root=>root.contains(p.range.startContainer)||root.contains(p.range.endContainer))));
      const pendingGroups=[],cache=new WeakMap();
      let text='',pieces=[],total=0,limited=full?false:snapshot.limited,overflow=false,sliceStarted=win.performance.now();
      const flush=()=>{
        if(text&&/\S/u.test(text))for(const group of reader.match(text)) {
          if(kept.length+pendingGroups.length>=MAX_GROUPS){limited=true;break;}
          const ranges=group.spans.map(s=>toRange(doc,pieces,s,text.slice(s.start,s.end)));
          if(ranges.some(x=>!x))continue;
          pendingGroups.push({parts:ranges.map((range,i)=>({range,expected:text.slice(group.spans[i].start,group.spans[i].end),name:config.style==='underline'?NAMES[2]:bucket(range,win,cache,config)}))});
        }
        text='';pieces=[];overflow=false;
      };
      for(const root of roots) {
        if(root.parentElement?.closest(SKIP))continue;
        for(const token of tokens(root,win)) {
          if(ticket!==generation||destroyed)return;
          if(token.limit){limited=true;break;}
          if(token.boundary)flush();
          else if(!overflow) {
            if(total+token.text.length>300000||kept.length+pendingGroups.length>=MAX_GROUPS){limited=true;break;}
            total+=token.text.length;
            const keep=token.text.slice(0,CORE.LIMITS.paragraph-text.length);
            pieces.push({node:token.node,start:text.length,end:text.length+keep.length});text+=keep;
            if(keep.length<token.text.length){overflow=true;limited=true;}
          }
          if(win.performance.now()-sliceStarted>4){await idle();sliceStarted=win.performance.now();}
        }
        flush();if(total>=300000)break;
      }
      if(ticket!==generation||destroyed)return;
      const current=kept.concat(pendingGroups).filter(valid);paint(current);
      publish({groups:current.length,ranges:current.reduce((n,g)=>n+g.parts.length,0),limited,busy:false,milliseconds:Math.round(win.performance.now()-started),scans:snapshot.scans+1,scannedCharacters:total});
    }
    async function scan() {
      win.clearTimeout(timer);win.clearTimeout(styleTimer);firstDirty=0;dirty.clear();styleDirty.clear();fullPending=false;
      return run([doc.body],true);
    }
    function schedule(full=false) {
      if(destroyed||!config.enabled)return;
      fullPending ||= full;
      if(!firstDirty)firstDirty=Date.now();
      win.clearTimeout(timer);
      timer=win.setTimeout(async()=>{
        // Scroll-driven style mutations settle after scrolling. Scrolling alone
        // does not invalidate text ranges and never requests a scan.
        if(win.performance.now()-lastScroll<160){schedule();return;}
        const roots=[...dirty],full=fullPending;dirty.clear();fullPending=false;firstDirty=0;
        await run(full?[doc.body]:roots,full);
      },Math.max(40,Math.min(220,800-(Date.now()-firstDirty))));
    }
    observer=new win.MutationObserver(records=>{
      let changed=false;
      for(const r of records) {
        if(r.target===styleNode)continue;
        const el=r.target.nodeType===1?r.target:r.target.parentElement;
        if(!el?.isConnected){changed=true;continue;}
        if(r.type==='attributes') {
          const structural=['hidden','aria-hidden','contenteditable','data-reading-cues-ignore','inert','role','aria-live'].includes(r.attributeName);
          if(!structural&&el?.closest(SKIP))continue;
          if(['class','style'].includes(r.attributeName)) {
            // Cosmetic updates (hover, animations, video chrome) have a separate
            // trailing queue. They cannot force repeated article scans via the
            // maximum wait for actual text edits.
            styleDirty.add(blockFor(el));win.clearTimeout(styleTimer);
            if(styleDirty.size>128){styleDirty.clear();styleDirty.add(doc.body);}
            styleTimer=win.setTimeout(()=>{for(const root of styleDirty)dirty.add(root);styleDirty.clear();schedule();},300);
            continue;
          }
          dirty.add(blockFor(el));changed=true;
        } else if(!el?.closest(SKIP)) {
          if(r.type==='childList'&&[...r.addedNodes,...r.removedNodes].every(n=>n===styleNode||n.nodeType===8))continue;
          // Block siblings can be scanned independently of the existing article.
          if(r.type==='childList'&&[...r.addedNodes,...r.removedNodes].every(n=>n.nodeType===1&&BLOCKS.has(n.tagName))) {
            for(const n of r.addedNodes)dirty.add(n);
          } else dirty.add(blockFor(el));
          changed=true;
        }
      }
      if(changed)schedule();
    });
    function observe() {if(config.enabled)observer.observe(doc.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,
      attributeFilter:['class','style','hidden','aria-hidden','contenteditable','data-reading-cues-ignore','inert','role','aria-live']});}
    applyColors();observe();
    const theme=win.matchMedia('(prefers-color-scheme: dark)');
    const rescan=()=>schedule(true),scroll=()=>{lastScroll=win.performance.now();};
    theme.addEventListener('change',rescan);win.addEventListener('pageshow',rescan);win.addEventListener('scroll',scroll,{passive:true,capture:true});
    return {
      scan,getSnapshot:()=>({...snapshot}),
      async setSettings(next) {
        const normalized=CORE.normalizeSettings(next);
        if(JSON.stringify(normalized)===JSON.stringify(config)&&snapshot.scans>0)return;
        config=normalized;reader=CORE.createReader(lexicon,config);
        observer.disconnect();applyColors();observe();snapshot.segmentationSupported=reader.segmentationSupported;
        return scan();
      },
      destroy() {
        destroyed=true;generation++;win.clearTimeout(timer);win.clearTimeout(styleTimer);observer.disconnect();
        theme.removeEventListener('change',rescan);win.removeEventListener('pageshow',rescan);win.removeEventListener('scroll',scroll,true);
        clear();styleNode?.remove();for(const name of Object.keys(CORE.colorVariables(config)))doc.documentElement.style.removeProperty(name);
        publish({groups:0,ranges:0,busy:false});
      }
    };
  }
  globalThis.ReadingCuesRenderer=Object.freeze({create,cssText:CSS_TEXT});
})();
