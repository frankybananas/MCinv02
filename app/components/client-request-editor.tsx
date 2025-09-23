"use client"

import React, { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { ClientRequest } from "../types"

interface ClientRequestEditorProps {
  initial?: Partial<ClientRequest>
  onCancel: () => void
  onSave: (data: { title?: string; freeText?: string; filters: ClientRequest["filters"] }) => Promise<void> | void
}

export default function ClientRequestEditor({ initial, onCancel, onSave }: ClientRequestEditorProps) {
  const [title, setTitle] = useState<string>(initial?.title ?? "")
  const [freeText, setFreeText] = useState<string>(initial?.freeText ?? "")
  const [makes, setMakes] = useState<string>((initial?.filters?.makes || []).join(", "))
  const [models, setModels] = useState<string>((initial?.filters?.models || []).join(", "))
  const [minYear, setMinYear] = useState<string>(initial?.filters?.minYear != null ? String(initial.filters.minYear) : "")
  const [maxYear, setMaxYear] = useState<string>(initial?.filters?.maxYear != null ? String(initial.filters.maxYear) : "")
  const [maxBudgetZar, setMaxBudgetZar] = useState<string>(initial?.filters?.maxBudgetZar != null ? String(initial.filters.maxBudgetZar) : "")
  const [maxMileageKm, setMaxMileageKm] = useState<string>(initial?.filters?.maxMileageKm != null ? String(initial.filters.maxMileageKm) : "")
  const [seats, setSeats] = useState<string>(initial?.filters?.seats != null ? String(initial.filters.seats) : "")
  const [colors, setColors] = useState<string>((initial?.filters?.colors || []).join(", "))
  const [fuelTypes, setFuelTypes] = useState<string>((initial?.filters?.fuelTypes || []).join(", "))
  const [transmissions, setTransmissions] = useState<string>((initial?.filters?.transmissions || []).join(", "))
  const [bodyTypes, setBodyTypes] = useState<string>((initial?.filters?.bodyTypes || []).join(", "))
  const [mustHave, setMustHave] = useState<string>((initial?.filters?.mustHave || []).join(", "))
  const [niceToHave, setNiceToHave] = useState<string>((initial?.filters?.niceToHave || []).join(", "))
  const [excludeTerms, setExcludeTerms] = useState<string>((initial?.filters?.excludeTerms || []).join(", "))

  const filters = useMemo<ClientRequest["filters"]>(() => {
    const parseCsv = (v: string) => v.split(",").map(s => s.trim()).filter(Boolean)
    const toNum = (v: string) => {
      const n = Number(v)
      return Number.isFinite(n) ? n : undefined
    }
    return {
      makes: parseCsv(makes),
      models: parseCsv(models),
      minYear: toNum(minYear),
      maxYear: toNum(maxYear),
      maxBudgetZar: toNum(maxBudgetZar),
      maxMileageKm: toNum(maxMileageKm),
      seats: toNum(seats),
      colors: parseCsv(colors),
      fuelTypes: parseCsv(fuelTypes),
      transmissions: parseCsv(transmissions),
      bodyTypes: parseCsv(bodyTypes),
      mustHave: parseCsv(mustHave),
      niceToHave: parseCsv(niceToHave),
      excludeTerms: parseCsv(excludeTerms),
    }
  }, [makes, models, minYear, maxYear, maxBudgetZar, maxMileageKm, seats, colors, fuelTypes, transmissions, bodyTypes, mustHave, niceToHave, excludeTerms])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSave({ title: title.trim() || undefined, freeText: freeText.trim() || undefined, filters })
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <Label htmlFor="title">Title</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Family SUV under R350k" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="freeText">Notes / Preferences</Label>
        <Textarea id="freeText" value={freeText} onChange={(e) => setFreeText(e.target.value)} placeholder="Any free-text notes from the customer..." rows={4} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="makes">Makes (comma-separated)</Label>
          <Input id="makes" value={makes} onChange={(e) => setMakes(e.target.value)} placeholder="Toyota, VW" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="models">Models (comma-separated)</Label>
          <Input id="models" value={models} onChange={(e) => setModels(e.target.value)} placeholder="Fortuner, Polo" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="minYear">Min Year</Label>
          <Input id="minYear" type="number" inputMode="numeric" value={minYear} onChange={(e) => setMinYear(e.target.value)} placeholder="2018" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="maxYear">Max Year</Label>
          <Input id="maxYear" type="number" inputMode="numeric" value={maxYear} onChange={(e) => setMaxYear(e.target.value)} placeholder="2023" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="maxBudgetZar">Max Budget (ZAR)</Label>
          <Input id="maxBudgetZar" type="number" inputMode="decimal" value={maxBudgetZar} onChange={(e) => setMaxBudgetZar(e.target.value)} placeholder="350000" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="maxMileageKm">Max Mileage (km)</Label>
          <Input id="maxMileageKm" type="number" inputMode="decimal" value={maxMileageKm} onChange={(e) => setMaxMileageKm(e.target.value)} placeholder="90000" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="seats">Min Seats</Label>
          <Input id="seats" type="number" inputMode="decimal" value={seats} onChange={(e) => setSeats(e.target.value)} placeholder="5" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="colors">Colors (comma-separated)</Label>
          <Input id="colors" value={colors} onChange={(e) => setColors(e.target.value)} placeholder="white, silver" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fuelTypes">Fuel Types (comma-separated)</Label>
          <Input id="fuelTypes" value={fuelTypes} onChange={(e) => setFuelTypes(e.target.value)} placeholder="petrol, diesel" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="transmissions">Transmissions (comma-separated)</Label>
          <Input id="transmissions" value={transmissions} onChange={(e) => setTransmissions(e.target.value)} placeholder="automatic, manual" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="bodyTypes">Body Types (comma-separated)</Label>
          <Input id="bodyTypes" value={bodyTypes} onChange={(e) => setBodyTypes(e.target.value)} placeholder="SUV, hatchback" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="mustHave">Must Have (comma-separated)</Label>
          <Input id="mustHave" value={mustHave} onChange={(e) => setMustHave(e.target.value)} placeholder="Android Auto, reverse camera" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="niceToHave">Nice To Have (comma-separated)</Label>
          <Input id="niceToHave" value={niceToHave} onChange={(e) => setNiceToHave(e.target.value)} placeholder="sunroof, leather seats" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="excludeTerms">Exclude Terms (comma-separated)</Label>
          <Input id="excludeTerms" value={excludeTerms} onChange={(e) => setExcludeTerms(e.target.value)} placeholder="accident, salvage" />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit">Save</Button>
      </div>
    </form>
  )
}
