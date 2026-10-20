/* Offline shallow phrase candidates. POS labels are lexical hints, not a
   contextual parser or a claim to understand the text. See licenses/jieba-MIT.txt. */
(() => {
  'use strict';
  let dictionary,preparing;
  function prepare(){
    if(dictionary)return Promise.resolve();
    if(preparing)return preparing;
    preparing=(async()=>{
      const result=new Map(),rows=(globalThis.ReadingCuesPOSData||'').split('\n');let slice=performance.now();
      for(const line of rows){const [word,tag,score]=line.split('\t');if(word)result.set(word,{tag,score:+score});
        if(performance.now()-slice>4){await new Promise(resolve=>setTimeout(resolve,0));slice=performance.now();}}
      dictionary=result;
    })();return preparing;
  }
  const STOP=new Set('我 你 您 他 她 它 我们 你们 他们 她们 它们 自己 这里 那里 这个 那个 这些 那些 一个 一种 部分 所有 还有 除了 如果 但是 可以 需要 应该 正在 原本 后来 随便 直接 根据 是否 判断 不同 不能 因为 所以 对于 关于 则 边'.split(' '));
  const VERB_HELPERS=new Set('是 有 在 能 会 将 将会 能够 可能 要 可 需 须 应 可以 需要 应该 帮助 进行 提供 开始 继续 让 使 被 把 想 希望'.split(' '));
  const PREFIX=new Set('不 没 未 无 并非 并不 不会 不是 不必 不需 无需 不能 不需要 难以 因此 从而 正常 自动 立即 尽快 逐渐 渐渐 持续 连续 重新 只是 差点 差一点 刚 已 已经 仍然 仍 必须 仅 只 可 能 会 将 将会 能够 可能'.split(' '));
  const TIME=new Set('今天 明天 后天 昨天 当天 本周 下周 周末 早上 上午 中午 下午 晚上 清晨 傍晚 最后 首先 随后 目前 过去 未来'.split(' '));
  const UNITS=new Set('年 月 日 天 周 小时 分钟 秒 个 次 盆 本 张 件 台 公里 米 元 岁 份 多 半'.split(' '));
  const GRAMMAR={正在:'d',重新:'d',自动:'d',只是:'d',最后:'t',首先:'t',连续:'d',提前:'d',不同:'a',时:'f',前:'f',后:'f',盆:'q',原:'a',则:'c',边:'f'};
  const MOTION=new Set('坐 乘 乘坐 去 到 来 走进 走过 进入 前往 放'.split(' '));
  const GENERIC_HEADS=new Set('时候 地方 方面 情况 问题 事情 内容 部分 东西'.split(' '));
  const INCOMPLETE_ENDS=new Set('照着 按照 根据 关于 对于 意味着 认为 觉得 表示 发现 需要 要求 允许 可能 能够 希望'.split(' '));
  const isN=t=>!!t&&/^n/u.test(t.tag),isV=t=>!!t&&/^v/u.test(t.tag),isA=t=>!!t&&/^a/u.test(t.tag);
  const isQ=t=>!!t&&(/^[mq]/u.test(t.tag)||UNITS.has(t.word));
  const isT=t=>!!t&&(t.tag==='t'||TIME.has(t.word));
  function lexicon(){
    if(dictionary)return dictionary;
    dictionary=new Map();
    for(const line of (globalThis.ReadingCuesPOSData||'').split('\n')){
      const [word,tag,score]=line.split('\t');if(word)dictionary.set(word,{tag,score:+score});
    }
    return dictionary;
  }
  function tokenize(text){
    const dict=/\p{Script=Han}/u.test(text)?lexicon():null,out=[];
    for(const found of text.matchAll(/[\p{Script=Han}]+|\d+(?:\.\d+)?|[A-Za-z][A-Za-z0-9_-]*/gu)){
      const run=found[0],base=found.index;
      if(!/\p{Script=Han}/u.test(run)){out.push({word:run,start:base,end:base+run.length,tag:/^\d/u.test(run)?'m':'eng'});continue;}
      const route=Array(run.length+1);route[run.length]={score:0};
      for(let i=run.length-1;i>=0;i--){
        let best={score:route[i+1].score-180,end:i+1,tag:'x'};
        for(let n=1;n<=8&&i+n<=run.length;n++){
          const item=dict.get(run.slice(i,i+n));if(!item)continue;
          const score=item.score-180+route[i+n].score;
          if(score>best.score)best={score,end:i+n,tag:item.tag};
        }
        route[i]=best;
      }
      for(let i=0;i<run.length;){const r=route[i],end=r.end;out.push({word:run.slice(i,end),tag:r.tag,start:base+i,end:base+end});i=end;}
    }
    for(let i=0;i<out.length;i++){
      if(GRAMMAR[out[i].word])out[i].tag=GRAMMAR[out[i].word];
      if(isN(out[i])&&i>0&&PREFIX.has(out[i-1].word)&&out[i-1].end===out[i].start)out[i].tag='v';
    }
    return out;
  }
  const intersect=(a,b)=>a.start<b.end&&b.start<a.end;
  function create(settings={}){
    function match(input,{budget=true}={}){
      if(!settings.enabled)return [];
      const text=input.slice(0,8000),all=tokenize(text),candidates=[],endTokens=new Map(all.map(t=>[t.end,t]));
      const ignored=(settings.ignored||[]).flatMap(word=>locations(text,word));
      const add=(start,end,kind,weight)=>{
        const word=text.slice(start,end);
        if(word.length<2||word.length>(kind==='personal'?80:18)||(kind!=='personal'&&/[^\p{Script=Han}\p{L}\p{N}._+%/-]/u.test(word))||ignored.some(x=>intersect({start,end},x)))return;
        if(kind!=='personal'&&(STOP.has(word)||VERB_HELPERS.has(word)||GENERIC_HEADS.has(word)))return;
        if(kind!=='personal'){
          const last=endTokens.get(end);
          if(last&&(PREFIX.has(last.word)||VERB_HELPERS.has(last.word)||['d','c','p','r','uj','ul','uz'].includes(last.tag)))return;
          if(last&&INCOMPLETE_ENDS.has(last.word))return;
          if(last&&isQ(last)&&kind!=='time'&&!/(?:小时|分钟|秒|天|次|步)$/u.test(last.word))return;
        }
        const negated=/^(?:不(?!但|仅|僅)|没|未|无|并非|并不|无需)/u.test(word);
        candidates.push({start,end,kind,weight:weight+Math.min(word.length,12)*.7+(negated?24:0)});
      };
      for(const word of settings.personal||[])for(const span of locations(text,word))add(span.start,span.end,'personal',1000);
      // Punctuation and whitespace are hard boundaries. Keep offsets in UTF-16.
      const clauses=[];let clause=[];
      for(const token of all){if(clause.length&&/[^\p{L}\p{N}]/u.test(text.slice(clause.at(-1).end,token.start))){clauses.push(clause);clause=[];}clause.push(token);}
      if(clause.length)clauses.push(clause);
      for(const ts of clauses){
        for(let i=0;i<ts.length;i++){
          const t=ts[i];
          if(isN(t)&&!STOP.has(t.word)&&(ts[i+1]?.word!=='的'||t.tag==='ns'))add(t.start,t.end,'entity',isV(ts[i+1])||ts[i+1]?.word==='正在'?2:7);
          if(isV(t)&&!VERB_HELPERS.has(t.word)&&ts[i+1]?.word!=='的')add(t.start,t.end,'action',/^(.)\1$/u.test(t.word)?1:8);
          if(isA(t)&&t.word.length>=2&&!STOP.has(t.word))add(t.start,t.end,'state',5);
          if(isT(t)){
            let j=i+1;while(j<ts.length&&j-i<7&&(isT(ts[j])||isQ(ts[j])||['前','后','之前','之后','点'].includes(ts[j].word)))j++;
            const begin=i>0&&['上','下','本','这','那'].includes(ts[i-1].word)&&/^(?:周|星期)/u.test(t.word)?i-1:i;
            add(ts[begin].start,ts[j-1].end,'time',32);
          }
          // Adjacent nouns, adjectives and quantity/classifier + object.
          if((isN(t)||isA(t)||isQ(t))&&!STOP.has(t.word)){
            let j=i;while(j+1<ts.length&&j-i<5&&(isN(ts[j+1])||isA(ts[j+1])||isQ(ts[j+1]))&&!STOP.has(ts[j+1].word))j++;
            if(j>i&&isN(ts[j]))add(t.start,ts[j].end,'noun-phrase',10);
          }
          // A bounded attributive expression: verb / modifiers + object 的 noun.
          if(t.word==='的'&&isN(ts[i+1])){
            let begin=i,verbs=0;
            while(begin>0&&i-begin<6){const prev=ts[begin-1];
              if(VERB_HELPERS.has(prev.word)||MOTION.has(prev.word)||STOP.has(prev.word)||prev.tag==='nr')break;
              if(isV(prev)){if(verbs++)break;begin--;break;}
              if(!isN(prev)&&!isA(prev)&&prev.tag!=='s')break;begin--;
            }
            let end=i+1;while(isN(ts[end+1])&&end-i<3)end++;
            while(begin>0&&['刚','已经','正在'].includes(ts[begin-1].word))begin--;
            if(begin>=0&&(i-begin>=2||ts[begin]?.tag==='s')&&ts[end].word.length>=2&&!GENERIC_HEADS.has(ts[end].word))add(ts[begin].start,ts[end].end,'attributive',27);
          }
          if(isV(t)&&!VERB_HELPERS.has(t.word)&&(!MOTION.has(t.word)||PREFIX.has(ts[i-1]?.word))&&!STOP.has(t.word)){
            let end=i;
            let state=i+1;while(state<ts.length&&state-i<=2&&ts[state].tag==='d')state++;
            if(isA(ts[state]))end=state;
            if(['了','着','过'].includes(ts[end+1]?.word))end++;
            while(end+1<ts.length&&end-i<6&&(isN(ts[end+1])||isA(ts[end+1])||isQ(ts[end+1])||ts[end+1].tag==='vn')&&!STOP.has(ts[end+1].word))end++;
            // Some light verbs take a nominalized action as object.
            if(end===i&&isV(ts[i+1])&&['提交','取消','完成','修改','更换'].includes(t.word))end=i+1;
            if(end>i&&isV(ts[end+1])&&['增加','减少','避免','控制','促进','防止','限制'].includes(t.word))end++;
            if(end>i){
              let begin=i;
              while(begin>0&&i-begin<4&&PREFIX.has(ts[begin-1].word))begin--;
              if(begin>0&&['需要','可以','会','能'].includes(ts[begin-1].word)&&begin>1&&PREFIX.has(ts[begin-2].word))begin-=2;
              if(begin>0&&ts[begin-1].word==='并'&&/^不/u.test(ts[begin].word))begin--;
              add(ts[begin].start,ts[end].end,'action-object',isA(ts[end])?28:18);
              if(isA(ts[end+1]))add(ts[begin].start,ts[end+1].end,'predicate',33);
            }
            // Adverb / modality / negation + terminal predicate, including result clauses.
            let begin=i;
            while(begin>0&&i-begin<6&&(PREFIX.has(ts[begin-1].word)||(ts[begin-1].tag==='d'&&!STOP.has(ts[begin-1].word))))begin--;
            if(begin<i){
              let start=begin;
              if(start>0&&isN(ts[start-1])&&['会','能','逐渐','渐渐'].includes(ts[start].word))start--;
              if(ts[Math.max(i,end)+1]?.word!=='的')add(ts[start].start,ts[Math.max(i,end)].end,'predicate',34);
            }
            // Time-modified action: 提前 + quantity / duration + action.
            let b=i-1;while(b>=0&&i-b<=6&&(isQ(ts[b])||isT(ts[b])))b--;
            if(b>=0&&['提前','推迟','延后'].includes(ts[b].word)&&b<i-1)add(ts[b].start,Math.max(t.end,ts[end].end),'timed-action',29);
          }
          // A locative object belongs with its modification action.
          if(['中','内','上','里'].includes(t.word)&&isV(ts[i+1])&&isN(ts[i-1])){
            let begin=i-1;if(['原','新','旧'].includes(ts[begin-1]?.word))begin--;
            add(ts[begin].start,ts[i+1].end,'located-action',27);
          }
        }
      }
      // Deduplicate, then prefer complete constructions over their component
      // words. Density is independent of color and never alternates by index.
      const unique=new Map();for(const c of candidates){const k=c.start+':'+c.end;if(!unique.has(k)||unique.get(k).weight<c.weight)unique.set(k,c);}
      const ranked=[...unique.values()].sort((a,b)=>b.weight-a.weight||(b.end-b.start)-(a.end-a.start)||a.start-b.start),resolved=[];
      for(const c of ranked)if(!resolved.some(x=>intersect(x,c)))resolved.push(c);
      const ratio={light:.36,balanced:.52,more:.66}[settings.chunkDensity]||.52;
      const characterLimit=budget?Math.max(8,Math.floor(text.replace(/\s/gu,'').length*ratio)):Infinity;let size=0;
      const selected=[];
      for(const c of resolved){if(c.kind==='personal'||size+c.end-c.start<=characterLimit){selected.push(c);if(c.kind!=='personal')size+=c.end-c.start;}}
      return selected.sort((a,b)=>a.start-b.start).map(c=>({id:`chunk:${c.start}:${c.end}`,category:c.kind,spans:[{start:c.start,end:c.end}],reason:c.kind}));
    }
    return {match,prepare};
  }
  function locations(text,word){if(typeof word!=='string'||!word.length)return [];const spans=[];for(let start=text.indexOf(word);start!==-1;start=text.indexOf(word,start+word.length))spans.push({start,end:start+word.length});return spans;}
  globalThis.ReadingCuesChunks=Object.freeze({create,tokenize,prepare});
})();
