import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import HeaderBar from '@/app/components/header-bar';

const originalFetch = global.fetch;

describe('HeaderBar', () => {
  afterEach(() => {
    (global.fetch as any) = originalFetch;
    jest.clearAllMocks();
  });

  it('hides Profile when unauthenticated', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Unauthenticated' }) });
    render(<HeaderBar />);
    // Give useEffect a tick
    await waitFor(() => {
      expect(screen.queryByText(/Profile/i)).toBeNull();
    });
  });

  it('shows Profile when authenticated', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => ({ data: { firstName: 'Admin', lastName: 'User', phone: '+100', email: 'a@b.com' } }) });
    render(<HeaderBar />);
    await waitFor(() => {
      expect(screen.getByText(/Admin User|Profile/i)).toBeInTheDocument();
    });
  });
});
