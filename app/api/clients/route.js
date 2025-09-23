import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Client from '@/models/Client';
import Phone from '@/models/Phone'; 
import Car from '@/models/Car'; // Ensure Car model is registered
import Document from '@/models/Document'; // Ensure Document model is registered
import ClientRequest from '@/models/ClientRequest';
import Match from '@/models/Match';
import User from '@/models/User';
import { parseNotesToRequest } from '@/lib/parse-request';
import { buildRequestText, embedText, explainMatchShort } from '@/lib/embeddings';
import { upsertRequestVector, searchCarsByVector } from '@/lib/vector-store';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';

// The middleware now handles all authentication. 
// These routes will only be reached if the user has a valid session token.

export async function GET() {
  try {
    await connectToDatabase();
    // Verify user and apply role-based filtering
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    const jwtSecret = process.env.JWT_SECRET;

    if (!token || !jwtSecret) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    let role = 'user';
    let phone = '';
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(jwtSecret));
      role = (payload.role ?? 'user');
      phone = (payload.phone ?? '');
    } catch (_) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const isPrivileged = role === 'admin' || role === 'manager';
    const query = isPrivileged ? {} : { createdByPhone: phone };
    const clients = await Client.find(query).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: clients });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await connectToDatabase();
    const body = await request.json();

    // Verify user creating the client
    const cookieStore = await cookies();
    const token = cookieStore.get('session_token')?.value;
    const jwtSecret = process.env.JWT_SECRET;
    if (!token || !jwtSecret) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    let phone = '';
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(jwtSecret));
      phone = (payload.phone ?? '');
    } catch (_) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    Object.keys(body).forEach(key => {
      if (body[key] === '') delete body[key];
    });
    
    if (body.phone) {
      let phoneNumber = body.phone.trim();
      if (phoneNumber.startsWith('0')) {
        phoneNumber = `+27${phoneNumber.substring(1)}`;
      }
      body.phone = phoneNumber;
    }

    // Set owner of client to the creator's phone
    body.createdByPhone = phone;

    const client = await Client.create(body);
    
    // Auto-seed a ClientRequest from Notes, if present and looks like a buying intent
    const notes = (body?.notes || '').trim();
    if (typeof notes === 'string' && notes.length >= 10) {
      try {
        const parsed = await parseNotesToRequest(notes);
        if (parsed && parsed.filters) {
          const requestText = buildRequestText({ freeText: parsed.freeText, filters: parsed.filters });
          const vector = await embedText(requestText);
          // Create request doc
          const reqDoc = await ClientRequest.create({
            client: client._id,
            createdByPhone: client.createdByPhone || phone,
            title: parsed.title,
            freeText: parsed.freeText,
            status: 'active',
            filters: parsed.filters,
            requestText,
            embeddingVector: vector,
            embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
            lastEmbeddedAt: new Date(),
            source: 'notes',
          });

          // Upsert into vector store
          const tolBudget = (parsed.filters?.maxBudgetZar ? Number(parsed.filters.maxBudgetZar) * 1.2 : undefined);
          const tolMileage = (parsed.filters?.maxMileageKm ? Number(parsed.filters.maxMileageKm) * 1.2 : undefined);
          await upsertRequestVector(String(reqDoc._id), vector, {
            requestId: String(reqDoc._id),
            clientId: String(client._id),
            createdByPhone: client.createdByPhone || phone,
            status: 'active',
            maxBudgetZar: typeof tolBudget === 'number' ? tolBudget : undefined,
            maxMileageKm: typeof tolMileage === 'number' ? tolMileage : undefined,
            seats: typeof parsed.filters?.seats === 'number' ? parsed.filters.seats : undefined,
            makes: Array.isArray(parsed.filters?.makes) ? parsed.filters.makes : undefined,
            models: Array.isArray(parsed.filters?.models) ? parsed.filters.models : undefined,
          });

          // Only run matching if the owner's matching is enabled
          try {
            const ownerPhone = client.createdByPhone || phone;
            const owner = await User.findOne({ phone: ownerPhone }).select('matchingEnabled');
            if (!owner || owner.matchingEnabled !== false) {
              // Search cars for this single request
              const results = await searchCarsByVector(vector, {
                topK: 60,
                threshold: 0.78,
                excludeSold: true,
                maxBudgetZar: typeof tolBudget === 'number' ? tolBudget : undefined,
                maxMileageKm: typeof tolMileage === 'number' ? tolMileage : undefined,
                seats: typeof parsed.filters?.seats === 'number' ? parsed.filters.seats : undefined,
              });
              const top = results.slice(0, 10);
              for (const r of top) {
                const carId = r.id || r.point?.id || r.payload?.carId;
                if (!carId) continue;
                try {
                  const car = await Car.findById(carId).populate('images');
                  if (!car) continue;
                  const explanation = await explainMatchShort(car, { freeText: parsed.freeText, filters: parsed.filters });
                  await Match.updateOne(
                    { request: reqDoc._id, car: car._id },
                    {
                      $setOnInsert: {
                        request: reqDoc._id,
                        car: car._id,
                        client: client._id,
                        createdByPhone: client.createdByPhone || phone,
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
          } catch {}
        }
      } catch (e) {
        console.warn('Auto-seed from notes failed:', e?.message || e);
      }
    }
    
    return NextResponse.json({ success: true, data: client }, { status: 201 });
  } catch (error) {
    console.error('Clients API POST Error:', error);
    return NextResponse.json({ success: false, message: 'Failed to create client.', error: error.message }, { status: 500 });
  }
}

