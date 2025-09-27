"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft } from "lucide-react"

interface OTPScreenProps {
  phoneNumber: string
  onVerify: (otp: string) => void
  onBack: () => void
}

export function OTPScreen({ phoneNumber, onVerify, onBack }: OTPScreenProps) {
  const [otp, setOtp] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.trim()) {
      onVerify(otp)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-blue-50 to-white">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="self-start">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="text-center">
            <CardTitle className="text-2xl">Enter OTP</CardTitle>
            <CardDescription>
              We sent a verification code to
              <br />
              <span className="font-semibold">{phoneNumber}</span>
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="text"
                placeholder="Enter 4-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="text-center text-2xl h-16 tracking-widest"
                maxLength={4}
                required
              />
            </div>
            <Button type="submit" className="w-full h-12 text-lg">
              Verify & Login
            </Button>
            <Button variant="ghost" className="w-full">
              Resend OTP
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
