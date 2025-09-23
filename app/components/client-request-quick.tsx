"use client"

import React, { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ClientRequest } from "../types"

interface QuickProps {
  placeholder?: string
  onCancel: () => void
  onSave: (data: { title?: string; freeText: string; filters: ClientRequest["filters"] }) => Promise<void> | void
}

export default function ClientRequestQuick({ placeholder = "e.g. Looking for Cross, min year 2022, max budget R480k", onCancel, onSave }: QuickProps) {
  const [text, setText] = useState("")
  const [saving, setSaving] = useState(false)
  const [showExamples, setShowExamples] = useState(false)

  const examples: string[] = [
    "White/silver only Toyota Hilux 2020+ under R450k",
    "Looking for Cross, min year 2022, max budget R480k (Toyota present → Corolla Cross; VW present → T‑Cross)",
    "Any silver SUV under 300k",
    "Kia Seltos 2021+, white only",
    "P‑Series bakkie, 2022+, under R500k",
    "Haval Jolion white, 2023+",
    "Hyundai i20 or Grand i10, 2020+, hatch",
  ]

  const parsed = useMemo(() => parseQuick(text), [text])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    try {
      setSaving(true)
      const { title, freeText, filters } = parsed
      await onSave({ title, freeText, filters })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="space-y-3" onSubmit={handleSave}>
      <div className="space-y-2">
        <div className="relative">
          <Input
            value={text}
            onFocus={() => setShowExamples(text.trim().length === 0)}
            onBlur={() => setShowExamples(false)}
            onChange={(e) => {
              const v = e.target.value
              setText(v)
              if (v.trim().length > 0) setShowExamples(false)
            }}
            placeholder={placeholder}
          />
          {showExamples && text.trim().length === 0 && (
            <div className="absolute z-50 left-0 right-0 top-full mt-2 rounded-md border bg-popover p-2 shadow-md">
              <div className="text-xs font-medium mb-2 text-muted-foreground">Examples</div>
              <ul className="space-y-1 text-sm">
                {examples.map((ex) => (
                  <li key={ex}>
                    <button
                      type="button"
                      className="w-full text-left px-2 py-1 rounded hover:bg-accent hover:text-accent-foreground"
                      onMouseDown={(e) => { e.preventDefault(); setText(ex); setShowExamples(false) }}
                    >
                      {ex}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          Parsed: {summary(parsed)}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={!text.trim() || saving}>{saving ? "Saving…" : "Add"}</Button>
      </div>
    </form>
  )
}

function summary(p: ReturnType<typeof parseQuick>) {
  const parts: string[] = []
  if (p.filters.minYear) parts.push(`minYear ${p.filters.minYear}`)
  if (p.filters.maxYear) parts.push(`maxYear ${p.filters.maxYear}`)
  if (p.filters.maxBudgetZar) parts.push(`maxBudget R${p.filters.maxBudgetZar.toLocaleString()}`)
  if (p.filters.maxMileageKm) parts.push(`maxMileage ${p.filters.maxMileageKm.toLocaleString()} km`)
  if (p.filters.seats) parts.push(`${p.filters.seats} seats`)
  if (p.filters.fuelTypes?.length) parts.push(p.filters.fuelTypes.join("/"))
  if (p.filters.transmissions?.length) parts.push(p.filters.transmissions.join("/"))
  if (p.filters.makes?.length) parts.push(`makes: ${p.filters.makes.join(", ")}`)
  if (p.filters.models?.length) parts.push(`models: ${p.filters.models.join(", ")}`)
  if (p.filters.colors?.length) parts.push(`colors: ${p.filters.colors.join("/")}`)
  if (p.filters.bodyTypes?.length) parts.push(`body: ${p.filters.bodyTypes.join("/")}`)
  return parts.length ? parts.join(" · ") : "no structured filters (free text only)"
}

function parseQuick(input: string): { title?: string; freeText: string; filters: ClientRequest["filters"] } {
  const text = input.trim()
  const lower = text.toLowerCase()

  const filters: ClientRequest["filters"] = {}

  // Budget: look for R amounts or numbers near budget words or "under"
  const budgetWords = ["budget", "price", "under", "max", "<=", "up to", "upto"]
  const budgetRegex = /(r\s*)?([0-9][0-9\s,\.]*)(\s*[km])?/i
  for (const w of budgetWords) {
    const idx = lower.indexOf(w)
    if (idx !== -1) {
      const slice = text.slice(idx, idx + 30)
      const m = slice.match(budgetRegex)
      if (m) {
        const amount = normalizeMoney(m[2] || "", m[3] || "")
        if (amount) { filters.maxBudgetZar = amount; break }
      }
    }
  }
  // Also try any standalone Rxxx pattern
  if (!filters.maxBudgetZar) {
    const m = text.match(/r\s*([0-9][0-9\s,\.]*)(\s*[km])?/i)
    if (m) {
      const amount = normalizeMoney(m[1] || "", m[2] || "")
      if (amount) filters.maxBudgetZar = amount
    }
  }

  // Years
  const minYearPhrase = /(min\s*year|from\s*(year)?|after\s*(year)?|>=\s*(year)?)[^\d]{0,6}(\d{4})/i
  const maxYearPhrase = /(max\s*year|before\s*(year)?|<=\s*(year)?)[^\d]{0,6}(\d{4})/i
  const minMatch = text.match(minYearPhrase)
  if (minMatch) {
    const y = Number(minMatch[5])
    if (y >= 1980 && y <= 2100) filters.minYear = y
  }
  const maxMatch = text.match(maxYearPhrase)
  if (maxMatch) {
    const y = Number(maxMatch[4])
    if (y >= 1980 && y <= 2100) filters.maxYear = y
  }
  // Single year like "2022+"
  const plusMatch = text.match(/(\d{4})\s*\+/)
  if (!filters.minYear && plusMatch) {
    const y = Number(plusMatch[1]); if (y >= 1980 && y <= 2100) filters.minYear = y
  }

  // Mileage
  const mileageMatch = text.match(/(under|max|<=)\s*([0-9][0-9\s,\.]*)(\s*[km])?\s*km/i)
  if (mileageMatch) {
    const num = normalizeNumber(mileageMatch[2] || "", mileageMatch[3] || "k")
    if (num) filters.maxMileageKm = num
  } else {
    // e.g. "90k km"
    const km2 = text.match(/([0-9][0-9\s,\.]*)\s*(k|m)?\s*km/i)
    if (km2) {
      const num = normalizeNumber(km2[1] || "", km2[2] || "k")
      if (num) filters.maxMileageKm = num
    }
  }

  // Seats
  const seat = text.match(/(\d+)\s*(seat|seater)/i)
  if (seat) {
    const s = Number(seat[1]); if (Number.isFinite(s) && s > 0) filters.seats = s
  }

  // Transmission
  if (/(auto|automatic)/i.test(text)) filters.transmissions = ["automatic"]
  if (/manual/i.test(text)) filters.transmissions = ["manual"]

  // Fuel types
  const fuels: string[] = []
  if (/diesel/i.test(text)) fuels.push("diesel")
  if (/petrol|gasoline/i.test(text)) fuels.push("petrol")
  if (/hybrid/i.test(text)) fuels.push("hybrid")
  if (/electric|ev/i.test(text)) fuels.push("electric")
  if (fuels.length) filters.fuelTypes = fuels

  // Colors (SA common names and synonyms)
  const colorMap: Record<string, string> = {
    "white": "white",
    "pearl white": "white",
    "off white": "white",
    "off-white": "white",
    "polar white": "white",
    "diamond white": "white",
    "snow white": "white",
    "platinum white": "white",
    "cream": "beige",
    "beige": "beige",
    "ivory": "beige",
    "tan": "beige",
    "silver": "silver",
    "grey": "grey",
    "gray": "grey",
    "charcoal": "grey",
    "gunmetal": "grey",
    "gun metal": "grey",
    "space grey": "grey",
    "graphite": "grey",
    "black": "black",
    "blue": "blue",
    "navy": "blue",
    "sky blue": "blue",
    "red": "red",
    "maroon": "red",
    "green": "green",
    "lime": "green",
    "gold": "gold",
    "champagne": "gold",
    "bronze": "bronze",
    "orange": "orange",
    "yellow": "yellow",
    "brown": "brown",
    "purple": "purple",
  }
  const colorKeysPattern = Object.keys(colorMap).map(escapeRegex).join("|")
  if (colorKeysPattern) {
    const re = new RegExp(`\\b(${colorKeysPattern})\\b`, 'gi')
    const found = new Set<string>()
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const raw = (m[1] || '').toLowerCase()
      const canon = colorMap[raw] || raw
      found.add(canon)
    }
    if (found.size) filters.colors = Array.from(found)
  }

  // Makes: detect a few common brands quickly (non-exhaustive)
  const brandMap: Record<string, string> = {
    "volkswagen": "Volkswagen",
    "vw": "Volkswagen",
    "toyota": "Toyota",
    "ford": "Ford",
    "bmw": "BMW",
    "mercedes": "Mercedes-Benz",
    "mercedes-benz": "Mercedes-Benz",
    "audi": "Audi",
    "kia": "Kia",
    "hyundai": "Hyundai",
    "nissan": "Nissan",
    "renault": "Renault",
    "mazda": "Mazda",
    "haval": "Haval",
    "gwm": "GWM",
    "great wall": "GWM",
    "suzuki": "Suzuki",
    "isuzu": "Isuzu",
    "land rover": "Land Rover",
    "range rover": "Land Rover",
    "jaguar": "Jaguar",
    "peugeot": "Peugeot",
    "citroen": "Citroen",
    "opel": "Opel",
    "volvo": "Volvo",
    "jeep": "Jeep",
    "mini": "Mini",
    "mitsubishi": "Mitsubishi",
    "chery": "Chery",
    // SA-specific additional brands
    "mahindra": "Mahindra",
    "tata": "Tata",
    "proton": "Proton",
    "baic": "BAIC",
    "jac": "JAC",
    "fiat": "Fiat",
    "alfa": "Alfa Romeo",
    "alfa romeo": "Alfa Romeo",
    "subaru": "Subaru",
    "byd": "BYD",
    "ora": "ORA",
    "ssangyong": "SsangYong",
    "daihatsu": "Daihatsu",
    "changan": "Changan",
    "chana": "Changan",
    "honda": "Honda",
    "chevrolet": "Chevrolet",
    "datsun": "Datsun",
  }
  const foundMakes = new Set<string>()
  for (const key of Object.keys(brandMap)) {
    const re = new RegExp(`\\b${escapeRegex(key)}\\b`, 'i')
    if (re.test(text)) foundMakes.add(brandMap[key])
  }
  if (foundMakes.size) filters.makes = Array.from(foundMakes)

  // SA-common model aliases detection
  const modelsFound = new Set<string>()
  const addModel = (n: string) => { if (n) modelsFound.add(n) }
  const mk = Array.from(foundMakes)

  // Handle ambiguous "Cross": map to Corolla Cross if Toyota is present, T-Cross if VW present
  if (/\bcross\b/i.test(text)) {
    if (mk.includes('Toyota')) addModel('Corolla Cross')
    else if (mk.includes('Volkswagen')) addModel('T-Cross')
  }

  const patterns: Array<{ re: RegExp; name: string }> = [
    { re: /\bhilux\b/i, name: 'Hilux' },
    { re: /\branger\b/i, name: 'Ranger' },
    { re: /\bpolo\s*vivo\b/i, name: 'Polo Vivo' },
    { re: /\bpolo\b/i, name: 'Polo' },
    { re: /\bcorolla\s*cross\b/i, name: 'Corolla Cross' },
    { re: /\bfortuner\b/i, name: 'Fortuner' },
    { re: /\brav\s*4\b/i, name: 'RAV4' },
    { re: /\bprado\b/i, name: 'Prado' },
    { re: /\bland\s*cruiser\b/i, name: 'Land Cruiser' },
    { re: /\burban\s*cruiser\b/i, name: 'Urban Cruiser' },
    { re: /\brumion\b/i, name: 'Rumion' },
    { re: /\betios\b/i, name: 'Etios' },
    { re: /\bstarlet\b/i, name: 'Starlet' },
    { re: /\bbaleno\b/i, name: 'Baleno' },
    { re: /\bswift\b/i, name: 'Swift' },
    { re: /\bjimny\b/i, name: 'Jimny' },
    { re: /\bvitara\b/i, name: 'Vitara' },
    { re: /\bkwid\b/i, name: 'Kwid' },
    { re: /\bmagnite\b/i, name: 'Magnite' },
    { re: /\bduster\b/i, name: 'Duster' },
    { re: /\bkiger\b/i, name: 'Kiger' },
    { re: /\bnavara\b/i, name: 'Navara' },
    { re: /\bnp\s*200\b/i, name: 'NP200' },
    { re: /\bqashqai\b/i, name: 'Qashqai' },
    { re: /\bx[- ]?trail\b/i, name: 'X-Trail' },
    { re: /\bt[- ]?cross\b/i, name: 'T-Cross' },
    { re: /\bt[- ]?roc\b/i, name: 'T-Roc' },
    { re: /\btiguan\b/i, name: 'Tiguan' },
    { re: /\bamarok\b/i, name: 'Amarok' },
    { re: /\bp[- ]?series\b/i, name: 'P-Series' },
    { re: /\bsteed\b/i, name: 'Steed' },
    { re: /\beco\s*sport\b/i, name: 'EcoSport' },
    { re: /\beverest\b/i, name: 'Everest' },
    { re: /\bfiesta\b/i, name: 'Fiesta' },
    { re: /\bfocus\b/i, name: 'Focus' },
    { re: /\bfigo\b/i, name: 'Figo' },
    { re: /\bd[- ]?max\b/i, name: 'D-Max' },
    { re: /\bkb\b/i, name: 'KB' },
    { re: /\bmu[- ]?x\b/i, name: 'MU-X' },
    { re: /\bcx[- ]?3\b/i, name: 'CX-3' },
    { re: /\bcx[- ]?5\b/i, name: 'CX-5' },
    { re: /\bpicanto\b/i, name: 'Picanto' },
    { re: /\brio\b/i, name: 'Rio' },
    { re: /\bseltos\b/i, name: 'Seltos' },
    { re: /\bsportage\b/i, name: 'Sportage' },
    { re: /\btucson\b/i, name: 'Tucson' },
    { re: /\bkona\b/i, name: 'Kona' },
    { re: /\bcreta\b/i, name: 'Creta' },
    { re: /\bvenue\b/i, name: 'Venue' },
    { re: /\bgrand\s*i10\b/i, name: 'Grand i10' },
    { re: /\bi[- ]?10\b/i, name: 'i10' },
    { re: /\bi[- ]?20\b/i, name: 'i20' },
    { re: /\bgolf\b/i, name: 'Golf' },
    { re: /\ba1\b/i, name: 'A1' },
    { re: /\ba3\b/i, name: 'A3' },
    { re: /\ba4\b/i, name: 'A4' },
    { re: /\bq2\b/i, name: 'Q2' },
    { re: /\bq3\b/i, name: 'Q3' },
    { re: /\bq5\b/i, name: 'Q5' },
    { re: /\b1\s*series\b/i, name: '1 Series' },
    { re: /\b3\s*series\b/i, name: '3 Series' },
    { re: /\b2\s*series\b/i, name: '2 Series' },
    { re: /\b5\s*series\b/i, name: '5 Series' },
    { re: /\bx1\b/i, name: 'X1' },
    { re: /\bx3\b/i, name: 'X3' },
    { re: /\bx5\b/i, name: 'X5' },
    { re: /\ba[- ]?class\b/i, name: 'A-Class' },
    { re: /\bc[- ]?class\b/i, name: 'C-Class' },
    { re: /\be[- ]?class\b/i, name: 'E-Class' },
    { re: /\bgla\b/i, name: 'GLA' },
    { re: /\bglc\b/i, name: 'GLC' },
    { re: /\bgle\b/i, name: 'GLE' },
    { re: /\btriton\b/i, name: 'Triton' },
    { re: /\boutlander\b/i, name: 'Outlander' },
    { re: /\basx\b/i, name: 'ASX' },
    { re: /\bduster\b/i, name: 'Duster' },
    { re: /\bjolion\b/i, name: 'Jolion' },
    { re: /\bh6\b/i, name: 'H6' },
    { re: /\bcat\b/i, name: 'Ora Cat' },
    { re: /\batto\s*3\b/i, name: 'Atto 3' },
    { re: /\bx70\b/i, name: 'X70' },
    { re: /\bx50\b/i, name: 'X50' },
    { re: /\btiggo\s*4\s*pro\b/i, name: 'Tiggo 4 Pro' },
    { re: /\btiggo\s*7\s*pro\b/i, name: 'Tiggo 7 Pro' },
    { re: /\btiggo\s*8\s*pro\b/i, name: 'Tiggo 8 Pro' },
  ]
  for (const ptn of patterns) {
    if (ptn.re.test(text)) addModel(ptn.name)
  }
  if (modelsFound.size) {
    filters.models = Array.from(new Set([...(filters.models || []), ...Array.from(modelsFound)]))
  }

  // SA body-type terms (optional)
  if (/bakkie|double\s*cab|single\s*cab|pickup/i.test(text)) {
    filters.bodyTypes = Array.from(new Set([...(filters.bodyTypes || []), 'bakkie']))
  }
  if (/\bsuv\b/i.test(text)) {
    filters.bodyTypes = Array.from(new Set([...(filters.bodyTypes || []), 'suv']))
  }
  if (/hatch|hatchback/i.test(text)) {
    filters.bodyTypes = Array.from(new Set([...(filters.bodyTypes || []), 'hatchback']))
  }
  if (/sedan/i.test(text)) {
    filters.bodyTypes = Array.from(new Set([...(filters.bodyTypes || []), 'sedan']))
  }

  // Extract a likely model word after "looking for" if present
  const lf = text.match(/looking\s*for\s*([^,.;]+)/i)
  if (lf) {
    const modelPhrase = lf[1].trim()
    // Keep it concise: take first 3 words
    const m = modelPhrase.split(/\s+/).slice(0, 3).join(" ")
    if (m && m.length <= 40) {
      filters.models = [m]
    }
  }

  const title = text.length > 60 ? text.slice(0, 60) + "…" : text
  return { title, freeText: text, filters }
}

function normalizeMoney(numStr: string, suffix: string): number | undefined {
  const raw = (numStr || "").replace(/[^0-9.,]/g, "").trim()
  if (!raw) return undefined
  const clean = raw.replace(/[,\s]/g, "")
  let val = Number(clean)
  if (!Number.isFinite(val)) return undefined
  const s = (suffix || "").toLowerCase().trim()
  if (s.includes("m")) val = val * 1_000_000
  else if (s.includes("k")) val = val * 1_000
  return Math.round(val)
}

function normalizeNumber(numStr: string, suffix: string): number | undefined {
  const clean = (numStr || "").replace(/[,\s]/g, "")
  let val = Number(clean)
  if (!Number.isFinite(val)) return undefined
  const s = (suffix || "").toLowerCase()
  if (s.includes("m")) val = val * 1_000_000
  if (s.includes("k")) val = val * 1_000
  return Math.round(val)
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
