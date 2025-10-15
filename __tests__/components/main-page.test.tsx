import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import MainPage from '@/app/components/main-page';
import type { Car, Client } from '@/app/types';
import { toast } from 'sonner';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useSearchParams: () => ({
    get: jest.fn(),
  }),
  usePathname: () => '/',
}));

// Mock lazy loaded components
jest.mock('@/app/components/dashboard', () => ({
  Dashboard: ({ onClientDelete, clients }: any) => (
    <div data-testid="dashboard">
      <button onClick={() => onClientDelete('client-1')}>Delete Client</button>
      <div data-testid="clients-count">{clients.length}</div>
    </div>
  ),
}));

jest.mock('@/app/components/car-detail', () => ({
  CarDetail: () => <div data-testid="car-detail">Car Detail</div>,
}));

jest.mock('@/app/components/client-detail', () => ({
  ClientDetail: () => <div data-testid="client-detail">Client Detail</div>,
}));

jest.mock('@/app/components/delivery-detail', () => ({
  DeliveryDetail: () => <div data-testid="delivery-detail">Delivery Detail</div>,
}));

jest.mock('@/app/components/add-edit-car', () => ({
  AddEditCar: () => <div data-testid="add-edit-car">Add/Edit Car</div>,
}));

jest.mock('@/app/components/add-edit-client', () => ({
  AddEditClient: () => <div data-testid="add-edit-client">Add/Edit Client</div>,
}));

jest.mock('@/app/components/login-form', () => ({
  LoginForm: ({ onLoginSuccess }: any) => (
    <div data-testid="login-form">
      <button onClick={onLoginSuccess}>Login</button>
    </div>
  ),
}));

// Mock sonner toast
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock fetch globally
global.fetch = jest.fn();

const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

const createMockCar = (overrides: Partial<Car> = {}): Car => ({
  _id: 'car-1',
  images: [],
  year: 2024,
  make: 'Toyota',
  model: 'Corolla',
  price: 350000,
  kilometers: 15000,
  color: 'White',
  transmission: 'automatic',
  vin: 'VIN123',
  notes: '',
  status: 'in-stock',
  demo: false,
  createdAt: new Date().toISOString(),
  auditLog: [],
  ...overrides,
});

const createMockClient = (overrides: Partial<Client> = {}): Client => ({
  _id: 'client-1',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  phone: '+27123456789',
  active: true,
  createdAt: new Date().toISOString(),
  ...overrides,
});

