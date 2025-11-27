"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"

interface ProfileData {
  firstName: string
  lastName: string
  phone: string
  email: string
  avatar?: string
}

export default function ProfilePage() {
  const router = useRouter()
  const [data, setData] = useState<ProfileData>({ firstName: "", lastName: "", phone: "", email: "", avatar: "" })
  const [initial, setInitial] = useState<ProfileData>({ firstName: "", lastName: "", phone: "", email: "", avatar: "" })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const json = await res.json()
          setData(json.data)
          setInitial(json.data)
        }
      } catch (e) {
        // noop
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleFile = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setData((d) => ({ ...d, avatar: String(reader.result || '') }))
    }
    reader.readAsDataURL(file)
  }

  const save = async () => {
    try {
      setSaving(true)
      const res = await fetch('/api/auth/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const json = await res.json()
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to save')
      toast.success('Profile updated')
      if (json.requireReauth) {
        toast.message('Phone changed, please sign in again')
        await fetch('/api/auth/logout', { method: 'POST' })
        window.location.href = '/auth/login'
      }
      // navigate back to dashboard when saved successfully and no reauth is required
      if (!json.requireReauth) {
        router.push('/')
      }
    } catch (e: any) {
      toast.error(e?.message || 'Error saving profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-4">Loading...</div>

  return (
    <div className="max-w-xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your Profile</h1>
        <Button variant="ghost" onClick={() => router.push('/')}>Back to Dashboard</Button>
      </div>
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
              {data.avatar ? (
                <img src={data.avatar} alt="avatar" className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm text-gray-400">No Image</span>
              )}
            </div>
            <div>
              <Label htmlFor="avatar">Profile picture</Label>
              <Input id="avatar" type="file" accept="image/*" onChange={(e) => handleFile(e.target.files?.[0] || undefined)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" value={data.firstName} onChange={(e) => setData({ ...data, firstName: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" value={data.lastName} onChange={(e) => setData({ ...data, lastName: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">Mobile</Label>
              <Input id="phone" value={data.phone} onChange={(e) => setData({ ...data, phone: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} />
            </div>
          </div>

          <div className="flex justify-end">
            <Button onClick={save} disabled={saving || JSON.stringify(data) === JSON.stringify(initial)}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
