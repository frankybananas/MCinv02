"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { ArrowLeft, Edit, MoreVertical, Clock } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { Car, CarStatus } from "../types"

interface CarDetailProps {
  car: Car
  onBack: () => void
  onEdit: (car: Car) => void
  onReserve: () => void
  onStatusChange: (status: CarStatus) => void
}

export function CarDetail({ car, onBack, onEdit, onReserve, onStatusChange }: CarDetailProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

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
          <div className={`px-3 py-1 rounded-md text-sm font-medium ${getStatusColor(car.status)}`}>
            {car.status.charAt(0).toUpperCase() + car.status.slice(1).replace("-", " ")}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="w-8 h-8 sm:w-9 sm:h-9">
                <MoreVertical className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onStatusChange("in-stock")}>Mark as In Stock</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange("coming")}>Mark as Coming</DropdownMenuItem>
              <DropdownMenuItem onClick={onReserve}>Reserve Car</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStatusChange("sold")}>Mark as Sold</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-3 sm:p-4 md:p-6 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Image Gallery */}
              <Card>
                <CardContent className="p-2 sm:p-4">
                  <div className="relative">
                    <img
                      src={(car.images ?? [])[currentImageIndex]?.imageUrl || "/placeholder.svg"}
                      alt={`${car.year} ${car.make} ${car.model}`}
                      className="w-full object-contain rounded-md"
                    />
                    {(car.images ?? []).length > 1 && (
                      <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 bg-black/60 text-white px-2 py-1 rounded-md text-xs sm:text-sm">
                        {currentImageIndex + 1} / {(car.images ?? []).length}
                      </div>
                    )}
                  </div>

                  {(car.images ?? []).length > 1 && (
                    <ScrollArea className="mt-2 sm:mt-4">
                      <div className="flex gap-2 pb-2">
                        {(car.images ?? []).map((image, index) => (
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
