import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { AddEditCar } from '@/app/components/add-edit-car';
import type { Car } from '@/app/types';

type Props = React.ComponentProps<typeof AddEditCar>;

describe('AddEditCar drag and drop', () => {
  const defaultCar: Car = {
    _id: 'car-1',
    images: [
      {
        _id: 'img-1',
        title: 'Front',
        imageUrl: 'https://example.com/front.jpg',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      },
      {
        _id: 'img-2',
        title: 'Rear',
        imageUrl: 'https://example.com/rear.jpg',
        createdAt: '2024-01-02T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      },
    ],
    year: 2024,
    make: 'Toyota',
    model: 'Corolla Cross',
    price: 429000,
    kilometers: 17800,
    color: 'White',
    transmission: 'automatic',
    vin: 'VIN123',
    notes: '',
    description: 'Compact SUV',
    status: 'in-stock',
    demo: false,
    createdAt: '2024-01-01T00:00:00.000Z',
    auditLog: [],
  };

  const baseProps = (overrides: Partial<Props> = {}): Props => ({
    car: defaultCar,
    onSave: jest.fn(),
    onCancel: jest.fn(),
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires 300ms press before drag starts', () => {
    // Mock the timer functions
    jest.useFakeTimers();
    
    // Render the component
    render(<AddEditCar {...baseProps()} />);
    
    // Get the tiles
    const tiles = screen.getAllByTestId('car-image-tile');
    const tileOne = tiles[0];
    
    // Mock the pointer capture methods
    const mockSetPointerCapture = jest.fn();
    Object.defineProperty(tileOne, 'setPointerCapture', {
      value: mockSetPointerCapture,
      writable: true
    });

    // 1. Initial pointer down
    fireEvent.pointerDown(tileOne, { 
      pointerId: 1, 
      pointerType: 'touch', 
      clientX: 5, 
      clientY: 5 
    });
    
    // Should not have called setPointerCapture yet
    expect(mockSetPointerCapture).not.toHaveBeenCalled();
    
    // 2. Advance time by 300ms
    act(() => {
      jest.advanceTimersByTime(300);
    });
    
    // Now it should have called setPointerCapture
    expect(mockSetPointerCapture).toHaveBeenCalledWith(1);
    
    // Cleanup
    jest.useRealTimers();
  });

  it('cancels drag if movement exceeds threshold during delay', () => {
    // Mock the timer functions
    jest.useFakeTimers();
    
    // Render the component
    render(<AddEditCar {...baseProps()} />);
    
    // Get the tiles
    const tiles = screen.getAllByTestId('car-image-tile');
    const tileOne = tiles[0];
    
    // Mock the pointer capture methods
    const mockSetPointerCapture = jest.fn();
    Object.defineProperty(tileOne, 'setPointerCapture', {
      value: mockSetPointerCapture,
      writable: true
    });

    // 1. Initial pointer down
    fireEvent.pointerDown(tileOne, { 
      pointerId: 1, 
      pointerType: 'touch', 
      clientX: 5, 
      clientY: 5 
    });
    
    // 2. Move more than 5px during the delay (exceeds threshold)
    act(() => {
      jest.advanceTimersByTime(100);
      fireEvent.pointerMove(tileOne, { 
        pointerId: 1, 
        pointerType: 'touch', 
        clientX: 20,  // More than 5px from start (5,5)
        clientY: 20   // More than 5px from start (5,5)
      });
    });
    
    // 3. Wait for the full 300ms
    act(() => {
      jest.advanceTimersByTime(200);
    });
    
    // Should not have called setPointerCapture because we moved too much
    expect(mockSetPointerCapture).not.toHaveBeenCalled();
    
    // Cleanup
    jest.useRealTimers();
  });
});
