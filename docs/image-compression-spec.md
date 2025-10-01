# Image Compression – Client-Only Integration (Spec)

This document describes a safe, SSR-compatible approach to add image compression back into the app without reintroducing build/SSR failures.

## Goals
- Avoid SSR build crashes by isolating all browser APIs to a client-only module.
- Keep `app/components/add-edit-car.tsx` simple; compression is an optional enhancement.
- Provide a progressive enhancement path with graceful fallbacks.

## Design

- Create a dedicated client-only helper: `app/components/image-compression.client.ts`.
- Export a single `compressImage(file: File, opts?: CompressOptions): Promise<File>` that only runs in the browser.
- Internally guard browser-only APIs (`createImageBitmap`, `Image`, `canvas`, `FileReader`, `URL`) with `typeof window !== 'undefined'` and capability checks.
- Dynamically import the helper inside `handleFileChange()` in `add-edit-car.tsx` so Next never evaluates it during SSR.

### File: `app/components/image-compression.client.ts`
- Top line: `"use client"`.
- Export types:
  - `interface CompressOptions { maxDimension?: number; qualityWebp?: number; qualityJpeg?: number; targetType?: 'image/webp' | 'image/jpeg'; }`
- Defaults: `maxDimension = 1920`, `qualityWebp = 0.8`, `qualityJpeg = 0.85`, `targetType = 'image/webp'`.
- Steps:
  1. Runtime guard: if `typeof window === 'undefined'`, throw a friendly error (should never happen with dynamic import pattern).
  2. Read the file into an `ImageBitmap` if available, else `HTMLImageElement` fallback.
  3. Compute target width/height preserving aspect ratio limited by `maxDimension`.
  4. Draw to an offscreen `canvas` (or regular `canvas` as fallback).
  5. Convert to `Blob` via `canvas.toBlob` with the chosen MIME and quality; wrap Blob into a new `File`.
  6. Return original file if anything fails.
- Fallback matrix:
  - If `createImageBitmap` not available, use `img.src = URL.createObjectURL(file)` and wait for `onload`.
  - If `canvas.toBlob` returns `null`, return `file`.
  - If target MIME not supported by the browser, fall back to `image/jpeg`.
- Memory hygiene:
  - Revoke all created object URLs after use.

### Usage in `app/components/add-edit-car.tsx`

Inside `handleFileChange(e)`:

```ts
const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  if (!e.target.files) return;
  const files = Array.from(e.target.files);

  // Progressive enhancement: try compression in browser, otherwise fall back to originals
  let processed = files;
  try {
    const { compressImage } = await import('./image-compression.client');
    processed = [];
    for (const f of files) {
      try {
        const cf = await compressImage(f, { maxDimension: 1920, targetType: 'image/webp', qualityWebp: 0.8 });
        processed.push(cf);
      } catch {
        processed.push(f);
      }
    }
  } catch {
    // dynamic import failed (SSR or unsupported) — silently fall back to originals
  }

  const newImages: DisplayImage[] = processed.map(file => ({
    id: uuidv4(),
    url: URL.createObjectURL(file),
    file,
    isNew: true,
  }));
  setDisplayedImages(prev => [...prev, ...newImages]);
  try { e.target.value = ''; } catch {}
};
```

Important: keep the dynamic `import()` inside the handler to ensure it only runs after user interaction, never during SSR.

## SSR Safety Checklist

- Do not import `image-compression.client.ts` at the module top-level of any component. Only dynamic-import inside an event handler or an effect with proper guards.
- Ensure `image-compression.client.ts` starts with `"use client"` and never exported from any server file.
- Avoid browser globals at module scope anywhere (`window`, `document`, `navigator`, `localStorage`, `FileReader`, `Image`, `createImageBitmap`, `URL`). Access them inside functions guarded by `typeof window !== 'undefined'`.
- Keep `next.config.mjs` free from accidental double keys or unstable experimental flags while debugging. We removed duplicate `webpack` and disabled `experimental.optimizePackageImports` during the fix.

## Performance & UX Notes

- Process images sequentially to avoid memory spikes on low-RAM devices.
- Prefer `image/webp` when supported; otherwise use `image/jpeg`.
- Reasonable max dimension: `1600–2048`. 1920 strikes a good balance.
- Show subtle UI feedback (spinner or text) while compressing multiple files.
- Consider skipping compression for very small images (< 200 KB) to save time.

## Error Handling

- Wrap each file’s compression in try/catch and fall back to the original file on error.
- Never block the flow if compression fails — users should still be able to upload.
- Log non-fatal warnings only in development.

## Testing Plan

- Verify `pnpm build` succeeds (SSR safe).
- Run `pnpm dev` and test on Chrome/Android (Web Share + compression), iOS Safari (JPEG fallback), and desktop.
- Check memory usage with multiple large images (5–10 at ~4–8MB each).
- Ensure object URLs are revoked when not needed (e.g., on component unmount or after upload).

## Future Enhancements (Optional)

- Heuristics: compress to a target size range (e.g., 300–800 KB) by iterating quality.
- Use `OffscreenCanvas` when available.
- Preserve orientation via EXIF if needed (read with `createImageBitmap` which often handles orientation; otherwise correct via EXIF parsing library — keep in client-only module).
- Support HEIC/HEIF via browser-native decoders when available; otherwise skip.

## Lessons Learned

- SSR will evaluate module top-level code. Any browser-only access at module scope can crash builds with opaque errors (e.g., `reading 'length'`).
- Keep browser logic isolated and lazy-loaded.
- Prefer event-driven dynamic imports over eager imports in components that render server-side.
- When debugging build errors, simplify `next.config.mjs` and remove duplicate keys to reduce webpack edge cases.
