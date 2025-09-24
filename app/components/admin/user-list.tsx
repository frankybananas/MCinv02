'use client';

import { useState, useEffect } from 'react';

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
  createdAt: string;
}

export default function UserList() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  if (loading) return <p>Loading users...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div className="mt-8">
      <h2 className="text-2xl font-semibold mb-4">Existing Users</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border">
          <thead>
            <tr className="w-full bg-gray-100 text-left">
              <th className="p-3">Name</th>
              <th className="p-3">Phone</th>
              <th className="p-3">Department</th>
              <th className="p-3">Role</th>
              <th className="p-3">Matching</th>
              <th className="p-3">TODO Access</th>
              <th className="p-3">Created At</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user._id} className="border-b">
                <td className="p-3">{user.profile.firstName} {user.profile.lastName}</td>
                <td className="p-3">{user.phone}</td>
                <td className="p-3">{user.department}</td>
                <td className="p-3">{user.role}</td>
                <td className="p-3">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={user.matchingEnabled !== false}
                      onChange={(e) => toggleMatching(user._id, e.target.checked)}
                    />
                    <span>{user.matchingEnabled !== false ? 'Enabled' : 'Disabled'}</span>
                  </label>
                </td>
                <td className="p-3">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={user.todoEnabled === true}
                      onChange={(e) => toggleTodo(user._id, e.target.checked)}
                    />
                    <span>{user.todoEnabled ? 'Enabled' : 'Disabled'}</span>
                  </label>
                </td>
                <td className="p-3">{new Date(user.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
