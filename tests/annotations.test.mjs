import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/annotations.js';
const session=()=>ReadingCuesAnnotations.create();

test('annotations identify a particular repeated occurrence with raw UTF-16 offsets',()=>{
  const s=session(),text='🌿完整词组，然后再次出现完整词组。',start=text.lastIndexOf('完整词组');
  s.add(text,start,start+4,{id:'repeat'});
  const data=JSON.parse(s.exportJSON());assert.equal(data.offsets,'UTF-16');
  assert.deepEqual(data.samples[0].spans,[{start,end:start+4,text:'完整词组'}]);
  assert.equal(data.samples[0].reviewed,false);
  assert.throws(()=>s.add(text,1,4),/完整字符/u);
  assert.throws(()=>s.add(text,-1,4));assert.throws(()=>s.add(text,3,text.length+1));
});
test('overlapping selections replace exact boundaries; adjacent phrases and undo are preserved',()=>{
  const s=session(),text='完整词组需要保留';s.add(text,0,2);s.add(text,2,4);
  assert.equal(s.get(text).spans.length,2);s.add(text,0,4);
  assert.deepEqual(s.get(text).spans.map(x=>x.text),['完整词组']);s.undo(text);
  assert.deepEqual(s.get(text).spans.map(x=>x.text),['完整','词组']);
  s.complete(text);assert.equal(s.get(text).reviewed,true);s.remove(text,0,2);
  assert.equal(s.get(text).reviewed,false);s.undo(text);assert.equal(s.get(text).reviewed,true);
  s.clear(text);assert.equal(s.get(text).spans.length,0);s.undo(text);assert.equal(s.get(text).spans.length,2);
});
test('a confirmed empty review differs from an untouched sample and drafts do not become references',()=>{
  const s=session();assert.equal(JSON.parse(s.exportJSON()).samples.length,0);
  s.complete('这一段不需要标记');s.add('另一个草稿',0,2);
  const data=JSON.parse(s.exportJSON());assert.equal(data.samples[0].reviewed,true);assert.deepEqual(data.samples[0].spans,[]);
  assert.equal(data.samples[1].reviewed,false);assert.equal(JSON.parse(s.exportJSON('另一个草稿')).samples.length,1);
  assert.deepEqual(Object.keys(data.samples[0]).sort(),['id','reviewed','spans','text','title']);
});
test('review state cannot be mutated through returned data and has text/session bounds',()=>{
  const s=session();s.add('完整词组',0,4);s.get('完整词组').spans[0].end=1;
  assert.equal(s.get('完整词组').spans[0].end,4);
  assert.throws(()=>s.add('a'.repeat(8001),0,2));assert.throws(()=>s.add('a'.repeat(81),0,81));
  for(let i=0;i<19;i++)s.complete('段落'+i);
  assert.equal(s.size,20);assert.throws(()=>s.complete('超出数量'),/20 段/u);
});
