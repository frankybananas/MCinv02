"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarIcon, Plus, Trash2, Pencil, Check } from 'lucide-react';
import type { TodoItem } from '../types';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

// Very lightweight day selector without heavy deps
function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

  const load = async (iso?: string) => {
    const date = iso ?? selectedDate;
    try {
      setLoading(true);
      const res = await fetch(`/api/todos?date=${encodeURIComponent(date)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const message = typeof data?.error === 'string' ? data.error : 'Failed to load TODOs';
        throw new Error(message);
      }
      const fetchedItems = Array.isArray(data?.data) ? data.data : [];
      setItems(fetchedItems);
      setError(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load TODOs';
      setItems([]);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(selectedDate); }, [selectedDate]);

  const add = async () => {
    if (!newTitle.trim()) return;
    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          title: newTitle.trim(),
          time: newTime ? newTime : null,
        })
      });
      if (!res.ok) throw new Error('Failed to add TODO');
      setNewTitle('');
      setNewTime('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/todos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete TODO');
      await load();
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
        body: JSON.stringify({
          title: editingTitle,
          time: editingTime ? editingTime : null,
        })
      });
      if (!res.ok) throw new Error('Failed to update TODO');
      setEditingId(null);
      setEditingTitle('');
      setEditingTime('');
      await load();
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
        body: JSON.stringify({ order: i })
      })));
    } catch (e) {
      setError((e as Error).message);
      // Fallback reload
      await load();
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

  return (
    <div className="w-full space-y-4 px-3 pb-6 sm:px-4 sm:max-w-3xl mx-auto">
      {/* Monthly calendar */}
      <div className="rounded-xl border bg-white/80 shadow-sm overflow-hidden w-full">
        <DayPicker
          mode="single"
          selected={new Date(selectedDate + 'T12:00:00.000Z')}
          onSelect={(d) => d && setSelectedDate(toIsoDate(d))}
          weekStartsOn={1}
          showOutsideDays
          className="w-full"
          styles={{
            root: { width: '100%', maxWidth: '100%' },
            month: { width: '100%', margin: 0 },
            table: { width: '100%' },
            caption: { fontWeight: 600, padding: '0.5rem 0', textAlign: 'center' },
          }}
        />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {strip.map((d) => {
          const isActive = d === selectedDate;
          const label = new Date(d + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          return (
            <Button key={d} size="sm" variant={isActive ? 'default' : 'ghost'} className="rounded-full shrink-0" onClick={() => setSelectedDate(d)}>
              <CalendarIcon className="w-4 h-4 mr-1" /> {label}
            </Button>
          );
        })}
      </div>

      <Card className="w-full">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <form
            className="flex flex-col sm:flex-row gap-3 sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <div className="flex-1 min-w-0 w-full">
              <label htmlFor="todo-title" className="block text-xs font-medium text-muted-foreground mb-1">
                Title
              </label>
              <Input
                id="todo-title"
                placeholder="New entry (e.g. Call client)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
              />
            </div>
            <div className="w-full sm:w-40">
              <label htmlFor="todo-time" className="block text-xs font-medium text-muted-foreground mb-1">
                Time (optional)
              </label>
              <Input
                id="todo-time"
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                step={300}
              />
            </div>
            <div className="sm:w-auto w-full">
              <Button type="submit" disabled={!newTitle.trim()} className="w-full sm:w-auto">
                <Plus className="w-4 h-4 mr-1" /> Add Entry
              </Button>
            </div>
          </form>
          {loading ? (
            <p className="mt-3 text-sm text-muted-foreground">Loading...</p>
          ) : error ? (
            <p className="mt-3 text-sm text-red-500">{error}</p>
          ) : items.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No entries for this day.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {items.map((t) => (
                <li
                  key={t._id}
                  className="flex items-center justify-between border rounded-md p-2"
                  draggable
                  onDragStart={() => onDragStart(t._id)}
                  onDragOver={onDragOver}
                  onDrop={() => onDrop(t._id)}
                >
                  <div className="flex-1 min-w-0 pr-2">
                    {editingId === t._id ? (
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <Input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') void saveEdit(); }}
                          autoFocus
                        />
                        <Input
                          type="time"
                          value={editingTime}
                          onChange={(e) => setEditingTime(e.target.value)}
                          step={300}
                        />
                        <Button size="icon" variant="secondary" onClick={saveEdit} aria-label="Save">
                          <Check className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <p className="font-medium text-sm truncate">{t.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.time ? `${t.time} · ` : ''}{new Date(t.date).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {editingId !== t._id && (
                      <Button variant="ghost" size="icon" onClick={() => startEdit(t._id, t.title, t.time)} aria-label="Edit">
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => remove(t._id)} aria-label="Delete">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
