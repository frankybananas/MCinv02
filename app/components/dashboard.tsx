"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Plus, CarIcon } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import type { Car, CarStatus } from "../types"

import type { Client } from "../types"

interface DashboardProps {
  cars: Car[]
  clients: Client[]
  onCarSelect: (car: Car) => void
  onAddCar: () => void
  onAddClient: () => void
  activeTabId?: (tabId: CarStatus | "clients") => void
  onStatusChange: (carId: string, status: CarStatus) => void
}

export function Dashboard({ cars, clients, onCarSelect, onAddCar, onAddClient, activeTabId, onStatusChange }: DashboardProps) {
  type TabId = CarStatus | "clients"
  const [activeTab, setActiveTab] = useState<TabId>("all")
  
  // Update parent component with active tab
  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId)
    if (activeTabId) {
      activeTabId(tabId)
    }
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: "all", label: "All" },
    { id: "in-stock", label: "In-Stock" },
    { id: "coming", label: "Coming" },
    { id: "reserved", label: "Reserved" },
    { id: "sold", label: "Sold" },
    { id: "clients", label: "Clients" },
  ]

  const filteredCars = activeTab === "all" ? cars : 
    activeTab === "in-stock" ? cars.filter((car) => car.status !== "coming") : 
    cars.filter((car) => car.status === activeTab)
  const showClients = activeTab === "clients"

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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
      minimumFractionDigits: 0,
    }).format(price)
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-white border-b p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <CarIcon className="w-6 h-6" />
            Car Inventory
          </h1>
          <Badge variant="secondary">{filteredCars.length} cars</Badge>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b">
        <ScrollArea className="w-full">
          <div className="flex gap-1 p-4">
            {tabs.map((tab) => (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? "default" : "ghost"}
                size="sm"
                onClick={() => handleTabChange(tab.id)}
                className="whitespace-nowrap"
              >
                {tab.label}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Clients list */}
      {showClients && (
        <div className="p-4 space-y-4">
          {clients.length === 0 && <p className="text-sm text-muted-foreground">No clients yet.</p>}
          {clients.map((client: Client) => (
            <Card key={client.id} className="cursor-default">
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <p className="font-medium">{client.name}</p>
                  <p className="text-sm text-muted-foreground">{client.phone}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Car list */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {filteredCars.map((car) => (
            <Card
              key={car.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => onCarSelect(car)}
            >
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <img
                    src={car.images[0] || "/placeholder.svg"}
                    alt={`${car.year} ${car.make} ${car.model}`}
                    className="w-20 h-20 object-cover rounded-lg"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">
                          {car.year} {car.make} {car.model}
                        </h3>
                        <p className="text-2xl font-bold text-green-600">{formatPrice(car.price)}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Badge
                            className={getStatusColor(car.status)}
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
                                  onStatusChange(car.id, statusOption)
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
                    <div className="flex gap-4 text-sm text-muted-foreground mt-2">
                      <span>{car.kilometers.toLocaleString()} km</span>
                      <span>{car.color}</span>
                      <span className="capitalize">{car.transmission}</span>
                    </div>
                    {car.status === "reserved" && car.reservedBy && (
                      <p className="text-sm text-yellow-600 mt-1">Reserved by {car.reservedBy}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredCars.length === 0 && (
            <div className="text-center py-12">
              <CarIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No cars found in this category</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Floating Action Button */}
      <Button 
        onClick={activeTab === "clients" ? onAddClient : onAddCar} 
        size="lg" 
        className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-lg"
      >
        <Plus className="w-6 h-6" />
      </Button>
    </div>
  )
}
