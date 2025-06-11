"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowLeft, Upload, X } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Car } from "../types"

interface AddEditCarProps {
  car?: Car
  onSave: (carData: Partial<Car>) => void
  onCancel: () => void
}

export function AddEditCar({ car, onSave, onCancel }: AddEditCarProps) {
  const [formData, setFormData] = useState({
    images: car?.images || [],
    year: car?.year || new Date().getFullYear(),
    make: car?.make || "",
    model: car?.model || "",
    price: car?.price || 0,
    kilometers: car?.kilometers || 0,
    color: car?.color || "",
    transmission: car?.transmission || "automatic",
    vin: car?.vin || "",
    notes: car?.notes || "",
  })

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleImageUpload = () => {
    // Mock image upload - in real app, this would open camera/gallery
    const newImage = "/placeholder.svg?height=300&width=400"
    setFormData((prev) => ({
      ...prev,
      images: [...prev.images, newImage],
    }))
  }

  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  const isEditing = !!car

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-white border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">{isEditing ? "Edit Car" : "Add New Car"}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Save</Button>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          {/* Images */}
          <Card>
            <CardHeader>
              <CardTitle>Images</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {formData.images.map((image, index) => (
                  <div key={index} className="relative">
                    <img
                      src={image || "/placeholder.svg"}
                      alt={`Car image ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 w-6 h-6"
                      onClick={() => removeImage(index)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" className="h-32 border-dashed" onClick={handleImageUpload}>
                  <div className="text-center">
                    <Upload className="w-6 h-6 mx-auto mb-2" />
                    <span className="text-sm">Add Image</span>
                  </div>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
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
                  <label className="text-sm font-medium">Price ($)</label>
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
        </form>
      </ScrollArea>
    </div>
  )
}
