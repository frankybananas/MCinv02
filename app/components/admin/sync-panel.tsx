"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle, AlertCircle, Clock, Loader2 } from "lucide-react";

interface SyncStatus {
  lastSync: {
    status: string;
    lastRunAt: string | null;
    lastSuccessAt: string | null;
    lastErrorAt: string | null;
    message: string | null;
    durationMs: number | null;
  } | null;
  lastSuccessfulSync: {
    startedAt: string;
    completedAt: string;
    vehiclesAdded: number;
    vehiclesUpdated: number;
    vehiclesFlagged: number;
    totalFetched: number;
    durationMs: number | null;
  } | null;
  inventory: {
    totalSynced: number;
    totalNew: number;
    totalMissing: number;
  };
}

interface SyncLog {
  _id: string;
  startedAt: string;
  completedAt?: string;
  status: string;
  vehiclesAdded: number;
  vehiclesUpdated: number;
  vehiclesFlagged: number;
  totalFetched: number;
  syncErrors: string[];
  durationMs?: number;
  triggeredBy: string;
}

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatRelative(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "Just now";
}

function statusBadge(status: string) {
  if (status === "success") return <Badge className="bg-green-100 text-green-800 border-green-300 text-xs">✓ Success</Badge>;
  if (status === "error") return <Badge className="bg-red-100 text-red-800 border-red-300 text-xs">✗ Error</Badge>;
  if (status === "running") return <Badge className="bg-blue-100 text-blue-800 border-blue-300 text-xs">⟳ Running</Badge>;
  return <Badge variant="secondary" className="text-xs">{status}</Badge>;
}

export default function SyncPanel() {
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<{ success: boolean; message?: string; vehiclesAdded?: number; vehiclesUpdated?: number; vehiclesFlagged?: number; syncErrors?: string[] } | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const [statusRes, logsRes] = await Promise.all([
        fetch("/api/sync/status"),
        fetch("/api/sync/logs?limit=5"),
      ]);
      if (statusRes.ok) {
        const data = await statusRes.json();
        setSyncStatus(data);
      }
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(Array.isArray(data.logs) ? data.logs : []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleTrigger = async () => {
    setTriggering(true);
    setTriggerResult(null);
    try {
      const res = await fetch("/api/sync/trigger", { method: "POST" });
      const data = await res.json();
      setTriggerResult({
        success: data.success,
        message: data.message,
        vehiclesAdded: data.vehiclesAdded,
        vehiclesUpdated: data.vehiclesUpdated,
        vehiclesFlagged: data.vehiclesFlagged,
        syncErrors: data.syncErrors,
      });
      await loadStatus();
    } catch {
      setTriggerResult({ success: false, message: "Network error" });
    } finally {
      setTriggering(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
            e-Toyota Stock Sync
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={handleTrigger}
            disabled={triggering}
            className="h-8 text-xs"
          >
            {triggering ? (
              <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Syncing…</>
            ) : (
              <><RefreshCw className="w-3 h-3 mr-1" /> Sync Now</>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {triggerResult && (
          <div className={`p-3 rounded-md text-sm ${triggerResult.success ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
            {triggerResult.success ? (
              <div className="space-y-1">
                <span>
                  ✓ Sync complete — <strong>+{triggerResult.vehiclesAdded ?? 0}</strong> added,{" "}
                  <strong>~{triggerResult.vehiclesUpdated ?? 0}</strong> updated,{" "}
                  <strong>⚠{triggerResult.vehiclesFlagged ?? 0}</strong> flagged missing
                </span>
                {triggerResult.syncErrors && triggerResult.syncErrors.length > 0 && (
                  <div className="mt-1 pt-1 border-t border-green-300">
                    <p className="font-semibold text-amber-700">⚠ {triggerResult.syncErrors.length} partial error(s):</p>
                    <ul className="mt-0.5 space-y-0.5 text-amber-800 text-xs">
                      {triggerResult.syncErrors.slice(0, 3).map((e, i) => (
                        <li key={i} className="truncate">{e}</li>
                      ))}
                      {triggerResult.syncErrors.length > 3 && (
                        <li className="text-amber-600">…and {triggerResult.syncErrors.length - 3} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <span>✗ Sync failed: {triggerResult.message}</span>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading sync status…
          </div>
        ) : (
          <>
            {/* Inventory summary */}
            {syncStatus?.inventory && (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-xl font-bold">{syncStatus.inventory.totalSynced}</p>
                  <p className="text-xs text-muted-foreground">Synced Cars</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-xl font-bold text-green-700">{syncStatus.inventory.totalNew}</p>
                  <p className="text-xs text-muted-foreground">New (unreviewed)</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3">
                  <p className="text-xl font-bold text-amber-700">{syncStatus.inventory.totalMissing}</p>
                  <p className="text-xs text-muted-foreground">Missing from stock</p>
                </div>
              </div>
            )}

            {/* Last sync info */}
            {syncStatus?.lastSync ? (
              <div className="text-xs space-y-1 text-muted-foreground border rounded-md p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-foreground">Last sync run</span>
                  {statusBadge(syncStatus.lastSync.status)}
                </div>
                <div className="flex justify-between">
                  <span>Run at</span>
                  <span>{syncStatus.lastSync.lastRunAt ? new Date(syncStatus.lastSync.lastRunAt).toLocaleString() : "—"}</span>
                </div>
                {syncStatus.lastSync.message && (
                  <div className="flex justify-between">
                    <span>Summary</span>
                    <span className="text-right max-w-[60%]">{syncStatus.lastSync.message}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Duration</span>
                  <span>{formatDuration(syncStatus.lastSync.durationMs)}</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <Clock className="w-4 h-4" /> No sync has run yet.
              </div>
            )}

            {/* Recent logs */}
            {logs.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Recent Runs</p>
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log._id} className="flex items-center justify-between text-xs border rounded px-3 py-2">
                      <div className="flex items-center gap-2">
                        {log.status === "success" ? (
                          <CheckCircle className="w-3 h-3 text-green-600 flex-shrink-0" />
                        ) : log.status === "error" ? (
                          <AlertCircle className="w-3 h-3 text-red-600 flex-shrink-0" />
                        ) : (
                          <Loader2 className="w-3 h-3 text-blue-600 flex-shrink-0 animate-spin" />
                        )}
                        <span className="text-muted-foreground">{formatRelative(log.startedAt)}</span>
                        <Badge variant="outline" className="text-[10px] h-4 px-1">{log.triggeredBy}</Badge>
                      </div>
                      <div className="text-muted-foreground text-right">
                        {log.status === "success"
                          ? `+${log.vehiclesAdded} ~${log.vehiclesUpdated} ⚠${log.vehiclesFlagged}`
                          : log.syncErrors?.[0]?.substring(0, 40) ?? "—"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Scheduled: daily at 7:00 AM and 1:00 PM SAST via Coolify cron.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
