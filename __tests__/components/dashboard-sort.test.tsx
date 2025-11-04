import React from 'react'
import { render, screen } from '@testing-library/react'
import { Dashboard } from '@/app/components/dashboard'
import type { Car, Client, DashboardTab } from '@/app/types'

// Mock the UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, className, variant, size, ...props }: any) => (
    <button onClick={onClick} className={className} data-variant={variant} data-size={size} {...props}>
      {children}
    </button>
  ),
}))

jest.mock('@/components/ui/card', () => ({
  Card: ({ children, className, onClick, ...props }: any) => (
    <div className={className} onClick={onClick} {...props}>{children}</div>
  ),
  CardContent: ({ children, className, ...props }: any) => (
    <div className={className} {...props}>{children}</div>
  ),
}))

jest.mock('@/components/ui/badge', () => ({
  Badge: ({ children, className, ...props }: any) => (
    <span className={className} {...props}>{children}</span>
  ),
}))

jest.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className }: any) => <div className={className}>{children}</div>,
}))

jest.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div data-testid="dropdown-trigger">{children}</div>,
  DropdownMenuContent: ({ children, align, className }: any) => (
    <div data-testid="dropdown-content" data-align={align} className={className}>{children}</div>
  ),
  DropdownMenuItem: ({ children, onClick, ...props }: any) => (
    <div onClick={onClick} data-testid="dropdown-item" {...props}>{children}</div>
  ),
  DropdownMenuLabel: ({ children }: any) => <div data-testid="dropdown-label">{children}</div>,
  DropdownMenuSeparator: () => <div data-testid="dropdown-separator" />,
  DropdownMenuRadioGroup: ({ children, value, onValueChange }: any) => (
    <div data-testid="dropdown-radio-group" data-value={value} onClick={(e: any) => {
      const target = e.target as HTMLElement
      const value = target.getAttribute('data-value')
      if (value && onValueChange) onValueChange(value)
    }}>
      {children}
    </div>
  ),
  DropdownMenuRadioItem: ({ children, value, ...props }: any) => (
    <div data-testid="dropdown-radio-item" data-value={value} {...props}>{children}</div>
  ),
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

jest.mock('@/app/components/marketing', () => ({
  Marketing: () => <div data-testid="marketing-component">Marketing Component</div>,
}))

const mockCars: Car[] = [
  {
    _id: '1',
    year: 2020,
    make: 'Toyota',
    model: 'Corolla',
    price: 200000,
    kilometers: 50000,
    color: 'White',
    transmission: 'automatic',
    status: 'in-stock',
    images: [{ imageUrl: '/car1.jpg' }],
    createdAt: '2024-01-01T00:00:00Z',
  } as Car,
  {
    _id: '2',
    year: 2022,
    make: 'Honda',
    model: 'Civic',
    price: 300000,
    kilometers: 30000,
    color: 'Black',
    transmission: 'manual',
    status: 'in-stock',
    images: [{ imageUrl: '/car2.jpg' }],
    createdAt: '2024-02-01T00:00:00Z',
  } as Car,
  {
    _id: '3',
    year: 2019,
    make: 'BMW',
    model: '3 Series',
    price: 400000,
    kilometers: 70000,
    color: 'Blue',
    transmission: 'automatic',
    status: 'in-stock',
    images: [{ imageUrl: '/car3.jpg' }],
    createdAt: '2024-03-01T00:00:00Z',
  } as Car,
]

const mockClients: Client[] = []

