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
import { Label } from "@/components/ui/label"
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
  const LS_IMG_TILE_KEY = 'mcinv_img_tile_px'
  const DEFAULT_TILE = 200
  const MIN_TILE = 120
  const MAX_TILE = 320
  const STEP_TILE = 20

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

  const [tileSize, setTileSize] = useState<number>(DEFAULT_TILE);

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

  // Load and persist image tile size preference
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_IMG_TILE_KEY)
      const num = raw ? parseInt(raw, 10) : NaN
      if (!isNaN(num)) {
        const clamped = Math.min(MAX_TILE, Math.max(MIN_TILE, num))
        setTileSize(clamped)
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try { localStorage.setItem(LS_IMG_TILE_KEY, String(tileSize)) } catch {}
  }, [tileSize])

  const [displayedImages, setDisplayedImages] = useState<DisplayImage[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pointer-based reordering support (works on mouse & touch)
  const dragFromIndex = useRef<number | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const isPointerDraggingRef = useRef(false);

  useEffect(() => {
    const initialImages = car?.images?.map(img => ({
      id: String((img as any)._id ?? (img as any).id ?? uuidv4()),
      url: (img as any).imageUrl,
      isNew: false,
    })) ?? [];
    setDisplayedImages(initialImages);

    return () => {
      displayedImages.forEach(img => {
        if (img.isNew) {
          URL.revokeObjectURL(img.url);
        }
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const newImages: DisplayImage[] = files.map(file => ({
        id: uuidv4(),
        url: URL.createObjectURL(file),
        file: file,
        isNew: true,
      }));
      setDisplayedImages(prev => [...prev, ...newImages]);
    }
  };

  const handleRemoveImage = (idToRemove: string) => {
    const imageToRemove = displayedImages.find(img => img.id === idToRemove);
    if (imageToRemove && imageToRemove.isNew) {
      URL.revokeObjectURL(imageToRemove.url);
    }
    setDisplayedImages(prev => prev.filter(img => img.id !== idToRemove));
  };

  const finalizePointerDrag = () => {
    dragFromIndex.current = null;
    activePointerIdRef.current = null;
    isPointerDraggingRef.current = false;
  };

  const handleTilePointerDown = (event: React.PointerEvent<HTMLDivElement>, index: number) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    dragFromIndex.current = index;
    activePointerIdRef.current = event.pointerId;
    isPointerDraggingRef.current = true;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {}
    event.preventDefault();
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
    if (!isPointerDraggingRef.current || event.pointerId !== activePointerIdRef.current) return;
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
                    <div className="flex items-center gap-3">
                      <Label htmlFor="tile-size" className="text-xs text-muted-foreground">Image size</Label>
                      <input
                        id="tile-size"
                        type="range"
                        min={MIN_TILE}
                        max={MAX_TILE}
                        step={STEP_TILE}
                        value={tileSize}
                        onChange={(e) => setTileSize(Number(e.target.value))}
                        className="w-28 sm:w-40 h-2 cursor-pointer"
                        aria-label="Image size"
                      />
                      <span className="text-xs text-muted-foreground w-12 text-right">{tileSize}px</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div
                      className="grid gap-2 sm:gap-4"
                      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${tileSize}px, 1fr))` }}
                    >
                      {displayedImages.map((img, idx) => (
                        <div
                          key={img.id}
                          className="relative group aspect-square cursor-grab"
                          data-testid="car-image-tile"
                          data-image-index={idx}
                          data-image-id={img.id}
                          style={{ touchAction: 'none' }}
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