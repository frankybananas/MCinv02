"use client"

import { useState } from "react"
import React from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CarIcon, Plus, UsersIcon, Trash2Icon, ArrowLeft, Car as CarLucide, Users, X } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import type { Car, CarStatus, CarState, DashboardTab, Delivery } from "../types"

import type { Client } from "../types"

interface DashboardProps {
  cars: Car[];
  clients: Client[];
  activeStatus: DashboardTab;
  onStatusFilterChange: (status: DashboardTab) => void;
  onCarSelect: (car: Car) => void;
  onAddCar: () => void;
  onAddClient: () => void;
  onStatusChange: (carId: string, status: CarState) => void;
  onClientSelect: (client: Client | null) => void;
  onClientDelete: (clientId: string) => void;
  onLogout: () => void;
  userRole: string | null;
  deliveries?: Delivery[];
  onDeliverySelect?: (delivery: Delivery) => void;
}

//

export function Dashboard({ 
  cars, 
  clients, 
  activeStatus,
  onStatusFilterChange,
  onCarSelect, 
  onAddCar, 
  onAddClient, 
  onStatusChange, 
  onClientSelect, 
  onClientDelete,
  onLogout,
  userRole,
  deliveries = [],
  onDeliverySelect
}: DashboardProps) {
  const [fabOpen, setFabOpen] = useState(false)
  // header moved to Root layout
  // Top-level tabs: Stock (car area), Clients, Delivery, and Admin (if role)
  const tabs: { id: DashboardTab | 'admin'; label: string; href?: string }[] = [
    { id: "all", label: "Stock" },
    { id: "clients", label: "Clients" },
    { id: "delivery", label: "Delivery" },
  ];

  if (userRole === 'admin') {
    tabs.push({ id: 'admin', label: 'Admin' });
  }

  const showClients = activeStatus === "clients"
  const showDelivery = activeStatus === "delivery"
  const isStockStatus = ['all','in-stock','coming','reserved','sold'].includes(activeStatus)

    const getStatusColor = (status: CarState) => {
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

      {/* Top-level Tabs (hidden whenever viewing Stock) */}
      {!isStockStatus && (
        <>
          {/* Mobile/Tablet: floating bottom navbar for top-level tabs */}
          <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 bg-white/80 dark:bg-neutral-900/80 backdrop-blur border-t shadow-lg">
            <ScrollArea className="w-full">
              <div className="flex justify-center p-2 sm:p-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
                <div className="flex gap-1 flex-wrap justify-center">
                  {tabs.map((tab) => (
                    <Button
                      key={tab.id}
                      variant={activeStatus === tab.id ? "default" : "ghost"}
                      size="sm"
                      onClick={() => {
                        if (tab.id === 'admin') {
                          window.location.href = '/admin';
                        } else {
                          onStatusFilterChange(tab.id as DashboardTab)
                        }
                      }}
                      className="h-9 rounded-md px-3 text-xs sm:text-sm"
                    >
                      {tab.label}
                    </Button>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Desktop: top sticky navbar for top-level tabs */}
          <div className="hidden lg:block bg-white border-b sticky top-[56px] z-10">
            <ScrollArea className="w-full">
              <div className="flex justify-center p-2 sm:p-4">
                <div className="flex gap-1 flex-wrap justify-center">
                  {tabs.map((tab) => (
                    <Button
                      key={tab.id}
                      variant={activeStatus === tab.id ? "default" : "ghost"}
                      size="sm"
                      onClick={() => {
                        if (tab.id === 'admin') {
                          window.location.href = '/admin';
                        } else {
                          onStatusFilterChange(tab.id as DashboardTab)
                        }
                      }}
                      className="h-9 rounded-md px-3 text-xs sm:text-sm"
                    >
                      {tab.label}
                    </Button>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </div>
        </>
      )}

      {/* Secondary navbar for Stock status filters */}
      {isStockStatus && (
        <>
          {/* Mobile/Tablet: floating bottom navbar */}
          <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 bg-white/80 dark:bg-neutral-900/80 backdrop-blur border-t shadow-lg">
            <ScrollArea className="w-full">
              <div className="relative flex items-center justify-center p-2 sm:p-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
                {/* Back arrow to show top-level dashboard */}
                <button
                  aria-label="Back to dashboard"
                  className="absolute left-3 sm:left-6 inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                  onClick={() => onStatusFilterChange('delivery')}
                >
                  <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                  <span className="hidden sm:inline">Back</span>
                </button>
                <div className="flex gap-1 flex-wrap justify-center">
                  {([
                    { id: 'all', label: 'All' },
                    { id: 'in-stock', label: 'In-Stock' },
                    { id: 'coming', label: 'Coming' },
                    { id: 'reserved', label: 'Reserved' },
                    { id: 'sold', label: 'Sold' },
                  ] as {id: DashboardTab; label: string}[]).map((s) => (
                    <Button
                      key={s.id}
                      variant={activeStatus === s.id ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => onStatusFilterChange(s.id)}
                      className="h-9 rounded-md px-3 text-xs sm:text-sm"
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </div>

          {/* Desktop: top sticky navbar */}
          <div className="hidden lg:block bg-white border-b sticky top-[56px] z-10">
            <ScrollArea className="w-full">
              <div className="relative flex items-center justify-center p-2 sm:p-3">
                {/* Back arrow to show top-level dashboard */}
                <button
                  aria-label="Back to dashboard"
                  className="absolute left-3 sm:left-6 inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
                  onClick={() => onStatusFilterChange('delivery')}
                >
                  <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
                  <span className="hidden sm:inline">Back</span>
                </button>
                <div className="flex gap-1 flex-wrap justify-center">
                  {([
                    { id: 'all', label: 'All' },
                    { id: 'in-stock', label: 'In-Stock' },
                    { id: 'coming', label: 'Coming' },
                    { id: 'reserved', label: 'Reserved' },
                    { id: 'sold', label: 'Sold' },
                  ] as {id: DashboardTab; label: string}[]).map((s) => (
                    <Button
                      key={s.id}
                      variant={activeStatus === s.id ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => onStatusFilterChange(s.id)}
                      className="h-9 rounded-md px-3 text-xs sm:text-sm"
                    >
                      {s.label}
                    </Button>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </div>
        </>
      )}


      {/* Main content */}
      <ScrollArea className="flex-1">
        <div className={`p-2 sm:p-4 space-y-4 max-w-4xl mx-auto pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-4`}>
          {/* Client list */}
          {showClients && (
            <div key="clients-section" className="space-y-2 sm:space-y-4">
              {clients.length === 0 ? (
                <div key="no-clients-found" className="text-center py-12">
                  <UsersIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No clients found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {clients.map((client) => (
                    <Card key={client._id} className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden" onClick={() => onClientSelect(client)}>
                      <CardContent className="p-3 sm:p-4 flex justify-between items-center">
                        <div>
                          <h3 className="font-semibold text-base sm:text-lg">{client.firstName} {client.lastName}</h3>
                          <p className="text-sm text-muted-foreground">{client.email}</p>
                          <p className="text-sm text-muted-foreground">{client.phone}</p>
                          {(userRole === 'admin' || userRole === 'manager') && client.createdByPhone && (
                            <p className="text-xs text-muted-foreground mt-1">Owner: {client.createdByPhone}</p>
                          )}

          {/* Delivery list */}
          {showDelivery && (
            <div key="delivery-section" className="space-y-2 sm:space-y-4">
              {deliveries.length === 0 ? (
                <div key="no-deliveries-found" className="text-center py-12">
                  <CarIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No deliveries assigned to you yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {deliveries.map((d) => (
                    <Card key={d._id} className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden" onClick={() => onDeliverySelect?.(d)}>
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-base sm:text-lg truncate">
                              {typeof d.car === 'object' ? `${(d.car as any).year} ${(d.car as any).make} ${(d.car as any).model}` : 'Car'}
                            </h3>
                            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                              Status: {d.status}
                            </p>
                            {d.deliveryDate && (
                              <p className="text-xs sm:text-sm text-muted-foreground">Delivery: {new Date(d.deliveryDate).toLocaleDateString()}</p>
                            )}
                          </div>
                          <Badge className="flex-shrink-0">Delivery</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
                        </div>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onClientDelete?.(client._id); }} className="text-muted-foreground hover:text-red-500">
                          <Trash2Icon className="w-5 h-5" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Car list */}
          {!showClients && (
            <div key="cars-section" className="space-y-2 sm:space-y-4">
              {cars.length === 0 ? (
                <div key="no-cars-found" className="text-center py-12">
                  <CarIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No cars found in this category</p>
                </div>
              ) : (
                cars.map((car) => (
                  <Card key={car._id} className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden" onClick={() => onCarSelect(car)}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex flex-col sm:flex-row gap-4">
                        <img
                          src={car.images?.[0]?.imageUrl || "/placeholder.svg"}
                          alt={`${car.year} ${car.make} ${car.model}`}
                          className="w-full sm:w-24 object-contain rounded-lg"
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
                                {(['in-stock', 'coming', 'reserved', 'sold'] as CarState[]).map((statusOption) => (
                                  <DropdownMenuItem
                                    key={statusOption}
                                    onClick={(e: React.MouseEvent) => {
                                      e.stopPropagation();
                                      if (statusOption !== car.status) {
                                        onStatusChange(car._id, statusOption);
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

      {/* Floating Action Button with Menu */}
      <div className="fixed right-6 z-40 bottom-[calc(4rem+env(safe-area-inset-bottom))] lg:bottom-6 flex flex-col items-center">
        {/* Menu Items */}
        <div className={`flex flex-col items-center gap-3 mb-3 transition-all duration-300 ${fabOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
          <div className="flex items-center gap-3">
            <span className="bg-black/80 text-white px-3 py-1 rounded-md text-sm font-medium whitespace-nowrap shadow-lg">
              Add Client
            </span>
            <Button
              onClick={() => {
                onAddClient()
                setFabOpen(false)
              }}
              size="lg"
              variant="secondary"
              className="rounded-full w-12 h-12 shadow-lg hover:shadow-xl transition-all duration-200 bg-white hover:bg-gray-50 border border-gray-200"
            >
              <Users className="w-5 h-5 text-gray-700" />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <span className="bg-black/80 text-white px-3 py-1 rounded-md text-sm font-medium whitespace-nowrap shadow-lg">
              Add Car
            </span>
            <Button
              onClick={() => {
                onAddCar()
                setFabOpen(false)
              }}
              size="lg"
              className="rounded-full w-12 h-12 shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <CarLucide className="w-5 h-5" />
            </Button>
          </div>
        </div>
        
        {/* Main FAB */}
        <Button
          onClick={() => setFabOpen(!fabOpen)}
          size="lg"
          className={`rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-all duration-300 ${
            fabOpen ? 'rotate-45 bg-red-500 hover:bg-red-600' : 'rotate-0'
          }`}
        >
          <Plus className="w-6 h-6" />
        </Button>
        
        {/* Backdrop */}
        {fabOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-20 -z-10"
            onClick={() => setFabOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
