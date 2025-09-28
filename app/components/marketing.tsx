"use client";

import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Loader2, CheckSquare, X } from 'lucide-react';
import { toast } from 'sonner';
import { generateWhatsAppImages } from '@/lib/whatsapp-generator';
import { getStatusColor } from './status-utils';
import type { Car } from '../types';

interface MarketingProps {
  cars: Car[];
  onGenerationComplete?: (count: number) => void;
}

export function Marketing({ cars, onGenerationComplete }: MarketingProps) {
  const [selectedCars, setSelectedCars] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);

  const marketingCars = useMemo(() => {
    return cars.filter((car) => car.status === 'in-stock' || car.status === 'reserved');
  }, [cars]);

  const handleSelectAll = () => {
    if (selectedCars.size === marketingCars.length) {
      setSelectedCars(new Set());
    } else {
      setSelectedCars(new Set(marketingCars.map((car) => car._id)));
    }
  };

  const handleCarToggle = (carId: string) => {
    const newSelected = new Set(selectedCars);
    if (newSelected.has(carId)) {
      newSelected.delete(carId);
    } else {
      newSelected.add(carId);
    }
    setSelectedCars(newSelected);
  };

  const handleGenerate = async () => {
    if (selectedCars.size === 0) {
      toast.error('Please select at least one car');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateWhatsAppImages(Array.from(selectedCars));

      if (result.success) {
        const generatedCount = result.count ?? 0;
        toast.success(`Generated ${generatedCount} WhatsApp images! Check your gallery.`);
        onGenerationComplete?.(generatedCount);
        setSelectedCars(new Set()); // Clear selection after successful generation
      } else {
        toast.error(result.error || 'Failed to generate images');
      }
    } catch (error) {
      console.error('WhatsApp generation error:', error);
      toast.error('Failed to generate WhatsApp images');
    } finally {
      setIsGenerating(false);
    }
  };

  const formatPrice = (price?: number | null) => {
    const safePrice = typeof price === 'number' ? price : 0;
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0
    }).format(safePrice);
  };

  return (
    <div className="w-full max-w-full px-2 sm:px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] mx-auto">
      {/* Header with controls */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b mb-4 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">Marketing</h1>
          <Badge variant="secondary">
            {marketingCars.length} cars available
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSelectAll}
            className="flex items-center gap-2"
            disabled={marketingCars.length === 0}
          >
            {selectedCars.size === marketingCars.length ? (
              <X className="h-4 w-4" />
            ) : (
              <CheckSquare className="h-4 w-4" />
            )}
            {selectedCars.size === marketingCars.length ? 'Clear All' : 'Select All'}
          </Button>

          <Button
            onClick={handleGenerate}
            disabled={selectedCars.size === 0 || isGenerating}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
          >
            {isGenerating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageSquare className="h-4 w-4" />
            )}
            Generate {selectedCars.size > 0 && `(${selectedCars.size})`}
          </Button>
        </div>
      </div>

      {/* Cars grid */}
      {marketingCars.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              No cars available for marketing. Cars must be in-stock or reserved and have images.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {marketingCars.map((car) => (
            <Card
              key={car._id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                selectedCars.has(car._id) ? 'ring-2 ring-green-500 bg-green-50' : ''
              }`}
              onClick={() => handleCarToggle(car._id)}
            >
              <CardContent className="p-3">
                <div className="relative mb-3">
                  <img
                    src={car.images?.[0]?.imageUrl || "/placeholder.svg"}
                    alt={`${car.year} ${car.make} ${car.model}`}
                    className="w-full h-32 object-cover rounded-md"
                  />
                  <div className="absolute top-2 left-2">
                    <input
                      type="checkbox"
                      checked={selectedCars.has(car._id)}
                      onChange={() => handleCarToggle(car._id)}
                      className="h-4 w-4 rounded border border-white bg-white/90 text-green-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500"
                    />
                  </div>
                  <div className="absolute top-2 right-2">
                    <Badge
                      variant="secondary"
                      className={`${getStatusColor(car.status)} text-white text-xs`}
                    >
                      {car.status === 'in-stock' ? 'In Stock' : 'Reserved'}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="font-medium text-sm truncate">
                    {car.year} {car.make} {car.model}
                  </h3>
                  <p className="text-lg font-semibold text-green-600">
                    {formatPrice(car.price)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
