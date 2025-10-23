import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const src = searchParams.get('src')

    if (!src) {
      return NextResponse.json({ error: 'Missing src' }, { status: 400 })
    }

    let url: URL
    try {
      url = new URL(src)
    } catch {
      return NextResponse.json({ error: 'Invalid src' }, { status: 400 })
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return NextResponse.json({ error: 'Unsupported protocol' }, { status: 400 })
    }

    // Fetch upstream image without credentials; let it be public
    const upstream = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
      credentials: 'omit',
      // Avoid sending cookies/headers that may cause 403
      headers: {
        // Some CDNs require an Accept header
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    })

    if (!upstream.ok) {
      return NextResponse.json({ error: 'Upstream fetch failed', status: upstream.status }, { status: 502 })
    }

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
    const buf = await upstream.arrayBuffer()

    // Return as same-origin response; CORS headers are irrelevant since this is same-origin
    const res = new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=60',
        // Allow cross-origin canvas use if needed; but main value is same-origin URL
        'Access-Control-Allow-Origin': '*',
      },
    })

    return res
  } catch (err) {
    console.error('image-proxy error:', err)
    return NextResponse.json({ error: 'Proxy failed' }, { status: 500 })
  }
}
