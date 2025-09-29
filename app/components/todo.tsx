"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarIcon, Plus, Trash2, Pencil } from 'lucide-react';
import type { TodoItem } from '../types';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { cn } from '@/lib/utils';

// Very lightweight day selector without heavy deps
function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface TimeInputFieldProps {
  inputId: string;
  value: string;
  onChange: (value: string) => void;
  wrapperClassName?: string;
}

function TimeInputField({ inputId, value, onChange, wrapperClassName }: TimeInputFieldProps) {
  return (
    <div className={cn('relative', wrapperClassName)}>
      <Input
        id={inputId}
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        step={300}
        className="w-full pl-20"
        aria-label="Time"
      />
      {!value && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 rounded-md bg-white px-2 py-0.5 text-xs font-medium text-muted-foreground shadow-sm dark:bg-slate-900">
          Optional: Time
        </span>
      )}
    </div>
  );
}

export function Todo() {
  const [selectedDate, setSelectedDate] = useState<string>(toIsoDate(new Date()));
  const [items, setItems] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [editingTime, setEditingTime] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [monthOverview, setMonthOverview] = useState<Record<string, number>>({});

  const load = async (iso?: string): Promise<TodoItem[]> => {
    const date = iso ?? selectedDate;
    try {
      setLoading(true);
      const res = await fetch(`/api/todos?date=${encodeURIComponent(date)}`, { credentials: 'include' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = typeof data?.error === 'string' ? data.error : 'Failed to load TODOs';
        throw new Error(message);
      }
      const fetchedItems = Array.isArray(data?.data) ? data.data : [];
      setItems(fetchedItems);
      setError(null);
      return fetchedItems;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load TODOs';
      setItems([]);
      setError(message);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const loadMonthOverview = async (iso: string) => {
    try {
      const res = await fetch(`/api/todos?date=${encodeURIComponent(iso)}&range=month`, { credentials: 'include' });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        return;
      }
      const overview = data?.overview as Record<string, number> | undefined;
      if (overview && typeof overview === 'object') {
        setMonthOverview(overview);
      }
    } catch {
      // Ignore overview errors
    }
  };

  useEffect(() => { void load(selectedDate); }, [selectedDate]);
  const monthKey = selectedDate.slice(0, 7);
  useEffect(() => { void loadMonthOverview(selectedDate); }, [monthKey, selectedDate]);

  const add = async () => {
    if (!newTitle.trim()) return;
    try {
      setError(null);
      const payload = {
        date: selectedDate,
        title: newTitle.trim(),
        time: newTime?.trim() || null
      };
      
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        const errorMessage = data?.error || (res.status === 401 ? 'Unauthorized' : 'Failed to add TODO');
        throw new Error(typeof errorMessage === 'string' ? errorMessage : 'Failed to add TODO');
      }
      
      setNewTitle('');
      setNewTime('');
      const updated = await load();
      setMonthOverview((prev) => ({ ...prev, [selectedDate]: updated.length }));
    } catch (e) {
      console.error('Error adding TODO:', e);
      setError((e as Error).message || 'Failed to add TODO');
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/todos/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to delete TODO');
      const updated = await load();
      setMonthOverview((prev) => ({ ...prev, [selectedDate]: updated.length }));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const startEdit = (id: string, title: string, time?: string | null) => {
    setEditingId(id);
    setEditingTitle(title);
    setEditingTime(time ?? '');
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      const res = await fetch(`/api/todos/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: editingTitle,
          time: editingTime ? editingTime : null,
        })
      });
      if (!res.ok) throw new Error('Failed to update TODO');
      setEditingId(null);
      setEditingTitle('');
      setEditingTime('');
      const updated = await load();
      setMonthOverview((prev) => ({ ...prev, [selectedDate]: updated.length }));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // Drag-and-drop ordering
  const [dragId, setDragId] = useState<string | null>(null);
  const onDragStart = (id: string) => setDragId(id);
  const onDragOver = (e: React.DragEvent) => e.preventDefault();
  const onDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const idxFrom = items.findIndex(i => i._id === dragId);
    const idxTo = items.findIndex(i => i._id === targetId);
    if (idxFrom === -1 || idxTo === -1) return;
    const reordered = [...items];
    const [moved] = reordered.splice(idxFrom, 1);
    reordered.splice(idxTo, 0, moved);
    setItems(reordered);
    setDragId(null);
    // Persist new ordering sequentially
    try {
      await Promise.all(reordered.map((it, i) => fetch(`/api/todos/${it._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ order: i })
      })));
    } catch (e) {
      setError((e as Error).message);
      // Fallback reload
      const updated = await load();
      setMonthOverview((prev) => ({ ...prev, [selectedDate]: updated.length }));
    }
  };

  // Simple 7-day strip navigation
  const strip = useMemo(() => {
    const base = new Date(selectedDate + 'T12:00:00.000Z');
    const days: string[] = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      days.push(toIsoDate(d));
    }
    return days;
  }, [selectedDate]);

  const eventsByDate = useMemo(() => {
    return new Map<string, number>(Object.entries(monthOverview || {}));
  }, [monthOverview]);

  const selectedDay = useMemo(() => {
    const date = new Date(selectedDate + 'T12:00:00.000Z');
    const weekday = date.toLocaleDateString(undefined, { weekday: 'long' });
    const formatted = date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
    return { weekday, formatted };
  }, [selectedDate]);

  return (
    <div className="relative w-full max-w-full min-w-0 px-1 sm:px-2 pb-[calc(9rem+env(safe-area-inset-bottom))] mx-auto overflow-x-hidden">
      <div className="pointer-events-none fixed left-4 bottom-[calc(7.25rem+env(safe-area-inset-bottom))] z-50 sm:left-6">
        <div className="relative">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-3 rounded-full bg-slate-900/25 blur-lg shadow-[0_24px_44px_-18px_rgba(15,23,42,0.6)] dark:bg-slate-200/20"
          />
          <Button
            type="button"
            size="icon"
            onClick={() => setShowForm((prev) => !prev)}
            aria-expanded={showForm}
            aria-label={showForm ? 'Hide new entry form' : 'Open new entry form'}
            className={`pointer-events-auto h-14 w-14 rounded-full border border-white/30 bg-white/50 text-slate-900 shadow-xl ring-1 ring-white/70 backdrop-blur-2xl transition-all duration-300 hover:bg-white/60 dark:text-white dark:ring-slate-700/70 ${showForm ? 'rotate-45' : ''}`}
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Monthly calendar - full width but contained */}
      <div className="w-full max-w-full min-w-0 overflow-hidden rounded-lg border bg-white/80 shadow-sm mb-3">
        <DayPicker
          mode="single"
          selected={new Date(selectedDate + 'T12:00:00.000Z')}
          onSelect={(d) => d && setSelectedDate(toIsoDate(d))}
          weekStartsOn={1}
          showOutsideDays
          className="w-full"
          styles={{
            root: { width: '100%', maxWidth: '100%' },
            months: { width: '100%' },
            month: { width: '100%', margin: 0, padding: '0.25rem' },
            table: { width: '100%' },
            caption: {
              fontWeight: 600,
              padding: '0.25rem 0',
              textAlign: 'center',
              position: 'relative',
              marginBottom: '0.25rem',
              fontSize: '0.9rem',
            },
            nav: { display: 'flex', justifyContent: 'space-between', padding: '0 0.25rem' },
            head_cell: { padding: '0.15rem', textAlign: 'center', fontSize: '0.7rem' },
            cell: { padding: '0.15rem', fontSize: '0.8rem' },
            day: { width: '1.75rem', height: '1.75rem', margin: '0.05rem' },
          }}
          modifiers={{
            hasEntries: (d) => (eventsByDate.get(toIsoDate(d)) ?? 0) > 0,
          }}
          modifiersClassNames={{
            hasEntries: 'relative after:absolute after:inset-x-[28%] after:bottom-1 after:h-1.5 after:rounded-full after:bg-blue-500 after:content-[""]',
          }}
          modifiersStyles={{
            hasEntries: {
              boxShadow: '0 0 0 1px rgba(37, 99, 235, 0.35) inset',
              borderRadius: '999px',
              color: 'rgb(37 99 235)',
            },
          }}
        />
      </div>

      {/* Date strip with horizontal scrolling */}
      <div
        className="w-full min-w-0 overflow-x-auto pb-2 mx-0 sm:-mx-1 [-ms-overflow-style:none] scrollbar-thin scrollbar-transparent"
        style={{ scrollbarWidth: 'none' }}
      >
        <div className="flex gap-1.5 px-1 w-max" style={{ msOverflowStyle: 'none' }}>
          {strip.map((iso) => {
            const isActive = iso === selectedDate;
            const hasItems = (eventsByDate.get(iso) ?? 0) > 0;
            const dateObj = new Date(iso + 'T12:00:00.000Z');
            const dayOfWeek = dateObj.toLocaleDateString(undefined, { weekday: 'short' });
            const dayOfMonth = dateObj.getDate();

            return (
              <Button
                key={iso}
                size="sm"
                variant={isActive ? 'default' : 'outline'}
                className={cn(
                  'flex flex-col items-center justify-center h-12 w-12 rounded-lg p-0.5 text-xs transition-colors',
                  hasItems && !isActive && 'border border-blue-400/80 bg-blue-50/60 text-blue-700 shadow-sm',
                  isActive && 'shadow-md'
                )}
                onClick={() => setSelectedDate(iso)}
              >
                <span className="text-[0.65rem] font-normal leading-none">{dayOfWeek}</span>
                <span className="text-sm font-medium leading-none mt-0.5">{dayOfMonth}</span>
              </Button>
            );
          })}
        </div>
      </div>

      <Card className="mb-3 bg-white/80 shadow-sm w-full min-w-0">
        <CardContent className="p-3 min-w-0">
          <h2 className="text-base font-semibold text-slate-800">{selectedDay.weekday}</h2>
          <p className="text-xs text-muted-foreground">{selectedDay.formatted}</p>
        </CardContent>
      </Card>

      {showForm && (
        <Card className="w-full min-w-0 mb-3">
          <CardContent className="p-2 space-y-2 min-w-0">
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void add();
              }}
            >
              <div className="grid grid-cols-1 gap-2">
                <div className="space-y-1">
                  <Input
                    id="todo-title"
                    placeholder="New entry (e.g. Call client)"
                    value={newTitle}
                    onChange={(event) => setNewTitle(event.target.value)}
                    required
                    className="w-full"
                  />
                </div>

                <div className="flex gap-2">
                  <TimeInputField
                    inputId="todo-time"
                    value={newTime}
                    onChange={setNewTime}
                    wrapperClassName="flex-1 min-w-0"
                  />

                  <Button
                    type="submit"
                    disabled={!newTitle.trim()}
                    className="h-9 w-10"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="w-full min-w-0">
        <CardContent className="p-2 space-y-2 min-w-0">
          {loading ? (
            <div className="flex justify-center py-4">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : error ? (
            <div className="rounded-md bg-red-50 p-3">
              <p className="text-sm text-red-700">{error === 'Unauthorized' ? 'Unauthorized — please sign in again.' : error}</p>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-md bg-muted/30 p-4 text-center">
              <p className="text-sm text-muted-foreground">No entries for this day.</p>
            </div>
          ) : (
            <ul className="space-y-2 mt-3">
              {items.map((t) => (
                <li
                  key={t._id}
                  className="flex items-center justify-between rounded-lg border bg-card p-3"
                  draggable
                  onDragStart={() => onDragStart(t._id)}
                  onDragOver={onDragOver}
                  onDrop={() => onDrop(t._id)}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    {editingId === t._id ? (
                      <div className="space-y-2 w-full">
                        <Input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') void saveEdit(); }}
                          autoFocus
                          className="w-full"
                        />
                        <div className="flex gap-2">
                          <TimeInputField
                            inputId={`todo-edit-time-${t._id}`}
                            value={editingTime}
                            onChange={(value) => setEditingTime(value)}
                            wrapperClassName="flex-1 min-w-0"
                          />
                          <Button size="sm" variant="outline" onClick={saveEdit}>
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-0.5">
                        <p className="font-medium text-sm truncate">{t.title}</p>
                        <div className="flex items-center text-xs text-muted-foreground">
                          {t.time && (
                            <span className="inline-flex items-center">
                              <CalendarIcon className="w-3 h-3 mr-1" />
                              {t.time}
                            </span>
                          )}
                          {t.time && <span className="mx-1">•</span>}
                          <span>{new Date(t.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {editingId !== t._id && (
                    <div className="flex items-center gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(t._id, t.title, t.time);
                        }} 
                        className="h-8 w-8"
                        aria-label="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(t._id);
                        }} 
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
