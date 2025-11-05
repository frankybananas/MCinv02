import React from 'react'
import { render, screen } from '@testing-library/react'
import { Dashboard } from '@/app/components/dashboard'
import { Marketing } from '@/app/components/marketing'
import type { Car, Client, DashboardTab, NotificationItem } from '@/app/types'

// Mock UI components
jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, className, ...props }: any) => (
    <button onClick={onClick} className={className} {...props}>
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

jest.mock('@/lib/whatsapp-generator', () => ({
  generateWhatsAppImages: jest.fn(),
}))

const mockNotifications: NotificationItem[] = [
  {
    _id: '1',
    title: 'Very Long Notification Title That Should Wrap Properly On Mobile Devices Without Being Cut Off',
    description: 'This is a very long description that should also wrap properly on mobile devices without extending past the card boundaries or being truncated inappropriately',
    type: 'car_new',
    createdAt: '2024-01-01T00:00:00Z',
    read: false,
  } as NotificationItem,
  {
    _id: '2',
    title: 'Short Title',
    description: 'Short description',
    type: 'delivery_due_soon',
    createdAt: '2024-01-02T00:00:00Z',
    read: false,
  } as NotificationItem,
]

const mockCars: Car[] = [
  {
    _id: '1',
    year: 2023,
    make: 'Mercedes-Benz',
    model: 'GLC250d 4MATIC AMG Line Premium Plus',
    price: 850000,
    kilometers: 15000,
    color: 'Obsidian Black Metallic',
    transmission: 'automatic',
    status: 'in-stock',
    images: [{ imageUrl: '/car1.jpg' }],
    doNotAdvertise: false,
  } as Car,
  {
    _id: '2',
    year: 2022,
    make: 'BMW',
    model: 'X5 xDrive40i M Sport',
    price: 1200000,
    kilometers: 25000,
    color: 'Alpine White',
    transmission: 'automatic',
    status: 'reserved',
    images: [{ imageUrl: '/car2.jpg' }],
    doNotAdvertise: false,
  } as Car,
]

describe('Notifications Responsive Layout', () => {
  const defaultProps = {
    cars: [],
    clients: [] as Client[],
    activeStatus: 'notifications' as DashboardTab,
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
    notifications: mockNotifications,
    onNotificationSelect: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render notifications without truncate class', () => {
    const { container } = render(<Dashboard {...defaultProps} />)
    
    const titleElements = container.querySelectorAll('h3')
    const notificationTitle = Array.from(titleElements).find(el => 
      el.textContent?.includes('Very Long Notification Title')
    )
    
    expect(notificationTitle).toBeInTheDocument()
    expect(notificationTitle?.className).not.toContain('truncate')
  })

  it('should use break-words for notification titles', () => {
    const { container } = render(<Dashboard {...defaultProps} />)
    
    const titleElements = container.querySelectorAll('h3')
    const notificationTitle = Array.from(titleElements).find(el => 
      el.textContent?.includes('Very Long Notification Title')
    )
    
    expect(notificationTitle?.className).toContain('break-words')
    expect(notificationTitle?.className).toContain('overflow-wrap-anywhere')
  })

  it('should render notification descriptions with word wrapping', () => {
    const { container } = render(<Dashboard {...defaultProps} />)
    
    const descriptions = container.querySelectorAll('p')
    const longDescription = Array.from(descriptions).find(el => 
      el.textContent?.includes('very long description')
    )
    
    expect(longDescription).toBeInTheDocument()
    expect(longDescription?.className).toContain('break-words')
    expect(longDescription?.className).toContain('overflow-wrap-anywhere')
  })

  it('should have proper width constraints on notification content', () => {
    const { container } = render(<Dashboard {...defaultProps} />)
    
    const titleElements = container.querySelectorAll('h3')
    const notificationTitle = Array.from(titleElements).find(el => 
      el.textContent?.includes('Very Long Notification Title')
    )
    
    expect(notificationTitle?.className).toContain('min-w-0')
    expect(notificationTitle?.className).toContain('max-w-full')
  })

  it('should render timestamp with whitespace-nowrap', () => {
    const { container } = render(<Dashboard {...defaultProps} />)
    
    const timestamps = container.querySelectorAll('.text-xs.text-muted-foreground.flex-shrink-0')
    expect(timestamps.length).toBeGreaterThan(0)
    
    const timestamp = Array.from(timestamps).find(el => 
      el.className.includes('whitespace-nowrap')
    )
    expect(timestamp).toBeInTheDocument()
  })

  it('should render all notifications', () => {
    render(<Dashboard {...defaultProps} />)
    
    expect(screen.getByText(/Very Long Notification Title/i)).toBeInTheDocument()
    expect(screen.getByText('Short Title')).toBeInTheDocument()
  })

  it('should handle empty notifications', () => {
    const emptyProps = { ...defaultProps, notifications: [] }
    render(<Dashboard {...emptyProps} />)
    
    expect(screen.getByText('No notifications')).toBeInTheDocument()
  })

  it('should use items-start for notification title row', () => {
    const { container } = render(<Dashboard {...defaultProps} />)
    
    const titleRows = container.querySelectorAll('.flex.items-start')
    expect(titleRows.length).toBeGreaterThan(0)
  })

  it('should have leading-tight on notification titles', () => {
    const { container } = render(<Dashboard {...defaultProps} />)
    
    const titleElements = container.querySelectorAll('h3')
    const notificationTitle = Array.from(titleElements).find(el => 
      el.textContent?.includes('Very Long Notification Title')
    )
    
    expect(notificationTitle?.className).toContain('leading-tight')
  })
})

