"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function CreateUserForm() {
  const [phone, setPhone] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setIsError(false);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone, firstName, lastName, department, role }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(data.message || 'User created successfully!');
        setIsError(false);
        // Clear form
        setPhone('');
        setFirstName('');
        setLastName('');
        setDepartment('');
        setRole('');
      } else {
        setMessage(data.error || 'Failed to create user.');
        setIsError(true);
      }
    } catch (error) {
      console.error('Error creating user:', error);
      setMessage('An unexpected error occurred.');
      setIsError(true);
    }
  };

  return (
    <Card className="border-gray-200">
      <CardHeader className="space-y-1 pb-6">
        <CardTitle className="text-xl">Create New User</CardTitle>
        <CardDescription>Enter the details for the new user.</CardDescription>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              placeholder="Phone Number (e.g., +1234567890)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="h-11"
            />
            <Select value={role} onValueChange={setRole} required>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="h-11"
            />
            <Input
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="h-11"
            />
            <Select value={department} onValueChange={setDepartment} required>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select a department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="used">Used</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="pt-2">
            <Button type="submit" className="w-full md:w-auto px-8 h-11">Create User</Button>
          </div>
        </form>
        {message && (
          <p className={`mt-5 text-sm font-medium ${isError ? 'text-red-600' : 'text-green-600'}`}>
            {message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
