'use client';

import React, { useState, useRef, useEffect } from 'react';
import Image from 'next/image';

interface OptimizedImageProps {
  src: string;
  alt: string;
  thumbnailSrc?: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  onLoad?: () => void;
  fill?: boolean;
  sizes?: string;
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down';
}

/**
 * OptimizedImage component with lazy loading and progressive image loading
 * 
 * Features:
 * - Lazy loading: Images load only when they enter viewport
 * - Progressive loading: Show low-res thumbnail first, then load full image
 * - Automatic blur placeholder
 * - Intersection Observer for efficient viewport detection
 */
export default function OptimizedImage({
  src,
  alt,
  thumbnailSrc,
  width,
  height,
  className = '',
  priority = false,
  onLoad,
  fill = false,
  sizes,
  objectFit = 'cover',
}: OptimizedImageProps) {
  const [isInView, setIsInView] = useState(priority);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showFullImage, setShowFullImage] = useState(priority);
  const imgRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (priority) return; // Skip intersection observer for priority images

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            // Start loading full image after a small delay
            setTimeout(() => setShowFullImage(true), 100);
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before image enters viewport
        threshold: 0.01,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, [priority]);

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  // If we have both thumbnail and full image, use progressive loading
  const useProgressiveLoading = thumbnailSrc && thumbnailSrc !== src && !priority;

  const imageProps = {
    alt,
    className: `${className} transition-opacity duration-300 ${
      isLoaded ? 'opacity-100' : 'opacity-0'
    }`,
    onLoad: handleLoad,
    ...(fill
      ? { fill: true, sizes, style: { objectFit } }
      : { width, height, style: { objectFit } }),
  };

  return (
    <div
      ref={imgRef}
      className={`relative ${fill ? 'w-full h-full' : ''}`}
      style={!fill && width && height ? { width, height } : undefined}
    >
      {/* Placeholder/Thumbnail */}
      {useProgressiveLoading && isInView && !showFullImage && (
        <Image
          src={thumbnailSrc}
          {...imageProps}
          priority={priority}
          quality={20}
        />
      )}

      {/* Full Image */}
      {(showFullImage || !useProgressiveLoading) && (isInView || priority) && (
        <Image
          src={src}
          {...imageProps}
          priority={priority}
          quality={85}
          loading={priority ? 'eager' : 'lazy'}
        />
      )}

      {/* Loading placeholder */}
      {!isInView && !priority && (
        <div
          className={`absolute inset-0 bg-muted animate-pulse ${className}`}
          style={!fill && width && height ? { width, height } : undefined}
        />
      )}
    </div>
  );
}
