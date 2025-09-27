import React from 'react';
import { act, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { AddEditCar } from '@/app/components/add-edit-car';
import type { Car } from '@/app/types';

type Props = React.ComponentProps<typeof AddEditCar>;

describe('AddEditCar image interactions', () => {
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
      {
        _id: 'img-3',
        title: 'Interior',
        imageUrl: 'https://example.com/interior.jpg',
        createdAt: '2024-01-03T00:00:00.000Z',
        updatedAt: '2024-01-03T00:00:00.000Z',
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

  it('reorders images via pointer drag', async () => {
    jest.useFakeTimers();
    render(<AddEditCar {...baseProps()} />);

    const tiles = screen.getAllByTestId('car-image-tile');
    expect(tiles).toHaveLength(3);

    const tileOne = tiles[0];
    const tileTwo = tiles[1];
    expect(tileOne).toHaveAttribute('data-image-id', expect.stringContaining('img-1'));

    const originalElementFromPoint = document.elementFromPoint;
    (document as any).elementFromPoint = jest.fn(() => tileTwo);

    // Start drag with initial pointer down
    fireEvent.pointerDown(tileOne, { pointerId: 1, pointerType: 'touch', clientX: 5, clientY: 5 });
    
    // Wait for the drag delay
    act(() => {
      jest.advanceTimersByTime(300);
    });
    
    // Move the pointer to trigger reorder
    fireEvent.pointerMove(tileOne, { pointerId: 1, pointerType: 'touch', clientX: 50, clientY: 50 });
    
    // End the drag
    fireEvent.pointerUp(tileOne, { pointerId: 1, pointerType: 'touch' });

    (document as any).elementFromPoint = originalElementFromPoint;
    
    // Clean up timers
    jest.useRealTimers();

    const updatedTiles = screen.getAllByTestId('car-image-tile');
    expect(updatedTiles[0]).toHaveAttribute('data-image-id', expect.stringContaining('img-2'));
    expect(updatedTiles[1]).toHaveAttribute('data-image-id', expect.stringContaining('img-1'));
  });

  it('removes an image without interfering with drag logic', async () => {
    render(<AddEditCar {...baseProps()} />);

    const tiles = screen.getAllByTestId('car-image-tile');
    expect(tiles).toHaveLength(3);

    const removeButton = within(tiles[1]).getByRole('button', { name: /remove image/i });

    // For remove button clicks, we don't need to wait for the drag delay
    // since we're not actually dragging, just clicking the button
    fireEvent.pointerDown(removeButton, { pointerId: 2, pointerType: 'touch' });
    fireEvent.click(removeButton);
    fireEvent.pointerUp(removeButton, { pointerId: 2, pointerType: 'touch' });

    const afterRemoval = screen.getAllByTestId('car-image-tile');
    expect(afterRemoval).toHaveLength(2);
    expect(afterRemoval[0]).toHaveAttribute('data-image-id', expect.stringContaining('img-1'));
    expect(afterRemoval[1]).toHaveAttribute('data-image-id', expect.stringContaining('img-3'));
  });

  it('appends new images and maintains order metadata during submission', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<AddEditCar {...baseProps({ onSave })} />);

    const fileInput = screen.getByTestId('car-image-file-input') as HTMLInputElement;

    const fileA = new File(['one'], 'one.jpg', { type: 'image/jpeg' });
    const fileB = new File(['two'], 'two.jpg', { type: 'image/jpeg' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [fileA, fileB] } });
    });

    const tiles = screen.getAllByTestId('car-image-tile');
    expect(tiles).toHaveLength(5);

    // No need for act here since we're not testing drag functionality
    fireEvent.click(screen.getByRole('button', { name: /save car/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const formDataArg = onSave.mock.calls[0][0] as FormData;
    const entries = Array.from(formDataArg.entries());
    const imageOrder = entries.filter(([key]) => key === 'imageOrder').map(([, value]) => value);
    
    // Check that all images are included in the correct order
    expect(imageOrder).toHaveLength(5);
    expect(imageOrder[0]).toMatch(/img-1/);
    expect(imageOrder[1]).toMatch(/img-2/);
    expect(imageOrder[2]).toMatch(/img-3/);
    expect(imageOrder[3]).toMatch(/new:0/);
    expect(imageOrder[4]).toMatch(/new:1/);
    
    // Also verify the structure of the form data
    expect(entries.some(([key]) => key === 'images')).toBe(true);
  });

  it('requires 300ms press before drag starts', async () => {
    jest.useFakeTimers();
    render(<AddEditCar {...baseProps()} />);

    const tiles = screen.getAllByTestId('car-image-tile');
    const tileOne = tiles[0];
    const tileTwo = tiles[1];

    // Mock elementFromPoint to return the second tile
    const originalElementFromPoint = document.elementFromPoint;
    (document as any).elementFromPoint = jest.fn(() => tileTwo);

    // Start pointer down but don't wait long enough
    fireEvent.pointerDown(tileOne, { pointerId: 1, pointerType: 'touch', clientX: 5, clientY: 5 });
    
    // Move pointer after 150ms (before the 300ms threshold)
    act(() => {
      jest.advanceTimersByTime(150);
      fireEvent.pointerMove(tileOne, { pointerId: 1, pointerType: 'touch', clientX: 50, clientY: 50 });
    });

    // Should not have reordered yet
    let updatedTiles = screen.getAllByTestId('car-image-tile');
    expect(updatedTiles[0]).toHaveAttribute('data-image-id', expect.stringContaining('img-1'));

    // Wait for the full 300ms
    act(() => {
      jest.advanceTimersByTime(150);
    });

    // Now it should have reordered
    updatedTiles = screen.getAllByTestId('car-image-tile');
    expect(updatedTiles[0]).toHaveAttribute('data-image-id', expect.stringContaining('img-2'));

    fireEvent.pointerUp(tileOne, { pointerId: 1, pointerType: 'touch' });
    (document as any).elementFromPoint = originalElementFromPoint;
    jest.useRealTimers();
  });

  it('cancels drag if movement exceeds threshold during delay', async () => {
    jest.useFakeTimers();
    render(<AddEditCar {...baseProps()} />);

    const tiles = screen.getAllByTestId('car-image-tile');
    const tileOne = tiles[0];
    const tileTwo = tiles[1];

    // Mock elementFromPoint to return the second tile
    const originalElementFromPoint = document.elementFromPoint;
    (document as any).elementFromPoint = jest.fn(() => tileTwo);

    // Start pointer down
    fireEvent.pointerDown(tileOne, { pointerId: 1, pointerType: 'touch', clientX: 5, clientY: 5 });
    
    // Move more than 5px during the delay
    act(() => {
      jest.advanceTimersByTime(100);
      fireEvent.pointerMove(tileOne, { pointerId: 1, pointerType: 'touch', clientX: 20, clientY: 20 });
    });

    // Wait for the full 300ms
    act(() => {
      jest.advanceTimersByTime(300);
    });

    // Should not have reordered because we moved too much during delay
    const updatedTiles = screen.getAllByTestId('car-image-tile');
    expect(updatedTiles[0]).toHaveAttribute('data-image-id', expect.stringContaining('img-1'));

    fireEvent.pointerUp(tileOne, { pointerId: 1, pointerType: 'touch' });
    (document as any).elementFromPoint = originalElementFromPoint;
    jest.useRealTimers();
  });

  it('allows small movements during delay without canceling drag', async () => {
    jest.useFakeTimers();
    render(<AddEditCar {...baseProps()} />);

    const tiles = screen.getAllByTestId('car-image-tile');
    const tileOne = tiles[0];
    const tileTwo = tiles[1];

    // Mock elementFromPoint to return the second tile
    const originalElementFromPoint = document.elementFromPoint;
    (document as any).elementFromPoint = jest.fn(() => tileTwo);

    // Start pointer down
    fireEvent.pointerDown(tileOne, { pointerId: 1, pointerType: 'touch', clientX: 5, clientY: 5 });
    
    // Move less than 5px during the delay (small jitter)
    act(() => {
      jest.advanceTimersByTime(100);
      fireEvent.pointerMove(tileOne, { pointerId: 1, pointerType: 'touch', clientX: 7, clientY: 6 });
    });

    // Wait for the full 300ms
    act(() => {
      jest.advanceTimersByTime(200);
    });

    // Should still allow the drag to proceed
    const updatedTiles = screen.getAllByTestId('car-image-tile');
    expect(updatedTiles[0]).toHaveAttribute('data-image-id', expect.stringContaining('img-2'));

    fireEvent.pointerUp(tileOne, { pointerId: 1, pointerType: 'touch' });
    (document as any).elementFromPoint = originalElementFromPoint;
    jest.useRealTimers();
  });
});
