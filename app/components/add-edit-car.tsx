"use client"

import type React from "react"
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
// import { Label } from "@/components/ui/label"
import type { Car } from "../types"

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
const MAX_DIMENSION = 2560; // pixels (covers ~2.5K long edge screens)
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

  // Pointer-based reordering support (works on mouse & touch)
  const dragFromIndex = useRef<number | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const isPointerDraggingRef = useRef(false);
  const dragStartTimerRef = useRef<number | null>(null);
  const initialPointerPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    try {
      // Ensure we have a valid images array, defaulting to an empty array if undefined
      const images = Array.isArray(car?.images) ? car.images : [];
      
      const initialImages = images.map(img => ({
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
    setDisplayedImages(prev => prev.filter(img => img.id !== idToRemove));
  };

  const finalizePointerDrag = () => {
    // Clear any pending drag start
    if (dragStartTimerRef.current) {
      clearTimeout(dragStartTimerRef.current);
      dragStartTimerRef.current = null;
    }
    dragFromIndex.current = null;
    activePointerIdRef.current = null;
    isPointerDraggingRef.current = false;
    initialPointerPos.current = null;
  };

  const handleTilePointerDown = (event: React.PointerEvent<HTMLDivElement>, index: number) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    
    // Clear any existing timer
    if (dragStartTimerRef.current) {
      clearTimeout(dragStartTimerRef.current);
    }
    
    // Store initial position for movement threshold check
    initialPointerPos.current = { x: event.clientX, y: event.clientY };
    
    // Set a timer to start dragging after a delay
    dragStartTimerRef.current = window.setTimeout(() => {
      if (initialPointerPos.current) {
        dragFromIndex.current = index;
        activePointerIdRef.current = event.pointerId;
        isPointerDraggingRef.current = true;
        try {
          event.currentTarget.setPointerCapture(event.pointerId);
        } catch {}
      }
      dragStartTimerRef.current = null;
    }, 300); // 300ms delay before drag starts
  };

  const reorderImages = (toIndex: number) => {
    const fromIndex = dragFromIndex.current;
    if (fromIndex === null) return;
    setDisplayedImages(prev => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const boundedFrom = Math.min(Math.max(fromIndex, 0), next.length - 1);
      const [moved] = next.splice(boundedFrom, 1);
      const insertionIndex = Math.min(Math.max(Math.trunc(toIndex), 0), next.length);
      next.splice(insertionIndex, 0, moved);
      dragFromIndex.current = Math.min(insertionIndex, next.length - 1);
      return next;
    });
  };

  const handleTilePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    // If we have a drag start timer, check if we've moved too far
    if (dragStartTimerRef.current && initialPointerPos.current) {
      const dx = Math.abs(event.clientX - initialPointerPos.current.x);
      const dy = Math.abs(event.clientY - initialPointerPos.current.y);
      
      // If moved more than 5px in any direction, cancel the drag start
      if (dx > 5 || dy > 5) {
        clearTimeout(dragStartTimerRef.current);
        dragStartTimerRef.current = null;
        initialPointerPos.current = null;
      }
      return;
    }
    
    // Handle actual dragging
    if (!isPointerDraggingRef.current || event.pointerId !== activePointerIdRef.current) return;
    // Prevent page scroll only while actively dragging
    event.preventDefault();
    if (typeof document === 'undefined') return;
    
    const element = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const tile = element?.closest('[data-image-index]') as HTMLElement | null;
    if (!tile) return;
    
    const toIndexRaw = Number(tile.dataset.imageIndex ?? '-1');
    if (Number.isNaN(toIndexRaw)) return;
    
    reorderImages(toIndexRaw);
  };

  const handleTilePointerEnter = (event: React.PointerEvent<HTMLDivElement>, index: number) => {
    if (!isPointerDraggingRef.current || event.pointerId !== activePointerIdRef.current) return;
    event.preventDefault();
    reorderImages(index);
  };

  const handleTilePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    // If we have an active drag start timer, clear it (this was just a tap/click)
    if (dragStartTimerRef.current) {
      clearTimeout(dragStartTimerRef.current);
      dragStartTimerRef.current = null;
      initialPointerPos.current = null;
      return;
    }
    
    if (!isPointerDraggingRef.current || event.pointerId !== activePointerIdRef.current) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {}
    event.preventDefault();
    finalizePointerDrag();
  };

  const handleTilePointerCancel = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDraggingRef.current || event.pointerId !== activePointerIdRef.current) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {}
    finalizePointerDrag();
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
                      {displayedImages.map((img, idx) => (
                        <div
                          key={img.id}
                          className="relative group aspect-square cursor-grab"
                          data-testid="car-image-tile"
                          data-image-index={idx}
                          data-image-id={img.id}
                          onPointerDown={(event) => handleTilePointerDown(event, idx)}
                          onPointerMove={handleTilePointerMove}
                          onPointerEnter={(event) => handleTilePointerEnter(event, idx)}
                          onPointerUp={handleTilePointerUp}
                          onPointerCancel={handleTilePointerCancel}
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
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-1 right-1 w-5 h-5 sm:w-6 sm:h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Remove image"
                            onClick={() => handleRemoveImage(img.id)}
                            onPointerDown={(event) => event.stopPropagation()}
                            onPointerUp={(event) => event.stopPropagation()}
                          >
                            <X className="w-3 h-3 sm:w-4 sm:h-4" />
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
                          onValueChange={(value) => handleInputChange("year", value)}
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
                        onValueChange={(value) => handleInputChange("transmission", value)}
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
    </div>
  );
}