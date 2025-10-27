/**
 * Recon Component Test Suite
 *
 * Tests loading, rendering, task toggling, empty and error states.
 * Target Coverage: 80%+
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import Recon from '@/app/components/recon';
import type { Delivery } from '@/app/types';

// Mock fetch
const originalFetch = global.fetch;

describe('Recon component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    global.fetch = originalFetch as any;
  });

  function sampleDeliveries(): Delivery[] {
    return [
      {
        _id: 'd1',
        car: {
          _id: 'car1',
          images: [{ _id: 'img1', title: 'Front', imageUrl: '/car.jpg', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
          year: 2021,
          make: 'Toyota',
          model: 'Corolla',
          price: 250000,
          kilometers: 10000,
          color: 'White',
          transmission: 'automatic',
          vin: 'VIN1',
          notes: '',
          status: 'reserved',
          createdAt: new Date().toISOString(),
          auditLog: [],
        } as any,
        salesperson: 'u1',
        client: undefined,
        status: 'active',
        deliveryDate: new Date().toISOString(),
        financeBank: '',
        reconTasks: [
          { text: 'Valet interior', done: false },
          { text: 'Touch-up paint', done: true },
        ],
        licensing: { done: false },
        customerType: 'natural',
        docs: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];
  }

  it('renders recon queue items', async () => {
    global.fetch = jest.fn()
      // Initial GET
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: sampleDeliveries() }),
      });

    render(<Recon />);

    expect(screen.getByText('Recon Queue')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('recon-card')).toBeInTheDocument();
    });
    expect(screen.getByText(/Recon 1\/2/)).toBeInTheDocument();
  });

  it('toggles a recon task checkbox and updates UI', async () => {
    const deliveries = sampleDeliveries();
    const updated = JSON.parse(JSON.stringify(deliveries));
    // Toggle first task to done
    (updated[0] as any).reconTasks[0].done = true;

    global.fetch = jest.fn()
      // Initial GET
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: deliveries }) })
      // PUT update
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: updated[0] }) });

    render(<Recon />);

    await waitFor(() => {
      expect(screen.getByTestId('recon-card')).toBeInTheDocument();
    });
    // Before toggle: 1/2
    expect(screen.getByText(/Recon 1\/2/)).toBeInTheDocument();

    const checkbox = screen.getByRole('checkbox', { name: 'toggle-task-0' });
    fireEvent.click(checkbox);

    await waitFor(() => {
      // After toggle: 2/2
      expect(screen.getByText(/Recon 2\/2/)).toBeInTheDocument();
    });

    // Ensure PUT called with correct body
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain('/api/deliveries/d1');
    const putInit = (global.fetch as jest.Mock).mock.calls[1][1];
    expect(putInit.method).toBe('PUT');
    const body = JSON.parse(putInit.body);
    expect(Array.isArray(body.reconTasks)).toBe(true);
    expect(body.reconTasks[0].done).toBe(true);
  });

  it('shows empty state', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: [] }) });

    render(<Recon />);
    await waitFor(() => {
      expect(screen.getByText('No vehicles pending recon')).toBeInTheDocument();
    });
  });

  it('shows error state', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: false });

    render(<Recon />);

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
    });
  });
});
