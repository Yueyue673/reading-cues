import './build.mjs';
import {readdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {deflateRawSync} from 'node:zlib';
import {root} from './build.mjs';
const dir = path.join(root, 'dist', 'extension');
const {version} = JSON.parse(await readFile(path.join(dir, 'manifest.json'), 'utf8'));
async function walk(folder, prefix = '') {
  const files = [];
  for (const entry of (await readdir(folder, {withFileTypes:true})).sort((a,b) => a.name.localeCompare(b.name))) {
    const relative = prefix + entry.name;
    if (entry.isDirectory()) files.push(...await walk(path.join(folder, entry.name), relative + '/'));
    else files.push({name:relative, data:await readFile(path.join(folder, entry.name))});
  }
  return files;
}
function crc32(data) { let crc=0xffffffff; for(const byte of data){crc^=byte;for(let k=0;k<8;k++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return(crc^0xffffffff)>>>0; }
const files = await walk(dir);
files.push({name:'LICENSE', data:await readFile(path.join(root,'LICENSE'))});
files.push({name:'INSTALL.txt', data:Buffer.from('轻读 Reading Cues\n\n1. 解压整个 ZIP 文件到固定目录。\n2. 在 Chrome 打开 chrome://extensions ，或在 Edge 打开 edge://extensions 。\n3. 打开“开发者模式”，点击“加载已解压的扩展程序”，选择包含 manifest.json 的目录。\n4. 打开普通网页即可自动提示，无需逐个网站开启。安装或升级时请确认浏览器的网站访问权限。\n5. 双击 compare.html 对照与标注，demo.html 体验样式。标注仅在本页暂存，请主动导出保留记录。\n\n源码与隐私说明：https://github.com/Yueyue673/reading-cues\n')});
const local = [], central = []; let offset = 0;
for (const file of files) {
  const name = Buffer.from(file.name), compressed = deflateRawSync(file.data), crc = crc32(file.data);
  const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20,4); header.writeUInt16LE(0x800,6); header.writeUInt16LE(8,8);
  header.writeUInt16LE(0x5d54,12); header.writeUInt32LE(crc,14); header.writeUInt32LE(compressed.length,18); header.writeUInt32LE(file.data.length,22); header.writeUInt16LE(name.length,26);
  local.push(header,name,compressed);
  const record = Buffer.alloc(46); record.writeUInt32LE(0x02014b50); record.writeUInt16LE(20,4); record.writeUInt16LE(20,6); record.writeUInt16LE(0x800,8); record.writeUInt16LE(8,10);
  record.writeUInt16LE(0x5d54,14); record.writeUInt32LE(crc,16); record.writeUInt32LE(compressed.length,20); record.writeUInt32LE(file.data.length,24); record.writeUInt16LE(name.length,28); record.writeUInt32LE(offset,42);
  central.push(record,name); offset += header.length + name.length + compressed.length;
}
const directory = Buffer.concat(central), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length,8); end.writeUInt16LE(files.length,10); end.writeUInt32LE(directory.length,12); end.writeUInt32LE(offset,16);
const target = path.join(root,'dist',`reading-cues-${version}.zip`); const zip = Buffer.concat([...local,directory,end]); await writeFile(target,zip);
console.log(`Packaged ${path.relative(root,target)} · ${files.length} files · ${zip.length} bytes`);
