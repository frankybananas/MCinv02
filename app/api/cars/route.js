import { connectToDatabase } from '@/lib/mongodb';
import Car from '@/models/Car.js';
import Client from '@/models/Client';
import Picture from '@/models/Picture';
import ClientRequest from '@/models/ClientRequest';
import Match from '@/models/Match';
import { buildCarSearchText, embedText, explainMatchShort } from '@/lib/embeddings';
import { upsertCarVector, searchRequestsByVector } from '@/lib/vector-store';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

// The middleware now handles all authentication.

export async function GET() {
  try {
    await connectToDatabase();
    const cars = await Car.find({}).sort({ createdAt: -1 }).populate('owner').populate('images');
    const formattedCars = cars.map(car => ({
      ...car.toObject(),
      id: car._id.toString(),
    }));
    return NextResponse.json({ success: true, data: formattedCars });
  } catch (error) {
    console.error('Cars API GET Error:', error);
    return NextResponse.json({ success: false, message: 'Failed to fetch cars.', error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await connectToDatabase();
    const headersList = await headers();
    const userPhone = headersList.get('x-user-phone');
    const userName = headersList.get('x-user-name');
    // Ensure indexes are in sync (applies partial unique index for licensePlate)
    try {
      await Car.syncIndexes();
      // Extra: if existing index is incompatible, drop and recreate with partial filter
      const indexes = await Car.collection.indexes();
      const lp = indexes.find(i => i.name === 'licensePlate_1');
      const needsRecreate = lp && lp.unique && (!lp.partialFilterExpression || !lp.partialFilterExpression.licensePlate);
      if (needsRecreate) {
        try { await Car.collection.dropIndex('licensePlate_1'); } catch (e) { console.warn('dropIndex warning:', e?.message || e); }
        try {
          await Car.collection.createIndex(
            { licensePlate: 1 },
            { name: 'licensePlate_1', unique: true, partialFilterExpression: { licensePlate: { $type: 'string', $ne: '' } } }
          );
        } catch (e) { console.warn('createIndex warning:', e?.message || e); }
      }
    } catch (e) { console.warn('Car.syncIndexes warning:', e?.message || e); }
    const data = await request.formData();
    const carData = {};
    const files = data.getAll('images');

    for (const [key, value] of data.entries()) {
      if (key === 'images') continue;
      if (['year', 'price', 'kilometers'].includes(key)) {
        const num = key === 'price' ? Number(value) : parseInt(String(value), 10);
        if (!Number.isNaN(num)) carData[key] = num;
      } else {
        carData[key] = value;
      }
    }

    let newCar;
    try {
      newCar = await Car.create(carData);
    } catch (err) {
      // Handle duplicate key for licensePlate when it's null/empty due to legacy index
      if (err && err.code === 11000 && err.message?.includes('licensePlate')) {
        // Retry without licensePlate if none was provided
        if (!('licensePlate' in carData) || carData.licensePlate == null || carData.licensePlate === '') {
          const clone = { ...carData };
          delete clone.licensePlate;
          try {
            newCar = await Car.create(clone);
          } catch (e2) {
            throw err; // rethrow original
          }
        } else {
          throw err;
        }
      } else {
        throw err;
      }
    }
    // Record creation in audit log
    newCar.auditLog.push({
      action: 'Car Created',
      details: 'New car record created',
      user: userName || userPhone || 'unknown',
    });

    if (files && files.length > 0) {
      const newPictureIds = await Promise.all(files.filter(f => f.size > 0).map(async file => {
        const newFileName = `${uuidv4()}.${file.name.split('.').pop()}`;
        const { s3 } = await import('@/lib/s3');
        await s3.send(new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: newFileName,
          Body: Buffer.from(await file.arrayBuffer()),
          ContentType: file.type,
        }));
        const imageUrl = `${process.env.R2_PUBLIC_URL}/${newFileName}`;
        const newPicture = new Picture({ title: `${newCar.make} ${newCar.model}`, imageUrl, car: newCar._id });
        await newPicture.save();
        return newPicture._id;
      }));
      newCar.images.push(...newPictureIds);
      await newCar.save();
    }
    // Ensure audit entry persists even when there are no images uploaded
    if (!files || files.length === 0) {
      await newCar.save();
    }

    // --- Build embedding and index the new car ---
    try {
      const carDoc = await Car.findById(newCar._id)
      if (carDoc) {
        const searchText = buildCarSearchText(carDoc)
        const vector = await embedText(searchText)
        carDoc.searchText = searchText
        carDoc.embeddingVector = vector
        carDoc.embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small'
        carDoc.lastEmbeddedAt = new Date()
        await carDoc.save()

        await upsertCarVector(String(carDoc._id), vector, {
          carId: String(carDoc._id),
          status: carDoc.status,
          priceZar: typeof carDoc.price === 'number' ? carDoc.price : undefined,
          mileageKm: typeof carDoc.kilometers === 'number' ? carDoc.kilometers : undefined,
          seats: typeof carDoc.seats === 'number' ? carDoc.seats : undefined,
          make: carDoc.make,
          model: carDoc.model,
          year: carDoc.year,
          imageUrl: undefined,
        })

        // Search active client requests team-wide and create matches
        const results = await searchRequestsByVector(vector, {
          topK: 60,
          threshold: 0.78,
          requireMaxBudgetGte: typeof carDoc.price === 'number' ? carDoc.price : undefined,
          requireMaxMileageGte: typeof carDoc.kilometers === 'number' ? carDoc.kilometers : undefined,
          requireSeatsLte: typeof carDoc.seats === 'number' ? carDoc.seats : undefined,
        })
        const top = (results || []).slice(0, 10)
        for (const r of top) {
          const requestId = r.id || r.point?.id || r.payload?.requestId
          const clientId = r.payload?.clientId
          const ownerPhone = r.payload?.createdByPhone
          if (!requestId || !clientId) continue
          try {
            const explanation = await explainMatchShort(carDoc, { freeText: '', filters: {} })
            await Match.updateOne(
              { request: requestId, car: carDoc._id },
              {
                $setOnInsert: {
                  request: requestId,
                  car: carDoc._id,
                  client: clientId,
                  createdByPhone: ownerPhone || 'unknown',
                  status: 'new',
                  createdAt: new Date(),
                },
                $set: {
                  score: typeof r.score === 'number' ? r.score : 0,
                  explanation,
                  updatedAt: new Date(),
                },
              },
              { upsert: true }
            )
          } catch {}
        }
      }
    } catch (e) {
      console.warn('Car embedding/matching failed:', e?.message || e)
    }

    const populatedCar = await Car.findById(newCar._id).populate('owner').populate('images');
    return NextResponse.json({ success: true, data: populatedCar.toObject({ virtuals: true }) }, { status: 201 });
  } catch (error) {
    console.error('Cars API POST Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
