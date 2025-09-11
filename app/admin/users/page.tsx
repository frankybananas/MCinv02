import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import CreateUserForm from '@/app/components/admin/create-user-form';
import UserList from '@/app/components/admin/user-list';

export default function AdminUsersPage() {
  return (
    <div className="container mx-auto py-10">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">Admin – Users</h1>
        <Link href="/" passHref>
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
      </div>
      <p className="text-muted-foreground mb-6">Create and manage application users.</p>
      <div className="space-y-8">
        <CreateUserForm />
        <UserList />
      </div>
    </div>
  );
}
