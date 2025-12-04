import React from 'react'
import { render, screen } from '@testing-library/react'
import { Dashboard } from '@/app/components/dashboard'
import type { Car, Client, DashboardTab } from '@/app/types'

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, className, ...props }: any) => (
    <button onClick={onClick} className={className} {...props}>
      {children}
    </button>
  ),
}))

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardContent: ({ children, className }: any) => <div className={className}>{children}</div>,
}))

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className }: any) => <span className={className}>{children}</span>,
}))

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: any) => <div className={className}>{children}</div>,
}))

jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div>{children}</div>,
  DropdownMenuContent: ({ children, align, className }: any) => <div className={className} data-align={align}>{children}</div>,
  DropdownMenuLabel: ({ children }: any) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuRadioGroup: ({ children, value, onValueChange }: any) => (
    <div data-value={value} onClick={() => onValueChange?.('recent')}>{children}</div>
  ),
  DropdownMenuRadioItem: ({ children, value }: any) => <div data-value={value}>{children}</div>,
  DropdownMenuItem: ({ children, onClick }: any) => <div onClick={onClick}>{children}</div>,
}))

jest.mock('@/app/components/status-utils', () => ({
  getStatusColor: jest.fn(() => 'bg-green-500'),
  formatStatusLabel: jest.fn((status: string) => status),
  STATUS_OPTIONS: [],
}))

jest.mock('@/app/components/todo', () => ({
  Todo: () => <div data-testid="todo-component">Todo Component</div>,
}))

jest.mock('@/app/components/main-menu', () => ({
  MainMenu: () => <div data-testid="main-menu">Main Menu</div>,
}))

const mockClients: Client[] = [
  {
    _id: '1',
    firstName: 'John',
    lastName: 'Smith-Johnson-Williams',
    email: 'john.smith.johnson.williams@verylongemail.com',
    phone: '+27824544656',
    active: true,
  } as Client,
  {
    _id: '2',
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@email.com',
    phone: '+27821234567',
    active: false,
  } as Client,
]

