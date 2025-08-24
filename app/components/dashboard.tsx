"use client"

import { useState } from "react"
import React from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CarIcon, Plus, UsersIcon, Trash2Icon } from "lucide-react"
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
  // header moved to Root layout
  const tabs: { id: DashboardTab | 'admin'; label: string; href?: string }[] = [
    { id: "all", label: "All" },
    { id: "in-stock", label: "In-Stock" },
    { id: "coming", label: "Coming" },
    { id: "reserved", label: "Reserved" },
    { id: "sold", label: "Sold" },
    { id: "clients", label: "Clients" },
    { id: "delivery", label: "Delivery" },
  ];

  if (userRole === 'admin') {
    tabs.push({ id: 'admin', label: 'Admin' });
  }

  const showClients = activeStatus === "clients"
  const showDelivery = activeStatus === "delivery"

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

      {/* Tabs */}
      <div className="bg-white border-b sticky top-[56px] z-10">
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
                      onStatusFilterChange(tab.id as DashboardTab);
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

      {/* Quick actions under tabs */}
      <div className="bg-white border-b z-10">
        <div className="max-w-4xl mx-auto flex justify-center gap-2 p-3">
          <Button onClick={onAddCar}>Add Car</Button>
          <Button onClick={onAddClient} variant="secondary">Add Client</Button>
        </div>
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

      {/* Floating Action Button */}
      <Button
        onClick={activeStatus === "clients" ? onAddClient : onAddCar}
        size="lg"
        className="fixed bottom-6 right-6 rounded-full w-14 h-14 shadow-lg z-20"
      >
        <Plus className="w-6 h-6" />
      </Button>
    </div>
  );
}
