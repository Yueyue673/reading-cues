/* Explicit, temporary review data. No persistence, browser APIs or telemetry. */
(() => {
  'use strict';
  function create(){
    const samples=new Map();
    const copy=sample=>({reviewed:sample.reviewed,spans:sample.spans.map(s=>({...s}))});
    function ensure(text,meta={}){
      if(typeof text!=='string'||!text.length||text.length>8000)throw new Error('请使用不超过 8,000 字的一段文字。');
      if(!samples.has(text)){
        if(samples.size>=20)throw new Error('本次已标注 20 段，请先导出，再刷新页面开始下一批。');
        samples.set(text,{id:String(meta.id||'local').slice(0,80),title:String(meta.title||'我的文字').slice(0,80),text,spans:[],reviewed:false,history:[]});
      }
      return samples.get(text);
    }
    function update(sample,next){sample.history.push(copy(sample));if(sample.history.length>20)sample.history.shift();Object.assign(sample,next);}
    function add(text,start,end,meta){
      if(typeof text!=='string'||!Number.isInteger(start)||!Number.isInteger(end)||start<0||end>text.length||start>=end)throw new Error('请先选中本段中的完整词组。');
      while(start<end&&/\s/u.test(text[start]))start++;
      while(end>start&&/\s/u.test(text[end-1]))end--;
      const word=text.slice(start,end);
      const splitPair=i=>i>0&&i<text.length&&/[\uD800-\uDBFF]/u.test(text[i-1])&&/[\uDC00-\uDFFF]/u.test(text[i]);
      if([...word].length<2||[...word].length>80||splitPair(start)||splitPair(end))throw new Error('每个标注请选择 2–80 个完整字符。');
      const sample=ensure(text,meta),overlap=s=>s.start<end&&start<s.end;
      if(sample.spans.some(s=>s.start===start&&s.end===end))return false;
      const spans=sample.spans.filter(s=>!overlap(s));
      if(spans.length>=100)throw new Error('本段最多保留 100 个标注。');
      spans.push({start,end,text:word});spans.sort((a,b)=>a.start-b.start);
      update(sample,{spans,reviewed:false});return true;
    }
    const get=text=>samples.has(text)?copy(samples.get(text)):{spans:[],reviewed:false};
    return Object.freeze({
      add,get,
      canUndo(text){return !!samples.get(text)?.history.length;},
      remove(text,start,end){const s=samples.get(text);if(s&&s.spans.some(x=>x.start===start&&x.end===end))update(s,{spans:s.spans.filter(x=>x.start!==start||x.end!==end),reviewed:false});},
      clear(text){const s=samples.get(text);if(s&&(s.spans.length||s.reviewed))update(s,{spans:[],reviewed:false});},
      undo(text){const s=samples.get(text);if(s?.history.length)Object.assign(s,s.history.pop());},
      complete(text,meta){const s=ensure(text,meta);if(!s.reviewed)update(s,{reviewed:true});},
      exportJSON(text){
        const rows=[...samples.values()].filter(s=>text===undefined||s.text===text).map(({id,title,text,spans,reviewed})=>({id,title,text,reviewed,spans:spans.map(s=>({...s}))}));
        return JSON.stringify({kind:'reading-cues-annotations',schemaVersion:1,offsets:'UTF-16',samples:rows},null,2)+'\n';
      },
      get size(){return samples.size;}
    });
  }
  globalThis.ReadingCuesAnnotations=Object.freeze({create});
})();
