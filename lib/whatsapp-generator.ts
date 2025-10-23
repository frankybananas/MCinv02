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

    // 3. Download images to gallery
    await downloadImagesToGallery(generatedImages, cars);

    // 4. Update generation status
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
  return new Promise((resolve, reject) => {
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
        // 1. Draw car image (centered, maintaining aspect ratio)
        const imgAspect = img.width / img.height;
        const canvasAspect = canvas.width / canvas.height;

        let drawWidth, drawHeight, drawX, drawY;

        if (imgAspect > canvasAspect) {
          // Image is wider - fit to height
          drawHeight = canvas.height * 0.7; // Use 70% of canvas height
          drawWidth = drawHeight * imgAspect;
          drawX = (canvas.width - drawWidth) / 2;
          drawY = (canvas.height - drawHeight) / 2;
        } else {
          // Image is taller - fit to width
          drawWidth = canvas.width;
          drawHeight = drawWidth / imgAspect;
          drawX = 0;
          drawY = (canvas.height - drawHeight) / 2;
        }

        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

        // 2. Add gradient overlay only at bottom quarter
        const overlayTop = canvas.height * 0.75;
        const gradient = ctx.createLinearGradient(0, overlayTop, 0, canvas.height);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.8)');

        ctx.fillStyle = gradient;
        ctx.fillRect(0, overlayTop, canvas.width, canvas.height - overlayTop);

        // 3. Add text overlay (bold white)
        ctx.textAlign = 'center';
        ctx.fillStyle = 'white';

        // Top row: Year Model
        ctx.font = 'bold 72px Arial, sans-serif';
        const topRow = `${car.year} ${car.model}`;
        const topY = canvas.height * 0.82;
        ctx.fillText(topRow, canvas.width / 2, topY);

        // Bottom row: mileage price
        ctx.font = 'bold 96px Arial, sans-serif';
        const price = new Intl.NumberFormat('en-ZA', {
          style: 'currency',
          currency: 'ZAR',
          minimumFractionDigits: 0
        }).format(car.price);
        const kmText = typeof car.kilometers === 'number' ? `${car.kilometers.toLocaleString()} km` : '';
        const bottomRow = kmText ? `${kmText}  ${price}` : `${price}`;
        const bottomY = canvas.height * 0.90;
        ctx.fillText(bottomRow, canvas.width / 2, bottomY);

        // 4. Convert to blob
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
    img.src = car.coverImage;
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

    // Trigger download without mutating DOM (safer for tests/jsdom)
    try {
      (link as HTMLAnchorElement).click();
    } catch {
      // no-op if click not supported
    }

    // Cleanup
    URL.revokeObjectURL(url);

    // Small delay between downloads to avoid browser blocking
    if (i < images.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}
