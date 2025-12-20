import { logAuditEvent } from '@/lib/audit-log';
import { connect } from '@/lib/mongodb';
import AuditLog from '@/models/AuditLog';

jest.mock('@/lib/mongodb', () => ({
  connect: jest.fn(),
}));

jest.mock('@/models/AuditLog', () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
  },
}));

const mockConnect = connect as jest.Mock;

describe('logAuditEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('logs to console and does not write to MongoDB in test environment', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    logAuditEvent({
      eventType: 'LOGIN_SUCCESS',
      phone: '+27821234567',
      metadata: { role: 'admin' },
    });

    expect(logSpy).toHaveBeenCalled();
    expect(mockConnect).not.toHaveBeenCalled();
    expect((AuditLog as any).create).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });
});
