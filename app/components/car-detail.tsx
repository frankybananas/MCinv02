"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
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
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-white border-b p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">
            {car.year} {car.make} {car.model}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(car)}>
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreVertical className="w-4 h-4" />
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
        <div className="p-4 space-y-6">
          {/* Image Gallery */}
          <div className="space-y-4">
            <div className="relative">
              <img
                src={(car.images ?? [])[currentImageIndex] || "/placeholder.svg"}
                alt={`${car.year} ${car.make} ${car.model}`}
                className="w-full h-64 object-cover rounded-lg"
              />
              {(car.images ?? []).length > 1 && (
                <div className="absolute bottom-4 right-4 bg-black/50 text-white px-2 py-1 rounded text-sm">
                  {currentImageIndex + 1} / {(car.images ?? []).length}
                </div>
              )}
            </div>

            {(car.images ?? []).length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {(car.images ?? []).map((image, index) => (
                  <img
                    key={index}
                    src={image || "/placeholder.svg"}
                    alt={`View ${index + 1}`}
                    className={`w-16 h-16 object-cover rounded cursor-pointer border-2 ${
                      index === currentImageIndex ? "border-blue-500" : "border-transparent"
                    }`}
                    onClick={() => setCurrentImageIndex(index)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Price and Status */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-green-600">{formatPrice(car.price ?? 0)}</p>
              {car.status === "reserved" && car.reservedBy && (
                <p className="text-sm text-yellow-600 mt-1">Reserved by {car.reservedBy}</p>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Badge
                  className={getStatusColor(car.status)}
                  style={{ fontSize: "14px", padding: "6px 12px" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {car.status === "in-stock"
                    ? "In Stock"
                    : car.status === "coming"
                      ? "Coming"
                      : car.status === "reserved"
                        ? "Reserved"
                        : "Sold"}
                </Badge>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(["in-stock", "coming", "reserved", "sold"] as CarStatus[]).map((statusOption) => (
                  <DropdownMenuItem
                    key={statusOption}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (statusOption !== car.status) {
                        onStatusChange(statusOption)
                      }
                    }}
                  >
                    {statusOption === "in-stock"
                      ? "In Stock"
                      : statusOption === "coming"
                        ? "Coming"
                        : statusOption === "reserved"
                          ? "Reserved"
                          : "Sold"}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Car Details */}
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Year</p>
                  <p className="font-semibold">{car.year}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Make</p>
                  <p className="font-semibold">{car.make}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Model</p>
                  <p className="font-semibold">{car.model}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Kilometers</p>
                  <p className="font-semibold">{(car.kilometers ?? 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Color</p>
                  <p className="font-semibold capitalize">{car.color}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Transmission</p>
                  <p className="font-semibold capitalize">{car.transmission}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">VIN</p>
                <p className="font-mono text-sm bg-muted p-2 rounded">{car.vin}</p>
              </div>

              {car.notes && (
                <div>
                  <p className="text-sm text-muted-foreground">Notes</p>
                  <p className="text-sm">{car.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Audit Log */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Audit Log
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(car.auditLog ?? []).slice(0, 3).map((entry, index) => (
                  <div key={index} className="flex items-start gap-3 pb-3 border-b last:border-b-0">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{entry.action}</p>
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
      </ScrollArea>
    </div>
  )
}
