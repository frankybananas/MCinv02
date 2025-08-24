import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "sonner"
import HeaderBar from "./components/header-bar"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Car Inventory - Mobile App",
  description: "Mobile car inventory management application",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Car Inventory",
  },

}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#2563eb",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const clean = (v?: string) => {
    if (!v) return undefined
    const t = v.trim()
    // strip wrapping quotes if present
    return t.replace(/^"|"$/g, '')
  }
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Car Inventory" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <HeaderBar />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
