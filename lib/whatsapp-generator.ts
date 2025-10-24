interface CarData {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  coverImage: string;
  kilometers?: number;
}

interface GenerationResult {
  success: boolean;
  count?: number;
  error?: string;
}

export async function generateWhatsAppImages(selectedCarIds: string[]): Promise<GenerationResult> {
  try {
    // 1. Fetch car data from API
    const response = await fetch('/api/whatsapp/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ selectedCarIds })
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error };
    }

    const { generationId, cars } = await response.json();

    // 2. Generate images for each car
    const generatedImages: Blob[] = [];

    for (const car of cars) {
      try {
        const imageBlob = await generateCarImage(car);
        generatedImages.push(imageBlob);
      } catch (error) {
        console.error(`Failed to generate image for car ${car.id}:`, error);
      }
    }

    if (generatedImages.length === 0) {
      return { success: true, count: 0 };
    }

    // 3. Download images to gallery
    await downloadImagesToGallery(generatedImages, cars);

    // 4. Update generation status (only if something was generated)
    await fetch('/api/whatsapp/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        generationId,
        status: 'completed'
      })
    });

    return { success: true, count: generatedImages.length };

  } catch (error) {
    console.error('WhatsApp generation error:', error);
    return { success: false, error: 'Generation failed' };
  }
}

async function generateCarImage(car: CarData): Promise<Blob> {
  return new Promise(async (resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Canvas not supported'));
      return;
    }

    // WhatsApp Status dimensions (9:16 aspect ratio)
    canvas.width = 1080;
    canvas.height = 1920;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const minTextBoxHeight = 420; // reserve space for two lines
        const availableImageHeight = canvas.height - minTextBoxHeight;

        // Optional background to avoid transparency in JPEG
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const scale = Math.min(canvas.width / img.width, availableImageHeight / img.height);
        const drawWidth = Math.round(img.width * scale);
        const drawHeight = Math.round(img.height * scale);
        const drawX = Math.round((canvas.width - drawWidth) / 2);
        const drawY = Math.round((availableImageHeight - drawHeight) / 2);

        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

        const textTop = availableImageHeight;
        ctx.fillStyle = 'black';
        ctx.fillRect(0, textTop, canvas.width, canvas.height - textTop);

        ctx.textAlign = 'center';
        ctx.fillStyle = 'white';

        const price = new Intl.NumberFormat('en-ZA', {
          style: 'currency',
          currency: 'ZAR',
          minimumFractionDigits: 0
        }).format(car.price);
        const kmText = typeof car.kilometers === 'number' ? `${car.kilometers.toLocaleString()} km` : '';
        const topRow = `${car.year} ${car.model}`;
        const bottomRow = kmText ? `${kmText}  ${price}` : `${price}`;

        const margin = 48;

        const fitAndDraw = (text: string, baseSize: number, y: number) => {
          let size = baseSize;
          const family = 'Arial, sans-serif';
          if (typeof (ctx as any).measureText === 'function') {
            while (size > 24) {
              ctx.font = `bold ${size}px ${family}`;
              const w = ctx.measureText(text).width;
              if (w <= canvas.width - margin * 2) break;
              size -= 2;
            }
          } else {
            ctx.font = `bold ${size}px ${family}`;
          }
          ctx.fillText(text, canvas.width / 2, y);
        };

        const topY = textTop + 120;
        const bottomY = textTop + 240;
        fitAndDraw(topRow, 72, topY);
        fitAndDraw(bottomRow, 96, bottomY);

        // Convert to blob
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create image blob'));
          }
        }, 'image/jpeg', 0.9);

      } catch (error) {
        reject(error);
      }
    };

    img.onerror = () => reject(new Error('Failed to load car image'));
    try {
      // Prefetch image via same-origin proxy to avoid CORS and tainted canvas
      const proxied = `/api/image-proxy?src=${encodeURIComponent(car.coverImage)}`;
      const resp = await fetch(proxied, { credentials: 'include', mode: 'cors' as RequestMode });
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      img.src = url;
    } catch (e) {
      reject(e instanceof Error ? e : new Error('Failed to fetch car image'));
      return;
    }
  });
}

async function downloadImagesToGallery(images: Blob[], cars: CarData[]): Promise<void> {
  for (let i = 0; i < images.length; i++) {
    const blob = images[i];
    const car = cars[i];

    // Create filename
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const filename = `WhatsApp-${car.year}-${car.make}-${car.model}-${timestamp}.jpg`;

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    (link as HTMLAnchorElement).download = filename;
    (link as HTMLAnchorElement).rel = 'noopener';

    // Trigger download; appending to DOM improves reliability in Chrome/Safari
    try {
      if (document && typeof document.body?.appendChild === 'function') {
        document.body.appendChild(link);
        (link as HTMLAnchorElement).click();
        document.body.removeChild(link);
      } else {
        (link as HTMLAnchorElement).click();
      }
    } catch {
      // best-effort fallback
      try { (link as HTMLAnchorElement).click(); } catch {}
      try {
        const anyWin: any = window as any;
        if (typeof anyWin.showSaveFilePicker === 'function') {
          const handle = await anyWin.showSaveFilePicker({
            suggestedName: filename,
            types: [{ description: 'JPEG Image', accept: { 'image/jpeg': ['.jpg', '.jpeg'] } }]
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
        } else {
          window.open?.(url, '_blank', 'noopener,noreferrer');
        }
      } catch {}
    }

    // Cleanup
    URL.revokeObjectURL(url);

    // Small delay between downloads to avoid browser blocking
    if (i < images.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}
