import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { AddEditCar } from '@/app/components/add-edit-car';
import type { Car } from '@/app/types';
jest.mock('@/app/components/image-compression.client', () => ({
  __esModule: true,
  compressImage: jest.fn(async (f: File) => f),
}));

type Props = React.ComponentProps<typeof AddEditCar>;

describe('AddEditCar image interactions', () => {
  beforeAll(() => {
    // Ensure object URL is available in this test file when run in isolation
    // @ts-ignore
    if (!global.URL.createObjectURL) {
      // @ts-ignore
      global.URL.createObjectURL = jest.fn(() => 'blob:mock');
    }
  });
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

  // Reordering removed on mobile and desktop; manual ordering is not supported.

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

    const tiles = await screen.findAllByTestId('car-image-tile');
    expect(tiles.length).toBeGreaterThanOrEqual(5);

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

  it('moves selected image to first when using Set as Cover', async () => {
    render(<AddEditCar {...baseProps()} />);

    // Initially, first tile should be img-1
    const before = screen.getAllByTestId('car-image-tile');
    expect(before[0]).toHaveAttribute('data-image-id', expect.stringContaining('img-1'));

    // Open role modal on second image (img-2)
    const editBtn = within(before[1]).getByRole('button', { name: /edit image roles/i });
    fireEvent.click(editBtn);

    // Click Set as Cover
    const setCover = await screen.findByRole('button', { name: /set as cover/i });
    fireEvent.click(setCover);

    // After action, first tile should now be img-2
    const after = screen.getAllByTestId('car-image-tile');
    expect(after[0]).toHaveAttribute('data-image-id', expect.stringContaining('img-2'));
  });

  it('persists new order after Set as Cover on save', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<AddEditCar {...baseProps({ onSave })} />);

    // Make second image cover
    const tiles = screen.getAllByTestId('car-image-tile');
    const editBtn = within(tiles[1]).getByRole('button', { name: /edit image roles/i });
    fireEvent.click(editBtn);
    const setCover = await screen.findByRole('button', { name: /set as cover/i });
    fireEvent.click(setCover);

    // Save
    fireEvent.click(screen.getByRole('button', { name: /save car/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const formDataArg = onSave.mock.calls[0][0] as FormData;
    const entries = Array.from(formDataArg.entries());
    const imageOrder = entries.filter(([key]) => key === 'imageOrder').map(([, value]) => String(value));

    // New order should start with img-2 then img-1 then img-3
    expect(imageOrder.slice(0, 3)).toEqual([
      expect.stringContaining('img-2'),
      expect.stringContaining('img-1'),
      expect.stringContaining('img-3'),
    ]);
  });

  it('moves selected image to last when using Mark as VIN', async () => {
    render(<AddEditCar {...baseProps()} />);

    // Initially, last tile should be img-3
    const before = screen.getAllByTestId('car-image-tile');
    expect(before[2]).toHaveAttribute('data-image-id', expect.stringContaining('img-3'));

    // Open role modal on first image (img-1)
    const editBtn = within(before[0]).getByRole('button', { name: /edit image roles/i });
    fireEvent.click(editBtn);

    // Click Mark as VIN
    const setVin = await screen.findByRole('button', { name: /mark as vin/i });
    fireEvent.click(setVin);

    // After action, last tile should now be img-1
    const after = screen.getAllByTestId('car-image-tile');
    expect(after[2]).toHaveAttribute('data-image-id', expect.stringContaining('img-1'));
  });

  it('displays VIN badge on VIN-marked image', async () => {
    render(<AddEditCar {...baseProps()} />);

    // Open role modal on first image
    const tiles = screen.getAllByTestId('car-image-tile');
    const editBtn = within(tiles[0]).getByRole('button', { name: /edit image roles/i });
    fireEvent.click(editBtn);

    // Click Mark as VIN
    const setVin = await screen.findByRole('button', { name: /mark as vin/i });
    fireEvent.click(setVin);

    // Check VIN badge appears
    const vinBadge = screen.getByText('VIN');
    expect(vinBadge).toBeInTheDocument();
  });

  it('persists VIN index on save', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<AddEditCar {...baseProps({ onSave })} />);

    // Mark second image as VIN
    const tiles = screen.getAllByTestId('car-image-tile');
    const editBtn = within(tiles[1]).getByRole('button', { name: /edit image roles/i });
    fireEvent.click(editBtn);
    const setVin = await screen.findByRole('button', { name: /mark as vin/i });
    fireEvent.click(setVin);

    // Save
    fireEvent.click(screen.getByRole('button', { name: /save car/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const formDataArg = onSave.mock.calls[0][0] as FormData;
    const entries = Array.from(formDataArg.entries());
    const vinIndex = entries.find(([key]) => key === 'vinImageIndex')?.[1];

    // VIN should be at last position (index 2)
    expect(vinIndex).toBe('2');
  });

  it('persists cover index on save', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<AddEditCar {...baseProps({ onSave })} />);

    // Mark second image as cover
    const tiles = screen.getAllByTestId('car-image-tile');
    const editBtn = within(tiles[1]).getByRole('button', { name: /edit image roles/i });
    fireEvent.click(editBtn);
    const setCover = await screen.findByRole('button', { name: /set as cover/i });
    fireEvent.click(setCover);

    // Save
    fireEvent.click(screen.getByRole('button', { name: /save car/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const formDataArg = onSave.mock.calls[0][0] as FormData;
    const entries = Array.from(formDataArg.entries());
    const coverIndex = entries.find(([key]) => key === 'coverImageIndex')?.[1];

    // Cover should be at first position (index 0)
    expect(coverIndex).toBe('0');
  });

  it('moves image up when Move Up button is clicked', async () => {
    render(<AddEditCar {...baseProps()} />);

    // Initially, second tile should be img-2
    const before = screen.getAllByTestId('car-image-tile');
    expect(before[1]).toHaveAttribute('data-image-id', expect.stringContaining('img-2'));

    // Open role modal on second image (img-2)
    const editBtn = within(before[1]).getByRole('button', { name: /edit image roles/i });
    fireEvent.click(editBtn);

    // Click Move Up
    const moveUp = await screen.findByRole('button', { name: /move up/i });
    fireEvent.click(moveUp);

    // After action, first tile should now be img-2
    const after = screen.getAllByTestId('car-image-tile');
    expect(after[0]).toHaveAttribute('data-image-id', expect.stringContaining('img-2'));
  });

  it('moves image down when Move Down button is clicked', async () => {
    render(<AddEditCar {...baseProps()} />);

    // Initially, first tile should be img-1
    const before = screen.getAllByTestId('car-image-tile');
    expect(before[0]).toHaveAttribute('data-image-id', expect.stringContaining('img-1'));

    // Open role modal on first image (img-1)
    const editBtn = within(before[0]).getByRole('button', { name: /edit image roles/i });
    fireEvent.click(editBtn);

    // Click Move Down
    const moveDown = await screen.findByRole('button', { name: /move down/i });
    fireEvent.click(moveDown);

    // After action, second tile should now be img-1
    const after = screen.getAllByTestId('car-image-tile');
    expect(after[1]).toHaveAttribute('data-image-id', expect.stringContaining('img-1'));
  });

  it('disables Move Up on first image', async () => {
    render(<AddEditCar {...baseProps()} />);

    const tiles = screen.getAllByTestId('car-image-tile');
    const editBtn = within(tiles[0]).getByRole('button', { name: /edit image roles/i });
    fireEvent.click(editBtn);

    const moveUp = await screen.findByRole('button', { name: /move up/i });
    expect(moveUp).toBeDisabled();
  });

  it('disables Move Down on last image', async () => {
    render(<AddEditCar {...baseProps()} />);

    const tiles = screen.getAllByTestId('car-image-tile');
    const editBtn = within(tiles[2]).getByRole('button', { name: /edit image roles/i });
    fireEvent.click(editBtn);

    const moveDown = await screen.findByRole('button', { name: /move down/i });
    expect(moveDown).toBeDisabled();
  });

  it('maintains cover and VIN positions when reordering middle images', async () => {
    const carWithFourImages: Car = {
      ...defaultCar,
      images: [
        { _id: 'img-1', title: 'Cover', imageUrl: 'https://example.com/1.jpg', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' },
        { _id: 'img-2', title: 'Middle1', imageUrl: 'https://example.com/2.jpg', createdAt: '2024-01-02T00:00:00.000Z', updatedAt: '2024-01-02T00:00:00.000Z' },
        { _id: 'img-3', title: 'Middle2', imageUrl: 'https://example.com/3.jpg', createdAt: '2024-01-03T00:00:00.000Z', updatedAt: '2024-01-03T00:00:00.000Z' },
        { _id: 'img-4', title: 'VIN', imageUrl: 'https://example.com/4.jpg', createdAt: '2024-01-04T00:00:00.000Z', updatedAt: '2024-01-04T00:00:00.000Z' },
      ],
      coverImageIndex: 0,
      vinImageIndex: 3,
    };

    render(<AddEditCar {...baseProps({ car: carWithFourImages })} />);

    // Verify initial state
    const tiles = screen.getAllByTestId('car-image-tile');
    expect(tiles).toHaveLength(4);
    expect(tiles[0]).toHaveAttribute('data-image-id', expect.stringContaining('img-1'));
    expect(tiles[3]).toHaveAttribute('data-image-id', expect.stringContaining('img-4'));

    // Move middle image up
    const editBtn = within(tiles[2]).getByRole('button', { name: /edit image roles/i });
    fireEvent.click(editBtn);
    const moveUp = await screen.findByRole('button', { name: /move up/i });
    fireEvent.click(moveUp);

    // Verify cover and VIN are still in correct positions
    const afterMove = screen.getAllByTestId('car-image-tile');
    expect(afterMove[0]).toHaveAttribute('data-image-id', expect.stringContaining('img-1'));
    expect(afterMove[3]).toHaveAttribute('data-image-id', expect.stringContaining('img-4'));

    // Verify badges are still present
    expect(screen.getByText('Cover')).toBeInTheDocument();
    expect(screen.getByText('VIN')).toBeInTheDocument();
  });

  it('unsets cover when marking cover image as VIN', async () => {
    const carWithCover: Car = {
      ...defaultCar,
      coverImageIndex: 0,
    };

    render(<AddEditCar {...baseProps({ car: carWithCover })} />);

    // Open role modal on first image (which is cover)
    const tiles = screen.getAllByTestId('car-image-tile');
    const editBtn = within(tiles[0]).getByRole('button', { name: /edit image roles/i });
    fireEvent.click(editBtn);

    // Click Mark as VIN
    const setVin = await screen.findByRole('button', { name: /mark as vin/i });
    fireEvent.click(setVin);

    // Verify VIN badge appears but Cover badge is gone from that image
    const vinBadge = screen.getByText('VIN');
    expect(vinBadge).toBeInTheDocument();
    
    // There should be no Cover badge since we unset it
    const coverBadges = screen.queryAllByText('Cover');
    expect(coverBadges.length).toBe(0);
  });

  // Reordering delay/threshold tests removed.

  // Reordering cancellation test removed.

  // Reordering small-movement test removed.
});
