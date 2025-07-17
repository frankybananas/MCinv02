import React from 'react';
import CreateUserForm from '@/app/components/admin/create-user-form';
import UserList from '@/app/components/admin/user-list';

export default function AdminPage() {
  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold">Admin Panel</h1>
      <p className="text-muted-foreground">Welcome to the admin panel. Here you can manage users.</p>
      <CreateUserForm />
      <UserList />
    </div>
  );
}
