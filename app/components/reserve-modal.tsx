"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Upload } from "lucide-react"
import type { Car, Client } from "../types"

interface ReserveModalProps {
  car: Car
  clients: Client[]
  onConfirm: (name: string, phone: string) => void
  onClose: () => void
}

export function ReserveModal({ car, clients, onConfirm, onClose }: ReserveModalProps) {
  const [formData, setFormData] = useState({
    customerName: "",
    phoneNumber: "",
    selectedClientId: "new", // "new" means create new
    reason: "",
    notes: "",
    proofFile: null as File | null,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.selectedClientId !== "new") {
      const client = clients.find((c) => c.id === formData.selectedClientId)
      if (client) {
        onConfirm(client.name, client.phone)
      }
    } else if (formData.customerName.trim() && formData.phoneNumber.trim()) {
      onConfirm(formData.customerName, formData.phoneNumber)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setFormData((prev) => ({ ...prev, proofFile: file }))
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reserve Vehicle</DialogTitle>
          <DialogDescription>
            Reserve {car.year} {car.make} {car.model}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Select Client</label>
            <Select
              value={formData.selectedClientId}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, selectedClientId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">+ New Client</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name} – {c.phone}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.selectedClientId === "new" && (
            <>
              <div>
                <label className="text-sm font-medium">Customer Name</label>
            <Input
              value={formData.customerName}
              onChange={(e) => setFormData((prev) => ({ ...prev, customerName: e.target.value }))}
              placeholder="Enter customer name"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium">Customer Phone</label>
            <Input
              value={formData.phoneNumber}
              onChange={(e) => setFormData((prev) => ({ ...prev, phoneNumber: e.target.value }))}
              placeholder="Enter phone number"
              required
            />
          </div>

          <div>
            <label className="text-sm font-medium">Reservation Reason</label>
            <Select
              value={formData.reason}
              onValueChange={(value) => setFormData((prev) => ({ ...prev, reason: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select reason" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="test-drive">Test Drive Scheduled</SelectItem>
                <SelectItem value="inspection">Pending Inspection</SelectItem>
                <SelectItem value="financing">Financing Review</SelectItem>
                <SelectItem value="deposit">Deposit Received</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">Additional Notes</label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Any additional information..."
              rows={3}
            />
          </div>

          <div>
            <label className="text-sm font-medium">Upload Proof</label>
            <div className="mt-2">
              <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-muted-foreground/50 transition-colors">
                <div className="text-center">
                  <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {formData.proofFile ? formData.proofFile.name : "Upload document or image"}
                  </span>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </div>
          </>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Confirm Reservation
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
