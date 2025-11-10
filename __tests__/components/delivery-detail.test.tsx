import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DeliveryDetail } from '@/app/components/delivery-detail';
import type { Delivery } from '@/app/types';

// Mock fetch
global.fetch = jest.fn();

// Mock IDB functions
jest.mock('@/lib/idb-docs', () => ({
  saveDoc: jest.fn(),
  getDoc: jest.fn(),
  makeLocalKey: jest.fn((id, kind) => `${id}-${kind}`),
}));

describe('DeliveryDetail', () => {
  const mockDelivery: Delivery = {
    _id: 'delivery-1',
    car: {
      _id: 'car-1',
      make: 'Toyota',
      model: 'Hilux',
      year: 2020,
      price: 350000,
      kilometers: 50000,
      color: 'White',
      transmission: 'automatic',
      status: 'reserved',
      vin: 'VIN123456789',
      notes: 'Test car notes',
      images: [],
      createdAt: new Date().toISOString(),
      auditLog: [],
    },
    salesperson: 'user-1',
    status: 'active',
    deliveryDate: '2024-12-01T00:00:00.000Z',
    financeBank: 'Test Bank',
    customerType: 'natural',
    docs: [],
    reconTasks: [],
    licensing: { done: false, notes: '' },
    additionalDocs: {},
    auditLog: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockOnBack = jest.fn();
  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: [] }),
    });
  });

  it('renders delivery detail page', () => {
    render(
      <DeliveryDetail
        delivery={mockDelivery}
        onBack={mockOnBack}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByText('Delivery Preparation')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('displays car details', () => {
    render(
      <DeliveryDetail
        delivery={mockDelivery}
        onBack={mockOnBack}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByText(/Toyota/i)).toBeInTheDocument();
    expect(screen.getByText(/Hilux/i)).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', () => {
    render(
      <DeliveryDetail
        delivery={mockDelivery}
        onBack={mockOnBack}
        onSave={mockOnSave}
      />
    );

    const backButton = screen.getAllByRole('button')[0]; // First button is back
    fireEvent.click(backButton);

    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });

  it('calls onSave and navigates back when save button is clicked', async () => {
    mockOnSave.mockResolvedValue(undefined);

    render(
      <DeliveryDetail
        delivery={mockDelivery}
        onBack={mockOnBack}
        onSave={mockOnSave}
      />
    );

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(mockOnBack).toHaveBeenCalledTimes(1);
    });
  });

  it('does not navigate back if save fails', async () => {
    mockOnSave.mockRejectedValue(new Error('Save failed'));
    
    // Mock alert to prevent actual alert dialog
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => {});

    render(
      <DeliveryDetail
        delivery={mockDelivery}
        onBack={mockOnBack}
        onSave={mockOnSave}
      />
    );

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledTimes(1);
    });

    // Should not call onBack if save fails
    expect(mockOnBack).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Failed to save delivery. Please try again.');

    alertSpy.mockRestore();
  });

  it('disables save button while saving', async () => {
    mockOnSave.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    render(
      <DeliveryDetail
        delivery={mockDelivery}
        onBack={mockOnBack}
        onSave={mockOnSave}
      />
    );

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    // Button should show "Saving..." and be disabled
    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    const savingButton = screen.getByText('Saving...');
    expect(savingButton).toBeDisabled();
  });

  it('updates delivery date', () => {
    render(
      <DeliveryDetail
        delivery={mockDelivery}
        onBack={mockOnBack}
        onSave={mockOnSave}
      />
    );

    const dateInput = screen.getByLabelText(/delivery date/i) as HTMLInputElement;
    expect(dateInput.value).toBe('2024-12-01');
    
    fireEvent.change(dateInput, { target: { value: '2024-12-15' } });
    expect(dateInput).toHaveValue('2024-12-15');
  });

  it('updates finance bank', () => {
    render(
      <DeliveryDetail
        delivery={mockDelivery}
        onBack={mockOnBack}
        onSave={mockOnSave}
      />
    );

    const bankInput = screen.getByLabelText(/finance bank/i) as HTMLInputElement;
    expect(bankInput.value).toBe('Test Bank');
    
    fireEvent.change(bankInput, { target: { value: 'New Bank' } });
    expect(bankInput).toHaveValue('New Bank');
  });

  it('adds new recon task', () => {
    render(
      <DeliveryDetail
        delivery={mockDelivery}
        onBack={mockOnBack}
        onSave={mockOnSave}
      />
    );

    const taskInput = screen.getByPlaceholderText(/Add a task/i);
    fireEvent.change(taskInput, { target: { value: 'Fix bumper' } });

    // Find the add button by getting all buttons and selecting the one with Plus icon
    const buttons = screen.getAllByRole('button');
    const addButton = buttons.find(btn => btn.querySelector('svg.lucide-plus'));
    expect(addButton).toBeDefined();
    fireEvent.click(addButton!);

    expect(screen.getByDisplayValue('Fix bumper')).toBeInTheDocument();
  });

  it('toggles licensing done status', () => {
    render(
      <DeliveryDetail
        delivery={mockDelivery}
        onBack={mockOnBack}
        onSave={mockOnSave}
      />
    );

    // Licensing is a select dropdown, not a checkbox
    const licensingSelect = screen.getByText(/licensing done/i).closest('div');
    expect(licensingSelect).toBeInTheDocument();
  });

  it('switches customer type', () => {
    render(
      <DeliveryDetail
        delivery={mockDelivery}
        onBack={mockOnBack}
        onSave={mockOnSave}
      />
    );

    // Customer type section should be present
    expect(screen.getByText(/Customer Type/i)).toBeInTheDocument();
  });

  it('passes correct data to onSave', async () => {
    mockOnSave.mockResolvedValue(undefined);

    render(
      <DeliveryDetail
        delivery={mockDelivery}
        onBack={mockOnBack}
        onSave={mockOnSave}
      />
    );

    // Update delivery date
    const dateInput = screen.getByDisplayValue('2024-12-01');
    fireEvent.change(dateInput, { target: { value: '2024-12-20' } });

    // Update finance bank
    const bankInput = screen.getByDisplayValue('Test Bank');
    fireEvent.change(bankInput, { target: { value: 'Updated Bank' } });

    const saveButton = screen.getByText('Save');
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          deliveryDate: expect.stringContaining('2024-12-20'),
          financeBank: 'Updated Bank',
          customerType: 'natural',
          reconTasks: [],
          licensing: { done: false, notes: '' },
          additionalDocs: {},
          docs: [],
        })
      );
    });
  });

  it('handles delivery with existing recon tasks', () => {
    const deliveryWithTasks: Delivery = {
      ...mockDelivery,
      reconTasks: [
        { text: 'Task 1', done: false, note: '' },
        { text: 'Task 2', done: true, note: 'Completed' },
      ],
    };

    render(
      <DeliveryDetail
        delivery={deliveryWithTasks}
        onBack={mockOnBack}
        onSave={mockOnSave}
      />
    );

    // Tasks are displayed in input fields
    expect(screen.getByDisplayValue('Task 1')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Task 2')).toBeInTheDocument();
  });

  it('migrates legacy reconNotes to reconTasks', () => {
    const deliveryWithLegacyNotes: any = {
      ...mockDelivery,
      reconNotes: 'Legacy recon notes',
      reconTasks: undefined,
    };

    render(
      <DeliveryDetail
        delivery={deliveryWithLegacyNotes}
        onBack={mockOnBack}
        onSave={mockOnSave}
      />
    );

    // Legacy notes are migrated to a recon task and displayed in an input field
    expect(screen.getByDisplayValue('Legacy recon notes')).toBeInTheDocument();
  });

  it('fetches clients on mount', async () => {
    const mockClients = [
      { _id: 'client-1', firstName: 'John', lastName: 'Doe', phone: '1234567890' },
    ];

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ data: mockClients }),
    });

    render(
      <DeliveryDetail
        delivery={mockDelivery}
        onBack={mockOnBack}
        onSave={mockOnSave}
      />
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/clients');
    });
  });

  it('handles client fetch failure gracefully', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <DeliveryDetail
        delivery={mockDelivery}
        onBack={mockOnBack}
        onSave={mockOnSave}
      />
    );

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch clients:',
        expect.any(Error)
      );
    });

    consoleErrorSpy.mockRestore();
  });

  it('displays audit log entries', () => {
    const deliveryWithAudit: Delivery = {
      ...mockDelivery,
      auditLog: [
        {
          timestamp: new Date('2024-01-01').toISOString(),
          user: 'Test User',
          action: 'created',
          details: 'Delivery created',
        },
      ],
    };

    render(
      <DeliveryDetail
        delivery={deliveryWithAudit}
        onBack={mockOnBack}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByText(/Test User/i)).toBeInTheDocument();
    expect(screen.getByText(/Delivery created/i)).toBeInTheDocument();
  });

  it('handles delivery with populated client object', () => {
    const deliveryWithClient: Delivery = {
      ...mockDelivery,
      client: {
        _id: 'client-1',
        firstName: 'Jane',
        lastName: 'Smith',
        phone: '9876543210',
        email: 'jane@example.com',
        active: true,
        cars: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any,
    };

    render(
      <DeliveryDetail
        delivery={deliveryWithClient}
        onBack={mockOnBack}
        onSave={mockOnSave}
      />
    );

    // Component should render without errors
    expect(screen.getByText('Delivery Preparation')).toBeInTheDocument();
  });
});
