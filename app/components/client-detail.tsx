"use client"

import type { Client, Car } from '../types'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Edit, Mail, Phone, CarIcon } from 'lucide-react'

interface ClientDetailProps {
  client: Client
  onBack: () => void
  onEdit: (client: Client) => void
  onSelectCar: (car: Car) => void
}

export function ClientDetail({ client, onBack, onEdit, onSelectCar }: ClientDetailProps) {
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

