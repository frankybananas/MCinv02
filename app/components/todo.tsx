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
      setError(null);
      const payload = {
        date: selectedDate,
        title: newTitle.trim(),
        time: newTime?.trim() || null
      };
      
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cookie': document.cookie // Ensure cookies are sent with the request
        },
        credentials: 'include', // Include credentials for cross-origin requests
        body: JSON.stringify(payload)
      });
      
      const data = await res.json().catch(() => ({}));
      
      if (!res.ok) {
        const errorMessage = data?.error || 'Failed to add TODO';
        throw new Error(typeof errorMessage === 'string' ? errorMessage : 'Failed to add TODO');
      }
      
      setNewTitle('');
      setNewTime('');
      await load();
    } catch (e) {
      console.error('Error adding TODO:', e);
      setError((e as Error).message || 'Failed to add TODO');
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
    <div className="w-full max-w-full overflow-x-hidden px-1 sm:px-2 pb-4 mx-auto">
      {/* Monthly calendar - full width but contained */}
      <div className="w-full max-w-full overflow-hidden rounded-lg border bg-white/80 shadow-sm mb-3">
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
              fontSize: '0.9rem'
            },
            nav: { display: 'flex', justifyContent: 'space-between', padding: '0 0.25rem' },
            head_cell: { padding: '0.15rem', textAlign: 'center', fontSize: '0.7rem' },
            cell: { padding: '0.15rem', fontSize: '0.8rem' },
            day: { width: '1.75rem', height: '1.75rem', margin: '0.05rem' }
          }}
        />
      </div>

      {/* Date strip with horizontal scrolling */}
      <div className="w-full overflow-x-auto pb-2 -mx-1">
        <div className="flex gap-1.5 px-1 w-max min-w-full">
          {strip.map((d) => {
            const isActive = d === selectedDate;
            const day = new Date(d + 'T12:00:00');
            const dayOfWeek = day.toLocaleDateString(undefined, { weekday: 'short' });
            const dayOfMonth = day.getDate();
            
            return (
              <Button 
                key={d} 
                size="sm" 
                variant={isActive ? 'default' : 'outline'} 
                className="flex-col h-12 w-10 p-0.5 rounded-md text-xs" 
                onClick={() => setSelectedDate(d)}
              >
                <span className="text-[0.65rem] font-normal leading-none">{dayOfWeek}</span>
                <span className="text-sm font-medium leading-none mt-0.5">{dayOfMonth}</span>
              </Button>
            );
          })}
        </div>
      </div>

      <Card className="w-full mt-3">
        <CardContent className="p-2 space-y-2">
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <div className="grid grid-cols-1 gap-2">
              <div className="space-y-1">
                <Input
                  id="todo-title"
                  placeholder="New entry (e.g. Call client)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  className="w-full"
                />
              </div>
              
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    id="todo-time"
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    step={300}
                    className="w-full"
                  />
                </div>
                
                <Button 
                  type="submit" 
                  disabled={!newTitle.trim()} 
                  className="h-9 px-3"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </form>

          {loading ? (
            <div className="flex justify-center py-4">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : error ? (
            <div className="rounded-md bg-red-50 p-3">
              <p className="text-sm text-red-700">{error}</p>
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
                  <div className="min-w-0 pr-2">
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
                          <Input
                            type="time"
                            value={editingTime}
                            onChange={(e) => setEditingTime(e.target.value)}
                            step={300}
                            className="flex-1"
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
