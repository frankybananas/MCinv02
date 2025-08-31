"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { User, LogOut } from "lucide-react"

function clean(v?: string) {
  return v ? v.trim().replace(/^"|"$/g, "") : undefined
}

export default function HeaderBar() {
  // Use the supplied Halfway logo explicitly, removing the previous placeholder/ACME logo
  const logoPath = "/halfway-logo.png"
  const [profile, setProfile] = useState<{ firstName: string; lastName: string; email: string; phone: string; avatar?: string } | null>(null)

  useEffect(() => {
    const fetchMe = async () => {
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          const json = await res.json()
          setProfile(json.data)
        }
      } catch {}
    }
    fetchMe()
  }, [])

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      window.location.href = '/auth/login'
    } catch {}
  }

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-gray-200/50 px-4 py-2 flex items-center justify-between gap-3 shadow-lg">
      <Image src={logoPath} alt="Halfway" width={140} height={40} loading="eager" className="h-8 w-auto object-contain" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="flex items-center gap-2 pr-3 pl-3"
          >
            {profile?.avatar ? (
              <span
                className="h-9 w-9 rounded-full ring-2 ring-primary/30 bg-center bg-cover"
                style={{ backgroundImage: `url(${profile.avatar})` }}
              />
            ) : (
              <span className="h-9 w-9 rounded-full bg-muted flex items-center justify-center ring-2 ring-muted-foreground/20">
                <User className="h-4 w-4 opacity-70" />
              </span>
            )}
            <span className="font-semibold tracking-wide">
              {profile ? `${profile.firstName} ${profile.lastName}`.trim() || 'Profile' : 'Profile'}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => { window.location.href = '/profile' }}>Profile</DropdownMenuItem>
          <DropdownMenuItem onClick={logout} className="text-red-600">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
