(() => {
  'use strict';
  async function send(message) {
    const result = await chrome.runtime.sendMessage(message);
    if (!result?.ok) throw new Error(result?.error || '操作未完成，请重新打开轻读后再试。');
    return result;
  }
  async function load() {
    const data = await chrome.storage.local.get(['settings', 'excludedSites']);
    return {settings: ReadingCues.normalizeSettings(data.settings), excludedSites: data.excludedSites || []};
  }
  function announce(text, error = false) {
    const el = document.getElementById('message');
    el.textContent = text;
    el.classList.toggle('error', error);
  }
  async function act(fn) {
    try { return await fn(); } catch (error) { announce(error.message, true); }
  }
  function bindPreferences(onChange) {
    bindReaderControls(patch=>act(()=>send({type:'settings',patch}).then(onChange)));
    document.querySelectorAll('[name=style]').forEach(input => input.addEventListener('change', () => {
      if (input.checked) void act(() => send({type: 'settings', patch: {style: input.value}}).then(onChange));
    }));
    document.querySelectorAll('[name=category]').forEach(input => input.addEventListener('change', () => {
      const categories = [...document.querySelectorAll('[name=category]:checked')].map(x => x.value);
      void act(() => send({type: 'settings', patch: {categories}}).then(onChange));
    }));
    document.getElementById('density')?.addEventListener('change', event => {
      void act(() => send({type: 'settings', patch: {maxGroups: Number(event.target.value)}}).then(onChange));
    });
    document.getElementById('global-pause')?.addEventListener('change', event => {
      void act(() => send({type: 'settings', patch: {enabled: !event.target.checked}}).then(onChange));
    });
  }
  function mountReaderControls() {
    const mode=document.getElementById('reader-controls'),colors=document.getElementById('color-controls');
    if(mode)mode.innerHTML=`<label class="stack" for="reading-mode">阅读方式<select id="reading-mode"><option value="chunks">意义块（试验）</option><option value="words">逐词分界（旧版对照）</option><option value="cues">逻辑与数值提示</option><option value="personal">只提示个人词库</option></select></label><p class="hint">意义块尝试把时间、修饰语、动作和状态一起保留；本地规则仍会选错。颜色不表示重要程度。</p><label class="row" for="chunk-density">意义块密度<select id="chunk-density"><option value="light">轻量</option><option value="balanced">均衡</option><option value="more">较多</option></select></label><details><summary>旧版逐词分界数量</summary><label class="row" for="word-step">分界密度<select id="word-step"><option value="2">隔 1 个词组标记</option><option value="3">隔 2 个词组标记</option><option value="4">隔 3 个词组标记</option></select></label></details><a href="compare.html" target="_blank">比较原文、旧版与你的标注 →</a>`;
    if(colors)colors.innerHTML=`<fieldset><legend>颜色与清晰度</legend><div class="palette" role="group" aria-label="配色预设"></div><div class="color-row"><label>浅色网页<input id="light-color" type="color" aria-label="浅色网页标记颜色"></label><label>深色网页<input id="dark-color" type="color" aria-label="深色网页标记颜色"></label></div><label class="stack" for="intensity">底色强度 <output id="intensity-value">50%</output><input id="intensity" type="range" min="20" max="85" step="5" value="50"></label><p class="hint">可自由取色。底色影响清晰度时，文字自动配深浅色；图片背景使用清楚的下划线。下划线跟随原文字色。</p><p class="color-preview"><span class="preview-mark">完整词组</span> 之间的 <span class="preview-mark">边界</span></p></fieldset>`;
    if(colors){const label=document.createElement('label');label.className='stack';label.innerHTML='配色方式<select id="color-mode"><option value="single">单色（默认）</option><option value="multi">随机多色，稳定分配</option></select>';const button=document.createElement('button');button.id='shuffle-colors';button.type='button';button.textContent='换一组颜色';const hint=document.createElement('p');hint.className='hint';hint.textContent='同一词组保持同色，滚动和重扫不变色。换色只改变配色，不增加标记。加重采用描边式效果，保留换行。';colors.prepend(label,button,hint);}
    const presets=[['金黄','#ffc940','#ffc940'],['薄荷','#64d9b0','#66d9c4'],['天蓝','#77baff','#77baff'],['薰衣草','#bda0ff','#bda0ff'],['桃粉','#ff9fbb','#ff9fbb'],['杏橙','#ffa35c','#ffa35c']];
    for(const [label,light,dark]of presets){const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.light=light;button.dataset.dark=dark;button.style.setProperty('--swatch',light);colors?.querySelector('.palette').append(button);}
    const existing=document.querySelector('[name=style], [name=demo-style]');
    if(existing){const name=existing.name,root=existing.closest('.choices');root.replaceChildren();const choices=[['underline','下划线'],['background','底色'],['bold','加重'],['bold-underline','加重＋下划线']];if(name==='demo-style')choices.unshift(['original','原文']);for(const [value,title]of choices){const label=document.createElement('label'),input=document.createElement('input'),span=document.createElement('span');label.className='choice';input.type='radio';input.name=name;input.value=value;input.checked=value===ReadingCues.DEFAULTS.style;span.className=styleClass(value);span.textContent=title;label.append(input,span);root.append(label);}}
  }
  const styleClass=style=>({'background':'preview-mark','underline':'preview-line','bold':'preview-bold','bold-underline':'preview-bold preview-line'}[style]||'');
  function bindReaderControls(save) {
    for(const [id,field]of [['reading-mode','mode'],['chunk-density','chunkDensity'],['word-step','wordStep'],['light-color','lightColor'],['dark-color','darkColor'],['intensity','intensity'],['color-mode','colorMode']]) {
      const el=document.getElementById(id);if(!el)continue;
      el.addEventListener('input',()=>{if(id==='intensity')document.getElementById('intensity-value').textContent=el.value+'%';previewColors();});
      el.addEventListener('change',()=>void save({[field]:['wordStep','intensity'].includes(field)?Number(el.value):el.value}));
    }
    for(const button of document.querySelectorAll('.palette button'))button.addEventListener('click',()=>void save({lightColor:button.dataset.light,darkColor:button.dataset.dark}));
    document.getElementById('shuffle-colors')?.addEventListener('click',()=>void save({colorMode:'multi',colorSeed:crypto.getRandomValues(new Uint32Array(1))[0]}));
  }
  function previewColors() {
    const lightColor=document.getElementById('light-color')?.value,darkColor=document.getElementById('dark-color')?.value,intensity=Number(document.getElementById('intensity')?.value);
    for(const [name,value]of Object.entries(ReadingCues.colorVariables({lightColor,darkColor,intensity})))document.documentElement.style.setProperty(name,value);
    const dark=matchMedia('(prefers-color-scheme: dark)').matches,color=dark?darkColor:lightColor;
    if(!color)return;
    const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
    const paper=getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
    const bg=rgb(paper),paint=rgb(color),result=bg.map((n,i)=>paint[i]*intensity/100+n*(1-intensity/100));
    const lum=channels=>channels.map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
    const l=lum(result),darkRatio=(l+.05)/.05,lightRatio=1.05/(l+.05);
    document.documentElement.style.setProperty('--reading-cues-preview-ink',darkRatio>=lightRatio?'#000000':'#ffffff');
  }
  function mountCategories(id) {
    const root = document.getElementById(id);
    if (!root) return;
    for (const [category, title] of Object.entries(ReadingCues.CATEGORY_LABELS)) {
      const label = document.createElement('label'), input = document.createElement('input');
      input.type = 'checkbox'; input.name = 'category'; input.value = category;
      label.append(input, document.createTextNode(title)); root.append(label);
    }
  }
  function showPreferences(settings) {
    for(const [id,value]of [['reading-mode',settings.mode],['chunk-density',settings.chunkDensity],['word-step',settings.wordStep],['light-color',settings.lightColor],['dark-color',settings.darkColor],['intensity',settings.intensity],['color-mode',settings.colorMode]])if(document.getElementById(id))document.getElementById(id).value=value;
    if(document.getElementById('intensity-value'))document.getElementById('intensity-value').textContent=settings.intensity+'%';
    if(document.getElementById('word-step'))document.getElementById('word-step').disabled=settings.mode!=='words';
    document.querySelectorAll('#light-color, #dark-color, #intensity, .palette button').forEach(input=>input.disabled=settings.style!=='background'||settings.colorMode==='multi');
    if(document.getElementById('intensity'))document.getElementById('intensity').disabled=settings.style!=='background';
    if(document.getElementById('chunk-density'))document.getElementById('chunk-density').disabled=settings.mode!=='chunks';
    if(document.getElementById('color-mode'))document.getElementById('color-mode').disabled=settings.style==='bold';
    if(document.getElementById('shuffle-colors'))document.getElementById('shuffle-colors').disabled=settings.colorMode!=='multi'||settings.style==='bold';
    if(document.getElementById('density'))document.getElementById('density').disabled=settings.mode!=='cues';
    document.querySelectorAll('[name=category]').forEach(input=>input.disabled=settings.mode!=='cues');
    previewColors();
    for (const input of document.querySelectorAll('[name=style]')) input.checked = settings.style === input.value;
    for (const input of document.querySelectorAll('[name=demo-style]')) input.checked = (settings.enabled?settings.style:'original') === input.value;
    for(const span of document.querySelectorAll('.color-preview span')){
      span.className=styleClass(settings.style);span.style.backgroundColor='';span.style.textDecorationColor='';span.style.color='';
      if(settings.colorMode==='multi'){
        const i=ReadingCues.colorIndex(span.textContent,settings.colorSeed),dark=matchMedia('(prefers-color-scheme: dark)').matches;
        if(settings.style==='background'){
          const rgb=[1,3,5].map(n=>parseInt(ReadingCues.PALETTE[i].slice(n,n+2),16));span.style.backgroundColor=`rgb(${rgb.join(' ')} / ${settings.intensity/100})`;span.style.color=dark&&settings.intensity<40?'#fff':'#000';
        }else span.style.textDecorationColor=(dark?ReadingCues.PALETTE:ReadingCues.LINE_PALETTE)[i];
      }
    }
    for (const input of document.querySelectorAll('[name=category]')) input.checked = settings.categories.includes(input.value);
    if (document.getElementById('density')) document.getElementById('density').value = settings.maxGroups;
    if (document.getElementById('global-pause')) document.getElementById('global-pause').checked = !settings.enabled;
  }
  globalThis.ReadingCuesUI = {send, load, announce, act, bindPreferences, showPreferences, mountCategories,mountReaderControls,bindReaderControls,styleClass};
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change',previewColors);
})();
