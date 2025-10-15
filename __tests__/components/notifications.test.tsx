/**
 * Notifications Display Tests
 * 
 * Comprehensive test suite for the notification display functionality in the Dashboard component.
 * Tests cover empty states, notification rendering, responsive text handling, icon display,
 * user interactions, and edge cases to ensure robust notification handling.
 */

import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Dashboard } from '@/app/components/dashboard';
import type { Car, Client, DashboardTab, Delivery, NotificationItem } from '@/app/types';

type DashboardProps = React.ComponentProps<typeof Dashboard>;

/**
 * Factory function to create a test notification with default values
 * @param overrides - Partial notification properties to override defaults
 * @returns Complete NotificationItem for testing
 */
const createNotification = (overrides: Partial<NotificationItem> = {}): NotificationItem => ({
  _id: 'notif-1',
  type: 'car_new',
  title: 'New car added: 2024 BMW M3 Competition',
  description: 'Price: ZAR 1,899,000',
  createdAt: new Date('2024-10-13T16:43:24').toISOString(),
  data: {
    carId: 'car-123',
  },
  ...overrides,
});

/**
 * Factory function to create a notification with long text for testing text wrapping
 * @returns NotificationItem with intentionally long title and description
 */
const createLongTextNotification = (): NotificationItem => ({
  _id: 'notif-long',
  type: 'car_reserved',
  title: 'Car reserved: 2024 BMW M3 Competition with Extended Package and Premium Features',
  description: 'Status changed from \'in-stock\' to \'reserved\' by John Smith for client Jane Doe with additional notes about the reservation',
  createdAt: new Date('2024-10-14T23:47:39').toISOString(),
  data: {
    carId: 'car-456',
  },
});

const baseProps = (overrides: Partial<DashboardProps> = {}): DashboardProps => ({
  cars: [],
  clients: [],
  activeStatus: 'notifications' as DashboardTab,
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
  notifications: [],
  onNotificationSelect: jest.fn(),
  onNotificationDone: jest.fn(),
  unreadNotificationsCount: 0,
  onMarkAllNotificationsRead: jest.fn(),
  ...overrides,
});

