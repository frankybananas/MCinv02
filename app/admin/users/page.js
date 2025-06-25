"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    phone: '',
    role: 'user',
    isTestAccount: false,
    profile: {
      firstName: '',
      lastName: '',
      email: '',
    }
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      setLoading(true);
      const response = await fetch('/api/users');
      const data = await response.json();
      
      if (data.success) {
        setUsers(data.data);
      } else {
        setError('Failed to fetch users');
      }
    } catch (err) {
      setError('Error fetching users: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: value
        }
      }));
    } else if (type === 'checkbox') {
      setFormData(prev => ({
        ...prev,
        [name]: checked
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  }

  function handleRoleChange(value) {
    setFormData(prev => ({
      ...prev,
      role: value
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess('');
    
    try {
      // Always set isAuthorized to true for admin-added users
      const userData = {
        ...formData,
        isAuthorized: true
      };
      
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('User added successfully');
        setFormData({
          phone: '',
          role: 'user',
          isTestAccount: false,
          profile: {
            firstName: '',
            lastName: '',
            email: '',
          }
        });
        fetchUsers();
      } else {
        setError(data.message || 'Failed to add user');
      }
    } catch (err) {
      setError('Error adding user: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteUser(id) {
    if (!confirm('Are you sure you want to delete this user?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
      });
      
      const data = await response.json();
      
      if (data.success) {
        setSuccess('User deleted successfully');
        fetchUsers();
      } else {
        setError(data.message || 'Failed to delete user');
      }
    } catch (err) {
      setError('Error deleting user: ' + err.message);
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Manage Authorized Users</h1>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          {success}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Add New Authorized User</CardTitle>
            <CardDescription>
              Add a new user who will be authorized to access the application
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  name="phone"
                  placeholder="+1 650-555-3434"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                />
                <p className="text-xs text-gray-500">
                  Format: +[country code] [number], e.g., +1 650-555-3434
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Select 
                  value={formData.role} 
                  onValueChange={handleRoleChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isTestAccount"
                  name="isTestAccount"
                  checked={formData.isTestAccount}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="isTestAccount">Test Account</Label>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="profile.firstName">First Name</Label>
                <Input
                  id="profile.firstName"
                  name="profile.firstName"
                  value={formData.profile.firstName}
                  onChange={handleChange}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="profile.lastName">Last Name</Label>
                <Input
                  id="profile.lastName"
                  name="profile.lastName"
                  value={formData.profile.lastName}
                  onChange={handleChange}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="profile.email">Email</Label>
                <Input
                  id="profile.email"
                  name="profile.email"
                  type="email"
                  value={formData.profile.email}
                  onChange={handleChange}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Adding...' : 'Add User'}
              </Button>
            </CardFooter>
          </form>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Authorized Users</CardTitle>
            <CardDescription>
              List of all users authorized to access the application
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Loading users...</p>
            ) : users.length === 0 ? (
              <p>No authorized users found.</p>
            ) : (
              <div className="space-y-4">
                {users.map(user => (
                  <div key={user._id} className="border p-4 rounded-md">
                    <div className="flex justify-between">
                      <h3 className="font-semibold">{user.profile?.firstName || ''} {user.profile?.lastName || ''}</h3>
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleDeleteUser(user._id)}
                      >
                        Delete
                      </Button>
                    </div>
                    <p className="text-sm">Phone: {user.phone}</p>
                    <p className="text-sm">Role: {user.role}</p>
                    <p className="text-sm">Email: {user.profile?.email || 'N/A'}</p>
                    <p className="text-sm">Test Account: {user.isTestAccount ? 'Yes' : 'No'}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
