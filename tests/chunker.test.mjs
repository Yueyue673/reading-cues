import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../src/core.js';
import '../src/chunker.js';
globalThis.ReadingCuesPOSData=readFileSync(new URL('../src/data/pos.tsv',import.meta.url),'utf8');
const lexicon=JSON.parse(readFileSync(new URL('../src/lexicon.json',import.meta.url),'utf8'));
const Core=ReadingCues;
const pieces=(text,settings={})=>Core.createReader(lexicon,settings).match(text).flatMap(g=>g.spans.map(s=>text.slice(s.start,s.end)));
const constructions=text=>ReadingCuesChunks.create(Core.normalizeSettings()).match(text,{budget:false}).flatMap(g=>g.spans.map(s=>text.slice(s.start,s.end)));
test('complete constructions are generated without containing whole calibration sentences',()=>{
  for(const [text,wanted]of [
    ['明天晚上，她需要提前两天登记，不收取押金。',['明天晚上','提前两天登记','不收取押金']],
    ['持续升温时，水位会逐渐下降。',['持续升温','水位会逐渐下降']],
    ['我们翻开一本介绍桥梁结构的图册。',['介绍桥梁结构的图册']]
  ])for(const phrase of wanted)assert.ok(constructions(text).includes(phrase),JSON.stringify({text,wanted:phrase,actual:constructions(text)}));
});
test('negation is never stripped off a selected negative action',()=>{
  const text='不需要重新提交申请，也不收取费用。';const marks=constructions(text);
  assert.ok(marks.includes('不需要重新提交申请'));assert.ok(marks.includes('不收取费用'));
  assert.ok(!marks.includes('需要重新提交申请'));assert.ok(!marks.includes('收取费用'));
});
test('candidate boundaries do not stop at a modifier, classifier or subordinate-clause introducer',()=>{
  for(const text of ['保留将自动取消。','他又买了一本介绍桥梁结构的图册。','这并不意味着所有鱼类都能立即适应。']){
    const found=constructions(text);
    for(const incomplete of ['将自动','又买了一本','不意味着','一本','能够'])assert.ok(!found.includes(incomplete),JSON.stringify({text,found}));
  }
});
test('chunk candidates respect punctuation, raw offsets, ignored text and literal personal overrides',()=>{
  const text='🌿明天晚上，比较 a+b 和 [词]。不收取费用。';
  const groups=Core.createReader(lexicon,{personal:['a+b','[词]'],ignored:['不收取费用']}).match(text);
  const marked=groups.flatMap(g=>g.spans.map(s=>text.slice(s.start,s.end)));
  assert.ok(marked.includes('a+b'));assert.ok(marked.includes('[词]'));assert.ok(!marked.some(w=>w.includes('费用')));
  assert.ok(groups.every(g=>g.spans.every(s=>s.start>=2&&!/[，。]/u.test(text.slice(s.start,s.end)))));
});
test('personal phrases longer than automatic chunks stay intact',()=>{
  const term='这是一个由用户明确指定需要完整保留的个人词组';assert.ok(pieces(term,{personal:[term]}).includes(term));
});
test('color allocation is deterministic and independent of annotation density',()=>{
  assert.equal(Core.normalizeSettings().style,'background');assert.equal(Core.normalizeSettings().colorMode,'multi');assert.equal(Core.normalizeSettings().intensity,20);assert.equal(Core.normalizeSettings({aidMode:'evil'}).aidMode,'off');
  for(const text of ['提前一天申请','空气会逐渐减少','城市建筑'])assert.equal(Core.colorIndex(text,123),Core.colorIndex(text,123));
  assert.ok(new Set(['公交车','植物','服务台','费用','材料','空气'].map(t=>Core.colorIndex(t,123))).size>1);
  assert.equal(Core.normalizeSettings({colorSeed:-1,colorMode:'evil'}).colorMode,'multi');
});
test('calibration annotations stay separate from general regression examples',()=>{
  const data=JSON.parse(readFileSync(new URL('./fixtures/user-annotations.json',import.meta.url),'utf8'));
  assert.equal(data.kind,'calibration-not-heldout');assert.equal(data.samples.length,3);
  assert.equal(data.samples.reduce((n,s)=>n+s.marks.length,0),31);
  assert.ok(data.samples.every(s=>s.marks.every(w=>s.text.includes(w))));
});

test('negative adjective predicates and modal actions keep their attached negation at every density',()=>{
  for(const [text,wanted,forbidden]of [
    ['这个结果并不稳定。','并不稳定','稳定'],
    ['申请不能自动通过。','不能自动通过','自动通过'],
    ['没有完成审核。','没有完成审核','完成审核'],
    ['项目并不意味着完全失败。','并不意味着完全失败','失败']
  ]){
    assert.ok(constructions(text).includes(wanted),JSON.stringify({text,actual:constructions(text)}));
    for(const chunkDensity of ['light','balanced','more'])assert.ok(!pieces(text,{chunkDensity}).includes(forbidden));
  }
});
test('selected amounts retain units and distinguish a change from its result',()=>{
  const text='价格降低了20元，另一个套餐降低到20元。';const actual=constructions(text);
  assert.ok(actual.includes('降低了20元'));assert.ok(actual.includes('降低到20元'));
  for(const bad of ['降低','20','元'])assert.ok(!actual.includes(bad));
  for(const [text,wanted]of [['电量不足20%时请充电。','不足20%'],['温度不要超过37.5℃。','不要超过37.5℃']])assert.ok(constructions(text).includes(wanted));
  for(const text of ['费用为10-20元。','比例约20%-30%。']){
    const tokens=ReadingCuesChunks.tokenize(text);assert.ok(tokens.some(t=>['10-20元','20%-30%'].includes(t.word)));
    assert.ok(!tokens.some(t=>/^-(?:20元|30%)$/u.test(t.word)));
  }
});
test('date and clock syntax stays intact without crossing whitespace or sentence punctuation',()=>{
  const text='🌿时间为2026年10月20日18:30，费用12.5元。';
  const actual=constructions(text);assert.ok(actual.includes('2026年10月20日18:30'));assert.ok(actual.includes('12.5元'));
  const spaced='2026年10月20日 18:30。明天再来';
  assert.ok(constructions(spaced).every(t=>!/[\s。]/u.test(t)));
  assert.ok(constructions('不要超过37.5℃，请关闭设备。').every(t=>!/[，。]/u.test(t)));
});
test('adverbial endings and bare modal helpers are not completed phrase candidates',()=>{
  for(const text of ['项目并没有达到预定目标，也不意味着完全失败。','只有提交完整材料，申请才能进入审核。']){
    const actual=constructions(text);
    for(const bad of ['没有','不意味着完全','才能'])assert.ok(!actual.includes(bad),JSON.stringify({text,actual}));
  }
});
