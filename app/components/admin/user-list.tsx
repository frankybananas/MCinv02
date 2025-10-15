'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2 } from 'lucide-react';
import EditUserDialog from './edit-user-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface User {
  _id: string;
  phone: string;
  profile: {
    firstName: string;
    lastName: string;
  };
  department: string;
  role: string;
  matchingEnabled?: boolean;
  todoEnabled?: boolean;
  marketingEnabled?: boolean;
  createdAt: string;
}

export default function UserList() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const reload = async () => {
    const res = await fetch('/api/admin/users');
    if (!res.ok) throw new Error('Failed to fetch users');
    const data = await res.json();
    setUsers(data.data);
  };

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        await reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const toggleMatching = async (userId: string, next: boolean) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, matchingEnabled: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Failed to update user');
      }
      await reload();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const toggleTodo = async (userId: string, next: boolean) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, todoEnabled: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Failed to update user');
      }
      await reload();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const toggleMarketing = async (userId: string, next: boolean) => {
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, marketingEnabled: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Failed to update user');
      }
      await reload();
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setIsEditDialogOpen(true);
  };

  const handleDeleteClick = (user: User) => {
    setDeletingUser(user);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingUser) return;

    try {
      const res = await fetch(`/api/admin/users?userId=${deletingUser._id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Failed to delete user');
      }
      await reload();
      setIsDeleteDialogOpen(false);
      setDeletingUser(null);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  if (loading) return <p>Loading users...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <>
      <div className="mt-8">
        <h2 className="text-2xl font-semibold mb-6">Existing Users</h2>
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full bg-white">
            <thead>
              <tr className="w-full bg-gray-50 text-left border-b border-gray-200">
                <th className="px-6 py-4 font-medium text-gray-700">Name</th>
                <th className="px-6 py-4 font-medium text-gray-700">Phone</th>
                <th className="px-6 py-4 font-medium text-gray-700">Department</th>
                <th className="px-6 py-4 font-medium text-gray-700">Role</th>
                <th className="px-6 py-4 font-medium text-gray-700">Matching</th>
                <th className="px-6 py-4 font-medium text-gray-700">TODO</th>
                <th className="px-6 py-4 font-medium text-gray-700">Marketing</th>
                <th className="px-6 py-4 font-medium text-gray-700">Created</th>
                <th className="px-6 py-4 font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">{user.profile.firstName} {user.profile.lastName}</td>
                  <td className="px-6 py-4">{user.phone}</td>
                  <td className="px-6 py-4 capitalize">{user.department}</td>
                  <td className="px-6 py-4 capitalize">{user.role}</td>
                  <td className="px-6 py-4">
                    <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={user.matchingEnabled !== false}
                        onChange={(e) => toggleMatching(user._id, e.target.checked)}
                        className="w-4 h-4 cursor-pointer"
                      />
                      <span>{user.matchingEnabled !== false ? 'On' : 'Off'}</span>
                    </label>
                  </td>
                  <td className="px-6 py-4">
                    <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={user.todoEnabled === true}
                        onChange={(e) => toggleTodo(user._id, e.target.checked)}
                        className="w-4 h-4 cursor-pointer"
                      />
                      <span>{user.todoEnabled ? 'On' : 'Off'}</span>
                    </label>
                  </td>
                  <td className="px-6 py-4">
                    <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={user.marketingEnabled === true}
                        onChange={(e) => toggleMarketing(user._id, e.target.checked)}
                        className="w-4 h-4 cursor-pointer"
                      />
                      <span>{user.marketingEnabled ? 'On' : 'Off'}</span>
                    </label>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(user)}
                        className="h-8 w-8 p-0"
                        title="Edit user"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteClick(user)}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Delete user"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <EditUserDialog
        user={editingUser}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        onSuccess={reload}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deletingUser?.profile.firstName} {deletingUser?.profile.lastName}'s account.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
