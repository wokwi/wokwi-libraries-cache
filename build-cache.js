import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { rimrafSync } from 'rimraf';
import presets from './presets.json' with { type: 'json' };

const CACHE_DIR = resolve(new URL('.', import.meta.url).pathname, 'cache');

function hashLibraryList(libs) {
  const list = Array.from(new Set(libs)).sort().join('\n');
  return createHash('sha256').update(list).digest('hex');
}

if (existsSync(CACHE_DIR)) {
  rimrafSync(CACHE_DIR);
}

mkdirSync(CACHE_DIR, { recursive: true });
let index = [];
for (const libs of presets) {
  const hash = hashLibraryList(libs);
  console.log(hash);
  for (const lib of libs) {
    console.log(` -> ${lib}`);
  }

  const cache = resolve(CACHE_DIR, `libraries-${hash}.tar.zst`);
  const dir = `tmp/${hash}`;
  const absDir = resolve(dir);
  mkdirSync(dir, { recursive: true });
  const libVars = libs.map((_, index) => `"$L_${index}"`);
  const libCmd = `arduino-cli lib install -- ${libVars.join(' ')}`;
  try {
    execSync(libCmd, {
      cwd: dir,
      env: {
        HOME: process.env.HOME ?? '',
        PATH: process.env.PATH ?? '',  
        ARDUINO_SKETCHBOOK_DIR: absDir,
        ...Object.fromEntries(libs.map((libName, index) => [`L_${index}`, libName])),
      }
    });
    writeFileSync(`${absDir}/libraries/index.txt`, libs.sort().join('\n'));
    writeFileSync(`${absDir}/libraries/libraries_hash.txt`, hash);
    execSync(`tar -cf - -C ${absDir}/libraries . | zstd -19 -T0 - > ${cache}`);
  } finally {
    rimrafSync(absDir);
  }
  index.push(hash);
}

writeFileSync(resolve(CACHE_DIR, 'index.json'), JSON.stringify(index, null, 2));
writeFileSync(resolve(CACHE_DIR, 'index.txt'), index.join('\n') + '\n');
