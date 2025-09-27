"use client"

import { useEffect, useState } from "react"
import React from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CarIcon, Plus, UsersIcon, Trash2Icon, ArrowLeft, Car as CarLucide, Users, X, Check, Truck, CheckCircle, Clock, Tag, BookmarkCheck, Wand2, Bell } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu"
import type { Car, CarStatus, CarState, DashboardTab, Delivery, NotificationItem } from "../types"
import { getStatusColor, STATUS_OPTIONS, formatStatusLabel } from "./status-utils"
import { Todo } from './todo'
import { MainMenu } from "./main-menu"

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
  notifications?: NotificationItem[];
  onNotificationSelect?: (item: NotificationItem) => void;
  unreadNotificationsCount?: number;
  todoEnabled?: boolean;
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
  onDeliverySelect,
  notifications = [],
  onNotificationSelect,
  unreadNotificationsCount = 0,
  todoEnabled = false
}: DashboardProps) {
  const [fabOpen, setFabOpen] = useState(false)
  const [sortKey, setSortKey] = useState<'recent' | 'price' | 'year' | 'mileage' | 'model'>('recent')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const showClients = activeStatus === "clients"
  const showDelivery = activeStatus === "delivery"
  const showNotifications = activeStatus === "notifications"
  const showTodo = activeStatus === "todo"

  useEffect(() => {
    if (showTodo && fabOpen) {
      setFabOpen(false)
    }
  }, [showTodo, fabOpen])
  const isStockStatus = ['all','in-stock','coming','reserved','sold','demo'].includes(activeStatus)

  const formatPrice = (price?: number | null) => {
    const validPrice = typeof price === 'number' ? price : 0;
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
      minimumFractionDigits: 0,
    }).format(validPrice)
  }

  const sortedCars = React.useMemo(() => {
    const kmOf = (c: any) => (typeof c?.kilometers === 'number' ? c.kilometers : (typeof c?.mileage === 'number' ? c.mileage : 0))
    const arr = [...cars]
    arr.sort((a, b) => {
      switch (sortKey) {
        case 'recent': {
          const da = new Date((a as any).createdAt ?? 0).getTime()
          const db = new Date((b as any).createdAt ?? 0).getTime()
          return sortDir === 'asc' ? da - db : db - da
        }
        case 'price': {
          const pa = (a as any).price ?? 0
          const pb = (b as any).price ?? 0
          return sortDir === 'asc' ? pa - pb : pb - pa
        }
        case 'year': {
          const ya = (a as any).year ?? 0
          const yb = (b as any).year ?? 0
          return sortDir === 'asc' ? ya - yb : yb - ya
        }
        case 'mileage': {
          const ka = kmOf(a)
          const kb = kmOf(b)
          return sortDir === 'asc' ? ka - kb : kb - ka
        }
        case 'model': {
          const ma = `${(a as any).model ?? ''}`.toLowerCase()
          const mb = `${(b as any).model ?? ''}`.toLowerCase()
          return sortDir === 'asc' ? ma.localeCompare(mb) : mb.localeCompare(ma)
        }
        default:
          return 0
      }
    })
    return arr
  }, [cars, sortKey, sortDir])

  // Clients: Active first, then inactive; within each group, sort by most recent interaction (fallback to createdAt)
  const sortedClients = React.useMemo(() => {
    const getLatestTs = (c: any): number => {
      const interactions = Array.isArray(c?.interactionHistory) ? c.interactionHistory : []
      const latestInteraction = interactions.reduce((max: number, it: any) => {
        const t = new Date(it?.timestamp ?? 0).getTime()
        return t > max ? t : max
      }, 0)
      const created = new Date((c as any)?.createdAt ?? 0).getTime()
      return Math.max(latestInteraction, created)
    }
    const arr = [...clients]
    arr.sort((a: any, b: any) => {
      const aActive = (a?.active ?? true) === true
      const bActive = (b?.active ?? true) === true
      if (aActive !== bActive) return aActive ? -1 : 1
      const at = getLatestTs(a)
      const bt = getLatestTs(b)
      return bt - at // newest first
    })
    return arr
  }, [clients])

  const currentSortLabel =
    sortKey === 'recent'
      ? 'Recent'
      : sortKey === 'price'
      ? 'Price'
      : sortKey === 'year'
      ? 'Year'
      : sortKey === 'mileage'
      ? 'Mileage'
      : 'Model'

  return (
    <div className="flex flex-col h-screen bg-background">

      {/* Secondary navbar for Stock status filters */}
      {isStockStatus && (
        <>
          {/* Desktop top sticky navbar remains unchanged below */}

          {/* Desktop: top sticky navbar */}
          <div className="hidden lg:block bg-white border-b sticky top-[56px] z-10">
            <ScrollArea className="w-full">
              <div className="relative flex items-center justify-center p-2 sm:p-3">
                {/* Back arrow to show top-level dashboard */}
                <button
                  aria-label="Back to dashboard"
                  className="absolute left-3 sm:left-6 inline-flex items-center gap-2 text-sm text-blue-700 hover:text-blue-800"
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
                    { id: 'demo', label: 'Demo' },
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
        <div className={`p-2 sm:p-4 space-y-4 max-w-4xl mx-auto pb-[calc(10rem+env(safe-area-inset-bottom))] lg:pb-4`}>
          {/* Notifications list */}
          {showNotifications && (
            <div key="notifications-section" className="space-y-2 sm:space-y-4">
              {notifications.length === 0 ? (
                <div key="no-notifications-found" className="text-center py-12">
                  <Bell className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No notifications</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {notifications.map((n) => {
                    const created = new Date(n.createdAt).toLocaleString()
                    return (
                      <Card key={n._id} className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden" onClick={() => onNotificationSelect?.(n)}>
                        <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                          <div className="w-12 h-12 rounded-md bg-accent/30 flex items-center justify-center flex-shrink-0">
                            {n.type === 'car_new' && <CarIcon className="w-5 h-5 text-foreground/80" />}
                            {n.type === 'car_reserved' && <BookmarkCheck className="w-5 h-5 text-foreground/80" />}
                            {n.type === 'car_sold' && <Tag className="w-5 h-5 text-foreground/80" />}
                            {n.type === 'delivery_due_soon' && <Clock className="w-5 h-5 text-foreground/80" />}
                            {n.type === 'delivery_completed' && <CheckCircle className="w-5 h-5 text-foreground/80" />}
                            {n.type === 'delivery_update' && <Truck className="w-5 h-5 text-foreground/80" />}
                            {!(
                              n.type === 'car_new' || n.type === 'car_reserved' || n.type === 'car_sold' ||
                              n.type === 'delivery_due_soon' || n.type === 'delivery_completed' || n.type === 'delivery_update'
                            ) && <Bell className="w-5 h-5 text-foreground/80" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-base truncate">{n.title}</h3>
                            </div>
                            {n.description && <p className="text-sm text-muted-foreground mt-1 truncate">{n.description}</p>}
                            <p className="text-xs text-muted-foreground mt-1">{created}</p>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          {/* TODO list */}
          {showTodo && (
            <div key="todo-section" className="space-y-2 sm:space-y-4">
              <Todo />
            </div>
          )}
          {/* Client list */
          }
          {showClients && (
            <div key="clients-section" className="space-y-2 sm:space-y-4">
              {clients.length === 0 ? (
                <div key="no-clients-found" className="text-center py-12">
                  <UsersIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No clients found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sortedClients.map((client) => (
                    <Card key={client._id} className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden" onClick={() => onClientSelect(client)}>
                      <CardContent className="p-3 sm:p-4 flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-base sm:text-lg">{client.firstName} {client.lastName}</h3>
                            {(client.active === false) && (
                              <Badge variant="secondary" className="text-xs">Inactive</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{client.email}</p>
                          <p className="text-sm text-muted-foreground">{client.phone}</p>
                          {(userRole === 'admin' || userRole === 'manager') && client.createdByPhone && (
                            <p className="text-xs text-muted-foreground mt-1">Owner: {client.createdByPhone}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => { e.stopPropagation(); onClientDelete?.(client._id); }}
                          className="text-muted-foreground hover:text-red-500"
                        >
                          <Trash2Icon className="w-5 h-5" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Delivery list */}
          {showDelivery && (
            <div key="deliveries-section" className="space-y-2 sm:space-y-4">
              {deliveries.length === 0 ? (
                <div key="no-deliveries-found" className="text-center py-12">
                  <CarIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No deliveries found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {deliveries.map((d) => {
                    const carObj = (d.car as any) || {};
                    const isCarPopulated = typeof d.car === 'object' && d.car !== null;
                    const title = isCarPopulated
                      ? `${(carObj.year ?? '')} ${(carObj.make ?? '')} ${(carObj.model ?? '')}`.trim()
                      : 'Vehicle';
                    const imageUrl = isCarPopulated ? (carObj.images?.[0]?.imageUrl || "/placeholder.svg") : "/placeholder.svg";
                    const tasks = Array.isArray((d as any).reconTasks) ? ((d as any).reconTasks as any[]) : [];
                    const doneCount = tasks.filter(t => !!t.done).length;
                    const totalCount = tasks.length;
                    const allDone = totalCount > 0 && doneCount === totalCount;
                    const licensingDone = !!(d as any)?.licensing?.done;
                    const customerType = (d as any)?.customerType || 'natural';
                    const docKinds = new Set(((d as any)?.docs || []).map((x: any) => x.kind));
                    const addl = (d as any)?.additionalDocs || {};
                    const hasTradeIn = docKinds.has('trade_in_natis') || !!addl.trade_in_natis;
                    const hasSof = docKinds.has('source_of_funds') || !!addl.source_of_funds;
                    const hasUbo = docKinds.has('ubo_form') || !!addl.ubo_form;
                    return (
                      <Card key={d._id} className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden" onClick={() => onDeliverySelect?.(d)}>
                        <CardContent className="p-3 sm:p-4 flex items-center gap-3">
                          <img src={imageUrl} alt={title} className="w-16 h-12 object-contain rounded" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold text-base truncate">{title}</h3>
                              <Badge variant="secondary" className="capitalize">{d.status}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 truncate">Updated {new Date(d.updatedAt).toLocaleString()}</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {/* Recon tasks progress */}
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${allDone ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                {allDone ? (<Check className="w-3.5 h-3.5" />) : (<X className="w-3.5 h-3.5" />)}
                                Recon {doneCount}/{totalCount}
                              </span>
                              {/* Licensing done */}
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${licensingDone ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                {licensingDone ? (<Check className="w-3.5 h-3.5" />) : (<X className="w-3.5 h-3.5" />)}
                                Licensing {licensingDone ? 'Done' : 'Pending'}
                              </span>
                              {/* Additional docs */}
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${hasTradeIn ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                {hasTradeIn ? (<Check className="w-3.5 h-3.5" />) : (<X className="w-3.5 h-3.5" />)}
                                Trade-In Natis
                              </span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${hasSof ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                {hasSof ? (<Check className="w-3.5 h-3.5" />) : (<X className="w-3.5 h-3.5" />)}
                                Source of Funds
                              </span>
                              {customerType === 'company' && (
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${hasUbo ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                  {hasUbo ? (<Check className="w-3.5 h-3.5" />) : (<X className="w-3.5 h-3.5" />)}
                                  UBO Form
                                </span>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Car list */}
          {isStockStatus && (
            <div key="cars-section" className="space-y-2 sm:space-y-4">
              {cars.length === 0 ? (
                <div key="no-cars-found" className="text-center py-12">
                  <CarIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No cars found in this category</p>
                </div>
              ) : (
                <>
                  {/* Compact sort dropdown */}
                  <div className="mb-2 flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-8 rounded-md px-3 bg-white/70 backdrop-blur-md border border-gray-200/50"
                        >
                          Sort: {currentSortLabel}
                          <span className="ml-1 opacity-80">{sortDir === 'asc' ? '↑' : '↓'}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioGroup
                          value={sortKey}
                          onValueChange={(v) => {
                            const key = v as 'recent' | 'price' | 'year' | 'mileage' | 'model'
                            setSortKey(key)
                            setSortDir(key === 'recent' ? 'desc' : 'asc')
                          }}
                        >
                          <DropdownMenuRadioItem value="recent">Recent</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="price">Price</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="year">Year</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="mileage">Mileage</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="model">Model</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}>
                          Direction
                          <span className="ml-auto text-xs opacity-70">{sortDir === 'asc' ? 'Ascending' : 'Descending'}</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {sortedCars.map((car) => (
                  <Card
                    key={car._id}
                    className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden rounded-xl transition-all duration-300 hover:scale-[1.02] bg-transparent border-0 shadow-lg sm:hover:shadow-2xl sm:bg-white/90 sm:backdrop-blur-md sm:border sm:border-gray-200/50 sm:hover:border-blue-300/50"
                    onClick={() => onCarSelect(car)}
                    data-testid="dashboard-car-card"
                  >
                    <CardContent className="p-0 sm:p-4">
                      {/* Mobile layout: background image with bottom glass overlay */}
                      <div className="relative sm:hidden overflow-hidden">
                        <img
                          src={car.images?.[0]?.imageUrl || "/placeholder.svg"}
                          alt={`${car.year} ${car.make} ${car.model}`}
                          className="w-full h-auto block"
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/10 to-black/35" />
                        <div className="absolute bottom-0 left-0 right-0 p-3">
                          <div className="bg-white/20 backdrop-blur-sm border border-white/10 rounded-md p-2.5 shadow-lg">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-base truncate text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]">
                                    {car.year} {car.make} {car.model}
                                  </h3>
                                  {car.demo && (
                                    <Badge className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                                      DEMO
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-2xl font-extrabold text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]">{formatPrice(car.price)}</p>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Badge
                                    className={`${getStatusColor(car.status)} cursor-pointer flex-shrink-0 whitespace-nowrap`}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {formatStatusLabel(car.status)}
                                  </Badge>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {(STATUS_OPTIONS as CarState[]).map((statusOption) => (
                                    <DropdownMenuItem
                                      key={statusOption}
                                      onClick={(e: React.MouseEvent) => {
                                        e.stopPropagation();
                                        if (statusOption !== car.status) {
                                          onStatusChange(car._id, statusOption);
                                        }
                                      }}
                                    >
                                      {formatStatusLabel(statusOption)}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/95 drop-shadow-[0_1px_1px_rgba(0,0,0,0.3)] mt-2 font-medium">
                              <span>{(car.kilometers ?? 0).toLocaleString()} km</span>
                              <span>{car.color}</span>
                              <span className="capitalize">{car.transmission}</span>
                            </div>
                            {car.status === "reserved" && car.reservedBy && (
                              <p className="text-xs text-yellow-600 mt-1">Reserved by {car.reservedBy}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Desktop/tablet layout: existing horizontal card */}
                      <div className="hidden sm:flex flex-row gap-4">
                        <img
                          src={car.images?.[0]?.imageUrl || "/placeholder.svg"}
                          alt={`${car.year} ${car.make} ${car.model}`}
                          className="w-24 object-contain rounded-lg"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-base sm:text-lg truncate text-foreground">
                                  {car.year} {car.make} {car.model}
                                </h3>
                                {car.demo && (
                                  <Badge className="bg-orange-500 text-white text-xs px-2 py-0.5 rounded-full">
                                    DEMO
                                  </Badge>
                                )}
                              </div>
                              <p className="text-2xl font-bold text-orange-500">{formatPrice(car.price)}</p>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Badge
                                  className={`${getStatusColor(car.status)} cursor-pointer flex-shrink-0 whitespace-nowrap`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {formatStatusLabel(car.status)}
                                </Badge>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {(STATUS_OPTIONS as CarState[]).map((statusOption) => (
                                  <DropdownMenuItem
                                    key={statusOption}
                                    onClick={(e: React.MouseEvent) => {
                                      e.stopPropagation();
                                      if (statusOption !== car.status) {
                                        onStatusChange(car._id, statusOption);
                                      }
                                    }}
                                  >
                                    {formatStatusLabel(statusOption)}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-2">
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
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {!showTodo && (
        <div className="fixed right-4 sm:right-6 z-50 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] lg:bottom-6 flex flex-col items-center pointer-events-none">
          <div className={`flex flex-col items-center gap-3 mb-3 transition-all duration-300 ${fabOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
            <div className="flex items-center gap-3">
              <span className="bg-black/80 backdrop-blur-md text-white px-3 py-1 rounded-md text-sm font-medium whitespace-nowrap shadow-lg border border-white/20">
                Add Client
              </span>
              <Button
                onClick={() => {
                  onAddClient()
                  setFabOpen(false)
                }}
                size="lg"
                variant="secondary"
                className="pointer-events-auto rounded-full w-12 h-12 shadow-xl hover:shadow-2xl transition-all duration-200 bg-white/90 backdrop-blur-md border border-gray-200/50 hover:border-blue-300/50"
              >
                <Users className="w-5 h-5 text-blue-600" />
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <span className="bg-black/80 backdrop-blur-md text-white px-3 py-1 rounded-md text-sm font-medium whitespace-nowrap shadow-lg border border-white/20">
                Add Car
              </span>
              <Button
                onClick={() => {
                  onAddCar()
                  setFabOpen(false)
                }}
                size="lg"
                className="pointer-events-auto rounded-full w-12 h-12 shadow-xl hover:shadow-2xl transition-all duration-200 bg-orange-500 hover:bg-orange-600 border border-orange-300/50"
              >
                <CarLucide className="w-5 h-5 text-white" />
              </Button>
            </div>
          </div>
          <Button
            onClick={() => setFabOpen(!fabOpen)}
            size="lg"
            className={`pointer-events-auto rounded-full w-14 h-14 shadow-xl hover:shadow-2xl transition-all duration-300 bg-blue-600 hover:bg-blue-700 border border-blue-300/50 ${fabOpen ? 'rotate-45' : 'rotate-0'}`}
          >
            <Plus className="w-6 h-6 text-white" />
          </Button>
          {fabOpen && (
            <div
              className="fixed inset-0 bg-black bg-opacity-20 -z-10"
              onClick={() => setFabOpen(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}
