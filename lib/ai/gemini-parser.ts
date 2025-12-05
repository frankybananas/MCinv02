import { generateJson } from './gemini-client';

export interface ParsedCriteria {
  filters: {
    makes?: string[];
    models?: string[];
    minYear?: number;
    maxYear?: number;
    maxMileageKm?: number;
    minBudgetZar?: number;
    maxBudgetZar?: number;
    seats?: number;
    fuelTypes?: string[];
    transmissions?: string[];
    bodyTypes?: string[];
    colors?: string[];
    mustHave?: string[];
    niceToHave?: string[];
    excludeTerms?: string[];
  };
  confidence: number;
  ambiguities: string[];
}

const SYSTEM_PROMPT = `
You are an expert vehicle sales assistant. Your task is to parse a client's natural language request into structured search criteria for the South African market.

Extract the following fields into a 'filters' object:
- makes: List of manufacturers (e.g., "Toyota", "BMW"). Normalize to Title Case.
- models: List of models (e.g., "Hilux", "3 Series", "Polo"). Normalize to Title Case.
- minYear: Minimum year (number).
- maxYear: Maximum year (number).
- maxMileageKm: Maximum mileage in kilometers (number).
- minBudgetZar: Minimum budget in ZAR (number).
- maxBudgetZar: Maximum budget in ZAR (number).
- seats: Number of seats (number).
- fuelTypes: List from ["Petrol", "Diesel", "Electric", "Hybrid"].
- transmissions: List from ["Manual", "Automatic"].
- bodyTypes: List of body types (e.g., "SUV", "Sedan", "Hatchback", "Bakkie", "Coupe").
- colors: List of preferred colors.
- mustHave: List of mandatory features.
- niceToHave: List of optional features.
- excludeTerms: List of things the client explicitly does NOT want.

Also provide at the top level:
- confidence: A number between 0 and 1 indicating how confident you are in the parsing.
- ambiguities: A list of strings describing any ambiguous parts of the request or assumptions made.

Rules:
1. If a field is not mentioned, exclude it from the JSON or set to null.
2. Be smart about inferring ranges (e.g., "newer than 2020" -> minYear: 2021).
3. Handle "k" for thousands (e.g., "400k" -> 400000).
4. Handle "m" for millions (e.g., "1.2m" -> 1200000).
5. If the user asks for a specific car (e.g., "2023 Ford Ranger"), populate make, model, and year.
6. For "Bakkie", you can map bodyTypes to ["Bakkie", "Pickup"].
7. Infer fuel type if obvious (e.g., "GLC250d" -> diesel).

Output must be valid JSON matching the structure.
`;

export const parseClientRequest = async (text: string): Promise<ParsedCriteria> => {
  const prompt = `${SYSTEM_PROMPT}\n\nClient Request: "${text}"\n\nJSON Response:`;
  return generateJson<ParsedCriteria>(prompt);
};
