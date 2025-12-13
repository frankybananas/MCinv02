import { calculateMatchScore } from '@/lib/matching/scoring';
import { Car } from '@/app/types';

describe('Scoring Algorithm', () => {
  const mockCar: Partial<Car> = {
    make: 'Toyota',
    model: 'Corolla',
    year: 2021,
    price: 450000,
    color: 'White',
    transmission: 'automatic',
    kilometers: 50000,
    fuelType: 'Petrol'
  };

  it('should calculate perfect score for exact match', () => {
    const criteria = {
      makes: ['Toyota'],
      models: ['Corolla'],
      minYear: 2020,
      maxBudgetZar: 500000,
      colors: ['White'],
      transmissions: ['Automatic'],
      fuelTypes: ['Petrol'],
      maxMileageKm: 100000
    };

    const result = calculateMatchScore(mockCar, criteria);
    expect(result.totalScore).toBe(100);
    expect(result.quality).toBe('excellent');
  });

  it('should handle partial matches', () => {
    const criteria = {
      makes: ['Toyota'],
      models: ['Hilux'], // Mismatch
      minYear: 2020,
      maxBudgetZar: 500000
    };

    const result = calculateMatchScore(mockCar, criteria);
    // Make: 25
    // Model: 0
    // Year: 15
    // Price: 15
    // Color: 10 (not specified)
    // Other: 10 (not specified)
    // Total: 75
    expect(result.totalScore).toBe(75);
    expect(result.quality).toBe('good');
  });

  it('should handle no criteria', () => {
    const criteria = {};
    const result = calculateMatchScore(mockCar, criteria);
    expect(result.totalScore).toBe(100); // Matches everything if nothing specified
  });

  it('should score mustHave terms against car text', () => {
    const criteria = { mustHave: ['Double Cab'] };

    const matchingCar: Partial<Car> = {
      ...mockCar,
      notes: 'Double Cab'
    };
    const matchResult = calculateMatchScore(matchingCar, criteria);
    expect(matchResult.totalScore).toBe(100);

    const nonMatchingCar: Partial<Car> = {
      ...mockCar,
      notes: ''
    };
    const nonMatchResult = calculateMatchScore(nonMatchingCar, criteria);
    expect(nonMatchResult.totalScore).toBe(90);
  });
});
