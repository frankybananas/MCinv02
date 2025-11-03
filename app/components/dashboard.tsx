"use client"

import { useEffect, useState } from "react"
import React from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CarIcon, Plus, UsersIcon, Trash2Icon, ArrowLeft, Car as CarLucide, Users, X, Check, Truck, CheckCircle, Clock, Tag, BookmarkCheck, Bell } from "lucide-react"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu"
import type { Car, CarState, DashboardTab, Delivery, NotificationItem } from "../types"
import { getStatusColor, STATUS_OPTIONS, formatStatusLabel } from "./status-utils"
import { Todo } from './todo'
import { MainMenu } from "./main-menu"
import { Marketing } from "./marketing"

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
  _onLogout: () => void;
  userRole: string | null;
  deliveries?: Delivery[];
  onDeliverySelect?: (delivery: Delivery) => void;
  notifications?: NotificationItem[];
  onNotificationSelect?: (item: NotificationItem) => void;
  _onNotificationDone?: (item: NotificationItem) => void;
  unreadNotificationsCount?: number;
  todoEnabled?: boolean;
  marketingEnabled?: boolean;
  _onMarkAllNotificationsRead?: () => void;
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
  _onLogout,
  userRole,
  deliveries = [],
  onDeliverySelect,
  notifications = [],
  onNotificationSelect,
  _onNotificationDone,
  unreadNotificationsCount = 0,
  todoEnabled = false,
  marketingEnabled = false,
  _onMarkAllNotificationsRead
}: DashboardProps) {
  const [fabOpen, setFabOpen] = useState(false)
  const [sortKey, setSortKey] = useState<'recent' | 'price' | 'year' | 'mileage' | 'model'>('recent')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [viewMode, setViewMode] = useState<'card' | 'list'>('list')

  const showClients = activeStatus === "clients"
  const showDelivery = activeStatus === "delivery"
  const showNotifications = activeStatus === "notifications"
  const showTodo = activeStatus === "todo"
  const showMarketing = activeStatus === "marketing"
  const handleAdminNavigate = React.useCallback(() => {
    try {
      const globalWindow = typeof globalThis !== 'undefined' ? (globalThis as any).window : null
      if (globalWindow) {
        globalWindow.location.href = "/admin"
      }
    } catch (error) {
      console.error("Navigation to admin failed", error)
    }
  }, [])

  useEffect(() => {
    if (showTodo && fabOpen) {
      setFabOpen(false)
    }
  }, [showTodo, fabOpen])
  const isStockStatus = ['all','in-stock','coming','reserved','sold','demo'].includes(activeStatus)

  // Set view mode to list only (compact view)
  useEffect(() => {
    setViewMode('list')
  }, [activeStatus])

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
      <ScrollArea className="flex-1 min-w-0 overflow-x-hidden">
        <div className={`px-3 sm:px-4 lg:px-6 space-y-4 w-full max-w-4xl min-w-0 mx-auto pb-[calc(10rem+env(safe-area-inset-bottom))] lg:pb-4`}>
          {/* Notifications list - displays user notifications with responsive card layout */}
          {showNotifications && (
            <div key="notifications-section" className="space-y-2 sm:space-y-4 w-full max-w-full min-w-0">
              {notifications.length === 0 ? (
                // Empty state with centered icon and message
                <div key="no-notifications-found" className="text-center py-12">
                  <Bell className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No notifications</p>
                </div>
              ) : (
                // Cards or List
                <div className="flex flex-col gap-3 w-full max-w-full min-w-0 pr-2 sm:pr-3">
                  {viewMode === 'list' && notifications.map((n) => {
                    const created = new Date(n.createdAt).toLocaleString()
                    return (
                      <button
                        key={n._id}
                        className="w-full text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none rounded-md border border-gray-200/60 bg-white/90 backdrop-blur-md"
                        onClick={() => onNotificationSelect?.(n)}
                        data-testid="notification-row"
                      >
                        <div className="p-3 flex items-center gap-3 w-full max-w-full">
                          <div className="w-10 h-10 rounded-md bg-accent/30 flex items-center justify-center flex-shrink-0">
                            <Bell className="w-4 h-4 text-foreground/80" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="font-medium text-sm truncate">{n.title}</h3>
                              <span className="text-xs text-muted-foreground flex-shrink-0">{created}</span>
                            </div>
                            {n.description && (
                              <p className="text-xs text-muted-foreground line-clamp-2">{n.description}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                  {viewMode === 'card' && notifications.map((n) => {
                    const created = new Date(n.createdAt).toLocaleString()
                    return (
                      <Card
                        key={n._id}
                        className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden w-full max-w-full min-w-0"
                        onClick={() => onNotificationSelect?.(n)}
                      >
                        <CardContent className="p-3 sm:p-4 flex items-start gap-3 w-full max-w-full min-w-0 overflow-hidden">
                          {/* Icon container - displays type-specific icon */}
                          <div className="w-12 h-12 rounded-md bg-accent/30 flex items-center justify-center flex-shrink-0">
                            {n.type === 'car_new' && <CarIcon className="w-5 h-5 text-foreground/80" />}
                            {n.type === 'car_reserved' && <BookmarkCheck className="w-5 h-5 text-foreground/80" />}
                            {n.type === 'car_sold' && <Tag className="w-5 h-5 text-foreground/80" />}
                            {n.type === 'delivery_due_soon' && <Clock className="w-5 h-5 text-foreground/80" />}
                            {n.type === 'delivery_completed' && <CheckCircle className="w-5 h-5 text-foreground/80" />}
                            {n.type === 'delivery_update' && <Truck className="w-5 h-5 text-foreground/80" />}
                            {/* Default bell icon for unknown notification types */}
                            {!(
                              n.type === 'car_new' || n.type === 'car_reserved' || n.type === 'car_sold' ||
                              n.type === 'delivery_due_soon' || n.type === 'delivery_completed' || n.type === 'delivery_update'
                            ) && <Bell className="w-5 h-5 text-foreground/80" />}
                          </div>
                          {/* Content area with responsive text wrapping */}
                          <div className="flex-1 min-w-0 max-w-full space-y-1 overflow-hidden">
                            <div className="flex items-start justify-between gap-2 min-w-0">
                              {/* Title with break-words to handle long text without overflow */}
                              <h3 className="font-semibold text-base break-words overflow-wrap-anywhere min-w-0 max-w-full">
                                {n.title}
                              </h3>
                            </div>
                            {/* Optional description with text wrapping */}
                            {n.description && (
                              <p className="text-sm text-muted-foreground break-words overflow-wrap-anywhere max-w-full">
                                {n.description}
                              </p>
                            )}
                            {/* Timestamp display */}
                            <p className="text-xs text-muted-foreground break-words">{created}</p>
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
            <div key="todo-section" className="space-y-2 sm:space-y-4 w-full min-w-0">
              <Todo />
            </div>
          )}
          {/* Marketing page */}
          {showMarketing && marketingEnabled && (
            <div key="marketing-section" className="space-y-2 sm:space-y-4 w-full min-w-0">
              <Marketing
                cars={cars.filter((car) => car.status === "in-stock" || car.status === "reserved")}
                onGenerationComplete={(_count) => {
                  // Handle completion notification
                }}
              />
            </div>
          )}
          {/* Client list */}
          {showClients && (
            <div key="clients-section" className="space-y-2 sm:space-y-4 w-full min-w-0">
              {clients.length === 0 ? (
                <div key="no-clients-found" className="text-center py-12">
                  <UsersIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No clients found</p>
                </div>
              ) : (
                <>
                  {viewMode === 'list' && (
                    <div className="w-full max-w-full flex flex-col divide-y rounded-xl bg-white/90 backdrop-blur-md border border-gray-200/50 shadow-lg pr-2 sm:pr-3">
                      {sortedClients.map((client) => (
                        <button
                          key={client._id}
                          className="w-full text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                          onClick={() => onClientSelect(client)}
                          data-testid="client-row"
                        >
                          <div className="p-3 pr-2 sm:pr-3 flex items-center gap-3 w-full max-w-full">
                            <div className="w-10 h-10 rounded-full bg-accent/20 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <h3 className="font-medium text-sm sm:text-base truncate">{client.firstName} {client.lastName}</h3>
                                {(client.active === false) && (
                                  <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                                )}
                              </div>
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                <span className="truncate">{client.email}</span>
                                <span className="truncate">{client.phone}</span>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => { e.stopPropagation(); onClientDelete?.(client._id); }}
                              className="text-muted-foreground hover:text-red-500"
                              aria-label="Delete client"
                            >
                              <Trash2Icon className="w-5 h-5" />
                            </Button>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {viewMode === 'card' && (
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
                </>
              )}
            </div>
          )}
          {/* Delivery list */}
          {showDelivery && (
            <div key="deliveries-section" className="space-y-2 sm:space-y-4 w-full min-w-0">
              {deliveries.length === 0 ? (
                <div key="no-deliveries-found" className="text-center py-12">
                  <CarIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No deliveries found</p>
                </div>
              ) : (
                <>
                  {viewMode === 'list' && (
                    <div className="w-full max-w-full flex flex-col divide-y rounded-xl bg-white/90 backdrop-blur-md border border-gray-200/50 shadow-lg pr-2 sm:pr-3">
                      {deliveries.map((d) => {
                        const carObj = (d.car as any) || {};
                        const isCarPopulated = typeof d.car === 'object' && d.car !== null;
                        const title = isCarPopulated
                          ? `${(carObj.year ?? '')} ${(carObj.make ?? '')} ${(carObj.model ?? '')}`.trim()
                          : 'Vehicle';
                        const imageUrl = isCarPopulated ? (carObj.images?.[0]?.imageUrl || "/placeholder.svg") : "/placeholder.svg";
                        return (
                          <button
                            key={(d as any)._id}
                            className="w-full text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                            onClick={() => onDeliverySelect?.(d)}
                            data-testid="delivery-row"
                          >
                            <div className="p-3 flex items-center gap-3 w-full max-w-full">
                              <img src={imageUrl} alt={title} className="w-16 h-12 object-contain rounded flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2">
                                  <h3 className="font-medium text-sm sm:text-base truncate">{title}</h3>
                                  <Badge variant="secondary" className="capitalize">{(d as any).status}</Badge>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 truncate">Updated {new Date((d as any).updatedAt).toLocaleString()}</p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {viewMode === 'card' && (
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
                </>
              )}
            </div>
          )}

          {/* Car list */}
          {isStockStatus && (
            <div key="cars-section" className="space-y-2 sm:space-y-4 w-full min-w-0">
              {cars.length === 0 ? (
                <div key="no-cars-found" className="text-center py-12">
                  <CarIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No cars found in this category</p>
                </div>
              ) : (
                <>
                  {/* Sort */}
                  <div className="mb-2 flex justify-end relative z-10">
                    <div className="flex items-center gap-2 max-w-full flex-wrap bg-white/80 backdrop-blur-md rounded-md px-2 py-1 border border-gray-200/50">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="h-8 rounded-md px-3 bg-white/70 backdrop-blur-md border border-gray-200/50 shrink-0"
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
                  </div>

                  {viewMode === 'list' && (
                    <div className="w-full max-w-full flex flex-col divide-y rounded-xl bg-white/90 backdrop-blur-md border border-gray-200/50 shadow-lg pr-2 sm:pr-3">
                      {sortedCars.map((car) => (
                        <button
                          key={car._id}
                          className="w-full text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                          onClick={() => onCarSelect(car)}
                          data-testid="dashboard-car-row"
                        >
                          <div className="p-3 sm:p-3 pr-2 sm:pr-3 flex items-start gap-3 w-full max-w-full">
                            <img
                              src={car.images?.[0]?.imageUrl || "/placeholder.svg"}
                              alt={`${car.year} ${car.make} ${car.model}`}
                              className="w-16 h-12 object-cover rounded flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0 flex flex-col gap-1">
                              <h3 className="font-medium text-base break-words overflow-wrap-anywhere min-w-0 max-w-full leading-tight">
                                {car.year} {car.make} {car.model}
                              </h3>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                <span>{(car.kilometers ?? 0).toLocaleString()} km</span>
                                <span>{car.color}</span>
                                <span className="capitalize">{car.transmission}</span>
                              </div>
                              <div className="flex items-center justify-between gap-2 min-w-0">
                                <span className="text-orange-500 font-semibold text-base truncate">{formatPrice(car.price)}</span>
                                <Badge className={`${getStatusColor(car.status)} flex-shrink-0 whitespace-nowrap`}>
                                  {formatStatusLabel(car.status)}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {viewMode === 'card' && sortedCars.map((car) => (
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
        <div className="fixed right-4 bottom-[calc(7.25rem+env(safe-area-inset-bottom))] z-50 sm:right-6 pointer-events-none">
          <div className="relative flex flex-col items-end gap-3 pointer-events-none">
            <div className={`flex items-center gap-3 rounded-full border border-white/15 bg-slate-950/85 px-4 py-2 text-white text-sm font-medium shadow-[0_18px_36px_-18px_rgba(15,23,42,0.8)] backdrop-blur-xl transition-all duration-300 ${fabOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'}`}>
              <Button
                onClick={() => {
                  onAddClient()
                  setFabOpen(false)
                }}
                variant="ghost"
                className="h-10 px-0 flex items-center gap-2 rounded-full text-white hover:bg-white/10"
              >
                <div className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors">
                  <Users className="h-5 w-5" />
                </div>
                <span className="whitespace-nowrap pr-3">Add client</span>
              </Button>
              <div className="h-8 w-px bg-white/20" aria-hidden="true" />
              <Button
                onClick={() => {
                  onAddCar()
                  setFabOpen(false)
                }}
                className="h-10 px-0 flex items-center gap-2 rounded-full bg-transparent text-white hover:bg-white/10"
              >
                <span className="whitespace-nowrap pl-3">Add car</span>
                <div className="h-10 w-10 rounded-full bg-orange-500 flex items-center justify-center hover:bg-orange-600 transition-colors">
                  <CarLucide className="h-5 w-5" />
                </div>
              </Button>
            </div>
            <Button
              onClick={() => setFabOpen(!fabOpen)}
              size="lg"
              className={`pointer-events-auto rounded-full w-16 h-16 border border-white/25 bg-white/20 text-slate-900 shadow-[0_24px_40px_-18px_rgba(15,23,42,0.45)] backdrop-blur-2xl transition-all duration-300 hover:bg-white/30 dark:text-white ${fabOpen ? 'rotate-45' : 'rotate-0'}`}
            >
              <Plus className="w-6 h-6" />
            </Button>
          </div>
          {fabOpen && (
            <div
              className="fixed inset-0 z-[-1] bg-black/20"
              onClick={() => setFabOpen(false)}
            />
          )}
        </div>
      )}
      <MainMenu
        activeStatus={activeStatus}
        onStatusFilterChange={onStatusFilterChange}
        unreadNotificationsCount={unreadNotificationsCount}
        userRole={userRole}
        marketingEnabled={marketingEnabled}
        todoEnabled={todoEnabled}
        onAdminNavigate={handleAdminNavigate}
      />
    </div>
  );
}
