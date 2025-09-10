"use client";

import { useState, useEffect, FormEvent, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import parsePhoneNumber from 'libphonenumber-js';

// Define a type for the user object for better type safety
interface User {
  phone: string;
  role: string;
  profile?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/';
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const otpAbortRef = useRef<AbortController | null>(null);

  // Start WebOTP listening after OTP is sent
  const startWebOtpListener = () => {
    try {
      if (typeof window === 'undefined') return;
      if (!('OTPCredential' in window) || !(navigator as any).credentials?.get) return;

      // Abort any existing listener
      otpAbortRef.current?.abort();
      const ac = new AbortController();
      otpAbortRef.current = ac;

      (navigator as any).credentials
        .get({ otp: { transport: ['sms'] }, signal: ac.signal })
        .then((cred: any) => {
          if (!cred) return;
          const received = cred.code || cred?.otp || '';
          if (received) setOtp(received);
        })
        .catch(() => {
          // Ignore; user can type manually or browser unsupported
        });
    } catch {}
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      otpAbortRef.current?.abort();
    };
  }, []);

  // Persist phone number locally so users don't have to retype it
  useEffect(() => {
    try {
      const saved = localStorage.getItem('login_phone');
      if (saved) setPhone(saved);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (phone) localStorage.setItem('login_phone', phone);
    } catch {}
  }, [phone]);

  async function handlePhoneSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const phoneNumber = parsePhoneNumber(phone, 'ZA');
    if (!phoneNumber || !phoneNumber.isValid()) {
      setError('Please enter a valid phone number.');
      setLoading(false);
      return;
    }

    const normalizedPhone = phoneNumber.format('E.164');

    try {
      const response = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizedPhone }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('OTP sent successfully');
        setStep('otp');
        // Start WebOTP immediately after user gesture
        startWebOtpListener();
        if (data.testOtp) {
          setOtp(data.testOtp);
        }
      } else {
        setError(data.error || 'Failed to send OTP');
      }
    } catch (err: any) {
      setError('Error sending OTP: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const phoneNumber = parsePhoneNumber(phone, 'ZA');
    if (!phoneNumber || !phoneNumber.isValid()) {
      // This should not happen if the first step worked, but as a safeguard:
      setError('An error occurred with the phone number. Please go back.');
      setLoading(false);
      return;
    }

    const normalizedPhone = phoneNumber.format('E.164');

    try {
      const response = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: normalizedPhone, code: otp }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('Authentication successful! Redirecting...');
        // Redirect after a short delay to allow state to update
        setTimeout(() => {
          window.location.href = redirectTo;
        }, 500);
      } else {
        setError(data.error || 'Failed to verify OTP');
      }
    } catch (err: any) {
      setError('Error verifying OTP: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    setStep('phone');
    setError('');
    setSuccess('');
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription>
            {step === 'phone'
              ? 'Enter your phone number to receive a verification code'
              : 'Enter the verification code sent to your phone'}
          </CardDescription>
        </CardHeader>

        {error && (
          <div className="mx-6 mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {success && step === 'otp' && (
          <div className="mx-6 mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            {success}
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handlePhoneSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  name="tel"
                  type="tel"
                  autoComplete="tel"
                  placeholder="+27720560090"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
                <p className="text-xs text-gray-500">
                  For testing, use: +16505553434
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Sending...' : 'Send Verification Code'}
              </Button>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={handleOtpSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Verification Code</Label>
                <Input
                  id="otp"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  name="one-time-code"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                />
                 <p className="text-xs text-gray-500">
                  For testing, use: 123456
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button type="button" variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify Code'}
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
