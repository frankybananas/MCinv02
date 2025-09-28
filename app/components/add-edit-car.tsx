"use client"

import type { Car } from "../types"

import { useState, useRef, useEffect } from "react"
import { v4 as uuidv4 } from 'uuid';
import { toast } from "sonner"
import { ArrowLeft, X } from 'lucide-react';
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface AddEditCarProps {
  car?: Car
  onSave: (carData: FormData) => Promise<void>
  onCancel: () => void
}

interface DisplayImage {
  id: string;
  url: string;
  file?: File;
  isNew: boolean;
}

// Image compression settings and helpers
// Target: high visual quality for fullscreen on ~9" tablets while saving bandwidth/storage.
// Strategy: limit long edge to 2560px, prefer WebP at quality ~0.82, fall back to JPEG at quality ~0.86.
// Placeholder removed
const MAX_DIMENSION = 1080; // pixels (covers ~2.5K long edge screens)
const WEBP_QUALITY = 0.82;
const JPEG_QUALITY = 0.86;

async function loadImageBitmap(file: File): Promise<ImageBitmap> {
  try {
    // createImageBitmap is fast and handles various formats
    return await createImageBitmap(file);
  } catch {
    // Fallback via HTMLImageElement
    const dataUrl = await fileToDataURL(file);
    return await dataURLToImageBitmap(dataUrl);
  }
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function dataURLToImageBitmap(dataUrl: string): Promise<ImageBitmap> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      createImageBitmap(img)
        .then(resolve)
        .catch(reject);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function getTargetSize(width: number, height: number) {
  const longEdge = Math.max(width, height);
  if (longEdge <= MAX_DIMENSION) return { width, height };
  const scale = MAX_DIMENSION / longEdge;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Canvas toBlob returned null'));
      resolve(blob);
    }, type, quality);
  });
}

async function compressImage(file: File): Promise<File> {
  // Only attempt compression for typical raster images
  const inputType = (file.type || '').toLowerCase();
  const isRaster = /image\/(jpeg|jpg|png|webp|heic|heif|bmp)/.test(inputType);
  if (!isRaster) return file;

  const bitmap = await loadImageBitmap(file);
  const { width: tw, height: th } = getTargetSize(bitmap.width, bitmap.height);

  const canvas = document.createElement('canvas');
  canvas.width = tw;
  canvas.height = th;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file; // fallback
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, tw, th);

  // Prefer WebP when supported by the browser; otherwise JPEG
  const canUseWebP = typeof canvas.toDataURL === 'function' && ((): boolean => {
    try {
      return canvas.toDataURL('image/webp').startsWith('data:image/webp');
    } catch {
      return false;
    }
  })();

  const mime = canUseWebP ? 'image/webp' : 'image/jpeg';
  const quality = canUseWebP ? WEBP_QUALITY : JPEG_QUALITY;
  const blob = await canvasToBlob(canvas, mime, quality);

  // Keep original extension semantics if possible; otherwise set based on mime
  const ext = canUseWebP ? 'webp' : 'jpg';
  const base = file.name.replace(/\.[^.]+$/, '') || 'image';
  const newName = `${base}-compressed.${ext}`;
  return new File([blob], newName, { type: mime, lastModified: Date.now() });
}

