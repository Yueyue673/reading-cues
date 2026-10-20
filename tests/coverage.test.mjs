import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';
import '../src/core.js';
const read=name=>JSON.parse(readFileSync(new URL(name,import.meta.url),'utf8'));
const lexicon=read('../src/lexicon.json'), passages=read('./fixtures/reading-passages.json');
const matcher=ReadingCues.createMatcher(lexicon);
const pieces=(text,groups)=>groups.flatMap(g=>g.spans.map(s=>text.slice(s.start,s.end)));
for(const item of passages)test(`independent passage: ${item.genre}`,()=>{
  const found=pieces(item.text,matcher.match(item.text,{budget:false}));
  for(const term of item.mustInclude)assert.ok(found.includes(term),`missing full expression ${term}; found ${found.join('/')}`);
  const visible=matcher.match(item.text);if(item.expectNone)assert.equal(visible.length,0);else assert.ok(visible.length>0);
});
test('more common reading scenarios are covered than the v0.1 lexicon',()=>{
  const old=ReadingCues.createMatcher(read('./fixtures/lexicon-v0.1.json'));
  const relevant=passages.filter(p=>!p.expectNone);
  const before=relevant.filter(p=>old.match(p.text).length).length, after=relevant.filter(p=>matcher.match(p.text).length).length;
  assert.equal(after,relevant.length);assert.ok(after>before);
  console.log(`Authored scenario coverage: v0.1 ${before}/${relevant.length}; v0.2 ${after}/${relevant.length}. This is a regression corpus, not a population estimate.`);
});
test('long paragraphs receive more automatic cues with bounded marked characters',()=>{
  const text=passages.filter(p=>!p.expectNone).slice(0,6).map(p=>p.text).join('');
  const groups=matcher.match(text);assert.ok(groups.length>2);assert.ok(groups.length<=ReadingCues.paragraphBudget(text).groups);
  assert.ok(groups.reduce((n,g)=>n+g.spans.reduce((m,s)=>m+s.end-s.start,0),0)<=ReadingCues.paragraphBudget(text).characters);
});
test('complete concepts and full values beat shorter overlapping prefixes',()=>{
  const text='注意力机制和注意力不同，截止时间和截止日期分别记录。费用降低到20元，另外一笔降低了20元。';
  const found=pieces(text,matcher.match(text,{budget:false}));
  for(const term of ['注意力机制','注意力','截止时间','截止日期','降低到20元','降低了20元'])assert.ok(found.includes(term));
  for(const term of ['降低到','降低了','20元'])assert.ok(!found.includes(term));
});
test('quantities do not scan unbounded digit runs or mark identifier fragments',()=>{
  const text='9'.repeat(8000), start=performance.now();assert.deepEqual(matcher.match(text),[]);assert.ok(performance.now()-start<1000);
  assert.ok(!pieces('版本20.18:30没有时间语义。',matcher.match('版本20.18:30没有时间语义。',{budget:false})).includes('18:30'));
});
test('global mode defaults on and exclusions propagate to embedded frames',()=>{
  assert.equal(ReadingCues.isSiteEnabled('https://new.example/article'),true);
  assert.equal(ReadingCues.isSiteEnabled('https://new.example/article',{enabled:false}),false);
  assert.equal(ReadingCues.isSiteEnabled('https://frame.example/article',{},['https://top.example/*'],'https://top.example/read'),false);
  assert.equal(ReadingCues.isSiteEnabled('https://other.example/read',{},['https://top.example/*']),true);
  assert.equal(ReadingCues.isSiteEnabled('chrome://settings'),false);
});
