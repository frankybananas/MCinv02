import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Dashboard } from '@/app/components/dashboard';
import type { Car, Client, DashboardTab, Delivery, NotificationItem } from '@/app/types';

type DashboardProps = React.ComponentProps<typeof Dashboard>;

const createCar = (overrides: Partial<Car> = {}): Car => ({
  _id: 'car-1',
  images: [
    {
      _id: 'img-1',
      title: 'Front',
      imageUrl: '/car.jpg',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      description: 'Front profile',
    },
  ],
  year: 2024,
  make: 'Toyota',
  model: 'Corolla Cross',
  price: 429000,
  kilometers: 17800,
  color: 'White',
  transmission: 'automatic',
  vin: 'VIN-123',
  notes: '',
  status: 'in-stock',
  demo: false,
  createdAt: new Date().toISOString(),
  auditLog: [],
  ...overrides,
});

const createClient = (overrides: Partial<Client> = {}): Client => ({
  _id: 'client-1',
  firstName: 'Nandi',
  lastName: 'Smith',
  email: 'nandi@example.com',
  phone: '+27112223333',
  active: true,
  createdAt: new Date().toISOString(),
  ...overrides,
});

const baseProps = (overrides: Partial<DashboardProps> = {}): DashboardProps => ({
  cars: [createCar()],
  clients: [createClient()],
  activeStatus: 'all' as DashboardTab,
  onStatusFilterChange: jest.fn(),
  onCarSelect: jest.fn(),
  onAddCar: jest.fn(),
  onAddClient: jest.fn(),
  onStatusChange: jest.fn(),
  onClientSelect: jest.fn(),
  onClientDelete: jest.fn(),
  _onLogout: jest.fn(),
  userRole: 'user',
  deliveries: [] as Delivery[],
  onDeliverySelect: jest.fn(),
  notifications: [] as NotificationItem[],
  onNotificationSelect: jest.fn(),
  _onNotificationDone: jest.fn(),
  unreadNotificationsCount: 0,
  _onMarkAllNotificationsRead: jest.fn(),
  ...overrides,
});

describe('Dashboard component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders sort and view toggle controls', () => {
    render(<Dashboard {...baseProps()} />);
    expect(screen.getByRole('button', { name: /Sort:/i })).toBeInTheDocument();
    expect(screen.getByTestId('view-toggle-card')).toBeInTheDocument();
    expect(screen.getByTestId('view-toggle-list')).toBeInTheDocument();
  });

  it('does not render a dismiss overlay when menu is pinned open', () => {
    render(<Dashboard {...baseProps()} />);

    expect(screen.queryByTestId('mobile-overlay')).toBeNull();
  });

  it('sorts cars by most recent createdAt by default', () => {
    const newerCar = createCar({
      _id: 'car-new',
      make: 'Toyota',
      model: 'Corolla Cross',
      year: 2024,
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    const olderCar = createCar({
      _id: 'car-old',
      make: 'Toyota',
      model: 'Etios',
      year: 2018,
      createdAt: '2018-01-01T00:00:00.000Z',
    });

    render(
      <Dashboard
        {...baseProps({ cars: [olderCar, newerCar] })}
      />
    );

    const cards = screen.getAllByTestId('dashboard-car-card');
    expect(cards[0]).toHaveTextContent('2024');
    expect(cards[0]).toHaveTextContent('Corolla Cross');
    expect(cards[1]).toHaveTextContent('2018');
    expect(cards[1]).toHaveTextContent('Etios');
  });

  it('invokes onCarSelect when a car card is clicked', () => {
    const carClick = jest.fn();
    render(<Dashboard {...baseProps({ onCarSelect: carClick })} />);

    fireEvent.click(screen.getByTestId('dashboard-car-card'));

    expect(carClick).toHaveBeenCalledTimes(1);
    const carArg = carClick.mock.calls[0][0] as Car;
    expect(carArg._id).toBe('car-1');
  });

  it('shows the default sort button label', () => {
    render(<Dashboard {...baseProps()} />);

    expect(screen.getByRole('button', { name: /Sort: Recent/i })).toBeInTheDocument();
  });

  it('renders cards by default and can switch to list view', () => {
    render(<Dashboard {...baseProps()} />);

    // Default: card view shows car cards
    expect(screen.getAllByTestId('dashboard-car-card').length).toBeGreaterThan(0);
    // Toggle to list
    fireEvent.click(screen.getByTestId('view-toggle-list'));

    // Cards should not render, rows should
    expect(screen.queryByTestId('dashboard-car-card')).toBeNull();
    expect(screen.getAllByTestId('dashboard-car-row').length).toBeGreaterThan(0);
  });

  it('toggles back to card view from list view', () => {
    render(<Dashboard {...baseProps()} />);

    fireEvent.click(screen.getByTestId('view-toggle-list'));
    expect(screen.getAllByTestId('dashboard-car-row').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId('view-toggle-card'));
    expect(screen.getAllByTestId('dashboard-car-card').length).toBeGreaterThan(0);
    expect(screen.queryByTestId('dashboard-car-row')).toBeNull();
  });

  it('persists view mode per tab in localStorage', () => {
    // Ensure clean slate
    window.localStorage.clear();

    const { unmount } = render(<Dashboard {...baseProps({ activeStatus: 'all' })} />);
    fireEvent.click(screen.getByTestId('view-toggle-list'));
    expect(screen.getAllByTestId('dashboard-car-row').length).toBeGreaterThan(0);
    // Unmount and re-render same tab -> should still be list
    unmount();
    render(<Dashboard {...baseProps({ activeStatus: 'all' })} />);
    expect(screen.getAllByTestId('dashboard-car-row').length).toBeGreaterThan(0);

    // Switch to another tab should not inherit (fresh default)
    unmount();
    render(<Dashboard {...baseProps({ activeStatus: 'in-stock' })} />);
    // Default is card on desktop environment
    expect(screen.getAllByTestId('dashboard-car-card').length).toBeGreaterThan(0);
  });

  it('defaults to list view on small screens when no saved preference exists', () => {
    // Clear any saved preference for tab
    window.localStorage.clear();
    // Mock small screen
    // @ts-ignore
    window.innerWidth = 375;
    const { unmount } = render(<Dashboard {...baseProps({ activeStatus: 'all' })} />);
    expect(screen.getAllByTestId('dashboard-car-row').length).toBeGreaterThan(0);
    unmount();
    // restore desktop width for safety
    // @ts-ignore
    window.innerWidth = 1024;
  });
});
