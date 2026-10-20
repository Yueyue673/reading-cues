(() => {
  'use strict';
  const samples=globalThis.ReadingCuesComparisonData,select=document.getElementById('compare-sample'),article=document.getElementById('compare-article');
  let selected=samples[0],plan='chunks',revision=0;
  const renderer=ReadingCuesRenderer.create({settings:{style:'underline'}});
  for(const [i,sample]of samples.entries()){const option=document.createElement('option');option.value=i;option.textContent=sample.title||['校准① · 日常叙述','校准② · 操作说明','校准③ · 科普解释'][i];select.append(option);}
  async function render(){
    const ticket=++revision,text=selected.text;
    article.textContent=text;
    const settings=ReadingCues.normalizeSettings({enabled:plan!=='original',mode:plan==='personal'?'personal':plan==='words'?'words':'chunks',style:'underline',personal:plan==='personal'?(selected.marks||[]):[]});
    document.querySelectorAll('[data-plan]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.plan===plan)));
    document.getElementById('manual-plan').disabled=!selected.marks;
    document.getElementById('sample-note').textContent=selected.marks?'校准样例：你的原始边界原样保留。新候选可能不同，尤其会尝试补全否定动作。':'新段落：没有使用者标注。请先按自己的感觉判断，不把程序输出当作正确答案。';
    await renderer.setSettings(settings);await renderer.scan();if(ticket!==revision)return;
    const root=document.getElementById('chosen-pieces');root.replaceChildren();
    const groups=ReadingCues.createReader(ReadingCuesLexicon,settings).match(text);
    for(const group of groups){const span=document.createElement('span');span.textContent=group.spans.map(s=>text.slice(s.start,s.end)).join(' … ');root.append(span);}
    document.getElementById('compare-status').textContent=plan==='original'?'原文，没有标记。':`当前 ${groups.length} 组。保持同一字号、样式和文字，比较选词差异。`;
  }
  for(const button of document.querySelectorAll('[data-plan]'))button.addEventListener('click',()=>{plan=button.dataset.plan;void render();});
  select.addEventListener('change',()=>{selected=samples[Number(select.value)];if(plan==='personal'&&!selected.marks)plan='chunks';void render();});
  document.getElementById('compare-use').addEventListener('click',()=>{const text=document.getElementById('compare-custom').value.trim();if(!text)return;selected={id:'local-custom',text};if(plan==='personal')plan='chunks';void render();});
  globalThis.readingCuesComparison=renderer;
  void render();
})();
