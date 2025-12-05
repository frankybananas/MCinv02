"use client"

import React, { useEffect, useState } from 'react'
import type { Client, Car } from '../types'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Edit, Mail, Phone, CarIcon, Plus, Pause, Play, CheckCircle, Trash2, Eye, UserCheck, X } from 'lucide-react'
import { Badge } from "@/components/ui/badge"
import type { ClientRequest, MatchItem } from '../types'
import ClientRequestEditor from './client-request-editor'
import ClientRequestQuick from './client-request-quick'

interface ClientDetailProps {
  client: Client
  onBack: () => void
  onEdit: (client: Client) => void
  onSelectCar: (car: Car) => void
}

export function ClientDetail({ client, onBack, onEdit, onSelectCar }: ClientDetailProps) {
  const [requests, setRequests] = useState<ClientRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState<boolean>(false)
  const [creating, setCreating] = useState<boolean>(false)
  const [editing, setEditing] = useState<ClientRequest | null>(null)
  const [matches, setMatches] = useState<MatchItem[]>([])
  const [loadingMatches, setLoadingMatches] = useState<boolean>(false)
  const [useAdvancedCreate, setUseAdvancedCreate] = useState<boolean>(false)

  const fetchRequests = async () => {
    try {
      setLoadingRequests(true)
      const res = await fetch(`/api/clients/${client._id}/requests`)
      if (res.ok) {
        const j = await res.json()
        const list = Array.isArray(j?.data) ? (j.data as ClientRequest[]) : []
        setRequests(list)
      }
    } catch {}
    finally { setLoadingRequests(false) }
  }

  useEffect(() => { fetchRequests() }, [client._id])
  useEffect(() => { (async () => { await fetchMatches() })() }, [client._id])

  const handleCreate = async (data: { title?: string; freeText?: string; filters: ClientRequest["filters"] }) => {
    try {
      const res = await fetch(`/api/clients/${client._id}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        setCreating(false)
        await fetchRequests()
        await fetchMatches()
      }
    } catch {}
  }

  const handleUpdate = async (reqId: string, data: Partial<Pick<ClientRequest, 'title' | 'freeText' | 'filters' | 'status'>>) => {
    try {
      const res = await fetch(`/api/clients/${client._id}/requests/${reqId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        setEditing(null)
        await fetchRequests()
        await fetchMatches()
      }
    } catch {}
  }

  const handleDelete = async (reqId: string) => {
    try {
      const res = await fetch(`/api/clients/${client._id}/requests/${reqId}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchRequests()
        await fetchMatches()
      }
    } catch {}
  }

  const statusBadge = (s: ClientRequest['status']) => (
    <Badge variant={s === 'active' ? 'default' : s === 'paused' ? 'secondary' : 'outline'} className="capitalize">
      {s}
    </Badge>
  )

  const fetchMatches = async () => {
    try {
      setLoadingMatches(true)
      const res = await fetch(`/api/clients/${client._id}/matches`)
      if (res.ok) {
        const j = await res.json()
        const list = Array.isArray(j?.data) ? (j.data as MatchItem[]) : []
        setMatches(list)
      }
    } catch {}
    finally { setLoadingMatches(false) }
  }

  const handleViewMatch = async (m: MatchItem) => {
    try {
      await fetch(`/api/matches/${m._id}/view`, { method: 'POST' })
      await fetchMatches()
      // Open the car detail
      const carId = typeof m.car === 'string' ? m.car : (m.car as any)?._id
      if (carId) {
        try {
          const res = await fetch(`/api/cars/${carId}`)
          if (res.ok) {
            const j = await res.json()
            if (j?.data) onSelectCar(j.data as Car)
          }
        } catch {}
      }
    } catch {}
  }

  const handleDismissMatch = async (matchId: string) => {
    try {
      await fetch(`/api/matches/${matchId}/dismiss`, { method: 'POST' })
      await fetchMatches()
    } catch {}
  }

  const handleContactedMatch = async (matchId: string) => {
    try {
      await fetch(`/api/matches/${matchId}/contacted`, { method: 'POST' })
      await fetchMatches()
    } catch {}
  }

  return (
    <div className="h-screen bg-gray-50">
      <header className="bg-white border-b p-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg sm:text-xl font-bold truncate">
            {client.firstName} {client.lastName}
          </h1>
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => onEdit(client)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </header>

      <main className="p-2 sm:p-4 max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Phone className="h-5 w-5 text-muted-foreground" />
              <span>{client.phone}</span>
            </div>
            {client.email && (
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-muted-foreground" />
                <span>{client.email}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Looking For requests */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold">Looking For</h2>
            {!creating && !editing && (
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add request
              </Button>
            )}
          </div>

          {creating && (
            <Card className="mb-4">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">New request</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant={useAdvancedCreate ? 'ghost' : 'secondary'} size="sm" onClick={() => setUseAdvancedCreate(false)}>Quick</Button>
                    <Button variant={useAdvancedCreate ? 'secondary' : 'ghost'} size="sm" onClick={() => setUseAdvancedCreate(true)}>Advanced</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {useAdvancedCreate ? (
                  <ClientRequestEditor
                    onCancel={() => setCreating(false)}
                    onSave={async (data) => { await handleCreate(data) }}
                  />
                ) : (
                  <ClientRequestQuick
                    onCancel={() => setCreating(false)}
                    onSave={async (data) => { await handleCreate(data) }}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {editing && (
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="text-base">Edit request</CardTitle>
              </CardHeader>
              <CardContent>
                <ClientRequestEditor
                  initial={editing}
                  onCancel={() => setEditing(null)}
                  onSave={async (data) => { await handleUpdate(editing._id, data) }}
                />
              </CardContent>
            </Card>
          )}

          {/* List */}
          {loadingRequests ? (
            <div className="text-sm text-muted-foreground">Loading requests…</div>
          ) : requests.length === 0 ? (
            <div className="text-sm text-muted-foreground">No requests yet.</div>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => {
                const title = r.title || r.requestText || 'Request'
                const updated = new Date(r.updatedAt).toLocaleString()
                return (
                  <Card key={r._id}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold truncate">{title}</h3>
                            {statusBadge(r.status)}
                            {r.aiParsing?.matchCount && r.aiParsing.matchCount > 0 ? (
                               <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200">
                                  {r.aiParsing.matchCount} Matches
                               </Badge>
                            ) : null}
                          </div>
                          {r.freeText && <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{r.freeText}</p>}
                          <p className="text-xs text-muted-foreground mt-1">Updated {updated}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button variant="ghost" size="sm" onClick={() => setEditing(r)}>
                            <Edit className="h-4 w-4 mr-1" /> Edit
                          </Button>
                          {r.status !== 'completed' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUpdate(r._id, { status: r.status === 'active' ? 'paused' : 'active' })}
                            >
                              {r.status === 'active' ? (<><Pause className="h-4 w-4 mr-1" /> Pause</>) : (<><Play className="h-4 w-4 mr-1" /> Resume</>)}
                            </Button>
                          )}
                          {r.status !== 'completed' && (
                            <Button variant="ghost" size="sm" onClick={() => handleUpdate(r._id, { status: 'completed' })}>
                              <CheckCircle className="h-4 w-4 mr-1" /> Complete
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(r._id)} className="text-muted-foreground hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        {/* Matches panel */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-semibold">Matches</h2>
            <Button variant="ghost" size="sm" onClick={() => fetchMatches()}>Refresh</Button>
          </div>

          {loadingMatches ? (
            <div className="text-sm text-muted-foreground">Loading matches…</div>
          ) : matches.length === 0 ? (
            <div className="text-sm text-muted-foreground">No matches found yet.</div>
          ) : (
            <div className="space-y-3">
              {matches.map((m) => {
                const car: any = typeof m.car === 'string' ? null : m.car
                const title = car ? `${car.year ?? ''} ${car.make ?? ''} ${car.model ?? ''}`.trim() : 'Matched vehicle'
                const imageUrl = car?.images?.[0]?.imageUrl || '/placeholder.svg'
                const scorePct = Math.round((Number(m.score) || 0) * 100)
                const created = new Date(m.createdAt).toLocaleString()
                return (
                  <Card key={m._id}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start gap-3">
                        <img src={imageUrl} alt={title} className="w-16 h-12 object-contain rounded" />
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold truncate mr-2">{title}</h3>
                            <Badge variant={m.status === 'dismissed' ? 'secondary' : (m.status === 'viewed' ? 'outline' : 'default')} className="capitalize">{m.status}</Badge>
                            <span className="text-xs text-muted-foreground">Score: {scorePct}%</span>
                          </div>
                          {m.explanation && <p className="text-sm text-muted-foreground mt-1">{m.explanation}</p>}
                          <p className="text-xs text-muted-foreground mt-1">Matched {created}</p>
                        </div>
                        <div className="flex flex-col sm:flex-row gap-1 flex-shrink-0">
                          <Button variant="ghost" size="sm" onClick={() => handleViewMatch(m)} title="View">
                            <Eye className="h-4 w-4 mr-1" /> View
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleContactedMatch(m._id)} title="Contacted">
                            <UserCheck className="h-4 w-4 mr-1" /> Contacted
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDismissMatch(m._id)} className="text-muted-foreground hover:text-red-600" title="Dismiss">
                            <X className="h-4 w-4 mr-1" /> Dismiss
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>

        <h2 className="text-xl font-semibold mt-6 mb-4">Associated Cars</h2>
        {client.cars && client.cars.length > 0 ? (
          <div className="space-y-4">
            {client.cars
              .filter((c: any) => typeof c === 'object' && c?.status === 'reserved')
              .map((car: any, idx: number) => {
              const carObj = typeof car === 'string' ? null : (car as Car | null);
              const key = carObj?.
                _id ? String(carObj._id) : (typeof car === 'string' ? car : String(idx));
              const imageUrl = carObj?.images?.[0]?.imageUrl || '/placeholder.svg';
              const title = `${carObj?.year ?? ''} ${carObj?.make ?? ''} ${carObj?.model ?? ''}`.trim() || 'Vehicle';
              const status = carObj?.status ?? '';
              return (
                <Card
                  key={key}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => { if (carObj?._id) onSelectCar(carObj as Car); }}
                >
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex items-center gap-4">
                      <img
                        src={imageUrl}
                        alt={title}
                        className="w-20 h-20 object-contain rounded-lg"
                      />
                      <div>
                        <h3 className="font-semibold">{title}</h3>
                        {status && (
                          <p className="text-sm text-muted-foreground">{status}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8">
            <CarIcon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No cars associated with this client.</p>
          </div>
        )}
      </main>
    </div>
  )
}

