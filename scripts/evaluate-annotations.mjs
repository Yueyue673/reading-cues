// Calibration comparison only. It is intentionally not part of pass/fail CI.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import '../src/core.js';
import '../src/chunker.js';
globalThis.ReadingCuesPOSData=await readFile(new URL('../src/data/pos.tsv',import.meta.url),'utf8');
const lexicon=JSON.parse(await readFile(new URL('../src/lexicon.json',import.meta.url),'utf8'));
const data=JSON.parse(await readFile(new URL('../tests/fixtures/user-annotations.json',import.meta.url),'utf8'));
const results=[];
for(const settings of [{mode:'words',wordStep:2},{mode:'chunks',chunkDensity:'light'},{mode:'chunks',chunkDensity:'balanced'},{mode:'chunks',chunkDensity:'more'}]){
  const reader=ReadingCues.createReader(lexicon,settings);await reader.prepare?.();let tp=0,predicted=0,expected=0;const samples=[];
  for(const sample of data.samples){
    const wanted=sample.marks.map(word=>({start:sample.text.indexOf(word),end:sample.text.indexOf(word)+word.length}));
    const actual=reader.match(sample.text).flatMap(g=>g.spans);const hits=actual.filter(a=>wanted.some(w=>w.start===a.start&&w.end===a.end)).length;
    tp+=hits;predicted+=actual.length;expected+=wanted.length;
    samples.push({id:sample.id,hits,predicted:actual.length,expected:wanted.length,actual:actual.map(s=>sample.text.slice(s.start,s.end))});
  }
  const precision=tp/predicted,recall=tp/expected;
  results.push({settings,exactMatches:tp,predicted,expected,precision,recall,f1:2*precision*recall/(precision+recall),samples});
}
const result={scope:'Calibration on three provided samples. Not held-out accuracy or reading effectiveness.',matching:'Exact start/end span; the partial 不需要重新 annotation is preserved literally.',results};
await mkdir('artifacts',{recursive:true});await writeFile('artifacts/annotation-calibration.json',JSON.stringify(result,null,2));
for(const r of results)console.log(JSON.stringify({...r,samples:undefined}));
