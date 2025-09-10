"use client"

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CarIcon } from 'lucide-react';

interface LoginFormProps {
  onLoginSuccess: () => void;
}

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const otpAbortRef = useRef<AbortController | null>(null);

  // Start WebOTP listening after OTP is sent
  const startWebOtpListener = () => {
    try {
      // Ensure browser support and secure context
      if (typeof window === 'undefined') return;
      if (!('OTPCredential' in window) || !(navigator as any).credentials?.get) return;

      // Abort any prior listener
      otpAbortRef.current?.abort();
      const ac = new AbortController();
      otpAbortRef.current = ac;

      // Request the OTP via WebOTP API
      (navigator as any).credentials
        .get({ otp: { transport: ['sms'] }, signal: ac.signal })
        .then((cred: any) => {
          if (!cred) return;
          const received = cred.code || cred?.otp || '';
          if (received) {
            setCode(received);
          }
        })
        .catch(() => {
          // Silently ignore errors (user may type code manually or browser unsupported)
        });
    } catch {
      // No-op; fallback to manual entry
    }
  };

  // Abort WebOTP on unmount
  useEffect(() => {
    return () => {
      otpAbortRef.current?.abort();
    };
  }, []);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send OTP');
      }

      setOtpSent(true);
      // Attempt to start WebOTP right after the user gesture that triggered send
      // This increases the likelihood that browsers allow the API call
      startWebOtpListener();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Invalid OTP');
      }

      // On successful verification, call the parent component's handler
      onLoginSuccess();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-sm mx-4">
        <CardHeader className="text-center">
          <CarIcon className="w-12 h-12 mx-auto text-gray-400" />
          <CardTitle className="mt-4 text-2xl font-bold">Car Inventory</CardTitle>
          <CardDescription>Sign in to continue</CardDescription>
        </CardHeader>
        <CardContent>
          {!otpSent ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label htmlFor="phone" className="sr-only">Phone Number</label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="e.g. +27721234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Send OTP'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label htmlFor="code" className="sr-only">OTP Code</label>
                <Input
                  id="code"
                  type="tel"
                  placeholder="Enter the code from SMS"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  disabled={isLoading}
                  // Hints for browser/SMS OTP autofill
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  name="one-time-code"
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Verifying...' : 'Verify & Sign In'}
              </Button>
            </form>
          )}
          {error && <p className="mt-4 text-sm text-center text-red-500">{error}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
