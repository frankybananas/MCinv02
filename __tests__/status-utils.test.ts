import { getStatusColor, STATUS_OPTIONS, formatStatusLabel } from '@/app/components/status-utils';

describe('status-utils', () => {
  test('STATUS_OPTIONS order and values', () => {
    expect(STATUS_OPTIONS).toEqual(['in-stock', 'coming', 'reserved', 'sold']);
  });

  test('formatStatusLabel formats correctly', () => {
    expect(formatStatusLabel('in-stock')).toBe('In stock');
    expect(formatStatusLabel('coming')).toBe('Coming');
    expect(formatStatusLabel('reserved')).toBe('Reserved');
    expect(formatStatusLabel('sold')).toBe('Sold');
  });

  test('getStatusColor returns consistent classes', () => {
    expect(getStatusColor('in-stock')).toContain('green');
    expect(getStatusColor('coming')).toContain('blue');
    expect(getStatusColor('reserved')).toContain('yellow');
    expect(getStatusColor('sold')).toContain('gray');
  });
});
