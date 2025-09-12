// Usage:
// 1) Place your source logo at public/app-icon-source.png (ideally 1024x1024 PNG with transparent or solid background)
// 2) Install deps: pnpm add -D sharp png-to-ico
// 3) Run: pnpm exec node scripts/generate-icons.mjs  (or add a script: "icons:gen")
// Outputs to public/:
//   - app-icon-512.png
//   - app-icon.png (192x192)
//   - app-icon-maskable.png (512x512 with safe padding for maskable shapes)
//   - favicon-16.png, favicon-32.png, favicon-48.png, favicon.ico

import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const root = path.resolve(process.cwd());
const pub = path.join(root, 'public');
const src = path.join(pub, 'app-icon-source.png');

async function ensureExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function main() {
  if (!(await ensureExists(src))) {
    console.error('Source image not found:', src);
    console.error('Please save your PNG to public/app-icon-source.png and rerun.');
    process.exit(1);
  }

  const out512 = path.join(pub, 'app-icon-512.png');
  const out192 = path.join(pub, 'app-icon.png'); // 192x192
  const outMask = path.join(pub, 'app-icon-maskable.png');
  const fav16 = path.join(pub, 'favicon-16.png');
  const fav32 = path.join(pub, 'favicon-32.png');
  const fav48 = path.join(pub, 'favicon-48.png');
  const favIco = path.join(pub, 'favicon.ico');

  // Read and normalize
  const base = sharp(src).png({ compressionLevel: 9 });

  // 512x512 main icon
  await base.clone().resize(512, 512, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } }).toFile(out512);

  // 192x192 app icon
  await base.clone().resize(192, 192, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } }).toFile(out192);

  // Maskable: add 12% padding inside a 512 canvas to respect mask safe area
  const PAD = Math.round(512 * 0.12);
  const inner = 512 - PAD * 2;
  const padded = await base.clone().resize(inner, inner, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .extend({ top: PAD, right: PAD, bottom: PAD, left: PAD, background: { r: 255, g: 255, b: 255, alpha: 0 } })
    .toBuffer();
  await sharp(padded).png({ compressionLevel: 9 }).toFile(outMask);

  // Favicons
  await base.clone().resize(16, 16).toFile(fav16);
  await base.clone().resize(32, 32).toFile(fav32);
  await base.clone().resize(48, 48).toFile(fav48);

  const icoBuf = await pngToIco([fav16, fav32, fav48]);
  await fs.writeFile(favIco, icoBuf);

  console.log('Icons generated:');
  console.log('-', path.relative(root, out512));
  console.log('-', path.relative(root, out192));
  console.log('-', path.relative(root, outMask));
  console.log('-', path.relative(root, favIco));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
