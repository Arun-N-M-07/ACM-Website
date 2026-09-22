#!/usr/bin/env node
/**
 * Scans /public for optional media + model files and writes a manifest of what
 * actually exists. The experience only requests files listed here, so missing
 * photographs / GLB models degrade to procedural stand-ins without 404 noise.
 *
 * Runs automatically before `dev` and `build`. Run manually with `npm run media:scan`.
 */
import { readdirSync, statSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const root = process.cwd();
const publicDir = join(root, 'public');
const scanDirs = ['media', 'models', 'brand', 'audio'];
const exts = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.glb', '.gltf', '.svg', '.mp3', '.m4a', '.aac', '.ogg', '.opus', '.wav', '.flac']);

function walk(dir, out) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else {
      const dot = name.lastIndexOf('.');
      if (dot >= 0 && exts.has(name.slice(dot).toLowerCase())) {
        out.push('/' + relative(publicDir, full).split(sep).join('/'));
      }
    }
  }
  return out;
}

const files = scanDirs.flatMap((d) => walk(join(publicDir, d), [])).sort();
const outDir = join(root, 'src', 'content', 'generated');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'available-assets.json'), JSON.stringify({ files }, null, 2) + '\n');
console.log(`[media:scan] ${files.length} optional asset(s) available`);
