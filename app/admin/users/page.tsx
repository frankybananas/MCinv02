"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';

interface User {
  _id: string;
  phone: string;
  position?: string;
  department: 'new' | 'used';
  profile: {
    firstName: string;
    lastName: string;
  };
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    position: '',
    department: 'new',
    phone: '',
  });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data.data);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const addUser = async () => {
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: form.phone,
          position: form.position,
          department: form.department,
          profile: {
            firstName: form.firstName,
            lastName: form.lastName,
          },
        }),
      });
      if (!res.ok) throw new Error('Failed to add user');
      await fetchUsers();
      setDialogOpen(false);
      setForm({ firstName: '', lastName: '', position: '', department: 'new', phone: '' });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Admin – Users</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" /> Add User
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label>Name</Label>
                  <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
                </div>
                <div className="flex-1">
                  <Label>Surname</Label>
                  <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label>Position</Label>
                  <Input value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
                </div>
                <div className="flex-1">
                  <Label>Department (new / used)</Label>
                  <Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value as 'new' | 'used' })} />
                </div>
              </div>
              <div>
                <Label>Mobile Number</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <Button onClick={addUser} disabled={loading}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : error ? (
        <p className="text-red-500">Error: {error}</p>
      ) : (
        users.length === 0 ? (
          <p>No users found.</p>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <Card key={user._id}>
                <CardHeader>
                  <CardTitle>{user.profile.firstName} {user.profile.lastName}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground grid grid-cols-2 gap-2">
                  <span className="font-medium">Mobile:</span> {user.phone}
                  <span className="font-medium">Position:</span> {user.position || '-'}
                  <span className="font-medium">Department:</span> {user.department}
                </CardContent>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
