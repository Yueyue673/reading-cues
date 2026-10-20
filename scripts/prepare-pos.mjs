// Reproduce the compact offline POS dictionary from the pinned jieba source.
// Input is a local upstream dict.txt; this script never accesses the network.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const file=process.argv[2]||'artifacts/jieba-dict.txt';
const source=await readFile(file),rows=[];
if(createHash('sha256').update(source).digest('hex')!=='7197c3211ddd98962b036cdf40324d1ea2bfaa12bd028e68faa70111a88e12a8')throw new Error('Source does not match the documented pinned dictionary');
for(const line of source.toString('utf8').split(/\r?\n/u)){
  const [word,frequency,tag]=line.split(' ');
  if(+frequency>=20&&word.length<=8&&/^[\p{Script=Han}]+$/u.test(word))rows.push(`${word}\t${tag}\t${Math.round(Math.log(+frequency)*10)}`);
}
await mkdir('src/data',{recursive:true});await mkdir('licenses',{recursive:true});
await writeFile('src/data/pos.tsv',rows.join('\n')+'\n');
await writeFile('licenses/jieba-MIT.txt',await readFile(process.argv[3]||'artifacts/jieba-LICENSE.txt'));
console.log(JSON.stringify({sourceSHA256:createHash('sha256').update(source).digest('hex'),entries:rows.length,bytes:Buffer.byteLength(rows.join('\n')+'\n')}));
