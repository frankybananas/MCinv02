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
import ReconPageShell from '@/app/recon/recon-page-shell';
import type { Delivery } from '@/app/types';

// Mock fetch
const originalFetch = global.fetch;

describe('Recon component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets due date via quick buttons and can clear it', async () => {
    const deliveries = sampleDeliveries();
    const todayIso = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).toISOString().slice(0,10);

    const afterToday = JSON.parse(JSON.stringify(deliveries));
    (afterToday[0] as any).reconTasks[0].dueDate = todayIso;

    const afterClear = JSON.parse(JSON.stringify(afterToday));
    delete (afterClear[0] as any).reconTasks[0].dueDate;

    global.fetch = jest.fn()
      // Initial GET
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: deliveries }) })
      // PUT Today
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: afterToday[0] }) })
      // PUT Clear
      .mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: afterClear[0] }) });

    render(<Recon />);

    await waitFor(() => expect(screen.getByTestId('recon-card')).toBeInTheDocument());

    // Click first Today quick-set
    const todayButtons = screen.getAllByText('Today');
    fireEvent.click(todayButtons[0]);

    await waitFor(() => {
      const secondCall = (global.fetch as jest.Mock).mock.calls[1];
      expect(secondCall[0]).toContain('/api/deliveries/d1');
      const body = JSON.parse(secondCall[1].body);
      expect(body.reconTasks[0].dueDate).toBe(todayIso);
    });

    // Clear (task-level)
    const clearButtons = await screen.findAllByText('Clear');
    fireEvent.click(clearButtons[0]);

    await waitFor(() => {
      const thirdCall = (global.fetch as jest.Mock).mock.calls[2];
      expect(thirdCall[0]).toContain('/api/deliveries/d1');
      const body = JSON.parse(thirdCall[1].body);
      expect(body.reconTasks[0].dueDate).toBe('');
    });
  });

  it('opens attachment viewer and closes it', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: sampleDeliveries() }) });

    render(<Recon />);
    await waitFor(() => expect(screen.getByTestId('recon-card')).toBeInTheDocument());

    // Click thumbnail
    const thumb = screen.getByAltText('Attachment 1');
    fireEvent.click(thumb);

    // Overlay shows close button
    await waitFor(() => expect(screen.getByText('✕')).toBeInTheDocument());
    fireEvent.click(screen.getByText('✕'));
    await waitFor(() => expect(screen.queryByText('✕')).not.toBeInTheDocument());
  });


  it('shows Clear filters when a due filter is selected', async () => {
    // Preseed localStorage to simulate an active filter
    (global as any).localStorage?.setItem?.('recon:due', 'due_today');
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, data: sampleDeliveries() }) });
    render(<Recon />);
    await waitFor(() => expect(screen.getByTestId('recon-card')).toBeInTheDocument());
    // Clear button appears
    await waitFor(() => expect(screen.getAllByText('Clear')[0]).toBeInTheDocument());
    // Clear resets filters
    fireEvent.click(screen.getAllByText('Clear')[0]);
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
          { text: 'Valet interior', done: false, attachments: [{ url: '/a1.jpg' }] as any },
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

  it('ReconPageShell renders MainMenu and keeps bottom nav visible', async () => {
    const mockNotifications = [
      { _id: 'n1', createdAt: new Date().toISOString() },
    ] as any;

    global.fetch = jest.fn(async (input: RequestInfo) => {
      const url = typeof input === 'string' ? input : input instanceof Request ? input.url : '';

      if (url.includes('/api/auth/me')) {
        return {
          ok: true,
          json: async () => ({ data: { notificationsLastSeenAt: null, role: 'recon' } }),
        } as Response;
      }

      if (url.includes('/api/notifications')) {
        return {
          ok: true,
          json: async () => ({ data: mockNotifications }),
        } as Response;
      }

      if (url.includes('/api/deliveries')) {
        return {
          ok: true,
          json: async () => ({ success: true, data: sampleDeliveries() }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({}),
      } as Response;
    }) as unknown as typeof fetch;

    render(<ReconPageShell />);

    expect(await screen.findByTestId('recon-card')).toBeInTheDocument();
    expect(screen.getByText('Recon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back to Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /primary navigation/i })).toBeInTheDocument();
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
