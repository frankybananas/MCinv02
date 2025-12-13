import { connectToDatabase } from '@/lib/mongodb';
import ClientRequest from '@/models/ClientRequest';
import VehicleMatch, { IVehicleMatch } from '@/models/VehicleMatch';
import Car from '@/models/Car';
import { calculateMatchScore } from './scoring';
import { Car as CarType } from '@/app/types';

export async function matchClientToInventory(clientRequestId: string): Promise<IVehicleMatch[]> {
  await connectToDatabase();
  
  const request = await ClientRequest.findById(clientRequestId);
  if (!request || !request.filters || request.status !== 'active') return [];
  
  // Find all available cars (Global Inventory)
  // We handle both case conventions just in case, though schema says lowercase enum
  const cars = await Car.find({ 
    status: { $in: ['in-stock', 'coming', 'In-Stock', 'Coming'] } 
  }).populate('images');
  
  const matches: IVehicleMatch[] = [];
  
  for (const car of cars) {
    // Map mongoose document to Car interface
    const carInterface: Partial<CarType> = {
      make: car.make,
      model: car.model,
      year: car.year,
      price: car.price,
      color: car.color,
      transmission: car.transmission,
      fuelType: car.fuelType,
      kilometers: car.kilometers || car.mileage,
      description: car.description,
      notes: car.notes,
      features: (car as any).features
    };
    
    const scoreResult = calculateMatchScore(carInterface, request.filters);
    
    if (scoreResult.totalScore >= 70) {
       // Handle image URL extraction safely
       let imageUrl: string | undefined;
       if (car.images && car.images.length > 0) {
         const firstImg = car.images[0];
         if (typeof firstImg === 'string') imageUrl = firstImg;
         else if (firstImg && typeof firstImg === 'object' && 'imageUrl' in firstImg) {
           imageUrl = (firstImg as any).imageUrl;
         }
       }

       const match = await VehicleMatch.findOneAndUpdate(
         { request: request._id, car: car._id },
         {
           request: request._id,
           car: car._id,
           createdByPhone: request.createdByPhone,
           score: scoreResult.totalScore,
           quality: scoreResult.quality,
           breakdown: scoreResult.breakdown,
           // We don't overwrite status if it exists, unless we want to revive?
           // For now, let's setDefaultsOnInsert handle 'new'. 
           // But if score updates, we might want to notify again? 
           // Let's keep status as is if exists.
           carSnapshot: {
             make: car.make,
             model: car.model,
             year: car.year,
             price: car.price,
             color: car.color,
             status: car.status,
             imageUrl
           }
         },
         { upsert: true, new: true, setDefaultsOnInsert: true }
       );
       matches.push(match);
    }
  }
  
  // Update request match metadata
  request.aiParsing = {
    ...request.aiParsing,
    matchCount: matches.length,
    lastMatchedAt: new Date()
  };
  await request.save();
  
  return matches;
}

export async function matchInventoryToClients(carId: string): Promise<IVehicleMatch[]> {
  await connectToDatabase();
  
  const car = await Car.findById(carId).populate('images');
  if (!car) return [];
  
  // Only match if car is available
  const status = car.status.toLowerCase();
  if (status !== 'in-stock' && status !== 'coming') return [];
  
  // Find all active client requests
  const requests = await ClientRequest.find({ status: 'active' });
  
  const matches: IVehicleMatch[] = [];
  
  const carInterface: Partial<CarType> = {
    make: car.make,
    model: car.model,
    year: car.year,
    price: car.price,
    color: car.color,
    transmission: car.transmission,
    fuelType: car.fuelType,
    kilometers: car.kilometers || car.mileage,
    description: car.description,
    notes: car.notes,
    features: (car as any).features
  };
  
  for (const request of requests) {
    if (!request.filters) continue;
    
    const scoreResult = calculateMatchScore(carInterface, request.filters);
    
    if (scoreResult.totalScore >= 70) {
       let imageUrl: string | undefined;
       if (car.images && car.images.length > 0) {
         const firstImg = car.images[0];
         if (typeof firstImg === 'string') imageUrl = firstImg;
         else if (firstImg && typeof firstImg === 'object' && 'imageUrl' in firstImg) {
           imageUrl = (firstImg as any).imageUrl;
         }
       }

       const match = await VehicleMatch.findOneAndUpdate(
         { request: request._id, car: car._id },
         {
           request: request._id,
           car: car._id,
           createdByPhone: request.createdByPhone,
           score: scoreResult.totalScore,
           quality: scoreResult.quality,
           breakdown: scoreResult.breakdown,
           carSnapshot: {
             make: car.make,
             model: car.model,
             year: car.year,
             price: car.price,
             color: car.color,
             status: car.status,
             imageUrl
           }
         },
         { upsert: true, new: true, setDefaultsOnInsert: true }
       );
       matches.push(match);
       
       // Update request match metadata (increment count?)
       // Note: this is expensive to do one by one. ideally batch.
       // But we just matched ONE car.
       // The count should be total matches.
       // We can just increment matchCount if it was a new match.
       // But strictly, we should count distinct matches.
       // Let's leave it for now or run an aggregation later.
       // Or update matchCount:
       const count = await VehicleMatch.countDocuments({ request: request._id });
       request.aiParsing = {
         ...request.aiParsing,
         matchCount: count,
         lastMatchedAt: new Date()
       };
       await request.save();
    }
  }
  
  return matches;
}
