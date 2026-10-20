(() => {
  'use strict';
  const samples=globalThis.ReadingCuesComparisonData,select=document.getElementById('compare-sample'),article=document.getElementById('compare-article');
  const reviews=ReadingCuesAnnotations.create(),panel=document.getElementById('annotation-panel'),addButton=document.getElementById('annotation-add');
  let selected=samples[0],customSample=null,plan='chunks',revision=0,selection=null;
  const renderer=ReadingCuesRenderer.create({settings:{style:'underline'}});
  const notice=(message,error=false)=>{const el=document.getElementById('annotation-status');el.textContent=message;el.classList.toggle('error',error);};
  for(const [i,sample]of samples.entries()){const option=document.createElement('option');option.value=i;option.textContent=sample.title||['校准① · 日常叙述','校准② · 操作说明','校准③ · 科普解释'][i];select.append(option);}
  function drawReview(){
    CSS.highlights.delete('reading-cues-review');if(plan!=='annotate')return;
    const highlight=new Highlight();
    for(const span of reviews.get(selected.text).spans){const range=new Range();range.setStart(article.firstChild,span.start);range.setEnd(article.firstChild,span.end);highlight.add(range);}
    CSS.highlights.set('reading-cues-review',highlight);
  }
  function reviewControls(){
    const data=reviews.get(selected.text);
    document.getElementById('annotation-count').textContent=`本段 ${data.spans.length} 处 · ${data.reviewed?'已确认完成':'尚未确认完成'}`;
    document.getElementById('annotation-copy').disabled=!data.spans.length&&!data.reviewed;
    document.getElementById('annotation-export').disabled=!reviews.size;
  }
  async function render(){
    const ticket=++revision,text=selected.text,currentPlan=plan;
    selection=null;addButton.disabled=true;CSS.highlights.delete('reading-cues-review');article.textContent=text;
    const settings=ReadingCues.normalizeSettings({enabled:!['original','annotate'].includes(currentPlan),mode:currentPlan==='personal'?'personal':currentPlan==='words'?'words':'chunks',chunkDensity:document.getElementById('compare-density').value,style:'underline',personal:currentPlan==='personal'?(selected.marks||[]):[]});
    panel.hidden=currentPlan!=='annotate';
    document.getElementById('annotation-actions').hidden=currentPlan!=='annotate';
    document.getElementById('compare-density').disabled=currentPlan!=='chunks';
    document.querySelectorAll('[data-plan]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.plan===currentPlan)));
    document.getElementById('manual-plan').disabled=!selected.marks;
    document.getElementById('sample-note').textContent=selected.marks?'校准样例：上一轮的原始边界保留不变。你也可以另做一份新标注。':'新段落：没有参考标注。可以先自行标注，再查看程序，减少先看到算法带来的影响。';
    document.getElementById('compare-status').textContent='正在准备…';
    await renderer.setSettings(settings);await renderer.scan();if(ticket!==revision)return;
    const root=document.getElementById('chosen-pieces');root.replaceChildren();
    const groups=currentPlan==='annotate'?reviews.get(text).spans.map(s=>({spans:[s]})):currentPlan==='original'?[]:ReadingCues.createReader(ReadingCuesLexicon,settings).match(text);
    for(const group of groups){
      const piece=group.spans.map(s=>text.slice(s.start,s.end)).join(' … '),el=document.createElement(currentPlan==='annotate'?'button':'span');el.textContent=piece;
      if(currentPlan==='annotate'){el.type='button';el.setAttribute('aria-label',`移除标注：${piece}`);el.addEventListener('click',()=>{reviews.remove(text,group.spans[0].start,group.spans[0].end);notice('已移除；可以撤销。');void render();});}
      root.append(el);
    }
    drawReview();reviewControls();
    document.getElementById('compare-status').textContent=currentPlan==='original'?'原文，没有标记。':currentPlan==='annotate'?'自行标注：拖选正文中的完整词组，然后点“加入标注”。':`当前 ${groups.length} 组。保持同一字号、样式和文字，比较选词差异。`;
  }
  function addSelection(){
    if(plan!=='annotate'||!selection)return;
    try{reviews.add(selected.text,selection.start,selection.end,selected);notice('已加入标注；重叠的旧标注按这次选取的边界替换。');void render();}catch(error){notice(error.message,true);}
  }
  document.addEventListener('selectionchange',()=>{
    selection=null;addButton.disabled=true;if(plan!=='annotate')return;
    const sel=window.getSelection();if(!sel?.rangeCount||sel.isCollapsed)return;
    const range=sel.getRangeAt(0);if(!article.contains(range.startContainer)||!article.contains(range.endContainer))return;
    const before=new Range();before.selectNodeContents(article);before.setEnd(range.startContainer,range.startOffset);
    const start=before.toString().length,end=start+range.toString().length;
    if([...selected.text.slice(start,end).trim()].length<2)return;
    selection={start,end};addButton.disabled=false;
  });
  document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'&&selection&&plan==='annotate'){event.preventDefault();addSelection();}});
  addButton.addEventListener('click',addSelection);
  document.getElementById('annotation-undo').addEventListener('click',()=>{reviews.undo(selected.text);notice('已撤销上一步。');void render();});
  document.getElementById('annotation-clear').addEventListener('click',()=>{reviews.clear(selected.text);notice('已清空本段；可以撤销。');void render();});
  document.getElementById('annotation-complete').addEventListener('click',()=>{try{reviews.complete(selected.text,selected);notice('已确认本段完成。可以切换“新候选”比较，再回来修改。');reviewControls();}catch(error){notice(error.message,true);}});
  document.getElementById('annotation-copy').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(reviews.exportJSON(selected.text));notice('已复制本段标注，可以粘贴回聊天。');}catch(error){notice(error.name==='NotAllowedError'?'浏览器未允许复制，请使用“导出全部标注”。':error.message,true);}
  });
  document.getElementById('annotation-export').addEventListener('click',()=>{
    const url=URL.createObjectURL(new Blob([reviews.exportJSON()],{type:'application/json;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='reading-cues-annotations.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('已导出本次全部标注；未确认的条目会保留为草稿。');
  });
  for(const button of document.querySelectorAll('[data-plan]'))button.addEventListener('click',()=>{plan=button.dataset.plan;void render();});
  select.addEventListener('change',()=>{selected=select.value==='custom'?customSample:samples[Number(select.value)];if(plan==='personal'&&!selected.marks)plan='chunks';notice('');void render();});
  document.getElementById('compare-density').addEventListener('change',()=>void render());
  document.getElementById('compare-use').addEventListener('click',()=>{const text=document.getElementById('compare-custom').value.trim();if(!text)return;selected=customSample={id:'local-custom',title:'我的文字',text};if(!select.querySelector('[value=custom]')){const option=document.createElement('option');option.value='custom';option.textContent='我的文字';select.append(option);}select.value='custom';if(plan==='personal')plan='chunks';notice('');void render();});
  globalThis.readingCuesComparison=renderer;
  void render();
})();
