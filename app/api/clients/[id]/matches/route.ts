import { NextResponse } from 'next/server'

// Deprecated endpoint stub: Matching system has been removed from the codebase.
// This route remains only to avoid breaking existing clients during rollout.
// Returns 410 Gone with an empty data set to indicate deprecation.

export async function GET(request: Request) {
  try {
    // Maintain standardized pattern for dynamic routes
    // to ensure params/body can be consumed safely in Next.js runtimes.
    await request.blob().catch(() => undefined)
  } catch {}

  return NextResponse.json(
    {
      success: false,
      message: 'This endpoint has been removed. The matching feature is deprecated.',
      data: [],
    },
    { status: 410 }
  )
}
