"use client"

import { useState, useEffect } from "react"
import React from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CarIcon, Plus, UsersIcon, Trash2Icon } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import type { Car, CarStatus } from "../types"

import type { Client } from "../types"

interface DashboardProps {
  cars: Car[]
  clients: Client[]
  onCarSelect: (car: Car) => void
  onAddCar: () => void
  onAddClient: () => void
  activeTabId?: CarStatus | "clients" | "all"
  onTabChange?: (tabId: CarStatus | "clients") => void
  onStatusChange: (carId: string, status: CarStatus) => void
  onClientSelect?: (client: Client) => void
  onClientDelete?: (clientId: string) => void
}

export function Dashboard({ 
  cars, 
  clients, 
  onCarSelect, 
  onAddCar, 
  onAddClient, 
  activeTabId, 
  onTabChange,
  onStatusChange,
  onClientSelect,
  onClientDelete 
}: DashboardProps) {
  type TabId = CarStatus | "clients"
  // Use activeTabId from props or default to "all"
  const [activeTab, setActiveTab] = useState<TabId>(activeTabId as TabId || "all")
  
  // Update local state when activeTabId prop changes
  useEffect(() => {
    if (activeTabId) {
      setActiveTab(activeTabId as TabId)
    }
  }, [activeTabId])
  
  // Handle tab change
  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId)
    if (onTabChange) {
      onTabChange(tabId)
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

  const formatPrice = (price?: number | null) => {
    const validPrice = typeof price === 'number' ? price : 0;
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
      minimumFractionDigits: 0,
    }).format(validPrice)
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center text-center">
            <div>
              <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                <CarIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                Car Inventory
              </h1>
              <Badge variant="secondary" className="mt-2">
                {showClients
                  ? `${clients.length} ${clients.length === 1 ? 'client' : 'clients'}`
                  : `${filteredCars.length} ${filteredCars.length === 1 ? 'car' : 'cars'}`}
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b sticky top-[98px] z-10">
        <ScrollArea className="w-full">
          <div className="flex justify-center p-2 sm:p-4">
            <div className="flex gap-1 flex-wrap justify-center">
              {tabs.map((tab) => (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? "default" : "ghost"}
                  size="sm"
                  onClick={() => handleTabChange(tab.id)}
                  className="text-xs sm:text-sm"
                >
                  {tab.label}
                </Button>
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Main content */}
      <ScrollArea className="flex-1">
        <div className="p-2 sm:p-4 space-y-4 max-w-4xl mx-auto">
          {/* Client list */}
          {showClients && (
            <div key="clients-section" className="space-y-2 sm:space-y-4">
              {clients.length === 0 ? (
                <div key="no-clients-found" className="text-center py-12">
                  <UsersIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No clients found</p>
                </div>
              ) : (
                clients.map((client) => (
                  <Card key={client.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onClientSelect?.(client)}>
                    <CardContent className="p-3 sm:p-4 flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold text-base sm:text-lg">{client.firstName} {client.lastName}</h3>
                        <p className="text-xs sm:text-sm text-muted-foreground">{client.email}</p>
                        <p className="text-xs sm:text-sm text-muted-foreground">{client.phone}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onClientDelete?.(client.id); }}>
                        <Trash2Icon className="w-4 h-4" />
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* Car list */}
          {!showClients && (
            <div key="cars-section" className="space-y-2 sm:space-y-4">
              {filteredCars.length === 0 ? (
                <div key="no-cars-found" className="text-center py-12">
                  <CarIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No cars found in this category</p>
                </div>
              ) : (
                filteredCars.map((car) => (
                  <Card key={car.id} className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden" onClick={() => onCarSelect(car)}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <img
                          src={car.images?.[0]?.imageUrl || "/placeholder.svg"}
                          alt={`${car.year} ${car.make} ${car.model}`}
                          className="w-full sm:w-24 sm:h-24 h-48 object-cover rounded-lg"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <h3 className="font-semibold text-base sm:text-lg truncate">
                                {car.year} {car.make} {car.model}
                              </h3>
                              <p className="text-xl sm:text-2xl font-bold text-green-600">{formatPrice(car.price)}</p>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Badge
                                  className={`${getStatusColor(car.status)} cursor-pointer flex-shrink-0 whitespace-nowrap`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {car.status.charAt(0).toUpperCase() + car.status.slice(1).replace("-", " ")}
                                </Badge>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {(['in-stock', 'coming', 'reserved', 'sold'] as CarStatus[]).map((statusOption) => (
                                  <DropdownMenuItem
                                    key={statusOption}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (statusOption !== car.status) {
                                        onStatusChange(car.id, statusOption);
                                      }
                                    }}
                                  >
                                    {statusOption.charAt(0).toUpperCase() + statusOption.slice(1).replace("-", " ")}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm text-muted-foreground mt-2">
                            <span>{(car.kilometers ?? 0).toLocaleString()} km</span>
                            <span>{car.color}</span>
                            <span className="capitalize">{car.transmission}</span>
                          </div>
                          {car.status === "reserved" && car.reservedBy && (
                            <p className="text-xs sm:text-sm text-yellow-600 mt-1">Reserved by {car.reservedBy}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Floating Action Button */}
      <Button
        onClick={activeTab === "clients" ? onAddClient : onAddCar}
        size="lg"
        className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-lg z-20"
      >
        <Plus className="w-6 h-6" />
      </Button>
    </div>
  );
}
