# Image Compression in Add/Edit Car

This app now compresses images on the client before they are added/sent in the Add/Edit Car page (`app/components/add-edit-car.tsx`). The goal is to save storage/bandwidth while keeping high visual quality when an image is viewed fullscreen on a ~9" tablet.

## Strategy

- Limit the long edge to a maximum of 2560 px. Smaller images are left at their original size.
- Prefer WebP output at quality ≈ 0.82 if the browser supports it; otherwise fall back to JPEG at quality ≈ 0.86.
- High quality downscale using canvas with `imageSmoothingQuality = 'high'`.
- Sequential compression for selected files to avoid memory spikes on low-end devices.

These settings target good perceived quality on tablet-size screens with significant size savings compared to uploading raw photos.

## Implementation

- The compression logic lives near the top of `app/components/add-edit-car.tsx` as small helpers:
  - `compressImage(file: File): Promise<File>`
  - `getTargetSize(width, height)` and `canvasToBlob(...)` utilities
  - WebP/JPEG selection based on runtime support
- The file input handler `handleFileChange` compresses images before adding them to `displayedImages`. The compressed `File` objects are subsequently appended in `handleSubmit`.

## Tunables

You can tweak the following constants in `add-edit-car.tsx`:

- `MAX_DIMENSION` (default: `2560`) – the maximum long-edge in pixels
- `WEBP_QUALITY` (default: `0.82`) – output quality when using WebP
- `JPEG_QUALITY` (default: `0.86`) – output quality when falling back to JPEG

Increase quality to reduce compression artifacts at the cost of larger files. Decrease for more savings when bandwidth/storage is critical.

## Fallbacks and Compatibility

- If `createImageBitmap` isn't available, we fall back to decoding via `Image` element.
- If WebP isn't supported for `canvas.toDataURL('image/webp')`, we fall back to JPEG.
- If compression fails for any file, the original file is used.

## Notes

- Titles on submission still use the original filename base with a `-compressed` suffix.
- Object URLs are created for preview and will be revoked when images are removed.

## Why 2560 px?

A 9" tablet in landscape often ranges between ~2048×1536 and ~2560×1600 logical pixels. Limiting the long edge to 2560 keeps excellent fullscreen quality while providing meaningful size reduction for typical camera photos (often 3K–8K on the long edge).
