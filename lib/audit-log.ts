export interface AuditEventData {
  eventType: string;
  phone?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

export function logAuditEvent(data: AuditEventData): void {
  try {
    const timestamp = new Date().toISOString();

    const logEntry = {
      type: 'AUDIT_EVENT',
      timestamp,
      ...data,
    };

    console.log(JSON.stringify(logEntry));

    if (process.env.NODE_ENV === 'test') {
      return;
    }

    setTimeout(async () => {
      try {
        const { connect } = await import('@/lib/mongodb');
        const AuditLog = (await import('@/models/AuditLog')).default;

        await connect();

        await AuditLog.create({
          eventType: data.eventType,
          phone: data.phone,
          userId: data.userId,
          ip: data.ip,
          userAgent: data.userAgent,
          metadata: data.metadata,
        });
      } catch (error) {
        console.error('[AuditLog] Failed to persist audit event:', error);
      }
    }, 0);
  } catch (error) {
    console.error('[AuditLog] Unexpected error in logAuditEvent:', error);
  }
}
