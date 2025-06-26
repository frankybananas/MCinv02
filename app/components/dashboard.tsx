"use client"

import { useState, useEffect } from "react"
import React from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CarIcon, Plus, UsersIcon } from "lucide-react"
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
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-white border-b p-4">
        <div className="flex items-center justify-center">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <CarIcon className="w-6 h-6" />
            Car Inventory
          </h1>
        </div>
        <div className="flex justify-center mt-2">
          <Badge variant="secondary">
            {showClients 
              ? `${clients.length} ${clients.length === 1 ? 'client' : 'clients'}` 
              : `${filteredCars.length} ${filteredCars.length === 1 ? 'car' : 'cars'}`
            }
          </Badge>
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

      {/* Main Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Clients list */}
          {showClients && (
            <React.Fragment key="clients-section">
              {clients.length === 0 ? (
                <div className="text-center py-12">
                  <UsersIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No clients yet.</p>
                </div>
              ) : (
                clients.map((client) => (
                  <div key={client.id}>
                    <Card
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => onClientSelect && onClientSelect(client)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">
                              {client.firstName} {client.lastName}
                            </h3>
                            <p className="text-sm text-muted-foreground">{client.phone}</p>
                            {client.email && <p className="text-sm text-muted-foreground">{client.email}</p>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))
              )}
            </React.Fragment>
          )}

          {/* Car list */}
          {!showClients && (
            <React.Fragment key="cars-section">
              {filteredCars.length === 0 ? (
                <div className="text-center py-12">
                  <CarIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No cars found in this category</p>
                </div>
              ) : (
                filteredCars.map((car) => (
                  <div key={car.id}>
                    <Card
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => onCarSelect(car)}
                    >
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          <img
                            src={car.images?.[0] || "/placeholder.svg"}
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
                                    {car.status.charAt(0).toUpperCase() + car.status.slice(1).replace("-", " ")}
                                  </Badge>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {(new Array<CarStatus>("in-stock", "coming", "reserved", "sold")).map((statusOption) => (
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
                            <div className="flex gap-4 text-sm text-muted-foreground mt-2">
                              <span>{(car.kilometers ?? 0).toLocaleString()} km</span>
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
                  </div>
                ))
              )}
            </React.Fragment>
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
