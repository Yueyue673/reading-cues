import {mkdir, readFile, writeFile, copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflateSync} from 'node:zlib';
import '../src/core.js';
import '../src/renderer.js';
import '../src/reading-aids.js';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dest = path.join(root, 'dist', 'extension');
const files = ['core.js','chunker.js','renderer.js','reading-aids.js','content.js','background.js','manifest.json','ui.css','ui-common.js',
  'popup.html','popup.js','options.html','options.js','demo.html','demo.js','compare.html','compare.css','compare.js','annotations.js'];
await mkdir(path.join(dest, 'icons'), {recursive: true});
const lexicon = JSON.parse(await readFile(path.join(root, 'src', 'lexicon.json'), 'utf8'));
ReadingCues.validateLexicon(lexicon);
for (const file of files) await copyFile(path.join(root, 'src', file), path.join(dest, file));
await writeFile(path.join(dest, 'lexicon.js'), `/* Original local lexicon. Generated from src/lexicon.json. */\nglobalThis.ReadingCuesLexicon = ${JSON.stringify(lexicon)};\n`);
const pos=await readFile(path.join(root,'src','data','pos.tsv'),'utf8');
await writeFile(path.join(dest,'pos-data.js'),`/* Local POS hints, derived from jieba (MIT). See licenses/jieba-MIT.txt. */\nglobalThis.ReadingCuesPOSData=${JSON.stringify(pos)};\n`);
await mkdir(path.join(dest,'licenses'),{recursive:true});
await copyFile(path.join(root,'licenses','jieba-MIT.txt'),path.join(dest,'licenses','jieba-MIT.txt'));
const calibration=JSON.parse(await readFile(path.join(root,'tests','fixtures','user-annotations.json'),'utf8')).samples;
const challenges=JSON.parse(await readFile(path.join(root,'src','data','challenge-passages.json'),'utf8'));
await writeFile(path.join(dest,'comparison-data.js'),`/* Original examples; the first three are calibration, not held-out evaluation. */\nglobalThis.ReadingCuesComparisonData=${JSON.stringify([...calibration,...challenges])};\n`);
await writeFile(path.join(dest, 'highlights.css'), ReadingCuesRenderer.cssText);
await writeFile(path.join(dest, 'aids.css'), ReadingCuesAids.cssText);
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) { crc ^= byte; for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type), out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length); name.copy(out, 4); data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([name, data])), 8 + data.length); return out;
}
function icon(size) {
  const rows = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = (x + .5) / size, py = (y + .5) / size;
    const dx = Math.max(.18 - px, 0, px - .82), dy = Math.max(.18 - py, 0, py - .82);
    let color = dx * dx + dy * dy > .18 ** 2 ? [0,0,0,0] : [49,94,75,255];
    const line = (Math.abs(py-.33)<.025 && px>.25 && px<.72) || (Math.abs(py-.50)<.025 && px>.25 && px<.62) || (Math.abs(py-.67)<.025 && px>.25 && px<.72);
    if (line) color = [246,244,232,255];
    if ((px-.72)**2 + (py-.5)**2 < .038**2) color = [218,187,116,255];
    for (let c = 0; c < 4; c++) rows[y * (size * 4 + 1) + 1 + x * 4 + c] = color[c];
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(rows)), chunk('IEND', Buffer.alloc(0))]);
}
for (const size of [16,32,48,128]) await writeFile(path.join(dest, 'icons', `${size}.png`), icon(size));
console.log(`Built ${path.relative(root, dest)} · ${lexicon.entries.length} original rules · no runtime dependencies`);
