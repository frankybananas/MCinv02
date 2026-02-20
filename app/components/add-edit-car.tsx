"use client"

import type { Car } from "../types"

import { useState, useRef, useEffect } from "react"
import { v4 as uuidv4 } from 'uuid';
import { toast } from "sonner"
import { ArrowLeft, X, ChevronUp, ChevronDown, UploadCloud } from 'lucide-react';
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
    doNotAdvertise: car?.doNotAdvertise ?? false,
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
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragSrcIndex = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image viewer state
  const [viewerImage, setViewerImage] = useState<DisplayImage | null>(null);

  // Touch drag-to-reorder state
  const [touchDragging, setTouchDragging] = useState(false);
  const touchSrcIndex = useRef<number | null>(null);
  const touchLongPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchMoved = useRef(false);
  const displayedImagesRef = useRef<DisplayImage[]>(displayedImages);
  useEffect(() => { displayedImagesRef.current = displayedImages; }, [displayedImages]);

  // Image role tracking for persistent ordering
  const [coverImageIndex, setCoverImageIndex] = useState<number | null>(car?.coverImageIndex ?? null);
  const [vinImageIndex, setVinImageIndex] = useState<number | null>(car?.vinImageIndex ?? null);

  // Modal state for image role selection
  const [selectedImageForRole, setSelectedImageForRole] = useState<DisplayImage | null>(null);
  const [showRoleModal, setShowRoleModal] = useState(false);


  useEffect(() => {
    try {
      // Ensure we have a valid images array, defaulting to an empty array if undefined
      const images = Array.isArray(car?.images) ? car!.images : [];

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
      // Revoke any object URLs for newly added images and clear state
      setDisplayedImages(prevImages => {
        prevImages.forEach(img => {
          if (img?.isNew && img?.url) {
            URL.revokeObjectURL(img.url);
          }
        });
        return [] as DisplayImage[];
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

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;

    let processed: File[] = files;
    try {
      const mod = await import('./image-compression.client');
      if (mod && typeof mod.compressImage === 'function') {
        const out: File[] = [];
        for (const f of files) {
          try {
            const cf = await mod.compressImage(f, { maxDimension: 1920, targetType: 'image/webp', qualityWebp: 0.8, qualityJpeg: 0.85 });
            out.push(cf);
          } catch {
            out.push(f);
          }
        }
        processed = out;
      }
    } catch {
      // dynamic import failed — keep originals
    }

    const newImages: DisplayImage[] = processed.map(file => ({
      id: uuidv4(),
      url: URL.createObjectURL(file),
      file,
      isNew: true,
    }));
    setDisplayedImages(prev => [...prev, ...newImages]);
  };

  // ── File-drop zone handlers (CardContent level) ──────────────────────────
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    // Only activate the upload drop-zone when dragging external files (not image tiles)
    if (dragSrcIndex.current !== null) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (dragSrcIndex.current !== null) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    // If this is a tile-reorder drag, ignore at the container level
    if (dragSrcIndex.current !== null) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    await processFiles(files);
  };

  // ── Tile drag-to-reorder handlers ─────────────────────────────────────────
  const handleTileDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    dragSrcIndex.current = index;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleTileDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (dragSrcIndex.current !== null && dragSrcIndex.current !== index) {
      setDragOverIndex(index);
    }
  };

  const handleTileDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);
  };

  const handleTileDrop = (e: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);

    const srcIndex = dragSrcIndex.current;
    dragSrcIndex.current = null;

    if (srcIndex === null) return;
    reorderImages(srcIndex, dropIndex);
  };

  const handleTileDragEnd = () => {
    dragSrcIndex.current = null;
    setDragOverIndex(null);
  };

  // ── Shared reorder logic (used by both mouse and touch) ───────────────────
  const reorderImages = (srcIndex: number, dropIndex: number) => {
    if (srcIndex === dropIndex) return;

    setDisplayedImages(prev => {
      const next = [...prev];
      const [moved] = next.splice(srcIndex, 1);
      next.splice(dropIndex, 0, moved);
      return next;
    });

    setCoverImageIndex(prev => {
      if (prev === null) return prev;
      if (prev === srcIndex) return dropIndex;
      const lo = Math.min(srcIndex, dropIndex);
      const hi = Math.max(srcIndex, dropIndex);
      if (prev < lo || prev > hi) return prev;
      return srcIndex < dropIndex ? prev - 1 : prev + 1;
    });

    setVinImageIndex(prev => {
      if (prev === null) return prev;
      if (prev === srcIndex) return dropIndex;
      const lo = Math.min(srcIndex, dropIndex);
      const hi = Math.max(srcIndex, dropIndex);
      if (prev < lo || prev > hi) return prev;
      return srcIndex < dropIndex ? prev - 1 : prev + 1;
    });
  };

  // ── Touch drag-to-reorder handlers ───────────────────────────────────────
  const getTileIndexFromPoint = (x: number, y: number): number | null => {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const tile = (el as HTMLElement).closest('[data-testid="car-image-tile"]') as HTMLElement | null;
    if (!tile) return null;
    const id = tile.getAttribute('data-image-id');
    const idx = displayedImagesRef.current.findIndex(img => img.id === id);
    return idx >= 0 ? idx : null;
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>, index: number) => {
    touchMoved.current = false;
    touchLongPressTimer.current = setTimeout(() => {
      touchSrcIndex.current = index;
      setTouchDragging(true);
      setDragOverIndex(index);
    }, 400);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    touchMoved.current = true;
    if (touchSrcIndex.current === null) {
      // Not yet in drag mode — cancel long-press if finger moved significantly
      if (touchLongPressTimer.current) {
        clearTimeout(touchLongPressTimer.current);
        touchLongPressTimer.current = null;
      }
      return;
    }
    // In drag mode — prevent page scroll and find target tile
    e.preventDefault();
    const touch = e.touches[0];
    const overIdx = getTileIndexFromPoint(touch.clientX, touch.clientY);
    if (overIdx !== null && overIdx !== touchSrcIndex.current) {
      setDragOverIndex(overIdx);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>, index: number) => {
    if (touchLongPressTimer.current) {
      clearTimeout(touchLongPressTimer.current);
      touchLongPressTimer.current = null;
    }

    if (touchSrcIndex.current !== null) {
      // Commit reorder
      const touch = e.changedTouches[0];
      const dropIdx = getTileIndexFromPoint(touch.clientX, touch.clientY) ?? dragOverIndex;
      if (dropIdx !== null) {
        reorderImages(touchSrcIndex.current, dropIdx);
      }
      touchSrcIndex.current = null;
      setTouchDragging(false);
      setDragOverIndex(null);
    } else if (!touchMoved.current) {
      // Short tap — open image viewer
      const img = displayedImagesRef.current[index];
      if (img) setViewerImage(img);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    await processFiles(files);
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
    setDisplayedImages((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const selected = prev[index];
      const rest = prev.filter((_, i) => i !== index);
      const next = [selected, ...rest];
      return next;
    });

    setCoverImageIndex(0);
    if (index === vinImageIndex) {
      setVinImageIndex(null);
    } else if (vinImageIndex !== null && vinImageIndex < index) {
      setVinImageIndex(vinImageIndex + 1);
    }
  };

  const handleSetVin = (index: number) => {
    setDisplayedImages((prev) => {
      if (index < 0 || index >= prev.length) return prev;
      const selected = prev[index];
      const rest = prev.filter((_, i) => i !== index);
      const next = [...rest, selected];
      return next;
    });

    setVinImageIndex((prev) => {
      // VIN image will be at the last position after move
      return displayedImages.length - 1;
    });

    // If this image was cover, unset it
    if (index === coverImageIndex) {
      setCoverImageIndex(null);
    } else if (coverImageIndex !== null && coverImageIndex > index) {
      // Adjust cover index if needed
      setCoverImageIndex(coverImageIndex - 1);
    }
  };

  const handleRemoveCover = () => {
    setCoverImageIndex(null);
  };

  const handleRemoveVin = () => {
    setVinImageIndex(null);
  };

  // Move image up in the order
  const handleMoveImageUp = (index: number) => {
    if (index <= 0) return;
    setDisplayedImages((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });

    // Adjust cover and VIN indices
    if (coverImageIndex === index) {
      setCoverImageIndex(index - 1);
    } else if (coverImageIndex === index - 1) {
      setCoverImageIndex(index);
    }

    if (vinImageIndex === index) {
      setVinImageIndex(index - 1);
    } else if (vinImageIndex === index - 1) {
      setVinImageIndex(index);
    }
  };

  // Move image down in the order
  const handleMoveImageDown = (index: number) => {
    if (index >= displayedImages.length - 1) return;
    setDisplayedImages((prev) => {
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });

    // Adjust cover and VIN indices
    if (coverImageIndex === index) {
      setCoverImageIndex(index + 1);
    } else if (coverImageIndex === index + 1) {
      setCoverImageIndex(index);
    }

    if (vinImageIndex === index) {
      setVinImageIndex(index + 1);
    } else if (vinImageIndex === index + 1) {
      setVinImageIndex(index);
    }
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
        // Handle boolean fields explicitly
        if (typeof value === 'boolean') {
          data.append(key, value ? 'true' : 'false');
        } else {
          data.append(key, String(value));
        }
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
                  <CardContent
                    className="overflow-auto"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    data-testid="image-drop-zone"
                  >
                    {/* Desktop-only drag-and-drop area */}
                    <div
                      className={`hidden md:flex mb-3 flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-6 transition-colors cursor-pointer ${
                        isDragOver
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-gray-300 text-gray-400 hover:border-primary hover:text-primary'
                      }`}
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="desktop-drop-zone"
                    >
                      <UploadCloud className="w-8 h-8" />
                      <p className="text-sm font-medium">
                        {isDragOver ? 'Drop images here' : 'Drag & drop images here, or click to select'}
                      </p>
                      <p className="text-xs">Supports JPG, PNG, WEBP</p>
                    </div>
                    <div className="grid gap-2 sm:gap-3 grid-cols-3">
                      {displayedImages.map((img, idx) => (
                        <div
                          key={img.id}
                          className={`relative group aspect-square cursor-grab active:cursor-grabbing transition-all select-none ${
                            dragOverIndex === idx ? 'ring-2 ring-primary ring-offset-1 opacity-75' : ''
                          } ${
                            touchDragging && touchSrcIndex.current === idx ? 'opacity-50 scale-95' : ''
                          }`}
                          draggable
                          data-testid="car-image-tile"
                          data-image-id={img.id}
                          onDragStart={(e) => handleTileDragStart(e, idx)}
                          onDragOver={(e) => handleTileDragOver(e, idx)}
                          onDragLeave={handleTileDragLeave}
                          onDrop={(e) => handleTileDrop(e, idx)}
                          onDragEnd={handleTileDragEnd}
                          onTouchStart={(e) => handleTouchStart(e, idx)}
                          onTouchMove={handleTouchMove}
                          onTouchEnd={(e) => handleTouchEnd(e, idx)}
                        >
                          <img
                            src={img.url}
                            alt="Car image"
                            className="w-full h-full object-cover rounded-md pointer-events-none"
                            data-testid="car-image-img"
                            draggable={false}
                          />
                          {coverImageIndex === idx && (
                            <span className="absolute top-1 left-1 bg-black/60 text-white text-[10px] sm:text-xs px-1.5 py-0.5 rounded">Cover</span>
                          )}
                          {vinImageIndex === idx && (
                            <span className="absolute top-1 right-1 bg-blue-600/60 text-white text-[10px] sm:text-xs px-1.5 py-0.5 rounded">VIN</span>
                          )}
                          {formData.doNotAdvertise && (
                            <span className="absolute top-8 left-1 z-10 bg-white text-black font-bold text-xs sm:text-sm px-2 py-1 rounded shadow-md" data-testid="dna-badge">DNA</span>
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
                            className="absolute bottom-1 left-1 w-6 h-6 sm:w-7 sm:h-7 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
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
                        data-testid="add-image-tile"
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
                            {Array.from({ length: new Date().getFullYear() - 1960 + 1 }).map((_, idx) => {
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

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="doNotAdvertise"
                        checked={formData.doNotAdvertise}
                        onChange={(e) => handleInputChange("doNotAdvertise", e.target.checked)}
                        className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                        data-testid="do-not-advertise-checkbox"
                      />
                      <label htmlFor="doNotAdvertise" className="text-xs sm:text-sm font-medium text-gray-900">
                        Do Not Advertise
                      </label>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </ScrollArea>
      </form>

      {/* Image Viewer Modal (short tap on mobile) */}
      <Dialog open={!!viewerImage} onOpenChange={(open) => { if (!open) setViewerImage(null); }}>
        <DialogContent className="max-w-3xl p-2" data-testid="image-viewer-modal">
          <DialogHeader>
            <DialogTitle className="sr-only">Image preview</DialogTitle>
          </DialogHeader>
          {viewerImage && (
            <img
              src={viewerImage.url}
              alt="Car image preview"
              className="w-full max-h-[80vh] object-contain rounded-md"
              data-testid="image-viewer-img"
            />
          )}
        </DialogContent>
      </Dialog>

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
              <div className="space-y-4">
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
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">Reorder Image</p>
                  <div className="flex gap-2">
                    <Button
                      size="lg"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        const imageIndex = displayedImages.findIndex(img => img.id === selectedImageForRole.id);
                        handleMoveImageUp(imageIndex);
                      }}
                      disabled={displayedImages.findIndex(img => img.id === selectedImageForRole.id) === 0}
                    >
                      <ChevronUp className="w-4 h-4 mr-2" />
                      Move Up
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="flex-1"
                      onClick={() => {
                        const imageIndex = displayedImages.findIndex(img => img.id === selectedImageForRole.id);
                        handleMoveImageDown(imageIndex);
                      }}
                      disabled={displayedImages.findIndex(img => img.id === selectedImageForRole.id) === displayedImages.length - 1}
                    >
                      <ChevronDown className="w-4 h-4 mr-2" />
                      Move Down
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}