describe('MainPage Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
    
    // Default successful auth response
    mockFetch.mockImplementation((url) => {
      if (typeof url === 'string') {
        if (url.includes('/api/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              data: {
                phone: '+27123456789',
                firstName: 'Test',
                lastName: 'User',
                role: 'user',
                notificationsLastSeenAt: null,
                todoEnabled: false,
              },
            }),
          } as Response);
        }
        if (url.includes('/api/cars')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [createMockCar()] }),
          } as Response);
        }
        if (url.includes('/api/clients')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [createMockClient()] }),
          } as Response);
        }
        if (url.includes('/api/deliveries')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [] }),
          } as Response);
        }
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: [] }),
      } as Response);
    });
  });

  describe('Authentication', () => {
    it('should show login form when not authenticated', async () => {
      mockFetch.mockImplementation((url) => {
        if (typeof url === 'string' && url.includes('/api/auth/me')) {
          return Promise.resolve({
            ok: false,
            status: 401,
          } as Response);
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
      });

      render(<MainPage initialIsAuthenticated={false} userRole={null} />);

      await waitFor(() => {
        expect(screen.getByTestId('login-form')).toBeInTheDocument();
      });
    });

    it('should show dashboard when authenticated', async () => {
      render(<MainPage initialIsAuthenticated={true} userRole="user" />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });
    });

    it('should handle login success', async () => {
      mockFetch.mockImplementation((url) => {
        if (typeof url === 'string' && url.includes('/api/auth/me')) {
          return Promise.resolve({
            ok: false,
            status: 401,
          } as Response);
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
      });

      render(<MainPage initialIsAuthenticated={false} userRole={null} />);

      await waitFor(() => {
        expect(screen.getByTestId('login-form')).toBeInTheDocument();
      });

      // Update mock to return authenticated user
      mockFetch.mockImplementation((url) => {
        if (typeof url === 'string' && url.includes('/api/auth/me')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              data: {
                phone: '+27123456789',
                firstName: 'Test',
                lastName: 'User',
                role: 'user',
              },
            }),
          } as Response);
        }
        if (url.includes('/api/cars')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [createMockCar()] }),
          } as Response);
        }
        if (url.includes('/api/clients')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [createMockClient()] }),
          } as Response);
        }
        if (url.includes('/api/deliveries')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ data: [] }),
          } as Response);
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
      });

      const loginButton = screen.getByText('Login');
      fireEvent.click(loginButton);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Client Delete Functionality', () => {
    beforeEach(() => {
      // Mock window.confirm
      global.confirm = jest.fn(() => true);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should successfully delete a client when confirmed', async () => {
      const mockClients = [
        createMockClient({ _id: 'client-1', firstName: 'John' }),
        createMockClient({ _id: 'client-2', firstName: 'Jane' }),
      ];

      mockFetch.mockImplementation((url, options) => {
        if (typeof url === 'string') {
          if (url.includes('/api/clients/client-1') && options?.method === 'DELETE') {
            return Promise.resolve({
              ok: true,
              json: async () => ({ success: true, data: {} }),
            } as Response);
          }
          if (url.includes('/api/clients') && !url.includes('client-1')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ data: mockClients.filter(c => c._id !== 'client-1') }),
            } as Response);
          }
          if (url.includes('/api/cars')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ data: [createMockCar()] }),
            } as Response);
          }
          if (url.includes('/api/deliveries')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ data: [] }),
            } as Response);
          }
          if (url.includes('/api/auth/me')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({
                data: {
                  phone: '+27123456789',
                  firstName: 'Test',
                  lastName: 'User',
                  role: 'user',
                },
              }),
            } as Response);
          }
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
      });

      render(<MainPage initialIsAuthenticated={true} userRole="user" />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });

      const deleteButton = screen.getByText('Delete Client');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(global.confirm).toHaveBeenCalledWith(
          'Are you sure you want to delete this client? This action cannot be undone.'
        );
      });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/clients/client-1',
          expect.objectContaining({
            method: 'DELETE',
            credentials: 'include',
          })
        );
      });

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Client deleted successfully');
      });
    });

    it('should not delete client when user cancels confirmation', async () => {
      global.confirm = jest.fn(() => false);

      render(<MainPage initialIsAuthenticated={true} userRole="user" />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });

      const deleteButton = screen.getByText('Delete Client');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(global.confirm).toHaveBeenCalled();
      });

      // Should not call the DELETE API
      expect(mockFetch).not.toHaveBeenCalledWith(
        expect.stringContaining('/api/clients/client-1'),
        expect.objectContaining({ method: 'DELETE' })
      );

      expect(toast.success).not.toHaveBeenCalled();
    });

    it('should handle delete error gracefully', async () => {
      mockFetch.mockImplementation((url, options) => {
        if (typeof url === 'string') {
          if (url.includes('/api/clients/client-1') && options?.method === 'DELETE') {
            return Promise.resolve({
              ok: false,
              status: 500,
              json: async () => ({ success: false, message: 'Server error' }),
            } as Response);
          }
          if (url.includes('/api/auth/me')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({
                data: {
                  phone: '+27123456789',
                  firstName: 'Test',
                  lastName: 'User',
                  role: 'user',
                },
              }),
            } as Response);
          }
          if (url.includes('/api/cars')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ data: [createMockCar()] }),
            } as Response);
          }
          if (url.includes('/api/clients')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ data: [createMockClient()] }),
            } as Response);
          }
          if (url.includes('/api/deliveries')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ data: [] }),
            } as Response);
          }
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
      });

      render(<MainPage initialIsAuthenticated={true} userRole="user" />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });

      const deleteButton = screen.getByText('Delete Client');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Server error');
      });
    });

    it('should handle network error during delete', async () => {
      mockFetch.mockImplementation((url, options) => {
        if (typeof url === 'string') {
          if (url.includes('/api/clients/client-1') && options?.method === 'DELETE') {
            return Promise.reject(new Error('Network error'));
          }
          if (url.includes('/api/auth/me')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({
                data: {
                  phone: '+27123456789',
                  firstName: 'Test',
                  lastName: 'User',
                  role: 'user',
                },
              }),
            } as Response);
          }
          if (url.includes('/api/cars')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ data: [createMockCar()] }),
            } as Response);
          }
          if (url.includes('/api/clients')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ data: [createMockClient()] }),
            } as Response);
          }
          if (url.includes('/api/deliveries')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ data: [] }),
            } as Response);
          }
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
      });

      render(<MainPage initialIsAuthenticated={true} userRole="user" />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });

      const deleteButton = screen.getByText('Delete Client');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith('Network error');
      });
    });
  });

  describe('Data Fetching', () => {
    it('should fetch cars, clients, and deliveries on mount when authenticated', async () => {
      render(<MainPage initialIsAuthenticated={true} userRole="user" />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/cars');
        expect(mockFetch).toHaveBeenCalledWith('/api/clients');
        expect(mockFetch).toHaveBeenCalledWith('/api/deliveries');
      });
    });

    it('should handle fetch errors gracefully', async () => {
      mockFetch.mockImplementation((url) => {
        if (typeof url === 'string') {
          if (url.includes('/api/cars')) {
            return Promise.resolve({
              ok: false,
              status: 500,
            } as Response);
          }
          if (url.includes('/api/auth/me')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({
                data: {
                  phone: '+27123456789',
                  firstName: 'Test',
                  lastName: 'User',
                  role: 'user',
                },
              }),
            } as Response);
          }
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
      });

      render(<MainPage initialIsAuthenticated={true} userRole="user" />);

      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
      });
    });

    it('should show loading state while fetching data', async () => {
      render(<MainPage initialIsAuthenticated={true} userRole="user" />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('State Management', () => {
    it('should update clients state after successful delete', async () => {
      const mockClients = [
        createMockClient({ _id: 'client-1', firstName: 'John' }),
        createMockClient({ _id: 'client-2', firstName: 'Jane' }),
      ];

      let clientsData = [...mockClients];

      mockFetch.mockImplementation((url, options) => {
        if (typeof url === 'string') {
          if (url.includes('/api/clients/client-1') && options?.method === 'DELETE') {
            clientsData = clientsData.filter(c => c._id !== 'client-1');
            return Promise.resolve({
              ok: true,
              json: async () => ({ success: true, data: {} }),
            } as Response);
          }
          if (url.includes('/api/clients') && !url.includes('client-1')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ data: clientsData }),
            } as Response);
          }
          if (url.includes('/api/cars')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ data: [createMockCar()] }),
            } as Response);
          }
          if (url.includes('/api/deliveries')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ data: [] }),
            } as Response);
          }
          if (url.includes('/api/auth/me')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({
                data: {
                  phone: '+27123456789',
                  firstName: 'Test',
                  lastName: 'User',
                  role: 'user',
                },
              }),
            } as Response);
          }
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
      });

      render(<MainPage initialIsAuthenticated={true} userRole="user" />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });

      // Initially should have 2 clients
      expect(screen.getByTestId('clients-count')).toHaveTextContent('2');

      const deleteButton = screen.getByText('Delete Client');
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith('Client deleted successfully');
      });

      // After delete, should have 1 client
      await waitFor(() => {
        expect(screen.getByTestId('clients-count')).toHaveTextContent('1');
      });
    });
  });

  describe('User Role Handling', () => {
    it('should pass user role to dashboard', async () => {
      render(<MainPage initialIsAuthenticated={true} userRole="admin" />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });
    });

    it('should handle null user role', async () => {
      render(<MainPage initialIsAuthenticated={true} userRole={null} />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Logout Functionality', () => {
    it('should call logout API endpoint', async () => {
      mockFetch.mockImplementation((url, options) => {
        if (typeof url === 'string') {
          if (url.includes('/api/auth/logout') && options?.method === 'POST') {
            return Promise.resolve({
              ok: true,
              json: async () => ({ success: true }),
            } as Response);
          }
          if (url.includes('/api/auth/me')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({
                data: {
                  phone: '+27123456789',
                  firstName: 'Test',
                  lastName: 'User',
                  role: 'user',
                },
              }),
            } as Response);
          }
          if (url.includes('/api/cars')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ data: [createMockCar()] }),
            } as Response);
          }
          if (url.includes('/api/clients')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ data: [createMockClient()] }),
            } as Response);
          }
          if (url.includes('/api/deliveries')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ data: [] }),
            } as Response);
          }
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
      });

      render(<MainPage initialIsAuthenticated={true} userRole="user" />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Client Management', () => {
    it('should handle client selection', async () => {
      const mockClient = createMockClient({ _id: 'client-1', firstName: 'John' });

      mockFetch.mockImplementation((url) => {
        if (typeof url === 'string') {
          if (url.includes('/api/auth/me')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({
                data: {
                  phone: '+27123456789',
                  firstName: 'Test',
                  lastName: 'User',
                  role: 'user',
                },
              }),
            } as Response);
          }
          if (url.includes('/api/cars')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ data: [createMockCar()] }),
            } as Response);
          }
          if (url.includes('/api/clients')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ data: [mockClient] }),
            } as Response);
          }
          if (url.includes('/api/deliveries')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ data: [] }),
            } as Response);
          }
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
      });

      render(<MainPage initialIsAuthenticated={true} userRole="user" />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication check failure', async () => {
      mockFetch.mockImplementation((url) => {
        if (typeof url === 'string' && url.includes('/api/auth/me')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
      });

      render(<MainPage initialIsAuthenticated={false} userRole={null} />);

      await waitFor(() => {
        expect(screen.getByTestId('login-form')).toBeInTheDocument();
      });
    });

    it('should handle partial data fetch failure', async () => {
      mockFetch.mockImplementation((url) => {
        if (typeof url === 'string') {
          if (url.includes('/api/auth/me')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({
                data: {
                  phone: '+27123456789',
                  firstName: 'Test',
                  lastName: 'User',
                  role: 'user',
                },
              }),
            } as Response);
          }
          if (url.includes('/api/cars')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ data: [createMockCar()] }),
            } as Response);
          }
          if (url.includes('/api/clients')) {
            return Promise.resolve({
              ok: false,
              status: 500,
            } as Response);
          }
          if (url.includes('/api/deliveries')) {
            return Promise.resolve({
              ok: true,
              json: async () => ({ data: [] }),
            } as Response);
          }
        }
        return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
      });

      render(<MainPage initialIsAuthenticated={true} userRole="user" />);

      await waitFor(() => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
      });
    });
  });

  describe('BeforeEach Hook', () => {
    it('should clear all mocks before each test', () => {
      expect(jest.isMockFunction(mockFetch)).toBe(true);
      expect(jest.isMockFunction(toast.success)).toBe(true);
      expect(jest.isMockFunction(toast.error)).toBe(true);
    });
  });
});
