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
        console.log(`Generating image for car ${car.id}: ${car.year} ${car.make} ${car.model}`);
        const imageBlob = await generateCarImage(car);
        if (imageBlob && imageBlob.size > 0) {
          generatedImages.push(imageBlob);
          console.log(`Successfully generated image for car ${car.id}, size: ${imageBlob.size} bytes`);
        } else {
          console.warn(`Generated empty or null blob for car ${car.id}`);
        }
      } catch (error) {
        console.error(`Failed to generate image for car ${car.id}:`, error);
        // Continue with other cars even if one fails
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
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas not supported - browser may not support HTML5 Canvas'));
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

          // Scale to fill width while maintaining aspect ratio
          const scale = canvas.width / img.width;
          const drawWidth = canvas.width; // Full width
          const drawHeight = Math.round(img.height * scale);
          const drawX = 0; // No horizontal margin
          const drawY = 0; // Align to top to prevent cutoff

          // Ensure image doesn't exceed available height
          if (drawHeight > availableImageHeight) {
            // If image is too tall, scale to fit height instead
            const heightScale = availableImageHeight / img.height;
            const adjustedWidth = Math.round(img.width * heightScale);
            const adjustedHeight = availableImageHeight;
            ctx.drawImage(img, 
              Math.round((canvas.width - adjustedWidth) / 2), // Center horizontally
              0, 
              adjustedWidth, 
              adjustedHeight
            );
          } else {
            ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
          }

          // Calculate actual image height after scaling
          let actualImageHeight;
          if (drawHeight > availableImageHeight) {
            actualImageHeight = availableImageHeight;
          } else {
            actualImageHeight = drawHeight;
          }

          const textTop = actualImageHeight; // Text box starts right after image
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
          
          // Text positioning with proper padding
          const paddingFromImage = 20; // Same spacing as between lines
          const lineHeight = 80; // Fixed line height for consistent spacing
          const lineSpacing = 20; // Space between lines

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

          const topY = textTop + paddingFromImage;
          const bottomY = topY + lineHeight + lineSpacing;
          fitAndDraw(topRow, 72, topY);
          fitAndDraw(bottomRow, 72, bottomY); // Same size for consistency

          // Convert to blob
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create image blob - canvas.toBlob returned null'));
            }
          }, 'image/jpeg', 0.9);

        } catch (error) {
          reject(new Error(`Canvas rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      };

      img.onerror = () => reject(new Error('Failed to load car image - image load error'));
      
      try {
        // Prefetch image via same-origin proxy to avoid CORS and tainted canvas
        const proxied = `/api/image-proxy?src=${encodeURIComponent(car.coverImage)}`;
        console.log(`Fetching image from proxy: ${proxied}`);
        const resp = await fetch(proxied, { credentials: 'include', mode: 'cors' as RequestMode });
        
        if (!resp.ok) {
          throw new Error(`Image proxy returned ${resp.status}: ${resp.statusText}`);
        }
        
        const blob = await resp.blob();
        if (blob.size === 0) {
          throw new Error('Received empty image blob from proxy');
        }
        
        const url = URL.createObjectURL(blob);
        img.src = url;
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Failed to fetch car image from proxy'));
      }
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Unknown error in image generation'));
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
    
    try {
      // Check if we're on mobile and use appropriate method
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile) {
        // Mobile: Direct download without share popup
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        // Desktop: Standard download approach
        const link = document.createElement('a');
        link.href = url;
        (link as HTMLAnchorElement).download = filename;
        (link as HTMLAnchorElement).rel = 'noopener';
        
        if (document && typeof document.body?.appendChild === 'function') {
          document.body.appendChild(link);
          (link as HTMLAnchorElement).click();
          document.body.removeChild(link);
        } else {
          (link as HTMLAnchorElement).click();
        }
      }
    } catch (error) {
      console.error('Download failed for', filename, ':', error);
      // Ultimate fallback: try to open in new tab
      try {
        window.open?.(url, '_blank', 'noopener,noreferrer');
      } catch (_fallbackError) {
        console.error('All download methods failed for', filename);
      }
    }

    // Cleanup
    URL.revokeObjectURL(url);

    // Small delay between downloads to avoid browser blocking
    if (i < images.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}
