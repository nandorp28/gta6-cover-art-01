// Vice City Nights — a gta6-cover-art-01 entry (Node 22, standard library only).
// The app is this directory's app/ folder, plain static files a desktop browser
// loads offline (app/index.html and its ES modules, no library and no network
// request), and the program hands it in: it copies app/ and screenshots/ from
// beside this file to /output and writes /output/dossier.json, the summary the
// judge reads, with the vendored make.fun library.
//
// The app turns a person's photos + caption into multi-panel GTA-style poster
// art — four layouts, three Vice City colour grades, per-panel crop/position,
// and PNG exports at 1080x1080, 1080x1350 and 1920x1080. Its two sample photos
// (app/samples/) were made for make.fun with an image model and are free to use.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

/** Recursively counts the files and bytes under a directory (no symlinks in app/). */
function treeTotals(dir) {
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      const sub = treeTotals(p);
      files += sub.files;
      bytes += sub.bytes;
    } else if (entry.isFile()) {
      files += 1;
      bytes += statSync(p).size;
    }
  }
  return { files, bytes };
}

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Pre-flight: refuse a build that is missing its entry point or its screenshots,
// so a broken hand-in fails loudly here instead of silently at the gate.
const appIndex = join(here, 'app', 'index.html');
if (!existsSync(appIndex)) throw new Error(`missing app entry point: ${appIndex}`);
const shotsDir = join(here, 'screenshots');
const shotFiles = existsSync(shotsDir)
  ? readdirSync(shotsDir).filter((f) => !f.startsWith('.') && /\.(png|jpe?g)$/i.test(f))
  : [];
if (shotFiles.length < 3 || shotFiles.length > 4) {
  throw new Error(`expected 3 or 4 screenshots, found ${shotFiles.length}`);
}
for (const f of shotFiles) {
  if (statSync(join(shotsDir, f)).size > 262144) throw new Error(`screenshot over 256 KiB: ${f}`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of app
// files, in all, or a path under app/ over 1000 bytes: app/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);

// Build summary on stdout so a local run shows what was handed in, and a
// second gate-cap check on the app tree itself (<=993 files, <=48 MiB).
const appTotals = treeTotals(join(here, 'app'));
if (appTotals.files > 993 || appTotals.bytes > 50331648) {
  throw new Error(`app/ over gate caps: ${appTotals.files} files, ${appTotals.bytes} bytes`);
}
const dossierBytes = statSync(join(out, 'dossier.json')).size;
console.log(`vice-city-nights: wrote ${out} (app/ ${appTotals.files} files, ${appTotals.bytes} bytes + ${shotFiles.length} screenshots + dossier.json ${dossierBytes} bytes)`);
