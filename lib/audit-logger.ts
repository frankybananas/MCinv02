import { AuthEventType } from '@/models/AuthLog';

export interface AuthEventData {
  event: AuthEventType;
  phone: string;
  userId?: string;
  ip: string;
  userAgent: string;
  deviceType?: 'mobile' | 'desktop';
  success: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an authentication event.
 * Persists to MongoDB AuthLog collection and outputs structured JSON to console.
 * 
 * @param data - The auth event data to log
 */
export async function logAuthEvent(data: AuthEventData): Promise<void> {
  const timestamp = new Date().toISOString();
  
  // Always log to console as structured JSON for log aggregation (Coolify, etc.)
  const logEntry = {
    type: 'AUTH_EVENT',
    timestamp,
    ...data,
  };
  
  // Use appropriate log level based on event type
  if (data.success) {
    console.log(JSON.stringify(logEntry));
  } else {
    console.warn(JSON.stringify(logEntry));
  }

  // Persist to database (non-blocking)
  try {
    const { connect } = await import('@/lib/mongodb');
    const AuthLog = (await import('@/models/AuthLog')).default;
    
    await connect();
    
    await AuthLog.create({
      event: data.event,
      phone: data.phone,
      userId: data.userId,
      ip: data.ip,
      userAgent: data.userAgent,
      deviceType: data.deviceType,
      success: data.success,
      reason: data.reason,
      metadata: data.metadata,
    });
  } catch (error) {
    // Don't let logging failures affect the auth flow
    console.error('[AuthLog] Failed to persist auth event:', error);
  }
}

/**
 * Extract client IP from request headers.
 * Handles proxied requests (X-Forwarded-For) common in production.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // Take the first IP if there are multiple (client's IP)
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

/**
 * Detect device type from User-Agent string.
 */
export function getDeviceType(userAgent: string): 'mobile' | 'desktop' {
  return /android|iphone|ipad|mobile/i.test(userAgent) ? 'mobile' : 'desktop';
}

/**
 * Get recent failed login attempts for a phone number.
 * Useful for security monitoring and alerting.
 */
export async function getRecentFailedAttempts(
  phone: string, 
  windowMinutes: number = 60
): Promise<number> {
  try {
    const { connect } = await import('@/lib/mongodb');
    const AuthLog = (await import('@/models/AuthLog')).default;
    
    await connect();
    
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);
    
    const count = await AuthLog.countDocuments({
      phone,
      success: false,
      event: { $in: ['login_failure', 'otp_verified'] },
      createdAt: { $gte: windowStart },
    });
    
    return count;
  } catch (error) {
    console.error('[AuthLog] Failed to get failed attempts:', error);
    return 0;
  }
}

/**
 * Check if there are suspicious patterns for a phone number.
 * Returns true if alerts should be triggered.
 */
export async function checkSuspiciousActivity(phone: string): Promise<{
  suspicious: boolean;
  reason?: string;
  failedAttempts?: number;
}> {
  const failedAttempts = await getRecentFailedAttempts(phone, 60);
  
  // Alert threshold: 5+ failed attempts in the last hour
  if (failedAttempts >= 5) {
    return {
      suspicious: true,
      reason: `${failedAttempts} failed login attempts in the last hour`,
      failedAttempts,
    };
  }
  
  return { suspicious: false };
}