describe('Dashboard Sort Feature', () => {
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
    deliveries: [],
    notifications: [],
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render sort dropdown without redundant wrapper', () => {
    const { container } = render(<Dashboard {...defaultProps} />)
    
    // Check that the sort button exists
    const sortButton = screen.getByText(/Sort: Recent/i)
    expect(sortButton).toBeInTheDocument()
    
    // Verify no redundant wrapper with specific classes
    const redundantWrapper = container.querySelector('.bg-white\\/80.backdrop-blur-md.rounded-md.px-2.py-1.border.border-gray-200\\/50')
    expect(redundantWrapper).toBeNull()
  })

  it('should render sort button with correct default label', () => {
    render(<Dashboard {...defaultProps} />)
    
    const sortButton = screen.getByText(/Sort: Recent/i)
    expect(sortButton).toBeInTheDocument()
  })

  it('should display sort direction indicator', () => {
    render(<Dashboard {...defaultProps} />)
    
    // Default is descending for 'recent'
    const sortButton = screen.getByText(/Sort: Recent/i)
    expect(sortButton.textContent).toContain('↓')
  })

  it('should render dropdown menu structure', () => {
    render(<Dashboard {...defaultProps} />)
    
    expect(screen.getByTestId('dropdown-menu')).toBeInTheDocument()
    expect(screen.getByTestId('dropdown-trigger')).toBeInTheDocument()
    expect(screen.getByTestId('dropdown-content')).toBeInTheDocument()
  })

  it('should render all sort options', () => {
    render(<Dashboard {...defaultProps} />)
    
    expect(screen.getByText('Recent')).toBeInTheDocument()
    expect(screen.getByText('Price')).toBeInTheDocument()
    expect(screen.getByText('Year')).toBeInTheDocument()
    expect(screen.getByText('Mileage')).toBeInTheDocument()
    expect(screen.getByText('Model')).toBeInTheDocument()
  })

  it('should render direction toggle option', () => {
    render(<Dashboard {...defaultProps} />)
    
    expect(screen.getByText('Direction')).toBeInTheDocument()
    expect(screen.getByText('Descending')).toBeInTheDocument()
  })

  it('should sort cars by recent (default)', () => {
    render(<Dashboard {...defaultProps} />)
    
    const carRows = screen.getAllByTestId('dashboard-car-row')
    expect(carRows).toHaveLength(3)
    
    // Most recent first (descending by createdAt)
    expect(carRows[0]).toHaveTextContent('BMW 3 Series')
    expect(carRows[1]).toHaveTextContent('Honda Civic')
    expect(carRows[2]).toHaveTextContent('Toyota Corolla')
  })

  it('should have correct button styling without redundant classes', () => {
    const { container } = render(<Dashboard {...defaultProps} />)
    
    const sortButton = container.querySelector('button[data-variant="secondary"]')
    expect(sortButton).toBeInTheDocument()
    expect(sortButton?.className).toContain('h-8')
    expect(sortButton?.className).toContain('rounded-md')
    expect(sortButton?.className).toContain('px-3')
    expect(sortButton?.className).toContain('shrink-0')
    
    // Should NOT have redundant backdrop-blur styling
    expect(sortButton?.className).not.toContain('bg-white/70')
    expect(sortButton?.className).not.toContain('border-gray-200/50')
  })

  it('should only show sort when on stock status tabs', () => {
    const { rerender } = render(<Dashboard {...defaultProps} activeStatus="clients" />)
    
    expect(screen.queryByText(/Sort:/i)).not.toBeInTheDocument()
    
    rerender(<Dashboard {...defaultProps} activeStatus="in-stock" />)
    expect(screen.getByText(/Sort: Recent/i)).toBeInTheDocument()
  })

  it('should render sort button without wrapper container', () => {
    const { container } = render(<Dashboard {...defaultProps} />)
    
    // Sort button should exist without the old wrapper div
    const sortButton = screen.getByText(/Sort: Recent/i)
    expect(sortButton).toBeInTheDocument()
    
    // Should have mb-2 class directly on the button
    expect(sortButton.className).toContain('mb-2')
    
    // Dropdown menu should be present
    const dropdownMenu = container.querySelector('[data-testid="dropdown-menu"]')
    expect(dropdownMenu).toBeInTheDocument()
  })

  it('should handle empty cars array', () => {
    render(<Dashboard {...defaultProps} cars={[]} />)
    
    expect(screen.getByText('No cars found in this category')).toBeInTheDocument()
    expect(screen.queryByText(/Sort:/i)).not.toBeInTheDocument()
  })

  it('should render dropdown content with correct alignment', () => {
    render(<Dashboard {...defaultProps} />)
    
    const dropdownContent = screen.getByTestId('dropdown-content')
    expect(dropdownContent).toHaveAttribute('data-align', 'end')
    expect(dropdownContent.className).toContain('w-44')
  })

  it('should render radio group for sort options', () => {
    render(<Dashboard {...defaultProps} />)
    
    const radioGroup = screen.getByTestId('dropdown-radio-group')
    expect(radioGroup).toBeInTheDocument()
  })

  it('should render all radio items', () => {
    render(<Dashboard {...defaultProps} />)
    
    const radioItems = screen.getAllByTestId('dropdown-radio-item')
    expect(radioItems).toHaveLength(5) // recent, price, year, mileage, model
  })

  it('should have separators in dropdown', () => {
    render(<Dashboard {...defaultProps} />)
    
    const separators = screen.getAllByTestId('dropdown-separator')
    expect(separators.length).toBeGreaterThan(0)
  })

  it('should render dropdown label', () => {
    render(<Dashboard {...defaultProps} />)
    
    const label = screen.getByTestId('dropdown-label')
    expect(label).toHaveTextContent('Sort by')
  })

  it('should display correct price formatting', () => {
    const { container } = render(<Dashboard {...defaultProps} />)
    
    // Check that prices are formatted as ZAR currency
    const priceElements = container.querySelectorAll('.text-orange-500')
    expect(priceElements.length).toBeGreaterThan(0)
    
    // Verify all three prices are present in the document
    const bodyText = container.textContent || ''
    expect(bodyText).toContain('200')
    expect(bodyText).toContain('300')
    expect(bodyText).toContain('400')
  })

  it('should display car details correctly', () => {
    render(<Dashboard {...defaultProps} />)
    
    expect(screen.getByText('2020 Toyota Corolla')).toBeInTheDocument()
    expect(screen.getByText('2022 Honda Civic')).toBeInTheDocument()
    expect(screen.getByText('2019 BMW 3 Series')).toBeInTheDocument()
  })

  it('should render car images', () => {
    const { container } = render(<Dashboard {...defaultProps} />)
    
    const images = container.querySelectorAll('img')
    expect(images.length).toBeGreaterThan(0)
    
    // Check that at least one of the car images is rendered
    const imageSrcs = Array.from(images).map(img => img.getAttribute('src'))
    expect(imageSrcs).toContain('/car1.jpg')
  })

  it('should apply correct status badge styling', () => {
    render(<Dashboard {...defaultProps} />)
    
    const badges = screen.getAllByText('in-stock')
    expect(badges.length).toBeGreaterThan(0)
  })

  it('should render in list view mode by default', () => {
    const { container } = render(<Dashboard {...defaultProps} />)
    
    const listContainer = container.querySelector('.flex.flex-col.divide-y')
    expect(listContainer).toBeInTheDocument()
  })
})
