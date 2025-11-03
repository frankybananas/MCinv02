/**
 * Tests for Dashboard mobile view - compact list view with word-wrapped model names
 */
import { render, screen, fireEvent } from '@testing-library/react'
import { Dashboard } from '@/app/components/dashboard'
import type { Car, Client, DashboardTab, Delivery, NotificationItem } from '@/app/types'

// Mock scroll-area component
jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: any) => (
    <div className={className} data-testid="scroll-area">
      {children}
    </div>
  ),
}))

// Mock main-menu component
jest.mock('@/app/components/main-menu', () => ({
  MainMenu: () => <div data-testid="main-menu">Main Menu</div>,
}))

// Mock marketing component
jest.mock('@/app/components/marketing', () => ({
  Marketing: () => <div data-testid="marketing">Marketing</div>,
}))

// Mock todo component
jest.mock('@/app/components/todo', () => ({
  Todo: () => <div data-testid="todo">Todo</div>,
}))

describe('Dashboard Mobile View - Compact List', () => {
  const mockCars: Car[] = [
    {
      _id: '1',
      year: 2020,
      make: 'Toyota',
      model: 'Very Long Model Name That Would Normally Get Cut Off',
      price: 300000,
      status: 'in-stock',
      kilometers: 50000,
      color: 'White',
      transmission: 'automatic',
      images: [{ imageUrl: '/car1.jpg', title: 'Car 1', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
      vin: 'VIN123',
      notes: '',
      createdAt: new Date().toISOString(),
      auditLog: [],
    },
    {
      _id: '2',
      year: 2021,
      make: 'Mercedes-Benz',
      model: 'GLC250d 4MATIC AMG Line Premium Plus Extra Long Name',
      price: 750000,
      status: 'reserved',
      kilometers: 30000,
      color: 'Silver',
      transmission: 'automatic',
      images: [{ imageUrl: '/car2.jpg', title: 'Car 2', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
      vin: 'VIN456',
      notes: '',
      createdAt: new Date().toISOString(),
      auditLog: [],
    },
  ]

  const mockClients: Client[] = [
    {
      _id: 'c1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      phone: '+27821234567',
      createdByPhone: '+27821234567',
      active: true,
    },
  ]

  const mockDeliveries: Delivery[] = [
    {
      _id: 'd1',
      car: mockCars[1],
      salesperson: 'user1',
      status: 'active',
      customerType: 'natural',
      docs: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]

  const mockNotifications: NotificationItem[] = [
    {
      _id: 'n1',
      title: 'New Car Added',
      description: 'A new car has been added to the inventory',
      type: 'car_new',
      createdAt: new Date().toISOString(),
      read: false,
    },
  ]

  const defaultProps = {
    cars: mockCars,
    clients: mockClients,
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
    deliveries: mockDeliveries,
    onDeliverySelect: jest.fn(),
    notifications: mockNotifications,
    onNotificationSelect: jest.fn(),
    _onNotificationDone: jest.fn(),
    unreadNotificationsCount: 1,
    todoEnabled: false,
    marketingEnabled: false,
    _onMarkAllNotificationsRead: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('View Mode Behavior', () => {
    it('should default to list view on mount', () => {
      render(<Dashboard {...defaultProps} />)
      
      // List view items should be visible
      const carRows = screen.getAllByTestId('dashboard-car-row')
      expect(carRows).toHaveLength(2)
    })

    it('should not show view toggle buttons', () => {
      render(<Dashboard {...defaultProps} />)
      
      // View toggle buttons should not exist
      const cardButton = screen.queryByTestId('view-toggle-card')
      const listButton = screen.queryByTestId('view-toggle-list')
      
      expect(cardButton).not.toBeInTheDocument()
      expect(listButton).not.toBeInTheDocument()
    })

    it('should maintain list view across tab changes', () => {
      const { rerender } = render(<Dashboard {...defaultProps} activeStatus="all" />)
      
      // Verify list view for cars
      expect(screen.getAllByTestId('dashboard-car-row')).toHaveLength(2)

      // Switch to clients
      rerender(<Dashboard {...defaultProps} activeStatus="clients" />)
      
      // Verify list view for clients
      const clientRows = screen.getAllByTestId('client-row')
      expect(clientRows).toHaveLength(1)
    })

    it('should show list view for deliveries', () => {
      render(<Dashboard {...defaultProps} activeStatus="delivery" />)
      
      const deliveryRows = screen.getAllByTestId('delivery-row')
      expect(deliveryRows).toHaveLength(1)
    })

    it('should show list view for notifications', () => {
      render(<Dashboard {...defaultProps} activeStatus="notifications" />)
      
      const notificationRows = screen.getAllByTestId('notification-row')
      expect(notificationRows).toHaveLength(1)
    })
  })

  describe('Word Wrap for Long Model Names', () => {
    it('should use break-words class instead of truncate for car model names', () => {
      const { container } = render(<Dashboard {...defaultProps} />)
      
      // Find the h3 element containing car model
      const modelHeaders = container.querySelectorAll('h3.break-words')
      expect(modelHeaders.length).toBeGreaterThan(0)
      
      // Verify truncate class is not present
      const truncatedHeaders = container.querySelectorAll('h3.truncate')
      expect(truncatedHeaders.length).toBe(0)
    })

    it('should display full car model name with word wrapping', () => {
      render(<Dashboard {...defaultProps} />)
      
      // Check both long model names are fully displayed
      expect(screen.getByText(/Very Long Model Name That Would Normally Get Cut Off/)).toBeInTheDocument()
      expect(screen.getByText(/GLC250d 4MATIC AMG Line Premium Plus Extra Long Name/)).toBeInTheDocument()
    })

    it('should apply overflow-wrap-anywhere class for proper wrapping', () => {
      const { container } = render(<Dashboard {...defaultProps} />)
      
      const modelHeaders = container.querySelectorAll('h3.overflow-wrap-anywhere')
      expect(modelHeaders.length).toBeGreaterThan(0)
    })

    it('should maintain leading-tight class for better line spacing', () => {
      const { container } = render(<Dashboard {...defaultProps} />)
      
      const modelHeaders = container.querySelectorAll('h3.leading-tight')
      expect(modelHeaders.length).toBeGreaterThan(0)
    })
  })

  describe('Car List Layout', () => {
    it('should render car image with correct dimensions', () => {
      render(<Dashboard {...defaultProps} />)
      
      const images = screen.getAllByAltText(/Toyota|Mercedes-Benz/)
      expect(images[0]).toHaveClass('w-16', 'h-12', 'object-cover', 'rounded', 'flex-shrink-0')
    })

    it('should display car details: kilometers, color, transmission', () => {
      render(<Dashboard {...defaultProps} />)
      
      // Check for kilometers with flexible formatting (handles different locale separators)
      expect(screen.getByText(/50[,\s]000 km/)).toBeInTheDocument()
      expect(screen.getByText('White')).toBeInTheDocument()
      const automaticElements = screen.getAllByText('automatic')
      expect(automaticElements.length).toBeGreaterThanOrEqual(1)
    })

    it('should display formatted price', () => {
      const { container } = render(<Dashboard {...defaultProps} />)
      
      // Check for price elements containing the formatted amounts
      const priceElements = container.querySelectorAll('.text-orange-500')
      expect(priceElements.length).toBeGreaterThanOrEqual(2)
      
      // Verify prices are displayed
      const priceText = Array.from(priceElements).map(el => el.textContent)
      const hasPrice1 = priceText.some(text => text?.includes('300') && text?.includes('000'))
      const hasPrice2 = priceText.some(text => text?.includes('750') && text?.includes('000'))
      
      expect(hasPrice1).toBe(true)
      expect(hasPrice2).toBe(true)
    })

    it('should show status badge for each car', () => {
      render(<Dashboard {...defaultProps} />)
      
      const inStockBadges = screen.getAllByText('In-Stock')
      const reservedBadges = screen.getAllByText('Reserved')
      
      expect(inStockBadges.length).toBeGreaterThan(0)
      expect(reservedBadges.length).toBeGreaterThan(0)
    })

    it('should handle car click events', () => {
      render(<Dashboard {...defaultProps} />)
      
      const carRows = screen.getAllByTestId('dashboard-car-row')
      fireEvent.click(carRows[0])
      
      expect(defaultProps.onCarSelect).toHaveBeenCalledWith(mockCars[0])
    })
  })

  describe('Sort Functionality', () => {
    it('should show sort button', () => {
      render(<Dashboard {...defaultProps} />)
      
      const sortButton = screen.getByText(/Sort: Recent/)
      expect(sortButton).toBeInTheDocument()
    })

    it('should display sort direction indicator', () => {
      render(<Dashboard {...defaultProps} />)
      
      const sortButton = screen.getByText(/Sort: Recent/)
      expect(sortButton.textContent).toContain('↓')
    })
  })

  describe('Empty States', () => {
    it('should show empty state when no cars available', () => {
      render(<Dashboard {...defaultProps} cars={[]} />)
      
      expect(screen.getByText('No cars found in this category')).toBeInTheDocument()
    })

    it('should show empty state when no clients available', () => {
      render(<Dashboard {...defaultProps} activeStatus="clients" clients={[]} />)
      
      expect(screen.getByText('No clients found')).toBeInTheDocument()
    })

    it('should show empty state when no deliveries available', () => {
      render(<Dashboard {...defaultProps} activeStatus="delivery" deliveries={[]} />)
      
      expect(screen.getByText('No deliveries found')).toBeInTheDocument()
    })

    it('should show empty state when no notifications available', () => {
      render(<Dashboard {...defaultProps} activeStatus="notifications" notifications={[]} />)
      
      expect(screen.getByText('No notifications')).toBeInTheDocument()
    })
  })

  describe('Responsive Layout', () => {
    it('should apply proper padding for mobile devices', () => {
      const { container } = render(<Dashboard {...defaultProps} />)
      
      const mainContent = container.querySelector('.px-3')
      expect(mainContent).toBeInTheDocument()
    })

    it('should use full width with min-w-0 for overflow prevention', () => {
      const { container } = render(<Dashboard {...defaultProps} />)
      
      const sections = container.querySelectorAll('.min-w-0')
      expect(sections.length).toBeGreaterThan(0)
    })

    it('should apply max-w-full to prevent horizontal overflow', () => {
      const { container } = render(<Dashboard {...defaultProps} />)
      
      const elements = container.querySelectorAll('.max-w-full')
      expect(elements.length).toBeGreaterThan(0)
    })
  })

  describe('Client List in List View', () => {
    it('should render client rows in list view', () => {
      render(<Dashboard {...defaultProps} activeStatus="clients" />)
      
      const clientRows = screen.getAllByTestId('client-row')
      expect(clientRows).toHaveLength(1)
    })

    it('should display client name and contact info', () => {
      render(<Dashboard {...defaultProps} activeStatus="clients" />)
      
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('john@example.com')).toBeInTheDocument()
      expect(screen.getByText('+27821234567')).toBeInTheDocument()
    })

    it('should handle client click events', () => {
      render(<Dashboard {...defaultProps} activeStatus="clients" />)
      
      const clientRow = screen.getByTestId('client-row')
      fireEvent.click(clientRow)
      
      expect(defaultProps.onClientSelect).toHaveBeenCalledWith(mockClients[0])
    })
  })

  describe('Delivery List in List View', () => {
    it('should render delivery rows in list view', () => {
      render(<Dashboard {...defaultProps} activeStatus="delivery" />)
      
      const deliveryRows = screen.getAllByTestId('delivery-row')
      expect(deliveryRows).toHaveLength(1)
    })

    it('should display delivery vehicle information', () => {
      render(<Dashboard {...defaultProps} activeStatus="delivery" />)
      
      expect(screen.getByText(/2021 Mercedes-Benz/)).toBeInTheDocument()
    })

    it('should handle delivery click events', () => {
      render(<Dashboard {...defaultProps} activeStatus="delivery" />)
      
      const deliveryRow = screen.getByTestId('delivery-row')
      fireEvent.click(deliveryRow)
      
      expect(defaultProps.onDeliverySelect).toHaveBeenCalledWith(mockDeliveries[0])
    })
  })

  describe('Notification List in List View', () => {
    it('should render notification rows in list view', () => {
      render(<Dashboard {...defaultProps} activeStatus="notifications" />)
      
      const notificationRows = screen.getAllByTestId('notification-row')
      expect(notificationRows).toHaveLength(1)
    })

    it('should display notification title and description', () => {
      render(<Dashboard {...defaultProps} activeStatus="notifications" />)
      
      expect(screen.getByText('New Car Added')).toBeInTheDocument()
      expect(screen.getByText('A new car has been added to the inventory')).toBeInTheDocument()
    })

    it('should handle notification click events', () => {
      render(<Dashboard {...defaultProps} activeStatus="notifications" />)
      
      const notificationRow = screen.getByTestId('notification-row')
      fireEvent.click(notificationRow)
      
      expect(defaultProps.onNotificationSelect).toHaveBeenCalledWith(mockNotifications[0])
    })
  })

  describe('Multiple Cars with Different Model Lengths', () => {
    const carsWithVariousNameLengths: Car[] = [
      { ...mockCars[0], model: 'Short' },
      { ...mockCars[0], _id: '3', model: 'Medium Length Model Name' },
      { ...mockCars[0], _id: '4', model: 'Very Long Model Name That Would Definitely Get Cut Off Without Word Wrap' },
    ]

    it('should handle short model names without issues', () => {
      render(<Dashboard {...defaultProps} cars={[carsWithVariousNameLengths[0]]} />)
      
      expect(screen.getByText(/Short/)).toBeInTheDocument()
    })

    it('should handle medium length model names', () => {
      render(<Dashboard {...defaultProps} cars={[carsWithVariousNameLengths[1]]} />)
      
      expect(screen.getByText(/Medium Length Model Name/)).toBeInTheDocument()
    })

    it('should handle very long model names with word wrap', () => {
      render(<Dashboard {...defaultProps} cars={[carsWithVariousNameLengths[2]]} />)
      
      expect(screen.getByText(/Very Long Model Name That Would Definitely Get Cut Off Without Word Wrap/)).toBeInTheDocument()
    })

    it('should render all cars with different name lengths', () => {
      render(<Dashboard {...defaultProps} cars={carsWithVariousNameLengths} />)
      
      const carRows = screen.getAllByTestId('dashboard-car-row')
      expect(carRows).toHaveLength(3)
    })
  })

  describe('FAB and Main Menu', () => {
    it('should render main menu component', () => {
      render(<Dashboard {...defaultProps} />)
      
      expect(screen.getByTestId('main-menu')).toBeInTheDocument()
    })

    it('should show FAB when not on todo tab', () => {
      const { container } = render(<Dashboard {...defaultProps} activeStatus="all" />)
      
      // FAB should be visible (look for Plus button)
      const fabContainer = container.querySelector('.fixed.right-4.bottom-\\[calc\\(7\\.25rem\\+env\\(safe-area-inset-bottom\\)\\)\\]')
      expect(fabContainer).toBeInTheDocument()
    })

    it('should hide FAB when on todo tab', () => {
      render(<Dashboard {...defaultProps} activeStatus="todo" todoEnabled />)
      
      // FAB container should not be rendered when showTodo is true
      const fab = screen.queryByRole('button', { name: /add/i })
      expect(fab).not.toBeInTheDocument()
    })
  })
})
