import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import LoginPage from '@/app/auth/login/page'

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn().mockReturnValue('/'),
  }),
}))

jest.mock('libphonenumber-js', () => ({
  __esModule: true,
  default: (value: string) => {
    if (value === '+27721234567') {
      return {
        isValid: () => true,
        format: () => '+27721234567',
      }
    }
    return {
      isValid: () => false,
      format: () => value,
    }
  },
}))

describe('LoginPage OTP flow', () => {
  beforeEach(() => {
    ;(global.fetch as any) = jest.fn()
    jest.clearAllMocks()
  })

  it('renders phone step without test hints', () => {
    render(<LoginPage />)

    expect(screen.getByText('Login')).toBeInTheDocument()
    expect(
      screen.queryByText(/For testing, use:/i)
    ).not.toBeInTheDocument()
  })

  it('moves to OTP step on successful send and does not show test hints', async () => {
    const mockFetch = jest.fn((url: any) => {
      if (typeof url === 'string' && url.includes('/api/auth/otp/send')) {
        return Promise.resolve({
          ok: true,
          json: async () => ({ testOtp: '123456' }),
        } as Response)
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({}),
      } as Response)
    })

    ;(global.fetch as any) = mockFetch

    render(<LoginPage />)

    const phoneInput = screen.getByLabelText('Phone Number')
    fireEvent.change(phoneInput, { target: { value: '+27721234567' } })

    const sendButton = screen.getByRole('button', {
      name: /send verification code/i,
    })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(
        screen.getByText('Enter the verification code sent to your phone')
      ).toBeInTheDocument()
    })

    expect(
      screen.queryByText(/For testing, use:/i)
    ).not.toBeInTheDocument()

    const otpInput = screen.getByLabelText('Verification Code') as HTMLInputElement
    expect(otpInput.value).toBe('123456')
  })

  it('shows validation error for invalid phone number and does not call API', async () => {
    const mockFetch = jest.fn()
    ;(global.fetch as any) = mockFetch

    render(<LoginPage />)

    const phoneInput = screen.getByLabelText('Phone Number')
    fireEvent.change(phoneInput, { target: { value: '123' } })

    const sendButton = screen.getByRole('button', {
      name: /send verification code/i,
    })
    fireEvent.click(sendButton)

    await waitFor(() => {
      expect(
        screen.getByText('Please enter a valid phone number.')
      ).toBeInTheDocument()
    })

    expect(mockFetch).not.toHaveBeenCalled()
  })
})