describe('Marketing Page Responsive Layout', () => {
  const marketingProps = {
    cars: mockCars,
    onGenerationComplete: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should render marketing cars without truncate class', () => {
    const { container } = render(<Marketing {...marketingProps} />)
    
    const titleElements = container.querySelectorAll('h3')
    const carTitle = Array.from(titleElements).find(el => 
      el.textContent?.includes('GLC250d 4MATIC AMG Line')
    )
    
    expect(carTitle).toBeInTheDocument()
    expect(carTitle?.className).not.toContain('truncate')
  })

  it('should use break-words for car titles in marketing', () => {
    const { container } = render(<Marketing {...marketingProps} />)
    
    const titleElements = container.querySelectorAll('h3')
    const carTitle = Array.from(titleElements).find(el => 
      el.textContent?.includes('GLC250d 4MATIC AMG Line')
    )
    
    expect(carTitle?.className).toContain('break-words')
    expect(carTitle?.className).toContain('overflow-wrap-anywhere')
  })

  it('should have proper width constraints on car details', () => {
    const { container } = render(<Marketing {...marketingProps} />)
    
    const detailsDivs = container.querySelectorAll('.flex-1')
    expect(detailsDivs.length).toBeGreaterThan(0)
    
    const carDetails = Array.from(detailsDivs).find(el => 
      el.querySelector('h3')?.textContent?.includes('GLC250d')
    )
    
    expect(carDetails?.className).toContain('min-w-0')
    expect(carDetails?.className).toContain('max-w-full')
  })

  it('should render responsive image sizes', () => {
    const { container } = render(<Marketing {...marketingProps} />)
    
    const images = container.querySelectorAll('img')
    const carImage = Array.from(images).find(img => 
      img.alt.includes('GLC250d')
    )
    
    expect(carImage?.className).toContain('w-20')
    expect(carImage?.className).toContain('sm:w-24')
  })

  it('should render all marketing cars', () => {
    const { container } = render(<Marketing {...marketingProps} />)
    
    expect(container.textContent).toContain('GLC250d 4MATIC AMG Line')
    expect(container.textContent).toContain('X5 xDrive40i M Sport')
  })

  it('should have overflow-hidden on card content', () => {
    const { container } = render(<Marketing {...marketingProps} />)
    
    const cardContents = container.querySelectorAll('.p-0')
    expect(cardContents.length).toBeGreaterThan(0)
    
    const cardContent = Array.from(cardContents).find(el => 
      el.className.includes('overflow-hidden')
    )
    expect(cardContent).toBeInTheDocument()
  })

  it('should wrap car detail items properly', () => {
    const { container } = render(<Marketing {...marketingProps} />)
    
    const detailRows = container.querySelectorAll('.flex-wrap')
    expect(detailRows.length).toBeGreaterThan(0)
  })

  it('should filter out cars with doNotAdvertise flag', () => {
    const carsWithDNA = [
      ...mockCars,
      {
        _id: '3',
        year: 2021,
        make: 'Audi',
        model: 'Q7',
        status: 'in-stock',
        doNotAdvertise: true,
        images: [{ imageUrl: '/car3.jpg' }],
      } as Car,
    ]
    
    const { container } = render(<Marketing {...marketingProps} cars={carsWithDNA} />)
    
    expect(container.textContent).not.toContain('Q7')
    expect(container.textContent).toContain('GLC250d')
  })

  it('should show empty state when no cars available', () => {
    render(<Marketing {...marketingProps} cars={[]} />)
    
    expect(screen.getByText(/No cars available for marketing/i)).toBeInTheDocument()
  })

  it('should have capitalize class on transmission', () => {
    const { container } = render(<Marketing {...marketingProps} />)
    
    const transmissionSpans = Array.from(container.querySelectorAll('span')).filter(el => 
      el.textContent?.includes('automatic')
    )
    
    const capitalizedTransmission = transmissionSpans.find(el => 
      el.className.includes('capitalize')
    )
    expect(capitalizedTransmission).toBeInTheDocument()
  })

  it('should render checkboxes for car selection', () => {
    const { container } = render(<Marketing {...marketingProps} />)
    
    const checkboxes = container.querySelectorAll('input[type="checkbox"]')
    expect(checkboxes.length).toBe(2) // Two cars
  })

  it('should have proper responsive padding', () => {
    const { container } = render(<Marketing {...marketingProps} />)
    
    const detailsDivs = container.querySelectorAll('.pr-2.sm\\:pr-3')
    expect(detailsDivs.length).toBeGreaterThan(0)
  })
})