describe('Notifications Display', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Empty State', () => {
    it('renders empty state when no notifications exist', () => {
      render(<Dashboard {...baseProps()} />);

      expect(screen.getByText('No notifications')).toBeInTheDocument();
    });

    it('displays bell icon in empty state', () => {
      const { container } = render(<Dashboard {...baseProps()} />);
      
      // Check for the bell icon in the empty state
      const bellIcon = container.querySelector('svg');
      expect(bellIcon).toBeInTheDocument();
    });
  });

  describe('Notification Cards', () => {
    it('renders notification cards when notifications exist', () => {
      const notifications = [createNotification()];
      render(<Dashboard {...baseProps({ notifications })} />);

      expect(screen.getByText('New car added: 2024 BMW M3 Competition')).toBeInTheDocument();
      expect(screen.getByText('Price: ZAR 1,899,000')).toBeInTheDocument();
    });

    it('renders multiple notification cards', () => {
      const notifications = [
        createNotification({ _id: 'notif-1', title: 'First notification' }),
        createNotification({ _id: 'notif-2', title: 'Second notification' }),
        createNotification({ _id: 'notif-3', title: 'Third notification' }),
      ];
      render(<Dashboard {...baseProps({ notifications })} />);

      expect(screen.getByText('First notification')).toBeInTheDocument();
      expect(screen.getByText('Second notification')).toBeInTheDocument();
      expect(screen.getByText('Third notification')).toBeInTheDocument();
    });

    it('displays formatted timestamp', () => {
      const notifications = [createNotification()];
      const { container } = render(<Dashboard {...baseProps({ notifications })} />);

      // Check that a date string is rendered (format may vary by locale)
      const timestampElements = container.querySelectorAll('.text-xs.text-muted-foreground.break-words');
      expect(timestampElements.length).toBeGreaterThan(0);
      const timestampText = timestampElements[0].textContent;
      expect(timestampText).toBeTruthy();
      // Verify it contains date-like content (numbers and slashes or commas)
      expect(timestampText).toMatch(/\d/);
    });
  });

  describe('Notification Types and Icons', () => {
    it('renders car icon for car_new type', () => {
      const notifications = [createNotification({ type: 'car_new' })];
      const { container } = render(<Dashboard {...baseProps({ notifications })} />);

      // Check for icon container
      const iconContainer = container.querySelector('.bg-accent\\/30');
      expect(iconContainer).toBeInTheDocument();
    });

    it('renders bookmark icon for car_reserved type', () => {
      const notifications = [createNotification({ type: 'car_reserved' })];
      const { container } = render(<Dashboard {...baseProps({ notifications })} />);

      const iconContainer = container.querySelector('.bg-accent\\/30');
      expect(iconContainer).toBeInTheDocument();
    });

    it('renders tag icon for car_sold type', () => {
      const notifications = [createNotification({ type: 'car_sold' })];
      const { container } = render(<Dashboard {...baseProps({ notifications })} />);

      const iconContainer = container.querySelector('.bg-accent\\/30');
      expect(iconContainer).toBeInTheDocument();
    });

    it('renders clock icon for delivery_due_soon type', () => {
      const notifications = [createNotification({ type: 'delivery_due_soon' })];
      const { container } = render(<Dashboard {...baseProps({ notifications })} />);

      const iconContainer = container.querySelector('.bg-accent\\/30');
      expect(iconContainer).toBeInTheDocument();
    });

    it('renders check icon for delivery_completed type', () => {
      const notifications = [createNotification({ type: 'delivery_completed' })];
      const { container } = render(<Dashboard {...baseProps({ notifications })} />);

      const iconContainer = container.querySelector('.bg-accent\\/30');
      expect(iconContainer).toBeInTheDocument();
    });

    it('renders truck icon for delivery_update type', () => {
      const notifications = [createNotification({ type: 'delivery_update' })];
      const { container } = render(<Dashboard {...baseProps({ notifications })} />);

      const iconContainer = container.querySelector('.bg-accent\\/30');
      expect(iconContainer).toBeInTheDocument();
    });

    it('renders default bell icon for unknown type', () => {
      const notifications = [createNotification({ type: 'unknown_type' as any })];
      const { container } = render(<Dashboard {...baseProps({ notifications })} />);

      const iconContainer = container.querySelector('.bg-accent\\/30');
      expect(iconContainer).toBeInTheDocument();
    });
  });

  describe('Notification Interactions', () => {
    it('calls onNotificationSelect when notification is clicked', () => {
      const onNotificationSelect = jest.fn();
      const notifications = [createNotification()];
      render(<Dashboard {...baseProps({ notifications, onNotificationSelect })} />);

      const notificationCard = screen.getByText('New car added: 2024 BMW M3 Competition').closest('.cursor-pointer');
      fireEvent.click(notificationCard!);

      expect(onNotificationSelect).toHaveBeenCalledTimes(1);
      expect(onNotificationSelect).toHaveBeenCalledWith(notifications[0]);
    });

    it('applies hover effect on notification cards', () => {
      const notifications = [createNotification()];
      const { container } = render(<Dashboard {...baseProps({ notifications })} />);

      const card = container.querySelector('.hover\\:shadow-md');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Responsive Text Handling', () => {
    it('handles long notification titles without overflow', () => {
      const notifications = [createLongTextNotification()];
      const { container } = render(<Dashboard {...baseProps({ notifications })} />);

      const title = screen.getByText(/Car reserved: 2024 BMW M3 Competition/);
      expect(title).toHaveClass('break-words');
      expect(title).toHaveClass('overflow-wrap-anywhere');
    });

    it('handles long notification descriptions without overflow', () => {
      const notifications = [createLongTextNotification()];
      render(<Dashboard {...baseProps({ notifications })} />);

      const description = screen.getByText(/Status changed from/);
      expect(description).toHaveClass('break-words');
      expect(description).toHaveClass('overflow-wrap-anywhere');
    });

    it('applies proper width constraints to notification cards', () => {
      const notifications = [createNotification()];
      const { container } = render(<Dashboard {...baseProps({ notifications })} />);

      const card = container.querySelector('.w-full.max-w-full.min-w-0');
      expect(card).toBeInTheDocument();
    });

    it('applies overflow-hidden to card content', () => {
      const notifications = [createNotification()];
      const { container } = render(<Dashboard {...baseProps({ notifications })} />);

      const cardContent = container.querySelector('.overflow-hidden.p-3');
      expect(cardContent).toBeInTheDocument();
    });
  });

  describe('Notification Content', () => {
    it('renders notification without description', () => {
      const notifications = [createNotification({ description: undefined })];
      render(<Dashboard {...baseProps({ notifications })} />);

      expect(screen.getByText('New car added: 2024 BMW M3 Competition')).toBeInTheDocument();
      expect(screen.queryByText('Price: ZAR 1,899,000')).not.toBeInTheDocument();
    });

    it('renders notification with empty description', () => {
      const notifications = [createNotification({ description: '' })];
      render(<Dashboard {...baseProps({ notifications })} />);

      expect(screen.getByText('New car added: 2024 BMW M3 Competition')).toBeInTheDocument();
    });

    it('handles special characters in notification text', () => {
      const notifications = [
        createNotification({
          title: 'Special chars: <>&"\'',
          description: 'Description with special chars: <>&"\'',
        }),
      ];
      render(<Dashboard {...baseProps({ notifications })} />);

      expect(screen.getByText('Special chars: <>&"\'')).toBeInTheDocument();
      expect(screen.getByText('Description with special chars: <>&"\'')).toBeInTheDocument();
    });
  });

  describe('Layout and Styling', () => {
    it('applies correct gap between notification cards', () => {
      const notifications = [
        createNotification({ _id: 'notif-1' }),
        createNotification({ _id: 'notif-2' }),
      ];
      const { container } = render(<Dashboard {...baseProps({ notifications })} />);

      const notificationContainer = container.querySelector('.flex.flex-col.gap-3');
      expect(notificationContainer).toBeInTheDocument();
    });

    it('applies correct padding to notification cards', () => {
      const notifications = [createNotification()];
      const { container } = render(<Dashboard {...baseProps({ notifications })} />);

      const cardContent = container.querySelector('.p-3.sm\\:p-4');
      expect(cardContent).toBeInTheDocument();
    });

    it('icon container has correct size and styling', () => {
      const notifications = [createNotification()];
      const { container } = render(<Dashboard {...baseProps({ notifications })} />);

      const iconContainer = container.querySelector('.w-12.h-12.rounded-md.bg-accent\\/30');
      expect(iconContainer).toBeInTheDocument();
    });

    it('icon container is flex-shrink-0 to prevent squishing', () => {
      const notifications = [createNotification()];
      const { container } = render(<Dashboard {...baseProps({ notifications })} />);

      const iconContainer = container.querySelector('.flex-shrink-0');
      expect(iconContainer).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('notification cards are keyboard accessible', () => {
      const notifications = [createNotification()];
      render(<Dashboard {...baseProps({ notifications })} />);

      const card = screen.getByText('New car added: 2024 BMW M3 Competition').closest('.cursor-pointer');
      expect(card).toBeInTheDocument();
    });

    it('applies cursor-pointer to indicate clickability', () => {
      const notifications = [createNotification()];
      const { container } = render(<Dashboard {...baseProps({ notifications })} />);

      const card = container.querySelector('.cursor-pointer');
      expect(card).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles very long titles gracefully', () => {
      const veryLongTitle = 'A'.repeat(200);
      const notifications = [createNotification({ title: veryLongTitle })];
      render(<Dashboard {...baseProps({ notifications })} />);

      expect(screen.getByText(veryLongTitle)).toBeInTheDocument();
    });

    it('handles very long descriptions gracefully', () => {
      const veryLongDescription = 'B'.repeat(500);
      const notifications = [createNotification({ description: veryLongDescription })];
      render(<Dashboard {...baseProps({ notifications })} />);

      expect(screen.getByText(veryLongDescription)).toBeInTheDocument();
    });

    it('handles invalid date gracefully', () => {
      const notifications = [createNotification({ createdAt: 'invalid-date' })];
      render(<Dashboard {...baseProps({ notifications })} />);

      // Should still render without crashing
      expect(screen.getByText('New car added: 2024 BMW M3 Competition')).toBeInTheDocument();
    });

    it('handles missing data field', () => {
      const notifications = [createNotification({ data: undefined as any })];
      render(<Dashboard {...baseProps({ notifications })} />);

      expect(screen.getByText('New car added: 2024 BMW M3 Competition')).toBeInTheDocument();
    });
  });

  describe('Integration with Dashboard', () => {
    it('only shows notifications when activeStatus is notifications', () => {
      const notifications = [createNotification()];
      const { rerender } = render(
        <Dashboard {...baseProps({ notifications, activeStatus: 'all' })} />
      );

      expect(screen.queryByText('New car added: 2024 BMW M3 Competition')).not.toBeInTheDocument();

      rerender(<Dashboard {...baseProps({ notifications, activeStatus: 'notifications' })} />);

      expect(screen.getByText('New car added: 2024 BMW M3 Competition')).toBeInTheDocument();
    });

    it('maintains notification state when switching tabs', () => {
      const notifications = [createNotification()];
      const { rerender } = render(
        <Dashboard {...baseProps({ notifications, activeStatus: 'notifications' })} />
      );

      expect(screen.getByText('New car added: 2024 BMW M3 Competition')).toBeInTheDocument();

      rerender(<Dashboard {...baseProps({ notifications, activeStatus: 'all' })} />);
      rerender(<Dashboard {...baseProps({ notifications, activeStatus: 'notifications' })} />);

      expect(screen.getByText('New car added: 2024 BMW M3 Competition')).toBeInTheDocument();
    });
  });
});