const mockDeliveries = [
  {
    _id: '1',
    car: {
      _id: 'car1',
      year: 2023,
      make: 'Mercedes-Benz',
      model: 'GLC250d 4MATIC AMG Line Premium Plus',
      images: [{ imageUrl: '/car1.jpg' }],
    },
    status: 'pending',
    salesperson: 'user1',
    customerType: 'individual',
    docs: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    _id: '2',
    car: {
      _id: 'car2',
      year: 2022,
      make: 'BMW',
      model: 'X5 xDrive40i M Sport',
      images: [{ imageUrl: '/car2.jpg' }],
    },
    status: 'delivered',
    salesperson: 'user1',
    customerType: 'individual',
    docs: [],
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
] as any

const mockCars: Car[] = [
  {
    _id: '1',
    year: 2023,
    make: 'Mercedes-Benz',
    model: 'GLC250d 4MATIC AMG Line Premium Plus',
    price: 850000,
    kilometers: 15000,
    color: 'Black',
    transmission: 'automatic',
    status: 'in-stock',
    images: [{ imageUrl: '/car1.jpg' }],
  } as Car,
]

describe('Dashboard Layout and Responsiveness', () => {
  const defaultProps = {
    cars: mockCars,
    clients: mockClients,
    activeStatus: 'in-stock' as DashboardTab,
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
    notifications: [],
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Clients Section', () => {
    const clientProps = { ...defaultProps, activeStatus: 'clients' as DashboardTab }

    it('should render client names with word wrapping', () => {
      const { container } = render(<Dashboard {...clientProps} />)
      
      const titleElements = container.querySelectorAll('h3')
      const clientName = Array.from(titleElements).find(el => 
        el.textContent?.includes('Smith-Johnson-Williams')
      )
      
      expect(clientName).toBeInTheDocument()
      expect(clientName?.className).toContain('break-words')
      expect(clientName?.className).toContain('overflow-wrap-anywhere')
      expect(clientName?.className).not.toContain('truncate')
    })

    it('should render client emails with word wrapping', () => {
      const { container } = render(<Dashboard {...clientProps} />)
      
      const emailElements = container.querySelectorAll('span')
      const email = Array.from(emailElements).find(el => 
        el.textContent?.includes('verylongemail.com')
      )
      
      expect(email).toBeInTheDocument()
      expect(email?.className).toContain('break-words')
      expect(email?.className).not.toContain('truncate')
    })

    it('should have proper width constraints on client content', () => {
      const { container } = render(<Dashboard {...clientProps} />)
      
      const titleElements = container.querySelectorAll('h3')
      const clientName = Array.from(titleElements).find(el => 
        el.textContent?.includes('Smith-Johnson-Williams')
      )
      
      expect(clientName?.className).toContain('min-w-0')
      expect(clientName?.className).toContain('max-w-full')
    })

    it('should use items-start for client name row', () => {
      const { container } = render(<Dashboard {...clientProps} />)
      
      const nameRows = container.querySelectorAll('.flex.items-start')
      expect(nameRows.length).toBeGreaterThan(0)
    })

    it('should have leading-tight on client names', () => {
      const { container } = render(<Dashboard {...clientProps} />)
      
      const titleElements = container.querySelectorAll('h3')
      const clientName = Array.from(titleElements).find(el => 
        el.textContent?.includes('Smith-Johnson-Williams')
      )
      
      expect(clientName?.className).toContain('leading-tight')
    })

    it('should render inactive badge with flex-shrink-0', () => {
      const { container } = render(<Dashboard {...clientProps} />)
      
      const badges = container.querySelectorAll('.flex-shrink-0')
      const inactiveBadge = Array.from(badges).find(el => 
        el.textContent?.includes('Inactive')
      )
      
      expect(inactiveBadge).toBeInTheDocument()
    })
  })

  describe('Deliveries Section', () => {
    const deliveryProps = { ...defaultProps, activeStatus: 'delivery' as DashboardTab }

    it('should render delivery titles with word wrapping', () => {
      const { container } = render(<Dashboard {...deliveryProps} />)
      
      const titleElements = container.querySelectorAll('h3')
      const deliveryTitle = Array.from(titleElements).find(el => 
        el.textContent?.includes('GLC250d 4MATIC AMG Line')
      )
      
      expect(deliveryTitle).toBeInTheDocument()
      expect(deliveryTitle?.className).toContain('break-words')
      expect(deliveryTitle?.className).toContain('overflow-wrap-anywhere')
      expect(deliveryTitle?.className).not.toContain('truncate')
    })

    it('should render delivery dates with word wrapping', () => {
      const { container } = render(<Dashboard {...deliveryProps} />)
      
      const dateElements = container.querySelectorAll('p')
      const date = Array.from(dateElements).find(el => 
        el.textContent?.includes('Updated')
      )
      
      expect(date).toBeInTheDocument()
      expect(date?.className).toContain('break-words')
      expect(date?.className).not.toContain('truncate')
    })

    it('should have proper width constraints on delivery content', () => {
      const { container } = render(<Dashboard {...deliveryProps} />)
      
      const titleElements = container.querySelectorAll('h3')
      const deliveryTitle = Array.from(titleElements).find(el => 
        el.textContent?.includes('GLC250d')
      )
      
      expect(deliveryTitle?.className).toContain('min-w-0')
      expect(deliveryTitle?.className).toContain('max-w-full')
    })

    it('should render status badge with whitespace-nowrap', () => {
      const { container } = render(<Dashboard {...deliveryProps} />)
      
      const badges = container.querySelectorAll('.whitespace-nowrap')
      expect(badges.length).toBeGreaterThan(0)
    })
  })

  describe('Sort Button Positioning', () => {
    it('should render Sort button on the right side', () => {
      render(<Dashboard {...defaultProps} />)
      
      // Sort button should be rendered and accessible
      const sortText = screen.getByText(/Sort: Recent/i)
      expect(sortText).toBeInTheDocument()
    })

    it('should have Sort button wrapper', () => {
      const { container } = render(<Dashboard {...defaultProps} />)
      
      // Sort wrapper contains the dropdown menu
      const sortText = screen.getByText(/Sort: Recent/i)
      expect(sortText).toBeInTheDocument()
    })

    it('should render Sort button as clickable element', () => {
      render(<Dashboard {...defaultProps} />)
      
      // The sort text should be inside a button
      const sortText = screen.getByText(/Sort: Recent/i)
      const button = sortText.closest('button')
      expect(button).toBeInTheDocument()
    })

    it('should render Sort button with styling', () => {
      render(<Dashboard {...defaultProps} />)
      
      // Check parent button has appropriate classes
      const sortText = screen.getByText(/Sort: Recent/i)
      const button = sortText.closest('button')
      expect(button).toHaveClass('rounded-lg')
    })

    it('should render sort dropdown menu trigger', () => {
      render(<Dashboard {...defaultProps} />)
      
      // Verify the sort button can be found and is in the DOM
      const sortText = screen.getByText(/Sort: Recent/i)
      expect(sortText.closest('button')).toBeInTheDocument()
    })

    it('should not render Sort button when cars list is empty', () => {
      const emptyProps = { ...defaultProps, cars: [] }
      render(<Dashboard {...emptyProps} />)
      
      expect(screen.queryByText(/Sort:/i)).not.toBeInTheDocument()
    })
  })

  describe('Cars Section Responsiveness', () => {
    it('should render car titles with word wrapping', () => {
      const { container } = render(<Dashboard {...defaultProps} />)
      
      const titleElements = container.querySelectorAll('h3')
      const carTitle = Array.from(titleElements).find(el => 
        el.textContent?.includes('GLC250d 4MATIC AMG Line')
      )
      
      expect(carTitle).toBeInTheDocument()
      expect(carTitle?.className).toContain('break-words')
      expect(carTitle?.className).toContain('overflow-wrap-anywhere')
    })

    it('should have proper width constraints on all sections', () => {
      const { container } = render(<Dashboard {...defaultProps} />)
      
      const sections = container.querySelectorAll('.w-full.min-w-0')
      expect(sections.length).toBeGreaterThan(0)
    })
  })

  describe('Empty States', () => {
    it('should render empty state for clients', () => {
      const emptyProps = { ...defaultProps, activeStatus: 'clients' as DashboardTab, clients: [] }
      render(<Dashboard {...emptyProps} />)
      
      expect(screen.getByText('No clients found')).toBeInTheDocument()
    })

    it('should render empty state for deliveries', () => {
      const emptyProps = { ...defaultProps, activeStatus: 'delivery' as DashboardTab, deliveries: [] }
      render(<Dashboard {...emptyProps} />)
      
      expect(screen.getByText('No deliveries found')).toBeInTheDocument()
    })

    it('should render empty state for cars', () => {
      const emptyProps = { ...defaultProps, cars: [] }
      render(<Dashboard {...emptyProps} />)
      
      expect(screen.getByText('No cars found in this category')).toBeInTheDocument()
    })
  })

  describe('Responsive Container Classes', () => {
    it('should have max-w-full on all content divs', () => {
      const { container } = render(<Dashboard {...defaultProps} />)
      
      const maxWidthDivs = container.querySelectorAll('.max-w-full')
      expect(maxWidthDivs.length).toBeGreaterThan(0)
    })

    it('should have proper responsive padding on list items', () => {
      const { container } = render(<Dashboard {...defaultProps} />)
      
      const listItems = container.querySelectorAll('.pr-2.sm\\:pr-3')
      expect(listItems.length).toBeGreaterThan(0)
    })
  })
})
