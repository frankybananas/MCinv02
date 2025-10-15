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
    return cars.filter((car) => 
      (car.status === 'in-stock' || car.status === 'reserved') && 
      !car.doNotAdvertise
    );
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

      {/* Cars list - Compact one-liner layout */}
      {marketingCars.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">
              No cars available for marketing. Cars must be in-stock or reserved and have images.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2 w-full max-w-full min-w-0">
          {marketingCars.map((car) => (
            <Card
              key={car._id}
              className={`cursor-pointer transition-all hover:shadow-md w-full max-w-full min-w-0 overflow-hidden ${
                selectedCars.has(car._id) ? 'ring-2 ring-green-500 bg-green-50/50' : ''
              }`}
              onClick={() => handleCarToggle(car._id)}
            >
              <CardContent className="p-0 min-w-0">
                <div className="flex items-center gap-2.5 w-full min-w-0 py-[1px]">
                  {/* Checkbox */}
                  <div className="flex-shrink-0 pl-3">
                    <input
                      type="checkbox"
                      checked={selectedCars.has(car._id)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleCarToggle(car._id);
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-2 focus:ring-green-500 focus:ring-offset-0"
                      aria-label={`Select ${car.year} ${car.make} ${car.model}`}
                    />
                  </div>

                  {/* Thumbnail */}
                  <div className="flex-shrink-0 py-[1px]">
                    <img
                      src={car.images?.[0]?.imageUrl || "/placeholder.svg"}
                      alt={`${car.year} ${car.make} ${car.model}`}
                      className="w-24 h-16 object-cover rounded border border-gray-200"
                    />
                  </div>

                  {/* Car details - compact two-line layout */}
                  <div className="flex-1 min-w-0 pr-3 py-1 flex flex-col justify-center gap-0.5">
                    {/* Line 1: Year Make Model */}
                    <h3 className="font-semibold text-sm leading-tight truncate">
                      {car.year} {car.make} {car.model}
                    </h3>
                    
                    {/* Line 2: Price • Km • Color • Transmission • Status */}
                    <div className="flex items-center gap-1 text-xs leading-tight flex-wrap">
                      <span className="font-bold text-sm text-green-600 flex-shrink-0">
                        {formatPrice(car.price)}
                      </span>
                      {car.kilometers != null && (
                        <span className="text-muted-foreground flex-shrink-0">• {car.kilometers.toLocaleString()} km</span>
                      )}
                      {car.color && (
                        <span className="text-muted-foreground flex-shrink-0">• {car.color}</span>
                      )}
                      {car.transmission && (
                        <span className="text-muted-foreground flex-shrink-0">• {car.transmission}</span>
                      )}
                      <span className={`flex-shrink-0 ${car.status === 'reserved' ? 'text-amber-600' : 'text-blue-600'}`}>
                        • {car.status === 'in-stock' ? 'In Stock' : 'Reserved'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
