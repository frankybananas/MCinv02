export function getDeviceType(userAgent: string | null | undefined): 'mobile' | 'desktop' {
  const ua = userAgent || '';
  return /android|iphone|ipad|mobile/i.test(ua) ? 'mobile' : 'desktop';
}
