"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { generateWhatsAppImages } from '@/lib/whatsapp-generator';

interface WhatsAppButtonProps {
  onGenerationComplete?: (count: number) => void;
}

export function WhatsAppButton({ onGenerationComplete }: WhatsAppButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (isGenerating) return;

    setIsGenerating(true);
    try {
      const result = await generateWhatsAppImages();
      
      if (result.success && result.count !== undefined) {
        toast.success(`Generated ${result.count} WhatsApp images! Check your gallery.`);
        onGenerationComplete?.(result.count);
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

  return (
    <div className="pointer-events-none fixed right-4 bottom-[calc(7.25rem+env(safe-area-inset-bottom))] z-50 sm:right-6">
      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-3 rounded-full bg-green-500/25 blur-lg shadow-[0_24px_44px_-18px_rgba(34,197,94,0.6)]"
        />
        <Button
          type="button"
          size="icon"
          onClick={handleGenerate}
          disabled={isGenerating}
          aria-label="Generate WhatsApp status images"
          className="pointer-events-auto h-14 w-14 rounded-full border border-green-200/30 bg-green-500/90 text-white shadow-xl ring-1 ring-green-200/70 backdrop-blur-2xl transition-all duration-300 hover:bg-green-600/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <MessageSquare className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
