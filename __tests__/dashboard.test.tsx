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
  onLogout: jest.fn(),
  userRole: null,
  deliveries: [] as Delivery[],
  onDeliverySelect: jest.fn(),
  notifications: [] as NotificationItem[],
  onNotificationSelect: jest.fn(),
  unreadNotificationsCount: 0,
  ...overrides,
});

describe('Dashboard component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the mobile bottom navigation by default', () => {
    render(<Dashboard {...baseProps()} />);

    expect(screen.getByTestId('mobile-bottom-nav')).toBeInTheDocument();
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
});
