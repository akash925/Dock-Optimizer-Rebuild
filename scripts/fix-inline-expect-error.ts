import { globbySync } from 'globby';
import fs from 'node:fs';

const files = globbySync('client/**/*.tsx');   // adjust the glob if needed
const INLINE_EXPECT = /^\s*\/\/\s*@ts-expect-error[^\n]*\n?/gm;

for (const path of files) {
  const src = fs.readFileSync(path, 'utf8');
  if (INLINE_EXPECT.test(src)) {
    const cleaned = src.replace(INLINE_EXPECT, '');
    fs.writeFileSync(path, cleaned);
    console.log('✅ removed inline expects →', path);
  }
}
