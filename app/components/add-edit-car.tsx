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
import type { Car } from "../types"

interface AddEditCarProps {
  car?: Car
  onSave: (carData: FormData) => Promise<void>
  onCancel: () => void
}

interface DisplayImage {
  id: string;      // MongoDB ObjectId for existing, UUID for new
  url: string;     // Public URL for existing, blob URL for new
  file?: File;     // The File object for new uploads
  isNew: boolean;
}

export function AddEditCar({ car, onSave, onCancel }: AddEditCarProps) {
  const [formData, setFormData] = useState({
    make: car?.make ?? "",
    model: car?.model ?? "",
    year: car?.year ?? new Date().getFullYear(),
    price: car?.price ?? 0,
    kilometers: car?.kilometers ?? 0,
    description: car?.description ?? "",
    color: car?.color ?? '',
    transmission: car?.transmission ?? 'automatic',
    vin: car?.vin ?? '',
    notes: car?.notes ?? '',
  });

  const [displayedImages, setDisplayedImages] = useState<DisplayImage[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const initialImages = car?.images?.map(img => ({
      id: img.id,
      url: img.imageUrl,
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
    setFormData((prev) => ({ ...prev, [field]: value }));
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSaving(true);

    const data = new FormData();

    Object.entries(formData).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        data.append(key, String(value));
      }
    });

    displayedImages.forEach(img => {
      if (img.isNew && img.file) {
        data.append('images', img.file);
      } else if (!img.isNew) {
        data.append('existingImages', img.id);
      }
    });

    try {
      await onSave(data);
    } catch (error) {
      console.error('Failed to save car:', error);
      toast.error('Failed to save car. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const isEditing = !!car;

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <form onSubmit={handleSubmit} className="flex flex-col h-full">
        <header className="bg-white border-b p-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" type="button" onClick={onCancel}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold">{isEditing ? "Edit Car" : "Add New Car"}</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" type="button" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </header>

        <ScrollArea className="flex-grow p-4">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Images</CardTitle>
              </CardHeader>
              <CardContent>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept="image/*"
                  multiple
                />
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                  {displayedImages.map((image) => (
                    <div key={image.id} className="relative aspect-square">
                      <img
                        src={image.url}
                        alt="Car image"
                        className="w-full h-full object-cover rounded-md"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6 rounded-full"
                        onClick={() => handleRemoveImage(image.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div
                    className="w-full aspect-square border-2 border-dashed rounded-md flex items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground">Add Image</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Vehicle Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Year</label>
                    <Input
                      type="number"
                      value={formData.year}
                      onChange={(e) => handleInputChange("year", Number.parseInt(e.target.value))}
                      min="1900"
                      max={new Date().getFullYear() + 1}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Price (R)</label>
                    <Input
                      type="number"
                      value={formData.price}
                      onChange={(e) => handleInputChange("price", Number.parseFloat(e.target.value))}
                      min="0"
                      step="100"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Make</label>
                  <Input
                    value={formData.make}
                    onChange={(e) => handleInputChange("make", e.target.value)}
                    placeholder="e.g. Toyota, Honda, BMW"
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Model</label>
                  <Input
                    value={formData.model}
                    onChange={(e) => handleInputChange("model", e.target.value)}
                    placeholder="e.g. Camry, Civic, 3 Series"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Kilometers</label>
                    <Input
                      type="number"
                      value={formData.kilometers}
                      onChange={(e) => handleInputChange("kilometers", Number.parseInt(e.target.value))}
                      min="0"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Color</label>
                    <Input
                      value={formData.color}
                      onChange={(e) => handleInputChange("color", e.target.value)}
                      placeholder="e.g. White, Black, Silver"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium">Transmission</label>
                  <Select
                    value={formData.transmission}
                    onValueChange={(value) => handleInputChange("transmission", value)}
                  >
                    <SelectTrigger>
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
                  <label className="text-sm font-medium">VIN</label>
                  <Input
                    value={formData.vin}
                    onChange={(e) => handleInputChange("vin", e.target.value)}
                    placeholder="Vehicle Identification Number"
                    maxLength={17}
                    required
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Notes</label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => handleInputChange("notes", e.target.value)}
                    placeholder="Additional notes about the vehicle..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </form>
    </div>
  );
}
