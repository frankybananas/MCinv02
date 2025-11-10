interface CarData {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number;
  coverImage: string;
  kilometers?: number;
  transmission?: string;
  allImages?: string[];
}

interface UserInfo {
  name: string;
  phone: string;
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

    const { generationId, cars, user } = await response.json();

    // 2. Generate images for each car
    const generatedImages: Blob[] = [];

    for (const car of cars) {
      try {
        console.log(`Generating image for car ${car.id}: ${car.year} ${car.make} ${car.model}`);
        const imageBlob = await generateCarImage(car, user);
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

async function generateCarImage(car: CarData, user: UserInfo): Promise<Blob> {
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

      // Fill with white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Load all necessary images
      const imagesToLoad: string[] = [car.coverImage];
      
      // Add up to 3 additional images for thumbnails
      if (car.allImages && car.allImages.length > 1) {
        // Skip the first image if it's the same as cover, add next 3
        const startIdx = car.allImages[0] === car.coverImage ? 1 : 0;
        for (let i = startIdx; i < Math.min(startIdx + 3, car.allImages.length); i++) {
          if (car.allImages[i] && car.allImages[i] !== car.coverImage) {
            imagesToLoad.push(car.allImages[i]);
          }
        }
      }

      // Load all images
      const loadedImages: HTMLImageElement[] = [];
      
      for (const imgUrl of imagesToLoad) {
        try {
          const img = await loadImage(imgUrl);
          loadedImages.push(img);
        } catch (error) {
          console.error(`Failed to load image: ${imgUrl}`, error);
          // Continue with other images
        }
      }

      if (loadedImages.length === 0) {
        reject(new Error('No images could be loaded'));
        return;
      }

      // Layout configuration
      const mainImageHeight = 900; // Height for main image
      const thumbnailHeight = 280; // Height for thumbnail row
      const thumbnailGap = 5; // Gap between thumbnails
      const textAreaHeight = canvas.height - mainImageHeight - thumbnailHeight - 40; // Remaining space for text
      
      // Draw main image
      const mainImg = loadedImages[0];
      const mainScale = Math.min(canvas.width / mainImg.width, mainImageHeight / mainImg.height);
      const mainWidth = mainImg.width * mainScale;
      const mainHeight = mainImg.height * mainScale;
      const mainX = (canvas.width - mainWidth) / 2;
      const mainY = 0;
      
      ctx.drawImage(mainImg, mainX, mainY, mainWidth, mainHeight);

      // Draw thumbnails if we have them
      const thumbnailY = mainImageHeight + 10;
      const numThumbnails = Math.min(3, loadedImages.length - 1);
      
      if (numThumbnails > 0) {
        const totalGapWidth = (numThumbnails - 1) * thumbnailGap;
        const thumbnailWidth = (canvas.width - 40 - totalGapWidth) / 3; // 3 equal-width thumbnails with padding
        
        for (let i = 0; i < 3; i++) {
          const x = 20 + i * (thumbnailWidth + thumbnailGap);
          
          if (i < numThumbnails) {
            const thumbImg = loadedImages[i + 1];
            const thumbScale = Math.min(thumbnailWidth / thumbImg.width, thumbnailHeight / thumbImg.height);
            const thumbW = thumbImg.width * thumbScale;
            const thumbH = thumbImg.height * thumbScale;
            const thumbX = x + (thumbnailWidth - thumbW) / 2;
            const thumbY = thumbnailY + (thumbnailHeight - thumbH) / 2;
            
            ctx.drawImage(thumbImg, thumbX, thumbY, thumbW, thumbH);
          } else {
            // Draw placeholder rectangle if we don't have enough images
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(x, thumbnailY, thumbnailWidth, thumbnailHeight);
          }
        }
      }

      // Text area starts after thumbnails
      const textStartY = mainImageHeight + thumbnailHeight + 40;
      
      // Format phone number: replace +27 with 0
      const formattedPhone = user.phone.startsWith('+27') 
        ? '0' + user.phone.substring(3)
        : user.phone;
      
      // Price formatting
      const price = new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: 'ZAR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(car.price).replace('ZAR', 'R');
      
      // Prepare text lines
      const makeModel = `${car.year} ${car.make} ${car.model}`;
      const details: string[] = [];
      
      if (car.kilometers != null) {
        details.push(`${car.kilometers.toLocaleString()} km`);
      }
      if (car.transmission) {
        details.push(car.transmission.charAt(0).toUpperCase() + car.transmission.slice(1));
      }
      
      const detailsText = details.join(' • ');
      
      // Text styling
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Calculate vertical spacing
      const lineSpacing = 35;
      let currentY = textStartY + 50;
      
      // Draw contact line above price
      const contactLine = `Contact ${user.name} on ${formattedPhone}`;
      ctx.fillStyle = '#333333';
      ctx.font = '32px Arial, sans-serif';
      ctx.fillText(contactLine, canvas.width / 2, currentY);
      currentY += 65;
      
      // Draw price (largest, bold)
      ctx.fillStyle = '#0066cc'; // Blue color for price
      ctx.font = 'bold 72px Arial, sans-serif';
      ctx.fillText(price, canvas.width / 2, currentY);
      currentY += 90;
      
      // Draw make and model (with text wrapping if needed)
      ctx.fillStyle = '#333333';
      ctx.font = '48px Arial, sans-serif';
      
      // Check if text needs wrapping
      const maxWidth = canvas.width - 80;
      const textMetrics = ctx.measureText(makeModel);
      
      if (textMetrics.width > maxWidth) {
        // Split text into two lines
        const words = makeModel.split(' ');
        let line1 = '';
        let line2 = '';
        let halfWay = Math.floor(words.length / 2);
        
        // Try to split at make/model boundary
        if (words.length >= 3) {
          line1 = `${words[0]} ${words[1]}`; // Year Make
          line2 = words.slice(2).join(' '); // Model
        } else {
          line1 = words.slice(0, halfWay).join(' ');
          line2 = words.slice(halfWay).join(' ');
        }
        
        ctx.font = '44px Arial, sans-serif';
        ctx.fillText(line1, canvas.width / 2, currentY);
        currentY += 55;
        ctx.fillText(line2, canvas.width / 2, currentY);
        currentY += 70;
      } else {
        ctx.fillText(makeModel, canvas.width / 2, currentY);
        currentY += 80;
      }
      
      // Draw details (kilometers, transmission)
      if (detailsText) {
        ctx.fillStyle = '#666666';
        ctx.font = '36px Arial, sans-serif';
        ctx.fillText(detailsText, canvas.width / 2, currentY);
      }

      // Convert to blob
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create image blob - canvas.toBlob returned null'));
        }
      }, 'image/jpeg', 0.95);

    } catch (error) {
      reject(error instanceof Error ? error : new Error('Unknown error in image generation'));
    }
  });
}

// Helper function to load an image with CORS handling
async function loadImage(imageUrl: string): Promise<HTMLImageElement> {
  return new Promise(async (resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    
    try {
      // Use proxy to avoid CORS issues
      const proxied = `/api/image-proxy?src=${encodeURIComponent(imageUrl)}`;
      const resp = await fetch(proxied, { credentials: 'include', mode: 'cors' as RequestMode });
      
      if (!resp.ok) {
        throw new Error(`Image proxy returned ${resp.status}`);
      }
      
      const blob = await resp.blob();
      if (blob.size === 0) {
        throw new Error('Empty image blob');
      }
      
      const url = URL.createObjectURL(blob);
      img.src = url;
    } catch (e) {
      reject(e);
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
