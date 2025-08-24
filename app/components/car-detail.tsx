"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { ArrowLeft, Edit, MoreVertical, Clock, ChevronLeft, ChevronRight, Share2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import type { Car, CarStatus, CarState } from "../types"

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

  const buildShareText = useCallback(() => {
    const lines: string[] = []
    const title = `${car.year} ${car.make} ${car.model}`.trim()
    lines.push(title)
    if (typeof car.price === 'number') lines.push(`Price: ${formatPrice(car.price)}`)
    if (car.kilometers != null) lines.push(`Kilometers: ${(car.kilometers ?? 0).toLocaleString()} km`)
    if (car.color) lines.push(`Color: ${car.color}`)
    if (car.transmission) lines.push(`Transmission: ${car.transmission}`)
    if (car.description) lines.push('', car.description)

    // Optional: include a few direct links as references (not required when attaching files)
    const imgUrls = images.map(i => i.imageUrl).filter(Boolean).slice(0, 3)
    if (imgUrls.length) {
      lines.push('', 'Sample Photos:')
      imgUrls.forEach((u, idx) => lines.push(`${idx + 1}. ${u}`))
    }

    if (dealerInfo) {
      lines.push('', '—', 'Your Sales Contact:')
      if (dealerInfo.name) lines.push(`Name: ${dealerInfo.name}`)
      if (dealerInfo.phone) lines.push(`Mobile: ${dealerInfo.phone}`)
      if (dealerInfo.email) lines.push(`Email: ${dealerInfo.email}`)
    }

    return lines.join('\n')
  }, [car, images, dealerInfo])

  const chunkFiles = (files: File[], size = 30) => {
    const chunks: File[][] = []
    for (let i = 0; i < files.length; i += size) {
      chunks.push(files.slice(i, i + size))
    }
    return chunks
  }

  const onShare = useCallback(async () => {
    const text = buildShareText()

    // Try native share with attached image files (best UX on mobile)
    try {
      const navAny = typeof navigator !== 'undefined' ? (navigator as any) : undefined
      if (navAny?.share) {
        // Attempt to fetch ALL images and attach as files. We'll batch share to respect platform limits.
        const imgUrls = images.map(i => i.imageUrl).filter(Boolean) as string[]
        const files: File[] = []
        for (let i = 0; i < imgUrls.length; i++) {
          const url = imgUrls[i]
          try {
            const resp = await fetch(url, { mode: 'cors' })
            const blob = await resp.blob()
            const type = blob.type || 'image/jpeg'
            const name = `car_${car.make}_${car.model}_${i + 1}.${type.includes('png') ? 'png' : 'jpg'}`
            files.push(new File([blob], name, { type }))
          } catch {
            // If any image fails due to CORS or size, skip that file
          }
        }

        // If device supports file sharing, share images in batches first,
        // then open WhatsApp with the details as a separate text message.
        if (files.length && navAny.canShare) {
          const batches = chunkFiles(files, 10)
          for (const batch of batches) {
            if (navAny.canShare({ files: batch })) {
              await navAny.share({
                title: `${car.year} ${car.make} ${car.model}`,
                files: batch,
              })
            } else {
              // Fallback: if a batch isn't supported, skip it
            }
          }
          const wa = `https://wa.me/?text=${encodeURIComponent(text)}`
          window.open(wa, '_blank')
          return
        } else {
          // If we can't attach files, share text only (native sheet)
          await navAny.share({
            title: `${car.year} ${car.make} ${car.model}`,
            text,
          })
          return
        }
      }
    } catch (_) {
      // ignore and fall back to WhatsApp URL
    }

    // Fallback: WhatsApp text share (no attachments when Web Share API not available)
    const wa = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(wa, '_blank')
  }, [buildShareText, car.make, car.model, car.year, images])

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

  const getStatusColor = (status: CarStatus) => {
    switch (status) {
      case "in-stock":
        return "bg-green-100 text-green-800"
      case "coming":
        return "bg-blue-100 text-blue-800"
      case "reserved":
        return "bg-yellow-100 text-yellow-800"
      case "sold":
        return "bg-gray-100 text-gray-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white border-b p-3 sm:p-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-base sm:text-lg font-semibold truncate">
            {car.year} {car.make} {car.model}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className={`px-3 py-1 rounded-md text-sm font-medium ${getStatusColor(car.status)} cursor-pointer`}>
                {car.status.charAt(0).toUpperCase() + car.status.slice(1).replace("-", " ")}
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onStatusChange("in-stock")}>Mark as In Stock</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange("coming")}>Mark as Coming</DropdownMenuItem>
              <DropdownMenuItem onClick={onReserve}>Reserve Car</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange("sold")}>Mark as Sold</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="secondary" size="sm" className="h-8" onClick={onShare}>
            <Share2 className="w-4 h-4 mr-1" />
            Share
          </Button>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-3 sm:p-4 md:p-6 max-w-6xl mx-auto">
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
                      onClick={() => setIsLightboxOpen(true)}
                    />
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
                          <img
                            key={image.id || index}
                            src={image.imageUrl || "/placeholder.svg"}
                            alt={`View ${index + 1}`}
                            className={`w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-md cursor-pointer border-2 flex-shrink-0 ${
                              index === currentImageIndex ? "border-primary" : "border-transparent"
                            }`}
                            onClick={() => setCurrentImageIndex(index)}
                          />
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
                <div className="space-y-3">
                  {(car.auditLog ?? []).slice(0, 5).map((entry, index) => (
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
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
