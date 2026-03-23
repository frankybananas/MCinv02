import { connectToDatabase } from '@/lib/mongodb';
import { markCronRunning, markCronSuccess, markCronError } from '@/lib/cron-metadata';
import { fetchUsedStock } from './stock';
import { mapVehicleToNewCar, mapVehicleToMutableFields, extractVinSuffix } from './mapper';
import type { EToyotaVehicle } from './types';
import SyncLog from '@/models/SyncLog';

export interface SyncResult {
  vehiclesAdded: number;
  vehiclesUpdated: number;
  vehiclesFlagged: number;
  vehiclesReturned: number;
  totalFetched: number;
  syncErrors: string[];
  durationMs: number;
}

const MUTABLE_FIELDS = [
  'kilometers',
  'daysInStock',
  'price',
  'etoyotaStatusId',
  'etoyotaImageCount',
];

export async function runSync(triggeredBy: 'cron' | 'manual'): Promise<SyncResult> {
  const startedAt = Date.now();

  await connectToDatabase();

  const Car = (await import('@/models/Car')).default;

  const logEntry = await SyncLog.create({
    startedAt: new Date(),
    status: 'running',
    triggeredBy,
  });

  if (triggeredBy === 'cron') {
    try {
      await markCronRunning('etoyota-sync');
    } catch {
      // non-fatal
    }
  }

  const result: SyncResult = {
    vehiclesAdded: 0,
    vehiclesUpdated: 0,
    vehiclesFlagged: 0,
    vehiclesReturned: 0,
    totalFetched: 0,
    syncErrors: [],
    durationMs: 0,
  };

  try {
    const { vehicles, totalCount } = await fetchUsedStock();
    result.totalFetched = totalCount;

    // Build lookup maps from API response
    const apiById = new Map<number, EToyotaVehicle>();
    const apiByVinSuffix = new Map<string, EToyotaVehicle>();

    for (const v of vehicles) {
      if (v.Id) apiById.set(v.Id, v);
      const suffix = extractVinSuffix(v.DMSStockNumber ?? '');
      if (suffix) apiByVinSuffix.set(suffix, v);
    }

    // Load all existing cars from DB
    const existingCars = await Car.find({}).lean();

    // Track which etoyotaIds we have processed (to find missing ones)
    const processedEtoyotaIds = new Set<number>();

    for (const car of existingCars) {
      const c = car as any;

      // Try primary match: etoyotaId
      let apiVehicle: EToyotaVehicle | undefined;
      if (c.etoyotaId) {
        apiVehicle = apiById.get(c.etoyotaId);
        if (apiVehicle) processedEtoyotaIds.add(c.etoyotaId);
      }

      // Fallback match: last 5 of VIN against last 5 of DMSStockNumber
      if (!apiVehicle && c.vin && c.vin.length >= 5) {
        const vinSuffix = String(c.vin).slice(-5).toUpperCase();
        apiVehicle = apiByVinSuffix.get(vinSuffix);
        if (apiVehicle) {
          processedEtoyotaIds.add(apiVehicle.Id);
        }
      }

      if (apiVehicle) {
        // Car exists in API — update mutable fields
        const mutableFields = mapVehicleToMutableFields(apiVehicle);
        const manuallyEdited: string[] = Array.isArray(c.manuallyEditedFields)
          ? c.manuallyEditedFields
          : [];

        const updateSet: Record<string, unknown> = {
          etoyotaId: apiVehicle.Id,
          stockNumber: apiVehicle.DMSStockNumber ?? c.stockNumber,
          lastSyncedAt: new Date(),
          missingFromStock: false,
          dateFlaggedMissing: null,
        };

        // Only update mutable fields if user hasn't manually edited them
        for (const field of MUTABLE_FIELDS) {
          if (!manuallyEdited.includes(field)) {
            updateSet[field] = (mutableFields as unknown as Record<string, unknown>)[field];
          }
        }

        // Promote syncStatus from 'new' to 'synced' if it was 'new'
        if (c.syncStatus === 'new') {
          updateSet.syncStatus = 'synced';
        } else if (!c.syncStatus) {
          updateSet.syncStatus = 'synced';
        }

        try {
          await Car.updateOne({ _id: c._id }, { $set: updateSet });
          result.vehiclesUpdated++;
        } catch (err) {
          const msg = `Update failed for car ${c._id}: ${(err as Error).message}`;
          console.error(`[e-Toyota Sync] ${msg}`);
          result.syncErrors.push(msg);
        }
      } else if (c.etoyotaId) {
        // Car was previously synced but is no longer in API response — flag as missing
        if (!c.missingFromStock) {
          try {
            await Car.updateOne(
              { _id: c._id },
              {
                $set: {
                  missingFromStock: true,
                  dateFlaggedMissing: new Date(),
                },
              }
            );
            result.vehiclesFlagged++;
          } catch (err) {
            const msg = `Flag-missing failed for car ${c._id}: ${(err as Error).message}`;
            console.error(`[e-Toyota Sync] ${msg}`);
            result.syncErrors.push(msg);
          }
        }
        // If already flagged, do nothing (no need to increment)
      }
      // Cars with no etoyotaId and no VIN match → manual cars, leave untouched
    }

    // Find vehicles in API that were not matched to any existing car → create new placeholders
    for (const [etoyotaId, vehicle] of apiById) {
      if (processedEtoyotaIds.has(etoyotaId)) continue;

      try {
        const newCarData = mapVehicleToNewCar(vehicle);
        await Car.create({
          ...newCarData,
          lastSyncedAt: new Date(),
          auditLog: [
            {
              action: 'Car Created',
              details: `Auto-created by e-Toyota sync. Stock: ${vehicle.DMSStockNumber}`,
              user: 'system',
            },
          ],
        });
        result.vehiclesAdded++;
      } catch (err) {
        const msg = `Create failed for etoyotaId ${etoyotaId}: ${(err as Error).message}`;
        console.error(`[e-Toyota Sync] ${msg}`);
        result.syncErrors.push(msg);
      }
    }

    result.durationMs = Date.now() - startedAt;

    // Update sync log
    await SyncLog.updateOne(
      { _id: logEntry._id },
      {
        $set: {
          status: 'success',
          completedAt: new Date(),
          vehiclesAdded: result.vehiclesAdded,
          vehiclesUpdated: result.vehiclesUpdated,
          vehiclesFlagged: result.vehiclesFlagged,
          vehiclesReturned: result.vehiclesReturned,
          totalFetched: result.totalFetched,
          syncErrors: result.syncErrors,
          durationMs: result.durationMs,
        },
      }
    );

    if (triggeredBy === 'cron') {
      try {
        await markCronSuccess('etoyota-sync', {
          message: `+${result.vehiclesAdded} added, ~${result.vehiclesUpdated} updated, ⚠${result.vehiclesFlagged} flagged`,
          durationMs: result.durationMs,
        });
      } catch {
        // non-fatal
      }
    }

    return result;
  } catch (err) {
    result.durationMs = Date.now() - startedAt;
    const msg = (err as Error).message;
    result.syncErrors.push(msg);

    await SyncLog.updateOne(
      { _id: logEntry._id },
      {
        $set: {
          status: 'error',
          completedAt: new Date(),
          syncErrors: result.syncErrors,
          durationMs: result.durationMs,
        },
      }
    );

    if (triggeredBy === 'cron') {
      try {
        await markCronError('etoyota-sync', err, { durationMs: result.durationMs });
      } catch {
        // non-fatal
      }
    }

    throw err;
  }
}
