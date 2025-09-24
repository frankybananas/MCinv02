import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
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
    render(<AddEditCar {...baseProps()} />);

    const tiles = screen.getAllByTestId('car-image-tile');
    expect(tiles).toHaveLength(3);

    const tileOne = tiles[0];
    const tileTwo = tiles[1];
    expect(tileOne).toHaveAttribute('data-image-id', expect.stringContaining('img-1'));

    const originalElementFromPoint = document.elementFromPoint;
    (document as any).elementFromPoint = jest.fn(() => tileTwo);

    await act(async () => {
      fireEvent.pointerDown(tileOne, { pointerId: 1, pointerType: 'touch', clientX: 5, clientY: 5 });
      fireEvent.pointerMove(tileOne, { pointerId: 1, pointerType: 'touch', clientX: 50, clientY: 50 });
      fireEvent.pointerUp(tileOne, { pointerId: 1, pointerType: 'touch' });
    });

    (document as any).elementFromPoint = originalElementFromPoint;

    const updatedTiles = screen.getAllByTestId('car-image-tile');
    expect(updatedTiles[0]).toHaveAttribute('data-image-id', expect.stringContaining('img-2'));
    expect(updatedTiles[1]).toHaveAttribute('data-image-id', expect.stringContaining('img-1'));
  });

  it('removes an image without interfering with drag logic', async () => {
    render(<AddEditCar {...baseProps()} />);

    const tiles = screen.getAllByTestId('car-image-tile');
    expect(tiles).toHaveLength(3);

    const removeButton = within(tiles[1]).getByRole('button', { name: /remove image/i });

    await act(async () => {
      fireEvent.pointerDown(removeButton, { pointerId: 2, pointerType: 'touch' });
      fireEvent.click(removeButton);
      fireEvent.pointerUp(removeButton, { pointerId: 2, pointerType: 'touch' });
    });

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

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save car/i }));
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    const formDataArg = onSave.mock.calls[0][0] as FormData;
    const entries = Array.from(formDataArg.entries());
    const imageOrder = entries.filter(([key]) => key === 'imageOrder').map(([, value]) => value);
    expect(imageOrder[0]).toMatch(/img-1/);
    expect(imageOrder[1]).toMatch(/img-2/);
    expect(imageOrder[2]).toMatch(/img-3/);
    expect(imageOrder).toEqual([
      expect.stringMatching(/img-1/),
      expect.stringMatching(/img-2/),
      expect.stringMatching(/img-3/),
      expect.stringMatching(/new:0/),
      expect.stringMatching(/new:1/),
    ]);
  });
});
