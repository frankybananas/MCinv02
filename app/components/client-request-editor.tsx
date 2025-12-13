"use client"

import React, { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import {
  ZA_CAB_TYPES,
  getZaCabTypes,
  getZaEngines,
  getZaMake,
  getZaModel,
  getZaMakes,
  getZaModelNames,
} from "@/app/data/za-vehicle-taxonomy"
import type { ClientRequest } from "../types"

interface ClientRequestEditorProps {
  initial?: Partial<ClientRequest>
  onCancel: () => void
  onSave: (data: { title?: string; freeText?: string; filters: ClientRequest["filters"] }) => Promise<void> | void
}

type VehicleEntryMode = 'taxonomy' | 'custom'

export default function ClientRequestEditor({ initial, onCancel, onSave }: ClientRequestEditorProps) {
  const [title, setTitle] = useState<string>(initial?.title ?? "")
  const [freeText, setFreeText] = useState<string>(initial?.freeText ?? "")

  const initialMakeFromFilters = initial?.filters?.makes?.[0] ?? ""
  const initialModelFromFilters = initial?.filters?.models?.[0] ?? ""
  const initialMustHaveTerms = initial?.filters?.mustHave || []
  const initialTaxonomyMake = initialMakeFromFilters ? getZaMake(initialMakeFromFilters) : undefined
  const initialMakeMode: VehicleEntryMode = initialMakeFromFilters && !initialTaxonomyMake ? 'custom' : 'taxonomy'
  const initialTaxonomyModel =
    initialMakeMode === 'taxonomy' && initialTaxonomyMake && initialModelFromFilters
      ? getZaModel(initialTaxonomyMake.make, initialModelFromFilters)
      : undefined
  const initialModelMode: VehicleEntryMode =
    initialMakeMode === 'custom'
      ? 'custom'
      : initialModelFromFilters && !initialTaxonomyModel
        ? 'custom'
        : 'taxonomy'
  const initialEngine = (() => {
    if (initialMakeMode !== 'taxonomy' || initialModelMode !== 'taxonomy') return ""
    const mk = initialTaxonomyMake?.make
    const mdl = initialTaxonomyModel?.model
    if (!mk || !mdl) return ""
    const engines = getZaEngines(mk, mdl)
    const found = engines.find((engine) =>
      initialMustHaveTerms.some((term) => term.trim().toLowerCase().includes(engine.trim().toLowerCase()))
    )
    return found ?? ""
  })()
  const initialCabType = (() => {
    const lowered = initialMustHaveTerms.map((term) => term.trim().toLowerCase())
    const found = ZA_CAB_TYPES.find((entry) => lowered.includes(entry.label.toLowerCase()))
    return found?.value ?? ""
  })()

  const initialCabLabel = ZA_CAB_TYPES.find((entry) => entry.value === initialCabType)?.label ?? ""
  const initialMustHaveForInput = (() => {
    if (!initialMustHaveTerms || initialMustHaveTerms.length === 0) return ""
    const engineKey = initialEngine.trim().toLowerCase()
    const cabKey = initialCabLabel.trim().toLowerCase()
    const filtered = initialMustHaveTerms.filter((term) => {
      const key = term.trim().toLowerCase()
      if (engineKey && key === engineKey) return false
      if (cabKey && key === cabKey) return false
      return true
    })
    return filtered.join(", ")
  })()

  const [makeMode, setMakeMode] = useState<VehicleEntryMode>(initialMakeMode)
  const [selectedMake, setSelectedMake] = useState<string>(
    initialMakeMode === 'taxonomy' ? (initialTaxonomyMake?.make ?? "") : ""
  )
  const [customMake, setCustomMake] = useState<string>(initialMakeMode === 'custom' ? initialMakeFromFilters : "")
  const [modelMode, setModelMode] = useState<VehicleEntryMode>(initialMakeMode === 'custom' ? 'custom' : initialModelMode)
  const [selectedModel, setSelectedModel] = useState<string>(
    initialModelMode === 'taxonomy' ? (initialTaxonomyModel?.model ?? "") : ""
  )
  const [customModel, setCustomModel] = useState<string>(initialModelMode === 'custom' ? initialModelFromFilters : "")
  const [engine, setEngine] = useState<string>(initialEngine)
  const [cabType, setCabType] = useState<string>(initialCabType)

  const makeOptions = useMemo(() => getZaMakes(), [])
  const modelOptions = useMemo(() => {
    if (makeMode !== 'taxonomy' || !selectedMake) return []
    return getZaModelNames(selectedMake)
  }, [makeMode, selectedMake])
  const engineOptions = useMemo(() => {
    if (makeMode !== 'taxonomy' || modelMode !== 'taxonomy' || !selectedMake || !selectedModel) return []
    return getZaEngines(selectedMake, selectedModel)
  }, [makeMode, modelMode, selectedMake, selectedModel])
  const cabOptions = useMemo(() => {
    if (makeMode !== 'taxonomy' || modelMode !== 'taxonomy' || !selectedMake || !selectedModel) return []
    return getZaCabTypes(selectedMake, selectedModel)
  }, [makeMode, modelMode, selectedMake, selectedModel])

  const [minYear, setMinYear] = useState<string>(initial?.filters?.minYear != null ? String(initial.filters.minYear) : "")
  const [maxYear, setMaxYear] = useState<string>(initial?.filters?.maxYear != null ? String(initial.filters.maxYear) : "")
  const [maxBudgetZar, setMaxBudgetZar] = useState<string>(initial?.filters?.maxBudgetZar != null ? String(initial.filters.maxBudgetZar) : "")
  const [maxMileageKm, setMaxMileageKm] = useState<string>(initial?.filters?.maxMileageKm != null ? String(initial.filters.maxMileageKm) : "")
  const [seats, setSeats] = useState<string>(initial?.filters?.seats != null ? String(initial.filters.seats) : "")
  const [colors, setColors] = useState<string>((initial?.filters?.colors || []).join(", "))
  const [fuelTypes, setFuelTypes] = useState<string>((initial?.filters?.fuelTypes || []).join(", "))
  const [transmissions, setTransmissions] = useState<string>((initial?.filters?.transmissions || []).join(", "))
  const [bodyTypes, setBodyTypes] = useState<string>((initial?.filters?.bodyTypes || []).join(", "))
  const [mustHave, setMustHave] = useState<string>(initialMustHaveForInput)
  const [niceToHave, setNiceToHave] = useState<string>((initial?.filters?.niceToHave || []).join(", "))
  const [excludeTerms, setExcludeTerms] = useState<string>((initial?.filters?.excludeTerms || []).join(", "))
  const [isParsing, setIsParsing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const handleParseAI = async () => {
    if (!freeText) return
    setIsParsing(true)
    try {
      const res = await fetch('/api/ai/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: freeText })
      })
      const data = await res.json()
      if (data.success && data.data) {
        const { filters } = data.data

        const nextMake = Array.isArray(filters.makes) ? String(filters.makes[0] ?? "") : ""
        const nextModel = Array.isArray(filters.models) ? String(filters.models[0] ?? "") : ""
        const nextMustHave: string[] = Array.isArray(filters.mustHave)
          ? (filters.mustHave as unknown[]).filter((term): term is string => typeof term === 'string')
          : []

        const taxonomyMake = nextMake ? getZaMake(nextMake) : undefined
        const nextMakeMode: VehicleEntryMode = nextMake && !taxonomyMake ? 'custom' : 'taxonomy'
        setMakeMode(nextMakeMode)
        if (nextMakeMode === 'taxonomy') {
          setSelectedMake(taxonomyMake?.make ?? nextMake)
          setCustomMake("")
        } else {
          setCustomMake(nextMake)
          setSelectedMake("")
        }

        const taxonomyModel =
          nextMakeMode === 'taxonomy' && taxonomyMake && nextModel
            ? getZaModel(taxonomyMake.make, nextModel)
            : undefined
        const nextModelMode: VehicleEntryMode =
          nextMakeMode === 'custom'
            ? 'custom'
            : nextModel && !taxonomyModel
              ? 'custom'
              : 'taxonomy'
        setModelMode(nextModelMode)
        if (nextModelMode === 'taxonomy') {
          setSelectedModel(taxonomyModel?.model ?? nextModel)
          setCustomModel("")
        } else {
          setCustomModel(nextModel)
          setSelectedModel("")
        }

        const nextEngine = (() => {
          if (nextMakeMode !== 'taxonomy' || nextModelMode !== 'taxonomy') return ""
          const mk = taxonomyMake?.make
          const mdl = taxonomyModel?.model
          if (!mk || !mdl) return ""
          const engines = getZaEngines(mk, mdl)
          const lowered = nextMustHave.map((term) => term.trim().toLowerCase())
          const found = engines.find((entry) => lowered.includes(entry.trim().toLowerCase()))
          return found ?? ""
        })()
        setEngine(nextEngine)

        const nextCabType = (() => {
          const lowered = nextMustHave.map((term) => term.trim().toLowerCase())
          const found = ZA_CAB_TYPES.find((entry) => lowered.includes(entry.label.toLowerCase()))
          return found?.value ?? ""
        })()
        setCabType(nextCabType)

        const nextCabLabel = ZA_CAB_TYPES.find((entry) => entry.value === nextCabType)?.label ?? ""
        const strippedMustHave = nextMustHave
          .filter((term) => {
            const key = term.trim().toLowerCase()
            if (nextEngine && key === nextEngine.trim().toLowerCase()) return false
            if (nextCabLabel && key === nextCabLabel.trim().toLowerCase()) return false
            return true
          })
          .join(", ")
        setMustHave(strippedMustHave)

        if (filters.minYear) setMinYear(String(filters.minYear))
        if (filters.maxYear) setMaxYear(String(filters.maxYear))
        if (filters.maxBudgetZar) setMaxBudgetZar(String(filters.maxBudgetZar))
        if (filters.maxMileageKm) setMaxMileageKm(String(filters.maxMileageKm))
        if (filters.seats) setSeats(String(filters.seats))
        if (filters.colors) setColors(filters.colors.join(", "))
        if (filters.fuelTypes) setFuelTypes(filters.fuelTypes.join(", "))
        if (filters.transmissions) setTransmissions(filters.transmissions.join(", "))
        if (filters.bodyTypes) setBodyTypes(filters.bodyTypes.join(", "))
        if (filters.niceToHave) setNiceToHave(filters.niceToHave.join(", "))
        if (filters.excludeTerms) setExcludeTerms(filters.excludeTerms.join(", "))
      }
    } catch (error) {
      console.error("AI Parse failed", error)
    } finally {
      setIsParsing(false)
    }
  }

  const filters = useMemo<ClientRequest["filters"]>(() => {
    const parseCsv = (v: string) => {
      const arr = v.split(",").map(s => s.trim()).filter(Boolean)
      return arr.length > 0 ? arr : undefined // Return undefined for empty arrays
    }
    const toNum = (v: string) => {
      const trimmed = v.trim()
      if (trimmed === '') return undefined // Empty string = no value
      const n = Number(trimmed)
      return Number.isFinite(n) ? n : undefined // Return the number if valid
    }

    const makeValue = (makeMode === 'taxonomy' ? selectedMake : customMake).trim()
    const modelValue = (modelMode === 'taxonomy' ? selectedModel : customModel).trim()
    const engineValue = engine.trim()
    const cabLabel = cabType ? ZA_CAB_TYPES.find((entry) => entry.value === cabType)?.label : undefined

    const mustHaveFromInput = parseCsv(mustHave) || []
    const combinedMustHave = [...mustHaveFromInput]
    if (engineValue) combinedMustHave.push(engineValue)
    if (cabLabel) combinedMustHave.push(cabLabel)

    const normalizedMustHave = (() => {
      if (combinedMustHave.length === 0) return undefined
      const seen = new Set<string>()
      const result: string[] = []
      for (const value of combinedMustHave) {
        const trimmed = value.trim()
        if (!trimmed) continue
        const key = trimmed.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        result.push(trimmed)
      }
      return result.length ? result : undefined
    })()

    return {
      makes: makeValue ? [makeValue] : undefined,
      models: modelValue ? [modelValue] : undefined,
      minYear: toNum(minYear),
      maxYear: toNum(maxYear),
      maxBudgetZar: toNum(maxBudgetZar),
      maxMileageKm: toNum(maxMileageKm),
      seats: toNum(seats),
      colors: parseCsv(colors),
      fuelTypes: parseCsv(fuelTypes),
      transmissions: parseCsv(transmissions),
      bodyTypes: parseCsv(bodyTypes),
      mustHave: normalizedMustHave,
      niceToHave: parseCsv(niceToHave),
      excludeTerms: parseCsv(excludeTerms),
    }
  }, [makeMode, selectedMake, customMake, modelMode, selectedModel, customModel, engine, cabType, minYear, maxYear, maxBudgetZar, maxMileageKm, seats, colors, fuelTypes, transmissions, bodyTypes, mustHave, niceToHave, excludeTerms])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaveError(null)
    setIsSaving(true)
    try {
      console.log('[ClientRequestEditor] Saving:', { title: title.trim() || undefined, freeText: freeText.trim() || undefined, filters })
      await onSave({ title: title.trim() || undefined, freeText: freeText.trim() || undefined, filters })
      console.log('[ClientRequestEditor] Save completed')
    } catch (err) {
      console.error('[ClientRequestEditor] Save error:', err)
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <Label htmlFor="title">Title</Label>
        <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Family SUV under R350k" />
      </div>
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <Label htmlFor="freeText">Notes / Preferences</Label>
          <Button 
            type="button" 
            variant="outline" 
            size="sm" 
            onClick={handleParseAI}
            disabled={isParsing || !freeText}
          >
            {isParsing ? "Parsing..." : "Parse with AI"}
          </Button>
        </div>
        {initial?.aiParsing && (
          <div className="text-xs text-muted-foreground flex gap-4 mb-2">
             {initial.aiParsing.confidence !== undefined && (
                <span className={initial.aiParsing.confidence < 0.6 ? "text-yellow-600 font-medium" : ""}>
                  AI Confidence: {Math.round(initial.aiParsing.confidence * 100)}%
                </span>
             )}
             {initial.aiParsing.matchCount !== undefined && (
                <span>Matches: {initial.aiParsing.matchCount}</span>
             )}
             {initial.aiParsing.parsedAt && (
                <span>Parsed: {new Date(initial.aiParsing.parsedAt).toLocaleDateString()}</span>
             )}
          </div>
        )}
        <Textarea id="freeText" value={freeText} onChange={(e) => setFreeText(e.target.value)} placeholder="Any free-text notes from the customer..." rows={4} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="make">Make</Label>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant={makeMode === 'taxonomy' ? 'secondary' : 'ghost'}
                onClick={() => {
                  setMakeMode('taxonomy')
                  setCustomMake("")
                  if (modelMode === 'custom') setModelMode('taxonomy')
                }}
              >
                List
              </Button>
              <Button
                type="button"
                size="sm"
                variant={makeMode === 'custom' ? 'secondary' : 'ghost'}
                onClick={() => {
                  setMakeMode('custom')
                  setSelectedMake("")
                  setModelMode('custom')
                  setSelectedModel("")
                  setEngine("")
                  setCabType("")
                }}
              >
                Custom
              </Button>
            </div>
          </div>
          {makeMode === 'taxonomy' ? (
            <Select
              value={selectedMake || undefined}
              onValueChange={(value) => {
                setMakeMode('taxonomy')
                setSelectedMake(value)
                setCustomMake("")
                setModelMode('taxonomy')
                setSelectedModel("")
                setCustomModel("")
                setEngine("")
                setCabType("")
              }}
            >
              <SelectTrigger id="make">
                <SelectValue placeholder="Select make" />
              </SelectTrigger>
              <SelectContent>
                {makeOptions.map((make) => (
                  <SelectItem key={make} value={make}>
                    {make}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="make"
              value={customMake}
              onChange={(e) => {
                setCustomMake(e.target.value)
              }}
              placeholder="e.g. Toyota"
            />
          )}
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="model">Model</Label>
            {makeMode === 'taxonomy' && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={modelMode === 'taxonomy' ? 'secondary' : 'ghost'}
                  onClick={() => {
                    setModelMode('taxonomy')
                    setCustomModel("")
                  }}
                  disabled={!selectedMake}
                >
                  List
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={modelMode === 'custom' ? 'secondary' : 'ghost'}
                  onClick={() => {
                    setModelMode('custom')
                    setSelectedModel("")
                    setEngine("")
                    setCabType("")
                  }}
                >
                  Custom
                </Button>
              </div>
            )}
          </div>
          {makeMode === 'taxonomy' && modelMode === 'taxonomy' ? (
            <Select
              value={selectedModel || undefined}
              onValueChange={(value) => {
                setSelectedModel(value)
                setCustomModel("")
                setEngine("")
                setCabType("")
              }}
              disabled={!selectedMake}
            >
              <SelectTrigger id="model">
                <SelectValue placeholder={selectedMake ? "Select model" : "Select make first"} />
              </SelectTrigger>
              <SelectContent>
                {modelOptions.map((model) => (
                  <SelectItem key={model} value={model}>
                    {model}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="model"
              value={customModel}
              onChange={(e) => setCustomModel(e.target.value)}
              placeholder="e.g. Hilux"
              disabled={makeMode === 'taxonomy' && !selectedMake}
            />
          )}
        </div>

        <div className="space-y-1">
          <Label htmlFor="engine">Engine Size</Label>
          {makeMode === 'taxonomy' && modelMode === 'taxonomy' && engineOptions.length > 0 ? (
            <Select
              value={engine || '__none__'}
              onValueChange={(value) => setEngine(value === '__none__' ? "" : value)}
              disabled={!selectedMake || !selectedModel}
            >
              <SelectTrigger id="engine">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Any</SelectItem>
                {engineOptions.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {entry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              id="engine"
              value={engine}
              onChange={(e) => setEngine(e.target.value)}
              placeholder="e.g. 2.8"
            />
          )}
        </div>

        {(cabOptions.length > 0 || cabType) && (
          <div className="space-y-1">
            <Label htmlFor="cabType">Cab Type</Label>
            <Select
              value={cabType || '__none__'}
              onValueChange={(value) => setCabType(value === '__none__' ? "" : value)}
            >
              <SelectTrigger id="cabType">
                <SelectValue placeholder="Any" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Any</SelectItem>
                {(cabOptions.length > 0 ? cabOptions : ZA_CAB_TYPES.map((entry) => entry.value)).map((value) => {
                  const label = ZA_CAB_TYPES.find((entry) => entry.value === value)?.label ?? value
                  return (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        )}
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

      {saveError && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{saveError}</div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSaving}>Cancel</Button>
        <Button type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </form>
  )
}