// Helper function to format the price with spaces
const formatPrice = (value: string | number): string => {
  if (value === '' || value === null || value === undefined) return '';
  const stringValue = String(value).replace(/\s/g, '');
  if (isNaN(Number(stringValue))) return '';
  return stringValue.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

// Helper function to parse the formatted price back to a number
const parsePrice = (value: string): number => {
  return Number(String(value).replace(/\s/g, ''));
};

export function AddEditCar({ car, onSave, onCancel }: AddEditCarProps) {
  const isEditing = !!car;

  const [formData, setFormData] = useState({
    make: car?.make ?? "",
    model: car?.model ?? "",
    year: car?.year ?? '',
    price: car ? formatPrice(car.price) : '',
    kilometers: car?.kilometers ?? '',
    description: car?.description ?? "",
    color: car?.color ?? '',
    transmission: car?.transmission ?? 'automatic',
    vin: car?.vin ?? '',
    notes: car?.notes ?? '',
    demo: car?.demo ?? false,
  });

  // MRU suggestions for Make/Model
  const [recentMakes, setRecentMakes] = useState<string[]>([])
  const [recentModels, setRecentModels] = useState<string[]>([])

  const MRU_LIMIT = 15
  const LS_MAKES_KEY = 'mcinv_recent_makes'
  const LS_MODELS_KEY = 'mcinv_recent_models'

  const loadList = (key: string): string[] => {
    try {
      const raw = localStorage.getItem(key)
      const arr = raw ? JSON.parse(raw) : []
      return Array.isArray(arr) ? arr.filter(Boolean) : []
    } catch {
      return []
    }
  }

  const saveList = (key: string, values: string[]) => {
    try { localStorage.setItem(key, JSON.stringify(values)) } catch {}
  }

  const addToList = (key: string, value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    const v = (value || '').trim()
    if (!v) return
    setter(prev => {
      const next = [v, ...prev.filter(item => item.toLowerCase() !== v.toLowerCase())].slice(0, MRU_LIMIT)
      saveList(key, next)
      return next
    })
  }

  useEffect(() => {
    // Load MRU lists on mount
    const makes = loadList(LS_MAKES_KEY)
    const models = loadList(LS_MODELS_KEY)
    // Ensure current car values are present (when editing)
    const withCurrentMakes = formData.make ? [formData.make, ...makes] : makes
    const withCurrentModels = formData.model ? [formData.model, ...models] : models
    // Dedupe case-insensitively
    const dedupe = (arr: string[]) => {
      const seen = new Set<string>()
      return arr.filter(x => {
        const k = x.toLowerCase()
        if (seen.has(k)) return false
        seen.add(k)
        return true
      }).slice(0, MRU_LIMIT)
    }
    const m1 = dedupe(withCurrentMakes)
    const m2 = dedupe(withCurrentModels)
    setRecentMakes(m1)
    setRecentModels(m2)
    saveList(LS_MAKES_KEY, m1)
    saveList(LS_MODELS_KEY, m2)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [displayedImages, setDisplayedImages] = useState<DisplayImage[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image role tracking for persistent ordering
  const [coverImageIndex, setCoverImageIndex] = useState<number | null>(car?.coverImageIndex ?? null);
  const [vinImageIndex, setVinImageIndex] = useState<number | null>(car?.vinImageIndex ?? null);

  // Modal state for image role selection
  const [selectedImageForRole, setSelectedImageForRole] = useState<DisplayImage | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);


  useEffect(() => {
    try {
      // Ensure we have a valid images array, defaulting to an empty array if undefined
      const images = Array.isArray(car?.images) ? car.images : [];

      const initialImages = (images as any[]).map((img: any) => ({
        id: String((img as any)._id ?? (img as any).id ?? uuidv4()),
        url: (img as any).imageUrl ?? '',
        file: undefined,
        isNew: false,
      }));
      
      setDisplayedImages(initialImages);
    } catch (error) {
      console.error('Error initializing images:', error);
      setDisplayedImages([]);
    }

    return () => {
      // Use the current value of displayedImages in the cleanup
      setDisplayedImages(prevImages => {
        prevImages.forEach(img => {
          if (img?.isNew && img?.url) {
            URL.revokeObjectURL(img.url);
          }
        });
        return [];
      });
    };
  }, [car]);

  const handleInputChange = (field: string, value: any) => {
    if (field === 'price') {
      const formattedValue = formatPrice(value);
      setFormData((prev) => ({ ...prev, [field]: formattedValue }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);

    // Compress sequentially to avoid memory spikes on low-end devices
    const compressedFiles: File[] = [];
    for (const f of files) {
      try {
        const cf = await compressImage(f);
        compressedFiles.push(cf);
      } catch (err) {
        console.warn('Image compression failed, using original file:', err);
        compressedFiles.push(f);
      }
    }

    const newImages: DisplayImage[] = compressedFiles.map(file => ({
      id: uuidv4(),
      url: URL.createObjectURL(file),
      file,
      isNew: true,
    }));
    setDisplayedImages(prev => [...prev, ...newImages]);
    // Reset the input so the same files can be selected again if needed
    try { e.target.value = ''; } catch {}
  };

  const handleRemoveImage = (idToRemove: string) => {
    const imageToRemove = displayedImages.find(img => img.id === idToRemove);
    if (imageToRemove && imageToRemove.isNew) {
      URL.revokeObjectURL(imageToRemove.url);
    }
    setDisplayedImages(prev => {
      const newImages = prev.filter(img => img.id !== idToRemove);
      const removedIndex = prev.findIndex(img => img.id === idToRemove);

      // Update role indices if the removed image had a role
      let newCoverIndex = coverImageIndex;
      let newVinIndex = vinImageIndex;

      if (coverImageIndex === removedIndex) {
        newCoverIndex = null;
      } else if (coverImageIndex !== null && coverImageIndex > removedIndex) {
        newCoverIndex = coverImageIndex - 1;
      }

      if (vinImageIndex === removedIndex) {
        newVinIndex = null;
      } else if (vinImageIndex !== null && vinImageIndex > removedIndex) {
        newVinIndex = vinImageIndex - 1;
      }

      setCoverImageIndex(newCoverIndex);
      setVinImageIndex(newVinIndex);

      return newImages;
    });
  };

  // Handle setting/unsetting image roles
  const handleSetCover = (index: number) => {
    setCoverImageIndex(index);
    // If this image was VIN, unset it
    if (index === vinImageIndex) {
      setVinImageIndex(null);
    }
  };

  const handleSetVin = (index: number) => {
    setVinImageIndex(index);
    // If this image was cover, unset it
    if (index === coverImageIndex) {
      setCoverImageIndex(null);
    }
  };

  const handleRemoveCover = () => {
    setCoverImageIndex(null);
  };

  const handleRemoveVin = () => {
    setVinImageIndex(null);
  };

  // Get images sorted by role: cover first, then regular images, then VIN last
  const getSortedImages = () => {
    const images = [...displayedImages];
    const coverIdx = coverImageIndex;
    const vinIdx = vinImageIndex;

    // If no cover is set, treat the first image as cover by default
    const effectiveCoverIdx = coverIdx !== null ? coverIdx : (images.length > 0 ? 0 : null);

    const coverImage = effectiveCoverIdx !== null ? images[effectiveCoverIdx] : null;
    const vinImage = vinIdx !== null ? images[vinIdx] : null;

    const regularImages = images.filter((img, idx) =>
      idx !== effectiveCoverIdx && idx !== vinIdx
    );

    const sortedImages = [];
    if (coverImage) sortedImages.push(coverImage);
    sortedImages.push(...regularImages);
    if (vinImage) sortedImages.push(vinImage);

    return sortedImages;
  };



  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);

    const data = new FormData();
    const submissionData = { ...formData };

    // Parse the price back to a number before submission
    submissionData.price = String(parsePrice(formData.price));

    Object.entries(submissionData).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        data.append(key, String(value));
      }
    });

    // Append images in the displayed order and track order markers
    let newIdx = 0;
    displayedImages.forEach(img => {
      if (img.isNew && img.file) {
        data.append('images', img.file);
        // Use the original filename as the title
        data.append('imageTitles', img.file.name);
        data.append('imageOrder', `new:${newIdx}`);
        newIdx += 1;
      } else if (!img.isNew) {
        const existingId = String(img.id);
        data.append('existingImages', existingId);
        data.append('imageOrder', existingId);
      }
    });

    // Add image role flags
    if (coverImageIndex !== null) {
      data.append('coverImageIndex', String(coverImageIndex));
    }
    if (vinImageIndex !== null) {
      data.append('vinImageIndex', String(vinImageIndex));
    }

    try {
      await onSave(data);
      // Persist latest Make/Model to MRU lists on successful save
      addToList(LS_MAKES_KEY, String(formData.make), setRecentMakes)
      addToList(LS_MODELS_KEY, String(formData.model), setRecentModels)
    } catch (error) {
      console.error('Failed to save car:', error);
      toast.error('Failed to save car. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        <header className="bg-white border-b p-3 sm:p-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" size="icon" type="button" onClick={onCancel}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-base sm:text-lg font-semibold truncate">{isEditing ? "Edit Car" : "Add New Car"}</h1>
          </div>
          <Button type="submit" disabled={isSaving} size="sm" className="text-xs sm:text-sm">
            {isSaving ? "Saving..." : "Save Car"}
          </Button>
        </header>

        <ScrollArea className="flex-grow">
          <div className="p-3 sm:p-4 md:p-6 max-w-6xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              <div className="lg:col-span-1 space-y-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base sm:text-lg">Vehicle Images</CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-auto">
                    <div className="grid gap-2 sm:gap-3 grid-cols-3">
                      {getSortedImages().map((img, idx) => (
                        <div
                          key={img.id}
                          className="relative group aspect-square"
                          data-testid="car-image-tile"
                          data-image-id={img.id}
                        >
                          <img
                            src={img.url}
                            alt="Car image"
                            className="w-full h-full object-cover rounded-md"
                            data-testid="car-image-img"
                          />
                          {idx === 0 && (
                            <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] sm:text-xs px-1.5 py-0.5 rounded">Cover</span>
                          )}
                          {coverImageIndex === displayedImages.findIndex(i => i.id === img.id) && (
                            <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] sm:text-xs px-1.5 py-0.5 rounded">Cover</span>
                          )}
                          {vinImageIndex === displayedImages.findIndex(i => i.id === img.id) && (
                            <span className="absolute top-1 right-1 bg-blue-600/60 text-white text-[10px] sm:text-xs px-1.5 py-0.5 rounded">VIN</span>
                          )}
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 w-5 h-5 sm:w-6 sm:h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Remove image"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveImage(img.id);
                            }}
                          >
                            <X className="w-3 h-3 sm:w-4 sm:h-4" />
                          </Button>
                          {/* Small edit button that doesn't interfere with scrolling */}
                          <Button
                            type="button"
                            variant="secondary"
                            size="icon"
                            className="absolute bottom-1 right-1 w-6 h-6 sm:w-7 sm:h-7 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                            aria-label="Edit image roles"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedImageForRole(img);
                              setShowRoleModal(true);
                            }}
                          >
                            <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </Button>
                        </div>
                      ))}
                      <div
                        className="aspect-square border-2 border-dashed border-gray-300 rounded-md flex items-center justify-center cursor-pointer hover:border-primary transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                        data-image-index={displayedImages.length}
                      >
                        <span className="text-gray-500 text-2xl">+</span>
                      </div>
                    </div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      className="hidden"
                      aria-label="Upload car images"
                      data-testid="car-image-file-input"
                      multiple
                      accept="image/*"
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-1 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base sm:text-lg">Vehicle Details</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs sm:text-sm font-medium">Year</label>
                        <Select
                          value={String(formData.year ?? '')}
                          onValueChange={(value: string) => handleInputChange("year", value)}
                          required
                        >
                          <SelectTrigger className="text-sm sm:text-base">
                            <SelectValue placeholder="Select year" />
                          </SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 20 }).map((_, idx) => {
                              const y = new Date().getFullYear() - idx;
                              return (
                                <SelectItem key={y} value={String(y)}>
                                  {y}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs sm:text-sm font-medium">Price (R)</label>
                        <Input
                          type="text"
                          value={formData.price}
                          onChange={(e) => handleInputChange("price", e.target.value)}
                          placeholder="e.g. 150 000"
                          required
                          className="text-sm sm:text-base"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs sm:text-sm font-medium">Make</label>
                        <Input
                          value={formData.make}
                          onChange={(e) => handleInputChange("make", e.target.value)}
                          onBlur={(e) => addToList(LS_MAKES_KEY, e.target.value, setRecentMakes)}
                          placeholder="e.g. Toyota"
                          required
                          className="text-sm sm:text-base"
                          list="makes-list"
                        />
                        <datalist id="makes-list">
                          {recentMakes.map((m) => (
                            <option key={m} value={m} />
                          ))}
                        </datalist>
                      </div>
                      <div>
                        <label className="text-xs sm:text-sm font-medium">Model</label>
                        <Input
                          value={formData.model}
                          onChange={(e) => handleInputChange("model", e.target.value)}
                          onBlur={(e) => addToList(LS_MODELS_KEY, e.target.value, setRecentModels)}
                          placeholder="e.g. Hilux"
                          required
                          className="text-sm sm:text-base"
                          list="models-list"
                        />
                        <datalist id="models-list">
                          {recentModels.map((m) => (
                            <option key={m} value={m} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs sm:text-sm font-medium">Kilometers</label>
                        <Input
                          type="number"
                          value={formData.kilometers}
                          onChange={(e) => handleInputChange("kilometers", e.target.value)}
                          placeholder="e.g. 50000"
                          min="0"
                          required
                          className="text-sm sm:text-base"
                        />
                      </div>
                      <div>
                        <label className="text-xs sm:text-sm font-medium">Color</label>
                        <Input
                          value={formData.color}
                          onChange={(e) => handleInputChange("color", e.target.value)}
                          placeholder="e.g. White"
                          required
                          className="text-sm sm:text-base"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs sm:text-sm font-medium">Transmission</label>
                      <Select
                        value={formData.transmission}
                        onValueChange={(value: string) => handleInputChange("transmission", value)}
                      >
                        <SelectTrigger className="text-sm sm:text-base">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="manual">Manual</SelectItem>
                          <SelectItem value="automatic">Automatic</SelectItem>
                          <SelectItem value="cvt">CVT</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-xs sm:text-sm font-medium">VIN (Optional)</label>
                      <Input
                        value={formData.vin}
                        onChange={(e) => handleInputChange("vin", e.target.value)}
                        placeholder="Vehicle Identification Number"
                        maxLength={17}
                        className="text-sm sm:text-base"
                      />
                    </div>

                    <div>
                      <label className="text-xs sm:text-sm font-medium">Notes (Optional)</label>
                      <Textarea
                        value={formData.notes}
                        onChange={(e) => handleInputChange("notes", e.target.value)}
                        placeholder="Additional notes about the vehicle..."
                        rows={3}
                        className="text-sm sm:text-base"
                      />
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="demo"
                        checked={formData.demo}
                        onChange={(e) => handleInputChange("demo", e.target.checked)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor="demo" className="text-xs sm:text-sm font-medium text-gray-900">
                        Dealership Demo Vehicle
                      </label>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </ScrollArea>
      </form>

      {/* Image Role Selection Modal */}
      <Dialog open={showRoleModal} onOpenChange={setShowRoleModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Image Options</DialogTitle>
          </DialogHeader>
          {selectedImageForRole && (
            <div className="space-y-4">
              <img
                src={selectedImageForRole.url}
                alt="Selected car image"
                className="w-full h-64 object-cover rounded-md"
              />
              <div className="flex gap-4">
                <Button
                  size="lg"
                  className="flex-1"
                  onClick={() => {
                    const imageIndex = displayedImages.findIndex(img => img.id === selectedImageForRole.id);
                    handleSetCover(imageIndex);
                    setShowRoleModal(false);
                  }}
                >
                  {coverImageIndex === displayedImages.findIndex(img => img.id === selectedImageForRole.id) ? 'Is Cover' : 'Set as Cover'}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    const imageIndex = displayedImages.findIndex(img => img.id === selectedImageForRole.id);
                    handleSetVin(imageIndex);
                    setShowRoleModal(false);
                  }}
                >
                  {vinImageIndex === displayedImages.findIndex(img => img.id === selectedImageForRole.id) ? 'Is VIN' : 'Mark as VIN'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}