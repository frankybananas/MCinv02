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
    <header className="sticky top-0 z-30 bg-white border-b px-4 py-2 flex items-center justify-between gap-3 dark:bg-neutral-900 dark:border-neutral-800">
      <Image src={logoPath} alt="Halfway" width={140} height={40} priority className="h-8 w-auto object-contain" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="relative overflow-hidden pr-3 pl-10"
            style={profile?.avatar ? { backgroundImage: `url(${profile.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
          >
            {!profile?.avatar && <User className="absolute left-3 h-4 w-4 opacity-70" />}
            <span className="relative z-10">
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
