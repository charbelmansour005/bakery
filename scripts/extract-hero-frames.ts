/**
 * Turns a video into the frame sequence the hero plays as the page scrolls.
 *
 *   npm run hero:frames -- /path/to/video.mov [framesPerSecond] [width]
 *
 * Writes public/images/hero-jar/000.webp, 001.webp, … and lib/hero-frames.json
 * (frame count and size, read by the hero). Re-run it to swap the video; the old
 * frames are replaced.
 *
 * Why frames and not the video itself: scrubbing a video by scroll position
 * needs a keyframe on nearly every frame, which phone recordings do not have, so
 * seeking is slow and jerky. Still images draw instantly, on every browser.
 *
 * Needs Chrome (it does the decoding, so HEVC phone recordings work) and no other
 * tools. The video is served to it from a small local web server, because a
 * video can only seek when the server honours range requests.
 */
import { chromium } from '@playwright/test';
import { createReadStream, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const [, , sourceArg, fpsArg, widthArg] = process.argv;
if (!sourceArg) {
  console.error('Usage: npm run hero:frames -- /path/to/video.mov [framesPerSecond=4] [width=432]');
  process.exit(1);
}

const SOURCE = path.resolve(sourceArg);
const FPS = Number(fpsArg ?? 4);
const WIDTH = Number(widthArg ?? 432);
const OUT_DIR = path.join(process.cwd(), 'public/images/hero-jar');
const MANIFEST = path.join(process.cwd(), 'lib/hero-frames.json');
const QUALITY = 0.74;

const size = statSync(SOURCE).size;
const mime: Record<string, string> = { '.mov': 'video/quicktime', '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm' };
const contentType = mime[path.extname(SOURCE).toLowerCase()] ?? 'video/mp4';

const server = http.createServer((req, res) => {
  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<video id="v" src="/video" muted playsinline preload="auto"></video><canvas id="c"></canvas>');
    return;
  }
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
  const start = range && range[1] ? Number(range[1]) : 0;
  const end = range && range[2] ? Number(range[2]) : size - 1;
  res.writeHead(range ? 206 : 200, {
    'Content-Type': contentType,
    'Accept-Ranges': 'bytes',
    ...(range ? { 'Content-Range': `bytes ${start}-${end}/${size}` } : {}),
    'Content-Length': end - start + 1,
  });
  createReadStream(SOURCE, { start, end }).pipe(res);
});

async function main() {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/`);

  // Page code is passed as text: the script tool rewrites function bodies in a way the page cannot run.
  const meta = (await page.evaluate(`new Promise((resolve) => {
    const v = document.getElementById('v');
    const ok = () => resolve({ ok: true, duration: v.duration, width: v.videoWidth, height: v.videoHeight });
    if (v.readyState >= 2) return ok();
    v.onloadeddata = ok;
    v.onerror = () => resolve({ ok: false });
    setTimeout(() => resolve({ ok: false }), 30000);
  })`)) as { ok: boolean; duration: number; width: number; height: number };
  if (!meta.ok) throw new Error('Chrome could not read that video.');

  const height = Math.round((WIDTH * meta.height) / meta.width / 2) * 2;
  const count = Math.floor(meta.duration * FPS) + 1;
  console.log(`${meta.width}×${meta.height}, ${meta.duration.toFixed(1)}s → ${count} frames at ${WIDTH}×${height}`);

  mkdirSync(OUT_DIR, { recursive: true });
  for (const old of readdirSync(OUT_DIR)) if (old.endsWith('.webp')) rmSync(path.join(OUT_DIR, old));

  let bytes = 0;
  for (let i = 0; i < count; i++) {
    const t = Math.min(i / FPS, meta.duration - 0.05);
    const dataUrl = (await page.evaluate(`new Promise((resolve) => {
      const v = document.getElementById('v'); const c = document.getElementById('c');
      v.onseeked = () => setTimeout(() => {
        c.width = ${WIDTH}; c.height = ${height};
        c.getContext('2d').drawImage(v, 0, 0, ${WIDTH}, ${height});
        resolve(c.toDataURL('image/webp', ${QUALITY}));
      }, 250);
      v.currentTime = ${t};
    })`)) as string;
    const buffer = Buffer.from(dataUrl.split(',')[1], 'base64');
    bytes += buffer.length;
    writeFileSync(path.join(OUT_DIR, `${String(i).padStart(3, '0')}.webp`), buffer);
    if (i % 10 === 0) process.stdout.write(`  ${i}/${count}\r`);
  }

  writeFileSync(MANIFEST, JSON.stringify({ count, width: WIDTH, height, seconds: Number(meta.duration.toFixed(2)) }, null, 2) + '\n');
  console.log(`\nWrote ${count} frames, ${(bytes / 1048576).toFixed(1)} MB in total (${Math.round(bytes / count / 1024)} KB each).`);

  await browser.close();
  server.close();
}

main().catch((err) => {
  console.error('Could not extract frames:', err instanceof Error ? err.message : err);
  server.close();
  process.exit(1);
});
