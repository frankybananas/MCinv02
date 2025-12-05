import { Car } from '@/app/types';
import { ParsedCriteria } from '@/lib/ai/gemini-parser';

export interface ScoreResult {
  totalScore: number;
  breakdown: {
    makeScore: number;
    modelScore: number;
    yearScore: number;
    priceScore: number;
    colorScore: number;
    otherScore: number;
  };
  quality: 'excellent' | 'good' | 'fair';
}

const WEIGHTS = {
  MAKE: 25,
  MODEL: 25,
  YEAR: 15,
  PRICE: 15,
  COLOR: 10,
  OTHER: 10
};

export const calculateMatchScore = (car: Partial<Car>, criteria: ParsedCriteria['filters']): ScoreResult => {
  let makeScore = 0;
  let modelScore = 0;
  let yearScore = 0;
  let priceScore = 0;
  let colorScore = 0;
  let otherScore = 0;

  // 1. Make (25 points)
  if (criteria.makes && criteria.makes.length > 0) {
    if (car.make && criteria.makes.some(m => car.make!.toLowerCase().includes(m.toLowerCase()))) {
      makeScore = WEIGHTS.MAKE;
    }
  } else {
    // If no make specified, full points (neutral - assumed acceptable)
    makeScore = WEIGHTS.MAKE;
  }

  // 2. Model (25 points)
  if (criteria.models && criteria.models.length > 0) {
    if (car.model && criteria.models.some(m => car.model!.toLowerCase().includes(m.toLowerCase()))) {
      modelScore = WEIGHTS.MODEL;
    }
  } else {
    modelScore = WEIGHTS.MODEL;
  }

  // 3. Year (15 points)
  const minYear = criteria.minYear || 0;
  const maxYear = criteria.maxYear || 9999;
  if (car.year && car.year >= minYear && car.year <= maxYear) {
    yearScore = WEIGHTS.YEAR;
  }

  // 4. Price (15 points)
  const minBudget = criteria.minBudgetZar || 0;
  const maxBudget = criteria.maxBudgetZar || Infinity;
  if (car.price && car.price >= minBudget && car.price <= maxBudget) {
    priceScore = WEIGHTS.PRICE;
  }

  // 5. Color (10 points)
  if (criteria.colors && criteria.colors.length > 0) {
    if (car.color && criteria.colors.some(c => car.color!.toLowerCase().includes(c.toLowerCase()))) {
      colorScore = WEIGHTS.COLOR;
    }
  } else {
    colorScore = WEIGHTS.COLOR;
  }

  // 6. Other (10 points)
  let otherMatches = 0;
  let otherTotal = 0;

  if (criteria.transmissions && criteria.transmissions.length > 0) {
    otherTotal++;
    if (car.transmission && criteria.transmissions.some(t => car.transmission!.toLowerCase().includes(t.toLowerCase()))) {
      otherMatches++;
    }
  }

  if (criteria.fuelTypes && criteria.fuelTypes.length > 0) {
    otherTotal++;
    if (car.fuelType && criteria.fuelTypes.some(f => car.fuelType!.toLowerCase().includes(f.toLowerCase()))) {
      otherMatches++;
    }
  }

  if (criteria.maxMileageKm) {
    otherTotal++;
    if (car.kilometers && car.kilometers <= criteria.maxMileageKm) {
      otherMatches++;
    }
  }

  if (otherTotal > 0) {
    otherScore = (otherMatches / otherTotal) * WEIGHTS.OTHER;
  } else {
    otherScore = WEIGHTS.OTHER;
  }

  // Round otherScore
  otherScore = Math.round(otherScore * 10) / 10;

  const totalScore = Math.round(makeScore + modelScore + yearScore + priceScore + colorScore + otherScore);

  let quality: 'excellent' | 'good' | 'fair' = 'fair';
  if (totalScore >= 85) quality = 'excellent';
  else if (totalScore >= 70) quality = 'good';

  return {
    totalScore,
    breakdown: {
      makeScore,
      modelScore,
      yearScore,
      priceScore,
      colorScore,
      otherScore
    },
    quality
  };
};
