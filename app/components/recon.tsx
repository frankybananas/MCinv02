"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Delivery, ReconTask } from "@/app/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Recon() {
  const [items, setItems] = React.useState<Delivery[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reconUsers, setReconUsers] = React.useState<Array<{ _id: string; label: string }>>([]);
  const [assignee, setAssignee] = React.useState<string>("all");
  const [dueFilter, setDueFilter] = React.useState<string>("all");

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/deliveries?scope=recon");
      if (!res.ok) throw new Error("Failed to load recon queue");
      const j = await res.json();
      setItems(Array.isArray(j?.data) ? j.data : []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load recon queue");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
    (async () => {
      try {
        const r = await fetch('/api/users');
        if (!r.ok) return;
        const j = await r.json();
        const arr = Array.isArray(j?.data) ? j.data : [];
        const mapped = arr
          .filter((u: any) => String(u.role) === 'recon')
          .map((u: any) => ({ _id: String(u._id), label: `${u?.profile?.firstName ?? ''} ${u?.profile?.lastName ?? ''}`.trim() || (u.phone || 'Recon') }));
        setReconUsers(mapped);
      } catch {}
    })();
  }, [load]);

  const toggleTask = async (deliveryId: string, index: number) => {
    try {
      const d = items.find((x) => String(x._id) === String(deliveryId));
      if (!d) return;
      const tasks: ReconTask[] = Array.isArray(d.reconTasks) ? d.reconTasks.map((t) => ({ ...t })) : [];
      if (!tasks[index]) return;
      tasks[index] = { ...tasks[index], done: !tasks[index].done };
      const res = await fetch(`/api/deliveries/${deliveryId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reconTasks: tasks }),
      });
      if (res.ok) {
        const j = await res.json();
        const updated = j?.data as Delivery;
        setItems((prev) => prev.map((it) => (String(it._id) === String(deliveryId) ? updated : it)));
      }
    } catch {}
  };

  const formatDate = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString();
  };

  const taskMatchesFilters = (t: ReconTask): boolean => {
    // Assignee filter
    if (assignee !== 'all') {
      if (!t.assignee || String(t.assignee) !== assignee) return false;
    }
    // Due filter
    if (dueFilter === 'all') return true;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (!t.dueDate) return dueFilter === 'no_due';
    const due = new Date(t.dueDate);
    const ms = due.getTime();
    if (!Number.isFinite(ms)) return dueFilter === 'no_due';
    const diff = ms - today.getTime();
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    if (dueFilter === 'overdue') return !t.done && ms < today.getTime();
    if (dueFilter === 'due_soon') return !t.done && diff >= 0 && diff <= threeDays;
    if (dueFilter === 'due_today') return !t.done && due.toDateString() === today.toDateString();
    return true;
  };

  const onUploadAttachment = async (deliveryId: string, taskIndex: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/uploads', { method: 'POST', body: form });
    const j = await res.json();
    if (!res.ok) return;
    const d = items.find((x) => String(x._id) === String(deliveryId));
    if (!d) return;
    const tasks: ReconTask[] = Array.isArray(d.reconTasks) ? d.reconTasks.map((t) => ({ ...t })) : [];
    if (!tasks[taskIndex]) return;
    const atts = Array.isArray(tasks[taskIndex].attachments) ? tasks[taskIndex].attachments!.slice() : [];
    atts.push({ url: j?.data?.url, key: j?.data?.key, fileType: j?.data?.fileType, fileSize: j?.data?.fileSize, uploadedAt: new Date().toISOString() });
    tasks[taskIndex] = { ...tasks[taskIndex], attachments: atts };
    const put = await fetch(`/api/deliveries/${deliveryId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reconTasks: tasks }) });
    if (put.ok) {
      const updated = await put.json();
      setItems((prev) => prev.map((it) => (String(it._id) === String(deliveryId) ? updated.data : it)));
    }
  };

  const onToggleBlocked = async (deliveryId: string, index: number, blocked: boolean) => {
    const d = items.find((x) => String(x._id) === String(deliveryId));
    if (!d) return;
    const tasks: ReconTask[] = Array.isArray(d.reconTasks) ? d.reconTasks.map((t) => ({ ...t })) : [];
    if (!tasks[index]) return;
    tasks[index] = { ...tasks[index], blocked };
    const res = await fetch(`/api/deliveries/${deliveryId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reconTasks: tasks }) });
    if (res.ok) {
      const j = await res.json();
      setItems((prev) => prev.map((it) => (String(it._id) === String(deliveryId) ? j.data : it)));
    }
  };

  const onUpdateBlockedReason = async (deliveryId: string, index: number, reason: string) => {
    const d = items.find((x) => String(x._id) === String(deliveryId));
    if (!d) return;
    const tasks: ReconTask[] = Array.isArray(d.reconTasks) ? d.reconTasks.map((t) => ({ ...t })) : [];
    if (!tasks[index]) return;
    tasks[index] = { ...tasks[index], blockedReason: reason, blocked: reason.trim() ? true : tasks[index].blocked };
    await fetch(`/api/deliveries/${deliveryId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reconTasks: tasks }) });
  };

  const onSetDueDate = async (deliveryId: string, index: number, isoDate: string) => {
    const d = items.find((x) => String(x._id) === String(deliveryId));
    if (!d) return;
    const tasks: ReconTask[] = Array.isArray(d.reconTasks) ? d.reconTasks.map((t) => ({ ...t })) : [];
    if (!tasks[index]) return;
    tasks[index] = { ...tasks[index], dueDate: isoDate };
    const res = await fetch(`/api/deliveries/${deliveryId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reconTasks: tasks }) });
    if (res.ok) {
      const j = await res.json();
      setItems((prev) => prev.map((it) => (String(it._id) === String(deliveryId) ? j.data : it)));
    }
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Recon Queue</h1>
        <div className="flex items-center gap-2">
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignees</SelectItem>
              {reconUsers.map(u => (
                <SelectItem key={u._id} value={u._id}>{u.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dueFilter} onValueChange={setDueFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Due" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Dates</SelectItem>
              <SelectItem value="due_soon">Due Soon (≤3d)</SelectItem>
              <SelectItem value="due_today">Due Today</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="no_due">No Due Date</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={load}>Refresh</Button>
        </div>
      </div>
      {loading ? (
        <div className="p-6">Loading...</div>
      ) : error ? (
        <div className="p-6 text-red-600">Error: {error}</div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">No vehicles pending recon</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((d) => {
            const car: any = d.car as any;
            const tasks0 = Array.isArray(d.reconTasks) ? d.reconTasks : [];
            const tasks = tasks0.filter(taskMatchesFilters);
            const done = tasks.filter((t) => !!t.done).length;
            const total = tasks.length;
            const allDone = total > 0 && done === total;
            const imageUrl = car && car.images && car.images[0] ? (car.images[0] as any).imageUrl : "/placeholder.svg";
            const title = car ? `${car.year ?? ""} ${car.make ?? ""} ${car.model ?? ""}`.trim() : "Vehicle";
            return (
              <Card key={d._id} data-testid="recon-card" className="overflow-hidden">
                <CardContent className="p-3 sm:p-4">
                  <img src={imageUrl} alt={title} className="w-full h-32 object-contain rounded" />
                  <div className="mt-2 flex items-center justify-between">
                    <h3 className="font-semibold truncate">{title}</h3>
                    <div className="flex items-center gap-2">
                      {d.reconReady ? (
                        <Badge className="bg-green-600 text-white">Ready</Badge>
                      ) : (
                        <Badge className="bg-yellow-600 text-white">Not Ready</Badge>
                      )}
                      <Badge variant="secondary" className="capitalize">{d.status}</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Delivery date {formatDate(d.deliveryDate)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${allDone ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
                      Recon {done}/{total}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border ${d.licensing?.done ? "bg-green-50 text-green-700 border-green-200" : "bg-yellow-50 text-yellow-700 border-yellow-200"}`}>
                      {d.licensing?.done ? "Licensing Done" : "Licensing Pending"}
                    </span>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {tasks.length === 0 ? (
                      <li className="text-sm text-muted-foreground">No recon tasks</li>
                    ) : (
                      tasks.map((t, idx) => (
                        <li key={idx} className="flex flex-col gap-2 border rounded p-2">
                          <div className="flex items-center gap-2">
                            <input
                              aria-label={`toggle-task-${idx}`}
                              type="checkbox"
                              className="h-4 w-4"
                              checked={!!t.done}
                              onChange={() => toggleTask(String(d._id), idx)}
                            />
                            <span className={`text-sm ${t.done ? "line-through text-muted-foreground" : ""}`}>{t.text}</span>
                            {t.assignee && (
                              <Badge variant="outline" className="ml-auto">{reconUsers.find(u => u._id === t.assignee)?.label || 'Assignee'}</Badge>
                            )}
                          </div>
                          {/* Due date and blocked */}
                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            <label className="flex items-center gap-2">
                              <span>Due:</span>
                              <input
                                type="date"
                                value={t.dueDate ? new Date(t.dueDate).toISOString().slice(0,10) : ''}
                                onChange={(e) => onSetDueDate(String(d._id), idx, e.target.value)}
                                className="border rounded px-2 py-1 text-xs"
                              />
                            </label>
                            {t.dueDate && !t.done && (
                              (() => {
                                const due = new Date(t.dueDate as string);
                                const now = new Date();
                                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                                const diff = due.getTime() - today.getTime();
                                const threeDays = 3 * 24 * 60 * 60 * 1000;
                                if (due.getTime() < today.getTime()) return <Badge className="bg-red-600 text-white">Overdue</Badge>;
                                if (diff >= 0 && diff <= threeDays) return <Badge className="bg-orange-500 text-white">Due Soon</Badge>;
                                return null;
                              })()
                            )}
                            <label className="flex items-center gap-2">
                              <input type="checkbox" checked={!!t.blocked} onChange={(e) => onToggleBlocked(String(d._id), idx, e.target.checked)} />
                              <span>Blocked</span>
                            </label>
                            {t.blocked && (
                              <input
                                type="text"
                                placeholder="Reason"
                                defaultValue={t.blockedReason || ''}
                                onBlur={(e) => onUpdateBlockedReason(String(d._id), idx, e.target.value)}
                                className="border rounded px-2 py-1 text-xs flex-1"
                              />
                            )}
                          </div>
                          {/* Attachments */}
                          <div className="flex flex-wrap items-center gap-3 text-xs">
                            <div className="flex items-center gap-2">
                              <span>Attachments:</span>
                              <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadAttachment(String(d._id), idx, f); }} />
                            </div>
                            {Array.isArray(t.attachments) && t.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {t.attachments.map((a, i) => (
                                  <a key={i} href={a.url} target="_blank" rel="noreferrer" className="underline text-blue-600">Photo {i+1}</a>
                                ))}
                              </div>
                            )}
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
