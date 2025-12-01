import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import CreateUserForm from '@/app/components/admin/create-user-form';
import UserList from '@/app/components/admin/user-list';
import StorageMonitor from '@/app/components/admin/storage-monitor';

export default function AdminPage() {
  return (
    <div className="container mx-auto py-10 px-4 md:px-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <Link href="/" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
      <p className="text-muted-foreground mb-6">Welcome to the admin panel. Here you can manage users and monitor storage.</p>
      <div className="space-y-8">
        <StorageMonitor />
        <CreateUserForm />
        <UserList />
      </div>
    </div>
  );
}
