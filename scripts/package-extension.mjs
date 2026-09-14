import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

// Dependency-free ZIP (stored entries), deterministic for the same source.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entries = (await readdir(resolve(root, 'chrome-extension'))).filter(name => /\.(json|js|html|css|md)$/.test(name)).sort();
const local = [], central = [];
let offset = 0;
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
for (const name of entries) {
  const data = await readFile(resolve(root, 'chrome-extension', name)), filename = Buffer.from(name), crc = crc32(data);
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6); header.writeUInt16LE(33, 12);
  header.writeUInt32LE(crc, 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(data.length, 22); header.writeUInt16LE(filename.length, 26);
  const directory = Buffer.alloc(46);
  directory.writeUInt32LE(0x02014b50); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6); directory.writeUInt16LE(0x800, 8); directory.writeUInt16LE(33, 14);
  directory.writeUInt32LE(crc, 16); directory.writeUInt32LE(data.length, 20); directory.writeUInt32LE(data.length, 24); directory.writeUInt16LE(filename.length, 28); directory.writeUInt32LE(offset, 42);
  local.push(header, filename, data); central.push(directory, filename); offset += header.length + filename.length + data.length;
}
const centralSize = central.reduce((sum, part) => sum + part.length, 0), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
await mkdir(resolve(root, 'public'), { recursive: true });
await writeFile(resolve(root, 'public/browser-extension.zip'), Buffer.concat([...local, ...central, end]));
console.log(`Packaged ${entries.length} extension files.`);
