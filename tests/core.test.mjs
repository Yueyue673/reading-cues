import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import '../src/core.js';
const Core = globalThis.ReadingCues;
const lexicon = JSON.parse(readFileSync(new URL('../src/lexicon.json', import.meta.url), 'utf8'));
const matcher = Core.createMatcher(lexicon);
const marks = (text, settings = {}, options = {budget:false}) => Core.createMatcher(lexicon, settings).match(text, options).map(g => g.spans.map(s => text.slice(s.start,s.end)));

test('lexicon is structurally valid, IDs and original provenance are present', () => {
  assert.equal(Core.validateLexicon(lexicon),lexicon);
  assert.ok(lexicon.entries.every(e => e.source.startsWith('original:')));
  assert.throws(() => Core.validateLexicon({...lexicon,entries:[lexicon.entries[0],lexicon.entries[0]]}));
});
for (const entry of lexicon.entries) {
  const ruleMatcher = Core.createMatcher({...lexicon,entries:[entry]});
  for (const example of entry.examples.positive) test(`${entry.id}: positive ${example.text}`, () => {
    const found = ruleMatcher.match(example.text,{budget:false}).filter(g => g.id === entry.id);
    assert.ok(found.length,`expected ${entry.id}`);
    assert.deepEqual(found[0].spans.map(s => example.text.slice(s.start,s.end)),example.marks);
  });
  for (const example of entry.examples.negative) test(`${entry.id}: negative ${example}`, () => {
    assert.equal(ruleMatcher.match(example,{budget:false}).filter(g => g.id === entry.id).length,0);
  });
}
test('never treats single 不 as a negation or guesses an idiom outcome', () => {
  assert.deepEqual(marks('差点没赶上车。'),[]);
  assert.deepEqual(marks('不但支持中文，还支持英文。'),[['不但']]);
  assert.deepEqual(marks('不得不离开。'),[['不得不']]);
  assert.ok(!marks('并不是这样。').flat().includes('不'));
});
test('complete long expressions win over shorter nested personal words', () => {
  assert.deepEqual(marks('这并非所有人的目标。',{personal:['并非','并非所有']}),[['并非所有']]);
});
test('personal words deliberately override automatic annotation', () => {
  assert.deepEqual(marks('只有开启后才会生效。',{personal:['开启']}),[['只有','才'],['开启']]);
  assert.deepEqual(marks('不但支持中文。',{personal:['不但']}),[['不但']]);
});
test('ignore wins, and removes both halves of a paired expression', () => {
  assert.deepEqual(marks('只有开启后才会生效。',{ignored:['只有']}),[]);
  assert.deepEqual(marks('工作记忆与不一定。',{personal:['工作记忆'],ignored:['工作记忆','不一定']}),[]);
});
test('pairs do not cross punctuation, line breaks, or excessive gaps', () => {
  for(const middle of ['。','；','！','\n','a'.repeat(81)]) assert.deepEqual(marks(`只有开启${middle}才生效。`),[]);
});
test('paired markers are not duplicated as a standalone contrast', () => {
  assert.deepEqual(marks('虽然页面很长，但是仍然完整。'),[['虽然','但是']]);
});
test('two complete pairs can appear in one paragraph without reusing a closer', () => {
  assert.deepEqual(marks('只有先保存才生效，只有刷新才可见。'),[['只有','才'],['只有','才']]);
});
test('category toggles do not disable personal words', () => {
  assert.deepEqual(marks('不一定与工作记忆。',{categories:[],personal:['工作记忆']}),[['工作记忆']]);
});
test('paragraph budget applies to complete groups and selected-character density', () => {
  const text = '只有先完成全部准备工作才可以开始，然而这不一定意味着成功，并非所有建议都适合每个人。';
  for(const maxGroups of [1,2,3]) {
    const groups=Core.createMatcher(lexicon,{maxGroups}).match(text);
    assert.ok(groups.length <= maxGroups);
    assert.ok(groups.reduce((n,g)=>n+g.spans.reduce((m,s)=>m+s.end-s.start,0),0)<=Core.paragraphBudget(text,maxGroups).characters);
    assert.ok(groups.filter(g=>g.id.startsWith('condition')).every(g=>g.spans.length===2));
  }
});
test('emoji preceding a cue keeps UTF-16 offsets correct for DOM Range', () => {
  assert.deepEqual(marks('🌿这不一定更轻松。'),[['不一定']]);
});
test('literal personal words are never evaluated as regular expressions', () => {
  assert.deepEqual(marks('表达 a+b 与 [词]。',{categories:[],personal:['a+b','[词]']}),[['a+b'],['[词]']]);
});
test('pause returns no matches',()=>assert.deepEqual(marks('不一定。',{enabled:false}),[]));
test('settings normalize untrusted storage and maintain independent defaults',()=>{
  assert.deepEqual(Core.normalizeSettings(null),Core.normalizeSettings());
  const data=Core.normalizeSettings({style:'script',maxGroups:999,categories:['condition','bad'],personal:['词语','词语'],ignored:['<script>']});
  assert.equal(data.style,'background');assert.equal(data.maxGroups,0);assert.deepEqual(data.categories,['condition']);assert.deepEqual(data.personal,['词语']);assert.deepEqual(data.ignored,[]);
});
test('import/export roundtrip only includes personal and ignored lists',()=>{
  const raw=Core.exportDictionary({personal:['工作记忆'],ignored:['然而'],sites:['https://private.example/*']});
  assert.deepEqual(Core.parseImport(raw),{personal:['工作记忆'],ignored:['然而']});assert.ok(!raw.includes('private'));
});
test('malformed / oversized / control-character imports are rejected atomically',()=>{
  for(const raw of ['{','{}',JSON.stringify({schemaVersion:2,personal:[],ignored:[]}),JSON.stringify({schemaVersion:1,personal:['坏\n词'],ignored:[]}),JSON.stringify({schemaVersion:1,personal:['词语'.repeat(41)],ignored:[]}),JSON.stringify({schemaVersion:1,personal:Array(301).fill('词语'),ignored:[]}), ' '.repeat(100001)])assert.throws(()=>Core.parseImport(raw));
});
test('site permission patterns are exact hosts with safe schemes',()=>{
  assert.equal(Core.sitePattern('https://example.com:8080/a?q=secret'),'https://example.com/*');
  assert.equal(Core.sitePattern('http://sub.example.com/'),'http://sub.example.com/*');
  for(const s of ['chrome://extensions','file:///test','javascript:alert(1)','nonsense'])assert.equal(Core.sitePattern(s),null);
});
