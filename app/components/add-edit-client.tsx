"use client"

import { useState } from "react"
import { Button } from "../../components/ui/button"
import { Input } from "../../components/ui/input"
import { Textarea } from "../../components/ui/textarea"
import { Label } from "../../components/ui/label"
import { ArrowLeft } from "lucide-react"
import type { Client } from "../types"

interface AddEditClientProps {
  client?: Client
  onSave: (clientData: Partial<Client>) => void
  onCancel: () => void
  onDelete?: (clientId: string) => void
}

interface AddEditClientProps {
  client?: Client
  onSave: (clientData: Partial<Client>) => void
  onCancel: () => void
  onDelete?: (clientId: string) => void
  onAddInteraction?: (clientId: string, note: string) => void;
}

export function AddEditClient({ client, onSave, onCancel, onDelete, onAddInteraction }: AddEditClientProps) {
  const [formData, setFormData] = useState<Partial<Client>>({
    firstName: client?.firstName || "",
    lastName: client?.lastName || "",
    email: client?.email || "",
    phone: client?.phone || "",
    notes: client?.notes || "",
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [interactionNote, setInteractionNote] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.firstName?.trim()) {
      newErrors.firstName = "First name is required";
    }
    if (!formData.phone?.trim()) {
      newErrors.phone = "Phone number is required";
    }
    return newErrors;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    onSave(formData);
  };

  const handleAddInteraction = () => {
    if (client && interactionNote.trim()) {
      onAddInteraction?.(client._id, interactionNote.trim());
      setInteractionNote("");
    }
  };

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="bg-white border-b p-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">{client ? "Edit Client" : "Add New Client"}</h1>
        </div>
      </header>

      {/* Form */}
      <div className="flex-1 p-4 overflow-auto">
        <form onSubmit={handleSubmit} className="space-y-6 max-w-md mx-auto">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name</Label>
            <Input
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleChange}
              placeholder="Enter client's first name"
              className={errors.firstName ? "border-red-500" : ""}
            />
            {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name</Label>
            <Input
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleChange}
              placeholder="Enter client's last name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Enter client's email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Enter phone number"
              className={errors.phone ? "border-red-500" : ""}
            />
            {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Enter any notes about the client"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1">
              Save Client
            </Button>
          </div>
          
          {client && onDelete && (
            <div className="mt-8 pt-8 border-t">
              <Button 
                type="button" 
                variant="destructive" 
                className="w-full"
                onClick={() => {
                  if (client && confirm(`Are you sure you want to delete ${client.firstName} ${client.lastName}?`)) {
                    onDelete(client._id)
                  }
                }}
              >
                Delete Client
              </Button>
            </div>
          )}
        </form>

        {client && (
          <div className="mt-8 pt-8 border-t max-w-md mx-auto">
            <h2 className="text-lg font-semibold mb-4">Interaction History</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-interaction">Add New Interaction</Label>
                <Textarea
                  id="new-interaction"
                  value={interactionNote}
                  onChange={(e) => setInteractionNote(e.target.value)}
                  placeholder="Log a new interaction..."
                />
              </div>
              <Button onClick={handleAddInteraction} className="w-full">Add Interaction</Button>
            </div>

            <div className="mt-6 space-y-4">
              {client.interactionHistory?.map((interaction) => (
                <div key={interaction._id} className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm">{interaction.note}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(interaction.timestamp).toLocaleString()}
                  </p>
                </div>
              ))}
               <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm">Client created</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {client.createdAt ? new Date(client.createdAt).toLocaleString() : 'N/A'}
                  </p>
                </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
