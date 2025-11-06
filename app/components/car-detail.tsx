"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { ArrowLeft, Edit, MoreVertical, Clock, ChevronLeft, ChevronRight, Share2, Download, Loader2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import type { Car, CarStatus, CarState } from "../types"
import { getStatusColor, STATUS_OPTIONS, formatStatusLabel } from "./status-utils"
import { downloadCarImages, downloadSingleImage, type DownloadResult } from "@/lib/image-download"

interface CarDetailProps {
  car: Car
  onBack: () => void
  onEdit: (car: Car) => void
  onReserve: () => void
  onStatusChange: (status: CarState) => void
}

export function CarDetail({ car, onBack, onEdit, onReserve, onStatusChange }: CarDetailProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [dealerInfo, setDealerInfo] = useState<{ name: string; phone: string; email: string } | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 })
  const [downloadingImageIndex, setDownloadingImageIndex] = useState<number | null>(null)

  // Detect iOS
  const isIOS = typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent)

  const images = (car.images ?? [])

  // Fetch logged-in salesperson info for footer
  useEffect(() => {
    let mounted = true
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/auth/me')
        if (!res.ok) return
        const data = await res.json()
        if (mounted && data?.success) {
          const d = data.data as { firstName?: string; lastName?: string; phone?: string; email?: string }
          const name = `${d.firstName ?? ''} ${d.lastName ?? ''}`.trim()
          setDealerInfo({ name, phone: d.phone ?? '', email: d.email ?? '' })
        }
      } catch {}
    }
    fetchMe()
    return () => { mounted = false }
  }, [])

  const shareableImages = useMemo(() => {
    if (!Array.isArray(images) || images.length === 0) return [] as typeof images
    if (images.length === 1) return images
    return images.slice(0, images.length - 1)
  }, [images])

  const buildShareText = useCallback((includeImageLinks = false) => {
    const lines: string[] = []
    const title = `${car.year} ${car.make} ${car.model}`.trim()
    lines.push(title)
    if (typeof car.price === 'number') lines.push(`Price: ${formatPrice(car.price)}`)
    if (car.kilometers != null) lines.push(`Kilometers: ${(car.kilometers ?? 0).toLocaleString()} km`)
    if (car.color) lines.push(`Color: ${car.color}`)
    if (car.transmission) lines.push(`Transmission: ${car.transmission}`)
    if (car.description) lines.push('', car.description)

    // Only include image links if explicitly requested (for fallback)
    if (includeImageLinks) {
      const imgUrls = shareableImages.map(i => i.imageUrl).filter(Boolean).slice(0, 3)
      if (imgUrls.length) {
        lines.push('', 'Sample Photos:')
        imgUrls.forEach((u, idx) => lines.push(`${idx + 1}. ${u}`))
      }
    }

    return lines.join('\n')
  }, [car, shareableImages])

  const buildContactText = useCallback(() => {
    const lines: string[] = []
    if (dealerInfo) {
      lines.push('—', 'Your Sales Contact:')
      if (dealerInfo.name) lines.push(`Name: ${dealerInfo.name}`)
      if (dealerInfo.phone) lines.push(`Mobile: ${dealerInfo.phone}`)
      if (dealerInfo.email) lines.push(`Email: ${dealerInfo.email}`)
    }
    return lines.join('\n')
  }, [dealerInfo])

  const chunkFiles = (files: File[], size = 30) => {
    const chunks: File[][] = []
    for (let i = 0; i < files.length; i += size) {
      chunks.push(files.slice(i, i + size))
    }
    return chunks
  }

  const onShare = useCallback(async () => {
    // Precompute message and URLs up-front (sync with user gesture)
    const carDetailsText = buildShareText(false)
    const contactText = buildContactText()
    const fullText = contactText ? `${carDetailsText}\n\n${contactText}` : carDetailsText
    const encodedText = encodeURIComponent(fullText)
    const whatsappUrl = `whatsapp://send?text=${encodedText}`
    const webWhatsappUrl = `https://wa.me/?text=${encodedText}`
    
    // Detect platform
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
    const isAndroid = /Android/i.test(userAgent)
    const isIOS = /iPhone|iPad|iPod/i.test(userAgent)

    try {
      // Step 1: Download all images to device
      if (images.length > 0) {
        setIsDownloading(true)

        const imageUrls = images.map(img => img.imageUrl).filter(Boolean) as string[]
        const filenamePrefix = `${car.year}_${car.make}_${car.model}`.replace(/\s+/g, '_')

        const result = await downloadCarImages({
          imageUrls,
          filenamePrefix,
          onProgress: (current, total) => {
            setDownloadProgress({ current, total })
          },
        })

        setIsDownloading(false)
        setDownloadProgress({ current: 0, total: 0 })

        if (!result.success) {
          console.warn('Image download failed:', result.errors)
        }
      }

      // Step 2: Open WhatsApp with platform-specific strategy
      if (isAndroid) {
        // Android: Navigate current page to WhatsApp app (works reliably)
        try {
          window.location.href = whatsappUrl
        } catch {
          try { window.open(whatsappUrl, '_self') } catch {}
        }
      } else if (isIOS) {
        // iOS: Direct window.open with app URL, fallback to web version
        // iOS Safari blocks delayed popups, so we avoid pre-opening
        try {
          const opened = window.open(whatsappUrl, '_blank')
          // If popup blocked or app not installed, try web WhatsApp
          if (!opened || opened.closed || typeof opened.closed === 'undefined') {
            setTimeout(() => { 
              window.open(webWhatsappUrl, '_blank') 
            }, 1000)
          }
        } catch {
          // Fallback to web WhatsApp if app URL fails
          window.open(webWhatsappUrl, '_blank')
        }
      } else {
        // Desktop/Other: Try app URL first, fallback to web
        try {
          const opened = window.open(whatsappUrl, '_blank')
          if (!opened || opened.closed || typeof opened.closed === 'undefined') {
            setTimeout(() => { window.open(webWhatsappUrl, '_blank') }, 500)
          }
        } catch {
          window.open(webWhatsappUrl, '_blank')
        }
      }

    } catch (error) {
      console.error('Share error:', error)
      // Final fallback: Open web WhatsApp with text and image links
      const fallbackText = buildShareText(true) + '\n\n' + buildContactText()
      const fallbackUrl = `https://wa.me/?text=${encodeURIComponent(fallbackText)}`
      
      if (isAndroid) {
        try { window.location.href = fallbackUrl } catch { try { window.open(fallbackUrl, '_self') } catch {} }
      } else {
        window.open(fallbackUrl, '_blank')
      }
    }
  }, [buildShareText, buildContactText, car.make, car.model, car.year, images])

  // Download single image (for iOS)
  const onDownloadSingleImage = useCallback(async (imageIndex: number) => {
    if (downloadingImageIndex !== null) return
    
    setDownloadingImageIndex(imageIndex)
    const image = images[imageIndex]
    if (!image?.imageUrl) {
      setDownloadingImageIndex(null)
      return
    }

    try {
      const filename = `${car.year}_${car.make}_${car.model}_${imageIndex + 1}`.replace(/\s+/g, '_')
      const success = await downloadSingleImage(image.imageUrl, filename)
      
      if (success) {
        console.log(`Downloaded image ${imageIndex + 1}`)
      } else {
        alert('Failed to download image. Please try again.')
      }
    } catch (error) {
      console.error('Download error:', error)
      alert('An error occurred while downloading the image.')
    } finally {
      setDownloadingImageIndex(null)
    }
  }, [car.make, car.model, car.year, images, downloadingImageIndex])

  const onDownloadImages = useCallback(async () => {
    if (isDownloading || images.length === 0) return

    setIsDownloading(true)
    setDownloadProgress({ current: 0, total: images.length })

    try {
      const imageUrls = images.map(img => img.imageUrl).filter(Boolean) as string[]
      const filenamePrefix = `${car.year}_${car.make}_${car.model}`.replace(/\s+/g, '_')

      const result: DownloadResult = await downloadCarImages({
        imageUrls,
        filenamePrefix,
        onProgress: (current, total) => {
          setDownloadProgress({ current, total })
        },
        onError: (error, url) => {
          console.error(`Failed to download image from ${url}:`, error)
        },
      })

      // Check for partial success (some images failed during fetch)
      if (result.errors.length > 0 && result.filesDownloaded > 0) {
        alert(`Downloaded ${result.filesDownloaded} image(s). ${result.errors.length} failed to fetch.`)
      } else if (result.success && result.filesDownloaded > 0) {
        // Full success feedback
        if (result.method === 'native') {
          alert(`Successfully saved ${result.filesDownloaded} image(s) to the selected folder.`)
        } else {
          alert(`Successfully downloaded ${result.filesDownloaded} image(s). Check your Downloads folder.`)
        }
      } else if (result.filesDownloaded > 0 && !result.success) {
        // Files were fetched but download method failed (likely user cancelled folder selection)
        if (result.method === 'native') {
          // User cancelled the folder picker - don't show error, just silent fail
          console.log('User cancelled folder selection')
        } else {
          alert(`Prepared ${result.filesDownloaded} image(s) but download failed. Please check your browser settings or try again.`)
        }
      } else {
        // Complete failure
        alert('Failed to download images. Please try again.')
      }
    } catch (error) {
      console.error('Download error:', error)
      alert('An error occurred while downloading images. Please try again.')
    } finally {
      setIsDownloading(false)
      setDownloadProgress({ current: 0, total: 0 })
    }
  }, [car.make, car.model, car.year, images, isDownloading])

  const goPrev = useCallback(() => {
    if (images.length === 0) return
    setCurrentImageIndex((i) => (i - 1 + images.length) % images.length)
  }, [images.length])

  const goNext = useCallback(() => {
    if (images.length === 0) return
    setCurrentImageIndex((i) => (i + 1) % images.length)
  }, [images.length])

  // Keyboard navigation when lightbox is open
  useEffect(() => {
    if (!isLightboxOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isLightboxOpen, goPrev, goNext])

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
      minimumFractionDigits: 0,
    }).format(price)
  }

  

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  // Build audit entries including a synthetic creation entry when missing
  const auditEntries = useMemo(() => {
    const entries = [...(car.auditLog ?? [])]
    const hasCreation = entries.some(e => (e.action || "").toLowerCase().includes("created"))
    if (!hasCreation && car.createdAt) {
      entries.unshift({
        action: "Car Created",
        details: "New car record created",
        user: (car as any).createdByPhone || "unknown",
        timestamp: car.createdAt,
      } as any)
    }
    // Reverse to show most recent first
    return entries.reverse()
  }, [car])

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="sticky top-[56px] z-30 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 p-3 sm:p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-base sm:text-lg font-semibold truncate">
            {car.year} {car.make} {car.model}
          </h1>
        </div>
        <div className="flex items-center gap-2" />
      </header>

      <ScrollArea className="flex-1">
        <div className="p-3 sm:p-4 md:p-6 max-w-6xl mx-auto">
          <div className="mb-3 sm:mb-4 flex justify-center">
            <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full shadow-sm px-2 py-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Badge className={`${getStatusColor(car.status)} cursor-pointer flex-shrink-0 whitespace-nowrap rounded-full px-3 py-1`}>
                    {formatStatusLabel(car.status)}
                  </Badge>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center">
                  {(STATUS_OPTIONS as CarState[]).map((statusOption) => (
                    <DropdownMenuItem
                      key={statusOption}
                      onClick={() => onStatusChange(statusOption)}
                    >
                      {formatStatusLabel(statusOption)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              {/* Only show Download button on Android and Desktop, not on iOS */}
              {typeof navigator !== 'undefined' && !/iPhone|iPad|iPod/i.test(navigator.userAgent) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 rounded-full px-3"
                  onClick={onDownloadImages}
                  disabled={isDownloading || images.length === 0}
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      {downloadProgress.current > 0 
                        ? `Preparing ${downloadProgress.current}/${downloadProgress.total}` 
                        : 'Preparing...'}
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-1" />
                      Download
                    </>
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-9 rounded-full px-3"
                onClick={onShare}
              >
                <Share2 className="w-4 h-4 mr-1" />
                Share
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Image Gallery */}
              <Card>
                <CardContent className="p-2 sm:p-4">
                  <div className="relative group">
                    <img
                      src={images[currentImageIndex]?.imageUrl || "/placeholder.svg"}
                      alt={`${car.year} ${car.make} ${car.model}`}
                      className="w-full object-contain rounded-md cursor-zoom-in"
                      decoding="async"
                      fetchPriority="high"
                      onClick={() => setIsLightboxOpen(true)}
                    />
                    {car.doNotAdvertise && (
                      <span className="absolute top-2 left-2 sm:top-4 sm:left-4 bg-white text-black font-bold text-sm sm:text-base px-3 py-1.5 rounded shadow-lg" data-testid="dna-badge">DNA</span>
                    )}
                    {/* iOS: Download button on main image */}
                    {isIOS && (
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="absolute top-2 right-2 sm:top-4 sm:right-4 rounded-full bg-black/60 hover:bg-black/80 text-white"
                        onClick={() => onDownloadSingleImage(currentImageIndex)}
                        disabled={downloadingImageIndex === currentImageIndex}
                        aria-label="Download this image"
                      >
                        {downloadingImageIndex === currentImageIndex ? (
                          <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 sm:h-5 sm:w-5" />
                        )}
                      </Button>
                    )}
                    {images.length > 1 && (
                      <>
                        {/* Index badge */}
                        <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 bg-black/60 text-white px-2 py-1 rounded-md text-xs sm:text-sm">
                          {currentImageIndex + 1} / {images.length}
                        </div>
                        {/* Prev/Next arrows over main image */}
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 text-white"
                          onClick={goPrev}
                          aria-label="Previous image"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="secondary"
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 text-white"
                          onClick={goNext}
                          aria-label="Next image"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </Button>
                      </>
                    )}
                  </div>

                  {images.length > 1 && (
                    <ScrollArea className="mt-2 sm:mt-4">
                      <div className="flex gap-2 pb-2">
                        {images.map((image, index) => (
                          <div key={image.id || index} className="relative flex-shrink-0 group/thumb">
                            <img
                              src={(image as any).thumbnailUrl || image.imageUrl || "/placeholder.svg"}
                              alt={`View ${index + 1}`}
                              className={`w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-md cursor-pointer border-2 ${
                                index === currentImageIndex ? "border-primary" : "border-transparent"
                              }`}
                              loading="lazy"
                              decoding="async"
                              onClick={() => setCurrentImageIndex(index)}
                            />
                            {car.doNotAdvertise && (
                              <span className="absolute top-0.5 left-0.5 bg-white text-black font-bold text-[8px] px-1 py-0.5 rounded shadow">DNA</span>
                            )}
                            {/* iOS: Download button on thumbnail */}
                            {isIOS && (
                              <Button
                                type="button"
                                size="icon"
                                variant="secondary"
                                className="absolute bottom-0.5 right-0.5 h-6 w-6 rounded-full bg-black/60 hover:bg-black/80 text-white opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onDownloadSingleImage(index)
                                }}
                                disabled={downloadingImageIndex === index}
                                aria-label={`Download image ${index + 1}`}
                              >
                                {downloadingImageIndex === index ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Download className="h-3 w-3" />
                                )}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>

              {/* Lightbox Dialog */}
              {images.length > 0 && (
                <Dialog open={isLightboxOpen} onOpenChange={setIsLightboxOpen}>
                  <DialogContent className="max-w-5xl w-[95vw] bg-black/90 border-0 p-2 sm:p-4">
                    <DialogTitle className="sr-only">Image gallery</DialogTitle>
                    <DialogDescription className="sr-only">Use left and right arrow keys or on-screen buttons to navigate images.</DialogDescription>
                    <div className="relative">
                      <img
                        src={images[currentImageIndex]?.imageUrl || "/placeholder.svg"}
                        alt={`Image ${currentImageIndex + 1}`}
                        className="w-full max-h-[80vh] object-contain rounded-md"
                        decoding="async"
                        loading="lazy"
                      />
                      {images.length > 1 && (
                        <>
                          <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 hover:bg-black/80 text-white"
                            onClick={goPrev}
                            aria-label="Previous image"
                          >
                            <ChevronLeft className="h-6 w-6" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 hover:bg-black/80 text-white"
                            onClick={goNext}
                            aria-label="Next image"
                          >
                            <ChevronRight className="h-6 w-6" />
                          </Button>
                          <div className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded-md text-xs sm:text-sm">
                            {currentImageIndex + 1} / {images.length}
                          </div>
                        </>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              )}


            </div>

            <div className="lg:col-span-1 space-y-6">
              {/* Combined Vehicle Details and Price/Status */}
              <Card>
                <CardHeader className="pb-0">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-base sm:text-lg">Vehicle Details</CardTitle>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="text-xs h-8" 
                      onClick={() => onEdit(car)}
                    >
                      <Edit className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                      Edit
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 text-sm sm:text-base">
                  {car.status === "reserved" && car.reservedBy && (
                    <div className="mb-4 p-3 bg-amber-50 text-amber-800 text-sm rounded-md border border-amber-200">
                      <div className="font-medium">Reservation</div>
                      <div>Reserved by {car.reservedBy}</div>
                    </div>
                  )}
                  <div className="divide-y divide-gray-200">
                    <div className="py-3 flex justify-between items-center">
                      <p className="text-muted-foreground">Price</p>
                      <p className="text-xl sm:text-2xl font-bold text-primary">{formatPrice(car.price ?? 0)}</p>
                    </div>
                    <div className="py-3 flex justify-between items-center">
                      <p className="text-muted-foreground">Year</p>
                      <p className="font-semibold">{car.year}</p>
                    </div>
                    <div className="py-3 flex justify-between items-center">
                      <p className="text-muted-foreground">Make</p>
                      <p className="font-semibold">{car.make}</p>
                    </div>
                    <div className="py-3 flex justify-between items-center">
                      <p className="text-muted-foreground">Model</p>
                      <p className="font-semibold">{car.model}</p>
                    </div>
                    <div className="py-3 flex justify-between items-center">
                      <p className="text-muted-foreground">Kilometers</p>
                      <p className="font-semibold">{(car.kilometers ?? 0).toLocaleString()}</p>
                    </div>
                    <div className="py-3 flex justify-between items-center">
                      <p className="text-muted-foreground">Color</p>
                      <p className="font-semibold capitalize">{car.color}</p>
                    </div>
                    <div className="py-3 flex justify-between items-center">
                      <p className="text-muted-foreground">Transmission</p>
                      <p className="font-semibold capitalize">{car.transmission || 'N/A'}</p>
                    </div>
                  </div>

                  {/* VIN intentionally not included in share text */}
                  <div className="space-y-1 pt-4">
                    <p className="text-muted-foreground">VIN</p>
                    <p className="font-mono text-xs sm:text-sm bg-muted/50 p-2 rounded-md break-all border">
                      {car.vin || 'N/A'}
                    </p>
                  </div>

                  {car.notes && (
                    <div className="space-y-1">
                      <p className="text-muted-foreground">Notes</p>
                      <p className="whitespace-pre-wrap">{car.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
          
          {/* Moved Audit Log to bottom */}
          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                  Audit Log
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
                  <div className="space-y-3 pr-2">
                    {auditEntries.slice(0, 3).map((entry, index) => (
                      <div key={index} className="flex items-start gap-3 pb-3 border-b last:border-b-0">
                        <div className="w-2 h-2 bg-primary rounded-full mt-1.5 sm:mt-2 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm sm:text-base">{entry.action}</p>
                          <p className="text-sm text-muted-foreground">{entry.details}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.user} • {formatDate(entry.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                    {auditEntries.length > 3 && (
                      <div className="space-y-3">
                        {auditEntries.slice(3).map((entry, index) => (
                          <div key={index + 3} className="flex items-start gap-3 pb-3 border-b last:border-b-0">
                            <div className="w-2 h-2 bg-primary rounded-full mt-1.5 sm:mt-2 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm sm:text-base">{entry.action}</p>
                              <p className="text-sm text-muted-foreground">{entry.details}</p>
                              <p className="text-xs text-muted-foreground">
                                {entry.user} • {formatDate(entry.timestamp)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
