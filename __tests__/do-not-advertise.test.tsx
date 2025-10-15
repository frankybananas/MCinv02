import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AddEditCar } from '@/app/components/add-edit-car';
import { CarDetail } from '@/app/components/car-detail';
import { Marketing } from '@/app/components/marketing';
import type { Car } from '@/app/types';

// Mock dependencies
jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/whatsapp-generator', () => ({
  generateWhatsAppImages: jest.fn().mockResolvedValue({ success: true, count: 1 }),
}));

const mockCar: Car = {
  _id: '123',
  make: 'BMW',
  model: 'M3',
  year: 2024,
  price: 1899000,
  kilometers: 5000,
  color: 'Gray',
  transmission: 'automatic',
  vin: 'TEST123VIN',
  notes: 'Test notes',
  status: 'in-stock',
  demo: false,
  doNotAdvertise: false,
  images: [
    {
      _id: 'img1',
      title: 'Front view',
      imageUrl: 'https://example.com/image1.jpg',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01',
    },
  ],
  createdAt: '2024-01-01',
  auditLog: [],
};

const mockCarWithDNA: Car = {
  ...mockCar,
  doNotAdvertise: true,
};

describe('Do Not Advertise Feature', () => {
  describe('AddEditCar Component', () => {
    it('should render the "Do Not Advertise" checkbox', () => {
      const mockOnSave = jest.fn();
      const mockOnCancel = jest.fn();

      render(<AddEditCar onSave={mockOnSave} onCancel={mockOnCancel} />);

      const checkbox = screen.getByLabelText('Do Not Advertise');
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();
    });

    it('should check the "Do Not Advertise" checkbox when editing a DNA car', () => {
      const mockOnSave = jest.fn();
      const mockOnCancel = jest.fn();

      render(<AddEditCar car={mockCarWithDNA} onSave={mockOnSave} onCancel={mockOnCancel} />);

      const checkbox = screen.getByLabelText('Do Not Advertise');
      expect(checkbox).toBeChecked();
    });

    it('should toggle the "Do Not Advertise" checkbox', () => {
      const mockOnSave = jest.fn();
      const mockOnCancel = jest.fn();

      render(<AddEditCar onSave={mockOnSave} onCancel={mockOnCancel} />);

      const checkbox = screen.getByLabelText('Do Not Advertise') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);

      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);

      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(false);
    });

    it('should show DNA badge on images when doNotAdvertise is checked', () => {
      const mockOnSave = jest.fn();
      const mockOnCancel = jest.fn();

      render(<AddEditCar car={mockCarWithDNA} onSave={mockOnSave} onCancel={mockOnCancel} />);

      const dnaBadges = screen.getAllByTestId('dna-badge');
      expect(dnaBadges.length).toBeGreaterThan(0);
      expect(dnaBadges[0]).toHaveTextContent('DNA');
    });

    it('should not show DNA badge when doNotAdvertise is unchecked', () => {
      const mockOnSave = jest.fn();
      const mockOnCancel = jest.fn();

      render(<AddEditCar car={mockCar} onSave={mockOnSave} onCancel={mockOnCancel} />);

      const dnaBadges = screen.queryAllByTestId('dna-badge');
      expect(dnaBadges.length).toBe(0);
    });

    it('should show DNA badge when checkbox is toggled on', async () => {
      const mockOnSave = jest.fn();
      const mockOnCancel = jest.fn();

      render(<AddEditCar car={mockCar} onSave={mockOnSave} onCancel={mockOnCancel} />);

      // Initially no DNA badge
      expect(screen.queryAllByTestId('dna-badge').length).toBe(0);

      // Toggle checkbox
      const checkbox = screen.getByLabelText('Do Not Advertise');
      fireEvent.click(checkbox);

      // DNA badge should appear
      await waitFor(() => {
        const dnaBadges = screen.getAllByTestId('dna-badge');
        expect(dnaBadges.length).toBeGreaterThan(0);
      });
    });

    it('should include doNotAdvertise in form submission', async () => {
      const mockOnSave = jest.fn().mockResolvedValue(undefined);
      const mockOnCancel = jest.fn();

      render(<AddEditCar onSave={mockOnSave} onCancel={mockOnCancel} />);

      // Fill required fields
      fireEvent.change(screen.getByPlaceholderText(/e.g. Toyota/i), { target: { value: 'BMW' } });
      fireEvent.change(screen.getByPlaceholderText(/e.g. Hilux/i), { target: { value: 'M3' } });
      fireEvent.change(screen.getByPlaceholderText(/e.g. 150 000/i), { target: { value: '1899000' } });
      fireEvent.change(screen.getByPlaceholderText(/e.g. 50000/i), { target: { value: '5000' } });
      fireEvent.change(screen.getByPlaceholderText(/e.g. White/i), { target: { value: 'Gray' } });

      // Check doNotAdvertise
      const checkbox = screen.getByLabelText('Do Not Advertise');
      fireEvent.click(checkbox);

      // Submit form
      const submitButton = screen.getByText(/Save Car/i);
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
        const formData = mockOnSave.mock.calls[0][0] as FormData;
        expect(formData.get('doNotAdvertise')).toBe('true');
      });
    });
  });

  describe('CarDetail Component', () => {
    const mockProps = {
      onBack: jest.fn(),
      onEdit: jest.fn(),
      onReserve: jest.fn(),
      onStatusChange: jest.fn(),
    };

    beforeEach(() => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: { firstName: 'Test', lastName: 'User' } }),
      });
    });

    it('should show DNA badge on main image when doNotAdvertise is true', () => {
      render(<CarDetail car={mockCarWithDNA} {...mockProps} />);

      const dnaBadge = screen.getByTestId('dna-badge');
      expect(dnaBadge).toBeInTheDocument();
      expect(dnaBadge).toHaveTextContent('DNA');
    });

    it('should not show DNA badge when doNotAdvertise is false', () => {
      render(<CarDetail car={mockCar} {...mockProps} />);

      const dnaBadge = screen.queryByTestId('dna-badge');
      expect(dnaBadge).not.toBeInTheDocument();
    });

    it('should show DNA badge on thumbnail images when doNotAdvertise is true', () => {
      const carWithMultipleImages: Car = {
        ...mockCarWithDNA,
        images: [
          {
            _id: 'img1',
            title: 'Front',
            imageUrl: 'https://example.com/image1.jpg',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          },
          {
            _id: 'img2',
            title: 'Back',
            imageUrl: 'https://example.com/image2.jpg',
            createdAt: '2024-01-01',
            updatedAt: '2024-01-01',
          },
        ],
      };

      render(<CarDetail car={carWithMultipleImages} {...mockProps} />);

      // Should have DNA badge on main image + thumbnails
      const dnaBadges = screen.getAllByText('DNA');
      expect(dnaBadges.length).toBeGreaterThan(1);
    });
  });

  describe('Marketing Component', () => {
    it('should filter out cars with doNotAdvertise flag', () => {
      const cars: Car[] = [
        mockCar,
        mockCarWithDNA,
        { ...mockCar, _id: '456', doNotAdvertise: false },
      ];

      render(<Marketing cars={cars} />);

      // Should show 2 cars (excluding the DNA one)
      expect(screen.getByText('2 cars available')).toBeInTheDocument();
    });

    it('should show all cars when none have doNotAdvertise flag', () => {
      const cars: Car[] = [
        mockCar,
        { ...mockCar, _id: '456' },
        { ...mockCar, _id: '789' },
      ];

      render(<Marketing cars={cars} />);

      expect(screen.getByText('3 cars available')).toBeInTheDocument();
    });

    it('should show no cars when all have doNotAdvertise flag', () => {
      const cars: Car[] = [
        mockCarWithDNA,
        { ...mockCarWithDNA, _id: '456' },
      ];

      render(<Marketing cars={cars} />);

      expect(screen.getByText('0 cars available')).toBeInTheDocument();
      expect(screen.getByText(/No cars available for marketing/i)).toBeInTheDocument();
    });

    it('should not include DNA cars in selection', () => {
      const cars: Car[] = [
        mockCar,
        mockCarWithDNA,
      ];

      render(<Marketing cars={cars} />);

      const selectAllButton = screen.getByText('Select All');
      fireEvent.click(selectAllButton);

      // Should only select 1 car (the non-DNA one)
      expect(screen.getByText(/Generate \(1\)/i)).toBeInTheDocument();
    });

    it('should filter cars by status and doNotAdvertise', () => {
      const cars: Car[] = [
        mockCar, // in-stock, no DNA - should show
        mockCarWithDNA, // in-stock, DNA - should not show
        { ...mockCar, _id: '456', status: 'sold' as const }, // sold - should not show
        { ...mockCar, _id: '789', status: 'reserved' as const }, // reserved, no DNA - should show
        { ...mockCar, _id: '101', status: 'reserved' as const, doNotAdvertise: true }, // reserved, DNA - should not show
      ];

      render(<Marketing cars={cars} />);

      // Should show 2 cars (in-stock without DNA + reserved without DNA)
      expect(screen.getByText('2 cars available')).toBeInTheDocument();
    });
  });

  describe('Integration Tests', () => {
    it('should maintain DNA state through edit flow', async () => {
      const mockOnSave = jest.fn().mockResolvedValue(undefined);
      const mockOnCancel = jest.fn();

      const { rerender } = render(<AddEditCar car={mockCar} onSave={mockOnSave} onCancel={mockOnCancel} />);

      // Toggle DNA on
      const checkbox = screen.getByLabelText('Do Not Advertise');
      fireEvent.click(checkbox);

      // Verify badge appears
      await waitFor(() => {
        expect(screen.getAllByTestId('dna-badge').length).toBeGreaterThan(0);
      });

      // Simulate saving and reopening with updated car
      const updatedCar = { ...mockCar, doNotAdvertise: true };
      rerender(<AddEditCar car={updatedCar} onSave={mockOnSave} onCancel={mockOnCancel} />);

      // Verify checkbox is still checked
      expect(screen.getByLabelText('Do Not Advertise')).toBeChecked();
      expect(screen.getAllByTestId('dna-badge').length).toBeGreaterThan(0);
    });

    it('should handle undefined doNotAdvertise as false', () => {
      const carWithoutDNA = { ...mockCar };
      delete (carWithoutDNA as any).doNotAdvertise;

      const mockOnSave = jest.fn();
      const mockOnCancel = jest.fn();

      render(<AddEditCar car={carWithoutDNA} onSave={mockOnSave} onCancel={mockOnCancel} />);

      const checkbox = screen.getByLabelText('Do Not Advertise') as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle car with no images', () => {
      const carWithoutImages: Car = {
        ...mockCar,
        images: [],
        doNotAdvertise: true,
      };

      const mockOnSave = jest.fn();
      const mockOnCancel = jest.fn();

      render(<AddEditCar car={carWithoutImages} onSave={mockOnSave} onCancel={mockOnCancel} />);

      const checkbox = screen.getByLabelText('Do Not Advertise');
      expect(checkbox).toBeChecked();
      // No DNA badges should appear since there are no images
      expect(screen.queryAllByTestId('dna-badge').length).toBe(0);
    });

    it('should show DNA badge styling correctly', () => {
      const mockOnSave = jest.fn();
      const mockOnCancel = jest.fn();

      render(<AddEditCar car={mockCarWithDNA} onSave={mockOnSave} onCancel={mockOnCancel} />);

      const dnaBadge = screen.getAllByTestId('dna-badge')[0];
      expect(dnaBadge).toHaveClass('bg-white');
      expect(dnaBadge).toHaveClass('text-black');
      expect(dnaBadge).toHaveClass('font-bold');
      expect(dnaBadge).toHaveClass('border-red-600');
    });

    it('should handle rapid checkbox toggling', async () => {
      const mockOnSave = jest.fn();
      const mockOnCancel = jest.fn();

      render(<AddEditCar car={mockCar} onSave={mockOnSave} onCancel={mockOnCancel} />);

      const checkbox = screen.getByLabelText('Do Not Advertise');

      // Rapid toggle
      fireEvent.click(checkbox);
      fireEvent.click(checkbox);
      fireEvent.click(checkbox);

      await waitFor(() => {
        expect((checkbox as HTMLInputElement).checked).toBe(true);
      });
    });
  });
});
